"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Html, OrbitControls, Stars, useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import type { VehicleKind } from "./vehicles";

/** Center an object on the origin (feet on y=0 if `ground`) and scale its largest dimension to `size`. */
function Fit({ size, ground = false, children }: { size: number; ground?: boolean; children: ReactNode }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (!outer.current || !inner.current) return;
    inner.current.position.set(0, 0, 0);
    outer.current.scale.setScalar(1);
    // measure in the outer group's own frame: clear its transform and refresh world matrices first
    outer.current.updateWorldMatrix(true, true);
    const toLocal = outer.current.matrixWorld.clone().invert();
    const box = new THREE.Box3().setFromObject(inner.current, true).applyMatrix4(toLocal);
    const dims = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const s = size / Math.max(dims.x, dims.y, dims.z, 1e-6);
    inner.current.position.set(-c.x, ground ? -box.min.y : -c.y, -c.z);
    outer.current.scale.setScalar(s);
  }, [size, ground]);
  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

function Glb({ url, hide }: { url: string; hide?: RegExp }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    if (hide) c.traverse((o) => void (hide.test(o.name) && (o.visible = false)));
    // drop hidden parts entirely so they don't count toward the fitted size
    if (hide) c.traverse((o) => o.children.filter((ch) => !ch.visible).forEach((ch) => o.remove(ch)));
    return c;
  }, [scene, hide]);
  return <primitive object={clone} />;
}

const ISS_EXTRAS = /^(bendedtru|pCylinder)/;

function Iss() {
  return (
    <Fit size={9}>
      <group rotation={[0.45, Math.PI / 2 - 0.5, 0]}>
        {/* the file also carries a small detached part ~40 m above the station; leave it out */}
        <Glb url="/nasa-3d/iss.glb" hide={ISS_EXTRAS} />
      </group>
    </Fit>
  );
}

function Orion() {
  const geo = useLoader(STLLoader, "/nasa-3d/orion.stl");
  useMemo(() => geo.computeVertexNormals(), [geo]);
  return (
    <Fit size={5}>
      <mesh geometry={geo} rotation={[0.25, 0, -0.35]}>
        <meshStandardMaterial color="#d9dde4" metalness={0.55} roughness={0.35} />
      </mesh>
    </Fit>
  );
}

function Habitat({ size = 4 }: { size?: number }) {
  return (
    <Fit size={size} ground>
      <Glb url="/nasa-3d/hdu-1.glb" />
      <Glb url="/nasa-3d/hdu-2.glb" />
    </Fit>
  );
}

// Mars Trek tiles (see scripts/fetch-nasa-assets.ts). The zoom-7 color mosaic (2×2 tiles) covers exactly the
// bottom-right quadrant of the zoom-5 elevation tile: lon 75.94–78.75°E, lat 16.88–19.69°N, centered near Jezero.
const DEM_URL = "/mars-trek/dem-5-12-45.png";
const COLOR_URLS = ["/mars-trek/color-7-50-182.jpg", "/mars-trek/color-7-50-183.jpg", "/mars-trek/color-7-51-182.jpg", "/mars-trek/color-7-51-183.jpg"];
const TERRAIN = 40; // world units across
const RELIEF = 3.2; // world units for the full 8-bit range (vertically exaggerated)
// Jezero Crater center (77.45°E, 18.44°N) as a fraction of the patch, from its west and north edges
const JEZERO = { u: (77.45 - 75.9375) / 2.8125, v: (19.6875 - 18.44) / 2.8125 };

