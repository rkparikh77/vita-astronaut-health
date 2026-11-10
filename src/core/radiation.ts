import type { MissionEnvironment } from "./environments";
import type { Status } from "./types";

/** NASA-STD-3001 Vol 1 Rev B (2022): career effective dose limit, all ages and sexes. */
export const CAREER_LIMIT_MSV = 600;
/** Short-term blood-forming-organ limits (mGy-Eq, treated here as ~mSv for display). */
export const LIMIT_30_DAY = 250;
export const LIMIT_1_YEAR = 500;

/** Extra dose (mSv) a crew member in a deep-space habitat would take from an SEP event, before shelter. */
export const SEP_EVENT_DOSE: Record<"minor" | "moderate" | "major", number> = {
  minor: 5,
  moderate: 30,
  major: 120,
};

export interface DoseDay {
  day: number;
  daily: number;
  cumulative: number;
  sep?: boolean;
}

export interface SepEvent {
  day: number;
  severity: keyof typeof SEP_EVENT_DOSE;
  /** Fraction of dose avoided by sheltering (0–1). */
  shelterFactor?: number;
}

export function doseTimeline(
  env: MissionEnvironment,
  days: number,
  priorCareerDose = 0,
  events: SepEvent[] = [],
): DoseDay[] {
  const out: DoseDay[] = [];
  let cum = priorCareerDose;
  for (let d = 1; d <= days; d++) {
    let daily = env.doseRate;
    let sep = false;
    for (const e of events.filter((e) => e.day === d)) {
      daily += SEP_EVENT_DOSE[e.severity] * env.sepExposure * (1 - (e.shelterFactor ?? 0));
      sep = true;
    }
    cum += daily;
    out.push({ day: d, daily, cumulative: cum, sep });
  }
  return out;
}

export function windowDose(tl: DoseDay[], endDay: number, window: number): number {
  return tl.filter((d) => d.day > endDay - window && d.day <= endDay).reduce((a, d) => a + d.daily, 0);
}

export function radiationStatus(cumulative: number, last30: number): Status {
  const pct = cumulative / CAREER_LIMIT_MSV;
  if (pct >= 1 || last30 >= LIMIT_30_DAY) return "critical";
  if (pct >= 0.8 || last30 >= LIMIT_30_DAY * 0.6) return "action";
  if (pct >= 0.5 || last30 >= LIMIT_30_DAY * 0.3) return "watch";
  return "nominal";
}

/** Days of mission left before reaching the career limit at the current rate. */
export function daysToCareerLimit(cumulative: number, env: MissionEnvironment): number {
  return Math.max(0, Math.floor((CAREER_LIMIT_MSV - cumulative) / env.doseRate));
}

/** Classify a DONKI SEP or flare record into a severity bucket. */
export function classifyFlare(classType: string | undefined): SepEvent["severity"] {
  if (!classType) return "minor";
  if (classType.startsWith("X")) return "major";
  if (classType.startsWith("M")) return "moderate";
  return "minor";
}
