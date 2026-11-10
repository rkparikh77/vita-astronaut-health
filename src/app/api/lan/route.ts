import { networkInterfaces } from "node:os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Dev-only: this machine's private IPv4 addresses, so the "Open on phone" QR works from localhost. */
export function GET() {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ addresses: [] });
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address)
    .filter((a) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a));
  return NextResponse.json({ addresses });
}
