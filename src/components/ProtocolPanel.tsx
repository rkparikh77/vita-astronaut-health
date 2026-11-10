"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Clock, Trophy } from "lucide-react";
import { progress } from "@/core/gamification";
import { getIndicator } from "@/core/indicators";
import { tasksForDay, taskState, type ProtocolTask } from "@/core/protocol";
import type { Reading } from "@/core/types";
import { useMission } from "@/lib/store";
import { ReactionTest } from "./ReactionTest";

const STATE_STYLE = {
  done: { color: "var(--nominal)", label: "Done" },
  due: { color: "var(--watch)", label: "Due now" },
  overdue: { color: "var(--action)", label: "Overdue" },
  upcoming: { color: "var(--ink-3)", label: "Later" },
};

export function ProtocolPanel({
  crewId,
  readings,
  onLogged,
}: {
  crewId: string;
  readings: Reading[];
  onLogged?: (indicators: string[]) => void;
}) {
  const { log, today, record, bestPvt } = useMission();
  const [open, setOpen] = useState<string>();
  const [hour, setHour] = useState(9);
  const [toast, setToast] = useState<string>();
  useEffect(() => setHour(new Date().getHours()), []);

  const crewLog = log[crewId] ?? {};
  const done = new Set(crewLog[today] ?? []);
  const tasks = tasksForDay(today);
  const goodSleep = readings.filter((r) => r.indicator === "sleep_hours" && r.value >= 7).length;
  const prog = progress(crewLog, today, { bestPvt: bestPvt[crewId], goodSleepNights: goodSleep });

  const submit = (task: ProtocolTask, vals: { indicator: string; value: number }[]) => {
    record(crewId, vals, task.id);
    onLogged?.(vals.map((v) => v.indicator));
    setOpen(undefined);
    setToast(`+${task.xp} XP · ${task.label.split(":")[0]}`);
    setTimeout(() => setToast(undefined), 2200);
  };

  return (
    <section className="panel ticks p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Today&apos;s protocol · Day {today}</h2>
        <span className="font-data text-xs text-ink-2">
          {done.size}/{tasks.length}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Level" value={prog.level} />
        <Stat label="XP" value={prog.xp} />
        <Stat label="Streak" value={`${prog.streak}d`} />
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-gradient-to-r from-nominal to-watch transition-all duration-700" style={{ width: `${(prog.levelXp / prog.nextLevelXp) * 100}%` }} />
      </div>

      <ul className="mt-4 space-y-2">
        {tasks.map((t) => {
          const st = taskState(t, done, hour);
          const sty = STATE_STYLE[st];
          const isOpen = open === t.id;
          return (
            <li key={t.id} className="rounded-lg border border-line bg-bg-2/60">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? undefined : t.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                aria-expanded={isOpen}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border" style={{ borderColor: sty.color, background: st === "done" ? sty.color : "transparent" }}>
                  {st === "done" && <Check size={12} color="var(--bg)" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${st === "done" ? "text-ink-3" : "text-ink"}`}>{t.label}</span>
                  <span className="font-data flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: sty.color }}>
                    <Clock size={10} /> {t.window} · {sty.label} · {t.minutes} min · +{t.xp} XP
                  </span>
                </span>
                <ChevronDown size={14} className={`text-ink-3 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-line px-3 py-3">
                  {t.id === "pvt" ? (
                    <ReactionTest onCancel={() => setOpen(undefined)} onComplete={(ms) => submit(t, [{ indicator: "pvt_ms", value: ms }])} />
                  ) : (
                    <TaskForm task={t} onSubmit={(v) => submit(t, v)} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5">
        <h3 className="panel-title flex items-center gap-2">
          <Trophy size={12} /> Badges
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {prog.badges.map((b) => (
            <span
              key={b.id}
              title={b.description}
              className="font-data rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider"
              style={{
                borderColor: b.earned ? "var(--watch)" : "var(--line)",
                color: b.earned ? "var(--watch)" : "var(--ink-3)",
                background: b.earned ? "color-mix(in srgb, var(--watch) 10%, transparent)" : "transparent",
              }}
            >
              {b.earned ? "★ " : ""}
              {b.name}
            </span>
          ))}
        </div>
      </div>

      {toast && (
        <div role="status" className="rise fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-watch/50 bg-panel-2 px-5 py-2.5 text-sm font-semibold text-watch shadow-2xl">
          {toast}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-bg-2/60 px-3 py-2">
      <div className="panel-title text-[9px]">{label}</div>
      <div className="font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}

const SCALES: Record<string, { value: number; label: string; color?: string }[]> = {
  mood: [
    { value: 1, label: "😞" },
    { value: 2, label: "🙁" },
    { value: 3, label: "😐" },
    { value: 4, label: "🙂" },
    { value: 5, label: "😄" },
  ],
  stress: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
  vision_score: [0, 1, 2, 3].map((v) => ({ value: v, label: String(v) })),
  hydration: ["#f6f3d0", "#f3ec9e", "#efe16c", "#e9d23f", "#ddb92a", "#c99a1f", "#a97618", "#7d5310"].map((c, i) => ({ value: i + 1, label: String(i + 1), color: c })),
};

function TaskForm({ task, onSubmit }: { task: ProtocolTask; onSubmit: (v: { indicator: string; value: number }[]) => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const errors = task.indicators.map((id) => {
    const ind = getIndicator(id);
    const raw = vals[id];
    if (raw === undefined || raw === "") return `${ind.name} is required`;
    const v = Number(raw);
    if (Number.isNaN(v) || v < ind.range[0] || v > ind.range[1]) return `${ind.name} must be ${ind.range[0]}–${ind.range[1]} ${ind.unit}`;
    return null;
  });
  const valid = errors.every((e) => !e);
  const touched = Object.keys(vals).length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(task.indicators.map((id) => ({ indicator: id, value: Number(vals[id]) })));
      }}
      className="space-y-3"
    >
      {task.indicators.map((id) => {
        const ind = getIndicator(id);
        const scale = SCALES[id];
        return (
          <div key={id}>
            <label className="flex items-baseline justify-between text-xs text-ink-2" htmlFor={`f-${id}`}>
              <span>{ind.name}</span>
              <span className="font-data text-ink-3">{ind.unit}</span>
            </label>
            {scale ? (
              <div className="mt-1 flex gap-1.5" role="radiogroup" aria-label={ind.name}>
                {scale.map((o) => {
                  const sel = vals[id] === String(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setVals((v) => ({ ...v, [id]: String(o.value) }))}
                      className="font-data h-9 flex-1 rounded-md border text-sm transition"
                      style={{
                        background: o.color ?? (sel ? "var(--panel-2)" : "transparent"),
                        borderColor: sel ? "var(--nominal)" : "var(--line)",
                        color: o.color ? "#222" : "var(--ink)",
                        outline: sel ? "2px solid var(--nominal)" : undefined,
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                id={`f-${id}`}
                inputMode="decimal"
                type="number"
                step={ind.decimals ? 1 / 10 ** ind.decimals : 1}
                value={vals[id] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [id]: e.target.value }))}
                className="font-data mt-1 w-full rounded-md border border-line-2 bg-bg px-3 py-2 text-sm text-ink"
                placeholder={`${ind.range[0]}–${ind.range[1]}`}
              />
            )}
            <details className="mt-1 text-[11px] text-ink-3">
              <summary className="cursor-pointer hover:text-ink-2">How to measure</summary>
              <p className="mt-1 leading-relaxed">{ind.howTo}</p>
            </details>
          </div>
        );
      })}
      {touched && !valid && <p className="text-xs text-action">{errors.find(Boolean)}</p>}
      <button type="submit" disabled={!valid} className="w-full rounded-lg bg-nominal py-2 text-sm font-semibold text-bg transition disabled:opacity-30">
        Log & assess
      </button>
    </form>
  );
}
