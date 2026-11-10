import { getIndicator, type Thresholds } from "./indicators";
import { STATUS_RANK, worst, type Reading, type Status } from "./types";

/** Status from absolute thresholds only. */
export function thresholdStatus(t: Thresholds, v: number): Status {
  if (Number.isNaN(v)) return "unknown";
  const { low, high } = t;
  if (low?.critical !== undefined && v < low.critical) return "critical";
  if (high?.critical !== undefined && v > high.critical) return "critical";
  if (low && v < low.action) return "action";
  if (high && v > high.action) return "action";
  if (low && v < low.watch) return "watch";
  if (high && v > high.watch) return "watch";
  return "nominal";
}

/** Least-squares slope (units per day) of the readings. */
export function slope(points: { day: number; value: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((a, p) => a + p.day, 0) / n;
  const my = points.reduce((a, p) => a + p.value, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.day - mx) * (p.value - my);
    den += (p.day - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export interface Assessment {
  indicator: string;
  status: Status;
  latest?: Reading;
  baseline?: number;
  /** Standard deviations from personal baseline. */
  z?: number;
  /** Units per day over the trend window. */
  trendPerDay: number;
  /** Days until the trend reaches the action threshold, if heading there within the horizon. */
  daysToAction?: number;
  reasons: string[];
}

export interface AssessOptions {
  trendWindowDays?: number;
  horizonDays?: number;
  zWatch?: number;
  /** Personalized thresholds (e.g. from the astronaut's lab reference range). */
  thresholds?: Thresholds;
  /**
   * Compare against the astronaut's own recent readings (days latest-33 … latest-3) instead of the
   * preflight baseline once enough in-flight data exists. This absorbs normal adaptation to
   * spaceflight (e.g. core temperature rising ~1 °C) so only new changes get flagged.
   */
  rollingBaseline?: boolean;
}

/** Median of readings in a day window, or undefined if fewer than `min` readings. */
export function windowMedian(rs: Reading[], from: number, to: number, min = 4): number | undefined {
  const vals = rs.filter((r) => r.day >= from && r.day <= to).map((r) => r.value).sort((a, b) => a - b);
  if (vals.length < min) return undefined;
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
}

/**
 * Combine three signals:
 *  1. absolute thresholds (population safety limits),
 *  2. deviation from the astronaut's own baseline (catches changes still inside normal range),
 *  3. trend projection (catches slow drifts like rising calcium before they cross a limit).
 * Only the absolute threshold can raise a result to action/critical; the other two can raise it to watch.
 */
export function assess(
  indicatorId: string,
  readings: Reading[],
  baseline?: number,
  opts: AssessOptions = {},
): Assessment {
  const { trendWindowDays = 14, horizonDays = 30, zWatch = 2.5 } = opts;
  const ind = getIndicator(indicatorId);
  const thresholds = opts.thresholds ?? ind.thresholds;
  const rs = readings.filter((r) => r.indicator === indicatorId).sort((a, b) => a.day - b.day);
  const latest = rs[rs.length - 1];
  if (!latest) return { indicator: indicatorId, status: "unknown", trendPerDay: 0, reasons: ["No readings yet"], baseline };

  const reasons: string[] = [];
  let status = thresholdStatus(thresholds, latest.value);
  if (status !== "nominal") reasons.push(`${capital(status)} range for ${ind.name.toLowerCase()}`);

  if (opts.rollingBaseline) {
    const rolling = windowMedian(rs, latest.day - 33, latest.day - 3);
    if (rolling !== undefined) baseline = rolling;
  }

  let z: number | undefined;
  if (baseline !== undefined && ind.personalSd > 0) {
    z = (latest.value - baseline) / ind.personalSd;
    if (Math.abs(z) >= zWatch && STATUS_RANK[status] < STATUS_RANK.watch) {
      status = "watch";
      reasons.push(`${Math.abs(z).toFixed(1)} SD ${z > 0 ? "above" : "below"} your personal baseline`);
    }
  }

  const window = rs.filter((r) => r.day > latest.day - trendWindowDays);
  const trendPerDay = window.length >= 4 ? slope(window) : 0;
  const span = window.length ? latest.day - window[0].day : 0;
  // Ignore drifts smaller than 1.5 personal SDs across the window: that is just noise.
  const meaningful = Math.abs(trendPerDay * span) >= 1.5 * ind.personalSd;
  let daysToAction: number | undefined;
  if (trendPerDay !== 0 && meaningful) {
    const { low, high } = thresholds;
    const target = trendPerDay > 0 ? high?.action : low?.action;
    if (target !== undefined) {
      const d = (target - latest.value) / trendPerDay;
      if (d > 0 && d <= horizonDays) {
        daysToAction = Math.round(d);
        if (STATUS_RANK[status] < STATUS_RANK.watch) {
          status = "watch";
          reasons.push(`Trending ${trendPerDay > 0 ? "up" : "down"}: reaches action level in about ${daysToAction} days`);
        }
      }
    }
  }

  return { indicator: indicatorId, status, latest, baseline, z, trendPerDay, daysToAction, reasons };
}

export function overallStatus(as: Assessment[]): Status {
  return worst(...as.map((a) => a.status));
}

function capital(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
