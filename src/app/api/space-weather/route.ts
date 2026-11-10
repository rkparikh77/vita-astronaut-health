import { NextResponse } from "next/server";
import { fetchSpaceWeather } from "@/lib/spaceWeather";

export type { SpaceWeather, SpaceWeatherEvent } from "@/lib/spaceWeather";

export const revalidate = 1800;

export async function GET() {
  return NextResponse.json(await fetchSpaceWeather());
}
