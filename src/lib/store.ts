import type {
  AnalysisBrief,
  BroadcastDraft,
  LoopRun,
  OutreachDraft,
  Prospect,
  SignalEvent,
} from "./types";

/**
 * Public, shared data: live hazard events pulled from open feeds.
 * Everything a user acts on (briefs, prospects, outreach/broadcast approval
 * queues, loop runs) lives in a per-session workspace so one session can
 * never see or approve another session's items.
 */
type SharedStore = {
  events: SignalEvent[];
};

export type SessionStore = {
  briefs: AnalysisBrief[];
  prospects: Prospect[];
  outreach: OutreachDraft[];
  broadcasts: BroadcastDraft[];
  loops: LoopRun[];
  touchedAt: number;
};

const SESSION_STORE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSION_STORES = 500;

const globalForStore = globalThis as unknown as {
  __terragentShared?: SharedStore;
  __terragentSessions?: Map<string, SessionStore>;
};

function createSessionStore(): SessionStore {
  return {
    briefs: [],
    prospects: [],
    outreach: [],
    broadcasts: [],
    loops: [],
    touchedAt: Date.now(),
  };
}

function sharedStore(): SharedStore {
  if (!globalForStore.__terragentShared) {
    globalForStore.__terragentShared = { events: [] };
  }
  const store = globalForStore.__terragentShared;
  if (!Array.isArray(store.events)) store.events = [];
  return store;
}

function sessionMap(): Map<string, SessionStore> {
  if (!globalForStore.__terragentSessions) {
    globalForStore.__terragentSessions = new Map();
  }
  return globalForStore.__terragentSessions;
}

function evictSessions(map: Map<string, SessionStore>, now: number) {
  for (const [id, s] of map) {
    if (now - s.touchedAt > SESSION_STORE_TTL_MS) map.delete(id);
  }
  // Map preserves insertion order; touched stores are re-inserted, so the
  // first keys are the least recently used.
  while (map.size >= MAX_SESSION_STORES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

/** Workspace for one verified session id. Never pass unverified input here. */
export function getSessionStore(sessionId: string): SessionStore {
  const map = sessionMap();
  const now = Date.now();
  let store = map.get(sessionId);
  if (store) {
    map.delete(sessionId);
  } else {
    evictSessions(map, now);
    store = createSessionStore();
  }
  store.touchedAt = now;
  map.set(sessionId, store);
  return store;
}

export function peekSessionStore(sessionId: string): SessionStore | null {
  return sessionMap().get(sessionId) ?? null;
}

export function getEvents(): SignalEvent[] {
  return sharedStore().events;
}

export function resetStore() {
  globalForStore.__terragentShared = { events: [] };
  globalForStore.__terragentSessions = new Map();
}

export function upsertEvents(events: SignalEvent[]) {
  const store = sharedStore();
  for (const event of events) {
    const idx = store.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) store.events[idx] = event;
    else store.events.unshift(event);
  }
  store.events = store.events.slice(0, 40);
  return store.events;
}
