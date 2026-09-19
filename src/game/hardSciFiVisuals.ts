import * as THREE from 'three';
import type { Contract, LocationId } from './campaign';
import type { EquipmentFaction } from './factionGear';
import type { Enemy, SimState, WeaponId } from './sim';
import { buildMapVisualOverhaul, syncMapVisualOverhaul } from './mapVisuals';

type MeshStd = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type MeshBasic = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

type SuitRig = {
  shell: THREE.MeshStandardMaterial;
  secondary: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftThruster: MeshBasic;
  rightThruster: MeshBasic;
  leftBoot: MeshStd;
  rightBoot: MeshStd;
  chestLight: MeshBasic;
};

type WeaponDetail = {
  root: THREE.Group;
  muzzleX: number;
  glow: THREE.MeshStandardMaterial[];
};

type PaletteLike = {
  accent: number;
  secondary: number;
  background: number;
};

export type LocationArtIdentity = {
  silhouette: string;
  material: string;
  lighting: string;
  propSet: string;
};

export const LOCATION_ART_IDENTITIES: Record<LocationId, LocationArtIdentity> = {
  'orbital-station': { silhouette: 'radial-spine', material: 'clean-industrial', lighting: 'neutral-cyan', propSet: 'service-cases' },
  'damaged-vessel': { silhouette: 'broken-ribs', material: 'scarred-hull', lighting: 'emergency-amber', propSet: 'salvage-cases' },
  'asteroid-refinery': { silhouette: 'processor-tanks', material: 'heavy-ferrous', lighting: 'furnace-amber', propSet: 'ore-service' },
  'spin-habitat': { silhouette: 'ring-and-spokes', material: 'habitat-alloy', lighting: 'cool-green', propSet: 'habitat-service' },
  'jovian-harvester': { silhouette: 'skimmer-towers', material: 'weathered-condenser', lighting: 'storm-orange', propSet: 'compressor-service' },
  'ice-mine': { silhouette: 'bore-crystals', material: 'frosted-industrial', lighting: 'ice-cyan', propSet: 'drill-service' },
  'solar-yard': { silhouette: 'panel-clamps', material: 'heat-shielded-alloy', lighting: 'solar-orange', propSet: 'fabrication-service' },
  'lattice-annex': { silhouette: 'reference-pylons', material: 'survey-ceramic', lighting: 'metrology-teal', propSet: 'calibration-service' },
  'momentum-exchange': { silhouette: 'flywheel-lane', material: 'magnetic-machinery', lighting: 'transfer-blue', propSet: 'capture-service' },
  'cryo-reserve': { silhouette: 'tank-gallery', material: 'cryogenic-shell', lighting: 'cold-blue', propSet: 'valve-service' },
  'parallax-array': { silhouette: 'baseline-pylons', material: 'metrology-composite', lighting: 'reference-violet', propSet: 'inertial-reference' },
};

export function locationArtIdentityFor(location: LocationId) {
  return LOCATION_ART_IDENTITIES[location];
}

const SUIT_KEY = '__ironshadeHardSuit';
const WEAPON_KEY = '__ironshadeWeaponDetail';
const ENV_KEY = '__ironshadeSpaceEnvironment';
const BREACH_KEY = '__ironshadeBreachJets';

const playerFactionColor: Record<EquipmentFaction, number> = {
  meridian: 0x789789,
  heliostat: 0xc7833f,
  longarc: 0x628fa8,
};

const weaponColor: Record<WeaponId, number> = {
  carbine: 0xbfe8c7,
  breacher: 0xffc997,
  rail: 0x9edfff,
};

function std(color: number, metalness = 0.78, roughness = 0.32, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
}

function basic(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}

function mesh(root: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, x: number, y: number, z: number, shadow = true) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = shadow;
  item.receiveShadow = shadow;
  root.add(item);
  return item;
}

