import * as THREE from 'three';
import { mountainHeight, ROAD_SURFACE_OFFSET } from '../terrain/MountainTerrain';

export type RoadNode = { id: string; position: THREE.Vector3; connections: string[] };
export type RoadSegment = {
  id: string; from: string; to: string; curve: THREE.CatmullRomCurve3;
  length: number; width: number; risk: number; blocked: boolean; traversable: boolean;
  oneWay: boolean; forwardFrom: string; forwardTo: string;
};

function curveLength(curve: THREE.CatmullRomCurve3): number {
  return curve.getLength();
}

export class RoadGraph {
  readonly nodes = new Map<string, RoadNode>();
  readonly segments = new Map<string, RoadSegment>();

  addNode(id: string, position: THREE.Vector3) {
    this.nodes.set(id, { id, position, connections: [] });
  }

  addSegment(id: string, from: string, to: string, points: THREE.Vector3[], risk: number, width = 5.5, oneWay = true) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    const segment: RoadSegment = { id, from, to, curve, length: curveLength(curve), width, risk, blocked: false, traversable: true, oneWay, forwardFrom: from, forwardTo: to };
    this.segments.set(id, segment);
    this.nodes.get(from)?.connections.push(id);
    this.nodes.get(to)?.connections.push(id);
  }

  neighbors(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.connections.map(id => this.segments.get(id)).filter((segment): segment is RoadSegment => Boolean(segment) && (!segment.oneWay || segment.forwardFrom === nodeId));
  }

  setBlocked(segmentId: string, blocked: boolean) {
    const segment = this.segments.get(segmentId);
    if (segment) { segment.blocked = blocked; segment.traversable = !blocked; }
  }
}

export function validateRoadContinuity(graph: RoadGraph): boolean {
  let valid = true;
  for (const segment of graph.segments.values()) {
    const from = graph.nodes.get(segment.from)?.position;
    const to = graph.nodes.get(segment.to)?.position;
    const start = segment.curve.getPointAt(0);
    const end = segment.curve.getPointAt(1);
    if (!from || !to || segment.length <= 0 || start.distanceTo(from) > 0.05 || end.distanceTo(to) > 0.05) {
      console.warn('ROAD ENDPOINT MISALIGNED', segment.id);
      valid = false;
    }
  }
  for (const node of graph.nodes.values()) {
    if (node.connections.length < 2) continue;
    for (let index = 0; index < node.connections.length; index++) {
      for (let next = index + 1; next < node.connections.length; next++) {
        const first = graph.segments.get(node.connections[index]);
        const second = graph.segments.get(node.connections[next]);
        if (!first || !second) continue;
        const firstEnd = first.from === node.id ? first.curve.getPointAt(0) : first.curve.getPointAt(1);
        const secondEnd = second.from === node.id ? second.curve.getPointAt(0) : second.curve.getPointAt(1);
        if (firstEnd.distanceTo(secondEnd) > 0.05) {
          console.warn('ROAD CONNECTION GAP', node.id, first.id, second.id);
          valid = false;
        }
      }
    }
  }
  if (valid) console.info('ROAD CONTINUITY: PASS');
  return valid;
}

const point = (x: number, z: number) => new THREE.Vector3(x, mountainHeight(x, z) + ROAD_SURFACE_OFFSET, z);

export function createMountainRoadGraph(): RoadGraph {
  const graph = new RoadGraph();
  const nodes: Record<string, [number, number]> = {
    START_NODE: [-28, 21], N1: [-21, 15], N2: [-12, 8], N3: [-1, 1], N4: [-7, 21],
    N5: [5, 17], N6: [15, -4], N7: [-11, -3], N8: [-1, -10], N9: [-22, -10],
    N10: [12, -15], DESTINATION_NODE: [28, -21],
  };
  Object.entries(nodes).forEach(([id, [x, z]]) => graph.addNode(id, point(x, z)));
  const junction = (id: string) => graph.nodes.get(id)!.position;
  const add = (id: string, from: string, to: string, middle: THREE.Vector3[], risk: number) => graph.addSegment(id, from, to, [junction(from), ...middle, junction(to)], risk);
  add('R_MAIN_01', 'START_NODE', 'N1', [point(-25, 18)], 18);
  add('R_MAIN_02', 'N1', 'N2', [point(-17, 12)], 18);
  add('R_MAIN_03', 'N2', 'N3', [point(-7, 5)], 22);
  add('R_MAIN_04', 'N3', 'N6', [point(7, -1)], 72);
  add('R_ALT_01', 'N2', 'N4', [point(-10, 15)], 42);
  add('R_ALT_02', 'N4', 'N5', [point(-1, 22)], 38);
  add('R_ALT_03', 'N5', 'N6', [point(11, 9)], 29);
  add('R_CONNECT_01', 'N2', 'N7', [point(-15, 2)], 65);
  add('R_CONNECT_02', 'N7', 'N8', [point(-6, -8)], 68);
  add('R_CONNECT_03', 'N8', 'N10', [point(6, -14)], 70);
  add('R_CONNECT_04', 'N1', 'N9', [point(-25, 3)], 31);
  add('R_CONNECT_05', 'N9', 'N10', [point(-6, -16)], 29);
  add('R_DEST_01', 'N6', 'DESTINATION_NODE', [point(22, -12)], 20);
  add('R_DEST_02', 'N10', 'DESTINATION_NODE', [point(21, -19)], 72);
  return graph;
}

export const ROAD_GRAPH = createMountainRoadGraph();
validateRoadContinuity(ROAD_GRAPH);

export const MISSION_ROUTE_SEGMENTS: Record<string, string[]> = {
  'ROUTE-A': ['R_MAIN_01', 'R_MAIN_02', 'R_MAIN_03', 'R_MAIN_04', 'R_DEST_01'],
  'ROUTE-B': ['R_MAIN_01', 'R_MAIN_02', 'R_ALT_01', 'R_ALT_02', 'R_ALT_03', 'R_DEST_01'],
  'ROUTE-C': ['R_MAIN_01', 'R_CONNECT_04', 'R_CONNECT_05', 'R_DEST_02'],
};

export function getMissionSegments(routeId: string) {
  return (MISSION_ROUTE_SEGMENTS[routeId] ?? []).map(id => ROAD_GRAPH.segments.get(id)).filter((segment): segment is RoadSegment => Boolean(segment));
}

export function sampleRoadSegments(segments: RoadSegment[], progress: number) {
  if (!segments.length) return { point: new THREE.Vector3(), tangent: new THREE.Vector3(0, 0, 1), segment: undefined, segmentT: 0 };
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0);
  let distance = THREE.MathUtils.clamp(progress, 0, 1) * totalLength;
  for (const segment of segments) {
    if (distance <= segment.length || segment === segments[segments.length - 1]) {
      const t = segment.length ? distance / segment.length : 0;
      return { point: segment.curve.getPointAt(t), tangent: segment.curve.getTangentAt(t).normalize(), segment, segmentT: t };
    }
    distance -= segment.length;
  }
  return { point: segments[segments.length - 1].curve.getPointAt(1), tangent: segments[segments.length - 1].curve.getTangentAt(1).normalize(), segment: segments[segments.length - 1], segmentT: 1 };
}
