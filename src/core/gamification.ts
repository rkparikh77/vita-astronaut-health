import { PROTOCOL, tasksForDay } from "./protocol";

/** Completed protocol task ids per mission day. */
export type CompletionLog = Record<number, string[]>;

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
}

export interface Progress {
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  streak: number;
  badges: Badge[];
}

export const XP_PER_LEVEL = 400;
export const FULL_DAY_BONUS = 50;

export function dayComplete(log: CompletionLog, day: number): boolean {
  const done = new Set(log[day] ?? []);
  return tasksForDay(day).every((t) => done.has(t.id));
}

/** Consecutive fully completed days ending at `today` (today counts only if complete). */
export function streak(log: CompletionLog, today: number): number {
  let d = dayComplete(log, today) ? today : today - 1;
  let n = 0;
  while (d >= 1 && dayComplete(log, d)) {
    n++;
    d--;
  }
  return n;
}

export function progress(log: CompletionLog, today: number, extras: { bestPvt?: number; goodSleepNights?: number } = {}): Progress {
  let xp = 0;
  let fullDays = 0;
  for (const [dayStr, ids] of Object.entries(log)) {
    const day = Number(dayStr);
    for (const id of new Set(ids)) xp += PROTOCOL.find((t) => t.id === id)?.xp ?? 0;
    if (dayComplete(log, day)) {
      xp += FULL_DAY_BONUS;
      fullDays++;
    }
  }
  const s = streak(log, today);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const badges: Badge[] = [
    { id: "first_light", name: "First Light", description: "Complete your first check-in", earned: Object.values(log).some((v) => v.length > 0) },
    { id: "full_day", name: "Full Protocol", description: "Finish every task in one day", earned: fullDays >= 1 },
    { id: "iron_week", name: "Iron Week", description: "7-day protocol streak", earned: s >= 7 },
    { id: "sharp_mind", name: "Sharp Mind", description: "Reaction test under 250 ms", earned: (extras.bestPvt ?? Infinity) < 250 },
    { id: "sleep_guardian", name: "Sleep Guardian", description: "5 nights of 7+ hours sleep", earned: (extras.goodSleepNights ?? 0) >= 5 },
  ];
  return { xp, level, levelXp: xp % XP_PER_LEVEL, nextLevelXp: XP_PER_LEVEL, streak: s, badges };
}
