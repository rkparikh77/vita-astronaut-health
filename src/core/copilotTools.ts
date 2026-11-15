import { checkDose, DRUG, MEDICAL, PHARMACY, shelfStatus } from "./medical";
// Tools the VITA Copilot (Claude) can call. Pure functions over the same engine the UI uses,
// so every number the assistant quotes is one the dashboard also shows.
import { z } from "zod";
import panels from "../data/inspiration4-panels.json";
import { FINDINGS, PRESETS, projectionSummary, type Phase } from "./atlas";
import { CREW, crewLabs, crewState, getCrew, LAB_ANALYTE, MISSION, thresholdsFor } from "./crew";
import { ENV_MAP, ENVIRONMENTS, delayRange, type EnvironmentId } from "./environments";
import { escalate } from "./escalation";
import { INDICATORS, getIndicator } from "./indicators";
import { tasksForDay } from "./protocol";
import { CAREER_LIMIT_MSV, type SepEvent } from "./radiation";
import { summarize, type PanelMatrix } from "./research";
import { countermeasures, odometer, readiness, sleep } from "./scores";
import { blackoutWindows, earthAt, fmtDuration, legAt, lightSeconds, linkAt, marsAt, MISSION_PLAN, missionDate } from "./deepSpace";
import { SCENARIOS, leakTau, co2RiseMmHgPerSec, arrestSurvival } from "./emergencies";
import type { Reading } from "./types";

/** What the browser knows that the server doesn't: location, the astronaut's own entries, drills. */
export interface CopilotContext {
  env: EnvironmentId;
  page?: string;
  focusCrewId?: string;
  entries?: Record<string, Reading[]>;
  sepEvents?: SepEvent[];
  log?: Record<string, Record<number, string[]>>;
}

export const ContextSchema = z.object({
  env: z.enum(ENVIRONMENTS.map((e) => e.id) as [EnvironmentId, ...EnvironmentId[]]),
  page: z.string().max(200).optional(),
  focusCrewId: z.string().max(40).optional(),
  entries: z
    .record(
      z.string(),
      z.array(z.object({ indicator: z.string(), value: z.number(), day: z.number(), source: z.enum(["sensor", "self", "lab", "sim"]) })).max(500),
    )
    .optional(),
  sepEvents: z.array(z.object({ day: z.number(), severity: z.enum(["minor", "moderate", "major"]), shelterFactor: z.number().optional() })).max(50).optional(),
  log: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
});

const r1 = (x: number, d = 1) => Number(x.toFixed(d));
const STUDY = summarize(panels as unknown as PanelMatrix);

function stateFor(id: string, ctx: CopilotContext) {
  const p = getCrew(id);
  if (!p) throw new Error(`Unknown crew id "${id}". Valid ids: ${CREW.map((c) => c.id).join(", ")}`);
  return crewState(p, ctx.env, { extraReadings: ctx.entries?.[id], sepEvents: ctx.sepEvents });
}

function scoresFor(id: string, ctx: CopilotContext) {
  const s = stateFor(id, ctx);
  const day = MISSION.currentDay;
  const done = (ctx.log?.[id]?.[day] ?? []).length;
  const ex = s.readings.filter((r) => r.indicator === "exercise_min" && r.day > day - 30).map((r) => r.value);
  const adherence = ex.length ? Math.min(1, ex.reduce((a, b) => a + b, 0) / ex.length / 120) : 0.8;
  return {
    s,
    readiness: readiness(s.readings, day),
    sleep: sleep(s.readings, day),
    countermeasures: countermeasures(s.readings, day, done, tasksForDay(day).length),
    odometer: odometer(s.env, day, s.dose.cumulative - s.profile.priorDoseMsv, adherence),
  };
}

// --- Tool definitions (JSON Schema for the API, Zod for validation before running) ---

const crewId = z.enum(CREW.map((c) => c.id) as [string, ...string[]]);

