import { describe, expect, it } from "vitest";
import { analyzeVoice, compareVoice, estimateHeartRate, framePitch, resample, type Sample } from "../rppg";
import { makeRng } from "../telemetry";

/** Simulated forehead green-channel trace: tiny pulse riding on lighting drift, noise and jitter in frame timing. */
function camera(bpm: number, seconds: number, noise: number, seed = 1): Sample[] {
  const rng = makeRng(seed);
  const out: Sample[] = [];
  let t = 0;
  while (t < seconds) {
    const pulse = 0.4 * Math.sin(2 * Math.PI * (bpm / 60) * t) + 0.15 * Math.sin(4 * Math.PI * (bpm / 60) * t + 0.6);
    const drift = 8 * Math.sin(2 * Math.PI * 0.05 * t) + 2 * t;
    out.push({ t, v: 120 + drift + pulse + rng.g() * noise });
    t += 1 / 30 + (rng.u() - 0.5) * 0.012; // ~30 fps with jitter
  }
  return out;
}

describe("camera heart rate (rPPG)", () => {
  it("resamples jittery frames onto an even grid", () => {
    const r = resample([{ t: 0, v: 0 }, { t: 0.5, v: 5 }, { t: 1, v: 10 }], 10);
    expect(r).toHaveLength(10);
    expect(r[5]).toBeCloseTo(5, 5);
  });

  it.each([54, 72, 96, 128])("recovers %i bpm within 2 bpm from a noisy 20 s trace", (bpm) => {
    const est = estimateHeartRate(resample(camera(bpm, 20, 0.3), 30), 30)!;
    expect(Math.abs(est.bpm - bpm)).toBeLessThan(2);
    expect(est.quality).toBeGreaterThan(0.2);
  });

  it("reports low quality when there is no pulse in the signal", () => {
    const rng = makeRng(9);
    const s: Sample[] = Array.from({ length: 600 }, (_, i) => ({ t: i / 30, v: 120 + rng.g() }));
    const est = estimateHeartRate(resample(s, 30), 30)!;
    expect(est.quality).toBeLessThan(0.15);
  });

  it("needs at least 5 seconds", () => {
    expect(estimateHeartRate(resample(camera(70, 3, 0.1), 30), 30)).toBeNull();
  });
});

function voice(f0: number, vibratoHz: number, vibratoDepth: number, syllablesPerSec: number, amp: number, sr = 16000, seconds = 4) {
  const pcm = new Float32Array(sr * seconds);
  let phase = 0;
  for (let i = 0; i < pcm.length; i++) {
    const t = i / sr;
    const f = f0 + vibratoDepth * Math.sin(2 * Math.PI * vibratoHz * t);
    phase += (2 * Math.PI * f) / sr;
    const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * syllablesPerSec * t); // syllable rhythm
    pcm[i] = amp * env * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase));
  }
  return pcm;
}

describe("voice analysis", () => {
  it("detects pitch of a harmonic frame", () => {
    const sr = 16000;
    const frame = Array.from({ length: 640 }, (_, i) => Math.sin((2 * Math.PI * 140 * i) / sr) + 0.5 * Math.sin((2 * Math.PI * 280 * i) / sr));
    expect(framePitch(frame, sr)).toBeCloseTo(140, 0);
  });

  it("silence is unvoiced", () => {
    expect(framePitch(new Float32Array(640), 16000)).toBeNull();
  });

  it("measures mean pitch, variability and rhythm", () => {
    const f = analyzeVoice(voice(150, 1.5, 25, 4, 0.3), 16000);
    expect(f.f0Mean).toBeGreaterThan(140);
    expect(f.f0Mean).toBeLessThan(160);
    expect(f.f0Sd).toBeGreaterThan(10);
    expect(f.voicedFraction).toBeGreaterThan(0.8);
    expect(f.syllablesPerSec).toBeGreaterThan(2.5);
    expect(f.syllablesPerSec).toBeLessThan(5.5);
  });

  it("a flatter, slower, quieter voice scores lower than baseline", () => {
    const base = analyzeVoice(voice(150, 1.5, 25, 4, 0.3), 16000);
    const tired = analyzeVoice(voice(140, 1.5, 6, 2.5, 0.12), 16000);
    const same = compareVoice(base, base);
    const cmp = compareVoice(tired, base);
    expect(same.index).toBe(100);
    expect(cmp.index).toBeLessThan(60);
    expect(cmp.notes.join(" ")).toMatch(/Pitch variation/);
  });
});
