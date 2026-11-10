"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SpaceWeather } from "@/app/api/space-weather/route";
import { crewState, getCrew, MISSION, type CrewState } from "@/core/crew";
import type { EnvironmentId } from "@/core/environments";
import type { CompletionLog } from "@/core/gamification";
import { classifyFlare, type SepEvent } from "@/core/radiation";
import type { Reading } from "@/core/types";
import { tasksForDay } from "@/core/protocol";
import { countermeasures, odometer, readiness, sleep } from "@/core/scores";

interface Persisted {
  env: EnvironmentId;
  entries: Record<string, Reading[]>;
  log: Record<string, CompletionLog>;
  drills: SepEvent[];
  bestPvt: Record<string, number>;
}

const DEFAULT: Persisted = { env: "mars_transit", entries: {}, log: {}, drills: [], bestPvt: {} };
const KEY = "vita.v1";

interface Store extends Persisted {
  today: number;
  setEnv: (e: EnvironmentId) => void;
  record: (crewId: string, readings: { indicator: string; value: number }[], taskId?: string) => void;
  triggerDrill: (severity: SepEvent["severity"], sheltered: boolean) => void;
  clearDrills: () => void;
  reset: () => void;
  weather?: SpaceWeather;
  sepEvents: SepEvent[];
  hydrated: boolean;
}

const Ctx = createContext<Store | null>(null);

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function MissionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);
  const [weather, setWeather] = useState<SpaceWeather>();
  const today = MISSION.currentDay;

  useEffect(() => {
    setState(load());
    setHydrated(true);
    fetch("/api/space-weather")
      .then((r) => r.json())
      .then(setWeather)
      .catch(() => setWeather({ live: false, fetchedAt: new Date().toISOString(), windowDays: 30, events: [], error: "offline" }));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: state just won't persist */
    }
  }, [state, hydrated]);

  const setEnv = useCallback((env: EnvironmentId) => setState((s) => ({ ...s, env })), []);

  const record = useCallback(
    (crewId: string, readings: { indicator: string; value: number }[], taskId?: string) => {
      setState((s) => {
        const prev = (s.entries[crewId] ?? []).filter(
          (r) => !(r.day === today && readings.some((n) => n.indicator === r.indicator)),
        );
        const next = [...prev, ...readings.map((r) => ({ ...r, day: today, source: "self" as const }))];
        const crewLog = { ...(s.log[crewId] ?? {}) };
        if (taskId) crewLog[today] = [...new Set([...(crewLog[today] ?? []), taskId])];
        const pvt = readings.find((r) => r.indicator === "pvt_ms")?.value;
        const bestPvt = { ...s.bestPvt };
        if (pvt !== undefined) bestPvt[crewId] = Math.min(bestPvt[crewId] ?? Infinity, pvt);
        return { ...s, entries: { ...s.entries, [crewId]: next }, log: { ...s.log, [crewId]: crewLog }, bestPvt };
      });
    },
    [today],
  );

  const triggerDrill = useCallback(
    (severity: SepEvent["severity"], sheltered: boolean) =>
      setState((s) => ({
        ...s,
        drills: [...s.drills.filter((d) => d.day !== today), { day: today, severity, shelterFactor: sheltered ? 0.8 : 0 }],
      })),
    [today],
  );
  const clearDrills = useCallback(() => setState((s) => ({ ...s, drills: [] })), []);
  const reset = useCallback(() => setState({ ...DEFAULT }), []);

  // Live DONKI events mapped onto mission days: "today" on the mission is today's date.
  const sepEvents = useMemo<SepEvent[]>(() => {
    const live: SepEvent[] = (weather?.events ?? [])
      .filter((e) => e.type === "SEP")
      .map((e) => {
        const daysAgo = Math.floor((Date.now() - new Date(e.time).getTime()) / 86400000);
        const flare = weather?.events.find((f) => f.type === "FLR" && Math.abs(new Date(f.time).getTime() - new Date(e.time).getTime()) < 2 * 86400000);
        return { day: Math.max(1, today - daysAgo), severity: classifyFlare(flare?.classType) };
      });
    return [...live, ...state.drills];
  }, [weather, state.drills, today]);

  const value = useMemo<Store>(
    () => ({ ...state, today, setEnv, record, triggerDrill, clearDrills, reset, weather, sepEvents, hydrated }),
    [state, today, setEnv, record, triggerDrill, clearDrills, reset, weather, sepEvents, hydrated],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMission(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useMission outside MissionProvider");
  return s;
}

export function useCrewState(id: string): CrewState | undefined {
  const { env, entries, sepEvents } = useMission();
  return useMemo(() => {
    const p = getCrew(id);
    return p ? crewState(p, env, { extraReadings: entries[id], sepEvents }) : undefined;
  }, [id, env, entries, sepEvents]);
}

/** Wearable-style daily scores for a crew member, recomputed whenever their data changes. */
export function useScores(state: CrewState | undefined) {
  const { log, today } = useMission();
  return useMemo(() => {
    if (!state) return undefined;
    const done = (log[state.profile.id]?.[today] ?? []).length;
    const total = tasksForDay(today).length;
    const ex = state.readings.filter((r) => r.indicator === "exercise_min" && r.day > today - 30).map((r) => r.value);
    const adherence = ex.length ? Math.min(1, ex.reduce((a, b) => a + b, 0) / ex.length / 120) : 0.8;
    return {
      readiness: readiness(state.readings, today),
      sleep: sleep(state.readings, today),
      countermeasures: countermeasures(state.readings, today, done, total),
      odometer: odometer(state.env, today, state.dose.cumulative - state.profile.priorDoseMsv, adherence),
      adherence,
    };
  }, [state, log, today]);
}
