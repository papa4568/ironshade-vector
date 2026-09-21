import * as THREE from 'three';
import type { Contract } from './campaign';
import type { EquipmentFaction } from './factionGear';
import { getNextMissionObjectiveTarget } from './encounters';
import { findNavigationPath } from './mapPathfinding';
import { getWorldSize, type CombatObject, type Enemy, type Player, type SimState, type WeaponId } from './sim';
import { buildHardSciFiEnvironment, decorateEnemy, decorateOperator, hardSciFiMuzzleOffset, locationArtIdentityFor, syncEnemyVisual, syncHardSciFiBreaches, syncHardSciFiEnvironment, syncOperatorVisual } from './hardSciFiVisuals';
import { groundLootPresentation } from './fieldLoot';
import { AdaptiveRenderBudget, type RenderBudgetSnapshot } from './renderQuality';
import { DAMAGED_VESSEL_ASSET_FAMILIES, ENEMY_ASSET_FAMILIES, INTERACTABLE_ASSET_FAMILIES, OPERATOR_ASSET_FAMILY, SPIN_HABITAT_BOSS_ASSET_FAMILY, JOVIAN_HARVESTER_BOSS_ASSET_FAMILY, ICE_MINE_BOSS_ASSET_FAMILY, SOLAR_YARD_BOSS_ASSET_FAMILY, SPIN_HABITAT_ENEMY_ASSET_FAMILIES, SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES, OPERATOR_CLASS_ASSET_FAMILIES, JOVIAN_HARVESTER_ASSET_FAMILIES, JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES, ICE_MINE_ASSET_FAMILIES, SOLAR_YARD_ASSET_FAMILIES, PARALLAX_ASSET_FAMILIES, PICKUP_ASSET_FAMILY, REFINERY_ASSET_FAMILIES, SPIN_HABITAT_ASSET_FAMILIES, WEAPON_ASSET_FAMILIES } from './graphicsAssetManifest';
import { configureGraphicsAssetRenderer, instantiateGraphicsAsset, selectGraphicsAssetSpec, type GraphicsAssetInstance } from './graphicsAssets';
import { spinHabitatArchitectureState, spinHabitatRenderProfile, spinHabitatSpindownState } from './spinHabitatArchitecture';
import { jovianHarvesterRenderProfile, jovianHarvesterStormState } from './jovianHarvesterVisualLanguage';
import { solarYardRenderProfile } from './solarYardVisualProfile';
import { perseidRenderProfile, perseidStageIdentity } from './perseidCapstone';
import { k91RenderProfile, k91StageIdentity } from './k91Capstone';
import { orphelineRenderProfile, orphelineStageIdentity } from './orphelineCapstone';
import { hecateRenderProfile, hecateStageIdentity } from './hecateCapstone';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;

