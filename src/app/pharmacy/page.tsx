"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Pill } from "lucide-react";
import { DataBadge } from "@/components/viz";
import { CREW } from "@/core/crew";
import { MISSION_PLAN, missionDate } from "@/core/deepSpace";
import { checkDose, DRUG, lowStock, MISSION_END, PHARMACY, shelfLifeCliff, sleepAidReliance, stockLeft, type ShelfStatus } from "@/core/medical";
import { useMission } from "@/lib/store";

const SHELF: Record<ShelfStatus, { label: string; color: string }> = {
  expired: { label: "Expired", color: "var(--critical)" },
  expiring: { label: "Expires < 60 days", color: "var(--action)" },
  "expires-before-return": { label: "Expires before Earth return", color: "var(--watch)" },
  ok: { label: "Lasts the mission", color: "var(--nominal)" },
};

const DAY = 86_400_000;

export default function PharmacyPage() {
  const { today, doses, logDose, reportSideEffects } = useMission();
  const [crewId, setCrewId] = useState("tanaka");
  const [drugId, setDrugId] = useState("ibuprofen");
  const [override, setOverride] = useState(false);
  const checks = useMemo(() => checkDose(crewId, drugId, today, doses), [crewId, drugId, today, doses]);
  const blocked = checks.some((c) => c.severity === "block");
  const cliff = useMemo(() => shelfLifeCliff(today), [today]);
  const missionDays = Math.round((MISSION_END.getTime() - MISSION_PLAN[0].start.getTime()) / DAY);
  const expired = cliff.rows.filter((r) => r.status === "expired").length;
  const expiring = cliff.rows.filter((r) => r.status === "expiring").length;
  const low = PHARMACY.filter((d) => lowStock(d, doses)).length;
  const flagged = doses.map((d, i) => ({ ...d, i })).filter((d) => d.sideEffects?.length && !d.sideEffects.includes("None"));

  const give = () => {
    logDose(crewId, drugId);
    setOverride(false);
  };

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-center gap-2">
        <p className="panel-title">Onboard pharmacy</p>
        <DataBadge kind="model" />
      </div>
      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
        No resupply
        <br />
        <span className="text-ink-3">for {missionDays.toLocaleString()} days</span>
      </h1>
      <p className="mt-4 max-w-3xl text-ink-2">
        The ISS gets fresh medicine every few months. A Mars crew carries everything for the whole trip, and much of it expires on the way. VITA checks every
        dose against the astronaut&apos;s allergies, conditions and other medicines before it is taken, tracks stock and side effects, and shows what runs out
        of shelf life before the crew is home.
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Expired now" value={expired} color="var(--critical)" />
        <Kpi label="Expire within 60 days" value={expiring} color="var(--action)" />
        <Kpi label="Expire before Earth return" value={`${cliff.beforeReturn}/${cliff.total}`} color="var(--watch)" />
        <Kpi label="Low stock" value={low} color={low ? "var(--watch)" : "var(--nominal)"} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="panel ticks p-5">
          <h2 className="panel-title flex items-center gap-2">
            <Pill size={13} /> Check before you take it
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-ink-3">
              Crew member
              <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className="mt-1 w-full rounded-md border border-line-2 bg-panel px-2 py-2 text-sm text-ink">
                {CREW.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-3">
              Medication
              <select value={drugId} onChange={(e) => setDrugId(e.target.value)} className="mt-1 w-full rounded-md border border-line-2 bg-panel px-2 py-2 text-sm text-ink">
                {PHARMACY.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.use}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="mt-4 space-y-2" aria-live="polite">
            {checks.filter((c) => c.severity !== "info").length === 0 && (
              <li className="flex items-start gap-2 rounded-lg border border-nominal/40 bg-nominal/10 px-3 py-2 text-sm text-nominal">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> No allergy, interaction or condition conflicts found.
              </li>
            )}
            {checks.map((c) => (
              <li
                key={c.text}
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                style={{
                  color: c.severity === "block" ? "var(--critical)" : c.severity === "warn" ? "var(--watch)" : "var(--ink-2)",
                  borderColor: c.severity === "block" ? "var(--critical)" : c.severity === "warn" ? "var(--watch)" : "var(--line-2)",
                }}
              >
                {c.severity === "block" ? <AlertOctagon size={15} className="mt-0.5 shrink-0" /> : c.severity === "warn" ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <Info size={15} className="mt-0.5 shrink-0" />}
                {c.text}
              </li>
            ))}
          </ul>

          {blocked && (
            <label className="mt-3 flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Flight surgeon override (logged)
            </label>
          )}
          <button
            type="button"
            disabled={blocked && !override}
            onClick={give}
            className="mt-4 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
          >
            Log dose · {DRUG[drugId].dose}
          </button>
          <p className="mt-2 text-[11px] text-ink-3">
            Stock after this dose: {stockLeft(DRUG[drugId], doses) - 1} {DRUG[drugId].unit}. Demo rule set for illustration, not a clinical decision tool.
          </p>
        </div>

        <div className="panel ticks p-5">
          <h2 className="panel-title">Doses and side effects</h2>
          {doses.length === 0 && <p className="mt-3 text-sm text-ink-3">No doses logged yet. Log one on the left; VITA will ask about side effects.</p>}
          <ul className="mt-3 max-h-[330px] space-y-2 overflow-y-auto">
            {[...doses.map((d, i) => ({ ...d, i }))].reverse().slice(0, 12).map((d) => {
              const drug = DRUG[d.drugId];
              const who = CREW.find((c) => c.id === d.crewId)?.name;
              return (
                <li key={d.i} className="rounded-lg border border-line bg-bg-2/60 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>
                      {who} · <b>{drug?.name}</b>
                    </span>
                    <span className="font-data text-[11px] text-ink-3">day {d.day}</span>
                  </div>
                  {!d.sideEffects ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-ink-3">Any side effects?</span>
                      {["None", ...(drug?.sideEffects ?? [])].map((e) => (
                        <button key={e} type="button" onClick={() => reportSideEffects(d.i, [e])} className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-ink-2 hover:text-ink">
                          {e}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 text-xs" style={{ color: d.sideEffects.includes("None") ? "var(--ink-3)" : "var(--watch)" }}>
                      Side effects: {d.sideEffects.join(", ")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {(flagged.length > 0 || CREW.some((c) => sleepAidReliance(c.id, today, doses).flag)) && (
            <div className="mt-4 rounded-lg border border-watch/50 bg-watch/10 p-3 text-xs text-watch">
              <div className="font-semibold">For flight-surgeon review</div>
              <ul className="mt-1 space-y-0.5">
                {flagged.map((f) => (
                  <li key={f.i}>
                    {CREW.find((c) => c.id === f.crewId)?.name}: {DRUG[f.drugId]?.name} → {f.sideEffects!.join(", ")}
                  </li>
                ))}
                {CREW.filter((c) => sleepAidReliance(c.id, today, doses).flag).map((c) => (
                  <li key={c.id}>
                    {c.name}: {sleepAidReliance(c.id, today, doses).doses} sleep-aid doses in 7 days (heavy reliance)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <ShelfLife today={today} />

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-ink-3">
        Why this matters: NASA&apos;s study of medicines flown on the ISS found more formulations falling below potency standards after spaceflight than matched
        ground controls (Du et al., AAPS Journal 2011). Kit contents follow ISS medical-kit categories; quantities and dates are illustrative.
      </p>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="panel ticks p-4">
      <div className="panel-title text-[9px]">{label}</div>
      <div className="font-display mt-1 text-4xl font-extrabold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

/** Each drug's remaining shelf life against the mission timeline. */
function ShelfLife({ today }: { today: number }) {
  const cliff = shelfLifeCliff(today);
  const start = missionDate(today).getTime();
  const end = MISSION_END.getTime() + 120 * DAY;
  const x = (t: number) => `${Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100))}%`;
  const marks = [
    { t: start, label: "Today" },
    { t: MISSION_PLAN[1].start.getTime(), label: "Mars arrival" },
    { t: MISSION_PLAN[2].start.getTime(), label: "Mars departure" },
    { t: MISSION_END.getTime(), label: "Earth return" },
  ];
  const rows = [...cliff.rows].sort((a, b) => a.daysLeft - b.daysLeft);
  return (
    <section className="panel ticks mt-5 overflow-x-auto p-5">
      <h2 className="panel-title">Shelf-life cliff: what still works when you need it</h2>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-3">
        {Object.entries(SHELF).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: v.color }} /> {v.label}
          </span>
        ))}
      </div>
      <div className="mt-4 min-w-[620px]">
        <div className="relative ml-[190px] h-6">
          {marks.map((m) => (
            <span key={m.label} className="font-data absolute -translate-x-1/2 text-[10px] whitespace-nowrap text-ink-3" style={{ left: x(m.t) }}>
              {m.label}
            </span>
          ))}
        </div>
        <ul className="space-y-1">
          {rows.map((r) => {
            const exp = new Date(r.drug.expires + "T00:00:00Z").getTime();
            return (
              <li key={r.drug.id} className="flex items-center gap-2 text-xs">
                <span className="w-[182px] shrink-0 truncate text-ink-2" title={r.drug.use}>
                  {r.drug.name}
                </span>
                <div className="relative h-3 flex-1 rounded-sm bg-bg-2">
                  {marks.map((m) => (
                    <span key={m.label} className="absolute top-0 h-full w-px bg-line-2" style={{ left: x(m.t) }} />
                  ))}
                  <span className="absolute top-0 left-0 h-full rounded-sm" style={{ width: x(exp), background: SHELF[r.status].color, opacity: 0.85 }} />
                </div>
                <span className="font-data w-[78px] shrink-0 text-right text-[10px] text-ink-3">{r.drug.expires.slice(0, 7)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
