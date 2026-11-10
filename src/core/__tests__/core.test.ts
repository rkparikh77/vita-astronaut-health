import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assess, slope, thresholdStatus } from "../assess";
import { CREW, crewState, SCENARIOS, thresholdsFor } from "../crew";
import { ENV_MAP } from "../environments";
import { escalate, isAutonomous } from "../escalation";
import { progress, streak } from "../gamification";
import { getIndicator, INDICATORS } from "../indicators";
import { mergeCrewLabs, parseLabCsv, parseTimepoint, preflightBaseline } from "../osdr";
import { tasksForDay, taskState, PROTOCOL } from "../protocol";
import { CAREER_LIMIT_MSV, doseTimeline, radiationStatus } from "../radiation";
import { simulate } from "../simulator";
import type { Reading } from "../types";

const r = (indicator: string, value: number, day: number): Reading => ({ indicator, value, day, source: "self" });

describe("osdr parser", () => {
  const csv = `﻿Sample Name,glucose_value_milligram_per_deciliter,glucose_range_min_milligram_per_deciliter,glucose_range_max_milligram_per_deciliter
C001_serum_L-3,80,65,99
C001_serum_L-44,90,65,99
C001_serum_R+1,100,65,99
C002_serum_L-92,70,65,99`;

  it("parses timepoint labels", () => {
    expect(parseTimepoint("L-92")).toEqual({ day: -92, phase: "preflight" });
    expect(parseTimepoint("R+45")).toEqual({ day: 45, phase: "postflight" });
    expect(() => parseTimepoint("X1")).toThrow();
  });

  it("groups by crew and analyte, sorts preflight first", () => {
    const crew = mergeCrewLabs(parseLabCsv(csv));
    expect(crew.map((c) => c.id)).toEqual(["C001", "C002"]);
    expect(crew[0].timepoints.map((t) => t.label)).toEqual(["L-44", "L-3", "R+1"]);
    expect(crew[0].timepoints[0].labs.glucose).toEqual({ value: 90, min: 65, max: 99, unit: "milligram_per_deciliter" });
  });

  it("uses the preflight median as baseline", () => {
    const crew = mergeCrewLabs(parseLabCsv(csv));
    expect(preflightBaseline(crew[0], "glucose")).toBe(85);
  });

  it("real OSDR export has 4 crew × 7 timepoints with key analytes", () => {
    const data = JSON.parse(readFileSync("src/data/inspiration4.json", "utf8"));
    expect(data.crew).toHaveLength(4);
    for (const c of data.crew) {
      expect(c.timepoints).toHaveLength(7);
      for (const a of ["glucose", "calcium", "hemoglobin", "white_blood_cell_count", "absolute_lymphocytes"]) {
        expect(c.timepoints[0].labs[a]?.value).toBeTypeOf("number");
      }
    }
  });
});

describe("thresholds", () => {
  it("classifies glucose correctly at every band", () => {
    const t = getIndicator("glucose").thresholds;
    expect(thresholdStatus(t, 95)).toBe("nominal");
    expect(thresholdStatus(t, 72)).toBe("nominal");
    expect(thresholdStatus(t, 65)).toBe("watch");
    expect(thresholdStatus(t, 58)).toBe("action");
    expect(thresholdStatus(t, 50)).toBe("critical");
    expect(thresholdStatus(t, 220)).toBe("action");
    expect(thresholdStatus(t, 320)).toBe("critical");
  });

  it("every indicator has ordered thresholds and guidance for each level", () => {
    for (const ind of INDICATORS) {
      const { low, high } = ind.thresholds;
      if (low) {
        expect(low.watch).toBeGreaterThan(low.action);
        if (low.critical !== undefined) expect(low.action).toBeGreaterThan(low.critical);
      }
      if (high) {
        expect(high.watch).toBeLessThan(high.action);
        if (high.critical !== undefined) expect(high.action).toBeLessThan(high.critical);
      }
      expect(ind.actions.watch.length && ind.actions.action.length && ind.actions.critical.length).toBeTruthy();
      expect(ind.howTo.length).toBeGreaterThan(20);
    }
  });
});

describe("assess", () => {
  it("returns unknown without readings", () => {
    expect(assess("heart_rate", []).status).toBe("unknown");
  });

  it("flags deviation from personal baseline even inside normal range", () => {
    const a = assess("heart_rate", [r("heart_rate", 80, 1)], 58);
    expect(a.status).toBe("watch");
    expect(a.z).toBeCloseTo(4.4, 1);
  });

  it("projects a trend toward the action threshold", () => {
    const rs = [9.6, 9.8, 10.0, 10.2, 10.4].map((v, i) => r("calcium", v, i * 2 + 1));
    const a = assess("calcium", rs, undefined);
    // 10.4 is above the 10.2 watch line already; trend should give daysToAction
    expect(a.trendPerDay).toBeCloseTo(0.1, 2);
    expect(a.daysToAction).toBe(4);
  });

  it("ignores small noisy drifts", () => {
    const rs = [70, 71, 70, 71, 72].map((v, i) => r("heart_rate", v, i + 1));
    expect(assess("heart_rate", rs, 70).daysToAction).toBeUndefined();
  });

  it("rolling baseline absorbs normal in-flight adaptation", () => {
    // Temperature settled ~0.8 °C higher in flight; today's value matches that new normal.
    const rs = Array.from({ length: 40 }, (_, i) => r("body_temp", 37.5, i + 1));
    expect(assess("body_temp", rs, 36.7).status).toBe("watch");
    expect(assess("body_temp", rs, 36.7, { rollingBaseline: true }).status).toBe("nominal");
  });

  it("slope of flat data is zero", () => {
    expect(slope([{ day: 1, value: 3 }, { day: 2, value: 3 }])).toBe(0);
  });
});

