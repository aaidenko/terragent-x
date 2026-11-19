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
  const issued = issueSession(ip);
  if (!issued.ok) {
    if (issued.reason === "unconfigured") {
      // Fail closed: no host secret means no sessions (and no gated POSTs).
      console.error(
        "[terragent] session secret not configured; set TERRAGENT_SESSION_SECRET",
      );
      return NextResponse.json(publicError("Sessions are unavailable"), {
        status: 503,
      });
    }
    return NextResponse.json(publicError("Too many session requests"), {
      status: 429,
    });
  }
  return NextResponse.json({ ok: true, session: issued.token, expiresInSec: 3600 });
}
