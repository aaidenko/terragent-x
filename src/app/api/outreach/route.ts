import { NextResponse } from "next/server";
import { approveOutreach, getMissionState } from "@/lib/loop";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  const sent = approveOutreach(body.ids);
  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    sent,
    ...getMissionState(),
  });
}
