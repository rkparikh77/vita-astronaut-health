// Emergency playground: physically grounded habitat emergencies with crew physiology.
// Pure state machine (step + act) so the 3D view, tests and the AI copilot all see the same simulation.

export type ZoneId = "lab" | "galley" | "exercise" | "hatch" | "medbay" | "shelter";
export type ScenarioId = "sep" | "depress" | "co2" | "fire" | "cardiac";

/** Two modules joined by a hatch. Module A: lab, galley, exercise. Module B: medbay, storm shelter. */
export const ZONES: Record<ZoneId, { label: string; module: "A" | "B" | "node"; x: number; z: number }> = {
  exercise: { label: "Exercise (ARED)", module: "A", x: -11, z: 0.8 },
  galley: { label: "Galley", module: "A", x: -7, z: -0.8 },
  lab: { label: "Lab", module: "A", x: -3, z: 0.8 },
  hatch: { label: "Hatch", module: "node", x: 0, z: 0 },
  medbay: { label: "Medical bay", module: "B", x: 4, z: -0.8 },
  shelter: { label: "Storm shelter", module: "B", x: 9, z: 0.8 },
};

const TRANSLATE_M_S = 0.5; // crew translation speed in microgravity

export interface CrewSim {
  id: string;
  name: string;
  zone: ZoneId;
  from: ZoneId;
  moveStart: number;
  moveEnd: number;
  mask: boolean;
  conscious: boolean;
  /** True arterial O2 saturation (%). */
  sao2: number;
  /** What a pulse oximeter shows (%) — it can't tell carboxyhemoglobin from oxyhemoglobin. */
  spo2Reading: number;
  cohb: number;
  hr: number;
  rr: number;
  doseMsv: number;
  lowO2Sec: number;
  arrest?: { since: number; cpr: boolean; cprAt?: number; aclsAt?: number; shocks: number; rosc: boolean };
}

export interface Habitat {
  pressureA: number; // kPa
  pressureB: number;
  o2Frac: number;
  co2: number; // mmHg
  smoke: number; // 0..1 in module A
  fire: boolean;
  hatchClosed: boolean;
  leakAreaM2: number;
  leakPatched: boolean;
  scrubber: "on" | "failed" | "backup";
  radiationMsvH: number; // unsheltered dose rate inside the hull
  ventilation: boolean;
}

export interface LogEntry {
  t: number;
  text: string;
  kind: "alarm" | "action" | "event" | "outcome";
}

export interface ActionDef {
  id: string;
  label: string;
  hint: string;
  /** Seconds of crew effort before the effect lands. */
  takes?: number;
}

export interface SimState {
  scenario: ScenarioId;
  t: number;
  hab: Habitat;
  crew: CrewSim[];
  log: LogEntry[];
  done: string[];
  pending: { id: string; at: number }[];
  ended: boolean;
  outcome?: Debrief;
  /** One-way light time to Earth (s): the flight-surgeon consult takes 2× this plus review. */
  oneWaySec: number;
  surgeonReplyAt?: number;
}

export interface Debrief {
  grade: "A" | "B" | "C" | "D" | "F";
  headline: string;
  metrics: { label: string; value: string; good: boolean }[];
  lessons: string[];
}

// --- Physiology ---

