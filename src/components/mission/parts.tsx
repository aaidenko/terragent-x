"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Arrow, ArrowRight, SparkleAt } from "@/components/deck/glyphs";
import { CountUp, EASE_DECK } from "@/components/deck/motion";
import { Glass, IndexMark, LiveDot, Mono, Pill } from "@/components/deck/primitives";
import {
  DRAFT_STATUS_LABEL,
  FEED_STATE_LABEL,
  LOOP_STATUS_LABEL,
  MARKET_LABEL,
  SEVERITY_LABEL,
  SEVERITY_LEVEL,
  STEP_LABEL,
  clock,
  coords,
  isApproximateLocation,
  isFallback,
  relativeTime,
  type FeedReading,
} from "@/components/format";
import { Button } from "@/components/ui/button";
import type { LoopRun, OutreachDraft, SignalEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ───────────── Severity meter: four hairline bars, flare only when critical ───────────── */
export function SeverityMeter({ severity, className }: { severity: SignalEvent["severity"]; className?: string }) {
  const level = SEVERITY_LEVEL[severity];
  const hot = severity === "critical";
  return (
    <span
      role="img"
      aria-label={`Severity: ${SEVERITY_LABEL[severity]}`}
      className={cn("inline-flex h-3.5 items-end gap-[3px]", className)}
    >
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={cn(
            "w-[3px] rounded-[1px]",
            b <= level ? (hot ? "bg-flare" : "bg-paper") : "bg-paper/15",
          )}
          style={{ height: `${35 + b * 16}%` }}
        />
      ))}
    </span>
  );
}