function seedFromString(value: string) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    seed ^= value.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function randomSource(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function roleAccent(role: Enemy['role'] | 'operator') {
  if (role === 'technician') return 0x75bfd8;
  if (role === 'suppressor') return 0xe09a58;
  if (role === 'elite' || role === 'boss') return 0xe26771;
  return 0xa2c7b7;
}

function ensureSuit(root: THREE.Group, role: Enemy['role'] | 'operator', baseColor: number, accentColor = roleAccent(role)) {
  const cached = root.userData[SUIT_KEY] as SuitRig | undefined;
  if (cached) return cached;

  const shell = std(baseColor, role === 'operator' ? 0.82 : 0.74, 0.3);
  const secondary = std(0x242c2f, 0.9, 0.34);
  const accent = std(accentColor, 0.58, 0.22, accentColor, 0.16);
  const visor = std(0x111d22, 0.42, 0.07, accentColor, 0.18);

  const torso = mesh(root, new THREE.BoxGeometry(0.45, 0.82, 0.72), shell, 0, 1.02, 0);
  torso.rotation.z = -0.015;
  mesh(root, new THREE.BoxGeometry(0.49, 0.25, 0.78), secondary, 0.08, 1.12, 0);
  mesh(root, new THREE.BoxGeometry(0.11, 0.2, 0.54), accent, 0.255, 1.16, 0, false);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.055, 6, 20), secondary);
  collar.rotation.y = Math.PI / 2;
  collar.position.set(0, 1.48, 0);
  root.add(collar);

  const helmet = mesh(root, new THREE.SphereGeometry(0.31, 14, 10), secondary, 0, 1.7, 0);
  helmet.scale.set(0.9, 0.96, 1.03);
  const visorMesh = mesh(
    root,
    new THREE.SphereGeometry(0.25, 14, 8, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.23, Math.PI * 0.54),
    visor,
    0.09,
    1.72,
    0,
    false,
  );
  visorMesh.rotation.z = Math.PI / 2;

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 0.075), basic(accentColor, 0.96));
  lamp.position.set(0.26, 1.82, -0.19);
  root.add(lamp);

  const backpack = new THREE.Group();
  backpack.position.set(-0.3, 1.08, 0);
  root.add(backpack);
  mesh(backpack, new THREE.BoxGeometry(0.32, 0.68, 0.6), secondary, 0, 0, 0);
  for (const side of [-1, 1]) {
    const tank = mesh(backpack, new THREE.CylinderGeometry(0.085, 0.085, 0.54, 8), shell, -0.06, 0.02, side * 0.22);
    tank.rotation.z = side * 0.05;
  }

  const leftThruster = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 8, 1, true), basic(0x76d9ff, 0.72));
  const rightThruster = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 8, 1, true), basic(0x76d9ff, 0.72));
  leftThruster.rotation.z = -Math.PI / 2;
  rightThruster.rotation.z = -Math.PI / 2;
  leftThruster.position.set(-0.36, -0.2, -0.2);
  rightThruster.position.set(-0.36, -0.2, 0.2);
  backpack.add(leftThruster, rightThruster);

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.position.set(0, 1.33, -0.48);
  rightArm.position.set(0, 1.33, 0.48);
  root.add(leftArm, rightArm);
  for (const [arm, side] of [[leftArm, -1], [rightArm, 1]] as const) {
    const shoulderWidth = role === 'suppressor' || role === 'boss' ? 0.39 : role === 'technician' ? 0.28 : 0.32;
    mesh(arm, new THREE.BoxGeometry(0.34, 0.24, shoulderWidth), shell, 0, -0.05, 0);
    const upper = mesh(arm, new THREE.CylinderGeometry(0.105, 0.12, 0.5, 8), secondary, 0.03, -0.35, 0);
    upper.rotation.z = -0.06;
    mesh(arm, new THREE.BoxGeometry(0.22, 0.16, 0.24), accent, 0.03, -0.63, 0);
    if (role === 'suppressor' || role === 'boss') {
      mesh(arm, new THREE.BoxGeometry(0.38, 0.2, 0.36), shell, -0.03, -0.08, side * 0.02);
    }
  }

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.position.set(0, 0.68, -0.2);
  rightLeg.position.set(0, 0.68, 0.2);
  root.add(leftLeg, rightLeg);

  let leftBoot: MeshStd | null = null;
  let rightBoot: MeshStd | null = null;
  for (const [leg, side] of [[leftLeg, -1], [rightLeg, 1]] as const) {
    mesh(leg, new THREE.BoxGeometry(0.3, 0.5, 0.25), shell, 0, -0.25, 0);
    mesh(leg, new THREE.BoxGeometry(0.26, 0.34, 0.22), secondary, 0, -0.67, 0);
    const bootMaterial = std(0x20282b, 0.91, 0.32);
    const boot = mesh(leg, new THREE.BoxGeometry(0.48, 0.2, 0.27), bootMaterial, 0.1, -0.93, 0);
    const magPad = mesh(leg, new THREE.BoxGeometry(0.28, 0.035, 0.2), accent, 0.1, -1.045, 0, false);
    magPad.material.emissiveIntensity = 0.22;
    if (side === -1) leftBoot = boot;
    else rightBoot = boot;
  }

  const chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.38), basic(accentColor, 0.94));
  chestLight.position.set(0.255, 1.23, 0);
  root.add(chestLight);

  if (role === 'technician') {
    const mast = mesh(root, new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6), secondary, -0.28, 1.66, 0.26);
    mast.rotation.z = -0.14;
    const dish = mesh(root, new THREE.ConeGeometry(0.22, 0.09, 12, 1, true), accent, -0.22, 2.03, 0.3, false);
    dish.rotation.z = Math.PI / 2;
  } else if (role === 'elite' || role === 'boss') {
    for (const side of [-1, 1]) {
      const antenna = mesh(root, new THREE.CylinderGeometry(0.02, 0.02, role === 'boss' ? 0.9 : 0.62, 6), accent, -0.22, role === 'boss' ? 1.77 : 1.68, side * 0.31);
      antenna.rotation.z = side * 0.08;
    }
  }

  const rig: SuitRig = {
    shell,
    secondary,
    accent,
    visor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftThruster,
    rightThruster,
    leftBoot: leftBoot!,
    rightBoot: rightBoot!,
    chestLight,
  };
  root.userData[SUIT_KEY] = rig;
  return rig;
}

