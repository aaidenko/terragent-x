import { cn } from "@/lib/utils";

/*
 * Every glyph in the system lives here: thin 1px strokes, square caps,
 * drawn on a 14px grid so they sit on the text baseline like the deck's.
 */

type Dir = "se" | "sw" | "nw" | "ne";
const rotation: Record<Dir, number> = { se: 0, sw: 90, nw: 180, ne: 270 };

type GlyphProps = { className?: string; title?: string };

function a11y(title?: string) {
  return title
    ? { role: "img" as const, "aria-label": title }
    : { "aria-hidden": true as const };
}

/** Diagonal arrow with an L-shaped head — the deck's ↘ / ↗ / ↙. */
export function Arrow({ dir = "se", className, title }: GlyphProps & { dir?: Dir }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="square"
      className={cn("inline-block size-[0.9em] shrink-0", className)}
      style={{ transform: `rotate(${rotation[dir]}deg)` }}
      {...a11y(title)}
    >
      <path d="M2.5 2.5 L11.5 11.5 M11.5 4.75 V11.5 H4.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Horizontal arrow →, used inside pills and buttons. */
export function ArrowRight({ className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="square"
      className={cn("inline-block size-[0.9em] shrink-0", className)}
      {...a11y(title)}
    >
      <path d="M1.5 7 H12.5 M8 2.5 L12.5 7 L8 11.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Two arrows side by side — the deck's ↘↘ / ↙↙ / ↗↗ pairs. */
export function ArrowPair({ dir = "se", className }: GlyphProps & { dir?: Dir }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-[0.35em]", className)}>
      <Arrow dir={dir} />
      <Arrow dir={dir} />
    </span>
  );
}

/** Arrow followed by a corner tick — the deck's "↘ ⌟" pairing. */
export function ArrowTick({ dir = "se", className }: GlyphProps & { dir?: Dir }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-[0.45em]", className)}>
      <Arrow dir={dir} />
      <CornerTick corner="sw" />
    </span>
  );
}

/** L-shaped corner tick ⌟ ⌞. */
export function CornerTick({
  corner = "se",
  className,
}: GlyphProps & { corner?: Dir }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="square"
      aria-hidden
      className={cn("inline-block size-[0.9em] shrink-0", className)}
      style={{ transform: `rotate(${rotation[corner]}deg)` }}
    >
      <path d="M11.5 2.5 V11.5 H2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Four-point sparkle ✦. Only ever placed where two hairlines cross. */
export function Sparkle({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("inline-block size-4 shrink-0 text-paper", className)}
    >
      <path
        fill="currentColor"
        d="M12 0c.5 6.9 4.9 11.4 12 12-7.1.6-11.5 5.1-12 12-.5-6.9-4.9-11.4-12-12C7.1 11.4 11.5 6.9 12 0Z"
      />
    </svg>
  );
}

/**
 * A sparkle centered on an exact coordinate. Use inside a `relative` parent
 * at the point where two hairlines meet.
 */
export function SparkleAt({
  x,
  y,
  className,
}: {
  x: string;
  y: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2", className)}
      style={{ left: x, top: y }}
    >
      <Sparkle className="size-4 md:size-5" />
    </span>
  );
}

/**
 * Crop-mark frame over imagery: four hairlines inset from the edge that run
 * the full length, with sparkles at the intersections (deck slide 1).
 */
export function CropFrame({
  inset = "1.5rem",
  className,
  sparkles = ["bl", "br"],
}: {
  inset?: string;
  className?: string;
  sparkles?: Array<"tl" | "tr" | "bl" | "br">;
}) {
  const at = {
    tl: { x: inset, y: inset },
    tr: { x: `calc(100% - ${inset})`, y: inset },
    bl: { x: inset, y: `calc(100% - ${inset})` },
    br: { x: `calc(100% - ${inset})`, y: `calc(100% - ${inset})` },
  } as const;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      <span className="absolute inset-x-0 h-px bg-paper/40" style={{ top: inset }} />
      <span className="absolute inset-x-0 h-px bg-paper/40" style={{ bottom: inset }} />
      <span className="absolute inset-y-0 w-px bg-paper/40" style={{ left: inset }} />
      <span className="absolute inset-y-0 w-px bg-paper/40" style={{ right: inset }} />
      {sparkles.map((k) => (
        <SparkleAt key={k} x={at[k].x} y={at[k].y} />
      ))}
    </div>
  );
}