export const TOOL_SCHEMAS = {
  get_crew_overview: z.object({}),
  get_crew_member: z.object({ crew_id: crewId }),
  check_medication: z.object({ crew_id: crewId, drug: z.enum(PHARMACY.map((d) => d.id) as [string, ...string[]]) }),
  get_indicator_history: z.object({ crew_id: crewId, indicator: z.string(), days: z.number().int().min(1).max(112).optional() }),
  get_indicator_reference: z.object({ indicator: z.string() }),
  get_research_stats: z.object({ query: z.string().optional(), timepoint: z.enum(["R+1", "R+45", "R+82", "R+194"]).optional(), limit: z.number().int().min(1).max(30).optional() }),
  get_findings: z.object({ system: z.string().optional() }),
  project_mission: z.object({ preset: z.enum(PRESETS.map((p) => p.id) as [string, ...string[]]).optional(), env: z.string().optional(), days: z.number().int().min(1).max(2000).optional(), exercise_adherence: z.number().min(0).max(1).optional() }),
  get_space_weather: z.object({}),
  get_environment: z.object({ env: z.string().optional() }),
  get_deep_space_link: z.object({ mission_day: z.number().int().min(1).max(1100).optional() }),
  get_emergency_science: z.object({ scenario: z.enum(["sep", "depress", "co2", "fire", "cardiac"]).optional() }),
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

export const TOOL_DEFS: { name: ToolName; description: string; input_schema: Record<string, unknown> }[] = [
  {
    name: "get_crew_overview",
    description: "Current status of all four crew at the selected mission location: overall status, readiness/sleep/countermeasure scores, flagged indicators, radiation dose. Call this first for crew-wide questions.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_crew_member",
    description: "Full health picture for one astronaut: every indicator's latest value, status, personal baseline, deviation and trend reasons; the escalation (who should respond and the steps); daily score contributors; body-odometer estimates; real Inspiration4 preflight lab baselines.",
    input_schema: { type: "object", properties: { crew_id: { type: "string", enum: CREW.map((c) => c.id), description: "vega (Commander), okafor (Pilot), lindqvist (Mission Specialist), tanaka (Flight Engineer / crew medical officer)" } }, required: ["crew_id"] },
  },
  {
    name: "get_indicator_history",
    description: "Daily time series of one indicator for one astronaut (simulated in-flight values; weekly for labs), with min/max/mean and trend. Use for 'how has X changed' questions.",
    input_schema: {
      type: "object",
      properties: {
        crew_id: { type: "string", enum: CREW.map((c) => c.id) },
        indicator: { type: "string", enum: INDICATORS.map((i) => i.id) },
        days: { type: "integer", minimum: 1, maximum: 112, description: "How many recent days (default 30)" },
      },
      required: ["crew_id", "indicator"],
    },
  },
  {
    name: "get_indicator_reference",
    description: "How an indicator is measured, why it matters in space, its watch/action/critical limits, recommended actions at each level, and the source standard or paper.",
    input_schema: { type: "object", properties: { indicator: { type: "string", enum: INDICATORS.map((i) => i.id) } }, required: ["indicator"] },
  },
  {
    name: "get_research_stats",
    description: "Statistics computed from REAL NASA OSDR Inspiration4 blood data (118 analytes: CBC, metabolic panel, 71 cytokines, 9 cardiovascular proteins; 4 crew; 7 timepoints). Returns log2 fold change vs each crew member's preflight median, paired t-test p, Benjamini-Hochberg q, crew concordance, recovery by R+82, plus whole-panel batch QC. Search by analyte name, or omit query for the top movers.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Analyte name fragment, e.g. 'IL-6', 'CRP', 'hemoglobin'. Omit for top movers." },
        timepoint: { type: "string", enum: ["R+1", "R+45", "R+82", "R+194"], description: "Default R+1 (day after landing)" },
        limit: { type: "integer", minimum: 1, maximum: 30 },
      },
    },
  },
  {
    name: "get_findings",
    description: "Peer-reviewed findings about what spaceflight does to the body (fluid shift, jugular stasis, heart shape, space anemia, sleep, muscle, bone, spine, SANS, Inspiration4, Twins Study, CO2), each with citation and URL.",
    input_schema: { type: "object", properties: { system: { type: "string", description: "Optional filter: cardio, immune, neuro, musculoskeletal, vision, respiratory, genome" } } },
  },
  {
    name: "project_mission",
    description: "Project radiation dose (vs NASA 600 mSv career limit), bone loss and calf-muscle loss for a mission, using published rates. Use a preset (iss6, kelly, artemis, mars) or a single env + days.",
    input_schema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: PRESETS.map((p) => p.id) },
        env: { type: "string", enum: ENVIRONMENTS.map((e) => e.id) },
        days: { type: "integer", minimum: 1, maximum: 2000 },
        exercise_adherence: { type: "number", minimum: 0, maximum: 1, description: "0–1 share of the ~2 h/day exercise program (default 0.8)" },
      },
    },
  },
  {
    name: "check_medication",
    description: "Safety check before giving a medicine from the onboard pharmacy to a crew member: allergies, interactions with their current medicines, condition cautions (e.g. hypertension), expiry and stock, plus safer alternatives when blocked. Demo rule set, not clinical.",
    input_schema: {
      type: "object",
      properties: { crew_id: { type: "string", enum: ["vega", "okafor", "lindqvist", "tanaka"] }, drug: { type: "string", enum: PHARMACY.map((d) => d.id) } },
      required: ["crew_id", "drug"],
    },
  },
  {
    name: "get_space_weather",
    description: "Live space weather: solar particle events and M/X-class flares from NASA DONKI (last 30 days), plus hourly L1 solar wind (speed, density, dynamic pressure, Bz) from NASA's Wind spacecraft via SPDF CDAWeb with a storm-driver level and shock detection. Each feed reports clearly if unreachable.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_environment",
    description: "Facts about a mission location: gravity, radiation dose rate and source, one-way comms delay to Earth, evacuation time, solar-storm exposure. Defaults to the current location.",
    input_schema: { type: "object", properties: { env: { type: "string", enum: ENVIRONMENTS.map((e) => e.id) } } },
  },
  {
    name: "get_deep_space_link",
    description: "Earth–vehicle communications for the Mars mission from REAL JPL Horizons ephemeris: one-way light time, distance, solar elongation and link state (nominal / degraded / blackout) on a mission day; today's real Earth–Mars light time; the mission plan; and solar-conjunction blackout windows.",
    input_schema: { type: "object", properties: { mission_day: { type: "integer", minimum: 1, maximum: 1100, description: "Mission day (1 = launch, 2026-11-20). Default: current mission day." } } },
  },
  {
    name: "get_emergency_science",
    description: "The physics and physiology behind the 3D emergency playground (solar storm, hull breach, CO2 scrubber failure, fire/carbon monoxide, cardiac arrest): models, key numbers and the recommended response for each.",
    input_schema: { type: "object", properties: { scenario: { type: "string", enum: ["sep", "depress", "co2", "fire", "cardiac"] } } },
  },
];

