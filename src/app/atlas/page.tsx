"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, Sparkles } from "lucide-react";
import { FINDINGS, PRESETS, projectMission, projectionSummary, type Finding } from "@/core/atlas";
import { ENV_MAP } from "@/core/environments";
import { CAREER_LIMIT_MSV } from "@/core/radiation";
import { BODY_SYSTEMS } from "@/core/types";
import { DataBadge, SERIES } from "@/components/viz";

const SYSTEM_LABEL: Record<Finding["system"], string> = {
  ...Object.fromEntries(Object.entries(BODY_SYSTEMS).map(([k, v]) => [k, v.organ])),
  genome: "Genome",
} as Record<Finding["system"], string>;

const SHORT: Record<string, string> = {
  fluid: "fluid shift",
  jugular: "neck-vein stasis",
  heart_shape: "rounder heart",
  anemia: "space anemia",
  sleep: "sleep a night",
  muscle: "calf muscle",
  bone: "bone at 1 year",
  spine: "taller",
  sans: "eye changes",
  inspiration4: "changes reversed",
  twins: "Twins Study",
  co2: "cabin CO₂",
};

const TICKS = [
  { d: 0, l: "Launch" },
  { d: 1, l: "Day 1" },
  { d: 7, l: "Week 1" },
  { d: 30, l: "Month 1" },
  { d: 180, l: "6 months" },
  { d: 365, l: "1 year" },
];
// Rounded so server and client render identical style strings.
const pos = (d: number) => Math.round((Math.log10(d + 1) / Math.log10(366)) * 10000) / 100;