function createWeaponDetail(id: WeaponId, color: number) {
  const root = new THREE.Group();
  root.name = `hard-weapon-${id}`;
  const dark = std(0x171f22, 0.94, 0.24);
  const casing = std(0x566466, 0.88, 0.28);
  const glow = std(color, 0.48, 0.2, color, 0.38);
  const glows = [glow];
  let muzzleX = 1.45;

  if (id === 'carbine') {
    mesh(root, new THREE.BoxGeometry(0.95, 0.2, 0.22), casing, 0.45, 0, 0);
    mesh(root, new THREE.BoxGeometry(0.42, 0.12, 0.28), dark, -0.18, -0.02, 0);
    const barrel = mesh(root, new THREE.CylinderGeometry(0.052, 0.052, 0.65, 8), dark, 1.15, 0, 0);
    barrel.rotation.z = Math.PI / 2;
    mesh(root, new THREE.BoxGeometry(0.22, 0.4, 0.18), dark, 0.35, -0.28, 0);
    mesh(root, new THREE.BoxGeometry(0.42, 0.055, 0.08), glow, 0.55, 0.14, 0, false);
    muzzleX = 1.49;
  } else if (id === 'breacher') {
    mesh(root, new THREE.BoxGeometry(0.7, 0.3, 0.42), casing, 0.28, 0, 0);
    for (const z of [-0.11, 0.11]) {
      const barrel = mesh(root, new THREE.CylinderGeometry(0.075, 0.075, 0.72, 10), dark, 0.95, 0.07, z);
      barrel.rotation.z = Math.PI / 2;
    }
    mesh(root, new THREE.BoxGeometry(0.3, 0.085, 0.38), glow, 0.25, 0.19, 0, false);
    muzzleX = 1.34;
  } else {
    mesh(root, new THREE.BoxGeometry(1.02, 0.24, 0.3), casing, 0.42, 0, 0);
    for (const z of [-0.16, 0.16]) mesh(root, new THREE.BoxGeometry(1.62, 0.075, 0.075), dark, 0.96, 0.03, z);
    for (const x of [0.25, 0.55, 0.85, 1.15]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.032, 6, 18), glow);
      coil.rotation.y = Math.PI / 2;
      coil.position.set(x, 0.04, 0);
      root.add(coil);
    }
    mesh(root, new THREE.BoxGeometry(0.44, 0.44, 0.26), dark, -0.08, -0.03, 0);
    muzzleX = 1.81;
  }

  root.traverse(child => {
    const candidate = child as THREE.Mesh;
    if (candidate.isMesh) candidate.castShadow = true;
  });
  return { root, muzzleX, glow: glows } satisfies WeaponDetail;
}

function ensureWeaponDetails(pivot: THREE.Group) {
  const cached = pivot.userData[WEAPON_KEY] as Record<WeaponId, WeaponDetail> | undefined;
  if (cached) return cached;
  const details: Record<WeaponId, WeaponDetail> = {
    carbine: createWeaponDetail('carbine', weaponColor.carbine),
    breacher: createWeaponDetail('breacher', weaponColor.breacher),
    rail: createWeaponDetail('rail', weaponColor.rail),
  };
  for (const detail of Object.values(details)) {
    detail.root.visible = false;
    detail.root.position.y = 1.02;
    pivot.add(detail.root);
  }
  pivot.userData[WEAPON_KEY] = details;
  return details;
}

function sectorAt(state: SimState, x: number, y: number) {
  return state.sectors.find(sector => x >= sector.x && x <= sector.x + sector.w && y >= sector.y && y <= sector.y + sector.h) ?? state.sectors[0];
}

export function decorateOperator(root: THREE.Group) {
  ensureSuit(root, 'operator', 0x819d93, 0x8bc8b6);
}

export function decorateEnemy(root: THREE.Group, enemy: Enemy) {
  ensureSuit(root, enemy.role, enemy.role === 'boss' ? 0x873b37 : enemy.role === 'elite' ? 0x843a4d : enemy.role === 'technician' ? 0x44556f : enemy.role === 'suppressor' ? 0x735039 : 0x71403b);
  const weapon = createWeaponDetail(enemy.role === 'technician' ? 'rail' : enemy.role === 'suppressor' || enemy.role === 'boss' ? 'breacher' : 'carbine', roleAccent(enemy.role));
  weapon.root.name = 'hard-enemy-weapon';
  weapon.root.scale.setScalar(enemy.role === 'boss' ? 1.05 : enemy.role === 'suppressor' ? 0.9 : 0.72);
  weapon.root.position.set(0.55, 1.12, 0.07);
  root.add(weapon.root);
}

