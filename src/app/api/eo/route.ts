import { NextResponse } from "next/server";
import { analyzeAoiNdwi } from "@/lib/eo";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    lat?: number;
    lon?: number;
    pad_deg?: number;
  };
  const result = await analyzeAoiNdwi({
    lat: body.lat ?? 28.386,
    lon: body.lon ?? -80.742,
    pad_deg: body.pad_deg ?? 0.12,
  });
  return NextResponse.json({ ok: result.ok, result });
}
