// Statistics over the real Inspiration4 multi-panel matrix (NASA OSDR OSD-569 / OSD-575).
// Everything here is computed from measured values; nothing is simulated.

export interface PanelMatrix {
  crew: string[];
  timepoints: string[];
  analytes: { id: string; label: string; panel: string; unit: string; values: (number | null)[][] }[];
}

export const PRE = ["L-92", "L-44", "L-3"];
export const POST = ["R+1", "R+45", "R+82", "R+194"];

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// --- Student's t distribution via the regularized incomplete beta function (Numerical Recipes) ---
function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a t statistic with df degrees of freedom. */
export function tTestP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Benjamini–Hochberg adjusted q-values, returned in the input order. */
export function benjaminiHochberg(ps: number[]): number[] {
  const n = ps.length;
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const q = new Array<number>(n);
  let prev = 1;
  for (let k = n - 1; k >= 0; k--) {
    const [p, i] = order[k];
    prev = Math.min(prev, (p * n) / (k + 1));
    q[i] = prev;
  }
  return q;
}

// --- Per-analyte statistics ---

export interface TimepointStat {
  tp: string;
  /** log2 fold change vs that crew member's preflight median, one per crew (null if missing). */
  perCrew: (number | null)[];
  mean: number;
  sd: number;
  t: number;
  p: number;
  q?: number;
  /** Crew members whose change points the same way as the group mean. */
  concordant: number;
  n: number;
}

export interface AnalyteStats {
  id: string;
  label: string;
  panel: string;
  unit: string;
  baseline: (number | null)[];
  /** Coefficient of variation across the three preflight draws, averaged over crew (biological + assay noise). */
  preflightCv: number;
  post: TimepointStat[];
  /** Share of the R+1 change still present at R+82 (0 = fully recovered, 1 = unchanged). Undefined if no R+1 change. */
  residual82?: number;
}

export function analyteStats(a: PanelMatrix["analytes"][number], timepoints: string[]): AnalyteStats {
  const idx = (tp: string) => timepoints.indexOf(tp);
  const baseline = a.values.map((row) => {
    const pre = PRE.map((tp) => row[idx(tp)]).filter((v): v is number => v !== null && v > 0);
    return pre.length ? median(pre) : null;
  });
  const cvs = a.values
    .map((row) => PRE.map((tp) => row[idx(tp)]).filter((v): v is number => v !== null && v > 0))
    .filter((v) => v.length >= 2)
    .map((v) => sd(v) / mean(v));
  const post = POST.map((tp) => {
    const perCrew = a.values.map((row, c) => {
      const v = row[idx(tp)];
      const b = baseline[c];
      return v === null || b === null || v <= 0 ? null : Math.log2(v / b);
    });
    const xs = perCrew.filter((x): x is number => x !== null);
    const m = xs.length ? mean(xs) : 0;
    const s = sd(xs);
    const t = s > 0 ? m / (s / Math.sqrt(xs.length)) : m === 0 ? 0 : Infinity * Math.sign(m);
    const p = xs.length >= 2 ? tTestP(t, xs.length - 1) : 1;
    const concordant = xs.filter((x) => Math.sign(x) === Math.sign(m) && x !== 0).length;
    return { tp, perCrew, mean: m, sd: s, t, p, concordant, n: xs.length };
  });
  const r1 = post[0].mean;
  const r82 = post[2].mean;
  const residual82 = Math.abs(r1) >= 0.25 ? Math.max(0, Math.min(1.5, (r82 * Math.sign(r1)) / Math.abs(r1))) : undefined;
  return { id: a.id, label: a.label, panel: a.panel, unit: a.unit, baseline, preflightCv: cvs.length ? mean(cvs) : 0, post, residual82 };
}

export interface PanelShift {
  panel: string;
  tp: string;
  /** Median log2 fold change across every analyte in the panel. */
  medianShift: number;
  flagged: boolean;
}

/**
 * Quality control: if most unrelated analytes in one panel move together at a timepoint,
 * that usually means sample handling or assay batch, not biology.
 */
export function panelShifts(stats: AnalyteStats[], threshold = 0.4): PanelShift[] {
  const panels = [...new Set(stats.map((s) => s.panel))];
  const out: PanelShift[] = [];
  for (const panel of panels) {
    const inPanel = stats.filter((s) => s.panel === panel);
    if (inPanel.length < 5) {
      // Small panels: still report, but flag only if nearly every analyte moved the same way.
    }
    for (let i = 0; i < POST.length; i++) {
      const means = inPanel.map((s) => s.post[i].mean);
      const ms = median(means);
      const sameDir = means.filter((m) => Math.sign(m) === Math.sign(ms) && Math.abs(m) > 0.2).length / means.length;
      out.push({ panel, tp: POST[i], medianShift: ms, flagged: Math.abs(ms) >= threshold && sameDir >= 0.7 });
    }
  }
  return out;
}

export interface StudySummary {
  stats: AnalyteStats[];
  shifts: PanelShift[];
  /** Analytes with |mean log2FC| ≥ 0.5 at R+1 (≥1.41×). */
  changedAtR1: number;
  /** Of those, how many are back within half their R+1 change by R+82. */
  recoveredBy82: number;
  significantR1: number;
}

export function summarize(m: PanelMatrix): StudySummary {
  const stats = m.analytes.map((a) => analyteStats(a, m.timepoints));
  // FDR across all analytes, separately per timepoint.
  for (let i = 0; i < POST.length; i++) {
    const q = benjaminiHochberg(stats.map((s) => s.post[i].p));
    stats.forEach((s, k) => (s.post[i].q = q[k]));
  }
  const shifts = panelShifts(stats);
  const changed = stats.filter((s) => Math.abs(s.post[0].mean) >= 0.5);
  const recovered = changed.filter((s) => (s.residual82 ?? 0) < 0.5);
  return {
    stats,
    shifts,
    changedAtR1: changed.length,
    recoveredBy82: recovered.length,
    significantR1: stats.filter((s) => s.post[0].p < 0.05).length,
  };
}
