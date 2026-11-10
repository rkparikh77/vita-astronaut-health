import type { MissionEnvironment } from "./environments";
import { INDICATORS, getIndicator } from "./indicators";
import type { Reading } from "./types";

/** Small deterministic PRNG so every run of the demo shows the same mission. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A scenario adds a delta to an indicator between two mission days (inclusive).
 * Days can be negative to mean "relative to the current day" (-1 = yesterday).
 */
export interface Scenario {
  id: string;
  label: string;
  description: string;
  start: number;
  end: number;
  effects: Partial<Record<string, number | ((dayIntoScenario: number) => number)>>;
}

export interface SimInput {
  seed: string;
  baselines: Record<string, number>;
  env: MissionEnvironment;
  currentDay: number;
  missionLength: number;
  scenarios?: Scenario[];
}

const exp1 = (d: number, tau: number) => 1 - Math.exp(-d / tau);

/**
 * Published spaceflight effects, scaled by how much gravity is missing (0 g = full effect).
 * Sources: Stahn 2017 (core temperature), Barger 2014 (sleep), Trudel 2022 (space anemia),
 * Smith 2015 (calcium), Norsk 2015 (blood pressure), Crucian 2018 (immune).
 */
function spaceflightDelta(id: string, day: number, gf: number, phase: number): number {
  switch (id) {
    case "heart_rate":
      return -3 * gf * exp1(day, 7);
    case "systolic_bp":
      return -6 * gf * exp1(day, 5);
    case "diastolic_bp":
      return -3 * gf * exp1(day, 5);
    case "body_temp":
      return 0.8 * gf * exp1(day, 60);
    case "sleep_hours":
      return -1.0; // ~6 h average in flight vs ~7 h on the ground
    case "mood":
      return phase > 0.5 && phase < 0.75 ? -0.4 : 0; // "third-quarter" effect
    case "body_mass_pct":
      return -1.2 * exp1(day, 30);
    case "hemoglobin":
      return -0.5 * gf * exp1(day, 15);
    case "calcium":
      return 0.15 * gf * exp1(day, 30);
    case "lymphocytes":
      return -150 * gf * exp1(day, 30);
    case "glucose":
      return (5 * gf * day) / 180; // gradual insulin resistance
    default:
      return 0;
  }
}

const NOISE_SCALE: Record<string, number> = { mood: 0.4, stress: 0.4, vision_score: 0, spo2: 0.6, hydration: 0.8 };

export function simulate(input: SimInput): Reading[] {
  const { env, currentDay, missionLength, baselines } = input;
  const rand = mulberry32(hashString(input.seed));
  const gf = 1 - Math.min(env.gravityG, 1);
  const scenarios = (input.scenarios ?? []).map((s) => ({
    ...s,
    start: s.start < 0 ? currentDay + s.start + 1 : s.start,
    end: s.end < 0 ? currentDay + s.end + 1 : s.end,
  }));
  const out: Reading[] = [];
  const sleepLog: number[] = [];

  for (let day = 1; day <= currentDay; day++) {
    const phase = day / missionLength;
    const today: Record<string, number> = {};

    // Order matters: sleep first, so reaction time can respond to sleep debt.
    const ordered = [...INDICATORS.filter((i) => i.id === "sleep_hours"), ...INDICATORS.filter((i) => i.id !== "sleep_hours")];
    for (const ind of ordered) {
      if (ind.cadence === "weekly" && day % 7 !== 0 && day !== currentDay) continue;
      const base = baselines[ind.id];
      if (base === undefined) continue;
      let v = base + spaceflightDelta(ind.id, day, gf, phase);
      v += gaussian(rand) * (NOISE_SCALE[ind.id] ?? ind.personalSd * 0.6);

      for (const s of scenarios) {
        if (day < s.start || day > s.end) continue;
        const e = s.effects[ind.id];
        if (e === undefined) continue;
        v += typeof e === "function" ? e(day - s.start) : e;
      }

      if (ind.id === "pvt_ms") {
        const recent = sleepLog.slice(-3);
        const debt = recent.reduce((a, h) => a + Math.max(0, 7.5 - h), 0);
        v += 9 * debt;
      }
      if (ind.id === "heart_rate" && today.sleep_hours !== undefined) {
        v += Math.max(0, 6 - today.sleep_hours) * 2;
      }
      if (ind.id === "hrv" && today.sleep_hours !== undefined) {
        v -= Math.max(0, 6.5 - today.sleep_hours) * 6;
      }

      const [lo, hi] = ind.range;
      v = Math.min(hi, Math.max(lo, v));
      if (ind.decimals === 0) v = Math.round(v);
      else v = Number(v.toFixed(ind.decimals));
      today[ind.id] = v;
      out.push({ indicator: ind.id, value: v, day, source: "sim" });
    }
    if (today.sleep_hours !== undefined) sleepLog.push(today.sleep_hours);
  }
  return out;
}

export function latestDay(readings: Reading[]): number {
  return readings.reduce((m, r) => Math.max(m, r.day), 0);
}

/** Readings for one indicator, sorted by day. */
export function series(readings: Reading[], id: string) {
  getIndicator(id);
  return readings.filter((r) => r.indicator === id).sort((a, b) => a.day - b.day);
}
