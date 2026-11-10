// "Body in space" atlas: verified findings from the literature plus a simple mission projection model.
import { ENV_MAP, type EnvironmentId } from "./environments";
import { CAREER_LIMIT_MSV } from "./radiation";
import { calfLoss } from "./scores";
import type { BodySystem } from "./types";

export interface Finding {
  id: string;
  system: BodySystem | "genome";
  stat: string;
  headline: string;
  detail: string;
  onset: string;
  /** Rough day the effect becomes noticeable, for the timeline. */
  onsetDay: number;
  recovery: string;
  citation: string;
  url: string;
  surprising?: boolean;
}

export const FINDINGS: Finding[] = [
  {
    id: "fluid",
    system: "cardio",
    stat: "~2 L",
    headline: "Fluid rushes to the head",
    detail: "Without gravity, about two liters of fluid shift from the legs toward the chest and head: puffy face, 'bird legs', stuffy nose and higher pressure behind the eyes.",
    onset: "Minutes",
    onsetDay: 0,
    recovery: "Reverses within days of landing, but causes fainting risk on the first stand-up.",
    citation: "NASA HRP Evidence: cardiovascular",
    url: "https://humanresearchroadmap.nasa.gov/",
  },
  {
    id: "jugular",
    system: "cardio",
    stat: "6 of 11",
    headline: "Blood in the neck can stall or flow backward",
    detail: "Ultrasound on the ISS found stagnant or reversed flow in the internal jugular vein in 6 of 11 crew around flight day 50. One developed a clot, which was treated with blood thinners in orbit (Auñón-Chancellor 2020, NEJM).",
    onset: "~Day 50",
    onsetDay: 50,
    recovery: "Resolved after flight; lower-body negative pressure improved flow in 59% of sessions.",
    citation: "Marshall-Goebel et al. 2019, JAMA Network Open",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6902784",
    surprising: true,
  },
  {
    id: "heart_shape",
    system: "cardio",
    stat: "9.4%",
    headline: "The heart becomes rounder",
    detail: "Onboard ultrasound of 12 astronauts showed the heart becoming 9.4% more spherical, matching models that predicted less efficient pumping in low gravity.",
    onset: "Weeks",
    onsetDay: 30,
    recovery: "Returns to its normal elongated shape soon after landing.",
    citation: "Thomas et al., NASA, ACC Scientific Session 2014",
    url: "https://www.news-medical.net/news/20140331/Study-of-astronauts-show-heart-becomes-more-spherical-when-exposed-to-microgravity-in-space.aspx",
    surprising: true,
  },
  {
    id: "anemia",
    system: "immune",
    stat: "+54%",
    headline: "Space anemia: red cells destroyed faster",
    detail: "Measured in 14 astronauts on six-month missions: about 3 million red blood cells destroyed per second instead of the usual 2 million.",
    onset: "From day 1",
    onsetDay: 1,
    recovery: "Reverses over 3–4 months after return.",
    citation: "Trudel et al. 2022, Nature Medicine",
    url: "https://www.eurekalert.org/news-releases/939794",
    surprising: true,
  },
  {
    id: "sleep",
    system: "neuro",
    stat: "6.1 h",
    headline: "Astronauts barely sleep 6 hours",
    detail: "Across 85 astronauts, ISS sleep averaged 6.09 h despite 8.5 h scheduled, and 12 of 16 ISS crew used sleep medication.",
    onset: "Whole mission",
    onsetDay: 1,
    recovery: "Also short before launch (<6.5 h in training).",
    citation: "Barger et al. 2014, Lancet Neurology",
    url: "https://www.eurekalert.org/news-releases/595450",
  },
  {
    id: "muscle",
    system: "musculoskeletal",
    stat: "−13%",
    headline: "Calf muscle shrinks despite daily exercise",
    detail: "MRI of 9 ISS crew showed calf muscle volume down 13% after six months, even with the onboard exercise program.",
    onset: "Weeks",
    onsetDay: 14,
    recovery: "Months of rehabilitation after landing.",
    citation: "Trappe et al. 2009, J Appl Physiol",
    url: "https://www.scientificamerican.com/blog/news-blog/spaceflight-wreaks-havoc-on-astrona-2009-04-08/",
  },
  {
    id: "bone",
    system: "musculoskeletal",
    stat: "−2.1%",
    headline: "Bone is still missing a year later",
    detail: "In 17 astronauts, tibia strength and density remained 0.9–2.1% below preflight 12 months after landing: a deficit like a decade of aging. 9 of 17 never fully recovered density.",
    onset: "Month 1+",
    onsetDay: 30,
    recovery: "Incomplete at 12 months, worse after missions over 6 months.",
    citation: "Gabel et al. 2022, Scientific Reports",
    url: "https://doaj.org/article/66f343f830484db896f2ef767ece0c1a",
    surprising: true,
  },
  {
    id: "spine",
    system: "musculoskeletal",
    stat: "+5 cm",
    headline: "Astronauts grow taller",
    detail: "Unloaded spinal discs expand, adding up to ~5 cm of height, while the muscles supporting the spine lose almost 20% of their mass.",
    onset: "Days",
    onsetDay: 3,
    recovery: "Height returns on landing; herniated-disc risk is raised in the first year.",
    citation: "Chang et al. 2016, Spine",
    url: "https://www.smithsonianmag.com/smart-news/space-makes-astronauts-grow-taller-and-also-backs-180960922/",
  },
  {
    id: "sans",
    system: "vision",
    stat: "~70%",
    headline: "Eyes change shape (SANS)",
    detail: "Most long-duration crew show signs of spaceflight-associated neuro-ocular syndrome: optic-disc swelling, folds in the back of the eye and a shift toward farsightedness.",
    onset: "Months",
    onsetDay: 60,
    recovery: "Some changes persist years after flight.",
    citation: "Lee et al. 2020, npj Microgravity",
    url: "https://humanresearchroadmap.nasa.gov/",
  },
  {
    id: "inspiration4",
    system: "genome",
    stat: "~95%",
    headline: "Most molecular changes reverse, some don't",
    detail: "After Inspiration4's 3-day flight, crew recovered from about 95% of measured biological changes within months. Anti-inflammatory cytokines spiked on return, and some proteins and genes stayed altered.",
    onset: "Days",
    onsetDay: 3,
    recovery: "Months; a minority of changes persisted.",
    citation: "Mason et al., SOMA package, Nature 2024",
    url: "https://foxweather.com/earth-space/spaceflight-molecular-changes-astronauts-inspiration-4",
  },
  {
    id: "twins",
    system: "genome",
    stat: "n = 1",
    headline: "The NASA Twins Study",
    detail: "Scott Kelly's year in space vs his identical twin on Earth: changes in gene expression, immune response, telomere dynamics, chromosomal inversions and cognition were tracked across 10 research teams.",
    onset: "Year-long",
    onsetDay: 120,
    recovery: "Most changes reversed; some, including cognitive and chromosomal effects, lingered.",
    citation: "Garrett-Bakelman et al. 2019, Science",
    url: "https://www.sciencedaily.com/releases/2019/04/190411165113.htm",
  },
  {
    id: "co2",
    system: "respiratory",
    stat: "~10×",
    headline: "Cabin air holds ~10× Earth's CO₂",
    detail: "ISS CO₂ runs around 2–4 mmHg versus ~0.3 mmHg outdoors on Earth. Without convection, exhaled CO₂ can pool around a sleeping astronaut's face; crews report headaches.",
    onset: "Whole mission",
    onsetDay: 1,
    recovery: "Immediate on return.",
    citation: "NASA-STD-3001 Vol 2 Rev C (2022)",
    url: "https://www.nasa.gov/ochmo/",
  },
];

