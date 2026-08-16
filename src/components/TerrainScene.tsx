import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { terrainH, interpolateRoute, SOURCE_POS, DEST_POS } from '../data/mapData';
import type { MissionState } from '../simulation/types';

// ─── Terrain Mesh ─────────────────────────────────────────────────────────────
function Terrain() {
  const mesh = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const SIZE = 24;
    const SEGS = 64;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainH(x, z));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    // Color by height
    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i);
      const t = (h + 3) / 6;
      const r = THREE.MathUtils.lerp(0.03, 0.15, t);
      const g = THREE.MathUtils.lerp(0.07, 0.28, t);
      const b = THREE.MathUtils.lerp(0.04, 0.12, t);
      colors.push(r, g, b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <mesh ref={mesh} geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0.08}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ─── Route Line ───────────────────────────────────────────────────────────────
interface RouteLineProps {
  waypoints: { x: number; y: number; z: number }[];
  color: string;
  isActive: boolean;
  isUnsafe: boolean;
  isAlternative: boolean;
}

function RouteLine({ waypoints, color, isActive, isUnsafe, isAlternative }: RouteLineProps) {
  const points = waypoints.map(w => new THREE.Vector3(w.x, w.y + 0.08, w.z));
  const width = isActive ? 3.5 : isAlternative ? 2.5 : 1.5;
  const opacity = isUnsafe ? 0.4 : isActive || isAlternative ? 1 : 0.35;

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={width}
        transparent
        opacity={opacity}
        dashed={isUnsafe}
        dashSize={0.3}
        gapSize={0.2}
      />
      {isActive && (
        <Line
          points={points}
          color={color}
          lineWidth={8}
          transparent
          opacity={0.08}
        />
      )}
    </group>
  );
}

// ─── Animated Vehicle ─────────────────────────────────────────────────────────
interface VehicleProps {
  position: { x: number; y: number; z: number };
  active: boolean;
}

function Vehicle({ position, active }: VehicleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta * 2.5;
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(t.current) * 0.25);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.15 + Math.sin(t.current) * 0.08;
    }
  });

  if (!active) return null;

  return (
    <group position={[position.x, position.y + 0.35, position.z]}>
      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.15} />
      </mesh>
      {/* Core */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={2.5}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>
      {/* Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.03, 8, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.6} />
      </mesh>
      {/* Label */}
      <Html
        distanceFactor={12}
        position={[0, 0.7, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: '#00d4ff',
          background: 'rgba(4,12,24,0.85)',
          border: '1px solid rgba(0,212,255,0.4)',
          padding: '2px 5px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
        }}>
          NODE-01 ◈
        </div>
      </Html>
    </group>
  );
}

// ─── Hazard Marker ────────────────────────────────────────────────────────────
interface HazardMarkerProps {
  position: { x: number; y: number; z: number };
}

function HazardMarker({ position }: HazardMarkerProps) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    if (ring1.current) ring1.current.scale.setScalar(1 + (t.current % 1.5) / 1.5 * 2);
    if (ring2.current) ring2.current.scale.setScalar(1 + ((t.current + 0.75) % 1.5) / 1.5 * 2);
    const a1 = Math.max(0, 1 - (t.current % 1.5) / 1.5);
    const a2 = Math.max(0, 1 - ((t.current + 0.75) % 1.5) / 1.5);
    if (ring1.current) (ring1.current.material as THREE.MeshBasicMaterial).opacity = a1 * 0.6;
    if (ring2.current) (ring2.current.material as THREE.MeshBasicMaterial).opacity = a2 * 0.6;
  });

  return (
    <group position={[position.x, position.y + 0.5, position.z]}>
      {/* Pulse rings */}
      <mesh ref={ring1} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.04, 8, 32]} />
        <meshBasicMaterial color="#ff2d2d" transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.04, 8, 32]} />
        <meshBasicMaterial color="#ff2d2d" transparent opacity={0.4} />
      </mesh>
      {/* Core */}
      <mesh>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color="#ff2d2d" emissive="#ff2d2d" emissiveIntensity={3} />
      </mesh>
      <Html distanceFactor={12} position={[0, 0.8, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: '#ff2d2d',
          background: 'rgba(4,12,24,0.9)',
          border: '1px solid rgba(255,45,45,0.5)',
          padding: '2px 5px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
        }}>
          ⚠ HAZARD
        </div>
      </Html>
    </group>
  );
}

// ─── Comm Node Pillar ─────────────────────────────────────────────────────────
interface CommNodeMeshProps {
  position: { x: number; y: number; z: number };
  label: string;
  status: string;
}

