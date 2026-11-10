import type { Status } from "@/core/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/ui";

export function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${status === "critical" ? "pulse-critical" : ""}`}
      style={{ width: size, height: size, background: STATUS_COLOR[status], boxShadow: `0 0 10px ${STATUS_COLOR[status]}` }}
    />
  );
}

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className="font-data inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]"
      style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 35%, transparent)` }}
    >
      <StatusDot status={status} size={6} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
