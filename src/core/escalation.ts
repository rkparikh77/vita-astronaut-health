import type { Assessment } from "./assess";
import { delayRange, type MissionEnvironment } from "./environments";
import { getIndicator } from "./indicators";
import { STATUS_RANK, type Status } from "./types";

export type Responder = "self" | "crew_medical_officer" | "flight_surgeon";

export interface Escalation {
  level: Status;
  responder: Responder;
  headline: string;
  steps: string[];
  /** Whether ground can realistically help in real time. */
  autonomous: boolean;
}

/** Ground support counts as "real time" if a question and answer round-trip takes under a minute. */
export function isAutonomous(env: MissionEnvironment): boolean {
  return env.commsDelaySec[0] * 2 > 60;
}

/**
 * @param opts.patientIsCmo the person being assessed is the crew medical officer, so care goes to the backup.
 */
export function escalate(as: Assessment[], env: MissionEnvironment, opts: { patientIsCmo?: boolean } = {}): Escalation {
  const result = escalateInner(as, env);
  if (!opts.patientIsCmo || result.responder === "self") return result;
  return {
    ...result,
    steps: [
      ...result.steps.map((s) =>
        s.replace(/crew medical officer/gi, (m) => `${m[0] === "C" ? "B" : "b"}ackup medical officer (Commander)`),
      ),
      "You are the crew medical officer: hand your medical duties to the backup until you are cleared.",
    ],
  };
}

function escalateInner(as: Assessment[], env: MissionEnvironment): Escalation {
  const ranked = [...as].filter((a) => a.status !== "unknown").sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const top = ranked[0];
  const autonomous = isAutonomous(env);
  const delay = delayRange(env);

  if (!top || top.status === "nominal") {
    return {
      level: "nominal",
      responder: "self",
      headline: "All indicators nominal",
      steps: ["Keep to today's protocol.", "Log your measurements to keep your streak."],
      autonomous,
    };
  }

  const ind = getIndicator(top.indicator);
  const steps = [...ind.actions[top.status as "watch" | "action" | "critical"]];

  if (top.status === "watch") {
    return {
      level: "watch",
      responder: "self",
      headline: `Watch: ${ind.name.toLowerCase()}`,
      steps: [...steps, "VITA will prompt a recheck at your next check-in."],
      autonomous,
    };
  }

  if (top.status === "action") {
    return {
      level: "action",
      responder: "crew_medical_officer",
      headline: `Action needed: ${ind.name.toLowerCase()}`,
      steps: [
        ...steps,
        autonomous
          ? `Queue a report for the flight surgeon (one-way delay ${delay}). Don't wait for the reply to start care.`
          : `Send to the flight surgeon at the next private medical conference (delay ${delay}).`,
      ],
      autonomous,
    };
  }

  return {
    level: "critical",
    responder: autonomous ? "crew_medical_officer" : "flight_surgeon",
    headline: `Critical: ${ind.name.toLowerCase()}`,
    steps: [
      ...steps,
      autonomous
        ? `Earth is ${delay} away one-way. The crew medical officer leads treatment now with the onboard medical guide; send data to ground in parallel.`
        : `Call the flight surgeon now on the priority medical channel (delay ${delay}).`,
    ],
    autonomous,
  };
}
