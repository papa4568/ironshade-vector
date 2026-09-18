import * as THREE from 'three';
import type { Contract } from './campaign';
import type { EquipmentFaction } from './factionGear';
import { getNextMissionObjectiveTarget } from './encounters';
import { findNavigationPath } from './mapPathfinding';
import { getWorldSize, type CombatObject, type Enemy, type Player, type SimState, type WeaponId } from './sim';
import { buildHardSciFiEnvironment, decorateEnemy, decorateOperator, hardSciFiMuzzleOffset, syncEnemyVisual, syncHardSciFiBreaches, syncHardSciFiEnvironment, syncOperatorVisual } from './hardSciFiVisuals';
import { lootColor } from './fieldLoot';
import { AdaptiveRenderBudget, type RenderBudgetSnapshot } from './renderQuality';
import { ENEMY_ASSET_FAMILIES, OPERATOR_ASSET_FAMILY, REFINERY_ASSET_FAMILIES, WEAPON_ASSET_FAMILIES } from './graphicsAssetManifest';
import { configureGraphicsAssetRenderer, instantiateGraphicsAsset, selectGraphicsAssetSpec, type GraphicsAssetInstance } from './graphicsAssets';

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

type EnemyRig = {
  hip: THREE.Object3D;
  torso: THREE.Object3D;
  helmet: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  backpack: THREE.Object3D;
  weaponSocket: THREE.Object3D;
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
  role: Enemy['role'];
  proceduralVisuals: THREE.Object3D[];
  assetInstance: GraphicsAssetInstance | null;
  authoredRoot: THREE.Group | null;
  authoredMaterials: THREE.MeshStandardMaterial[];
  authoredOwnedMaterials: THREE.Material[];
  rig: EnemyRig | null;
};

type AuthoredWeaponVisual = {
  instance: GraphicsAssetInstance;
  assetId: string;
  root: THREE.Group;
  muzzleSocket: THREE.Object3D;
  shellMaterials: THREE.MeshStandardMaterial[];
  accentMaterials: THREE.MeshStandardMaterial[];
  ownedMaterials: THREE.Material[];
};

type ProjectileVisual = {
  root: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  trail: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
};

type RingVisual = THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
type DebrisVisual = THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
type GroundLootVisual = { root: THREE.Group; core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>; ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> };

type LocationPalette = {
  background: number;
  fog: number;
  floor: number;
  grid: number;
  accent: number;
  secondary: number;
};

type EnvironmentPlacement = {
  position: THREE.Vector3;
  rotationY?: number;
  scale?: number;
};

