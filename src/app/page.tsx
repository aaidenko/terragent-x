import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { PLAYBOOKS } from "@/lib/playbooks";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-scan"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(214,242,106,0.035) 29px)",
        }}
      />
      <div
        aria-hidden
        className="animate-drift pointer-events-none absolute -right-24 top-10 h-[70vh] w-[70vh] rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(62,198,255,0.25) 0%, transparent 65%)",
        }}
      />

      <SiteHeader active="home" />

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="flex min-h-[78vh] flex-col justify-end px-5 pb-16 pt-10 md:px-10 md:pb-24">
          <p className="animate-rise font-mono text-xs tracking-[0.22em] text-signal uppercase">
            Earth intelligence company
          </p>
          <h1 className="animate-rise font-heading mt-4 max-w-5xl text-5xl leading-[0.95] font-extrabold tracking-tight text-foreground md:text-7xl lg:text-8xl">
            Terragent
          </h1>
          <p className="animate-rise mt-6 max-w-xl text-lg text-sand/90 md:text-xl">
            Ask about any place on Earth — or we come to you with the answer.
            Agents watch live public space data, write verified briefs, and reach
            the businesses who need them.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3">
            <Link href="/mission" className={cn(buttonVariants({ size: "lg" }))}>
              Open mission control
            </Link>
            <a
              href="#markets"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              See markets
            </a>
          </div>
        </section>

        <section id="markets" className="border-t border-border/70 px-5 py-16 md:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
              One engine. Five markets.
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Same loop as the original Terragent company — Scout → Analyst →
              Matcher → Closer — now run by Grok Bot teammates over a Cursor-built
              factory. Private brokerage stays on the scale path.
            </p>
            <ul className="mt-10 grid gap-8 md:grid-cols-2">
              {PLAYBOOKS.map((p) => (
                <li key={p.id} className="border-t border-border/80 pt-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-heading text-xl font-semibold">{p.name}</h3>
                    <span className="font-mono text-[11px] tracking-wider text-primary uppercase">
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p.pitch}
                  </p>
                  <p className="mt-3 font-mono text-[11px] text-signal/80">
                    {p.dataSources.join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border/70 px-5 py-16 md:px-10">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="font-heading text-3xl font-bold tracking-tight">
                How the company runs
              </h2>
              <p className="mt-3 text-muted-foreground">
                You talk to the CEO bot. It delegates. The factory processes live
                Earth data. You approve outreach — or flip demo auto-send.
              </p>
              <ol className="mt-8 space-y-4 font-mono text-sm text-foreground/90">
                <li>01 Scout — NWS, USGS, EONET, FIRMS + X ground truth</li>
                <li>02 Analyst — Cursor pipeline writes the brief</li>
                <li>03 Matcher — finds reachable businesses near the AOI</li>
                <li>04 Closer — drafts X + email; human tap to send</li>
              </ol>
            </div>
            <div className="border border-border/80 bg-card/50 p-6 backdrop-blur-sm">
              <p className="font-mono text-xs tracking-widest text-primary uppercase">
                Stack
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>Grok Bot — CEO + 4 workers, skills, routines</li>
                <li>Cursor — EO factory + mission control UI</li>
                <li>Live feeds — USGS NWIS, NWS, NASA EONET</li>
                <li>Scale path — paid imagery brokerage</li>
              </ul>
              <Link
                href="/mission"
                className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}
              >
                Run the loop live
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
