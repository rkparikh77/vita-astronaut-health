// Hardware-free vitals, computed entirely on the device.
//
// 1. Camera heart rate (remote photoplethysmography, rPPG): each heartbeat slightly changes skin blood volume,
//    which changes how much green light the skin reflects (Verkruysse et al. 2008, Optics Express). Averaging the
//    green channel over the forehead gives a pulse wave; its dominant frequency in 0.7–3 Hz is the heart rate.
// 2. Voice: fundamental frequency (pitch) by autocorrelation, pitch variability, speaking rate and loudness.
//    Fatigue and sleep loss tend to flatten pitch variation and slow speech (Vogel et al. 2010; Krajewski et al. 2009).

export interface Sample {
  t: number; // seconds
  v: number;
}

/** Resample irregular camera frames onto an even grid (linear interpolation). */
export function resample(samples: Sample[], fs: number): number[] {
  if (samples.length < 2) return [];
  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t;
  const n = Math.floor((t1 - t0) * fs);
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / fs;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j];
    const b = samples[j + 1];
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out.push(a.v + (b.v - a.v) * Math.max(0, Math.min(1, f)));
  }
  return out;
}

function movingAverage(x: number[], w: number): number[] {
  const out = new Array<number>(x.length);
  let sum = 0;
  const q: number[] = [];
  for (let i = 0; i < x.length; i++) {
    q.push(x[i]);
    sum += x[i];
    if (q.length > w) sum -= q.shift()!;
    out[i] = sum / q.length;
  }
  // center the window
  const half = Math.floor(w / 2);
  return out.map((_, i) => out[Math.min(out.length - 1, i + half)]);
}

/** Band-pass by difference of moving averages: removes slow lighting drift and fast sensor noise. */
export function bandpass(x: number[], fs: number, lowHz = 0.7, highHz = 3.5): number[] {
  const slow = movingAverage(x, Math.max(1, Math.round(fs / lowHz)));
  const detrended = x.map((v, i) => v - slow[i]);
  return movingAverage(detrended, Math.max(1, Math.round(fs / (highHz * 2))));
}

/** Power at frequency f (Hz) via direct DFT on a Hann-windowed signal. */
function powerAt(x: number[], fs: number, f: number): number {
  let re = 0;
  let im = 0;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const ph = (2 * Math.PI * f * i) / fs;
    re += x[i] * w * Math.cos(ph);
    im -= x[i] * w * Math.sin(ph);
  }
  return re * re + im * im;
}

export interface HeartRateEstimate {
  bpm: number;
  /** Share of in-band power at the peak (0–1). Below ~0.15 the signal is unreliable. */
  quality: number;
  spectrum: { bpm: number; power: number }[];
}

export function estimateHeartRate(signal: number[], fs: number): HeartRateEstimate | null {
  if (signal.length < fs * 5) return null;
  const x = bandpass(signal, fs);
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const centered = x.map((v) => v - mean);
  const spectrum: { bpm: number; power: number }[] = [];
  for (let bpm = 42; bpm <= 200; bpm += 1) spectrum.push({ bpm, power: powerAt(centered, fs, bpm / 60) });
  const total = spectrum.reduce((a, s) => a + s.power, 0) || 1;
  let best = spectrum[0];
  for (const s of spectrum) if (s.power > best.power) best = s;
  // quality: power within ±3 bpm of the peak over all in-band power
  const near = spectrum.filter((s) => Math.abs(s.bpm - best.bpm) <= 3).reduce((a, s) => a + s.power, 0);
  // parabolic interpolation around the peak for sub-bpm resolution
  const i = spectrum.indexOf(best);
  let bpm = best.bpm;
  if (i > 0 && i < spectrum.length - 1) {
    const [a, b, c] = [spectrum[i - 1].power, best.power, spectrum[i + 1].power];
    const d = a - 2 * b + c;
    if (d !== 0) bpm += (0.5 * (a - c)) / d;
  }
  return { bpm, quality: near / total, spectrum };
}

// --- Voice ---

export interface VoiceFeatures {
  f0Mean: number; // Hz
  f0Sd: number; // Hz (pitch variability; flattens with fatigue)
  voicedFraction: number;
  syllablesPerSec: number;
  loudnessDb: number;
  f0Track: (number | null)[];
}

