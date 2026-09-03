import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { terrainH, SOURCE_POS, DEST_POS } from '../data/mapData';
import type { MissionState } from '../simulation/types';
import { createMountainTerrain } from '../terrain/MountainTerrain';
import { ROAD_GRAPH, getMissionSegments, sampleRoadSegments, type RoadSegment } from '../engine/RoadGraph';
import { createJunctionPatch, createRoadNetworkGeometry } from '../terrain/RoadNetwork';

// ─── Terrain Mesh ─────────────────────────────────────────────────────────────
function Terrain() {
  const mesh = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = createMountainTerrain(64, 96);

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

const ROAD_SURFACE_OFFSET = 0.25;
const MODEL_FORWARD_OFFSET = 0;

function MountainRelief() {
  const scenery = useMemo(() => {
    const roads = [...ROAD_GRAPH.segments.values()].map(segment => ({ id: segment.id, curve: segment.curve, width: segment.width }));
    const points: { x: number; z: number; scale: number; type: number }[] = [];
    const rocks: { x: number; z: number; size: number }[] = [];
    let seed = 19;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let treeAttempts = 0;
    while (points.length < 90 && treeAttempts < 4000) {
      treeAttempts++;
      const x = (random() - 0.5) * 36;
      const z = (random() - 0.5) * 34;
      const clear = roads.every(({ curve }) => {
        for (let i = 0; i <= 100; i++) {
          if (Math.hypot(curve.getPointAt(i / 100).x - x, curve.getPointAt(i / 100).z - z) < 4.25) return false;
        }
        return true;
      });
      if (clear && points.every(point => Math.hypot(point.x - x, point.z - z) >= 2.8)) {
        points.push({ x, z, scale: 0.28 + random() * 0.25, type: Math.floor(random() * 4) });
      }
    }
    for (let index = 0; index < 38; index++) {
      const x = (random() - 0.5) * 36;
      const z = (random() - 0.5) * 34;
      if (roads.every(({ curve }) => Array.from({ length: 24 }, (_, sample) => curve.getPointAt(sample / 23)).every(point => Math.hypot(point.x - x, point.z - z) >= 4.25))) {
        rocks.push({ x, z, size: 0.18 + random() * 0.35 });
      }
    }
    return { roads, points, rocks };
  }, []);

  return (
    <group>
      {scenery.roads.map(({ id }) => <Road key={id} segment={ROAD_GRAPH.segments.get(id)!} />)}
      {[...ROAD_GRAPH.nodes.values()].filter(node => node.connections.length > 1).map(node => {
        const radius = Math.max(...node.connections.map(id => ROAD_GRAPH.segments.get(id)?.width ?? 0)) / 2 + 0.8;
        return <primitive key={`junction-${node.id}`} object={createJunctionPatch(node.position, radius)} />;
      })}
      {scenery.points.map(({ x, z, scale, type }, index) => (
        <group key={`tree-${index}`} position={[x, terrainH(x, z), z]} scale={scale}>
          <mesh position={[0, 0.6, 0]} castShadow><cylinderGeometry args={[0.18, 0.24, 1.2, 6]} /><meshStandardMaterial color="#43352a" /></mesh>
          {type === 1 ? <mesh position={[0, 1.7, 0]} castShadow><sphereGeometry args={[1.2, 8, 6]} /><meshStandardMaterial color="#38523b" roughness={1} /></mesh> : type === 2 ? <mesh position={[0, 2.9, 0]} castShadow><coneGeometry args={[0.8, 5, 7]} /><meshStandardMaterial color="#1d342b" roughness={1} /></mesh> : type === 3 ? <mesh position={[0, 1.1, 0]} castShadow><dodecahedronGeometry args={[1.1, 0]} /><meshStandardMaterial color="#496347" roughness={1} /></mesh> : <mesh position={[0, 2.8, 0]} castShadow><coneGeometry args={[1.15, 4.2, 7]} /><meshStandardMaterial color="#25362c" roughness={1} /></mesh>}
        </group>
      ))}
      {scenery.rocks.map(({ x, z, size }, index) => (
        <mesh key={`rock-${index}`} position={[x, terrainH(x, z) + size * 0.5, z]} scale={[1.2, 0.7, 0.9]} rotation={[0.2, index, 0]} castShadow>
          <dodecahedronGeometry args={[size, 0]} />
          <meshStandardMaterial color="#4b504d" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Road({ segment }: { segment: RoadSegment }) {
  const road = useMemo(() => createRoadNetworkGeometry(segment), [segment]);
  return (
    <primitive object={road} />
  );
}

// ─── Route Line ───────────────────────────────────────────────────────────────
interface RouteLineProps {
  routeId: string;
  color: string;
  isActive: boolean;
  isUnsafe: boolean;
  isAlternative: boolean;
}

function RouteLine({ routeId, color, isActive, isUnsafe, isAlternative }: RouteLineProps) {
  if (!isActive && !isAlternative) return null;
  const points = getMissionSegments(routeId).flatMap(segment => segment.curve.getPoints(80).map(point => point.clone().setY(point.y + 0.15)));
  const width = isActive ? 3.5 : 2.5;
  const opacity = isUnsafe ? 0.4 : 1;

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
  routeSegments: RoadSegment[];
  routeT: number;
}

function Vehicle({ position, active, routeSegments, routeT }: VehicleProps) {
  const vehicleRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const headingRef = useRef(0);
  const t = useRef(0);

  useFrame((_, delta) => {
    t.current += delta * 2.5;
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(t.current) * 0.25);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.15 + Math.sin(t.current) * 0.08;
    }
    if (vehicleRef.current && routeSegments.length) {
      const sampled = sampleRoadSegments(routeSegments, routeT);
      const targetHeading = Math.atan2(sampled.tangent.x, sampled.tangent.z);
      const deltaHeading = THREE.MathUtils.euclideanModulo(targetHeading - headingRef.current + Math.PI, Math.PI * 2) - Math.PI;
      headingRef.current += deltaHeading * Math.min(1, delta * 8);
      vehicleRef.current.rotation.y = headingRef.current;
    }
  });

  if (!active) return null;

  return (
    <group ref={vehicleRef} position={[position.x, position.y + 0.35, position.z]}>
      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.15} />
      </mesh>
      {/* Recovery truck */}
      <group rotation={[0, MODEL_FORWARD_OFFSET, 0]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.9, 0.42, 1.45]} />
          <meshStandardMaterial color="#ff7a00" metalness={0.25} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.65, 0.38]} castShadow>
          <boxGeometry args={[0.84, 0.42, 0.55]} />
          <meshStandardMaterial color="#d95f00" metalness={0.25} roughness={0.6} />
        </mesh>
        {[[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]].map(([x, z], index) => (
          <mesh key={index} position={[x, 0.12, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.12, 12]} />
            <meshStandardMaterial color="#11161a" roughness={1} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.025, 8, 32]} />
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

function BlueNodeMarker({ position, index }: { position: THREE.Vector3; index: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const label = `NODE-BLUE-${String(index + 1).padStart(2, '0')}`;
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.8;
  });
  return (
    <group position={[position.x, position.y + 0.4, position.z]}>
      <pointLight color="#0088ff" intensity={0.35} distance={2.5} />
      <mesh><sphereGeometry args={[0.18, 16, 16]} /><meshStandardMaterial color="#00aaff" emissive="#0088ff" emissiveIntensity={3} /></mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.32, 0.025, 8, 24]} /><meshBasicMaterial color="#00aaff" transparent opacity={0.7} /></mesh>
      <Html distanceFactor={14} position={[0, 0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ color: '#55cfff', fontFamily: "'JetBrains Mono', monospace", fontSize: '8px', background: 'rgba(4,12,24,0.82)', border: '1px solid rgba(0,170,255,0.45)', padding: '2px 4px', whiteSpace: 'nowrap' }}>{label}</div>
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

function HazardEventVisual({ hazard }: { hazard: MissionState['hazards'][number] }) {
  const rocks = useMemo(() => Array.from({ length: 14 }, (_, index) => ({
    x: ((index * 37) % 100) / 100 * 3.5 - 1.75,
    z: ((index * 61) % 100) / 100 * 2.5 - 1.25,
    startY: 6 + ((index * 17) % 100) / 100 * 5,
    size: 0.25 + ((index * 29) % 100) / 100 * 0.4,
    rotation: index * 0.8,
  })), []);
  const elapsed = useRef(0);
  useFrame((_, delta) => { elapsed.current = Math.min(1.4, elapsed.current + delta); });

  if (hazard.type === 'LANDSLIDE') {
    const progress = Math.min(1, elapsed.current / 1.1);
    return (
      <group position={[hazard.position.x, hazard.position.y, hazard.position.z]}>
        {rocks.map((rock, index) => {
          const fall = THREE.MathUtils.smoothstep(progress, 0, 1);
          const y = THREE.MathUtils.lerp(rock.startY, 0.25 + (index % 3) * 0.18, fall);
          return <mesh key={index} position={[rock.x, y, rock.z]} rotation={[rock.rotation, rock.rotation * 0.7, 0]} scale={rock.size} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#65584c" roughness={1} />
          </mesh>;
        })}
      </group>
    );
  }

  return (
    <group position={[hazard.position.x, hazard.position.y + 0.35, hazard.position.z]}>
      <mesh castShadow>
        <boxGeometry args={[3.5, 0.7, 2.2]} />
        <meshStandardMaterial color={hazard.type === 'FIRE' ? '#e34b20' : '#5d6468'} emissive={hazard.type === 'FIRE' ? '#7a1908' : '#000000'} emissiveIntensity={hazard.type === 'FIRE' ? 1.5 : 0} />
      </mesh>
      {hazard.type === 'FIRE' && <pointLight color="#ff4b19" intensity={2} distance={5} />}
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
    camera.position.set(0, 42, 48);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ─── Route color helper ───────────────────────────────────────────────────────
function routeColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return '#00d4ff';
    case 'ALTERNATIVE': return '#00d4ff';
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
  const activeSegments = getMissionSegments(state.activeRouteId);
  const vehiclePos = state.vehiclePosition ?? SOURCE_POS;

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
        <fog attach="fog" args={['#020810', 45, 100]} />

        {/* Terrain */}
        <Terrain />
        <MountainRelief />

        {/* Routes */}
        {state.routes.map(route => (
          <RouteLine
            key={route.id}
            routeId={route.id}
            color={routeColor(route.status)}
            isActive={route.status === 'ACTIVE'}
            isUnsafe={route.status === 'UNSAFE'}
            isAlternative={route.status === 'ALTERNATIVE'}
          />
        ))}

        {/* Endpoints */}
        <EndpointMarker position={SOURCE_POS} label="BASE-01" color="#00d4ff" />
        <EndpointMarker position={DEST_POS} label="ZONE-07" color="#00ff8c" />

        {/* Graph junction markers */}
        {[...ROAD_GRAPH.nodes.values()].map((node, index) => (
          <BlueNodeMarker key={node.id} position={node.position} index={index} />
        ))}

        {/* Hazards */}
        {state.hazards.filter(h => h.active).map(h => (
          <group key={h.id}>
            <HazardEventVisual hazard={h} />
            <HazardMarker position={h.position} />
          </group>
        ))}

        {/* Vehicle */}
        <Vehicle position={vehiclePos} active={isActive} routeSegments={activeSegments} routeT={state.vehicleT} />

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={18}
          maxDistance={72}
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
