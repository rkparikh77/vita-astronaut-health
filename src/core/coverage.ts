// Traceability: every requirement in the team's "NASA Health Software" requirements document mapped to what VITA does.
// "built" = working in the app; "partial" = some of the requirement is built; "next" = designed, not yet built.

export type Coverage = "built" | "partial" | "next";

export interface Requirement {
  area: string;
  group: "Core risk" | "Additional factor" | "Personal factor";
  need: string;
  vita: string;
  status: Coverage;
  href?: string;
}

export const REQUIREMENTS: Requirement[] = [
  // Core risks (NASA Human Research Program hazards)
  { area: "Space radiation", group: "Core risk", need: "Per-crew dose vs career limit, green/yellow/red", vita: "Cumulative dose per astronaut including prior flights, against NASA's 600 mSv career limit and 30-day limit, with status colors", status: "built", href: "/radiation" },
  { area: "Space radiation", group: "Core risk", need: "Solar particle event warning and shelter alert", vita: "Live NASA DONKI events, live SDO Sun and SPDF solar wind with shock detection; storm drill moves crew to the shelter; Playground solar-storm emergency", status: "built", href: "/radiation" },
  { area: "Space radiation", group: "Core risk", need: "Limit high-radiation time, postpone spacewalks", vita: "Storm protocol: stop EVAs and rover traverses, shelter, hourly dosimeter logs", status: "built", href: "/radiation" },
  { area: "Space radiation", group: "Core risk", need: "Flag abnormal blood results for the flight surgeon", vita: "Real Inspiration4 bloodwork vs each astronaut's preflight baseline; abnormal values flagged and escalated", status: "built", href: "/research" },
  { area: "Isolation & confinement", group: "Core risk", need: "Mood, stress, sleep, crew relations; questionnaires", vita: "Daily mood/stress logs plus a private check-in with standard PHQ-2 and GAD-2 screens, sleep quality, crew cohesion and workload", status: "built", href: "/checkin" },
  { area: "Isolation & confinement", group: "Core risk", need: "Spot downward trends; suggest coping tools", vita: "Trend detection on a rolling personal baseline; tailored suggestions; guided breathing; recorded family messages sized to the comms delay", status: "built", href: "/checkin" },
  { area: "Isolation & confinement", group: "Core risk", need: "Private check-ins; share only with permission or serious risk", vita: "Private by default with a sharing choice; only a flag is sent automatically when a serious-risk threshold is crossed; biweekly private conference with an 'ask for earlier' button", status: "built", href: "/checkin" },
  { area: "Altered gravity", group: "Core risk", need: "Fitness, strength and body mass vs preflight baseline", vita: "Exercise minutes, body mass and a calf-muscle loss model against each astronaut's baseline; countermeasure score", status: "built", href: "/" },
  { area: "Altered gravity", group: "Core risk", need: "Vision changes flagged for an eye exam", vita: "Weekly Amsler-grid self-check; SANS scenario escalates to the flight surgeon", status: "built", href: "/crew/vega" },
  { area: "Altered gravity", group: "Core risk", need: "Balance tests; fall risk after gravity transitions", vita: "Readiness score after landing is planned; balance test not yet built", status: "next" },
  { area: "Hostile closed environment", group: "Core risk", need: "CO₂ / O₂ monitoring with alarms and step-by-step instructions", vita: "Cabin CO₂ indicator; Playground CO₂ build-up, hull breach and fire emergencies with alarms, steps and live physiology", status: "built", href: "/sim" },
  { area: "Hostile closed environment", group: "Core risk", need: "Link symptoms like headache to high CO₂", vita: "CO₂ alarm explains expected headaches; the AI flight surgeon cross-references symptoms with cabin readings", status: "partial", href: "/sim" },
  { area: "Hostile closed environment", group: "Core risk", need: "Water quality, microbes, noise, temperature", vita: "Not yet built", status: "next" },
  { area: "Immune changes", group: "Core risk", need: "White cells and cytokines", vita: "Real Inspiration4 white-cell counts and a 71-plex cytokine panel with statistics (IL-6 up 1.93× in 4/4 crew at return)", status: "built", href: "/research" },
  { area: "Immune changes", group: "Core risk", need: "Dormant virus reactivation (EBV, VZV, CMV)", vita: "Each astronaut's seropositive viruses on their medical profile, with antiviral in the kit; saliva testing not yet modeled", status: "partial", href: "/crew/tanaka" },
  { area: "Immune changes", group: "Core risk", need: "Symptom checklist; treat from the onboard kit following protocols", vita: "Fever scenario with escalation; pharmacy checks allergies, interactions and conditions before every dose and suggests safe alternatives", status: "built", href: "/pharmacy" },
  { area: "Bone loss", group: "Core risk", need: "Calcium, vitamin D, resistance exercise; kidney-stone risk", vita: "Real calcium baselines, bone-loss scenario, exercise tracking, vitamin D supplement on the profile, kidney-stone and hydration warnings", status: "built", href: "/crew/lindqvist" },
  { area: "Cardiovascular", group: "Core risk", need: "Heart rhythm with immediate alerts and emergency steps", vita: "Live ECG with atrial-fibrillation and PVC detection; cardiac-arrest emergency with survival odds", status: "built", href: "/live" },
  { area: "Cardiovascular", group: "Core risk", need: "BP/HR trends; guided repeat measurement", vita: "Trend and personal-baseline alerts; every alert says how to repeat the reading", status: "built", href: "/crew/tanaka" },
  { area: "Cardiovascular", group: "Core risk", need: "Fluid loading and compression before return to gravity", vita: "Covered in the Atlas of spaceflight effects; return-to-gravity checklist planned", status: "partial", href: "/atlas" },
  { area: "Behavioral health", group: "Core risk", need: "Reaction time, fatigue, workload; warn before critical tasks", vita: "1-minute reaction test (PVT), readiness score, workload rating; sedating medicines carry a no-EVA/no-piloting window", status: "built", href: "/crew/okafor" },
  { area: "Behavioral health", group: "Core risk", need: "Depression and anxiety screening; self-help tools", vita: "PHQ-2 and GAD-2 screens; breathing and sleep-hygiene tools; earlier private conference", status: "built", href: "/checkin" },
  // Additional factors
  { area: "Medication", group: "Additional factor", need: "Dose log, allergy and interaction checks, expiry and stock, side effects", vita: "Onboard pharmacy: every dose checked first, stock and shelf-life tracking (incl. what expires before Earth return), side-effect check-ins flagged for review", status: "built", href: "/pharmacy" },
  { area: "Sleep quality", group: "Additional factor", need: "Sleep debt; flag heavy sleep-medication use", vita: "Sleep score and sleep-debt scenario; 4+ sleep-aid doses in a week flagged for the flight surgeon", status: "built", href: "/pharmacy" },
  { area: "Hydration", group: "Additional factor", need: "Fluid intake reminders; kidney-stone risk", vita: "Daily hydration log with low-intake warnings and kidney-stone guidance", status: "built", href: "/crew/lindqvist" },
  { area: "Reproductive & hormonal", group: "Additional factor", need: "Cycle management plan; hormones", vita: "Menstrual suppression plan on the medical profile with daily dosing; hormone labs not yet modeled", status: "partial", href: "/crew/lindqvist" },
  { area: "Workload & EVA exertion", group: "Additional factor", need: "Real-time EVA heart-rate and exertion alerts", vita: "Live heart telemetry and detectors exist; EVA-specific profile planned", status: "partial", href: "/live" },
  { area: "Nutrition", group: "Additional factor", need: "Calories and nutrients vs targets, allergies", vita: "Dietary restrictions on the profile; food logging not yet built", status: "next" },
  { area: "Injuries & ergonomics", group: "Additional factor", need: "First-aid guidance, healing tracking", vita: "Lidocaine and kit supplies tracked; injury log not yet built", status: "next" },
  { area: "Dental & oral health", group: "Additional factor", need: "Self-checks, temporary care, images to Earth dentists", vita: "Dental anesthetic and antibiotics in the kit; self-check not yet built", status: "next" },
  // Personal factors
  { area: "Pre-existing conditions", group: "Personal factor", need: "Different safe range (e.g. mild hypertension)", vita: "Tanaka's known hypertension applies a personal blood-pressure range, so normal-for-him readings don't alarm", status: "built", href: "/crew/tanaka" },
  { area: "Allergies & current medicines", group: "Personal factor", need: "Avoid reactions; account for drug effects", vita: "Blocks allergens, checks interactions with current medicines, offers alternatives", status: "built", href: "/pharmacy" },
  { area: "Pre-flight baselines", group: "Personal factor", need: "Each astronaut's own normal", vita: "Personal baselines from real Inspiration4 preflight draws (L-92, L-44, L-3) and a rolling in-flight baseline", status: "built", href: "/research" },
  { area: "Prior flights, age & sex", group: "Personal factor", need: "Prior dose toward career limit; normal ranges", vita: "Prior-flight dose added to the career total; age, sex and fitness on the profile (NASA's 600 mSv limit is the same for everyone since 2022)", status: "built", href: "/radiation" },
  { area: "Latent virus status", group: "Personal factor", need: "Which dormant viruses each person carries", vita: "Seropositive status on each profile", status: "built", href: "/crew/okafor" },
  { area: "Mission context", group: "Personal factor", need: "Time into mission, location, recent exercise", vita: "Location-aware radiation, comms delay and escalation; mission-day timeline; rolling baselines", status: "built", href: "/link" },
  { area: "Mental health history & genetics", group: "Personal factor", need: "Adjust check-ins; sensitivity", vita: "Not yet built", status: "next" },
];

export function coverageSummary() {
  const n = (s: Coverage) => REQUIREMENTS.filter((r) => r.status === s).length;
  return { built: n("built"), partial: n("partial"), next: n("next"), total: REQUIREMENTS.length };
}
