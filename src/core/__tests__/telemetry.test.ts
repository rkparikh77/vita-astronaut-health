import { describe, expect, it } from "vitest";
import { BeatGenerator, detect, ecgSample, makeRng, meanHr, parseHeartRateMeasurement, rmssd, stressIndex, type Beat } from "../telemetry";

function run(scenario: "none" | "pvc" | "af", hr = 64, target = 50, n = 400) {
  const g = new BeatGenerator(makeRng(7));
  const beats: Beat[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const b = g.next(t, hr, target, 13, scenario);
    t += b.rr;
    beats.push({ t, rr: b.rr, kind: b.kind });
  }
  return beats;
}

describe("telemetry engine", () => {
  it("R wave is the tallest point of the ECG complex", () => {
    const xs = Array.from({ length: 1000 }, (_, i) => ecgSample(i / 1000));
    const peak = xs.indexOf(Math.max(...xs)) / 1000;
    expect(peak).toBeCloseTo(0.25, 2);
  });

  it("generated beats reproduce the target heart rate and RMSSD", () => {
    const beats = run("none", 64, 50);
    const rr = beats.map((b) => b.rr);
    expect(meanHr(rr)).toBeGreaterThan(60);
    expect(meanHr(rr)).toBeLessThan(68);
    expect(rmssd(rr)).toBeGreaterThan(35);
    expect(rmssd(rr)).toBeLessThan(70);
  });

  it("normal sinus rhythm raises no alerts", () => {
    const beats = run("none");
    expect(detect(beats, 98, 0)).toEqual([]);
  });

  it("detects atrial fibrillation pattern", () => {
    // Check many windows: AF must be flagged and never double-reported as isolated PVCs.
    const beats = run("af");
    for (let end = 40; end <= beats.length; end += 7) {
      const kinds = detect(beats.slice(0, end), 97, 0).map((a) => a.kind);
      expect(kinds).toContain("irregular");
      expect(kinds).not.toContain("ectopic");
    }
  });

  it("detects a premature beat with compensatory pause", () => {
    const beats = run("none", 64, 30, 20);
    const med = 60 / 64;
    beats.push({ t: 0, rr: med * 0.62, kind: "pvc" }, { t: 0, rr: med * 1.4, kind: "normal" }, { t: 0, rr: med, kind: "normal" });
    expect(detect(beats, 98, 0).map((a) => a.kind)).toContain("ectopic");
  });

  it("flags tachycardia and desaturation with severity", () => {
    const beats = Array.from({ length: 12 }, (_, i) => ({ t: i, rr: 60 / 140, kind: "normal" as const }));
    const alerts = detect(beats, 86, 8);
    expect(alerts.find((a) => a.kind === "tachycardia")?.severity).toBe("critical");
    expect(alerts.find((a) => a.kind === "desaturation")?.severity).toBe("critical");
  });

  it("stress rises when HR goes up and HRV falls", () => {
    expect(stressIndex(64, 50, 64, 50)).toBe(30);
    expect(stressIndex(84, 25, 64, 50)).toBeGreaterThan(90);
    expect(stressIndex(58, 70, 64, 50)).toBeLessThan(30);
  });

  it("parses a Bluetooth heart-rate packet with RR intervals", () => {
    // flags 0x10 (RR present, 8-bit HR), HR 72, RR 1024 (=1.0 s) and 870
    const bytes = new Uint8Array([0x10, 72, 0x00, 0x04, 0x66, 0x03]);
    const out = parseHeartRateMeasurement(new DataView(bytes.buffer));
    expect(out.hr).toBe(72);
    expect(out.rr[0]).toBeCloseTo(1.0, 5);
    expect(out.rr[1]).toBeCloseTo(870 / 1024, 5);
  });

  it("parses a 16-bit heart rate with energy-expended field", () => {
    const bytes = new Uint8Array([0x19, 0x2c, 0x01, 0x10, 0x00, 0x00, 0x04]);
    const out = parseHeartRateMeasurement(new DataView(bytes.buffer));
    expect(out.hr).toBe(300);
    expect(out.rr).toEqual([1]);
  });
});
