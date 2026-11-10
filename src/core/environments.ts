export type EnvironmentId = "iss" | "gateway" | "lunar_base" | "lunar_rover" | "mars_transit" | "mars_base";

export interface MissionEnvironment {
  id: EnvironmentId;
  name: string;
  short: string;
  gravityG: number;
  /** Typical effective dose rate behind normal shielding, mSv/day. */
  doseRate: number;
  doseSource: string;
  /** One-way light-time to Earth in seconds: [min, max]. */
  commsDelaySec: [number, number];
  /** Days to get a sick crew member to a hospital on Earth. */
  evacuationDays: string;
  /** How much of a solar particle event reaches the crew (magnetosphere / planet shielding). */
  sepExposure: number;
  notes: string;
}

export const ENVIRONMENTS: MissionEnvironment[] = [
  {
    id: "iss",
    name: "International Space Station",
    short: "ISS",
    gravityG: 0,
    doseRate: 0.5,
    doseSource: "ISS dosimetry, ~0.3–0.8 mSv/day depending on solar cycle",
    commsDelaySec: [0.5, 0.5],
    evacuationDays: "< 1 day",
    sepExposure: 0.1,
    notes: "Inside Earth's magnetic field. Near real-time contact with flight surgeons.",
  },
  {
    id: "gateway",
    name: "Lunar Gateway (NRHO)",
    short: "Gateway",
    gravityG: 0,
    doseRate: 1.3,
    doseSource: "Deep-space GCR estimate behind habitat shielding",
    commsDelaySec: [1.3, 1.3],
    evacuationDays: "~5 days",
    sepExposure: 1,
    notes: "Outside the magnetosphere: solar storms hit at full strength. Storm shelter required.",
  },
  {
    id: "lunar_base",
    name: "Lunar south pole base",
    short: "Moon base",
    gravityG: 0.166,
    doseRate: 1.37,
    doseSource: "Chang'e-4 LND surface measurement, 1.37 mSv/day (Zhang 2020)",
    commsDelaySec: [1.3, 1.3],
    evacuationDays: "~5–7 days",
    sepExposure: 0.5,
    notes: "The Moon blocks half the sky. Regolith-covered habitats cut dose further.",
  },
  {
    id: "lunar_rover",
    name: "Pressurized lunar rover",
    short: "Rover",
    gravityG: 0.166,
    doseRate: 1.37,
    doseSource: "Lunar surface rate with thin rover shielding",
    commsDelaySec: [1.3, 2.0],
    evacuationDays: "~6–8 days",
    sepExposure: 0.6,
    notes: "Limited medical kit; relay gaps behind terrain. Return to base for anything beyond first aid.",
  },
  {
    id: "mars_transit",
    name: "Mars transit vehicle",
    short: "Mars transit",
    gravityG: 0,
    doseRate: 1.84,
    doseSource: "MSL RAD cruise measurement, 1.84 mSv/day (Zeitlin 2013)",
    commsDelaySec: [180, 1320],
    evacuationDays: "No return possible for months",
    sepExposure: 1,
    notes: "Crew is fully autonomous. Messages to the flight surgeon take 3–22 minutes each way.",
  },
  {
    id: "mars_base",
    name: "Mars surface base",
    short: "Mars base",
    gravityG: 0.38,
    doseRate: 0.64,
    doseSource: "MSL RAD Gale Crater surface, 0.64 mSv/day (Hassler 2014)",
    commsDelaySec: [180, 1320],
    evacuationDays: "No return possible for months",
    sepExposure: 0.3,
    notes: "Atmosphere and planet give some shielding. Dust storms and conjunction blackouts cut comms.",
  },
];

export const ENV_MAP: Record<EnvironmentId, MissionEnvironment> = Object.fromEntries(
  ENVIRONMENTS.map((e) => [e.id, e]),
) as Record<EnvironmentId, MissionEnvironment>;

export function formatDelay(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)} s`;
  return `${Math.round(sec / 60)} min`;
}

export function delayRange(env: MissionEnvironment): string {
  const [a, b] = env.commsDelaySec;
  return a === b ? formatDelay(a) : `${formatDelay(a)}–${formatDelay(b)}`;
}
