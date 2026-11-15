// Solar wind at L1 from NASA's Wind spacecraft, served by NASA SPDF / CDAWeb through its HAPI interface.
// Pure parsing and interpretation live here so they can be unit-tested; fetching is in src/lib/solarWind.ts.

export const SPDF_HAPI = "https://cdaweb.gsfc.nasa.gov/hapi/data";
export const WIND_PLASMA = "WI_K0_SWE"; // Wind SWE key parameters: velocity, proton density, dynamic pressure
export const WIND_FIELD = "WI_K0_MFI"; // Wind MFI key parameters: |B| and B in GSM

export interface SolarWindPoint {
  /** ISO hour, e.g. 2026-11-10T13:00:00Z */
  t: string;
  speed?: number; // km/s
  density?: number; // protons / cm³
  pressure?: number; // nPa
  bt?: number; // nT, field magnitude
  bz?: number; // nT, GSM north-south component (negative = southward = geoeffective)
}

export type SolarWindLevel = "quiet" | "elevated" | "storm-driving";

export interface SolarWind {
  live: boolean;
  source: string;
  spacecraft: string;
  latest?: SolarWindPoint;
  /** Hour of the newest sample; SPDF key parameters typically lag real time by about a day. */
  dataThrough?: string;
  series: SolarWindPoint[];
  level: SolarWindLevel;
  shock?: { t: string; speedJump: number; densityRatio: number };
  notes: string[];
  error?: string;
}

/** Parse a HAPI CSV body into rows of [epochMs, ...values], dropping fill values (−1e31) as NaN. */
export function parseHapiCsv(text: string): number[][] {
  const rows: number[][] = [];
  for (const line of text.split("\n")) {
    const parts = line.trim().split(",");
    if (parts.length < 2) continue;
    const t = Date.parse(parts[0]);
    if (!Number.isFinite(t)) continue;
    rows.push([t, ...parts.slice(1).map((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > -1e30 ? n : NaN;
    })]);
  }
  return rows;
}

const HOUR = 3_600_000;

function mean(xs: number[]) {
  const v = xs.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
}

function round(x: number | undefined, dp = 1) {
  return x === undefined ? undefined : Math.round(x * 10 ** dp) / 10 ** dp;
}

/**
 * Merge plasma rows [t, vx, vy, vz, np, p] and field rows [t, bt, bx, by, bz] into hourly means.
 */
export function hourlySeries(plasma: number[][], field: number[][]): SolarWindPoint[] {
  const bins = new Map<number, { speed: number[]; density: number[]; pressure: number[]; bt: number[]; bz: number[] }>();
  const bin = (t: number) => {
    const k = Math.floor(t / HOUR) * HOUR;
    if (!bins.has(k)) bins.set(k, { speed: [], density: [], pressure: [], bt: [], bz: [] });
    return bins.get(k)!;
  };
  for (const [t, vx, vy, vz, np, p] of plasma) {
    const b = bin(t);
    b.speed.push(Math.hypot(vx, vy, vz));
    b.density.push(np);
    b.pressure.push(p);
  }
  for (const [t, bt, , , bz] of field) {
    const b = bin(t);
    b.bt.push(bt);
    b.bz.push(bz);
  }
  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, b]) => ({
      t: new Date(k).toISOString().replace(".000", ""),
      speed: round(mean(b.speed), 0),
      density: round(mean(b.density)),
      pressure: round(mean(b.pressure), 2),
      bt: round(mean(b.bt)),
      bz: round(mean(b.bz)),
    }));
}

/**
 * Look for an interplanetary shock: a jump of ≥80 km/s in speed together with ≥1.5× density, comparing the
 * two hours after a point with the two hours before it. Returns the most recent one.
 */
export function detectShock(series: SolarWindPoint[]): SolarWind["shock"] {
  let found: SolarWind["shock"];
  for (let i = 2; i < series.length - 1; i++) {
    const before = series.slice(i - 2, i);
    const after = series.slice(i, i + 2);
    const v0 = mean(before.map((p) => p.speed ?? NaN));
    const v1 = mean(after.map((p) => p.speed ?? NaN));
    const n0 = mean(before.map((p) => p.density ?? NaN));
    const n1 = mean(after.map((p) => p.density ?? NaN));
    if (v0 === undefined || v1 === undefined || n0 === undefined || n1 === undefined || n0 <= 0) continue;
    if (v1 - v0 >= 80 && n1 / n0 >= 1.5) found = { t: series[i].t, speedJump: Math.round(v1 - v0), densityRatio: Math.round((n1 / n0) * 10) / 10 };
  }
  return found;
}

/** Interpret the last few hours for a crew-health audience. */
export function interpret(series: SolarWindPoint[]): Pick<SolarWind, "level" | "shock" | "notes" | "latest" | "dataThrough"> {
  const recent = series.slice(-3);
  // plasma and field streams end at slightly different times: take the newest value of each
  const newest = <K extends keyof SolarWindPoint>(k: K) => [...series].reverse().find((p) => p[k] !== undefined)?.[k];
  const last = [...series].reverse().find((p) => p.speed !== undefined || p.bz !== undefined);
  const latest: SolarWindPoint | undefined = last && {
    t: last.t,
    speed: newest("speed") as number | undefined,
    density: newest("density") as number | undefined,
    pressure: newest("pressure") as number | undefined,
    bt: newest("bt") as number | undefined,
    bz: newest("bz") as number | undefined,
  };
  const speed = mean(recent.map((p) => p.speed ?? NaN));
  const bz = mean(recent.map((p) => p.bz ?? NaN));
  const density = mean(recent.map((p) => p.density ?? NaN));
  const shock = detectShock(series);
  const notes: string[] = [];
  let level: SolarWindLevel = "quiet";

  if (bz !== undefined && bz <= -10 && (speed ?? 0) >= 450) {
    level = "storm-driving";
    notes.push(`Strongly southward magnetic field (Bz ${bz.toFixed(1)} nT) with ${Math.round(speed ?? 0)} km/s wind: conditions that drive geomagnetic storms.`);
  } else if ((speed ?? 0) >= 600 || (bz !== undefined && bz <= -5)) {
    level = "elevated";
  }
  if ((speed ?? 0) >= 600) notes.push(`Fast solar wind (${Math.round(speed!)} km/s), typical of a coronal-hole high-speed stream.`);
  if ((density ?? 0) >= 20) notes.push(`High density (${density!.toFixed(0)} p/cm³): possible compression region or CME sheath.`);
  if (shock) notes.push(`Possible interplanetary shock at ${shock.t.slice(5, 16).replace("T", " ")} UTC: speed +${shock.speedJump} km/s, density ×${shock.densityRatio}. CME-driven shocks can carry an energetic-particle (ESP) dose spike.`);
  if (level === "quiet" && notes.length === 0) notes.push("Ambient solar wind. No storm drivers in the last few hours.");
  notes.push("Solar wind itself is not the crew radiation hazard (solar energetic particles are), but it signals CME arrivals and storms that raise dose in LEO and disrupt comms and navigation.");
  notes.push("Measured at L1, sunward of Earth: about 30–60 minutes of warning for Earth orbit. A vehicle in Mars transit sits at a different solar longitude and needs its own monitor.");

  return { level, shock, notes, latest, dataThrough: latest?.t };
}
