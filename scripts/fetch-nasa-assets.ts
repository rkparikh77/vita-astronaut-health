/**
 * Download the NASA assets used by the 3D views into public/ so the app works offline:
 *  - 3D models from NASA 3D Resources (github.com/nasa/NASA-3D-Resources)
 *  - Mars Trek tiles around Jezero Crater: MOLA elevation (heightmap) and Viking MDIM 2.1 color mosaic
 * Run with: npm run assets
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const NASA3D = "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/";
const TREK = "https://trek.nasa.gov/tiles/Mars/EQ/";

export const MODELS: { file: string; src: string }[] = [
  { file: "iss.glb", src: "3D Models/International Space Station (ISS) (B)/International Space Station (ISS) (B).glb" },
  { file: "hdu-1.glb", src: "3D Models/Habitat Demonstration Unit/Habitat Demonstration Unit (part 1).glb" },
  { file: "hdu-2.glb", src: "3D Models/Habitat Demonstration Unit/Habitat Demonstration Unit (part 2).glb" },
  { file: "orion.stl", src: "3D Printing/Orion Capsule/Orion Capsule (no fbc).stl" },
];

// WMTS "default028mm" matrix set: zoom z has 2^(z+1) × 2^z tiles over a global equirectangular grid.
const DEM = "mola128_mola64_merge_90Nto90S_SimpleC_clon0";
const COLOR = "Mars_Viking_MDIM21_ClrMosaic_global_232m";
export const TILES: { file: string; url: string }[] = [
  { file: "dem-5-12-45.png", url: `${TREK}${DEM}/1.0.0//default/default028mm/5/12/45.png` },
  ...[50, 51].flatMap((row) =>
    [182, 183].map((col) => ({ file: `color-7-${row}-${col}.jpg`, url: `${TREK}${COLOR}/1.0.0//default/default028mm/7/${row}/${col}.jpg` })),
  ),
];

async function get(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const root = path.join(process.cwd(), "public");
  await mkdir(path.join(root, "nasa-3d"), { recursive: true });
  await mkdir(path.join(root, "mars-trek"), { recursive: true });
  for (const m of MODELS) {
    const buf = await get(NASA3D + m.src.split("/").map(encodeURIComponent).join("/"));
    await writeFile(path.join(root, "nasa-3d", m.file), buf);
    console.log(`nasa-3d/${m.file}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
  for (const t of TILES) {
    const buf = await get(t.url);
    await writeFile(path.join(root, "mars-trek", t.file), buf);
    console.log(`mars-trek/${t.file}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
