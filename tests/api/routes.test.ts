import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SignalEvent } from "@/lib/types";

const EVENTS: SignalEvent[] = [
  {
    id: "evt-test-flood",
    market: "disasters",
    title: "Test river flood warning",
    summary: "Synthetic test event",
    lat: 28.4,
    lon: -80.9,
    severity: "critical",
    source: "test",
    observedAt: "2026-11-19T00:00:00Z",
  },
];

const signals = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/signals", () => ({
  collectLiveSignals: vi.fn(async () => {
    if (signals.fail) throw new Error("upstream exploded at /secret/path line 42");
    return EVENTS;
  }),
}));
vi.mock("@/lib/eo", () => ({
  analyzeAoiNdwi: vi.fn(async () => ({
    ok: false,
    error: "EO analysis unavailable",
    limitations: ["test"],
  })),
}));

let n = 0;
const ip = () => `203.0.113.${(n += 1)}`;
const call = (
  method: string,
  headers: Record<string, string> = {},
  body?: unknown,
) =>
  new Request("http://localhost/api", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(() => {
  process.env.TERRAGENT_SESSION_SECRET = randomBytes(32).toString("hex");
  process.env.TRUSTED_PROXY_HOPS = "1";
});

async function newSession(addr: string): Promise<string> {
  const { POST } = await import("@/app/api/session/route");
  const res = await POST(call("POST", { "x-forwarded-for": addr }));
  expect(res.status).toBe(200);
  return (await res.json()).session as string;
}

describe("session gate on POSTs", () => {
  it("rejects POST /api/loop, /api/outreach, /api/broadcast, /api/eo without a session", async () => {
    const routes = await Promise.all([
      import("@/app/api/loop/route"),
      import("@/app/api/outreach/route"),
      import("@/app/api/broadcast/route"),
      import("@/app/api/eo/route"),
    ]);
    for (const r of routes) {
      const res = await r.POST(call("POST", { "x-forwarded-for": ip() }, {}));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: "Session required" });
    }
  });

  it("returns 503 from /api/session when the secret is missing", async () => {
    const saved = process.env.TERRAGENT_SESSION_SECRET;
    delete process.env.TERRAGENT_SESSION_SECRET;
    const { POST } = await import("@/app/api/session/route");
    const res = await POST(call("POST", { "x-forwarded-for": ip() }));
    expect(res.status).toBe(503);
    process.env.TERRAGENT_SESSION_SECRET = saved;
  });
});

describe("GET /api/signals", () => {
  it("rate-limits per client and ignores spoofed XFF prefixes", async () => {
    const { GET } = await import("@/app/api/signals/route");
    const real = ip();
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push((await GET(call("GET", { "x-forwarded-for": `9.9.9.${i}, ${real}` }))).status);
    }
    expect(codes).toEqual([200, 200, 200, 200, 200, 200, 429, 429]);
  });

  it("sanitizes upstream errors", async () => {
    const { GET } = await import("@/app/api/signals/route");
    signals.fail = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(call("GET", { "x-forwarded-for": ip() }));
    signals.fail = false;
    spy.mockRestore();
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toMatch(/secret|line 42|Error:|at /);
    expect(JSON.parse(text)).toEqual({ ok: false, error: "Signals unavailable" });
  });
});

describe("per-session isolation", () => {
  it("session B cannot see or approve session A's queue", async () => {
    const loop = await import("@/app/api/loop/route");
    const outreach = await import("@/app/api/outreach/route");
    const a = await newSession(ip());
    const b = await newSession(ip());

    const ra = await loop.POST(
      call("POST", { "x-forwarded-for": ip(), "x-terragent-session": a }, { skipImagery: true }),
    );
    expect(ra.status).toBe(200);
    const stateA = await ra.json();
    expect(stateA.loops.length).toBe(1);
    const ids = (stateA.outreach as { id: string }[]).map((o) => o.id);

    const gb = await loop.GET(call("GET", { "x-forwarded-for": ip(), "x-terragent-session": b }));
    const stateB = await gb.json();
    expect(stateB.loops).toEqual([]);
    expect(stateB.outreach).toEqual([]);
    expect(stateB.briefs).toEqual([]);

    const steal = await outreach.POST(
      call("POST", { "x-forwarded-for": ip(), "x-terragent-session": b }, { ids }),
    );
    expect((await steal.json()).sentCount).toBe(0);

    const anon = await loop.GET(call("GET", { "x-forwarded-for": ip() }));
    expect((await anon.json()).loops).toEqual([]);
  });
});

describe("POST /api/eo", () => {
  it("rejects pad_deg above 0.15 with a plain message", async () => {
    const eo = await import("@/app/api/eo/route");
    const s = await newSession(ip());
    const res = await eo.POST(
      call("POST", { "x-forwarded-for": ip(), "x-terragent-session": s }, { lat: 28, lon: -80, pad_deg: 0.5 }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "pad_deg must be between 0 and 0.15" });
  });
});
