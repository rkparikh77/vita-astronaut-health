"use client";

import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Thresholds } from "@/core/indicators";
import type { Reading } from "@/core/types";

export function TrendChart({
  readings,
  thresholds,
  baseline,
  unit,
  days = 30,
  height = 200,
  color = "var(--nominal)",
}: {
  readings: Reading[];
  thresholds: Thresholds;
  baseline?: number;
  unit: string;
  days?: number;
  height?: number;
  color?: string;
}) {
  const last = readings[readings.length - 1]?.day ?? 0;
  const data = readings.filter((r) => r.day > last - days).map((r) => ({ day: r.day, value: r.value, self: r.source === "self" }));
  const vals = data.map((d) => d.value);
  const lo = thresholds.low?.watch;
  const hi = thresholds.high?.watch;
  const domainLo = Math.min(...vals, lo ?? Infinity, baseline ?? Infinity);
  const domainHi = Math.max(...vals, hi ?? -Infinity, baseline ?? -Infinity);
  const pad = (domainHi - domainLo) * 0.15 || 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.25} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <ReferenceArea
          y1={lo ?? domainLo - pad}
          y2={hi ?? domainHi + pad}
          fill="var(--nominal)"
          fillOpacity={0.05}
          ifOverflow="hidden"
        />
        {lo !== undefined && <ReferenceLine y={lo} stroke="var(--watch)" strokeDasharray="4 4" strokeOpacity={0.6} />}
        {hi !== undefined && <ReferenceLine y={hi} stroke="var(--watch)" strokeDasharray="4 4" strokeOpacity={0.6} />}
        {thresholds.low && <ReferenceLine y={thresholds.low.action} stroke="var(--action)" strokeDasharray="2 4" strokeOpacity={0.5} ifOverflow="hidden" />}
        {thresholds.high && <ReferenceLine y={thresholds.high.action} stroke="var(--action)" strokeDasharray="2 4" strokeOpacity={0.5} ifOverflow="hidden" />}
        {baseline !== undefined && <ReferenceLine y={baseline} stroke="var(--ink-3)" strokeOpacity={0.6} label={{ value: "baseline", fill: "var(--ink-3)", fontSize: 9, position: "insideTopLeft" }} />}
        <XAxis dataKey="day" tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} tickFormatter={(d) => `D${d}`} />
        <YAxis domain={[domainLo - pad, domainHi + pad]} tick={{ fill: "var(--ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))} width={44} />
        <Tooltip
          contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--ink-3)" }}
          labelFormatter={(d) => `Mission day ${d}`}
          formatter={(v: number) => [`${v} ${unit}`, "value"]}
        />
        <Area type="monotone" dataKey="value" stroke="none" fill="url(#trend-fill)" isAnimationActive={false} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={(p: { cx?: number; cy?: number; payload?: { self: boolean }; index?: number }) =>
            p.payload?.self ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill="var(--ink)" stroke={color} strokeWidth={2} /> : <g key={p.index} />
          }
          isAnimationActive
          animationDuration={700}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
