// Personal medical factors and the onboard pharmacy.
//
// Profiles are fictional (the crew are composites built on the real Inspiration4 lab baselines). The drug list is a
// representative deep-space kit modeled on the categories of the ISS medical kit; quantities and dates are
// illustrative. Interaction rules are a small demo rule set, NOT a clinical decision tool.

import { MISSION_PLAN, missionDate } from "./deepSpace";

export type Allergy = "penicillin" | "sulfonamide" | "nsaid";
export type Condition = "stage1_hypertension" | "low_vitamin_d" | "myopia";
export type LatentVirus = "EBV" | "VZV" | "CMV" | "HSV-1";

export interface MedicalProfile {
  crewId: string;
  age: number;
  sex: "F" | "M";
  allergies: Allergy[];
  conditions: Condition[];
  currentMeds: { drugId: string; schedule: string }[];
  /** Seropositive viruses that can reactivate under spaceflight stress (Mehta et al., NASA JSC). */
  latentViruses: LatentVirus[];
  priorFlights: number;
  dietary: string[];
  fitness: "high" | "moderate";
  notes: string[];
}

export const CONDITION_LABEL: Record<Condition, string> = {
  stage1_hypertension: "Stage 1 hypertension, diet-controlled",
  low_vitamin_d: "Low vitamin D preflight (supplemented)",
  myopia: "Myopia; watch for hyperopic shift (SANS)",
};

export const ALLERGY_LABEL: Record<Allergy, string> = {
  penicillin: "Penicillin (rash)",
  sulfonamide: "Sulfonamide antibiotics",
  nsaid: "NSAIDs (hives)",
};

export const MEDICAL: Record<string, MedicalProfile> = {
  vega: {
    crewId: "vega",
    age: 46,
    sex: "F",
    allergies: ["sulfonamide"],
    conditions: ["myopia"],
    currentMeds: [],
    latentViruses: ["EBV", "VZV"],
    priorFlights: 2,
    dietary: [],
    fitness: "high",
    notes: ["Two prior long-duration flights: prior dose counts toward the 600 mSv career limit."],
  },
  okafor: {
    crewId: "okafor",
    age: 39,
    sex: "M",
    allergies: [],
    conditions: [],
    currentMeds: [{ drugId: "melatonin", schedule: "3 mg at sleep time, as needed" }],
    latentViruses: ["EBV", "VZV", "CMV"],
    priorFlights: 1,
    dietary: ["Vegetarian"],
    fitness: "high",
    notes: ["Sleep-shift work on transit: watch reliance on sleep medication."],
  },
  lindqvist: {
    crewId: "lindqvist",
    age: 41,
    sex: "F",
    allergies: ["penicillin"],
    conditions: ["low_vitamin_d"],
    currentMeds: [
      { drugId: "vitamin_d3", schedule: "1000 IU daily" },
      { drugId: "ocp_continuous", schedule: "1 tablet daily, continuous (menstrual suppression plan)" },
    ],
    latentViruses: ["EBV", "VZV", "HSV-1"],
    priorFlights: 0,
    dietary: ["Lactose intolerant"],
    fitness: "moderate",
    notes: ["First flight. Bone-loss risk elevated: watch calcium and resistance exercise."],
  },
  tanaka: {
    crewId: "tanaka",
    age: 44,
    sex: "M",
    allergies: ["nsaid"],
    conditions: ["stage1_hypertension"],
    currentMeds: [],
    latentViruses: ["EBV", "VZV", "CMV"],
    priorFlights: 1,
    dietary: [],
    fitness: "moderate",
    notes: ["Crew medical officer: when he is the patient, care passes to the backup medical officer.", "Known mild hypertension: personal blood-pressure range applied."],
  },
};

