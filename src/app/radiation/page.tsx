"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldAlert } from "lucide-react";
import { SolarWindPanel } from "@/components/SolarWindPanel";
import { SpaceWeatherPanel } from "@/components/SpaceWeatherPanel";
import { StatusPill } from "@/components/StatusPill";
import { CREW, MISSION } from "@/core/crew";
import { ENVIRONMENTS, ENV_MAP } from "@/core/environments";
import { CAREER_LIMIT_MSV, daysToCareerLimit, LIMIT_30_DAY, SEP_EVENT_DOSE, type SepEvent } from "@/core/radiation";
import { useCrewState, useMission } from "@/lib/store";
import { STATUS_COLOR } from "@/lib/ui";
import { SERIES } from "@/components/viz";

const LINE_COLORS = SERIES;

export default function RadiationPage() {
  const { env, triggerDrill, clearDrills, drills } = useMission();
  const states = [useCrewState("vega"), useCrewState("okafor"), useCrewState("lindqvist"), useCrewState("tanaka")];
  const [severity, setSeverity] = useState<SepEvent["severity"]>("major");
  const [shelter, setShelter] = useState(true);
  const e = ENV_MAP[env];

  const chart: Record<string, number>[] = [];
  for (let d = 0; d < MISSION.currentDay; d++) {
    const row: Record<string, number> = { day: d + 1 };
    states.forEach((s) => s && (row[s.profile.id] = Number(s.dose.timeline[d].cumulative.toFixed(1))));
    chart.push(row);
  }

  return (
    <div className="pt-8">
      <section className="rise">
        <p className="panel-title">Hazard 1 of 5 · Space radiation</p>
        <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-6xl">Radiation dose</h1>
        <p className="mt-3 max-w-2xl text-ink-2">
          Every crew member has a career limit of {CAREER_LIMIT_MSV} mSv (NASA-STD-3001, 2022). In {e.name.toLowerCase()} the background rate is{" "}
          <span className="font-data text-ink">{e.doseRate} mSv/day</span>, and solar particle events add more on top. Source: {e.doseSource}.
        </p>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {states.map((s, i) =>
          s ? (
            <div key={s.profile.id} className="panel ticks rise p-5" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-data text-[10px] uppercase tracking-widest text-ink-3">{s.profile.callsign}</div>
                  <div className="font-semibold">{s.profile.name}</div>
                </div>
                <StatusPill status={s.dose.status} />
              </div>
              <DoseRing value={s.dose.cumulative} color={STATUS_COLOR[s.dose.status]} />
              <dl className="font-data grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-ink-3">Before mission</dt>
                <dd className="text-right">{s.profile.priorDoseMsv} mSv</dd>
                <dt className="text-ink-3">Last 30 days</dt>
                <dd className="text-right">
                  {s.dose.last30.toFixed(1)} / {LIMIT_30_DAY}
                </dd>
                <dt className="text-ink-3">Days to limit</dt>
                <dd className="text-right">{daysToCareerLimit(s.dose.cumulative, e).toLocaleString()}</dd>
              </dl>
            </div>
          ) : null,
        )}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel ticks p-5">
          <h2 className="panel-title">Cumulative career dose · mSv</h2>
          <div className="mt-3 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 6" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickFormatter={(d) => `D${d}`} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--ink-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12 }} labelFormatter={(d) => `Mission day ${d}`} />
                <ReferenceLine y={CAREER_LIMIT_MSV * 0.5} stroke="var(--watch)" strokeDasharray="4 4" label={{ value: "50% of limit", fill: "var(--watch)", fontSize: 10, position: "insideTopRight" }} />
                {CREW.map((c, i) => (
                  <Line key={c.id} type="monotone" dataKey={c.id} name={c.name} stroke={LINE_COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            {CREW.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1.5 text-ink-2">
                <span className="h-2 w-2 rounded-full" style={{ background: LINE_COLORS[i] }} /> {c.name}
              </span>
            ))}
          </div>
        </div>

        <div className="panel ticks p-5">
          <h2 className="panel-title flex items-center gap-2">
            <ShieldAlert size={13} /> Solar storm drill
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            Rehearse a solar particle event at today&apos;s mission day. VITA adds the dose to every crew member, scaled by how
            exposed this location is ({Math.round(e.sepExposure * 100)}% here).
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(Object.keys(SEP_EVENT_DOSE) as SepEvent["severity"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSeverity(k)}
                className="font-data rounded-md border py-2 text-xs uppercase tracking-wider"
                style={{ borderColor: severity === k ? "var(--critical)" : "var(--line)", color: severity === k ? "var(--critical)" : "var(--ink-2)" }}
              >
                {k}
                <div className="text-[10px] text-ink-3">{SEP_EVENT_DOSE[k]} mSv</div>
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={shelter} onChange={(ev) => setShelter(ev.target.checked)} className="accent-[var(--nominal)]" />
            Crew reaches the storm shelter (cuts dose ~80%)
          </label>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => triggerDrill(severity, shelter)} className="flex-1 rounded-lg bg-critical py-2 text-sm font-semibold text-white">
              Trigger SEP drill
            </button>
            {drills.length > 0 && (
              <button type="button" onClick={clearDrills} className="rounded-lg border border-line-2 px-3 text-sm text-ink-2">
                Clear
              </button>
            )}
          </div>
          <div className="mt-5 border-t border-line pt-4 text-sm text-ink-2">
            <h3 className="panel-title">If a real event hits</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Move to the shelter: the most shielded spot (water walls, supplies, crew quarters).</li>
              <li>Stop EVAs and rover traverses. Return to base or habitat.</li>
              <li>Wear the personal dosimeter; log readings every hour.</li>
              <li>Stay in until ground or the onboard monitor gives the all-clear.</li>
            </ol>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <SolarWindPanel />
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <SpaceWeatherPanel />
        <div className="panel ticks overflow-x-auto p-5">
          <h2 className="panel-title">Where you are changes everything</h2>
          <table className="mt-3 w-full min-w-[520px] text-sm">
            <thead>
              <tr className="font-data text-left text-[10px] uppercase tracking-wider text-ink-3">
                <th className="py-2 font-normal">Location</th>
                <th className="font-normal">mSv/day</th>
                <th className="font-normal">Days to {CAREER_LIMIT_MSV} mSv*</th>
                <th className="font-normal">Solar storm exposure</th>
              </tr>
            </thead>
            <tbody>
              {ENVIRONMENTS.map((x) => (
                <tr key={x.id} className={`border-t border-line ${x.id === env ? "text-ink" : "text-ink-2"}`}>
                  <td className="py-2">
                    {x.id === env && <span className="text-nominal">▸ </span>}
                    {x.name}
                  </td>
                  <td className="font-data">{x.doseRate}</td>
                  <td className="font-data">{Math.round(CAREER_LIMIT_MSV / x.doseRate).toLocaleString()}</td>
                  <td>
                    <div className="h-1.5 w-24 rounded-full bg-panel-2">
                      <div className="h-full rounded-full bg-critical" style={{ width: `${x.sepExposure * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink-3">*Starting from zero, background rate only.</p>
        </div>
      </section>
    </div>
  );
}

function DoseRing({ value, color }: { value: number; color: string }) {
  const pct = Math.min(1, value / CAREER_LIMIT_MSV);
  const r = 52;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto my-4 h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-3xl font-extrabold">{Math.round(value)}</div>
          <div className="font-data text-[10px] text-ink-3">of {CAREER_LIMIT_MSV} mSv</div>
        </div>
      </div>
    </div>
  );
}
