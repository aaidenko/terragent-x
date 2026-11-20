import Link from "next/link";
import { Arrow, ArrowRight, CornerTick, SparkleAt } from "@/components/deck/glyphs";
import { Display, DrawRule, Reveal } from "@/components/deck/motion";
import { Brand, Glass, IndexMark, LiveDot, Panel, Pill, Strip } from "@/components/deck/primitives";
import { PLAYBOOKS, type Playbook } from "@/lib/playbooks";
import { cn } from "@/lib/utils";
import { SectionStrip } from "./story";

const SHORT: Record<Playbook["id"], string> = {
  disasters: "Disasters",
  wildfire: "Wildfire",
  deforestation: "Deforestation",
  mining: "Mining",
  private_brokerage: "Brokerage",
};

const STATUS: Record<Playbook["status"], string> = {
  live: "Live",
  ready: "Ready",
  roadmap: "Roadmap",
};

/* ───────────── Slide 6 — markets as giant stacked words, live ones on the band ───────────── */
export function Markets() {
  return (
    <section aria-labelledby="markets-title" className="relative">
      <Panel tone="ink">
        <SectionStrip label="Markets" center="One engine, five markets" />
        <h2 id="markets-title" className="sr-only">
          Markets
        </h2>
      </Panel>

      <ol>
        {PLAYBOOKS.map((p, i) => {
          const live = p.status === "live";
          return (
            <li key={p.id}>
              <Panel
                tone={live ? "band" : "ink"}
                className={cn(
                  "grid grid-cols-1 gap-5 px-5 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)_auto] md:items-center md:gap-10 md:px-10 md:py-9",
                  live && i > 0 && "border-t border-white/15",
                  !live && "border-t border-hair",
                )}
              >
                <div className={cn("flex items-start gap-3 md:gap-5", live && "md:pl-[16vw]")}>
                  <IndexMark n={i + 1} className={live ? "text-paper/80" : undefined} />
                  <Display as="h3" lines={[SHORT[p.id]]} className="text-display-m" delay={0.04 * i} />
                </div>
                <Reveal className="flex max-w-[22rem] items-start gap-3 text-micro">
                  <Arrow dir="se" className="mt-0.5 shrink-0" />
                  <p className={live ? "text-paper/90" : "text-quiet"}>{p.pitch}</p>
                </Reveal>
                <div className="md:justify-self-end">
                  <Pill className={cn(!live && "text-paper/70")}>
                    {live ? <LiveDot quiet className="[&>span]:bg-paper" /> : null}
                    {STATUS[p.status]}
                  </Pill>
                </div>
              </Panel>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ───────────── Slide 8 — ink headline, gradient list, sparkle at the seam ───────────── */
const DIFFERENT = [
  {
    name: "Verified",
    line: "Every brief ships with its method, confidence and known limitations.",
  },
  {
    name: "Resilient",
    line: "Feeds fail and gauges flap. The loop falls back, labels it, and never invents data.",
  },
  {
    name: "Proactive",
    line: "We find the people in the path and reach them before the adjuster does.",
  },
];

export function Different() {
  return (
    <section
      aria-labelledby="different-title"
      className="relative grid md:min-h-[min(100svh,56.25vw)] md:grid-cols-[minmax(0,0.61fr)_minmax(0,0.39fr)]"
    >
      <Panel tone="ink" className="relative flex flex-col">
        <div className="flex-1 px-5 pt-16 pb-14 md:px-10 md:pt-14">
          <Display
            as="h2"
            lines={["Why it", "holds up"]}
            className="text-display-l"
            label="Why it holds up"
          />
          <span id="different-title" className="sr-only">
            Why it holds up
          </span>
        </div>
        <div className="relative border-t border-hair">
          <SparkleAt x="100%" y="0%" className="hidden md:block" />
          <Strip left={<Brand />} center="Built for gaps, bad values and feeds that go down" />
        </div>
      </Panel>

      <Panel tone="fall" className="flex flex-col justify-between px-5 py-12 md:px-10 md:py-14">
        <ul className="md:mt-[12%]">
          {DIFFERENT.map((d, i) => (
            <li key={d.name}>
              <DrawRule className="bg-paper/30" delay={i * 0.1} />
              <Reveal
                delay={0.08 + i * 0.1}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-6 py-6 md:py-7"
              >
                <h3 className="text-title">{d.name}</h3>
                <p className="text-micro text-paper/85">{d.line}</p>
              </Reveal>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-end">
          <Link href="/mission" className="glass-pill inline-flex h-8 items-center gap-2 px-4 text-micro text-paper transition-colors duration-200 hover:bg-white/25">
            See it live <ArrowRight />
          </Link>
        </div>
      </Panel>
    </section>
  );
}

/* ───────────── Slide 9 — staggered glass cards on the gradient ───────────── */
const PHASES = [
  {
    label: "Now",
    title: "Disasters & wildfire",
    line: "Live on river gauges, NWS alerts and NASA EONET, with a human approving every send.",
  },
  {
    label: "Next",
    title: "Deforestation & mining",
    line: "Playbooks ready: forest-loss alerts near suppliers, pit growth near landowners.",
  },
  {
    label: "Then",
    title: "Data brokerage",
    line: "When free imagery is not enough, agents quote paid scenes and sell the answer.",
  },
  {
    label: "Later",
    title: "Any place on Earth",
    line: "Ask about a parcel, a river, a supply chain. The agents answer from orbit.",
  },
];

export function Roadmap() {
  return (
    <section aria-labelledby="roadmap-title" className="relative">
      <Panel tone="fall" className="flex flex-col justify-center px-5 py-16 md:min-h-[min(100svh,56.25vw)] md:px-10 md:py-20">
        <h2 id="roadmap-title" className="sr-only">
          Roadmap
        </h2>
        <ul className="grid gap-5 md:grid-cols-2 md:gap-x-6 md:gap-y-8">
          {PHASES.map((ph, i) => (
            <Reveal
              as="li"
              key={ph.label}
              delay={0.08 * i}
              className={cn(i >= 2 && "md:translate-x-[12%]", "md:max-w-[88%]")}
            >
              <Glass className="grid h-full grid-cols-[auto_minmax(0,1fr)] items-center gap-6 p-6 md:gap-8 md:p-8">
                <p className="text-display-m">{ph.label}</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    {i % 2 ? <Arrow dir="se" className="mt-0.5" /> : <CornerTick corner="se" className="mt-0.5" />}
                    <h3 className="text-micro text-paper">{ph.title}</h3>
                  </div>
                  <p className="text-micro text-paper/75">{ph.line}</p>
                </div>
              </Glass>
            </Reveal>
          ))}
        </ul>
      </Panel>
      <Panel tone="ink">
        <SectionStrip label="Roadmap" center="Live today, built to widen" />
      </Panel>
    </section>
  );
}

