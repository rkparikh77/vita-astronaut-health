"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, Box, Database, FlaskConical, MoreHorizontal, Radiation, Satellite, ScanFace, Sparkles, Users, X } from "lucide-react";
import { MISSION } from "@/core/crew";
import { delayRange, ENVIRONMENTS, ENV_MAP, type EnvironmentId } from "@/core/environments";
import { useMission } from "@/lib/store";
import { PhoneQr } from "./PhoneQr";

const NAV = [
  { href: "/", label: "Crew", icon: Users },
  { href: "/live", label: "Live", icon: Activity },
  { href: "/sim", label: "Playground", icon: Box },
  { href: "/link", label: "Deep Space", icon: Satellite },
  { href: "/scan", label: "Scan", icon: ScanFace },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/atlas", label: "Atlas", icon: Sparkles },
  { href: "/radiation", label: "Radiation", icon: Radiation },
  { href: "/about", label: "Data", icon: Database },
];
const TABS = ["/", "/live", "/sim", "/link"];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/crew") : path.startsWith(href);
}

export function Header() {
  const { env, setEnv, today } = useMission();
  const path = usePathname();
  const e = ENV_MAP[env];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center gap-x-6 gap-y-3 px-4 py-2.5 sm:px-6 md:flex-wrap md:py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 md:gap-3">
          <Logo />
          <div className="leading-none">
            <div className="font-display text-xl font-extrabold tracking-[0.12em] md:text-2xl">VITA</div>
            <div className="font-data hidden text-[10px] tracking-[0.2em] text-ink-3 uppercase sm:block">Crew health monitor</div>
          </div>
        </Link>

        <nav className="-mx-1 hidden min-w-0 gap-0.5 overflow-x-auto md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition ${isActive(path, n.href) ? "bg-panel-2 text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-3 md:gap-4">
          <div className="font-data hidden text-xs text-ink-2 2xl:block">
            <span className="text-ink-3">MISSION DAY </span>
            <span className="text-ink">{today}</span>
            <span className="text-ink-3"> / {MISSION.length}</span>
          </div>
          <div className="font-data hidden text-xs text-ink-2 2xl:block">
            <span className="text-ink-3">COMMS DELAY </span>
            <span className="text-ink">{delayRange(e)}</span>
          </div>
          <div className="font-data text-[10px] leading-tight text-ink-3 md:hidden">
            DAY <span className="text-ink">{today}</span>
          </div>
          <select
            aria-label="Mission location"
            value={env}
            onChange={(ev) => setEnv(ev.target.value as EnvironmentId)}
            className="font-data max-w-[44vw] min-w-0 rounded-md border border-line-2 bg-panel px-2 py-1.5 text-xs text-ink md:max-w-none"
          >
            {ENVIRONMENTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <Link href="/about" aria-label="Data sources" className="rounded-md p-1.5 text-ink-3 hover:text-ink md:hidden">
            <Database size={16} />
          </Link>
          <PhoneQr />
        </div>
      </div>
    </header>
  );
}

/** App-style bottom tab bar on phones, with a "More" sheet for the remaining sections. */
export function MobileTabBar() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const tabs = NAV.filter((n) => TABS.includes(n.href));
  const rest = NAV.filter((n) => !TABS.includes(n.href));
  const moreActive = rest.some((n) => isActive(path, n.href));
  return (
    <>
      {more && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setMore(false)}>
          <div className="absolute right-0 bottom-0 left-0 rounded-t-3xl border-t border-line bg-bg-2 p-5 pb-[calc(6rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="panel-title">More</span>
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className="text-ink-3">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {rest.map((n) => {
                const Icon = n.icon;
                return (
                  <Link key={n.href} href={n.href} onClick={() => setMore(false)} className={`flex flex-col items-center gap-2 rounded-2xl border p-4 ${isActive(path, n.href) ? "border-nominal/60 text-ink" : "border-line text-ink-2"}`}>
                    <Icon size={22} className={isActive(path, n.href) ? "text-nominal" : ""} />
                    <span className="text-xs">{n.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <nav aria-label="Primary" className="fixed right-0 bottom-0 left-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {tabs.map((n) => {
            const active = isActive(path, n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} onClick={() => setMore(false)} className="flex flex-col items-center gap-1 pt-2.5 pb-2" aria-current={active ? "page" : undefined}>
                <Icon size={20} className={active ? "text-nominal" : "text-ink-3"} strokeWidth={active ? 2.2 : 1.8} />
                <span className={`text-[10px] ${active ? "text-ink" : "text-ink-3"}`}>{n.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMore((m) => !m)} className="flex flex-col items-center gap-1 pt-2.5 pb-2" aria-expanded={more}>
            <MoreHorizontal size={20} className={moreActive || more ? "text-nominal" : "text-ink-3"} />
            <span className={`text-[10px] ${moreActive || more ? "text-ink" : "text-ink-3"}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="h-8 w-8 md:h-[34px] md:w-[34px]">
      <circle cx="17" cy="17" r="15.5" fill="none" stroke="var(--line-2)" />
      <ellipse cx="17" cy="17" rx="15.5" ry="6" fill="none" stroke="var(--nominal)" strokeOpacity="0.5" transform="rotate(-25 17 17)" />
      <path d="M6 18h6l2.5-6 4 11 3-8 1.5 3H28" fill="none" stroke="var(--nominal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
