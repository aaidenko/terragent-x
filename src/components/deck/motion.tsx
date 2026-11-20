"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Motion vocabulary. One easing, long durations, nothing bounces.
 * Every primitive collapses to a static render under reduced motion.
 */
export const EASE_DECK = [0.2, 0.7, 0.1, 1] as const;

/** Giant type that slides up out of a line mask, one line after another. */
export function Display({
  lines,
  as = "h2",
  className,
  lineClassName,
  delay = 0,
  stagger = 0.09,
  label,
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  lineClassName?: string;
  delay?: number;
  stagger?: number;
  /** Accessible name when the visual lines differ from the real text. */
  label?: string;
}) {
  const Tag = as;
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduce = useReducedMotion();

  return (
    <Tag ref={ref} className={cn("font-normal", className)} aria-label={label}>
      {lines.map((line, i) => (
        <span
          key={i}
          aria-hidden={label ? true : undefined}
          className={cn("block overflow-hidden pb-[0.16em] -mb-[0.16em]", lineClassName)}
        >
          <motion.span
            className="block will-change-transform"
            initial={reduce ? false : { y: "108%" }}
            animate={inView || reduce ? { y: "0%" } : undefined}
            transition={{ duration: 1.1, ease: EASE_DECK, delay: delay + i * stagger }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Quiet fade-and-rise for supporting content. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "li" | "section" | "span" | "p";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, ease: EASE_DECK, delay }}
    >
      {children}
    </Comp>
  );
}

/** A hairline that draws itself from left to right. */
export function DrawRule({ className, delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={cn("h-px w-full origin-left bg-hair", className)}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 1.3, ease: EASE_DECK, delay }}
    />
  );
}

/** Numbers that count up once when they scroll into view. */
export function CountUp({
  value,
  className,
  duration = 1.4,
  pad = 0,
  decimals = 0,
  suffix,
}: {
  value: number;
  className?: string;
  duration?: number;
  pad?: number;
  decimals?: number;
  suffix?: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (!inView || reduce) return;
    let raf = 0;
    const start = performance.now();
    const from = current.current;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      current.current = from + (value - from) * eased;
      setN(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduce]);

  const shown = reduce ? value : n;

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {decimals ? shown.toFixed(decimals) : Math.round(shown).toString().padStart(pad, "0")}
      {suffix}
    </span>
  );
}
