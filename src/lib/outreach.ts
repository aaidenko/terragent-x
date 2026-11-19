import type { AnalysisBrief, OutreachDraft, Prospect, SignalEvent } from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const DISASTER_PROSPECTS: Omit<Prospect, "id" | "eventId">[] = [
  {
    name: "Lone Cabbage Fish Camp",
    kind: "Marina / riverside business",
    why: "NWS impacts list docks/parking flooded at major stage near Cocoa.",
    channel: "x",
    handleOrEmail: "@search:Lone Cabbage Fish Camp Cocoa",
    fitScore: 0.91,
  },
  {
    name: "Lake Poinsett riverside HOA / property mgr",
    kind: "Residential property",
    why: "Homes called out when stage enters ~17.2 ft+ major flood impacts.",
    channel: "email",
    handleOrEmail: "ops@example-lake-poinsett-hoa.test",
    fitScore: 0.88,
  },
  {
    name: "Brevard County property managers (riverside)",
    kind: "Property management",
    why: "Portfolio risk across Rockledge / Cocoa low-lying stock.",
    channel: "x",
    handleOrEmail: "@search:Brevard property management flood",
    fitScore: 0.8,
  },
  {
    name: "Silver Pines / Rockledge landlords",
    kind: "Residential landlord",
    why: "Subdivision named in NWS major-flood impact language.",
    channel: "email",
    handleOrEmail: "manager@example-silver-pines.test",
    fitScore: 0.84,
  },
];

const FIRE_PROSPECTS: Omit<Prospect, "id" | "eventId">[] = [
  {
    name: "Nearby timber / landowner co-op",
    kind: "Timber",
    why: "Acreage inside 10 km hotspot buffer.",
    channel: "x",
    handleOrEmail: "@search:timber landowner near fire",
    fitScore: 0.77,
  },
  {
    name: "County emergency management",
    kind: "Public sector",
    why: "Needs perimeter + asset exposure brief for public updates.",
    channel: "email",
    handleOrEmail: "em@example-county.gov.test",
    fitScore: 0.82,
  },
];

export function matchProspects(event: SignalEvent, limit = 3): Prospect[] {
  const pool =
    event.market === "wildfire" ? FIRE_PROSPECTS : DISASTER_PROSPECTS;
  return pool.slice(0, limit).map((p) => ({
    ...p,
    id: uid("prospect"),
    eventId: event.id,
  }));
}

export function draftOutreach(
  event: SignalEvent,
  brief: AnalysisBrief,
  prospect: Prospect,
): OutreachDraft {
  const stage = event.metrics?.stageFt;
  const disclosure =
    "— Terragent Earth intel (AI-assisted). Opt out: reply STOP. Businesses only.";

  if (prospect.channel === "x") {
    const body =
      `Public gauges + satellite context on ${event.title}. ` +
      (stage ? `Stage ~${stage} ft. ` : "") +
      `We mapped likely impact near ${prospect.name}. Free 1-page brief with finding: "${brief.headline}". Reply YES for the PDF. ${disclosure}`;
    return {
      id: uid("out"),
      prospectId: prospect.id,
      eventId: event.id,
      channel: "x",
      to: prospect.handleOrEmail,
      body: body.slice(0, 480),
      status: "draft",
      createdAt: new Date().toISOString(),
    };
  }

  return {
    id: uid("out"),
    prospectId: prospect.id,
    eventId: event.id,
    channel: "email",
    to: prospect.handleOrEmail,
    subject: `Verified ${brief.market} brief for ${prospect.name}`,
    body: `Hi — Terragent agents watch live public Earth data (NOAA/USGS/NASA) and turn it into asset-level answers.\n\nEvent: ${event.title}\nFinding: ${brief.finding}\n\nMethod: ${brief.method.join("; ")}\nConfidence: ${Math.round(brief.confidence * 100)}%\n\nIf useful, reply and we send the one-page PDF. No obligation.\n\n${disclosure}`,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}