type OperatorRig = {
  hip: THREE.Object3D;
  torso: THREE.Object3D;
  helmet: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  backpack: THREE.Object3D;
  weaponSocket: THREE.Object3D;
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
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(item => materials.add(item));
    else if (material) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
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
  private readonly authoredEnvironmentRoot = new THREE.Group();
  private readonly objectRoot = new THREE.Group();
  private readonly dynamicRoot = new THREE.Group();
  private readonly objectiveBeacon = new THREE.Group();
  private readonly objectiveGuide = new THREE.Group();
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
  private readonly authoredEnemyRoles = new Set<Enemy['role']>();
  private authoredEnemyCount = 0;
  private readonly authoredWeapons = new Map<WeaponId, AuthoredWeaponVisual>();
  private readonly authoredWeaponFailures = new Set<WeaponId>();
  private readonly proceduralRefineryVisuals: THREE.Object3D[] = [];
  private readonly refineryAssetInstances: GraphicsAssetInstance[] = [];
  private readonly refineryInstancedMeshes: THREE.InstancedMesh[] = [];
  private refineryLoadGeneration = 0;
  private readonly projectilePool: ProjectileVisual[] = [];
  private readonly hazardPool: RingVisual[] = [];
  private readonly effectPool: RingVisual[] = [];
  private readonly breachPool: RingVisual[] = [];
  private readonly debrisPool: DebrisVisual[] = [];
  private readonly groundLootPool: GroundLootVisual[] = [];
  private readonly projectileCoreGeometry = new THREE.SphereGeometry(0.11, 8, 6);
  private readonly projectileTrailGeometry = new THREE.BoxGeometry(0.62, 0.035, 0.035);
  private readonly groundLootCoreGeometry = new THREE.OctahedronGeometry(0.22, 0);
  private readonly groundLootRingGeometry = new THREE.TorusGeometry(0.48, 0.045, 6, 32);
  private readonly groundLootBeamGeometry = new THREE.CylinderGeometry(0.018, 0.055, 1.7, 6);
  private readonly effectRingGeometry = new THREE.TorusGeometry(1, 0.045, 6, 40);
  private readonly debrisGeometry = new THREE.IcosahedronGeometry(0.12, 0);
  private readonly objectiveGuideMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.28, 0.035, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.62, depthWrite: false, depthTest: false }),
    28,
  );
  private readonly objectiveGuideTransform = new THREE.Object3D();
  private readonly renderBudget: AdaptiveRenderBudget;
  private readonly coarse: boolean;
  private readonly proceduralOperatorVisuals: THREE.Object3D[] = [];
  private operatorAssetInstance: GraphicsAssetInstance | null = null;
  private authoredOperatorRoot: THREE.Group | null = null;
  private authoredOperatorMaterials: THREE.MeshStandardMaterial[] = [];
  private authoredOperatorOwnedMaterials: THREE.Material[] = [];
  private authoredOperatorRig: OperatorRig | null = null;
  private operatorHitUntil = -1;
  private lastPlayerDurability = Number.NaN;
  private disposed = false;
  private environmentSignature = '';
  private objectiveGuideTargetId = '';
  private objectiveGuideRefreshAt = -1;
  private objectiveGuidePoints: Array<{ x: number; y: number }> = [];
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private lastFrameAt = 0;

  constructor(canvas: HTMLCanvasElement, coarse: boolean) {
    this.coarse = coarse;
    this.renderBudget = new AdaptiveRenderBudget(coarse);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: false, powerPreference: 'high-performance' });
    configureGraphicsAssetRenderer(this.renderer);
    this.renderer.domElement.dataset.operatorVisual = 'procedural-loading';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.add(this.environmentRoot, this.authoredEnvironmentRoot, this.objectRoot, this.dynamicRoot, this.playerRoot);
    this.dynamicRoot.add(this.objectiveBeacon, this.objectiveGuide);
    this.objectiveGuideMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.objectiveGuideMesh.count = 0;
    this.objectiveGuideMesh.renderOrder = 38;
    this.objectiveGuide.add(this.objectiveGuideMesh);
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
    this.proceduralOperatorVisuals.push(...this.playerRoot.children);

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

    void this.loadAuthoredOperator();
    void this.loadAuthoredWeapons();
  }

  render(state: SimState, width: number, height: number, quality: number, mission: Contract, mobileTargetId: number | null, operatorFaction: EquipmentFaction | null) {
    const now = performance.now();
    const frameMs = this.lastFrameAt > 0 ? now - this.lastFrameAt : 1000 / 60;
    this.lastFrameAt = now;
    const budget = this.renderBudget.sample(frameMs, quality);
    this.resize(width, height, quality, budget);
    this.ensureEnvironment(state, mission);
    syncHardSciFiEnvironment(this.environmentRoot, state, mission);
    this.syncSectors(state);
    this.syncObjects(state);
    this.syncObjectiveBeacon(state, mission);
    this.syncPlayer(state, operatorFaction);
    this.syncEnemies(state, mobileTargetId);
    this.syncProjectiles(state);
    this.syncGroundLoot(state);
    this.syncHazards(state);
    this.syncEffects(state);
    this.syncBreaches(state);
    syncHardSciFiBreaches(this.dynamicRoot, state, WORLD_SCALE);
    this.syncDebris(state, quality * budget.detailScale);
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
    this.disposed = true;
    this.clearAuthoredRefineryEnvironment();
    if (this.authoredOperatorRig && this.weaponPivot.parent === this.authoredOperatorRig.weaponSocket) {
      this.playerRoot.add(this.weaponPivot);
    }
    this.operatorAssetInstance?.release();
    this.operatorAssetInstance = null;
    this.authoredOperatorRoot = null;
    this.authoredOperatorRig = null;
    this.authoredOperatorOwnedMaterials.forEach(material => material.dispose());
    this.authoredOperatorOwnedMaterials = [];
    this.authoredOperatorMaterials = [];
    for (const visual of this.authoredWeapons.values()) {
      visual.instance.release();
      visual.ownedMaterials.forEach(material => material.dispose());
    }
    this.authoredWeapons.clear();
    for (const visual of this.enemyVisuals.values()) {
      visual.assetInstance?.release();
      visual.assetInstance = null;
      visual.authoredRoot = null;
      visual.rig = null;
      visual.authoredOwnedMaterials.forEach(material => material.dispose());
      visual.authoredOwnedMaterials = [];
      visual.authoredMaterials = [];
    }
    disposeTree(this.scene);
    this.renderer.dispose();
  }

  private clearAuthoredRefineryEnvironment() {
    this.refineryLoadGeneration += 1;
    for (const mesh of this.refineryInstancedMeshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.refineryInstancedMeshes.length = 0;
    for (const instance of this.refineryAssetInstances) instance.release();
    this.refineryAssetInstances.length = 0;
    this.authoredEnvironmentRoot.clear();
    this.proceduralRefineryVisuals.forEach(item => { item.visible = true; });
    this.renderer.domElement.dataset.environmentVisual = 'procedural';
    delete this.renderer.domElement.dataset.environmentLod;
    delete this.renderer.domElement.dataset.environmentKit;
    delete this.renderer.domElement.dataset.environmentInstances;
    delete this.renderer.domElement.dataset.environmentTerminals;
  }

  private addInstancedEnvironmentAsset(instance: GraphicsAssetInstance, placements: EnvironmentPlacement[], label: string) {
    if (placements.length === 0) return 0;
    instance.root.updateMatrixWorld(true);
    let created = 0;
    instance.root.traverse(child => {
      const source = child as THREE.Mesh;
      if (!source.isMesh || !source.geometry || !source.material) return;
      source.updateWorldMatrix(true, false);
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, placements.length);
      mesh.name = `authored-${label}-${source.name || 'mesh'}`;
      mesh.castShadow = source.castShadow || label !== 'floor';
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      const sourceMatrix = source.matrixWorld.clone();
      const placementMatrix = new THREE.Matrix4();
      const finalMatrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      for (let index = 0; index < placements.length; index += 1) {
        const placement = placements[index];
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotationY ?? 0);
        scale.setScalar(placement.scale ?? 1);
        placementMatrix.compose(placement.position, quaternion, scale);
        finalMatrix.multiplyMatrices(placementMatrix, sourceMatrix);
        mesh.setMatrixAt(index, finalMatrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.authoredEnvironmentRoot.add(mesh);
      this.refineryInstancedMeshes.push(mesh);
      created += placements.length;
    });
    return created;
  }

  private async loadAuthoredRefineryEnvironment(state: SimState, worldW: number, worldH: number) {
    const generation = ++this.refineryLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
    const detailScale = this.coarse ? 0.5 : 0.78;
    const loaded: Array<{ key: keyof typeof REFINERY_ASSET_FAMILIES; instance: GraphicsAssetInstance; lod: number }> = [];

    try {
      for (const key of Object.keys(REFINERY_ASSET_FAMILIES) as Array<keyof typeof REFINERY_ASSET_FAMILIES>) {
        const spec = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES[key], detailScale);
        if (!spec) throw new Error(`No authored refinery asset available for ${key}`);
        const instance = await instantiateGraphicsAsset(spec);
        loaded.push({ key, instance, lod: spec.lod });
      }

      if (this.disposed || generation !== this.refineryLoadGeneration) {
        loaded.forEach(item => item.instance.release());
        return;
      }

      this.refineryAssetInstances.push(...loaded.map(item => item.instance));
      const byKey = new Map(loaded.map(item => [item.key, item]));
      const width = scaled(worldW);
      const height = scaled(worldH);
      const cx = width / 2;
      const cz = height / 2;
      const floorPlacements: EnvironmentPlacement[] = [];
      for (const fx of [0.18, 0.34, 0.50, 0.66, 0.82]) {
        for (const fz of [0.20, 0.40, 0.60, 0.80]) {
          floorPlacements.push({ position: new THREE.Vector3(width * fx, 0.005, height * fz), scale: 1.35 });
        }
      }

      const bulkheadPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.14, 0, height * 0.24) },
        { position: new THREE.Vector3(width * 0.14, 0, height * 0.50) },
        { position: new THREE.Vector3(width * 0.14, 0, height * 0.76) },
        { position: new THREE.Vector3(width * 0.86, 0, height * 0.24), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.86, 0, height * 0.50), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.86, 0, height * 0.76), rotationY: Math.PI },
      ];

      const processorPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(cx - Math.min(11, width * 0.22), 0, cz + height * 0.16), rotationY: 0.12 },
        { position: new THREE.Vector3(cx, 0, cz - height * 0.18), rotationY: -0.10 },
        { position: new THREE.Vector3(cx + Math.min(11, width * 0.22), 0, cz + height * 0.14), rotationY: Math.PI - 0.12 },
      ];

      const pipePlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.26, 0, height * 0.14) },
        { position: new THREE.Vector3(width * 0.50, 0, height * 0.14) },
        { position: new THREE.Vector3(width * 0.74, 0, height * 0.14) },
        { position: new THREE.Vector3(width * 0.50, 0, height * 0.86), rotationY: Math.PI },
      ];

      const cratePlacements: EnvironmentPlacement[] = [
        [0.22, 0.31, 0.1], [0.27, 0.69, -0.2], [0.38, 0.82, 0.12], [0.62, 0.20, -0.12],
        [0.73, 0.66, 0.2], [0.79, 0.34, -0.16], [0.32, 0.55, 0.08], [0.68, 0.48, -0.08],
      ].map(([x, z, rotationY]) => ({ position: new THREE.Vector3(width * x, 0, height * z), rotationY }));

      const terminalPlacements: EnvironmentPlacement[] = state.objects
        .filter(object => object.active && panelObject(object))
        .slice(0, 10)
        .map(object => ({
          position: new THREE.Vector3(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2)),
          rotationY: Math.PI / 4,
          scale: 0.9,
        }));

      let instances = 0;
      instances += this.addInstancedEnvironmentAsset(byKey.get('floor')!.instance, floorPlacements, 'refinery-floor');
      instances += this.addInstancedEnvironmentAsset(byKey.get('bulkhead')!.instance, bulkheadPlacements, 'refinery-bulkhead');
      instances += this.addInstancedEnvironmentAsset(byKey.get('processor')!.instance, processorPlacements, 'refinery-processor');
      instances += this.addInstancedEnvironmentAsset(byKey.get('pipeRack')!.instance, pipePlacements, 'refinery-pipe-rack');
      instances += this.addInstancedEnvironmentAsset(byKey.get('crate')!.instance, cratePlacements, 'refinery-crate');
      instances += this.addInstancedEnvironmentAsset(byKey.get('terminal')!.instance, terminalPlacements, 'refinery-terminal');

      this.proceduralRefineryVisuals.forEach(item => { item.visible = false; });
      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-refinery';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'floor,bulkhead,processor,pipe-rack,crate,terminal';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentTerminals = String(terminalPlacements.length);
    } catch (error) {
      loaded.forEach(item => item.instance.release());
      if (this.disposed || generation !== this.refineryLoadGeneration) return;
      this.refineryAssetInstances.length = 0;
      this.refineryInstancedMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.dispose();
      });
      this.refineryInstancedMeshes.length = 0;
      this.authoredEnvironmentRoot.clear();
      this.proceduralRefineryVisuals.forEach(item => { item.visible = true; });
      this.renderer.domElement.dataset.environmentVisual = 'procedural-fallback';
      console.warn('Authored Asteroid Refinery kit failed to load; keeping procedural scenery.', error);
    }
  }

  private async loadAuthoredWeapons() {
    await Promise.all((['carbine', 'breacher', 'rail'] as WeaponId[]).map(id => this.loadAuthoredWeapon(id)));
    if (this.disposed) return;
    const loaded = [...this.authoredWeapons.keys()].sort();
    this.renderer.domElement.dataset.weaponRoles = loaded.join(',');
    this.renderer.domElement.dataset.weaponVisual = loaded.length === 3 ? 'authored' : loaded.length > 0 ? 'partial' : 'procedural-fallback';
    this.renderer.domElement.dataset.weaponFallback = [...this.authoredWeaponFailures].sort().join(',');
  }

  private async loadAuthoredWeapon(id: WeaponId) {
    const spec = selectGraphicsAssetSpec(WEAPON_ASSET_FAMILIES[id], this.coarse ? 0.72 : 1);
    if (!spec) {
      this.authoredWeaponFailures.add(id);
      return;
    }

    try {
      const instance = await instantiateGraphicsAsset(spec);
      if (this.disposed) {
        instance.release();
        return;
      }

      const root = instance.root;
      const standardMaterials = new Set<THREE.MeshStandardMaterial>();
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        if (Array.isArray(mesh.material)) {
          const cloned = mesh.material.map(material => material.clone());
          mesh.material = cloned;
          cloned.forEach(material => {
            if (material instanceof THREE.MeshStandardMaterial) standardMaterials.add(material);
          });
        } else if (mesh.material) {
          const cloned = mesh.material.clone();
          mesh.material = cloned;
          if (cloned instanceof THREE.MeshStandardMaterial) standardMaterials.add(cloned);
        }
      });

      const muzzleSocket = root.getObjectByName('muzzle-socket');
      if (!muzzleSocket) {
        instance.release();
        standardMaterials.forEach(material => material.dispose());
        throw new Error(`Authored ${id} weapon is missing muzzle-socket`);
      }

      const shellMaterials = [...standardMaterials].filter(material => {
        const name = material.name.toLowerCase();
        return name.includes('weapon-shell');
      });
      const accentMaterials = [...standardMaterials].filter(material => {
        const name = material.name.toLowerCase();
        return name.includes('accent') || name.includes('emissive');
      });

      root.name = `authored-weapon-${id}`;
      root.visible = false;
      this.weaponPivot.add(root);
      this.authoredWeapons.set(id, {
        instance,
        assetId: spec.id,
        root,
        muzzleSocket,
        shellMaterials,
        accentMaterials,
        ownedMaterials: [...standardMaterials],
      });
    } catch (error) {
      if (this.disposed) return;
      this.authoredWeaponFailures.add(id);
      console.warn(`Authored ${id} weapon asset failed to load; keeping procedural fallback.`, error);
    }
  }

  private syncAuthoredWeapon(state: SimState, operatorFaction: EquipmentFaction | null) {
    const player = state.player;
    const current = this.authoredWeapons.get(player.currentWeapon) ?? null;
    for (const [id, visual] of this.authoredWeapons) {
      visual.root.visible = id === player.currentWeapon;
    }

    if (!current) {
      this.playerWeapon.visible = true;
      this.renderer.domElement.dataset.weaponActive = `procedural-${player.currentWeapon}`;
      this.renderer.domElement.dataset.weaponAsset = '';
      return;
    }

    this.playerWeapon.visible = false;
    for (const child of this.weaponPivot.children) {
      if (child.name.startsWith('hard-weapon-')) child.visible = false;
    }

    const shellColor = operatorFaction ? factionColors[operatorFaction] : 0x64716f;
    const weaponColor = weaponColors[player.currentWeapon];
    const heat = THREE.MathUtils.clamp(player.weaponHeat[player.currentWeapon] ?? 0, 0, 1);
    const reloadDuration = Math.max(0.01, state.weapons[player.currentWeapon].reloadSeconds);
    const reload = player.reloadT > 0 && player.reloadWeapon === player.currentWeapon
      ? THREE.MathUtils.clamp(player.reloadT / reloadDuration, 0, 1)
      : 0;
    const flash = THREE.MathUtils.clamp(state.weaponFlash * 8, 0, 1);
    const pulse = 0.75 + Math.sin(state.time * 11) * 0.12;

    current.shellMaterials.forEach(material => {
      material.color.setHex(shellColor);
      material.emissive.setHex(heat > 0.72 ? 0x7a2f18 : 0x000000);
      material.emissiveIntensity = heat > 0.72 ? 0.15 + heat * 0.22 : 0;
    });
    current.accentMaterials.forEach(material => {
      material.color.setHex(weaponColor);
      material.emissive.setHex(weaponColor);
      material.emissiveIntensity = 0.28 + heat * 0.9 + flash * 0.8 + reload * pulse * 0.25;
    });

    const muzzleLocal = new THREE.Vector3();
    current.muzzleSocket.getWorldPosition(muzzleLocal);
    this.weaponPivot.worldToLocal(muzzleLocal);
    this.muzzleFlash.position.copy(muzzleLocal);

    if (player.currentWeapon === 'breacher') {
      this.muzzleFlash.scale.set(1.7 + flash * 0.8, 1.18 + flash * 0.35, 1.18 + flash * 0.35);
    } else if (player.currentWeapon === 'rail') {
      this.muzzleFlash.scale.set(2.3 + flash * 1.1, 0.52 + flash * 0.2, 0.52 + flash * 0.2);
    } else {
      this.muzzleFlash.scale.set(1.25 + flash * 0.55, 0.78 + flash * 0.25, 0.78 + flash * 0.25);
    }

    this.renderer.domElement.dataset.weaponActive = player.currentWeapon;
    this.renderer.domElement.dataset.weaponAsset = current.assetId;
    this.renderer.domElement.dataset.weaponHeat = heat.toFixed(2);
    this.renderer.domElement.dataset.weaponFx = player.currentWeapon === 'rail' ? 'lance' : player.currentWeapon === 'breacher' ? 'scatter' : 'tracer';
  }

  private async loadAuthoredOperator() {
    const spec = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, this.coarse ? 0.72 : 1);
    if (!spec) {
      this.renderer.domElement.dataset.operatorVisual = 'procedural-fallback';
      return;
    }

    try {
      const instance = await instantiateGraphicsAsset(spec);
      if (this.disposed) {
        instance.release();
        return;
      }

      const root = instance.root;
      const standardMaterials = new Set<THREE.MeshStandardMaterial>();
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (Array.isArray(mesh.material)) {
          const cloned = mesh.material.map(material => material.clone());
          mesh.material = cloned;
          cloned.forEach(material => {
            if (material instanceof THREE.MeshStandardMaterial) standardMaterials.add(material);
          });
        } else if (mesh.material) {
          const cloned = mesh.material.clone();
          mesh.material = cloned;
          if (cloned instanceof THREE.MeshStandardMaterial) standardMaterials.add(cloned);
        }
      });

      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.y -= bounds.min.y;
        root.position.z -= center.z;
      }
      root.name = 'authored-operator';
      this.playerRoot.add(root);

      const rigCandidates = {
        hip: root.getObjectByName('hip'),
        torso: root.getObjectByName('torso'),
        helmet: root.getObjectByName('helmet'),
        leftArm: root.getObjectByName('arm-left'),
        rightArm: root.getObjectByName('arm-right'),
        leftLeg: root.getObjectByName('leg-left'),
        rightLeg: root.getObjectByName('leg-right'),
        backpack: root.getObjectByName('backpack'),
        weaponSocket: root.getObjectByName('weapon-socket'),
      };
      const rigReady = Object.values(rigCandidates).every(Boolean);
      if (rigReady) {
        const rig = rigCandidates as OperatorRig;
        for (const node of Object.values(rig)) {
          node.userData.operatorRestPosition = node.position.clone();
          node.userData.operatorRestRotation = node.rotation.clone();
        }
        this.authoredOperatorRig = rig;
        this.weaponPivot.removeFromParent();
        rig.weaponSocket.add(this.weaponPivot);
        this.weaponPivot.position.set(0, 0, 0);
        this.weaponPivot.rotation.set(0, 0, 0);
        this.playerWeapon.position.set(0.72, 0, 0);
        this.muzzleFlash.position.set(1.45, 0, 0);
        this.renderer.domElement.dataset.operatorRig = 'articulated';
        this.renderer.domElement.dataset.operatorSocket = 'weapon-socket';
      } else {
        this.authoredOperatorRig = null;
        this.renderer.domElement.dataset.operatorRig = 'static';
        delete this.renderer.domElement.dataset.operatorSocket;
      }

      const tintable = [...standardMaterials].filter(material => {
        const name = material.name.toLowerCase();
        return name.includes('suit') || name.includes('shell') || name.includes('primary');
      });
      this.operatorAssetInstance = instance;
      this.authoredOperatorRoot = root;
      this.authoredOperatorOwnedMaterials = [...standardMaterials];
      this.authoredOperatorMaterials = tintable.length > 0 ? tintable : [...standardMaterials];
      this.proceduralOperatorVisuals.forEach(item => { item.visible = false; });
      this.renderer.domElement.dataset.operatorVisual = `authored-${spec.lod}`;
      this.renderer.domElement.dataset.operatorAsset = spec.id;
      this.renderer.domElement.dataset.operatorAnimation = this.authoredOperatorRig ? 'idle' : 'static';
    } catch (error) {
      if (this.disposed) return;
      this.renderer.domElement.dataset.operatorVisual = 'procedural-fallback';
      console.warn('Authored operator asset failed to load; keeping procedural fallback.', error);
    }
  }

  private syncAuthoredOperatorAnimation(state: SimState) {
    const rig = this.authoredOperatorRig;
    if (!rig) return;

    const player = state.player;
    const animatedNodes = [rig.hip, rig.torso, rig.helmet, rig.leftArm, rig.rightArm, rig.leftLeg, rig.rightLeg, rig.backpack, rig.weaponSocket];
    for (const node of animatedNodes) {
      const restPosition = node.userData.operatorRestPosition as THREE.Vector3 | undefined;
      const restRotation = node.userData.operatorRestRotation as THREE.Euler | undefined;
      if (restPosition) node.position.copy(restPosition);
      if (restRotation) node.rotation.copy(restRotation);
    }

    const speed = THREE.MathUtils.clamp(Math.hypot(player.vx, player.vy) * 0.012, 0, 1);
    const gait = Math.sin(state.time * (8.5 + speed * 3)) * speed;
    const idleBreath = Math.sin(state.time * 2.4);
    const recoil = THREE.MathUtils.clamp(state.weaponFlash * 8, 0, 1);
    const reloadDuration = Math.max(0.01, state.weapons[player.reloadWeapon].reloadSeconds);
    const reload = player.reloadT > 0 ? THREE.MathUtils.clamp(player.reloadT / reloadDuration, 0, 1) : 0;
    const dodge = player.dodgeTime > 0 ? THREE.MathUtils.clamp(player.dodgeTime / 0.3, 0, 1) : 0;
    const hit = state.time < this.operatorHitUntil
      ? THREE.MathUtils.clamp((this.operatorHitUntil - state.time) / 0.18, 0, 1)
      : 0;

    rig.torso.position.y += idleBreath * 0.012;
    rig.backpack.position.y += idleBreath * 0.008;
    rig.helmet.rotation.z += idleBreath * 0.012;
    rig.leftLeg.rotation.z += gait * 0.42;
    rig.rightLeg.rotation.z -= gait * 0.42;

    // Aim-ready upper-body pose. The authored root owns yaw; limb motion is local and simulation-read-only.
    rig.leftArm.rotation.z += -0.52 - gait * 0.09;
    rig.rightArm.rotation.z += 0.42 + gait * 0.06;
    rig.leftArm.rotation.x += -0.12;
    rig.rightArm.rotation.x += 0.12;

    if (recoil > 0) {
      rig.weaponSocket.position.x -= 0.1 * recoil;
      rig.torso.rotation.z -= 0.055 * recoil;
      rig.rightArm.rotation.z += 0.1 * recoil;
    }

    if (reload > 0) {
      const cycle = Math.sin((1 - reload) * Math.PI);
      rig.weaponSocket.rotation.z += 0.5 * cycle;
      rig.weaponSocket.position.y -= 0.08 * cycle;
      rig.leftArm.rotation.z += 0.58 * cycle;
      rig.rightArm.rotation.z -= 0.22 * cycle;
    }

    if (dodge > 0) {
      rig.torso.rotation.z -= 0.28 * dodge;
      rig.hip.position.x += 0.1 * dodge;
      rig.backpack.rotation.z += 0.16 * dodge;
    }

    if (hit > 0) {
      const stagger = Math.sin((1 - hit) * Math.PI);
      rig.torso.rotation.z += 0.22 * stagger;
      rig.torso.rotation.x += 0.08 * stagger;
      rig.helmet.rotation.z -= 0.16 * stagger;
      rig.leftArm.rotation.z += 0.18 * stagger;
      rig.rightArm.rotation.z -= 0.12 * stagger;
      rig.hip.position.x -= 0.06 * stagger;
    }

    if (player.dead) {
      rig.hip.position.y -= 0.48;
      rig.torso.rotation.z = -1.02;
      rig.helmet.rotation.z = -0.34;
      rig.leftArm.rotation.z = -0.12;
      rig.rightArm.rotation.z = 0.1;
      rig.leftLeg.rotation.z = 0.2;
      rig.rightLeg.rotation.z = -0.22;
    }

    const mode = player.dead
      ? 'down'
      : player.dodgeTime > 0
        ? 'dodge'
        : hit > 0
          ? 'hit'
          : player.reloadT > 0
            ? 'reload'
            : state.weaponFlash > 0
              ? 'recoil'
              : speed > 0.08
                ? 'locomotion'
                : 'idle';
    this.renderer.domElement.dataset.operatorAnimation = mode;
    this.renderer.domElement.dataset.operatorBlend = [
      `move:${speed.toFixed(2)}`,
      `recoil:${recoil.toFixed(2)}`,
      `reload:${reload.toFixed(2)}`,
      `dodge:${dodge.toFixed(2)}`,
      `hit:${hit.toFixed(2)}`,
    ].join(',');
  }

  private resize(width: number, height: number, quality: number, budget: RenderBudgetSnapshot) {
    const qualityCap = quality < 0.55 ? 1.12 : this.coarse || quality < 0.8 ? 1.35 : 1.8;
    const maxRatio = Math.max(0.76, qualityCap * budget.pixelRatioScale);
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
    this.keyLight.castShadow = budget.shadows;
  }

  private ensureEnvironment(state: SimState, mission: Contract) {
    const signature = `${mission.location}:${mission.locationName}:${state.sectors.length}:${state.objects.length}`;
    if (signature === this.environmentSignature) return;
    this.environmentSignature = signature;

    this.clearAuthoredRefineryEnvironment();
    this.proceduralRefineryVisuals.length = 0;
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
    if (mission.location === 'asteroid-refinery') {
      void this.loadAuthoredRefineryEnvironment(state, world.w, world.h);
    } else {
      this.renderer.domElement.dataset.environmentVisual = 'procedural';
    }

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
      new THREE.Mesh(longWall, material),
      new THREE.Mesh(longWall, material),
      new THREE.Mesh(shortWall, material),
      new THREE.Mesh(shortWall, material),
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
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.environmentRoot.add(mesh);
      return mesh;
    };

    if (location === 'asteroid-refinery') {
      for (const offset of [-12, 0, 12]) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.8, 16), structural);
        tank.position.set(cx + offset, 2.4, cz + (offset === 0 ? -5 : 4));
        tank.castShadow = true;
        this.environmentRoot.add(tank);
        this.proceduralRefineryVisuals.push(tank);
      }
      this.proceduralRefineryVisuals.push(addBox(cx, cz - 9, 30, 0.45, 0.45, emissive));
    } else if (location === 'spin-habitat') {
      for (const radius of [5.5, 8.5, 11.5]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 64), emissive);
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
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.3, 2.4 + (i % 4) * 0.8, 6), emissive);
        crystal.position.set(cx - 16 + i * 4, 1.4, cz + (i % 2 ? 7 : -7));
        crystal.rotation.z = (i - 4) * 0.04;
        crystal.castShadow = true;
        this.environmentRoot.add(crystal);
      }
    } else if (location === 'solar-yard') {
      for (let i = -3; i <= 3; i += 1) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 2.2), emissive);
        panel.position.set(cx + i * 5.2, 1.3 + Math.abs(i) * 0.08, cz + (i % 2 ? 6 : -6));
        panel.rotation.z = -0.16;
        panel.castShadow = true;
        this.environmentRoot.add(panel);
      }
    } else if (location === 'momentum-exchange') {
      for (const offset of [-9, 0, 9]) {
        const flywheel = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.48, 12, 48), structural);
        flywheel.rotation.y = Math.PI / 2;
        flywheel.position.set(cx + offset, 3.2, cz + (offset === 0 ? -5 : 5));
        flywheel.castShadow = true;
        this.environmentRoot.add(flywheel);
      }
    } else if (location === 'cryo-reserve') {
      for (let i = -3; i <= 3; i += 1) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.2, 12), emissive);
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
        const collidable = object.kind === 'cover' || object.kind === 'conduit' || object.kind === 'coolant' || object.kind === 'breachPlate' || object.kind === 'anchorNode';
        if (collidable) {
          const footprintColor = object.material === 'bulkhead' ? 0xd66f4f : object.material === 'system' ? 0x68aab1 : 0xd0a65d;
          const footprint = new THREE.Mesh(
            new THREE.BoxGeometry(Math.max(0.24, scaled(object.w) + 0.28), 0.035, Math.max(0.24, scaled(object.h) + 0.28)),
            new THREE.MeshBasicMaterial({ color: footprintColor, transparent: true, opacity: 0.34, depthWrite: false }),
          );
          footprint.name = 'navigation-footprint';
          footprint.position.y = -height / 2 + 0.035;
          mesh.add(footprint);
        }
        this.objectRoot.add(mesh);
        this.objectVisuals.set(object.id, mesh);
      }
      mesh.visible = object.active;
      mesh.position.set(scaled(object.x + object.w / 2), mesh.geometry.parameters.height / 2, scaled(object.y + object.h / 2));
      mesh.material.color.setHex(objectColor(object));
      mesh.material.emissive.setHex(object.exposed ? 0xd69b4d : 0x000000);
      mesh.material.emissiveIntensity = object.exposed ? 0.32 : 0;
      const objectCenterX = object.x + object.w / 2;
      const objectCenterY = object.y + object.h / 2;
      const nearPlayer = Math.hypot(objectCenterX - state.player.x, objectCenterY - state.player.y) < 155;
      const tallOccluder = mesh.geometry.parameters.height >= 1.05 && object.kind === 'cover';
      mesh.material.transparent = nearPlayer && tallOccluder;
      mesh.material.opacity = nearPlayer && tallOccluder ? 0.48 : 1;
      const footprint = mesh.getObjectByName('navigation-footprint') as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | undefined;
      if (footprint) footprint.material.opacity = object.active ? (object.material === 'bulkhead' ? 0.48 : 0.3) : 0;
      const hpRatio = object.maxHp > 0 ? THREE.MathUtils.clamp(object.hp / object.maxHp, 0.18, 1) : 1;
      mesh.scale.y = object.destructible && object.maxHp < 9000 ? 0.72 + hpRatio * 0.28 : 1;
    }
    for (const [id, mesh] of this.objectVisuals) if (!activeIds.has(id)) mesh.visible = false;
  }

  private syncObjectiveBeacon(state: SimState, mission: Contract) {
    const target = getNextMissionObjectiveTarget(state, mission);
    if (!target) {
      this.objectiveBeacon.visible = false;
      this.objectiveGuide.visible = false;
      return;
    }

    if (this.objectiveBeacon.children.length === 0) {
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.065, 8, 48), markerMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      ring.renderOrder = 40;
      ring.name = 'objective-ring';

      const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), markerMaterial.clone());
      diamond.position.y = 1.75;
      diamond.renderOrder = 41;
      diamond.name = 'objective-diamond';

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.28, 6),
        new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.34, depthTest: false, depthWrite: false }),
      );
      beam.position.y = 1.05;
      beam.renderOrder = 39;
      beam.name = 'objective-beam';
      this.objectiveBeacon.add(ring, diamond, beam);
    }

    this.objectiveBeacon.visible = true;
    this.objectiveBeacon.position.set(scaled(target.x + target.w / 2), 0, scaled(target.y + target.h / 2));
    const pulse = 1 + Math.sin(state.time * 6.5) * 0.08;
    this.objectiveBeacon.scale.setScalar(pulse);
    const ring = this.objectiveBeacon.getObjectByName('objective-ring');
    const diamond = this.objectiveBeacon.getObjectByName('objective-diamond');
    if (ring) ring.rotation.z = state.time * 0.9;
    if (diamond) diamond.rotation.y = state.time * 1.8;
    this.syncObjectiveGuide(state, target);
  }

  private syncObjectiveGuide(state: SimState, target: CombatObject) {
    this.objectiveGuide.visible = true;
    if (this.objectiveGuideTargetId !== target.id || state.time >= this.objectiveGuideRefreshAt) {
      const result = findNavigationPath(state, target);
      this.objectiveGuideTargetId = target.id;
      this.objectiveGuideRefreshAt = state.time + 0.55;
      const markers: Array<{ x: number; y: number }> = [];
      for (let index = 0; index < result.points.length - 1; index += 1) {
        const a = result.points[index];
        const b = result.points[index + 1];
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const count = Math.max(1, Math.floor(distance / 125));
        for (let step = 1; step <= count; step += 1) {
          const t = step / (count + 1);
          markers.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
      this.objectiveGuidePoints = markers.slice(0, 28);
    }
    this.objectiveGuideMesh.count = this.objectiveGuidePoints.length;
    this.objectiveGuideMesh.material.opacity = 0.56 + Math.sin(state.time * 5.4) * 0.1;
    for (let index = 0; index < this.objectiveGuidePoints.length; index += 1) {
      const point = this.objectiveGuidePoints[index];
      const pulse = 0.82 + Math.sin(state.time * 6.5 + index * 0.7) * 0.14;
      this.objectiveGuideTransform.position.set(scaled(point.x), 0.075, scaled(point.y));
      this.objectiveGuideTransform.rotation.set(0, Math.PI / 4, 0);
      this.objectiveGuideTransform.scale.setScalar(pulse);
      this.objectiveGuideTransform.updateMatrix();
      this.objectiveGuideMesh.setMatrixAt(index, this.objectiveGuideTransform.matrix);
    }
    this.objectiveGuideMesh.instanceMatrix.needsUpdate = true;
  }

  private syncPlayer(state: SimState, operatorFaction: EquipmentFaction | null) {
    const player = state.player;
    const durability = player.hp + player.armor;
    if (Number.isFinite(this.lastPlayerDurability) && durability < this.lastPlayerDurability - 0.5 && !player.dead) {
      this.operatorHitUntil = state.time + 0.18;
    }
    this.lastPlayerDurability = durability;
    this.playerRoot.position.set(scaled(player.x), 0, scaled(player.y));
    syncOperatorVisual(this.playerRoot, this.weaponPivot, state, operatorFaction);
    const suitColor = operatorFaction ? factionColors[operatorFaction] : 0x8aa89d;
    const operatorEmissive = player.disrupted > 0 ? 0x7655a0 : player.vacuumExposure > 0.55 ? 0x6b8794 : 0x000000;
    const operatorEmissiveIntensity = player.disrupted > 0 || player.vacuumExposure > 0.55 ? 0.25 : 0;
    this.playerBody.material.color.setHex(suitColor);
    this.playerBody.material.emissive.setHex(operatorEmissive);
    this.playerBody.material.emissiveIntensity = operatorEmissiveIntensity;
    if (this.authoredOperatorRoot) {
      this.authoredOperatorRoot.rotation.y = Math.atan2(-player.aim.y, player.aim.x);
      this.syncAuthoredOperatorAnimation(state);
    }
    for (const material of this.authoredOperatorMaterials) {
      material.color.setHex(suitColor);
      material.emissive.setHex(operatorEmissive);
      material.emissiveIntensity = operatorEmissiveIntensity;
    }

    const weaponColor = weaponColors[player.currentWeapon];
    this.playerWeapon.material.color.setHex(weaponColor);
    this.playerWeapon.material.emissive.setHex(weaponColor);
    this.playerWeapon.scale.x = player.currentWeapon === 'rail' ? 1.28 : player.currentWeapon === 'breacher' ? 0.9 : 1;
    if (this.authoredOperatorRig) {
      this.weaponPivot.rotation.y = 0;
      for (const child of this.weaponPivot.children) {
        if (child.name.startsWith('hard-weapon-')) child.position.y = 0;
      }
    } else {
      this.weaponPivot.rotation.y = Math.atan2(-player.aim.y, player.aim.x);
    }
    this.muzzleFlash.material.color.setHex(weaponColor);
    this.muzzleFlash.visible = state.weaponFlash > 0;
    this.syncAuthoredWeapon(state, operatorFaction);
    if (!this.authoredWeapons.has(player.currentWeapon)) {
      this.muzzleFlash.position.x = hardSciFiMuzzleOffset(this.weaponPivot, 1.45);
      const flashScale = 0.7 + Math.min(1.7, state.weaponFlash * 8);
      this.muzzleFlash.scale.setScalar(flashScale);
    }

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
    // Phase 4 replaces weapons. Keep the current weapon detail visible while the authored body takes over.
    const proceduralVisuals = root.children.filter(child => child.name !== 'hard-enemy-weapon');

    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.7 * bossScale, 0.045, 6, 32), new THREE.MeshBasicMaterial({ color: 0xa7eed7, transparent: true, opacity: 0.82, depthWrite: false }));
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.y = 0.04;
    root.add(targetRing);

    const protocolRing = new THREE.Mesh(new THREE.TorusGeometry(0.9 * bossScale, 0.035, 6, 40), new THREE.MeshBasicMaterial({ color: enemy.combatClass === 'elite' ? 0xe3a8ba : 0xa8ccd5, transparent: true, opacity: 0.52, depthWrite: false }));
    protocolRing.rotation.x = Math.PI / 2;
    protocolRing.position.y = 0.08;
    root.add(protocolRing);

    const barRoot = new THREE.Group();
    const barWidth = enemy.role === 'boss' ? 3.0 : enemy.role === 'elite' ? 2.2 : 1.9;
    const hpBack = new THREE.Mesh(new THREE.PlaneGeometry(barWidth + 0.1, 0.24), new THREE.MeshBasicMaterial({ color: 0x050707, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false, toneMapped: false }));
    hpBack.position.y = -0.04;
    hpBack.renderOrder = 30;
    barRoot.add(hpBack);
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.2), new THREE.MeshBasicMaterial({ color: 0xff725f, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }));
    hp.position.y = -0.04;
    hp.position.z = 0.003;
    hp.renderOrder = 32;
    barRoot.add(hp);
    if (enemy.maxArmor > 0) {
      const armorBack = new THREE.Mesh(new THREE.PlaneGeometry(barWidth + 0.1, 0.15), new THREE.MeshBasicMaterial({ color: 0x050707, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false, toneMapped: false }));
      armorBack.position.y = 0.18;
      armorBack.renderOrder = 30;
      barRoot.add(armorBack);
    }
    const armor = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.12), new THREE.MeshBasicMaterial({ color: 0x8ee8ff, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }));
    armor.position.y = 0.18;
    armor.position.z = 0.004;
    armor.renderOrder = 33;
    armor.visible = enemy.maxArmor > 0;
    barRoot.add(armor);

    this.dynamicRoot.add(root);
    this.scene.add(barRoot);
    const visual: EnemyVisual = {
      root,
      body,
      head,
      barRoot,
      hp,
      armor,
      targetRing,
      protocolRing,
      role: enemy.role,
      proceduralVisuals,
      assetInstance: null,
      authoredRoot: null,
      authoredMaterials: [],
      authoredOwnedMaterials: [],
      rig: null,
    };
    this.enemyVisuals.set(enemy.id, visual);
    void this.loadAuthoredEnemy(visual, enemy);
    return visual;
  }

  private async loadAuthoredEnemy(visual: EnemyVisual, enemy: Enemy) {
    const spec = selectGraphicsAssetSpec(ENEMY_ASSET_FAMILIES[enemy.role], this.coarse ? 0.72 : 1);
    if (!spec) return;

    try {
      const instance = await instantiateGraphicsAsset(spec);
      if (this.disposed || visual.role !== enemy.role) {
        instance.release();
        return;
      }

      const root = instance.root;
      const standardMaterials = new Set<THREE.MeshStandardMaterial>();
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (Array.isArray(mesh.material)) {
          const cloned = mesh.material.map(material => material.clone());
          mesh.material = cloned;
          cloned.forEach(material => {
            if (material instanceof THREE.MeshStandardMaterial) standardMaterials.add(material);
          });
        } else if (mesh.material) {
          const cloned = mesh.material.clone();
          mesh.material = cloned;
          if (cloned instanceof THREE.MeshStandardMaterial) standardMaterials.add(cloned);
        }
      });

      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.y -= bounds.min.y;
        root.position.z -= center.z;
      }
      root.name = `authored-enemy-${enemy.role}`;
      visual.root.add(root);

      const rigCandidates = {
        hip: root.getObjectByName('hip'),
        torso: root.getObjectByName('torso'),
        helmet: root.getObjectByName('helmet'),
        leftArm: root.getObjectByName('arm-left'),
        rightArm: root.getObjectByName('arm-right'),
        leftLeg: root.getObjectByName('leg-left'),
        rightLeg: root.getObjectByName('leg-right'),
        backpack: root.getObjectByName('backpack'),
        weaponSocket: root.getObjectByName('weapon-socket'),
      };
      if (Object.values(rigCandidates).every(Boolean)) {
        const rig = rigCandidates as EnemyRig;
        for (const node of Object.values(rig)) {
          node.userData.enemyRestPosition = node.position.clone();
          node.userData.enemyRestRotation = node.rotation.clone();
        }
        visual.rig = rig;
      }

      const tintable = [...standardMaterials].filter(material => material.name.toLowerCase().includes('primary'));
      visual.assetInstance = instance;
      visual.authoredRoot = root;
      visual.authoredOwnedMaterials = [...standardMaterials];
      visual.authoredMaterials = tintable.length > 0 ? tintable : [...standardMaterials];
      visual.proceduralVisuals.forEach(item => { item.visible = false; });

      this.authoredEnemyCount += 1;
      this.authoredEnemyRoles.add(enemy.role);
      this.renderer.domElement.dataset.enemyVisual = 'authored';
      this.renderer.domElement.dataset.enemyAuthoredCount = String(this.authoredEnemyCount);
      this.renderer.domElement.dataset.enemyRoles = [...this.authoredEnemyRoles].sort().join(',');
    } catch (error) {
      if (this.disposed) return;
      const fallback = new Set((this.renderer.domElement.dataset.enemyFallbackRoles ?? '').split(',').filter(Boolean));
      fallback.add(enemy.role);
      this.renderer.domElement.dataset.enemyFallbackRoles = [...fallback].sort().join(',');
      console.warn(`Authored ${enemy.role} enemy asset failed to load; keeping procedural fallback.`, error);
    }
  }

  private syncAuthoredEnemyAnimation(visual: EnemyVisual, enemy: Enemy, state: SimState) {
    const rig = visual.rig;
    if (!rig) return;

    for (const node of [rig.hip, rig.torso, rig.helmet, rig.leftArm, rig.rightArm, rig.leftLeg, rig.rightLeg, rig.backpack, rig.weaponSocket]) {
      const restPosition = node.userData.enemyRestPosition as THREE.Vector3 | undefined;
      const restRotation = node.userData.enemyRestRotation as THREE.Euler | undefined;
      if (restPosition) node.position.copy(restPosition);
      if (restRotation) node.rotation.copy(restRotation);
    }

    const speed = THREE.MathUtils.clamp(Math.hypot(enemy.vx, enemy.vy) * 0.012, 0, 1);
    const gait = Math.sin(state.time * (7.4 + speed * 2.8) + enemy.id * 0.71) * speed;
    const idle = Math.sin(state.time * 2.1 + enemy.id * 0.37);
    const aim = THREE.MathUtils.clamp(enemy.telegraph * 1.8, 0, 1);
    const burst = enemy.burst > 0 && enemy.fireCooldown <= 0.78 ? 1 : 0;
    const hit = THREE.MathUtils.clamp(enemy.statuses.stagger * 2, 0, 1);

    rig.torso.position.y += idle * 0.01;
    rig.backpack.position.y += idle * 0.006;
    rig.helmet.rotation.z += idle * 0.01;
    rig.leftLeg.rotation.z += gait * 0.34;
    rig.rightLeg.rotation.z -= gait * 0.34;
    rig.leftArm.rotation.z += -0.20 - gait * 0.07 - aim * 0.22;
    rig.rightArm.rotation.z += 0.18 + gait * 0.05 + aim * 0.18;
    rig.weaponSocket.rotation.z -= aim * 0.08;

    if (burst > 0) {
      rig.weaponSocket.position.x -= 0.08;
      rig.torso.rotation.z -= 0.04;
      rig.rightArm.rotation.z += 0.08;
    }

    if (hit > 0) {
      const side = enemy.id % 2 === 0 ? 1 : -1;
      rig.torso.rotation.z += side * 0.18 * hit;
      rig.helmet.rotation.z -= side * 0.12 * hit;
      rig.hip.position.x -= 0.06 * hit;
    }

    if (enemy.dead) {
      const fall = THREE.MathUtils.clamp(1 - enemy.deathT, 0, 1);
      rig.hip.position.y -= 0.45 * fall;
      rig.torso.rotation.z = (enemy.id % 2 === 0 ? -1 : 1) * 1.1 * fall;
      rig.leftArm.rotation.z = -0.15;
      rig.rightArm.rotation.z = 0.12;
    }
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
      if (visual.authoredRoot) {
        this.syncAuthoredEnemyAnimation(visual, enemy, state);
        const statusEmissive = enemy.statuses.disrupted > 0 ? 0x63508a : enemy.telegraph > 0 ? 0x7a3327 : 0x000000;
        const statusIntensity = enemy.statuses.disrupted > 0 || enemy.telegraph > 0 ? 0.28 : 0;
        for (const material of visual.authoredMaterials) {
          material.color.setHex(roleColors[enemy.role]);
          material.emissive.setHex(statusEmissive);
          material.emissiveIntensity = statusIntensity;
        }
      }

      const height = enemy.role === 'boss' ? 3.55 : enemy.role === 'elite' ? 2.85 : 2.35;
      visual.barRoot.position.set(scaled(enemy.x), height, scaled(enemy.y));
      visual.barRoot.quaternion.copy(this.camera.quaternion);
      const hpRatio = THREE.MathUtils.clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1);
      const armorRatio = enemy.maxArmor > 0 ? THREE.MathUtils.clamp(enemy.armor / enemy.maxArmor, 0, 1) : 0;
      const barWidth = enemy.role === 'boss' ? 3.0 : enemy.role === 'elite' ? 2.2 : 1.9;
      visual.barRoot.scale.setScalar(enemy.id === mobileTargetId ? 1.18 : enemy.maxArmor > 0 && enemy.armor <= 0 ? 1.12 : 1);
      visual.hp.material.color.setHex(enemy.maxArmor > 0 && enemy.armor <= 0 ? 0xffa080 : 0xff725f);
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
      const core = new THREE.Mesh(this.projectileCoreGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.15, roughness: 0.22 }));
      const trail = new THREE.Mesh(this.projectileTrailGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
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
      if (projectile.weapon === 'rail') {
        visual.core.scale.setScalar(size * 0.72);
        visual.core.material.emissiveIntensity = 2.1;
        visual.trail.scale.set(3.25, 0.72, 0.72);
        visual.trail.material.opacity = 0.88;
      } else if (projectile.weapon === 'breacher') {
        visual.core.scale.set(size * 1.22, size * 0.92, size * 1.22);
        visual.core.material.emissiveIntensity = 1.45;
        visual.trail.scale.set(0.62, 1.35, 1.35);
        visual.trail.material.opacity = 0.40;
      } else {
        visual.core.scale.setScalar(size * 0.88);
        visual.core.material.emissiveIntensity = 1.65;
        visual.trail.scale.set(1.5, 0.92, 0.92);
        visual.trail.material.opacity = 0.62;
      }
    }
    for (let index = count; index < this.projectilePool.length; index += 1) this.projectilePool[index].root.visible = false;
  }

  private syncGroundLoot(state: SimState) {
    let count = 0;
    for (const drop of state.groundLoot) {
      if (!drop.active || drop.collected) continue;
      while (this.groundLootPool.length <= count) {
        const root = new THREE.Group();
        const core = new THREE.Mesh(this.groundLootCoreGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.35, roughness: 0.22 }));
        core.position.y = 0.52;
        const ring = new THREE.Mesh(this.groundLootRingGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
        const beam = new THREE.Mesh(this.groundLootBeamGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); beam.position.y = 0.9;
        root.add(core, ring, beam); this.dynamicRoot.add(root); this.groundLootPool.push({ root, core, ring, beam });
      }
      const visual = this.groundLootPool[count++]; const color = lootColor(drop.rarity); visual.root.visible = true; visual.root.position.set(scaled(drop.x), 0, scaled(drop.y)); visual.root.rotation.y = state.time * 0.8 + drop.enemyId; visual.core.material.color.setHex(color); visual.core.material.emissive.setHex(color); visual.ring.material.color.setHex(color); visual.beam.material.color.setHex(color); const pulse = 1 + Math.sin(state.time * 7 + drop.enemyId) * 0.12; visual.core.scale.setScalar(drop.rarity === 'Singular' ? 1.35 * pulse : drop.rarity === 'Prototype' ? 1.15 * pulse : pulse); visual.ring.scale.setScalar(drop.rarity === 'Singular' ? 1.4 : drop.rarity === 'Prototype' ? 1.18 : 1); visual.beam.material.opacity = drop.rarity === 'Singular' ? 0.48 : drop.rarity === 'Prototype' ? 0.34 : 0.2;
    }
    for (let index = count; index < this.groundLootPool.length; index += 1) this.groundLootPool[index].root.visible = false;
  }

  private ensureRing(pool: RingVisual[], index: number, color: number) {
    while (pool.length <= index) {
      const ring = new THREE.Mesh(this.effectRingGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }));
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
    let lastImpactLanguage = '';
    for (const effect of state.effects) {
      if (!effect.active) continue;
      let color = effect.kind === 'arc' ? 0x84caeb : effect.kind === 'breach' ? 0xf07d4d : effect.kind === 'mark' ? 0xd0e07a : 0xc2ddd3;
      let impactScale = 1;
      if (effect.kind === 'impact') {
        let nearbyEnemy: Enemy | null = null;
        let enemyDistance = 95;
        for (const enemy of state.enemies) {
          if (!enemy.active || enemy.dead) continue;
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance < enemyDistance) {
            nearbyEnemy = enemy;
            enemyDistance = distance;
          }
        }
        if (nearbyEnemy) {
          if (nearbyEnemy.armor > 0) {
            color = 0x8ee8ff;
            impactScale = 1.2;
            lastImpactLanguage = 'armor-spark';
          } else {
            color = 0xff8a68;
            impactScale = 0.95;
            lastImpactLanguage = 'hull-spall';
          }
        } else {
          let nearbyObject: CombatObject | null = null;
          let objectDistance = 110;
          for (const object of state.objects) {
            if (!object.active) continue;
            const distance = Math.hypot(object.x + object.w / 2 - effect.x, object.y + object.h / 2 - effect.y);
            if (distance < objectDistance) {
              nearbyObject = object;
              objectDistance = distance;
            }
          }
          if (nearbyObject) {
            if (nearbyObject.material === 'bulkhead') {
              color = 0xf0b164;
              impactScale = 1.15;
              lastImpactLanguage = 'metal-spark';
            } else if (nearbyObject.material === 'system') {
              color = 0x82d8df;
              impactScale = 1.1;
              lastImpactLanguage = 'electrical-flash';
            } else {
              color = 0xc9a878;
              impactScale = 0.88;
              lastImpactLanguage = 'industrial-spall';
            }
          } else {
            lastImpactLanguage = 'generic-spark';
          }
        }
      }

      const ring = this.ensureRing(this.effectPool, count++, color);
      const progress = 1 - effect.life / Math.max(0.01, effect.maxLife);
      ring.visible = true;
      ring.material.color.setHex(color);
      ring.material.opacity = Math.max(0, 0.76 * (1 - progress));
      ring.position.set(scaled(effect.x), 0.12 + progress * 0.35, scaled(effect.y));
      ring.scale.setScalar(Math.max(0.18, scaled(effect.radius) * (0.42 + progress * 0.85) * impactScale));
      if (effect.kind === 'impact') ring.rotation.z = state.time * 2.2 + progress * Math.PI;
    }
    for (let index = count; index < this.effectPool.length; index += 1) this.effectPool[index].visible = false;
    if (lastImpactLanguage) this.renderer.domElement.dataset.impactFx = lastImpactLanguage;
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
      const mesh = new THREE.Mesh(this.debrisGeometry, new THREE.MeshStandardMaterial({ color: 0x66736f, metalness: 0.72, roughness: 0.48 }));
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