export function syncOperatorVisual(root: THREE.Group, weaponPivot: THREE.Group, state: SimState, faction: EquipmentFaction | null) {
  const rig = ensureSuit(root, 'operator', faction ? playerFactionColor[faction] : 0x819d93, faction === 'heliostat' ? 0xe7a354 : faction === 'longarc' ? 0x79b7d2 : 0x8bc8b6);
  const player = state.player;
  const sector = sectorAt(state, player.x, player.y);
  const gravity = sector?.gravity ?? 1;
  const lowG = gravity < 0.72;
  const speed = Math.hypot(player.vx, player.vy);
  const stride = THREE.MathUtils.clamp(speed * 0.012, 0, 1);
  const gait = Math.sin(state.time * (8.5 + stride * 3)) * stride;
  root.position.y = lowG ? 0.08 + Math.sin(state.time * 2.6) * 0.045 : 0;

  rig.shell.color.setHex(faction ? playerFactionColor[faction] : 0x819d93);
  const accentColor = faction === 'heliostat' ? 0xe7a354 : faction === 'longarc' ? 0x79b7d2 : 0x8bc8b6;
  rig.accent.color.setHex(accentColor);
  rig.accent.emissive.setHex(accentColor);
  const damageRatio = 1 - THREE.MathUtils.clamp((player.hp + player.armor) / Math.max(1, player.maxHp + player.maxArmor), 0, 1);
  rig.shell.emissive.setHex(player.disrupted > 0 ? 0x654a89 : sector?.pressureState === 'vacuum' ? 0x214f62 : damageRatio > 0.55 ? 0x612b20 : 0x000000);
  rig.shell.emissiveIntensity = player.disrupted > 0 ? 0.28 : sector?.pressureState === 'vacuum' ? 0.11 : damageRatio > 0.55 ? 0.17 : 0;
  rig.visor.emissiveIntensity = sector?.pressureState === 'vacuum' ? 0.28 : 0.15;
  rig.chestLight.material.color.setHex(player.disrupted > 0 ? 0xb48cff : sector?.pressureState === 'vacuum' ? 0x72d5ff : damageRatio > 0.65 ? 0xff7858 : accentColor);

  rig.leftLeg.rotation.z = lowG ? gait * 0.1 : gait * 0.34;
  rig.rightLeg.rotation.z = lowG ? -gait * 0.1 : -gait * 0.34;
  rig.leftArm.rotation.z = -0.22 - gait * 0.1;
  rig.rightArm.rotation.z = 0.18 + gait * 0.06;
  const thrusters = player.dodgeTime > 0 || (lowG && speed > 12);
  rig.leftThruster.visible = thrusters;
  rig.rightThruster.visible = thrusters;
  const plume = player.dodgeTime > 0 ? 1.55 : 0.85 + Math.sin(state.time * 18) * 0.12;
  rig.leftThruster.scale.y = plume;
  rig.rightThruster.scale.y = plume;

  rig.leftBoot.material.emissive.setHex(gravity > 0.78 ? accentColor : 0x000000);
  rig.rightBoot.material.emissive.setHex(gravity > 0.78 ? accentColor : 0x000000);
  rig.leftBoot.material.emissiveIntensity = gravity > 0.78 ? 0.12 : 0;
  rig.rightBoot.material.emissiveIntensity = gravity > 0.78 ? 0.12 : 0;

  const details = ensureWeaponDetails(weaponPivot);
  for (const [id, detail] of Object.entries(details) as [WeaponId, WeaponDetail][]) {
    detail.root.visible = id === player.currentWeapon;
    detail.glow.forEach(material => {
      material.emissiveIntensity = id === player.currentWeapon && state.weaponFlash > 0 ? 0.9 : 0.38;
    });
  }
  weaponPivot.userData.hardMuzzleX = details[player.currentWeapon].muzzleX;
}

