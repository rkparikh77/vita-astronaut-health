import { describe, expect, it } from "vitest";
import { thresholdsFor, CREW } from "../crew";
import { checkDose, lowStock, shelfLifeCliff, shelfStatus, sleepAidReliance, DRUG, type DoseEntry } from "../medical";
import { nextConference, score, type CheckIn } from "../wellbeing";

const DAY = 112; // 2027-03-11

describe("pharmacy safety checks", () => {
  it("blocks an NSAID for the crew member allergic to NSAIDs and offers acetaminophen", () => {
    const c = checkDose("tanaka", "ibuprofen", DAY, []);
    expect(c.some((x) => x.severity === "block" && /Allergy/.test(x.text))).toBe(true);
    expect(c.some((x) => /acetaminophen/.test(x.text))).toBe(true);
  });

  it("blocks penicillin for a penicillin-allergic crew member", () => {
    expect(checkDose("lindqvist", "amox_clav", DAY, []).some((x) => x.severity === "block")).toBe(true);
  });

  it("warns about ciprofloxacin with a daily calcium supplement taken in the last 24 h", () => {
    const log: DoseEntry[] = [{ crewId: "vega", drugId: "calcium_d", day: DAY, at: "" }];
    expect(checkDose("vega", "ciprofloxacin", DAY, log).some((x) => x.severity === "warn" && /Calcium/.test(x.text))).toBe(true);
  });

  it("flags additive sedation with a current sleep aid", () => {
    expect(checkDose("okafor", "zolpidem", DAY, []).some((x) => /melatonin/i.test(x.text))).toBe(true);
  });

  it("cautions decongestants for known hypertension", () => {
    expect(checkDose("tanaka", "pseudoephedrine", DAY, []).some((x) => /hypertension/i.test(x.text))).toBe(true);
  });

  it("gives a clean check for a safe dose", () => {
    expect(checkDose("vega", "acetaminophen", DAY, []).filter((x) => x.severity !== "info")).toEqual([]);
  });

  it("knows what has expired and what runs out before Earth return", () => {
    expect(shelfStatus(DRUG.epinephrine, DAY).status).toBe("expired");
    expect(shelfStatus(DRUG.amox_clav, DAY).status).toBe("expiring");
    const cliff = shelfLifeCliff(DAY);
    expect(cliff.beforeReturn).toBeGreaterThan(cliff.total / 2);
    expect(cliff.returnDate).toBe("2029-08-24");
  });

  it("tracks stock and sleep-aid reliance", () => {
    const log: DoseEntry[] = Array.from({ length: 4 }, (_, i) => ({ crewId: "okafor", drugId: "zolpidem", day: DAY - i, at: "" }));
    expect(sleepAidReliance("okafor", DAY, log).flag).toBe(true);
    expect(lowStock(DRUG.epinephrine, [])).toBe(true);
    expect(lowStock(DRUG.acetaminophen, [])).toBe(false);
  });
});

describe("personal factors change the warning range", () => {
  it("applies a personal blood-pressure range only to the crew member with hypertension", () => {
    const tanaka = CREW.find((c) => c.id === "tanaka")!;
    const vega = CREW.find((c) => c.id === "vega")!;
    expect(thresholdsFor(tanaka, "systolic_bp")?.high?.watch).toBe(142);
    expect(thresholdsFor(vega, "systolic_bp")).toBeUndefined();
  });
});

describe("private wellbeing check-in", () => {
  const base: CheckIn = { crewId: "vega", day: DAY, phq: [0, 1], gad: [1, 0], sleepQuality: 4, cohesion: 4, workload: 3, sharing: "private" };

  it("shares nothing by default when screens are negative", () => {
    const r = score(base);
    expect(r.positive).toEqual({ depression: false, anxiety: false });
    expect(r.visibleToSurgeon).toBe("Nothing");
  });

  it("suggests an earlier conference on a positive screen but keeps answers private", () => {
    const r = score({ ...base, phq: [2, 1] });
    expect(r.positive.depression).toBe(true);
    expect(r.autoEscalate).toBe(false);
    expect(r.visibleToSurgeon).toBe("Nothing");
    expect(r.suggestions[0]).toMatch(/private conference/);
  });

  it("escalates only a flag when a serious-risk threshold is crossed", () => {
    const prev = { ...base, day: DAY - 7, phq: [2, 2] as [number, number] };
    const r = score({ ...base, phq: [2, 1] }, [prev]);
    expect(r.autoEscalate).toBe(true);
    expect(r.visibleToSurgeon).toMatch(/flag/);
    expect(score({ ...base, phq: [3, 3] }).autoEscalate).toBe(true);
  });

  it("schedules the biweekly private conference", () => {
    expect(nextConference(112)).toBe(126);
    expect(nextConference(112, true)).toBe(113);
  });
});
