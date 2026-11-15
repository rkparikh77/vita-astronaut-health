"use client";

import Link from "next/link";
import { HeartPulse, Lock } from "lucide-react";
import { ALLERGY_LABEL, CONDITION_LABEL, DRUG, MEDICAL, sleepAidReliance } from "@/core/medical";
import { score } from "@/core/wellbeing";
import { useMission } from "@/lib/store";

const VIRUS_NOTE: Record<string, string> = {
  EBV: "Epstein-Barr",
  VZV: "chickenpox/shingles (valacyclovir in kit)",
  CMV: "cytomegalovirus",
  "HSV-1": "cold sores (valacyclovir in kit)",
};

/** Personal factors that change how VITA reads this astronaut's data (from the team's requirements). */
export function MedicalProfilePanel({ crewId, priorDoseMsv }: { crewId: string; priorDoseMsv: number }) {
  const { today, doses, checkIns } = useMission();
  const m = MEDICAL[crewId];
  if (!m) return null;
  const recent = doses.filter((d) => d.crewId === crewId && today - d.day < 7);
  const reliance = sleepAidReliance(crewId, today, doses);
  const latest = checkIns.filter((c) => c.crewId === crewId).sort((a, b) => b.day - a.day)[0];
  const wb = latest ? score(latest, checkIns) : null;

  return (
    <section className="panel ticks rise mt-5 p-5" style={{ animationDelay: "40ms" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title flex items-center gap-2">
          <HeartPulse size={13} /> Medical profile · personal factors
        </h2>
        <Link href="/pharmacy" className="text-xs text-ink-3 hover:text-ink">
          Pharmacy ▸
        </Link>
      </div>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Age · sex · fitness">
          {m.age} · {m.sex} · {m.fitness}
        </Field>
        <Field label="Allergies">{m.allergies.length ? m.allergies.map((a) => ALLERGY_LABEL[a]).join(", ") : "None known"}</Field>
        <Field label="Conditions">
          {m.conditions.length ? m.conditions.map((c) => CONDITION_LABEL[c]).join("; ") : "None"}
          {m.conditions.includes("stage1_hypertension") && <div className="text-[11px] text-nominal">Personal blood-pressure range applied</div>}
        </Field>
        <Field label="Current medicines">{m.currentMeds.length ? m.currentMeds.map((c) => `${DRUG[c.drugId]?.name} (${c.schedule})`).join("; ") : "None"}</Field>
        <Field label="Dormant viruses (seropositive)">{m.latentViruses.map((v) => `${v}: ${VIRUS_NOTE[v]}`).join("; ")}</Field>
        <Field label="Prior spaceflight">
          {m.priorFlights} flight{m.priorFlights === 1 ? "" : "s"} · {priorDoseMsv} mSv counted toward the career limit
        </Field>
        <Field label="Diet">{m.dietary.length ? m.dietary.join(", ") : "No restrictions"}</Field>
        <Field label="Doses in the last 7 days">
          {recent.length ? recent.map((d) => DRUG[d.drugId]?.name).join(", ") : "None logged"}
          {reliance.flag && <div className="text-[11px] text-watch">Heavy sleep-aid use: flight-surgeon review</div>}
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg-2/60 px-3 py-2 text-xs text-ink-2">
        <Lock size={12} className="text-ink-3" />
        Wellbeing check-in:{" "}
        {!latest ? (
          "none yet"
        ) : latest.sharing === "full" ? (
          <span>
            shared · mood {wb!.phq2}/6, anxiety {wb!.gad2}/6, sleep {latest.sleepQuality}/5{latest.note ? ` · “${latest.note}”` : ""}
          </span>
        ) : latest.sharing === "summary" ? (
          <span>
            scores shared · mood {wb!.phq2}/6, anxiety {wb!.gad2}/6
          </span>
        ) : wb!.autoEscalate ? (
          <span className="text-watch">private · follow-up needed (risk threshold crossed)</span>
        ) : (
          <span>private · nothing shared</span>
        )}
      </div>
      {m.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-3">
          {m.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="panel-title text-[9px]">{label}</div>
      <div className="mt-1 text-ink-2">{children}</div>
    </div>
  );
}
