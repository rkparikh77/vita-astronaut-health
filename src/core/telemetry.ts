// Real-time physiological signal engine for the live monitor.
// Waveforms are synthesized; beat timing either comes from the simulator (with realistic HRV)
// or from a real Bluetooth heart-rate strap's RR intervals.

/** One PQRST complex as a sum of Gaussians (after McSharry et al. 2003, ECGSYN). phase ∈ [0, 1) of the RR interval. */
const WAVES = [
  { a: 0.12, mu: 0.16, sigma: 0.025 }, // P
  { a: -0.12, mu: 0.235, sigma: 0.008 }, // Q
  { a: 1.0, mu: 0.25, sigma: 0.01 }, // R
  { a: -0.22, mu: 0.27, sigma: 0.009 }, // S
  { a: 0.28, mu: 0.48, sigma: 0.05 }, // T
];

export function ecgSample(phase: number, opts: { wide?: boolean; noP?: boolean } = {}): number {
  let v = 0;
  for (const [i, w] of WAVES.entries()) {
    if (opts.noP && i === 0) continue;
    const sigma = opts.wide && i >= 1 && i <= 3 ? w.sigma * 2.6 : w.sigma;
    const amp = opts.wide && i === 2 ? w.a * 1.35 : w.a;
    v += amp * Math.exp(-((phase - w.mu) ** 2) / (2 * sigma * sigma));
  }
  return v;
}

/** Photoplethysmogram (pulse oximeter) wave: systolic upstroke and a dicrotic notch. */
export function plethSample(phase: number): number {
  const p = (phase + 0.85) % 1; // pulse arrives ~150 ms after the R wave
  const sys = Math.exp(-((p - 0.18) ** 2) / (2 * 0.06 ** 2));
  const dic = 0.35 * Math.exp(-((p - 0.45) ** 2) / (2 * 0.07 ** 2));
  return sys + dic;
}

export function respSample(t: number, breathsPerMin: number): number {
  return Math.sin((2 * Math.PI * t * breathsPerMin) / 60);
}

/** Seeded Gaussian generator so the demo stream is repeatable. */
export function makeRng(seed = 42) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { u, g: () => Math.sqrt(-2 * Math.log(Math.max(u(), 1e-12))) * Math.cos(2 * Math.PI * u()) };
}

export type BeatKind = "normal" | "pvc" | "af";

export interface Beat {
  t: number; // R-peak time, seconds
  rr: number; // interval since previous beat, seconds
  kind: BeatKind;
}

export type Scenario = "none" | "pvc" | "af" | "tachy" | "desat";

/**
 * Generates the next RR interval. AR(1) noise is scaled so successive differences have
 * the requested RMSSD; respiratory sinus arrhythmia adds a breathing-locked swing.
 */
export class BeatGenerator {
  private x = 0;
  private pendingCompensation = 0;
  constructor(private rng = makeRng()) {}

  next(t: number, hr: number, rmssdMs: number, breathsPerMin: number, scenario: Scenario): { rr: number; kind: BeatKind } {
    if (this.pendingCompensation) {
      const rr = this.pendingCompensation;
      this.pendingCompensation = 0;
      return { rr, kind: "normal" };
    }
    const mean = 60 / hr;
    if (scenario === "af") return { rr: Math.max(0.33, 0.42 + this.rng.u() * 0.6), kind: "af" };
    if (scenario === "pvc" && this.rng.u() < 0.18) {
      this.pendingCompensation = mean * 1.4; // full compensatory pause
      return { rr: mean * 0.62, kind: "pvc" };
    }
    const phi = 0.5;
    const sigma = rmssdMs / 1000; // with φ=0.5, SD of successive differences ≈ σ
    this.x = phi * this.x + this.rng.g() * sigma * Math.sqrt(1 - phi * phi);
    const rsa = 0.35 * sigma * Math.sin((2 * Math.PI * t * breathsPerMin) / 60);
    return { rr: Math.max(0.3, mean + this.x + rsa), kind: "normal" };
  }
}

// --- Beat-to-beat metrics ---

export function rmssd(rrSec: number[]): number {
  if (rrSec.length < 3) return NaN;
  let s = 0;
  for (let i = 1; i < rrSec.length; i++) s += (rrSec[i] - rrSec[i - 1]) ** 2;
  return Math.sqrt(s / (rrSec.length - 1)) * 1000;
}

export function meanHr(rrSec: number[]): number {
  if (!rrSec.length) return NaN;
  return 60 / (rrSec.reduce((a, b) => a + b, 0) / rrSec.length);
}

/**
 * 0–100 stress index from the last minute: higher heart rate and lower RMSSD than the person's
 * baseline both push it up (same idea as consumer "stress monitor" features, kept transparent).
 */
