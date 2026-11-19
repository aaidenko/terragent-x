import { NextResponse } from "next/server";
import { getMissionState, runOpsLoop } from "@/lib/loop";

export async function GET() {
  return NextResponse.json({ ok: true, ...getMissionState() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    autoApprove?: boolean;
    maxEvents?: number;
  };
  const run = await runOpsLoop({
    autoApprove: Boolean(body.autoApprove),
    maxEvents: body.maxEvents ?? 3,
  });
  return NextResponse.json({ ok: true, run, ...getMissionState() });
}