/** Autocorrelation pitch of one frame (Hz), or null if unvoiced. */
export function framePitch(frame: Float32Array | number[], sampleRate: number, minHz = 70, maxHz = 400): number | null {
  const n = frame.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += frame[i] * frame[i];
  if (energy / n < 1e-5) return null;
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(n - 1, Math.ceil(sampleRate / minHz));
  let bestLag = -1;
  let best = 0;
  const r0 = energy;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let r = 0;
    for (let i = 0; i + lag < n; i++) r += frame[i] * frame[i + lag];
    const norm = r / r0;
    if (norm > best) {
      best = norm;
      bestLag = lag;
    }
  }
  if (best < 0.45 || bestLag <= 0) return null;
  // refine with parabolic interpolation
  const ac = (lag: number) => {
    let r = 0;
    for (let i = 0; i + lag < n; i++) r += frame[i] * frame[i + lag];
    return r;
  };
  const [a, b, c] = [ac(bestLag - 1), ac(bestLag), ac(bestLag + 1)];
  const d = a - 2 * b + c;
  const lag = d !== 0 ? bestLag + (0.5 * (a - c)) / d : bestLag;
  return sampleRate / lag;
}

export function analyzeVoice(pcm: Float32Array, sampleRate: number): VoiceFeatures {
  const frameLen = Math.round(sampleRate * 0.04);
  const hop = Math.round(sampleRate * 0.02);
  const track: (number | null)[] = [];
  const env: number[] = [];
  let sumSq = 0;
  for (let i = 0; i + frameLen <= pcm.length; i += hop) {
    const f = pcm.subarray(i, i + frameLen);
    let e = 0;
    for (let k = 0; k < f.length; k++) e += f[k] * f[k];
    env.push(Math.sqrt(e / f.length));
    sumSq += e;
    track.push(framePitch(f, sampleRate));
  }
  const voiced = track.filter((x): x is number => x !== null);
  const mean = voiced.length ? voiced.reduce((a, b) => a + b, 0) / voiced.length : NaN;
  const sd = voiced.length > 1 ? Math.sqrt(voiced.reduce((a, b) => a + (b - mean) ** 2, 0) / (voiced.length - 1)) : NaN;
  // syllable nuclei ≈ peaks of the smoothed loudness envelope above a dynamic threshold
  const smooth = env.map((_, i) => env.slice(Math.max(0, i - 3), i + 4).reduce((a, b) => a + b, 0) / Math.min(7, env.length));
  const thr = Math.max(...smooth) * 0.35;
  let peaks = 0;
  for (let i = 1; i < smooth.length - 1; i++) if (smooth[i] > thr && smooth[i] > smooth[i - 1] && smooth[i] >= smooth[i + 1]) peaks++;
  const seconds = pcm.length / sampleRate;
  const rms = Math.sqrt(sumSq / Math.max(1, pcm.length));
  return {
    f0Mean: mean,
    f0Sd: sd,
    voicedFraction: track.length ? voiced.length / track.length : 0,
    syllablesPerSec: peaks / seconds,
    loudnessDb: 20 * Math.log10(Math.max(rms, 1e-6)),
    f0Track: track,
  };
}

/**
 * Compare today's voice to the astronaut's own baseline. Returns a 0–100 "vocal energy" index
 * (100 = matches baseline) and the reasons it dropped.
 */
export function compareVoice(today: VoiceFeatures, baseline: VoiceFeatures): { index: number; notes: string[] } {
  const notes: string[] = [];
  let score = 100;
  const varRatio = today.f0Sd / baseline.f0Sd;
  if (varRatio < 0.8) {
    score -= Math.min(35, (0.8 - varRatio) * 100);
    notes.push(`Pitch variation down ${Math.round((1 - varRatio) * 100)}% (flatter, more monotone speech)`);
  }
  const rateRatio = today.syllablesPerSec / baseline.syllablesPerSec;
  if (rateRatio < 0.9) {
    score -= Math.min(30, (0.9 - rateRatio) * 120);
    notes.push(`Speaking rate down ${Math.round((1 - rateRatio) * 100)}%`);
  }
  const dDb = today.loudnessDb - baseline.loudnessDb;
  if (dDb < -3) {
    score -= Math.min(20, -dDb * 3);
    notes.push(`Voice ${Math.abs(dDb).toFixed(0)} dB quieter`);
  }
  if (!notes.length) notes.push("Matches your baseline");
  return { index: Math.max(0, Math.round(score)), notes };
}
