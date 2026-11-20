"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type {
  AnalysisBrief,
  BroadcastDraft,
  LoopRun,
  OutreachDraft,
  Prospect,
  SignalEvent,
} from "@/lib/types";

export type MissionState = {
  events: SignalEvent[];
  briefs: AnalysisBrief[];
  prospects: Prospect[];
  outreach: OutreachDraft[];
  broadcasts: BroadcastDraft[];
  loops: LoopRun[];
};

const EMPTY: MissionState = {
  events: [],
  briefs: [],
  prospects: [],
  outreach: [],
  broadcasts: [],
  loops: [],
};

function normalize(data: Partial<MissionState> | null | undefined): MissionState {
  return {
    events: data?.events ?? [],
    briefs: data?.briefs ?? [],
    prospects: data?.prospects ?? [],
    outreach: data?.outreach ?? [],
    broadcasts: data?.broadcasts ?? [],
    loops: data?.loops ?? [],
  };
}

const SESSION_KEY = "tx-session";
const SESSION_HEADER = "x-terragent-session";
/** GET /api/loop allows 30 requests a minute per IP; stay well under it. */
const POLL_MS = 1600;

function readStoredSession(): string | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw) as { token: string; exp: number };
    return token && Date.now() < exp ? token : null;
  } catch {
    return null;
  }
}

function storeSession(token: string, ttlSec: number) {
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ token, exp: Date.now() + Math.max(60, ttlSec - 60) * 1000 }),
    );
  } catch {
    /* storage unavailable: the token lives in memory only */
  }
}

/**
 * Client state for mission control, built only on the existing API:
 *  POST /api/session    signed demo session (sent as x-terragent-session)
 *  GET  /api/loop       public events + this session's queues
 *  POST /api/loop       run a pass (the server appends steps as it goes)
 *  POST /api/outreach   approve drafts, all or by id
 *  POST /api/broadcast  approve @Terragent posts, all or by id
 * While a pass runs we poll GET so steps stream in as the agents work.
 */
export function useMission() {
  const [state, setState] = useState<MissionState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState<string | "all" | "broadcasts" | null>(null);
  const [, startTransition] = useTransition();
  const runningRef = useRef(false);
  const sessionRef = useRef<string | null>(null);

  const session = useCallback(async (fresh = false): Promise<string> => {
    if (!fresh) {
      sessionRef.current ??= readStoredSession();
      if (sessionRef.current) return sessionRef.current;
    }
    const res = await fetch("/api/session", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session) {
      throw new Error(
        res.status === 503
          ? "Demo sessions are unavailable on this host right now."
          : data.error || "Could not start a demo session.",
      );
    }
    sessionRef.current = data.session as string;
    storeSession(sessionRef.current, Number(data.expiresInSec) || 3600);
    return sessionRef.current;
  }, []);

  /** fetch with the session header; re-issues the session once on 401. */
  const call = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const go = async (token: string) =>
        fetch(url, {
          cache: "no-store",
          ...init,
          headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), [SESSION_HEADER]: token },
        });
      let res = await go(await session());
      if (res.status === 401) res = await go(await session(true));
      return res;
    },
    [session],
  );

  const refresh = useCallback(async () => {
    const res = await call("/api/loop");
    if (res.status === 429) throw new Error("rate-limited");
    if (!res.ok) throw new Error(`Mission state unavailable (${res.status})`);
    return normalize(await res.json());
  }, [call]);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Public signals still load without a session; show them if we can.
        fetch("/api/loop", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!cancelled && d) setState(normalize(d));
          })
          .catch(() => {});
        setError(e instanceof Error && e.message !== "rate-limited" ? e.message : "Could not reach mission control.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const runLoop = useCallback(() => {
    if (runningRef.current) return;
    setError(null);
    setRunning(true);
    runningRef.current = true;

    const poll = window.setInterval(() => {
      refresh()
        .then((s) => {
          if (runningRef.current) setState(s);
        })
        .catch(() => {});
    }, POLL_MS);

    call("/api/loop", { method: "POST", body: JSON.stringify({ maxEvents: 3 }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error("Rate limit reached: three passes a minute. Try again shortly.");
        if (!res.ok) throw new Error(data?.error || `Loop failed (${res.status})`);
        return normalize(data);
      })
      .then((s) => {
        runningRef.current = false;
        startTransition(() => setState(s));
        const last = s.loops[0];
        if (last?.status === "error") setError(last.error ?? "The loop reported an error.");
      })
      .catch((e: unknown) => {
        runningRef.current = false;
        setError(e instanceof Error ? e.message : "Loop failed");
      })
      .finally(() => {
        window.clearInterval(poll);
        runningRef.current = false;
        setRunning(false);
      });
  }, [call, refresh]);

  const approveWith = useCallback(
    (url: string, marker: string | "all" | "broadcasts", ids?: string[]) => {
      setError(null);
      setApproving(marker);
      call(url, { method: "POST", body: JSON.stringify(ids?.length ? { ids } : {}) })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `Approve failed (${res.status})`);
          startTransition(() => setState(normalize(data)));
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Approve failed"))
        .finally(() => setApproving(null));
    },
    [call],
  );

  const approve = useCallback(
    (ids?: string[]) => approveWith("/api/outreach", ids?.length === 1 ? ids[0] : "all", ids),
    [approveWith],
  );
  const approveBroadcasts = useCallback(
    (ids?: string[]) => approveWith("/api/broadcast", ids?.length === 1 ? ids[0] : "broadcasts", ids),
    [approveWith],
  );

  return {
    state,
    loaded,
    error,
    running,
    approving,
    runLoop,
    approve,
    approveBroadcasts,
    dismissError: () => setError(null),
  };
}

/** Re-render on an interval so relative timestamps stay honest. */
export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
