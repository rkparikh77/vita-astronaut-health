"use client";

import Link from "next/link";
import { ArrowUpRight, FlaskConical, Gauge, Orbit, Radiation, Sparkles, Timer } from "lucide-react";
import { SpaceWeatherPanel } from "@/components/SpaceWeatherPanel";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { Sparkline } from "@/components/TrendChart";
import { CountUp, DataBadge, ScoreRing } from "@/components/viz";
import { MISSION, type CrewState } from "@/core/crew";
import { delayRange, ENV_MAP } from "@/core/environments";
import { escalate } from "@/core/escalation";
import { getIndicator, formatValue } from "@/core/indicators";
import { tasksForDay } from "@/core/protocol";
import { CAREER_LIMIT_MSV } from "@/core/radiation";
import type { Score } from "@/core/scores";
import { BODY_SYSTEMS, STATUS_RANK, worst, type BodySystem, type Status } from "@/core/types";
import { useCrewState, useMission, useScores } from "@/lib/store";
import { initials, STATUS_COLOR } from "@/lib/ui";

export default function Overview() {
  const { env, log, today, reset } = useMission();
  const e = ENV_MAP[env];
  const states = [useCrewState("vega"), useCrewState("okafor"), useCrewState("lindqvist"), useCrewState("tanaka")];
  const scores = [useScores(states[0]), useScores(states[1]), useScores(states[2]), useScores(states[3])];
  const avgReadiness = Math.round(scores.reduce((a, s) => a + (s?.readiness.value ?? 0), 0) / scores.length);
  const alerts = states.reduce((a, s) => a + (s?.assessments.filter((x) => STATUS_RANK[x.status] >= 2).length ?? 0), 0);
  const watches = states.reduce((a, s) => a + (s?.assessments.filter((x) => x.status === "watch").length ?? 0), 0);
  const missionDose = states.reduce((a, s) => a + ((s?.dose.cumulative ?? 0) - (s?.profile.priorDoseMsv ?? 0)), 0) / states.length;
  const readingsLogged = states.reduce((a, s) => a + (s?.readings.length ?? 0), 0);
  const avgScore: Score = { value: avgReadiness, band: avgReadiness >= 85 ? "optimal" : avgReadiness >= 70 ? "good" : avgReadiness >= 55 ? "fair" : "low", contributors: [] };

  return (
    <div className="pt-8">
      <section className="rise grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div>
          <p className="panel-title">{MISSION.name}</p>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.88] sm:text-7xl xl:text-8xl">
            Crew health
            <br />
            <span className="bg-gradient-to-r from-ink-3 to-ink-2 bg-clip-text text-transparent">{e.short}</span>
          </h1>
          <p className="mt-4 max-w-xl text-ink-2">{e.notes}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/research" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
              <FlaskConical size={14} /> Explore real astronaut data
            </Link>
            <Link href="/atlas" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-4 py-2 text-sm text-ink-2 hover:text-ink">
              <Sparkles size={14} /> What space does to a body
            </Link>
          </div>
        </div>
        <OrbitHero score={avgScore} env={e.short} />
      </section>

      {/* Mission telemetry strip */}
      <section className="rise mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6" style={{ animationDelay: "80ms" }}>
        <Telemetry icon={<Orbit size={13} />} label="Gravity" text={e.gravityG === 0 ? "Micro-g" : `${e.gravityG} g`} />
        <Telemetry icon={<Radiation size={13} />} label="Mission dose / crew" value={missionDose} unit="mSv" />
        <Telemetry icon={<Timer size={13} />} label="Comms delay" text={delayRange(e)} />
        <Telemetry icon={<Gauge size={13} />} label="Evacuation" text={e.evacuationDays} small />
        <Telemetry label="Open alerts" value={alerts} unit={`+ ${watches} watch`} color={alerts ? "var(--action)" : undefined} />
        <Telemetry label="Readings analysed" value={readingsLogged} />
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {states.map((s, i) =>
          s ? <CrewCard key={s.profile.id} s={s} scores={scores[i]} delay={i * 80} done={(log[s.profile.id]?.[today] ?? []).length} total={tasksForDay(today).length} /> : null,
        )}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <SpaceWeatherPanel compact />
        <div className="panel ticks p-5">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">How to read VITA</h2>
            <div className="flex gap-1">
              <DataBadge kind="real" />
              <DataBadge kind="sim" />
            </div>
          </div>
          <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {(["nominal", "watch", "action", "critical"] as Status[]).map((st) => (
              <li key={st} className="flex gap-3">
                <StatusDot status={st} size={10} />
                <div>
                  <div className="font-medium capitalize" style={{ color: STATUS_COLOR[st] }}>
                    {st}
                  </div>
                  <div className="text-ink-3">
                    {
                      {
                        nominal: "Within your personal normal range.",
                        watch: "Drifting from your baseline or trending toward a limit. Self-care and recheck.",
                        action: "Outside safe range. Act today with the crew medical officer.",
                        critical: "Act now. VITA routes you to help, accounting for the comms delay.",
                      }[st as "nominal"]
                    }
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-4 text-xs text-ink-3">
            Lab baselines are real preflight blood draws of the four Inspiration4 crew (NASA OSDR OSD-569, OSD-575). Day-to-day vitals are
            simulated on top of them using published spaceflight effects. Crew names are fictional.{" "}
            <Link href="/about" className="text-ink-2 underline-offset-2 hover:underline">
              Where every number comes from →
            </Link>
          </p>
          <button type="button" onClick={reset} className="font-data mt-3 text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink">
            ↺ Reset demo data
          </button>
        </div>
      </section>
    </div>
  );
}

function OrbitHero({ score, env }: { score: Score; env: string }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[380px]">
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="planet" cx="40%" cy="35%">
            <stop offset="0" stopColor="#1c2a3b" />
            <stop offset="1" stopColor="#0a0f16" />
          </radialGradient>
        </defs>
        {[190, 160, 130].map((r, i) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="var(--line)" strokeDasharray={i === 1 ? "2 6" : undefined} />
        ))}
        <g style={{ transformOrigin: "200px 200px", animation: "spin 24s linear infinite" }}>
          <circle cx="390" cy="200" r="5" fill="var(--nominal)" />
          <circle cx="390" cy="200" r="12" fill="var(--nominal)" opacity="0.15" />
        </g>
        <g style={{ transformOrigin: "200px 200px", animation: "spin 40s linear infinite reverse" }}>
          <circle cx="200" cy="40" r="3.5" fill="var(--watch)" />
        </g>
        <circle cx="200" cy="200" r="104" fill="url(#planet)" stroke="var(--line-2)" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center">
          <ScoreRing score={score} label={`Crew readiness · ${env}`} size={170} stroke={11} />
        </div>
      </div>
    </div>
  );
}