export function syncEnemyVisual(root: THREE.Group, enemy: Enemy, state: SimState) {
  const rig = ensureSuit(root, enemy.role, 0x61403c, roleAccent(enemy.role));
  const speed = Math.hypot(enemy.vx, enemy.vy);
  const sector = sectorAt(state, enemy.x, enemy.y);
  const gravity = sector?.gravity ?? 1;
  root.position.y = gravity < 0.72 ? 0.04 + Math.sin(state.time * 2.2 + enemy.id) * 0.035 : 0;
  const gait = Math.sin(state.time * 8 + enemy.id) * THREE.MathUtils.clamp(speed * 0.012, 0, 0.72);

  rig.leftLeg.rotation.z = gravity < 0.72 ? gait * 0.1 : gait * 0.28;
  rig.rightLeg.rotation.z = gravity < 0.72 ? -gait * 0.1 : -gait * 0.28;
  rig.leftArm.rotation.z = -0.12 - gait * 0.08;
  rig.rightArm.rotation.z = 0.14 + gait * 0.05;
  const usesThrusters = enemy.variant === 'vectorSkirmisher' || enemy.variant === 'parallaxSkirmisher' || enemy.variant === 'gravityDrone' || enemy.variant === 'vacuumSaboteur';
  rig.leftThruster.visible = usesThrusters && speed > 6;
  rig.rightThruster.visible = usesThrusters && speed > 6;

  rig.shell.emissive.setHex(enemy.statuses.disrupted > 0 ? 0x59447e : enemy.telegraph > 0 ? 0x63281f : enemy.armor <= 0 && enemy.maxArmor > 0 ? 0x5a211b : 0x000000);
  rig.shell.emissiveIntensity = enemy.statuses.disrupted > 0 || enemy.telegraph > 0 ? 0.3 : enemy.armor <= 0 && enemy.maxArmor > 0 ? 0.12 : 0;
  rig.chestLight.material.color.setHex(enemy.telegraph > 0 ? 0xff654e : enemy.statuses.disrupted > 0 ? 0xb18bff : roleAccent(enemy.role));

  const weapon = root.getObjectByName('hard-enemy-weapon');
  if (weapon) weapon.position.x = 0.55 - (enemy.telegraph > 0 ? Math.sin(state.time * 40 + enemy.id) * 0.04 : 0);
}

function addBox(root: THREE.Object3D, x: number, z: number, w: number, d: number, h: number, material: THREE.MeshStandardMaterial) {
  return mesh(root, new THREE.BoxGeometry(w, h, d), material, x, h / 2, z);
}

function addSpaceVista(root: THREE.Group, location: LocationId, worldW: number, worldH: number, palette: PaletteLike) {
  const random = randomSource(seedFromString(`vista:${location}:${worldW}:${worldH}`));
  const starCount = 520;
  const positions = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    positions[index * 3] = worldW / 2 + (random() - 0.5) * 145;
    positions[index * 3 + 1] = 8 + random() * 62;
    positions[index * 3 + 2] = worldH / 2 + (random() - 0.5) * 145;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xd7e2e4, size: 0.09, transparent: true, opacity: 0.88, depthWrite: false, fog: false }));
  stars.name = 'hard-stars';
  root.add(stars);

  const planetColor = location === 'jovian-harvester' ? 0xb36e3c : location === 'solar-yard' ? 0xa4472a : location === 'ice-mine' || location === 'cryo-reserve' ? 0x7898aa : 0x526875;
  const planetSize = location === 'jovian-harvester' ? 18 : location === 'solar-yard' ? 10 : 6.5;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(planetSize, 32, 20), new THREE.MeshBasicMaterial({ color: planetColor, fog: false }));
  planet.position.set(worldW / 2 - 31, 23, worldH / 2 - 45);
  planet.name = 'hard-planet';
  root.add(planet);

  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(planetSize * 1.06, 28, 18), new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: location === 'jovian-harvester' ? 0.13 : 0.07, side: THREE.BackSide, depthWrite: false, fog: false }));
  atmosphere.position.copy(planet.position);
  root.add(atmosphere);

  if (location === 'solar-yard') {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(5.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffa750, fog: false }));
    sun.position.set(worldW + 26, 30, -35);
    root.add(sun);
  }

  const dustCount = 130;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let index = 0; index < dustCount; index += 1) {
    dustPositions[index * 3] = random() * worldW;
    dustPositions[index * 3 + 1] = 0.3 + random() * 4.2;
    dustPositions[index * 3 + 2] = random() * worldH;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: palette.accent, size: 0.055, transparent: true, opacity: 0.18, depthWrite: false }));
  dust.name = 'hard-dust';
  root.add(dust);
}

function addStationArchitecture(root: THREE.Group, location: LocationId, worldW: number, worldH: number, palette: PaletteLike) {
  const structural = std(palette.secondary, 0.9, 0.31);
  const dark = std(0x171d20, 0.93, 0.38);
  const glow = std(palette.accent, 0.56, 0.25, palette.accent, 0.3);

  const ribCount = Math.max(6, Math.floor(worldW / 5.8));
  for (let index = 0; index <= ribCount; index += 1) {
    if (location === 'damaged-vessel' && index > ribCount * 0.54 && index < ribCount * 0.82) continue;
    const x = worldW * (index / ribCount);
    mesh(root, new THREE.BoxGeometry(0.16, 4.8, 0.22), dark, x, 2.4, 0.34);
    mesh(root, new THREE.BoxGeometry(0.16, 4.8, 0.22), dark, x, 2.4, worldH - 0.34);
    const beam = mesh(root, new THREE.BoxGeometry(0.18, 0.18, worldH * 0.95), structural, x, 4.75, worldH / 2, false);
    beam.receiveShadow = false;
  }

  for (const z of [1.35, worldH - 1.35]) {
    for (const y of [1.7, 2.28]) {
      const pipe = mesh(root, new THREE.CylinderGeometry(0.082, 0.082, worldW * 0.88, 8), structural, worldW / 2, y, z);
      pipe.rotation.z = Math.PI / 2;
    }
  }

  const airlock = (x: number, z: number, rotation: number) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    root.add(group);
    mesh(group, new THREE.BoxGeometry(0.65, 2.65, 2.8), structural, 0, 1.32, 0);
    mesh(group, new THREE.BoxGeometry(0.68, 1.9, 2.18), dark, 0.34, 1.22, 0);
    for (const side of [-1, 1]) mesh(group, new THREE.BoxGeometry(0.72, 0.09, 0.16), glow, 0.39, 1.22 + side * 0.68, side * 0.92, false);
  };
  airlock(0.35, worldH * 0.27, 0);
  airlock(worldW - 0.35, worldH * 0.73, Math.PI);

  const random = randomSource(seedFromString(`cargo:${location}:${worldW}`));
  for (let index = 0; index < 13; index += 1) {
    const x = 1.5 + random() * Math.max(1, worldW - 3);
    const topEdge = random() > 0.5;
    const z = topEdge ? 1.1 + random() * 1.45 : worldH - 1.1 - random() * 1.45;
    const size = 0.5 + random() * 0.55;
    const box = addBox(root, x, z, size * 1.5, size, size, index % 4 === 0 ? glow : structural);
    box.rotation.y = (random() - 0.5) * 0.24;
  }
}

