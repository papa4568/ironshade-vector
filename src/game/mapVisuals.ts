import * as THREE from 'three';
import type { Contract, LocationId } from './campaign';
import { getMapNavigationPlan } from './mapNavigation';
import type { SimState, Vec2 } from './sim';

type PaletteLike = { accent: number; secondary: number; background: number };
const MAP_KEY = '__ironshadeMapOverhaul';
const WORLD_W = 2320;
const WORLD_H = 1040;

function standard(color: number, metalness = 0.84, roughness = 0.34, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
}

function basic(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}

function addBox(root: THREE.Object3D, x: number, z: number, w: number, d: number, h: number, material: THREE.Material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  root.add(mesh);
  return mesh;
}

function routeSegment(root: THREE.Object3D, a: Vec2, b: Vec2, scaleX: number, scaleZ: number, width: number, material: THREE.Material, y = 0.018) {
  const ax = a.x * scaleX;
  const az = a.y * scaleZ;
  const bx = b.x * scaleX;
  const bz = b.y * scaleZ;
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(length, 0.028, width), material);
  ribbon.position.set((ax + bx) / 2, y, (az + bz) / 2);
  ribbon.rotation.y = -Math.atan2(dz, dx);
  ribbon.receiveShadow = true;
  root.add(ribbon);
  return { ribbon, length, ax, az, bx, bz };
}

function addRouteLights(root: THREE.Object3D, segment: ReturnType<typeof routeSegment>, color: number, step = 1.65) {
  const count = Math.max(1, Math.floor(segment.length / step));
  const lightMaterial = basic(color, 0.9);
  for (let index = 0; index <= count; index += 1) {
    const t = index / Math.max(1, count);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.075), lightMaterial);
    marker.position.set(
      segment.ax + (segment.bx - segment.ax) * t,
      0.055,
      segment.az + (segment.bz - segment.az) * t,
    );
    marker.rotation.y = segment.ribbon.rotation.y;
    marker.name = 'map-route-light';
    root.add(marker);
  }
}

function signTexture(label: string, color: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#101719';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fillStyle = '#e0ece8';
  ctx.font = '700 42px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addZoneSigns(root: THREE.Group, mission: Contract, worldW: number, worldH: number, palette: PaletteLike) {
  const plan = getMapNavigationPlan(mission.location);
  const scaleX = worldW / WORLD_W;
  const scaleZ = worldH / WORLD_H;
  const frameMaterial = standard(0x303b3d, 0.92, 0.3);
  for (const landmark of plan.landmarks) {
    const group = new THREE.Group();
    const x = landmark.x * scaleX;
    const z = landmark.y * scaleZ;
    group.position.set(x, 0, z);
    group.rotation.y = -Math.PI / 4;
    root.add(group);
    addBox(group, 0, 0, 0.14, 0.14, 3.8, frameMaterial);
    addBox(group, 2.65, 0, 0.14, 0.14, 3.8, frameMaterial);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.14), frameMaterial);
    beam.position.set(1.32, 3.7, 0);
    group.add(beam);
    const texture = signTexture(landmark.label, palette.accent);
    if (texture) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.62), new THREE.MeshBasicMaterial({ map: texture, transparent: false, side: THREE.DoubleSide, fog: false }));
      sign.position.set(1.32, 3.15, 0);
      sign.name = 'map-zone-sign';
      group.add(sign);
    }
  }
}

