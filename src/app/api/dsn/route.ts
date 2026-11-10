import { NextResponse } from "next/server";
import { parseDsn } from "@/core/deepSpace";

// NASA Deep Space Network "DSN Now" — which antennas are talking to which spacecraft, live.
const DSN_URL = "https://eyes.nasa.gov/dsn/data/dsn.xml";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${DSN_URL}?r=${Math.floor(Date.now() / 5000)}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseDsn(await res.text());
    return NextResponse.json({ live: true, fetchedAt: new Date().toISOString(), ...parsed });
  } catch (e) {
    return NextResponse.json({ live: false, fetchedAt: new Date().toISOString(), dishes: [], error: e instanceof Error ? e.message : "unreachable" });
  }
}
