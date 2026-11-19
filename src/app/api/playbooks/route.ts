import { NextResponse } from "next/server";
import { PLAYBOOKS } from "@/lib/playbooks";

export async function GET() {
  return NextResponse.json({ ok: true, playbooks: PLAYBOOKS });
}
