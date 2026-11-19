import type {
  AnalysisBrief,
  BroadcastDraft,
  LoopRun,
  OutreachDraft,
  Prospect,
  SignalEvent,
} from "./types";

type Store = {
  events: SignalEvent[];
  briefs: AnalysisBrief[];
  prospects: Prospect[];
  outreach: OutreachDraft[];
  broadcasts: BroadcastDraft[];
  loops: LoopRun[];
};

const globalForStore = globalThis as unknown as { __terragentStore?: Store };

function createStore(): Store {
  return {
    events: [],
    briefs: [],
    prospects: [],
    outreach: [],
    broadcasts: [],
    loops: [],
  };
}

export function getStore(): Store {
  if (!globalForStore.__terragentStore) {
    globalForStore.__terragentStore = createStore();
  }
  const store = globalForStore.__terragentStore;
  // migrate older in-memory shapes after hot reload
  if (!Array.isArray(store.broadcasts)) store.broadcasts = [];
  if (!Array.isArray(store.events)) store.events = [];
  if (!Array.isArray(store.briefs)) store.briefs = [];
  if (!Array.isArray(store.prospects)) store.prospects = [];
  if (!Array.isArray(store.outreach)) store.outreach = [];
  if (!Array.isArray(store.loops)) store.loops = [];
  return store;
}

export function resetStore() {
  globalForStore.__terragentStore = createStore();
  return globalForStore.__terragentStore;
}

export function upsertEvents(events: SignalEvent[]) {
  const store = getStore();
  for (const event of events) {
    const idx = store.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) store.events[idx] = event;
    else store.events.unshift(event);
  }
  store.events = store.events.slice(0, 40);
  return store.events;
}
