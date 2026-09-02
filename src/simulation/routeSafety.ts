// Route safety and hazard collision detection
import type { Route, Hazard, Vec3 } from './types';

/**
 * Calculate 3D distance between two points
 */
export function distance3D(p1: Vec3, p2: Vec3): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Interpolate a position along a route given parameter t (0-1)
 */
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

/**
 * Check if a position is within hazard collision radius
 * Uses 2D distance (x, z plane) since hazards are location-based, not altitude-based
 */
export function isInHazardRadius(position: Vec3, hazard: Hazard): boolean {
  const dx = hazard.position.x - position.x;
  const dz = hazard.position.z - position.z;
  const dist2D = Math.sqrt(dx * dx + dz * dz);
  return dist2D < hazard.radius;
}

export function movementIntersectsHazard(start: Vec3, end: Vec3, hazard: Hazard): boolean {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((hazard.position.x - start.x) * dx + (hazard.position.z - start.z) * dz) / lengthSquared));
  const closest = { x: start.x + dx * projection, y: start.y, z: start.z + dz * projection };
  return isInHazardRadius(closest, hazard);
}

export function interpolatePath(path: Vec3[], t: number): Vec3 {
  if (path.length === 0) return { x: 0, y: 0, z: 0 };
  if (path.length === 1 || t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];
  const scaled = t * (path.length - 1);
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const start = path[index];
  const end = path[index + 1];
  return {
    x: start.x + (end.x - start.x) * localT,
    y: start.y + (end.y - start.y) * localT,
    z: start.z + (end.z - start.z) * localT,
  };
}

/**
 * Find which waypoint index is closest to a position along a route
 */
export function findClosestWaypointIndex(position: Vec3, waypoints: Vec3[]): number {
  let minDist = Infinity;
  let closestIdx = 0;

  for (let i = 0; i < waypoints.length; i++) {
    const d = distance3D(position, waypoints[i]);
    if (d < minDist) {
      minDist = d;
      closestIdx = i;
    }
  }

  return closestIdx;
}

/**
 * Calculate the progress parameter (t) along a route to reach a target position
 * Returns a value from 0 to 1, where we connect the current position to the route
 */
export function calculateTForPosition(position: Vec3, waypoints: Vec3[]): number {
  // Find closest point on route
  let minDist = Infinity;
  let bestT = 0;

  const totalSegs = waypoints.length - 1;
  const samples = totalSegs * 10; // Sample 10 points per segment

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const routePos = interpolateRoute(waypoints, t);
    const d = distance3D(position, routePos);
    if (d < minDist) {
      minDist = d;
      bestT = t;
    }
  }

  return bestT;
}

/**
 * Check if a hazard intersects with any waypoint on a route
 */
export function checkHazardIntersectsRoute(hazard: Hazard, route: Route): number[] {
  const blockedIndices: number[] = [];

  for (let i = 0; i < route.waypoints.length; i++) {
    const dx = hazard.position.x - route.waypoints[i].x;
    const dz = hazard.position.z - route.waypoints[i].z;
    if (Math.sqrt(dx * dx + dz * dz) < hazard.radius) {
      blockedIndices.push(i);
    }
  }

  return blockedIndices;
}

/**
 * Check if a route is passable given active hazards
 */
export function isRoutePassable(route: Route, hazards: Hazard[]): boolean {
  if (!route.blockedWaypoints || route.blockedWaypoints.length === 0) {
    return true;
  }

  // A route is impassable if it has blocked waypoints
  // that form a barrier (not just the start or end)
  const waypoints = route.waypoints.length;
  
  // If start is blocked, can't begin
  if (route.blockedWaypoints.includes(0)) return false;
  
  // If end is blocked, can't reach destination
  if (route.blockedWaypoints.includes(waypoints - 1)) return false;

  // If there's a contiguous block in the middle, it might still be passable
  // if we can navigate around it (for more complex route planning)
  // For now, any blocked waypoint makes the route risky
  return false;
}

/**
 * Mark waypoints on a route as blocked by hazards
 */
export function markBlockedWaypoints(route: Route, hazards: Hazard[]): Route {
  const blocked = new Set<number>();

  for (const hazard of hazards) {
    if (hazard.affectedRouteId === route.id && hazard.active) {
      const intersecting = checkHazardIntersectsRoute(hazard, route);
      intersecting.forEach(idx => blocked.add(idx));
    }
  }

  return {
    ...route,
    blockedWaypoints: Array.from(blocked),
  };
}

/**
 * Get the distance traveled along a route up to waypoint index i
 */
export function getDistanceToWaypoint(waypoints: Vec3[], waypointIndex: number): number {
  let dist = 0;
  for (let i = 0; i < Math.min(waypointIndex, waypoints.length - 1); i++) {
    dist += distance3D(waypoints[i], waypoints[i + 1]);
  }
  return dist;
}

/**
 * Get total route distance
 */
export function getTotalRouteDistance(waypoints: Vec3[]): number {
  let dist = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    dist += distance3D(waypoints[i], waypoints[i + 1]);
  }
  return dist;
}

/**
 * Calculate time parameter (t) from distance traveled
 * Assumes uniform speed, but accounts for actual waypoint positions
 */
export function getTFromDistance(distance: number, waypoints: Vec3[]): number {
  const totalDist = getTotalRouteDistance(waypoints);
  if (totalDist === 0) return 0;
  return Math.min(1, distance / totalDist);
}
