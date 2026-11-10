// Daily composite scores in the style of consumer wearables (Whoop recovery, Oura readiness),
// adapted for spaceflight. Each score is transparent: it returns its contributors so the UI can
// show exactly why the number is what it is.
import { windowMedian } from "./assess";
import type { MissionEnvironment } from "./environments";
import type { Reading } from "./types";

export interface Contributor {
  id: string;
  label: string;
  /** 0–100 sub-score. */
  score: number;
  detail: string;
}

export interface Score {
  value: number;
  band: "low" | "fair" | "good" | "optimal";
  contributors: Contributor[];
}

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

function band(v: number): Score["band"] {
  if (v >= 85) return "optimal";
  if (v >= 70) return "good";
  if (v >= 55) return "fair";
  return "low";
}

function latest(rs: Reading[], id: string, day: number): number | undefined {
  return rs.find((r) => r.indicator === id && r.day === day)?.value;
}

function seriesOf(rs: Reading[], id: string) {
  return rs.filter((r) => r.indicator === id).sort((a, b) => a.day - b.day);
}

function weighted(cs: Contributor[], w: Record<string, number>): number {
  let num = 0;
  let den = 0;
  for (const c of cs) {
    num += c.score * (w[c.id] ?? 1);
    den += w[c.id] ?? 1;
  }
  return den ? num / den : 0;
}

/** Score a value against the person's own recent median: 100 at or better than baseline, falling by `perSd` per SD worse. */
function relative(v: number | undefined, base: number | undefined, sdUnit: number, higherIsBetter: boolean, perSd = 22): number {
  if (v === undefined || base === undefined) return 70;
  const z = ((v - base) / sdUnit) * (higherIsBetter ? 1 : -1);
  return clamp(85 + z * perSd);
}

export function readiness(rs: Reading[], day: number): Score {
  const hrv = latest(rs, "hrv", day);
  const hrvBase = windowMedian(seriesOf(rs, "hrv"), day - 30, day - 1);
  const rhr = latest(rs, "heart_rate", day);
  const rhrBase = windowMedian(seriesOf(rs, "heart_rate"), day - 30, day - 1);
  const temp = latest(rs, "body_temp", day);
  const tempBase = windowMedian(seriesOf(rs, "body_temp"), day - 30, day - 1);
  const sleepScore = sleep(rs, day).value;
  const cs: Contributor[] = [
    { id: "hrv", label: "HRV balance", score: relative(hrv, hrvBase, 8, true), detail: hrv !== undefined && hrvBase !== undefined ? `${hrv} ms vs ${Math.round(hrvBase)} ms usual` : "No data" },
    { id: "rhr", label: "Resting heart rate", score: relative(rhr, rhrBase, 4, false), detail: rhr !== undefined && rhrBase !== undefined ? `${rhr} bpm vs ${Math.round(rhrBase)} usual` : "No data" },
    { id: "temp", label: "Body temperature", score: temp !== undefined && tempBase !== undefined ? clamp(100 - Math.max(0, Math.abs(temp - tempBase) - 0.2) * 90) : 70, detail: temp !== undefined && tempBase !== undefined ? `${temp >= tempBase ? "+" : ""}${(temp - tempBase).toFixed(1)} °C from usual` : "No data" },
    { id: "sleep", label: "Sleep", score: sleepScore, detail: `Sleep score ${Math.round(sleepScore)}` },
  ];
  const v = Math.round(weighted(cs, { hrv: 3, rhr: 2, temp: 2, sleep: 3 }));
  return { value: v, band: band(v), contributors: cs };
}

export function sleep(rs: Reading[], day: number): Score {
  const s = seriesOf(rs, "sleep_hours");
  const last = s.find((r) => r.day === day)?.value;
  const week = s.filter((r) => r.day > day - 7 && r.day <= day).map((r) => r.value);
  const need = 7.5;
  const debt = week.reduce((a, h) => a + Math.max(0, need - h), 0);
  const consistency = week.length >= 3 ? Math.sqrt(week.reduce((a, h) => a + (h - week.reduce((x, y) => x + y, 0) / week.length) ** 2, 0) / week.length) : 0;
  const cs: Contributor[] = [
    { id: "duration", label: "Last night", score: last === undefined ? 50 : clamp((last / need) * 100), detail: last === undefined ? "Not logged" : `${last.toFixed(1)} h of ${need} h need` },
    { id: "debt", label: "7-day sleep debt", score: clamp(100 - debt * 8), detail: `${debt.toFixed(1)} h owed` },
    { id: "consistency", label: "Consistency", score: clamp(100 - consistency * 45), detail: `±${consistency.toFixed(1)} h night to night` },
  ];
  const v = Math.round(weighted(cs, { duration: 3, debt: 2, consistency: 1 }));
  return { value: v, band: band(v), contributors: cs };
}

