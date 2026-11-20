import Link from "next/link";
import { ArrowPair, ArrowRight } from "@/components/deck/glyphs";
import { Brand, Panel, Pill, Strip } from "@/components/deck/primitives";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] grid-rows-[auto_1fr]">
      <Panel tone="ink">
        <Strip left={<Brand />} center="Ask about any place on Earth" right={<Pill>404</Pill>} />
      </Panel>
      <Panel tone="rise" className="flex flex-col justify-end px-5 pb-12 md:px-10 md:pb-16">
        <div className="flex items-start justify-between gap-6">
          <h1 className="text-display-xl">
            Off the
            <br />
            map.
          </h1>
          <ArrowPair dir="sw" className="mt-[1.4vw] text-[clamp(0.9rem,1.3vw,1.35rem)] text-paper/85" />
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-6">
          <p className="max-w-[24rem] text-micro text-paper/80">
            This coordinate has no page. The planet is still there.
          </p>
          <Link href="/" className={buttonVariants({ variant: "glass" })}>
            Back to TerragentX <ArrowRight />
          </Link>
        </div>
      </Panel>
    </main>
  );
}
