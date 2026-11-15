/** Which real NASA asset stands in for the vehicle at each mission location. */
export type VehicleKind = "iss" | "orion" | "mars_base" | "lunar_base";

export const VEHICLES: Record<VehicleKind, { label: string; credit: string; note: string }> = {
  iss: { label: "International Space Station", credit: "NASA 3D Resources · ISS (B)", note: "Low Earth orbit, 400 km. Evacuation to Earth in hours." },
  orion: { label: "Orion crew vehicle", credit: "NASA 3D Resources · Orion Capsule", note: "Deep-space crew vehicle for Gateway and Mars-class missions." },
  mars_base: {
    label: "Habitat at Jezero Crater, Mars",
    credit: "NASA 3D Resources · Habitat Demonstration Unit · NASA Mars Trek MOLA DEM + Viking MDIM 2.1",
    note: "Real elevation and color of Jezero Crater from Mars Trek. Relief exaggerated; habitat not to scale.",
  },
  lunar_base: { label: "Lunar surface habitat", credit: "NASA 3D Resources · Habitat Demonstration Unit", note: "NASA's surface-habitat prototype, tested in the Arizona desert." },
};

export function vehicleFor(env: string): VehicleKind {
  if (env === "iss") return "iss";
  if (env === "mars_base") return "mars_base";
  if (env === "lunar_base" || env === "lunar_rover") return "lunar_base";
  return "orion";
}