function createGroundLootStarGeometry() {
  const shape = new THREE.Shape();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? 0.24 : 0.1;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

const roleColors: Record<Enemy['role'], number> = {
  assault: 0xb35a4b,
  suppressor: 0xb67850,
  technician: 0x7d6daf,
  elite: 0xc34f6e,
  boss: 0xd04c46,
};

function spinHabitatEnemyAssetFamily(enemy: Enemy, mission: Contract) {
  if (mission.location !== 'spin-habitat' || enemy.role === 'boss') return null;
  if (enemy.variant === 'marksman') return SPIN_HABITAT_ENEMY_ASSET_FAMILIES.marksman;
  if (enemy.variant === 'gravitySpecialist') return SPIN_HABITAT_ENEMY_ASSET_FAMILIES.gravitySpecialist;
  if (enemy.variant === 'droneCarrier') return SPIN_HABITAT_ENEMY_ASSET_FAMILIES.droneCarrier;
  if (enemy.variant === 'shieldBoarder') return SPIN_HABITAT_ENEMY_ASSET_FAMILIES.shieldBoarder;
  return null;
}

function spinHabitatEnemyColor(enemy: Enemy) {
  if (enemy.variant === 'marksman') return 0x3d6159;
  if (enemy.variant === 'gravitySpecialist') return 0x40585c;
  if (enemy.variant === 'droneCarrier') return 0x485d56;
  if (enemy.variant === 'shieldBoarder') return 0x506157;
  return roleColors[enemy.role];
}

function spinHabitatBossAssetFamily(enemy: Enemy, mission: Contract) {
  if (mission.location !== 'spin-habitat' || enemy.role !== 'boss' || mission.deepTarget !== 'Recovery Commander Sable Voss') return null;
  return SPIN_HABITAT_BOSS_ASSET_FAMILY;
}

function jovianHarvesterBossAssetFamily(enemy: Enemy, mission: Contract) {
  if (mission.location !== 'jovian-harvester' || enemy.role !== 'boss' || mission.deepTarget !== 'Stormline Foreman Ilex') return null;
  return JOVIAN_HARVESTER_BOSS_ASSET_FAMILY;
}

function iceMineBossAssetFamily(enemy: Enemy, mission: Contract) {
  if (mission.location !== 'ice-mine' || enemy.role !== 'boss' || mission.deepTarget !== 'Salvage Captain Rhea Kade') return null;
  return ICE_MINE_BOSS_ASSET_FAMILY;
}

function solarYardBossAssetFamily(enemy: Enemy, mission: Contract) {
  if (mission.location !== 'solar-yard' || enemy.role !== 'boss' || mission.deepTarget !== 'HELIOS-9 Yardmind') return null;
  return SOLAR_YARD_BOSS_ASSET_FAMILY;
}

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

type LocationLightingProfile = {
  id: string;
  keyColor: number;
  rimColor: number;
  emergencyColor: number;
  keyIntensity: number;
  rimIntensity: number;
  emergencyIntensity: number;
  exposure: number;
};

const LOCATION_LIGHTING_PROFILES: Record<Contract['location'], LocationLightingProfile> = {
  'orbital-station': { id: 'neutral-cyan', keyColor: 0xd8e8e1, rimColor: 0x72a8b2, emergencyColor: 0xd97958, keyIntensity: 2.35, rimIntensity: 1.0, emergencyIntensity: 8.5, exposure: 1.06 },
  'damaged-vessel': { id: 'emergency-amber', keyColor: 0xd8c6b2, rimColor: 0xa65d48, emergencyColor: 0xf0754f, keyIntensity: 1.8, rimIntensity: 0.92, emergencyIntensity: 12, exposure: 1.0 },
  'asteroid-refinery': { id: 'furnace-amber', keyColor: 0xe3d0b8, rimColor: 0xc58a4f, emergencyColor: 0xdf7a55, keyIntensity: 2.15, rimIntensity: 0.95, emergencyIntensity: 11, exposure: 1.02 },
  'spin-habitat': { id: 'cool-green', keyColor: 0xd2e4dc, rimColor: 0x6fb2ac, emergencyColor: 0x6ba89f, keyIntensity: 2.2, rimIntensity: 1.06, emergencyIntensity: 7.8, exposure: 1.07 },
  'jovian-harvester': { id: 'storm-orange', keyColor: 0xffc89a, rimColor: 0xd59a57, emergencyColor: 0xd46b45, keyIntensity: 2.5, rimIntensity: 1.18, emergencyIntensity: 9.5, exposure: 1.09 },
  'ice-mine': { id: 'ice-cyan', keyColor: 0xd2e7ef, rimColor: 0x7ec9df, emergencyColor: 0x76cde9, keyIntensity: 2.1, rimIntensity: 1.1, emergencyIntensity: 8, exposure: 1.08 },
  'solar-yard': { id: 'solar-orange', keyColor: 0xffc89a, rimColor: 0xef8f46, emergencyColor: 0xe27745, keyIntensity: 2.55, rimIntensity: 1.14, emergencyIntensity: 8.8, exposure: 1.1 },
  'lattice-annex': { id: 'metrology-teal', keyColor: 0xd9e6e2, rimColor: 0x88b8ad, emergencyColor: 0x629d93, keyIntensity: 2.25, rimIntensity: 1.0, emergencyIntensity: 7.6, exposure: 1.05 },
  'momentum-exchange': { id: 'transfer-blue', keyColor: 0xd4e5ed, rimColor: 0x67b5d5, emergencyColor: 0x4d90ac, keyIntensity: 2.3, rimIntensity: 1.16, emergencyIntensity: 8.2, exposure: 1.06 },
  'cryo-reserve': { id: 'cold-blue', keyColor: 0xd0e3ed, rimColor: 0x77c6de, emergencyColor: 0x76cde9, keyIntensity: 2.0, rimIntensity: 1.12, emergencyIntensity: 8.4, exposure: 1.07 },
  'parallax-array': { id: 'reference-violet', keyColor: 0xe2ddf1, rimColor: 0x9a87cf, emergencyColor: 0x7864ba, keyIntensity: 2.2, rimIntensity: 1.15, emergencyIntensity: 8.1, exposure: 1.06 },
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
  bossSignature: THREE.Group | null;
  role: Enemy['role'];
  proceduralVisuals: THREE.Object3D[];
  assetInstance: GraphicsAssetInstance | null;
  authoredRoot: THREE.Group | null;
  authoredMaterials: THREE.MeshStandardMaterial[];
  authoredOwnedMaterials: THREE.Material[];
  authoredAssetId: string | null;
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
type GroundLootVisual = {
  root: THREE.Group;
  core: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshStandardMaterial>;
  marker: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  assetInstance: GraphicsAssetInstance | null;
  authoredRoot: THREE.Group | null;
  accentMaterials: THREE.MeshStandardMaterial[];
  ownedMaterials: THREE.Material[];
  assetRequested: boolean;
};
type AuthoredInteractableVisual = {
  instance: GraphicsAssetInstance;
  root: THREE.Group;
  assetId: string;
  statusMaterials: THREE.MeshStandardMaterial[];
  ownedMaterials: THREE.Material[];
};
type DamageNumberVisual = { sprite: THREE.Sprite; canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; texture: THREE.CanvasTexture; serial: number };

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
  if (location === 'parallax-array') return { background: 0x05040a, fog: 0x0b0913, floor: 0x12101b, grid: 0x514674, accent: 0x9a87cf, secondary: 0x665a82 };
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
  private readonly authoredInteractableRoot = new THREE.Group();
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
  private readonly playerReadabilityLight = new THREE.PointLight(0xb7efe3, 7.2, 7.5, 2);
  private readonly refineryPracticalLights = [
    new THREE.PointLight(0xffb36c, 10, 12, 2),
    new THREE.PointLight(0x6edce7, 8, 10, 2),
  ];
  private readonly objectVisuals = new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>();
  private readonly authoredInteractables = new Map<string, AuthoredInteractableVisual>();
  private readonly authoredInteractableRequests = new Set<string>();
  private readonly sectorVisuals = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private readonly enemyVisuals = new Map<number, EnemyVisual>();
  private readonly authoredEnemyRoles = new Set<Enemy['role']>();
  private authoredEnemyCount = 0;
  private readonly authoredWeapons = new Map<WeaponId, AuthoredWeaponVisual>();
  private readonly authoredWeaponFailures = new Set<WeaponId>();
  private readonly proceduralRefineryVisuals: THREE.Object3D[] = [];
  private readonly refineryAssetInstances: GraphicsAssetInstance[] = [];
  private readonly refineryInstancedMeshes: THREE.InstancedMesh[] = [];
  private readonly refineryOwnedMaterials: THREE.Material[] = [];
  private refinerySteam: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private refineryDecals: THREE.InstancedMesh | null = null;
  private refineryGrimeDecals: THREE.InstancedMesh | null = null;
  private refineryContactShadows: THREE.InstancedMesh | null = null;
  private damagedVesselVapor: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private damagedVesselScorchDecals: THREE.InstancedMesh | null = null;
  private refineryLoadGeneration = 0;
  private damagedVesselLoadGeneration = 0;
  private parallaxLoadGeneration = 0;
  private spinHabitatLoadGeneration = 0;
  private jovianHarvesterLoadGeneration = 0;
  private iceMineLoadGeneration = 0;
  private solarYardLoadGeneration = 0;
  private solarYardThermalShutterRoot: THREE.Group | null = null;
  private solarYardThermalShutterLeft: THREE.Object3D | null = null;
  private solarYardThermalShutterRight: THREE.Object3D | null = null;
  private readonly solarYardGantryCraneTrolleys: Array<{ trolley: THREE.Object3D; phase: number; amplitude: number; speed: number }> = [];
  private readonly solarYardSunPatches: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly solarYardShadePatches: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly iceMineBrittleSupportVisuals = new Map<string, THREE.Object3D>();
  private readonly iceMineFractureRoots = new Map<string, THREE.Group>();
  private readonly iceMineFractureCracks = new Map<string, Array<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>>();
  private readonly iceMineFractureShards = new Map<string, Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>>();
  private readonly iceMineFracturePulses = new Map<string, THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>();
  private readonly iceMineCollapseStartedAt = new Map<string, number>();
  private readonly iceMineBrittleSupportLastActive = new Map<string, boolean>();
  private readonly iceMineFractureCrackGeometry = new THREE.TorusGeometry(0.48, 0.035, 5, 20);
  private readonly iceMineFracturePulseGeometry = new THREE.TorusGeometry(0.66, 0.05, 6, 28);
  private readonly iceMineFractureShardGeometry = new THREE.BoxGeometry(0.16, 0.10, 0.32);
  private readonly iceMineFractureCrackMaterial = new THREE.MeshBasicMaterial({ color: 0xb7f2ff, transparent: true, opacity: 0.62, depthWrite: false });
  private readonly iceMineFracturePulseMaterial = new THREE.MeshBasicMaterial({ color: 0x85ddea, transparent: true, opacity: 0.34, depthWrite: false });
  private readonly iceMineFractureShardMaterial = new THREE.MeshStandardMaterial({ color: 0xb9dce3, emissive: 0x6ab8c6, emissiveIntensity: 0.18, metalness: 0.14, roughness: 0.72 });
  private jovianStormVisualRoot: THREE.Group | null = null;
  private readonly jovianStormChargeSweeps: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly jovianPressureShearBands: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>> = [];
  private jovianPressureReliefPulse: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  private jovianAtmosphereRoot: THREE.Group | null = null;
  private readonly jovianAtmosphereClouds: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>> = [];
  private jovianAtmosphereParticulate: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private jovianAtmosphereSpineHaze: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  private spinHabitatAuthoredRotor: THREE.Group | null = null;
  private spinHabitatProceduralRotor: THREE.Group | null = null;
  private spinHabitatSpindownVfx: THREE.Group | null = null;
  private readonly spinHabitatSpindownArcs: Array<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>> = [];
  private spinHabitatSpindownBeacon: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  private spinHabitatAmbientRoot: THREE.Group | null = null;
  private spinHabitatAmbientDust: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private spinHabitatAmbientAxisHaze: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  private readonly spinHabitatAmbientBands: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>> = [];
  private spinHabitatRotationY = 0;
  private spinHabitatLastSimTime = Number.NaN;
  private interactableLoadGeneration = 0;
  private readonly projectilePool: ProjectileVisual[] = [];
  private readonly hazardPool: RingVisual[] = [];
  private readonly effectPool: RingVisual[] = [];
  private readonly breachPool: RingVisual[] = [];
  private readonly debrisPool: DebrisVisual[] = [];
  private readonly groundLootPool: GroundLootVisual[] = [];
  private readonly damageNumberPool: DamageNumberVisual[] = [];
  private readonly projectileCoreGeometry = new THREE.SphereGeometry(0.11, 8, 6);
  private readonly projectileTrailGeometry = new THREE.BoxGeometry(0.62, 0.035, 0.035);
  private readonly groundLootCoreGeometry = new THREE.OctahedronGeometry(0.22, 0);
  private readonly groundLootMarkerGeometries: Record<ReturnType<typeof groundLootPresentation>['shape'], THREE.BufferGeometry> = {
    diamond: new THREE.OctahedronGeometry(0.18, 0),
    bar: new THREE.BoxGeometry(0.46, 0.14, 0.14),
    hexagon: new THREE.CylinderGeometry(0.22, 0.22, 0.14, 6),
    star: createGroundLootStarGeometry(),
  };
  private readonly groundLootRingGeometry = new THREE.TorusGeometry(0.48, 0.045, 6, 32);
  private readonly groundLootBeamGeometry = new THREE.CylinderGeometry(0.018, 0.055, 1.7, 6);
  private readonly effectRingGeometry = new THREE.TorusGeometry(1, 0.045, 6, 40);
  private readonly impactSparkGeometry = new THREE.BufferGeometry();
  private readonly impactSparkPool: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>[] = [];
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
  private operatorAssetRequested = false;
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
    this.renderer.domElement.dataset.interactableVisual = 'procedural-loading';
    this.renderer.domElement.dataset.lootVisual = 'procedural-ready';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.add(this.environmentRoot, this.authoredEnvironmentRoot, this.objectRoot, this.authoredInteractableRoot, this.dynamicRoot, this.playerRoot);
    this.dynamicRoot.add(this.objectiveBeacon, this.objectiveGuide);
    this.objectiveGuideMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.objectiveGuideMesh.count = 0;
    this.objectiveGuideMesh.renderOrder = 38;
    this.objectiveGuide.add(this.objectiveGuideMesh);
    this.scene.add(new THREE.HemisphereLight(0xa6c7c2, 0x14110e, 1.25));
    this.impactSparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0.12, 0,
      0.24, 0.34, 0.04,
      -0.22, 0.28, 0.08,
      0.12, 0.42, -0.18,
      -0.08, 0.38, 0.2,
      0.3, 0.2, -0.1,
    ]), 3));

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
    this.emergencyLight.castShadow = false;
    this.scene.add(this.emergencyLight);
    this.playerReadabilityLight.castShadow = false;
    this.scene.add(this.playerReadabilityLight);
    this.refineryPracticalLights.forEach(light => {
      light.castShadow = false;
      light.visible = false;
      this.scene.add(light);
    });

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

    void this.loadAuthoredWeapons();
  }

  render(state: SimState, width: number, height: number, quality: number, mission: Contract, mobileTargetId: number | null, operatorFaction: EquipmentFaction | null) {
    const now = performance.now();
    const frameMs = this.lastFrameAt > 0 ? now - this.lastFrameAt : 1000 / 60;
    this.lastFrameAt = now;
    const budget = this.renderBudget.sample(frameMs, quality);
    this.resize(width, height, quality, budget);
    this.ensureEnvironment(state, mission, budget);
    this.syncSpinHabitatArchitecture(state, mission, budget);
    this.syncJovianHarvesterVisualLanguage(state, mission, budget);
    this.syncIceMineBrittleSupports(state, mission, budget);
    syncHardSciFiEnvironment(this.environmentRoot, state, mission, budget.detailScale, budget.transparencyScale);
    this.syncSectors(state);
    this.syncObjects(state, mission);
    this.syncObjectiveBeacon(state, mission);
    if (!this.operatorAssetRequested) {
      this.operatorAssetRequested = true;
      void this.loadAuthoredOperator(state.build.operatorClass);
    }
    this.syncPlayer(state, operatorFaction);
    this.syncEnemies(state, mission, mobileTargetId);
    this.syncDamageNumbers(state);
    this.syncProjectiles(state, budget.transparencyScale);
    this.syncGroundLoot(state);
    this.syncHazards(state);
    this.syncEffects(state, quality * budget.detailScale, budget.vfxDensity, budget.transparencyScale);
    this.syncBreaches(state);
    syncHardSciFiBreaches(this.dynamicRoot, state, WORLD_SCALE, quality * budget.vfxDensity);
    this.syncDebris(state, quality * budget.detailScale * budget.vfxDensity);
    this.syncRefineryAtmospherics(state, quality * budget.detailScale, budget.vfxDensity, budget.transparencyScale);
    this.syncDamagedVesselAtmospherics(state, quality * budget.detailScale, budget.vfxDensity, budget.transparencyScale);
    this.syncCamera(state, width / Math.max(1, height));
    this.syncLighting(state, mission, quality, budget);
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
    this.clearAuthoredInteractables();
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
    for (const visual of this.groundLootPool) {
      visual.assetInstance?.release();
      visual.assetInstance = null;
      visual.authoredRoot = null;
      visual.ownedMaterials.forEach(material => material.dispose());
      visual.ownedMaterials = [];
      visual.accentMaterials = [];
    }
    for (const visual of this.damageNumberPool) visual.texture.dispose();
    this.damageNumberPool.length = 0;
    this.iceMineFractureCrackGeometry.dispose();
    this.iceMineFracturePulseGeometry.dispose();
    this.iceMineFractureShardGeometry.dispose();
    this.iceMineFractureCrackMaterial.dispose();
    this.iceMineFracturePulseMaterial.dispose();
    this.iceMineFractureShardMaterial.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
  }

  private clearAuthoredRefineryEnvironment() {
    this.refineryLoadGeneration += 1;
    this.damagedVesselLoadGeneration += 1;
    this.parallaxLoadGeneration += 1;
    this.spinHabitatLoadGeneration += 1;
    this.jovianHarvesterLoadGeneration += 1;
    this.iceMineLoadGeneration += 1;
    this.solarYardLoadGeneration += 1;
    this.solarYardThermalShutterRoot = null;
    this.solarYardThermalShutterLeft = null;
    this.solarYardThermalShutterRight = null;
    this.solarYardGantryCraneTrolleys.length = 0;
    this.solarYardSunPatches.length = 0;
    this.solarYardShadePatches.length = 0;
    this.iceMineBrittleSupportVisuals.clear();
    this.iceMineFractureRoots.clear();
    this.iceMineFractureCracks.clear();
    this.iceMineFractureShards.clear();
    this.iceMineFracturePulses.clear();
    this.iceMineCollapseStartedAt.clear();
    this.iceMineBrittleSupportLastActive.clear();
    this.jovianStormVisualRoot = null;
    this.jovianStormChargeSweeps.length = 0;
    this.jovianPressureShearBands.length = 0;
    this.jovianPressureReliefPulse = null;
    this.jovianAtmosphereRoot = null;
    this.jovianAtmosphereClouds.length = 0;
    this.jovianAtmosphereParticulate = null;
    this.jovianAtmosphereSpineHaze = null;
    this.spinHabitatAuthoredRotor = null;
    this.spinHabitatProceduralRotor = null;
    this.spinHabitatSpindownVfx = null;
    this.spinHabitatSpindownArcs.length = 0;
    this.spinHabitatSpindownBeacon = null;
    this.spinHabitatAmbientRoot = null;
    this.spinHabitatAmbientDust = null;
    this.spinHabitatAmbientAxisHaze = null;
    this.spinHabitatAmbientBands.length = 0;
    this.spinHabitatRotationY = 0;
    this.spinHabitatLastSimTime = Number.NaN;
    for (const mesh of this.refineryInstancedMeshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.refineryInstancedMeshes.length = 0;
    this.refineryOwnedMaterials.forEach(material => material.dispose());
    this.refineryOwnedMaterials.length = 0;
    if (this.refinerySteam) {
      this.refinerySteam.geometry.dispose();
      this.refinerySteam.material.dispose();
      this.refinerySteam = null;
    }
    if (this.refineryDecals) {
      this.refineryDecals.geometry.dispose();
      const materials = Array.isArray(this.refineryDecals.material) ? this.refineryDecals.material : [this.refineryDecals.material];
      materials.forEach(material => material.dispose());
      this.refineryDecals = null;
    }
    if (this.refineryGrimeDecals) {
      this.refineryGrimeDecals.geometry.dispose();
      const materials = Array.isArray(this.refineryGrimeDecals.material) ? this.refineryGrimeDecals.material : [this.refineryGrimeDecals.material];
      materials.forEach(material => material.dispose());
      this.refineryGrimeDecals = null;
    }
    if (this.refineryContactShadows) {
      this.refineryContactShadows.geometry.dispose();
      const materials = Array.isArray(this.refineryContactShadows.material) ? this.refineryContactShadows.material : [this.refineryContactShadows.material];
      materials.forEach(material => material.dispose());
      this.refineryContactShadows = null;
    }
    if (this.damagedVesselVapor) {
      this.damagedVesselVapor.geometry.dispose();
      this.damagedVesselVapor.material.dispose();
      this.damagedVesselVapor = null;
    }
    if (this.damagedVesselScorchDecals) {
      this.damagedVesselScorchDecals.geometry.dispose();
      const materials = Array.isArray(this.damagedVesselScorchDecals.material) ? this.damagedVesselScorchDecals.material : [this.damagedVesselScorchDecals.material];
      materials.forEach(material => material.dispose());
      this.damagedVesselScorchDecals = null;
    }
    for (const instance of this.refineryAssetInstances) instance.release();
    this.refineryAssetInstances.length = 0;
    this.authoredEnvironmentRoot.clear();
    this.proceduralRefineryVisuals.forEach(item => { item.visible = true; });
    this.renderer.domElement.dataset.environmentVisual = 'procedural';
    delete this.renderer.domElement.dataset.environmentLod;
    delete this.renderer.domElement.dataset.environmentKit;
    delete this.renderer.domElement.dataset.environmentInstances;
    delete this.renderer.domElement.dataset.environmentTerminals;
    delete this.renderer.domElement.dataset.environmentLandmark;
    delete this.renderer.domElement.dataset.environmentMotion;
    delete this.renderer.domElement.dataset.environmentSpinMode;
    delete this.renderer.domElement.dataset.environmentSpinRpm;
    delete this.renderer.domElement.dataset.environmentSpinPhase;
    delete this.renderer.domElement.dataset.environmentSpinSource;
    delete this.renderer.domElement.dataset.environmentSpindown;
    delete this.renderer.domElement.dataset.environmentSpindownIntensity;
    delete this.renderer.domElement.dataset.environmentSpindownSource;
    delete this.renderer.domElement.dataset.environmentSpindownDetail;
    delete this.renderer.domElement.dataset.environmentAmbient;
    delete this.renderer.domElement.dataset.environmentAmbientMotion;
    delete this.renderer.domElement.dataset.environmentAmbientDetail;
    delete this.renderer.domElement.dataset.environmentAmbientIntensity;
    delete this.renderer.domElement.dataset.environmentPerformanceProfile;
    delete this.renderer.domElement.dataset.environmentInstanceBudget;
    delete this.renderer.domElement.dataset.environmentShadowCasters;
    delete this.renderer.domElement.dataset.environmentServiceDetails;
    delete this.renderer.domElement.dataset.environmentSurfaceDetail;
    delete this.renderer.domElement.dataset.environmentMachineDetail;
    delete this.renderer.domElement.dataset.environmentComposition;
    delete this.renderer.domElement.dataset.environmentTunnelSequence;
    delete this.renderer.domElement.dataset.environmentBrittleSupports;
    delete this.renderer.domElement.dataset.environmentBrittleSupportState;
    delete this.renderer.domElement.dataset.environmentBrittleSupportIds;
    delete this.renderer.domElement.dataset.environmentFractureVfx;
    delete this.renderer.domElement.dataset.environmentFractureState;
    delete this.renderer.domElement.dataset.environmentFractureDetail;
    delete this.renderer.domElement.dataset.environmentFractureSupports;
    delete this.renderer.domElement.dataset.environmentZoneIdentity;
    delete this.renderer.domElement.dataset.environmentLighting;
    delete this.renderer.domElement.dataset.environmentMaterials;
    delete this.renderer.domElement.dataset.environmentVfx;
    delete this.renderer.domElement.dataset.environmentTone;
    delete this.renderer.domElement.dataset.environmentStormLanguage;
    delete this.renderer.domElement.dataset.environmentStormMode;
    delete this.renderer.domElement.dataset.environmentStormIntensity;
    delete this.renderer.domElement.dataset.environmentPressureShear;
    delete this.renderer.domElement.dataset.environmentPressureRange;
    delete this.renderer.domElement.dataset.environmentStormSource;
    delete this.renderer.domElement.dataset.environmentStormDetail;
    delete this.renderer.domElement.dataset.environmentSunShadow;
    delete this.renderer.domElement.dataset.environmentSunDirection;
    delete this.renderer.domElement.dataset.environmentSunMode;
    delete this.renderer.domElement.dataset.environmentSunPatches;
    delete this.renderer.domElement.dataset.environmentShadowBudget;
    delete this.renderer.domElement.dataset.environmentThermalShutters;
    delete this.renderer.domElement.dataset.environmentThermalProtection;
    delete this.renderer.domElement.dataset.environmentThermalShutterControl;
    delete this.renderer.domElement.dataset.environmentTransport;
    delete this.renderer.domElement.dataset.environmentCraneMotion;
    delete this.renderer.domElement.dataset.environmentCraneOffsets;
    delete this.renderer.domElement.dataset.megastructureIdentity;
    delete this.renderer.domElement.dataset.megastructureStage;
    delete this.renderer.domElement.dataset.megastructureContinuity;
    delete this.renderer.domElement.dataset.megastructureStageKit;
    delete this.renderer.domElement.dataset.megastructurePerformanceProfile;
    delete this.renderer.domElement.dataset.readabilityLanguage;
  }

  private cloneRefineryMaterial(source: THREE.Material, label: string) {
    const material = source.clone();
    this.refineryOwnedMaterials.push(material);
    if (material instanceof THREE.MeshStandardMaterial) {
      const tuning = label.includes('floor')
        ? { metalness: 0.64, roughness: 0.54 }
        : label.includes('bulkhead') || label.includes('pipe') || label.includes('conduit') || label.includes('gantry') || label.includes('wall') || label.includes('cable')
          ? { metalness: 0.82, roughness: 0.38 }
          : label.includes('crate')
            ? { metalness: 0.58, roughness: 0.58 }
            : { metalness: 0.7, roughness: 0.42 };
      material.metalness = tuning.metalness;
      material.roughness = tuning.roughness;
      if (label.includes('terminal')) {
        material.emissive.setHex(0x63d7d7);
        material.emissiveIntensity = 0.34;
      } else if (label.includes('processor')) {
        material.emissive.setHex(0xd18c4f);
        material.emissiveIntensity = 0.16;
      }
    }
    return material;
  }

  private cloneDamagedVesselMaterial(source: THREE.Material, label: string) {
    const material = source.clone();
    this.refineryOwnedMaterials.push(material);
    if (material instanceof THREE.MeshStandardMaterial) {
      const tuning = label.includes('salvage')
        ? { metalness: 0.62, roughness: 0.54 }
        : label.includes('breach')
          ? { metalness: 0.78, roughness: 0.50 }
          : { metalness: 0.84, roughness: 0.46 };
      material.metalness = tuning.metalness;
      material.roughness = tuning.roughness;
    }
    return material;
  }

  private buildRefineryAtmospherics(width: number, height: number) {
    const steamPositions = new Float32Array(30 * 3);
    const steamStacks = [
      [0.29, 0.67],
      [0.50, 0.26],
      [0.71, 0.67],
    ] as const;
    for (let index = 0; index < 30; index += 1) {
      const stack = index % steamStacks.length;
      const t = Math.floor(index / steamStacks.length) / 9;
      const [stackX, stackZ] = steamStacks[stack];
      steamPositions[index * 3] = width * stackX + Math.sin(index * 1.7) * 0.16;
      steamPositions[index * 3 + 1] = 0.52 + t * 2.55;
      steamPositions[index * 3 + 2] = height * stackZ + Math.cos(index * 1.3) * 0.14;
    }
    const steamGeometry = new THREE.BufferGeometry();
    steamGeometry.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));
    const steamMaterial = new THREE.PointsMaterial({
      color: 0xb8d9d4,
      size: 0.16,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const steam = new THREE.Points(steamGeometry, steamMaterial);
    steam.name = 'refinery-steam';
    steam.frustumCulled = false;
    this.refinerySteam = steam;
    this.authoredEnvironmentRoot.add(steam);

    const decalGeometry = new THREE.PlaneGeometry(2.4, 0.2);
    const decalMaterial = new THREE.MeshBasicMaterial({
      color: 0xe2a052,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const decals = new THREE.InstancedMesh(decalGeometry, decalMaterial, 8);
    const transform = new THREE.Object3D();
    const safetyLaneMarkers = [
      [0.32, 0.36, 0.18], [0.32, 0.48, 0.18], [0.32, 0.60, 0.18], [0.32, 0.72, 0.18],
      [0.68, 0.36, -0.18], [0.68, 0.48, -0.18], [0.68, 0.60, -0.18], [0.68, 0.72, -0.18],
    ];
    safetyLaneMarkers.forEach(([x, z, rotationZ], index) => {
      transform.position.set(width * x, 0.028, height * z);
      transform.rotation.set(-Math.PI / 2, 0, rotationZ);
      transform.updateMatrix();
      decals.setMatrixAt(index, transform.matrix);
    });
    decals.instanceMatrix.needsUpdate = true;
    decals.renderOrder = 3;
    decals.name = 'refinery-safety-decals';
    this.refineryDecals = decals;
    this.authoredEnvironmentRoot.add(decals);

    const grimeGeometry = new THREE.CircleGeometry(0.72, 10);
    const grimeMaterial = new THREE.MeshBasicMaterial({
      color: 0x171410,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const grime = new THREE.InstancedMesh(grimeGeometry, grimeMaterial, 7);
    for (let index = 0; index < 7; index += 1) {
      const t = index / 6;
      transform.position.set(width * (0.2 + t * 0.62), 0.024, height * (0.28 + (index % 3) * 0.2));
      transform.rotation.set(-Math.PI / 2, 0, index * 0.53);
      const scale = 0.65 + (index % 3) * 0.22;
      transform.scale.set(scale * 1.5, scale * 0.72, 1);
      transform.updateMatrix();
      grime.setMatrixAt(index, transform.matrix);
    }
    grime.instanceMatrix.needsUpdate = true;
    grime.renderOrder = 2;
    grime.name = 'refinery-grime-decals';
    this.refineryGrimeDecals = grime;
    this.authoredEnvironmentRoot.add(grime);

    const contactGeometry = new THREE.PlaneGeometry(2.4, 1.6);
    const contactMaterial = new THREE.MeshBasicMaterial({
      color: 0x050403,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const contactShadows = new THREE.InstancedMesh(contactGeometry, contactMaterial, 10);
    const contactPoints = [
      [0.29, 0.67, 1.00, 0.72], [0.50, 0.26, 1.16, 0.84], [0.71, 0.67, 1.00, 0.72],
      [0.50, 0.09, 1.55, 0.62], [0.18, 0.24, 0.72, 0.52], [0.82, 0.24, 0.72, 0.52],
      [0.18, 0.76, 0.72, 0.52], [0.82, 0.76, 0.72, 0.52], [0.29, 0.52, 0.54, 0.40],
      [0.71, 0.52, 0.54, 0.40],
    ];
    contactPoints.forEach(([x, z, sx, sz], index) => {
      transform.position.set(width * x, 0.021, height * z);
      transform.rotation.set(-Math.PI / 2, 0, index * 0.31);
      transform.scale.set(sx, sz, 1);
      transform.updateMatrix();
      contactShadows.setMatrixAt(index, transform.matrix);
    });
    contactShadows.instanceMatrix.needsUpdate = true;
    contactShadows.renderOrder = 1;
    contactShadows.name = 'refinery-contact-darkening';
    this.refineryContactShadows = contactShadows;
    this.authoredEnvironmentRoot.add(contactShadows);
  }

  private syncRefineryAtmospherics(state: SimState, detailLevel: number, vfxDensity: number, transparencyScale: number) {
    if (!this.refinerySteam) return;
    const reducedEffects = detailLevel < 0.58 || vfxDensity < 0.55;
    this.refinerySteam.visible = !reducedEffects;
    this.refinerySteam.rotation.y = Math.sin(state.time * 0.16) * 0.025;
    this.refinerySteam.material.opacity = (0.1 + Math.sin(state.time * 1.7) * 0.025) * transparencyScale;
    if (this.refineryDecals) this.refineryDecals.visible = true;
    if (this.refineryGrimeDecals) this.refineryGrimeDecals.visible = !reducedEffects;
  }

  private buildDamagedVesselAtmospherics(width: number, height: number) {
    const vaporPositions = new Float32Array(18 * 3);
    for (let index = 0; index < 18; index += 1) {
      const t = index / 17;
      vaporPositions[index * 3] = width * (0.74 + t * 0.15);
      vaporPositions[index * 3 + 1] = 0.62 + (index % 6) * 0.34;
      vaporPositions[index * 3 + 2] = height * (0.50 + Math.sin(index * 1.41) * 0.020);
    }
    const vaporGeometry = new THREE.BufferGeometry();
    vaporGeometry.setAttribute('position', new THREE.BufferAttribute(vaporPositions, 3));
    const vaporMaterial = new THREE.PointsMaterial({
      color: 0xbfd8d5,
      size: 0.12,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const vapor = new THREE.Points(vaporGeometry, vaporMaterial);
    vapor.name = 'damaged-vessel-breach-vapor';
    vapor.frustumCulled = false;
    this.damagedVesselVapor = vapor;
    this.authoredEnvironmentRoot.add(vapor);

    const scorchGeometry = new THREE.CircleGeometry(0.82, 10);
    const scorchMaterial = new THREE.MeshBasicMaterial({
      color: 0x080605,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const scorch = new THREE.InstancedMesh(scorchGeometry, scorchMaterial, 6);
    const transform = new THREE.Object3D();
    const scorchPoints = [
      [0.76, 0.45, 1.15, 0.55],
      [0.80, 0.51, 0.86, 0.48],
      [0.84, 0.56, 1.28, 0.50],
      [0.78, 0.62, 0.78, 0.42],
      [0.88, 0.42, 0.70, 0.38],
      [0.86, 0.68, 0.92, 0.44],
    ];
    scorchPoints.forEach(([x, z, sx, sz], index) => {
      transform.position.set(width * x, 0.023, height * z);
      transform.rotation.set(-Math.PI / 2, 0, index * 0.47);
      transform.scale.set(sx, sz, 1);
      transform.updateMatrix();
      scorch.setMatrixAt(index, transform.matrix);
    });
    scorch.instanceMatrix.needsUpdate = true;
    scorch.renderOrder = 2;
    scorch.name = 'damaged-vessel-breach-scorch';
    this.damagedVesselScorchDecals = scorch;
    this.authoredEnvironmentRoot.add(scorch);
  }

  private syncDamagedVesselAtmospherics(state: SimState, detailLevel: number, vfxDensity: number, transparencyScale: number) {
    if (!this.damagedVesselVapor) return;
    const reducedEffects = detailLevel < 0.58 || vfxDensity < 0.55;
    this.damagedVesselVapor.visible = !reducedEffects;
    this.damagedVesselVapor.position.x = Math.sin(state.time * 0.73) * 0.08;
    this.damagedVesselVapor.position.z = Math.cos(state.time * 0.61) * 0.035;
    this.damagedVesselVapor.material.opacity = (0.075 + Math.sin(state.time * 1.9) * 0.018) * transparencyScale;
    if (this.damagedVesselScorchDecals) this.damagedVesselScorchDecals.visible = true;
  }

  private addInstancedEnvironmentAsset(instance: GraphicsAssetInstance, placements: EnvironmentPlacement[], label: string, parent: THREE.Object3D = this.authoredEnvironmentRoot, castShadow = true) {
    if (placements.length === 0) return 0;
    instance.root.updateMatrixWorld(true);
    let created = 0;
    instance.root.traverse(child => {
      const source = child as THREE.Mesh;
      if (!source.isMesh || !source.geometry || !source.material) return;
      source.updateWorldMatrix(true, false);
      const material = Array.isArray(source.material)
        ? source.material.map(item => this.cloneRefineryMaterial(item, label))
        : this.cloneRefineryMaterial(source.material, label);
      const mesh = new THREE.InstancedMesh(source.geometry, material, placements.length);
      mesh.name = `authored-${label}-${source.name || 'mesh'}`;
      mesh.castShadow = castShadow && (source.castShadow || label !== 'floor');
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
      parent.add(mesh);
      this.refineryInstancedMeshes.push(mesh);
      created += placements.length;
    });
    return created;
  }

  private addInstancedDamagedVesselAsset(instance: GraphicsAssetInstance, placements: EnvironmentPlacement[], label: string) {
    if (placements.length === 0) return 0;
    instance.root.updateMatrixWorld(true);
    let created = 0;
    instance.root.traverse(child => {
      const source = child as THREE.Mesh;
      if (!source.isMesh || !source.geometry || !source.material) return;
      source.updateWorldMatrix(true, false);
      const material = Array.isArray(source.material)
        ? source.material.map(item => this.cloneDamagedVesselMaterial(item, label))
        : this.cloneDamagedVesselMaterial(source.material, label);
      const mesh = new THREE.InstancedMesh(source.geometry, material, placements.length);
      mesh.name = `authored-${label}-${source.name || 'mesh'}`;
      mesh.castShadow = true;
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



  private async loadAuthoredJovianHarvesterEnvironment(worldW: number, worldH: number, detailScale: number) {
    const generation = ++this.jovianHarvesterLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
    const profile = jovianHarvesterRenderProfile(detailScale, this.coarse);
    const loaded: Array<{ key: keyof typeof JOVIAN_HARVESTER_ASSET_FAMILIES; instance: GraphicsAssetInstance; lod: number }> = [];

    try {
      for (const key of Object.keys(JOVIAN_HARVESTER_ASSET_FAMILIES) as Array<keyof typeof JOVIAN_HARVESTER_ASSET_FAMILIES>) {
        const spec = selectGraphicsAssetSpec(JOVIAN_HARVESTER_ASSET_FAMILIES[key], profile.assetDetailScale);
        if (!spec) throw new Error(`No authored Jovian Harvester asset available for ${key}`);
        const instance = await instantiateGraphicsAsset(spec);
        loaded.push({ key, instance, lod: spec.lod });
      }

      if (this.disposed || generation !== this.jovianHarvesterLoadGeneration) {
        loaded.forEach(item => item.instance.release());
        return;
      }

      this.refineryAssetInstances.push(...loaded.map(item => item.instance));
      const byKey = new Map(loaded.map(item => [item.key, item]));
      const width = scaled(worldW);
      const height = scaled(worldH);

      const deckPlacementsAll: EnvironmentPlacement[] = [
        [0.26, 0.26, 0], [0.50, 0.25, 0], [0.74, 0.26, 0],
        [0.28, 0.72, Math.PI], [0.52, 0.74, Math.PI], [0.76, 0.72, Math.PI],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale: 0.92,
      }));
      const deckPlacements = deckPlacementsAll.filter((_, index) => profile.deckInstances === 6 || [0, 2, 3, 5].includes(index));
      const towerPlacements: EnvironmentPlacement[] = [
        [0.18, 0.38, 0.78], [0.34, 0.54, 0.92], [0.50, 0.42, 1.10], [0.66, 0.57, 0.96], [0.82, 0.40, 0.82],
      ].map(([x, z, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY: x < 0.5 ? Math.PI * 0.08 : -Math.PI * 0.08,
        scale,
      }));
      const bridgePlacementsAll: EnvironmentPlacement[] = [
        [0.26, 0.46, 0], [0.42, 0.48, 0], [0.58, 0.49, 0], [0.74, 0.47, 0],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale: 0.88,
      }));
      const bridgePlacements = bridgePlacementsAll.filter((_, index) => profile.bridgeInstances === 4 || index === 0 || index === 3);
      const ballastPlacementsAll: EnvironmentPlacement[] = [
        [0.18, 0.22, Math.PI / 2], [0.82, 0.22, -Math.PI / 2],
        [0.20, 0.78, Math.PI / 2], [0.80, 0.78, -Math.PI / 2],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale: 0.86,
      }));
      const ballastPlacements = ballastPlacementsAll.filter((_, index) => profile.ballastInstances === 4 || index === 0 || index === 3);

      let instances = 0;
      instances += this.addInstancedEnvironmentAsset(byKey.get('deckSpan')!.instance, deckPlacements, 'jovian-harvester-deck-span', this.authoredEnvironmentRoot, profile.structureShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('skimmerTower')!.instance, towerPlacements, 'jovian-harvester-skimmer-tower', this.authoredEnvironmentRoot, profile.structureShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('transferBridge')!.instance, bridgePlacements, 'jovian-harvester-transfer-bridge', this.authoredEnvironmentRoot, profile.structureShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('ballastPod')!.instance, ballastPlacements, 'jovian-harvester-ballast-pod', this.authoredEnvironmentRoot, profile.structureShadows);

      this.proceduralRefineryVisuals.forEach(item => { item.visible = false; });
      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-jovian-harvester';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'deck-span,skimmer-tower,transfer-bridge,ballast-pod';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentPerformanceProfile = `${profile.name}:lod${lods.join(',')}:structure-shadows-${profile.structureShadows ? 'on' : 'off'}`;
      this.renderer.domElement.dataset.environmentInstanceBudget = `deck:${deckPlacements.length}+tower:${towerPlacements.length}+bridge:${bridgePlacements.length}+ballast:${ballastPlacements.length}`;
      this.renderer.domElement.dataset.environmentShadowCasters = profile.structureShadows ? 'jovian-structures' : 'off';
      this.renderer.domElement.dataset.environmentLandmark = 'five-skimmer-tower-spine';
      this.renderer.domElement.dataset.environmentServiceDetails = `transfer-bridge:${bridgePlacements.length}+ballast-pod:${ballastPlacements.length}`;
      this.renderer.domElement.dataset.environmentSurfaceDetail = `deck-span:${deckPlacements.length}+skimmer-tower:${towerPlacements.length}`;
      this.renderer.domElement.dataset.environmentComposition = 'elevated-skimmer-decks+five-tower-spine+transfer-bridges+ballast-pods';
      this.renderer.domElement.dataset.environmentMaterials = 'weathered-shell+dark-truss+amber-wayfinding+bright-ballast-shell';
      this.renderer.domElement.dataset.environmentZoneIdentity = 'deck:weathered-plate|tower:vertical-skimmer-spine|bridge:dark-transfer-truss|ballast:light-suspended-pod';
      this.renderer.domElement.dataset.readabilityLanguage = 'tower-height+bridge-lines+amber-wayfinding+pressure-shear+storm-charge';
    } catch (error) {
      loaded.forEach(item => item.instance.release());
      if (this.disposed || generation !== this.jovianHarvesterLoadGeneration) return;
      this.refineryAssetInstances.length = 0;
      this.refineryInstancedMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.dispose();
      });
      this.refineryInstancedMeshes.length = 0;
      this.refineryOwnedMaterials.forEach(material => material.dispose());
      this.refineryOwnedMaterials.length = 0;
      this.authoredEnvironmentRoot.clear();
      this.proceduralRefineryVisuals.forEach(item => { item.visible = true; });
      this.renderer.domElement.dataset.environmentVisual = 'procedural-fallback';
      delete this.renderer.domElement.dataset.environmentLandmark;
      delete this.renderer.domElement.dataset.environmentServiceDetails;
      delete this.renderer.domElement.dataset.environmentSurfaceDetail;
      delete this.renderer.domElement.dataset.environmentComposition;
      delete this.renderer.domElement.dataset.environmentZoneIdentity;
      delete this.renderer.domElement.dataset.environmentMaterials;
      delete this.renderer.domElement.dataset.readabilityLanguage;
      console.warn('Authored Jovian Harvester kit failed to load; keeping procedural scenery.', error);
    }
  }


  private async loadAuthoredIceMineEnvironment(state: SimState, worldW: number, worldH: number, detailScale: number) {
    const generation = ++this.iceMineLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
    const assetDetailScale = this.coarse ? Math.min(detailScale, 0.55) : detailScale;
    const loaded: Array<{ key: keyof typeof ICE_MINE_ASSET_FAMILIES; instance: GraphicsAssetInstance; lod: number }> = [];

    try {
      for (const key of Object.keys(ICE_MINE_ASSET_FAMILIES) as Array<keyof typeof ICE_MINE_ASSET_FAMILIES>) {
        const spec = selectGraphicsAssetSpec(ICE_MINE_ASSET_FAMILIES[key], assetDetailScale);
        if (!spec) throw new Error(`No authored Ice Mine asset available for ${key}`);
        const instance = await instantiateGraphicsAsset(spec);
        loaded.push({ key, instance, lod: spec.lod });
      }

      if (this.disposed || generation !== this.iceMineLoadGeneration) {
        loaded.forEach(item => item.instance.release());
        return;
      }

      const byKey = new Map(loaded.map(item => [item.key, item]));
      const width = scaled(worldW);
      const height = scaled(worldH);

      const frostWallPlacements: EnvironmentPlacement[] = [
        [0.12, 0.15, 0, 1.04], [0.28, 0.14, 0, 0.96], [0.46, 0.14, 0, 0.94], [0.64, 0.14, 0, 0.96], [0.82, 0.15, 0, 1.04],
        [0.12, 0.85, Math.PI, 1.04], [0.28, 0.86, Math.PI, 0.96], [0.46, 0.86, Math.PI, 0.94], [0.64, 0.86, Math.PI, 0.96], [0.82, 0.85, Math.PI, 1.04],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));

      const supportFramePlacements: EnvironmentPlacement[] = [
        [0.20, 0.50, 0.98],
        [0.44, 0.50, 0.94],
        [0.68, 0.50, 0.94],
        [0.78, 0.50, 0.98],
      ].map(([x, z, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY: 0,
        scale,
      }));
      const brittleSupportFramePlacements = (['ice-brittle-gate-a', 'ice-brittle-gate-b'] as const).map((id, index) => {
        const object = state.objects.find(item => item.id === id);
        return {
          id,
          placement: {
            position: object
              ? new THREE.Vector3(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2))
              : new THREE.Vector3(width * (index === 0 ? 0.32 : 0.56), 0, height * 0.45),
            scale: 0.94,
          } satisfies EnvironmentPlacement,
        };
      });

      const serviceDeckPlacements: EnvironmentPlacement[] = [
        [0.25, 0.50, 0], [0.40, 0.50, 0], [0.55, 0.50, 0], [0.70, 0.50, 0],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * x, 0.01, height * z),
        rotationY,
        scale: 0.92,
      }));

      const cryoPumpPlacements: EnvironmentPlacement[] = [
        [0.36, 0.34, Math.PI / 2, 0.88],
        [0.58, 0.66, -Math.PI / 2, 0.92],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));

      const coolantManifoldPlacements: EnvironmentPlacement[] = [
        [0.46, 0.32, 0, 0.86],
        [0.62, 0.50, Math.PI / 2, 0.90],
        [0.74, 0.70, Math.PI, 0.84],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));

      const freezeCompressorPlacements: EnvironmentPlacement[] = [
        [0.72, 0.34, Math.PI / 2, 0.94],
        [0.80, 0.60, -Math.PI / 2, 0.90],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));

      const icePillarPlacements: EnvironmentPlacement[] = [
        [0.82, 0.30, -0.18, 0.92], [0.87, 0.42, 0.12, 1.08], [0.90, 0.56, -0.10, 1.18],
        [0.84, 0.69, 0.20, 0.96], [0.76, 0.64, -0.22, 0.82],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));

      let instances = 0;
      instances += this.addInstancedEnvironmentAsset(byKey.get('frostWall')!.instance, frostWallPlacements, 'ice-mine-frost-wall');
      instances += this.addInstancedEnvironmentAsset(byKey.get('supportFrame')!.instance, supportFramePlacements, 'ice-mine-support-frame');
      for (const [supportIndex, support] of brittleSupportFramePlacements.entries()) {
        const root = new THREE.Group();
        root.name = `ice-mine-brittle-support-${support.id}`;
        this.authoredEnvironmentRoot.add(root);
        instances += this.addInstancedEnvironmentAsset(byKey.get('supportFrame')!.instance, [support.placement], 'ice-mine-support-frame-brittle', root);
        this.iceMineBrittleSupportVisuals.set(support.id, root);

        const fractureRoot = new THREE.Group();
        fractureRoot.name = `ice-mine-fracture-vfx-${support.id}`;
        fractureRoot.position.copy(support.placement.position);
        const cracks: Array<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>> = [];
        for (let crackIndex = 0; crackIndex < 3; crackIndex += 1) {
          const crack = new THREE.Mesh(this.iceMineFractureCrackGeometry, this.iceMineFractureCrackMaterial);
          crack.name = `ice-mine-fracture-crack-${support.id}-${crackIndex}`;
          crack.position.set((crackIndex - 1) * 0.14, 0.84 + crackIndex * 0.34, 0.02 * (crackIndex - 1));
          crack.rotation.y = crackIndex % 2 === 0 ? 0.18 : -0.22;
          crack.rotation.z = (crackIndex - 1) * 0.46;
          crack.scale.set(0.72 + crackIndex * 0.10, 1.12 - crackIndex * 0.08, 1);
          crack.visible = false;
          fractureRoot.add(crack);
          cracks.push(crack);
        }

        const pulse = new THREE.Mesh(this.iceMineFracturePulseGeometry, this.iceMineFracturePulseMaterial);
        pulse.name = `ice-mine-collapse-frost-pulse-${support.id}`;
        pulse.rotation.x = Math.PI / 2;
        pulse.position.y = 0.06;
        pulse.visible = false;
        fractureRoot.add(pulse);

        const shards: Array<THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>> = [];
        for (let shardIndex = 0; shardIndex < 8; shardIndex += 1) {
          const shard = new THREE.Mesh(this.iceMineFractureShardGeometry, this.iceMineFractureShardMaterial);
          shard.name = `ice-mine-collapse-shard-${support.id}-${shardIndex}`;
          const angle = (shardIndex / 8) * Math.PI * 2 + supportIndex * 0.31;
          const speed = 0.42 + (shardIndex % 3) * 0.13;
          shard.userData.velocity = [Math.cos(angle) * speed, 0.78 + (shardIndex % 4) * 0.12, Math.sin(angle) * speed];
          shard.position.set(0, 0.92, 0);
          shard.rotation.set(shardIndex * 0.31, shardIndex * 0.47, shardIndex * 0.23);
          shard.visible = false;
          fractureRoot.add(shard);
          shards.push(shard);
        }

        this.authoredEnvironmentRoot.add(fractureRoot);
        this.iceMineFractureRoots.set(support.id, fractureRoot);
        this.iceMineFractureCracks.set(support.id, cracks);
        this.iceMineFracturePulses.set(support.id, pulse);
        this.iceMineFractureShards.set(support.id, shards);
      }
      instances += this.addInstancedEnvironmentAsset(byKey.get('serviceDeck')!.instance, serviceDeckPlacements, 'ice-mine-service-deck');
      instances += this.addInstancedEnvironmentAsset(byKey.get('cryoPump')!.instance, cryoPumpPlacements, 'ice-mine-cryo-pump');
      instances += this.addInstancedEnvironmentAsset(byKey.get('coolantManifold')!.instance, coolantManifoldPlacements, 'ice-mine-coolant-manifold');
      instances += this.addInstancedEnvironmentAsset(byKey.get('freezeCompressor')!.instance, freezeCompressorPlacements, 'ice-mine-freeze-compressor');
      instances += this.addInstancedEnvironmentAsset(byKey.get('icePillar')!.instance, icePillarPlacements, 'ice-mine-ice-pillar');

      this.refineryAssetInstances.push(...loaded.map(item => item.instance));
      this.proceduralRefineryVisuals.forEach(item => { item.visible = false; });
      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-ice-mine';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'frost-wall,support-frame,service-deck,ice-pillar,cryo-pump,coolant-manifold,freeze-compressor';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentLandmark = 'subglacial-vault-ice-pillars';
      this.renderer.domElement.dataset.environmentServiceDetails = `support-frame:${supportFramePlacements.length + brittleSupportFramePlacements.length}+service-deck:${serviceDeckPlacements.length}+cryo-machinery:${cryoPumpPlacements.length + coolantManifoldPlacements.length + freezeCompressorPlacements.length}`;
      this.renderer.domElement.dataset.environmentMachineDetail = `cryo-pump:${cryoPumpPlacements.length}+coolant-manifold:${coolantManifoldPlacements.length}+freeze-compressor:${freezeCompressorPlacements.length}`;
      this.renderer.domElement.dataset.environmentSurfaceDetail = `frost-wall:${frostWallPlacements.length}+ice-pillar:${icePillarPlacements.length}`;
      this.renderer.domElement.dataset.environmentComposition = 'access-bore+reinforced-extraction-tunnel+subglacial-vault';
      this.renderer.domElement.dataset.environmentTunnelSequence = 'access-bore>extraction-tunnel>subglacial-vault';
      this.renderer.domElement.dataset.environmentMaterials = 'frozen-rock+support-steel+frost-ice+cold-cyan';
      this.renderer.domElement.dataset.environmentZoneIdentity = 'access-bore:frost-wall-cut|extraction-tunnel:steel-support-frames+service-deck+cryo-pumps|subglacial-vault:ice-pillar-cluster+coolant-manifolds+freeze-compressors';
      this.renderer.domElement.dataset.readabilityLanguage = 'frost-wall-corridor+support-frame-rhythm+cyan-service-deck+vault-pillars+cold-cyan-machinery';
    } catch (error) {
      loaded.forEach(item => item.instance.release());
      if (this.disposed || generation !== this.iceMineLoadGeneration) return;
      this.iceMineBrittleSupportVisuals.clear();
      this.iceMineFractureRoots.clear();
      this.iceMineFractureCracks.clear();
      this.iceMineFractureShards.clear();
      this.iceMineFracturePulses.clear();
      this.iceMineCollapseStartedAt.clear();
      this.iceMineBrittleSupportLastActive.clear();
      this.refineryInstancedMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.dispose();
      });
      this.refineryInstancedMeshes.length = 0;
      this.refineryOwnedMaterials.forEach(material => material.dispose());
      this.refineryOwnedMaterials.length = 0;
      this.authoredEnvironmentRoot.clear();
      this.proceduralRefineryVisuals.forEach(item => { item.visible = true; });
      this.renderer.domElement.dataset.environmentVisual = 'procedural-fallback';
      delete this.renderer.domElement.dataset.environmentLandmark;
      delete this.renderer.domElement.dataset.environmentServiceDetails;
      delete this.renderer.domElement.dataset.environmentSurfaceDetail;
      delete this.renderer.domElement.dataset.environmentComposition;
      delete this.renderer.domElement.dataset.environmentTunnelSequence;
      delete this.renderer.domElement.dataset.environmentMachineDetail;
      delete this.renderer.domElement.dataset.environmentBrittleSupports;
      delete this.renderer.domElement.dataset.environmentBrittleSupportState;
      delete this.renderer.domElement.dataset.environmentBrittleSupportIds;
      delete this.renderer.domElement.dataset.environmentZoneIdentity;
      delete this.renderer.domElement.dataset.environmentMaterials;
      delete this.renderer.domElement.dataset.readabilityLanguage;
      console.warn('Authored Ice Mine bore/tunnel kit failed to load; keeping procedural scenery.', error);
    }
  }

  private async loadAuthoredSolarYardEnvironment(state: SimState, worldW: number, worldH: number, detailScale: number) {
    const generation = ++this.solarYardLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
    const profile = solarYardRenderProfile(detailScale, this.coarse);
    const assetDetailScale = profile.assetDetailScale;
    const loaded: Array<{ key: keyof typeof SOLAR_YARD_ASSET_FAMILIES; instance: GraphicsAssetInstance; lod: number }> = [];

    try {
      for (const key of Object.keys(SOLAR_YARD_ASSET_FAMILIES) as Array<keyof typeof SOLAR_YARD_ASSET_FAMILIES>) {
        const spec = selectGraphicsAssetSpec(SOLAR_YARD_ASSET_FAMILIES[key], assetDetailScale);
        if (!spec) throw new Error(`No authored Solar Yard asset available for ${key}`);
        const instance = await instantiateGraphicsAsset(spec);
        loaded.push({ key, instance, lod: spec.lod });
      }

      if (this.disposed || generation !== this.solarYardLoadGeneration) {
        loaded.forEach(item => item.instance.release());
        return;
      }

      const byKey = new Map(loaded.map(item => [item.key, item]));
      const width = scaled(worldW);
      const height = scaled(worldH);

      const ceramicDeckPlacementsAll: EnvironmentPlacement[] = [
        [0.24, 0.27, 0, 0.94], [0.50, 0.27, 0, 0.96], [0.76, 0.27, 0, 0.94],
        [0.26, 0.73, Math.PI, 0.94], [0.52, 0.73, Math.PI, 0.96], [0.78, 0.73, Math.PI, 0.94],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0.01, height * z),
        rotationY,
        scale,
      }));
      const ceramicDeckPlacements = ceramicDeckPlacementsAll.filter((_, index) => profile.ceramicDeckInstances === 6 || [0, 2, 3, 5].includes(index));

      const trussFramePlacementsAll: EnvironmentPlacement[] = [
        [0.18, 0.50, 0.92], [0.34, 0.50, 0.96], [0.50, 0.50, 1.04], [0.66, 0.50, 0.96], [0.82, 0.50, 0.92],
      ].map(([x, z, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY: 0,
        scale,
      }));
      const trussFramePlacements = trussFramePlacementsAll.filter((_, index) => profile.trussFrameInstances === 5 || [0, 2, 4].includes(index));

      const radiatorTowerPlacementsAll: EnvironmentPlacement[] = [
        [0.14, 0.22, 0.86], [0.14, 0.78, 0.86], [0.86, 0.22, 0.90], [0.86, 0.78, 0.90],
      ].map(([x, z, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY: x < 0.5 ? Math.PI / 2 : -Math.PI / 2,
        scale,
      }));
      const radiatorTowerPlacements = radiatorTowerPlacementsAll.filter((_, index) => profile.radiatorTowerInstances === 4 || index === 0 || index === 3);

      const reflectorPylonPlacements: EnvironmentPlacement[] = [
        [0.72, 0.22, Math.PI / 2, 0.90],
        [0.82, 0.50, Math.PI / 2, 1.04],
        [0.72, 0.78, Math.PI / 2, 0.90],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));

      const sinterForgePlacementsAll: EnvironmentPlacement[] = [
        [0.40, 0.38, Math.PI / 2, 0.90],
        [0.58, 0.62, -Math.PI / 2, 0.94],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));
      const sinterForgePlacements = sinterForgePlacementsAll.filter((_, index) => profile.sinterForgeInstances === 2 || index === 0);

      const printerSpindlePlacementsAll: EnvironmentPlacement[] = [
        [0.26, 0.36, 0, 0.88],
        [0.50, 0.50, 0, 0.94],
        [0.74, 0.34, Math.PI, 0.90],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));
      const printerSpindlePlacements = printerSpindlePlacementsAll.filter((_, index) => profile.printerSpindleInstances === 3 || index === 0 || index === 2);

      const feedstockPressPlacementsAll: EnvironmentPlacement[] = [
        [0.34, 0.68, Math.PI / 2, 0.88],
        [0.68, 0.70, -Math.PI / 2, 0.90],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));
      const feedstockPressPlacements = feedstockPressPlacementsAll.filter((_, index) => profile.feedstockPressInstances === 2 || index === 0);

      const transferRailPlacementsAll: EnvironmentPlacement[] = [
        [0.22, 0.50, 0.86],
        [0.50, 0.50, 0.92],
        [0.78, 0.50, 0.86],
      ].map(([x, z, scale]) => ({
        position: new THREE.Vector3(width * x, 0.02, height * z),
        rotationY: 0,
        scale,
      }));
      const transferRailPlacements = transferRailPlacementsAll.filter((_, index) => profile.transferRailInstances === 3 || index === 0 || index === 2);

      const gantryCranePlacementsAll = [
        { x: 0.34, z: 0.50, scale: 0.72, phase: 0, amplitude: 2.06, speed: 0.48 },
        { x: 0.66, z: 0.50, scale: 0.76, phase: Math.PI * 0.72, amplitude: 1.78, speed: 0.56 },
      ] as const;
      const gantryCranePlacements = profile.gantryCraneInstances === 2
        ? gantryCranePlacementsAll
        : [{ x: 0.50, z: 0.50, scale: 0.74, phase: Math.PI * 0.36, amplitude: 1.92, speed: 0.52 }] as const;

      const thermalShutterControl = state.objects.find(object => object.id === 'solar-shutter');
      if (!thermalShutterControl) throw new Error('Solar Yard thermal shutter control is missing from encounter state');
      const thermalShutterRoot = byKey.get('thermalShutter')!.instance.root;
      thermalShutterRoot.name = 'solar-yard-thermal-shutter-authored';
      thermalShutterRoot.position.set(
        scaled(thermalShutterControl.x + thermalShutterControl.w / 2),
        0.02,
        scaled(thermalShutterControl.y + thermalShutterControl.h / 2),
      );
      thermalShutterRoot.rotation.y = Math.PI / 2;
      thermalShutterRoot.scale.setScalar(this.coarse ? 0.58 : 0.64);
      thermalShutterRoot.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = profile.environmentShadows;
        mesh.receiveShadow = true;
      });
      this.authoredEnvironmentRoot.add(thermalShutterRoot);
      this.solarYardThermalShutterRoot = thermalShutterRoot;
      this.solarYardThermalShutterLeft = thermalShutterRoot.getObjectByName('solar-yard-thermal-shutter-panel-left') ?? null;
      this.solarYardThermalShutterRight = thermalShutterRoot.getObjectByName('solar-yard-thermal-shutter-panel-right') ?? null;
      if (!this.solarYardThermalShutterLeft || !this.solarYardThermalShutterRight) {
        throw new Error('Authored Solar Yard thermal shutter is missing stateful panel nodes');
      }

      this.solarYardGantryCraneTrolleys.length = 0;
      const gantryCraneTemplate = byKey.get('gantryCrane')!.instance.root;
      for (const [index, placement] of gantryCranePlacements.entries()) {
        const root = index === 0 ? gantryCraneTemplate : gantryCraneTemplate.clone(true);
        root.name = `solar-yard-gantry-crane-authored-${index + 1}`;
        root.position.set(width * placement.x, 0.02, height * placement.z);
        root.rotation.y = 0;
        root.scale.setScalar(placement.scale);
        root.traverse(child => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = profile.environmentShadows;
          mesh.receiveShadow = true;
        });
        const trolley = root.getObjectByName('solar-yard-gantry-crane-trolley');
        if (!trolley) throw new Error('Authored Solar Yard gantry crane is missing its moving trolley node');
        this.authoredEnvironmentRoot.add(root);
        this.solarYardGantryCraneTrolleys.push({
          trolley,
          phase: placement.phase,
          amplitude: placement.amplitude,
          speed: placement.speed,
        });
      }

      let instances = 1 + gantryCranePlacements.length;
      instances += this.addInstancedEnvironmentAsset(byKey.get('ceramicDeck')!.instance, ceramicDeckPlacements, 'solar-yard-ceramic-deck', this.authoredEnvironmentRoot, profile.environmentShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('trussFrame')!.instance, trussFramePlacements, 'solar-yard-truss-frame', this.authoredEnvironmentRoot, profile.environmentShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('radiatorTower')!.instance, radiatorTowerPlacements, 'solar-yard-radiator-tower', this.authoredEnvironmentRoot, profile.environmentShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('reflectorPylon')!.instance, reflectorPylonPlacements, 'solar-yard-reflector-pylon', this.authoredEnvironmentRoot, profile.environmentShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('sinterForge')!.instance, sinterForgePlacements, 'solar-yard-sinter-forge', this.authoredEnvironmentRoot, profile.environmentShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('printerSpindle')!.instance, printerSpindlePlacements, 'solar-yard-printer-spindle', this.authoredEnvironmentRoot, profile.environmentShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('feedstockPress')!.instance, feedstockPressPlacements, 'solar-yard-feedstock-press', this.authoredEnvironmentRoot, profile.environmentShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('transferRail')!.instance, transferRailPlacements, 'solar-yard-transfer-rail', this.authoredEnvironmentRoot, profile.environmentShadows);

      this.refineryAssetInstances.push(...loaded.map(item => item.instance));
      this.proceduralRefineryVisuals.forEach(item => { item.visible = false; });
      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-solar-yard';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'ceramic-deck,truss-frame,radiator-tower,reflector-pylon,sinter-forge,printer-spindle,feedstock-press,transfer-rail,gantry-crane,thermal-shutter';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentPerformanceProfile = `${profile.name}:lod${lods.join(',')}:structure-shadows-${profile.environmentShadows ? 'on' : 'off'}`;
      this.renderer.domElement.dataset.environmentInstanceBudget = `deck:${ceramicDeckPlacements.length}+truss:${trussFramePlacements.length}+radiator:${radiatorTowerPlacements.length}+reflector:${reflectorPylonPlacements.length}+machines:${sinterForgePlacements.length + printerSpindlePlacements.length + feedstockPressPlacements.length}+rail:${transferRailPlacements.length}+crane:${gantryCranePlacements.length}+shutter:1`;
      this.renderer.domElement.dataset.environmentShadowCasters = profile.environmentShadows ? 'solar-yard-structures+gameplay-actors' : 'gameplay-actors-only';
      this.renderer.domElement.dataset.environmentLandmark = 'gold-reflector-pylon-row';
      this.renderer.domElement.dataset.environmentServiceDetails = `ceramic-deck:${ceramicDeckPlacements.length}+truss-frame:${trussFramePlacements.length}+radiator-tower:${radiatorTowerPlacements.length}+thermal-shutter:1`;
      this.renderer.domElement.dataset.environmentTransport = `transfer-rail:${transferRailPlacements.length}+gantry-crane:${gantryCranePlacements.length}`;
      this.renderer.domElement.dataset.environmentSurfaceDetail = `reflector-pylon:${reflectorPylonPlacements.length}+ceramic-deck:${ceramicDeckPlacements.length}`;
      this.renderer.domElement.dataset.environmentMachineDetail = `sinter-forge:${sinterForgePlacements.length}+printer-spindle:${printerSpindlePlacements.length}+feedstock-press:${feedstockPressPlacements.length}`;
      this.renderer.domElement.dataset.environmentComposition = 'shade-service-deck+fabrication-spine+sunward-work-yard';
      this.renderer.domElement.dataset.environmentMaterials = 'ceramic-shell+scorched-steel+black-radiator+solar-gold+heat-amber';
      this.renderer.domElement.dataset.environmentZoneIdentity = 'shade:ceramic-deck+radiator-towers+thermal-shutter|spine:truss-frames+sinter-forges+transfer-rails+gantry-cranes|sunward:reflector-pylons+printer-spindles+feedstock-presses';
      this.renderer.domElement.dataset.readabilityLanguage = 'ceramic-deck+black-radiators+gold-reflectors+amber-hot-work+moving-gold-cranes';
    } catch (error) {
      loaded.forEach(item => item.instance.release());
      if (this.disposed || generation !== this.solarYardLoadGeneration) return;
      this.refineryInstancedMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.dispose();
      });
      this.refineryInstancedMeshes.length = 0;
      this.refineryOwnedMaterials.forEach(material => material.dispose());
      this.refineryOwnedMaterials.length = 0;
      this.authoredEnvironmentRoot.clear();
      this.solarYardThermalShutterRoot = null;
      this.solarYardThermalShutterLeft = null;
      this.solarYardThermalShutterRight = null;
      this.solarYardGantryCraneTrolleys.length = 0;
      this.proceduralRefineryVisuals.forEach(item => { item.visible = true; });
      this.renderer.domElement.dataset.environmentVisual = 'procedural-fallback';
      delete this.renderer.domElement.dataset.environmentLandmark;
      delete this.renderer.domElement.dataset.environmentServiceDetails;
      delete this.renderer.domElement.dataset.environmentSurfaceDetail;
      delete this.renderer.domElement.dataset.environmentMachineDetail;
      delete this.renderer.domElement.dataset.environmentComposition;
      delete this.renderer.domElement.dataset.environmentZoneIdentity;
      delete this.renderer.domElement.dataset.environmentMaterials;
      delete this.renderer.domElement.dataset.environmentThermalShutters;
      delete this.renderer.domElement.dataset.environmentThermalProtection;
      delete this.renderer.domElement.dataset.environmentThermalShutterControl;
      delete this.renderer.domElement.dataset.environmentTransport;
      delete this.renderer.domElement.dataset.environmentCraneMotion;
      delete this.renderer.domElement.dataset.environmentCraneOffsets;
      delete this.renderer.domElement.dataset.environmentPerformanceProfile;
      delete this.renderer.domElement.dataset.environmentInstanceBudget;
      delete this.renderer.domElement.dataset.environmentShadowCasters;
      delete this.renderer.domElement.dataset.readabilityLanguage;
      console.warn('Authored Solar Yard fabrication kit failed to load; keeping procedural scenery.', error);
    }
  }

  private async loadAuthoredSpinHabitatEnvironment(worldW: number, worldH: number, detailScale: number) {
    const generation = ++this.spinHabitatLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
    const profile = spinHabitatRenderProfile(detailScale, this.coarse);
    const loaded: Array<{ key: keyof typeof SPIN_HABITAT_ASSET_FAMILIES; instance: GraphicsAssetInstance; lod: number }> = [];

    try {
      for (const key of Object.keys(SPIN_HABITAT_ASSET_FAMILIES) as Array<keyof typeof SPIN_HABITAT_ASSET_FAMILIES>) {
        const spec = selectGraphicsAssetSpec(SPIN_HABITAT_ASSET_FAMILIES[key], profile.assetDetailScale);
        if (!spec) throw new Error(`No authored Spin Habitat asset available for ${key}`);
        const instance = await instantiateGraphicsAsset(spec);
        loaded.push({ key, instance, lod: spec.lod });
      }

      if (this.disposed || generation !== this.spinHabitatLoadGeneration) {
        loaded.forEach(item => item.instance.release());
        return;
      }

      this.refineryAssetInstances.push(...loaded.map(item => item.instance));
      const byKey = new Map(loaded.map(item => [item.key, item]));
      const width = scaled(worldW);
      const height = scaled(worldH);

      const rotorRoot = new THREE.Group();
      rotorRoot.name = 'spin-habitat-rotating-frame';
      rotorRoot.position.set(width * 0.50, 0, height * 0.50);
      rotorRoot.rotation.y = this.spinHabitatRotationY;
      this.authoredEnvironmentRoot.add(rotorRoot);
      this.spinHabitatAuthoredRotor = rotorRoot;

      const ringPlacementsAll: EnvironmentPlacement[] = [
        [0.22, 0.12, 0, 0.92], [0.50, 0.11, 0, 0.96], [0.78, 0.12, 0, 0.92],
        [0.22, 0.88, Math.PI, 0.92], [0.50, 0.89, Math.PI, 0.96], [0.78, 0.88, Math.PI, 0.92],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * (x - 0.50), 0, height * (z - 0.50)),
        rotationY,
        scale,
      }));
      const ringPlacements = ringPlacementsAll.filter((_, index) => profile.ringInstances === 6 || [0, 2, 3, 5].includes(index));

      const spokePlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(0, 0, height * -0.20), rotationY: Math.PI / 2, scale: 0.88 },
        { position: new THREE.Vector3(0, 0, height * 0.20), rotationY: Math.PI / 2, scale: 0.88 },
        { position: new THREE.Vector3(width * -0.20, 0, 0), rotationY: 0, scale: 0.88 },
        { position: new THREE.Vector3(width * 0.20, 0, 0), rotationY: 0, scale: 0.88 },
      ];

      const hubPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.50, 0, height * 0.50), rotationY: Math.PI / 4, scale: 1.04 },
      ];

      const servicePlacementsAll: EnvironmentPlacement[] = [
        [0.18, 0.28, Math.PI / 2], [0.82, 0.30, -Math.PI / 2], [0.20, 0.72, Math.PI / 2], [0.80, 0.70, -Math.PI / 2],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * (x - 0.50), 0, height * (z - 0.50)),
        rotationY,
        scale: 0.90,
      }));
      const servicePlacements = servicePlacementsAll.filter((_, index) => profile.serviceInstances === 4 || index === 0 || index === 3);

      let instances = 0;
      instances += this.addInstancedEnvironmentAsset(byKey.get('ringSegment')!.instance, ringPlacements, 'spin-habitat-ring-segment', rotorRoot, profile.movingShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('spokeTruss')!.instance, spokePlacements, 'spin-habitat-spoke-truss', rotorRoot, profile.movingShadows);
      instances += this.addInstancedEnvironmentAsset(byKey.get('axisHub')!.instance, hubPlacements, 'spin-habitat-axis-hub');
      instances += this.addInstancedEnvironmentAsset(byKey.get('serviceBay')!.instance, servicePlacements, 'spin-habitat-service-bay', rotorRoot, profile.movingShadows);

      this.proceduralRefineryVisuals.forEach(item => { item.visible = false; });
      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-spin-habitat';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'ring-segment,spoke-truss,axis-hub,service-bay';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentPerformanceProfile = `${profile.name}:lod${lods.join(',')}:rotor-shadows-${profile.movingShadows ? 'on' : 'off'}`;
      this.renderer.domElement.dataset.environmentInstanceBudget = `ring:${ringPlacements.length}+spoke:${spokePlacements.length}+axis:${hubPlacements.length}+service:${servicePlacements.length}`;
      this.renderer.domElement.dataset.environmentShadowCasters = profile.movingShadows ? 'rotor+axis' : 'axis-only';
      this.renderer.domElement.dataset.environmentLandmark = 'central-axis-hub';
      this.renderer.domElement.dataset.environmentServiceDetails = `service-bay:${servicePlacements.length}`;
      this.renderer.domElement.dataset.environmentSurfaceDetail = `ring-segment:${ringPlacements.length}+spoke-truss:${spokePlacements.length}`;
      this.renderer.domElement.dataset.environmentMachineDetail = 'axis-hub:1';
      this.renderer.domElement.dataset.environmentComposition = 'rotating-ring-arc+rotating-cross-spokes+stationary-axis';
      this.renderer.domElement.dataset.environmentMotion = 'gravity-coupled-rigid-rotation';
      this.renderer.domElement.dataset.environmentSpinSource = 'sector-A-gravity';
      this.renderer.domElement.dataset.environmentMaterials = 'rim-green-plating+spoke-dark-cyan+axis-bright-cool+service-amber';
      this.renderer.domElement.dataset.environmentZoneIdentity = 'rim:plated-green-deck|spoke:skeletal-cyan-truss|axis:bright-stationary-tower';
      this.renderer.domElement.dataset.readabilityLanguage = 'rim-plated-green+spoke-skeletal-cyan+axis-bright-stationary';
    } catch (error) {
      loaded.forEach(item => item.instance.release());
      if (this.disposed || generation !== this.spinHabitatLoadGeneration) return;
      this.refineryAssetInstances.length = 0;
      this.refineryInstancedMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.dispose();
      });
      this.refineryInstancedMeshes.length = 0;
      this.refineryOwnedMaterials.forEach(material => material.dispose());
      this.refineryOwnedMaterials.length = 0;
      this.authoredEnvironmentRoot.clear();
      this.spinHabitatAuthoredRotor = null;
      this.proceduralRefineryVisuals.forEach(item => { item.visible = true; });
      this.renderer.domElement.dataset.environmentVisual = 'procedural-fallback';
      delete this.renderer.domElement.dataset.environmentLandmark;
      delete this.renderer.domElement.dataset.environmentServiceDetails;
      delete this.renderer.domElement.dataset.environmentSurfaceDetail;
      delete this.renderer.domElement.dataset.environmentMachineDetail;
      delete this.renderer.domElement.dataset.environmentComposition;
      delete this.renderer.domElement.dataset.environmentZoneIdentity;
      delete this.renderer.domElement.dataset.environmentMaterials;
      delete this.renderer.domElement.dataset.environmentPerformanceProfile;
      delete this.renderer.domElement.dataset.environmentInstanceBudget;
      delete this.renderer.domElement.dataset.environmentShadowCasters;
      delete this.renderer.domElement.dataset.readabilityLanguage;
      console.warn('Authored Spin Habitat kit failed to load; keeping procedural scenery.', error);
    }
  }

  private async loadAuthoredParallaxEnvironment(state: SimState, worldW: number, worldH: number, detailScale: number) {
    const generation = ++this.parallaxLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
    const loaded: Array<{ key: keyof typeof PARALLAX_ASSET_FAMILIES; instance: GraphicsAssetInstance; lod: number }> = [];

    try {
      for (const key of Object.keys(PARALLAX_ASSET_FAMILIES) as Array<keyof typeof PARALLAX_ASSET_FAMILIES>) {
        const spec = selectGraphicsAssetSpec(PARALLAX_ASSET_FAMILIES[key], detailScale);
        if (!spec) throw new Error(`No authored Parallax asset available for ${key}`);
        const instance = await instantiateGraphicsAsset(spec);
        loaded.push({ key, instance, lod: spec.lod });
      }

      if (this.disposed || generation !== this.parallaxLoadGeneration) {
        loaded.forEach(item => item.instance.release());
        return;
      }

      this.refineryAssetInstances.push(...loaded.map(item => item.instance));
      const byKey = new Map(loaded.map(item => [item.key, item]));
      const width = scaled(worldW);
      const height = scaled(worldH);

      const pylonObjects = state.objects
        .filter(object => object.active && object.id.startsWith('reference-node-'))
        .slice(0, 3);
      const pylonPlacements: EnvironmentPlacement[] = pylonObjects.length === 3
        ? pylonObjects.map((object, index) => ({
            position: new THREE.Vector3(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2)),
            rotationY: [0.18, Math.PI * 0.72, -Math.PI * 0.58][index],
            scale: 0.92,
          }))
        : [
            { position: new THREE.Vector3(width * 0.24, 0, height * 0.28), rotationY: 0.18, scale: 0.92 },
            { position: new THREE.Vector3(width * 0.50, 0, height * 0.72), rotationY: Math.PI * 0.72, scale: 0.92 },
            { position: new THREE.Vector3(width * 0.76, 0, height * 0.30), rotationY: -Math.PI * 0.58, scale: 0.92 },
          ];

      const frameObjects = state.objects
        .filter(object => object.active && object.id.startsWith('parallax-frame-'))
        .slice(0, 3);
      const framePlacements: EnvironmentPlacement[] = frameObjects.length > 0
        ? frameObjects.map((object, index) => ({
            position: new THREE.Vector3(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2)),
            rotationY: index === 1 ? Math.PI / 2 : 0,
            scale: 0.88,
          }))
        : [
            { position: new THREE.Vector3(width * 0.34, 0, height * 0.38), rotationY: 0, scale: 0.88 },
            { position: new THREE.Vector3(width * 0.50, 0, height * 0.62), rotationY: Math.PI / 2, scale: 0.88 },
            { position: new THREE.Vector3(width * 0.66, 0, height * 0.40), rotationY: 0, scale: 0.88 },
          ];

      const carriagePlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.18, 0, height * 0.53), rotationY: Math.PI / 2, scale: 0.92 },
        { position: new THREE.Vector3(width * 0.50, 0, height * 0.22), rotationY: 0, scale: 0.94 },
        { position: new THREE.Vector3(width * 0.82, 0, height * 0.58), rotationY: -Math.PI / 2, scale: 0.92 },
      ];

      const shearAnchorPlacements: EnvironmentPlacement[] = [
        [0.10, 0.18, 0], [0.10, 0.50, 0], [0.10, 0.82, 0],
        [0.90, 0.18, Math.PI], [0.90, 0.50, Math.PI], [0.90, 0.82, Math.PI],
        [0.32, 0.10, Math.PI / 2], [0.68, 0.90, -Math.PI / 2],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale: 0.86,
      }));

      const consolePlacements: EnvironmentPlacement[] = pylonPlacements.map((placement, index) => ({
        position: placement.position.clone().add(new THREE.Vector3(index === 1 ? -1.7 : 1.55, 0, index === 2 ? -1.2 : 1.0)),
        rotationY: (placement.rotationY ?? 0) + Math.PI / 2,
        scale: 0.90,
      }));

      let instances = 0;
      instances += this.addInstancedEnvironmentAsset(byKey.get('pylon')!.instance, pylonPlacements, 'parallax-baseline-pylon');
      instances += this.addInstancedEnvironmentAsset(byKey.get('frame')!.instance, framePlacements, 'parallax-reference-frame');
      instances += this.addInstancedEnvironmentAsset(byKey.get('massCarriage')!.instance, carriagePlacements, 'parallax-mass-carriage');
      instances += this.addInstancedEnvironmentAsset(byKey.get('shearAnchor')!.instance, shearAnchorPlacements, 'parallax-shear-anchor');
      instances += this.addInstancedEnvironmentAsset(byKey.get('console')!.instance, consolePlacements, 'parallax-reference-console');

      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-parallax-array';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'baseline-pylon,reference-frame,mass-carriage,shear-anchor,reference-console';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentTerminals = String(consolePlacements.length);
      this.renderer.domElement.dataset.environmentLandmark = 'three-point-long-baseline';
      this.renderer.domElement.dataset.environmentServiceDetails = `reference-console:${consolePlacements.length}+mass-carriage:${carriagePlacements.length}`;
      this.renderer.domElement.dataset.environmentSurfaceDetail = `reference-frame:${framePlacements.length}+shear-anchor:${shearAnchorPlacements.length}`;
      this.renderer.domElement.dataset.environmentMachineDetail = `baseline-pylon:${pylonPlacements.length}+mass-carriage:${carriagePlacements.length}`;
      this.renderer.domElement.dataset.environmentComposition = 'three-point-baseline+cross-track-frames+perimeter-shear-anchors';
      this.renderer.domElement.dataset.environmentMaterials = 'graphite-structure+reference-shell+violet-alignment+cyan-readout';
      this.renderer.domElement.dataset.environmentVfx = 'reference-shear-procedural+authored-emissive-calibration';
      this.renderer.domElement.dataset.readabilityLanguage = 'baseline-silhouette+violet-cyan+luminance';
    } catch (error) {
      loaded.forEach(item => item.instance.release());
      if (this.disposed || generation !== this.parallaxLoadGeneration) return;
      this.refineryAssetInstances.length = 0;
      this.refineryInstancedMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.dispose();
      });
      this.refineryInstancedMeshes.length = 0;
      this.refineryOwnedMaterials.forEach(material => material.dispose());
      this.refineryOwnedMaterials.length = 0;
      this.authoredEnvironmentRoot.clear();
      this.renderer.domElement.dataset.environmentVisual = 'procedural-fallback';
      delete this.renderer.domElement.dataset.environmentLandmark;
      delete this.renderer.domElement.dataset.environmentServiceDetails;
      delete this.renderer.domElement.dataset.environmentSurfaceDetail;
      delete this.renderer.domElement.dataset.environmentMachineDetail;
      delete this.renderer.domElement.dataset.environmentComposition;
      delete this.renderer.domElement.dataset.environmentMaterials;
      delete this.renderer.domElement.dataset.environmentVfx;
      delete this.renderer.domElement.dataset.readabilityLanguage;
      console.warn('Authored Cislunar Parallax Array kit failed to load; keeping procedural scenery.', error);
    }
  }

  private async loadAuthoredDamagedVesselEnvironment(worldW: number, worldH: number, detailScale: number) {
    const generation = ++this.damagedVesselLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
    const loaded: Array<{ key: keyof typeof DAMAGED_VESSEL_ASSET_FAMILIES; instance: GraphicsAssetInstance; lod: number }> = [];

    try {
      for (const key of Object.keys(DAMAGED_VESSEL_ASSET_FAMILIES) as Array<keyof typeof DAMAGED_VESSEL_ASSET_FAMILIES>) {
        const spec = selectGraphicsAssetSpec(DAMAGED_VESSEL_ASSET_FAMILIES[key], detailScale);
        if (!spec) throw new Error(`No authored damaged-vessel asset available for ${key}`);
        const instance = await instantiateGraphicsAsset(spec);
        loaded.push({ key, instance, lod: spec.lod });
      }

      if (this.disposed || generation !== this.damagedVesselLoadGeneration) {
        loaded.forEach(item => item.instance.release());
        return;
      }

      this.refineryAssetInstances.push(...loaded.map(item => item.instance));
      const byKey = new Map(loaded.map(item => [item.key, item]));
      const width = scaled(worldW);
      const height = scaled(worldH);

      const ribPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.82, 0, height * 0.22), rotationY: Math.PI, scale: 0.94 },
        { position: new THREE.Vector3(width * 0.84, 0, height * 0.36), rotationY: Math.PI - 0.10, scale: 1.02 },
        { position: new THREE.Vector3(width * 0.85, 0, height * 0.50), rotationY: Math.PI + 0.06, scale: 1.08 },
        { position: new THREE.Vector3(width * 0.84, 0, height * 0.64), rotationY: Math.PI - 0.05, scale: 1.00 },
        { position: new THREE.Vector3(width * 0.82, 0, height * 0.78), rotationY: Math.PI + 0.09, scale: 0.92 },
      ];
      const breachPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.91, 0, height * 0.50), rotationY: Math.PI, scale: 1.05 },
      ];
      const salvagePlacements: EnvironmentPlacement[] = [
        [0.16, 0.24, 0.06], [0.17, 0.40, -0.05], [0.16, 0.72, 0.08],
        [0.38, 0.86, Math.PI], [0.56, 0.86, Math.PI], [0.72, 0.84, Math.PI - 0.05],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale: 0.94,
      }));
      const tornPlatePlacements: EnvironmentPlacement[] = [
        [0.88, 0.28, Math.PI / 2, 0.96],
        [0.89, 0.70, Math.PI / 2, 1.04],
        [0.12, 0.32, -Math.PI / 2, 0.92],
        [0.11, 0.68, -Math.PI / 2, 0.98],
        [0.42, 0.10, 0, 0.94],
        [0.64, 0.90, Math.PI, 0.90],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));
      const serviceBundlePlacements: EnvironmentPlacement[] = [
        [0.86, 0.35, Math.PI / 2, 0.92],
        [0.87, 0.63, Math.PI / 2, 0.96],
        [0.14, 0.50, -Math.PI / 2, 0.90],
        [0.34, 0.12, 0, 0.88],
        [0.68, 0.88, Math.PI, 0.90],
      ].map(([x, z, rotationY, scale]) => ({
        position: new THREE.Vector3(width * x, 0, height * z),
        rotationY,
        scale,
      }));

      let instances = 0;
      instances += this.addInstancedDamagedVesselAsset(byKey.get('rib')!.instance, ribPlacements, 'damaged-vessel-broken-rib');
      instances += this.addInstancedDamagedVesselAsset(byKey.get('breachFrame')!.instance, breachPlacements, 'damaged-vessel-breach-frame');
      instances += this.addInstancedDamagedVesselAsset(byKey.get('salvageRack')!.instance, salvagePlacements, 'damaged-vessel-salvage-rack');
      instances += this.addInstancedDamagedVesselAsset(byKey.get('tornPlate')!.instance, tornPlatePlacements, 'damaged-vessel-torn-wall-plate');
      instances += this.addInstancedDamagedVesselAsset(byKey.get('serviceBundle')!.instance, serviceBundlePlacements, 'damaged-vessel-service-bundle');
      this.buildDamagedVesselAtmospherics(width, height);

      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-damaged-vessel';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'broken-rib,breach-frame,salvage-rack,torn-plate,service-bundle';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentLandmark = 'starboard-hull-breach';
      this.renderer.domElement.dataset.environmentServiceDetails = `salvage-rack:${salvagePlacements.length}+service-bundle:${serviceBundlePlacements.length}`;
      this.renderer.domElement.dataset.environmentSurfaceDetail = `broken-rib:${ribPlacements.length}+torn-plate:${tornPlatePlacements.length}+scorch:6`;
      this.renderer.domElement.dataset.environmentComposition = 'broken-rib-corridor+starboard-breach+torn-shell+perimeter-salvage';
      this.renderer.domElement.dataset.environmentMaterials = 'scarred-hull+torn-edge+warning-emissive+salvage-status';
      this.renderer.domElement.dataset.environmentVfx = 'breach-vapor:18+scorch:6';
      this.renderer.domElement.dataset.readabilityLanguage = 'silhouette+damage-edge+breach-vapor+luminance';
    } catch (error) {
      loaded.forEach(item => item.instance.release());
      if (this.disposed || generation !== this.damagedVesselLoadGeneration) return;
      this.refineryAssetInstances.length = 0;
      this.refineryInstancedMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.dispose();
      });
      this.refineryInstancedMeshes.length = 0;
      this.refineryOwnedMaterials.forEach(material => material.dispose());
      this.refineryOwnedMaterials.length = 0;
      this.authoredEnvironmentRoot.clear();
      this.renderer.domElement.dataset.environmentVisual = 'procedural-fallback';
      delete this.renderer.domElement.dataset.environmentLandmark;
      delete this.renderer.domElement.dataset.environmentServiceDetails;
      delete this.renderer.domElement.dataset.environmentSurfaceDetail;
      delete this.renderer.domElement.dataset.environmentComposition;
      delete this.renderer.domElement.dataset.environmentMaterials;
      delete this.renderer.domElement.dataset.environmentVfx;
      delete this.renderer.domElement.dataset.readabilityLanguage;
      console.warn('Authored Damaged Vessel overlay failed to load; keeping procedural scenery.', error);
    }
  }

  private async loadAuthoredRefineryEnvironment(state: SimState, worldW: number, worldH: number, detailScale: number) {
    const generation = ++this.refineryLoadGeneration;
    this.renderer.domElement.dataset.environmentVisual = 'authored-loading';
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
      const floorPlacements: EnvironmentPlacement[] = [];
      for (const fx of [0.18, 0.34, 0.50, 0.66, 0.82]) {
        for (const fz of [0.20, 0.40, 0.60, 0.80]) {
          floorPlacements.push({ position: new THREE.Vector3(width * fx, 0.005, height * fz), scale: 1.35 });
        }
      }

      const floorGratePlacements: EnvironmentPlacement[] = [
        [0.34, 0.40, 0], [0.66, 0.40, Math.PI / 2],
        [0.34, 0.60, Math.PI / 2], [0.66, 0.60, 0],
        [0.18, 0.40, Math.PI / 2], [0.82, 0.40, 0],
        [0.18, 0.60, 0], [0.82, 0.60, Math.PI / 2],
      ].map(([x, z, rotationY]) => ({
        position: new THREE.Vector3(width * x, 0.010, height * z),
        rotationY,
        scale: 0.92,
      }));

      const bulkheadPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.14, 0, height * 0.24) },
        { position: new THREE.Vector3(width * 0.14, 0, height * 0.50) },
        { position: new THREE.Vector3(width * 0.14, 0, height * 0.76) },
        { position: new THREE.Vector3(width * 0.86, 0, height * 0.24), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.86, 0, height * 0.50), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.86, 0, height * 0.76), rotationY: Math.PI },
      ];

      const processorPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.29, 0, height * 0.67), rotationY: 0.14, scale: 0.96 },
        { position: new THREE.Vector3(cx, 0, height * 0.26), rotationY: 0, scale: 1.05 },
        { position: new THREE.Vector3(width * 0.71, 0, height * 0.67), rotationY: Math.PI - 0.14, scale: 0.96 },
      ];

      const pipePlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.26, 0, height * 0.14) },
        { position: new THREE.Vector3(width * 0.50, 0, height * 0.14) },
        { position: new THREE.Vector3(width * 0.74, 0, height * 0.14) },
        { position: new THREE.Vector3(width * 0.50, 0, height * 0.86), rotationY: Math.PI },
      ];

      const wallPanelPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.115, 0, height * 0.30) },
        { position: new THREE.Vector3(width * 0.115, 0, height * 0.50) },
        { position: new THREE.Vector3(width * 0.115, 0, height * 0.70) },
        { position: new THREE.Vector3(width * 0.885, 0, height * 0.30), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.885, 0, height * 0.50), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.885, 0, height * 0.70), rotationY: Math.PI },
      ];

      const cableTrayPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.095, 0, height * 0.20) },
        { position: new THREE.Vector3(width * 0.095, 0, height * 0.50) },
        { position: new THREE.Vector3(width * 0.095, 0, height * 0.80) },
        { position: new THREE.Vector3(width * 0.905, 0, height * 0.20), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.905, 0, height * 0.50), rotationY: Math.PI },
        { position: new THREE.Vector3(width * 0.905, 0, height * 0.80), rotationY: Math.PI },
      ];

      const serviceConduitPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(width * 0.08, 0, height * 0.24), rotationY: Math.PI / 2, scale: 0.92 },
        { position: new THREE.Vector3(width * 0.08, 0, height * 0.50), rotationY: Math.PI / 2, scale: 0.92 },
        { position: new THREE.Vector3(width * 0.08, 0, height * 0.76), rotationY: Math.PI / 2, scale: 0.92 },
        { position: new THREE.Vector3(width * 0.92, 0, height * 0.24), rotationY: -Math.PI / 2, scale: 0.92 },
        { position: new THREE.Vector3(width * 0.92, 0, height * 0.50), rotationY: -Math.PI / 2, scale: 0.92 },
        { position: new THREE.Vector3(width * 0.92, 0, height * 0.76), rotationY: -Math.PI / 2, scale: 0.92 },
      ];

      const gantryPlacements: EnvironmentPlacement[] = [
        { position: new THREE.Vector3(cx, 0, height * 0.09), scale: 0.96 },
      ];

      const cratePlacements: EnvironmentPlacement[] = [
        [0.22, 0.31, 0.1], [0.22, 0.69, -0.2], [0.38, 0.82, 0.12], [0.62, 0.20, -0.12],
        [0.78, 0.69, 0.2], [0.79, 0.34, -0.16], [0.18, 0.52, 0.08], [0.82, 0.48, -0.08],
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
      instances += this.addInstancedEnvironmentAsset(byKey.get('floorGrate')!.instance, floorGratePlacements, 'refinery-floor-service-grate');
      instances += this.addInstancedEnvironmentAsset(byKey.get('bulkhead')!.instance, bulkheadPlacements, 'refinery-bulkhead');
      instances += this.addInstancedEnvironmentAsset(byKey.get('processor')!.instance, processorPlacements, 'refinery-processor');
      instances += this.addInstancedEnvironmentAsset(byKey.get('pipeRack')!.instance, pipePlacements, 'refinery-pipe-rack');
      instances += this.addInstancedEnvironmentAsset(byKey.get('wallPanel')!.instance, wallPanelPlacements, 'refinery-wall-service-panel');
      instances += this.addInstancedEnvironmentAsset(byKey.get('cableTray')!.instance, cableTrayPlacements, 'refinery-cable-tray');
      instances += this.addInstancedEnvironmentAsset(byKey.get('serviceConduit')!.instance, serviceConduitPlacements, 'refinery-service-conduit');
      instances += this.addInstancedEnvironmentAsset(byKey.get('gantry')!.instance, gantryPlacements, 'refinery-smelter-gantry');
      instances += this.addInstancedEnvironmentAsset(byKey.get('crate')!.instance, cratePlacements, 'refinery-crate');
      instances += this.addInstancedEnvironmentAsset(byKey.get('terminal')!.instance, terminalPlacements, 'refinery-terminal');
      this.buildRefineryAtmospherics(width, height);

      this.proceduralRefineryVisuals.forEach(item => { item.visible = false; });
      const lods = [...new Set(loaded.map(item => item.lod))].sort();
      this.renderer.domElement.dataset.environmentVisual = 'authored-refinery';
      this.renderer.domElement.dataset.environmentLod = lods.join(',');
      this.renderer.domElement.dataset.environmentKit = 'floor,floor-grate,bulkhead,processor,pipe-rack,wall-panel,cable-tray,service-conduit,gantry,crate,terminal';
      this.renderer.domElement.dataset.environmentInstances = String(instances);
      this.renderer.domElement.dataset.environmentTerminals = String(terminalPlacements.length);
      this.renderer.domElement.dataset.environmentLandmark = 'ore-smelter-gantry';
      this.renderer.domElement.dataset.environmentServiceDetails = `service-conduit:${serviceConduitPlacements.length}`;
      this.renderer.domElement.dataset.environmentSurfaceDetail = `wall-panel:${wallPanelPlacements.length}+cable-tray:${cableTrayPlacements.length}+contact-darkening:10`;
      this.renderer.domElement.dataset.environmentMachineDetail = `processor-functional:3+floor-grate:${floorGratePlacements.length}`;
      this.renderer.domElement.dataset.environmentComposition = 'clear-center-lane+processor-triangle+gantry-focal+perimeter-clutter';
      this.renderer.domElement.dataset.environmentMaterials = 'pbr-bounded+emissive+decals:safety+grime+contact-darkening';
      this.renderer.domElement.dataset.environmentVfx = 'steam+sparse-sparks+debris+breach+objective';
      this.renderer.domElement.dataset.readabilityLanguage = 'shape+silhouette+luminance';
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
      delete this.renderer.domElement.dataset.environmentLandmark;
      delete this.renderer.domElement.dataset.environmentServiceDetails;
      delete this.renderer.domElement.dataset.environmentSurfaceDetail;
      delete this.renderer.domElement.dataset.environmentMachineDetail;
      delete this.renderer.domElement.dataset.environmentComposition;
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
    const spec = selectGraphicsAssetSpec(WEAPON_ASSET_FAMILIES[id], this.coarse ? 0.55 : 1);
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

  private async loadAuthoredOperator(operatorClass: SimState['build']['operatorClass']) {
    const family = operatorClass ? OPERATOR_CLASS_ASSET_FAMILIES[operatorClass] : OPERATOR_ASSET_FAMILY;
    const spec = selectGraphicsAssetSpec(family, this.coarse ? 0.55 : 1);
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
      this.renderer.domElement.dataset.operatorClassAsset = operatorClass ?? 'generic';
      this.renderer.domElement.dataset.operatorAnimation = this.authoredOperatorRig ? 'idle' : 'static';
      this.renderer.domElement.dataset.operatorBlend = this.authoredOperatorRig
        ? 'move:0.00,recoil:0.00,reload:0.00,dodge:0.00,hit:0.00'
        : '';
    } catch (error) {
      if (this.disposed) return;
      this.renderer.domElement.dataset.operatorVisual = 'procedural-fallback';
      this.renderer.domElement.dataset.operatorClassAsset = operatorClass ?? 'generic';
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
    const shadowSize = budget.shadowMapSize;
    if (this.keyLight.shadow.mapSize.x !== shadowSize || this.keyLight.shadow.mapSize.y !== shadowSize) {
      this.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
    }
    this.renderer.domElement.dataset.renderTier = budget.tierName;
    this.renderer.domElement.dataset.renderBudget = [
      `pixel:${budget.pixelRatioScale.toFixed(2)}`,
      `shadow:${budget.shadows ? budget.shadowMapSize : 0}`,
      `vfx:${budget.vfxDensity.toFixed(2)}`,
      `transparency:${budget.transparencyScale.toFixed(2)}`,
      `detail:${budget.detailScale.toFixed(2)}`,
    ].join('+');
  }

  private addMegastructureInstanceBatch(
    label: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    placements: Array<{ position: [number, number, number]; rotation?: [number, number, number] }>,
    castShadow: boolean,
  ) {
    if (placements.length === 0) {
      geometry.dispose();
      return null;
    }
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    const transform = new THREE.Object3D();
    placements.forEach((placement, index) => {
      const [rx, ry, rz] = placement.rotation ?? [0, 0, 0];
      transform.position.set(...placement.position);
      transform.rotation.set(rx, ry, rz);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = `megastructure-${label}`;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    mesh.frustumCulled = true;
    this.environmentRoot.add(mesh);
    return mesh;
  }

  private addPerseidCapstoneScenery(mission: Contract, worldW: number, worldH: number, detailScale: number) {
    const stage = perseidStageIdentity(mission);
    if (!stage) return;
    const profile = perseidRenderProfile(detailScale, this.coarse);
    const cx = scaled(worldW * 0.5);
    const cz = scaled(worldH * 0.5);
    const width = scaled(worldW);
    const height = scaled(worldH);
    const structural = new THREE.MeshStandardMaterial({ color: 0x43525a, metalness: 0.84, roughness: 0.38 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111a1f, metalness: 0.76, roughness: 0.48 });
    const guide = new THREE.MeshStandardMaterial({ color: 0x6aa88b, emissive: 0x4baf7f, emissiveIntensity: 0.5, metalness: 0.45, roughness: 0.28 });
    const stageAccent = new THREE.MeshStandardMaterial({
      color: stage.stage === 3 ? 0x75b7c8 : stage.stage === 4 ? 0xd2a35e : 0x6b927d,
      emissive: stage.stage === 3 ? 0x2e778a : stage.stage === 4 ? 0x8a5c25 : 0x315f4a,
      emissiveIntensity: 0.28,
      metalness: 0.56,
      roughness: 0.34,
    });

    const addMesh = (mesh: THREE.Mesh) => {
      mesh.castShadow = profile.castStructuralShadows;
      mesh.receiveShadow = profile.castStructuralShadows;
      this.environmentRoot.add(mesh);
      return mesh;
    };

    const keel = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.18, scaled(18)), structural));
    keel.position.set(cx, 0.28, cz);

    const ribPlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.ribPairs; index += 1) {
      const t = profile.ribPairs === 1 ? 0.5 : index / (profile.ribPairs - 1);
      const x = width * (0.18 + t * 0.64);
      ribPlacements.push(
        { position: [x, 0.36, height * 0.17] },
        { position: [x, 0.36, height * 0.83] },
      );
    }
    this.addMegastructureInstanceBatch(
      'perseid-ribs',
      new THREE.BoxGeometry(scaled(10), 0.72, height * 0.18),
      dark,
      ribPlacements,
      profile.castStructuralShadows,
    );

    const guidePlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.guideLights; index += 1) {
      const t = profile.guideLights === 1 ? 0.5 : index / (profile.guideLights - 1);
      guidePlacements.push({ position: [width * (0.2 + t * 0.6), 0.42, cz] });
    }
    this.addMegastructureInstanceBatch(
      'perseid-guides',
      new THREE.BoxGeometry(scaled(8), 0.06, scaled(3.5)),
      guide,
      guidePlacements,
      profile.castStructuralShadows,
    );

    const propCount = profile.stageProps;
    if (stage.stage === 1) {
      const collar = addMesh(new THREE.Mesh(new THREE.TorusGeometry(scaled(80), scaled(9), 8, 32), stageAccent));
      collar.rotation.x = Math.PI / 2;
      collar.position.set(width * 0.20, 0.62, cz);
      for (let index = 0; index < propCount; index += 1) {
        const rail = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.12, 0.14, scaled(6)), stageAccent));
        rail.position.set(width * (0.24 + index * 0.055), 0.34, cz + (index % 2 === 0 ? scaled(54) : -scaled(54)));
      }
    } else if (stage.stage === 2) {
      for (let index = 0; index < propCount; index += 1) {
        const row = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.14, 0.2, scaled(18)), index % 2 === 0 ? guide : dark));
        row.position.set(width * (0.26 + (index % 4) * 0.15), 0.3, height * (index < 4 ? 0.31 : 0.69));
      }
    } else if (stage.stage === 3) {
      for (let index = 0; index < propCount; index += 1) {
        const bank = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(scaled(16), scaled(16), scaled(62), 10), stageAccent));
        bank.rotation.z = Math.PI / 2;
        bank.position.set(width * (0.26 + (index % 4) * 0.15), 0.5, height * (index < 4 ? 0.30 : 0.70));
      }
    } else {
      for (let index = 0; index < propCount; index += 1) {
        const pylon = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(scaled(7), scaled(12), scaled(90), 8), stageAccent));
        pylon.position.set(width * (0.28 + (index % 4) * 0.14), scaled(45), height * (index < 4 ? 0.29 : 0.71));
      }
      const seal = addMesh(new THREE.Mesh(new THREE.TorusGeometry(scaled(58), scaled(8), 8, 28), stageAccent));
      seal.rotation.x = Math.PI / 2;
      seal.position.set(width * 0.78, 0.78, cz);
    }

    this.renderer.domElement.dataset.megastructureIdentity = 'generation-ship:perseid';
    this.renderer.domElement.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.renderer.domElement.dataset.megastructureContinuity = 'keel-spine+pressure-ribs+green-transit-datum';
    this.renderer.domElement.dataset.megastructureStageKit = stage.kit.join('+');
    this.renderer.domElement.dataset.megastructureBatching = 'instanced-continuity';
    this.renderer.domElement.dataset.megastructureContinuityDrawCalls = '2';
    this.renderer.domElement.dataset.megastructurePerformanceProfile = `${profile.name}:ribs-${profile.ribPairs}:guides-${profile.guideLights}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
  }

  private addK91CapstoneScenery(mission: Contract, worldW: number, worldH: number, detailScale: number) {
    const stage = k91StageIdentity(mission);
    if (!stage) return;
    const profile = k91RenderProfile(detailScale, this.coarse);
    const cx = scaled(worldW * 0.5);
    const cz = scaled(worldH * 0.5);
    const width = scaled(worldW);
    const height = scaled(worldH);
    const structural = new THREE.MeshStandardMaterial({ color: 0x4b555b, metalness: 0.86, roughness: 0.36 });
    const ballast = new THREE.MeshStandardMaterial({ color: 0x252d31, metalness: 0.8, roughness: 0.46 });
    const datum = new THREE.MeshStandardMaterial({ color: 0xd0a15f, emissive: 0xa76a26, emissiveIntensity: 0.58, metalness: 0.48, roughness: 0.28 });
    const stageAccent = new THREE.MeshStandardMaterial({
      color: stage.stage === 3 ? 0xc08b46 : stage.stage === 4 ? 0x8f735d : 0x87949a,
      emissive: stage.stage === 3 ? 0x7e4f1e : stage.stage === 4 ? 0x4b3529 : 0x33484f,
      emissiveIntensity: 0.26,
      metalness: 0.62,
      roughness: 0.36,
    });

    const addMesh = (mesh: THREE.Mesh) => {
      mesh.castShadow = profile.castStructuralShadows;
      mesh.receiveShadow = profile.castStructuralShadows;
      this.environmentRoot.add(mesh);
      return mesh;
    };

    const spine = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.74, 0.22, scaled(24)), structural));
    spine.position.set(cx, 0.3, cz);

    const railPlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.railPairs; index += 1) {
      const t = profile.railPairs === 1 ? 0.5 : index / (profile.railPairs - 1);
      const x = width * (0.2 + t * 0.6);
      railPlacements.push(
        { position: [x, 0.38, height * 0.29] },
        { position: [x, 0.38, height * 0.71] },
      );
    }
    this.addMegastructureInstanceBatch(
      'k91-rails',
      new THREE.BoxGeometry(scaled(14), 0.42, scaled(38)),
      ballast,
      railPlacements,
      profile.castStructuralShadows,
    );

    const datumPlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.datumLights; index += 1) {
      const t = profile.datumLights === 1 ? 0.5 : index / (profile.datumLights - 1);
      datumPlacements.push({ position: [width * (0.2 + t * 0.6), 0.46, cz] });
    }
    this.addMegastructureInstanceBatch(
      'k91-datum',
      new THREE.BoxGeometry(scaled(7), 0.07, scaled(4)),
      datum,
      datumPlacements,
      profile.castStructuralShadows,
    );

    const propCount = profile.stageProps;
    if (stage.stage === 1) {
      const collar = addMesh(new THREE.Mesh(new THREE.TorusGeometry(scaled(86), scaled(11), 8, 32), stageAccent));
      collar.rotation.x = Math.PI / 2;
      collar.position.set(width * 0.2, 0.7, cz);
      for (let index = 0; index < propCount; index += 1) {
        const jaw = addMesh(new THREE.Mesh(new THREE.BoxGeometry(scaled(18), 0.55, scaled(52)), index % 2 === 0 ? structural : ballast));
        jaw.position.set(width * (0.28 + (index % 4) * 0.12), 0.45, height * (index < 4 ? 0.3 : 0.7));
      }
    } else if (stage.stage === 2) {
      for (let index = 0; index < propCount; index += 1) {
        const carriage = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.11, 0.52, scaled(28)), index % 2 === 0 ? stageAccent : ballast));
        carriage.position.set(width * (0.25 + (index % 4) * 0.16), 0.46, height * (index < 4 ? 0.3 : 0.7));
      }
    } else if (stage.stage === 3) {
      for (let index = 0; index < propCount; index += 1) {
        const bus = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.13, 0.16, scaled(12)), index % 2 === 0 ? datum : stageAccent));
        bus.position.set(width * (0.24 + (index % 4) * 0.16), 0.52, height * (index < 4 ? 0.31 : 0.69));
      }
    } else {
      for (let index = 0; index < propCount; index += 1) {
        const block = addMesh(new THREE.Mesh(new THREE.BoxGeometry(scaled(54), 0.72, scaled(42)), index % 2 === 0 ? ballast : stageAccent));
        block.position.set(width * (0.25 + (index % 4) * 0.16), 0.5, height * (index < 4 ? 0.3 : 0.7));
      }
      const blackbox = addMesh(new THREE.Mesh(new THREE.BoxGeometry(scaled(40), 0.85, scaled(40)), datum));
      blackbox.position.set(width * 0.78, 0.58, cz);
    }

    this.renderer.domElement.dataset.megastructureIdentity = 'counterweight:k-91';
    this.renderer.domElement.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.renderer.domElement.dataset.megastructureContinuity = 'load-spine+countermass-rails+amber-inertial-datum';
    this.renderer.domElement.dataset.megastructureStageKit = stage.kit.join('+');
    this.renderer.domElement.dataset.megastructureBatching = 'instanced-continuity';
    this.renderer.domElement.dataset.megastructureContinuityDrawCalls = '2';
    this.renderer.domElement.dataset.megastructurePerformanceProfile = `${profile.name}:rails-${profile.railPairs}:guides-${profile.datumLights}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
  }

  private addOrphelineCapstoneScenery(mission: Contract, worldW: number, worldH: number, detailScale: number) {
    const stage = orphelineStageIdentity(mission);
    if (!stage) return;
    const profile = orphelineRenderProfile(detailScale, this.coarse);
    const cx = scaled(worldW * 0.5);
    const cz = scaled(worldH * 0.5);
    const width = scaled(worldW);
    const height = scaled(worldH);
    const rock = new THREE.MeshStandardMaterial({ color: 0x30383d, metalness: 0.18, roughness: 0.82 });
    const patched = new THREE.MeshStandardMaterial({ color: 0x697276, metalness: 0.72, roughness: 0.48 });
    const utility = new THREE.MeshStandardMaterial({ color: 0x9a78d5, emissive: 0x7044aa, emissiveIntensity: 0.62, metalness: 0.4, roughness: 0.3 });
    const occupancy = new THREE.MeshStandardMaterial({ color: 0xd9d7cd, emissive: 0x77736a, emissiveIntensity: 0.18, metalness: 0.22, roughness: 0.55 });
    const stageAccent = new THREE.MeshStandardMaterial({
      color: stage.stage === 1 ? 0x91b8c4 : stage.stage === 2 ? 0xc28a58 : stage.stage === 3 ? 0x7da98f : 0xa98bc4,
      emissive: stage.stage === 1 ? 0x315966 : stage.stage === 2 ? 0x74451f : stage.stage === 3 ? 0x315c45 : 0x65417d,
      emissiveIntensity: 0.3,
      metalness: 0.48,
      roughness: 0.4,
    });

    const addMesh = (mesh: THREE.Mesh) => {
      mesh.castShadow = profile.castStructuralShadows;
      mesh.receiveShadow = profile.castStructuralShadows;
      this.environmentRoot.add(mesh);
      return mesh;
    };

    const buriedSpine = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.74, 0.2, scaled(22)), rock));
    buriedSpine.position.set(cx, 0.28, cz);
    const utilityTrunk = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.66, 0.09, scaled(7)), utility));
    utilityTrunk.position.set(cx, 0.46, cz + scaled(22));

    const rockRibPlacements: Array<{ position: [number, number, number] }> = [];
    const patchedRibPlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.rockRibs; index += 1) {
      const t = profile.rockRibs === 1 ? 0.5 : index / (profile.rockRibs - 1);
      const x = width * (0.18 + t * 0.64);
      const placements = index % 2 === 0 ? rockRibPlacements : patchedRibPlacements;
      placements.push(
        { position: [x, 0.36, height * 0.18] },
        { position: [x, 0.36, height * 0.82] },
      );
    }
    this.addMegastructureInstanceBatch('orpheline-rock-ribs', new THREE.BoxGeometry(scaled(16), 0.66, height * 0.16), rock, rockRibPlacements, profile.castStructuralShadows);
    this.addMegastructureInstanceBatch('orpheline-patched-ribs', new THREE.BoxGeometry(scaled(16), 0.66, height * 0.16), patched, patchedRibPlacements, profile.castStructuralShadows);

    const occupancyPlacements: Array<{ position: [number, number, number] }> = [];
    const utilityPlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.utilityLights; index += 1) {
      const t = profile.utilityLights === 1 ? 0.5 : index / (profile.utilityLights - 1);
      const placements = index % 3 === 0 ? occupancyPlacements : utilityPlacements;
      placements.push({ position: [width * (0.2 + t * 0.6), 0.5, cz] });
    }
    this.addMegastructureInstanceBatch('orpheline-occupancy', new THREE.BoxGeometry(scaled(7), 0.055, scaled(4)), occupancy, occupancyPlacements, profile.castStructuralShadows);
    this.addMegastructureInstanceBatch('orpheline-utility', new THREE.BoxGeometry(scaled(7), 0.055, scaled(4)), utility, utilityPlacements, profile.castStructuralShadows);

    const propCount = profile.stageProps;
    if (stage.stage === 1) {
      const bore = addMesh(new THREE.Mesh(new THREE.TorusGeometry(scaled(78), scaled(10), 8, 30), stageAccent));
      bore.rotation.x = Math.PI / 2;
      bore.position.set(width * 0.2, 0.65, cz);
      for (let index = 0; index < propCount; index += 1) {
        const shutter = addMesh(new THREE.Mesh(new THREE.BoxGeometry(scaled(18), 0.58, scaled(48)), index % 2 === 0 ? patched : rock));
        shutter.position.set(width * (0.29 + (index % 4) * 0.12), 0.42, height * (index < 4 ? 0.3 : 0.7));
      }
    } else if (stage.stage === 2) {
      for (let index = 0; index < propCount; index += 1) {
        const stall = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.105, 0.48, scaled(30)), index % 2 === 0 ? stageAccent : patched));
        stall.position.set(width * (0.25 + (index % 4) * 0.16), 0.4, height * (index < 4 ? 0.3 : 0.7));
      }
    } else if (stage.stage === 3) {
      for (let index = 0; index < propCount; index += 1) {
        const pod = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(scaled(15), scaled(15), scaled(56), 10), index % 2 === 0 ? occupancy : stageAccent));
        pod.rotation.z = Math.PI / 2;
        pod.position.set(width * (0.25 + (index % 4) * 0.16), 0.5, height * (index < 4 ? 0.29 : 0.71));
      }
    } else {
      for (let index = 0; index < propCount; index += 1) {
        const archive = addMesh(new THREE.Mesh(new THREE.BoxGeometry(scaled(34), 0.82, scaled(54)), index % 2 === 0 ? occupancy : stageAccent));
        archive.position.set(width * (0.25 + (index % 4) * 0.16), 0.5, height * (index < 4 ? 0.29 : 0.71));
      }
      const founderSeal = addMesh(new THREE.Mesh(new THREE.TorusGeometry(scaled(56), scaled(8), 8, 28), utility));
      founderSeal.rotation.x = Math.PI / 2;
      founderSeal.position.set(width * 0.78, 0.78, cz);
    }

    this.renderer.domElement.dataset.megastructureIdentity = 'hidden-habitat:orpheline';
    this.renderer.domElement.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.renderer.domElement.dataset.megastructureContinuity = 'rock-cut-spine+violet-utility-trunk+white-occupancy-marks';
    this.renderer.domElement.dataset.megastructureStageKit = stage.kit.join('+');
    this.renderer.domElement.dataset.megastructureBatching = 'instanced-continuity';
    this.renderer.domElement.dataset.megastructureContinuityDrawCalls = '4';
    this.renderer.domElement.dataset.megastructurePerformanceProfile = `${profile.name}:ribs-${profile.rockRibs}:guides-${profile.utilityLights}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
  }

  private addHecateCapstoneScenery(mission: Contract, worldW: number, worldH: number, detailScale: number) {
    const stage = hecateStageIdentity(mission);
    if (!stage) return;
    const profile = hecateRenderProfile(detailScale, this.coarse);
    const cx = scaled(worldW * 0.5);
    const cz = scaled(worldH * 0.5);
    const width = scaled(worldW);
    const height = scaled(worldH);
    const truss = new THREE.MeshStandardMaterial({ color: 0x303438, metalness: 0.86, roughness: 0.38 });
    const hull = new THREE.MeshStandardMaterial({ color: 0x777a78, metalness: 0.7, roughness: 0.5 });
    const clamp = new THREE.MeshStandardMaterial({ color: 0xb64335, emissive: 0x5b1712, emissiveIntensity: 0.28, metalness: 0.66, roughness: 0.36 });
    const cutter = new THREE.MeshStandardMaterial({ color: 0xe1b348, emissive: 0x8d5e12, emissiveIntensity: 0.56, metalness: 0.52, roughness: 0.28 });
    const stageAccent = new THREE.MeshStandardMaterial({
      color: stage.stage === 1 ? 0xd48442 : stage.stage === 2 ? 0x9e5141 : stage.stage === 3 ? 0x7a9ca4 : 0xc0a24c,
      emissive: stage.stage === 1 ? 0x77370f : stage.stage === 2 ? 0x582019 : stage.stage === 3 ? 0x294b52 : 0x6c5414,
      emissiveIntensity: 0.3,
      metalness: 0.58,
      roughness: 0.4,
    });

    const addMesh = (mesh: THREE.Mesh) => {
      mesh.castShadow = profile.castStructuralShadows;
      mesh.receiveShadow = profile.castStructuralShadows;
      this.environmentRoot.add(mesh);
      return mesh;
    };

    const salvageSpine = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.74, 0.22, scaled(24)), truss));
    salvageSpine.position.set(cx, 0.3, cz);
    const cutterRail = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.66, 0.08, scaled(7)), cutter));
    cutterRail.position.set(cx, 0.47, cz + scaled(22));

    const trussPlacements: Array<{ position: [number, number, number] }> = [];
    const hullPlacements: Array<{ position: [number, number, number] }> = [];
    const clampPlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.trussPairs; index += 1) {
      const t = profile.trussPairs === 1 ? 0.5 : index / (profile.trussPairs - 1);
      const x = width * (0.18 + t * 0.64);
      const placements = index % 2 === 0 ? trussPlacements : hullPlacements;
      placements.push(
        { position: [x, 0.36, height * 0.18] },
        { position: [x, 0.36, height * 0.82] },
      );
      if (index % 2 === 0) {
        clampPlacements.push(
          { position: [x, 0.48, height * 0.28] },
          { position: [x, 0.48, height * 0.72] },
        );
      }
    }
    this.addMegastructureInstanceBatch('hecate-trusses', new THREE.BoxGeometry(scaled(16), 0.64, height * 0.17), truss, trussPlacements, profile.castStructuralShadows);
    this.addMegastructureInstanceBatch('hecate-hulls', new THREE.BoxGeometry(scaled(16), 0.64, height * 0.17), hull, hullPlacements, profile.castStructuralShadows);
    this.addMegastructureInstanceBatch('hecate-clamps', new THREE.BoxGeometry(scaled(8), 0.72, scaled(26)), clamp, clampPlacements, profile.castStructuralShadows);

    const clampDatumPlacements: Array<{ position: [number, number, number] }> = [];
    const cutterDatumPlacements: Array<{ position: [number, number, number] }> = [];
    for (let index = 0; index < profile.cutterDatums; index += 1) {
      const t = profile.cutterDatums === 1 ? 0.5 : index / (profile.cutterDatums - 1);
      const placements = index % 3 === 0 ? clampDatumPlacements : cutterDatumPlacements;
      placements.push({ position: [width * (0.2 + t * 0.6), 0.51, cz] });
    }
    this.addMegastructureInstanceBatch('hecate-clamp-datum', new THREE.BoxGeometry(scaled(7), 0.055, scaled(4)), clamp, clampDatumPlacements, profile.castStructuralShadows);
    this.addMegastructureInstanceBatch('hecate-cutter-datum', new THREE.BoxGeometry(scaled(7), 0.055, scaled(4)), cutter, cutterDatumPlacements, profile.castStructuralShadows);

    const propCount = profile.stageProps;
    if (stage.stage === 1) {
      const clampRing = addMesh(new THREE.Mesh(new THREE.TorusGeometry(scaled(80), scaled(10), 8, 30), stageAccent));
      clampRing.rotation.x = Math.PI / 2;
      clampRing.position.set(width * 0.2, 0.7, cz);
      for (let index = 0; index < propCount; index += 1) {
        const jaw = addMesh(new THREE.Mesh(new THREE.BoxGeometry(scaled(20), 0.6, scaled(50)), index % 2 === 0 ? clamp : hull));
        jaw.position.set(width * (0.29 + (index % 4) * 0.12), 0.43, height * (index < 4 ? 0.3 : 0.7));
      }
    } else if (stage.stage === 2) {
      for (let index = 0; index < propCount; index += 1) {
        const crusher = addMesh(new THREE.Mesh(new THREE.BoxGeometry(width * 0.105, 0.62, scaled(34)), index % 2 === 0 ? clamp : stageAccent));
        crusher.position.set(width * (0.25 + (index % 4) * 0.16), 0.46, height * (index < 4 ? 0.3 : 0.7));
      }
    } else if (stage.stage === 3) {
      for (let index = 0; index < propCount; index += 1) {
        const wreck = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(scaled(18), scaled(18), scaled(62), 10, 1, true), index % 2 === 0 ? hull : stageAccent));
        wreck.rotation.z = Math.PI / 2;
        wreck.position.set(width * (0.25 + (index % 4) * 0.16), 0.52, height * (index < 4 ? 0.29 : 0.71));
      }
    } else {
      for (let index = 0; index < propCount; index += 1) {
        const control = addMesh(new THREE.Mesh(new THREE.BoxGeometry(scaled(32), 0.9, scaled(50)), index % 2 === 0 ? clamp : truss));
        control.position.set(width * (0.25 + (index % 4) * 0.16), 0.54, height * (index < 4 ? 0.29 : 0.71));
      }
      const crown = addMesh(new THREE.Mesh(new THREE.TorusGeometry(scaled(58), scaled(9), 8, 30), cutter));
      crown.rotation.x = Math.PI / 2;
      crown.position.set(width * 0.78, 0.82, cz);
    }

    this.renderer.domElement.dataset.megastructureIdentity = 'shipbreaking-yard:hecate';
    this.renderer.domElement.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.renderer.domElement.dataset.megastructureContinuity = 'salvage-truss-spine+red-clamp-arms+yellow-cutter-datum';
    this.renderer.domElement.dataset.megastructureStageKit = stage.kit.join('+');
    this.renderer.domElement.dataset.megastructureBatching = 'instanced-continuity';
    this.renderer.domElement.dataset.megastructureContinuityDrawCalls = '5';
    this.renderer.domElement.dataset.megastructurePerformanceProfile = `${profile.name}:trusses-${profile.trussPairs}:guides-${profile.cutterDatums}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
  }

  private ensureEnvironment(state: SimState, mission: Contract, budget: RenderBudgetSnapshot) {
    const signature = `${mission.location}:${mission.locationName}:${state.sectors.length}:${state.objects.length}:tier-${budget.tier}`;
    if (signature === this.environmentSignature) return;
    this.environmentSignature = signature;

    this.clearAuthoredRefineryEnvironment();
    this.clearAuthoredInteractables();
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
    const lightingProfile = LOCATION_LIGHTING_PROFILES[mission.location];
    this.keyLight.color.setHex(lightingProfile.keyColor);
    this.rimLight.color.setHex(lightingProfile.rimColor);
    this.emergencyLight.color.setHex(lightingProfile.emergencyColor);

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
    this.addLocationScenery(mission.location, world.w, world.h, palette, budget.detailScale);
    buildHardSciFiEnvironment(this.environmentRoot, mission, scaled(world.w), scaled(world.h), palette);
    this.addPerseidCapstoneScenery(mission, world.w, world.h, budget.detailScale);
    this.addK91CapstoneScenery(mission, world.w, world.h, budget.detailScale);
    this.addOrphelineCapstoneScenery(mission, world.w, world.h, budget.detailScale);
    this.addHecateCapstoneScenery(mission, world.w, world.h, budget.detailScale);
    const artIdentity = locationArtIdentityFor(mission.location);
    this.renderer.domElement.dataset.locationArt = `${mission.location}:${artIdentity.silhouette}:${artIdentity.material}`;
    this.renderer.domElement.dataset.locationLighting = `${mission.location}:${artIdentity.lighting}`;
    this.renderer.domElement.dataset.locationProps = `${artIdentity.propSet}:instanced-shared-library`;
    if (mission.location === 'asteroid-refinery') {
      void this.loadAuthoredRefineryEnvironment(state, world.w, world.h, budget.detailScale);
    } else if (mission.location === 'damaged-vessel') {
      void this.loadAuthoredDamagedVesselEnvironment(world.w, world.h, budget.detailScale);
    } else if (mission.location === 'parallax-array') {
      void this.loadAuthoredParallaxEnvironment(state, world.w, world.h, budget.detailScale);
    } else if (mission.location === 'spin-habitat') {
      void this.loadAuthoredSpinHabitatEnvironment(world.w, world.h, budget.detailScale);
    } else if (mission.location === 'jovian-harvester') {
      void this.loadAuthoredJovianHarvesterEnvironment(world.w, world.h, budget.detailScale);
    } else if (mission.location === 'ice-mine') {
      void this.loadAuthoredIceMineEnvironment(state, world.w, world.h, budget.detailScale);
    } else if (mission.location === 'solar-yard') {
      void this.loadAuthoredSolarYardEnvironment(state, world.w, world.h, budget.detailScale);
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

  private addLocationScenery(location: string, worldW: number, worldH: number, palette: LocationPalette, detailScale = 1) {
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
      const spinProfile = spinHabitatRenderProfile(detailScale, this.coarse);
      const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x587168, emissive: 0x102c20, emissiveIntensity: 0.14, metalness: 0.72, roughness: 0.42 });
      const spokeMaterial = new THREE.MeshStandardMaterial({ color: 0x14262d, emissive: 0x0b4051, emissiveIntensity: 0.28, metalness: 0.90, roughness: 0.30 });
      const axisMaterial = new THREE.MeshStandardMaterial({ color: 0x98aaa6, emissive: 0x315b60, emissiveIntensity: 0.22, metalness: 0.76, roughness: 0.28 });
      const rotor = new THREE.Group();
      rotor.name = 'spin-habitat-procedural-rotor';
      rotor.position.set(cx, 2.8, cz);
      for (const radius of [5.5, 8.5, 11.5]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.18, 8, spinProfile.proceduralRingSegments), rimMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = spinProfile.movingShadows;
        rotor.add(ring);
      }
      const radialSpoke = new THREE.Mesh(new THREE.BoxGeometry(22, 0.24, 0.24), spokeMaterial);
      radialSpoke.castShadow = spinProfile.movingShadows;
      rotor.add(radialSpoke);
      const crossSpoke = radialSpoke.clone();
      crossSpoke.rotation.y = Math.PI / 2;
      rotor.add(crossSpoke);
      const rotationWitness = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.72), emissive);
      rotationWitness.position.set(8.5, 0.34, 0);
      rotationWitness.castShadow = spinProfile.movingShadows;
      rotationWitness.name = 'spin-habitat-rotation-witness';
      rotor.add(rotationWitness);

      const axisHub = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 4.8, 12), axisMaterial);
      axisHub.position.set(cx, 2.4, cz);
      axisHub.castShadow = true;
      axisHub.receiveShadow = true;
      axisHub.name = 'spin-habitat-procedural-axis-hub';
      const axisCollar = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.14, 8, 32), axisMaterial);
      axisCollar.rotation.x = Math.PI / 2;
      axisCollar.position.set(cx, 3.25, cz);
      axisCollar.castShadow = true;
      axisCollar.name = 'spin-habitat-procedural-axis-collar';

      const spindownVfx = new THREE.Group();
      spindownVfx.name = 'spin-habitat-spindown-vfx';
      spindownVfx.position.set(cx, 0.075, cz);
      spindownVfx.visible = false;
      const spindownArcGeometry = new THREE.TorusGeometry(10.2, 0.055, 6, 40, Math.PI * 0.58);
      for (let index = 0; index < 6; index += 1) {
        const arc = new THREE.Mesh(
          spindownArcGeometry,
          new THREE.MeshBasicMaterial({
            color: 0xff9b5a,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        );
        arc.name = `spin-habitat-brake-arc-${index}`;
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = (index / 6) * Math.PI * 2;
        arc.position.y = index % 2 === 0 ? 0 : 0.012;
        arc.renderOrder = 6;
        spindownVfx.add(arc);
        this.spinHabitatSpindownArcs.push(arc);
      }
      const spindownBeacon = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.075, 6, 36),
        new THREE.MeshBasicMaterial({
          color: 0xffc071,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      spindownBeacon.name = 'spin-habitat-axis-warning-pulse';
      spindownBeacon.rotation.x = Math.PI / 2;
      spindownBeacon.renderOrder = 7;
      spindownVfx.add(spindownBeacon);

      const ambientRoot = new THREE.Group();
      ambientRoot.name = 'spin-habitat-ambient-effects';
      ambientRoot.position.set(cx, 0.085, cz);
      const ambientBandGeometry = new THREE.BoxGeometry(0.46, 0.018, 18.8);
      for (let index = 0; index < 4; index += 1) {
        const band = new THREE.Mesh(
          ambientBandGeometry,
          new THREE.MeshBasicMaterial({
            color: index % 2 === 0 ? 0x79d8c8 : 0x8dc7d0,
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        );
        band.name = `spin-habitat-rim-light-band-${index}`;
        band.rotation.y = index * Math.PI / 4;
        band.position.y = 0.01 + index * 0.004;
        band.renderOrder = 5;
        ambientRoot.add(band);
        this.spinHabitatAmbientBands.push(band);
      }

      const dustCount = 48;
      const dustPositions = new Float32Array(dustCount * 3);
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let index = 0; index < dustCount; index += 1) {
        const angle = index * goldenAngle;
        const radius = 2.8 + (index % 12) / 11 * 8.4;
        dustPositions[index * 3] = Math.cos(angle) * radius;
        dustPositions[index * 3 + 1] = 0.24 + ((index * 7) % 13) / 12 * 1.45;
        dustPositions[index * 3 + 2] = Math.sin(angle) * radius;
      }
      const dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      const dustMaterial = new THREE.PointsMaterial({
        color: 0xa5eadc,
        size: 0.085,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const ambientDust = new THREE.Points(dustGeometry, dustMaterial);
      ambientDust.name = 'spin-habitat-spin-dust';
      ambientDust.renderOrder = 5;
      ambientRoot.add(ambientDust);

      const axisHaze = new THREE.Mesh(
        new THREE.TorusGeometry(2.45, 0.13, 6, 44),
        new THREE.MeshBasicMaterial({
          color: 0x83dfd4,
          transparent: true,
          opacity: 0.13,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      axisHaze.name = 'spin-habitat-axis-haze';
      axisHaze.rotation.x = Math.PI / 2;
      axisHaze.position.y = 0.02;
      axisHaze.renderOrder = 5;
      ambientRoot.add(axisHaze);

      this.environmentRoot.add(rotor, axisHub, axisCollar, spindownVfx, ambientRoot);
      this.spinHabitatProceduralRotor = rotor;
      this.spinHabitatSpindownVfx = spindownVfx;
      this.spinHabitatSpindownBeacon = spindownBeacon;
      this.spinHabitatAmbientRoot = ambientRoot;
      this.spinHabitatAmbientDust = ambientDust;
      this.spinHabitatAmbientAxisHaze = axisHaze;
      this.proceduralRefineryVisuals.push(rotor, axisHub, axisCollar);
    } else if (location === 'jovian-harvester') {
      const jovianProfile = jovianHarvesterRenderProfile(detailScale, this.coarse);
      const jovianVisuals: THREE.Object3D[] = [];
      for (let i = -2; i <= 2; i += 1) {
        const tower = addBox(cx + i * 7, cz + i * 1.5, 1.1, 1.1, 6 + Math.abs(i), structural);
        tower.castShadow = jovianProfile.structureShadows;
        jovianVisuals.push(tower);
      }
      const guide = addBox(cx, cz - 7, 34, 0.35, 0.35, emissive);
      guide.castShadow = jovianProfile.structureShadows;
      jovianVisuals.push(guide);
      this.proceduralRefineryVisuals.push(...jovianVisuals);
      this.renderer.domElement.dataset.environmentPerformanceProfile = `${jovianProfile.name}:procedural:structure-shadows-${jovianProfile.structureShadows ? 'on' : 'off'}`;
      this.renderer.domElement.dataset.environmentInstanceBudget = 'tower:5+guide:1';
      this.renderer.domElement.dataset.environmentShadowCasters = jovianProfile.structureShadows ? 'jovian-structures' : 'off';

      const width = scaled(worldW);
      const height = scaled(worldH);
      const stormRoot = new THREE.Group();
      stormRoot.name = 'jovian-harvester-storm-pressure-language';

      const chargeSweepGeometry = new THREE.BoxGeometry(width * 0.58, 0.018, 0.07);
      for (let index = 0; index < 4; index += 1) {
        const sweep = new THREE.Mesh(
          chargeSweepGeometry,
          new THREE.MeshBasicMaterial({
            color: index % 2 === 0 ? 0xf0aa55 : 0xffd083,
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        );
        sweep.name = `jovian-harvester-storm-charge-sweep-${index}`;
        sweep.position.set(width * 0.50, 0.048 + index * 0.004, height * (0.22 + index * 0.18));
        sweep.rotation.y = index % 2 === 0 ? 0.06 : -0.06;
        sweep.userData.baseZ = sweep.position.z;
        sweep.renderOrder = 5;
        stormRoot.add(sweep);
        this.jovianStormChargeSweeps.push(sweep);
      }

      const pressureBandGeometry = new THREE.BoxGeometry(0.10, 0.02, height * 0.66);
      for (let index = 0; index < 3; index += 1) {
        const band = new THREE.Mesh(
          pressureBandGeometry,
          new THREE.MeshBasicMaterial({
            color: 0x78c9d6,
            transparent: true,
            opacity: 0.07,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        );
        band.name = `jovian-harvester-pressure-shear-band-${index}`;
        band.position.set(width * [0.33, 0.50, 0.67][index], 0.056 + index * 0.004, height * 0.50);
        band.userData.baseX = band.position.x;
        band.renderOrder = 6;
        stormRoot.add(band);
        this.jovianPressureShearBands.push(band);
      }

      const reliefPulse = new THREE.Mesh(
        new THREE.TorusGeometry(1.42, 0.07, 6, 40),
        new THREE.MeshBasicMaterial({
          color: 0xff8a50,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      reliefPulse.name = 'jovian-harvester-relief-manifold-pulse';
      reliefPulse.rotation.x = Math.PI / 2;
      reliefPulse.position.set(scaled(1450), 0.07, scaled(220));
      reliefPulse.renderOrder = 7;
      stormRoot.add(reliefPulse);

      const atmosphereRoot = new THREE.Group();
      atmosphereRoot.name = 'jovian-harvester-atmospheric-effects';

      const cloudGeometry = new THREE.BoxGeometry(width * 0.50, 0.012, 0.42);
      const cloudRows = [0.14, 0.31, 0.48, 0.66, 0.82];
      for (let index = 0; index < cloudRows.length; index += 1) {
        const cloud = new THREE.Mesh(
          cloudGeometry,
          new THREE.MeshBasicMaterial({
            color: index % 2 === 0 ? 0xd7bd7d : 0x8fb8bd,
            transparent: true,
            opacity: 0.05,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        );
        cloud.name = `jovian-harvester-pressure-cloud-${index}`;
        cloud.position.set(width * 0.50, 0.032 + index * 0.003, height * cloudRows[index]);
        cloud.rotation.y = index % 2 === 0 ? 0.025 : -0.025;
        cloud.userData.baseX = cloud.position.x;
        cloud.userData.baseZ = cloud.position.z;
        cloud.renderOrder = 4;
        atmosphereRoot.add(cloud);
        this.jovianAtmosphereClouds.push(cloud);
      }

      const particulateCount = 56;
      const particulatePositions = new Float32Array(particulateCount * 3);
      for (let index = 0; index < particulateCount; index += 1) {
        const xPhase = ((index * 17) % 53) / 52;
        const zPhase = ((index * 29) % 55) / 54;
        particulatePositions[index * 3] = width * (0.16 + xPhase * 0.68);
        particulatePositions[index * 3 + 1] = 0.10 + (((index * 11) % 9) / 8) * 0.22;
        particulatePositions[index * 3 + 2] = height * (0.10 + zPhase * 0.80);
      }
      const particulateGeometry = new THREE.BufferGeometry();
      particulateGeometry.setAttribute('position', new THREE.BufferAttribute(particulatePositions, 3));
      const particulate = new THREE.Points(
        particulateGeometry,
        new THREE.PointsMaterial({
          color: 0xe4c77f,
          size: 0.075,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      particulate.name = 'jovian-harvester-charged-particulate';
      particulate.renderOrder = 4;
      atmosphereRoot.add(particulate);

      const spineHaze = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.10, 6, 48),
        new THREE.MeshBasicMaterial({
          color: 0xc8d8c2,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      );
      spineHaze.name = 'jovian-harvester-skimmer-spine-haze';
      spineHaze.rotation.x = Math.PI / 2;
      spineHaze.position.set(width * 0.50, 0.055, height * 0.48);
      spineHaze.renderOrder = 4;
      atmosphereRoot.add(spineHaze);

      this.environmentRoot.add(stormRoot, atmosphereRoot);
      this.jovianStormVisualRoot = stormRoot;
      this.jovianPressureReliefPulse = reliefPulse;
      this.jovianAtmosphereRoot = atmosphereRoot;
      this.jovianAtmosphereParticulate = particulate;
      this.jovianAtmosphereSpineHaze = spineHaze;
    } else if (location === 'ice-mine') {
      const iceMineFallback: THREE.Object3D[] = [];
      for (let i = 0; i < 9; i += 1) {
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.7 + (i % 3) * 0.3, 2.4 + (i % 4) * 0.8, 6), emissive);
        crystal.position.set(cx - 16 + i * 4, 1.4, cz + (i % 2 ? 7 : -7));
        crystal.rotation.z = (i - 4) * 0.04;
        crystal.castShadow = true;
        this.environmentRoot.add(crystal);
        iceMineFallback.push(crystal);
      }
      this.proceduralRefineryVisuals.push(...iceMineFallback);
    } else if (location === 'solar-yard') {
      const solarYardProfile = solarYardRenderProfile(detailScale, this.coarse);
      const solarYardFallback: THREE.Object3D[] = [];
      const fallbackPanelOffsets = solarYardProfile.fallbackPanelInstances === 7
        ? [-3, -2, -1, 0, 1, 2, 3]
        : solarYardProfile.fallbackPanelInstances === 5
          ? [-3, -2, 0, 2, 3]
          : [-3, 0, 3];
      for (const i of fallbackPanelOffsets) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 2.2), emissive);
        panel.position.set(cx + i * 5.2, 1.3 + Math.abs(i) * 0.08, cz + (i % 2 ? 6 : -6));
        panel.rotation.z = -0.16;
        panel.castShadow = solarYardProfile.environmentShadows;
        this.environmentRoot.add(panel);
        solarYardFallback.push(panel);
      }
      this.proceduralRefineryVisuals.push(...solarYardFallback);

      const sunShadowRoot = new THREE.Group();
      sunShadowRoot.name = 'solar-yard-sun-shadow-language';
      const createShadeMaterial = () => new THREE.MeshBasicMaterial({
        color: 0x07141c,
        transparent: true,
        opacity: 0.17,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const createSunMaterial = () => new THREE.MeshBasicMaterial({
        color: 0xffb45d,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const shadePlacements = [
        [0.18, 0.36, 0.26, 0.72, -0.10],
        [0.36, 0.66, 0.18, 0.52, -0.10],
        [0.52, 0.28, 0.13, 0.36, -0.10],
      ] as const;
      for (const [x, z, widthRatio, depthRatio, rotation] of shadePlacements.slice(0, solarYardProfile.shadePatchInstances)) {
        const shade = new THREE.Mesh(new THREE.PlaneGeometry(scaled(worldW * widthRatio), scaled(worldH * depthRatio)), createShadeMaterial());
        shade.rotation.x = -Math.PI / 2;
        shade.rotation.z = rotation;
        shade.position.set(scaled(worldW * x), 0.028, scaled(worldH * z));
        shade.renderOrder = 2;
        sunShadowRoot.add(shade);
        this.solarYardShadePatches.push(shade);
      }
      const sunPlacements = [
        [0.68, 0.30, 0.20, 0.34, -0.10],
        [0.78, 0.56, 0.17, 0.30, -0.10],
        [0.64, 0.78, 0.16, 0.24, -0.10],
      ] as const;
      for (const [x, z, widthRatio, depthRatio, rotation] of sunPlacements.slice(0, solarYardProfile.sunPatchInstances)) {
        const sunPatch = new THREE.Mesh(new THREE.PlaneGeometry(scaled(worldW * widthRatio), scaled(worldH * depthRatio)), createSunMaterial());
        sunPatch.rotation.x = -Math.PI / 2;
        sunPatch.rotation.z = rotation;
        sunPatch.position.set(scaled(worldW * x), 0.032, scaled(worldH * z));
        sunPatch.renderOrder = 3;
        sunShadowRoot.add(sunPatch);
        this.solarYardSunPatches.push(sunPatch);
      }
      this.environmentRoot.add(sunShadowRoot);
      this.renderer.domElement.dataset.environmentPerformanceProfile = `${solarYardProfile.name}:procedural:structure-shadows-${solarYardProfile.environmentShadows ? 'on' : 'off'}`;
      this.renderer.domElement.dataset.environmentInstanceBudget = `fallback-panel:${solarYardFallback.length}+sun:${this.solarYardSunPatches.length}+shade:${this.solarYardShadePatches.length}`;
      this.renderer.domElement.dataset.environmentShadowCasters = solarYardProfile.environmentShadows ? 'solar-yard-structures+gameplay-actors' : 'gameplay-actors-only';
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

  private syncSpinHabitatArchitecture(state: SimState, mission: Contract, budget: RenderBudgetSnapshot) {
    if (mission.location !== 'spin-habitat') {
      this.spinHabitatLastSimTime = Number.NaN;
      return;
    }

    const spinSector = state.sectors.find(sector => sector.id === 'A') ?? state.sectors[0];
    const transferSector = state.sectors.find(sector => sector.id === 'B');
    const motion = spinHabitatArchitectureState(spinSector?.gravity ?? 1);
    const spindown = spinHabitatSpindownState(transferSector?.gravity ?? 0.42);
    const previousTime = this.spinHabitatLastSimTime;
    this.spinHabitatLastSimTime = state.time;
    const delta = Number.isFinite(previousTime) ? THREE.MathUtils.clamp(state.time - previousTime, 0, 0.25) : 0;
    this.spinHabitatRotationY = (this.spinHabitatRotationY + motion.angularSpeed * delta) % (Math.PI * 2);

    if (this.spinHabitatAuthoredRotor) this.spinHabitatAuthoredRotor.rotation.y = this.spinHabitatRotationY;
    if (this.spinHabitatProceduralRotor) this.spinHabitatProceduralRotor.rotation.y = this.spinHabitatRotationY;

    const reducedSpindownDetail = this.coarse || budget.vfxDensity < 0.55;
    if (this.spinHabitatAmbientRoot) {
      const density = budget.vfxDensity < 0.55 ? 'reduced' : budget.vfxDensity < 0.85 ? 'balanced' : 'full';
      const visibleBands = density === 'reduced' ? 2 : density === 'balanced' ? 3 : 4;
      const visibleDust = density === 'reduced' ? 20 : density === 'balanced' ? 34 : 48;
      const ambientPulse = 0.5 + Math.sin(state.time * 1.35) * 0.5;
      const ambientIntensity = (0.68 + ambientPulse * 0.32) * budget.transparencyScale;

      this.spinHabitatAmbientRoot.rotation.y = this.spinHabitatRotationY * 0.72 + state.time * 0.022;
      for (let index = 0; index < this.spinHabitatAmbientBands.length; index += 1) {
        const band = this.spinHabitatAmbientBands[index];
        band.visible = index < visibleBands;
        band.material.opacity = band.visible ? (0.045 + ambientPulse * 0.055) * budget.transparencyScale : 0;
      }
      if (this.spinHabitatAmbientDust) {
        this.spinHabitatAmbientDust.geometry.setDrawRange(0, visibleDust);
        this.spinHabitatAmbientDust.rotation.y = -this.spinHabitatRotationY * 0.28 + state.time * 0.035;
        this.spinHabitatAmbientDust.material.opacity = (0.12 + ambientPulse * 0.12) * budget.transparencyScale;
      }
      if (this.spinHabitatAmbientAxisHaze) {
        this.spinHabitatAmbientAxisHaze.material.opacity = (0.07 + ambientPulse * 0.09) * budget.transparencyScale;
        this.spinHabitatAmbientAxisHaze.scale.setScalar(0.94 + ambientPulse * 0.12);
      }

      this.renderer.domElement.dataset.environmentAmbient = 'rim-light-sweep+spin-dust+axis-haze';
      this.renderer.domElement.dataset.environmentAmbientMotion = 'gravity-coupled-sweep+counterspin-drift+stationary-axis-pulse';
      this.renderer.domElement.dataset.environmentAmbientDetail = `${visibleBands}-bands+${visibleDust}-motes+axis-haze`;
      this.renderer.domElement.dataset.environmentAmbientIntensity = ambientIntensity.toFixed(2);
    }

    if (this.spinHabitatSpindownVfx) {
      const pulse = 0.5 + Math.sin(state.time * (4.2 + spindown.intensity * 2.6)) * 0.5;
      this.spinHabitatSpindownVfx.visible = spindown.active;
      this.spinHabitatSpindownVfx.rotation.y = -this.spinHabitatRotationY * 0.32 + state.time * (0.08 + spindown.intensity * 0.16);
      for (let index = 0; index < this.spinHabitatSpindownArcs.length; index += 1) {
        const arc = this.spinHabitatSpindownArcs[index];
        arc.visible = spindown.active && (!reducedSpindownDetail || index % 2 === 0);
        arc.material.opacity = spindown.active
          ? (0.12 + pulse * 0.28) * spindown.intensity * budget.transparencyScale
          : 0;
        const arcScale = 1 + spindown.intensity * 0.035 + Math.sin(state.time * 2.1 + index) * 0.008;
        arc.scale.setScalar(arcScale);
      }
      if (this.spinHabitatSpindownBeacon) {
        this.spinHabitatSpindownBeacon.visible = spindown.active;
        this.spinHabitatSpindownBeacon.material.opacity = spindown.active
          ? (0.18 + pulse * 0.42) * spindown.intensity * budget.transparencyScale
          : 0;
        this.spinHabitatSpindownBeacon.scale.setScalar(0.92 + spindown.intensity * 0.16 + pulse * 0.08);
      }
    }

    this.renderer.domElement.dataset.environmentMotion = 'gravity-coupled-rigid-rotation';
    this.renderer.domElement.dataset.environmentSpinMode = motion.mode;
    this.renderer.domElement.dataset.environmentSpinRpm = motion.rpm.toFixed(2);
    this.renderer.domElement.dataset.environmentSpinPhase = this.spinHabitatRotationY.toFixed(3);
    this.renderer.domElement.dataset.environmentSpinSource = 'sector-A-gravity';
    this.renderer.domElement.dataset.environmentSpindown = spindown.active ? 'active' : 'idle';
    this.renderer.domElement.dataset.environmentSpindownIntensity = spindown.intensity.toFixed(2);
    this.renderer.domElement.dataset.environmentSpindownSource = 'sector-B-transfer-gravity';
    this.renderer.domElement.dataset.environmentSpindownDetail = reducedSpindownDetail ? '3-arcs+axis-pulse' : '6-arcs+axis-pulse';
    this.renderer.domElement.dataset.environmentVfx = 'spindown-brake-arcs+axis-warning-pulse';
  }

  private syncIceMineBrittleSupports(state: SimState, mission: Contract, budget: RenderBudgetSnapshot) {
    if (mission.location !== 'ice-mine') {
      delete this.renderer.domElement.dataset.environmentBrittleSupports;
      delete this.renderer.domElement.dataset.environmentBrittleSupportState;
      delete this.renderer.domElement.dataset.environmentBrittleSupportIds;
      delete this.renderer.domElement.dataset.environmentFractureVfx;
      delete this.renderer.domElement.dataset.environmentFractureState;
      delete this.renderer.domElement.dataset.environmentFractureDetail;
      delete this.renderer.domElement.dataset.environmentFractureSupports;
      return;
    }

    const supportIds = ['ice-brittle-gate-a', 'ice-brittle-gate-b'] as const;
    const reducedFractureDetail = this.coarse || budget.vfxDensity < 0.55;
    const shardBudget = reducedFractureDetail ? 4 : 8;
    const crackBudget = reducedFractureDetail ? 2 : 3;
    let intact = 0;
    let failed = 0;
    let damaged = 0;
    let cracking = 0;
    let collapsing = 0;
    let settled = 0;

    for (const id of supportIds) {
      const object = state.objects.find(item => item.id === id);
      const visual = this.iceMineBrittleSupportVisuals.get(id);
      const active = Boolean(object?.active);
      const previousActive = this.iceMineBrittleSupportLastActive.get(id);
      if (previousActive === true && !active) this.iceMineCollapseStartedAt.set(id, state.time);
      else if (previousActive === undefined && !active && !this.iceMineCollapseStartedAt.has(id)) this.iceMineCollapseStartedAt.set(id, state.time);
      this.iceMineBrittleSupportLastActive.set(id, active);
      if (visual) visual.visible = active;

      const hpRatio = object && object.maxHp > 0 ? THREE.MathUtils.clamp(object.hp / object.maxHp, 0, 1) : 1;
      const supportDamaged = active && hpRatio < 0.999;
      const cracks = this.iceMineFractureCracks.get(id) ?? [];
      for (let index = 0; index < cracks.length; index += 1) {
        const crack = cracks[index];
        crack.visible = supportDamaged && index < crackBudget;
        if (crack.visible) {
          const severity = 1 - hpRatio;
          const pulse = 0.96 + Math.sin(state.time * (4.2 + severity * 3.4) + index) * 0.045;
          crack.scale.z = pulse;
          crack.rotation.z += 0.0025 * (index % 2 === 0 ? 1 : -1);
        }
      }

      const pulse = this.iceMineFracturePulses.get(id);
      const shards = this.iceMineFractureShards.get(id) ?? [];
      if (active) {
        if (pulse) pulse.visible = false;
        for (const shard of shards) shard.visible = false;
        this.iceMineCollapseStartedAt.delete(id);
        intact += 1;
        if (supportDamaged) {
          damaged += 1;
          cracking += 1;
        }
      } else {
        failed += 1;
        const startedAt = this.iceMineCollapseStartedAt.get(id) ?? state.time;
        const elapsed = Math.max(0, state.time - startedAt);
        const inBurst = elapsed < 1.35;
        if (inBurst) collapsing += 1;
        else settled += 1;

        if (pulse) {
          pulse.visible = inBurst;
          if (pulse.visible) {
            const pulseScale = 0.72 + Math.min(1, elapsed / 0.85) * 1.9;
            pulse.scale.setScalar(pulseScale);
            pulse.rotation.z = state.time * 0.42;
          }
        }

        for (let index = 0; index < shards.length; index += 1) {
          const shard = shards[index];
          const keepRubble = !inBurst && index < Math.min(2, shardBudget);
          shard.visible = (inBurst && index < shardBudget) || keepRubble;
          if (!shard.visible) continue;
          const velocity = (shard.userData.velocity as [number, number, number] | undefined) ?? [0, 0.9, 0];
          const travelT = Math.min(1.2, elapsed);
          const groundY = 0.05 + (index % 2) * 0.025;
          shard.position.set(
            velocity[0] * travelT,
            Math.max(groundY, 0.92 + velocity[1] * travelT - 2.25 * travelT * travelT),
            velocity[2] * travelT,
          );
          shard.rotation.set(
            index * 0.31 + travelT * (1.2 + index * 0.08),
            index * 0.47 + travelT * (0.9 + index * 0.05),
            index * 0.23 + travelT * (1.4 + index * 0.06),
          );
          shard.scale.setScalar(keepRubble ? 0.78 : 1);
        }
      }
    }

    this.renderer.domElement.dataset.environmentBrittleSupports = `intact:${intact}+failed:${failed}+damaged:${damaged}`;
    this.renderer.domElement.dataset.environmentBrittleSupportState = failed === supportIds.length
      ? 'cleared'
      : failed > 0
        ? 'partial'
        : damaged > 0
          ? 'damaged'
          : 'intact';
    this.renderer.domElement.dataset.environmentBrittleSupportIds = supportIds.join(',');
    this.renderer.domElement.dataset.environmentFractureVfx = 'support-cracks+shard-burst+frost-pulse';
    this.renderer.domElement.dataset.environmentFractureState = collapsing > 0
      ? 'collapsing'
      : cracking > 0
        ? 'cracking'
        : settled > 0
          ? 'settled'
          : 'idle';
    this.renderer.domElement.dataset.environmentFractureDetail = `${shardBudget}-shards+${crackBudget}-cracks+frost-pulse`;
    this.renderer.domElement.dataset.environmentFractureSupports = `cracking:${cracking}+collapsing:${collapsing}+settled:${settled}`;
  }

  private syncJovianHarvesterVisualLanguage(state: SimState, mission: Contract, budget: RenderBudgetSnapshot) {
    if (mission.location !== 'jovian-harvester') return;

    const serviceBreach = state.breaches.find(breach => breach.id === 'service-breach');
    const storm = jovianHarvesterStormState(
      state.sectors.map(sector => sector.pressure),
      state.sectors.map(sector => sector.pressureState),
      Boolean(serviceBreach?.active && !serviceBreach.sealed),
      mission.conditions.includes('unstable-pressure'),
      mission.conditions.includes('damaged-grid'),
    );
    const reducedStormDetail = this.coarse || budget.vfxDensity < 0.55;
    const pulse = 0.5 + Math.sin(state.time * (2.6 + storm.intensity * 2.8)) * 0.5;

    if (this.jovianStormVisualRoot) {
      const sweepCount = reducedStormDetail ? 2 : 4;
      const bandCount = reducedStormDetail ? 2 : 3;
      for (let index = 0; index < this.jovianStormChargeSweeps.length; index += 1) {
        const sweep = this.jovianStormChargeSweeps[index];
        const visible = index < sweepCount;
        const baseZ = Number(sweep.userData.baseZ ?? sweep.position.z);
        sweep.visible = visible;
        sweep.position.z = baseZ + Math.sin(state.time * (0.52 + storm.stormCharge * 0.72) + index * 1.61) * (0.16 + storm.intensity * 0.44);
        sweep.material.opacity = visible
          ? (0.035 + storm.stormCharge * 0.12 + pulse * 0.035) * budget.transparencyScale
          : 0;
        sweep.scale.x = 0.92 + storm.stormCharge * 0.16 + pulse * 0.025;
      }

      const bandColor = storm.venting ? 0xff7e52 : storm.pressureShear > 0.42 ? 0xe4aa62 : 0x78c9d6;
      for (let index = 0; index < this.jovianPressureShearBands.length; index += 1) {
        const band = this.jovianPressureShearBands[index];
        const visible = index < bandCount;
        const baseX = Number(band.userData.baseX ?? band.position.x);
        band.visible = visible;
        band.position.x = baseX + Math.sin(state.time * 1.1 + index * 2.2) * storm.pressureShear * 0.11;
        band.material.color.setHex(bandColor);
        band.material.opacity = visible
          ? (0.025 + storm.pressureShear * 0.22 + (storm.venting ? 0.08 : 0)) * budget.transparencyScale
          : 0;
        band.scale.z = 0.94 + storm.pressureShear * 0.16 + pulse * storm.pressureShear * 0.04;
      }

      if (this.jovianPressureReliefPulse) {
        this.jovianPressureReliefPulse.visible = true;
        this.jovianPressureReliefPulse.material.color.setHex(storm.venting ? 0xff6f45 : 0xffa75f);
        this.jovianPressureReliefPulse.material.opacity = (
          storm.activeBreach
            ? 0.18 + pulse * 0.40
            : 0.035 + storm.intensity * 0.08 + pulse * 0.025
        ) * budget.transparencyScale;
        this.jovianPressureReliefPulse.scale.setScalar(
          storm.activeBreach
            ? 0.90 + storm.intensity * 0.18 + pulse * 0.14
            : 0.92 + pulse * 0.05,
        );
        this.jovianPressureReliefPulse.rotation.z = state.time * (0.18 + storm.intensity * 0.44);
      }
    }

    const atmosphereDensity = this.coarse || budget.vfxDensity < 0.55
      ? 'reduced'
      : budget.vfxDensity < 0.85
        ? 'balanced'
        : 'full';
    const visibleClouds = atmosphereDensity === 'reduced' ? 2 : atmosphereDensity === 'balanced' ? 3 : 5;
    const visibleMotes = atmosphereDensity === 'reduced' ? 20 : atmosphereDensity === 'balanced' ? 36 : 56;
    const atmospherePulse = 0.5 + Math.sin(state.time * 0.42) * 0.5;
    const atmosphereIntensity = (
      0.38
      + atmospherePulse * 0.12
      + storm.stormCharge * 0.22
      + storm.pressureShear * 0.12
    ) * budget.transparencyScale;

    if (this.jovianAtmosphereRoot) {
      for (let index = 0; index < this.jovianAtmosphereClouds.length; index += 1) {
        const cloud = this.jovianAtmosphereClouds[index];
        const visible = index < visibleClouds;
        const baseX = Number(cloud.userData.baseX ?? cloud.position.x);
        const baseZ = Number(cloud.userData.baseZ ?? cloud.position.z);
        cloud.visible = visible;
        cloud.position.x = baseX + Math.sin(state.time * 0.09 + index * 1.4) * (0.14 + storm.pressureShear * 0.24);
        cloud.position.z = baseZ + Math.cos(state.time * 0.07 + index * 1.8) * (0.08 + storm.pressureShear * 0.08);
        cloud.material.opacity = visible
          ? (0.024 + atmospherePulse * 0.020 + storm.stormCharge * 0.026) * budget.transparencyScale
          : 0;
        cloud.scale.x = 0.96 + atmospherePulse * 0.05 + storm.pressureShear * 0.04;
      }
      if (this.jovianAtmosphereParticulate) {
        this.jovianAtmosphereParticulate.geometry.setDrawRange(0, visibleMotes);
        this.jovianAtmosphereParticulate.rotation.y = state.time * (0.004 + storm.stormCharge * 0.006);
        this.jovianAtmosphereParticulate.material.opacity = (
          0.08
          + atmospherePulse * 0.05
          + storm.stormCharge * 0.08
        ) * budget.transparencyScale;
      }
      if (this.jovianAtmosphereSpineHaze) {
        this.jovianAtmosphereSpineHaze.material.opacity = (
          0.035
          + atmospherePulse * 0.040
          + storm.pressureShear * 0.030
        ) * budget.transparencyScale;
        this.jovianAtmosphereSpineHaze.scale.setScalar(0.95 + atmospherePulse * 0.08 + storm.pressureShear * 0.04);
        this.jovianAtmosphereSpineHaze.rotation.z = state.time * 0.018;
      }
    }

    this.renderer.domElement.dataset.environmentAmbient = 'upper-haze+pressure-clouds+charged-particulate';
    this.renderer.domElement.dataset.environmentAmbientMotion = 'crosswind-drift+pressure-breath+charged-drift';
    this.renderer.domElement.dataset.environmentAmbientDetail = `${visibleClouds}-clouds+${visibleMotes}-motes+spine-haze`;
    this.renderer.domElement.dataset.environmentAmbientIntensity = atmosphereIntensity.toFixed(2);
    this.renderer.domElement.dataset.environmentStormLanguage = 'storm-charge-sweeps+pressure-shear-bands+relief-pulse';
    this.renderer.domElement.dataset.environmentStormMode = storm.mode;
    this.renderer.domElement.dataset.environmentStormIntensity = storm.intensity.toFixed(2);
    this.renderer.domElement.dataset.environmentPressureShear = storm.pressureShear.toFixed(2);
    this.renderer.domElement.dataset.environmentPressureRange = `${storm.minPressure.toFixed(2)}-${storm.maxPressure.toFixed(2)}`;
    this.renderer.domElement.dataset.environmentStormSource = 'live-sector-pressure+service-breach+contract-conditions';
    this.renderer.domElement.dataset.environmentStormDetail = reducedStormDetail ? '2-sweeps+2-bands+relief-pulse' : '4-sweeps+3-bands+relief-pulse';
    this.renderer.domElement.dataset.environmentVfx = 'storm-charge-sweeps+pressure-shear-bands+relief-pulse';
    this.renderer.domElement.dataset.environmentTone = storm.venting ? 'storm-orange+pressure-cyan+vent-red' : 'storm-orange+pressure-cyan';
    this.renderer.domElement.dataset.readabilityLanguage = 'tower-height+bridge-lines+amber-wayfinding+pressure-shear+storm-charge';
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

  private clearAuthoredInteractables() {
    this.interactableLoadGeneration += 1;
    for (const visual of this.authoredInteractables.values()) {
      visual.instance.release();
      visual.ownedMaterials.forEach(material => material.dispose());
    }
    this.authoredInteractables.clear();
    this.authoredInteractableRequests.clear();
    this.authoredInteractableRoot.clear();
    this.renderer.domElement.dataset.interactableVisual = 'procedural-loading';
    delete this.renderer.domElement.dataset.interactableAssets;
    delete this.renderer.domElement.dataset.interactableFallback;
    delete this.renderer.domElement.dataset.interactableMode;
    delete this.renderer.domElement.dataset.interactableBiome;
    delete this.renderer.domElement.dataset.interactableKit;
    delete this.renderer.domElement.dataset.interactablePressureKit;
    delete this.renderer.domElement.dataset.interactablePressureSource;
    delete this.renderer.domElement.dataset.interactablePressureState;
    delete this.renderer.domElement.dataset.interactablePressureDoor;
  }

  private async loadAuthoredInteractable(object: CombatObject, mission: Contract) {
    if (this.authoredInteractableRequests.has(object.id)) return;
    const spinHabitatFamily = mission.location !== 'spin-habitat'
      ? null
      : object.kind === 'powerControl'
        ? SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES.spinBusIsolator
        : object.kind === 'gravityControl'
          ? SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES.gravityTrim
          : mission.objectiveMode === 'machinery-recovery' && object.id === 'salvage-node-a'
            ? SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES.bearingControl
            : mission.objectiveMode === 'machinery-recovery' && object.id === 'salvage-node-b'
              ? SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES.attitudeFlywheel
              : object.kind === 'doorControl' || object.kind === 'sealControl'
                ? SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES.pressureLock
                : null;
    const jovianHarvesterFamily = mission.location !== 'jovian-harvester'
      ? null
      : object.kind === 'powerControl'
        ? JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.stormBusIsolator
        : object.kind === 'gravityControl'
          ? JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.deckMassTrim
          : mission.objectiveMode === 'machinery-recovery' && object.id === 'salvage-node-a'
            ? JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.skimmerCompressor
            : mission.objectiveMode === 'machinery-recovery' && object.id === 'salvage-node-b'
              ? JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.separatorPackage
              : object.kind === 'doorControl'
                ? JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.stormPressureLock
                : object.kind === 'sealControl'
                  ? JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.reliefManifold
                  : null;
    const family = spinHabitatFamily
      ?? jovianHarvesterFamily
      ?? (object.kind === 'salvageNode'
        ? INTERACTABLE_ASSET_FAMILIES.salvage
        : panelObject(object)
          ? INTERACTABLE_ASSET_FAMILIES.control
          : null);
    if (!family) return;
    const spec = selectGraphicsAssetSpec(family, this.coarse ? 0.55 : 1);
    if (!spec) return;

    this.authoredInteractableRequests.add(object.id);
    const generation = this.interactableLoadGeneration;
    try {
      const instance = await instantiateGraphicsAsset(spec);
      if (this.disposed || generation !== this.interactableLoadGeneration) {
        instance.release();
        return;
      }

      const root = instance.root;
      const ownedMaterials: THREE.Material[] = [];
      const statusMaterials: THREE.MeshStandardMaterial[] = [];
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const material = Array.isArray(mesh.material) ? null : mesh.material;
        if (material instanceof THREE.MeshStandardMaterial && material.name.includes('interactable-status-emissive')) {
          const cloned = material.clone();
          mesh.material = cloned;
          ownedMaterials.push(cloned);
          statusMaterials.push(cloned);
        }
      });
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= bounds.min.y;
      }
      root.name = `authored-interactable-${object.id}`;
      this.authoredInteractableRoot.add(root);
      this.authoredInteractables.set(object.id, { instance, root, assetId: spec.id, statusMaterials, ownedMaterials });

      const loaded = new Set((this.renderer.domElement.dataset.interactableAssets ?? '').split(',').filter(Boolean));
      loaded.add(spec.id);
      this.renderer.domElement.dataset.interactableAssets = [...loaded].sort().join(',');
      this.renderer.domElement.dataset.interactableVisual = 'authored';
      if (mission.location === 'spin-habitat') {
        this.renderer.domElement.dataset.interactableBiome = 'spin-habitat';
        this.renderer.domElement.dataset.interactableMode = 'spin-habitat-machinery+mission-controls';
        this.renderer.domElement.dataset.interactableKit = 'spin-bus-isolator+gravity-trim+bearing-control+attitude-flywheel+pressure-lock';
      } else if (mission.location === 'jovian-harvester' && jovianHarvesterFamily) {
        this.renderer.domElement.dataset.interactableBiome = 'jovian-harvester';
        this.renderer.domElement.dataset.interactableMode = 'jovian-gas-machinery+mission-controls';
        this.renderer.domElement.dataset.interactableKit = 'storm-bus-isolator+deck-mass-trim+skimmer-compressor+separator-package';
        this.renderer.domElement.dataset.interactablePressureKit = 'storm-pressure-lock+relief-manifold';
        this.renderer.domElement.dataset.interactablePressureSource = 'live-pressure-links+breach-state+sector-pressure';
      } else if (mission.location !== 'jovian-harvester') {
        delete this.renderer.domElement.dataset.interactableBiome;
        delete this.renderer.domElement.dataset.interactableKit;
        this.renderer.domElement.dataset.interactableMode = 'control-terminal+salvage-tag-node';
      }
    } catch (error) {
      if (this.disposed || generation !== this.interactableLoadGeneration) return;
      const fallback = new Set((this.renderer.domElement.dataset.interactableFallback ?? '').split(',').filter(Boolean));
      fallback.add(object.kind === 'salvageNode' ? 'salvage' : 'control');
      this.renderer.domElement.dataset.interactableFallback = [...fallback].sort().join(',');
      this.renderer.domElement.dataset.interactableVisual = 'procedural-fallback';
      console.warn(`Authored interactable asset failed to load for ${object.id}; keeping procedural fallback.`, error);
    }
  }

  private syncObjects(state: SimState, mission: Contract) {
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
        if (panelObject(object)) void this.loadAuthoredInteractable(object, mission);
      }

      const authored = this.authoredInteractables.get(object.id);
      const authoredBrittleSupport = mission.location === 'ice-mine' && this.iceMineBrittleSupportVisuals.has(object.id);
      mesh.visible = object.active && !authored && !authoredBrittleSupport;
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

      if (authored) {
        authored.root.visible = object.active;
        authored.root.position.set(scaled(objectCenterX), 0, scaled(objectCenterY));
        const footprintScale = THREE.MathUtils.clamp(scaled(Math.max(object.w, object.h)) * 0.82, 0.72, 1.08);
        authored.root.scale.setScalar(object.kind === 'salvageNode' ? Math.max(0.82, footprintScale) : footprintScale);
        let statusColor = object.exposed ? 0x82c58c : objectColor(object);
        let statusIntensity = object.exposed ? 0.42 : 1.0 + Math.sin(state.time * 4.5 + objectCenterX * 0.01) * 0.16;
        if (mission.location === 'jovian-harvester' && object.kind === 'doorControl') {
          const pressureLink = state.links.find(link => link.id === 'door-ab');
          statusColor = pressureLink?.open ? 0xf0aa55 : 0x79c8d1;
          statusIntensity = pressureLink?.open ? 1.14 + Math.sin(state.time * 4.8) * 0.20 : 0.62;
        } else if (mission.location === 'jovian-harvester' && object.kind === 'sealControl') {
          const breachId = object.id === 'boss-seal' ? 'boss-breach' : 'service-breach';
          const breach = state.breaches.find(item => item.id === breachId);
          statusColor = breach?.active && !breach.sealed ? 0xff7048 : breach?.sealed || object.exposed ? 0x82c58c : 0x79c8d1;
          statusIntensity = breach?.active && !breach.sealed ? 1.18 + Math.sin(state.time * 6.4) * 0.30 : 0.62;
        }
        for (const material of authored.statusMaterials) {
          material.color.setHex(statusColor);
          material.emissive.setHex(statusColor);
          material.emissiveIntensity = statusIntensity;
        }
      }
    }
    for (const [id, mesh] of this.objectVisuals) if (!activeIds.has(id)) mesh.visible = false;
    for (const [id, visual] of this.authoredInteractables) if (!activeIds.has(id)) visual.root.visible = false;

    if (mission.location === 'jovian-harvester') {
      const serviceBreach = state.breaches.find(breach => breach.id === 'service-breach');
      const pressureSector = state.sectors.find(sector => sector.id === 'B') ?? state.sectors[0];
      const pressureDoor = state.links.find(link => link.id === 'door-ab');
      this.renderer.domElement.dataset.interactablePressureState = serviceBreach?.active && !serviceBreach.sealed
        ? 'venting'
        : pressureSector?.pressureState ?? 'normal';
      this.renderer.domElement.dataset.interactablePressureDoor = pressureDoor?.open ? 'open' : 'sealed';
    } else {
      delete this.renderer.domElement.dataset.interactablePressureState;
      delete this.renderer.domElement.dataset.interactablePressureDoor;
    }
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

      const chevron = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.34, 3),
        new THREE.MeshBasicMaterial({ color: 0xf4f0bf, transparent: true, opacity: 0.88, depthTest: false, depthWrite: false }),
      );
      chevron.position.y = 2.18;
      chevron.rotation.z = Math.PI;
      chevron.renderOrder = 42;
      chevron.name = 'objective-chevron';

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.28, 6),
        new THREE.MeshBasicMaterial({ color: 0xc8e87f, transparent: true, opacity: 0.34, depthTest: false, depthWrite: false }),
      );
      beam.position.y = 1.05;
      beam.renderOrder = 39;
      beam.name = 'objective-beam';
      this.objectiveBeacon.add(ring, diamond, chevron, beam);
    }

    this.objectiveBeacon.visible = true;
    this.objectiveBeacon.position.set(scaled(target.x + target.w / 2), 0, scaled(target.y + target.h / 2));
    const pulse = 1 + Math.sin(state.time * 6.5) * 0.08;
    this.objectiveBeacon.scale.setScalar(pulse);
    const ring = this.objectiveBeacon.getObjectByName('objective-ring');
    const diamond = this.objectiveBeacon.getObjectByName('objective-diamond');
    const chevron = this.objectiveBeacon.getObjectByName('objective-chevron');
    if (ring) ring.rotation.z = state.time * 0.9;
    if (diamond) {
      diamond.rotation.y = state.time * 1.8;
      diamond.position.y = 1.75 + Math.sin(state.time * 4.2) * 0.08;
    }
    if (chevron) {
      chevron.rotation.y = state.time * 1.1;
      chevron.position.y = 2.18 + Math.sin(state.time * 4.2 + 0.8) * 0.12;
    }
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

  private createEnemyVisual(enemy: Enemy, mission: Contract) {
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

    let bossSignature: THREE.Group | null = null;
    if (enemy.role === 'boss') {
      bossSignature = new THREE.Group();
      bossSignature.name = 'boss-signature-root';

      const phaseRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.075, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x8ee8ff, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
      );
      phaseRing.name = 'boss-phase-ring';
      phaseRing.rotation.x = Math.PI / 2;
      phaseRing.position.y = 0.055;
      bossSignature.add(phaseRing);

      const phaseHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.055, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0xff9a70, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
      );
      phaseHalo.name = 'boss-phase-halo';
      phaseHalo.position.y = 2.65;
      phaseHalo.rotation.y = Math.PI / 2;
      phaseHalo.visible = false;
      bossSignature.add(phaseHalo);

      const telegraph = new THREE.Mesh(
        new THREE.CircleGeometry(2.65, 32, -0.42, 0.84),
        new THREE.MeshBasicMaterial({ color: 0xffa070, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      );
      telegraph.name = 'boss-telegraph-wedge';
      telegraph.rotation.x = -Math.PI / 2;
      telegraph.position.y = 0.035;
      telegraph.visible = false;
      bossSignature.add(telegraph);

      const pylonGeometry = new THREE.BoxGeometry(0.18, 0.7, 0.18);
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI / 2;
        const pylon = new THREE.Mesh(
          pylonGeometry,
          new THREE.MeshStandardMaterial({
            color: 0x6b5f5a,
            emissive: 0x5a241d,
            emissiveIntensity: 0.3,
            metalness: 0.78,
            roughness: 0.34,
          }),
        );
        pylon.name = `boss-signature-pylon-${index}`;
        pylon.position.set(Math.cos(angle) * 0.92, 1.72 + (index % 2) * 0.14, Math.sin(angle) * 0.92);
        pylon.rotation.z = index % 2 === 0 ? 0.28 : -0.28;
        pylon.castShadow = true;
        bossSignature.add(pylon);
      }
      root.add(bossSignature);
    }

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
      bossSignature,
      role: enemy.role,
      proceduralVisuals,
      assetInstance: null,
      authoredRoot: null,
      authoredMaterials: [],
      authoredOwnedMaterials: [],
      authoredAssetId: null,
      rig: null,
    };
    this.enemyVisuals.set(enemy.id, visual);
    void this.loadAuthoredEnemy(visual, enemy, mission);
    return visual;
  }

  private async loadAuthoredEnemy(visual: EnemyVisual, enemy: Enemy, mission: Contract) {
    const spinHabitatFamily = spinHabitatEnemyAssetFamily(enemy, mission);
    const spinHabitatBossFamily = spinHabitatBossAssetFamily(enemy, mission);
    const jovianHarvesterBossFamily = jovianHarvesterBossAssetFamily(enemy, mission);
    const iceMineBossFamily = iceMineBossAssetFamily(enemy, mission);
    const solarYardBossFamily = solarYardBossAssetFamily(enemy, mission);
    const localFamily = spinHabitatBossFamily ?? jovianHarvesterBossFamily ?? iceMineBossFamily ?? solarYardBossFamily ?? spinHabitatFamily;
    const family = localFamily ?? ENEMY_ASSET_FAMILIES[enemy.role];
    const spec = selectGraphicsAssetSpec(family, this.coarse ? 0.55 : 1);
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
      root.name = `authored-enemy-${localFamily?.id ?? enemy.role}`;
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
      visual.authoredAssetId = family.id;
      visual.proceduralVisuals.forEach(item => { item.visible = false; });

      this.authoredEnemyCount += 1;
      this.authoredEnemyRoles.add(enemy.role);
      this.renderer.domElement.dataset.enemyVisual = 'authored';
      this.renderer.domElement.dataset.enemyAuthoredCount = String(this.authoredEnemyCount);
      this.renderer.domElement.dataset.enemyRoles = [...this.authoredEnemyRoles].sort().join(',');
      if (spinHabitatFamily) {
        const localAssets = new Set((this.renderer.domElement.dataset.enemyLocalAssets ?? '').split(',').filter(Boolean));
        localAssets.add(spec.id);
        this.renderer.domElement.dataset.enemyBiome = 'spin-habitat';
        this.renderer.domElement.dataset.enemyLocalVisual = 'authored';
        this.renderer.domElement.dataset.enemyLocalKit = 'spoke-marksman+spin-trim-specialist+ring-drone-carrier+axis-shield-boarder';
        this.renderer.domElement.dataset.enemyLocalAssets = [...localAssets].sort().join(',');
      }
      if (spinHabitatBossFamily) {
        this.renderer.domElement.dataset.bossBiome = 'spin-habitat';
        this.renderer.domElement.dataset.bossPresentation = 'sable-voss';
        this.renderer.domElement.dataset.bossVisual = 'authored';
        this.renderer.domElement.dataset.bossAsset = spec.id;
        this.renderer.domElement.dataset.bossSilhouette = 'counterspin-mantle+governor-towers+command-visor';
        this.renderer.domElement.dataset.bossPalette = 'recovery-green+cyan-command+amber-phase-two';
      }
      if (jovianHarvesterBossFamily) {
        this.renderer.domElement.dataset.bossBiome = 'jovian-harvester';
        this.renderer.domElement.dataset.bossPresentation = 'stormline-foreman-ilex';
        this.renderer.domElement.dataset.bossVisual = 'authored';
        this.renderer.domElement.dataset.bossAsset = spec.id;
        this.renderer.domElement.dataset.bossSilhouette = 'storm-cowl+pressure-crown+relief-stacks';
        this.renderer.domElement.dataset.bossPalette = 'storm-orange+pressure-cyan+vent-red-phase-two';
      }
      if (iceMineBossFamily) {
        this.renderer.domElement.dataset.bossBiome = 'ice-mine';
        this.renderer.domElement.dataset.bossPresentation = 'rhea-kade';
        this.renderer.domElement.dataset.bossVisual = 'authored';
        this.renderer.domElement.dataset.bossAsset = spec.id;
        this.renderer.domElement.dataset.bossSilhouette = 'bore-cowl+cryo-tanks+fracture-ram';
        this.renderer.domElement.dataset.bossPalette = 'mine-steel+frost-cyan+fracture-amber-phase-two';
      }
      if (solarYardBossFamily) {
        this.renderer.domElement.dataset.bossBiome = 'solar-yard';
        this.renderer.domElement.dataset.bossPresentation = 'helios-9';
        this.renderer.domElement.dataset.bossVisual = 'authored';
        this.renderer.domElement.dataset.bossAsset = spec.id;
        this.renderer.domElement.dataset.bossSilhouette = 'sunshield-crown+reflector-wings+fabricator-core';
        this.renderer.domElement.dataset.bossPalette = 'ceramic-white+solar-gold+heat-amber+overheat-red-phase-two';
      }
      if (enemy.role === 'boss') {
        this.renderer.domElement.dataset.bossSignature = 'authored-boss+phase-ring+pylons';
        this.renderer.domElement.dataset.bossTelegraph = 'directional-wedge+phase-halo+pulse';
        this.renderer.domElement.dataset.bossDamageFx = 'armor-break+phase-emissive+low-hp-pulse';
      }
    } catch (error) {
      if (this.disposed) return;
      const fallback = new Set((this.renderer.domElement.dataset.enemyFallbackRoles ?? '').split(',').filter(Boolean));
      fallback.add(enemy.role);
      this.renderer.domElement.dataset.enemyFallbackRoles = [...fallback].sort().join(',');
      if (spinHabitatFamily) {
        const localFallback = new Set((this.renderer.domElement.dataset.enemyLocalFallback ?? '').split(',').filter(Boolean));
        localFallback.add(enemy.variant);
        this.renderer.domElement.dataset.enemyLocalFallback = [...localFallback].sort().join(',');
      }
      if (spinHabitatBossFamily) {
        this.renderer.domElement.dataset.bossFallback = 'sable-voss';
      }
      if (jovianHarvesterBossFamily) {
        this.renderer.domElement.dataset.bossFallback = 'stormline-foreman-ilex';
      }
      if (iceMineBossFamily) {
        this.renderer.domElement.dataset.bossFallback = 'rhea-kade';
      }
      if (solarYardBossFamily) {
        this.renderer.domElement.dataset.bossFallback = 'helios-9';
      }
      console.warn(`Authored ${localFamily?.id ?? enemy.role} enemy asset failed to load; keeping procedural fallback.`, error);
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

  private syncBossSignature(visual: EnemyVisual, enemy: Enemy, state: SimState) {
    const signature = visual.bossSignature;
    if (!signature) return;
    signature.visible = enemy.active && !enemy.dead;
    if (!signature.visible) return;

    const phaseRing = signature.getObjectByName('boss-phase-ring') as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | undefined;
    const phaseHalo = signature.getObjectByName('boss-phase-halo') as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | undefined;
    const telegraph = signature.getObjectByName('boss-telegraph-wedge') as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | undefined;
    const hpRatio = THREE.MathUtils.clamp(enemy.hp / Math.max(1, enemy.maxHp), 0, 1);
    const phaseTwo = enemy.bossPhase === 2;
    const armorBroken = enemy.maxArmor > 0 && enemy.armor <= 0;
    const lowHp = hpRatio < 0.34;
    const sableVoss = visual.authoredAssetId === 'spin-habitat-sable-voss';
    const stormlineIlex = visual.authoredAssetId === 'jovian-harvester-stormline-foreman';
    const rheaKade = visual.authoredAssetId === 'ice-mine-rhea-kade';
    const helios9 = visual.authoredAssetId === 'solar-yard-helios-9';
    const phaseColor = sableVoss
      ? phaseTwo ? 0xffb15b : armorBroken ? 0xffd27a : 0x72f1d0
      : stormlineIlex
        ? phaseTwo ? 0xff7357 : armorBroken ? 0x7fd9e8 : 0xf0ae69
        : rheaKade
          ? phaseTwo ? 0xffb465 : armorBroken ? 0xc6f5ff : 0x79d6e8
          : helios9
            ? phaseTwo ? 0xff6a3d : armorBroken ? 0xffd26a : 0xf2b447
            : phaseTwo ? 0xff8e68 : armorBroken ? 0xffc078 : 0x8ee8ff;

    if (phaseRing) {
      phaseRing.material.color.setHex(phaseColor);
      phaseRing.material.opacity = 0.34 + Math.sin(state.time * (phaseTwo ? 5.8 : 3.2) + enemy.patternIndex) * 0.1 + (lowHp ? 0.1 : 0);
      const ringScale = 1 + (phaseTwo ? 0.08 : 0.04) * Math.sin(state.time * 4.5);
      phaseRing.scale.setScalar(ringScale);
      phaseRing.rotation.z = state.time * (phaseTwo ? 1.1 : 0.55);
    }

    if (phaseHalo) {
      phaseHalo.visible = phaseTwo || armorBroken;
      phaseHalo.material.color.setHex(phaseColor);
      phaseHalo.material.opacity = phaseTwo ? 0.58 : 0.38;
      phaseHalo.rotation.z = -state.time * (phaseTwo ? 1.8 : 0.8);
      phaseHalo.scale.setScalar(lowHp ? 1.2 + Math.sin(state.time * 7.5) * 0.08 : 1);
    }

    if (telegraph) {
      telegraph.visible = enemy.telegraph > 0;
      telegraph.material.color.setHex(phaseColor);
      telegraph.material.opacity = THREE.MathUtils.clamp(0.16 + enemy.telegraph * 0.55, 0.16, 0.72);
      const telegraphScale = 0.86 + THREE.MathUtils.clamp(enemy.telegraph, 0, 1) * (phaseTwo ? 0.38 : 0.28);
      telegraph.scale.set(telegraphScale, telegraphScale, telegraphScale);
    }

    for (let index = 0; index < 4; index += 1) {
      const pylon = signature.getObjectByName(`boss-signature-pylon-${index}`) as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | undefined;
      if (!pylon) continue;
      pylon.material.emissive.setHex(phaseColor);
      pylon.material.emissiveIntensity = phaseTwo ? 0.58 : armorBroken ? 0.42 : 0.28;
      pylon.scale.y = lowHp ? 0.8 + Math.sin(state.time * 8 + index) * 0.08 : 1;
    }

    const presentationPrefix = sableVoss ? 'sable-voss+' : stormlineIlex ? 'stormline-foreman-ilex+' : rheaKade ? 'rhea-kade+' : helios9 ? 'helios-9+' : '';
    this.renderer.domElement.dataset.bossPhaseVisual = `${presentationPrefix}phase:${enemy.bossPhase}+pattern:${enemy.bossPattern}+telegraph:${enemy.telegraph > 0 ? 'active' : 'idle'}`;
  }

  private syncEnemies(state: SimState, mission: Contract, mobileTargetId: number | null) {
    const seen = new Set<number>();
    for (const enemy of state.enemies) {
      seen.add(enemy.id);
      const visual = this.enemyVisuals.get(enemy.id) ?? this.createEnemyVisual(enemy, mission);
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
      if (enemy.role === 'boss') this.syncBossSignature(visual, enemy, state);
      visual.body.material.emissive.setHex(enemy.statuses.disrupted > 0 ? 0x63508a : enemy.telegraph > 0 ? 0x7a3327 : 0x000000);
      visual.body.material.emissiveIntensity = enemy.statuses.disrupted > 0 || enemy.telegraph > 0 ? 0.34 : 0;
      if (visual.authoredRoot) {
        this.syncAuthoredEnemyAnimation(visual, enemy, state);
        const sableVoss = visual.authoredAssetId === 'spin-habitat-sable-voss';
        const stormlineIlex = visual.authoredAssetId === 'jovian-harvester-stormline-foreman';
        const rheaKade = visual.authoredAssetId === 'ice-mine-rhea-kade';
        const helios9 = visual.authoredAssetId === 'solar-yard-helios-9';
        const bossPhaseEmissive = enemy.role === 'boss' && enemy.bossPhase === 2
          ? sableVoss ? 0x76521f : stormlineIlex ? 0x8a3328 : rheaKade ? 0x7a5428 : helios9 ? 0x8f3222 : 0x7a2f24
          : 0x000000;
        const statusEmissive = enemy.statuses.disrupted > 0 ? 0x63508a : enemy.telegraph > 0 ? 0x7a3327 : bossPhaseEmissive;
        const statusIntensity = enemy.statuses.disrupted > 0 || enemy.telegraph > 0 ? 0.28 : bossPhaseEmissive ? 0.24 : 0;
        for (const material of visual.authoredMaterials) {
          material.color.setHex(
            sableVoss
              ? enemy.bossPhase === 2 ? 0x79623f : 0x3f6b64
              : stormlineIlex
                ? enemy.bossPhase === 2 ? 0x8a4938 : 0x6d5138
                : rheaKade
                  ? enemy.bossPhase === 2 ? 0x7f6241 : 0x3d555b
                  : helios9
                    ? enemy.bossPhase === 2 ? 0x8b4f31 : 0x76694f
                    : enemy.role === 'boss' && enemy.bossPhase === 2
                  ? 0xc76252
                  : visual.authoredAssetId?.startsWith('spin-habitat-') ? spinHabitatEnemyColor(enemy) : roleColors[enemy.role],
          );
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

  private ensureDamageNumber(index: number) {
    while (this.damageNumberPool.length <= index) {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 72;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to create damage number canvas context.');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.name = 'enemy-damage-number';
      sprite.renderOrder = 80;
      sprite.frustumCulled = false;
      sprite.visible = false;
      this.dynamicRoot.add(sprite);
      this.damageNumberPool.push({ sprite, canvas, context, texture, serial: -1 });
    }
    return this.damageNumberPool[index];
  }

  private paintDamageNumber(visual: DamageNumberVisual, value: number, kind: 'armor' | 'health' | 'heavy') {
    const { canvas, context, texture } = visual;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const label = String(Math.max(1, Math.round(value)));
    const heavy = kind === 'heavy';
    context.font = `900 ${heavy ? 44 : 38}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = heavy ? 10 : 8;
    context.strokeStyle = 'rgba(3, 6, 7, 0.9)';
    context.strokeText(label, canvas.width / 2, canvas.height / 2 + 1);
    context.fillStyle = kind === 'armor' ? '#8ee8ff' : heavy ? '#ffd27a' : '#fff0dc';
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 1);
    texture.needsUpdate = true;
  }

  private syncDamageNumbers(state: SimState) {
    let count = 0;
    for (const popup of state.damageNumbers) {
      if (!popup.active) continue;
      const visual = this.ensureDamageNumber(count++);
      if (visual.serial !== popup.serial) {
        visual.serial = popup.serial;
        this.paintDamageNumber(visual, popup.value, popup.kind);
      }
      const progress = 1 - popup.life / Math.max(0.01, popup.maxLife);
      const fade = THREE.MathUtils.clamp(1 - Math.max(0, progress - 0.55) / 0.45, 0, 1);
      const heavyScale = popup.kind === 'heavy' ? 1.18 : 1;
      visual.sprite.visible = true;
      visual.sprite.material.opacity = fade;
      visual.sprite.position.set(scaled(popup.x), 2.55 + progress * 1.05, scaled(popup.y));
      visual.sprite.scale.set(1.85 * heavyScale, 0.84 * heavyScale, 1);
    }
    for (let index = count; index < this.damageNumberPool.length; index += 1) this.damageNumberPool[index].sprite.visible = false;
    this.renderer.domElement.dataset.damageNumbers = count > 0 ? 'active' : 'idle';
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

  private syncProjectiles(state: SimState, transparencyScale: number) {
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
        visual.trail.material.opacity = 0.88 * transparencyScale;
      } else if (projectile.weapon === 'breacher') {
        visual.core.scale.set(size * 1.22, size * 0.92, size * 1.22);
        visual.core.material.emissiveIntensity = 1.45;
        visual.trail.scale.set(0.62, 1.35, 1.35);
        visual.trail.material.opacity = 0.40 * transparencyScale;
      } else {
        visual.core.scale.setScalar(size * 0.88);
        visual.core.material.emissiveIntensity = 1.65;
        visual.trail.scale.set(1.5, 0.92, 0.92);
        visual.trail.material.opacity = 0.62 * transparencyScale;
      }
    }
    for (let index = count; index < this.projectilePool.length; index += 1) this.projectilePool[index].root.visible = false;
  }

  private async loadAuthoredGroundLoot(visual: GroundLootVisual) {
    if (visual.assetRequested) return;
    visual.assetRequested = true;
    const spec = selectGraphicsAssetSpec(PICKUP_ASSET_FAMILY, this.coarse ? 0.55 : 1);
    if (!spec) return;

    try {
      const instance = await instantiateGraphicsAsset(spec);
      if (this.disposed) {
        instance.release();
        return;
      }
      const root = instance.root;
      const ownedMaterials: THREE.Material[] = [];
      const accentMaterials: THREE.MeshStandardMaterial[] = [];
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const material = Array.isArray(mesh.material) ? null : mesh.material;
        if (material instanceof THREE.MeshStandardMaterial && material.name.includes('pickup-accent-emissive')) {
          const cloned = material.clone();
          mesh.material = cloned;
          ownedMaterials.push(cloned);
          accentMaterials.push(cloned);
        }
      });
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= bounds.min.y;
      }
      root.name = 'authored-ground-loot';
      visual.root.add(root);
      visual.assetInstance = instance;
      visual.authoredRoot = root;
      visual.accentMaterials = accentMaterials;
      visual.ownedMaterials = ownedMaterials;
      visual.core.visible = false;
      this.renderer.domElement.dataset.lootVisual = 'authored';
      this.renderer.domElement.dataset.lootAsset = spec.id;
      this.renderer.domElement.dataset.lootReadability = 'authored-capsule+rarity-ring+beam';
    } catch (error) {
      if (this.disposed) return;
      visual.core.visible = true;
      this.renderer.domElement.dataset.lootVisual = 'procedural-fallback';
      console.warn('Authored recovery pickup failed to load; keeping procedural fallback.', error);
    }
  }

  private syncGroundLoot(state: SimState) {
    let count = 0;
    for (const drop of state.groundLoot) {
      if (!drop.active || drop.collected) continue;
      while (this.groundLootPool.length <= count) {
        const root = new THREE.Group();
        const core = new THREE.Mesh(this.groundLootCoreGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, metalness: 0.35, roughness: 0.22 }));
        core.position.y = 0.52;
        const marker = new THREE.Mesh(this.groundLootMarkerGeometries.diamond, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5, metalness: 0.1, roughness: 0.24, side: THREE.DoubleSide }));
        marker.position.y = 1.16;
        const ring = new THREE.Mesh(this.groundLootRingGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06;
        const beam = new THREE.Mesh(this.groundLootBeamGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, depthTest: false })); beam.position.y = 0.9;
        root.add(core, marker, ring, beam);
        this.dynamicRoot.add(root);
        const visual: GroundLootVisual = { root, core, marker, ring, beam, assetInstance: null, authoredRoot: null, accentMaterials: [], ownedMaterials: [], assetRequested: false };
        this.groundLootPool.push(visual);
        void this.loadAuthoredGroundLoot(visual);
      }
      const visual = this.groundLootPool[count++];
      const presentation = groundLootPresentation(drop.rarity);
      const color = presentation.color;
      visual.root.visible = true;
      visual.root.position.set(scaled(drop.x), 0, scaled(drop.y));
      visual.root.rotation.y = state.time * 0.8 + drop.enemyId;
      visual.core.visible = !visual.authoredRoot;
      visual.core.material.color.setHex(color);
      visual.core.material.emissive.setHex(color);
      visual.marker.geometry = this.groundLootMarkerGeometries[presentation.shape];
      visual.marker.material.color.setHex(color);
      visual.marker.material.emissive.setHex(color);
      visual.marker.material.emissiveIntensity = 1.35 + presentation.rank * 0.22;
      visual.ring.material.color.setHex(color);
      visual.beam.material.color.setHex(color);
      for (const material of visual.accentMaterials) {
        material.color.setHex(color);
        material.emissive.setHex(color);
        material.emissiveIntensity = 1.05 + presentation.rank * 0.2;
      }
      const pulse = 1 + Math.sin(state.time * 7 + drop.enemyId) * 0.12;
      visual.core.scale.setScalar(presentation.markerScale * pulse);
      visual.marker.scale.setScalar(presentation.markerScale * (0.96 + Math.sin(state.time * 6 + drop.enemyId) * 0.06));
      visual.marker.position.y = 1.14 + Math.sin(state.time * 4.5 + drop.enemyId) * 0.08;
      visual.marker.rotation.z = presentation.shape === 'bar' ? 0 : state.time * 0.55;
      if (visual.authoredRoot) {
        const authoredScale = 1 + presentation.rank * 0.055;
        visual.authoredRoot.scale.setScalar(authoredScale * (0.98 + Math.sin(state.time * 5 + drop.enemyId) * 0.025));
        visual.authoredRoot.position.y = 0.10 + Math.sin(state.time * 4.5 + drop.enemyId) * 0.035;
      }
      visual.ring.scale.setScalar(presentation.ringScale);
      visual.beam.scale.y = presentation.beaconScale;
      visual.beam.position.y = 0.85 * presentation.beaconScale;
      visual.beam.material.opacity = 0.14 + presentation.rank * 0.11;
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

  private ensureImpactSpark(index: number, color: number) {
    while (this.impactSparkPool.length <= index) {
      const material = new THREE.PointsMaterial({ color, size: 0.11, transparent: true, opacity: 0.72, depthWrite: false, sizeAttenuation: true });
      const points = new THREE.Points(this.impactSparkGeometry, material);
      points.frustumCulled = false;
      this.dynamicRoot.add(points);
      this.impactSparkPool.push(points);
    }
    return this.impactSparkPool[index];
  }

  private syncEffects(state: SimState, detailLevel: number, vfxDensity: number, transparencyScale: number) {
    let count = 0;
    let sparkCount = 0;
    let impactOrdinal = 0;
    let lastImpactLanguage = '';
    let lastCapstoneFx = '';
    const reducedEffects = detailLevel < 0.58 || vfxDensity < 0.55;
    for (const effect of state.effects) {
      if (!effect.active) continue;
      let color = effect.kind === 'vanguard' ? 0xbd8a64 : effect.kind === 'vector' ? 0x74a6c7 : effect.kind === 'systems' ? 0x9b87bd : effect.kind === 'arc' ? 0x84caeb : effect.kind === 'breach' ? 0xf07d4d : effect.kind === 'mark' ? 0xd0e07a : effect.kind === 'pulse' ? 0x9debd8 : 0xc2ddd3;
      if (effect.kind === 'vanguard' || effect.kind === 'vector' || effect.kind === 'systems') lastCapstoneFx = effect.kind;
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
      const baseScale = Math.max(0.18, scaled(effect.radius) * (0.42 + progress * 0.85) * impactScale);
      ring.visible = true;
      ring.material.color.setHex(color);
      const capstoneOpacity = effect.kind === 'vanguard' || effect.kind === 'vector' || effect.kind === 'systems' ? 0.9 : effect.kind === 'mark' ? 0.58 : 0.76;
      ring.material.opacity = Math.max(0, capstoneOpacity * (1 - progress) * Math.max(0.72, transparencyScale));
      ring.position.set(scaled(effect.x), 0.12 + progress * 0.35, scaled(effect.y));
      if (effect.kind === 'arc') {
        ring.scale.set(baseScale * 0.72, baseScale, baseScale * 1.28);
        ring.rotation.z = -state.time * 2.8 - progress * Math.PI;
      } else if (effect.kind === 'mark') {
        ring.scale.set(baseScale * 0.78, baseScale, baseScale * 0.78);
        ring.rotation.z = state.time * 0.7;
      } else if (effect.kind === 'pulse') {
        ring.scale.set(baseScale * 1.2, baseScale, baseScale * 1.2);
        ring.rotation.z = progress * Math.PI * 0.5;
      } else if (effect.kind === 'vanguard') {
        ring.scale.set(baseScale * 1.38, baseScale * 0.82, baseScale * 0.88);
        ring.rotation.z = progress * Math.PI * 0.18;
      } else if (effect.kind === 'vector') {
        ring.scale.set(baseScale * 1.62, baseScale * 0.72, baseScale * 0.58);
        ring.rotation.z = -0.48 + progress * Math.PI * 0.72;
      } else if (effect.kind === 'systems') {
        const meshPulse = 0.86 + Math.sin((state.time + progress) * 18) * 0.12;
        ring.scale.set(baseScale * meshPulse, baseScale * 1.18, baseScale * meshPulse);
        ring.rotation.z = state.time * 1.8 + progress * Math.PI;
      } else {
        ring.scale.setScalar(baseScale);
        if (effect.kind === 'impact') ring.rotation.z = state.time * 2.2 + progress * Math.PI;
      }

      if (effect.kind === 'impact') impactOrdinal += 1;
      const sparkStride = vfxDensity >= 0.95 ? 1 : vfxDensity >= 0.65 ? 2 : 3;
      if (effect.kind === 'impact' && !reducedEffects && impactOrdinal % sparkStride === 0) {
        const spark = this.ensureImpactSpark(sparkCount++, color);
        spark.visible = true;
        spark.material.color.setHex(color);
        spark.material.opacity = Math.max(0, 0.8 * (1 - progress) * transparencyScale);
        spark.position.set(scaled(effect.x), 0.12, scaled(effect.y));
        spark.rotation.set(state.time * 2.4, state.time * 1.6, state.time * 3.1);
        spark.scale.setScalar(0.72 + progress * 1.9);
      }
    }
    for (let index = count; index < this.effectPool.length; index += 1) this.effectPool[index].visible = false;
    for (let index = sparkCount; index < this.impactSparkPool.length; index += 1) this.impactSparkPool[index].visible = false;
    if (lastImpactLanguage) this.renderer.domElement.dataset.impactFx = lastImpactLanguage;
    this.renderer.domElement.dataset.capstoneFx = lastCapstoneFx || 'idle';
    this.renderer.domElement.dataset.effectsMode = reducedEffects ? 'reduced' : 'full';
    this.renderer.domElement.dataset.combatVfx = 'shape-coded+surface-impacts+ability-pulses+class-capstones';
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
        const speed = Math.hypot(debris.vx, debris.vy);
        mesh.scale.set(
          Math.max(0.48, debris.radius * 0.16),
          Math.max(0.32, debris.radius * 0.11),
          Math.max(0.4, debris.radius * 0.13),
        );
        mesh.rotation.set(state.time * debris.vy * 0.012, state.time * debris.vx * 0.01, state.time * (0.55 + Math.min(1.2, speed * 0.002)));
        mesh.material.color.setHex(speed > 240 ? 0x8c7761 : 0x66736f);
        mesh.material.emissive.setHex(speed > 240 ? 0x6f371f : 0x000000);
        mesh.material.emissiveIntensity = speed > 240 ? 0.18 : 0;
      }
    }
    for (let index = count; index < this.debrisPool.length; index += 1) this.debrisPool[index].visible = false;
  }

  private syncLighting(state: SimState, mission: Contract, quality: number, budget: RenderBudgetSnapshot) {
    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    const isRefinery = mission.location === 'asteroid-refinery';
    const isDamagedVessel = mission.location === 'damaged-vessel';
    const isSolarYard = mission.location === 'solar-yard';
    const lightingProfile = LOCATION_LIGHTING_PROFILES[mission.location];
    const reducedEffects = budget.tier === 2 || quality < 0.55;
    const solarShutter = isSolarYard ? state.objects.find(object => object.id === 'solar-shutter') : undefined;
    const solarSurge = isSolarYard
      && state.time >= 10
      && state.time < 18
      && !solarShutter?.exposed;

    let readabilityX = px - 0.6;
    let readabilityZ = pz + 0.7;
    let nearestEnemyDistanceSq = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const dx = enemy.x - state.player.x;
      const dy = enemy.y - state.player.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= nearestEnemyDistanceSq || distanceSq > 650 * 650) continue;
      nearestEnemyDistanceSq = distanceSq;
      readabilityX = scaled(state.player.x + dx * 0.42);
      readabilityZ = scaled(state.player.y + dy * 0.42);
    }
    this.playerReadabilityLight.position.set(readabilityX, 2.7, readabilityZ);
    this.playerReadabilityLight.intensity = reducedEffects ? 4.8 : 7.2;
    this.playerReadabilityLight.distance = reducedEffects ? 5.8 : 7.5;

    let activeBoss: Enemy | null = null;
    for (const enemy of state.enemies) {
      if (enemy.active && !enemy.dead && enemy.role === 'boss') {
        activeBoss = enemy;
        break;
      }
    }
    const bossPhaseTwo = activeBoss?.bossPhase === 2;
    const bossPulse = bossPhaseTwo ? 1 + Math.sin(state.time * 4.6) * 0.16 : 1;

    this.emergencyLight.position.set(px + 2.4, 3.2, pz - 2.2);
    this.emergencyLight.color.setHex(lightingProfile.emergencyColor);
    this.emergencyLight.intensity = lightingProfile.emergencyIntensity * (reducedEffects ? 0.72 : 1) * (bossPhaseTwo ? bossPulse : 1);

    const world = getWorldSize();
    const firstPractical = this.refineryPracticalLights[0];
    firstPractical.visible = isRefinery || isDamagedVessel;
    if (isDamagedVessel) {
      firstPractical.color.setHex(0xf0754f);
      firstPractical.position.set(scaled(world.w * 0.86), 3.05, scaled(world.h * 0.50));
      firstPractical.intensity = (reducedEffects ? 5.4 : 8.6) * bossPulse;
    } else {
      firstPractical.color.setHex(0xffb36c);
      firstPractical.position.set(scaled(world.w * 0.50), 3.25, scaled(world.h * 0.23));
      firstPractical.intensity = (reducedEffects ? 6.2 : 9.6) * bossPulse;
    }
    const secondPractical = this.refineryPracticalLights[1];
    secondPractical.visible = (isRefinery || isDamagedVessel) && !reducedEffects;
    if (isDamagedVessel) {
      secondPractical.color.setHex(0x6bc6c1);
      secondPractical.position.set(scaled(world.w * 0.18), 2.65, scaled(world.h * 0.40));
      secondPractical.intensity = 4.8 * bossPulse;
    } else {
      secondPractical.color.setHex(0x6edce7);
      secondPractical.position.set(scaled(world.w * 0.71), 2.9, scaled(world.h * 0.67));
      secondPractical.intensity = 7.0 * bossPulse;
    }

    this.keyLight.color.setHex(lightingProfile.keyColor);
    this.rimLight.color.setHex(lightingProfile.rimColor);
    this.keyLight.intensity = isSolarYard ? (solarSurge ? 3.75 : 3.15) : lightingProfile.keyIntensity;
    this.rimLight.intensity = isSolarYard ? (solarSurge ? 0.68 : 0.82) : lightingProfile.rimIntensity;
    const baseExposure = isSolarYard ? (solarSurge ? 1.16 : 1.08) : lightingProfile.exposure;
    this.renderer.toneMappingExposure = mission.conditions.includes('low-visibility') ? baseExposure * 1.04 : baseExposure;
    this.renderer.domElement.dataset.locationLighting = `${mission.location}:${lightingProfile.id}:aces-${this.renderer.toneMappingExposure.toFixed(2)}`;

    if (isSolarYard) {
      const shutterClosed = !!solarShutter?.exposed;
      if (this.solarYardThermalShutterRoot && this.solarYardThermalShutterLeft && this.solarYardThermalShutterRight) {
        this.solarYardThermalShutterLeft.position.x = shutterClosed ? -1.34 : -2.22;
        this.solarYardThermalShutterRight.position.x = shutterClosed ? 1.34 : 2.22;
        this.renderer.domElement.dataset.environmentThermalShutters = `authored:${shutterClosed ? 'closed' : 'open'}`;
        this.renderer.domElement.dataset.environmentThermalProtection = shutterClosed
          ? 'radiant-load-cut'
          : solarSurge ? 'solar-surge-exposed' : 'shutters-open';
        this.renderer.domElement.dataset.environmentThermalShutterControl = 'solar-shutter:state-linked';
      }

      if (this.solarYardGantryCraneTrolleys.length > 0) {
        const offsets = this.solarYardGantryCraneTrolleys.map(({ trolley, phase, amplitude, speed }) => {
          const offset = Math.sin(state.time * speed + phase) * amplitude;
          trolley.position.z = offset;
          return offset.toFixed(2);
        });
        this.renderer.domElement.dataset.environmentCraneMotion = `reciprocating-trolleys:${this.solarYardGantryCraneTrolleys.length}`;
        this.renderer.domElement.dataset.environmentCraneOffsets = offsets.join(',');
      }

      this.keyLight.position.set(scaled(world.w * 1.12), 30, scaled(world.h * 0.10));
      this.keyLight.target.position.set(scaled(world.w * 0.48), 0, scaled(world.h * 0.58));
      if (!this.keyLight.target.parent) this.scene.add(this.keyLight.target);
      this.rimLight.position.set(scaled(world.w * 0.08), 13.5, scaled(world.h * 0.88));

      const shadeOpacity = (solarSurge ? 0.22 : 0.17) * (reducedEffects ? 0.82 : 1);
      const sunOpacity = (solarSurge ? 0.12 : 0.075) * budget.transparencyScale;
      for (const patch of this.solarYardShadePatches) {
        patch.material.opacity = shadeOpacity;
      }
      for (const patch of this.solarYardSunPatches) {
        patch.material.opacity = sunOpacity;
      }

      this.renderer.domElement.dataset.environmentLighting = `solar-yard-hard-key+cool-fill+contact:player+enemy+shadow:${budget.shadows ? budget.shadowMapSize : 0}`;
      this.renderer.domElement.dataset.environmentSunShadow = 'hard-sun+cool-shade+long-shadow';
      this.renderer.domElement.dataset.environmentSunDirection = 'fixed-sunward-east-to-west';
      this.renderer.domElement.dataset.environmentSunMode = solarSurge ? 'solar-surge' : 'hard-sun';
      this.renderer.domElement.dataset.environmentSunPatches = `sun:${this.solarYardSunPatches.length}+shade:${this.solarYardShadePatches.length}`;
      this.renderer.domElement.dataset.environmentShadowBudget = budget.shadows ? `key:${budget.shadowMapSize}` : 'key:off';
      this.renderer.domElement.dataset.environmentTone = `aces-${this.renderer.toneMappingExposure.toFixed(2)}+warm-sun+cool-shade`;
      this.renderer.domElement.dataset.readabilityLanguage = 'hard-sun-edge+cool-shade-mass+gold-reflectors+amber-hot-work+moving-gantry-cues';
    } else if (isRefinery) {
      const practicalCount = (firstPractical.visible ? 1 : 0) + (secondPractical.visible ? 1 : 0);
      this.renderer.domElement.dataset.environmentLighting = `refinery-key+rim+contact:player+enemy+practical:${practicalCount}+shadow:key`;
      this.renderer.domElement.dataset.environmentTone = `aces-${this.renderer.toneMappingExposure.toFixed(2)}`;
      this.renderer.domElement.dataset.bossEnvironmentFx = bossPhaseTwo ? 'phase2-practical-pulse' : 'phase-reactive-ready';
    } else if (isDamagedVessel) {
      const practicalCount = (firstPractical.visible ? 1 : 0) + (secondPractical.visible ? 1 : 0);
      this.renderer.domElement.dataset.environmentLighting = `damaged-vessel-emergency:breach+salvage+contact:player+enemy+practical:${practicalCount}+shadow:key`;
      this.renderer.domElement.dataset.environmentTone = `aces-${this.renderer.toneMappingExposure.toFixed(2)}`;
    }
  }

  private syncCamera(state: SimState, aspect: number) {
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

  }
}
