import * as THREE from 'three';
import type { HazardType } from '../simulation/types';
import type { RoadGraph, RoadSegment } from './RoadGraph';

export type HazardEvent = {
  id: string;
  type: HazardType;
  targetNodeId: string;
  targetSegmentId: string;
  position: THREE.Vector3;
  active: boolean;
  blocking: boolean;
  animation: 'FALLING' | 'STATIC';
};

export function createHazardEvent(graph: RoadGraph, segment: RoadSegment, type: HazardType, id: string): HazardEvent {
  const targetNode = graph.nodes.get(segment.to);
  const position = segment.curve.getPointAt(0.82);
  return {
    id,
    type,
    targetNodeId: targetNode?.id ?? segment.to,
    targetSegmentId: segment.id,
    position,
    active: true,
    blocking: false,
    animation: type === 'LANDSLIDE' ? 'FALLING' : 'STATIC',
  };
}