export function stressIndex(hr: number, rmssdMs: number, baseHr: number, baseRmssd: number): number {
  if (!Number.isFinite(hr) || !Number.isFinite(rmssdMs)) return NaN;
  const hrTerm = (hr - baseHr) / 10; // +10 bpm → +1
  const hrvTerm = Math.log(baseRmssd / Math.max(rmssdMs, 1)) / Math.log(2); // half the HRV → +1
  return Math.round(Math.max(0, Math.min(100, 30 + 25 * hrTerm + 30 * hrvTerm)));
}

export type AlertKind = "tachycardia" | "bradycardia" | "ectopic" | "irregular" | "desaturation";

export interface MonitorAlert {
  kind: AlertKind;
  severity: "watch" | "action" | "critical";
  message: string;
}

/** Rhythm and saturation checks over the recent beats. Each returns at most one alert per kind. */
export function detect(beats: Beat[], spo2: number, spo2LowSeconds: number): MonitorAlert[] {
  const out: MonitorAlert[] = [];
  const recent = beats.slice(-12);
  if (recent.length >= 8) {
    const hr = meanHr(recent.slice(-8).map((b) => b.rr));
    if (hr > 130) out.push({ kind: "tachycardia", severity: "critical", message: `Heart rate ${Math.round(hr)} bpm (sustained)` });
    else if (hr > 110) out.push({ kind: "tachycardia", severity: "action", message: `Heart rate ${Math.round(hr)} bpm (sustained)` });
    else if (hr < 45) out.push({ kind: "bradycardia", severity: "action", message: `Heart rate ${Math.round(hr)} bpm (sustained)` });

    // Ectopic beat: a short interval followed by a compensatory pause, relative to the local median.
    const rrs = recent.map((b) => b.rr);
    const med = [...rrs].sort((a, b) => a - b)[Math.floor(rrs.length / 2)];
    for (let i = rrs.length - 3; i < rrs.length - 1; i++) {
      if (i > 0 && rrs[i] < 0.8 * med && rrs[i + 1] > 1.2 * med) {
        out.push({ kind: "ectopic", severity: "watch", message: "Premature beat with compensatory pause (possible PVC)" });
        break;
      }
    }
  }
  const window = beats.slice(-20);
  if (window.length >= 16) {
    // Remove ectopic short-long pairs first (as AF screens do), so isolated PVCs don't look like AF.
    const all = window.map((b) => b.rr);
    const med = [...all].sort((x, y) => x - y)[Math.floor(all.length / 2)];
    const drop = new Set<number>();
    for (let i = 0; i < all.length - 1; i++) if (all[i] < 0.8 * med && all[i + 1] > 1.2 * med) drop.add(i).add(i + 1);
    const rrs = all.filter((_, i) => !drop.has(i));
    const m = rrs.reduce((a, b) => a + b, 0) / rrs.length;
    // Normalized RMSSD > 0.12 over 12+ clean beats is a common AF screening threshold.
    const nrmssd = rrs.length >= 12 ? rmssd(rrs) / 1000 / m : 0;
    if (nrmssd > 0.12) out.push({ kind: "irregular", severity: "action", message: `Irregularly irregular rhythm (nRMSSD ${nrmssd.toFixed(2)}): possible atrial fibrillation` });
  }
  // In an irregularly irregular rhythm, "premature beats" are part of the irregularity, not a separate finding.
  if (out.some((a) => a.kind === "irregular")) {
    const i = out.findIndex((a) => a.kind === "ectopic");
    if (i >= 0) out.splice(i, 1);
  }
  if (spo2 < 88 && spo2LowSeconds >= 5) out.push({ kind: "desaturation", severity: "critical", message: `SpO₂ ${Math.round(spo2)}% for ${Math.round(spo2LowSeconds)} s` });
  else if (spo2 < 92 && spo2LowSeconds >= 10) out.push({ kind: "desaturation", severity: "action", message: `SpO₂ ${Math.round(spo2)}% for ${Math.round(spo2LowSeconds)} s` });
  return out;
}

/** Parse a Bluetooth Heart Rate Measurement characteristic (0x2A37). */
export function parseHeartRateMeasurement(dv: DataView): { hr: number; rr: number[] } {
  const flags = dv.getUint8(0);
  const hr16 = flags & 0x01;
  let o = 1;
  const hr = hr16 ? dv.getUint16(o, true) : dv.getUint8(o);
  o += hr16 ? 2 : 1;
  if (flags & 0x08) o += 2; // energy expended present
  const rr: number[] = [];
  if (flags & 0x10) {
    for (; o + 1 < dv.byteLength; o += 2) rr.push(dv.getUint16(o, true) / 1024);
  }
  return { hr, rr };
}
