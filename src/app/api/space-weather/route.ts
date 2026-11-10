import { NextResponse } from "next/server";

// NASA DONKI (Community Coordinated Modeling Center). Public, no key needed on this host.
const DONKI = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get";

export const revalidate = 1800;

export interface SpaceWeatherEvent {
  id: string;
  type: "SEP" | "FLR";
  time: string;
  detail: string;
  classType?: string;
  link?: string;
}

export interface SpaceWeather {
  live: boolean;
  fetchedAt: string;
  windowDays: number;
  events: SpaceWeatherEvent[];
  error?: string;
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), next: { revalidate } });
  if (!res.ok) throw new Error(`DONKI HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface DonkiSep {
  sepID: string;
  eventTime: string;
  instruments?: { displayName: string }[];
  link?: string;
}
interface DonkiFlr {
  flrID: string;
  peakTime?: string;
  beginTime: string;
  classType?: string;
  sourceLocation?: string;
  link?: string;
}

export async function GET() {
  const windowDays = 30;
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 86400000);
  const q = `startDate=${ymd(start)}&endDate=${ymd(end)}`;
  try {
    const [sep, flr] = await Promise.all([
      getJson<DonkiSep[] | null>(`${DONKI}/SEP?${q}`),
      getJson<DonkiFlr[] | null>(`${DONKI}/FLR?${q}`),
    ]);
    const events: SpaceWeatherEvent[] = [
      ...(sep ?? []).map((e) => ({
        id: e.sepID,
        type: "SEP" as const,
        time: e.eventTime,
        detail: `Solar energetic particle event${e.instruments?.length ? ` · ${e.instruments[0].displayName}` : ""}`,
        link: e.link,
      })),
      ...(flr ?? [])
        .filter((f) => f.classType && /^[MX]/.test(f.classType))
        .map((f) => ({
          id: f.flrID,
          type: "FLR" as const,
          time: f.peakTime ?? f.beginTime,
          classType: f.classType,
          detail: `${f.classType} solar flare${f.sourceLocation ? ` at ${f.sourceLocation}` : ""}`,
          link: f.link,
        })),
    ].sort((a, b) => b.time.localeCompare(a.time));
    return NextResponse.json<SpaceWeather>({ live: true, fetchedAt: new Date().toISOString(), windowDays, events });
  } catch (e) {
    return NextResponse.json<SpaceWeather>({
      live: false,
      fetchedAt: new Date().toISOString(),
      windowDays,
      events: [],
      error: e instanceof Error && /abort|timeout/i.test(e.name + e.message) ? "request timed out" : e instanceof Error ? e.message : "DONKI unreachable",
    });
  }
}
