"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Arrow } from "@/components/deck/glyphs";
import { IndexMark, Mono, Pill } from "@/components/deck/primitives";
import {
  MARKET_LABEL,
  SEVERITY_LABEL,
  coords,
  isApproximateLocation,
  isFallback,
  metricEntry,
  percent,
  utcStamp,
} from "@/components/format";
import type { AnalysisBrief, OutreachDraft, Prospect, SignalEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DraftCard, SeverityMeter } from "./parts";

/**
 * Right-side sheet: everything the pipeline knows about one signal —
 * the raw reading, the verified brief, matched buyers and drafts.
 */
export function SignalSheet({
  event,
  brief,
  prospects,
  drafts,
  open,
  onOpenChange,
  approving,
  onApprove,
}: {
  event: SignalEvent | null;
  brief?: AnalysisBrief;
  prospects: Prospect[];
  drafts: OutreachDraft[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approving: string | "all" | null;
  onApprove: (id: string) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/60 backdrop-blur-[3px] transition-opacity duration-500 ease-(--ease-deck) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="surface-dusk grain fixed inset-y-0 right-0 z-50 flex w-full max-w-[44rem] flex-col border-l border-hair-strong outline-none transition-transform duration-[650ms] ease-(--ease-deck) data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full">
          {event ? (
            <SheetBody
              event={event}
              brief={brief}
              prospects={prospects}
              drafts={drafts}
              approving={approving}
              onApprove={onApprove}
            />
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SheetBody({
  event,
  brief,
  prospects,
  drafts,
  approving,
  onApprove,
}: {
  event: SignalEvent;
  brief?: AnalysisBrief;
  prospects: Prospect[];
  drafts: OutreachDraft[];
  approving: string | "all" | null;
  onApprove: (id: string) => void;
}) {
  const metrics = Object.entries(event.metrics ?? {}).map(([k, v]) => metricEntry(k, v));
  const hot = event.severity === "critical";
  let section = 0;

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-6 py-5 md:px-9">
        <div className="flex items-center gap-2.5">
          <Pill>
            {!hot ? <SeverityMeter severity={event.severity} className="h-3" /> : null}
            {SEVERITY_LABEL[event.severity]}
          </Pill>
          <Pill>{MARKET_LABEL[event.market]}</Pill>
        </div>
        <Dialog.Close
          aria-label="Close details"
          className="glass-pill inline-flex size-8 items-center justify-center text-paper transition-colors hover:bg-white/25"
        >
          <svg viewBox="0 0 14 14" className="size-3" stroke="currentColor" strokeWidth={1} aria-hidden>
            <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" vectorEffect="non-scaling-stroke" />
          </svg>
        </Dialog.Close>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-14 md:px-9">
        <Dialog.Title className="text-title text-paper">{event.title}</Dialog.Title>
        <Dialog.Description className="mt-4 text-micro text-paper/80">{event.summary}</Dialog.Description>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/20 pt-5 font-mono text-mono">
          <Fact label="Observed" value={utcStamp(event.observedAt)} />
          <Fact
            label="Location"
            value={`${coords(event.lat, event.lon, 3)}${isApproximateLocation(event) ? "  (region default)" : ""}`}
          />
          <Fact label="Source" value={event.source} />
          <Fact label="Provenance" value={isFallback(event) ? "Fallback snapshot, live read failed" : "Live read"} />
        </dl>
        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="link-draw mt-5 inline-flex items-center gap-2 py-1 text-micro text-paper"
          >
            Open the source record <Arrow dir="ne" />
          </a>
        ) : null}

        {metrics.length ? (
          <Block index={++section} title="Reading">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {metrics.map((m) => (
                <div key={m.label} className="min-w-0">
                  <dt className="text-micro text-paper/60">{m.label}</dt>
                  <dd className="mt-1 truncate font-mono text-mono text-paper">{m.value}</dd>
                </div>
              ))}
            </dl>
          </Block>
        ) : null}

        <Block index={++section} title="Brief">
          {brief ? (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-body text-paper">{brief.headline}</p>
                <p className="mt-2 text-micro text-paper/80">{brief.finding}</p>
              </div>
              <Confidence value={brief.confidence} />
              {brief.eoConfidence ? (
                <div>
                  <p className="text-micro text-paper/70">
                    Imagery confidence{" "}
                    <span className="font-mono text-paper">{brief.eoConfidence.level}</span>
                    {brief.metrics?.new_water_delta != null
                      ? ` · new water Δ ${(Number(brief.metrics.new_water_delta) * 100).toFixed(2)} pp` +
                        (brief.metrics.new_water_significant === "no" ? " (within noise)" : "")
                      : ""}
                  </p>
                  {brief.eoConfidence.reasons.length ? (
                    <ul className="mt-2 list-disc pl-4 text-micro text-paper/80">
                      {brief.eoConfidence.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              <List label="Method" items={brief.method} ordered />
              {Object.keys(brief.metrics ?? {}).length ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {Object.entries(brief.metrics).map(([k, v]) => {
                    const m = metricEntry(k, v);
                    return (
                      <div key={k} className="min-w-0">
                        <dt className="text-micro text-paper/60">{m.label}</dt>
                        <dd className="mt-1 truncate font-mono text-mono text-paper">{m.value}</dd>
                      </div>
                    );
                  })}
                </dl>
              ) : null}
              <List label="Limitations" items={brief.limitations} />
              <Mono className="text-paper/60">
                Area of interest: {brief.mapHint.label} · {coords(brief.mapHint.lat, brief.mapHint.lon, 3)}
              </Mono>
            </div>
          ) : (
            <p className="text-micro text-paper/70">
              No brief for this signal. The analyst writes briefs for the top signals of each pass.
            </p>
          )}
        </Block>

        {prospects.length ? (
          <Block index={++section} title="Matched">
            <ul>
              {prospects.map((p, i) => (
                <li
                  key={p.id}
                  className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 py-4", i > 0 && "border-t border-white/15")}
                >
                  <p className="text-body text-paper">{p.name}</p>
                  <Mono className="self-center text-paper/80">fit {percent(p.fitScore)}</Mono>
                  <p className="text-micro text-paper/70">
                    {p.kind} · {p.why}
                  </p>
                  <Mono className="text-paper/55">
                    {p.channel === "x" ? "X" : "Email"}{" "}
                    {p.handleOrEmail || "needs contact · no draft made"}
                  </Mono>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        {drafts.length ? (
          <Block index={++section} title="Outreach">
            <div className="grid gap-4">
              {drafts.map((d) => (
                <DraftCard key={d.id} draft={d} approving={approving} onApprove={onApprove} />
              ))}
            </div>
          </Block>
        ) : null}
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-paper/55">{label}</dt>
      <dd className="mt-1 break-words text-paper">{value}</dd>
    </div>
  );
}

function Block({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-start gap-3 border-t border-white/20 pt-5">
        <IndexMark n={index} className="text-paper/70" />
        <h3 className="text-title">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Confidence({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-micro text-paper/70">Confidence</p>
        <Mono className="text-paper">{percent(v)}</Mono>
      </div>
      <div className="relative mt-2 h-px bg-white/20">
        <span className="absolute inset-y-[-1px] left-0 bg-paper" style={{ width: `${v * 100}%` }} />
        <span
          aria-hidden
          className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper"
          style={{ left: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

function List({ label, items, ordered }: { label: string; items: string[]; ordered?: boolean }) {
  if (!items?.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="text-micro text-paper/70">{label}</p>
      <Tag className="mt-2">
        {items.map((it, i) => (
          <li key={i} className="grid grid-cols-[1.6rem_minmax(0,1fr)] border-t border-white/12 py-2.5 text-micro text-paper/85 first:border-t-0">
            <span className="font-mono text-mono text-paper/50">{ordered ? String(i + 1).padStart(2, "0") : "—"}</span>
            <span>{it}</span>
          </li>
        ))}
      </Tag>
    </div>
  );
}