// --- Implementations ---

export async function runTool(name: string, rawInput: unknown, ctx: CopilotContext, deps: { spaceWeather?: () => Promise<unknown> } = {}): Promise<unknown> {
  if (!(name in TOOL_SCHEMAS)) throw new Error(`Unknown tool ${name}`);
  const parsed = TOOL_SCHEMAS[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) throw new Error(`Invalid input for ${name}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  const input = parsed.data as Record<string, unknown>;

  switch (name as ToolName) {
    case "get_crew_overview": {
      const env = ENV_MAP[ctx.env];
      return {
        mission: { ...MISSION, location: env.name, commsDelayOneWay: delayRange(env), dataNote: "Daily vitals are simulated on real Inspiration4 lab baselines; crew names are fictional." },
        crew: CREW.map((c) => {
          const { s, readiness: rd, sleep: sl, countermeasures: cm } = scoresFor(c.id, ctx);
          const esc = escalate(s.assessments, s.env, { patientIsCmo: /medical officer/i.test(c.role) });
          return {
            id: c.id,
            name: c.name,
            role: c.role,
            overall: s.overall,
            scores: { readiness: rd.value, sleep: sl.value, countermeasures: cm.value },
            escalation: { level: esc.level, responder: esc.responder, headline: esc.headline },
            flagged: s.assessments
              .filter((a) => a.status !== "nominal" && a.status !== "unknown")
              .map((a) => ({ indicator: a.indicator, name: getIndicator(a.indicator).name, value: a.latest?.value, unit: getIndicator(a.indicator).unit, status: a.status, why: a.reasons[0] })),
            radiation: { cumulativeMsv: r1(s.dose.cumulative), last30Msv: r1(s.dose.last30), pctCareerLimit: r1((s.dose.cumulative / CAREER_LIMIT_MSV) * 100), status: s.dose.status },
          };
        }),
      };
    }

    case "get_crew_member": {
      const id = input.crew_id as string;
      const { s, readiness: rd, sleep: sl, countermeasures: cm, odometer: od } = scoresFor(id, ctx);
      const esc = escalate(s.assessments, s.env, { patientIsCmo: /medical officer/i.test(s.profile.role) });
      const labs = crewLabs(s.profile.osdrId);
      return {
        profile: { id, name: s.profile.name, role: s.profile.role, inspiration4Profile: s.profile.osdrId, priorCareerDoseMsv: s.profile.priorDoseMsv },
        // Personal factors. Wellbeing check-ins are deliberately NOT included: they are private to the astronaut.
        medicalProfile: MEDICAL[id],
        location: s.env.name,
        missionDay: MISSION.currentDay,
        overall: s.overall,
        escalation: esc,
        scores: {
          readiness: { value: rd.value, band: rd.band, contributors: rd.contributors.map((c) => `${c.label}: ${Math.round(c.score)} (${c.detail})`) },
          sleep: { value: sl.value, band: sl.band, contributors: sl.contributors.map((c) => `${c.label}: ${Math.round(c.score)} (${c.detail})`) },
          countermeasures: { value: cm.value, band: cm.band, contributors: cm.contributors.map((c) => `${c.label}: ${Math.round(c.score)} (${c.detail})`) },
        },
        indicators: s.assessments.map((a) => {
          const ind = getIndicator(a.indicator);
          return {
            id: a.indicator,
            name: ind.name,
            value: a.latest?.value,
            unit: ind.unit,
            day: a.latest?.day,
            source: a.latest?.source === "self" ? "astronaut-logged" : ind.input === "lab" ? "lab (simulated draw on real baseline)" : "simulated sensor",
            status: a.status,
            baseline: a.baseline === undefined ? undefined : r1(a.baseline, ind.decimals + 1),
            sdFromBaseline: a.z === undefined ? undefined : r1(a.z),
            trendPerDay: a.trendPerDay ? r1(a.trendPerDay, 3) : 0,
            daysToActionLimit: a.daysToAction,
            reasons: a.reasons,
          };
        }),
        radiation: { cumulativeMsv: r1(s.dose.cumulative), last30Msv: r1(s.dose.last30), status: s.dose.status, careerLimitMsv: CAREER_LIMIT_MSV },
        bodyOdometer: od.map((o) => ({ label: o.label, value: r1(o.value, o.decimals), unit: o.unit, kind: o.kind, source: o.source })),
        realPreflightLabs: labs
          ? Object.fromEntries(
              Object.entries(LAB_ANALYTE).map(([ind, analyte]) => {
                const pre = labs.timepoints.filter((t) => t.phase === "preflight").map((t) => t.labs[analyte]?.value);
                const t = thresholdsFor(s.profile, ind);
                return [ind, { preflightDraws: pre, personalizedWatchLimits: t ? { low: t.low?.watch, high: t.high?.watch } : undefined, source: "NASA OSDR OSD-569/OSD-575 (real)" }];
              }),
            )
          : undefined,
      };
    }

    case "get_indicator_history": {
      const id = input.crew_id as string;
      const indicator = input.indicator as string;
      const ind = getIndicator(indicator);
      const s = stateFor(id, ctx);
      const days = (input.days as number | undefined) ?? 30;
      const series = s.readings.filter((r) => r.indicator === indicator && r.day > MISSION.currentDay - days).sort((a, b) => a.day - b.day);
      const vals = series.map((r) => r.value);
      const a = s.assessments.find((x) => x.indicator === indicator)!;
      return {
        crew: s.profile.name,
        indicator: ind.name,
        unit: ind.unit,
        provenance: ind.input === "lab" ? "weekly lab draws, simulated on the real Inspiration4 baseline" : "simulated daily readings (astronaut-logged values marked)",
        points: series.map((r) => ({ day: r.day, value: r.value, ...(r.source === "self" ? { logged: true } : {}) })),
        stats: vals.length ? { n: vals.length, min: Math.min(...vals), max: Math.max(...vals), mean: r1(vals.reduce((x, y) => x + y, 0) / vals.length, ind.decimals + 1) } : null,
        latestStatus: a.status,
        trendPerDay: r1(a.trendPerDay, 3),
        reasons: a.reasons,
      };
    }

    case "get_indicator_reference": {
      const ind = getIndicator(input.indicator as string);
      return { ...ind, personalSd: undefined, range: undefined };
    }

    case "get_research_stats": {
      const tpIdx = ["R+1", "R+45", "R+82", "R+194"].indexOf((input.timepoint as string) ?? "R+1");
      const q = ((input.query as string) ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const limit = (input.limit as number | undefined) ?? 10;
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9α-ω]/g, "");
      const pool = q ? STUDY.stats.filter((s) => norm(s.label).includes(q) || norm(s.id).includes(q)) : [...STUDY.stats].sort((a, b) => a.post[tpIdx].p - b.post[tpIdx].p);
      return {
        dataset: "NASA OSDR OSD-569 + OSD-575, SpaceX Inspiration4 (real measurements)",
        method: "log2(post / crew's own preflight median); one-sample t-test across 4 crew (df=3); BH-FDR across 118 analytes",
        caveat: "n = 4: ~6 of 118 analytes are expected at p<0.05 by chance; none pass q<0.1.",
        summary: { analytes: STUDY.stats.length, changedAtR1Over1_41x: STUDY.changedAtR1, recoveredByR82: STUDY.recoveredBy82, pBelow05AtR1: STUDY.significantR1 },
        batchQc: STUDY.shifts.filter((x) => Math.abs(x.medianShift) >= 0.2).map((x) => ({ panel: x.panel, timepoint: x.tp, medianLog2Shift: r1(x.medianShift, 2) })),
        results: pool.slice(0, limit).map((s) => ({
          analyte: s.label,
          panel: s.panel,
          unit: s.unit,
          byTimepoint: s.post.map((p) => ({ tp: p.tp, foldChange: r1(2 ** p.mean, 2), log2: r1(p.mean, 2), p: Number(p.p.toPrecision(2)), q: Number((p.q ?? 1).toPrecision(2)), sameDirection: `${p.concordant}/${p.n}`, perCrewLog2: p.perCrew.map((v) => (v === null ? null : r1(v, 2))) })),
          residualAtR82: s.residual82 === undefined ? undefined : r1(s.residual82, 2),
          preflightCv: r1(s.preflightCv, 2),
        })),
        noMatch: q && pool.length === 0 ? `No analyte matches "${input.query}".` : undefined,
      };
    }

    case "get_findings": {
      const sys = (input.system as string | undefined)?.toLowerCase();
      return FINDINGS.filter((f) => !sys || f.system === sys).map((f) => ({ stat: f.stat, headline: f.headline, detail: f.detail, onset: f.onset, recovery: f.recovery, citation: f.citation, url: f.url }));
    }

    case "project_mission": {
      const adherence = (input.exercise_adherence as number | undefined) ?? 0.8;
      let phases: Phase[];
      let label: string;
      if (input.preset) {
        const p = PRESETS.find((x) => x.id === input.preset)!;
        phases = p.phases;
        label = p.label;
      } else {
        const env = (input.env as EnvironmentId | undefined) ?? ctx.env;
        if (!ENV_MAP[env]) throw new Error(`Unknown env ${env}`);
        phases = [{ env, days: (input.days as number | undefined) ?? 180 }];
        label = `${ENV_MAP[env].name} · ${phases[0].days} days`;
      }
      const sum = projectionSummary(phases, adherence);
      return {
        mission: label,
        phases: phases.map((p) => ({ location: ENV_MAP[p.env].name, days: p.days, doseRateMsvPerDay: ENV_MAP[p.env].doseRate })),
        exerciseAdherence: adherence,
        projected: { days: sum.days, doseMsv: r1(sum.dose), pctOfCareerLimit: r1(sum.dosePctOfLimit), exceedsCareerLimit: sum.exceedsLimit, chestXrayEquivalents: Math.round(sum.xrays), boneLossPct: r1(sum.bone), calfMuscleLossPct: r1(sum.calf) },
        model: "Population averages from published rates (MSL RAD, ISS dosimetry, Trappe 2009, NASA HRP bone evidence); excludes solar storms.",
      };
    }

    case "check_medication": {
      const id = input.crew_id as string;
      const drug = DRUG[input.drug as string];
      return {
        drug: { name: drug.name, dose: drug.dose, use: drug.use, expires: drug.expires, shelf: shelfStatus(drug, MISSION.currentDay).status },
        checks: checkDose(id, drug.id, MISSION.currentDay, []),
        note: "Checked against the crew member's allergies, conditions and current medicines. Doses logged on this device are not visible to the server.",
      };
    }
    case "get_space_weather":
      return deps.spaceWeather ? await deps.spaceWeather() : { live: false, error: "space weather not available in this context" };

    case "get_deep_space_link": {
      const day = (input.mission_day as number | undefined) ?? MISSION.currentDay;
      const date = missionDate(day);
      const l = linkAt(date);
      const now = new Date();
      return {
        source: "NASA/JPL Horizons ephemeris (real planet positions); vehicle on an approximate transfer arc",
        missionDay: day,
        date: date.toISOString().slice(0, 10),
        phase: legAt(date)?.label,
        oneWayLightTime: fmtDuration(l.oneWaySec),
        roundTrip: fmtDuration(2 * l.oneWaySec),
        distanceAu: r1(l.distanceAu, 3),
        solarElongationDeg: r1(l.elongationDeg),
        linkState: l.state,
        todayRealEarthMarsOneWay: fmtDuration(lightSeconds(earthAt(now), marsAt(now))),
        missionPlan: MISSION_PLAN.map((m) => ({ leg: m.label, start: m.start.toISOString().slice(0, 10), end: m.end.toISOString().slice(0, 10) })),
        blackouts: blackoutWindows().map((w) => ({ start: w.start.toISOString().slice(0, 10), end: w.end.toISOString().slice(0, 10), days: Math.round((w.end.getTime() - w.start.getTime()) / 86400000), minElongationDeg: r1(w.minElongation, 2) })),
      };
    }

    case "get_emergency_science": {
      const which = input.scenario as string | undefined;
      const extra: Record<string, unknown> = {
        depress: { pressureTimeConstantMin_2cmHole: r1(leakTau(185, Math.PI * 0.01 ** 2) / 60), pressureTimeConstantMin_4cmHole: r1(leakTau(185, Math.PI * 0.02 ** 2) / 60), response: "Masks (100% O2) first, move crew to the safe module, close the hatch only when everyone is through, then patch with two masked crew." },
        co2: { riseMmHgPerHour_4crew_185m3: r1(co2RiseMmHgPerSec(4, 185) * 3600, 2), response: "Slow emergency: install LiOH backup, stand down from exercise, keep fans moving air across faces." },
        cardiac: { survivalIfShockedAt3min_withCprAt1min: r1(arrestSurvival(1, 3, 3) * 100), survivalIfShockedAt8min_noCpr: r1(arrestSurvival(8, 8, 8) * 100), model: "Larsen 1993: 67% − 2.3%/min to CPR − 1.1%/min to defibrillation − 2.1%/min to ALS", response: "Immediate CPR (Evetts–Russomano or reverse bear-hug in microgravity), AED as fast as possible; the ground cannot help in time." },
        fire: { response: "Masks on, ventilation off, CO2 extinguisher, check CO with the analyzer: pulse oximeters read carboxyhemoglobin as oxygenated." },
        sep: { response: "Shelter early behind water/polyethylene; peak flux can arrive within an hour of a flare; the storm shelter cuts dose ~85%." },
      };
      return SCENARIOS.filter((x) => !which || x.id === which).map((x) => ({ id: x.id, title: x.title, brief: x.brief, science: x.science, ...(extra[x.id] as object) }));
    }

    case "get_environment": {
      const e = ENV_MAP[((input.env as EnvironmentId | undefined) ?? ctx.env) as EnvironmentId];
      if (!e) throw new Error("Unknown environment");
      return { ...e, commsDelayOneWay: delayRange(e), current: e.id === ctx.env };
    }
  }
}

export const TOOL_LABELS: Record<ToolName, string> = {
  get_crew_overview: "Checked crew status",
  get_crew_member: "Read astronaut record",
  check_medication: "Check a medication",
  get_indicator_history: "Pulled indicator history",
  get_indicator_reference: "Looked up indicator guidance",
  get_research_stats: "Queried Inspiration4 blood data",
  get_findings: "Searched spaceflight research",
  project_mission: "Ran mission projection",
  get_space_weather: "Checked NASA DONKI",
  get_environment: "Read location profile",
  get_deep_space_link: "Computed deep-space link (JPL)",
  get_emergency_science: "Looked up emergency physiology",
};
