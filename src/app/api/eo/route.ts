import { NextResponse } from "next/server";
import { analyzeAoiNdwi } from "@/lib/eo";
import {
  clampEoInput,
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
  const limited = rateLimit(`eo:${ip}`, 2, 60_000);
  if (!limited.ok) {
    return NextResponse.json(publicError("Rate limit exceeded"), {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clamped = clampEoInput(body);
  if (!clamped.ok) {
    return NextResponse.json(publicError(clamped.error), { status: 400 });
  }

  const result = await analyzeAoiNdwi({
    lat: clamped.lat,
    lon: clamped.lon,
    pad_deg: clamped.pad_deg,
  });
  // Strip any unexpected internals
  const {
    ok,
    recent,
    baseline,
    delta,
    flood,
    confidence,
    method,
    limitations,
    bbox,
    center,
    error,
  } = result;
  return NextResponse.json({
    ok,
    result: {
      ok,
      recent,
      baseline,
      delta,
      flood,
      confidence,
      method,
      limitations,
      bbox,
      center,
      ...(ok ? {} : { error: error || "EO analysis unavailable" }),
    },
  });
}
