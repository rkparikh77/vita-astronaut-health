import data from "../data/inspiration4.json";
import { assess, type Assessment } from "./assess";
import { ENV_MAP, type EnvironmentId, type MissionEnvironment } from "./environments";
import { INDICATORS, getIndicator, type Thresholds } from "./indicators";
import { preflightBaseline, referenceRange, type CrewLabs } from "./osdr";
import { doseTimeline, radiationStatus, windowDose, type SepEvent } from "./radiation";
import { personalBpThresholds } from "./medical";
import { simulate, type Scenario } from "./simulator";
import { worst, type Reading, type Status } from "./types";

export const MISSION = {
  name: "Artemis-class long-duration demo",
  length: 180,
  currentDay: 112,
};

/** OSDR analyte name for each lab indicator. */
export const LAB_ANALYTE: Record<string, string> = {
  wbc: "white_blood_cell_count",
  lymphocytes: "absolute_lymphocytes",
  hemoglobin: "hemoglobin",
  calcium: "calcium",
  glucose: "glucose",
};

export const SCENARIOS: Record<string, Scenario> = {
  sleep_debt: {
    id: "sleep_debt",
    label: "Sleep debt",
    description: "Six nights of short sleep after a busy docking week.",
    start: -6,
    end: -1,
    effects: { sleep_hours: -1.8, mood: -1, stress: 1.5, hrv: -10 },
  },
  fever: {
    id: "fever",
    label: "Viral reactivation",
    description: "Fever with falling lymphocytes, consistent with a reactivated latent virus.",
    start: -2,
    end: -1,
    effects: { body_temp: 1.6, heart_rate: 14, lymphocytes: -900, wbc: 2.5, resp_rate: 4, hrv: -22 },
  },
  bone: {
    id: "bone",
    label: "Exercise device outage",
    description: "Resistive exercise device down for 3 weeks: calcium climbs as bone resorbs.",
    start: -21,
    end: -1,
    effects: { exercise_min: -70, calcium: (d) => 0.035 * d, hydration: 2 },
  },
  sans: {
    id: "sans",
    label: "Early SANS",
    description: "Slight near-vision blur from optic disc swelling.",
    start: 90,
    end: 400,
    effects: { vision_score: 1 },
  },
};

export interface CrewProfile {
  id: string;
  osdrId: string;
  name: string;
  role: string;
  callsign: string;
  priorDoseMsv: number;
  vitals: Record<string, number>;
  scenarios: string[];
}

export const CREW: CrewProfile[] = [
  {
    id: "vega",
    osdrId: "C001",
    name: "Amara Vega",
    role: "Commander",
    callsign: "CDR",
    priorDoseMsv: 92,
    vitals: { heart_rate: 58, hrv: 68, systolic_bp: 118, diastolic_bp: 76, mood: 4, stress: 2, pvt_ms: 245 },
    scenarios: ["sans"],
  },
  {
    id: "okafor",
    osdrId: "C002",
    name: "Tobi Okafor",
    role: "Pilot",
    callsign: "PLT",
    priorDoseMsv: 40,
    vitals: { heart_rate: 64, hrv: 52, systolic_bp: 112, diastolic_bp: 72, mood: 4, stress: 2, pvt_ms: 255 },
    scenarios: ["sleep_debt"],
  },
  {
    id: "lindqvist",
    osdrId: "C003",
    name: "Sofia Lindqvist",
    role: "Mission Specialist",
    callsign: "MS1",
    priorDoseMsv: 18,
    vitals: { heart_rate: 61, hrv: 58, systolic_bp: 116, diastolic_bp: 74, mood: 4, stress: 2, pvt_ms: 250 },
    scenarios: ["bone"],
  },
  {
    id: "tanaka",
    osdrId: "C004",
    name: "Kenji Tanaka",
    role: "Flight Engineer · Crew Medical Officer",
    callsign: "FE",
    priorDoseMsv: 65,
    vitals: { heart_rate: 66, hrv: 47, systolic_bp: 122, diastolic_bp: 79, mood: 4, stress: 2, pvt_ms: 262 },
    scenarios: ["fever"],
  },
];

const COMMON_BASELINE: Record<string, number> = {
  spo2: 98,
  body_temp: 36.7,
  resp_rate: 13,
  sleep_hours: 7.1,
  exercise_min: 120,
  body_mass_pct: 0,
  hydration: 3,
  vision_score: 0,
  cabin_co2: 2.3,
};

