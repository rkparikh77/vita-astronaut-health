"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Eye, Lock, Wind } from "lucide-react";
import { DataBadge } from "@/components/viz";
import { CREW } from "@/core/crew";
import { fmtDuration, linkAt, missionDate } from "@/core/deepSpace";
import { FREQ, GAD2, nextConference, PHQ2, score, type CheckIn, type Sharing } from "@/core/wellbeing";
import { useMission } from "@/lib/store";

const SHARING: { id: Sharing; label: string; hint: string }[] = [
  { id: "private", label: "Keep private", hint: "Nobody sees it unless a serious-risk threshold is crossed; then only a flag." },
  { id: "summary", label: "Share scores", hint: "The flight surgeon sees the two screening scores, not your answers." },
  { id: "full", label: "Share everything", hint: "Answers and note go to the flight surgeon." },
];

export default function CheckInPage() {
  const { today, checkIns, saveCheckIn, conferenceRequests, requestConference } = useMission();
  const [crewId, setCrewId] = useState("okafor");
  const [phq, setPhq] = useState<[number, number]>([0, 0]);
  const [gad, setGad] = useState<[number, number]>([0, 0]);
  const [sleepQuality, setSleep] = useState(3);
  const [cohesion, setCohesion] = useState(4);
  const [workload, setWorkload] = useState(3);
  const [sharing, setSharing] = useState<Sharing>("private");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState<CheckIn | null>(null);
  const oneWay = linkAt(missionDate(today)).oneWaySec;

  const mine = checkIns.filter((c) => c.crewId === crewId).sort((a, b) => b.day - a.day);
  const result = submitted ? score(submitted, checkIns) : null;
  const requested = conferenceRequests[crewId] !== undefined;
  const conf = nextConference(today, requested);

  const submit = () => {
    const c: CheckIn = { crewId, day: today, phq, gad, sleepQuality, cohesion, workload, sharing, note: note || undefined };
    saveCheckIn(c);
    setSubmitted(c);
  };

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-center gap-2">
        <p className="panel-title">Private wellbeing check-in</p>
        <DataBadge kind="model" />
      </div>
      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
        Just for you
        <br />
        <span className="text-ink-3">unless you say so</span>
      </h1>
      <p className="mt-4 max-w-3xl text-ink-2">
        Months of isolation and confinement wear on everyone. This two-minute check-in uses standard screening questions, spots downward trends, and
        suggests what helps. You decide what the flight surgeon sees. The only exception is a serious-risk threshold, and even then only a flag is sent.
      </p>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel ticks p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-xs text-ink-3">
              Checking in as
              <select
                value={crewId}
                onChange={(e) => {
                  setCrewId(e.target.value);
                  setSubmitted(null);
                }}
                className="ml-2 rounded-md border border-line-2 bg-panel px-2 py-1.5 text-sm text-ink"
              >
                {CREW.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="font-data flex items-center gap-1.5 text-[10px] tracking-widest text-nominal uppercase">
              <Lock size={12} /> Private by default
            </span>
          </div>

          <p className="mt-5 text-sm text-ink-2">Over the last two weeks, how often have you been bothered by:</p>
          {[...PHQ2.map((q, i) => ({ q, set: (v: number) => setPhq((p) => (i ? [p[0], v] : [v, p[1]])), v: phq[i] })), ...GAD2.map((q, i) => ({ q, set: (v: number) => setGad((p) => (i ? [p[0], v] : [v, p[1]])), v: gad[i] }))].map(
            (row) => (
              <fieldset key={row.q} className="mt-3">
                <legend className="text-sm text-ink">{row.q}</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {FREQ.map((f, v) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => row.set(v)}
                      aria-pressed={row.v === v}
                      className={`rounded-md px-2 py-1.5 text-[11px] ${row.v === v ? "bg-ink text-bg" : "border border-line-2 text-ink-2 hover:text-ink"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </fieldset>
            ),
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Scale label="Sleep quality" value={sleepQuality} onChange={setSleep} lo="Poor" hi="Great" />
            <Scale label="Crew getting along" value={cohesion} onChange={setCohesion} lo="Tense" hi="Great" />
            <Scale label="Workload" value={workload} onChange={setWorkload} lo="Light" hi="Crushing" />
          </div>

          <label className="mt-4 block text-xs text-ink-3">
            Anything else (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-line-2 bg-panel px-3 py-2 text-sm text-ink" />
          </label>

          <fieldset className="mt-4">
            <legend className="text-xs text-ink-3">Who can see this?</legend>
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
              {SHARING.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSharing(s.id)}
                  aria-pressed={sharing === s.id}
                  className={`rounded-lg border p-2 text-left text-xs ${sharing === s.id ? "border-nominal/70 bg-nominal/10 text-ink" : "border-line-2 text-ink-2"}`}
                >
                  <div className="font-semibold">{s.label}</div>
                  <div className="mt-0.5 text-[11px] text-ink-3">{s.hint}</div>
                </button>
              ))}
            </div>
          </fieldset>

          <button type="button" onClick={submit} className="mt-5 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-bg">
            Save check-in
          </button>
        </div>

        <div className="space-y-5">
          {result && submitted ? (
            <div className="panel ticks rise p-5">
              <h2 className="panel-title">Your results · day {submitted.day}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Screen label="Mood screen (PHQ-2)" score={result.phq2} positive={result.positive.depression} />
                <Screen label="Anxiety screen (GAD-2)" score={result.gad2} positive={result.positive.anxiety} />
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-line-2 bg-bg-2/60 p-3 text-sm">
                <Eye size={15} className="mt-0.5 shrink-0 text-ink-3" />
                <div>
                  <div className="text-ink-3 text-xs">What the flight surgeon sees</div>
                  <div className={result.autoEscalate && sharing === "private" ? "text-watch" : "text-ink"}>{result.visibleToSurgeon}</div>
                </div>
              </div>
              <h3 className="panel-title mt-4">What might help</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                {result.suggestions.map((s) => (
                  <li key={s} className="flex gap-2">
                    <span className="text-nominal">→</span>
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-3">A screen is not a diagnosis. A score of 3 or more means a conversation is worth having.</p>
            </div>
          ) : (
            <div className="panel ticks p-5 text-sm text-ink-3">Your results and suggestions appear here after you save.</div>
          )}

          <div className="panel ticks p-5">
            <h2 className="panel-title flex items-center gap-2">
              <CalendarClock size={13} /> Private conference
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Next private conference with behavioral health: <b className="text-ink">mission day {conf}</b>
              {requested ? " (earlier slot requested)" : ""}. Earth is {fmtDuration(oneWay)} away, so it runs as recorded messages back and forth rather than a live call.
            </p>
            <button
              type="button"
              disabled={requested}
              onClick={() => requestConference(crewId)}
              className="mt-3 rounded-lg border border-line-2 px-3 py-2 text-sm text-ink-2 hover:text-ink disabled:opacity-40"
            >
              {requested ? "Earlier slot requested" : "Request an earlier one"}
            </button>
          </div>

          <Breathing />

          {mine.length > 0 && (
            <div className="panel ticks p-5">
              <h2 className="panel-title">Your trend (only you see this)</h2>
              <ul className="mt-3 space-y-1 text-xs">
                {mine.slice(0, 6).map((c) => {
                  const r = score(c, checkIns);
                  return (
                    <li key={c.day} className="font-data flex justify-between text-ink-2">
                      <span>Day {c.day}</span>
                      <span>
                        Mood {r.phq2}/6 · Anxiety {r.gad2}/6 · Sleep {c.sleepQuality}/5 · {c.sharing}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Scale({ label, value, onChange, lo, hi }: { label: string; value: number; onChange: (v: number) => void; lo: string; hi: string }) {
  return (
    <label className="text-xs text-ink-3">
      {label}: <b className="text-ink">{value}</b>/5
      <input type="range" min={1} max={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--nominal)]" />
      <span className="flex justify-between text-[10px]">
        <span>{lo}</span>
        <span>{hi}</span>
      </span>
    </label>
  );
}

function Screen({ label, score, positive }: { label: string; score: number; positive: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-bg-2/60 p-3">
      <div className="panel-title text-[9px]">{label}</div>
      <div className="font-display mt-1 text-3xl font-extrabold" style={{ color: positive ? "var(--watch)" : "var(--nominal)" }}>
        {score}
        <span className="text-sm text-ink-3">/6</span>
      </div>
      <div className="text-[11px] text-ink-3">{positive ? "Worth a conversation" : "Below the follow-up level"}</div>
    </div>
  );
}

/** Box breathing: 4 s in, 4 s hold, 4 s out, 4 s hold. */
function Breathing() {
  const [on, setOn] = useState(false);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 4), 4000);
    return () => clearInterval(id);
  }, [on]);
  const labels = ["Breathe in", "Hold", "Breathe out", "Hold"];
  const big = phase === 0 || phase === 1;
  return (
    <div className="panel ticks p-5">
      <h2 className="panel-title flex items-center gap-2">
        <Wind size={13} /> Two-minute paced breathing
      </h2>
      <div className="mt-4 flex items-center gap-5">
        <div className="grid h-28 w-28 shrink-0 place-items-center">
          <div
            className="rounded-full border-2 border-nominal/70 bg-nominal/10"
            style={{ width: on && big ? 108 : 52, height: on && big ? 108 : 52, transition: "width 4s ease-in-out, height 4s ease-in-out" }}
          />
        </div>
        <div>
          <div className="text-lg font-semibold">{on ? labels[phase] : "Box breathing"}</div>
          <p className="text-xs text-ink-3">4 seconds in, hold, out, hold. Slows the heart rate and settles stress.</p>
          <button
            type="button"
            onClick={() => {
              setOn((o) => !o);
              setPhase(0);
            }}
            className="mt-2 rounded-lg border border-line-2 px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
          >
            {on ? "Stop" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
