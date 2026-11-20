import { ArrowPair, SparkleAt } from "@/components/deck/glyphs";
import { Display, DrawRule, Reveal } from "@/components/deck/motion";
import { Brand, Glass, IndexMark, Panel, Pill, Strip } from "@/components/deck/primitives";
import { Satellite } from "@/components/deck/satellite";

export function SectionStrip({
  label,
  center = "Ask about any place on Earth",
  className,
}: {
  label: string;
  center?: string;
  className?: string;
}) {
  return <Strip className={className} left={<Brand />} center={center} right={<Pill>{label}</Pill>} />;
}

/* ───────────── Slide 2 — giant word over ink, glass statement on gradient ───────────── */
export function Thesis() {
  return (
    <section id="thesis" aria-labelledby="thesis-title" className="relative scroll-mt-0">
      <Panel tone="ink" className="px-5 pt-20 pb-7 md:px-10 md:pt-28 md:pb-9">
        <Display
          as="h2"
          lines={["Ground truth."]}
          className="text-display-l"
          label="Ground truth."
        />
        <span id="thesis-title" className="sr-only">
          Ground truth
        </span>
      </Panel>

      <Panel tone="rise" className="relative grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div className="px-5 py-12 md:px-10 md:py-20">
          <Reveal>
            <Glass className="max-w-[36rem] p-7 md:p-9">
              <p className="text-title text-paper">
                We read river gauges, flood alerts and wildfire feeds the moment they update,
                and turn them into answers for the people in the way.
              </p>
            </Glass>
          </Reveal>
        </div>

        <div className="relative grid grid-cols-2 gap-8 border-t border-hair px-5 py-12 md:border-t-0 md:border-l md:px-10 md:py-20">
          <SparkleAt x="0%" y="0%" className="hidden md:block" />
          <Reveal delay={0.1} className="flex flex-col justify-end gap-3">
            <h3 className="text-title">Vision</h3>
            <p className="max-w-[15rem] text-micro text-quiet">
              Every place on Earth, understood the moment it changes.
            </p>
          </Reveal>
          <Reveal delay={0.2} className="flex flex-col justify-end gap-3">
            <h3 className="text-title">Mission</h3>
            <p className="max-w-[15rem] text-micro text-quiet">
              Turn free public Earth data into verified local answers, and deliver them first.
            </p>
          </Reveal>
        </div>
      </Panel>
    </section>
  );
}

/* ───────────── Slide 3 — gradient aside, stacked giant rows on ink ───────────── */
const PROBLEMS = ["Alerts arrive late", "Data lives in silos", "Nobody calls first"];

export function Problem() {
  return (
    <section
      aria-labelledby="problem-title"
      className="relative grid md:min-h-[min(100svh,56.25vw)] md:grid-cols-[minmax(0,0.31fr)_minmax(0,0.69fr)]"
    >
      <Panel tone="fall" className="flex flex-col justify-between gap-12 px-5 py-12 md:px-10 md:py-14">
        <div className="md:pt-[38%]">
          <Reveal>
            <Pill id="problem-title">The problem</Pill>
            <p className="mt-5 max-w-[17rem] text-micro text-paper/85">
              Satellites and river gauges measure floods and fires every few minutes. The people in
              their path still hear about it last.
            </p>
          </Reveal>
        </div>
        <ArrowPair dir="ne" className="text-paper/90" />
      </Panel>

      <Panel tone="ink" className="flex flex-col">
        <SectionStrip label="Mission brief · 2026" />
        <ol className="flex flex-1 flex-col justify-center px-5 pb-12 md:px-10 md:pb-16">
          {PROBLEMS.map((p, i) => (
            <li key={p}>
              <DrawRule delay={i * 0.08} />
              <div className="flex items-start gap-3 py-5 md:gap-5 md:py-7">
                <IndexMark n={i + 1} />
                <Display as="p" lines={[p]} className="text-display-m" delay={0.05 + i * 0.08} />
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </section>
  );
}

/* ───────────── Slide 4 — giant claim over a darkened scene, 2×2 glass ───────────── */
const AGENTS = [
  {
    name: "Scout",
    line: "Reads USGS river gauges, NWS alerts and NASA EONET on every pass.",
  },
  {
    name: "Analyst",
    line: "Writes the brief: finding, method, confidence and limitations.",
  },
  {
    name: "Matcher",
    line: "Finds the businesses and people inside the impact area.",
  },
  {
    name: "Closer",
    line: "Drafts the message. A human approves before anything is sent.",
  },
];

export function Company() {
  return (
    <section aria-labelledby="company-title" className="relative isolate overflow-hidden">
      <Satellite scene="fire" sizes="100vw" shade={0.5} position="50% 40%" />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(28_30_36/0.72)_0%,rgb(28_30_36/0.25)_60%,rgb(28_30_36/0.4)_100%)]" />

      <div className="relative z-10 grid gap-12 px-5 py-20 md:min-h-[min(100svh,56.25vw)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center md:px-10 md:py-24">
        <div className="flex flex-col gap-14">
          <Display
            as="h2"
            lines={["Four agents.", "One loop."]}
            className="text-display-m"
            label="Four agents. One loop."
          />
          <span id="company-title" className="sr-only">
            Four agents, one loop
          </span>
          <Reveal className="grid max-w-[30rem] grid-cols-[auto_1fr] gap-x-10 gap-y-2">
            <ArrowPair dir="se" className="mt-1 text-paper/85" />
            <p className="text-micro text-paper/85">
              A CEO agent on Grok Bot coordinates four workers. Every loop runs end to end on live
              public data, and stops for a human before anything leaves the building.
            </p>
          </Reveal>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 md:gap-5">
          {AGENTS.map((a, i) => (
            <Reveal as="li" key={a.name} delay={0.08 * i}>
              <Glass className="flex h-full min-h-[11.5rem] flex-col justify-between gap-8 p-6 md:min-h-[13rem] md:p-7">
                <div className="flex items-start justify-between">
                  <h3 className="text-title">{a.name}</h3>
                  <IndexMark n={i + 1} />
                </div>
                <p className="max-w-[17rem] text-micro text-paper/80">{a.line}</p>
              </Glass>
            </Reveal>
          ))}
        </ul>
      </div>

      <Panel tone="ink" className="relative z-10">
        <SectionStrip label="The company" center="Agent-run, human-approved" />
      </Panel>
    </section>
  );
}