/* ───────────── Readouts band ───────────── */
export function Readouts({
  items,
}: {
  items: { label: string; value: number; note?: ReactNode }[];
}) {
  return (
    <div className="relative grid grid-cols-2 border-t border-hair md:grid-cols-4">
      <SparkleAt x="25%" y="0%" className="hidden md:block" />
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            "flex min-h-[11rem] flex-col justify-between gap-6 px-5 py-6 md:min-h-[14rem] md:px-8 md:py-7",
            i % 2 === 1 && "border-l border-hair",
            i >= 2 && "border-t border-hair md:border-t-0",
            i === 2 && "md:border-l",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-micro text-quiet">{it.label}</p>
            <IndexMark n={i + 1} />
          </div>
          <div>
            <p className="text-display-m tabular">
              <CountUp value={it.value} pad={2} duration={1} />
            </p>
            {it.note ? <p className="mt-2 font-mono text-mono text-faint">{it.note}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Feed health ───────────── */
export function FeedHealth({ feeds, now, reading }: { feeds: FeedReading[]; now: number; reading?: boolean }) {
  return (
    <ul>
      {feeds.map((f, i) => (
        <li
          key={f.id}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-1.5 py-5",
            i > 0 && "border-t border-hair",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <FeedDot state={f.state} />
            <p className="truncate text-body">{f.name}</p>
          </div>
          <p className="text-display-s tabular row-span-2 self-center leading-none">
            {f.state === "idle" ? "—" : String(f.count).padStart(2, "0")}
          </p>
          <div className="min-w-0 pl-[1.15rem]">
            <p className="text-micro text-quiet">
              {reading ? "Reading…" : FEED_STATE_LABEL[f.state]}
              {f.latestAt ? <span className="text-faint"> · latest {relativeTime(f.latestAt, now)}</span> : null}
            </p>
            <Mono className="mt-1 block truncate text-faint">{f.endpoint}</Mono>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FeedDot({ state }: { state: FeedReading["state"] }) {
  if (state === "live") return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-paper" />;
  if (state === "fallback")
    return <span aria-hidden className="size-1.5 shrink-0 rounded-full border border-silver" />;
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-paper/20" />;
}

/* ───────────── Loop log ───────────── */
export function LoopLog({ loop, running }: { loop?: LoopRun; running: boolean }) {
  const reduce = useReducedMotion();
  if (!loop) {
    return (
      <p className="py-6 text-micro text-quiet">
        No passes yet. Each run reads every feed, writes briefs, matches buyers and drafts outreach.
      </p>
    );
  }
  const duration =
    loop.finishedAt && loop.startedAt
      ? ((Date.parse(loop.finishedAt) - Date.parse(loop.startedAt)) / 1000).toFixed(1)
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <Mono className="text-quiet">
          {loop.id} · started {clock(loop.startedAt)}
          {duration ? ` · ${duration}s` : ""}
        </Mono>
        <Pill live={loop.status === "error"} className={cn(loop.status === "running" && "text-paper")}>
          {loop.status === "running" ? <LiveDot quiet /> : null}
          {LOOP_STATUS_LABEL[loop.status]}
        </Pill>
      </div>
      <div className="relative h-px overflow-hidden bg-hair">
        {running ? <span className="absolute inset-y-0 left-0 w-1/4 animate-scan bg-paper/70" /> : null}
      </div>
      <ol aria-live="polite" className="font-mono text-mono">
        <AnimatePresence initial={false}>
          {loop.steps.map((s, i) => (
            <motion.li
              key={`${s.at}-${i}`}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_DECK }}
              className="grid grid-cols-[4.6rem_5rem_minmax(0,1fr)] gap-3 border-b border-hair py-3 md:grid-cols-[5.2rem_6rem_minmax(0,1fr)]"
            >
              <span className="text-faint tabular">{clock(s.at)}</span>
              <span className={cn(s.name === "error" ? "text-flare" : "text-paper")}>
                {STEP_LABEL[s.name] ?? s.name}
              </span>
              <span className="text-quiet">{s.detail}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

export function LoopHistory({ loops, now }: { loops: LoopRun[]; now: number }) {
  if (loops.length < 2) return null;
  return (
    <div className="mt-10">
      <p className="pb-3 text-micro text-quiet">Earlier passes</p>
      <ul className="font-mono text-mono">
        {loops.slice(1, 6).map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-4 border-t border-hair py-2.5">
            <span className="text-quiet">{l.id}</span>
            <span className="text-faint">
              {l.eventIds.length} signals · {l.outreachIds.length} drafts · {LOOP_STATUS_LABEL[l.status]} ·{" "}
              {relativeTime(l.startedAt, now)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── Signals table ───────────── */
export function SignalRows({
  events,
  briefIds,
  selectedId,
  onSelect,
  now,
}: {
  events: SignalEvent[];
  briefIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  return (
    <ul>
      {events.map((e) => {
        const hasBrief = briefIds.has(e.id);
        const active = selectedId === e.id;
        return (
          <li key={e.id} className="border-t border-hair first:border-t-0">
            <button
              type="button"
              onClick={() => onSelect(e.id)}
              aria-label={`${e.title}. ${SEVERITY_LABEL[e.severity]}. Open details`}
              className={cn(
                "group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-5 gap-y-2 py-5 text-left transition-colors duration-200 md:grid-cols-[auto_minmax(0,1fr)_9rem_8rem_auto] md:items-center md:py-6",
                active ? "bg-white/[0.04]" : "hover:bg-white/[0.025]",
              )}
            >
              <span className="pt-1 pl-1 md:pt-0">
                <SeverityMeter severity={e.severity} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body text-paper">{e.title}</span>
                <span className="mt-1 block truncate text-micro text-faint">
                  {isFallback(e) ? "Fallback snapshot · " : ""}
                  {e.summary}
                </span>
              </span>
              <span className="hidden text-micro text-quiet md:block">
                {MARKET_LABEL[e.market]}
                {hasBrief ? <span className="text-faint"> · brief</span> : null}
              </span>
              <span className="hidden font-mono text-mono text-faint md:block">
                {coords(e.lat, e.lon, 1)}
                {isApproximateLocation(e) ? " ≈" : ""}
              </span>
              <span className="flex items-center gap-3 font-mono text-mono text-faint">
                <span className="hidden sm:inline">{relativeTime(e.observedAt, now)}</span>
                <Arrow
                  dir="se"
                  className="text-paper/50 transition-transform duration-300 ease-(--ease-deck) group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:-rotate-90 group-hover:text-paper"
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────── Outreach cards ───────────── */
export function DraftCard({
  draft,
  approving,
  onApprove,
  compact,
}: {
  draft: OutreachDraft;
  approving: string | "all" | null;
  onApprove: (id: string) => void;
  compact?: boolean;
}) {
  const busy = approving === draft.id || approving === "all";
  return (
    <Glass className="flex h-full flex-col gap-5 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Pill className="h-6 px-2.5">{draft.channel === "x" ? "X" : "Email"}</Pill>
          <Mono className="truncate text-paper/80">{draft.to}</Mono>
        </div>
        <span
          className={cn(
            "shrink-0 text-micro",
            draft.status === "sent" ? "text-paper" : draft.status === "failed" ? "text-flare" : "text-paper/70",
          )}
        >
          {DRAFT_STATUS_LABEL[draft.status]}
        </span>
      </div>
      {draft.subject ? <p className="text-body text-paper">{draft.subject}</p> : null}
      <p
        className={cn(
          "text-micro whitespace-pre-line text-paper/75",
          compact ? "line-clamp-5" : "line-clamp-[12]",
        )}
      >
        {draft.body}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <Mono className="text-paper/55">
          {draft.status === "sent" && draft.sentAt ? `sent ${clock(draft.sentAt)}` : `drafted ${clock(draft.createdAt)}`}
        </Mono>
        {draft.status === "draft" ? (
          <Button
            variant="glass"
            size="sm"
            disabled={busy}
            onClick={() => onApprove(draft.id)}
            aria-label={`Approve and send to ${draft.to}`}
          >
            {busy ? "Sending…" : "Approve"}
            <ArrowRight />
          </Button>
        ) : null}
      </div>
    </Glass>
  );
}

/* ───────────── Section header used across mission control ───────────── */
export function SectionHead({
  index,
  title,
  aside,
  id,
}: {
  index: number;
  title: string;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="flex items-start gap-3">
        <IndexMark n={index} />
        <h2 id={id} className="text-display-s">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}
