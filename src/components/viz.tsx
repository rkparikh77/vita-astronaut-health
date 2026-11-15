"use client";

import { useEffect, useState } from "react";
import type { Score } from "@/core/scores";

/** Validated (dataviz validator, dark surface #0c1017): series colors for up to 4 crew lines. */
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#9085e9"];
/** Diverging pair for fold change: down ↔ neutral ↔ up. */
export const DIV_DOWN = "#3987e5";
export const DIV_UP = "#d55181";
export const DIV_MID = "#2a3240";

export function divergingColor(log2fc: number, max = 1.5): string {
  const t = Math.max(-1, Math.min(1, log2fc / max));
  const pole = t >= 0 ? DIV_UP : DIV_DOWN;
  const pct = Math.round(Math.abs(t) * 100);
  return `color-mix(in oklab, ${pole} ${pct}%, ${DIV_MID})`;
}

export type Provenance = "real" | "live" | "model" | "sim";

const PROV: Record<Provenance, { label: string; color: string; tip: string }> = {
  real: { label: "Real data", color: "#3ed6b5", tip: "Measured values from NASA OSDR (Inspiration4 crew)." },
  live: { label: "Live feed", color: "#7aa7ff", tip: "Fetched live from NASA (DONKI, SPDF, SDO, DSN)." },
  model: { label: "Model", color: "#c9b6ff", tip: "Calculated from published rates and the cited papers." },
  sim: { label: "Simulated", color: "#8a94a3", tip: "Simulated in-flight readings built on real baselines and published spaceflight effects." },
};

export function DataBadge({ kind, className = "" }: { kind: Provenance; className?: string }) {
  const p = PROV[kind];
  return (
    <span
      title={p.tip}
      className={`font-data inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${className}`}
      style={{ color: p.color, border: `1px solid color-mix(in srgb, ${p.color} 35%, transparent)`, background: `color-mix(in srgb, ${p.color} 8%, transparent)` }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: p.color }} />
      {p.label}
    </span>
  );
}

/**
 * Animate a number from 0 to `value` on mount. A timer guarantees the final value is shown even
 * when the tab is in the background and the browser pauses animation frames.
 */
export function CountUp({ value, decimals = 0, duration = 900, className = "" }: { value: number; decimals?: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    const done = setTimeout(() => setShown(value), duration + 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [value, duration]);
  return (
    <span className={`font-data tabular-nums ${className}`}>
      {shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

const BAND_COLOR: Record<Score["band"], string> = {
  optimal: "var(--nominal)",
  good: "#8fdc6a",
  fair: "var(--watch)",
  low: "var(--action)",
};

export function bandColor(b: Score["band"]) {
  return BAND_COLOR[b];
}

/** Oura/Whoop-style score ring. */
export function ScoreRing({
  score,
  label,
  size = 120,
  stroke = 9,
  onClick,
  active,
}: {
  score: Score;
  label: string;
  size?: number;
  stroke?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = BAND_COLOR[score.band];
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    // Timer, not rAF: draws even if the tab is backgrounded. The CSS transition animates the sweep.
    const id = setTimeout(() => setDrawn(score.value), 30);
    return () => clearTimeout(id);
  }, [score.value]);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": active } : {})}
      className={`group flex flex-col items-center gap-2 ${onClick ? "cursor-pointer" : ""}`}
      aria-label={`${label} ${score.value} of 100, ${score.band}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - drawn / 100)}
            style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)", filter: `drop-shadow(0 0 8px color-mix(in srgb, ${color} 55%, transparent))` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center leading-none">
            <div className="font-display font-extrabold" style={{ fontSize: size * 0.32 }}>
              {score.value}
            </div>
            <div className="font-data mt-1 text-[9px] uppercase tracking-[0.18em]" style={{ color }}>
              {score.band}
            </div>
          </div>
        </div>
        {active && <div className="absolute -inset-1.5 rounded-full border" style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }} />}
      </div>
      <div className={`font-data text-[10px] uppercase tracking-[0.18em] ${active ? "text-ink" : "text-ink-3 group-hover:text-ink-2"}`}>{label}</div>
    </Tag>
  );
}

export function ContributorBars({ score }: { score: Score }) {
  return (
    <ul className="space-y-2.5">
      {score.contributors.map((c) => {
        const b: Score["band"] = c.score >= 85 ? "optimal" : c.score >= 70 ? "good" : c.score >= 55 ? "fair" : "low";
        return (
          <li key={c.id}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-2">{c.label}</span>
              <span className="font-data text-xs text-ink-3">{c.detail}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.score}%`, background: BAND_COLOR[b] }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
