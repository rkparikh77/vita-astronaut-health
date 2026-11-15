import { hourlySeries, interpret, parseHapiCsv, SPDF_HAPI, WIND_FIELD, WIND_PLASMA, type SolarWind } from "@/core/solarWind";

const revalidate = 1800;

async function getCsv(id: string, parameters: string, min: Date, max: Date) {
  const url = `${SPDF_HAPI}?id=${id}&parameters=${parameters}&time.min=${min.toISOString().slice(0, 19)}Z&time.max=${max.toISOString().slice(0, 19)}Z&format=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), next: { revalidate } });
  if (!res.ok) throw new Error(`SPDF HTTP ${res.status}`);
  return parseHapiCsv(await res.text());
}

/** Last 4 days of L1 solar wind from NASA Wind via SPDF CDAWeb (HAPI). Never throws. */
export async function fetchSolarWind(now = new Date()): Promise<SolarWind> {
  const min = new Date(now.getTime() - 4 * 86400000);
  const base = { source: "NASA SPDF CDAWeb (HAPI)", spacecraft: "Wind (SWE + MFI key parameters)" };
  try {
    const [plasma, field] = await Promise.all([getCsv(WIND_PLASMA, "V_GSE,Np,Pressure", min, now), getCsv(WIND_FIELD, "BF1,BGSMc", min, now)]);
    if (!plasma.length && !field.length) throw new Error("no samples in window");
    const series = hourlySeries(plasma, field);
    return { live: true, ...base, series, ...interpret(series) };
  } catch (e) {
    return {
      live: false,
      ...base,
      series: [],
      level: "quiet",
      notes: [],
      error: e instanceof Error && /abort|timeout/i.test(e.name + e.message) ? "request timed out" : e instanceof Error ? e.message : "SPDF unreachable",
    };
  }
}
