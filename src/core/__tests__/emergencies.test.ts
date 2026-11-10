import { describe, expect, it } from "vitest";
import {
  act,
  arrestSurvival,
  co2RiseMmHgPerSec,
  createSim,
  crewPosition,
  leakTau,
  pio2,
  saturationFromPiO2,
  step,
  ZONES,
  type ScenarioId,
  type SimState,
} from "../emergencies";

function run(scenario: ScenarioId, plan: [number, string][], maxSec = 4 * 3600, dt = 5): SimState {
  let s = createSim(scenario, 600);
  const todo = [...plan].sort((a, b) => a[0] - b[0]);
  while (!s.ended && s.t < maxSec) {
    while (todo.length && s.t >= todo[0][0]) s = act(s, todo.shift()![1]);
    s = step(s, dt);
  }
  return s;
}

describe("physiology & physics", () => {
  it("sea-level air gives ~98% saturation; 100% O2 at 30 kPa still protects", () => {
    expect(saturationFromPiO2(pio2(101.3, 0.21))).toBeCloseTo(98, 0);
    expect(saturationFromPiO2(pio2(30, 1))).toBeGreaterThan(98);
    expect(saturationFromPiO2(pio2(40, 0.21))).toBeLessThan(70); // ~23,000 ft equivalent
  });

  it("hole size sets the pressure time constant: 2 cm ≈ 80 min, 4 cm ≈ 20 min in 185 m³", () => {
    expect(leakTau(185, Math.PI * 0.01 ** 2) / 60).toBeCloseTo(82.1, 0);
    expect(leakTau(185, Math.PI * 0.02 ** 2) / 60).toBeCloseTo(20.5, 0);
  });

  it("four crew raise CO2 by ~0.38 mmHg/h (~9 mmHg/day) in 185 m³ with no scrubbing", () => {
    const perHour = co2RiseMmHgPerSec(4, 185) * 3600;
    expect(perHour).toBeCloseTo(0.377, 2);
    expect(perHour * 24).toBeGreaterThan(8);
  });

  it("Larsen survival: 67% immediately, ~5.5%/min untreated, slower with early CPR", () => {
    expect(arrestSurvival(0, 0, 0)).toBeCloseTo(0.67);
    expect(arrestSurvival(1, 1, 1)).toBeCloseTo(0.615);
    expect(arrestSurvival(1, 6, 6)).toBeGreaterThan(arrestSurvival(6, 6, 6));
  });

  it("crew glide between zones over time", () => {
    let s = createSim("sep");
    s = act(s, "shelter");
    const v = s.crew.find((c) => c.id === "vega")!;
    const start = crewPosition(v, 0);
    const mid = crewPosition(v, (v.moveEnd - v.moveStart) / 2);
    expect(start[0]).toBe(ZONES.exercise.x);
    expect(mid[0]).toBeGreaterThan(ZONES.exercise.x);
    expect(crewPosition(v, v.moveEnd)[0]).toBe(ZONES.shelter.x);
  });
});

describe("scenarios reward good decisions", () => {
  it("solar storm: early shelter cuts dose versus finishing tasks first", () => {
    const good = run("sep", [[60, "shelter"]], 6 * 3600, 30);
    const bad = run("sep", [[60, "finish_task"]], 6 * 3600, 30);
    const dose = (s: SimState) => s.crew.reduce((a, c) => a + c.doseMsv, 0) / 4;
    expect(dose(good)).toBeLessThan(dose(bad) * 0.6);
    expect(good.outcome!.grade < bad.outcome!.grade).toBe(true); // "A" < "B" alphabetically
  });

  it("hull breach: masks + evacuate + hatch keeps everyone conscious; doing nothing does not", () => {
    const good = run("depress", [[20, "masks"], [30, "evacuate"], [120, "close_hatch"]], 3600, 2);
    expect(good.crew.every((c) => c.conscious)).toBe(true);
    expect(good.outcome?.metrics.find((m) => m.label.startsWith("Crew who"))?.value).toBe("0");
    const bad = run("depress", [], 3600, 2);
    expect(bad.crew.some((c) => !c.conscious)).toBe(true);
  });

  it("CO2 failure: backup scrubbers resolve it", () => {
    const s = run("co2", [[30, "rest"], [60, "backup"]], 36 * 3600, 60);
    expect(s.hab.scrubber).toBe("backup");
    expect(s.outcome).toBeDefined();
  });

  it("fire: pulse oximeter overestimates saturation when CO is present", () => {
    let s = createSim("fire");
    for (let i = 0; i < 120; i++) s = step(s, 2);
    const c = s.crew.find((x) => x.zone === "lab")!;
    expect(c.cohb).toBeGreaterThan(5);
    expect(c.spo2Reading).toBeGreaterThan(c.sao2 + 4);
  });

  it("fire: masks, vent off and extinguisher put it out", () => {
    const s = run("fire", [[10, "masks"], [15, "vent_off"], [60, "extinguish"]], 1800, 2);
    expect(s.hab.fire).toBe(false);
  });

  it("cardiac arrest: fast CPR and AED restore circulation; delay loses the patient", () => {
    const good = run("cardiac", [[5, "cpr"], [10, "aed"]], 1200, 1);
    expect(good.crew.find((c) => c.id === "vega")!.arrest!.rosc).toBe(true);
    const late = run("cardiac", [[600, "aed"]], 1200, 1);
    expect(late.crew.find((c) => c.id === "vega")!.arrest!.rosc).toBe(false);
  });

  it("flight surgeon consult arrives only after the light-time round trip", () => {
    let s = createSim("cardiac", 600);
    s = act(s, "consult");
    expect(s.surgeonReplyAt).toBe(2 * 600 + 300);
  });
});
