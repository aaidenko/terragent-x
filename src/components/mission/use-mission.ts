"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { AnalysisBrief, LoopRun, OutreachDraft, Prospect, SignalEvent } from "@/lib/types";

export type MissionState = {
  events: SignalEvent[];
  briefs: AnalysisBrief[];
  prospects: Prospect[];
  outreach: OutreachDraft[];
  loops: LoopRun[];
};

const EMPTY: MissionState = { events: [], briefs: [], prospects: [], outreach: [], loops: [] };

function normalize(data: Partial<MissionState> | null | undefined): MissionState {
  return {
    events: data?.events ?? [],
    briefs: data?.briefs ?? [],
    prospects: data?.prospects ?? [],
    outreach: data?.outreach ?? [],
    loops: data?.loops ?? [],
  };
}

/**
 * Client state for mission control, built only on the existing API:
 *  GET  /api/loop      mission state
 *  POST /api/loop      run a pass (the server appends steps as it goes)
 *  POST /api/outreach  approve drafts, all or by id
 * While a pass runs we poll GET so steps stream in as the agents work.
 */
export function useMission() {
  const [state, setState] = useState<MissionState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState<string | "all" | null>(null);
  const [, startTransition] = useTransition();
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/loop", { cache: "no-store" });
    if (!res.ok) throw new Error(`Mission state unavailable (${res.status})`);
    return normalize(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach mission control. Is the server running?");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const runLoop = useCallback(
    (autoApprove: boolean) => {
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
      }, 650);

      fetch("/api/loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApprove, maxEvents: 3 }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
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
    },
    [refresh],
  );

  const approve = useCallback((ids?: string[]) => {
    setError(null);
    setApproving(ids?.length === 1 ? ids[0] : "all");
    fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids?.length ? { ids } : {}),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Approve failed (${res.status})`);
        startTransition(() => setState(normalize(data)));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Approve failed"))
      .finally(() => setApproving(null));
  }, []);

  return { state, loaded, error, running, approving, runLoop, approve, dismissError: () => setError(null) };
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