const LABS = data as unknown as { crew: CrewLabs[]; source: { study: string; panel: string; url: string }[]; mission: string };

export function osdrSource() {
  return { mission: LABS.mission, source: LABS.source };
}

export function crewLabs(osdrId: string): CrewLabs | undefined {
  return LABS.crew.find((c) => c.id === osdrId);
}

/** Personal baselines: lab values from the real Inspiration4 preflight draws, vitals from the profile. */
export function baselinesFor(p: CrewProfile): Record<string, number> {
  const labs = crewLabs(p.osdrId);
  const out: Record<string, number> = { ...COMMON_BASELINE, ...p.vitals };
  if (labs) {
    for (const [ind, analyte] of Object.entries(LAB_ANALYTE)) {
      const b = preflightBaseline(labs, analyte);
      if (b === undefined) continue;
      // CBC reports WBC in thousands per µL already; lymphocytes in cells/µL.
      out[ind] = b;
    }
    // Serum glucose from stored samples reads low; use it only if it is physiologically plausible fasting.
    if (out.glucose < 75 || out.glucose > 105) out.glucose = Math.min(105, Math.max(80, out.glucose));
  }
  return out;
}

/** Lab thresholds tightened to the astronaut's own lab reference range where that range is stricter. */
export function thresholdsFor(p: CrewProfile, indicatorId: string): Thresholds | undefined {
  const personal = personalBpThresholds(p.id, indicatorId);
  if (personal) return personal;
  const analyte = LAB_ANALYTE[indicatorId];
  const labs = crewLabs(p.osdrId);
  if (!analyte || !labs || indicatorId === "glucose") return undefined;
  const ref = referenceRange(labs, analyte);
  if (!ref) return undefined;
  const t = getIndicator(indicatorId).thresholds;
  const out: Thresholds = { low: t.low && { ...t.low }, high: t.high && { ...t.high } };
  if (out.low && ref.min !== undefined && ref.min > out.low.action) out.low.watch = ref.min;
  if (out.high && ref.max !== undefined && ref.max < out.high.action) out.high.watch = ref.max;
  return out;
}

export interface CrewState {
  profile: CrewProfile;
  env: MissionEnvironment;
  readings: Reading[];
  baselines: Record<string, number>;
  assessments: Assessment[];
  overall: Status;
  dose: { cumulative: number; last30: number; status: Status; timeline: ReturnType<typeof doseTimeline> };
}

export function crewState(
  p: CrewProfile,
  envId: EnvironmentId,
  opts: { currentDay?: number; extraReadings?: Reading[]; sepEvents?: SepEvent[]; scenarioOverride?: string[] } = {},
): CrewState {
  const env = ENV_MAP[envId];
  const currentDay = opts.currentDay ?? MISSION.currentDay;
  const baselines = baselinesFor(p);
  const scen = (opts.scenarioOverride ?? p.scenarios).map((s) => SCENARIOS[s]).filter(Boolean);
  let readings = simulate({ seed: p.id, baselines, env, currentDay, missionLength: MISSION.length, scenarios: scen });
  if (opts.extraReadings?.length) {
    const override = new Set(opts.extraReadings.map((r) => `${r.indicator}@${r.day}`));
    readings = [...readings.filter((r) => !override.has(`${r.indicator}@${r.day}`)), ...opts.extraReadings];
  }
  const assessments = INDICATORS.map((ind) =>
    assess(ind.id, readings, baselines[ind.id], {
      thresholds: thresholdsFor(p, ind.id),
      trendWindowDays: ind.cadence === "weekly" ? 42 : 14,
      rollingBaseline: ind.input !== "lab",
    }),
  );
  const timeline = doseTimeline(env, currentDay, p.priorDoseMsv, opts.sepEvents);
  const cumulative = timeline[timeline.length - 1]?.cumulative ?? p.priorDoseMsv;
  const last30 = windowDose(timeline, currentDay, 30);
  const radStatus = radiationStatus(cumulative, last30);
  return {
    profile: p,
    env,
    readings,
    baselines,
    assessments,
    overall: worst(...assessments.map((a) => a.status), radStatus),
    dose: { cumulative, last30, status: radStatus, timeline },
  };
}

export function getCrew(id: string): CrewProfile | undefined {
  return CREW.find((c) => c.id === id);
}
