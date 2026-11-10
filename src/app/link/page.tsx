"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Antenna, Pause, Play, Radio, Satellite, Send, Sparkles, WifiOff } from "lucide-react";
import { DataBadge } from "@/components/viz";
import type { Packet } from "@/components/space/SolarSystem";
import { CREW, MISSION } from "@/core/crew";
import {
  blackoutWindows,
  earthAt,
  EPHEMERIS_SOURCE,
  fmtDuration,
  legAt,
  lightSeconds,
  linkAt,
  linkTimeline,
  marsAt,
  MARS_CRAFT,
  MISSION_PLAN,
  missionDate,
  packetTiming,
  SPACECRAFT,
  type DsnDish,
} from "@/core/deepSpace";

const SolarSystem = dynamic(() => import("@/components/space/SolarSystem"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-ink-3">Loading 3D solar system…</div>,
});

const TOTAL_DAYS = Math.round((MISSION_PLAN[MISSION_PLAN.length - 1].end.getTime() - MISSION_PLAN[0].start.getTime()) / 86400000) + 1;
const DAY_MS = 86400000;
const LINK_RATE_BPS = 2_000_000; // assumed crewed-vehicle Ka-band downlink (MRO reaches ~6 Mbps at close range)

const REPORTS = [
  { id: "vitals", label: "Vitals summary", kb: 40, desc: "24 h of HR, HRV, BP, SpO₂, temperature, sleep" },
  { id: "ecg", label: "12-lead ECG strip", kb: 250, desc: "10 s, 500 Hz, compressed" },
  { id: "us", label: "Ultrasound clip", kb: 12000, desc: "Cardiac echo, 6 s video" },
] as const;

const TIERS = [
  { max: 1, name: "Real-time telemedicine", text: "Video calls with the flight surgeon, as on the ISS today." },
  { max: 60, name: "Conversational with lag", text: "Lunar-distance delays: talk, but with awkward pauses." },
  { max: Infinity, name: "Store-and-forward", text: "No conversation possible. Send a packet, act on-board, reconcile when the reply lands." },
];

interface Flight {
  id: number;
  crew: string;
  report: (typeof REPORTS)[number];
  sentAt: number; // simulated ms since page start
  timing: ReturnType<typeof packetTiming>;
  queuedUntil?: Date;
}

