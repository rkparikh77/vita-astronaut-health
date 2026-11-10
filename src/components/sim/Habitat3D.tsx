"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { crewPosition, isMoving, ZONES, type CrewSim, type SimState } from "@/core/emergencies";

const CREW_COLOR: Record<string, string> = { vega: "#3987e5", okafor: "#d95926", lindqvist: "#199e70", tanaka: "#9085e9" };
const R = 2.3; // module radius (m)
const LEAK: [number, number, number] = [-6, 1.6, 1.4];
const FIRE: [number, number, number] = [-3, 0.6, -1.7];

function Shell({ x0, x1, tint }: { x0: number; x1: number; tint: string }) {
  const len = x1 - x0;
  const ribs = Math.floor(len / 1.6);
  return (
    <group position={[(x0 + x1) / 2, 0.8, 0]}>
      {/* translucent pressure hull, cut away on the camera side */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R, R, len, 48, 1, true, Math.PI * 0.15, Math.PI * 1.25]} />
        <meshStandardMaterial color={tint} transparent opacity={0.16} side={THREE.DoubleSide} metalness={0.4} roughness={0.5} />
      </mesh>
      {Array.from({ length: ribs + 1 }, (_, i) => (
        <mesh key={i} position={[-len / 2 + (i * len) / ribs, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[R, 0.03, 8, 48, Math.PI * 1.25]} />
          <meshStandardMaterial color="#5b6b80" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* deck */}
      <mesh position={[0, -1.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len, 3.2]} />
        <meshStandardMaterial color="#1a2230" metalness={0.3} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Rack({ x, z, h = 2, color = "#2a3444", screen }: { x: number; z: number; h?: number; color?: string; screen?: string }) {
  return (
    <group position={[x, -0.75 + h / 2, z]}>
      <mesh>
        <boxGeometry args={[1.2, h, 0.5]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
      </mesh>
      {screen && (
        <mesh position={[0, 0.3, z > 0 ? -0.26 : 0.26]}>
          <planeGeometry args={[0.8, 0.45]} />
          <meshBasicMaterial color={screen} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Props({ s }: { s: SimState }) {
  const sep = s.scenario === "sep" && s.hab.radiationMsvH > 1;
  return (
    <group>
      {/* exercise device (ARED) */}
      <group position={[ZONES.exercise.x, -0.2, -1.5]}>
        <mesh>
          <boxGeometry args={[1.6, 1.2, 0.4]} />
          <meshStandardMaterial color="#394456" metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.9, 0.4]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 1.6]} />
          <meshStandardMaterial color="#c0c8d4" metalness={0.9} />
        </mesh>
      </group>
      {/* galley */}
      <mesh position={[ZONES.galley.x, -0.35, 1.2]}>
        <boxGeometry args={[1.8, 0.8, 0.6]} />
        <meshStandardMaterial color="#2f3a4c" />
      </mesh>
      {/* lab racks */}
      <Rack x={-3.6} z={-1.7} screen="#3ed6b5" />
      <Rack x={-2.3} z={-1.7} screen={s.hab.fire ? "#ff5a2a" : "#4fb7ff"} />
      <Rack x={-2.9} z={1.7} screen="#4fb7ff" />
      {/* medical bay: cot + crash cart */}
      <mesh position={[ZONES.medbay.x, -0.6, 1.3]}>
        <boxGeometry args={[2, 0.25, 0.8]} />
        <meshStandardMaterial color="#d8dee8" />
      </mesh>
      <Rack x={ZONES.medbay.x + 1.6} z={-1.7} h={1.2} color="#7a1f2b" />
      {/* storm shelter: water-walled chamber */}
      <group position={[ZONES.shelter.x + 0.5, 0.4, 0]}>
        {[-1.4, 1.4].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <boxGeometry args={[3, 2.4, 0.35]} />
            <meshStandardMaterial color="#1e6bd6" transparent opacity={sep ? 0.75 : 0.35} emissive="#1e6bd6" emissiveIntensity={sep ? 0.9 : 0.1} />
          </mesh>
        ))}
        <Html position={[0, 1.6, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
          <div className="font-data text-[10px] tracking-widest whitespace-nowrap text-[#7fb2ff] uppercase">Storm shelter · water walls</div>
        </Html>
      </group>
    </group>
  );
}

function Hatch({ closed }: { closed: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const target = closed ? 0 : -Math.PI / 2;
    ref.current.rotation.y += (target - ref.current.rotation.y) * 0.08;
  });
  return (
    <group position={[0, 0.8, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.35, 1.35, 2.4, 32, 1, true]} />
        <meshStandardMaterial color="#334055" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <group ref={ref} position={[0, 0, -1]}>
        <mesh position={[0, 0, 1]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[1.05, 1.05, 0.12, 32]} />
          <meshStandardMaterial color={closed ? "#f5b83d" : "#56657a"} metalness={0.7} roughness={0.3} emissive={closed ? "#f5b83d" : "#000"} emissiveIntensity={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function AlarmLights({ active }: { active: boolean }) {
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  useFrame(({ clock }) => {
    const on = active && Math.sin(clock.elapsedTime * 6) > 0;
    mats.current.forEach((m) => m && m.color.set(on ? "#ff3b5c" : "#3a1520"));
  });
  return (
    <group>
      {[-12, -8, -4, 4, 8, 11].map((x, i) => (
        <mesh key={x} position={[x, 2.75, 0]}>
          <boxGeometry args={[0.6, 0.06, 0.2]} />
          <meshBasicMaterial ref={(m) => void (mats.current[i] = m!)} color="#3a1520" />
        </mesh>
      ))}
    </group>
  );
}

/** Simple GPU-cheap particle field driven by a per-frame update function. */
function Particles({ count, color, size, update, opacity = 0.8 }: { count: number; color: string; size: number; opacity?: number; update: (p: Float32Array, dt: number, t: number) => void }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  useFrame(({ clock }, dt) => {
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    update(attr.array as Float32Array, Math.min(dt, 0.05), clock.elapsedTime);
    attr.needsUpdate = true;
  });
  return (
    <points geometry={geo}>
      <pointsMaterial color={color} size={size} transparent opacity={opacity} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function Effects({ s }: { s: SimState }) {
  const h = s.hab;
  const sepLevel = s.scenario === "sep" ? Math.min(1, h.radiationMsvH / 30) : 0;
  return (
    <>
      {sepLevel > 0.02 && (
        <Particles
          count={260}
          color="#b98cff"
          size={0.07}
          opacity={0.25 + sepLevel * 0.6}
          update={(p, dt) => {
            for (let i = 0; i < p.length; i += 3) {
              p[i + 1] -= dt * (14 + (i % 7));
              p[i] += dt * 3;
              if (p[i + 1] < -1.5 || Math.random() < 0.002 * (1 - sepLevel)) {
                p[i] = rand(-15, 13);
                p[i + 1] = rand(4, 9);
                p[i + 2] = rand(-2, 2);
              }
            }
          }}
        />
      )}
      {s.scenario === "depress" && !h.leakPatched && (
        <Particles
          count={200}
          color="#d7f3ff"
          size={0.05}
          opacity={0.5}
          update={(p, dt) => {
            const speed = 0.5 + (h.pressureA / 101) * 3;
            for (let i = 0; i < p.length; i += 3) {
              const dx = LEAK[0] - p[i];
              const dy = LEAK[1] - p[i + 1];
              const dz = LEAK[2] - p[i + 2];
              const d = Math.hypot(dx, dy, dz);
              if (d < 0.15 || p[i] === 0) {
                p[i] = rand(-13, h.hatchClosed ? -1 : 11);
                p[i + 1] = rand(-1, 2.5);
                p[i + 2] = rand(-1.8, 1.8);
              } else {
                p[i] += (dx / d) * speed * dt;
                p[i + 1] += (dy / d) * speed * dt;
                p[i + 2] += (dz / d) * speed * dt;
              }
            }
          }}
        />
      )}
      {s.scenario === "depress" && (
        <mesh position={LEAK}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshBasicMaterial color={h.leakPatched ? "#3ed6b5" : "#ff3b5c"} />
        </mesh>
      )}
      {s.scenario === "fire" && h.fire && <FireLight />}
      {s.scenario === "fire" && h.smoke > 0.02 && (
        <Particles
          count={320}
          color="#8a8f98"
          size={0.45}
          opacity={Math.min(0.55, h.smoke * 0.7)}
          update={(p, dt, t) => {
            for (let i = 0; i < p.length; i += 3) {
              if (p[i] === 0) {
                p[i] = FIRE[0] + rand(-0.4, 0.4);
                p[i + 1] = FIRE[1];
                p[i + 2] = FIRE[2] + rand(-0.3, 0.3);
              }
              p[i] += Math.sin(t + i) * dt * 0.6 + (h.ventilation ? dt * 0.4 * Math.sign(Math.sin(i)) : 0);
              p[i + 1] += dt * 0.25;
              p[i + 2] += Math.cos(t * 0.7 + i) * dt * 0.4;
              const maxX = h.hatchClosed ? -1.3 : 11;
              if (p[i + 1] > 2.6 || p[i] < -13.5 || p[i] > maxX || Math.random() < 0.003) {
                p[i] = FIRE[0] + rand(-0.4, 0.4);
                p[i + 1] = FIRE[1];
                p[i + 2] = FIRE[2] + rand(-0.3, 0.3);
              }
            }
          }}
        />
      )}
    </>
  );
}

function FireLight() {
  const light = useRef<THREE.PointLight>(null);
  const core = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const f = 0.7 + Math.sin(clock.elapsedTime * 23) * 0.15 + Math.sin(clock.elapsedTime * 7) * 0.15;
    if (light.current) light.current.intensity = 14 * f;
    if (core.current) core.current.scale.setScalar(0.8 + f * 0.4);
  });
  return (
    <group position={FIRE}>
      <pointLight ref={light} color="#ff7a2a" distance={9} />
      <mesh ref={core}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
    </group>
  );
}

function Astronaut({ c, t }: { c: CrewSim; t: number }) {
  const ref = useRef<THREE.Group>(null);
  const color = CREW_COLOR[c.id] ?? "#ccc";
  const down = !c.conscious;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const [x, z] = crewPosition(c, t);
    ref.current.position.x += (x - ref.current.position.x) * 0.25;
    ref.current.position.z += (z - ref.current.position.z) * 0.25;
    // microgravity bob; a downed crew member drifts horizontally
    ref.current.position.y = (down ? -0.9 : 0) + Math.sin(clock.elapsedTime * 1.2 + x) * 0.06;
    ref.current.rotation.z += ((down ? Math.PI / 2 : 0) - ref.current.rotation.z) * 0.1;
    ref.current.rotation.y = isMoving(c, t) ? Math.atan2(0, 1) : Math.sin(clock.elapsedTime * 0.4 + x) * 0.3;
  });
  const sat = Math.round(c.sao2);
  const satColor = sat >= 92 ? "#3ed6b5" : sat >= 85 ? "#f5b83d" : "#ff3b5c";
  const [x0, z0] = crewPosition(c, t);
  return (
    <group ref={ref} position={[x0, 0, z0]}>
      <mesh position={[0, 0.25, 0]}>
        <capsuleGeometry args={[0.24, 0.75, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshStandardMaterial color="#e9edf2" roughness={0.3} />
      </mesh>
      <mesh position={[0.12, 1.04, 0]}>
        <sphereGeometry args={[0.13, 16, 16, 0, Math.PI]} />
        <meshStandardMaterial color="#0d1520" metalness={0.9} roughness={0.1} />
      </mesh>
      {c.mask && (
        <mesh position={[0.2, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.09, 0.12, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      )}
      {(c.arrest && !c.arrest.rosc) || !c.conscious ? (
        <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.85, 32]} />
          <meshBasicMaterial color="#ff3b5c" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
      <Html position={[0, 1.6, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div className="font-data rounded-md border border-white/10 bg-black/70 px-1.5 py-0.5 text-center text-[10px] leading-tight whitespace-nowrap backdrop-blur">
          <div style={{ color }}>{c.name}</div>
          <div style={{ color: c.arrest && !c.arrest.rosc ? "#ff3b5c" : satColor }}>
            {c.arrest && !c.arrest.rosc ? "VF ARREST" : `${sat}% · ${c.hr}`}
          </div>
        </div>
      </Html>
    </group>
  );
}

function Scene({ s }: { s: SimState }) {
  const alarm = !s.ended && (s.scenario !== "sep" || s.hab.radiationMsvH > 1);
  const co2Fog = Math.min(1, Math.max(0, (s.hab.co2 - 4) / 20));
  return (
    <>
      <color attach="background" args={["#05070b"]} />
      <fog attach="fog" args={[co2Fog > 0 ? "#2c3b22" : "#05070b", 18 - co2Fog * 8, 48 - co2Fog * 22]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 8]} intensity={1.1} />
      <pointLight position={[-7, 2.2, 0]} intensity={8} distance={12} color="#cfe3ff" />
      <pointLight position={[7, 2.2, 0]} intensity={8} distance={12} color="#cfe3ff" />
      <Shell x0={-14} x1={-1.2} tint={s.scenario === "depress" && s.hab.pressureA < 60 ? "#7fd0ff" : "#8aa0bd"} />
      <Shell x0={1.2} x1={12.5} tint="#8aa0bd" />
      <Hatch closed={s.hab.hatchClosed} />
      <Props s={s} />
      <Effects s={s} />
      <AlarmLights active={alarm} />
      {s.crew.map((c) => (
        <Astronaut key={c.id} c={c} t={s.t} />
      ))}
      <ContactShadows position={[0, -0.74, 0]} opacity={0.4} scale={30} blur={2.4} far={4} />
      <Html position={[-7.5, 3.4, 0]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
        <div className="font-data text-[11px] tracking-[0.2em] whitespace-nowrap text-ink-3 uppercase">Module A · {s.hab.pressureA.toFixed(0)} kPa</div>
      </Html>
      <Html position={[7, 3.4, 0]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
        <div className="font-data text-[11px] tracking-[0.2em] whitespace-nowrap text-ink-3 uppercase">Module B · {s.hab.pressureB.toFixed(0)} kPa</div>
      </Html>
      <OrbitControls target={[0, 0.3, 0]} minDistance={8} maxDistance={40} maxPolarAngle={Math.PI / 2.05} enablePan={false} />
    </>
  );
}

export default function Habitat3D({ s }: { s: SimState }) {
  return (
    <Canvas camera={{ position: [3, 12, 17], fov: 45 }} dpr={[1, 2]} shadows={false}>
      <Scene s={s} />
    </Canvas>
  );
}
