"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const NODE_COUNT = 260;
const RADIUS = 2.3;
const LINK_DISTANCE = 0.68;
const RING_RADIUS = RADIUS * 1.28;

function buildGraph() {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const nodes: THREE.Vector3[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    nodes.push(
      new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(RADIUS)
    );
  }
  const edges: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].distanceTo(nodes[j]) < LINK_DISTANCE) edges.push([i, j]);
    }
  }
  return { nodes, edges };
}

function PulseNode({ position, phase }: { position: THREE.Vector3; phase: number }) {
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!halo.current) return;
    const t = (clock.elapsedTime * 0.8 + phase) % 1;
    halo.current.scale.setScalar(1 + t * 3.5);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
  });
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color="#e0e7ff" />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial
          color="#818cf8"
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function Signals({
  nodes,
  edges,
}: {
  nodes: THREE.Vector3[];
  edges: [number, number][];
}) {
  const COUNT = 4;
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const signals = useRef<{ edge: number; t: number; speed: number }[]>([]);

  useFrame((_, delta) => {
    if (signals.current.length === 0) {
      signals.current = Array.from({ length: COUNT }, () => ({
        edge: Math.floor(Math.random() * edges.length),
        t: Math.random(),
        speed: 0.4 + Math.random() * 0.4,
      }));
    }
    signals.current.forEach((s, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      s.t += delta * s.speed;
      if (s.t >= 1) {
        s.t = 0;
        s.edge = Math.floor(Math.random() * edges.length);
      }
      const [a, b] = edges[s.edge];
      mesh.position.lerpVectors(nodes[a], nodes[b], s.t);
      mesh.scale.setScalar(Math.sin(Math.PI * s.t) * 1.4 + 0.001);
    });
  });

  return (
    <>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </>
  );
}

function Ring() {
  const orbit = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useFrame((_, delta) => {
    if (orbit.current) orbit.current.rotation.z += delta * 0.45;
  });

  return (
    <group rotation={[1.15, 0.1, -0.3]}>
      <lineLoop geometry={geometry}>
        <lineBasicMaterial
          color="#818cf8"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineLoop>
      <group ref={orbit}>
        <mesh position={[RING_RADIUS, 0, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#c7d2fe" />
        </mesh>
      </group>
    </group>
  );
}

function Globe() {
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const { nodes, edges } = useMemo(() => buildGraph(), []);

  const pointsGeometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(nodes),
    [nodes]
  );
  const linesGeometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    edges.forEach(([a, b]) => pts.push(nodes[a], nodes[b]));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [nodes, edges]);
  const pulseIdx = useMemo(() => [12, 47, 93, 138, 181, 226], []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.07;
    if (tilt.current) {
      tilt.current.rotation.x = THREE.MathUtils.damp(
        tilt.current.rotation.x,
        mouse.current.y * 0.18 + 0.15,
        3,
        delta
      );
      tilt.current.rotation.y = THREE.MathUtils.damp(
        tilt.current.rotation.y,
        mouse.current.x * 0.25,
        3,
        delta
      );
    }
  });

  return (
    <group ref={tilt}>
      <group ref={spin}>
        <points geometry={pointsGeometry}>
          <pointsMaterial
            color="#c7d2fe"
            size={0.05}
            sizeAttenuation
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        <lineSegments geometry={linesGeometry}>
          <lineBasicMaterial
            color="#6366f1"
            transparent
            opacity={0.38}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
        {pulseIdx.map((n, i) => (
          <PulseNode key={n} position={nodes[n]} phase={i * 0.37} />
        ))}
        <Signals nodes={nodes} edges={edges} />
      </group>
      <Ring />
    </group>
  );
}

function Rig({ children }: { children: ReactNode }) {
  const { viewport } = useThree();
  const scale = Math.min(1, viewport.width / (RING_RADIUS * 2 + 0.6));
  return <group scale={scale}>{children}</group>;
}

export default function LoginScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Rig>
        <Globe />
      </Rig>
    </Canvas>
  );
}
