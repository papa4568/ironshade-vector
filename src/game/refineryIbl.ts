import * as THREE from 'three';
import { REFINERY_IBL_PANELS, REFINERY_IBL_PROFILE } from './refineryLightingProfile';

export { REFINERY_IBL_PROFILE } from './refineryLightingProfile';

export function createRefineryIblTarget(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const environment = new THREE.Scene();
  environment.background = new THREE.Color(0x080604);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  for (const spec of REFINERY_IBL_PANELS) {
    const geometry = new THREE.PlaneGeometry(spec.size[0], spec.size[1]);
    const color = new THREE.Color().setRGB(spec.color[0], spec.color[1], spec.color[2]);
    const material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.set(spec.position[0], spec.position[1], spec.position[2]);
    panel.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
    environment.add(panel);
    geometries.push(geometry);
    materials.push(material);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(
    environment,
    REFINERY_IBL_PROFILE.blur,
    0.1,
    30,
    { size: REFINERY_IBL_PROFILE.size },
  );
  target.texture.name = 'refinery-ibl-pmrem';

  pmrem.dispose();
  environment.clear();
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  return target;
}