function addWayfindingDeck(root: THREE.Group, mission: Contract, worldW: number, worldH: number, palette: PaletteLike) {
  const plan = getMapNavigationPlan(mission.location);
  const scaleX = worldW / WORLD_W;
  const scaleZ = worldH / WORLD_H;
  const deckMaterial = standard(0x20292a, 0.94, 0.48);
  const primaryMaterial = standard(0x263532, 0.9, 0.34, palette.accent, 0.09);
  const secondaryMaterial = standard(0x242c2d, 0.9, 0.4, palette.secondary, 0.045);
  const connectorMaterial = standard(0x1d2526, 0.92, 0.44);

  for (const route of plan.routes) {
    for (let index = 0; index < route.points.length - 1; index += 1) {
      const a = route.points[index];
      const b = route.points[index + 1];
      const width = route.kind === 'primary' ? 2.15 : route.kind === 'secondary' ? 1.42 : 1.05;
      const base = routeSegment(root, a, b, scaleX, scaleZ, width + 0.22, deckMaterial, 0.012);
      const material = route.kind === 'primary' ? primaryMaterial : route.kind === 'secondary' ? secondaryMaterial : connectorMaterial;
      routeSegment(root, a, b, scaleX, scaleZ, width, material, 0.032);
      if (route.kind === 'primary') {
        const stripe = routeSegment(root, a, b, scaleX, scaleZ, 0.11, basic(palette.accent, 0.85), 0.054);
        addRouteLights(root, stripe, palette.accent, 1.35);
      } else if (route.kind === 'secondary' && index % 2 === 0) {
        addRouteLights(root, base, palette.secondary, 2.4);
      }
    }
  }
}

function addPerimeterDetail(root: THREE.Group, worldW: number, worldH: number, palette: PaletteLike) {
  const structural = standard(0x303a3c, 0.92, 0.34);
  const accent = standard(palette.accent, 0.58, 0.25, palette.accent, 0.26);
  const dark = standard(0x161c1e, 0.95, 0.42);
  for (let index = 0; index < 14; index += 1) {
    const x = 1.5 + index * ((worldW - 3) / 13);
    const top = index % 2 === 0;
    const z = top ? 0.75 : worldH - 0.75;
    const height = 2.1 + (index % 4) * 0.45;
    addBox(root, x, z, 0.55, 0.55, height, structural);
    const lamp = addBox(root, x, z + (top ? 0.42 : -0.42), 0.32, 0.12, 0.09, accent, false);
    lamp.position.y = height - 0.34;
    const cabinet = addBox(root, x + (index % 3 - 1) * 0.32, z + (top ? 0.7 : -0.7), 0.72, 0.34, 0.9, dark);
    cabinet.rotation.y = (index % 2 ? 1 : -1) * 0.08;
  }
}

