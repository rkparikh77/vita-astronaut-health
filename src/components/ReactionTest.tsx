"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TRIALS = 8;

type Phase = "intro" | "waiting" | "go" | "early" | "done";

/**
 * Short psychomotor vigilance test (PVT). The target turns green after a random 1.5–4 s
 * delay; the astronaut taps or presses space as fast as possible. Result = median reaction time.
 */
export function ReactionTest({ onComplete, onCancel }: { onComplete: (medianMs: number, lapses: number) => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number>();
  const shownAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const arm = useCallback(() => {
    setPhase("waiting");
    timer.current = setTimeout(() => {
      shownAt.current = performance.now();
      setPhase("go");
    }, 1500 + Math.random() * 2500);
  }, []);

  const hit = useCallback(() => {
    if (phase === "intro") return arm();
    if (phase === "waiting") {
      clearTimeout(timer.current);
      setPhase("early");
      setTimeout(arm, 900);
      return;
    }
    if (phase === "go") {
      const rt = Math.round(performance.now() - shownAt.current);
      setLast(rt);
      const next = [...times, rt];
      setTimes(next);
      if (next.length >= TRIALS) setPhase("done");
      else arm();
    }
  }, [phase, times, arm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        hit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hit]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Median, not mean: one distracted trial shouldn't define the score. Lapses are reported separately.
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted.length ? Math.round(sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
  const lapses = times.filter((t) => t > 500).length;

  const bg = { intro: "var(--panel-2)", waiting: "#1c1410", go: "var(--nominal)", early: "var(--critical)", done: "var(--panel-2)" }[phase];

  return (
    <div className="space-y-3">
      {phase !== "done" ? (
        <button
          type="button"
          // pointerdown fires sooner than click (more accurate timing) and keyboard space is
          // handled by the window listener, so a focused button can't double-count a press.
          onPointerDown={(e) => {
            e.preventDefault();
            hit();
          }}
          className="grid h-44 w-full place-items-center rounded-xl border border-line-2 text-center transition-colors duration-75 select-none"
          style={{ background: bg }}
        >
          <div>
            <div className="font-display text-3xl font-extrabold uppercase" style={{ color: phase === "go" ? "var(--bg)" : "var(--ink)" }}>
              {{ intro: "Tap to start", waiting: "Wait…", go: "Tap!", early: "Too early", done: "" }[phase]}
            </div>
            <div className="font-data mt-2 text-xs" style={{ color: phase === "go" ? "var(--bg)" : "var(--ink-3)" }}>
              {phase === "intro" ? `${TRIALS} trials · tap or press space when it turns green` : `Trial ${Math.min(times.length + 1, TRIALS)}/${TRIALS}${last ? ` · last ${last} ms` : ""}`}
            </div>
          </div>
        </button>
      ) : (
        <div className="rounded-xl border border-line-2 bg-panel-2 p-4 text-center">
          <div className="panel-title">Median reaction time</div>
          <div className="font-display text-5xl font-extrabold">{median} ms</div>
          <div className="font-data mt-1 text-xs text-ink-3">
            {lapses} lapse{lapses === 1 ? "" : "s"} (&gt;500 ms) · fastest {Math.min(...times)} ms
          </div>
          <button type="button" onClick={() => onComplete(median, lapses)} className="mt-4 w-full rounded-lg bg-nominal py-2 text-sm font-semibold text-bg">
            Save result
          </button>
        </div>
      )}
      <button type="button" onClick={onCancel} className="w-full text-xs text-ink-3 hover:text-ink">
        Cancel
      </button>
    </div>
  );
}