describe("escalation", () => {
  it("Mars is autonomous, ISS is not", () => {
    expect(isAutonomous(ENV_MAP.mars_transit)).toBe(true);
    expect(isAutonomous(ENV_MAP.iss)).toBe(false);
  });

  it("critical glucose on Mars goes to the crew medical officer with delay warning", () => {
    const e = escalate([assess("glucose", [r("glucose", 45, 1)])], ENV_MAP.mars_transit);
    expect(e.level).toBe("critical");
    expect(e.responder).toBe("crew_medical_officer");
    expect(e.steps.join(" ")).toMatch(/Earth is 3 min/);
  });

  it("critical on ISS calls the flight surgeon", () => {
    const e = escalate([assess("glucose", [r("glucose", 45, 1)])], ENV_MAP.iss);
    expect(e.responder).toBe("flight_surgeon");
  });

  it("routes to the backup when the patient is the crew medical officer", () => {
    const e = escalate([assess("body_temp", [r("body_temp", 39, 1)])], ENV_MAP.mars_transit, { patientIsCmo: true });
    expect(e.steps.join(" ")).toMatch(/Backup medical officer \(Commander\) today/);
    expect(e.steps.join(" ")).not.toMatch(/Crew medical officer today/);
  });

  it("nominal produces self-care", () => {
    const e = escalate([assess("glucose", [r("glucose", 92, 1)])], ENV_MAP.iss);
    expect(e.level).toBe("nominal");
  });
});

describe("radiation", () => {
  it("accumulates dose and adds SEP events scaled by environment", () => {
    const tl = doseTimeline(ENV_MAP.mars_transit, 10, 0, [{ day: 5, severity: "major" }]);
    expect(tl[9].cumulative).toBeCloseTo(10 * 1.84 + 120, 5);
    const iss = doseTimeline(ENV_MAP.iss, 10, 0, [{ day: 5, severity: "major" }]);
    expect(iss[9].cumulative).toBeCloseTo(10 * 0.5 + 12, 5);
  });

  it("status rises toward career limit", () => {
    expect(radiationStatus(100, 10)).toBe("nominal");
    expect(radiationStatus(CAREER_LIMIT_MSV * 0.85, 10)).toBe("action");
    expect(radiationStatus(CAREER_LIMIT_MSV, 10)).toBe("critical");
  });
});

describe("simulator", () => {
  const base = { seed: "x", baselines: { heart_rate: 60, sleep_hours: 7, pvt_ms: 250, calcium: 9.5 }, env: ENV_MAP.iss, currentDay: 30, missionLength: 180 };

  it("is deterministic for a seed", () => {
    expect(simulate(base)).toEqual(simulate(base));
    expect(simulate(base)).not.toEqual(simulate({ ...base, seed: "y" }));
  });

  it("generates weekly labs only every 7th day plus today", () => {
    const days = simulate(base).filter((x) => x.indicator === "calcium").map((x) => x.day);
    expect(days).toEqual([7, 14, 21, 28, 30]);
  });

  it("sleep debt scenario slows reaction time", () => {
    const debt = simulate({ ...base, scenarios: [SCENARIOS.sleep_debt] });
    const pvt = (rs: Reading[]) => rs.find((x) => x.indicator === "pvt_ms" && x.day === 30)!.value;
    expect(pvt(debt)).toBeGreaterThan(pvt(simulate(base)) + 30);
  });
});

describe("crew state (end-to-end on real baselines)", () => {
  const states = Object.fromEntries(CREW.map((c) => [c.id, crewState(c, "iss")]));

  it("each scripted scenario surfaces the right indicator", () => {
    const status = (crew: string, ind: string) => states[crew].assessments.find((a) => a.indicator === ind)!.status;
    expect(status("tanaka", "body_temp")).toMatch(/action|critical/);
    expect(status("okafor", "sleep_hours")).not.toBe("nominal");
    expect(status("lindqvist", "calcium")).not.toBe("nominal");
    expect(status("vega", "vision_score")).toBe("watch");
  });

  it("personalizes hemoglobin threshold from the lab's reference range", () => {
    const t = thresholdsFor(CREW[1], "hemoglobin");
    expect(t?.low?.watch).toBe(11.7);
  });

  it("user readings override simulated ones for the same day", () => {
    const s = crewState(CREW[0], "iss", { extraReadings: [r("glucose", 50, 112)] });
    expect(s.assessments.find((a) => a.indicator === "glucose")!.status).toBe("critical");
    expect(s.readings.filter((x) => x.indicator === "glucose" && x.day === 112)).toHaveLength(1);
  });
});

describe("protocol & gamification", () => {
  it("weekly tasks appear on day 7 only", () => {
    expect(tasksForDay(6).some((t) => t.cadence === "weekly")).toBe(false);
    expect(tasksForDay(7).some((t) => t.cadence === "weekly")).toBe(true);
  });

  it("task state follows time windows", () => {
    const t = PROTOCOL[0];
    expect(taskState(t, new Set(), 5)).toBe("upcoming");
    expect(taskState(t, new Set(), 8)).toBe("due");
    expect(taskState(t, new Set(), 12)).toBe("overdue");
    expect(taskState(t, new Set([t.id]), 12)).toBe("done");
  });

  it("streak counts consecutive full days", () => {
    const all = (d: number) => tasksForDay(d).map((t) => t.id);
    const log = { 1: all(1), 2: all(2), 3: all(3), 4: ["sleep_log"] };
    expect(streak(log, 4)).toBe(3);
    expect(streak(log, 3)).toBe(3);
    const p = progress(log, 4);
    expect(p.badges.find((b) => b.id === "full_day")!.earned).toBe(true);
    expect(p.xp).toBeGreaterThan(0);
  });
});
