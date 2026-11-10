export interface ProtocolTask {
  id: string;
  label: string;
  window: "morning" | "midday" | "evening";
  indicators: string[];
  minutes: number;
  /** "daily" or every 7th mission day. */
  cadence: "daily" | "weekly";
  xp: number;
}

export const PROTOCOL: ProtocolTask[] = [
  { id: "wake_vitals", label: "Wake-up vitals: heart rate, blood pressure, SpO₂, temperature", window: "morning", indicators: ["heart_rate", "systolic_bp", "diastolic_bp", "spo2", "body_temp", "resp_rate"], minutes: 5, cadence: "daily", xp: 20 },
  { id: "sleep_log", label: "Log last night's sleep", window: "morning", indicators: ["sleep_hours"], minutes: 1, cadence: "daily", xp: 10 },
  { id: "glucose", label: "Fasting blood glucose", window: "morning", indicators: ["glucose"], minutes: 2, cadence: "daily", xp: 15 },
  { id: "pvt", label: "1-minute reaction test", window: "midday", indicators: ["pvt_ms"], minutes: 1, cadence: "daily", xp: 25 },
  { id: "mood", label: "Mood & stress check-in", window: "evening", indicators: ["mood", "stress"], minutes: 1, cadence: "daily", xp: 10 },
  { id: "exercise", label: "Log exercise & hydration", window: "evening", indicators: ["exercise_min", "hydration"], minutes: 1, cadence: "daily", xp: 15 },
  { id: "weekly_mass", label: "Body mass measurement", window: "morning", indicators: ["body_mass_pct"], minutes: 3, cadence: "weekly", xp: 20 },
  { id: "weekly_vision", label: "Vision self-check (Amsler grid)", window: "midday", indicators: ["vision_score"], minutes: 2, cadence: "weekly", xp: 20 },
];

const WINDOW_HOUR: Record<ProtocolTask["window"], [number, number]> = {
  morning: [6, 10],
  midday: [11, 15],
  evening: [18, 22],
};

export function tasksForDay(day: number): ProtocolTask[] {
  return PROTOCOL.filter((t) => t.cadence === "daily" || day % 7 === 0);
}

export type TaskState = "done" | "due" | "overdue" | "upcoming";

export function taskState(task: ProtocolTask, done: Set<string>, hour: number): TaskState {
  if (done.has(task.id)) return "done";
  const [start, end] = WINDOW_HOUR[task.window];
  if (hour < start) return "upcoming";
  if (hour > end) return "overdue";
  return "due";
}

/** Which protocol task an indicator belongs to. */
export function taskForIndicator(indicatorId: string): ProtocolTask | undefined {
  return PROTOCOL.find((t) => t.indicators.includes(indicatorId));
}
