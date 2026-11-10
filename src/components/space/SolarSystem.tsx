"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { craftAt, earthAt, linkAt, marsAt, MISSION_PLAN, type LinkState, type Vec3 } from "@/core/deepSpace";

// Scene units: 1 AU = 10 units. Ecliptic (x, y) maps to scene (x, -z); ecliptic z maps to scene y.
const S = 10;
const toScene = (v: Vec3): [number, number, number] => [v[0] * S, v[2] * S, -v[1] * S];
const DAY = 86400000;

const LINK_COLOR: Record<LinkState, string> = { nominal: "#3ed6b5", degraded: "#f5b83d", blackout: "#ff3b5c" };

export interface Packet {
  id: number;
  /** 0..1 progress along the beam (0 = vehicle, 1 = Earth for downlink). */
  progress: number;
  direction: "down" | "up";
}

function orbitPoints(fn: (d: Date) => Vec3, start: Date, days: number, step = 4) {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= days; i += step) pts.push(toScene(fn(new Date(start.getTime() + i * DAY))));
  return pts;
}

function Body({ pos, color, size, label, glow }: { pos: [number, number, number]; color: string; size: number; label: string; glow?: boolean }) {
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow ? 2.5 : 0.25} roughness={0.7} />
      </mesh>
      <Html center distanceFactor={22} style={{ pointerEvents: "none" }}>
        <div className="font-data -translate-y-6 text-[10px] tracking-widest whitespace-nowrap text-ink uppercase" style={{ textShadow: "0 0 6px #000" }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function Sun() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.4) * 0.03);
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.9, 48, 48]} />
        <meshBasicMaterial color="#ffd27a" />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.12} />
      </mesh>
      <pointLight intensity={180} distance={80} color="#fff2d6" />
    </group>
  );
}

function PacketDot({ from, to, packet, color }: { from: [number, number, number]; to: [number, number, number]; packet: Packet; color: string }) {
  const a = new THREE.Vector3(...(packet.direction === "down" ? from : to));
  const b = new THREE.Vector3(...(packet.direction === "down" ? to : from));
  const p = a.clone().lerp(b, Math.max(0, Math.min(1, packet.progress)));
  return (
    <group position={p.toArray()}>
      <mesh>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function Scene({ date, packets }: { date: Date; packets: Packet[] }) {
  const earth = toScene(earthAt(date));
  const mars = toScene(marsAt(date));
  const craft = toScene(craftAt(date));
  const link = linkAt(date);
  const color = LINK_COLOR[link.state];

  const orbits = useMemo(() => {
    const start = MISSION_PLAN[0].start;
    return { earth: orbitPoints(earthAt, start, 366), mars: orbitPoints(marsAt, start, 688) };
  }, []);
  const route = useMemo(() => {
    const start = MISSION_PLAN[0].start.getTime();
    const end = MISSION_PLAN[MISSION_PLAN.length - 1].end.getTime();
    const pts: [number, number, number][] = [];
    for (let t = start; t <= end; t += 3 * DAY) pts.push(toScene(craftAt(new Date(t))));
    return pts;
  }, []);
  const travelled = route.filter((_, i) => MISSION_PLAN[0].start.getTime() + i * 3 * DAY <= date.getTime());

  return (
    <>
      <ambientLight intensity={0.15} />
      <Stars radius={120} depth={60} count={4000} factor={3} fade speed={0.4} />
      <Sun />
      <Line points={orbits.earth} color="#3987e5" lineWidth={1} transparent opacity={0.45} />
      <Line points={orbits.mars} color="#d95926" lineWidth={1} transparent opacity={0.45} />
      <Line points={route} color="#ffffff" lineWidth={1} dashed dashSize={0.25} gapSize={0.2} transparent opacity={0.25} />
      {travelled.length > 1 && <Line points={travelled} color="#ffffff" lineWidth={2} transparent opacity={0.8} />}
      <Body pos={earth} color="#4f8fe8" size={0.32} label="Earth" />
      <Body pos={mars} color="#d9673a" size={0.24} label="Mars" />
      <group position={craft}>
        <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <octahedronGeometry args={[0.2]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <Html center distanceFactor={22} style={{ pointerEvents: "none" }}>
          <div className="font-data translate-y-6 text-[10px] tracking-widest whitespace-nowrap text-nominal uppercase" style={{ textShadow: "0 0 6px #000" }}>
            Crew
          </div>
        </Html>
      </group>
      {/* the radio link: dashed and red when the Sun blocks it */}
      <Line points={[craft, earth]} color={color} lineWidth={link.state === "blackout" ? 1 : 1.6} dashed={link.state !== "nominal"} dashSize={0.3} gapSize={0.25} transparent opacity={0.85} />
      {packets.map((p) => (
        <PacketDot key={p.id} from={craft} to={earth} packet={p} color={p.direction === "down" ? "#3ed6b5" : "#c9b6ff"} />
      ))}
      <OrbitControls enablePan={false} minDistance={8} maxDistance={60} autoRotate autoRotateSpeed={0.15} />
    </>
  );
}

export default function SolarSystem({ date, packets }: { date: Date; packets: Packet[] }) {
  return (
    <Canvas camera={{ position: [0, 22, 24], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#04060a"]} />
      <Scene date={date} packets={packets} />
    </Canvas>
  );
}
