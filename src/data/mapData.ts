import type { Route, CommNode, Vec3 } from '../simulation/types';

// Continuous terrain field shared by the terrain mesh, roads, and scenery.
export function terrainH(x: number, z: number): number {
  const ridgeA = 2.5 * Math.exp(-((x + 7) ** 2 + (z - 5) ** 2) / 150);
  const ridgeB = 3.4 * Math.exp(-((x - 6) ** 2 + (z + 5) ** 2) / 190);
  const variation = 0.8 * Math.sin(x * 0.28) * Math.cos(z * 0.24);
  return Math.max(-0.8, ridgeA + ridgeB + variation);
}

function wp(x: number, z: number, yOffset = 0.25): Vec3 {
  return { x, y: terrainH(x, z) + yOffset, z };
}

export const SOURCE_POS: Vec3 = wp(-28, 21);
export const DEST_POS: Vec3 = wp(28, -21);

export const INITIAL_ROUTES: Route[] = [
  {
    id: 'ROUTE-A',
    label: 'Route A',
    waypoints: [
      wp(-8.5, 7.5),
      wp(-5, 4.5),
      wp(-2, 2),
      wp(1, 0),
      wp(4, -2.5),
      wp(6.5, -5),
      wp(8.5, -7.5),
    ],
    distance: 4.2,
    terrainRisk: 18,
    obstructionRisk: 5,
    environmentalRisk: 12,
    sensorConfidence: 94,
    currentRisk: 18,
    status: 'ACTIVE',
  },
  {
    id: 'ROUTE-B',
    label: 'Route B',
    waypoints: [
      wp(-8.5, 7.5),
      wp(-9, 3),
      wp(-8, -1),
      wp(-5, -4.5),
      wp(-1, -6),
      wp(3.5, -7),
      wp(7, -7.2),
      wp(8.5, -7.5),
    ],
    distance: 5.1,
    terrainRisk: 22,
    obstructionRisk: 8,
    environmentalRisk: 15,
    sensorConfidence: 91,
    currentRisk: 31,
    status: 'SAFE',
  },
  {
    id: 'ROUTE-C',
    label: 'Route C',
    waypoints: [
      wp(-8.5, 7.5),
      wp(-4, 6),
      wp(0, 5),
      wp(3, 2),
      wp(6, 0),
      wp(8.5, -7.5),
    ],
    distance: 4.7,
    terrainRisk: 58,
    obstructionRisk: 45,
    environmentalRisk: 38,
    sensorConfidence: 72,
    currentRisk: 72,
    status: 'HIGH_RISK',
  },
];

export const INITIAL_NODES: CommNode[] = [
  {
    id: 'NODE-01',
    label: 'NODE-01',
    position: wp(-8.5, 7.5, 0.5),
    status: 'ONLINE',
    lastMessage: 'Base Station',
  },
  {
    id: 'NODE-02',
    label: 'NODE-02',
    position: wp(-2, 2.5, 0.5),
    status: 'ONLINE',
    lastMessage: 'Relay Active',
  },
  {
    id: 'NODE-03',
    label: 'NODE-03',
    position: wp(-4, 4, 0.5),
    status: 'ONLINE',
    lastMessage: 'Monitoring',
  },
  {
    id: 'NODE-04',
    label: 'NODE-04',
    position: wp(3, -1.5, 0.5),
    status: 'ONLINE',
    lastMessage: 'Relay Active',
  },
  {
    id: 'NODE-05',
    label: 'NODE-05',
    position: wp(8.5, -7.5, 0.5),
    status: 'ONLINE',
    lastMessage: 'Destination',
  },
];

// Hazard spawn position — on Route A, about 40% along
export const HAZARD_POSITION: Vec3 = wp(-1.5, 1.2, 0.3);

// Hazard collision radius (vehicle must not enter this radius)
export const HAZARD_RADIUS = 1.0;

// Interpolate position along a route by t (0-1)
export function interpolateRoute(waypoints: Vec3[], t: number): Vec3 {
  if (t <= 0) return waypoints[0];
  if (t >= 1) return waypoints[waypoints.length - 1];

  const totalSegs = waypoints.length - 1;
  const rawIdx = t * totalSegs;
  const segIdx = Math.floor(rawIdx);
  const segT = rawIdx - segIdx;

  const a = waypoints[Math.min(segIdx, totalSegs - 1)];
  const b = waypoints[Math.min(segIdx + 1, totalSegs)];

  return {
    x: a.x + (b.x - a.x) * segT,
    y: a.y + (b.y - a.y) * segT,
    z: a.z + (b.z - a.z) * segT,
  };
}

// Calculate 3D distance between two points
export function distance3D(p1: Vec3, p2: Vec3): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Check if position intersects hazard radius
export function checkHazardCollision(vehiclePos: Vec3, hazardPos: Vec3, hazardRadius: number): boolean {
  return distance3D(vehiclePos, hazardPos) < hazardRadius;
}

// Find the closest point on the route (by t value) to a given position
export function findClosestRoutePoint(waypoints: Vec3[], targetPos: Vec3): number {
  let closestT = 0;
  let closestDist = Infinity;

  // Sample the route at fine intervals to find closest point
  for (let t = 0; t <= 1; t += 0.01) {
    const pt = interpolateRoute(waypoints, t);
    const dist = distance3D(pt, targetPos);
    if (dist < closestDist) {
      closestDist = dist;
      closestT = t;
    }
  }

  return closestT;
}