export default function AtlasPage() {
  const [system, setSystem] = useState<Finding["system"] | "all">("all");
  const [presetId, setPresetId] = useState("mars");
  const [adherence, setAdherence] = useState(0.8);
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const pts = projectMission(preset.phases, adherence);
  const sum = projectionSummary(preset.phases, adherence);
  // Place each finding on the first lane where it doesn't overlap a previous label (~16% of width each).
  const laneEnds: number[] = [];
  const placed = [...FINDINGS]
    .sort((x, y) => x.onsetDay - y.onsetDay)
    .map((f) => {
      const left = Math.min(84, pos(f.onsetDay));
      let lane = laneEnds.findIndex((end) => end <= left);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = left + 16;
      return { f, lane, left };
    });
  const lanes = laneEnds.length;
  const shown = FINDINGS.filter((f) => system === "all" || f.system === system);
  const systems = [...new Set(FINDINGS.map((f) => f.system))];

  // Phase bands for the charts.
  let acc = 0;
  const bands = preset.phases.map((ph) => {
    const b = { x1: acc, x2: acc + ph.days, label: ENV_MAP[ph.env].short };
    acc += ph.days;
    return b;
  });

  return (
    <div className="pt-8">
      <section className="rise relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          <p className="panel-title flex items-center gap-2">
            <Sparkles size={13} /> Body in space atlas
          </p>
          <DataBadge kind="model" />
        </div>
        <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
          What space
          <br />
          <span className="text-ink-3">does to a body</span>
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          The findings behind every indicator in VITA, from peer-reviewed studies of real astronauts. Some are well known; most people
          have never heard of the backward-flowing neck veins or the rounder heart.
        </p>
      </section>

      {/* Onset timeline */}
      <section className="panel ticks mt-8 p-5">
        <h2 className="panel-title">When it starts · log time from launch</h2>
        <div className="relative mt-6 mb-2" style={{ height: 40 + lanes * 26 }}>
          <div className="absolute right-0 left-0 h-px bg-gradient-to-r from-nominal via-watch to-critical opacity-60" style={{ top: lanes * 26 + 6 }} />
          {TICKS.map((t) => (
            <div key={t.l} className="absolute" style={{ left: `${pos(t.d)}%`, top: lanes * 26 + 2 }}>
              <div className="h-2 w-px bg-line-2" />
              <div className={`font-data mt-1 text-[9px] whitespace-nowrap text-ink-3 ${t.d === 0 ? "" : t.d === 365 ? "-translate-x-full" : "-translate-x-1/2"}`}>{t.l}</div>
            </div>
          ))}
          {placed.map(({ f, lane, left }) => (
            <button
              key={f.id}
              type="button"
              onClick={() => document.getElementById(`f-${f.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="group absolute flex items-center gap-1.5"
              style={{ left: `${left}%`, top: (lanes - 1 - lane) * 26 }}
              title={f.headline}
            >
              <span className={`block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-bg ${f.surprising ? "bg-critical" : "bg-nominal"} transition group-hover:scale-150`} />
              <span className={`font-data rounded bg-bg-2/80 px-1 text-[10px] whitespace-nowrap group-hover:text-ink ${f.surprising ? "text-critical" : "text-ink-2"}`}>
                {f.stat} <span className="hidden text-ink-3 lg:inline">{SHORT[f.id] ?? ""}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="font-data flex gap-4 text-[10px] text-ink-3">
          <span>
            <span className="text-critical">●</span> surprising
          </span>
          <span>
            <span className="text-nominal">●</span> well known
          </span>
        </div>
      </section>

      {/* Findings */}
      <div className="mt-6 flex flex-wrap gap-1">
        {(["all", ...systems] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSystem(s)}
            className={`font-data rounded-md px-2.5 py-1 text-[11px] uppercase tracking-wider ${system === s ? "bg-ink text-bg" : "text-ink-2 hover:bg-panel-2"}`}
          >
            {s === "all" ? "All systems" : SYSTEM_LABEL[s]}
          </button>
        ))}
      </div>
      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((f, i) => (
          <article
            id={`f-${f.id}`}
            key={f.id}
            className="panel ticks rise flex flex-col p-5"
            style={{ animationDelay: `${i * 40}ms`, borderColor: f.surprising ? "color-mix(in srgb, var(--critical) 30%, var(--line))" : undefined }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-display text-5xl font-extrabold" style={{ color: f.surprising ? "var(--critical)" : "var(--ink)" }}>
                {f.stat}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-data text-[10px] uppercase tracking-wider text-ink-3">{SYSTEM_LABEL[f.system]}</span>
                {f.surprising && <span className="font-data rounded-full bg-critical/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-critical">Little known</span>}
              </div>
            </div>
            <h3 className="mt-2 text-lg font-semibold leading-snug">{f.headline}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{f.detail}</p>
            <dl className="font-data mt-4 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <dt className="text-ink-3">Onset</dt>
                <dd>{f.onset}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Recovery</dt>
                <dd className="text-ink-2">{f.recovery}</dd>
              </div>
            </dl>
            <a href={f.url} target="_blank" rel="noreferrer" className="font-data mt-4 flex items-center gap-1.5 border-t border-line pt-3 text-[11px] text-ink-3 hover:text-ink">
              {f.citation} <ExternalLink size={11} />
            </a>
          </article>
        ))}
      </section>

      {/* Mission projector */}
      <section className="panel ticks mt-8 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="panel-title">Mission projector</h2>
              <DataBadge kind="model" />
            </div>
            <p className="mt-1 text-sm text-ink-2">What a mission would do to an average astronaut, from published rates.</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={`font-data rounded-md px-2.5 py-1.5 text-[11px] ${presetId === p.id ? "bg-ink text-bg" : "border border-line-2 text-ink-2 hover:text-ink"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 flex flex-wrap items-center gap-4">
          <span className="panel-title">Exercise adherence</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={adherence}
            onChange={(e) => setAdherence(Number(e.target.value))}
            className="w-56 accent-[var(--nominal)]"
            aria-label="Exercise adherence"
          />
          <span className="font-data text-sm">{Math.round(adherence * 100)}%</span>
          <span className="text-xs text-ink-3">of the ~2 h/day countermeasure program</span>
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile label="Mission length" value={sum.days} unit="days" />
          <Tile label="Radiation dose" value={sum.dose} unit="mSv" alert={sum.exceedsLimit} />
          <Tile label="Of career limit" value={sum.dosePctOfLimit} unit="%" alert={sum.exceedsLimit} />
          <Tile label="Bone (hip/leg)" value={sum.bone} unit="%" decimals={1} />
          <Tile label="Calf muscle" value={sum.calf} unit="%" decimals={1} />
        </div>
        {sum.exceedsLimit && (
          <p className="mt-3 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
            This mission exceeds NASA&apos;s {CAREER_LIMIT_MSV} mSv career limit for any astronaut, before counting a single solar storm. Equal to
            about {Math.round(sum.xrays).toLocaleString()} chest X-rays.
          </p>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="panel-title">Cumulative dose · mSv</h3>
            <div className="mt-2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pts} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="dose-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={SERIES[0]} stopOpacity={0.35} />
                      <stop offset="1" stopColor={SERIES[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="2 6" vertical={false} />
                  {bands.map((b, i) => (
                    <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill={i % 2 ? "var(--ink)" : "transparent"} fillOpacity={0.025} label={{ value: b.label, fill: "var(--ink-3)", fontSize: 9, position: "insideTop" }} />
                  ))}
                  <XAxis dataKey="day" type="number" domain={[0, "dataMax"]} tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} tickFormatter={(d) => `D${d}`} />
                  <YAxis tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, Math.ceil(Math.max(sum.dose, CAREER_LIMIT_MSV * 1.1) / 100) * 100]} />
                  <ReferenceLine y={CAREER_LIMIT_MSV} stroke="var(--critical)" strokeDasharray="4 4" label={{ value: "career limit 600", fill: "var(--critical)", fontSize: 10, position: "insideTopLeft" }} />
                  <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12 }} labelFormatter={(d) => `Mission day ${d}`} formatter={(v: number) => [`${v.toFixed(0)} mSv`, "dose"]} />
                  <Area type="monotone" dataKey="dose" stroke={SERIES[0]} strokeWidth={2} fill="url(#dose-fill)" isAnimationActive animationDuration={700} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="panel-title">Bone & calf muscle · % change</h3>
            <div className="mt-2 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pts} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="2 6" vertical={false} />
                  {bands.map((b, i) => (
                    <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill={i % 2 ? "var(--ink)" : "transparent"} fillOpacity={0.025} />
                  ))}
                  <XAxis dataKey="day" type="number" domain={[0, "dataMax"]} tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} tickFormatter={(d) => `D${d}`} />
                  <YAxis tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <ReferenceLine y={0} stroke="var(--line-2)" />
                  <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12 }} labelFormatter={(d) => `Mission day ${d}`} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
                  <Line type="monotone" dataKey="bone" name="Bone" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive animationDuration={700} />
                  <Line type="monotone" dataKey="calf" name="Calf muscle" stroke={SERIES[3]} strokeWidth={2} dot={false} isAnimationActive animationDuration={700} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[11px] text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded" style={{ background: SERIES[1] }} /> Bone
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded" style={{ background: SERIES[3] }} /> Calf muscle
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          Model: dose rates from MSL RAD and ISS dosimetry; bone ~1%/month unloaded, halved by full exercise adherence; calf −13% at 6
          months with exercise (Trappe 2009), leveling off toward −20%; effects scaled by missing gravity (Moon 0.17 g, Mars 0.38 g).
          Population averages, not predictions for a person.
        </p>
      </section>
    </div>
  );
}

function Tile({ label, value, unit, decimals = 0, alert }: { label: string; value: number; unit: string; decimals?: number; alert?: boolean }) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: alert ? "color-mix(in srgb, var(--critical) 45%, var(--line))" : "var(--line)", background: "var(--bg-2)" }}>
      <div className="panel-title text-[9px]">{label}</div>
      <div className="font-display mt-1 text-3xl font-extrabold" style={{ color: alert ? "var(--critical)" : undefined }}>
        {value.toFixed(decimals)}
        <span className="font-data ml-1 text-xs font-normal text-ink-3">{unit}</span>
      </div>
    </div>
  );
}

