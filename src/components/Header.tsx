"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MISSION } from "@/core/crew";
import { delayRange, ENVIRONMENTS, ENV_MAP, type EnvironmentId } from "@/core/environments";
import { useMission } from "@/lib/store";

const NAV = [
  { href: "/", label: "Crew" },
  { href: "/research", label: "Research" },
  { href: "/atlas", label: "Atlas" },
  { href: "/radiation", label: "Radiation" },
  { href: "/about", label: "Data" },
];

export function Header() {
  const { env, setEnv, today } = useMission();
  const path = usePathname();
  const e = ENV_MAP[env];
  return (
    <header className="z-40 border-b sm:sticky sm:top-0 border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <div className="leading-none">
            <div className="font-display text-2xl font-extrabold tracking-[0.12em]">VITA</div>
            <div className="font-data text-[10px] uppercase tracking-[0.2em] text-ink-3">Crew health monitor</div>
          </div>
        </Link>

        <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" || path.startsWith("/crew") : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition ${active ? "bg-panel-2 text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="font-data text-xs text-ink-2">
            <span className="text-ink-3">MISSION DAY </span>
            <span className="text-ink">{today}</span>
            <span className="text-ink-3"> / {MISSION.length}</span>
          </div>
          <div className="font-data hidden text-xs text-ink-2 md:block">
            <span className="text-ink-3">COMMS DELAY </span>
            <span className="text-ink">{delayRange(e)}</span>
          </div>
          <label className="flex items-center gap-2">
            <span className="panel-title hidden sm:inline">Location</span>
            <select
              aria-label="Mission environment"
              value={env}
              onChange={(ev) => setEnv(ev.target.value as EnvironmentId)}
              className="font-data rounded-md border border-line-2 bg-panel px-2 py-1.5 text-xs text-ink"
            >
              {ENVIRONMENTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r="15.5" fill="none" stroke="var(--line-2)" />
      <ellipse cx="17" cy="17" rx="15.5" ry="6" fill="none" stroke="var(--nominal)" strokeOpacity="0.5" transform="rotate(-25 17 17)" />
      <path d="M6 18h6l2.5-6 4 11 3-8 1.5 3H28" fill="none" stroke="var(--nominal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
