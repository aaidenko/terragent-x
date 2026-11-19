import { analyzeTopEvents } from "./analysis";
import { draftOutreach, matchProspects } from "./outreach";
import { collectLiveSignals } from "./signals";
import { getStore, upsertEvents } from "./store";
import type { LoopRun } from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function step(name: string, detail: string) {
  return { name, detail, at: new Date().toISOString() };
}

export async function runOpsLoop(options?: {
  autoApprove?: boolean;
  maxEvents?: number;
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

    const max = options?.maxEvents ?? 3;
    run.steps.push(step("analyst", `Analyzing top ${max} events`));
    const briefs = analyzeTopEvents(events, max);
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

    run.steps.push(step("closer", "Drafting X + email outreach"));
    const drafts = prospects.flatMap((prospect) => {
      const event = events.find((e) => e.id === prospect.eventId);
      const brief = briefs.find((b) => b.eventId === prospect.eventId);
      if (!event || !brief) return [];
      return [draftOutreach(event, brief, prospect)];
    });

    if (options?.autoApprove) {
      for (const d of drafts) {
        d.status = "sent";
        d.sentAt = new Date().toISOString();
      }
      run.steps.push(
        step("closer", `Auto-sent ${drafts.length} messages (demo mode)`),
      );
      run.status = "complete";
    } else {
      run.steps.push(
        step(
          "closer",
          `Queued ${drafts.length} drafts — awaiting human approval`,
        ),
      );
      run.status = "awaiting_approval";
    }

    store.outreach.unshift(...drafts);
    store.outreach = store.outreach.slice(0, 80);
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

export function getMissionState() {
  const store = getStore();
  return {
    events: store.events,
    briefs: store.briefs,
    prospects: store.prospects,
    outreach: store.outreach,
    loops: store.loops.slice(0, 10),
  };
}