/** How well the crew member is doing their spaceflight countermeasures (exercise, hydration, protocol). */
export function countermeasures(rs: Reading[], day: number, protocolDone: number, protocolTotal: number): Score {
  const ex = seriesOf(rs, "exercise_min").filter((r) => r.day > day - 7 && r.day <= day).map((r) => r.value);
  const exAvg = ex.length ? ex.reduce((a, b) => a + b, 0) / ex.length : 0;
  const hyd = latest(rs, "hydration", day);
  const cs: Contributor[] = [
    { id: "exercise", label: "Exercise (7-day avg)", score: clamp((exAvg / 120) * 100), detail: `${Math.round(exAvg)} of 120 min/day` },
    { id: "hydration", label: "Hydration", score: hyd === undefined ? 60 : clamp(100 - Math.max(0, hyd - 3) * 20), detail: hyd === undefined ? "Not logged" : `Urine color ${hyd}/8` },
    { id: "protocol", label: "Today's protocol", score: protocolTotal ? (protocolDone / protocolTotal) * 100 : 0, detail: `${protocolDone}/${protocolTotal} tasks` },
  ];
  const v = Math.round(weighted(cs, { exercise: 3, hydration: 1, protocol: 1 }));
  return { value: v, band: band(v), contributors: cs };
}

/**
 * Calf muscle volume loss (%) after `unloadedDays`. Muscle loss saturates rather than growing forever:
 * 20% × (1 − e^(−d/173)) gives the measured −13% at 182 days with exercise (Trappe 2009).
 * Poor exercise adherence scales it up to 1.4×.
 */
export function calfLoss(unloadedDays: number, adherence: number): number {
  return 20 * (1 - Math.exp(-unloadedDays / 173)) * (1.4 - 0.4 * Math.min(1, Math.max(0, adherence)));
}

// --- "Body odometer": cumulative, physically grounded quantities most people never think about ---

export interface OdometerItem {
  id: string;
  label: string;
  value: number;
  unit: string;
  decimals: number;
  note: string;
  source: string;
  kind: "model" | "fact";
}

/**
 * Cumulative estimates for one crew member at mission day `day`.
 * Rates are published population averages scaled by gravity and (for bone/muscle) exercise adherence.
 */
export function odometer(env: MissionEnvironment, day: number, doseMsv: number, exerciseAdherence: number): OdometerItem[] {
  const gf = 1 - Math.min(env.gravityG, 1);
  const months = day / 30.4;
  // Weight-bearing bone: ~1–1.5%/month without countermeasures; good exercise roughly halves it.
  const boneLoss = gf * months * 1.0 * (1 - 0.5 * Math.min(1, exerciseAdherence));
  // Calf muscle: ~13% over 6 months on ISS with exercise (Trappe et al. 2009, MRI of 9 crew); worse with poor adherence.
  const calf = calfLoss(gf * day, exerciseAdherence);
  const extraRbc = gf > 0 ? 1e6 * 86400 * day : 0; // 54% more hemolysis: ~3M/s vs 2M/s → +1M/s
  const sunrises = env.id === "iss" ? day * 16 : 0;
  return [
    { id: "dose_xray", label: "Radiation, in chest X-rays", value: doseMsv / 0.1, unit: "X-rays", decimals: 0, note: `${doseMsv.toFixed(0)} mSv ≈ ${Math.round(doseMsv / 0.1)} chest X-rays at 0.1 mSv each`, source: "Dose model; 0.1 mSv per PA chest X-ray", kind: "model" },
    { id: "bone", label: "Est. hip & leg bone lost", value: boneLoss, unit: "%", decimals: 1, note: "1–1.5% per month without loading; resistive exercise roughly halves it. Full recovery can take years.", source: "NASA HRP bone evidence; Gabel 2022", kind: "model" },
    { id: "calf", label: "Est. calf muscle volume lost", value: calf, unit: "%", decimals: 1, note: "ISS crews lost ~13% calf volume over 6 months despite daily exercise.", source: "Trappe et al. 2009, J Appl Physiol (9 ISS crew)", kind: "model" },
    { id: "height", label: "Spine lengthening", value: gf > 0 ? Math.min(5, 5 * (1 - Math.exp(-day / 10))) : 0, unit: "cm", decimals: 1, note: "Unloaded discs expand: crews 'grow' up to ~5 cm, raising disc-herniation risk on return.", source: "Chang et al. 2016 (6 NASA astronauts)", kind: "model" },
    { id: "rbc", label: "Extra red cells destroyed", value: extraRbc / 1e9, unit: "billion", decimals: 0, note: "54% more hemolysis in flight: ~3 million red cells per second instead of 2 million.", source: "Trudel et al. 2022, Nature Medicine", kind: "model" },
    ...(sunrises
      ? [{ id: "sunrises", label: "Sunrises seen", value: sunrises, unit: "", decimals: 0, note: "The ISS orbits every ~90 min: 16 sunrises a day scramble the body clock.", source: "ISS orbital period", kind: "fact" as const }]
      : [{ id: "delay", label: "Round-trip to Earth", value: (env.commsDelaySec[0] * 2) / 60, unit: "min", decimals: env.commsDelaySec[0] * 2 < 60 ? 2 : 0, note: "Minimum time to ask the flight surgeon a question and hear the answer.", source: "Light-time", kind: "fact" as const }]),
  ];
}
