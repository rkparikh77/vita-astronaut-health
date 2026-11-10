"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Lock, Mic, ScanFace, Square } from "lucide-react";
import { DataBadge } from "@/components/viz";
import { CREW } from "@/core/crew";
import { analyzeVoice, compareVoice, estimateHeartRate, resample, type HeartRateEstimate, type Sample, type VoiceFeatures } from "@/core/rppg";
import { useMission } from "@/lib/store";

const SCAN_SEC = 20;
const FS = 30;
const SENTENCE = "Mission day one hundred twelve. All systems nominal. The crew is rested and ready for the next task.";

export default function ScanPage() {
  const [crewId, setCrewId] = useState("tanaka");
  const [secure, setSecure] = useState(true);
  useEffect(() => setSecure(window.isSecureContext && !!navigator.mediaDevices?.getUserMedia), []);
  const crew = CREW.find((c) => c.id === crewId)!;

  return (
    <div className="pt-8">
      <section className="rise grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="panel-title flex items-center gap-2">
              <ScanFace size={13} /> Hardware-free vitals
            </p>
            <span className="font-data rounded-full border border-watch/50 px-2 py-0.5 text-[9px] tracking-[0.14em] text-watch uppercase">Experimental</span>
          </div>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
            When the kit
            <br />
            <span className="text-ink-3">breaks</span>
          </h1>
          <p className="mt-4 max-w-xl text-ink-2">
            Six months from the nearest spare part, a medical sensor failure can&apos;t ground the crew. VITA reads heart rate from a phone camera
            and checks fatigue in the voice, with no hardware beyond the tablet already on board. Useful on Earth too, anywhere a clinic is far away.
          </p>
        </div>
        <div className="panel flex items-start gap-3 p-4 text-sm text-ink-2">
          <Lock size={16} className="mt-0.5 shrink-0 text-nominal" />
          <div>
            <b className="text-ink">Processed entirely on this device.</b> No video or audio leaves the browser; only the resulting numbers are saved,
            and only if you choose to.
            <label className="mt-3 flex items-center gap-2">
              <span className="text-xs text-ink-3">Astronaut</span>
              <select value={crewId} onChange={(e) => setCrewId(e.target.value)} aria-label="Astronaut" className="font-data rounded-md border border-line-2 bg-panel px-2 py-1 text-xs">
                {CREW.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {!secure && (
        <p className="mt-6 rounded-xl border border-watch/50 bg-watch/10 px-4 py-3 text-sm text-watch">
          Camera and microphone need a secure (HTTPS) page. Open VITA from its deployed https:// address, or on this computer at localhost.
        </p>
      )}

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <CameraHr crewId={crewId} name={crew.name} />
        <VoiceCheck crewId={crewId} name={crew.name} />
      </section>
    </div>
  );
}

function CameraHr({ crewId, name }: { crewId: string; name: string }) {
  const { record } = useMission();
  const videoRef = useRef<HTMLVideoElement>(null);
  const traceRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samples = useRef<Sample[]>([]);
  const [state, setState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [est, setEst] = useState<HeartRateEstimate | null>(null);
  const [light, setLight] = useState(0);
  const [msg, setMsg] = useState<string>();

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stop, []);

  const start = async () => {
    try {
      setMsg(undefined);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      samples.current = [];
      setEst(null);
      setState("scanning");
    } catch (e) {
      setState("error");
      setMsg((e as Error).name === "NotAllowedError" ? "Camera permission was denied." : `Camera unavailable: ${(e as Error).message}`);
    }
  };

  // Sample the forehead region ~30×/s on a timer (works even if animation frames are throttled).
  useEffect(() => {
    if (state !== "scanning") return;
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const t0 = performance.now();
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, 160, 120);
      // forehead box inside the on-screen face guide
      const x0 = 64, y0 = 26, w = 32, h = 14;
      const px = ctx.getImageData(x0, y0, w, h).data;
      let g = 0;
      let lum = 0;
      for (let i = 0; i < px.length; i += 4) {
        g += px[i + 1];
        lum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      }
      const n = px.length / 4;
      const t = (performance.now() - t0) / 1000;
      samples.current.push({ t, v: g / n });
      setLight(lum / n);
      setElapsed(t);
      if (samples.current.length % 15 === 0 && t > 6) {
        const recent = samples.current.filter((s) => s.t > t - 15);
        setEst(estimateHeartRate(resample(recent, FS), FS));
      }
      drawTrace(traceRef.current, samples.current.filter((s) => s.t > t - 6));
      if (t >= SCAN_SEC) {
        setEst(estimateHeartRate(resample(samples.current.filter((s) => s.t > 2), FS), FS));
        setState("done");
        stop();
      }
    }, 1000 / FS);
    return () => clearInterval(id);
  }, [state]);

  const q = est?.quality ?? 0;
  const qLabel = q > 0.35 ? "Good signal" : q > 0.2 ? "Fair signal" : "Weak signal: hold still, face a light";
  const qColor = q > 0.35 ? "var(--nominal)" : q > 0.2 ? "var(--watch)" : "var(--action)";

  return (
    <div className="panel ticks p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title flex items-center gap-2">
          <Camera size={13} /> Camera heart rate
        </h2>
        <DataBadge kind="live" />
      </div>
      <div className="relative mx-auto mt-4 aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        {/* face guide + forehead region */}
        <svg viewBox="0 0 160 120" className="pointer-events-none absolute inset-0 h-full w-full">
          <ellipse cx="80" cy="62" rx="34" ry="44" fill="none" stroke={state === "scanning" ? qColor : "rgba(255,255,255,.5)"} strokeWidth="1.2" strokeDasharray="3 3" />
          <rect x="64" y="26" width="32" height="14" rx="3" fill="none" stroke="#3ed6b5" strokeWidth="1" />
        </svg>
        {state === "idle" && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-center text-sm text-ink-2">
            <div>
              Fit your face in the oval.
              <br />
              Keep still for {SCAN_SEC} seconds in good, steady light.
            </div>
          </div>
        )}
        {state === "scanning" && (
          <div className="absolute top-3 right-3 left-3 flex items-center justify-between">
            <span className="font-data rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-ink">{Math.max(0, SCAN_SEC - elapsed).toFixed(0)} s</span>
            {light < 60 && <span className="font-data rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-watch">Too dark</span>}
          </div>
        )}
      </div>
      <canvas ref={traceRef} width={600} height={80} className="mt-3 h-14 w-full" aria-label="Pulse waveform" />
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-6xl font-extrabold tabular-nums" style={{ color: est ? qColor : "var(--ink-3)" }}>
            {est ? Math.round(est.bpm) : "—"}
            <span className="font-data ml-1 text-sm font-normal text-ink-3">bpm</span>
          </div>
          {est && <div className="font-data text-[11px]" style={{ color: qColor }}>{qLabel} · {(q * 100).toFixed(0)}% peak power</div>}
        </div>
        {state === "scanning" ? (
          <button type="button" onClick={() => { stop(); setState("idle"); }} className="inline-flex items-center gap-2 rounded-lg border border-line-2 px-4 py-2 text-sm">
            <Square size={13} /> Stop
          </button>
        ) : (
          <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-lg bg-nominal px-4 py-2 text-sm font-semibold text-bg">
            <Camera size={14} /> {state === "done" ? "Scan again" : "Start scan"}
          </button>
        )}
      </div>
      {state === "done" && est && q > 0.2 && (
        <button
          type="button"
          onClick={() => {
            record(crewId, [{ indicator: "heart_rate", value: Math.round(est.bpm) }]);
            setMsg(`Saved ${Math.round(est.bpm)} bpm to ${name}'s record.`);
          }}
          className="mt-3 w-full rounded-lg border border-nominal/60 py-2 text-sm text-nominal"
        >
          Save to {name.split(" ")[0]}&apos;s record
        </button>
      )}
      {msg && <p className="mt-2 text-xs text-ink-2">{msg}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
        Remote photoplethysmography (Verkruysse et al. 2008): the green channel over the forehead, band-passed to 0.7–3.5 Hz, spectral peak = heart
        rate. Accuracy drops with motion and poor light; treat it as a screening value.
      </p>
    </div>
  );
}

