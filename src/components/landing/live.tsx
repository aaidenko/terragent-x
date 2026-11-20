import Link from "next/link";
import { Arrow, CropFrame } from "@/components/deck/glyphs";
import { CountUp, Reveal } from "@/components/deck/motion";
import { Mono, Panel, Pill, Rule } from "@/components/deck/primitives";
import {
  FEEDS,
  feedOf,
  isApproximateLocation,
  isFallback,
  relativeTime,
} from "@/components/format";
import { landDotsPath } from "@/components/map/land-dots";
import { WorldMap, type MapMarker } from "@/components/map/world-map";
import { SectionStrip } from "./story";
import { pulse } from "./pulse-cache";

/* ───────────── Slide 5 — giant live readouts beside the planet ───────────── */
export async function LiveNow() {
  const p = await pulse();
  const events = p.events;
  const gauge = events.find((e) => e.id === "flood-cocoa-stjohns");
  const stage = Number(gauge?.metrics?.stageFt);
  const hasStage = gauge && Number.isFinite(stage);
  const critical = events.filter((e) => e.severity === "critical" || e.severity === "high").length;
  const feedsUp = FEEDS.filter((f) => events.some((e) => feedOf(e) === f.id)).length;

  const markers: MapMarker[] = events.map((e) => ({
    id: e.id,
    lon: e.lon,
    lat: e.lat,
    severity: e.severity,
    label: e.title.length > 44 ? `${e.title.slice(0, 42)}…` : e.title,
    approximate: isApproximateLocation(e),
  }));

  return (
    <section aria-labelledby="live-title" className="relative">
      <Panel tone="ink">
        <SectionStrip label="Live now" center="Read from public feeds, not a saved file" />
      </Panel>

      <div className="grid md:min-h-[min(88svh,50vw)] md:grid-cols-[minmax(0,0.56fr)_minmax(0,0.44fr)]">
        <Panel tone="rise" className="flex flex-col justify-center px-5 py-12 md:px-10 md:py-14">
          <h2 id="live-title" className="sr-only">
            Live now
          </h2>

          <Rule className="bg-paper/20" />
          <Readout
            value={<CountUp value={events.length} pad={2} />}
            label={
              <>
                Live signals this pass
                <br />
                <span className="text-paper/60">
                  {feedsUp} of {FEEDS.length} feeds reporting
                </span>
              </>
            }
          />
          <Rule className="bg-paper/20" />
          {hasStage ? (
            <Readout
              value={
                <>
                  <CountUp value={stage} decimals={2} />
                  <span className="ml-[0.08em] align-top text-micro tracking-normal text-paper/75">ft</span>
                </>
              }
              label={
                <>
                  {String(gauge.metrics?.gaugeName ?? "St. Johns River near Cocoa")}
                  {gauge.metrics?.site ? ` (${String(gauge.metrics.site)})` : ""}
                  <br />
                  <span className="text-paper/60">
                    {[
                      gauge.metrics?.floodStageFt != null
                        ? `Flood stage ${String(gauge.metrics.floodStageFt)} ft`
                        : null,
                      gauge.metrics?.recordFt != null
                        ? `record crest ${String(gauge.metrics.recordFt)} ft`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {isFallback(gauge) ? " · fallback snapshot" : ""}
                  </span>
                </>
              }
            />
          ) : (
            <Readout
              value={<CountUp value={critical} pad={2} />}
              label={
                <>
                  High or critical
                  <br />
                  <span className="text-paper/60">Signals that warrant a brief</span>
                </>
              }
            />
          )}
          <Rule className="bg-paper/20" />

          <Reveal className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <Mono className="text-paper/70">
              {p.source === "unavailable"
                ? "Feeds unreachable right now. Nothing shown is invented."
                : `Read ${relativeTime(p.readAt)} · ${p.source === "loop" ? "latest ops loop" : "direct from USGS, NWS, NASA"}`}
            </Mono>
            <Link
              href="/mission"
              className="link-draw inline-flex items-center gap-2 py-1 text-micro text-paper"
            >
              Run the loop <Arrow dir="ne" />
            </Link>
          </Reveal>
        </Panel>

        <Panel tone="ink-2" className="relative flex min-h-[22rem] flex-col justify-center overflow-hidden px-6 py-14 md:px-10">
          <CropFrame inset="1.25rem" sparkles={["tr", "bl"]} />
          <WorldMap dots={landDotsPath(9)} markers={markers} className="relative z-0" />
          <div className="pointer-events-none absolute bottom-[2.1rem] left-[2.2rem] z-20 flex items-center gap-3">
            <Pill live={critical > 0}>{critical} high or critical</Pill>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Readout({ value, label }: { value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 py-6 md:py-8">
      <p className="text-display-l tabular">{value}</p>
      <div className="mb-[0.6em] flex max-w-[15rem] items-start gap-3 text-micro text-paper">
        <Arrow dir="se" className="mt-0.5" />
        <p>{label}</p>
      </div>
    </div>
  );
}

export function LiveNowFallback() {
  return (
    <section aria-hidden className="relative">
      <Panel tone="ink">
        <SectionStrip label="Live now" center="Reading public feeds" />
      </Panel>
      <div className="grid md:min-h-[min(88svh,50vw)] md:grid-cols-[minmax(0,0.56fr)_minmax(0,0.44fr)]">
        <Panel tone="rise" className="relative flex flex-col justify-center overflow-hidden px-5 py-12 md:px-10">
          <Rule className="bg-paper/20" />
          <div className="py-8">
            <p className="text-display-l text-paper/25">··</p>
          </div>
          <Rule className="bg-paper/20" />
          <div className="relative mt-6 h-px overflow-hidden">
            <span className="absolute inset-y-0 left-0 w-1/4 animate-scan bg-paper/60" />
          </div>
        </Panel>
        <Panel tone="ink-2" className="min-h-[22rem]" />
      </div>
    </section>
  );
}
