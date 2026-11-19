import { analyzeTopEvents } from "./analysis";
import { analyzeAoiNdwi, type EoAnalysis } from "./eo";
import { draftBroadcast, draftOutreach, matchProspects } from "./outreach";
import { collectLiveSignals } from "./signals";
import { getStore, upsertEvents } from "./store";
import type { LoopRun, SignalEvent } from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function step(name: string, detail: string) {
  return { name, detail, at: new Date().toISOString() };
}

function pickForImagery(events: SignalEvent[]): SignalEvent | null {
  const withGauge = events.find(
    (e) => e.market === "disasters" && e.metrics?.stageFt != null,
  );
  if (withGauge) return withGauge;
  return (
    events.find((e) => e.market === "disasters" && e.severity === "critical") ??
    events.find((e) => e.market === "disasters") ??
    null
  );
}

export async function runOpsLoop(options?: {
  autoApprove?: boolean;
  maxEvents?: number;
  skipImagery?: boolean;
}): Promise<LoopRun> {
  const store = getStore();
  const run: LoopRun = {
    id: uid("loop"),
    startedAt: new Date().toISOString(),
    status: "running",
    steps: [],
    eventIds: [],
    briefIds: [],
    prospectIds: [],
    outreachIds: [],
  };
  store.loops.unshift(run);

  try {
    run.steps.push(step("scout", "Collecting live NWS / USGS / EONET signals"));
    const events = await collectLiveSignals();
    upsertEvents(events);
    run.eventIds = events.map((e) => e.id);
    run.steps.push(
      step("scout", `Ingested ${events.length} live events (flood, fire, storms)`),
    );

    const eoByEventId: Record<string, EoAnalysis | null> = {};
    if (!options?.skipImagery) {
      const target = pickForImagery(events);
      if (target) {
        run.steps.push(
          step(
            "analyst",
            `Running Sentinel-2 NDWI on AOI (${target.lat.toFixed(3)}, ${target.lon.toFixed(3)})`,
          ),
        );
        const eo = await analyzeAoiNdwi({
          lat: target.lat,
          lon: target.lon,
          pad_deg: 0.12,
        });
        // Attach the same AOI mask to nearby disaster events so NWS alerts
        // in the same basin also get optical fusion in top briefs.
        for (const event of events) {
          if (event.market !== "disasters") continue;
          const dlat = Math.abs(event.lat - target.lat);
          const dlon = Math.abs(event.lon - target.lon);
          if (event.id === target.id || (dlat < 0.6 && dlon < 0.6)) {
            eoByEventId[event.id] = eo;
          }
        }
        if (eo.ok && eo.recent) {
          run.steps.push(
            step(
              "analyst",
              `NDWI water ${(eo.recent.water_fraction * 100).toFixed(2)}% · scene ${eo.recent.scene_id.slice(0, 28)}… · cloud ${eo.recent.cloud_cover_pct.toFixed(1)}%`,
            ),
          );
        } else {
          run.steps.push(
            step(
              "analyst",
              `Imagery fallback: ${eo.error ?? "no scene"} — continuing with gauge/alert fusion`,
            ),
          );
        }
      }
    }

    const max = options?.maxEvents ?? 3;
    run.steps.push(step("analyst", `Writing top ${max} fused briefs`));
    // Pin the imagery target into the analysis set so the EO story always shows.
    const pinned = pickForImagery(events);
    const pool = pinned
      ? [pinned, ...events.filter((e) => e.id !== pinned.id)]
      : events;
    const briefs = analyzeTopEvents(pool, max, eoByEventId);
    store.briefs.unshift(...briefs);
    store.briefs = store.briefs.slice(0, 40);
    run.briefIds = briefs.map((b) => b.id);
    run.steps.push(step("analyst", `Wrote ${briefs.length} verified briefs`));

    run.steps.push(step("matcher", "Matching reachable businesses to events"));
    const prospects = briefs.flatMap((brief) => {
      const event = events.find((e) => e.id === brief.eventId);
      if (!event) return [];
      return matchProspects(event, 2);
    });
    store.prospects.unshift(...prospects);
    store.prospects = store.prospects.slice(0, 60);
    run.prospectIds = prospects.map((p) => p.id);
    run.steps.push(step("matcher", `Matched ${prospects.length} prospects`));

    run.steps.push(step("closer", "Drafting X + email outreach + @Terragent broadcasts"));
    const drafts = prospects.flatMap((prospect) => {
      const event = events.find((e) => e.id === prospect.eventId);
      const brief = briefs.find((b) => b.eventId === prospect.eventId);
      if (!event || !brief) return [];
      return [draftOutreach(event, brief, prospect)];
    });
    const broadcasts = briefs.flatMap((brief) => {
      const event = events.find((e) => e.id === brief.eventId);
      if (!event) return [];
      return [draftBroadcast(event, brief)];
    });

    // Public deployment never auto-sends.
    run.steps.push(
      step(
        "closer",
        `Queued ${drafts.length} 1:1 drafts + ${broadcasts.length} @Terragent broadcast posts — awaiting approval`,
      ),
    );
    run.status = "awaiting_approval";

    store.outreach.unshift(...drafts);
    store.outreach = store.outreach.slice(0, 80);
    store.broadcasts.unshift(...broadcasts);
    store.broadcasts = store.broadcasts.slice(0, 40);
    run.outreachIds = drafts.map((d) => d.id);
    run.finishedAt = new Date().toISOString();
  } catch (err) {
    run.status = "error";
    run.error = err instanceof Error ? err.message : "Unknown loop error";
    run.steps.push(step("error", run.error));
    run.finishedAt = new Date().toISOString();
  }

  return run;
}

export function approveOutreach(ids?: string[]) {
  const store = getStore();
  const targets = store.outreach.filter((o) =>
    ids?.length ? ids.includes(o.id) : o.status === "draft",
  );
  const now = new Date().toISOString();
  for (const draft of targets) {
    draft.status = "sent";
    draft.sentAt = now;
  }
  const openLoop = store.loops.find((l) => l.status === "awaiting_approval");
  if (openLoop) {
    openLoop.status = "complete";
    openLoop.steps.push({
      name: "human",
      detail: `Approved ${targets.length} outreach messages`,
      at: now,
    });
    openLoop.finishedAt = now;
  }
  return targets;
}

export function approveBroadcasts(ids?: string[]) {
  const store = getStore();
  const targets = store.broadcasts.filter((o) =>
    ids?.length ? ids.includes(o.id) : o.status === "draft",
  );
  const now = new Date().toISOString();
  for (const draft of targets) {
    draft.status = "sent";
    draft.sentAt = now;
  }
  return targets;
}

export function getMissionState() {
  const store = getStore();
  return {
    events: store.events,
    briefs: store.briefs,
    prospects: store.prospects,
    outreach: store.outreach,
    broadcasts: store.broadcasts,
    loops: store.loops.slice(0, 10),
  };
}