function drawTrace(canvas: HTMLCanvasElement | null, s: Sample[]) {
  if (!canvas || s.length < 10) return;
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  // quick detrend for display
  const vals = s.map((p, i) => p.v - s.slice(Math.max(0, i - 15), i + 15).reduce((a, b) => a + b.v, 0) / Math.min(30, s.length));
  const max = Math.max(...vals.map(Math.abs)) || 1;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#3ed6b5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h / 2 - (v / max) * (h / 2.4);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();
}

function VoiceCheck({ crewId, name }: { crewId: string; name: string }) {
  const [state, setState] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [mode, setMode] = useState<"baseline" | "today">("today");
  const [features, setFeatures] = useState<VoiceFeatures | null>(null);
  const [baseline, setBaseline] = useState<VoiceFeatures | null>(null);
  const [level, setLevel] = useState(0);
  const [msg, setMsg] = useState<string>();
  const key = `vita.voice.${crewId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setBaseline(raw ? JSON.parse(raw) : null);
    } catch {
      setBaseline(null);
    }
    setFeatures(null);
  }, [key]);

  const recordVoice = async (which: "baseline" | "today") => {
    setMode(which);
    setMsg(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new Ctx();
      const src = ac.createMediaStreamSource(stream);
      const proc = ac.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d));
        let s = 0;
        for (let i = 0; i < d.length; i += 8) s += d[i] * d[i];
        setLevel(Math.min(1, Math.sqrt(s / (d.length / 8)) * 6));
      };
      src.connect(proc);
      proc.connect(ac.destination);
      setState("recording");
      await new Promise((r) => setTimeout(r, 7000));
      proc.disconnect();
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const total = chunks.reduce((a, c) => a + c.length, 0);
      const pcm = new Float32Array(total);
      let o = 0;
      for (const c of chunks) {
        pcm.set(c, o);
        o += c.length;
      }
      // decimate to ~16 kHz for speed
      const step = Math.max(1, Math.round(ac.sampleRate / 16000));
      const ds = new Float32Array(Math.floor(pcm.length / step));
      for (let i = 0; i < ds.length; i++) ds[i] = pcm[i * step];
      await ac.close();
      const f = analyzeVoice(ds, ac.sampleRate / step);
      if (!Number.isFinite(f.f0Mean) || f.voicedFraction < 0.15) {
        setState("error");
        setMsg("Couldn't hear enough speech. Read the sentence aloud, close to the microphone.");
        return;
      }
      setFeatures(f);
      if (which === "baseline") {
        try {
          localStorage.setItem(key, JSON.stringify({ ...f, f0Track: [] }));
        } catch {
          /* storage unavailable */
        }
        setBaseline(f);
      }
      setState("done");
    } catch (e) {
      setState("error");
      setMsg((e as Error).name === "NotAllowedError" ? "Microphone permission was denied." : `Microphone unavailable: ${(e as Error).message}`);
    }
  };

  const cmp = features && baseline && mode === "today" ? compareVoice(features, baseline) : null;
  const track = features?.f0Track ?? [];

  return (
    <div className="panel ticks p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title flex items-center gap-2">
          <Mic size={13} /> Voice fatigue check
        </h2>
        <DataBadge kind="live" />
      </div>
      <p className="mt-3 text-sm text-ink-2">Read this aloud at your normal pace:</p>
      <blockquote className="mt-2 rounded-xl border border-line bg-bg-2/60 p-4 text-lg leading-snug text-ink">&ldquo;{SENTENCE}&rdquo;</blockquote>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-nominal transition-all duration-75" style={{ width: `${state === "recording" ? level * 100 : 0}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={state === "recording"} onClick={() => recordVoice("baseline")} className="rounded-lg border border-line-2 px-4 py-2 text-sm text-ink-2 hover:text-ink disabled:opacity-40">
          {baseline ? "Re-record baseline" : "Record rested baseline"}
        </button>
        <button type="button" disabled={state === "recording" || !baseline} onClick={() => recordVoice("today")} className="inline-flex items-center gap-2 rounded-lg bg-nominal px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
          <Mic size={14} /> {state === "recording" ? "Listening…" : "Check today"}
        </button>
      </div>
      {!baseline && <p className="mt-2 text-xs text-ink-3">Record a baseline first, ideally after a good night&apos;s sleep. It stays on this device.</p>}

      {features && (
        <div className="mt-5">
          {cmp && (
            <div className="flex items-end gap-4">
              <div className="font-display text-6xl font-extrabold" style={{ color: cmp.index >= 85 ? "var(--nominal)" : cmp.index >= 65 ? "var(--watch)" : "var(--action)" }}>
                {cmp.index}
              </div>
              <div className="pb-2 text-sm text-ink-2">
                vocal energy vs {name.split(" ")[0]}&apos;s baseline
                <ul className="mt-1 text-xs text-ink-3">
                  {cmp.notes.map((n) => (
                    <li key={n}>• {n}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {mode === "baseline" && <p className="text-sm text-nominal">Baseline saved for {name.split(" ")[0]}.</p>}
          <svg viewBox="0 0 300 60" className="mt-3 h-16 w-full" aria-label="Pitch track">
            {track.map((f, i) =>
              f === null ? null : <circle key={i} cx={(i / Math.max(1, track.length - 1)) * 300} cy={60 - Math.min(58, Math.max(2, ((f - 70) / 250) * 60))} r={1.3} fill="#c9b6ff" />,
            )}
          </svg>
          <dl className="font-data mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Feat label="Pitch" value={`${features.f0Mean.toFixed(0)} Hz`} />
            <Feat label="Pitch variation" value={`±${features.f0Sd.toFixed(0)} Hz`} />
            <Feat label="Syllables/s" value={features.syllablesPerSec.toFixed(1)} />
            <Feat label="Loudness" value={`${features.loudnessDb.toFixed(0)} dB`} />
          </dl>
        </div>
      )}
      {msg && <p className="mt-3 text-xs text-watch">{msg}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
        Pitch by autocorrelation; fatigue and sleep loss tend to flatten pitch variation and slow speech (Vogel et al. 2010, Krajewski et al. 2009).
        A personal trend signal, not a diagnosis.
      </p>
    </div>
  );
}

function Feat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-2/60 px-2.5 py-2">
      <dt className="text-[9px] tracking-wider text-ink-3 uppercase">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
