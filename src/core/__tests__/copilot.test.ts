import { describe, expect, it } from "vitest";
import { runTool, TOOL_DEFS, TOOL_SCHEMAS, type CopilotContext } from "../copilotTools";

const ctx: CopilotContext = { env: "mars_transit" };

describe("copilot tools", () => {
  it("every API tool definition has a matching validator and label", () => {
    for (const t of TOOL_DEFS) expect(TOOL_SCHEMAS[t.name]).toBeDefined();
    expect(Object.keys(TOOL_SCHEMAS).sort()).toEqual(TOOL_DEFS.map((t) => t.name).sort());
  });

  it("crew overview reports all four crew with scores and flags", async () => {
    const out = (await runTool("get_crew_overview", {}, ctx)) as { crew: { id: string; scores: { readiness: number }; flagged: unknown[] }[] };
    expect(out.crew.map((c) => c.id)).toEqual(["vega", "okafor", "lindqvist", "tanaka"]);
    expect(out.crew.find((c) => c.id === "tanaka")!.flagged.length).toBeGreaterThan(0);
  });

  it("crew member record includes escalation and real preflight labs", async () => {
    const out = (await runTool("get_crew_member", { crew_id: "tanaka" }, ctx)) as {
      escalation: { responder: string; steps: string[] };
      realPreflightLabs: Record<string, { preflightDraws: number[] }>;
    };
    expect(out.escalation.steps.join(" ")).toMatch(/Backup medical officer/);
    expect(out.realPreflightLabs.hemoglobin.preflightDraws).toHaveLength(3);
  });

  it("astronaut-logged entries flow through to the assistant", async () => {
    const out = (await runTool("get_crew_member", { crew_id: "vega" }, { ...ctx, entries: { vega: [{ indicator: "glucose", value: 50, day: 112, source: "self" }] } })) as {
      indicators: { id: string; status: string; source: string }[];
    };
    const g = out.indicators.find((i) => i.id === "glucose")!;
    expect(g.status).toBe("critical");
    expect(g.source).toBe("astronaut-logged");
  });

  it("research search finds IL-6 with real statistics", async () => {
    const out = (await runTool("get_research_stats", { query: "IL-6" }, ctx)) as { results: { analyte: string; byTimepoint: { foldChange: number; sameDirection: string }[] }[] };
    const il6 = out.results.find((r) => r.analyte === "IL-6")!;
    expect(il6.byTimepoint[0].foldChange).toBeCloseTo(1.93, 1);
    expect(il6.byTimepoint[0].sameDirection).toBe("4/4");
  });

  it("mission projection flags a Mars mission over the career limit", async () => {
    const out = (await runTool("project_mission", { preset: "mars" }, ctx)) as { projected: { exceedsCareerLimit: boolean } };
    expect(out.projected.exceedsCareerLimit).toBe(true);
  });

  it("rejects bad input and unknown tools with clear errors", async () => {
    await expect(runTool("get_crew_member", { crew_id: "nobody" }, ctx)).rejects.toThrow(/Invalid input/);
    await expect(runTool("delete_everything", {}, ctx)).rejects.toThrow(/Unknown tool/);
  });

  it("deep-space link reports light time and the 2028 blackout", async () => {
    const out = (await runTool("get_deep_space_link", { mission_day: 112 }, ctx)) as { linkState: string; blackouts: { start: string }[] };
    expect(out.linkState).toBe("nominal");
    expect(out.blackouts[0].start).toMatch(/^2028-03/);
  });

  it("emergency science returns the cardiac survival model", async () => {
    const out = (await runTool("get_emergency_science", { scenario: "cardiac" }, ctx)) as { survivalIfShockedAt3min_withCprAt1min: number }[];
    expect(out[0].survivalIfShockedAt3min_withCprAt1min).toBeGreaterThan(50);
  });

  it("medication check blocks an allergen and the crew record carries the medical profile", async () => {
    const out = (await runTool("check_medication", { crew_id: "tanaka", drug: "ibuprofen" }, ctx)) as { checks: { severity: string }[] };
    expect(out.checks.some((c) => c.severity === "block")).toBe(true);
    const rec = (await runTool("get_crew_member", { crew_id: "tanaka" }, ctx)) as { medicalProfile: { allergies: string[] } };
    expect(rec.medicalProfile.allergies).toContain("nsaid");
  });

  it("space weather uses the injected fetcher", async () => {
    const out = await runTool("get_space_weather", {}, ctx, { spaceWeather: async () => ({ live: true, events: [] }) });
    expect(out).toEqual({ live: true, events: [] });
  });
});
