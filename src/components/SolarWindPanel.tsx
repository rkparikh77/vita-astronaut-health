"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sun, Wind } from "lucide-react";
import type { SolarWind, SolarWindPoint } from "@/core/solarWind";
import { useMission } from "@/lib/store";
import { DataBadge, SERIES } from "./viz";

// Latest full-disk images from NASA's Solar Dynamics Observatory, refreshed by SDO every ~15 minutes.
const SDO = "https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_";
const CHANNELS = [
  { id: "0193", label: "AIA 193 Å", what: "Hot corona. Dark patches are coronal holes, the source of fast solar wind." },
  { id: "0131", label: "AIA 131 Å", what: "Flaring plasma (~10 million K). Bright knots here are flares in progress." },
  { id: "0304", label: "AIA 304 Å", what: "Chromosphere. Filaments and prominences that can erupt as CMEs." },
  { id: "HMIB", label: "HMI magnetogram", what: "Surface magnetic field. Tangled, mixed-polarity regions produce the biggest flares." },
] as const;

const LEVEL = {
  quiet: { label: "Quiet", color: "var(--nominal)" },
  elevated: { label: "Elevated", color: "var(--watch)" },
  "storm-driving": { label: "Storm-driving", color: "var(--critical)" },
} as const;

export function SolarWindPanel() {
  const { weather } = useMission();
  const sw = weather?.solarWind;
  const [ch, setCh] = useState<(typeof CHANNELS)[number]["id"]>("0193");
  const channel = CHANNELS.find((c) => c.id === ch)!;

  return (
    <section className="panel ticks p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title flex items-center gap-2">
          <Sun size={13} /> The Sun right now · NASA SDO + SPDF
        </h2>
        <DataBadge kind="live" />
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div>
          <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-2xl bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- external, continuously-updated NASA image */}
            <img key={ch} src={`${SDO}${ch}.jpg`} alt={`Latest SDO ${channel.label} image of the Sun`} className="h-full w-full object-cover" loading="lazy" />
            <span className="font-data absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-ink-2">SDO · {channel.label}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCh(c.id)}
                className={`font-data rounded-md px-2 py-1 text-[11px] ${ch === c.id ? "bg-ink text-bg" : "border border-line-2 text-ink-2 hover:text-ink"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">{channel.what}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="panel-title flex items-center gap-2">
              <Wind size={13} /> Solar wind at L1 · NASA Wind
            </h3>
            {sw?.live && (
              <span className="font-data rounded-full px-2 py-0.5 text-[10px] tracking-widest uppercase" style={{ color: LEVEL[sw.level].color, border: `1px solid ${LEVEL[sw.level].color}` }}>
                {LEVEL[sw.level].label}
              </span>
            )}
          </div>
          {!weather && <p className="mt-3 text-sm text-ink-3">Connecting to NASA SPDF…</p>}
          {weather && (!sw || !sw.live) && (
            <p className="mt-3 text-sm text-ink-3">Can&apos;t reach NASA SPDF right now{sw?.error ? ` (${sw.error})` : ""}. The SDO images above still update live.</p>
          )}
          {sw?.live && <SolarWindCharts sw={sw} />}
        </div>
      </div>
    </section>
  );
}

function SolarWindCharts({ sw }: { sw: SolarWind }) {
  const l = sw.latest;
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Speed" value={l?.speed} unit="km/s" warn={(l?.speed ?? 0) >= 600} />
        <Stat label="Density" value={l?.density} unit="p/cm³" warn={(l?.density ?? 0) >= 20} />
        <Stat label="Bz (GSM)" value={l?.bz} unit="nT" warn={(l?.bz ?? 0) <= -10} />
        <Stat label="Pressure" value={l?.pressure} unit="nPa" warn={(l?.pressure ?? 0) >= 5} />
      </div>
      <div className="mt-3 space-y-1">
        <Mini data={sw.series} k="speed" label="Speed · km/s" color={SERIES[1]} refs={[{ y: 600, label: "fast stream" }]} shock={sw.shock?.t} />
        <Mini data={sw.series} k="density" label="Density · p/cm³" color={SERIES[2]} shock={sw.shock?.t} />
        <Mini data={sw.series} k="bz" label="Bz · nT (south < 0)" color={SERIES[0]} refs={[{ y: 0 }, { y: -10, label: "storm driver" }]} shock={sw.shock?.t} showAxis />
      </div>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-ink-2">
        {sw.notes.map((n) => (
          <li key={n} className="flex gap-2">
            <span className="text-ink-3">→</span>
            {n}
          </li>
        ))}
      </ul>
      <p className="font-data mt-3 text-[10px] text-ink-3">
        {sw.source} · {sw.spacecraft} · hourly means · data through {sw.dataThrough?.slice(0, 16).replace("T", " ")} UTC (key parameters lag about a day)
      </p>
    </>
  );
}

function Stat({ label, value, unit, warn }: { label: string; value?: number; unit: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-bg-2/60 px-3 py-2">
      <div className="panel-title text-[9px]">{label}</div>
      <div className="font-data mt-0.5 text-lg" style={{ color: warn ? "var(--watch)" : "var(--ink)" }}>
        {value ?? "—"}
        <span className="ml-1 text-[10px] text-ink-3">{unit}</span>
      </div>
    </div>
  );
}

function Mini({
  data,
  k,
  label,
  color,
  refs = [],
  shock,
  showAxis,
}: {
  data: SolarWindPoint[];
  k: "speed" | "density" | "bz";
  label: string;
  color: string;
  refs?: { y: number; label?: string }[];
  shock?: string;
  showAxis?: boolean;
}) {
  return (
    <div>
      <div className="font-data text-[10px] text-ink-3">{label}</div>
      <div className={showAxis ? "h-[86px]" : "h-[64px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} syncId="solarwind">
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="t"
              hide={!showAxis}
              tickFormatter={(t: string) => `${t.slice(8, 10)}·${t.slice(11, 13)}h`}
              tick={{ fill: "var(--ink-3)", fontSize: 10 }}
              stroke="var(--line)"
              minTickGap={40}
            />
            <YAxis width={36} tick={{ fill: "var(--ink-3)", fontSize: 10 }} stroke="var(--line)" domain={["auto", "auto"]} tickCount={3} />
            <Tooltip
              contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--line-2)", fontSize: 12 }}
              labelFormatter={(t) => `${String(t).slice(5, 16).replace("T", " ")} UTC`}
              formatter={(v) => [v as number, label.split(" · ")[0]]}
            />
            {refs.map((r) => (
              <ReferenceLine key={r.y} y={r.y} stroke="var(--ink-3)" strokeDasharray="3 3" label={r.label ? { value: r.label, fill: "var(--ink-3)", fontSize: 9, position: "insideTopRight" } : undefined} />
            ))}
            {shock && <ReferenceLine x={shock} stroke="var(--critical)" strokeDasharray="2 2" />}
            <Line type="linear" dataKey={k} stroke={color} dot={false} strokeWidth={1.6} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
