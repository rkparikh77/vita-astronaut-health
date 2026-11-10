"use client";

import { useEffect, useState } from "react";
import type { CrewState } from "@/core/crew";
import { useScores } from "@/lib/store";
import { ContributorBars, CountUp, DataBadge, ScoreRing, bandColor } from "./viz";

const BLURB = {
  readiness: "How recovered your body is today: HRV and resting heart rate against your own last 30 days, temperature drift and sleep.",
  sleep: "Last night against a 7.5 h need, the debt you've built this week, and how regular your sleep is. Astronauts average ~6 h in flight.",
  countermeasures: "How well you're fighting bone and muscle loss: resistive exercise, hydration (kidney stones) and today's measurement protocol.",
};

export function TodayPanel({ s }: { s: CrewState }) {
  const scores = useScores(s);
  const [sel, setSel] = useState<"readiness" | "sleep" | "countermeasures">("readiness");
  const [ring, setRing] = useState(112);
  useEffect(() => {
    // Three rings must fit side by side on a phone.
    const fit = () => setRing(window.innerWidth < 420 ? 90 : 112);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  if (!scores) return null;
  const score = scores[sel];
  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
      <div className="panel ticks rise relative overflow-hidden p-5" style={{ animationDelay: "40ms" }}>
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl transition-colors duration-700"
          style={{ background: bandColor(score.band) }}
        />
        <div className="flex items-center justify-between">
          <h2 className="panel-title">Today</h2>
          <DataBadge kind="sim" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <ScoreRing score={scores.readiness} label="Readiness" size={ring} onClick={() => setSel("readiness")} active={sel === "readiness"} />
          <ScoreRing score={scores.sleep} label="Sleep" size={ring} onClick={() => setSel("sleep")} active={sel === "sleep"} />
          <ScoreRing score={scores.countermeasures} label={ring < 100 ? "Counter" : "Countermeasures"} size={ring} onClick={() => setSel("countermeasures")} active={sel === "countermeasures"} />
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-4 text-sm text-ink-2">{BLURB[sel]}</p>
          <ContributorBars score={score} />
        </div>
      </div>

      <div className="panel ticks rise p-5" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="panel-title">Body odometer · day {s.readings.reduce((m, r) => Math.max(m, r.day), 0)}</h2>
          <DataBadge kind="model" />
        </div>
        <p className="mt-1 text-xs text-ink-3">What this mission has quietly done so far, from published rates and your exercise record ({Math.round(scores.adherence * 100)}% adherence).</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {scores.odometer.map((o) => (
            <div key={o.id} className="group rounded-xl border border-line bg-bg-2/70 p-3 transition hover:border-line-2" title={`${o.note}\nSource: ${o.source}`}>
              <div className="panel-title text-[9px] leading-tight">{o.label}</div>
              <div className="font-display mt-1.5 text-3xl font-extrabold leading-none">
                {o.id === "bone" || o.id === "calf" ? "−" : o.id === "height" ? "+" : ""}
                <CountUp value={o.value} decimals={o.decimals} className="font-display" />
                <span className="font-data ml-1 text-[10px] font-normal text-ink-3">{o.unit}</span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-ink-3">{o.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
