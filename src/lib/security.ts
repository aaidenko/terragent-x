import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

let eoInFlight = 0;
const EO_MAX_CONCURRENT = 1;
const SESSION_TTL_MS = 60 * 60 * 1000;

const MIN_SECRET_LENGTH = 32;
const MAX_BUCKETS = 20_000;

/**
 * Session HMAC key. There is deliberately NO hardcoded fallback: if the host
 * has not provided a strong secret, sessions are refused (fail closed).
 *
 * Preferred: TERRAGENT_SESSION_SECRET (>= 32 chars, random).
 * Accepted alternative: CURSOR_APP_SECRET (host-provided app secret); it is
 * domain-separated so the raw value is never used directly as this key.
 */
function sessionKey(): Buffer | null {
  const own = process.env.TERRAGENT_SESSION_SECRET?.trim();
  if (own && own.length >= MIN_SECRET_LENGTH) return Buffer.from(own, "utf8");
  const host = process.env.CURSOR_APP_SECRET?.trim();
  if (host && host.length >= MIN_SECRET_LENGTH) {
    return createHmac("sha256", host).update("terragent-session-v2").digest();
  }
  return null;
}

export function sessionsConfigured(): boolean {
  return sessionKey() !== null;
}

/**
 * Number of trusted reverse proxies in front of the app that each append the
 * address they saw to X-Forwarded-For. The client IP is taken N entries from
 * the RIGHT, so anything a client prepends is ignored. 0 = trust no proxy
 * headers (all callers share one rate-limit bucket: strict, never bypassable).
 */
function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw == null || raw.trim() === "") return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 10) return 1;
  return n;
}

function normalizeIp(value: string | undefined): string | null {
  const v = value?.trim().toLowerCase();
  if (!v || v.length > 64) return null;
  // IPv4, IPv6 (optionally bracketed), with optional port; nothing else.
  if (!/^[0-9a-f:.\[\]]+$/.test(v)) return null;
  return v;
}

export function clientIp(request: Request): string {
  const hops = trustedProxyHops();
  if (hops === 0) return "direct";
  const xf = request.headers.get("x-forwarded-for");
  if (!xf) return "unknown";
  const chain = xf
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length === 0) return "unknown";
  // Rightmost `hops` entries were written by our trusted proxies; the client
  // is the entry the outermost trusted proxy saw. If the chain is shorter than
  // expected, use the leftmost entry (all present entries are proxy-written).
  const idx = Math.max(0, chain.length - hops);
  return normalizeIp(chain[idx]) ?? "unknown";
}

function pruneBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    pruneBuckets(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true };
}

function sign(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export type IssueResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unconfigured" | "rate_limited" };

export function issueSession(ip: string): IssueResult {
  const key = sessionKey();
  if (!key) return { ok: false, reason: "unconfigured" };
  const gated = rateLimit(`session:${ip}`, 5, 60_000);
  if (!gated.ok) return { ok: false, reason: "rate_limited" };
  const nonce = randomBytes(16).toString("hex");
  const exp = Date.now() + SESSION_TTL_MS;
  const body = `${exp}.${nonce}`;
  return { ok: true, token: `${body}.${sign(key, body)}` };
}

/**
 * Returns the session id (the signed nonce) for a valid session header, or
 * null. Fails closed when no host secret is configured.
 */
export function sessionId(request: Request): string | null {
  const key = sessionKey();
  if (!key) return null;
  const header = request.headers.get("x-terragent-session")?.trim();
  if (!header) return null;
  const parts = header.split(".");
  if (parts.length !== 3) return null;
  const [expStr, nonce, sig] = parts;
  if (!expStr || !nonce || !sig) return null;
  if (!/^[0-9]{1,16}$/.test(expStr)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) return null;
  const expected = sign(key, `${expStr}.${nonce}`);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? nonce : null;
  } catch {
    return null;
  }
}

export function requireSession(request: Request): boolean {
  return sessionId(request) !== null;
}

export function clampEoInput(body: {
  lat?: unknown;
  lon?: unknown;
  pad_deg?: unknown;
}): { ok: true; lat: number; lon: number; pad_deg: number } | { ok: false; error: string } {
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const pad = body.pad_deg == null ? 0.12 : Number(body.pad_deg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pad)) {
    return { ok: false, error: "lat, lon, and pad_deg must be finite numbers" };
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false, error: "lat/lon out of range" };
  }
  if (pad <= 0 || pad > 0.15) {
    return { ok: false, error: "pad_deg must be between 0 and 0.15" };
  }
  return { ok: true, lat, lon, pad_deg: pad };
}

export function tryAcquireEoSlot(): boolean {
  if (eoInFlight >= EO_MAX_CONCURRENT) return false;
  eoInFlight += 1;
  return true;
}

export function releaseEoSlot() {
  eoInFlight = Math.max(0, eoInFlight - 1);
}

export function publicError(message: string) {
  return { ok: false as const, error: message };
}