/** Personal blood-pressure ranges for known hypertension (the PDF's example of a pre-existing condition). */
export function personalBpThresholds(crewId: string, indicatorId: string) {
  const m = MEDICAL[crewId];
  if (!m?.conditions.includes("stage1_hypertension")) return undefined;
  if (indicatorId === "systolic_bp") return { low: { watch: 100, action: 92, critical: 80 }, high: { watch: 142, action: 160, critical: 180 } };
  if (indicatorId === "diastolic_bp") return { low: { watch: 62, action: 55, critical: 45 }, high: { watch: 92, action: 100, critical: 120 } };
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Pharmacy

export interface Drug {
  id: string;
  name: string;
  dose: string;
  use: string;
  stock: number;
  unit: string;
  expires: string; // YYYY-MM-DD
  allergyTag?: Allergy;
  /** Interacting drug ids with severity and why. */
  interacts?: { with: string; severity: "avoid" | "caution"; why: string }[];
  /** Conditions that call for caution. */
  conditionCaution?: { condition: Condition; why: string }[];
  sedating?: boolean;
  sideEffects: string[];
}

export const PHARMACY: Drug[] = [
  { id: "acetaminophen", name: "Acetaminophen", dose: "500 mg tablet", use: "Pain, fever", stock: 120, unit: "tablets", expires: "2028-06-30", sideEffects: ["Nausea"] },
  {
    id: "ibuprofen",
    name: "Ibuprofen",
    dose: "400 mg tablet",
    use: "Pain, inflammation",
    stock: 100,
    unit: "tablets",
    expires: "2027-11-30",
    allergyTag: "nsaid",
    interacts: [
      { with: "aspirin", severity: "avoid", why: "Two NSAIDs together raise bleeding and stomach-ulcer risk." },
      { with: "sertraline", severity: "caution", why: "SSRIs plus NSAIDs increase gastrointestinal bleeding risk." },
    ],
    conditionCaution: [{ condition: "stage1_hypertension", why: "NSAIDs can raise blood pressure." }],
    sideEffects: ["Stomach upset", "Heartburn"],
  },
  { id: "aspirin", name: "Aspirin", dose: "325 mg tablet", use: "Pain; suspected heart attack", stock: 60, unit: "tablets", expires: "2028-03-31", allergyTag: "nsaid", sideEffects: ["Stomach upset", "Bleeding gums"] },
  {
    id: "promethazine",
    name: "Promethazine",
    dose: "25 mg injection/tablet",
    use: "Space motion sickness",
    stock: 30,
    unit: "doses",
    expires: "2027-09-30",
    sedating: true,
    interacts: [{ with: "zolpidem", severity: "caution", why: "Additive sedation: impaired alertness the next shift." }],
    sideEffects: ["Drowsiness", "Dry mouth"],
  },
  {
    id: "zolpidem",
    name: "Zolpidem",
    dose: "5 mg tablet",
    use: "Insomnia",
    stock: 40,
    unit: "tablets",
    expires: "2028-01-31",
    sedating: true,
    interacts: [
      { with: "promethazine", severity: "caution", why: "Additive sedation." },
      { with: "melatonin", severity: "caution", why: "Additive sedation; use one sleep aid at a time." },
    ],
    sideEffects: ["Next-day drowsiness", "Sleep-walking"],
  },
  { id: "melatonin", name: "Melatonin", dose: "3 mg tablet", use: "Sleep timing", stock: 90, unit: "tablets", expires: "2027-12-31", sedating: true, sideEffects: ["Morning grogginess"] },
  { id: "modafinil", name: "Modafinil", dose: "100 mg tablet", use: "Fatigue during critical operations", stock: 20, unit: "tablets", expires: "2028-08-31", sideEffects: ["Headache", "Insomnia"] },
  {
    id: "ciprofloxacin",
    name: "Ciprofloxacin",
    dose: "500 mg tablet",
    use: "Urinary and GI infections",
    stock: 28,
    unit: "tablets",
    expires: "2027-07-31",
    interacts: [{ with: "calcium_d", severity: "caution", why: "Calcium binds ciprofloxacin: take it 2 h before or 6 h after calcium." }],
    sideEffects: ["Tendon pain (stop and report)", "Nausea"],
  },
  { id: "amox_clav", name: "Amoxicillin-clavulanate", dose: "875 mg tablet", use: "Skin, dental and respiratory infections", stock: 20, unit: "tablets", expires: "2027-04-30", allergyTag: "penicillin", sideEffects: ["Diarrhea", "Rash (stop and report)"] },
  { id: "tmp_smx", name: "Trimethoprim-sulfamethoxazole", dose: "160/800 mg tablet", use: "Urinary and skin infections", stock: 20, unit: "tablets", expires: "2028-02-29", allergyTag: "sulfonamide", sideEffects: ["Rash", "Nausea"] },
  { id: "valacyclovir", name: "Valacyclovir", dose: "1 g tablet", use: "Shingles or cold-sore reactivation", stock: 21, unit: "tablets", expires: "2028-05-31", sideEffects: ["Headache"] },
  { id: "loratadine", name: "Loratadine", dose: "10 mg tablet", use: "Allergies, hives", stock: 60, unit: "tablets", expires: "2028-10-31", sideEffects: [] },
  { id: "epinephrine", name: "Epinephrine auto-injector", dose: "0.3 mg", use: "Anaphylaxis", stock: 4, unit: "injectors", expires: "2027-03-01", sideEffects: ["Racing heart", "Tremor"] },
  { id: "ondansetron", name: "Ondansetron", dose: "4 mg dissolving tablet", use: "Nausea, including radiation sickness", stock: 30, unit: "tablets", expires: "2028-07-31", sideEffects: ["Headache", "Constipation"] },
  {
    id: "pseudoephedrine",
    name: "Pseudoephedrine",
    dose: "30 mg tablet",
    use: "Congestion from the fluid shift",
    stock: 40,
    unit: "tablets",
    expires: "2027-12-31",
    conditionCaution: [{ condition: "stage1_hypertension", why: "Decongestants raise blood pressure and heart rate." }],
    interacts: [{ with: "modafinil", severity: "caution", why: "Two stimulants: higher heart rate and blood pressure." }],
    sideEffects: ["Racing heart", "Insomnia"],
  },
  { id: "sertraline", name: "Sertraline", dose: "50 mg tablet", use: "Depression or anxiety (flight-surgeon directed)", stock: 30, unit: "tablets", expires: "2028-04-30", sideEffects: ["Nausea", "Sleep changes"] },
  { id: "lidocaine", name: "Lidocaine 1%", dose: "5 mL vial", use: "Local anesthesia for dental care and wound repair", stock: 10, unit: "vials", expires: "2027-10-31", sideEffects: [] },
  { id: "calcium_d", name: "Calcium + vitamin D", dose: "600 mg / 400 IU tablet", use: "Bone protection", stock: 180, unit: "tablets", expires: "2028-12-31", sideEffects: ["Constipation"] },
  { id: "vitamin_d3", name: "Vitamin D3", dose: "1000 IU", use: "Vitamin D supplementation", stock: 365, unit: "tablets", expires: "2029-04-30", sideEffects: [] },
  { id: "ocp_continuous", name: "Levonorgestrel / ethinyl estradiol", dose: "0.1/0.02 mg tablet", use: "Menstrual suppression plan", stock: 120, unit: "tablets", expires: "2029-01-31", sideEffects: ["Spotting"] },
];

export const DRUG = Object.fromEntries(PHARMACY.map((d) => [d.id, d])) as Record<string, Drug>;

export interface DoseEntry {
  crewId: string;
  drugId: string;
  day: number;
  at: string; // ISO
  sideEffects?: string[];
}

export interface DoseCheck {
  severity: "block" | "warn" | "info";
  text: string;
}

const DAY = 86_400_000;
export const MISSION_END = MISSION_PLAN[MISSION_PLAN.length - 1].end;

export function stockLeft(drug: Drug, log: DoseEntry[]) {
  return drug.stock - log.filter((l) => l.drugId === drug.id).length;
}

export type ShelfStatus = "expired" | "expiring" | "expires-before-return" | "ok";

/** Shelf-life status on a mission day: expired, expiring within 60 days, or expiring before the crew is home. */
export function shelfStatus(drug: Drug, day: number): { status: ShelfStatus; daysLeft: number } {
  const now = missionDate(day).getTime();
  const exp = new Date(drug.expires + "T23:59:59Z").getTime();
  const daysLeft = Math.floor((exp - now) / DAY);
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= 60) return { status: "expiring", daysLeft };
  if (exp < MISSION_END.getTime()) return { status: "expires-before-return", daysLeft };
  return { status: "ok", daysLeft };
}

