import * as THREE from 'three';

export const REFINERY_IBL_PROFILE = {
  id: 'furnace-amber+service-cyan',
  intensity: 0.68,
  blur: 0.06,
  size: 64,
} as const;

type LightPanelSpec = {
  color: readonly [number, number, number];
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  size: readonly [number, number];
};

const REFINERY_IBL_PANELS: readonly LightPanelSpec[] = [
  { color: [4.2, 1.72, 0.56], position: [0, 4.8, -3.7], rotation: [Math.PI / 2, 0, 0], size: [7.8, 3.2] },
  { color: [2.5, 0.74, 0.24], position: [-1.5, 1.1, -5.2], rotation: [0, 0, 0], size: [4.8, 3.0] },
  { color: [0.3, 1.65, 2.15], position: [5.0, 1.4, 0.4], rotation: [0, -Math.PI / 2, 0], size: [3.0, 5.0] },
  { color: [0.72, 0.82, 0.86], position: [-5.0, 0.8, 1.1], rotation: [0, Math.PI / 2, 0], size: [2.6, 5.8] },
  { color: [1.25, 0.62, 0.28], position: [1.2, -3.6, 1.8], rotation: [-Math.PI / 2, 0, 0], size: [5.4, 4.0] },
];

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
