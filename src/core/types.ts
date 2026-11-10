export type Status = "nominal" | "watch" | "action" | "critical" | "unknown";

export const STATUS_RANK: Record<Status, number> = {
  unknown: -1,
  nominal: 0,
  watch: 1,
  action: 2,
  critical: 3,
};

export function worst(...s: Status[]): Status {
  return s.reduce<Status>((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a), "unknown");
}

/** NASA Human Research Program — the five hazards of human spaceflight. */
export type Hazard = "radiation" | "isolation" | "distance" | "gravity" | "environment";

export const HAZARDS: Record<Hazard, { name: string; blurb: string }> = {
  radiation: { name: "Space radiation", blurb: "Galactic cosmic rays and solar particle events raise cancer, CNS and cardiovascular risk." },
  isolation: { name: "Isolation & confinement", blurb: "Small crews in tight quarters for months strain sleep, mood and teamwork." },
  distance: { name: "Distance from Earth", blurb: "Communication delays and no quick return mean the crew must act on its own." },
  gravity: { name: "Altered gravity", blurb: "Fluid shifts, bone and muscle loss, and vision changes (SANS)." },
  environment: { name: "Hostile closed environment", blurb: "Cabin CO₂, noise, microbes and confined air quality affect every system." },
};

export type BodySystem =
  | "neuro"
  | "vision"
  | "cardio"
  | "respiratory"
  | "metabolic"
  | "musculoskeletal"
  | "immune";

export const BODY_SYSTEMS: Record<BodySystem, { name: string; organ: string; blurb: string }> = {
  neuro: { name: "Brain & behavior", organ: "Brain", blurb: "Sleep, mood, stress and alertness. Isolation and disrupted light cycles wear these down first." },
  vision: { name: "Eyes", organ: "Eyes", blurb: "Spaceflight-associated neuro-ocular syndrome (SANS) can swell the optic disc and blur vision." },
  cardio: { name: "Heart & circulation", organ: "Heart", blurb: "Fluids shift toward the head; the heart works less and can lose conditioning." },
  respiratory: { name: "Lungs & air", organ: "Lungs", blurb: "Oxygen saturation and breathing, plus the cabin CO₂ the crew is breathing." },
  metabolic: { name: "Metabolism & kidneys", organ: "Abdomen", blurb: "Blood sugar, hydration, body mass, and kidney load from bone calcium." },
  musculoskeletal: { name: "Bones & muscle", organ: "Legs", blurb: "Without load, weight-bearing bone loses ~1–1.5% per month. Exercise is the countermeasure." },
  immune: { name: "Blood & immunity", organ: "Blood", blurb: "Immune cells shift in flight and dormant viruses can reactivate. Red cells break down faster (space anemia)." },
};

export interface Reading {
  indicator: string;
  value: number;
  day: number; // mission day (1-based)
  source: "sensor" | "self" | "lab" | "sim";
}
