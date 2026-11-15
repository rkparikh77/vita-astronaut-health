"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock, Pause, Play, RotateCcw, Sparkles, Trophy } from "lucide-react";
import { DataBadge } from "@/components/viz";
import { MISSION } from "@/core/crew";
import { VEHICLES, vehicleFor, type VehicleKind } from "@/components/space/vehicles";
import { useMission } from "@/lib/store";
import { fmtDuration, linkAt, missionDate } from "@/core/deepSpace";
import {
  act,
  actionsFor,
  createSim,
  predictedSurvival,
  SCENARIO_MAP,
  SCENARIOS,
  step,
  ZONES,
  type ScenarioId,
  type SimState,
} from "@/core/emergencies";

const Habitat3D = dynamic(() => import("@/components/sim/Habitat3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-ink-3">Building the habitat…</div>,
});

const NasaVehicle3D = dynamic(() => import("@/components/space/NasaVehicle3D"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-xs text-ink-3">Loading NASA model…</div>,
});

const ICON: Record<ScenarioId, string> = { sep: "☢", depress: "◌", co2: "CO₂", fire: "🜂", cardiac: "♥" };

function clock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SimPage() {
  const oneWay = linkAt(missionDate(MISSION.currentDay)).oneWaySec;
  const [sim, setSim] = useState<SimState | null>(null);
  const [paused, setPaused] = useState(false);
  const [mult, setMult] = useState(1);
  const ref = useRef<SimState | null>(null);
  ref.current = sim;

  // Physics runs on a 20 Hz timer (independent of animation frames, which browsers pause in background tabs);
  // the 3D view interpolates crew motion every frame.
  const running = !!sim && !paused && !sim.ended;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dtReal = Math.min(0.25, (now - last) / 1000);
      last = now;
      const cur = ref.current;
      if (!cur || cur.ended) return;
      let remaining = dtReal * SCENARIO_MAP[cur.scenario].timeScale * mult;
      let s = cur;
      while (remaining > 0 && !s.ended) {
        const dt = Math.min(remaining, 5);
        s = step(s, dt);
        remaining -= dt;
      }
      setSim(s);
    }, 50);
    return () => clearInterval(id);
  }, [running, mult]);

  const start = (id: ScenarioId) => {
    setPaused(false);
    setMult(1);
    setSim(createSim(id, oneWay));
  };

  if (!sim) return <Picker onPick={start} oneWay={oneWay} />;

  const def = SCENARIO_MAP[sim.scenario];
  const actions = actionsFor(sim);
  const patient = sim.crew.find((c) => c.arrest);
  const h = sim.hab;
  const lastAlarm = [...sim.log].reverse().find((l) => l.kind === "alarm");
  const ask = () => {
    const vitals = sim.crew.map((c) => `${c.name} (${ZONES[c.zone].label}): SaO2 ${Math.round(c.sao2)}%, pulse-ox ${Number.isFinite(c.spo2Reading) ? Math.round(c.spo2Reading) + "%" : "n/a"}, HR ${c.hr}, ${c.conscious ? "conscious" : "UNCONSCIOUS"}${c.mask ? ", masked" : ""}${c.arrest && !c.arrest.rosc ? ", in VF arrest" : ""}, dose ${c.doseMsv.toFixed(1)} mSv`).join("; ");
    const q = `We're in a "${def.title}" emergency at T+${clock(sim.t)}. Habitat: Module A ${h.pressureA.toFixed(0)} kPa, Module B ${h.pressureB.toFixed(0)} kPa, CO2 ${h.co2.toFixed(1)} mmHg, smoke ${(h.smoke * 100).toFixed(0)}%, radiation ${h.radiationMsvH.toFixed(1)} mSv/h, hatch ${h.hatchClosed ? "closed" : "open"}, fire ${h.fire ? "burning" : "out"}. Crew: ${vitals}. Actions taken: ${sim.done.join(", ") || "none"}. Earth is ${fmtDuration(oneWay)} away one-way. As the on-board flight surgeon, what should we do next, in priority order?`;
    window.dispatchEvent(new CustomEvent("vita-ask", { detail: q }));
  };

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setSim(null)} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft size={14} /> Scenarios
        </button>
        <DataBadge kind="model" />
      </div>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="panel-title">Emergency playground · {def.title}</p>
          <h1 className="font-display mt-1 text-2xl leading-tight font-extrabold uppercase sm:text-5xl">{def.tagline}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-data flex items-center gap-1.5 rounded-md border border-line-2 px-3 py-2 text-sm">
            <Clock size={14} className="text-ink-3" /> T+{clock(sim.t)}
          </span>
          <button type="button" onClick={() => setPaused((p) => !p)} className="grid h-9 w-9 place-items-center rounded-md border border-line-2 text-ink-2 hover:text-ink" aria-label={paused ? "Resume" : "Pause"}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          {[1, 3].map((m) => (
            <button key={m} type="button" onClick={() => setMult(m)} className={`font-data h-9 rounded-md px-2.5 text-xs ${mult === m ? "bg-ink text-bg" : "border border-line-2 text-ink-2"}`}>
              {m}×
            </button>
          ))}
          <button type="button" onClick={() => start(sim.scenario)} className="grid h-9 w-9 place-items-center rounded-md border border-line-2 text-ink-2 hover:text-ink" aria-label="Restart">
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      {lastAlarm && !sim.ended && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-critical/50 bg-critical/10 px-4 py-2.5 text-sm text-critical">
          <AlertTriangle size={15} className="shrink-0" /> <span className="font-data text-[11px]">T+{clock(lastAlarm.t)}</span> {lastAlarm.text}
        </div>
      )}

      <section className="mt-4 grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <div className="panel ticks relative overflow-hidden p-0">
            <div className="h-[440px] sm:h-[540px]">
              <Habitat3D s={sim} />
            </div>
            <VehicleInset alarm={!sim.ended && !!lastAlarm} />
            <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex flex-wrap gap-2">
              <Gauge label="Module A" value={`${h.pressureA.toFixed(1)} kPa`} bad={h.pressureA < 70} />
              <Gauge label="Module B" value={`${h.pressureB.toFixed(1)} kPa`} bad={h.pressureB < 70} />
              <Gauge label="CO₂" value={`${h.co2.toFixed(1)} mmHg`} bad={h.co2 > 6} />
              {sim.scenario === "fire" && <Gauge label="Smoke" value={`${(h.smoke * 100).toFixed(0)}%`} bad={h.smoke > 0.2} />}
              {sim.scenario === "sep" && <Gauge label="Dose rate (hull)" value={`${h.radiationMsvH.toFixed(1)} mSv/h`} bad={h.radiationMsvH > 5} />}
              <Gauge label="Hatch" value={h.hatchClosed ? "sealed" : "open"} />
            </div>
          </div>

          <div className="panel ticks overflow-x-auto p-5">
            <h2 className="panel-title">Crew vitals</h2>
            <table className="mt-3 w-full min-w-[560px] text-sm">
              <thead className="font-data text-left text-[10px] tracking-wider text-ink-3 uppercase">
                <tr>
                  <th className="py-1.5 font-normal">Crew</th>
                  <th className="font-normal">Location</th>
                  <th className="font-normal">True SaO₂</th>
                  <th className="font-normal">Pulse-ox</th>
                  <th className="font-normal">HR</th>
                  <th className="font-normal">RR</th>
                  {sim.scenario === "sep" && <th className="font-normal">Dose</th>}
                  {sim.scenario === "fire" && <th className="font-normal">COHb</th>}
                </tr>
              </thead>
              <tbody>
                {sim.crew.map((c) => {
                  const gap = Number.isFinite(c.spo2Reading) && c.spo2Reading - c.sao2 > 4;
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="py-2">
                        {c.name} {!c.conscious && <span className="text-critical">· down</span>}
                        {c.mask && <span className="text-ink-3"> · mask</span>}
                      </td>
                      <td className="text-ink-2">{ZONES[c.zone].label}</td>
                      <td className="font-data" style={{ color: c.sao2 >= 92 ? "var(--nominal)" : c.sao2 >= 85 ? "var(--watch)" : "var(--critical)" }}>
                        {c.arrest && !c.arrest.rosc ? "—" : `${Math.round(c.sao2)}%`}
                      </td>
                      <td className="font-data" style={{ color: gap ? "var(--watch)" : undefined }} title={gap ? "Carbon monoxide fools the pulse oximeter" : undefined}>
                        {Number.isFinite(c.spo2Reading) ? `${Math.round(c.spo2Reading)}%${gap ? " ⚠" : ""}` : "—"}
                      </td>
                      <td className="font-data">{c.hr}</td>
                      <td className="font-data">{c.rr}</td>
                      {sim.scenario === "sep" && <td className="font-data">{c.doseMsv.toFixed(1)} mSv</td>}
                      {sim.scenario === "fire" && <td className="font-data">{c.cohb.toFixed(0)}%</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {patient?.arrest && !patient.arrest.rosc && (
              <p className="mt-3 rounded-md bg-critical/10 px-3 py-2 text-sm text-critical">
                {patient.name}: ventricular fibrillation for {clock(sim.t - patient.arrest.since)} · predicted survival if shocked now{" "}
                <b>{Math.round(predictedSurvival(patient, sim.t) * 100)}%</b> {patient.arrest.cpr ? "(CPR running)" : "(no CPR yet)"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="panel ticks p-5">
            <h2 className="panel-title">Your decisions</h2>
            <p className="mt-2 text-sm text-ink-2">{def.brief}</p>
            <div className="mt-4 space-y-2">
              {actions.map((a) => {
                const pending = sim.pending.some((p) => p.id === a.id);
                const used = sim.done.includes(a.id) && a.id !== "aed";
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={sim.ended || used || pending}
                    onClick={() => setSim((s) => (s ? act(s, a.id) : s))}
                    className="w-full rounded-xl border border-line-2 bg-bg-2/60 px-4 py-3 text-left transition hover:border-nominal/60 disabled:opacity-40"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {a.label}
                      {pending && <span className="font-data text-[10px] text-watch">in progress…</span>}
                      {a.takes && !pending && <span className="font-data text-[10px] text-ink-3">{a.takes >= 60 ? `${Math.round(a.takes / 60)} min` : `${a.takes} s`}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">{a.hint}</div>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={ask} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg">
              <Sparkles size={14} /> Ask the on-board AI flight surgeon
            </button>
            <p className="mt-3 text-xs text-ink-3">
              Earth is {fmtDuration(oneWay)} away (mission day {MISSION.currentDay}).{" "}
              {sim.surgeonReplyAt ? `Flight-surgeon reply in ${clock(sim.surgeonReplyAt - sim.t)}.` : "A consult costs a light-time round trip plus review."}
            </p>
          </div>

          <div className="panel ticks p-5">
            <h2 className="panel-title">Event log</h2>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-xs">
              {[...sim.log].reverse().map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-data shrink-0 text-ink-3">T+{clock(l.t)}</span>
                  <span className={l.kind === "alarm" ? "text-critical" : l.kind === "action" ? "text-nominal" : l.kind === "outcome" ? "font-semibold text-watch" : "text-ink-2"}>
                    {l.kind === "action" ? "▸ " : ""}
                    {l.text}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink-3">Model: {def.science}</p>
          </div>
        </div>
      </section>

      {sim.ended && sim.outcome && (
        <div className="fixed inset-0 z-[55] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="panel ticks rise max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <div className="flex items-center gap-4">
              <div
                className="font-display grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-5xl font-extrabold"
                style={{ background: "var(--panel-2)", color: sim.outcome.grade <= "B" ? "var(--nominal)" : sim.outcome.grade === "C" ? "var(--watch)" : "var(--critical)" }}
              >
                {sim.outcome.grade}
              </div>
              <div>
                <p className="panel-title flex items-center gap-2">
                  <Trophy size={12} /> Debrief · {def.title}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{sim.outcome.headline}</h2>
              </div>
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-2">
              {sim.outcome.metrics.map((m) => (
                <li key={m.label} className="rounded-lg border border-line bg-bg-2/60 p-3">
                  <div className="panel-title text-[9px]">{m.label}</div>
                  <div className="font-data mt-1 text-sm" style={{ color: m.good ? "var(--nominal)" : "var(--action)" }}>
                    {m.value}
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="panel-title mt-5">Lessons</h3>
            <ul className="mt-2 space-y-2 text-sm text-ink-2">
              {sim.outcome.lessons.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="text-nominal">→</span>
                  {l}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => start(sim.scenario)} className="flex-1 rounded-lg bg-nominal py-2.5 text-sm font-semibold text-bg">
                Try again
              </button>
              <button type="button" onClick={() => setSim(null)} className="flex-1 rounded-lg border border-line-2 py-2.5 text-sm text-ink-2 hover:text-ink">
                Other scenarios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Gauge({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border bg-black/60 px-2.5 py-1.5 backdrop-blur" style={{ borderColor: bad ? "var(--critical)" : "rgba(255,255,255,.1)" }}>
      <div className="font-data text-[9px] tracking-wider text-ink-3 uppercase">{label}</div>
      <div className="font-data text-xs" style={{ color: bad ? "var(--critical)" : "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function VehicleInset({ alarm }: { alarm: boolean }) {
  const { env } = useMission();
  const kind = vehicleFor(env);
  return (
    <div className="absolute top-3 right-3 hidden h-[150px] w-[210px] overflow-hidden rounded-xl border border-line-2 bg-black/70 shadow-lg sm:block">
      <NasaVehicle3D kind={kind} alarm={alarm} interactive={false} />
      <div className="font-data pointer-events-none absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 px-2 pt-4 pb-1.5 text-[9px] tracking-wider text-ink-2 uppercase">
        Exterior · {VEHICLES[kind].label}
      </div>
    </div>
  );
}

const VEHICLE_TABS: VehicleKind[] = ["iss", "orion", "mars_base"];

function VehicleHero() {
  const { env } = useMission();
  const [kind, setKind] = useState<VehicleKind>(() => vehicleFor(env));
  const v = VEHICLES[kind];
  return (
    <div className="panel ticks relative overflow-hidden p-0">
      <div className="h-[300px] sm:h-[360px]">
        <NasaVehicle3D kind={kind} />
      </div>
      <div className="absolute top-3 left-3 flex gap-1">
        {VEHICLE_TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`font-data rounded-md px-2 py-1 text-[10px] tracking-wider uppercase backdrop-blur ${kind === k ? "bg-ink text-bg" : "border border-white/15 bg-black/50 text-ink-2 hover:text-ink"}`}
          >
            {k === "iss" ? "ISS" : k === "orion" ? "Orion" : "Mars base"}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/85 px-4 pt-8 pb-3">
        <div className="text-sm font-semibold">{v.label}</div>
        <div className="text-xs text-ink-2">{v.note}</div>
        <div className="font-data mt-1 text-[9px] tracking-wider text-ink-3 uppercase">{v.credit}</div>
      </div>
    </div>
  );
}

function Picker({ onPick, oneWay }: { onPick: (id: ScenarioId) => void; oneWay: number }) {
  return (
    <div className="pt-8">
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_minmax(0,560px)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="panel-title">Emergency playground</p>
            <DataBadge kind="model" />
          </div>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
            Train for
            <br />
            <span className="text-ink-3">the worst day</span>
          </h1>
          <p className="mt-4 max-w-2xl text-ink-2">
            Walk into a 3D Mars-transit habitat and run a real emergency. Physics and physiology are computed live: cabin pressure, CO₂, smoke,
            radiation, oxygen saturation, survival odds. Earth is {fmtDuration(oneWay)} away, so you decide. A debrief scores every choice.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-ink-3">
            The vehicles are NASA&apos;s own 3D models, and the Mars base sits on real Jezero Crater terrain from NASA Mars Trek.
          </p>
        </div>
        <VehicleHero />
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className="panel ticks rise group flex flex-col p-6 text-left transition hover:-translate-y-0.5 hover:border-line-2"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-4xl text-critical">{ICON[s.id]}</span>
              <span className="font-data rounded-full border border-line-2 px-2.5 py-1 text-[10px] tracking-widest text-ink-3 uppercase group-hover:text-ink">Start ▸</span>
            </div>
            <h2 className="font-display mt-4 text-3xl font-extrabold uppercase">{s.title}</h2>
            <p className="mt-1 text-sm text-ink">{s.tagline}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-3">{s.brief}</p>
            <p className="font-data mt-4 border-t border-line pt-3 text-[10px] leading-relaxed text-ink-3">{s.science}</p>
          </button>
        ))}
      </section>
    </div>
  );
}
