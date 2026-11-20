import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clampEoInput,
  clientIp,
  issueSession,
  rateLimit,
  sessionId,
} from "@/lib/security";

const SECRET = randomBytes(32).toString("hex");
const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { headers });

beforeEach(() => {
  process.env.TERRAGENT_SESSION_SECRET = SECRET;
  delete process.env.CURSOR_APP_SECRET;
  delete process.env.TRUSTED_PROXY_HOPS;
});
afterEach(() => {
  delete process.env.TERRAGENT_SESSION_SECRET;
});

describe("sessions fail closed", () => {
  it("refuses to issue without a host secret", () => {
    delete process.env.TERRAGENT_SESSION_SECRET;
    expect(issueSession("10.0.0.1")).toEqual({ ok: false, reason: "unconfigured" });
  });
  it("refuses a short secret", () => {
    process.env.TERRAGENT_SESSION_SECRET = "short";
    expect(issueSession("10.0.0.2")).toEqual({ ok: false, reason: "unconfigured" });
  });
  it("issues and verifies a token; rejects it once the secret is gone", () => {
    const issued = issueSession("10.0.0.3");
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const r = req({ "x-terragent-session": issued.token });
    expect(sessionId(r)).toMatch(/^[a-f0-9]{32}$/);
    delete process.env.TERRAGENT_SESSION_SECRET;
    expect(sessionId(r)).toBeNull();
  });
  it("rejects tokens signed with the old hardcoded demo key", () => {
    const body = `${Date.now() + 60_000}.${randomBytes(16).toString("hex")}`;
    const sig = createHmac("sha256", "terragent-demo-session-v1").update(body).digest("hex");
    expect(sessionId(req({ "x-terragent-session": `${body}.${sig}` }))).toBeNull();
  });
  it("rejects tampered and expired tokens", () => {
    const issued = issueSession("10.0.0.4");
    if (!issued.ok) throw new Error("issue failed");
    const [exp, nonce, sig] = issued.token.split(".");
    expect(sessionId(req({ "x-terragent-session": `${Number(exp) + 1}.${nonce}.${sig}` }))).toBeNull();
    const old = `${Date.now() - 1}.${nonce}`;
    const oldSig = createHmac("sha256", SECRET).update(old).digest("hex");
    expect(sessionId(req({ "x-terragent-session": `${old}.${oldSig}` }))).toBeNull();
  });
});

describe("X-Forwarded-For hop handling", () => {
  it("default 1 hop takes the rightmost entry, ignoring client-prepended ones", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });
  it("2 hops takes the second from the right", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.4, 10.0.0.1" }))).toBe("198.51.100.4");
  });
  it("0 hops ignores the header entirely", () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("direct");
  });
  it("garbage values collapse to a shared bucket", () => {
    expect(clientIp(req({ "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(clientIp(req())).toBe("unknown");
  });
  it("invalid hop config falls back to 1", () => {
    process.env.TRUSTED_PROXY_HOPS = "lots";
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });
});

describe("rate limiter", () => {
  it("blocks after the limit with a retry-after", () => {
    const key = `t:${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    const third = rateLimit(key, 2, 60_000);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("EO pad clamp", () => {
  it("accepts 0.15 and rejects anything above or non-positive", () => {
    expect(clampEoInput({ lat: 28, lon: -80, pad_deg: 0.15 }).ok).toBe(true);
    expect(clampEoInput({ lat: 28, lon: -80, pad_deg: 0.1501 }).ok).toBe(false);
    expect(clampEoInput({ lat: 28, lon: -80, pad_deg: 0 }).ok).toBe(false);
    expect(clampEoInput({ lat: 95, lon: -80 }).ok).toBe(false);
    expect(clampEoInput({ lat: "x", lon: -80 }).ok).toBe(false);
  });
});
