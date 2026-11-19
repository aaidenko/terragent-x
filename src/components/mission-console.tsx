"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AnalysisBrief,
  BroadcastDraft,
  LoopRun,
  OutreachDraft,
  Prospect,
  SignalEvent,
} from "@/lib/types";
import { PLAYBOOKS } from "@/lib/playbooks";

type MissionState = {
  events: SignalEvent[];
  briefs: AnalysisBrief[];
  prospects: Prospect[];
  outreach: OutreachDraft[];
  broadcasts: BroadcastDraft[];
  loops: LoopRun[];
};

const empty: MissionState = {
  events: [],
  briefs: [],
  prospects: [],
  outreach: [],
  broadcasts: [],
  loops: [],
};

export function MissionConsole() {
  const [state, setState] = useState<MissionState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [session, setSession] = useState<string | null>(null);

  function applyPayload(data: Partial<MissionState> & { ok?: boolean; error?: string }) {
    setState({
      events: data.events ?? [],
      briefs: data.briefs ?? [],
      prospects: data.prospects ?? [],
      outreach: data.outreach ?? [],
      broadcasts: data.broadcasts ?? [],
      loops: data.loops ?? [],
    });
  }

  async function ensureSession(): Promise<string> {
    if (session) return session;
    const res = await fetch("/api/session", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.session) {
      throw new Error(data.error || "Could not start demo session");
    }
    setSession(data.session as string);
    return data.session as string;
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        const token = await ensureSession();
        const res = await fetch("/api/loop", {
          headers: { "x-terragent-session": token },
        });
        const data = await res.json();
        applyPayload(data);
      } catch {
        setError("Could not load mission state");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runLoop() {
    setError(null);
    startTransition(async () => {
      try {
        const token = await ensureSession();
        const res = await fetch("/api/loop", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-terragent-session": token,
          },
          body: JSON.stringify({ maxEvents: 3 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Loop failed");
        applyPayload(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Loop failed");
      }
    });
  }

  function approveAll() {
    setError(null);
    startTransition(async () => {
      try {
        const token = await ensureSession();
        const res = await fetch("/api/outreach", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-terragent-session": token,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Approve failed");
        applyPayload(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Approve failed");
      }
    });
  }

  function approveBroadcasts() {
    setError(null);
    startTransition(async () => {
      try {
        const token = await ensureSession();
        const res = await fetch("/api/broadcast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-terragent-session": token,
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Broadcast approve failed");
        applyPayload(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Broadcast approve failed");
      }
    });
  }

  const latestLoop = state.loops[0];
  const drafts = state.outreach.filter((o) => o.status === "draft").length;
  const sent = state.outreach.filter((o) => o.status === "sent").length;
  const broadcastDrafts = state.broadcasts.filter((o) => o.status === "draft").length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 pb-20 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-signal uppercase">
            Mission control
          </p>
          <h1 className="font-heading mt-2 text-4xl font-bold tracking-tight md:text-5xl">
            Live company loop
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Pulls real USGS / NWS / NASA EONET data, writes briefs across markets,
            queues X + email outreach. Private brokerage stays on the roadmap strip.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runLoop} disabled={pending} size="lg">
            {pending ? "Running…" : "Run ops loop"}
          </Button>
          <Button
            onClick={approveAll}
            disabled={pending || drafts === 0}
            variant="secondary"
            size="lg"
          >
            Approve {drafts || ""} drafts
          </Button>
          <Button
            onClick={approveBroadcasts}
            disabled={pending || broadcastDrafts === 0}
            variant="outline"
            size="lg"
          >
            Approve {broadcastDrafts || ""} @Terragent posts
          </Button>
        </div>
      </div>

      {error ? (
        <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Events", state.events.length],
          ["Briefs", state.briefs.length],
          ["Prospects", state.prospects.length],
          ["Sent", sent],
        ].map(([label, value]) => (
          <div key={label as string} className="border border-border/70 bg-card/40 px-4 py-3">
            <p className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              {label}
            </p>
            <p className="font-heading mt-1 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {latestLoop ? (
        <section className="border border-border/70 bg-card/30 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-xl font-semibold">Latest loop</h2>
            <Badge variant="secondary">{latestLoop.status}</Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {latestLoop.id}
            </span>
          </div>
          <ol className="mt-4 space-y-2">
            {latestLoop.steps.map((s, i) => (
              <li key={`${s.at}-${i}`} className="flex gap-3 font-mono text-xs md:text-sm">
                <span className="text-primary">{s.name}</span>
                <span className="text-muted-foreground">{s.detail}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Live signals</h2>
          <ul className="mt-4 space-y-4">
            {state.events.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                No events yet — hit Run ops loop.
              </li>
            ) : (
              state.events.slice(0, 8).map((e) => (
                <li key={e.id} className="border-t border-border/60 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{e.market}</Badge>
                    <Badge variant="outline">{e.severity}</Badge>
                  </div>
                  <p className="mt-2 font-medium">{e.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                    {e.summary}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-signal">
                    {e.source}
                    {e.metrics?.stageFt != null
                      ? ` · stage ${e.metrics.stageFt} ft`
                      : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h2 className="font-heading text-2xl font-semibold">Analysis briefs</h2>
          <ul className="mt-4 space-y-4">
            {state.briefs.length === 0 ? (
              <li className="text-sm text-muted-foreground">Waiting for analyst.</li>
            ) : (
              state.briefs.slice(0, 6).map((b) => (
                <li key={b.id} className="border-t border-border/60 pt-4">
                  <p className="font-medium">{b.headline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{b.finding}</p>
                  <p className="mt-2 font-mono text-[11px] text-primary">
                    confidence {Math.round(b.confidence * 100)}% ·{" "}
                    {b.method[0]}
                  </p>
                  {b.metrics?.ndwi_water_fraction != null ? (
                    <p className="mt-1 font-mono text-[11px] text-signal">
                      water {(Number(b.metrics.ndwi_water_fraction) * 100).toFixed(2)}%
                      {b.metrics.eo_model ? ` · ${b.metrics.eo_model}` : ""}
                      {b.metrics.mlp_train_acc != null
                        ? ` · mlp ${(Number(b.metrics.mlp_train_acc) * 100).toFixed(0)}%`
                        : ""}
                      {b.metrics.water_fraction_delta != null
                        ? ` · Δ ${(Number(b.metrics.water_fraction_delta) * 100).toFixed(2)} pp`
                        : ""}
                      {b.metrics.sentinel_cloud_pct != null
                        ? ` · cloud ${b.metrics.sentinel_cloud_pct}%`
                        : ""}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Prospects</h2>
          <ul className="mt-4 space-y-3">
            {state.prospects.slice(0, 8).map((p) => (
              <li key={p.id} className="border-t border-border/60 pt-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.why}</p>
                <p className="mt-1 font-mono text-[11px] text-signal">
                  {p.channel} → {p.handleOrEmail} · fit {Math.round(p.fitScore * 100)}%
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-heading text-2xl font-semibold">Outreach queue</h2>
          <ul className="mt-4 space-y-3">
            {state.outreach.slice(0, 8).map((o) => (
              <li key={o.id} className="border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <Badge variant={o.status === "sent" ? "default" : "secondary"}>
                    {o.status}
                  </Badge>
                  <span className="font-mono text-xs">{o.channel}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {o.to}
                  </span>
                </div>
                {o.subject ? (
                  <p className="mt-1 text-sm font-medium">{o.subject}</p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                  {o.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-2xl font-semibold">
          @Terragent broadcasts
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Public company posts — copy to X or have Grok Closer post after Approve.
        </p>
        <ul className="mt-4 space-y-3">
          {state.broadcasts.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              No broadcasts yet — run the loop.
            </li>
          ) : (
            state.broadcasts.slice(0, 6).map((b) => (
              <li key={b.id} className="border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <Badge variant={b.status === "sent" ? "default" : "secondary"}>
                    {b.status}
                  </Badge>
                  <span className="font-mono text-xs text-signal">{b.handle}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {b.market}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                  {b.body}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-2xl font-semibold">Playbooks</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PLAYBOOKS.map((p) => (
            <div key={p.id} className="border border-border/60 bg-card/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-heading font-semibold">{p.name}</p>
                <span className="font-mono text-[10px] text-primary uppercase">
                  {p.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{p.pitch}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
