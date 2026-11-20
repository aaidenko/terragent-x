import { checkContact } from "./contacts";
import { clipText } from "./text";
import type {
  AnalysisBrief,
  BroadcastDraft,
  OutreachDraft,
  Prospect,
  SignalEvent,
} from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Candidate prospects. `handleOrEmail` must be a real, verified contact or
 * empty. Placeholders (".test" domains, "@search:" lookups, …) are never
 * stored here; matchProspects() also re-validates every value.
 */
const DISASTER_PROSPECTS: Omit<Prospect, "id" | "eventId">[] = [
  {
    name: "Lone Cabbage Fish Camp",
    kind: "Marina / riverside business",
    why: "NWS impacts list docks/parking flooded at major stage near Cocoa.",
    channel: "x",
    handleOrEmail: "",
    fitScore: 0.91,
  },
  {
    name: "Lake Poinsett riverside HOA / property mgr",
    kind: "Residential property",
    why: "Homes called out when stage enters ~17.2 ft+ major flood impacts.",
    channel: "email",
    handleOrEmail: "",
    fitScore: 0.88,
  },
  {
    name: "Brevard County property managers (riverside)",
    kind: "Property management",
    why: "Portfolio risk across Rockledge / Cocoa low-lying stock.",
    channel: "x",
    handleOrEmail: "",
    fitScore: 0.8,
  },
  {
    name: "Silver Pines / Rockledge landlords",
    kind: "Residential landlord",
    why: "Subdivision named in NWS major-flood impact language.",
    channel: "email",
    handleOrEmail: "",
    fitScore: 0.84,
  },
];

const FIRE_PROSPECTS: Omit<Prospect, "id" | "eventId">[] = [
  {
    name: "Nearby timber / landowner co-op",
    kind: "Timber",
    why: "Acreage inside 10 km hotspot buffer.",
    channel: "x",
    handleOrEmail: "",
    fitScore: 0.77,
  },
  {
    name: "County emergency management",
    kind: "Public sector",
    why: "Needs perimeter + asset exposure brief for public updates.",
    channel: "email",
    handleOrEmail: "",
    fitScore: 0.82,
  },
];

export function matchProspects(event: SignalEvent, limit = 3): Prospect[] {
  const pool =
    event.market === "wildfire" ? FIRE_PROSPECTS : DISASTER_PROSPECTS;
  return pool.slice(0, limit).map((p) => {
    const check = checkContact(p.channel, p.handleOrEmail);
    return {
      ...p,
      // Never carry an unverified value forward.
      handleOrEmail: check.ok ? p.handleOrEmail.trim() : "",
      contactStatus: check.ok ? ("verified" as const) : ("needs_contact" as const),
      ...(check.ok
        ? {}
        : { note: "Needs contact: no verified handle/email on file, so no outreach draft was made." }),
      id: uid("prospect"),
      eventId: event.id,
    };
  });
}

/** True only for prospects whose contact passes validation. */
export function hasVerifiedContact(p: Pick<Prospect, "channel" | "handleOrEmail">): boolean {
  return checkContact(p.channel, p.handleOrEmail).ok;
}

export function draftOutreach(
  event: SignalEvent,
  brief: AnalysisBrief,
  prospect: Prospect,
): OutreachDraft | null {
  // No verified contact → no draft (caller shows a "needs contact" note).
  if (!hasVerifiedContact(prospect)) return null;
  const stage =
    typeof event.metrics?.stageFt === "number" ? event.metrics.stageFt : undefined;
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
      body: clipText(body, 480),
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

export function draftBroadcast(
  event: SignalEvent,
  brief: AnalysisBrief,
): BroadcastDraft {
  const stage =
    typeof event.metrics?.stageFt === "number" ? event.metrics.stageFt : undefined;
  const kind =
    event.market === "wildfire"
      ? "wildfire"
      : event.market === "disasters"
        ? "flood"
        : "Earth event";
  const placeHint =
    event.market === "disasters"
      ? String(event.metrics?.gaugeName ?? event.metrics?.area ?? "Florida")
          .split(";")[0]
          .trim()
      : event.title.split(",")[0] ?? "your area";

  const body =
    kind === "flood"
      ? `Were you affected by the ${placeHint} ${kind}?` +
        (stage ? ` Live stage ~${stage} ft.` : "") +
        (brief.metrics.sentinel_scene && stage != null
          ? ` Our agents fused NOAA gauges + Sentinel-2 water masks into a verified brief ("${clipText(brief.headline, 70)}").`
          : stage != null
            ? ` Our agents turned live NOAA gauge data into a verified brief ("${clipText(brief.headline, 70)}").`
            : ` Our agents turned the NWS alert into a verified brief ("${clipText(brief.headline, 70)}").`) +
        ` Property managers / businesses: reply DATA and we’ll send free analytics + imagery context.` +
        ` AI-assisted · @Terragent`
      : `Monitoring ${event.title}.` +
        ` Satellite + open hazard feeds → asset-level brief ready.` +
        ` If this hit your land, timber, or ops: reply DATA for a free Terragent pack.` +
        ` AI-assisted · @Terragent`;

  return {
    id: uid("broadcast"),
    eventId: event.id,
    market: event.market,
    channel: "x",
    handle: "@Terragent",
    body: clipText(body, 400),
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}
