// Deep-space communications for Earth-independent medicine.
// Planet positions are real (NASA/JPL Horizons); the crew vehicle follows a transfer arc between them.
import eph from "../data/ephemeris.json";

export type Vec3 = [number, number, number];

const AU_KM = 149597870.7;
const C_KM_S = 299792.458;
export const AU_LIGHT_SEC = AU_KM / C_KM_S; // ≈ 499.005 s
const DAY_MS = 86400000;
const EPH = eph as unknown as { start: string; stepDays: number; earth: Vec3[]; mars: Vec3[]; source: string };
const T0 = Date.parse(`${EPH.start}T00:00:00Z`);

export const EPHEMERIS_SOURCE = EPH.source;
export const EPHEMERIS_RANGE = { start: new Date(T0), end: new Date(T0 + (EPH.earth.length - 1) * EPH.stepDays * DAY_MS) };

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function interp(series: Vec3[], date: Date): Vec3 {
  const f = (date.getTime() - T0) / (EPH.stepDays * DAY_MS);
  const i = Math.max(0, Math.min(series.length - 2, Math.floor(f)));
  const t = Math.max(0, Math.min(1, f - i));
  const a = series[i];
  const b = series[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export const earthAt = (d: Date) => interp(EPH.earth, d);
export const marsAt = (d: Date) => interp(EPH.mars, d);

/** Seconds for light to cross between two heliocentric positions (AU). */
export function lightSeconds(a: Vec3, b: Vec3): number {
  return norm(sub(a, b)) * AU_LIGHT_SEC;
}

/** Sun–Earth–target angle in degrees (solar elongation as seen from Earth). */
export function elongationDeg(earth: Vec3, target: Vec3): number {
  const toSun: Vec3 = [-earth[0], -earth[1], -earth[2]];
  const toT = sub(target, earth);
  return (Math.acos(Math.max(-1, Math.min(1, dot(toSun, toT) / (norm(toSun) * norm(toT))))) * 180) / Math.PI;
}

/** Link quality from solar elongation: inside ~2° the Sun's plasma blocks the radio link (conjunction moratorium). */
export type LinkState = "nominal" | "degraded" | "blackout";
export function linkState(elong: number): LinkState {
  if (elong < 2) return "blackout";
  if (elong < 5) return "degraded";
  return "nominal";
}

// --- Mission plan: a conjunction-class Mars mission in the real late-2026 launch window ---

export interface Leg {
  kind: "transit" | "surface";
  label: string;
  start: Date;
  end: Date;
}

const d = (s: string) => new Date(`${s}T00:00:00Z`);

export const MISSION_PLAN: Leg[] = [
  { kind: "transit", label: "Earth → Mars", start: d("2026-11-20"), end: d("2027-08-17") },
  { kind: "surface", label: "Mars surface", start: d("2027-08-17"), end: d("2029-01-06") },
  { kind: "transit", label: "Mars → Earth", start: d("2029-01-06"), end: d("2029-08-24") },
];

/** Mission day 1 = departure. */
export function missionDate(day: number): Date {
  return new Date(MISSION_PLAN[0].start.getTime() + (day - 1) * DAY_MS);
}

/**
 * Crew vehicle position. Transit legs follow a transfer arc in polar coordinates from the departure
 * planet's position to the arrival planet's position (radius eased like a Hohmann ellipse, angle swept
 * prograde). A visual/physical approximation, not a navigation solution.
 */
export function craftAt(date: Date): Vec3 {
  const t = date.getTime();
  const leg = MISSION_PLAN.find((l) => t >= l.start.getTime() && t <= l.end.getTime());
  if (!leg) return t < MISSION_PLAN[0].start.getTime() ? earthAt(date) : earthAt(date);
  if (leg.kind === "surface") return marsAt(date);
  const outbound = leg.label.startsWith("Earth");
  const a = outbound ? earthAt(leg.start) : marsAt(leg.start);
  const b = outbound ? marsAt(leg.end) : earthAt(leg.end);
  const s = (t - leg.start.getTime()) / (leg.end.getTime() - leg.start.getTime());
  const ra = Math.hypot(a[0], a[1]);
  const rb = Math.hypot(b[0], b[1]);
  const tha = Math.atan2(a[1], a[0]);
  let thb = Math.atan2(b[1], b[0]);
  while (thb <= tha) thb += 2 * Math.PI; // prograde sweep
  const th = tha + (thb - tha) * s;
  const ease = (1 - Math.cos(Math.PI * s)) / 2; // radius changes fastest mid-transfer, like an ellipse
  const r = ra + (rb - ra) * ease;
  const z = a[2] + (b[2] - a[2]) * s;
  return [r * Math.cos(th), r * Math.sin(th), z];
}

export function legAt(date: Date): Leg | undefined {
  const t = date.getTime();
  return MISSION_PLAN.find((l) => t >= l.start.getTime() && t <= l.end.getTime());
}

export interface LinkSnapshot {
  date: Date;
  earth: Vec3;
  craft: Vec3;
  oneWaySec: number;
  elongationDeg: number;
  state: LinkState;
  distanceAu: number;
}

export function linkAt(date: Date): LinkSnapshot {
  const earth = earthAt(date);
  const craft = craftAt(date);
  const elong = elongationDeg(earth, craft);
  return { date, earth, craft, oneWaySec: lightSeconds(earth, craft), elongationDeg: elong, state: linkState(elong), distanceAu: norm(sub(earth, craft)) };
}

/** Sampled link over the whole mission (for the timeline chart). */
export function linkTimeline(stepDays = 4) {
  const out: { day: number; date: string; oneWayMin: number; elongation: number; state: LinkState }[] = [];
  const start = MISSION_PLAN[0].start.getTime();
  const end = MISSION_PLAN[MISSION_PLAN.length - 1].end.getTime();
  for (let t = start, day = 1; t <= end; t += stepDays * DAY_MS, day += stepDays) {
    const s = linkAt(new Date(t));
    out.push({ day, date: new Date(t).toISOString().slice(0, 10), oneWayMin: Number((s.oneWaySec / 60).toFixed(2)), elongation: Number(s.elongationDeg.toFixed(2)), state: s.state });
  }
  return out;
}

/** Contiguous blackout windows (solar conjunction) during the mission. */
export function blackoutWindows(stepDays = 1) {
  const windows: { start: Date; end: Date; minElongation: number }[] = [];
  const start = MISSION_PLAN[0].start.getTime();
  const end = MISSION_PLAN[MISSION_PLAN.length - 1].end.getTime();
  let open: { start: Date; minElongation: number } | null = null;
  for (let t = start; t <= end; t += stepDays * DAY_MS) {
    const s = linkAt(new Date(t));
    if (s.state === "blackout") {
      if (!open) open = { start: new Date(t), minElongation: s.elongationDeg };
      else open.minElongation = Math.min(open.minElongation, s.elongationDeg);
    } else if (open) {
      windows.push({ ...open, end: new Date(t) });
      open = null;
    }
  }
  if (open) windows.push({ ...open, end: new Date(end) });
  return windows;
}

// --- Medical packets ---

export interface PacketTiming {
  txSec: number; // time to clock the bits out at the link rate
  oneWaySec: number;
  arriveGroundSec: number; // from send
  replyAtCrewSec: number; // ground review + light time back
}

/** Time for a medical report to reach Earth and a flight-surgeon reply to come back. */
export function packetTiming(sizeKb: number, rateBps: number, oneWaySec: number, reviewSec = 600): PacketTiming {
  const txSec = (sizeKb * 8 * 1000) / Math.max(1, rateBps);
  const arrive = txSec + oneWaySec;
  return { txSec, oneWaySec, arriveGroundSec: arrive, replyAtCrewSec: arrive + reviewSec + oneWaySec };
}

export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  if (sec < 60) return `${sec.toFixed(1)} s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`;
  if (sec < 86400 * 2) return `${(sec / 3600).toFixed(1)} h`;
  return `${(sec / 86400).toFixed(1)} days`;
}

// --- NASA Deep Space Network "DSN Now" feed ---

export interface DsnDish {
  station: string;
  dish: string;
  activity: string;
  azimuth: number;
  elevation: number;
  targets: { name: string; rtltSec: number; rangeKm: number }[];
  down: { spacecraft: string; rateBps: number; band: string; active: boolean }[];
  up: { spacecraft: string; band: string; active: boolean }[];
}

/** Parse eyes.nasa.gov/dsn/data/dsn.xml without a DOM (works on server and in tests). */
export function parseDsn(xml: string): { dishes: DsnDish[]; timeUtc?: number } {
  const dishes: DsnDish[] = [];
  let station = "";
  let timeUtc: number | undefined;
  const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const tokens = xml.match(/<station [^>]*\/>|<dish [^>]*>[\s\S]*?<\/dish>/g) ?? [];
  for (const tok of tokens) {
    if (tok.startsWith("<station")) {
      const a = attrs(tok);
      station = a.friendlyName ?? a.name;
      timeUtc = Number(a.timeUTC) || timeUtc;
      continue;
    }
    const head = attrs(tok.slice(0, tok.indexOf(">")));
    const targets = [...tok.matchAll(/<target [^>]*\/>/g)]
      .map((m) => attrs(m[0]))
      .filter((t) => t.name && t.name !== "DSN" && t.name !== "DSS" && Number(t.rtlt) > 0)
      .map((t) => ({ name: t.name, rtltSec: Number(t.rtlt), rangeKm: Number(t.downlegRange) }));
    const down = [...tok.matchAll(/<downSignal [^>]*\/>/g)]
      .map((m) => attrs(m[0]))
      .filter((s) => s.spacecraft)
      .map((s) => ({ spacecraft: s.spacecraft, rateBps: Number(s.dataRate) || 0, band: s.band, active: s.active === "true" }));
    const up = [...tok.matchAll(/<upSignal [^>]*\/>/g)]
      .map((m) => attrs(m[0]))
      .filter((s) => s.spacecraft)
      .map((s) => ({ spacecraft: s.spacecraft, band: s.band, active: s.active === "true" }));
    dishes.push({ station, dish: head.name, activity: head.activity ?? "", azimuth: Number(head.azimuthAngle) || 0, elevation: Number(head.elevationAngle) || 0, targets, down, up });
  }
  return { dishes, timeUtc };
}

/** Friendly names for common DSN spacecraft codes. */
export const SPACECRAFT: Record<string, string> = {
  MSL: "Curiosity rover",
  M20: "Perseverance rover",
  MRO: "Mars Reconnaissance Orbiter",
  MVN: "MAVEN",
  ODY: "Mars Odyssey",
  TGO: "ExoMars TGO",
  MEX: "Mars Express",
  JWST: "James Webb Space Telescope",
  SPP: "Parker Solar Probe",
  VGR1: "Voyager 1",
  VGR2: "Voyager 2",
  JNO: "Juno",
  STA: "STEREO-A",
  SOHO: "SOHO",
  RST: "Roman Space Telescope",
  ESCG: "ESCAPADE",
  LRO: "Lunar Reconnaissance Orbiter",
  EM1: "Artemis / Orion",
  EMM: "Hope (UAE)",
  PSYC: "Psyche",
  LUCY: "Lucy",
  NHPC: "New Horizons",
  CHDR: "Chandra",
  KPLO: "Danuri (KPLO)",
  CAPS: "CAPSTONE",
  EURC: "Europa Clipper",
};

export const MARS_CRAFT = new Set(["MSL", "M20", "MRO", "MVN", "ODY", "TGO", "MEX", "EMM"]);
