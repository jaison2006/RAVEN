import * as THREE from 'three';
import type { RoadSegment } from '../engine/RoadGraph';

export function createJunctionPatch(position: THREE.Vector3, radius: number) {
  const patch = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }),
  );
  patch.position.set(position.x, position.y + 0.08, position.z);
  return patch;
}

export function createRoadNetworkGeometry(segment: RoadSegment) {
  const curve = segment.curve;
  const samples = 300;
  const halfWidth = segment.width / 2;
  const shoulderHalfWidth = halfWidth + 0.28;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const leftMark: THREE.Vector3[] = [];
  const rightMark: THREE.Vector3[] = [];
  const centerMark: THREE.Vector3[] = [];
  for (let index = 0; index <= samples; index++) {
    const point = curve.getPointAt(index / samples);
    const tangent = curve.getTangentAt(index / samples).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const left = point.clone().addScaledVector(normal, halfWidth);
    const right = point.clone().addScaledVector(normal, -halfWidth);
    vertices.push(left.x, left.y + 0.08, left.z, right.x, right.y + 0.08, right.z);
    uvs.push(0, index / samples, 1, index / samples);
    leftMark.push(point.clone().addScaledVector(normal, halfWidth - 0.18).setY(point.y + 0.13));
    rightMark.push(point.clone().addScaledVector(normal, -halfWidth + 0.18).setY(point.y + 0.13));
    centerMark.push(point.clone().setY(point.y + 0.13));
  }
  const indices: number[] = [];
  for (let index = 0; index < samples; index++) {
    const offset = index * 2;
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const shoulderGeometry = geometry.clone();
  const shoulderPositions = shoulderGeometry.attributes.position;
  for (let index = 0; index < shoulderPositions.count; index++) {
    const point = curve.getPointAt(Math.floor(index / 2) / samples);
    const tangent = curve.getTangentAt(Math.floor(index / 2) / samples).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = index % 2 === 0 ? 1 : -1;
    shoulderPositions.setX(index, point.x + normal.x * shoulderHalfWidth * side);
    shoulderPositions.setZ(index, point.z + normal.z * shoulderHalfWidth * side);
  }
  shoulderPositions.needsUpdate = true;
  shoulderGeometry.computeVertexNormals();
  const group = new THREE.Group();
  const shoulder = new THREE.Mesh(shoulderGeometry, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9, metalness: 0.03, side: THREE.DoubleSide }));
  group.add(shoulder, new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftMark), new THREE.LineBasicMaterial({ color: 0xffffff })));
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightMark), new THREE.LineBasicMaterial({ color: 0xffffff })));
  const center = new THREE.Line(new THREE.BufferGeometry().setFromPoints(centerMark), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.42, gapSize: 0.32 }));
  center.computeLineDistances();
  group.add(center);
  return group;
}
