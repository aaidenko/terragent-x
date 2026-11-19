import { NextResponse } from "next/server";
import { collectLiveSignals } from "@/lib/signals";
import { upsertEvents } from "@/lib/store";

export async function GET() {
  const events = await collectLiveSignals();
  upsertEvents(events);
  return NextResponse.json({ ok: true, count: events.length, events });
}
