import * as THREE from 'three';

export const ROAD_SURFACE_OFFSET = 0.25;

export function mountainHeight(x: number, z: number) {
  const ridgeA = 2.5 * Math.exp(-((x + 7) ** 2 + (z - 5) ** 2) / 150);
  const ridgeB = 3.4 * Math.exp(-((x - 6) ** 2 + (z + 5) ** 2) / 190);
  return Math.max(-0.8, ridgeA + ridgeB + 0.8 * Math.sin(x * 0.28) * Math.cos(z * 0.24));
}

export function createMountainTerrain(size = 42, segments = 96) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) position.setY(index, mountainHeight(position.getX(index), position.getZ(index)));
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
