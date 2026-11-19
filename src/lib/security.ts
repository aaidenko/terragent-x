import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

let eoInFlight = 0;
const EO_MAX_CONCURRENT = 1;
const SESSION_TTL_MS = 60 * 60 * 1000;

function sessionSecret(): string {
  return (
    process.env.TERRAGENT_SESSION_SECRET ||
    process.env.CURSOR_APP_SECRET ||
    "terragent-demo-session-v1"
  );
}

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
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

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function issueSession(ip: string): string | null {
  const gated = rateLimit(`session:${ip}`, 5, 60_000);
  if (!gated.ok) return null;
  const nonce = randomBytes(16).toString("hex");
  const exp = Date.now() + SESSION_TTL_MS;
  const body = `${exp}.${nonce}`;
  return `${body}.${sign(body)}`;
}

export function requireSession(request: Request): boolean {
  const header = request.headers.get("x-terragent-session")?.trim();
  if (!header) return false;
  const parts = header.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  if (!expStr || !nonce || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  const body = `${expStr}.${nonce}`;
  const expected = sign(body);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
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
