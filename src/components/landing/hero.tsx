import Link from "next/link";
import { Suspense } from "react";
import { Arrow, ArrowPair, ArrowRight, CropFrame } from "@/components/deck/glyphs";
import { Brand, Panel, Pill, Strip } from "@/components/deck/primitives";
import { Satellite } from "@/components/deck/satellite";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pulse } from "./pulse-cache";

async function LivePill() {
  const p = await pulse();
  if (!p.events.length) {
    return <Pill>Feeds quiet</Pill>;
  }
  return (
    <Pill live>
      Live <span className="text-faint">·</span>{" "}
      <span className="tabular">{p.events.length}</span> signals
    </Pill>
  );
}

const livePill = (
  <Suspense fallback={<Pill className="text-faint">Reading feeds</Pill>}>
    <LivePill />
  </Suspense>
);

/** Slide 1 — image half with crop marks, gradient half with the giant name. */
export function Hero() {
  return (
    <section
      aria-label="TerragentX"
      className="relative grid min-h-[100svh] grid-rows-[minmax(44svh,auto)_auto] md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] md:grid-rows-1"
    >
      {/* Image half */}
      <div className="relative overflow-hidden">
        <Satellite
          scene="florida"
          priority
          sizes="(min-width: 768px) 42vw, 100vw"
          position="30% 50%"
          imgClassName="animate-img-in"
        />
        <CropFrame inset="clamp(0.9rem, 1.9vw, 1.75rem)" sparkles={["tl", "br"]} />
        <Strip className="md:hidden" left={<Brand />} right={livePill} />
        <p className="absolute bottom-[calc(clamp(0.9rem,1.9vw,1.75rem)+0.75rem)] left-[calc(clamp(0.9rem,1.9vw,1.75rem)+0.9rem)] z-20 font-mono text-mono text-paper/75">
          28.45°N 80.60°W <span className="text-paper/40">· Cape Canaveral, FL · ISS, Dec 2020</span>
        </p>
      </div>

      {/* Gradient half */}
      <Panel tone="dusk" className="flex flex-col">
        <Strip
          className="hidden md:grid"
          left={<Brand />}
          center="Earth intelligence, agent-run"
          right={livePill}
        />
        <div className="flex flex-1 flex-col justify-end px-5 pt-14 pb-8 md:px-10 md:pt-0 md:pb-11">
          <div className="flex items-start justify-between gap-6">
            <h1 className="text-[clamp(4.6rem,10.6vw,13.75rem)] leading-[0.84] tracking-[-0.058em]">
              <span className="sr-only">TerragentX</span>
              <span aria-hidden className="-mb-[0.16em] block overflow-hidden pb-[0.16em]">
                <span className="block animate-line-up [animation-delay:120ms]">Terragent</span>
              </span>
              <span aria-hidden className="-mb-[0.16em] block overflow-hidden pb-[0.16em]">
                <span className="block animate-line-up [animation-delay:240ms]">X</span>
              </span>
            </h1>
            <ArrowPair
              dir="sw"
              className="mt-[0.9vw] shrink-0 animate-fade-up text-[clamp(0.9rem,1.3vw,1.35rem)] text-paper/85 [animation-delay:800ms]"
            />
          </div>

          <div className="mt-10 grid gap-7 md:mt-14 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <p className="max-w-[25rem] animate-fade-up text-body text-quiet [animation-delay:520ms]">
              Ask about any place on Earth, or we&apos;ll come to you with the answer.
            </p>
            <div className="flex animate-fade-up flex-wrap items-center gap-x-6 gap-y-3 [animation-delay:640ms]">
              <Link href="/mission" className={cn(buttonVariants({ variant: "solid" }))}>
                Enter mission control
                <ArrowRight className="transition-transform duration-300 ease-(--ease-deck) group-hover/button:translate-x-0.5" />
              </Link>
              <a
                href="#thesis"
                className={cn(buttonVariants({ variant: "quiet" }), "link-draw h-auto py-1")}
              >
                Read the brief <Arrow dir="se" />
              </a>
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}
