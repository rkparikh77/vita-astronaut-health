"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Stethoscope, TrendingDown, TrendingUp, UserRound, Satellite } from "lucide-react";
import { BodyMap } from "@/components/BodyMap";
import { ProtocolPanel } from "@/components/ProtocolPanel";
import { TodayPanel } from "@/components/TodayPanel";
import { LabPanel } from "@/components/LabPanel";
import { MedicalProfilePanel } from "@/components/MedicalProfilePanel";
import { DataBadge } from "@/components/viz";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { TrendChart } from "@/components/TrendChart";
import type { Assessment } from "@/core/assess";
import { thresholdsFor, type CrewState } from "@/core/crew";
import { escalate } from "@/core/escalation";
import { formatValue, getIndicator } from "@/core/indicators";
import { BODY_SYSTEMS, HAZARDS, STATUS_RANK, worst, type BodySystem } from "@/core/types";
import { useCrewState } from "@/lib/store";
import { initials, STATUS_COLOR, STATUS_MEANING } from "@/lib/ui";

export default function CrewPage() {
  const { id } = useParams<{ id: string }>();
  const s = useCrewState(id);
  if (!s) return <p className="pt-10 text-ink-2">Unknown crew member.</p>;
  return <CrewView key={id} s={s} />;
}

function CrewView({ s }: { s: CrewState }) {
  const { profile, assessments, overall, env } = s;
  const bySystem = useMemo(() => {
    const out = {} as Record<BodySystem, Assessment[]>;
    for (const sys of Object.keys(BODY_SYSTEMS) as BodySystem[]) out[sys] = [];
    for (const a of assessments) out[getIndicator(a.indicator).system].push(a);
    return out;
  }, [assessments]);
  const systemStatus = useMemo(
    () => Object.fromEntries(Object.entries(bySystem).map(([k, v]) => [k, worst(...v.map((a) => a.status))])) as Record<BodySystem, ReturnType<typeof worst>>,
    [bySystem],
  );
  const worstFirst = [...assessments].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const [system, setSystem] = useState<BodySystem>(getIndicator(worstFirst[0].indicator).system);
  const [selected, setSelected] = useState<string>(worstFirst[0].indicator);
  const esc = escalate(assessments, env, { patientIsCmo: /medical officer/i.test(profile.role) });
  const c = STATUS_COLOR[overall];

  const pickSystem = (sys: BodySystem) => {
    setSystem(sys);
    const first = [...bySystem[sys]].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0];
    if (first) setSelected(first.indicator);
  };

  const current = assessments.find((a) => a.indicator === selected)!;

  return (
    <div className="pt-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> Crew
      </Link>

      <header className="rise mt-4 flex flex-wrap items-center gap-5">
        <div
          className={`font-display grid h-16 w-16 place-items-center rounded-full text-2xl font-extrabold ${overall === "critical" ? "pulse-critical" : ""}`}
          style={{ border: `2px solid ${c}`, color: c, boxShadow: `0 0 30px color-mix(in srgb, ${c} 30%, transparent)` }}
        >
          {initials(profile.name)}
        </div>
        <div>
          <div className="font-data text-[11px] uppercase tracking-[0.18em] text-ink-3">
            {profile.callsign} · {profile.role} · Inspiration4 profile {profile.osdrId}
          </div>
          <h1 className="font-display text-4xl font-extrabold uppercase sm:text-5xl">{profile.name}</h1>
        </div>
        <div className="ml-auto">
          <StatusPill status={overall} />
        </div>
      </header>

      <TodayPanel s={s} />
      <MedicalProfilePanel crewId={profile.id} priorDoseMsv={profile.priorDoseMsv} />
      <LabPanel osdrId={profile.osdrId} name={profile.name} />

      <div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_360px]">
        {/* Body map */}
        <section className="panel ticks rise overflow-hidden p-4" style={{ animationDelay: "60ms" }}>
          <div className="scanline" />
          <h2 className="panel-title">Body systems · tap to inspect</h2>
          <div className="mx-auto mt-2 h-[420px] max-w-[300px]">
            <BodyMap systems={systemStatus} selected={system} onSelect={pickSystem} />
          </div>
          <div className="mt-2 border-t border-line pt-3">
            <div className="flex items-center gap-2">
              <StatusDot status={systemStatus[system]} />
              <h3 className="font-semibold">{BODY_SYSTEMS[system].name}</h3>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{BODY_SYSTEMS[system].blurb}</p>
          </div>
        </section>

        {/* Center column */}
        <div className="space-y-5">
          <EscalationCard esc={esc} envName={env.name} backup={/medical officer/i.test(profile.role)} />

          <section className="panel ticks rise p-5" style={{ animationDelay: "120ms" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="panel-title">{BODY_SYSTEMS[system].name} · indicators</h2>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(BODY_SYSTEMS) as BodySystem[]).map((sys) => (
                  <button
                    key={sys}
                    type="button"
                    onClick={() => pickSystem(sys)}
                    className={`font-data flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${sys === system ? "bg-panel-2 text-ink" : "text-ink-3 hover:text-ink"}`}
                  >
                    <StatusDot status={systemStatus[sys]} size={5} />
                    {BODY_SYSTEMS[sys].organ}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
              {bySystem[system].map((a) => (
                <IndicatorTile key={a.indicator} a={a} active={a.indicator === selected} onClick={() => setSelected(a.indicator)} />
              ))}
            </div>
          </section>

          {current && <IndicatorDetail s={s} a={current} />}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 xl:col-span-1">
          <ProtocolPanel
            crewId={profile.id}
            readings={s.readings}
            onLogged={(ids) => {
              // Show the most concerning of the values just logged.
              const logged = assessments.filter((a) => ids.includes(a.indicator)).sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
              const pick = logged[0]?.indicator ?? ids[0];
              setSystem(getIndicator(pick).system);
              setSelected(pick);
            }}
          />
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-3">
        VITA is a research prototype for the NASA Space Apps Challenge, not a medical device. All Action and Critical results route to the crew medical officer or flight surgeon.
      </p>
    </div>
  );
}

function EscalationCard({ esc, envName, backup }: { esc: ReturnType<typeof escalate>; envName: string; backup: boolean }) {
  const c = STATUS_COLOR[esc.level];
  const Who = { self: UserRound, crew_medical_officer: Stethoscope, flight_surgeon: Satellite }[esc.responder];
  const who = { self: "Self-care", crew_medical_officer: backup ? "Backup medical officer" : "Crew medical officer", flight_surgeon: "Flight surgeon (ground)" }[esc.responder];
  return (
    <section
      className="panel rise overflow-hidden p-5"
      style={{ borderColor: `color-mix(in srgb, ${c} 45%, var(--line))`, background: `linear-gradient(120deg, color-mix(in srgb, ${c} 10%, var(--panel)) 0%, var(--bg-2) 60%)` }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="panel-title" style={{ color: c }}>
          What to do now
        </h2>
        <span className="font-data ml-auto flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-2">
          <Who size={13} /> {who}
        </span>
      </div>
      <p className="font-display mt-2 text-3xl font-extrabold uppercase" style={{ color: c }}>
        {esc.headline}
      </p>
      <ol className="mt-3 space-y-2">
        {esc.steps.map((st, i) => (
          <li key={i} className="flex gap-3 text-sm text-ink">
            <span className="font-data mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]" style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c }}>
              {i + 1}
            </span>
            {st}
          </li>
        ))}
      </ol>
      {esc.autonomous && (
        <p className="font-data mt-4 text-[11px] uppercase tracking-wider text-watch">
          ⚠ Autonomous operations: {envName} is too far for real-time ground support
        </p>
      )}
    </section>
  );
}

