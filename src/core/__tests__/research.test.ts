import { describe, expect, it } from "vitest";
import panels from "../../data/inspiration4-panels.json";
import { PRESETS, projectMission, projectionSummary, FINDINGS } from "../atlas";
import { CREW, crewState } from "../crew";
import { ENV_MAP } from "../environments";
import { analyteStats, benjaminiHochberg, incompleteBeta, panelShifts, summarize, tTestP, type PanelMatrix } from "../research";
import { countermeasures, odometer, readiness, sleep } from "../scores";

describe("statistics", () => {
  it("t-test p-values match textbook critical values", () => {
    expect(tTestP(3.182, 3)).toBeCloseTo(0.05, 3);
    expect(tTestP(12.706, 1)).toBeCloseTo(0.05, 3);
    expect(tTestP(1.96, 1e6)).toBeCloseTo(0.05, 3);
    expect(tTestP(0, 3)).toBeCloseTo(1, 6);
  });

  it("incomplete beta is symmetric", () => {
    expect(incompleteBeta(0.3, 2, 5)).toBeCloseTo(1 - incompleteBeta(0.7, 5, 2), 10);
  });

  it("Benjamini–Hochberg matches a hand-worked example", () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.2]);
    expect(q.map((x) => Number(x.toFixed(4)))).toEqual([0.04, 0.0533, 0.0533, 0.2]);
  });

  it("fold change is relative to each crew member's own preflight median", () => {
    const tps = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"];
    const a = { id: "x", label: "X", panel: "P", unit: "", values: [[10, 10, 10, 20, 10, 10, 10], [100, 100, 100, 200, 100, 100, 100]] };
    const s = analyteStats(a, tps);
    expect(s.post[0].perCrew).toEqual([1, 1]);
    expect(s.post[0].concordant).toBe(2);
    expect(s.residual82).toBe(0);
  });

  it("flags a whole-panel shift as a possible batch effect", () => {
    const tps = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"];
    const analytes = Array.from({ length: 8 }, (_, i) => ({
      id: `a${i}`,
      label: `a${i}`,
      panel: "P",
      unit: "",
      values: [[10, 10, 10, 10, 10, 20 + i, 10], [5, 5, 5, 5, 5, 10 + i, 5]],
    }));
    const shifts = panelShifts(analytes.map((a) => analyteStats(a, tps)));
    expect(shifts.find((s) => s.tp === "R+82")!.flagged).toBe(true);
    expect(shifts.find((s) => s.tp === "R+1")!.flagged).toBe(false);
  });
});

describe("real Inspiration4 panels", () => {
  const m = panels as unknown as PanelMatrix;
  const s = summarize(m);

  it("has all four panels and 118 analytes", () => {
    expect(m.analytes).toHaveLength(118);
    expect(new Set(m.analytes.map((a) => a.panel))).toEqual(new Set(["CBC", "CMP", "Cytokine", "Cardio"]));
  });

  it("reproduces the post-flight IL-6 / IL-10 rise in all 4 crew, recovered by R+82", () => {
    for (const id of ["Cytokine:il_6", "Cytokine:il_10"]) {
      const a = s.stats.find((x) => x.id === id)!;
      expect(a.post[0].mean).toBeGreaterThan(0.4);
      expect(a.post[0].concordant).toBe(4);
      expect(a.residual82).toBeLessThan(0.25);
    }
  });

  it("q-values are never below p-values", () => {
    for (const a of s.stats) expect(a.post[0].q!).toBeGreaterThanOrEqual(a.post[0].p - 1e-12);
  });
});

describe("daily scores", () => {
  const st = crewState(CREW[3], "iss"); // Tanaka: fever scenario
  const healthy = crewState(CREW[0], "iss");

  it("scores stay within 0–100 and expose contributors", () => {
    for (const sc of [readiness(st.readings, 112), sleep(st.readings, 112), countermeasures(st.readings, 112, 3, 8)]) {
      expect(sc.value).toBeGreaterThanOrEqual(0);
      expect(sc.value).toBeLessThanOrEqual(100);
      expect(sc.contributors.length).toBeGreaterThan(1);
    }
  });

  it("fever lowers readiness compared with a healthy crewmate", () => {
    expect(readiness(st.readings, 112).value).toBeLessThan(readiness(healthy.readings, 112).value - 10);
  });

  it("sleep debt lowers the sleep score", () => {
    const okafor = crewState(CREW[1], "iss");
    expect(sleep(okafor.readings, 112).value).toBeLessThan(sleep(healthy.readings, 112).value);
  });
});

describe("odometer & projections", () => {
  it("no bone or muscle loss modeled in Earth-like gravity terms, more on ISS than Mars surface", () => {
    const iss = odometer(ENV_MAP.iss, 180, 90, 1);
    const mars = odometer(ENV_MAP.mars_base, 180, 90, 1);
    const v = (o: ReturnType<typeof odometer>, id: string) => o.find((x) => x.id === id)!.value;
    expect(v(iss, "bone")).toBeGreaterThan(v(mars, "bone"));
    expect(v(iss, "calf")).toBeCloseTo(13, 0); // Trappe 2009: −13% at ~6 months
    expect(iss.some((x) => x.id === "sunrises")).toBe(true);
  });

  it("Mars mission exceeds the 600 mSv career limit; 6-month ISS does not", () => {
    const mars = PRESETS.find((p) => p.id === "mars")!;
    const iss = PRESETS.find((p) => p.id === "iss6")!;
    expect(projectionSummary(mars.phases, 1).exceedsLimit).toBe(true);
    expect(projectionSummary(iss.phases, 1).exceedsLimit).toBe(false);
    expect(projectionSummary(mars.phases, 1).days).toBe(950);
  });

  it("better exercise adherence means less projected bone loss", () => {
    const p = PRESETS[0].phases;
    const good = projectMission(p, 1).at(-1)!.bone;
    const poor = projectMission(p, 0).at(-1)!.bone;
    expect(good).toBeGreaterThan(poor);
  });

  it("every finding has a citation and link", () => {
    for (const f of FINDINGS) {
      expect(f.citation.length).toBeGreaterThan(5);
      expect(f.url).toMatch(/^https:\/\//);
    }
  });
});
