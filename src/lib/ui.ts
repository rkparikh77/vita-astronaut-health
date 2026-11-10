import type { Status } from "@/core/types";

export const STATUS_COLOR: Record<Status, string> = {
  nominal: "var(--nominal)",
  watch: "var(--watch)",
  action: "var(--action)",
  critical: "var(--critical)",
  unknown: "var(--unknown)",
};

export const STATUS_LABEL: Record<Status, string> = {
  nominal: "Nominal",
  watch: "Watch",
  action: "Action",
  critical: "Critical",
  unknown: "No data",
};

export const STATUS_MEANING: Record<Status, string> = {
  nominal: "Within your normal range",
  watch: "Keep an eye on it, recheck soon",
  action: "Do something today",
  critical: "Act now",
  unknown: "Not measured yet",
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
}
