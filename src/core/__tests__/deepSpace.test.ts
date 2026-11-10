import { describe, expect, it } from "vitest";
import {
  AU_LIGHT_SEC,
  blackoutWindows,
  craftAt,
  earthAt,
  elongationDeg,
  lightSeconds,
  linkState,
  marsAt,
  MISSION_PLAN,
  packetTiming,
  parseDsn,
} from "../deepSpace";

describe("ephemeris (JPL Horizons)", () => {
  it("Earth stays ~1 AU and Mars ~1.38–1.67 AU from the Sun", () => {
    for (const day of ["2026-12-01", "2027-06-01", "2028-06-01", "2029-06-01"]) {
      const t = new Date(`${day}T00:00:00Z`);
      expect(Math.hypot(...earthAt(t))).toBeGreaterThan(0.98);
      expect(Math.hypot(...earthAt(t))).toBeLessThan(1.02);
      expect(Math.hypot(...marsAt(t))).toBeGreaterThan(1.38);
      expect(Math.hypot(...marsAt(t))).toBeLessThan(1.67);
    }
  });

  it("today's Earth–Mars light time matches Horizons' observer range (1.3582 AU on 2026-11-10)", () => {
    const t = new Date("2026-11-10T00:00:00Z");
    expect(lightSeconds(earthAt(t), marsAt(t)) / 60).toBeCloseTo((1.35815589 * AU_LIGHT_SEC) / 60, 1);
  });
});

describe("mission geometry", () => {
  it("vehicle starts at Earth and arrives at Mars", () => {
    const leg = MISSION_PLAN[0];
    const a = craftAt(leg.start);
    const b = craftAt(new Date(leg.end.getTime() - 1));
    expect(lightSeconds(a, earthAt(leg.start))).toBeLessThan(1);
    expect(lightSeconds(b, marsAt(leg.end))).toBeLessThan(60);
  });

  it("finds the 2028 solar conjunction blackout during the surface stay", () => {
    const w = blackoutWindows();
    expect(w.length).toBeGreaterThanOrEqual(1);
    const surface = MISSION_PLAN[1];
    expect(w[0].start.getTime()).toBeGreaterThan(surface.start.getTime());
    expect(w[0].end.getTime()).toBeLessThan(surface.end.getTime());
    const days = (w[0].end.getTime() - w[0].start.getTime()) / 86400000;
    expect(days).toBeGreaterThan(7);
    expect(days).toBeLessThan(30);
  });

  it("elongation and link state behave at the extremes", () => {
    expect(elongationDeg([1, 0, 0], [-1, 0, 0])).toBeCloseTo(0, 5); // target behind the Sun
    expect(elongationDeg([1, 0, 0], [2, 0, 0])).toBeCloseTo(180, 5); // opposition
    expect(linkState(1)).toBe("blackout");
    expect(linkState(3)).toBe("degraded");
    expect(linkState(40)).toBe("nominal");
  });
});

describe("medical packets", () => {
  it("adds transmission time, light time each way and review time", () => {
    const p = packetTiming(250, 2000, 600, 600); // 250 kB at 2 kbps, 10 min light time
    expect(p.txSec).toBe(1000);
    expect(p.arriveGroundSec).toBe(1600);
    expect(p.replyAtCrewSec).toBe(2800);
  });
});

describe("DSN Now parser", () => {
  const xml = `<dsn><station name="mdscc" friendlyName="Madrid" timeUTC="1794328356000" timeZoneOffset="3600000.0"/>
<dish name="DSS56" azimuthAngle="209" elevationAngle="18" windSpeed="2" isMSPA="false" isArray="false" isDDOR="false" activity="Spacecraft Telemetry, Tracking, and Command">
<upSignal active="true" signalType="data" dataRate="0" frequency="0" band="X" power="18" spacecraft="SPP" spacecraftID="-96"/>
<downSignal active="true" signalType="data" dataRate="178600" frequency="0" band="Ka" power="-130" spacecraft="SPP" spacecraftID="-96"/>
<target name="SPP" id="96" uplegRange="142000000" downlegRange="142000000" rtlt="950"/>
</dish>
<dish name="DSS55" azimuthAngle="0" elevationAngle="90" windSpeed="" activity="Engineering Upgrades">
<target name="DSN" id="99" uplegRange="-1" downlegRange="-1" rtlt="-1"/>
</dish></dsn>`;

  it("extracts stations, dishes, targets and data rates", () => {
    const { dishes, timeUtc } = parseDsn(xml);
    expect(timeUtc).toBe(1794328356000);
    expect(dishes).toHaveLength(2);
    expect(dishes[0]).toMatchObject({ station: "Madrid", dish: "DSS56", elevation: 18 });
    expect(dishes[0].targets[0]).toEqual({ name: "SPP", rtltSec: 950, rangeKm: 142000000 });
    expect(dishes[0].down[0]).toMatchObject({ spacecraft: "SPP", rateBps: 178600, band: "Ka", active: true });
    expect(dishes[1].targets).toEqual([]); // placeholder DSN target filtered out
  });
});
