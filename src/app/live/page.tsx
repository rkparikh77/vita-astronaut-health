"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Bluetooth, BluetoothConnected, HeartPulse, Pause, Play, Save, Sparkles, Wind } from "lucide-react";
import { Sparkline } from "@/components/TrendChart";
import { DataBadge } from "@/components/viz";
import { CREW } from "@/core/crew";
import {
  BeatGenerator,
  detect,
  ecgSample,
  makeRng,
  meanHr,
  parseHeartRateMeasurement,
  plethSample,
  respSample,
  rmssd,
  stressIndex,
  type Beat,
  type BeatKind,
  type MonitorAlert,
  type Scenario,
} from "@/core/telemetry";
import { useCrewState, useMission } from "@/lib/store";

const FS = 250; // samples per second
const SWEEP_SEC = 6; // seconds across the screen
const CH = [
  { id: "ecg", label: "ECG · II", color: "#3ed6b5", scale: 0.42, offset: 0.62 },
  { id: "pleth", label: "PLETH · SpO₂", color: "#4fb7ff", scale: 0.36, offset: 0.78 },
  { id: "resp", label: "RESP", color: "#f5b83d", scale: 0.28, offset: 0.5 },
] as const;

const SCENARIOS: { id: Scenario; label: string; hint: string }[] = [
  { id: "none", label: "Normal sinus", hint: "Baseline rhythm with breathing-locked HRV" },
  { id: "pvc", label: "PVCs", hint: "Premature ventricular beats with compensatory pauses" },
  { id: "af", label: "AFib", hint: "Irregularly irregular rhythm, no P waves" },
  { id: "tachy", label: "Tachycardia", hint: "Heart rate climbs to ~128 bpm" },
  { id: "desat", label: "Desaturation", hint: "SpO₂ falls toward 85% (cabin O₂ fault)" },
];

interface Numerics {
  hr: number;
  rmssd: number;
  spo2: number;
  rr: number;
  stress: number;
  hrTrend: number[];
  hrvTrend: number[];
}

interface LoggedAlert extends MonitorAlert {
  at: number;
}

// Minimal Web Bluetooth types (not in the TS DOM lib).
interface BleCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BleCharacteristic>;
}
interface BleDevice extends EventTarget {
  name?: string;
  gatt?: { connect(): Promise<{ getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<BleCharacteristic> }>; disconnect(): void }> };
}
type NavigatorBle = Navigator & { bluetooth?: { requestDevice(o: unknown): Promise<BleDevice> } };