const WATER_VAPOR_KPA = 6.3;
/** Oxyhemoglobin saturation from inspired O2 partial pressure (kPa), fit to altitude-hypoxia data. */
const SAT_TABLE: [number, number][] = [
  [3, 30], [4.5, 45], [6.6, 62], [8, 72], [9.3, 79], [11, 85], [13.3, 90], [16, 94], [19.95, 98], [30, 99], [60, 100],
];
export function saturationFromPiO2(pio2: number): number {
  if (pio2 <= SAT_TABLE[0][0]) return SAT_TABLE[0][1];
  for (let i = 1; i < SAT_TABLE.length; i++) {
    const [x1, y1] = SAT_TABLE[i];
    const [x0, y0] = SAT_TABLE[i - 1];
    if (pio2 <= x1) return y0 + ((pio2 - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 100;
}

export function pio2(pressureKpa: number, fio2: number): number {
  return Math.max(0, (pressureKpa - WATER_VAPOR_KPA) * fio2);
}

/**
 * Choked (sonic) flow through a hole: dp/dt = -p / τ with τ = V / (Cd · A · c*),
 * c* = sqrt(γRT)·(2/(γ+1))^((γ+1)/(2(γ−1))) ≈ 200 m/s for air at 295 K.
 */
export function leakTau(volumeM3: number, holeAreaM2: number, cd = 0.6): number {
  const gamma = 1.4;
  const R = 287;
  const T = 295;
  const cStar = Math.sqrt(gamma * R * T) * Math.pow(2 / (gamma + 1), (gamma + 1) / (2 * (gamma - 1)));
  return volumeM3 / (cd * holeAreaM2 * cStar);
}

/** CO2 build-up (mmHg/s) from crew metabolism with scrubbing off: ~1 kg CO2 per person per day. */
export function co2RiseMmHgPerSec(crewCount: number, volumeM3: number): number {
  const kgPerSec = (crewCount * 1.0) / 86400;
  const kpaPerSec = ((kgPerSec / 0.044) * 8.314 * 295) / volumeM3 / 1000;
  return kpaPerSec * 7.50062;
}

/**
 * Survival to hospital discharge after witnessed VF arrest (Larsen et al. 1993, Ann Emerg Med):
 * 67% − 2.3%/min to CPR − 1.1%/min to defibrillation − 2.1%/min to advanced life support.
 * With nothing done that is the familiar ~5.5%/min.
 */
export function arrestSurvival(minToCpr: number, minToDefib: number, minToAcls: number): number {
  return Math.max(0, Math.min(0.67, 0.67 - 0.023 * minToCpr - 0.011 * minToDefib - 0.021 * minToAcls));
}

const VOL_A = 110; // m³
const VOL_B = 75;
const SEA_LEVEL = 101.3;

// --- Scenario catalog ---

export interface ScenarioDef {
  id: ScenarioId;
  title: string;
  tagline: string;
  brief: string;
  timeScale: number; // sim seconds per real second
  maxSec: number;
  science: string;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "sep",
    title: "Solar particle storm",
    tagline: "Protons arriving in minutes. Get to the shelter.",
    brief: "An X-class flare has launched a solar particle event toward the vehicle. Inside the thin hull the dose rate will climb to tens of mSv per hour. The storm shelter's water walls cut it by about 85%.",
    timeScale: 120,
    maxSec: 6 * 3600,
    science: "Dose rate and shelter factor follow NASA storm-shelter design studies; peak unshielded-hull rate set to 40 mSv/h for a major event.",
  },
  {
    id: "depress",
    title: "Hull breach",
    tagline: "Orbital debris punched a 4 cm hole in Module A.",
    brief: "Cabin pressure in Module A is falling. Below ~50 kPa, crew without oxygen lose useful consciousness within minutes. Close the hatch to save Module B, get masks on, and decide whether to patch.",
    timeScale: 20,
    maxSec: 3600,
    science: "Pressure decays by choked flow through the hole (τ = V / CdAc*); saturation from inspired O₂ pressure on the altitude-hypoxia curve.",
  },
  {
    id: "co2",
    title: "CO₂ scrubber failure",
    tagline: "The carbon dioxide removal assembly just tripped.",
    brief: "Four crew exhale about 4 kg of CO₂ a day: roughly 9 mmHg of rise per day in this habitat with no scrubbing. A slow-burn emergency: hours to act, but symptoms (headache, faster breathing, slower thinking) start well before Earth limits.",
    timeScale: 2400,
    maxSec: 36 * 3600,
    science: "CO₂ rise = metabolic production (~1 kg/person/day) as ideal gas in 185 m³ (≈0.38 mmHg/h); symptom thresholds from NASA-STD-3001 Vol 2.",
  },
  {
    id: "fire",
    title: "Electrical fire",
    tagline: "Smoke detector in the lab rack.",
    brief: "Smoke is filling Module A. Carbon monoxide binds hemoglobin 200× more strongly than oxygen, and a pulse oximeter can't tell the difference: it will read normal while the crew suffocates.",
    timeScale: 10,
    maxSec: 1800,
    science: "COHb uptake scaled to smoke density; pulse oximetry reads (SaO₂ + COHb), the clinical CO pitfall.",
  },
  {
    id: "cardiac",
    title: "Cardiac arrest",
    tagline: "The Commander collapses at the exercise device.",
    brief: "Ventricular fibrillation. With nothing done, survival falls ~5.5% a minute. The flight surgeon is a round-trip of light-time away: the crew must lead the resuscitation themselves.",
    timeScale: 4,
    maxSec: 1200,
    science: "Survival model from Larsen et al. 1993 (Ann Emerg Med); microgravity CPR via the Evetts–Russomano and reverse-bearhug methods.",
  },
];

export const SCENARIO_MAP = Object.fromEntries(SCENARIOS.map((s) => [s.id, s])) as Record<ScenarioId, ScenarioDef>;

const CREW_START: { id: string; name: string; zone: ZoneId }[] = [
  { id: "vega", name: "Vega", zone: "exercise" },
  { id: "okafor", name: "Okafor", zone: "galley" },
  { id: "lindqvist", name: "Lindqvist", zone: "lab" },
  { id: "tanaka", name: "Tanaka", zone: "lab" },
];

export function createSim(scenario: ScenarioId, oneWaySec = 600): SimState {
  const hab: Habitat = {
    pressureA: SEA_LEVEL,
    pressureB: SEA_LEVEL,
    o2Frac: 0.21,
    co2: 2.2,
    smoke: 0,
    fire: scenario === "fire",
    hatchClosed: false,
    leakAreaM2: scenario === "depress" ? Math.PI * 0.02 ** 2 : 0,
    leakPatched: false,
    scrubber: scenario === "co2" ? "failed" : "on",
    radiationMsvH: 0.08,
    ventilation: true,
  };
  const crew: CrewSim[] = CREW_START.map((c) => ({
    ...c,
    from: c.zone,
    moveStart: 0,
    moveEnd: 0,
    mask: false,
    conscious: true,
    sao2: 98,
    spo2Reading: 98,
    cohb: 1,
    hr: 68,
    rr: 14,
    doseMsv: 0,
    lowO2Sec: 0,
    ...(scenario === "cardiac" && c.id === "vega" ? { conscious: false, hr: 0, rr: 0, arrest: { since: 0, cpr: false, shocks: 0, rosc: false } } : {}),
  }));
  const def = SCENARIO_MAP[scenario];
  return {
    scenario,
    t: 0,
    hab,
    crew,
    log: [{ t: 0, kind: "alarm", text: def.tagline }],
    done: [],
    pending: [],
    ended: false,
    oneWaySec,
  };
}

// --- Actions ---

const ACTIONS: Record<ScenarioId, ActionDef[]> = {
  sep: [
    { id: "shelter", label: "All crew to storm shelter", hint: "Move everyone behind the water walls in Module B." },
    { id: "finish_task", label: "Finish current tasks first", hint: "Keep working for one more hour before sheltering." },
    { id: "dosimeters", label: "Activate personal dosimeters", hint: "Start logging individual dose for the flight surgeon.", takes: 60 },
    { id: "consult", label: "Message the flight surgeon", hint: "Their reply takes a light-time round trip." },
  ],
  depress: [
    { id: "masks", label: "Masks on (100% O₂)", hint: "Portable breathing apparatus for everyone in Module A.", takes: 30 },
    { id: "evacuate", label: "Evacuate to Module B", hint: "Move all crew through the hatch." },
    { id: "close_hatch", label: "Close the hatch", hint: "Seal Module B. Anyone left in A stays in A.", takes: 20 },
    { id: "patch", label: "Patch the breach", hint: "Two crew in Module A apply a hull patch kit (takes 5 min).", takes: 300 },
    { id: "consult", label: "Message the flight surgeon", hint: "Their reply takes a light-time round trip." },
  ],
  co2: [
    { id: "backup", label: "Install LiOH backup canisters", hint: "Chemical CO₂ absorbers from stowage (takes 15 min).", takes: 900 },
    { id: "fans", label: "Maximize ventilation fans", hint: "Stops CO₂ pockets forming around the crew." },
    { id: "rest", label: "Stand down from exercise", hint: "Halves CO₂ production while resting." },
    { id: "masks", label: "Masks on (100% O₂)", hint: "Clean air while the fix is underway.", takes: 30 },
    { id: "consult", label: "Message the flight surgeon", hint: "Their reply takes a light-time round trip." },
  ],
  fire: [
    { id: "masks", label: "Masks on (100% O₂)", hint: "Clean air for everyone.", takes: 30 },
    { id: "vent_off", label: "Shut ventilation in Module A", hint: "Starves the fire and stops smoke spreading.", takes: 10 },
    { id: "extinguish", label: "CO₂ extinguisher on the rack", hint: "One crew member with a mask puts out the fire (raises cabin CO₂).", takes: 45 },
    { id: "evacuate", label: "Evacuate to Module B", hint: "Move all crew through the hatch." },
    { id: "close_hatch", label: "Close the hatch", hint: "Keep smoke out of Module B.", takes: 20 },
    { id: "co_check", label: "Check CO with the analyzer", hint: "Measures carbon monoxide directly, unlike the pulse oximeter.", takes: 20 },
  ],
  cardiac: [
    { id: "cpr", label: "Start CPR", hint: "Restrain the patient; compressions using the Evetts–Russomano position.", takes: 15 },
    { id: "aed", label: "Fetch AED and shock", hint: "Defibrillator from the medical bay (crew must fetch it first).", takes: 90 },
    { id: "epi", label: "Give epinephrine (IV)", hint: "From the advanced life support pack.", takes: 120 },
    { id: "consult", label: "Message the flight surgeon", hint: "Their reply takes a light-time round trip." },
  ],
};

export function actionsFor(s: SimState): ActionDef[] {
  return ACTIONS[s.scenario].filter((a) => !s.done.includes(a.id) || a.id === "aed");
}

function moveTo(c: CrewSim, zone: ZoneId, t: number) {
  if (!c.conscious || c.zone === zone) return;
  const a = ZONES[c.zone];
  const b = ZONES[zone];
  const dist = Math.hypot(a.x - b.x, a.z - b.z);
  c.from = c.zone;
  c.zone = zone;
  c.moveStart = t;
  c.moveEnd = t + dist / TRANSLATE_M_S;
}

export function isMoving(c: CrewSim, t: number) {
  return t < c.moveEnd;
}

/** Interpolated (x, z) position for rendering. */
export function crewPosition(c: CrewSim, t: number): [number, number] {
  const b = ZONES[c.zone];
  if (t >= c.moveEnd || c.moveEnd === c.moveStart) return [b.x, b.z];
  const a = ZONES[c.from];
  const f = (t - c.moveStart) / (c.moveEnd - c.moveStart);
  const e = f * f * (3 - 2 * f);
  return [a.x + (b.x - a.x) * e, a.z + (b.z - a.z) * e];
}

const clone = (s: SimState): SimState => ({
  ...s,
  hab: { ...s.hab },
  crew: s.crew.map((c) => ({ ...c, arrest: c.arrest ? { ...c.arrest } : undefined })),
  log: [...s.log],
  done: [...s.done],
  pending: [...s.pending],
});

export function act(state: SimState, id: string): SimState {
  if (state.ended) return state;
  const s = clone(state);
  const def = ACTIONS[s.scenario].find((a) => a.id === id);
  if (!def) return state;
  s.done.push(id);
  s.log.push({ t: s.t, kind: "action", text: def.label });
  const conscious = s.crew.filter((c) => c.conscious);

  switch (id) {
    case "shelter":
      conscious.forEach((c) => moveTo(c, "shelter", s.t));
      break;
    case "finish_task":
      s.pending.push({ id: "shelter_late", at: s.t + 3600 });
      break;
    case "evacuate":
      conscious.forEach((c) => moveTo(c, c.id === "vega" ? "shelter" : "medbay", s.t));
      break;
    case "consult":
      s.surgeonReplyAt = s.t + 2 * s.oneWaySec + 300;
      s.log.push({ t: s.t, kind: "event", text: `Report sent. Earliest reply in ${Math.round((2 * s.oneWaySec + 300) / 60)} min.` });
      break;
    case "fans":
    case "rest":
      break;
    case "cpr":
    case "aed": {
      // The crew medical officer leads; someone fetches the AED from the medical bay.
      const rescuer = s.crew.find((c) => c.id === "tanaka")!;
      moveTo(rescuer, "exercise", s.t);
      if (id === "aed") {
        const runner = s.crew.find((c) => c.id === "okafor")!;
        moveTo(runner, "medbay", s.t);
      }
      s.pending.push({ id, at: s.t + (def.takes ?? 0) + (id === "cpr" ? Math.max(0, rescuer.moveEnd - s.t) : 0) });
      break;
    }
    default:
      s.pending.push({ id, at: s.t + (def.takes ?? 0) });
  }
  return s;
}

function landEffect(s: SimState, id: string) {
  const h = s.hab;
  switch (id) {
    case "masks":
      s.crew.forEach((c) => (c.mask = true));
      s.log.push({ t: s.t, kind: "event", text: "Masks on: everyone breathing 100% oxygen." });
      break;
    case "close_hatch":
      h.hatchClosed = true;
      s.log.push({ t: s.t, kind: "event", text: `Hatch sealed. ${s.crew.filter((c) => ZONES[c.zone].module === "A").length} crew still in Module A.` });
      break;
    case "patch": {
      const inA = s.crew.filter((c) => c.conscious && ZONES[c.zone].module === "A" && c.mask).length;
      if (inA >= 2) {
        h.leakPatched = true;
        s.log.push({ t: s.t, kind: "event", text: "Breach patched. Pressure holding." });
      } else s.log.push({ t: s.t, kind: "event", text: "Patch failed: needs two masked crew in Module A." });
      break;
    }
    case "backup":
      h.scrubber = "backup";
      s.log.push({ t: s.t, kind: "event", text: "LiOH canisters installed. CO₂ falling." });
      break;
    case "vent_off":
      h.ventilation = false;
      s.log.push({ t: s.t, kind: "event", text: "Ventilation off in Module A: fire growth slows, smoke stops spreading." });
      break;
    case "extinguish":
      if (s.crew.some((c) => c.conscious && c.mask && ZONES[c.zone].module === "A")) {
        h.fire = false;
        h.co2 += 6;
        s.log.push({ t: s.t, kind: "event", text: "Fire out. Extinguisher added CO₂ to the cabin." });
      } else s.log.push({ t: s.t, kind: "event", text: "No masked crew in Module A to fight the fire." });
      break;
    case "co_check": {
      const worst = Math.max(...s.crew.map((c) => c.cohb));
      s.log.push({ t: s.t, kind: "event", text: `CO analyzer: COHb up to ${worst.toFixed(0)}%. Pulse oximeters read ${Math.round(Math.max(...s.crew.map((c) => c.spo2Reading)))}% but true saturation is lower.` });
      break;
    }
    case "dosimeters":
      s.log.push({ t: s.t, kind: "event", text: "Dosimeters logging." });
      break;
    case "shelter_late":
      s.crew.filter((c) => c.conscious).forEach((c) => moveTo(c, "shelter", s.t));
      s.log.push({ t: s.t, kind: "event", text: "Tasks finished. Crew heading to the shelter." });
      break;
    case "cpr": {
      const p = s.crew.find((c) => c.arrest);
      if (p?.arrest && !p.arrest.rosc) {
        p.arrest.cpr = true;
        p.arrest.cprAt = s.t;
        s.log.push({ t: s.t, kind: "event", text: "CPR running (Evetts–Russomano position)." });
      }
      break;
    }
    case "aed": {
      const p = s.crew.find((c) => c.arrest);
      if (!p?.arrest || p.arrest.rosc) break;
      p.arrest.shocks++;
      const minutes = (s.t - p.arrest.since) / 60;
      const surv = predictedSurvival(p, s.t);
      // Deterministic for teaching: a shock works if predicted survival is still above 35%, or on a 2nd shock above 25%.
      if (surv > 0.35 || (p.arrest.shocks >= 2 && surv > 0.25)) {
        p.arrest.rosc = true;
        p.conscious = false;
        p.hr = 96;
        p.rr = 10;
        s.log.push({ t: s.t, kind: "event", text: `Shock delivered: return of spontaneous circulation at ${minutes.toFixed(1)} min.` });
      } else s.log.push({ t: s.t, kind: "event", text: `Shock delivered: still in VF (predicted survival ${(surv * 100).toFixed(0)}%). Continue CPR, shock again.` });
      break;
    }
    case "epi": {
      const p = s.crew.find((c) => c.arrest);
      if (p?.arrest && p.arrest.aclsAt === undefined) p.arrest.aclsAt = s.t;
      s.log.push({ t: s.t, kind: "event", text: "Epinephrine 1 mg IV given (advanced life support)." });
      break;
    }
  }
}

/** Larsen survival if the patient were defibrillated now, given when CPR and ALS started (or not yet). */
export function predictedSurvival(c: CrewSim, t: number): number {
  if (!c.arrest) return 1;
  const m = (x?: number) => ((x ?? t) - c.arrest!.since) / 60;
  return arrestSurvival(m(c.arrest.cprAt), m(t), m(c.arrest.aclsAt));
}

export function step(state: SimState, dt: number): SimState {
  if (state.ended) return state;
  const s = clone(state);
  const h = s.hab;
  const def = SCENARIO_MAP[s.scenario];
  s.t += dt;

  // Scheduled effects
  for (const p of [...s.pending]) {
    if (s.t >= p.at) {
      landEffect(s, p.id);
      s.pending.splice(s.pending.indexOf(p), 1);
    }
  }
  if (s.surgeonReplyAt && s.t >= s.surgeonReplyAt) {
    s.log.push({ t: s.t, kind: "event", text: "Flight surgeon's reply arrived from Earth." });
    s.surgeonReplyAt = undefined;
  }

  // --- Habitat physics ---
  if (s.scenario === "depress" && !h.leakPatched) {
    const tauA = leakTau(h.hatchClosed ? VOL_A : VOL_A + VOL_B, h.leakAreaM2);
    h.pressureA *= Math.exp(-dt / tauA);
    if (!h.hatchClosed) h.pressureB = h.pressureA;
  }
  if (s.scenario === "sep") {
    // Storm onset at ~10 min, peak at 1 h, decays over hours.
    const hrs = s.t / 3600;
    const profile = s.t < 600 ? 0 : Math.min(1, (hrs - 1 / 6) / (5 / 6)) * Math.exp(-Math.max(0, hrs - 1) / 2.5);
    h.radiationMsvH = 0.08 + 40 * profile;
  }
  const crewCount = s.crew.length;
  if (h.scrubber === "failed") {
    const resting = s.done.includes("rest");
    h.co2 += co2RiseMmHgPerSec(crewCount * (resting ? 0.6 : 1), VOL_A + VOL_B) * dt;
  } else if (h.scrubber === "backup") h.co2 = Math.max(2.5, h.co2 - 0.004 * dt);
  if (s.scenario === "fire") {
    if (h.fire) h.smoke = Math.min(1, h.smoke + (h.ventilation ? 0.0025 : 0.0009) * dt);
    else h.smoke = Math.max(0, h.smoke - 0.0008 * dt);
  }

  // --- Crew physiology ---
  for (const c of s.crew) {
    const mod = ZONES[c.zone].module === "B" && h.hatchClosed ? "B" : ZONES[c.zone].module === "A" || !h.hatchClosed ? "A" : "B";
    const p = mod === "B" ? h.pressureB : h.pressureA;
    const fio2 = c.mask ? 1 : h.o2Frac;
    let sat = saturationFromPiO2(pio2(p, fio2));
    // CO2: mild hypercapnia raises breathing and heart rate.
    const co2 = h.co2;
    const smokeHere = mod === "A" && !(h.hatchClosed && ZONES[c.zone].module === "B") ? h.smoke : h.hatchClosed ? 0 : h.smoke * 0.6;
    if (!c.mask) c.cohb = Math.min(70, c.cohb + smokeHere * 0.06 * dt);
    else c.cohb = Math.max(1, c.cohb - 0.01 * dt);
    sat = Math.max(0, sat - Math.max(0, c.cohb - 1));
    c.sao2 = sat;
    c.spo2Reading = Math.min(100, sat + Math.max(0, c.cohb - 1)); // pulse-ox cannot see COHb

    if (c.arrest && !c.arrest.rosc) {
      c.hr = 0;
      c.rr = 0;
      c.sao2 = c.arrest.cpr ? 70 : 30;
      c.spo2Reading = NaN;
    } else if (c.conscious || c.arrest?.rosc) {
      c.hr = Math.round(68 + Math.max(0, 96 - sat) * 1.1 + Math.max(0, co2 - 4) * 0.9 + (isMoving(c, s.t) ? 8 : 0));
      c.rr = Math.round(14 + Math.max(0, co2 - 3) * 0.45 + Math.max(0, 92 - sat) * 0.2);
    }
    c.lowO2Sec = c.sao2 < 65 ? c.lowO2Sec + dt : Math.max(0, c.lowO2Sec - dt);
    if (c.conscious && c.lowO2Sec > 25) {
      c.conscious = false;
      s.log.push({ t: s.t, kind: "alarm", text: `${c.name} has lost consciousness (SaO₂ ${Math.round(c.sao2)}%).` });
    }
    if (!c.conscious && !c.arrest && c.sao2 > 85 && c.lowO2Sec === 0) {
      c.conscious = true;
      s.log.push({ t: s.t, kind: "event", text: `${c.name} is conscious again.` });
    }
    // Radiation: the shelter's water walls stop ~85%; Module B elsewhere ~30%.
    const shield = isMoving(c, s.t) ? 1 : c.zone === "shelter" ? 0.15 : ZONES[c.zone].module === "B" ? 0.7 : 1;
    c.doseMsv += (h.radiationMsvH * shield * dt) / 3600;
  }

  // Alarms on thresholds (once each)
  const once = (key: string, cond: boolean, text: string) => {
    if (cond && !s.log.some((l) => l.text === text)) s.log.push({ t: s.t, kind: "alarm", text });
    void key;
  };
  once("p70", h.pressureA < 70, "Module A pressure below 70 kPa.");
  once("p50", h.pressureA < 50, "Module A pressure below 50 kPa: hypoxia without masks.");
  once("co2_8", h.co2 > 8, "CO₂ above 8 mmHg: headaches and faster breathing expected.");
  once("co2_15", h.co2 > 15, "CO₂ above 15 mmHg: impaired thinking.");
  once("sep_peak", h.radiationMsvH > 20, "Proton flux peaking: dose rate above 20 mSv/h in the open cabin.");

  // End conditions
  const arrest = s.crew.find((c) => c.arrest);
  const resolved =
    (s.scenario === "fire" && !h.fire && h.smoke < 0.05) ||
    (s.scenario === "co2" && h.scrubber === "backup" && h.co2 < 4) ||
    (s.scenario === "depress" && (h.leakPatched || (h.hatchClosed && s.crew.every((c) => !c.conscious || ZONES[c.zone].module === "B")))) ||
    (s.scenario === "cardiac" && !!arrest?.arrest?.rosc) ||
    (s.scenario === "sep" && s.t > 3 * 3600 && h.radiationMsvH < 5);
  const lost = s.scenario === "cardiac" && arrest?.arrest && !arrest.arrest.rosc && s.t - arrest.arrest.since > 20 * 60;
  if (resolved || lost || s.t >= def.maxSec) {
    s.ended = true;
    s.outcome = debrief(s, !!resolved);
    s.log.push({ t: s.t, kind: "outcome", text: s.outcome.headline });
  }
  return s;
}

function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

function firstAction(s: SimState, id: string) {
  return s.log.find((l) => l.kind === "action" && ACTIONS[s.scenario].find((a) => a.id === id)?.label === l.text)?.t;
}

export function debrief(s: SimState, resolved: boolean): Debrief {
  const lessons: string[] = [];
  const metrics: Debrief["metrics"] = [{ label: "Time", value: mmss(s.t), good: resolved }];
  let score = resolved ? 80 : 40;
  const minSat = Math.min(...s.crew.filter((c) => !c.arrest).map((c) => c.sao2));
  const unconscious = s.crew.filter((c) => !c.conscious && !c.arrest).length;

  if (s.scenario === "sep") {
    const total = s.crew.reduce((a, c) => a + c.doseMsv, 0) / s.crew.length;
    const worstCase = 108; // mSv: unsheltered dose over this storm profile
    metrics.push({ label: "Mean crew dose", value: `${total.toFixed(1)} mSv`, good: total < 20 });
    metrics.push({ label: "Dose avoided vs no shelter", value: `${Math.max(0, (1 - total / worstCase) * 100).toFixed(0)}%`, good: total < 20 });
    const tShelter = firstAction(s, "shelter");
    metrics.push({ label: "Shelter ordered", value: tShelter !== undefined ? `T+${mmss(tShelter)}` : "never", good: tShelter !== undefined && tShelter < 900 });
    score += total < 20 ? 20 : total < 35 ? 0 : -30;
    if (s.done.includes("finish_task")) lessons.push("Finishing tasks first cost real dose: proton flux peaks within the hour.");
    lessons.push("On a Mars transit there is no magnetosphere: shelter early, the forecast lead time is minutes to hours.");
  }
  if (s.scenario === "depress") {
    metrics.push({ label: "Lowest Module A pressure", value: `${s.hab.pressureA.toFixed(0)} kPa`, good: s.hab.pressureA > 60 });
    metrics.push({ label: "Lowest crew SaO₂", value: `${Math.round(minSat)}%`, good: minSat > 85 });
    metrics.push({ label: "Crew who lost consciousness", value: String(unconscious), good: unconscious === 0 });
    score += minSat > 85 ? 15 : -20;
    score -= unconscious * 20;
    if (!s.done.includes("masks")) lessons.push("Masks first: oxygen buys the time to diagnose and patch.");
    if (s.hab.hatchClosed && s.crew.some((c) => ZONES[c.zone].module === "A")) lessons.push("Closing the hatch with crew still in Module A traps them with the leak.");
    lessons.push(`This 4 cm hole gives a pressure time constant of ~${Math.round(leakTau(VOL_A + VOL_B, s.hab.leakAreaM2) / 60)} min with the hatch open: breaches are survivable when the crew acts methodically, not instantly fatal as in films.`);
  }
  if (s.scenario === "co2") {
    metrics.push({ label: "Peak CO₂", value: `${s.hab.co2.toFixed(1)} mmHg`, good: s.hab.co2 < 10 });
    const t = firstAction(s, "backup");
    metrics.push({ label: "Backup scrubbing started", value: t !== undefined ? `T+${mmss(t)}` : "never", good: t !== undefined && t < 1200 });
    score += s.hab.co2 < 10 ? 15 : -15;
    lessons.push("CO₂ symptoms (headache, poor focus) start far below Earth limits, at 3–4 mmHg in microgravity where exhaled gas pools.");
    if (s.done.includes("rest")) lessons.push("Standing down from exercise was smart: it cuts CO₂ production sharply.");
  }
  if (s.scenario === "fire") {
    const maxCo = Math.max(...s.crew.map((c) => c.cohb));
    metrics.push({ label: "Peak carboxyhemoglobin", value: `${maxCo.toFixed(0)}%`, good: maxCo < 15 });
    metrics.push({ label: "Lowest true SaO₂", value: `${Math.round(minSat)}%`, good: minSat > 85 });
    score += maxCo < 15 ? 15 : -20;
    if (!s.done.includes("co_check")) lessons.push("Pulse oximeters can't see carbon monoxide. Only the CO analyzer showed the real danger.");
    if (!s.done.includes("vent_off")) lessons.push("Cutting ventilation starves the fire and keeps smoke in one module.");
  }
  if (s.scenario === "cardiac") {
    const p = s.crew.find((c) => c.arrest)!;
    const tCpr = firstAction(s, "cpr");
    const tAed = firstAction(s, "aed");
    metrics.push({ label: "CPR started", value: tCpr !== undefined ? `T+${mmss(tCpr)}` : "never", good: tCpr !== undefined && tCpr < 60 });
    metrics.push({ label: "First shock", value: tAed !== undefined ? `T+${mmss(tAed + 90)}` : "never", good: tAed !== undefined && tAed < 240 });
    metrics.push({ label: "Outcome", value: p.arrest?.rosc ? "Circulation restored" : "No return of circulation", good: !!p.arrest?.rosc });
    score += p.arrest?.rosc ? 20 : -40;
    lessons.push(`The flight surgeon's earliest reply was ${Math.round((2 * s.oneWaySec + 300) / 60)} min away: in an arrest, the crew is the only help.`);
    if (tCpr === undefined || tCpr > 60) lessons.push("Each minute before CPR costs 2.3% survival on top of 1.1%/min until the shock and 2.1%/min until advanced life support (Larsen 1993).");
  }
  const grade = score >= 95 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "F";
  const headline = resolved ? `Emergency resolved at T+${mmss(s.t)} · grade ${grade}` : `Emergency not resolved · grade ${grade}`;
  return { grade, headline, metrics, lessons };
}