export default function LinkPage() {
  const [day, setDay] = useState(MISSION.currentDay);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [simMs, setSimMs] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [crew, setCrew] = useState("tanaka");
  const [reportId, setReportId] = useState<(typeof REPORTS)[number]["id"]>("ecg");
  const [dsn, setDsn] = useState<{ live: boolean; dishes: DsnDish[]; error?: string }>();
  const [now, setNow] = useState<Date | null>(null);

  const date = missionDate(day);
  const link = linkAt(date);
  const leg = legAt(date);
  const timeline = useMemo(() => linkTimeline(4), []);
  const blackouts = useMemo(() => blackoutWindows(), []);
  const inBlackout = link.state === "blackout";
  const blackoutNow = blackouts.find((w) => date >= w.start && date <= w.end);
  const tier = TIERS.find((t) => link.oneWaySec * 2 <= t.max) ?? TIERS[2];

  // Real "now" Earth–Mars, computed client-side after mount to avoid hydration drift.
  useEffect(() => setNow(new Date()), []);
  const todayOneWay = now ? lightSeconds(earthAt(now), marsAt(now)) : NaN;

  // Simulation clock (accelerated) for packets in flight.
  const last = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last.current ? t - last.current : 0;
      last.current = t;
      setSimMs((s) => s + dt * speed);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  // Mission scrubbing.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setDay((d) => (d >= TOTAL_DAYS ? 1 : d + 2)), 80);
    return () => clearInterval(id);
  }, [playing]);

  // Live DSN.
  useEffect(() => {
    const load = () =>
      fetch("/api/dsn")
        .then((r) => r.json())
        .then(setDsn)
        .catch(() => setDsn({ live: false, dishes: [], error: "offline" }));
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const send = () => {
    const report = REPORTS.find((r) => r.id === reportId)!;
    const timing = packetTiming(report.kb, LINK_RATE_BPS, link.oneWaySec);
    setFlights((f) => [{ id: Date.now(), crew, report, sentAt: simMs, timing, queuedUntil: blackoutNow?.end }, ...f].slice(0, 6));
  };

  const packets: Packet[] = flights
    .filter((f) => !f.queuedUntil)
    .flatMap((f) => {
      const el = (simMs - f.sentAt) / 1000;
      const out: Packet[] = [];
      const down = (el - f.timing.txSec) / f.timing.oneWaySec;
      if (down >= 0 && down <= 1) out.push({ id: f.id, progress: down, direction: "down" });
      const upStart = f.timing.arriveGroundSec + (f.timing.replyAtCrewSec - f.timing.arriveGroundSec - f.timing.oneWaySec);
      const up = (el - upStart) / f.timing.oneWaySec;
      if (up >= 0 && up <= 1) out.push({ id: f.id + 1, progress: up, direction: "up" });
      return out;
    });

  const ask = (q: string) => window.dispatchEvent(new CustomEvent("vita-ask", { detail: q }));
  const marsDishes = (dsn?.dishes ?? []).filter((d) => d.targets.some((t) => MARS_CRAFT.has(t.name)));
  const activeDishes = (dsn?.dishes ?? []).filter((d) => d.targets.length > 0);
  const linkColor = { nominal: "var(--nominal)", degraded: "var(--watch)", blackout: "var(--critical)" }[link.state];

  return (
    <div className="pt-8">
      <section className="rise grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="panel-title flex items-center gap-2">
              <Satellite size={13} /> Earth-independent medicine
            </p>
            <DataBadge kind="real" />
            <DataBadge kind="live" />
          </div>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
            Medicine at
            <br />
            <span className="text-ink-3">the speed of light</span>
          </h1>
          <p className="mt-4 max-w-xl text-ink-2">
            On Mars, the flight surgeon is up to 20 light-minutes away, and for weeks at a time the Sun cuts the link entirely. Planet
            positions are real (JPL Horizons); the antennas below are NASA&apos;s Deep Space Network, live.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Earth → Mars right now" value={now ? fmtDuration(todayOneWay) : "…"} note="one-way light time, today" />
          <Stat label={`Mission day ${day} · ${date.toISOString().slice(0, 10)}`} value={fmtDuration(link.oneWaySec)} note={`${leg?.label ?? ""} · ${link.distanceAu.toFixed(2)} AU`} color={linkColor} />
          <Stat label="Next blackout" value={blackouts[0] ? blackouts[0].start.toISOString().slice(0, 10) : "none"} note={blackouts[0] ? `${Math.round((blackouts[0].end.getTime() - blackouts[0].start.getTime()) / DAY_MS)} days · Sun within ${blackouts[0].minElongation.toFixed(1)}°` : ""} />
          <Stat label="DSN dishes tracking" value={dsn ? String(activeDishes.length) : "…"} note={dsn?.live ? "live from NASA" : dsn ? "feed offline" : "connecting"} />
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="panel ticks relative overflow-hidden p-0">
          <div className="h-[460px] sm:h-[560px]">
            <SolarSystem date={date} packets={packets} />
          </div>
          <div className="pointer-events-none absolute top-4 left-4 flex flex-wrap items-center gap-2">
            <span className="font-data rounded-full border px-2.5 py-1 text-[10px] tracking-widest uppercase" style={{ color: linkColor, borderColor: linkColor, background: "rgba(4,6,10,.7)" }}>
              Link {link.state} · elongation {link.elongationDeg.toFixed(1)}°
            </span>
            <span className="font-data rounded-full border border-line-2 bg-bg/70 px-2.5 py-1 text-[10px] tracking-widest text-ink-2 uppercase">{tier.name}</span>
          </div>
          <div className="border-t border-line bg-bg-2/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setPlaying((p) => !p)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-bg" aria-label={playing ? "Pause mission" : "Play mission"}>
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <input type="range" min={1} max={TOTAL_DAYS} value={day} onChange={(e) => setDay(Number(e.target.value))} className="flex-1 accent-[var(--nominal)]" aria-label="Mission day" />
              <span className="font-data w-24 shrink-0 text-right text-xs text-ink-2">
                Day {day}/{TOTAL_DAYS}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { l: "Launch", d: 1 },
                { l: "Today's mission day", d: MISSION.currentDay },
                { l: "Mars arrival", d: 271 },
                ...(blackouts[0] ? [{ l: "Conjunction blackout", d: Math.round((blackouts[0].start.getTime() - MISSION_PLAN[0].start.getTime()) / DAY_MS) + 5 }] : []),
                { l: "Earth return", d: TOTAL_DAYS },
              ].map((j) => (
                <button key={j.l} type="button" onClick={() => setDay(j.d)} className="font-data rounded-md border border-line-2 px-2 py-1 text-[10px] tracking-wider text-ink-2 uppercase hover:text-ink">
                  {j.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="panel ticks p-5">
            <h2 className="panel-title flex items-center gap-2">
              <Send size={13} /> Send a medical report to Earth
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select value={crew} onChange={(e) => setCrew(e.target.value)} aria-label="Crew member" className="font-data rounded-md border border-line-2 bg-panel px-2 py-2 text-xs">
                {CREW.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select value={reportId} onChange={(e) => setReportId(e.target.value as typeof reportId)} aria-label="Report type" className="font-data rounded-md border border-line-2 bg-panel px-2 py-2 text-xs">
                {REPORTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs text-ink-3">{REPORTS.find((r) => r.id === reportId)!.desc}</p>
            <button type="button" onClick={send} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold ${inBlackout ? "bg-critical/20 text-critical" : "bg-nominal text-bg"}`}>
              {inBlackout ? <WifiOff size={14} /> : <Send size={14} />} {inBlackout ? "Queue for after blackout" : "Transmit via DSN"}
            </button>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-3">
              <span>Playback speed</span>
              {[1, 60, 600].map((s) => (
                <button key={s} type="button" onClick={() => setSpeed(s)} className={`font-data rounded px-1.5 py-0.5 ${speed === s ? "bg-ink text-bg" : "border border-line-2"}`}>
                  {s}×
                </button>
              ))}
            </div>
            <ul className="mt-4 space-y-3">
              {flights.map((f) => {
                const el = (simMs - f.sentAt) / 1000;
                const name = CREW.find((c) => c.id === f.crew)!.name.split(" ")[0];
                if (f.queuedUntil)
                  return (
                    <li key={f.id} className="rounded-lg border border-critical/40 bg-critical/5 p-3 text-xs">
                      <div className="font-semibold text-critical">
                        {f.report.label} · {name} · queued
                      </div>
                      <div className="mt-1 text-ink-2">Mars is behind the Sun. Holds until {f.queuedUntil.toISOString().slice(0, 10)}; the crew acts on its own.</div>
                      <button type="button" onClick={() => ask(`We're in the solar-conjunction blackout with no contact with Earth until ${f.queuedUntil!.toISOString().slice(0, 10)}. Act as the on-board flight surgeon for ${CREW.find((c) => c.id === f.crew)!.name}: what's their status and what should the crew do on their own?`)} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-bg">
                        <Sparkles size={11} /> On-board AI flight surgeon
                      </button>
                    </li>
                  );
                const stage = el < f.timing.txSec ? "Transmitting" : el < f.timing.arriveGroundSec ? "In flight to Earth" : el < f.timing.replyAtCrewSec - f.timing.oneWaySec ? "Flight surgeon reviewing" : el < f.timing.replyAtCrewSec ? "Reply in flight" : "Reply received";
                const pct = Math.min(100, (el / f.timing.replyAtCrewSec) * 100);
                return (
                  <li key={f.id} className="rounded-lg border border-line bg-bg-2/60 p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {f.report.label} · {name}
                      </span>
                      <span className={stage === "Reply received" ? "text-nominal" : "text-watch"}>{stage}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-nominal to-[#c9b6ff]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="font-data mt-1.5 flex justify-between text-[10px] text-ink-3">
                      <span>Earth in {fmtDuration(f.timing.arriveGroundSec)}</span>
                      <span>Reply in {fmtDuration(f.timing.replyAtCrewSec)}</span>
                    </div>
                  </li>
                );
              })}
              {flights.length === 0 && <li className="text-xs text-ink-3">Packets you send fly across the 3D view at the speed of light (sped up {speed}×).</li>}
            </ul>
          </div>

          <div className="panel ticks p-5">
            <h2 className="panel-title">Care tier at this distance</h2>
            <ul className="mt-3 space-y-2">
              {TIERS.map((t) => (
                <li key={t.name} className={`rounded-lg border p-3 text-xs ${t === tier ? "border-nominal/60 bg-nominal/5" : "border-line opacity-60"}`}>
                  <div className={`font-semibold ${t === tier ? "text-nominal" : "text-ink-2"}`}>{t.name}</div>
                  <div className="mt-0.5 text-ink-3">{t.text}</div>
                </li>
              ))}
              <li className={`rounded-lg border p-3 text-xs ${inBlackout ? "border-critical/60 bg-critical/5" : "border-line opacity-60"}`}>
                <div className={`font-semibold ${inBlackout ? "text-critical" : "text-ink-2"}`}>Conjunction blackout</div>
                <div className="mt-0.5 text-ink-3">No link at all. The crew medical officer and on-board AI carry full responsibility.</div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel ticks p-5">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">One-way light time over the mission · minutes</h2>
            <DataBadge kind="real" />
          </div>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="lt-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3987e5" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#3987e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 6" vertical={false} />
                {blackouts.map((w, i) => {
                  const a = Math.round((w.start.getTime() - MISSION_PLAN[0].start.getTime()) / DAY_MS) + 1;
                  const b = Math.round((w.end.getTime() - MISSION_PLAN[0].start.getTime()) / DAY_MS) + 1;
                  return <ReferenceArea key={i} x1={a} x2={b} fill="var(--critical)" fillOpacity={0.25} label={{ value: "blackout", fill: "var(--critical)", fontSize: 10, position: "insideTop" }} />;
                })}
                {MISSION_PLAN.slice(1).map((l) => {
                  const x = Math.round((l.start.getTime() - MISSION_PLAN[0].start.getTime()) / DAY_MS) + 1;
                  return <ReferenceLine key={l.label} x={x} stroke="var(--line-2)" strokeDasharray="3 3" label={{ value: l.label, fill: "var(--ink-3)", fontSize: 9, position: "insideTopLeft" }} />;
                })}
                <ReferenceLine x={day} stroke="var(--ink)" />
                <XAxis dataKey="day" type="number" domain={[1, TOTAL_DAYS]} tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} tickFormatter={(d) => `D${d}`} />
                <YAxis tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12 }} labelFormatter={(d) => `Mission day ${d}`} formatter={(v: number) => [`${v} min`, "one-way"]} />
                <Area type="monotone" dataKey="oneWayMin" stroke="#3987e5" strokeWidth={2} fill="url(#lt-fill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">
            {EPHEMERIS_SOURCE}. Vehicle path between planets is an approximate transfer arc. Blackout = Sun–Earth–vehicle angle under 2°.
          </p>
        </div>

        <div className="panel ticks p-5">
          <div className="flex items-center justify-between">
            <h2 className="panel-title flex items-center gap-2">
              <Antenna size={13} /> NASA Deep Space Network · now
            </h2>
            {dsn?.live ? <DataBadge kind="live" /> : <span className="font-data text-[10px] text-ink-3">{dsn ? "offline" : "…"}</span>}
          </div>
          {marsDishes.length > 0 && (
            <p className="mt-2 rounded-md bg-nominal/10 px-2 py-1.5 text-xs text-nominal">
              {marsDishes.length} antenna{marsDishes.length > 1 ? "s are" : " is"} talking to Mars right now.
            </p>
          )}
          <ul className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {activeDishes.map((d) => {
              const t = d.targets[0];
              const rate = d.down.find((s) => s.active)?.rateBps ?? d.down[0]?.rateBps ?? 0;
              const mars = d.targets.some((x) => MARS_CRAFT.has(x.name));
              return (
                <li key={d.station + d.dish} className={`rounded-lg border p-2.5 text-xs ${mars ? "border-nominal/50" : "border-line"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-data text-ink">
                      {d.station} · {d.dish}
                    </span>
                    <span className="font-data text-[10px] text-ink-3">el {d.elevation}°</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-ink-2">
                    <span className="flex items-center gap-1.5">
                      <Radio size={11} className={mars ? "text-nominal" : "text-ink-3"} /> {SPACECRAFT[t.name] ?? t.name}
                    </span>
                    <span className="font-data text-[10px]">
                      {rate ? `${rate >= 1e6 ? (rate / 1e6).toFixed(1) + " Mbps" : (rate / 1e3).toFixed(1) + " kbps"} · ` : ""}RTLT {fmtDuration(t.rtltSec)}
                    </span>
                  </div>
                </li>
              );
            })}
            {dsn && activeDishes.length === 0 && <li className="text-xs text-ink-3">{dsn.live ? "No dishes tracking right now." : `DSN Now unreachable (${dsn.error}).`}</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="panel-title text-[9px] leading-tight">{label}</div>
      <div className="font-display mt-1 text-2xl font-extrabold" style={{ color }}>
        {value}
      </div>
      {note && <div className="font-data text-[10px] text-ink-3">{note}</div>}
    </div>
  );
}