function addSharedPropLibrary(root: THREE.Group, location: LocationId, worldW: number, worldH: number, palette: PaletteLike) {
  const random = randomSource(seedFromString(`shared-props:${location}:${worldW}:${worldH}`));
  const identity = locationArtIdentityFor(location);
  const caseGeometry = new THREE.BoxGeometry(0.92, 0.62, 0.72);
  const caseMaterial = std(palette.secondary, 0.76, location === 'ice-mine' || location === 'cryo-reserve' ? 0.5 : 0.38);
  const cases = new THREE.InstancedMesh(caseGeometry, caseMaterial, 12);
  cases.name = `shared-props-${location}-cases`;
  cases.castShadow = true;
  cases.receiveShadow = true;

  const postGeometry = new THREE.CylinderGeometry(0.11, 0.14, 1.5, 8);
  const postMaterial = std(palette.accent, 0.58, 0.3, palette.accent, 0.16);
  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, 8);
  posts.name = `shared-props-${location}-posts`;
  posts.castShadow = true;
  posts.receiveShadow = true;

  const transform = new THREE.Object3D();
  const materialScale = identity.material.includes('heavy') || identity.material.includes('magnetic') ? 1.18
    : identity.material.includes('frosted') || identity.material.includes('cryogenic') ? 0.9
      : 1;
  for (let index = 0; index < 12; index += 1) {
    const edge = index % 2 === 0;
    const x = 1.7 + random() * Math.max(1, worldW - 3.4);
    const z = edge ? 2 + random() * 1.3 : worldH - 2 - random() * 1.3;
    const scale = materialScale * (0.78 + random() * 0.42);
    transform.position.set(x, 0.31 * scale, z);
    transform.rotation.set(0, (random() - 0.5) * 0.7, 0);
    transform.scale.set(scale * (index % 3 === 0 ? 1.25 : 1), scale, scale);
    transform.updateMatrix();
    cases.setMatrixAt(index, transform.matrix);
  }
  for (let index = 0; index < 8; index += 1) {
    const x = worldW * (0.12 + (index / 7) * 0.76);
    const z = index % 2 === 0 ? worldH * 0.13 : worldH * 0.87;
    const heightScale = location === 'spin-habitat' || location === 'lattice-annex' ? 1.3 : location === 'damaged-vessel' ? 0.78 : 1;
    transform.position.set(x, 0.75 * heightScale, z);
    transform.rotation.set(0, index * 0.47, 0);
    transform.scale.set(1, heightScale, 1);
    transform.updateMatrix();
    posts.setMatrixAt(index, transform.matrix);
  }
  cases.instanceMatrix.needsUpdate = true;
  posts.instanceMatrix.needsUpdate = true;
  root.add(cases, posts);
  root.userData.sharedPropLibrary = identity.propSet;
  root.userData.sharedPropInstances = 20;
}

