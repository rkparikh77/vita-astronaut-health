"use client";

import { ExternalLink, Radio, Siren } from "lucide-react";
import { useMission } from "@/lib/store";

export function SpaceWeatherPanel({ compact = false }: { compact?: boolean }) {
  const { weather, drills } = useMission();
  const events = weather?.events ?? [];
  return (
    <section className="panel ticks p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title flex items-center gap-2">
          <Radio size={13} /> Space weather · NASA DONKI
        </h2>
        {weather ? (
          <span className={`font-data text-[10px] uppercase tracking-widest ${weather.live ? "text-nominal" : "text-watch"}`}>
            {weather.live ? "● Live" : "○ Offline"}
          </span>
        ) : (
          <span className="font-data text-[10px] uppercase tracking-widest text-ink-3">Connecting…</span>
        )}
      </div>

      {weather && !weather.live && (
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Can&apos;t reach DONKI right now ({weather.error}). Radiation uses baseline dose rates. Run a drill on the
          Radiation page to rehearse a solar storm.
        </p>
      )}

      {drills.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
          <Siren size={14} /> SEP drill active: {drills[drills.length - 1].severity} event, mission day {drills[drills.length - 1].day}
        </div>
      )}

      {weather?.live && events.length === 0 && <p className="mt-3 text-sm text-ink-2">Quiet sun: no M/X flares or particle events in the last {weather.windowDays} days.</p>}

      <ul className="mt-3 space-y-2">
        {events.slice(0, compact ? 4 : 12).map((e) => (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span
              className="font-data mt-0.5 rounded px-1.5 py-0.5 text-[10px]"
              style={{
                color: e.type === "SEP" ? "var(--critical)" : e.classType?.startsWith("X") ? "var(--action)" : "var(--watch)",
                background: "var(--panel-2)",
              }}
            >
              {e.type === "SEP" ? "SEP" : e.classType}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-ink">{e.detail}</div>
              <div className="font-data text-[11px] text-ink-3">{new Date(e.time).toUTCString().slice(5, 22)} UTC</div>
            </div>
            {e.link && (
              <a href={e.link} target="_blank" rel="noreferrer" className="text-ink-3 hover:text-ink" aria-label="Open in DONKI">
                <ExternalLink size={13} />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
