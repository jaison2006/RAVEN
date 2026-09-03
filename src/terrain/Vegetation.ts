import * as THREE from 'three';
import { mountainHeight } from './MountainTerrain';

export function createVegetation(seed = 19, count = 90) {
  const group = new THREE.Group(); let value = seed;
  const random = () => { value = (value * 1664525 + 1013904223) % 4294967296; return value / 4294967296; };
  for (let index = 0; index < count; index++) {
    const x = (random() - 0.5) * 36; const z = (random() - 0.5) * 34; const scale = 0.28 + random() * 0.25;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(1.15, 4.2, index % 4 === 0 ? 7 : 5), new THREE.MeshStandardMaterial({ color: index % 3 ? 0x25362c : 0x38523b, roughness: 1 }));
    tree.position.set(x, mountainHeight(x, z) + 2.1, z); tree.scale.setScalar(scale); tree.castShadow = true; group.add(tree);
  }
  return group;
}
