"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Arrow, ArrowRight, CropFrame } from "@/components/deck/glyphs";
import { Display, Reveal } from "@/components/deck/motion";
import { Brand, Glass, LiveDot, Mono, Panel, Pill, Strip } from "@/components/deck/primitives";
import { LOOP_STATUS_LABEL, isApproximateLocation, readFeeds, relativeTime } from "@/components/format";
import { WorldMap, type MapMarker } from "@/components/map/world-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DraftCard,
  FeedHealth,
  LoopHistory,
  LoopLog,
  Readouts,
  SectionHead,
  SignalRows,
} from "./parts";
import { SignalSheet } from "./signal-sheet";
import { useMission, useNow } from "./use-mission";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function MissionConsole({ dots }: { dots: string }) {
  const { state, loaded, error, running, approving, runLoop, approve, dismissError } = useMission();
  const [autoApprove, setAutoApprove] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const now = useNow();

  const latest = state.loops[0];
  const passEvents = useMemo(() => {
    if (!latest) return [];
    const ids = new Set(latest.eventIds);
    const inPass = state.events.filter((e) => ids.has(e.id));
    return inPass.length || latest.status !== "running" ? inPass : state.events;
  }, [latest, state.events]);

  const events = useMemo(
    () =>
      [...state.events].sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          Date.parse(b.observedAt) - Date.parse(a.observedAt),
      ),
    [state.events],
  );

  const passDone = Boolean(latest) && latest?.status !== "running";
  const feeds = useMemo(() => readFeeds(passDone ? passEvents : [], passDone), [passEvents, passDone]);
  const briefIds = useMemo(() => new Set(state.briefs.map((b) => b.eventId)), [state.briefs]);
  const drafts = state.outreach.filter((o) => o.status === "draft");
  const sent = state.outreach.filter((o) => o.status === "sent").length;
  const critical = state.events.filter((e) => e.severity === "critical").length;

  const markers: MapMarker[] = useMemo(
    () =>
      state.events.map((e) => ({
        id: e.id,
        lon: e.lon,
        lat: e.lat,
        severity: e.severity,
        label: e.title.length > 44 ? `${e.title.slice(0, 42)}…` : e.title,
        approximate: isApproximateLocation(e),
      })),
    [state.events],
  );

  const selected = state.events.find((e) => e.id === selectedId) ?? null;
  const open = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  const hasData = state.events.length > 0 || state.loops.length > 0;
  const shownDrafts = showAllDrafts ? state.outreach : state.outreach.slice(0, 6);

  const statusPill = latest ? (
    <Pill live={latest.status === "error"}>
      {running ? <LiveDot quiet /> : null}
      {running ? "Running" : LOOP_STATUS_LABEL[latest.status]}
      <span className="text-faint">· {relativeTime(latest.finishedAt ?? latest.startedAt, now)}</span>
    </Pill>
  ) : (
    <Pill className="text-paper/70">{loaded ? "No passes yet" : "Connecting"}</Pill>
  );

  return (
    <>
      {/* ───────────── Hero: title + controls on ink, planet on gradient ───────────── */}
      <section className="grid md:min-h-[min(86svh,50vw)] md:grid-cols-[minmax(0,0.43fr)_minmax(0,0.57fr)]">
        <Panel tone="ink" className="flex flex-col">
          <Strip left={<Brand />} right={<span className="md:hidden">{statusPill}</span>} className="md:grid-cols-[1fr_auto]" />
          <div className="flex flex-1 flex-col justify-between gap-12 px-5 pt-8 pb-8 md:px-10 md:pt-10 md:pb-10">
            <Display
              as="h1"
              lines={["Mission", "control"]}
              className="text-display-l"
              label="Mission control"
            />

            <div className="flex flex-col gap-7">
              <p className="max-w-[24rem] text-micro text-quiet">
                One pass reads every feed, scores severity, writes verified briefs, matches the
                people in the path and drafts outreach. Nothing is sent until you approve it.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  variant="solid"
                  onClick={() => runLoop(autoApprove)}
                  disabled={running}
                  aria-busy={running}
                >
                  {running ? "Running…" : "Run ops loop"}
                  {!running ? <ArrowRight /> : null}
                </Button>
                <Button
                  size="lg"
                  variant="line"
                  onClick={() => approve()}
                  disabled={running || drafts.length === 0 || approving !== null}
                >
                  {approving === "all"
                    ? "Sending…"
                    : drafts.length
                      ? `Approve ${drafts.length} drafts`
                      : "Approve drafts"}
                </Button>
              </div>

              <label className="group inline-flex w-fit cursor-pointer items-center gap-3 text-micro text-quiet select-none">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="relative inline-flex h-4 w-7 items-center rounded-full border border-hair-strong transition-colors duration-200 peer-checked:border-paper/70 peer-checked:bg-white/10 peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-mist"
                >
                  <span
                    className={cn(
                      "absolute left-[3px] size-2 rounded-full bg-paper/60 transition-transform duration-300 ease-(--ease-deck)",
                      autoApprove && "translate-x-3 bg-paper",
                    )}
                  />
                </span>
                Demo auto-send
                <span className="text-faint">{autoApprove ? "on: drafts send immediately" : "off: drafts wait for you"}</span>
              </label>

              {error ? (
                <div role="alert" className="flex items-start justify-between gap-4 border-t border-hair pt-4">
                  <p className="flex items-start gap-2.5 text-micro text-paper">
                    <LiveDot className="mt-1" />
                    {error}
                  </p>
                  <button onClick={dismissError} className="text-micro text-faint hover:text-paper">
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel tone="dusk" className="relative flex min-h-[22rem] flex-col overflow-hidden">
          <Strip
            className="hidden md:grid md:grid-cols-[1fr_auto]"
            left={<span className="text-quiet">Live signals, Equal Earth projection</span>}
            right={statusPill}
          />
          <div className="relative flex flex-1 items-center px-6 pb-16 md:px-10">
            <CropFrame inset="1.25rem" sparkles={["br"]} className="md:top-[4.6rem]" />
            <WorldMap
              dots={dots}
              markers={markers}
              selectedId={sheetOpen ? selectedId : null}
              onSelect={open}
              className="relative z-0 py-6"
            />
            {!state.events.length ? (
              <p className="absolute inset-x-0 bottom-[2.4rem] z-20 text-center font-mono text-mono text-paper/60">
                {loaded ? "Awaiting first pass" : "Connecting to mission control"}
              </p>
            ) : (
              <div className="absolute bottom-[2.2rem] left-[2.4rem] z-20 flex flex-wrap items-center gap-2">
                <Pill live={critical > 0}>{critical} critical</Pill>
                <Pill>{state.events.length} on the map</Pill>
              </div>
            )}
          </div>
        </Panel>
      </section>

      {/* ───────────── Readouts ───────────── */}
      <Panel tone="ink">
        <Readouts
          items={[
            { label: "Signals", value: state.events.length, note: latest ? `${passEvents.length} this pass` : "none yet" },
            { label: "Briefs", value: state.briefs.length, note: "method + limitations" },
            { label: "Prospects", value: state.prospects.length, note: "inside impact areas" },
            { label: "Sent", value: sent, note: `${drafts.length} awaiting approval` },
          ]}
        />
      </Panel>

      {!hasData && loaded ? (
        <EmptyState onRun={() => runLoop(autoApprove)} running={running} />
      ) : (
        <>
          {/* ───────────── Loop + feeds ───────────── */}
          <Panel tone="ink" className="grid gap-14 border-t border-hair px-5 py-16 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-16 md:px-10 md:py-20">
            <div>
              <SectionHead index={1} title="Latest pass" />
              <LoopLog loop={latest} running={running} />
              <LoopHistory loops={state.loops} now={now} />
            </div>
            <div>
              <SectionHead index={2} title="Feeds" />
              <FeedHealth feeds={feeds} now={now} reading={running} />
              <p className="mt-6 max-w-[26rem] text-micro text-faint">
                A quiet feed returned nothing usable this pass, either because nothing is
                happening or because it was unreachable. The loop never fills gaps with invented
                data; a failed gauge read is replaced by a labeled snapshot.
              </p>
            </div>
          </Panel>

          {/* ───────────── Signals ───────────── */}
          <Panel tone="ink" className="border-t border-hair px-5 py-16 md:px-10 md:py-20">
            <SectionHead
              index={3}
              title="Signals"
              aside={<Mono>{events.length} total · sorted by severity · select one for the full brief</Mono>}
            />
            {events.length ? (
              <div className="border-t border-hair">
                <SignalRows
                  events={events}
                  briefIds={briefIds}
                  selectedId={sheetOpen ? selectedId : null}
                  onSelect={open}
                  now={now}
                />
              </div>
            ) : (
              <p className="border-t border-hair py-8 text-micro text-quiet">
                {running ? "Reading feeds…" : "No signals in memory."}
              </p>
            )}
          </Panel>

          {/* ───────────── Outreach ───────────── */}
          <Panel tone="rise" className="px-5 py-16 md:px-10 md:py-20">
            <SectionHead
              index={4}
              title="Outreach"
              aside={
                <Mono className="text-paper/70">
                  {drafts.length} drafts · {sent} sent · business contacts only, opt-out included
                </Mono>
              }
            />
            {state.outreach.length ? (
              <>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {shownDrafts.map((d, i) => (
                    <Reveal as="li" key={d.id} delay={Math.min(i, 5) * 0.05}>
                      <DraftCard draft={d} approving={approving} onApprove={(id) => approve([id])} compact />
                    </Reveal>
                  ))}
                </ul>
                {state.outreach.length > 6 ? (
                  <div className="mt-8 flex justify-center">
                    <Button variant="glass" onClick={() => setShowAllDrafts((v) => !v)}>
                      {showAllDrafts ? "Show fewer" : `Show all ${state.outreach.length}`}
                      <Arrow dir={showAllDrafts ? "ne" : "se"} />
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <Glass className="p-8">
                <p className="text-micro text-paper/80">
                  Drafts appear here after a pass. Each one cites the signal, the finding and the
                  method, and waits for your approval.
                </p>
              </Glass>
            )}
          </Panel>
        </>
      )}

      <Panel tone="ink">
        <Strip
          left={<Brand />}
          center="Live data: USGS NWIS · NWS · NASA EONET"
          right={
            <Link href="/" className="link-draw inline-flex items-center gap-2 py-1 text-micro text-paper">
              The company <Arrow dir="nw" />
            </Link>
          }
        />
      </Panel>

      <SignalSheet
        event={selected}
        brief={state.briefs.find((b) => b.eventId === selectedId)}
        prospects={state.prospects.filter((p) => p.eventId === selectedId)}
        drafts={state.outreach.filter((o) => o.eventId === selectedId)}
        open={sheetOpen && !!selected}
        onOpenChange={setSheetOpen}
        approving={approving}
        onApprove={(id) => approve([id])}
      />
    </>
  );
}

function EmptyState({ onRun, running }: { onRun: () => void; running: boolean }) {
  return (
    <Panel tone="rise" className="grid gap-10 px-5 py-20 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-10 md:py-28">
      <div>
        <Display as="h2" lines={["Nothing", "read yet."]} className="text-display-l" label="Nothing read yet." />
        <p className="mt-8 max-w-[26rem] text-micro text-paper/80">
          Run a pass to pull live readings from the USGS St. Johns River gauge, active NWS flood
          alerts and NASA EONET open events. It takes a few seconds.
        </p>
      </div>
      <Button size="lg" variant="glass" onClick={onRun} disabled={running}>
        {running ? "Running…" : "Run ops loop"}
        {!running ? <ArrowRight /> : null}
      </Button>
    </Panel>
  );
}