/**
 * Safety check before a dose: allergies, interactions with current medicines and anything taken in the last 24 h,
 * condition cautions, expiry and stock. Blocks are hard stops that need flight-surgeon override.
 */
export function checkDose(crewId: string, drugId: string, day: number, log: DoseEntry[]): DoseCheck[] {
  const drug = DRUG[drugId];
  const m = MEDICAL[crewId];
  if (!drug || !m) return [{ severity: "block", text: "Unknown crew member or medication." }];
  const out: DoseCheck[] = [];
  if (drug.allergyTag && m.allergies.includes(drug.allergyTag)) {
    out.push({ severity: "block", text: `Allergy: ${ALLERGY_LABEL[drug.allergyTag]}. Do not give ${drug.name}.` });
  }
  const recent = new Set([...m.currentMeds.map((c) => c.drugId), ...log.filter((l) => l.crewId === crewId && day - l.day <= 1).map((l) => l.drugId)]);
  recent.delete(drugId);
  for (const other of recent) {
    const rule = drug.interacts?.find((i) => i.with === other) ?? DRUG[other]?.interacts?.find((i) => i.with === drugId);
    if (rule) out.push({ severity: rule.severity === "avoid" ? "block" : "warn", text: `Interaction with ${DRUG[other]?.name ?? other}: ${rule.why}` });
  }
  for (const c of drug.conditionCaution ?? []) {
    if (m.conditions.includes(c.condition)) out.push({ severity: "warn", text: `${CONDITION_LABEL[c.condition]}: ${c.why}` });
  }
  const shelf = shelfStatus(drug, day);
  if (shelf.status === "expired") out.push({ severity: "warn", text: `Expired ${-shelf.daysLeft} days ago. Potency may be reduced; flight surgeon to approve use.` });
  if (stockLeft(drug, log) <= 0) out.push({ severity: "block", text: "Out of stock." });
  if (drug.sedating) out.push({ severity: "info", text: "Sedating: no EVA, piloting or critical tasks for 8 hours." });
  // alternatives when blocked
  if (out.some((o) => o.severity === "block") && drug.allergyTag === "nsaid") out.push({ severity: "info", text: "Alternative for pain or fever: acetaminophen." });
  if (out.some((o) => o.severity === "block") && drug.allergyTag === "penicillin") out.push({ severity: "info", text: "Alternatives for infection: ciprofloxacin or trimethoprim-sulfamethoxazole (check allergies)." });
  return out;
}

/** How much of the kit runs out of shelf life before the crew is back on Earth. */
export function shelfLifeCliff(day: number) {
  const rows = PHARMACY.map((d) => ({ drug: d, ...shelfStatus(d, day) }));
  return {
    rows,
    beforeReturn: rows.filter((r) => r.status !== "ok").length,
    total: rows.length,
    returnDate: MISSION_END.toISOString().slice(0, 10),
  };
}

/** Low-stock warning: fewer than 20% of the original supply, or fewer than 5 units. */
export function lowStock(drug: Drug, log: DoseEntry[]) {
  const left = stockLeft(drug, log);
  return left < Math.max(5, drug.stock * 0.2);
}

/** Heavy reliance on sleep medication: 4+ sedative sleep-aid doses in the last 7 days (PDF: sleep quality). */
export function sleepAidReliance(crewId: string, day: number, log: DoseEntry[]) {
  const n = log.filter((l) => l.crewId === crewId && day - l.day < 7 && (l.drugId === "zolpidem" || l.drugId === "melatonin")).length;
  return { doses: n, flag: n >= 4 };
}
