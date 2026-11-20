import { Suspense } from "react";
import { Markets, Model, Different, Roadmap } from "@/components/landing/business";
import { Close } from "@/components/landing/close";
import { Hero } from "@/components/landing/hero";
import { LiveNow, LiveNowFallback } from "@/components/landing/live";
import { Company, Problem, Thesis } from "@/components/landing/story";

/*
 * The landing page is the deck, slide for slide. Live numbers stream in
 * behind Suspense so the first paint never waits on an upstream feed.
 */
export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <Thesis />
      <Problem />
      <Company />
      <Suspense fallback={<LiveNowFallback />}>
        <LiveNow />
      </Suspense>
      <Markets />
      <Model />
      <Different />
      <Roadmap />
      <Close />
    </main>
  );
}
