"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { crewLabs } from "@/core/crew";
import type { CrewLabs } from "@/core/osdr";
import { DataBadge } from "./viz";

const MARKERS: { group: string; items: { id: string; label: string; unit: string; why: string }[] }[] = [
  {
    group: "Blood & immunity",
    items: [
      { id: "white_blood_cell_count", label: "White blood cells", unit: "K/µL", why: "Overall immune cell count; shifts in flight." },
      { id: "absolute_lymphocytes", label: "Lymphocytes", unit: "cells/µL", why: "Most radiation-sensitive immune cells; low counts allow latent viruses to reactivate." },
      { id: "absolute_neutrophils", label: "Neutrophils", unit: "cells/µL", why: "Rise with acute stress, such as launch and landing." },
      { id: "hemoglobin", label: "Hemoglobin", unit: "g/dL", why: "Oxygen carrier; falls with space anemia." },
      { id: "platelet_count", label: "Platelets", unit: "K/µL", why: "Clotting; relevant to jugular-vein stasis risk." },
    ],
  },
  {
    group: "Metabolic & bone",
    items: [
      { id: "glucose", label: "Glucose", unit: "mg/dL", why: "Insulin resistance builds as muscles go unloaded." },
      { id: "calcium", label: "Calcium", unit: "mg/dL", why: "Released from bone in microgravity; kidney-stone risk." },
      { id: "creatinine", label: "Creatinine", unit: "mg/dL", why: "Kidney function and muscle mass marker." },
      { id: "alkaline_phosphatase", label: "Alkaline phosphatase", unit: "U/L", why: "Partly from bone-forming cells." },
      { id: "albumin", label: "Albumin", unit: "g/dL", why: "Protein status and fluid balance." },
    ],
  },
];

const ORDER = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"];

export function LabPanel({ osdrId, name }: { osdrId: string; name: string }) {
  const labs = crewLabs(osdrId);
  const [tp, setTp] = useState("L-3");
  if (!labs) return null;
  const at = labs.timepoints.find((t) => t.label === tp);
  return (
    <section className="panel ticks rise mt-6 p-5" style={{ animationDelay: "60ms" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="panel-title flex items-center gap-2">
            <FlaskConical size={13} /> Blood panel · {name.split(" ")[0]}&apos;s Inspiration4 profile ({osdrId})
          </h2>
          <DataBadge kind="real" />
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Blood draw">
          {ORDER.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tp === t}
              onClick={() => setTp(t)}
              className={`font-data rounded-md px-2 py-1 text-[10px] tracking-wider ${tp === t ? "bg-ink text-bg" : "text-ink-3 hover:bg-panel-2 hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-3">
        Real clinical results from the crew member&apos;s actual 2021 orbital flight: three draws before launch (L-), four after return (R+). Bars show the
        lab&apos;s reference range; the line traces all seven draws.
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {MARKERS.map((g) => (
          <div key={g.group}>
            <h3 className="font-data text-[10px] tracking-[0.16em] text-ink-3 uppercase">{g.group}</h3>
            <ul className="mt-2 divide-y divide-line">
              {g.items.map((m) => {
                const lab = at?.labs[m.id];
                if (!lab) return null;
                return <Marker key={m.id} m={m} value={lab.value} min={lab.min} max={lab.max} series={seriesOf(labs, m.id)} tp={tp} />;
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function seriesOf(labs: CrewLabs, id: string) {
  return ORDER.map((t) => labs.timepoints.find((x) => x.label === t)?.labs[id]?.value ?? null);
}

function Marker({ m, value, min, max, series, tp }: { m: { label: string; unit: string; why: string }; value: number; min?: number; max?: number; series: (number | null)[]; tp: string }) {
  const lo = min ?? Math.min(...(series.filter((x) => x !== null) as number[]));
  const hi = max ?? Math.max(...(series.filter((x) => x !== null) as number[]));
  const span = hi - lo || 1;
  const pad = span * 0.35;
  const pos = Math.max(0, Math.min(100, ((value - (lo - pad)) / (span + 2 * pad)) * 100));
  const inRange = (min === undefined || value >= min) && (max === undefined || value <= max);
  const color = inRange ? "var(--nominal)" : "var(--watch)";
  const vals = series.filter((x): x is number => x !== null);
  const sMin = Math.min(...vals);
  const sMax = Math.max(...vals);
  const pts = series
    .map((v, i) => (v === null ? null : `${(i / (series.length - 1)) * 100},${22 - ((v - sMin) / (sMax - sMin || 1)) * 18}`))
    .filter(Boolean)
    .join(" ");
  const selIdx = ORDER.indexOf(tp);
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[150px_1fr_90px]" title={m.why}>
      <div className="min-w-0">
        <div className="truncate text-sm text-ink">{m.label}</div>
        <div className="font-data text-[10px] text-ink-3">
          {min !== undefined && max !== undefined ? `ref ${min}–${max}` : "no ref range"} {m.unit}
        </div>
      </div>
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
        <div className="relative h-2 rounded-full bg-panel-2">
          <div className="absolute inset-y-0 rounded-full bg-nominal/20" style={{ left: `${(pad / (span + 2 * pad)) * 100}%`, right: `${(pad / (span + 2 * pad)) * 100}%` }} />
          <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg transition-all duration-500" style={{ left: `${pos}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <svg viewBox="0 0 100 24" className="h-6 w-12" aria-hidden>
          <line x1={(3 / 6) * 100} x2={(3 / 6) * 100} y1="0" y2="24" stroke="var(--line-2)" strokeDasharray="2 2" />
          <polyline points={pts} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {series[selIdx] !== null && <circle cx={(selIdx / 6) * 100} cy={22 - (((series[selIdx] as number) - sMin) / (sMax - sMin || 1)) * 18} r="3" fill={color} />}
        </svg>
        <span className="font-data text-sm tabular-nums" style={{ color: inRange ? "var(--ink)" : "var(--watch)" }}>
          {value}
        </span>
      </div>
    </li>
  );
}
