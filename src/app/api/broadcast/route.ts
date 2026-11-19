import { NextResponse } from "next/server";
import { approveBroadcasts, getMissionState } from "@/lib/loop";
import {
  clientIp,
  publicError,
  rateLimit,
  sessionId,
} from "@/lib/security";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const sid = sessionId(request);
  if (!sid) {
    return NextResponse.json(publicError("Session required"), { status: 401 });
  }
  const limited = rateLimit(`broadcast:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(publicError("Rate limit exceeded"), {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string").slice(0, 20)
    : undefined;
  const sent = approveBroadcasts(sid, ids);
  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    sent,
    ...getMissionState(sid),
  });
}
