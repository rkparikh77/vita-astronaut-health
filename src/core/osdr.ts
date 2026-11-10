// Parse NASA OSDR "TRANSFORMED" lab CSVs (Inspiration4, OSD-569 CBC and OSD-575 CMP).
// Columns follow the pattern <analyte>_value_<unit>, <analyte>_range_min_<unit>, <analyte>_range_max_<unit>.

export interface LabValue {
  value: number;
  min?: number;
  max?: number;
  unit: string;
}

export interface Timepoint {
  label: string; // e.g. "L-92" (launch minus 92 days) or "R+1" (return plus 1 day)
  day: number; // signed day relative to launch/return
  phase: "preflight" | "postflight";
  labs: Record<string, LabValue>;
}

export interface CrewLabs {
  id: string; // C001..C004
  timepoints: Timepoint[];
}

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").trim();
  return clean.split(/\r?\n/).map((line) => line.split(","));
}

export function parseTimepoint(label: string): { day: number; phase: Timepoint["phase"] } {
  const m = /^([LR])([+-])(\d+)$/.exec(label);
  if (!m) throw new Error(`Unrecognised timepoint: ${label}`);
  const n = Number(m[3]) * (m[2] === "-" ? -1 : 1);
  return { day: n, phase: m[1] === "L" ? "preflight" : "postflight" };
}

/** Parse one transformed OSDR lab CSV into crew → timepoint → analyte map. */
export function parseLabCsv(text: string): Map<string, Map<string, Record<string, LabValue>>> {
  const rows = parseCsv(text);
  const header = rows[0];
  const out = new Map<string, Map<string, Record<string, LabValue>>>();

  // Group columns by analyte.
  const analytes = new Map<string, { value?: number; min?: number; max?: number; unit: string }>();
  header.forEach((col, i) => {
    const m = /^(.*?)_(value|range_min|range_max|concentration)(?:_(.*))?$/.exec(col);
    if (!m) return;
    const [, name, kind, unit = ""] = m;
    const entry = analytes.get(name) ?? { unit };
    // Multiplex panels report "<analyte>_concentration_<unit>"; treat it as the value.
    if (kind === "value" || kind === "concentration") entry.value = i;
    if (kind === "range_min") entry.min = i;
    if (kind === "range_max") entry.max = i;
    analytes.set(name, entry);
  });

  for (const row of rows.slice(1)) {
    const sample = row[0];
    // Sample names look like C001_whole-blood_L-3_cbc or C001_serum_R+45
    const m = /^(C\d{3})_[^_]+_([LR][+-]\d+)/.exec(sample);
    if (!m) continue;
    const [, crew, tp] = m;
    const labs: Record<string, LabValue> = {};
    for (const [name, a] of analytes) {
      if (a.value === undefined) continue;
      const v = Number(row[a.value]);
      if (row[a.value] === "" || Number.isNaN(v)) continue;
      const lab: LabValue = { value: v, unit: a.unit };
      if (a.min !== undefined && row[a.min] !== "") lab.min = Number(row[a.min]);
      if (a.max !== undefined && row[a.max] !== "") lab.max = Number(row[a.max]);
      labs[name] = lab;
    }
    if (!out.has(crew)) out.set(crew, new Map());
    const byTp = out.get(crew)!;
    byTp.set(tp, { ...(byTp.get(tp) ?? {}), ...labs });
  }
  return out;
}

/** Merge several parsed CSVs into a sorted crew list. */
export function mergeCrewLabs(...parsed: ReturnType<typeof parseLabCsv>[]): CrewLabs[] {
  const merged = new Map<string, Map<string, Record<string, LabValue>>>();
  for (const p of parsed) {
    for (const [crew, tps] of p) {
      if (!merged.has(crew)) merged.set(crew, new Map());
      const m = merged.get(crew)!;
      for (const [tp, labs] of tps) m.set(tp, { ...(m.get(tp) ?? {}), ...labs });
    }
  }
  return [...merged.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, tps]) => ({
      id,
      timepoints: [...tps.entries()]
        .map(([label, labs]) => ({ label, ...parseTimepoint(label), labs }))
        .sort((a, b) => (a.phase === b.phase ? a.day - b.day : a.phase === "preflight" ? -1 : 1)),
    }));
}

/** Median of preflight values for an analyte = personal baseline (median resists single outliers). */
export function preflightBaseline(crew: CrewLabs, analyte: string): number | undefined {
  const vals = crew.timepoints
    .filter((t) => t.phase === "preflight" && t.labs[analyte])
    .map((t) => t.labs[analyte].value)
    .sort((a, b) => a - b);
  if (!vals.length) return undefined;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

/** Lab reference range reported alongside the most recent preflight sample. */
export function referenceRange(crew: CrewLabs, analyte: string): { min?: number; max?: number } | undefined {
  const pre = crew.timepoints.filter((t) => t.phase === "preflight" && t.labs[analyte]);
  const last = pre[pre.length - 1];
  if (!last) return undefined;
  return { min: last.labs[analyte].min, max: last.labs[analyte].max };
}
