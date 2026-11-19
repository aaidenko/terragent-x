import { NextResponse } from "next/server";
import { clientIp, issueSession, publicError, rateLimit } from "@/lib/security";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`session-post:${ip}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json(publicError("Too many session requests"), {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }
  const token = issueSession(ip);
  if (!token) {
    return NextResponse.json(publicError("Too many session requests"), {
      status: 429,
    });
  }
  return NextResponse.json({ ok: true, session: token, expiresInSec: 3600 });
}