export default function LivePage() {
  const { record } = useMission();
  const [crewId, setCrewId] = useState("tanaka");
  const state = useCrewState(crewId);
  const latest = (id: string) => [...(state?.readings ?? [])].filter((r) => r.indicator === id).sort((a, b) => b.day - a.day)[0]?.value;
  const baseHr = latest("heart_rate") ?? 62;
  const baseHrv = latest("hrv") ?? 50;
  const baseResp = latest("resp_rate") ?? 13;
  const baseSpo2 = latest("spo2") ?? 98;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(true);
  const [scenario, setScenario] = useState<Scenario>("none");
  const [nums, setNums] = useState<Numerics>({ hr: NaN, rmssd: NaN, spo2: baseSpo2, rr: baseResp, stress: NaN, hrTrend: [], hrvTrend: [] });
  const [alerts, setAlerts] = useState<LoggedAlert[]>([]);
  const [active, setActive] = useState<MonitorAlert[]>([]);
  const [ble, setBle] = useState<{ name: string; hr?: number } | null>(null);
  const [bleSupported, setBleSupported] = useState(false);
  const [toast, setToast] = useState<string>();

  // Engine state lives in a ref so the 60 fps loop never re-renders React.
  const eng = useRef({
    t: 0,
    gen: new BeatGenerator(makeRng(11)),
    beats: [] as Beat[],
    beatStart: 0,
    rr: 1,
    kind: "normal" as BeatKind,
    nextBeat: 0.5,
    spo2: 98,
    spo2Low: 0,
    params: { hr: 62, hrv: 50, resp: 13, spo2: 98, scenario: "none" as Scenario },
    bleQueue: [] as number[],
    bleHr: 0,
    bleLive: false,
    lastXY: CH.map(() => ({ x: -1, y: 0 })),
    noise: makeRng(3),
  });

  useEffect(() => setBleSupported(typeof navigator !== "undefined" && !!(navigator as NavigatorBle).bluetooth), []);

  useEffect(() => {
    const e = eng.current;
    e.params = { hr: scenario === "tachy" ? 128 : baseHr, hrv: scenario === "tachy" ? baseHrv * 0.35 : baseHrv, resp: baseResp, spo2: scenario === "desat" ? 84 : baseSpo2, scenario };
  }, [scenario, baseHr, baseHrv, baseResp, baseSpo2]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.fillStyle = "#05070a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      eng.current.lastXY = CH.map(() => ({ x: -1, y: 0 }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!running) return;
      const e = eng.current;
      const W = canvas.width;
      const H = canvas.height;
      const rowH = H / CH.length;
      const n = Math.max(1, Math.round(dt * FS));

      for (let k = 0; k < n; k++) {
        e.t += 1 / FS;
        // Next beat: from the Bluetooth strap's real RR intervals when connected, else the generator.
        if (e.t >= e.nextBeat) {
          e.beatStart = e.nextBeat;
          let rr: number;
          let kind: BeatKind = "normal";
          if (e.bleLive) rr = e.bleQueue.shift() ?? 60 / Math.max(30, e.bleHr || 60);
          else ({ rr, kind } = e.gen.next(e.t, e.params.hr, e.params.hrv, e.params.resp, e.params.scenario));
          e.rr = rr;
          e.kind = kind;
          e.nextBeat = e.beatStart + rr;
          e.beats.push({ t: e.beatStart, rr, kind });
          if (e.beats.length > 400) e.beats.splice(0, e.beats.length - 400);
        }
        const phase = (e.t - e.beatStart) / e.rr;
        e.spo2 += (e.params.spo2 - e.spo2) * (0.12 / FS) + e.noise.g() * 0.002;
        e.spo2Low = e.spo2 < 92 ? e.spo2Low + 1 / FS : 0;

        const vals = [
          ecgSample(phase, { wide: e.kind === "pvc", noP: e.kind === "af" }) + e.noise.g() * 0.012 + (e.kind === "af" ? 0.03 * Math.sin(e.t * 2 * Math.PI * 6) : 0),
          plethSample(phase) * (0.6 + 0.4 * Math.min(1, (e.spo2 - 80) / 18)),
          respSample(e.t, e.params.resp),
        ];
        const x = ((e.t % SWEEP_SEC) / SWEEP_SEC) * W;
        CH.forEach((ch, i) => {
          const y = i * rowH + rowH * ch.offset - vals[i] * rowH * ch.scale;
          const p = e.lastXY[i];
          // erase a band ahead of the sweep, then draw
          ctx.fillStyle = "#05070a";
          ctx.fillRect(x, i * rowH, 14 * dpr, rowH);
          if (p.x >= 0 && x > p.x) {
            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 1.8 * dpr;
            ctx.shadowColor = ch.color;
            ctx.shadowBlur = 6 * dpr;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          e.lastXY[i] = { x, y };
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [running]);

  // Numerics, trends and alarms at 2 Hz
  useEffect(() => {
    const id = setInterval(() => {
      if (!running) return;
      const e = eng.current;
      const lastMin = e.beats.filter((b) => b.t > e.t - 60);
      const hr = e.bleLive && e.bleHr ? e.bleHr : meanHr(e.beats.slice(-8).map((b) => b.rr));
      const hv = rmssd(lastMin.filter((b) => b.kind === "normal").map((b) => b.rr));
      const found = detect(e.beats, e.spo2, e.spo2Low);
      setActive(found);
      setAlerts((prev) => {
        const fresh = found.filter((a) => !prev.some((p) => p.kind === a.kind && e.t - p.at < 20));
        return fresh.length ? [...fresh.map((a) => ({ ...a, at: e.t })), ...prev].slice(0, 30) : prev;
      });
      setNums((n) => ({
        hr,
        rmssd: hv,
        spo2: e.spo2,
        rr: e.params.resp,
        stress: stressIndex(hr, hv, baseHr, baseHrv),
        hrTrend: Number.isFinite(hr) ? [...n.hrTrend, hr].slice(-120) : n.hrTrend,
        hrvTrend: Number.isFinite(hv) ? [...n.hrvTrend, hv].slice(-120) : n.hrvTrend,
      }));
    }, 500);
    return () => clearInterval(id);
  }, [running, baseHr, baseHrv]);

  const connectBle = useCallback(async () => {
    try {
      const nav = navigator as NavigatorBle;
      const device = await nav.bluetooth!.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      const server = await device.gatt!.connect();
      const svc = await server.getPrimaryService("heart_rate");
      const ch = await svc.getCharacteristic("heart_rate_measurement");
      await ch.startNotifications();
      eng.current.bleLive = true;
      eng.current.bleQueue = [];
      setBle({ name: device.name ?? "Heart-rate strap" });
      setScenario("none");
      ch.addEventListener("characteristicvaluechanged", () => {
        if (!ch.value) return;
        const { hr, rr } = parseHeartRateMeasurement(ch.value);
        eng.current.bleHr = hr;
        eng.current.bleQueue.push(...rr.filter((x) => x > 0.25 && x < 2.5));
        setBle((b) => (b ? { ...b, hr } : b));
      });
      device.addEventListener("gattserverdisconnected", () => {
        eng.current.bleLive = false;
        setBle(null);
      });
    } catch (err) {
      if ((err as Error).name !== "NotFoundError") setToast(`Bluetooth: ${(err as Error).message}`);
    }
  }, []);

  const saveToRecord = () => {
    if (!Number.isFinite(nums.hr)) return;
    const vals = [{ indicator: "heart_rate", value: Math.round(nums.hr) }];
    if (Number.isFinite(nums.rmssd)) vals.push({ indicator: "hrv", value: Math.round(nums.rmssd) });
    record(crewId, vals);
    setToast(`Saved HR ${Math.round(nums.hr)} bpm${Number.isFinite(nums.rmssd) ? ` and HRV ${Math.round(nums.rmssd)} ms` : ""} to today's record`);
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const ask = (q: string) => window.dispatchEvent(new CustomEvent("vita-ask", { detail: q }));
  const crew = CREW.find((c) => c.id === crewId)!;
  const worst = active.find((a) => a.severity === "critical") ?? active.find((a) => a.severity === "action") ?? active[0];
  const sevColor = (s: MonitorAlert["severity"]) => (s === "critical" ? "var(--critical)" : s === "action" ? "var(--action)" : "var(--watch)");
  const fmtT = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  return (
    <div className="pt-8">
      <section className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="panel-title flex items-center gap-2">
              <Activity size={13} /> Live telemetry
            </p>
            {ble ? <DataBadge kind="live" /> : <DataBadge kind="sim" />}
          </div>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-6xl">
            Bedside monitor
            <br />
            <span className="text-ink-3">in orbit</span>
          </h1>
          <p className="mt-3 max-w-2xl text-ink-2">
            Real-time ECG, pulse oximetry and respiration at {FS} Hz, with beat-to-beat HRV, a stress index and on-device arrhythmia detection.
            Connect a Bluetooth chest strap to drive it from your own heartbeat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={crewId} onChange={(e) => setCrewId(e.target.value)} aria-label="Crew member" className="font-data rounded-md border border-line-2 bg-panel px-2 py-2 text-xs text-ink">
            {CREW.map((c) => (
              <option key={c.id} value={c.id}>
                {c.callsign} · {c.name}
              </option>
            ))}
          </select>
          {bleSupported && (
            <button type="button" onClick={connectBle} disabled={!!ble} className="inline-flex items-center gap-2 rounded-md border border-line-2 px-3 py-2 text-xs text-ink-2 hover:text-ink disabled:opacity-60">
              {ble ? <BluetoothConnected size={14} className="text-nominal" /> : <Bluetooth size={14} />}
              {ble ? `${ble.name}${ble.hr ? ` · ${ble.hr} bpm` : ""}` : "Connect HR strap"}
            </button>
          )}
          <button type="button" onClick={() => setRunning((r) => !r)} className="inline-flex items-center gap-2 rounded-md border border-line-2 px-3 py-2 text-xs text-ink-2 hover:text-ink">
            {running ? <Pause size={14} /> : <Play size={14} />} {running ? "Freeze" : "Resume"}
          </button>
        </div>
      </section>

      {worst && (
        <div className="rise mt-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: sevColor(worst.severity), background: `color-mix(in srgb, ${sevColor(worst.severity)} 12%, transparent)` }}>
          <span className={`h-2.5 w-2.5 rounded-full ${worst.severity === "critical" ? "pulse-critical" : ""}`} style={{ background: sevColor(worst.severity) }} />
          <span className="font-data text-xs tracking-widest uppercase" style={{ color: sevColor(worst.severity) }}>
            {worst.severity} · {worst.kind}
          </span>
          <span className="text-sm text-ink">{worst.message}</span>
          <button type="button" onClick={() => ask(`The live monitor for ${crew.name} shows: ${worst.message}. What should the crew do, given our location and comms delay?`)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-bg">
            <Sparkles size={12} /> Ask Copilot
          </button>
        </div>
      )}

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="panel ticks overflow-hidden p-0">
          <div className="relative">
            <canvas ref={canvasRef} className="block h-[420px] w-full sm:h-[480px]" aria-label="Live ECG, pleth and respiration waveforms" />
            {CH.slice(1).map((c, i) => (
              <div key={c.id} className="pointer-events-none absolute right-0 left-0 h-px bg-white/[0.06]" style={{ top: `${((i + 1) * 100) / CH.length}%` }} />
            ))}
            {CH.map((c, i) => (
              <span key={c.id} className="font-data pointer-events-none absolute left-3 text-[10px] tracking-widest" style={{ top: `calc(${(i * 100) / CH.length}% + 8px)`, color: c.color }}>
                {c.label}
              </span>
            ))}
            {ble && <span className="font-data pointer-events-none absolute right-3 bottom-2 text-[9px] text-ink-3">Beat timing from {ble.name}; waveform shape is synthesized</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          <Numeric label="Heart rate" unit="bpm" value={nums.hr} color="#3ed6b5" icon={<HeartPulse size={13} />} trend={nums.hrTrend} />
          <Numeric label="HRV · RMSSD 60 s" unit="ms" value={nums.rmssd} color="#c9b6ff" trend={nums.hrvTrend} />
          <Numeric label="SpO₂" unit="%" value={nums.spo2} color="#4fb7ff" warn={nums.spo2 < 92} />
          <Numeric label="Respiration" unit="/min" value={nums.rr} color="#f5b83d" icon={<Wind size={13} />} />
          <div className="panel col-span-2 p-4 xl:col-span-1">
            <div className="flex items-center justify-between">
              <span className="panel-title text-[9px]">Stress index</span>
              <span className="font-data text-[10px] text-ink-3">vs {crew.name.split(" ")[0]}&apos;s baseline</span>
            </div>
            <div className="font-display mt-1 text-4xl font-extrabold">{Number.isFinite(nums.stress) ? nums.stress : "—"}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gradient-to-r from-nominal via-watch to-critical opacity-90">
              <div className="h-full bg-bg/80 transition-all duration-500" style={{ marginLeft: `${Number.isFinite(nums.stress) ? nums.stress : 0}%` }} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-3">Rises with heart rate above baseline ({Math.round(baseHr)} bpm) and HRV below baseline ({Math.round(baseHrv)} ms).</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel ticks p-5">
          <h2 className="panel-title">Inject an event · test the detectors</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.hint}
                disabled={!!ble && s.id !== "none"}
                onClick={() => setScenario(s.id)}
                className={`font-data rounded-md px-3 py-1.5 text-[11px] tracking-wider uppercase transition disabled:opacity-30 ${scenario === s.id ? "bg-ink text-bg" : "border border-line-2 text-ink-2 hover:text-ink"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink-2">{SCENARIOS.find((s) => s.id === scenario)?.hint}.</p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" onClick={saveToRecord} className="inline-flex items-center gap-2 rounded-lg bg-nominal px-4 py-2 text-sm font-semibold text-bg">
              <Save size={14} /> Save HR & HRV to {crew.name.split(" ")[0]}&apos;s record
            </button>
            <button type="button" onClick={() => ask(`Interpret ${crew.name}'s live cardiac data: heart rate ${Math.round(nums.hr)} bpm, RMSSD ${Math.round(nums.rmssd)} ms, SpO2 ${Math.round(nums.spo2)}%, stress index ${nums.stress}. Compare with their recent trend.`)} className="inline-flex items-center gap-2 rounded-lg border border-line-2 px-4 py-2 text-sm text-ink-2 hover:text-ink">
              <Sparkles size={14} /> Interpret with Copilot
            </button>
          </div>
          <p className="mt-3 text-[11px] text-ink-3">
            Detectors: sustained HR &gt;110/&gt;130 or &lt;45 bpm; premature beat with compensatory pause; normalized RMSSD &gt;0.12 over 16+ beats (AF screen);
            SpO₂ &lt;92% for 10 s or &lt;88% for 5 s. Screening logic, not a diagnostic device.
          </p>
        </div>

        <div className="panel ticks p-5">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">Event log</h2>
            {alerts.length > 0 && (
              <button type="button" onClick={() => setAlerts([])} className="font-data text-[10px] text-ink-3 hover:text-ink">
                Clear
              </button>
            )}
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {alerts.length === 0 && <li className="text-sm text-ink-3">No events. Inject one to see the detectors respond.</li>}
            {alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="font-data mt-0.5 text-[10px] text-ink-3">T+{fmtT(a.at)}</span>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: sevColor(a.severity) }} />
                <span className="text-ink-2">{a.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {toast && (
        <div role="status" className="rise fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-nominal/50 bg-panel-2 px-5 py-2.5 text-sm font-semibold text-nominal shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function Numeric({ label, unit, value, color, icon, trend, warn }: { label: string; unit: string; value: number; color: string; icon?: React.ReactNode; trend?: number[]; warn?: boolean }) {
  return (
    <div className="panel p-4" style={warn ? { borderColor: "var(--critical)" } : undefined}>
      <div className="panel-title flex items-center gap-1.5 text-[9px]" style={{ color }}>
        {icon} {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-5xl font-extrabold tabular-nums" style={{ color: warn ? "var(--critical)" : color, textShadow: `0 0 18px color-mix(in srgb, ${color} 45%, transparent)` }}>
          {Number.isFinite(value) ? Math.round(value) : "—"}
        </span>
        <span className="font-data text-xs text-ink-3">{unit}</span>
      </div>
      {trend && trend.length > 2 && <Sparkline values={trend} color={color} />}
    </div>
  );
}
