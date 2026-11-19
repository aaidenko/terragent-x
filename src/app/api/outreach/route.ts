import { NextResponse } from "next/server";
import { approveOutreach, getMissionState } from "@/lib/loop";
import {
  clientIp,
  publicError,
  rateLimit,
  requireSession,
} from "@/lib/security";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!requireSession(request)) {
    return NextResponse.json(publicError("Session required"), { status: 401 });
  }
  const limited = rateLimit(`outreach:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(publicError("Rate limit exceeded"), {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id) => typeof id === "string").slice(0, 50)
    : undefined;
  const sent = approveOutreach(ids);
  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    sent,
    ...getMissionState(),
  });
}
