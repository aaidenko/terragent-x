import { NextResponse } from "next/server";
import { clientIp, publicError, rateLimit } from "@/lib/security";
import { collectLiveSignals } from "@/lib/signals";
import { upsertEvents } from "@/lib/store";

export async function GET(request: Request) {
  const ip = clientIp(request);
  // Each call fans out to USGS / NWS / EONET; keep it tight per client.
  const limited = rateLimit(`signals:${ip}`, 6, 60_000);
  if (!limited.ok) {
    return NextResponse.json(publicError("Rate limit exceeded"), {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }
  try {
    const events = await collectLiveSignals();
    upsertEvents(events);
    return NextResponse.json({ ok: true, count: events.length, events });
  } catch (err) {
    console.error("[terragent] signals refresh failed", err);
    return NextResponse.json(publicError("Signals unavailable"), { status: 502 });
  }
}
