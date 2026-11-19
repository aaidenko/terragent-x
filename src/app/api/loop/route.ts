import { NextResponse } from "next/server";
import { getMissionState, runOpsLoop } from "@/lib/loop";
import {
  clientIp,
  publicError,
  rateLimit,
  sessionId,
} from "@/lib/security";

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`loop-get:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(publicError("Rate limit exceeded"), {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }
  // Public events for everyone; session-scoped queues only for that session.
  return NextResponse.json({ ok: true, ...getMissionState(sessionId(request)) });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const sid = sessionId(request);
  if (!sid) {
    return NextResponse.json(publicError("Session required"), { status: 401 });
  }
  const limited = rateLimit(`loop:${ip}`, 3, 60_000);
  if (!limited.ok) {
    return NextResponse.json(publicError("Rate limit exceeded"), {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }

  const body = (await request.json().catch(() => ({}))) as {
    autoApprove?: boolean;
    maxEvents?: number;
    skipImagery?: boolean;
  };

  // Public demo never auto-sends; keep shared state safer.
  const maxEvents = Math.min(3, Math.max(1, Number(body.maxEvents ?? 3) || 3));
  const run = await runOpsLoop(sid, {
    autoApprove: false,
    maxEvents,
    skipImagery: Boolean(body.skipImagery),
  });
  return NextResponse.json({ ok: true, run, ...getMissionState(sid) });
}
