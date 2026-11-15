import Link from "next/link";
import { coverageSummary, REQUIREMENTS, type Coverage } from "@/core/coverage";

export const metadata = { title: "Requirements coverage · VITA" };

const STATUS: Record<Coverage, { label: string; color: string }> = {
  built: { label: "Built", color: "var(--nominal)" },
  partial: { label: "Partial", color: "var(--watch)" },
  next: { label: "Next", color: "var(--ink-3)" },
};

export default function CoveragePage() {
  const sum = coverageSummary();
  const groups = ["Core risk", "Additional factor", "Personal factor"] as const;
  return (
    <div className="mx-auto max-w-6xl pt-8">
      <p className="panel-title">Requirements coverage</p>
      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] sm:text-6xl">
        Every requirement,
        <br />
        <span className="text-ink-3">traced to a feature</span>
      </h1>
      <p className="mt-4 max-w-3xl text-ink-2">
        Before building, our team listed what a crew health system must monitor, how, and how it should respond, based on NASA&apos;s challenge and the Human
        Research Program&apos;s hazards. This page traces each requirement to the part of VITA that meets it, and is honest about what isn&apos;t built yet.
      </p>

      <section className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        {(Object.keys(STATUS) as Coverage[]).map((k) => (
          <div key={k} className="panel ticks p-4">
            <div className="panel-title text-[9px]">{STATUS[k].label}</div>
            <div className="font-display mt-1 text-4xl font-extrabold" style={{ color: STATUS[k].color }}>
              {sum[k]}
              <span className="text-base text-ink-3">/{sum.total}</span>
            </div>
          </div>
        ))}
      </section>

      {groups.map((g) => (
        <section key={g} className="panel ticks mt-5 overflow-x-auto p-5">
          <h2 className="panel-title">{g === "Core risk" ? "Core risks" : g === "Additional factor" ? "Additional factors" : "Personal factors the system accounts for"}</h2>
          <table className="mt-3 w-full min-w-[760px] text-sm">
            <thead className="font-data text-left text-[10px] uppercase tracking-wider text-ink-3">
              <tr>
                <th className="w-[150px] py-2 font-normal">Area</th>
                <th className="w-[230px] font-normal">Requirement</th>
                <th className="font-normal">What VITA does</th>
                <th className="w-[80px] font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {REQUIREMENTS.filter((r) => r.group === g).map((r) => (
                <tr key={r.area + r.need} className="border-t border-line align-top">
                  <td className="py-2.5 pr-3 text-ink">{r.area}</td>
                  <td className="py-2.5 pr-3 text-ink-2">{r.need}</td>
                  <td className="py-2.5 pr-3 text-ink-2">
                    {r.vita}
                    {r.href && (
                      <Link href={r.href} className="ml-1.5 text-nominal hover:underline">
                        Open ▸
                      </Link>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span className="font-data text-[11px] tracking-wider uppercase" style={{ color: STATUS[r.status].color }}>
                      ● {STATUS[r.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