function addLocationKit(root: THREE.Group, location: LocationId, worldW: number, worldH: number, palette: PaletteLike) {
  const cx = worldW / 2;
  const cz = worldH / 2;
  const structural = std(palette.secondary, 0.88, 0.31);
  const dark = std(0x161b1d, 0.94, 0.4);
  const glow = std(palette.accent, 0.56, 0.25, palette.accent, 0.32);
  const warning = std(0xcd644c, 0.52, 0.25, 0xcd644c, 0.3);

  if (location === 'damaged-vessel') {
    for (let index = 0; index < 8; index += 1) {
      const plate = addBox(root, cx + 6 + index * 1.42, cz - 8 + (index % 3) * 3.2, 2.2, 0.22, 1.4 + (index % 2) * 0.8, structural);
      plate.rotation.z = 0.18 + index * 0.035;
      plate.rotation.y = -0.2 + (index % 4) * 0.11;
    }
    const breach = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.23, 8, 32), warning);
    breach.rotation.x = Math.PI / 2;
    breach.position.set(worldW - 2.4, 2.8, cz);
    root.add(breach);
  } else if (location === 'asteroid-refinery') {
    for (const offset of [-11, 0, 11]) {
      const z = cz + (offset === 0 ? -4.5 : 4.2);
      mesh(root, new THREE.CylinderGeometry(2.0, 2.0, 5.2, 16), structural, cx + offset, 2.6, z);
      for (const y of [1.1, 2.6, 4.1]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(2.02, 0.06, 6, 28), glow);
        band.rotation.x = Math.PI / 2;
        band.position.set(cx + offset, y, z);
        root.add(band);
      }
    }
    for (let index = 0; index < 9; index += 1) {
      const rock = mesh(root, new THREE.DodecahedronGeometry(0.7 + (index % 4) * 0.22, 0), dark, cx - 17 + index * 4, 0.9 + (index % 2) * 0.6, cz - 7 + (index % 3) * 6);
      rock.rotation.set(index * 0.2, index * 0.4, index * 0.13);
    }
  } else if (location === 'spin-habitat') {
    const orbitalRing = new THREE.Mesh(new THREE.TorusGeometry(27, 1.0, 12, 96), structural);
    orbitalRing.rotation.x = Math.PI * 0.58;
    orbitalRing.rotation.z = Math.PI * 0.18;
    orbitalRing.position.set(cx - 31, 18, cz - 34);
    root.add(orbitalRing);
  } else if (location === 'jovian-harvester') {
    for (let index = -2; index <= 2; index += 1) {
      const tower = addBox(root, cx + index * 7, cz + index * 1.5, 1.15, 1.15, 6 + Math.abs(index) * 1.2, structural);
      for (const y of [1.2, 2.7, 4.2]) mesh(root, new THREE.BoxGeometry(1.25, 0.08, 1.25), glow, tower.position.x, y, tower.position.z, false);
    }
  } else if (location === 'ice-mine') {
    for (let index = 0; index < 13; index += 1) {
      const crystal = mesh(root, new THREE.ConeGeometry(0.65 + (index % 3) * 0.25, 2.3 + (index % 4) * 0.7, 6), index % 3 === 0 ? glow : structural, cx - 20 + index * 3.4, 1.3, cz + (index % 2 ? 7 : -7));
      crystal.rotation.z = (index - 6) * 0.035;
    }
    for (const x of [cx - 10, cx + 10]) {
      const drill = mesh(root, new THREE.CylinderGeometry(0.5, 0.5, 5.5, 10), dark, x, 2.5, cz);
      drill.rotation.z = Math.PI / 2.7;
    }
  } else if (location === 'solar-yard') {
    for (let index = -4; index <= 4; index += 1) {
      const z = cz + (index % 2 ? 6.5 : -6.5);
      addBox(root, cx + index * 4.7, z, 0.25, 0.25, 2.6, structural);
      const panel = mesh(root, new THREE.BoxGeometry(4.1, 0.12, 2.3), glow, cx + index * 4.7, 2.7, z);
      panel.rotation.z = -0.19;
      panel.rotation.y = index % 2 ? 0.15 : -0.15;
    }
  } else if (location === 'momentum-exchange') {
    for (const offset of [-9, 0, 9]) {
      const flywheel = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.52, 12, 52), structural);
      flywheel.rotation.y = Math.PI / 2;
      flywheel.position.set(cx + offset, 3.25, cz + (offset === 0 ? -4.5 : 4.5));
      root.add(flywheel);
    }
  } else if (location === 'cryo-reserve') {
    for (let index = -4; index <= 4; index += 1) {
      const z = cz + (index % 2 ? 6.5 : -6.5);
      mesh(root, new THREE.CylinderGeometry(0.92, 0.92, 4.4, 12), structural, cx + index * 3.7, 2.2, z);
      const cap = mesh(root, new THREE.SphereGeometry(0.92, 12, 8), glow, cx + index * 3.7, 4.25, z, false);
      cap.scale.y = 0.45;
    }
  } else if (location === 'parallax-array') {
    for (const offset of [-12, 0, 12]) {
      const pylon = addBox(root, cx + offset, cz + (offset === 0 ? -4 : 4), 0.8, 0.8, 6.2, structural);
      for (const y of [1.4, 3.1, 4.8]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.08, 8, 28), glow);
        ring.rotation.x = Math.PI / 2; ring.position.set(pylon.position.x, y, pylon.position.z); root.add(ring);
      }
    }
    for (const z of [cz - 7, cz + 7]) {
      const rail = addBox(root, cx, z, 29, 0.18, 0.12, glow); rail.position.y = 0.24;
    }
  } else if (location === 'lattice-annex') {
    for (let index = -5; index <= 5; index += 1) {
      const z = cz + Math.sin(index * 1.2) * 6;
      addBox(root, cx + index * 3.7, z, 0.9, 0.9, 3.7 + (Math.abs(index) % 3) * 0.8, index % 2 ? glow : structural);
    }
  } else {
    for (let index = -4; index <= 4; index += 1) {
      addBox(root, cx + index * 5.1, cz + (index % 2 ? 7.2 : -7.2), 0.72, 3.8, 3.5 + (index % 3 === 0 ? 1.2 : 0), structural);
    }
  }
}