function useMarsTerrain() {
  const dem = useLoader(THREE.ImageLoader, DEM_URL);
  const tiles = useLoader(THREE.ImageLoader, COLOR_URLS);
  return useMemo(() => {
    // elevation: crop the 128×128 quadrant, then a 3×3 blur to soften 8-bit terracing
    const n = 128;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(dem, 0, 0);
    const px = ctx.getImageData(128, 128, n, n).data;
    const raw = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) raw[i] = px[i * 4];
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let s = 0;
        let k = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < n && yy < n) {
              s += raw[yy * n + xx];
              k++;
            }
          }
        h[y * n + x] = s / k;
      }
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of h) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const geo = new THREE.PlaneGeometry(TERRAIN, TERRAIN, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, ((h[i] - lo) / Math.max(1, hi - lo)) * RELIEF);
    geo.computeVertexNormals();

    // color: stitch the four Viking tiles into one 512×512 texture
    const cc = document.createElement("canvas");
    cc.width = cc.height = 512;
    const cx = cc.getContext("2d")!;
    tiles.forEach((img, i) => cx.drawImage(img, (i % 2) * 256, Math.floor(i / 2) * 256));
    const tex = new THREE.CanvasTexture(cc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    // height under Jezero's center, for placing the habitat
    const jx = Math.round(JEZERO.u * (n - 1));
    const jy = Math.round(JEZERO.v * (n - 1));
    const jh = ((h[jy * n + jx] - lo) / Math.max(1, hi - lo)) * RELIEF;
    return { geo, tex, site: new THREE.Vector3((JEZERO.u - 0.5) * TERRAIN, jh, (JEZERO.v - 0.5) * TERRAIN) };
  }, [dem, tiles]);
}

function MarsSite({ habitat = true }: { habitat?: boolean }) {
  const { geo, tex, site } = useMarsTerrain();
  return (
    <group position={[0, -2.5, 0]}>
      <mesh geometry={geo}>
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
      </mesh>
      <group position={site}>
        {habitat && <Habitat size={6} />}
        <pointLight position={[3, 5, 4]} intensity={30} distance={14} color="#fff1e0" />
        <Html position={[0, 5.5, 0]} center distanceFactor={16} style={{ pointerEvents: "none" }}>
          <div className="font-data text-[10px] tracking-widest whitespace-nowrap text-[#ffcf9a] uppercase">Jezero Crater · 18.4°N 77.5°E</div>
        </Html>
      </group>
    </group>
  );
}

function LunarSite() {
  return (
    <group position={[0, -1.5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#6f7378" roughness={1} />
      </mesh>
      <Habitat size={5} />
    </group>
  );
}

/** Pulsing red halo while an emergency is active. */
function AlarmHalo({ active }: { active: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const on = active ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5) : 0;
    if (light.current) light.current.intensity = on * 40;
    if (ring.current) ring.current.opacity = on * 0.6;
  });
  return (
    <group>
      <pointLight ref={light} color="#ff3b5c" distance={14} position={[0, 1, 3]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]}>
        <ringGeometry args={[5.2, 5.6, 64]} />
        <meshBasicMaterial ref={ring} color="#ff3b5c" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Spin({ children, speed = 0.08 }: { children: ReactNode; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

export default function NasaVehicle3D({ kind, alarm = false, interactive = true }: { kind: VehicleKind; alarm?: boolean; interactive?: boolean }) {
  const surface = kind === "mars_base" || kind === "lunar_base";
  const cam: [number, number, number] = kind === "mars_base" ? [0, 26, 16] : surface ? [8, 6, 12] : [0, 2, 13];
  return (
    <Canvas camera={{ position: cam, fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={[kind === "mars_base" ? "#0b0705" : "#03050a"]} />
      {!surface && <Stars radius={80} depth={40} count={2500} factor={3} fade speed={0.4} />}
      <ambientLight intensity={surface ? 0.45 : 0.25} />
      <hemisphereLight args={[kind === "mars_base" ? "#ffd9b0" : "#cfe3ff", "#1a0f08", surface ? 0.6 : 0.3]} />
      <directionalLight position={[10, 12, 6]} intensity={surface ? 2.2 : 2.6} color={kind === "mars_base" ? "#ffe2c4" : "#ffffff"} />
      <directionalLight position={[-8, -4, -6]} intensity={0.4} color="#7aa7ff" />
      <Suspense fallback={null}>
        {kind === "iss" && (
          <Spin>
            <Iss />
          </Spin>
        )}
        {kind === "orion" && (
          <Spin speed={0.15}>
            <Orion />
          </Spin>
        )}
        {kind === "mars_base" && <MarsSite />}
        {kind === "lunar_base" && <LunarSite />}
      </Suspense>
      <AlarmHalo active={alarm} />
      <OrbitControls enabled={interactive} enablePan={false} autoRotate={surface} autoRotateSpeed={0.35} minDistance={5} maxDistance={45} maxPolarAngle={surface ? Math.PI / 2.2 : Math.PI} />
    </Canvas>
  );
}

useGLTF.preload("/nasa-3d/iss.glb");