function Telemetry({ icon, label, value, unit, text, color, small }: { icon?: React.ReactNode; label: string; value?: number; unit?: string; text?: string; color?: string; small?: boolean }) {
  return (
    <div className="bg-bg-2 px-4 py-3.5">
      <div className="panel-title flex items-center gap-1.5 text-[9px]">
        {icon} {label}
      </div>
      <div className={`font-display mt-1 font-extrabold ${small ? "text-lg leading-tight" : "text-2xl"}`} style={{ color }}>
        {value !== undefined ? <CountUp value={value} className="font-display" /> : text}
        {unit && <span className="font-data ml-1 text-[10px] font-normal text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

function CrewCard({ s, scores, delay, done, total }: { s: CrewState; scores: ReturnType<typeof useScores>; delay: number; done: number; total: number }) {
  const { profile, assessments, overall, dose, env } = s;
  const flagged = assessments
    .filter((a) => STATUS_RANK[a.status] > 0)
    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])
    .slice(0, 3);
  const systems = Object.keys(BODY_SYSTEMS).map((sys) => {
    const st = worst(...assessments.filter((a) => getIndicator(a.indicator).system === sys).map((a) => a.status));
    return [sys as BodySystem, st] as const;
  });
  const esc = escalate(assessments, env, { patientIsCmo: /medical officer/i.test(profile.role) });
  const hrv = s.readings.filter((r) => r.indicator === "hrv").slice(-21).map((r) => r.value);
  const c = STATUS_COLOR[overall];

  return (
    <Link
      href={`/crew/${profile.id}`}
      className="panel ticks rise group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-line-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-4">
        <div
          className={`font-display grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl font-extrabold ${overall === "critical" ? "pulse-critical" : ""}`}
          style={{ border: `2px solid ${c}`, boxShadow: `0 0 24px color-mix(in srgb, ${c} 30%, transparent)`, color: c }}
        >
          {initials(profile.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-data text-[10px] uppercase tracking-[0.18em] text-ink-3">
            {profile.callsign} · {profile.osdrId}
          </div>
          <div className="truncate text-lg font-semibold">{profile.name}</div>
          <div className="truncate text-xs text-ink-3">{profile.role}</div>
        </div>
        <ArrowUpRight size={18} className="text-ink-3 transition group-hover:text-ink" />
      </div>

      {scores && (
        <div className="mt-4 grid grid-cols-3 gap-1">
          <ScoreRing score={scores.readiness} label="Ready" size={74} stroke={6} />
          <ScoreRing score={scores.sleep} label="Sleep" size={74} stroke={6} />
          <ScoreRing score={scores.countermeasures} label="Counter" size={74} stroke={6} />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <StatusPill status={overall} />
        <div className="flex gap-1.5" aria-label="Body systems">
          {systems.map(([sys, st]) => (
            <span key={sys} title={`${BODY_SYSTEMS[sys].name}: ${st}`}>
              <StatusDot status={st} size={7} />
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm font-medium" style={{ color: overall === "nominal" ? "var(--ink-2)" : c }}>
        {esc.headline}
      </p>

      <ul className="mt-2 min-h-[72px] space-y-1.5">
        {flagged.length === 0 && <li className="text-sm text-ink-3">No flags today.</li>}
        {flagged.map((a) => {
          const ind = getIndicator(a.indicator);
          return (
            <li key={a.indicator} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-ink-2">
                <StatusDot status={a.status} size={6} />
                <span className="truncate">{ind.name}</span>
              </span>
              <span className="font-data shrink-0 text-ink">
                {formatValue(a.indicator, a.latest?.value)} <span className="text-ink-3">{ind.unit}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="panel-title">HRV · 21 d</span>
          <span className="font-data text-ink-3">
            {Math.round(dose.cumulative)} / {CAREER_LIMIT_MSV} mSv
          </span>
        </div>
        <Sparkline values={hrv} color={c} />
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-2" title="Today's protocol">
          <div className="h-full rounded-full bg-nominal transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <div className="font-data mt-1 text-[10px] text-ink-3">
          Protocol {done}/{total} today
        </div>
      </div>
    </Link>
  );
}