function CommNodeMesh({ position, label, status }: CommNodeMeshProps) {
  const t = useRef(0);
  const capRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta * 1.5;
    if (capRef.current) {
      (capRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.5 + Math.sin(t.current) * 0.8;
    }
  });

  const color = status === 'HAZARD' ? '#ff2d2d' : status === 'UPDATING' ? '#ffb800' : '#00d4ff';

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Pillar */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.6, 8]} />
        <meshStandardMaterial color="#0a1a30" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Cap */}
      <mesh ref={capRef} position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
          metalness={0.5}
        />
      </mesh>
      <Html distanceFactor={14} position={[0, 1.1, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '8px',
          color: color,
          background: 'rgba(4,12,24,0.7)',
          border: `1px solid ${color}44`,
          padding: '1px 4px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── Source / Destination Markers ─────────────────────────────────────────────
function EndpointMarker({ position, label, color }: { position: { x: number; y: number; z: number }; label: string; color: string }) {
  return (
    <group position={[position.x, position.y + 0.2, position.z]}>
      <mesh>
        <cylinderGeometry args={[0.18, 0.22, 0.15, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} metalness={0.6} />
      </mesh>
      <Html distanceFactor={12} position={[0, 0.7, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: '8px',
          color,
          background: 'rgba(4,12,24,0.9)',
          border: `1px solid ${color}55`,
          padding: '2px 6px',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
          letterSpacing: '0.1em',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── Scene Camera Setup ───────────────────────────────────────────────────────
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 20, 17);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ─── Route color helper ───────────────────────────────────────────────────────
function routeColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return '#00d4ff';
    case 'ALTERNATIVE': return '#00ff8c';
    case 'UNSAFE': return '#ff2d2d';
    case 'HIGH_RISK': return '#ff6b00';
    case 'CAUTION': return '#ffb800';
    default: return '#2a4060';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface TerrainSceneProps {
  state: MissionState;
}

export default function TerrainScene({ state }: TerrainSceneProps) {
  const vehicleRoute = state.routes.find(r => r.id === state.activeRouteId);
  const vehiclePos = vehicleRoute
    ? interpolateRoute(vehicleRoute.waypoints, state.vehicleT)
    : SOURCE_POS;

  const isActive = state.phase !== 'IDLE' && state.phase !== 'INITIALIZING' && state.phase !== 'ROUTE_ANALYSIS';

  return (
    <div className="w-full h-full relative">
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-lines opacity-40 pointer-events-none z-10" />
      <div className="absolute inset-0 scanlines z-10 pointer-events-none" />

      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#040c18' }}
      >
        <CameraSetup />

        {/* Lighting */}
        <ambientLight intensity={0.25} color="#0a1a2e" />
        <directionalLight
          position={[10, 20, 10]}
          intensity={0.8}
          color="#d4e8ff"
          castShadow
        />
        <pointLight position={[-8, 8, -8]} intensity={0.5} color="#00d4ff" />
        <pointLight position={[8, 6, 8]} intensity={0.3} color="#004466" />
        <fog attach="fog" args={['#020810', 28, 55]} />

        {/* Terrain */}
        <Terrain />

        {/* Routes */}
        {state.routes.map(route => (
          <RouteLine
            key={route.id}
            waypoints={route.waypoints}
            color={routeColor(route.status)}
            isActive={route.status === 'ACTIVE'}
            isUnsafe={route.status === 'UNSAFE'}
            isAlternative={route.status === 'ALTERNATIVE'}
          />
        ))}

        {/* Endpoints */}
        <EndpointMarker position={SOURCE_POS} label="BASE-01" color="#00d4ff" />
        <EndpointMarker position={DEST_POS} label="ZONE-07" color="#00ff8c" />

        {/* Comm nodes */}
        {state.nodes.map(node => (
          <CommNodeMesh
            key={node.id}
            position={node.position}
            label={node.label}
            status={node.status}
          />
        ))}

        {/* Hazards */}
        {state.hazards.filter(h => h.active).map(h => (
          <HazardMarker key={h.id} position={h.position} />
        ))}

        {/* Vehicle */}
        <Vehicle position={vehiclePos} active={isActive} />

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={10}
          maxDistance={35}
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* Corner labels */}
      <div className="absolute top-2 left-2 font-mono text-[9px] text-cyan-400/40 tracking-widest z-20 pointer-events-none">
        TACTICAL MAP — GRID REF: 42°N 18°E
      </div>
      <div className="absolute top-2 right-2 font-mono text-[9px] text-cyan-400/40 tracking-widest z-20 pointer-events-none">
        ALT: 420–1240m · SCALE: 1:50000
      </div>
    </div>
  );
}
