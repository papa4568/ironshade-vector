import * as THREE from 'three';
import type { Contract } from './campaign';
import type { EquipmentFaction } from './factionGear';
import { getWorldSize, type CombatObject, type Enemy, type Player, type SimState, type WeaponId } from './sim';
import { buildHardSciFiEnvironment, decorateEnemy, decorateOperator, hardSciFiMuzzleOffset, syncEnemyVisual, syncHardSciFiBreaches, syncHardSciFiEnvironment, syncOperatorVisual } from './hardSciFiVisuals';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;

const roleColors: Record<Enemy['role'], number> = {
  assault: 0xb35a4b,
  suppressor: 0xb67850,
  technician: 0x7d6daf,
  elite: 0xc34f6e,
  boss: 0xd04c46,
};

const weaponColors: Record<WeaponId, number> = {
  carbine: 0xd9f3c6,
  breacher: 0xffddb3,
  rail: 0xb9e8ff,
};

const factionColors: Record<EquipmentFaction, number> = {
  meridian: 0x7fa697,
  heliostat: 0xe0a45c,
  longarc: 0x79a8bf,
};

type EnemyVisual = {
  root: THREE.Group;
  body: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  barRoot: THREE.Group;
  hp: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  armor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  targetRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  protocolRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
};

type ProjectileVisual = {
  root: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  trail: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
};

type RingVisual = THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
type DebrisVisual = THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;

type LocationPalette = {
  background: number;
  fog: number;
  floor: number;
  grid: number;
  accent: number;
  secondary: number;
};

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function locationPalette(location: string): LocationPalette {
  if (location === 'asteroid-refinery') return { background: 0x070604, fog: 0x0b0805, floor: 0x17130e, grid: 0x5b4831, accent: 0xc58a4f, secondary: 0x6d5540 };
  if (location === 'spin-habitat') return { background: 0x03090a, fog: 0x061113, floor: 0x0d1c1d, grid: 0x365f5d, accent: 0x6fb2ac, secondary: 0x456c69 };
  if (location === 'jovian-harvester') return { background: 0x080503, fog: 0x120b05, floor: 0x1a120c, grid: 0x69482e, accent: 0xd59a57, secondary: 0x7d5b3d };
  if (location === 'ice-mine') return { background: 0x03080c, fog: 0x06111a, floor: 0x0b1820, grid: 0x365b6b, accent: 0x7ec9df, secondary: 0x4d7888 };
  if (location === 'solar-yard') return { background: 0x090402, fog: 0x160803, floor: 0x1d1008, grid: 0x6e3b24, accent: 0xef8f46, secondary: 0x8f5434 };
  if (location === 'lattice-annex') return { background: 0x030606, fog: 0x091010, floor: 0x111818, grid: 0x3f5a58, accent: 0x88b8ad, secondary: 0x546c68 };
  if (location === 'momentum-exchange') return { background: 0x020609, fog: 0x041019, floor: 0x07161d, grid: 0x31586a, accent: 0x67b5d5, secondary: 0x3f758d };
  if (location === 'cryo-reserve') return { background: 0x020609, fog: 0x041019, floor: 0x07151c, grid: 0x31576a, accent: 0x77c6de, secondary: 0x466f83 };
  return { background: 0x030506, fog: 0x080d0f, floor: 0x101716, grid: 0x334844, accent: 0x7aa99c, secondary: 0x4d6760 };
}

function objectColor(object: CombatObject) {
  if (object.kind === 'conduit') return object.exposed ? 0x8c6538 : 0x304b46;
  if (object.kind === 'coolant') return 0x356777;
  if (object.kind === 'breachPlate') return 0x584c43;
  if (object.kind === 'doorControl') return 0x4b8476;
  if (object.kind === 'gravityControl') return 0x5f83ad;
  if (object.kind === 'sealControl') return 0x966d4e;
  if (object.kind === 'powerControl') return 0x775d91;
  if (object.kind === 'salvageNode') return 0x868454;
  if (object.kind === 'anchorNode') return 0x87507f;
  if (object.material === 'light') return 0x485650;
  if (object.material === 'industrial') return 0x394542;
  return 0x293331;
}

function panelObject(object: CombatObject) {
  return object.kind === 'doorControl' || object.kind === 'gravityControl' || object.kind === 'sealControl' || object.kind === 'powerControl' || object.kind === 'salvageNode';
}

