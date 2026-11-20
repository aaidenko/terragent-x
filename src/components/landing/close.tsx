import Link from "next/link";
import { ArrowPair, ArrowRight } from "@/components/deck/glyphs";
import { Display } from "@/components/deck/motion";
import { Brand, Panel, Strip } from "@/components/deck/primitives";
import { Satellite } from "@/components/deck/satellite";

/* ───────────── Slide 10 — giant sign-off over the gradient, scene below ───────────── */
export function Close() {
  return (
    <footer aria-labelledby="close-title" className="relative">
      <Panel tone="rise" className="px-5 pt-20 pb-14 md:px-10 md:pt-24 md:pb-16">
        <div className="flex items-start justify-between gap-6">
          <Display
            as="h2"
            lines={["Let's read", "the planet."]}
            className="text-display-l"
            label="Let's read the planet."
          />
          <ArrowPair dir="sw" className="mt-[1vw] shrink-0 text-[clamp(0.9rem,1.3vw,1.35rem)] text-paper/85" />
        </div>
        <span id="close-title" className="sr-only">
          Let&apos;s read the planet
        </span>
      </Panel>

      <div className="relative isolate h-[52svh] min-h-[22rem] overflow-hidden md:h-[min(56svh,32vw)]">
        <Satellite scene="terrain" sizes="100vw" position="50% 55%" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgb(28_30_36/0.7))]" />
        <div className="absolute inset-x-0 bottom-0 z-10">
          <Strip
            left={<Brand />}
            center={
              <span className="font-mono text-mono text-paper/60">
                Imagery: NASA JSC · NASA Earth Observatory · USGS EROS
              </span>
            }
            right={
              <Link
                href="/mission"
                className="glass-pill inline-flex h-8 items-center gap-2 px-4 text-micro text-paper transition-colors duration-200 hover:bg-white/25"
              >
                Enter mission control <ArrowRight />
              </Link>
            }
          />
        </div>
      </div>
    </footer>
  );
}
