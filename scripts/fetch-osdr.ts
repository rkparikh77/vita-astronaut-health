// Data pipeline: download Inspiration4 clinical + multiplex panels from NASA OSDR.
//   src/data/inspiration4.json        CBC + CMP (personal baselines for the crew app)
//   src/data/inspiration4-panels.json all panels in a compact analyte × crew × timepoint matrix (research page)
// Run with `npm run data`. Outputs are committed so the app builds offline.
import { writeFileSync, mkdirSync } from "node:fs";
import { mergeCrewLabs, parseLabCsv } from "../src/core/osdr";

const BASE = "https://osdr.nasa.gov/geode-py/ws/studies";
const SOURCES = [
  { study: "OSD-569", file: "LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv", panel: "CBC", title: "Complete blood count" },
  { study: "OSD-575", file: "LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv", panel: "CMP", title: "Comprehensive metabolic panel" },
  { study: "OSD-575", file: "LSDS-8_Multiplex_serum_immune_EvePanel_TRANSFORMED.csv", panel: "Cytokine", title: "Serum cytokines & chemokines (71-plex)" },
  { study: "OSD-575", file: "LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv", panel: "Cardio", title: "Serum cardiovascular proteins (9-plex)" },
] as const;

const UNIT: Record<string, string> = {
  picogram_per_milliliter: "pg/mL",
  nanogram_per_milliliter: "ng/mL",
  milligram_per_deciliter: "mg/dL",
  gram_per_deciliter: "g/dL",
  millimol_per_liter: "mmol/L",
  units_per_liter: "U/L",
  cells_per_microliter: "cells/µL",
  thousand_per_microliter: "K/µL",
  million_per_microliter: "M/µL",
  percent: "%",
  femtoliter: "fL",
  picogram: "pg",
  grams_per_deciliter: "g/dL",
};

const PRETTY: Record<string, string> = {
  absolute_basophils: "Basophils (abs)",
  absolute_eosinophils: "Eosinophils (abs)",
  absolute_lymphocytes: "Lymphocytes (abs)",
  absolute_monocytes: "Monocytes (abs)",
  absolute_neutrophils: "Neutrophils (abs)",
  white_blood_cell_count: "White blood cells",
  red_blood_cell_count: "Red blood cells",
  platelet_count: "Platelets",
  urea_nitrogen_bun: "Blood urea nitrogen",
  bun_to_creatinine_ratio: "BUN/creatinine ratio",
  albumin_to_globulin_ratio: "Albumin/globulin ratio",
  alkaline_phosphatase: "Alkaline phosphatase",
  carbon_dioxide: "Bicarbonate (CO₂)",
  egfr_non_african_american: "eGFR",
  total_bilirubin: "Total bilirubin",
  total_protein: "Total protein",
  a2_macroglobulin: "α2-Macroglobulin",
  agp: "α1-Acid glycoprotein",
  crp: "C-reactive protein",
  fetuin_a36: "Fetuin-A",
  l_selectin: "L-selectin",
  pf4: "Platelet factor 4",
  sap: "Serum amyloid P",
  mcv: "MCV",
  mch: "MCH",
  mchc: "MCHC",
  mpv: "MPV",
  rdw: "RDW",
  alt: "ALT",
  ast: "AST",
};

function pretty(id: string, panel: string): string {
  if (PRETTY[id]) return PRETTY[id];
  if (panel === "Cytokine") {
    return id
      .replace(/_per_/g, "/")
      .replace(/_plus_/g, "+")
      .replace(/_/g, "-")
      .toUpperCase()
      .replace("Α", "α")
      .replace("Β", "β")
      .replace("Γ", "γ")
      .replace("Δ", "δ");
  }
  return id.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

async function download(study: string, file: string) {
  const url = `${BASE}/${study}/download?source=datamanager&file=${encodeURIComponent(file)}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${study}/${file}: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes("Sample Name")) throw new Error(`${study}/${file}: unexpected response`);
  return text;
}

async function main() {
  const parsed: Record<string, ReturnType<typeof parseLabCsv>> = {};
  for (const s of SOURCES) {
    process.stdout.write(`Fetching ${s.study} ${s.panel} … `);
    parsed[s.panel] = parseLabCsv(await download(s.study, s.file));
    console.log("ok");
  }

  const fetchedAt = new Date().toISOString();
  const mission = "SpaceX Inspiration4 (Sept 2021, 3-day orbital flight at ~585 km, 4 civilian crew)";
  const sourceMeta = SOURCES.map((s) => ({
    study: s.study,
    panel: s.panel,
    title: s.title,
    file: s.file,
    url: `https://osdr.nasa.gov/bio/repo/data/studies/${s.study}`,
  }));

  // 1. Clinical labs for the crew app (unchanged shape).
  const crew = mergeCrewLabs(parsed.CBC, parsed.CMP);
  mkdirSync("src/data", { recursive: true });
  writeFileSync("src/data/inspiration4.json", JSON.stringify({ source: sourceMeta.slice(0, 2), mission, fetchedAt, crew }, null, 1));

  // 2. Compact matrix of every analyte for the research page.
  const timepoints = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"];
  const crewIds = ["C001", "C002", "C003", "C004"];
  const analytes: { id: string; label: string; panel: string; unit: string; values: (number | null)[][] }[] = [];
  const skip = new Set(["egfr_african_american"]); // duplicate race-based eGFR; keep the race-free one only
  for (const s of SOURCES) {
    const p = parsed[s.panel];
    const names = new Set<string>();
    for (const tps of p.values()) for (const labs of tps.values()) Object.keys(labs).forEach((k) => names.add(k));
    for (const id of [...names].sort()) {
      if (skip.has(id)) continue;
      let unit = "";
      const values = crewIds.map((c) =>
        timepoints.map((tp) => {
          const lab = p.get(c)?.get(tp)?.[id];
          if (lab) unit = UNIT[lab.unit] ?? lab.unit;
          return lab ? lab.value : null;
        }),
      );
      analytes.push({ id: `${s.panel}:${id}`, label: pretty(id, s.panel), panel: s.panel, unit, values });
    }
  }
  writeFileSync(
    "src/data/inspiration4-panels.json",
    JSON.stringify({ source: sourceMeta, mission, fetchedAt, crew: crewIds, timepoints, analytes }),
  );
  console.log(`Wrote ${crew.length} crew × ${crew[0]?.timepoints.length} timepoints; ${analytes.length} analytes in the research matrix`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
