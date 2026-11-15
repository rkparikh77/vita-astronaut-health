import { describe, expect, it } from "vitest";
import { detectShock, hourlySeries, interpret, parseHapiCsv, type SolarWindPoint } from "../solarWind";

describe("solar wind (SPDF / Wind)", () => {
  it("parses HAPI CSV and turns fill values into NaN", () => {
    const rows = parseHapiCsv("2026-11-10T23:58:02.164Z,-570.5,12.6,18.8,2.3,1.237625e+00\n2026-11-10T23:59:00Z,-1.0E31,0,0,2.0,1.1\n\n");
    expect(rows).toHaveLength(2);
    expect(rows[0][1]).toBe(-570.5);
    expect(Number.isNaN(rows[1][1])).toBe(true);
  });

  it("bins plasma and field into hourly means with speed as |V|", () => {
    const t = Date.parse("2026-11-10T05:10:00Z");
    const s = hourlySeries(
      [
        [t, -600, 0, 0, 4, 2],
        [t + 60_000, -400, 0, 0, 6, 3],
      ],
      [[t, 8, 1, 1, -6]],
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ t: "2026-11-10T05:00:00Z", speed: 500, density: 5, pressure: 2.5, bt: 8, bz: -6 });
  });

  const hours = (vals: [number, number, number][]): SolarWindPoint[] =>
    vals.map(([speed, density, bz], i) => ({ t: new Date(Date.UTC(2026, 10, 10, i)).toISOString().replace(".000", ""), speed, density, bz }));

  it("detects a CME-style shock: speed jump with density compression", () => {
    const s = hours([
      [400, 5, 0],
      [405, 5, 0],
      [400, 5, 0],
      [560, 14, -4],
      [570, 15, -12],
      [565, 12, -14],
    ]);
    const shock = detectShock(s)!;
    expect(shock.t).toBe("2026-11-10T03:00:00Z");
    expect(shock.speedJump).toBeGreaterThanOrEqual(80);
    expect(shock.densityRatio).toBeGreaterThanOrEqual(1.5);
  });

  it("does not call a fast stream with falling density a shock", () => {
    expect(detectShock(hours([[400, 8, 0], [420, 8, 0], [600, 3, 0], [700, 2, 0], [720, 2, 0]]))).toBeUndefined();
  });

  it("classifies southward Bz plus fast wind as storm-driving, and quiet wind as quiet", () => {
    expect(interpret(hours([[500, 5, -12], [520, 5, -13], [530, 5, -14]])).level).toBe("storm-driving");
    expect(interpret(hours([[650, 3, 1], [660, 3, 2], [640, 3, 0]])).level).toBe("elevated");
    const q = interpret(hours([[380, 5, 2], [370, 5, 1], [375, 5, 0]]));
    expect(q.level).toBe("quiet");
    expect(q.notes.join(" ")).toMatch(/not the crew radiation hazard/);
  });
});

describe("solar wind latest values", () => {
  it("takes the newest value of each field when streams end at different hours", () => {
    const s = interpret([
      { t: "2026-11-10T21:00:00Z", speed: 500, density: 3, bz: -2 },
      { t: "2026-11-10T22:00:00Z", speed: 520, density: 3, bz: -3 },
      { t: "2026-11-10T23:00:00Z", speed: 540, density: 4 },
    ]);
    expect(s.latest).toMatchObject({ t: "2026-11-10T23:00:00Z", speed: 540, bz: -3 });
  });
});
