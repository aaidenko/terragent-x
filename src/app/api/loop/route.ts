import { NextResponse } from "next/server";
import { getMissionState, runOpsLoop } from "@/lib/loop";
import {
  clientIp,
  publicError,
  rateLimit,
  requireSession,
} from "@/lib/security";

export async function GET() {
  return NextResponse.json({ ok: true, ...getMissionState() });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!requireSession(request)) {
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
  const run = await runOpsLoop({
    autoApprove: false,
    maxEvents,
    skipImagery: Boolean(body.skipImagery),
  });
  return NextResponse.json({ ok: true, run, ...getMissionState() });
}