export function buildHardSciFiEnvironment(root: THREE.Group, mission: Contract, worldW: number, worldH: number, palette: PaletteLike) {
  const existing = root.getObjectByName(ENV_KEY);
  if (existing) return;
  const environment = new THREE.Group();
  environment.name = ENV_KEY;
  root.add(environment);
  addSpaceVista(environment, mission.location, worldW, worldH, palette);
  addStationArchitecture(environment, mission.location, worldW, worldH, palette);
  buildMapVisualOverhaul(environment, mission, worldW, worldH, palette);
  addSharedPropLibrary(environment, mission.location, worldW, worldH, palette);
  addLocationKit(environment, mission.location, worldW, worldH, palette);
  environment.userData.locationArtIdentity = locationArtIdentityFor(mission.location);
}

export function syncHardSciFiEnvironment(root: THREE.Group, state: SimState, mission: Contract, detailLevel = 1, transparencyScale = 1) {
  const environment = root.getObjectByName(ENV_KEY);
  if (!environment) return;
  syncMapVisualOverhaul(environment as THREE.Group, state);
  const dust = environment.getObjectByName('hard-dust') as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | undefined;
  const stars = environment.getObjectByName('hard-stars') as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | undefined;
  const sector = sectorAt(state, state.player.x, state.player.y);
  if (dust) {
    dust.visible = detailLevel > 0.55;
    dust.rotation.y = state.time * 0.012;
    dust.position.x = Math.sin(state.time * 0.18) * 0.08;
    const baseOpacity = sector?.pressureState === 'vacuum' ? 0.05 : sector?.pressureState === 'decompressing' ? 0.34 : mission.conditions.includes('low-visibility') ? 0.28 : 0.17;
    dust.material.opacity = baseOpacity * transparencyScale;
  }
  if (stars) stars.material.opacity = (sector?.pressureState === 'vacuum' ? 1 : 0.78) * Math.max(0.72, transparencyScale);
}

function ensureBreachJets(dynamicRoot: THREE.Group, state: SimState) {
  let group = dynamicRoot.getObjectByName(BREACH_KEY) as THREE.Group | undefined;
  if (!group) {
    group = new THREE.Group();
    group.name = BREACH_KEY;
    dynamicRoot.add(group);
  }

  while (group.children.length < state.breaches.length) {
    const root = new THREE.Group();
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.58, 3.5, 12, 1, true), basic(0xb7e4ee, 0.12));
    plume.position.y = 1.6;
    root.add(plume);
    const positions = new Float32Array(24 * 3);
    for (let index = 0; index < 24; index += 1) {
      const t = index / 24;
      positions[index * 3] = Math.sin(index * 2.3) * 0.42 * (0.3 + t);
      positions[index * 3 + 1] = 0.2 + t * 3.2;
      positions[index * 3 + 2] = Math.cos(index * 1.7) * 0.42 * (0.3 + t);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xd6f2f7, size: 0.075, transparent: true, opacity: 0.45, depthWrite: false }));
    root.add(particles);
    group.add(root);
  }

  return group;
}

export function syncHardSciFiBreaches(dynamicRoot: THREE.Group, state: SimState, worldScale: number, detailLevel = 1) {
  const group = ensureBreachJets(dynamicRoot, state);
  const reducedEffects = detailLevel < 0.58;
  for (let index = 0; index < group.children.length; index += 1) {
    const breach = state.breaches[index];
    const visual = group.children[index] as THREE.Group;
    visual.visible = !!breach?.active;
    if (!breach?.active) continue;
    visual.position.set(breach.x * worldScale, 0.08, breach.y * worldScale);
    visual.rotation.y = state.time * 0.12 + breach.x * 0.01;
    const plume = visual.children[0] as THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
    plume.scale.setScalar(0.58 + breach.strength * 0.07);
    plume.material.color.setHex(breach.boss ? 0xff9c7d : 0xb7e4ee);
    plume.material.opacity = reducedEffects ? 0.09 : 0.14;
    const particles = visual.children[1] as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    particles.visible = !reducedEffects;
    particles.rotation.y = state.time * (0.8 + breach.strength * 0.04);
    particles.material.opacity = 0.32 + Math.sin(state.time * 8 + index) * 0.12;
  }
}

export function hardSciFiMuzzleOffset(weaponPivot: THREE.Group, fallback: number) {
  const muzzle = weaponPivot.userData.hardMuzzleX;
  return typeof muzzle === 'number' ? muzzle : fallback;
}
