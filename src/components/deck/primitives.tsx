import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ───────────────────────── Strip ─────────────────────────
 * Three small labels spread across an edge: brand · tagline · pill.
 * Every full-height section carries one; it is the site's chrome.
 */
export function Strip({
  left,
  center,
  right,
  className,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative z-20 grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-5 text-micro md:grid-cols-[1fr_1fr_1fr] md:px-10 md:py-7",
        className,
      )}
    >
      <div className="min-w-0 justify-self-start">{left}</div>
      <div className="hidden min-w-0 justify-self-start text-quiet md:block">{center}</div>
      <div className="min-w-0 justify-self-end">{right}</div>
    </div>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="TerragentX home"
      className={cn("text-micro tracking-[-0.01em] text-paper", className)}
    >
      TerragentX
    </Link>
  );
}

/* ───────────────────────── Pill ─────────────────────────
 * The frosted tag from the deck's top-right corner.
 */
export function Pill({
  children,
  className,
  live,
  ...props
}: ComponentProps<"span"> & { live?: boolean }) {
  return (
    <span
      className={cn(
        "glass-pill inline-flex h-7 items-center gap-2 px-3.5 text-micro whitespace-nowrap text-paper/90",
        className,
      )}
      {...props}
    >
      {live ? <LiveDot /> : null}
      {children}
    </span>
  );
}

/* ───────────────────────── Live dot ─────────────────────────
 * The only animated loop in the system, and one of the only places
 * the flare color is allowed.
 */
export function LiveDot({ className, quiet }: { className?: string; quiet?: boolean }) {
  return (
    <span aria-hidden className={cn("relative inline-flex size-1.5 shrink-0", className)}>
      {!quiet ? (
        <span className="absolute inset-0 animate-live rounded-full bg-flare" />
      ) : null}
      <span
        className={cn("relative inline-flex size-1.5 rounded-full", quiet ? "bg-silver" : "bg-flare")}
      />
    </span>
  );
}

/* ───────────────────────── Glass ───────────────────────── */
export function Glass({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("glass", className)} {...props} />;
}

/* ───────────────────────── Rules ───────────────────────── */
export function Rule({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-px w-full bg-hair", className)} />;
}

export function VRule({ className }: { className?: string }) {
  return <div aria-hidden className={cn("w-px self-stretch bg-hair", className)} />;
}

/* ───────────────────────── Index mark ─────────────────────────
 * Tiny superscript ordinal beside giant words. Always sequential.
 */
export function IndexMark({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "font-mono text-mono tabular text-quiet inline-block translate-y-[0.35em] self-start",
        className,
      )}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

/* ───────────────────────── Micro label ───────────────────────── */
export function Micro({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-micro text-quiet", className)} {...props} />;
}

export function Mono({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("font-mono text-mono tabular text-quiet", className)} {...props} />;
}

/* ───────────────────────── Panels ─────────────────────────
 * Ink, gradient and image surfaces. Gradients always carry grain.
 */
type Tone = "ink" | "ink-2" | "fall" | "rise" | "band" | "dusk";

export function Panel({
  tone = "ink",
  className,
  ...props
}: ComponentProps<"div"> & { tone?: Tone }) {
  const surface: Record<Tone, string> = {
    ink: "bg-ink",
    "ink-2": "bg-ink-2",
    fall: "surface-fall grain",
    rise: "surface-rise grain",
    band: "surface-band grain",
    dusk: "surface-dusk grain",
  };
  return <div className={cn(surface[tone], className)} {...props} />;
}
