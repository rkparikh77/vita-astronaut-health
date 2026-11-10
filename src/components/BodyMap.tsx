"use client";

import { BODY_SYSTEMS, type BodySystem, type Status } from "@/core/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/ui";

/** Anchor point of each body system on the 200×420 figure. */
const NODES: Record<BodySystem, { x: number; y: number; lx: number; side: "l" | "r" }> = {
  neuro: { x: 100, y: 40, lx: 172, side: "r" },
  vision: { x: 89, y: 52, lx: 28, side: "l" },
  respiratory: { x: 116, y: 120, lx: 172, side: "r" },
  cardio: { x: 90, y: 128, lx: 28, side: "l" },
  metabolic: { x: 100, y: 182, lx: 172, side: "r" },
  immune: { x: 50, y: 175, lx: 28, side: "l" },
  musculoskeletal: { x: 118, y: 300, lx: 172, side: "r" },
};

export function BodyMap({
  systems,
  selected,
  onSelect,
}: {
  systems: Record<BodySystem, Status>;
  selected?: BodySystem;
  onSelect: (s: BodySystem) => void;
}) {
  return (
    <svg viewBox="-30 0 260 420" className="h-full w-full" role="group" aria-label="Body systems map">
      <defs>
        <linearGradient id="body-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2433" />
          <stop offset="1" stopColor="#0e141d" />
        </linearGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Silhouette */}
      <g fill="url(#body-fill)" stroke="var(--line-2)" strokeWidth="1.2">
        <circle cx="100" cy="44" r="26" />
        <rect x="91" y="68" width="18" height="14" rx="4" />
        <path d="M62 86 Q100 74 138 86 L146 150 Q144 196 132 214 L68 214 Q56 196 54 150 Z" />
        <path d="M62 88 Q46 96 42 130 L34 210 Q32 222 40 224 Q48 224 49 212 L60 140" />
        <path d="M138 88 Q154 96 158 130 L166 210 Q168 222 160 224 Q152 224 151 212 L140 140" />
        <path d="M70 212 L130 212 L128 236 L104 240 L96 240 L72 236 Z" />
        <path d="M72 234 L96 240 L94 330 L92 396 Q92 406 80 406 L72 406 Q66 404 70 394 L74 330 Z" />
        <path d="M128 234 L104 240 L106 330 L108 396 Q108 406 120 406 L128 406 Q134 404 130 394 L126 330 Z" />
      </g>
      {/* Visor line */}
      <path d="M80 40 Q100 30 120 40" fill="none" stroke="var(--line-2)" strokeWidth="1" />

      {(Object.keys(NODES) as BodySystem[]).map((s) => {
        const n = NODES[s];
        const st = systems[s] ?? "unknown";
        const c = STATUS_COLOR[st];
        const isSel = selected === s;
        return (
          <g
            key={s}
            role="button"
            tabIndex={0}
            aria-label={`${BODY_SYSTEMS[s].name}: ${STATUS_LABEL[st]}`}
            aria-pressed={isSel}
            onClick={() => onSelect(s)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(s))}
            className="cursor-pointer outline-none"
          >
            <line x1={n.x} y1={n.y} x2={n.side === "r" ? n.lx - 4 : n.lx + 4} y2={n.y} stroke={c} strokeOpacity={isSel ? 0.9 : 0.35} strokeDasharray="2 3" />
            <circle cx={n.x} cy={n.y} r={st === "nominal" ? 12 : 18} fill={c} filter="url(#soft)" className="node-glow" />
            <circle cx={n.x} cy={n.y} r={isSel ? 8 : 6} fill={c} stroke="var(--bg)" strokeWidth="2" />
            {isSel && <circle cx={n.x} cy={n.y} r="13" fill="none" stroke={c} strokeWidth="1.5" />}
            <text
              x={n.lx}
              y={n.y - 3}
              textAnchor={n.side === "r" ? "start" : "end"}
              className="font-data"
              fontSize="9.5"
              letterSpacing="0.08em"
              fill={isSel ? "var(--ink)" : "var(--ink-2)"}
            >
              {BODY_SYSTEMS[s].organ.toUpperCase()}
            </text>
            <text x={n.lx} y={n.y + 9} textAnchor={n.side === "r" ? "start" : "end"} className="font-data" fontSize="8.5" fill={c}>
              {STATUS_LABEL[st].toUpperCase()}
            </text>
            {/* bigger invisible hit target */}
            <circle cx={n.x} cy={n.y} r="20" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