function IndicatorTile({ a, active, onClick }: { a: Assessment; active: boolean; onClick: () => void }) {
  const ind = getIndicator(a.indicator);
  const c = STATUS_COLOR[a.status];
  const Trend = a.trendPerDay > 0 ? TrendingUp : TrendingDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-lg border p-3 text-left transition hover:border-line-2"
      style={{
        borderColor: active ? c : "var(--line)",
        background: active ? `color-mix(in srgb, ${c} 8%, var(--bg-2))` : "var(--bg-2)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-ink-2">{ind.name}</span>
        <StatusDot status={a.status} size={7} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-extrabold" style={{ color: a.status === "nominal" ? "var(--ink)" : c }}>
          {formatValue(a.indicator, a.latest?.value)}
        </span>
        <span className="font-data text-xs text-ink-3">{ind.unit}</span>
        {a.daysToAction !== undefined && <Trend size={14} style={{ color: c }} className="ml-auto" />}
      </div>
      <div className="font-data mt-0.5 text-[10px] text-ink-3">
        {a.latest ? `Day ${a.latest.day} · ${a.latest.source === "self" ? "you logged" : ind.input === "lab" ? "lab" : ind.input === "environment" ? "habitat" : "sensor"}` : "no data"}
      </div>
    </button>
  );
}

function IndicatorDetail({ s, a }: { s: CrewState; a: Assessment }) {
  const ind = getIndicator(a.indicator);
  const c = STATUS_COLOR[a.status];
  const readings = s.readings.filter((r) => r.indicator === a.indicator).sort((x, y) => x.day - y.day);
  const thresholds = thresholdsFor(s.profile, a.indicator) ?? ind.thresholds;
  const steps = a.status === "nominal" || a.status === "unknown" ? [] : ind.actions[a.status];

  return (
    <section className="panel ticks rise p-5" style={{ animationDelay: "180ms" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">
            {ind.name} · {ind.cadence === "weekly" ? "12 weeks" : "30 days"}
          </h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-5xl font-extrabold" style={{ color: c }}>
              {formatValue(a.indicator, a.latest?.value)}
            </span>
            <span className="font-data text-ink-3">{ind.unit}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 flex justify-end">
            <DataBadge kind={ind.input === "lab" ? "real" : "sim"} />
          </div>
          <StatusPill status={a.status} />
          <div className="mt-1 text-xs text-ink-3">{STATUS_MEANING[a.status]}</div>
        </div>
      </div>

      {a.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {a.reasons.map((r) => (
            <li key={r} className="font-data text-xs" style={{ color: c }}>
              › {r}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <TrendChart
          readings={readings}
          thresholds={thresholds}
          baseline={a.baseline}
          unit={ind.unit}
          days={ind.cadence === "weekly" ? 84 : 30}
          color={c}
        />
        <div className="font-data mt-1 flex flex-wrap gap-4 text-[10px] text-ink-3">
          <span>
            <span className="text-nominal">▬</span> normal band
          </span>
          <span>
            <span className="text-watch">┄</span> watch limit
          </span>
          <span>
            <span className="text-action">┄</span> action limit
          </span>
          <span>— baseline{a.baseline !== undefined ? ` ${a.baseline.toFixed(ind.decimals)}` : ""}</span>
          <span>● your entries</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Info title="How to measure">{ind.howTo}</Info>
        <Info title="Why it matters in space">
          {ind.whySpace}
          <div className="mt-2 flex flex-wrap gap-1">
            {ind.hazards.map((h) => (
              <span key={h} title={HAZARDS[h].blurb} className="font-data rounded border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-3">
                {HAZARDS[h].name}
              </span>
            ))}
          </div>
        </Info>
        <Info title={steps.length ? "What to do" : "Keep it up"}>
          {steps.length ? (
            <ul className="space-y-1.5">
              {steps.map((x) => (
                <li key={x} className="flex gap-2">
                  <span style={{ color: c }}>→</span>
                  {x}
                </li>
              ))}
            </ul>
          ) : (
            "This is in your normal range. Keep measuring on schedule so VITA can spot changes early."
          )}
        </Info>
      </div>
      <p className="font-data mt-4 text-[10px] text-ink-3">Source: {ind.source}</p>
    </section>
  );
}

function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="panel-title">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

