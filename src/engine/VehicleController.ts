import * as THREE from 'three';
import type { RoadSegment } from './RoadGraph';

export class VehicleController {
  readonly position = new THREE.Vector3();
  private heading = 0;
  private segmentIndex = 0;
  private t = 0;
  private static readonly MODEL_FORWARD_OFFSET = Math.PI;

  follow(segments: RoadSegment[], delta: number, speed = 0.08, reverse = false) {
    const segment = segments[this.segmentIndex];
    if (!segment) return true;
    this.t = Math.min(1, this.t + (speed * delta) / Math.max(segment.length, 1));
    const curveT = reverse ? 1 - this.t : this.t;
    const point = segment.curve.getPointAt(curveT);
    const tangent = segment.curve.getTangentAt(curveT).normalize().multiplyScalar(reverse ? -1 : 1);
    this.position.copy(point);
    const target = Math.atan2(tangent.x, tangent.z) + VehicleController.MODEL_FORWARD_OFFSET;
    const difference = THREE.MathUtils.euclideanModulo(target - this.heading + Math.PI, Math.PI * 2) - Math.PI;
    this.heading += difference * Math.min(1, delta * 8);
    if (this.t >= 1 && this.segmentIndex < segments.length - 1) { this.segmentIndex++; this.t = 0; }
    return this.segmentIndex === segments.length - 1 && this.t >= 1;
  }

  reverse(travelled: RoadSegment[], delta: number, speed = 0.08) {
    return this.follow([...travelled].reverse(), delta, speed, true);
  }
}
