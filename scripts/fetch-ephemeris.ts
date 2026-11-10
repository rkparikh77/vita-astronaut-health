// Pipeline: real Earth and Mars positions from NASA/JPL Horizons for the mission window.
// Writes src/data/ephemeris.json (heliocentric ecliptic J2000, AU). Run with `npm run ephemeris`.
import { mkdirSync, writeFileSync } from "node:fs";

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const START = "2026-11-01";
const STOP = "2030-01-01";
const STEP = "2d";

const AU_KM = 149597870.7;

async function vectors(body: string) {
  const q = new URLSearchParams({
    format: "text",
    COMMAND: `'${body}'`,
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'", // Sun center; default frame is ecliptic J2000, units km
    START_TIME: `'${START}'`,
    STOP_TIME: `'${STOP}'`,
    STEP_SIZE: `'${STEP}'`,
  });
  const res = await fetch(`${API}?${q}`);
  if (!res.ok) throw new Error(`Horizons ${body}: HTTP ${res.status}`);
  const text = await res.text();
  const block = text.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!block) throw new Error(`Horizons ${body}: no ephemeris block`);
  const rows: { jd: number; x: number; y: number; z: number }[] = [];
  const re = /^(\d+\.\d+) = .*?\n\s*X =\s*(\S+) Y =\s*(\S+) Z =\s*(\S+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) rows.push({ jd: Number(m[1]), x: Number(m[2]) / AU_KM, y: Number(m[3]) / AU_KM, z: Number(m[4]) / AU_KM });
  if (rows.some((r) => [r.x, r.y, r.z].some((v) => !Number.isFinite(v)))) throw new Error(`Horizons ${body}: unparseable vector`);
  return rows;
}

async function main() {
  process.stdout.write("Fetching Earth (399) … ");
  const earth = await vectors("399");
  console.log(earth.length, "rows");
  process.stdout.write("Fetching Mars (499) … ");
  const mars = await vectors("499");
  console.log(mars.length, "rows");
  if (earth.length !== mars.length) throw new Error("row count mismatch");
  const r = (v: number) => Number(v.toFixed(6));
  const out = {
    source: "NASA/JPL Horizons API (ssd.jpl.nasa.gov), DE441 ephemeris",
    frame: "Heliocentric ecliptic J2000, AU",
    start: START,
    stepDays: 2,
    fetchedAt: new Date().toISOString(),
    jd0: earth[0].jd,
    earth: earth.map((p) => [r(p.x), r(p.y), r(p.z)]),
    mars: mars.map((p) => [r(p.x), r(p.y), r(p.z)]),
  };
  mkdirSync("src/data", { recursive: true });
  writeFileSync("src/data/ephemeris.json", JSON.stringify(out));
  console.log(`Wrote ${out.earth.length} epochs → src/data/ephemeris.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