function locationSafeDetails(root: THREE.Group, location: LocationId, worldW: number, worldH: number, palette: PaletteLike) {
  const structural = standard(palette.secondary, 0.88, 0.32);
  const accent = standard(palette.accent, 0.62, 0.24, palette.accent, 0.22);
  const dark = standard(0x171d20, 0.95, 0.43);
  const cx = worldW / 2;
  const cz = worldH / 2;

  if (location === 'asteroid-refinery') {
    for (const z of [1.8, worldH - 1.8]) for (const x of [8, 18, 29, 39]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 8), indexMaterial(x, accent, structural));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(x, 2.4, z);
      root.add(pipe);
    }
  } else if (location === 'spin-habitat') {
    for (const x of [9, 18, 28, 38]) {
      const planter = addBox(root, x, x % 2 ? 2.0 : worldH - 2.0, 2.2, 0.9, 0.48, dark);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 6), basic(0x355848, 0.86));
      canopy.position.set(planter.position.x, 1.15, planter.position.z);
      root.add(canopy);
    }
  } else if (location === 'jovian-harvester') {
    for (const x of [7, 16, 25, 34, 43]) {
      const mast = addBox(root, x, x % 2 ? 1.7 : worldH - 1.7, 0.34, 0.34, 5.1, structural);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 6, 20), accent);
      crown.rotation.x = Math.PI / 2;
      crown.position.set(mast.position.x, 4.4, mast.position.z);
      root.add(crown);
    }
  } else if (location === 'ice-mine') {
    for (let index = 0; index < 18; index += 1) {
      const x = 3 + index * ((worldW - 6) / 17);
      const z = index % 2 === 0 ? 1.15 : worldH - 1.15;
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.24 + (index % 3) * 0.08, 1.1 + (index % 4) * 0.28, 6), index % 4 === 0 ? accent : structural);
      crystal.position.set(x, 0.55, z);
      crystal.rotation.z = (index % 3 - 1) * 0.16;
      root.add(crystal);
    }
  } else if (location === 'solar-yard') {
    for (const x of [6, 14, 22, 30, 38]) {
      const z = x % 2 ? 1.5 : worldH - 1.5;
      const truss = addBox(root, x, z, 3.4, 0.25, 0.28, structural);
      truss.position.y = 3.4;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.35), accent);
      panel.position.set(x, 4.05, z);
      panel.rotation.z = -0.16;
      root.add(panel);
    }
  } else if (location === 'momentum-exchange') {
    for (const x of [8, 19, 30, 41]) {
      const z = x % 2 ? 1.7 : worldH - 1.7;
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.2, 8, 32), structural);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 2.3, z);
      root.add(wheel);
      addBox(root, x, z, 2.8, 0.42, 0.32, dark);
    }
  } else if (location === 'cryo-reserve') {
    for (const x of [6, 12, 18, 28, 34, 40]) {
      const z = x % 2 ? 1.55 : worldH - 1.55;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 12), structural);
      tank.position.set(x, 1.3, z);
      root.add(tank);
      const cap = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 6, 18), accent);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(x, 2.2, z);
      root.add(cap);
    }
  } else if (location === 'lattice-annex') {
    for (const x of [6, 13, 20, 27, 34, 41]) {
      const z = x % 2 ? 1.5 : worldH - 1.5;
      const frame = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 + (x % 3) * 0.08, 0), x % 2 ? accent : structural);
      frame.position.set(x, 2.1, z);
      frame.rotation.y = x * 0.08;
      root.add(frame);
    }
  } else if (location === 'damaged-vessel') {
    for (const x of [7, 15, 24, 34, 42]) {
      const z = x % 2 ? 1.45 : worldH - 1.45;
      const torn = addBox(root, x, z, 2.7, 0.2, 0.24, structural);
      torn.position.y = 3.0 + (x % 3) * 0.45;
      torn.rotation.z = (x % 2 ? 1 : -1) * 0.22;
    }
  } else {
    for (const x of [7, 15, 23, 31, 39]) {
      const z = x % 2 ? 1.5 : worldH - 1.5;
      addBox(root, x, z, 1.9, 0.75, 1.4, x % 3 === 0 ? accent : structural);
    }
  }

  for (const x of [cx - 12, cx, cx + 12]) {
    const beam = addBox(root, x, cz, 0.12, worldH - 3.2, 0.12, dark, false);
    beam.position.y = 5.1;
  }
}

function indexMaterial(index: number, a: THREE.MeshStandardMaterial, b: THREE.MeshStandardMaterial) {
  return Math.round(index) % 2 === 0 ? a : b;
}

export function buildMapVisualOverhaul(root: THREE.Group, mission: Contract, worldW: number, worldH: number, palette: PaletteLike) {
  if (root.getObjectByName(MAP_KEY)) return;
  const group = new THREE.Group();
  group.name = MAP_KEY;
  root.add(group);
  addWayfindingDeck(group, mission, worldW, worldH, palette);
  addZoneSigns(group, mission, worldW, worldH, palette);
  addPerimeterDetail(group, worldW, worldH, palette);
  locationSafeDetails(group, mission.location, worldW, worldH, palette);
}

export function syncMapVisualOverhaul(root: THREE.Group, state: SimState) {
  const group = root.getObjectByName(MAP_KEY);
  if (!group) return;
  let index = 0;
  group.traverse(child => {
    if (child.name !== 'map-route-light') return;
    const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    mesh.material.opacity = 0.45 + Math.sin(state.time * 3.8 + index * 0.55) * 0.28;
    index += 1;
  });
}
