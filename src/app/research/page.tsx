"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Download, FlaskConical, Info, Search, TriangleAlert } from "lucide-react";
import panels from "@/data/inspiration4-panels.json";
import { POST, summarize, type AnalyteStats, type PanelMatrix } from "@/core/research";
import { CountUp, DataBadge, DIV_DOWN, DIV_UP, divergingColor, SERIES } from "@/components/viz";

const M = panels as unknown as PanelMatrix & { source: { study: string; panel: string; title: string; url: string }[]; mission: string };
const PANELS = ["All", "Cytokine", "CBC", "CMP", "Cardio"] as const;
const PANEL_NAME: Record<string, string> = { CBC: "Blood count", CMP: "Metabolic", Cytokine: "Cytokines", Cardio: "Cardiovascular" };
const CREW_LABEL = ["C001", "C002", "C003", "C004"];

const fmtFc = (l2: number) => {
  const x = 2 ** l2;
  return x >= 1 ? `${x.toFixed(2)}×` : `${x.toFixed(2)}×`;
};
const fmtP = (p: number) => (p < 0.001 ? p.toExponential(1) : p.toFixed(3));

export default function ResearchPage() {
  const summary = useMemo(() => summarize(M), []);
  const [panel, setPanel] = useState<(typeof PANELS)[number]>("All");
  const [tpIdx, setTpIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("Cytokine:il_6");

  const filtered = summary.stats.filter(
    (s) => (panel === "All" || s.panel === panel) && (!query || s.label.toLowerCase().includes(query.toLowerCase())),
  );
  const selected = summary.stats.find((s) => s.id === selectedId) ?? summary.stats[0];
  const nMeasurements = M.analytes.reduce((a, x) => a + x.values.flat().filter((v) => v !== null).length, 0);
  const fdrHits = summary.stats.filter((s) => (s.post[tpIdx].q ?? 1) < 0.1).length;
  const sigAtTp = summary.stats.filter((s) => s.post[tpIdx].p < 0.05).length;
  const expectedByChance = Math.round(summary.stats.length * 0.05);
  const topUp = [...summary.stats].filter((s) => s.post[0].concordant === 4).sort((a, b) => b.post[0].mean - a.post[0].mean)[0];

  const volcano = filtered.map((s) => {
    const st = s.post[tpIdx];
    return {
      id: s.id,
      label: s.label,
      panel: s.panel,
      x: Number(st.mean.toFixed(3)),
      y: Number((-Math.log10(Math.max(st.p, 1e-6))).toFixed(3)),
      p: st.p,
      q: st.q ?? 1,
      concordant: st.concordant,
      sig: st.p < 0.05 && Math.abs(st.mean) >= 0.25,
    };
  });

  const xMax = Math.max(1, Math.ceil(Math.max(...volcano.map((v) => Math.abs(v.x)), 0) * 1.15 * 4) / 4);

  const heat = [...filtered].sort((a, b) => Math.abs(b.post[tpIdx].mean) - Math.abs(a.post[tpIdx].mean)).slice(0, 28);

  const downloadCsv = () => {
    const rows = [["analyte", "panel", "unit", ...POST.flatMap((tp) => [`${tp}_mean_log2fc`, `${tp}_p`, `${tp}_q`, `${tp}_concordant`]), "preflight_cv", "residual_at_R+82"]];
    for (const s of summary.stats) {
      rows.push([
        s.label,
        s.panel,
        s.unit,
        ...s.post.flatMap((p) => [p.mean.toFixed(4), p.p.toExponential(3), (p.q ?? 1).toExponential(3), `${p.concordant}/${p.n}`]),
        s.preflightCv.toFixed(4),
        s.residual82 === undefined ? "" : s.residual82.toFixed(3),
      ]);
    }
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vita-inspiration4-stats.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="pt-8">
      <section className="rise grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="panel-title flex items-center gap-2">
              <FlaskConical size={13} /> Research lab
            </p>
            <DataBadge kind="real" />
          </div>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
            Inspiration4
            <br />
            <span className="text-ink-3">blood, decoded</span>
          </h1>
          <p className="mt-4 max-w-xl text-ink-2">
            Every measurement NASA released from the first all-civilian orbital crew&apos;s blood: preflight, the day after
            landing, and months into recovery. Each change is measured against that astronaut&apos;s <i>own</i> preflight median.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Analytes" value={M.analytes.length} />
          <Kpi label="Measurements" value={nMeasurements} />
          <Kpi label="Crew × timepoints" text="4 × 7" />
          <Kpi label={`p < 0.05 at ${POST[tpIdx]}`} value={sigAtTp} note={`~${expectedByChance} expected by chance`} />
          <Kpi label="Pass FDR q < 0.1" value={fdrHits} note="n = 4 limits power" />
          <Kpi label="Changed ≥1.41× at R+1" text={`${summary.recoveredBy82}/${summary.changedAtR1}`} note="recovered by R+82" />
        </div>
      </section>

      {topUp && (
        <section className="panel ticks rise mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 p-5" style={{ animationDelay: "80ms" }}>
          <div className="panel-title">Headline</div>
          <p className="max-w-3xl text-lg leading-snug">
            The day after landing, <b style={{ color: DIV_UP }}>{topUp.label}</b> was up{" "}
            <span className="font-data">{fmtFc(topUp.post[0].mean)}</span> in <b>all four</b> crew, alongside anti-inflammatory IL-10. By R+82 it
            was back to baseline, the same post-landing cytokine spike the SOMA papers reported.
          </p>
          <button type="button" onClick={() => setSelectedId(topUp.id)} className="font-data ml-auto rounded-md border border-line-2 px-3 py-1.5 text-xs text-ink-2 hover:text-ink">
            Inspect →
          </button>
        </section>
      )}

      {/* Filters: one row above the charts */}
      <div className="sticky top-[61px] z-30 -mx-4 mt-6 flex flex-wrap items-center gap-2 border-y border-line bg-bg/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap gap-1">
          {PANELS.map((p) => (
            <Chip key={p} active={panel === p} onClick={() => setPanel(p)}>
              {p === "All" ? "All panels" : PANEL_NAME[p]}
            </Chip>
          ))}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <div className="flex gap-1">
          {POST.map((tp, i) => (
            <Chip key={tp} active={tpIdx === i} onClick={() => setTpIdx(i)}>
              {tp}
            </Chip>
          ))}
        </div>
        <label className="relative ml-auto">
          <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search analyte…"
            aria-label="Search analyte"
            className="font-data w-44 rounded-md border border-line-2 bg-panel py-1.5 pr-2 pl-8 text-xs text-ink"
          />
        </label>
      </div>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        {/* Volcano */}
        <div className="panel ticks p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="panel-title">Volcano · {POST[tpIdx]} vs preflight</h2>
            <span className="font-data text-[10px] text-ink-3">{filtered.length} analytes · click a point</span>
          </div>
          <div className="mt-3 h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -4 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="2 6" />
                <ReferenceArea x1={-0.25} x2={0.25} fill="var(--ink)" fillOpacity={0.02} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-xMax, xMax]}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  tick={{ fill: "var(--ink-3)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line)" }}
                  label={{ value: "mean log₂ fold change (crew)", position: "insideBottom", offset: -10, fill: "var(--ink-3)", fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, (max: number) => Math.max(2, Math.ceil(max * 2) / 2)]}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  tick={{ fill: "var(--ink-3)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "−log₁₀ p", angle: -90, position: "insideLeft", offset: 18, fill: "var(--ink-3)", fontSize: 10 }}
                />
                <ZAxis range={[60, 60]} />
                <ReferenceLine y={-Math.log10(0.05)} stroke="var(--ink-3)" strokeDasharray="4 4" label={{ value: "p = 0.05", fill: "var(--ink-3)", fontSize: 9, position: "insideTopRight" }} />
                <ReferenceLine x={0} stroke="var(--line-2)" />
                <Tooltip cursor={false} content={<VolcanoTip />} />
                <Scatter
                  data={volcano}
                  onClick={(d: { id?: string }) => d.id && setSelectedId(d.id)}
                  shape={(p: { cx?: number; cy?: number; payload?: (typeof volcano)[number] }) => {
                    const d = p.payload!;
                    const isSel = d.id === selected.id;
                    const fill = d.sig ? (d.x > 0 ? DIV_UP : DIV_DOWN) : "#4a5566";
                    return (
                      <g className="cursor-pointer">
                        <circle cx={p.cx} cy={p.cy} r={12} fill="transparent" />
                        <circle cx={p.cx} cy={p.cy} r={isSel ? 7 : d.sig ? 5 : 4} fill={fill} stroke={isSel ? "var(--ink)" : "var(--bg-2)"} strokeWidth={2} fillOpacity={d.sig ? 0.95 : 0.6} />
                        {(isSel || (d.sig && d.y > 1.6)) && (
                          <text x={(p.cx ?? 0) + 9} y={(p.cy ?? 0) + 3} fontSize={10} fill="var(--ink-2)" className="font-data">
                            {d.label}
                          </text>
                        )}
                      </g>
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="font-data mt-1 flex flex-wrap gap-4 text-[10px] text-ink-3">
            <span>
              <span style={{ color: DIV_UP }}>●</span> up, p &lt; 0.05
            </span>
            <span>
              <span style={{ color: DIV_DOWN }}>●</span> down, p &lt; 0.05
            </span>
            <span>
              <span className="text-[#4a5566]">●</span> not significant
            </span>
            <span>Paired t-test on log₂ ratios, df = 3</span>
          </div>
        </div>

        <AnalyteDetail s={selected} />
      </section>

      {/* Heatmap */}
      <section className="panel ticks mt-5 overflow-x-auto p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="panel-title">Fold-change heatmap · top movers at {POST[tpIdx]}</h2>
          <div className="flex items-center gap-2">
            <span className="font-data text-[10px] text-ink-3">0.35×</span>
            <div className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${DIV_DOWN}, #2a3240, ${DIV_UP})` }} />
            <span className="font-data text-[10px] text-ink-3">2.8×</span>
          </div>
        </div>
        <table className="mt-4 w-full min-w-[760px] border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th />
              {POST.map((tp) => (
                <th key={tp} colSpan={4} className="font-data pb-1 text-[10px] font-normal tracking-wider text-ink-3">
                  {tp}
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {POST.flatMap((tp) =>
                CREW_LABEL.map((c) => (
                  <th key={tp + c} className="font-data pb-1 text-[8px] font-normal text-ink-3">
                    {c.slice(-1)}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {heat.map((s) => (
              <tr key={s.id} className="group cursor-pointer" onClick={() => setSelectedId(s.id)}>
                <td className={`pr-3 text-right text-xs whitespace-nowrap ${s.id === selected.id ? "text-ink" : "text-ink-2 group-hover:text-ink"}`}>
                  {s.label} <span className="font-data text-[9px] text-ink-3">{PANEL_NAME[s.panel]}</span>
                </td>
                {s.post.flatMap((p) =>
                  p.perCrew.map((v, ci) => (
                    <td
                      key={p.tp + ci}
                      title={`${s.label} · ${CREW_LABEL[ci]} · ${p.tp}: ${v === null ? "n/a" : fmtFc(v)}`}
                      className="h-5 min-w-5 rounded-[3px]"
                      style={{ background: v === null ? "transparent" : divergingColor(v) }}
                    />
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* QC + methods */}
      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="panel ticks p-5">
          <h2 className="panel-title flex items-center gap-2">
            <TriangleAlert size={13} /> Quality control · whole-panel drift
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            When unrelated analytes in one assay all move together, sample handling or assay batch is a likelier cause than biology.
            This table shows the median log₂ change of every analyte in each panel.
          </p>
          <table className="font-data mt-3 w-full text-xs">
            <thead className="text-[10px] text-ink-3">
              <tr>
                <th className="py-1 text-left font-normal">Panel</th>
                {POST.map((tp) => (
                  <th key={tp} className="font-normal">
                    {tp}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["CBC", "CMP", "Cytokine", "Cardio"].map((p) => (
                <tr key={p} className="border-t border-line">
                  <td className="py-1.5 text-ink-2">{PANEL_NAME[p]}</td>
                  {POST.map((tp) => {
                    const sh = summary.shifts.find((x) => x.panel === p && x.tp === tp)!;
                    const big = Math.abs(sh.medianShift) >= 0.2;
                    return (
                      <td key={tp} className="text-center" style={{ color: sh.flagged ? "var(--watch)" : big ? "var(--ink)" : "var(--ink-3)" }}>
                        {sh.medianShift >= 0 ? "+" : ""}
                        {sh.medianShift.toFixed(2)}
                        {big && " ⚑"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-3">
            ⚑ marks a panel-wide shift of ≥0.2 log₂. The 9-protein cardiovascular panel dips at R+1, then drifts up at R+82 and R+194
            (L-selectin, PF4 and serum amyloid P roughly double at R+82 in one crew member), and the cytokine panel drifts down by R+194.
            Treat single-analyte changes at those timepoints with care. Blood counts and chemistry stay flat, as expected.
          </p>
        </div>

        <div className="panel ticks p-5">
          <h2 className="panel-title flex items-center gap-2">
            <Info size={13} /> Methods & sources
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li>
              <b className="text-ink">Baseline:</b> median of each astronaut&apos;s three preflight draws (L-92, L-44, L-3). Fold changes are
              log₂(post / baseline), so up and down are symmetric.
            </li>
            <li>
              <b className="text-ink">Test:</b> one-sample t-test of the four crew log₂ ratios against 0 (df = 3), exact Student-t p-values,
              Benjamini–Hochberg FDR across all {M.analytes.length} analytes per timepoint.
            </li>
            <li>
              <b className="text-ink">Recovery:</b> residual = share of the R+1 change still present at R+82; recovered if under 50%.
            </li>
            <li>
              <b className="text-ink">Caveat:</b> with four people, p &lt; 0.05 is hypothesis-generating. About {expectedByChance} hits are
              expected by chance alone at each timepoint.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {M.source.map((s) => (
              <a key={s.title} href={s.url} target="_blank" rel="noreferrer" className="font-data rounded-md border border-line-2 px-2.5 py-1.5 text-[11px] text-ink-2 hover:text-ink">
                {s.study} · {s.title} ↗
              </a>
            ))}
          </div>
          <button type="button" onClick={downloadCsv} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg">
            <Download size={14} /> Download computed statistics (CSV)
          </button>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, text, note }: { label: string; value?: number; text?: string; note?: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="panel-title text-[9px]">{label}</div>
      <div className="font-display mt-1 text-3xl font-extrabold">{value !== undefined ? <CountUp value={value} className="font-display" /> : text}</div>
      {note && <div className="font-data text-[9px] text-ink-3">{note}</div>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`font-data rounded-md px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${active ? "bg-ink text-bg" : "text-ink-2 hover:bg-panel-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function VolcanoTip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; panel: string; x: number; p: number; q: number; concordant: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line-2 bg-panel-2 px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-ink">{d.label}</div>
      <div className="font-data mt-1 space-y-0.5 text-ink-2">
        <div>{PANEL_NAME[d.panel]}</div>
        <div>
          fold change {fmtFc(d.x)} · log₂ {d.x.toFixed(2)}
        </div>
        <div>
          p {fmtP(d.p)} · q {fmtP(d.q)}
        </div>
        <div>same direction in {d.concordant}/4 crew</div>
      </div>
    </div>
  );
}

function AnalyteDetail({ s }: { s: AnalyteStats }) {
  const raw = M.analytes.find((a) => a.id === s.id)!;
  const data = M.timepoints.map((tp, i) => {
    const row: Record<string, number | string | null> = { tp };
    raw.values.forEach((v, c) => (row[CREW_LABEL[c]] = v[i]));
    return row;
  });
  const r1 = s.post[0];
  return (
    <div className="panel ticks p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="panel-title">{PANEL_NAME[s.panel]} · {s.unit}</div>
          <h3 className="font-display mt-1 text-4xl font-extrabold uppercase">{s.label}</h3>
        </div>
        <DataBadge kind="real" />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <Mini label="R+1 change" value={fmtFc(r1.mean)} color={Math.abs(r1.mean) >= 0.25 ? (r1.mean > 0 ? DIV_UP : DIV_DOWN) : undefined} />
        <Mini label="p / q" value={`${fmtP(r1.p)} / ${fmtP(r1.q ?? 1)}`} />
        <Mini label="Concordant" value={`${r1.concordant}/4`} />
        <Mini label="Preflight CV" value={`${(s.preflightCv * 100).toFixed(0)}%`} />
      </div>

      <div className="mt-4 h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -4 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="2 6" vertical={false} />
            <ReferenceArea x1="L-92" x2="L-3" fill="var(--ink)" fillOpacity={0.03} label={{ value: "preflight", fill: "var(--ink-3)", fontSize: 9, position: "insideTop" }} />
            <ReferenceLine x="R+1" stroke="var(--line-2)" strokeDasharray="3 3" label={{ value: "landing", fill: "var(--ink-3)", fontSize: 9, position: "insideTopRight" }} />
            <XAxis dataKey="tp" tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
            <YAxis tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (v >= 10000 ? `${(v / 1000).toFixed(0)}k` : String(Number(v.toPrecision(3))))} />
            <Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--ink-3)" }} />
            {CREW_LABEL.map((c, i) => (
              <Line key={c} type="linear" dataKey={c} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: SERIES[i] }} activeDot={{ r: 5 }} connectNulls isAnimationActive animationDuration={600} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-ink-2">
        {CREW_LABEL.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: SERIES[i] }} /> {c}
          </span>
        ))}
      </div>

      <table className="font-data mt-4 w-full text-xs">
        <thead className="text-[10px] text-ink-3">
          <tr>
            <th className="py-1 text-left font-normal">log₂ FC</th>
            {CREW_LABEL.map((c) => (
              <th key={c} className="font-normal">
                {c}
              </th>
            ))}
            <th className="font-normal">mean</th>
          </tr>
        </thead>
        <tbody>
          {s.post.map((p) => (
            <tr key={p.tp} className="border-t border-line">
              <td className="py-1 text-ink-3">{p.tp}</td>
              {p.perCrew.map((v, i) => (
                <td key={i} className="text-center text-ink-2">
                  {v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
                </td>
              ))}
              <td className="text-center font-semibold" style={{ color: Math.abs(p.mean) >= 0.25 ? (p.mean > 0 ? DIV_UP : DIV_DOWN) : "var(--ink-2)" }}>
                {p.mean >= 0 ? "+" : ""}
                {p.mean.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.residual82 !== undefined && (
        <p className="mt-3 text-xs text-ink-3">
          {s.residual82 < 0.5 ? "Recovered:" : "Persisting:"} {Math.round(s.residual82 * 100)}% of the R+1 change remained at R+82.
        </p>
      )}
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-2/60 px-2.5 py-2">
      <div className="panel-title text-[8px]">{label}</div>
      <div className="font-data mt-0.5 text-sm" style={{ color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