export interface ProjectionPoint {
  day: number;
  dose: number;
  bone: number;
  calf: number;
  phase: string;
}

export interface Phase {
  env: EnvironmentId;
  days: number;
}

/**
 * Population-level projection across mission phases. Bone uses ~1%/month scaled by gravity and exercise
 * adherence; calf loss saturates (see calfLoss).
 */
export function projectMission(phases: Phase[], adherence: number, priorDose = 0): ProjectionPoint[] {
  const total = phases.reduce((a, p) => a + p.days, 0);
  const step = Math.max(1, Math.round(total / 160));
  const out: ProjectionPoint[] = [];
  let dose = priorDose;
  let bone = 0;
  let unloadedDays = 0;
  let day = 0;
  out.push({ day: 0, dose, bone: 0, calf: 0, phase: ENV_MAP[phases[0].env].short });
  for (const ph of phases) {
    const env = ENV_MAP[ph.env];
    const gf = 1 - Math.min(env.gravityG, 1);
    for (let i = 0; i < ph.days; i++) {
      day++;
      dose += env.doseRate;
      bone -= (gf / 30.4) * (1 - 0.5 * adherence);
      unloadedDays += gf;
      if (day % step === 0 || day === total) {
        out.push({ day, dose, bone, calf: -calfLoss(unloadedDays, adherence), phase: env.short });
      }
    }
  }
  return out;
}

export function projectionSummary(phases: Phase[], adherence: number) {
  const pts = projectMission(phases, adherence);
  const end = pts[pts.length - 1];
  return {
    days: end.day,
    dose: end.dose,
    dosePctOfLimit: (end.dose / CAREER_LIMIT_MSV) * 100,
    bone: end.bone,
    calf: end.calf,
    xrays: end.dose / 0.1,
    exceedsLimit: end.dose > CAREER_LIMIT_MSV,
  };
}

/** Reference missions for the projector presets. */
export const PRESETS: { id: string; label: string; phases: Phase[] }[] = [
  { id: "iss6", label: "ISS · 6 months", phases: [{ env: "iss", days: 182 }] },
  { id: "kelly", label: "ISS · 1 year", phases: [{ env: "iss", days: 340 }] },
  { id: "artemis", label: "Lunar base · 30 days", phases: [{ env: "gateway", days: 5 }, { env: "lunar_base", days: 30 }, { env: "gateway", days: 5 }] },
  {
    id: "mars",
    label: "Mars conjunction-class · ~2.6 yr",
    phases: [
      { env: "mars_transit", days: 200 },
      { env: "mars_base", days: 550 },
      { env: "mars_transit", days: 200 },
    ],
  },
];
