"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { MAP_W, project } from "./projection";

export type MapMarker = {
  id: string;
  lon: number;
  lat: number;
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  approximate?: boolean;
};

const radius: Record<MapMarker["severity"], number> = {
  low: 2.6,
  medium: 3.4,
  high: 4.4,
  critical: 5.2,
};

/** Crop the empty southern ocean below the trimmed Antarctica. */
const VIEW_H = Math.round((project(0, -60)?.[1] ?? 487) + 6);

/**
 * Dot-matrix Earth. Land is a single server-built path; markers are projected
 * on the client with the same Equal Earth projection. Equator and prime
 * meridian are hairlines, and their crossing carries the system's sparkle.
 */
export function WorldMap({
  dots,
  markers = [],
  selectedId,
  onSelect,
  className,
  dotClassName,
  showAxes = true,
  label = "World map of live signals",
}: {
  dots: string;
  markers?: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  dotClassName?: string;
  showAxes?: boolean;
  label?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const placed = useMemo(
    () =>
      markers
        .map((m) => {
          const p = project(m.lon, m.lat);
          return p ? { ...m, x: p[0], y: p[1] } : null;
        })
        .filter((m): m is MapMarker & { x: number; y: number } => m !== null)
        // draw calm markers first so critical ones sit on top
        .sort((a, b) => radius[a.severity] - radius[b.severity]),
    [markers],
  );

  const origin = project(0, 0) ?? [MAP_W / 2, VIEW_H / 2];
  const focus = placed.find((m) => m.id === (hover ?? selectedId));

  return (
    <figure className={cn("relative w-full", className)} aria-label={label}>
      <svg
        viewBox={`0 0 ${MAP_W} ${VIEW_H}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={label}
      >
        <path
          d={dots}
          className={cn("text-paper/30", dotClassName)}
          stroke="currentColor"
          strokeWidth={2.3}
          strokeLinecap="round"
          fill="none"
        />

        {showAxes ? (
          <g className="text-paper/20" stroke="currentColor" strokeWidth={1}>
            <line x1={0} x2={MAP_W} y1={origin[1]} y2={origin[1]} vectorEffect="non-scaling-stroke" />
            <line x1={origin[0]} x2={origin[0]} y1={0} y2={VIEW_H} vectorEffect="non-scaling-stroke" />
          </g>
        ) : null}
        {showAxes ? (
          <path
            transform={`translate(${origin[0] - 7} ${origin[1] - 7}) scale(0.5833)`}
            fill="currentColor"
            className="text-paper"
            d="M12 0c.5 6.9 4.9 11.4 12 12-7.1.6-11.5 5.1-12 12-.5-6.9-4.9-11.4-12-12C7.1 11.4 11.5 6.9 12 0Z"
          />
        ) : null}

        {focus ? (
          <g className="text-paper/45" stroke="currentColor" strokeWidth={1} pointerEvents="none">
            <line x1={0} x2={MAP_W} y1={focus.y} y2={focus.y} vectorEffect="non-scaling-stroke" strokeDasharray="2 4" />
            <line x1={focus.x} x2={focus.x} y1={0} y2={VIEW_H} vectorEffect="non-scaling-stroke" strokeDasharray="2 4" />
          </g>
        ) : null}

        {placed.map((m) => {
          const r = radius[m.severity];
          const hot = m.severity === "critical";
          const active = m.id === selectedId || m.id === hover;
          return (
            <g
              key={m.id}
              transform={`translate(${m.x} ${m.y})`}
              className={cn(onSelect && "cursor-pointer")}
              onMouseEnter={() => setHover(m.id)}
              onMouseLeave={() => setHover(null)}
              onClick={onSelect ? () => onSelect(m.id) : undefined}
            >
              {hot ? (
                <circle r={r} className="origin-center animate-live fill-flare" style={{ transformBox: "fill-box" }} />
              ) : null}
              <circle r={r + 7} fill="transparent" />
              <circle
                r={active ? r + 1.4 : r}
                className={cn(
                  "transition-[r] duration-300",
                  hot ? "fill-flare" : m.severity === "high" ? "fill-paper" : "fill-paper/70",
                )}
                stroke={active ? "var(--paper)" : "none"}
                strokeWidth={active ? 1 : 0}
                strokeOpacity={0.9}
                fillOpacity={m.approximate ? 0.55 : 1}
              />
              {active ? (
                <circle r={r + 6} fill="none" stroke="var(--paper)" strokeOpacity={0.6} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ) : null}
            </g>
          );
        })}
      </svg>

      {focus ? (
        <figcaption
          className="pointer-events-none absolute z-10 max-w-[16rem] -translate-y-full pb-3 font-mono text-mono text-paper"
          style={{
            left: `${(focus.x / MAP_W) * 100}%`,
            top: `${(focus.y / VIEW_H) * 100}%`,
            transform: `translate(${focus.x > MAP_W * 0.66 ? "-100%" : "10px"}, -100%)`,
          }}
        >
          <span className="glass-pill inline-block truncate px-3 py-1 align-bottom">
            {focus.label}
            <span className="text-faint">
              {" "}
              · {Math.abs(focus.lat).toFixed(2)}°{focus.lat >= 0 ? "N" : "S"}{" "}
              {Math.abs(focus.lon).toFixed(2)}°{focus.lon >= 0 ? "E" : "W"}
              {focus.approximate ? " ≈" : ""}
            </span>
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
