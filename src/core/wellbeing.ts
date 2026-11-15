// Private wellbeing check-in. Screens: PHQ-2 (Kroenke 2003) and GAD-2 (Kroenke 2007), both free to use, scored 0–6.
// A score of 3 or more is the standard cut-point for a positive screen that warrants a follow-up conversation.
// This is a screening aid for a crew's own use, not a diagnosis.

export const FREQ = ["Not at all", "Several days", "More than half the days", "Nearly every day"] as const;

export const PHQ2 = ["Little interest or pleasure in doing things", "Feeling down, depressed, or hopeless"];
export const GAD2 = ["Feeling nervous, anxious, or on edge", "Not being able to stop or control worrying"];

export type Sharing = "private" | "summary" | "full";

export interface CheckIn {
  crewId: string;
  day: number;
  phq: [number, number];
  gad: [number, number];
  sleepQuality: number; // 1–5
  cohesion: number; // 1–5: how well the crew is getting along
  workload: number; // 1–5
  sharing: Sharing;
  note?: string;
}

export interface CheckInResult {
  phq2: number;
  gad2: number;
  positive: { depression: boolean; anxiety: boolean };
  /** Shared automatically only when a serious-risk threshold is crossed. */
  autoEscalate: boolean;
  /** What the flight surgeon actually sees. */
  visibleToSurgeon: string;
  suggestions: string[];
}

export function score(c: CheckIn, history: CheckIn[] = []): CheckInResult {
  const phq2 = c.phq[0] + c.phq[1];
  const gad2 = c.gad[0] + c.gad[1];
  const positive = { depression: phq2 >= 3, anxiety: gad2 >= 3 };
  // Serious-risk threshold: maximal PHQ-2, or a positive depression screen on two check-ins in a row.
  const prev = history.filter((h) => h.crewId === c.crewId && h.day < c.day).sort((a, b) => b.day - a.day)[0];
  const sustained = positive.depression && !!prev && prev.phq[0] + prev.phq[1] >= 3;
  const autoEscalate = phq2 === 6 || sustained;

  const suggestions: string[] = [];
  if (positive.depression || positive.anxiety) suggestions.push("Book an earlier private conference with behavioral health. It stays between you and them.");
  if (c.sleepQuality <= 2) suggestions.push("Protect tonight's sleep: lights at the sleep-shift setting, no screens 30 min before, earplugs and eye mask.");
  if (c.workload >= 4) suggestions.push("Workload is high: ask the commander to move a non-critical task, and take your full exercise and meal breaks.");
  if (c.cohesion <= 2) suggestions.push("Crew friction is normal on long missions. A shared meal or a crew debrief helps; you can also raise it privately.");
  if (gad2 >= 2) suggestions.push("Try two minutes of paced breathing (below).");
  suggestions.push("Record a message for family: on this leg, live calls aren't possible but video messages are.");

  const visibleToSurgeon =
    c.sharing === "full"
      ? "Your answers and note"
      : c.sharing === "summary"
        ? "Scores only (no answers, no note)"
        : autoEscalate
          ? "A flag that a follow-up is needed (no answers, no note), because a serious-risk threshold was crossed"
          : "Nothing";
  return { phq2, gad2, positive, autoEscalate, visibleToSurgeon, suggestions };
}

/** ISS crews have a Private Psychological Conference about every two weeks. */
export function nextConference(day: number, requestedEarlier = false) {
  const next = Math.ceil((day + 1) / 14) * 14;
  return requestedEarlier ? day + 1 : next;
}