function disposeTree(root: THREE.Object3D) {
  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(item => item.dispose());
    else if (material) material.dispose();
  });
}

export class ThreeCombatRenderer {
  static isSupported() {
    if (typeof document === 'undefined') return false;
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  }

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y);
  private readonly environmentRoot = new THREE.Group();
  private readonly objectRoot = new THREE.Group();
  private readonly dynamicRoot = new THREE.Group();
  private readonly playerRoot = new THREE.Group();
  private readonly weaponPivot = new THREE.Group();
  private readonly playerBody: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  private readonly playerHead: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly playerWeapon: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly muzzleFlash: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly pulseRing: RingVisual;
  private readonly aimLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly keyLight = new THREE.DirectionalLight(0xd8e8e1, 2.4);
  private readonly rimLight = new THREE.DirectionalLight(0x7bb0c8, 1.1);
  private readonly emergencyLight = new THREE.PointLight(0xdf7a55, 18, 18, 2);
  private readonly objectVisuals = new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>();
  private readonly sectorVisuals = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private readonly enemyVisuals = new Map<number, EnemyVisual>();
  private readonly projectilePool: ProjectileVisual[] = [];
  private readonly hazardPool: RingVisual[] = [];
  private readonly effectPool: RingVisual[] = [];
  private readonly breachPool: RingVisual[] = [];
  private readonly debrisPool: DebrisVisual[] = [];
  private readonly coarse: boolean;
  private environmentSignature = '';
  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  constructor(canvas: HTMLCanvasElement, coarse: boolean) {
    this.coarse = coarse;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.add(this.environmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);
    this.scene.add(new THREE.HemisphereLight(0xa6c7c2, 0x14110e, 1.25));

    this.keyLight.position.set(16, 28, 14);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024);
    this.keyLight.shadow.camera.left = -28;
    this.keyLight.shadow.camera.right = 28;
    this.keyLight.shadow.camera.top = 28;
    this.keyLight.shadow.camera.bottom = -28;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 70;
    this.keyLight.shadow.bias = -0.0008;
    this.scene.add(this.keyLight);

    this.rimLight.position.set(-18, 16, -10);
    this.scene.add(this.rimLight);
    this.emergencyLight.position.set(0, 3.5, 0);
    this.scene.add(this.emergencyLight);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8aa89d, metalness: 0.72, roughness: 0.34 });
    this.playerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 1.25, 10), bodyMaterial);
    this.playerBody.position.y = 0.78;
    this.playerBody.castShadow = true;
    this.playerBody.receiveShadow = true;
    this.playerRoot.add(this.playerBody);
    decorateOperator(this.playerRoot);

    this.playerHead = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), new THREE.MeshStandardMaterial({ color: 0xbcc9c4, metalness: 0.55, roughness: 0.28 }));
    this.playerHead.position.y = 1.53;
    this.playerHead.castShadow = true;
    this.playerRoot.add(this.playerHead);

    this.playerWeapon = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 0.16), new THREE.MeshStandardMaterial({ color: weaponColors.carbine, metalness: 0.8, roughness: 0.23, emissive: weaponColors.carbine, emissiveIntensity: 0.12 }));
    this.playerWeapon.position.set(0.72, 1.02, 0);
    this.playerWeapon.castShadow = true;
    this.weaponPivot.add(this.playerWeapon);
    this.playerRoot.add(this.weaponPivot);

    this.muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: weaponColors.carbine }));
    this.muzzleFlash.position.set(1.45, 1.02, 0);
    this.weaponPivot.add(this.muzzleFlash);

    this.pulseRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 48), new THREE.MeshBasicMaterial({ color: 0x8bdccd, transparent: true, opacity: 0.8, depthWrite: false }));
    this.pulseRing.rotation.x = Math.PI / 2;
    this.pulseRing.position.y = 0.05;
    this.playerRoot.add(this.pulseRing);

    const aimGeometry = new THREE.BufferGeometry();
    aimGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.aimLine = new THREE.Line(aimGeometry, new THREE.LineBasicMaterial({ color: 0xb5d6ca, transparent: true, opacity: 0.72, depthWrite: false }));
    this.playerRoot.add(this.aimLine);
  }

  render(state: SimState, width: number, height: number, quality: number, mission: Contract, mobileTargetId: number | null, operatorFaction: EquipmentFaction | null) {
    this.resize(width, height, quality);
    this.ensureEnvironment(state, mission);
    syncHardSciFiEnvironment(this.environmentRoot, state, mission);
    this.syncSectors(state);
    this.syncObjects(state);
    this.syncPlayer(state, operatorFaction);
    this.syncEnemies(state, mobileTargetId);
    this.syncProjectiles(state);
    this.syncHazards(state);
    this.syncEffects(state);
    this.syncBreaches(state);
    syncHardSciFiBreaches(this.dynamicRoot, state, WORLD_SCALE);
    this.syncDebris(state, quality);
    this.syncCamera(state, mission, width / Math.max(1, height));
    this.renderer.render(this.scene, this.camera);
  }

  screenDirection(clientX: number, clientY: number, rect: DOMRect, player: Player) {
    if (rect.width <= 0 || rect.height <= 0) return null;
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const dx = hit.x / WORLD_SCALE - player.x;
    const dy = hit.z / WORLD_SCALE - player.y;
    const length = Math.hypot(dx, dy);
    return length > 0.01 ? { x: dx / length, y: dy / length } : null;
  }

  dispose() {
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private resize(width: number, height: number, quality: number) {
    const maxRatio = this.coarse || quality < 0.8 ? 1.35 : 1.8;
    const nextRatio = Math.min(maxRatio, window.devicePixelRatio || 1);
    if (Math.abs(nextRatio - this.pixelRatio) > 0.01) {
      this.pixelRatio = nextRatio;
      this.renderer.setPixelRatio(nextRatio);
    }
    if (width !== this.width || height !== this.height) {
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.renderer.setSize(this.width, this.height, false);
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
    this.keyLight.castShadow = quality > 0.62;
  }

  private ensureEnvironment(state: SimState, mission: Contract) {
    const signature = `${mission.location}:${mission.locationName}:${state.sectors.length}:${state.objects.length}`;
    if (signature === this.environmentSignature) return;
    this.environmentSignature = signature;

    disposeTree(this.environmentRoot);
    this.environmentRoot.clear();
    disposeTree(this.objectRoot);
    this.objectRoot.clear();
    this.objectVisuals.clear();
    this.sectorVisuals.clear();

    const palette = locationPalette(mission.location);
    this.scene.background = new THREE.Color(palette.background);
    this.scene.fog = new THREE.FogExp2(palette.fog, mission.conditions.includes('low-visibility') ? 0.037 : 0.019);
    this.keyLight.color.setHex(mission.location === 'solar-yard' || mission.location === 'jovian-harvester' ? 0xffc89a : 0xd8e8e1);
    this.rimLight.color.setHex(palette.accent);
    this.emergencyLight.color.setHex(mission.location === 'ice-mine' || mission.location === 'cryo-reserve' ? 0x76cde9 : 0xdf7a55);

    const world = getWorldSize();
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(scaled(world.w), 0.35, scaled(world.h)),
      new THREE.MeshStandardMaterial({ color: palette.floor, metalness: 0.64, roughness: 0.5 }),
    );
    floor.position.set(scaled(world.w / 2), -0.2, scaled(world.h / 2));
    floor.receiveShadow = true;
    this.environmentRoot.add(floor);

    const grid = new THREE.GridHelper(scaled(world.w), 28, palette.grid, palette.grid);
    grid.position.set(scaled(world.w / 2), 0.012, scaled(world.h / 2));
    grid.scale.z = world.h / world.w;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach(material => { material.transparent = true; material.opacity = 0.22; });
    this.environmentRoot.add(grid);

    this.addPerimeter(world.w, world.h, palette);
    this.addLocationScenery(mission.location, world.w, world.h, palette);
    buildHardSciFiEnvironment(this.environmentRoot, mission, scaled(world.w), scaled(world.h), palette);

    for (const sector of state.sectors) {
      const material = new THREE.MeshBasicMaterial({ color: 0x4a8070, transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scaled(sector.w), scaled(sector.h)), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(scaled(sector.x + sector.w / 2), 0.018, scaled(sector.y + sector.h / 2));
      this.environmentRoot.add(mesh);
      this.sectorVisuals.set(sector.id, mesh);
    }
  }

  private addPerimeter(worldW: number, worldH: number, palette: LocationPalette) {
    const material = new THREE.MeshStandardMaterial({ color: palette.secondary, metalness: 0.8, roughness: 0.38 });
    const longWall = new THREE.BoxGeometry(scaled(worldW), 1.45, 0.42);
    const shortWall = new THREE.BoxGeometry(0.42, 1.45, scaled(worldH));
    const walls = [
      new THREE.Mesh(longWall, material.clone()),
      new THREE.Mesh(longWall.clone(), material.clone()),
      new THREE.Mesh(shortWall, material.clone()),
      new THREE.Mesh(shortWall.clone(), material.clone()),
    ];
    walls[0].position.set(scaled(worldW / 2), 0.66, 0);
    walls[1].position.set(scaled(worldW / 2), 0.66, scaled(worldH));
    walls[2].position.set(0, 0.66, scaled(worldH / 2));
    walls[3].position.set(scaled(worldW), 0.66, scaled(worldH / 2));
    walls.forEach(wall => { wall.castShadow = true; wall.receiveShadow = true; this.environmentRoot.add(wall); });
  }

  private addLocationScenery(location: string, worldW: number, worldH: number, palette: LocationPalette) {
    const cx = scaled(worldW / 2);
    const cz = scaled(worldH / 2);
    const structural = new THREE.MeshStandardMaterial({ color: palette.secondary, metalness: 0.82, roughness: 0.32 });
    const emissive = new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 0.24, metalness: 0.56, roughness: 0.3 });

    const addBox = (x: number, z: number, w: number, d: number, h: number, material: THREE.MeshStandardMaterial) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material.clone());
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.environmentRoot.add(mesh);
    };

    if (location === 'asteroid-refinery') {
      for (const offset of [-12, 0, 12]) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.8, 16), structural.clone());
        tank.position.set(cx + offset, 2.4, cz + (offset === 0 ? -5 : 4));
        tank.castShadow = true;
        this.environmentRoot.add(tank);
      }
      addBox(cx, cz - 9, 30, 0.45, 0.45, emissive);
    } else if (location === 'spin-habitat') {
      for (const radius of [5.5, 8.5, 11.5]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 64), emissive.clone());
        ring.rotation.x = Math.PI / 2;
        ring.position.set(cx, 2.8, cz);
        this.environmentRoot.add(ring);
      }
      addBox(cx, cz, 0.45, 20, 0.45, structural);
    } else if (location === 'jovian-harvester') {
      for (let i = -2; i <= 2; i += 1) addBox(cx + i * 7, cz + i * 1.5, 1.1, 1.1, 6 + Math.abs(i), structural);
      addBox(cx, cz - 7, 34, 0.35, 0.35, emissive);
    } else if (location === 'ice-mine') {
      for (let i = 0; i < 9; i += 1) {
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.3, 2.4 + (i % 4) * 0.8, 6), emissive.clone());
        crystal.position.set(cx - 16 + i * 4, 1.4, cz + (i % 2 ? 7 : -7));
        crystal.rotation.z = (i - 4) * 0.04;
        crystal.castShadow = true;
        this.environmentRoot.add(crystal);
      }
    } else if (location === 'solar-yard') {
      for (let i = -3; i <= 3; i += 1) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 2.2), emissive.clone());
        panel.position.set(cx + i * 5.2, 1.3 + Math.abs(i) * 0.08, cz + (i % 2 ? 6 : -6));
        panel.rotation.z = -0.16;
        panel.castShadow = true;
        this.environmentRoot.add(panel);
      }
    } else if (location === 'momentum-exchange') {
      for (const offset of [-9, 0, 9]) {
        const flywheel = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.48, 12, 48), structural.clone());
        flywheel.rotation.y = Math.PI / 2;
        flywheel.position.set(cx + offset, 3.2, cz + (offset === 0 ? -5 : 5));
        flywheel.castShadow = true;
        this.environmentRoot.add(flywheel);
      }
    } else if (location === 'cryo-reserve') {
      for (let i = -3; i <= 3; i += 1) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.2, 12), emissive.clone());
        tank.position.set(cx + i * 4.1, 2.1, cz + (i % 2 ? 6.5 : -6.5));
        tank.castShadow = true;
        this.environmentRoot.add(tank);
      }
    } else if (location === 'lattice-annex') {
      for (let i = -4; i <= 4; i += 1) addBox(cx + i * 4.5, cz + Math.sin(i) * 6, 0.9, 0.9, 3.5 + (i % 3 + 3) % 3, i % 2 ? emissive : structural);
    } else {
      for (let i = -3; i <= 3; i += 1) {
        addBox(cx + i * 6, cz + (i % 2 ? 7.5 : -7.5), 0.6, 4.2, 3.8, structural);
      }
      addBox(cx, cz, 26, 0.35, 0.35, emissive);
    }
  }

  private syncSectors(state: SimState) {
    for (const sector of state.sectors) {
      const mesh = this.sectorVisuals.get(sector.id);
      if (!mesh) continue;
      const material = mesh.material;
      if (sector.pressureState === 'decompressing') { material.color.setHex(0x963f2e); material.opacity = 0.12; }
      else if (sector.pressureState === 'vacuum') { material.color.setHex(0x566c7c); material.opacity = 0.1; }
      else if (sector.pressureState === 'leaking') { material.color.setHex(0x8b623f); material.opacity = 0.07; }
      else { material.color.setHex(0x4a8070); material.opacity = 0.025; }
    }
  }

  private syncObjects(state: SimState) {
    const activeIds = new Set<string>();
    for (const object of state.objects) {
      activeIds.add(object.id);
      let mesh = this.objectVisuals.get(object.id);
      if (!mesh) {
        const height = panelObject(object) ? 0.7 : object.kind === 'cover' ? 1.25 : 1.05;
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.15, scaled(object.w)), height, Math.max(0.15, scaled(object.h))),
          new THREE.MeshStandardMaterial({ color: objectColor(object), metalness: 0.74, roughness: 0.38 }),
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.objectRoot.add(mesh);
        this.objectVisuals.set(object.id, mesh);
      }
      mesh.visible = object.active;
      mesh.position.set(scaled(object.x + object.w / 2), mesh.geometry.parameters.height / 2, scaled(object.y + object.h / 2));
      mesh.material.color.setHex(objectColor(object));
      mesh.material.emissive.setHex(object.exposed ? 0xd69b4d : 0x000000);
      mesh.material.emissiveIntensity = object.exposed ? 0.32 : 0;
      const hpRatio = object.maxHp > 0 ? THREE.MathUtils.clamp(object.hp / object.maxHp, 0.18, 1) : 1;
      mesh.scale.y = object.destructible && object.maxHp < 9000 ? 0.72 + hpRatio * 0.28 : 1;
    }
    for (const [id, mesh] of this.objectVisuals) if (!activeIds.has(id)) mesh.visible = false;
  }

  private syncPlayer(state: SimState, operatorFaction: EquipmentFaction | null) {
    const player = state.player;
    this.playerRoot.position.set(scaled(player.x), 0, scaled(player.y));
    syncOperatorVisual(this.playerRoot, this.weaponPivot, state, operatorFaction);
    const suitColor = operatorFaction ? factionColors[operatorFaction] : 0x8aa89d;
    this.playerBody.material.color.setHex(suitColor);
    this.playerBody.material.emissive.setHex(player.disrupted > 0 ? 0x7655a0 : player.vacuumExposure > 0.55 ? 0x6b8794 : 0x000000);
    this.playerBody.material.emissiveIntensity = player.disrupted > 0 || player.vacuumExposure > 0.55 ? 0.25 : 0;

    const weaponColor = weaponColors[player.currentWeapon];
    this.playerWeapon.material.color.setHex(weaponColor);
    this.playerWeapon.material.emissive.setHex(weaponColor);
    this.playerWeapon.scale.x = player.currentWeapon === 'rail' ? 1.28 : player.currentWeapon === 'breacher' ? 0.9 : 1;
    this.weaponPivot.rotation.y = Math.atan2(-player.aim.y, player.aim.x);
    this.muzzleFlash.material.color.setHex(weaponColor);
    this.muzzleFlash.visible = state.weaponFlash > 0;
    this.muzzleFlash.position.x = hardSciFiMuzzleOffset(this.weaponPivot, 1.45);
    const flashScale = 0.7 + Math.min(1.7, state.weaponFlash * 8);
    this.muzzleFlash.scale.setScalar(flashScale);

    this.pulseRing.visible = state.pulse > 0;
    if (state.pulse > 0) {
      const radius = Math.max(0.15, (0.36 - state.pulse) / 0.36 * 5.7);
      this.pulseRing.scale.setScalar(radius);
      this.pulseRing.material.opacity = THREE.MathUtils.clamp(state.pulse / 0.36, 0, 0.85);
    }

    const positions = this.aimLine.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, 0, 1.02, 0);
    positions.setXYZ(1, player.aim.x * 3.4, 1.02, player.aim.y * 3.4);
    positions.needsUpdate = true;
    this.aimLine.material.color.setHex(weaponColor);
    this.emergencyLight.position.set(scaled(player.x), 2.4, scaled(player.y));
    this.emergencyLight.intensity = state.weaponFlash > 0 ? 32 : state.eventT > 0 ? 12 : 5;
  }

  private createEnemyVisual(enemy: Enemy) {
    const root = new THREE.Group();
    const bossScale = enemy.role === 'boss' ? 1.75 : enemy.role === 'elite' ? 1.22 : 1;
    const material = new THREE.MeshStandardMaterial({ color: roleColors[enemy.role], metalness: 0.64, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * bossScale, 0.46 * bossScale, 1.15 * bossScale, 9), material);
    body.position.y = 0.68 * bossScale;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24 * bossScale, 10, 7), new THREE.MeshStandardMaterial({ color: 0xb99080, metalness: 0.48, roughness: 0.36 }));
    head.position.y = 1.4 * bossScale;
    head.castShadow = true;
    root.add(head);
    decorateEnemy(root, enemy);

    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.7 * bossScale, 0.045, 6, 32), new THREE.MeshBasicMaterial({ color: 0xa7eed7, transparent: true, opacity: 0.82, depthWrite: false }));
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.y = 0.04;
    root.add(targetRing);

    const protocolRing = new THREE.Mesh(new THREE.TorusGeometry(0.9 * bossScale, 0.035, 6, 40), new THREE.MeshBasicMaterial({ color: enemy.combatClass === 'elite' ? 0xe3a8ba : 0xa8ccd5, transparent: true, opacity: 0.52, depthWrite: false }));
    protocolRing.rotation.x = Math.PI / 2;
    protocolRing.position.y = 0.08;
    root.add(protocolRing);

    const barRoot = new THREE.Group();
    const barWidth = enemy.role === 'boss' ? 1.8 : 1.05;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.09), new THREE.MeshBasicMaterial({ color: 0x171e1d, transparent: true, opacity: 0.9, depthTest: false }));
    bg.renderOrder = 30;
    barRoot.add(bg);
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.065), new THREE.MeshBasicMaterial({ color: 0xd48368, depthTest: false }));
    hp.position.z = 0.002;
    hp.renderOrder = 31;
    barRoot.add(hp);
    const armor = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.045), new THREE.MeshBasicMaterial({ color: 0x6fa2bd, depthTest: false }));
    armor.position.y = 0.12;
    armor.position.z = 0.003;
    armor.renderOrder = 31;
    barRoot.add(armor);

    this.dynamicRoot.add(root);
    this.scene.add(barRoot);
    const visual = { root, body, head, barRoot, hp, armor, targetRing, protocolRing };
    this.enemyVisuals.set(enemy.id, visual);
    return visual;
  }

  private syncEnemies(state: SimState, mobileTargetId: number | null) {
    const seen = new Set<number>();
    for (const enemy of state.enemies) {
      seen.add(enemy.id);
      const visual = this.enemyVisuals.get(enemy.id) ?? this.createEnemyVisual(enemy);
      visual.root.visible = enemy.active;
      visual.barRoot.visible = enemy.active && !enemy.dead;
      if (!enemy.active) continue;
      visual.root.position.set(scaled(enemy.x), 0, scaled(enemy.y));
      syncEnemyVisual(visual.root, enemy, state);
      if (enemy.dead) {
        visual.root.scale.set(1, Math.max(0.16, enemy.deathT * 0.32), 1);
        visual.body.material.opacity = 0.35;
        visual.body.material.transparent = true;
      } else {
        visual.root.scale.setScalar(1);
        visual.body.material.opacity = 1;
        visual.body.material.transparent = false;
      }
      const direction = enemy.telegraph > 0 ? enemy.telegraphAim : { x: enemy.vx, y: enemy.vy };
      if (Math.hypot(direction.x, direction.y) > 0.01) visual.root.rotation.y = Math.atan2(-direction.y, direction.x);
      visual.targetRing.visible = !enemy.dead && enemy.id === mobileTargetId;
      visual.protocolRing.visible = !enemy.dead && (enemy.combatClass === 'enhanced' || enemy.combatClass === 'elite' || enemy.protocolPulse > 0);
      visual.protocolRing.material.opacity = enemy.protocolPulse > 0 ? Math.min(0.86, 0.4 + enemy.protocolPulse * 0.42) : 0.38;
      visual.protocolRing.rotation.z = state.time * (enemy.combatClass === 'elite' ? 1.2 : 0.72);
      visual.body.material.emissive.setHex(enemy.statuses.disrupted > 0 ? 0x63508a : enemy.telegraph > 0 ? 0x7a3327 : 0x000000);
      visual.body.material.emissiveIntensity = enemy.statuses.disrupted > 0 || enemy.telegraph > 0 ? 0.34 : 0;

      const height = enemy.role === 'boss' ? 3.55 : enemy.role === 'elite' ? 2.85 : 2.35;
      visual.barRoot.position.set(scaled(enemy.x), height, scaled(enemy.y));
      visual.barRoot.quaternion.copy(this.camera.quaternion);
      const hpRatio = THREE.MathUtils.clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1);
      const armorRatio = enemy.maxArmor > 0 ? THREE.MathUtils.clamp(enemy.armor / enemy.maxArmor, 0, 1) : 0;
      const barWidth = enemy.role === 'boss' ? 1.8 : 1.05;
      visual.hp.scale.x = hpRatio;
      visual.hp.position.x = -barWidth * (1 - hpRatio) / 2;
      visual.armor.visible = enemy.maxArmor > 0 && enemy.armor > 0;
      visual.armor.scale.x = armorRatio;
      visual.armor.position.x = -barWidth * (1 - armorRatio) / 2;
    }
    for (const [id, visual] of this.enemyVisuals) if (!seen.has(id)) { visual.root.visible = false; visual.barRoot.visible = false; }
  }

  private ensureProjectile(index: number) {
    while (this.projectilePool.length <= index) {
      const root = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.15, roughness: 0.22 }));
      const trail = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
      trail.position.x = -0.32;
      root.add(core, trail);
      this.dynamicRoot.add(root);
      this.projectilePool.push({ root, core, trail });
    }
    return this.projectilePool[index];
  }

  private syncProjectiles(state: SimState) {
    let count = 0;
    for (const projectile of state.projectiles) {
      if (!projectile.active) continue;
      const visual = this.ensureProjectile(count++);
      visual.root.visible = true;
      visual.root.position.set(scaled(projectile.x), 0.72, scaled(projectile.y));
      visual.root.rotation.y = Math.atan2(-projectile.vy, projectile.vx);
      const color = projectile.owner === 'player' && projectile.weapon !== 'enemy' ? weaponColors[projectile.weapon] : 0xef8a6e;
      visual.core.material.color.setHex(color);
      visual.core.material.emissive.setHex(color);
      visual.trail.material.color.setHex(color);
      const size = Math.max(0.55, projectile.radius * 0.18);
      visual.core.scale.setScalar(size);
      visual.trail.scale.x = projectile.weapon === 'rail' ? 2.4 : projectile.weapon === 'breacher' ? 0.8 : 1.35;
    }
    for (let index = count; index < this.projectilePool.length; index += 1) this.projectilePool[index].root.visible = false;
  }

  private ensureRing(pool: RingVisual[], index: number, color: number) {
    while (pool.length <= index) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
      ring.rotation.x = Math.PI / 2;
      this.dynamicRoot.add(ring);
      pool.push(ring);
    }
    return pool[index];
  }

  private syncHazards(state: SimState) {
    let count = 0;
    for (const hazard of state.hazards) {
      if (!hazard.active) continue;
      const color = hazard.kind === 'shockGrid' ? 0x9574cd : hazard.kind === 'gravityWell' ? 0x5f99b9 : hazard.kind === 'vectorWash' ? 0x5eb7da : hazard.kind === 'boiloffJet' ? 0x99dbeb : 0x6cc6d3;
      const ring = this.ensureRing(this.hazardPool, count++, color);
      ring.visible = true;
      ring.material.color.setHex(color);
      ring.material.opacity = 0.42 + Math.sin(state.time * 7) * 0.12;
      ring.position.set(scaled(hazard.x), 0.08, scaled(hazard.y));
      ring.scale.setScalar(Math.max(0.2, scaled(hazard.radius)));
      ring.rotation.z = state.time * (hazard.kind === 'gravityWell' ? -0.8 : 0.55);
    }
    for (let index = count; index < this.hazardPool.length; index += 1) this.hazardPool[index].visible = false;
  }

  private syncEffects(state: SimState) {
    let count = 0;
    for (const effect of state.effects) {
      if (!effect.active) continue;
      const color = effect.kind === 'arc' ? 0x84caeb : effect.kind === 'breach' ? 0xf07d4d : effect.kind === 'mark' ? 0xd0e07a : 0xc2ddd3;
      const ring = this.ensureRing(this.effectPool, count++, color);
      const progress = 1 - effect.life / Math.max(0.01, effect.maxLife);
      ring.visible = true;
      ring.material.color.setHex(color);
      ring.material.opacity = Math.max(0, 0.76 * (1 - progress));
      ring.position.set(scaled(effect.x), 0.12 + progress * 0.35, scaled(effect.y));
      ring.scale.setScalar(Math.max(0.18, scaled(effect.radius) * (0.42 + progress * 0.85)));
    }
    for (let index = count; index < this.effectPool.length; index += 1) this.effectPool[index].visible = false;
  }

  private syncBreaches(state: SimState) {
    let count = 0;
    for (const breach of state.breaches) {
      if (!breach.active) continue;
      const color = breach.boss ? 0xef6f4e : 0xde9a52;
      const ring = this.ensureRing(this.breachPool, count++, color);
      ring.visible = true;
      ring.material.color.setHex(color);
      ring.material.opacity = 0.55 + Math.sin(state.time * 5.2 + count) * 0.16;
      ring.position.set(scaled(breach.x), 0.1, scaled(breach.y));
      const pulse = Math.max(0.38, scaled(breach.radius) * (1 + Math.sin(state.time * 3.4) * 0.07));
      ring.scale.setScalar(pulse);
      ring.rotation.z = state.time * 0.38;
    }
    for (let index = count; index < this.breachPool.length; index += 1) this.breachPool[index].visible = false;
  }

  private ensureDebris(index: number) {
    while (this.debrisPool.length <= index) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0x66736f, metalness: 0.72, roughness: 0.48 }));
      mesh.castShadow = true;
      this.dynamicRoot.add(mesh);
      this.debrisPool.push(mesh);
    }
    return this.debrisPool[index];
  }

  private syncDebris(state: SimState, quality: number) {
    let count = 0;
    if (quality > 0.55) {
      for (const debris of state.debris) {
        if (!debris.active) continue;
        const mesh = this.ensureDebris(count++);
        mesh.visible = true;
        mesh.position.set(scaled(debris.x), 0.28, scaled(debris.y));
        mesh.scale.setScalar(Math.max(0.45, debris.radius * 0.14));
        mesh.rotation.set(state.time * debris.vy * 0.01, state.time * debris.vx * 0.008, state.time * 0.5);
      }
    }
    for (let index = count; index < this.debrisPool.length; index += 1) this.debrisPool[index].visible = false;
  }

  private syncCamera(state: SimState, mission: Contract, aspect: number) {
    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    const narrow = aspect < 1.15;
    const cameraHeight = narrow ? 18 : this.coarse ? 14.8 : 12.8;
    const cameraOffset = narrow ? 13.2 : this.coarse ? 11.2 : 9.8;
    const shake = state.weaponFlash > 0 ? (state.player.currentWeapon === 'rail' ? 0.13 : state.player.currentWeapon === 'breacher' ? 0.08 : 0.025) : 0;
    this.camera.position.set(px + cameraOffset + Math.sin(state.time * 103) * shake, cameraHeight, pz + cameraOffset + Math.cos(state.time * 83) * shake);
    this.camera.lookAt(px + state.player.aim.x * 1.1, 0.62, pz + state.player.aim.y * 1.1);
    this.camera.updateMatrixWorld();
    this.keyLight.position.set(px + 15, 28, pz + 12);
    this.keyLight.target.position.set(px, 0, pz);
    if (!this.keyLight.target.parent) this.scene.add(this.keyLight.target);
    if (mission.location === 'solar-yard' && state.time >= 10 && state.time < 18 && !state.objects.find(object => object.id === 'solar-shutter')?.exposed) {
      this.keyLight.intensity = 3.6;
      this.renderer.toneMappingExposure = 1.18;
    } else {
      this.keyLight.intensity = 2.4;
      this.renderer.toneMappingExposure = 1.08;
    }
  }
}
