import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Ray } from '@babylonjs/core/Culling/ray';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Node } from '@babylonjs/core/node';
import { Scene } from '@babylonjs/core/scene';
import {
  disposeBabylonGraphicsAssetRuntime,
  getBabylonGraphicsAssetRuntime,
  type BabylonGraphicsAssetInstance,
} from './babylonGraphicsAssets';
import { BabylonCryoReservePresentation } from './babylonCryoReservePresentation';
import { BabylonDamagedVesselPresentation } from './babylonDamagedVesselPresentation';
import { BabylonIceMinePresentation } from './babylonIceMinePresentation';
import { BabylonK91CapstonePresentation } from './babylonK91CapstonePresentation';
import { BabylonOrphelineCapstonePresentation } from './babylonOrphelineCapstonePresentation';
import { BabylonHecateCapstonePresentation } from './babylonHecateCapstonePresentation';
import { BabylonJovianHarvesterPresentation } from './babylonJovianHarvesterPresentation';
import { BabylonLatticeAnnexPresentation } from './babylonLatticeAnnexPresentation';
import { BabylonMomentumExchangePresentation } from './babylonMomentumExchangePresentation';
import { BabylonParallaxArrayPresentation } from './babylonParallaxArrayPresentation';
import { BabylonPerseidCapstonePresentation } from './babylonPerseidCapstonePresentation';
import { BabylonOrbitalStationPresentation } from './babylonOrbitalStationPresentation';
import { BabylonRefineryLighting } from './babylonRefineryLighting';
import { BabylonRefineryPostProcessing } from './babylonRefineryPostProcessing';
import { BabylonSpinHabitatPresentation } from './babylonSpinHabitatPresentation';
import { BabylonSolarYardPresentation } from './babylonSolarYardPresentation';
import type {
  BabylonGraphicsBackendId,
  CombatGraphicsBackend,
  CombatGraphicsPerformanceStats,
  CombatGraphicsPointerDirection,
  CombatGraphicsPointerProjectionArgs,
  CombatGraphicsRenderArgs,
} from './combatGraphicsBackend';
import { weaponVariantPresentation, weaponVariantThermalCue } from './classArsenal';
import {
  ENEMY_ASSET_FAMILIES,
  OPERATOR_ASSET_FAMILY,
  OPERATOR_CLASS_ASSET_FAMILIES,
  REFINERY_ASSET_FAMILIES,
  WEAPON_ASSET_FAMILIES,
} from './graphicsAssetManifest';
import { selectGraphicsAssetSpec, type GraphicsAssetSpec } from './graphicsAssets';
import { resolveEnemyBossAnimation, type EnemyBossAnimationSignals } from './enemyBossAnimation';
import { resolvePlayerHandlingAnimation } from './playerHandlingAnimation';
import { resolveEnemyDamageAnimation, resolvePlayerSkillAnimation, type EnemyDamageAnimationSignals } from './skillDamageAnimation';
import { BabylonAbilityVfx } from './babylonAbilityVfx';
import { BabylonEnemyTelegraphs } from './babylonEnemyTelegraphs';
import { BabylonEnemyLifecycleVisuals } from './babylonEnemyLifecycleVisuals';
import { BabylonProtocolStatusVisuals } from './babylonProtocolStatusVisuals';
import { BabylonRefineryWorldPresentation } from './babylonWorldPresentation';
import { BabylonWeaponVfx } from './babylonWeaponVfx';
import { AdaptiveRenderBudget, type RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, weaponHandlingProfiles, type CombatObject, type Enemy, type SimState, type WeaponId } from './sim';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;
const CAMERA_FOV_DEGREES = 42;
const CAMERA_FOV_RADIANS = CAMERA_FOV_DEGREES * Math.PI / 180;
const REFINERY_ENVIRONMENT_KIT = 'floor,floor-grate,bulkhead,processor,pipe-rack,wall-panel,cable-tray,service-conduit,gantry,crate,terminal';
const BABYLON_WEAPON_IDS: readonly WeaponId[] = ['carbine', 'breacher', 'rail'];
type BabylonEnemyRole = Exclude<Enemy['role'], 'boss'>;
const BABYLON_ENEMY_ROLES: readonly BabylonEnemyRole[] = ['assault', 'suppressor', 'technician', 'elite'];
const weaponColors: Record<WeaponId, number> = {
  carbine: 0xd9f3c6,
  breacher: 0xffddb3,
  rail: 0xb9e8ff,
};
const factionColors = {
  meridian: 0x7fa697,
  heliostat: 0xe0a45c,
  longarc: 0x79a8bf,
} as const;
const enemyRoleColors: Record<BabylonEnemyRole, number> = {
  assault: 0xb35a4b,
  suppressor: 0xb67850,
  technician: 0x7d6daf,
  elite: 0xc34f6e,
};

type RefineryFamilyKey = keyof typeof REFINERY_ASSET_FAMILIES;

type RefineryPlacement = {
  x: number;
  z: number;
  rotationY?: number;
  scale?: number;
};

type RefineryPlacementGroups = Record<RefineryFamilyKey, RefineryPlacement[]>;

type BabylonRigRest = {
  position: Vector3;
  rotation: Vector3;
};

type BabylonOperatorRig = {
  hip: TransformNode;
  torso: TransformNode;
  helmet: TransformNode;
  leftArm: TransformNode;
  rightArm: TransformNode;
  leftLeg: TransformNode;
  rightLeg: TransformNode;
  backpack: TransformNode;
  weaponSocket: TransformNode;
  rest: Map<TransformNode, BabylonRigRest>;
};

type BabylonWeaponVisual = {
  instance: BabylonGraphicsAssetInstance;
  assetId: string;
  mount: TransformNode;
  muzzleSocket: TransformNode;
};

type BabylonEnemyVariantSilhouette = 'standard' | 'mobile' | 'braced' | 'technical' | 'drone';

type BabylonEnemyVisual = {
  root: TransformNode;
  fallbackRoot: TransformNode;
  body: Mesh;
  head: Mesh;
  weapon: Mesh;
  variantCue: Mesh;
  shellMaterial: StandardMaterial;
  headMaterial: StandardMaterial;
  accentMaterial: StandardMaterial;
  role: BabylonEnemyRole;
  variant: Enemy['variant'];
  assetInstance: BabylonGraphicsAssetInstance | null;
  assetMount: TransformNode | null;
  assetId: string | null;
  assetSignature: string;
  rig: BabylonOperatorRig | null;
  loadGeneration: number;
  loadState: 'fallback' | 'loading' | 'authored';
  lastDurability: number;
  lastArmor: number;
  impactUntil: number;
  armorBreakUntil: number;
  lastTelegraph: number;
  attackEventAt: number;
  lastActive: boolean;
  activationEventAt: number;
  lastDead: boolean;
  deathEventAt: number;
  baseBodyY: number;
  baseHeadY: number;
};

function enemyVariantSilhouette(variant: Enemy['variant']): BabylonEnemyVariantSilhouette {
  if (variant === 'standard') return 'standard';
  if (/Drone$/.test(variant)) return 'drone';
  if (/Skirmisher|Thief|Broker/.test(variant)) return 'mobile';
  if (/Tech|Engineer|Rigger|Operator|Specialist|Orchestrator|Custodian|Adjudicator|Director/.test(variant)) return 'technical';
  return 'braced';
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function instanceNodes(instance: BabylonGraphicsAssetInstance) {
  const nodes: Node[] = [];
  for (const root of instance.rootNodes) {
    nodes.push(root, ...root.getDescendants(false));
  }
  return nodes;
}

function findInstanceTransform(instance: BabylonGraphicsAssetInstance, sourceName: string) {
  const node = instanceNodes(instance).find(candidate =>
    candidate.name === sourceName || candidate.name.endsWith(`:${sourceName}`));
  return node instanceof TransformNode ? node : null;
}

function prepareRigNode(node: TransformNode): BabylonRigRest {
  if (node.rotationQuaternion) {
    node.rotation.copyFrom(node.rotationQuaternion.toEulerAngles());
    node.rotationQuaternion = null;
  }
  return {
    position: node.position.clone(),
    rotation: node.rotation.clone(),
  };
}

function panelObject(object: CombatObject) {
  return object.kind === 'doorControl'
    || object.kind === 'gravityControl'
    || object.kind === 'sealControl'
    || object.kind === 'powerControl'
    || object.kind === 'salvageNode';
}

function refineryPlacements(state: SimState, worldW: number, worldH: number): RefineryPlacementGroups {
  const width = scaled(worldW);
  const height = scaled(worldH);
  const cx = width / 2;
  const floor: RefineryPlacement[] = [];
  for (const fx of [0.18, 0.34, 0.50, 0.66, 0.82]) {
    for (const fz of [0.20, 0.40, 0.60, 0.80]) {
      floor.push({ x: width * fx, z: height * fz, scale: 1.35 });
    }
  }

  return {
    floor,
    floorGrate: [
      [0.34, 0.40, 0], [0.66, 0.40, Math.PI / 2],
      [0.34, 0.60, Math.PI / 2], [0.66, 0.60, 0],
      [0.18, 0.40, Math.PI / 2], [0.82, 0.40, 0],
      [0.18, 0.60, 0], [0.82, 0.60, Math.PI / 2],
    ].map(([x, z, rotationY]) => ({ x: width * x, z: height * z, rotationY, scale: 0.92 })),
    bulkhead: [
      { x: width * 0.14, z: height * 0.24 },
      { x: width * 0.14, z: height * 0.50 },
      { x: width * 0.14, z: height * 0.76 },
      { x: width * 0.86, z: height * 0.24, rotationY: Math.PI },
      { x: width * 0.86, z: height * 0.50, rotationY: Math.PI },
      { x: width * 0.86, z: height * 0.76, rotationY: Math.PI },
    ],
    processor: [
      { x: width * 0.29, z: height * 0.67, rotationY: 0.14, scale: 0.96 },
      { x: cx, z: height * 0.26, rotationY: 0, scale: 1.05 },
      { x: width * 0.71, z: height * 0.67, rotationY: Math.PI - 0.14, scale: 0.96 },
    ],
    pipeRack: [
      { x: width * 0.26, z: height * 0.14 },
      { x: width * 0.50, z: height * 0.14 },
      { x: width * 0.74, z: height * 0.14 },
      { x: width * 0.50, z: height * 0.86, rotationY: Math.PI },
    ],
    wallPanel: [
      { x: width * 0.115, z: height * 0.30 },
      { x: width * 0.115, z: height * 0.50 },
      { x: width * 0.115, z: height * 0.70 },
      { x: width * 0.885, z: height * 0.30, rotationY: Math.PI },
      { x: width * 0.885, z: height * 0.50, rotationY: Math.PI },
      { x: width * 0.885, z: height * 0.70, rotationY: Math.PI },
    ],
    cableTray: [
      { x: width * 0.095, z: height * 0.20 },
      { x: width * 0.095, z: height * 0.50 },
      { x: width * 0.095, z: height * 0.80 },
      { x: width * 0.905, z: height * 0.20, rotationY: Math.PI },
      { x: width * 0.905, z: height * 0.50, rotationY: Math.PI },
      { x: width * 0.905, z: height * 0.80, rotationY: Math.PI },
    ],
    serviceConduit: [
      { x: width * 0.08, z: height * 0.24, rotationY: Math.PI / 2, scale: 0.92 },
      { x: width * 0.08, z: height * 0.50, rotationY: Math.PI / 2, scale: 0.92 },
      { x: width * 0.08, z: height * 0.76, rotationY: Math.PI / 2, scale: 0.92 },
      { x: width * 0.92, z: height * 0.24, rotationY: -Math.PI / 2, scale: 0.92 },
      { x: width * 0.92, z: height * 0.50, rotationY: -Math.PI / 2, scale: 0.92 },
      { x: width * 0.92, z: height * 0.76, rotationY: -Math.PI / 2, scale: 0.92 },
    ],
    gantry: [
      { x: cx, z: height * 0.09, scale: 0.96 },
    ],
    crate: [
      [0.22, 0.31, 0.1], [0.22, 0.69, -0.2], [0.38, 0.82, 0.12], [0.62, 0.20, -0.12],
      [0.78, 0.69, 0.2], [0.79, 0.34, -0.16], [0.18, 0.52, 0.08], [0.82, 0.48, -0.08],
    ].map(([x, z, rotationY]) => ({ x: width * x, z: height * z, rotationY })),
    terminal: state.objects
      .filter(object => object.active && panelObject(object))
      .slice(0, 10)
      .map(object => ({
        x: scaled(object.x + object.w / 2),
        z: scaled(object.y + object.h / 2),
        rotationY: Math.PI / 4,
        scale: 0.9,
      })),
  };
}

export class BabylonCombatRenderer implements CombatGraphicsBackend {
  readonly id = 'babylon' as const;
  readonly loadedId = 'babylon' as const;

  private readonly engine: AbstractEngine;
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderCanvas: HTMLCanvasElement;
  private readonly coarse: boolean;
  private readonly identity = Matrix.Identity();
  private readonly cameraTarget = new Vector3();
  private readonly playerRoot: TransformNode;
  private readonly weaponPivot: TransformNode;
  private readonly operatorAccent: Mesh;
  private readonly weaponAccent: Mesh;
  private readonly operatorAccentMaterial: StandardMaterial;
  private readonly weaponAccentMaterial: StandardMaterial;
  private readonly authoredWeapons = new Map<WeaponId, BabylonWeaponVisual>();
  private operatorAssetInstance: BabylonGraphicsAssetInstance | null = null;
  private operatorMountRoot: TransformNode | null = null;
  private authoredOperatorRig: BabylonOperatorRig | null = null;
  private playerPresentationSignature = '';
  private playerLoadGeneration = 0;
  private operatorHitUntil = -1;
  private lastPlayerDurability = Number.NaN;
  private readonly enemyVisuals = new Map<number, BabylonEnemyVisual>();
  private enemyCatalogSignature = '';
  private enemyCatalogGeneration = 0;
  private enemyCatalogReady = false;
  private enemyReleaseCount = 0;
  private readonly worldPresentation: BabylonRefineryWorldPresentation;
  private readonly weaponVfx: BabylonWeaponVfx;
  private readonly abilityVfx: BabylonAbilityVfx;
  private readonly enemyTelegraphs: BabylonEnemyTelegraphs;
  private readonly enemyLifecycleVisuals: BabylonEnemyLifecycleVisuals;
  private readonly protocolStatusVisuals: BabylonProtocolStatusVisuals;
  private readonly orbitalStationPresentation: BabylonOrbitalStationPresentation;
  private readonly damagedVesselPresentation: BabylonDamagedVesselPresentation;
  private readonly spinHabitatPresentation: BabylonSpinHabitatPresentation;
  private readonly jovianHarvesterPresentation: BabylonJovianHarvesterPresentation;
  private readonly iceMinePresentation: BabylonIceMinePresentation;
  private readonly k91CapstonePresentation: BabylonK91CapstonePresentation;
  private readonly orphelineCapstonePresentation: BabylonOrphelineCapstonePresentation;
  private readonly hecateCapstonePresentation: BabylonHecateCapstonePresentation;
  private readonly solarYardPresentation: BabylonSolarYardPresentation;
  private readonly latticeAnnexPresentation: BabylonLatticeAnnexPresentation;
  private readonly momentumExchangePresentation: BabylonMomentumExchangePresentation;
  private readonly cryoReservePresentation: BabylonCryoReservePresentation;
  private readonly parallaxArrayPresentation: BabylonParallaxArrayPresentation;
  private readonly perseidCapstonePresentation: BabylonPerseidCapstonePresentation;
  private readonly refineryLighting: BabylonRefineryLighting;
  private readonly refineryPostProcessing: BabylonRefineryPostProcessing;
  private readonly renderBudget: AdaptiveRenderBudget;
  private readonly refineryAssetInstances: BabylonGraphicsAssetInstance[] = [];
  private refineryMountRoot: TransformNode | null = null;
  private refineryEnvironmentSignature = '';
  private refineryLoadGeneration = 0;
  private disposed = false;
  private frames = 0;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private lastFrameAt = 0;
  private graphicsBudgetSignature = '';

  private constructor(
    canvas: HTMLCanvasElement,
    renderCanvas: HTMLCanvasElement,
    coarse: boolean,
    engine: AbstractEngine,
    scene: Scene,
    camera: FreeCamera,
  ) {
    this.canvas = canvas;
    this.renderCanvas = renderCanvas;
    this.coarse = coarse;
    this.engine = engine;
    this.scene = scene;
    this.camera = camera;
    this.worldPresentation = new BabylonRefineryWorldPresentation(scene, canvas, coarse);
    this.weaponVfx = new BabylonWeaponVfx(scene, canvas, coarse);
    this.abilityVfx = new BabylonAbilityVfx(scene, canvas, coarse);
    this.enemyTelegraphs = new BabylonEnemyTelegraphs(scene, canvas, coarse);
    this.enemyLifecycleVisuals = new BabylonEnemyLifecycleVisuals(scene, canvas, coarse);
    this.protocolStatusVisuals = new BabylonProtocolStatusVisuals(scene, canvas, coarse);
    this.orbitalStationPresentation = new BabylonOrbitalStationPresentation(scene, canvas, coarse);
    this.damagedVesselPresentation = new BabylonDamagedVesselPresentation(scene, canvas, coarse);
    this.spinHabitatPresentation = new BabylonSpinHabitatPresentation(scene, canvas, coarse);
    this.jovianHarvesterPresentation = new BabylonJovianHarvesterPresentation(scene, canvas, coarse);
    this.iceMinePresentation = new BabylonIceMinePresentation(scene, canvas, coarse);
    this.k91CapstonePresentation = new BabylonK91CapstonePresentation(scene, canvas, coarse);
    this.orphelineCapstonePresentation = new BabylonOrphelineCapstonePresentation(scene, canvas, coarse);
    this.hecateCapstonePresentation = new BabylonHecateCapstonePresentation(scene, canvas, coarse);
    this.solarYardPresentation = new BabylonSolarYardPresentation(scene, canvas, coarse);
    this.latticeAnnexPresentation = new BabylonLatticeAnnexPresentation(scene, canvas, coarse);
    this.momentumExchangePresentation = new BabylonMomentumExchangePresentation(scene, canvas, coarse);
    this.cryoReservePresentation = new BabylonCryoReservePresentation(scene, canvas, coarse);
    this.parallaxArrayPresentation = new BabylonParallaxArrayPresentation(scene, canvas, coarse);
    this.perseidCapstonePresentation = new BabylonPerseidCapstonePresentation(scene, canvas, coarse);
    this.refineryLighting = new BabylonRefineryLighting(scene, canvas);
    this.refineryPostProcessing = new BabylonRefineryPostProcessing(scene, canvas);
    this.renderBudget = new AdaptiveRenderBudget(coarse);

    this.playerRoot = new TransformNode('p27-b3-player-root', scene);
    this.weaponPivot = new TransformNode('p27-b3-weapon-pivot', scene);
    this.weaponPivot.parent = this.playerRoot;

    this.operatorAccentMaterial = new StandardMaterial('p27-b3-operator-accent-material', scene);
    this.operatorAccentMaterial.diffuseColor = colorFromHex(weaponColors.carbine).scale(0.45);
    this.operatorAccentMaterial.emissiveColor = colorFromHex(weaponColors.carbine).scale(0.22);
    this.operatorAccentMaterial.specularColor = Color3.Black();
    this.operatorAccent = MeshBuilder.CreateBox('p27-b3-operator-accent', {
      width: 0.04,
      height: 0.13,
      depth: 0.32,
    }, scene);
    this.operatorAccent.parent = this.playerRoot;
    this.operatorAccent.position.set(0.27, 1.22, 0);
    this.operatorAccent.material = this.operatorAccentMaterial;
    this.operatorAccent.isPickable = false;
    this.operatorAccent.setEnabled(false);

    this.weaponAccentMaterial = new StandardMaterial('p27-b3-weapon-accent-material', scene);
    this.weaponAccentMaterial.diffuseColor = colorFromHex(weaponColors.carbine).scale(0.45);
    this.weaponAccentMaterial.emissiveColor = colorFromHex(weaponColors.carbine).scale(0.28);
    this.weaponAccentMaterial.specularColor = Color3.Black();
    this.weaponAccent = MeshBuilder.CreateBox('p27-b3-weapon-accent', {
      width: 0.46,
      height: 0.035,
      depth: 0.055,
    }, scene);
    this.weaponAccent.parent = this.weaponPivot;
    this.weaponAccent.position.set(0.45, 0.08, 0);
    this.weaponAccent.material = this.weaponAccentMaterial;
    this.weaponAccent.isPickable = false;
    this.weaponAccent.setEnabled(false);
  }

  static async create(
    renderCanvas: HTMLCanvasElement,
    coarse: boolean,
    backend: BabylonGraphicsBackendId = 'webgl2',
    telemetryCanvas: HTMLCanvasElement = renderCanvas,
  ) {
    let engine: AbstractEngine | null = null;
    telemetryCanvas.dataset.babylonBackendRequested ||= backend;
    telemetryCanvas.dataset.babylonBackendLoaded = 'initializing';

    try {
      if (backend === 'webgpu') {
        telemetryCanvas.dataset.babylonBackendInitStage = 'webgpu-support';
        const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine');
        if (!(await WebGPUEngine.IsSupportedAsync)) {
          throw new Error('Babylon WebGPU is not supported by this browser/runtime.');
        }
        telemetryCanvas.dataset.babylonBackendInitStage = 'webgpu-init';
        const webGpuEngine = new WebGPUEngine(renderCanvas, {
          powerPreference: 'high-performance',
        });
        engine = webGpuEngine;
        await webGpuEngine.initAsync();
      } else {
        telemetryCanvas.dataset.babylonBackendInitStage = 'webgl2-init';
        const webGlEngine = new Engine(renderCanvas, !coarse, {
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
          stencil: true,
        }, false);
        engine = webGlEngine;
        if (webGlEngine.webGLVersion !== 2) {
          const version = webGlEngine.webGLVersion;
          webGlEngine.dispose();
          engine = null;
          throw new Error(`Babylon QA backend requires WebGL2; initialized WebGL${version}.`);
        }
      }

      telemetryCanvas.dataset.babylonBackendInitStage = 'scene-create';
      const scene = new Scene(engine);
      scene.useRightHandedSystem = true;
      scene.clearColor = new Color4(0.035, 0.055, 0.065, 1);
      const camera = new FreeCamera('p27-b1-babylon-camera', new Vector3(9.8, 12.8, 9.8), scene);
      camera.fov = CAMERA_FOV_RADIANS;
      camera.minZ = 0.1;
      camera.maxZ = 180;
      camera.setTarget(new Vector3(0, 0.62, 0));
      scene.activeCamera = camera;

      telemetryCanvas.dataset.babylonBackend = backend;
      telemetryCanvas.dataset.babylonBackendLoaded = backend;
      telemetryCanvas.dataset.babylonBackendInitStage = 'ready';
      telemetryCanvas.dataset.babylonInit = 'ready';
      telemetryCanvas.dataset.babylonScene = 'active';
      telemetryCanvas.dataset.babylonDisposed = 'false';
      telemetryCanvas.dataset.babylonFrames = '0';
      telemetryCanvas.dataset.babylonCameraParity = 'three-combat-v1';
      telemetryCanvas.dataset.babylonInputParity = 'ground-plane-raycast-v1';
      telemetryCanvas.dataset.babylonEnvironmentState = 'idle';
      telemetryCanvas.dataset.babylonPlayerState = 'idle';
      telemetryCanvas.dataset.babylonEnemyCatalogState = 'idle';
      telemetryCanvas.dataset.babylonEnemyState = 'idle';

      return new BabylonCombatRenderer(telemetryCanvas, renderCanvas, coarse, engine, scene, camera);
    } catch (error) {
      engine?.dispose();
      telemetryCanvas.dataset.babylonBackendLoaded = 'failed';
      throw error;
    }
  }

  render(...args: CombatGraphicsRenderArgs): void {
    if (this.disposed) return;
    const [state, width, height, quality, qualityMode, mission, mobileTargetId, operatorFaction, reducedTargetMotion = false, firingIntent = false, cameraFeedback] = args;
    const now = performance.now();
    const frameMs = this.lastFrameAt > 0 ? now - this.lastFrameAt : 1000 / 60;
    this.lastFrameAt = now;
    const budget = this.renderBudget.sample(frameMs, quality, qualityMode);
    const refineryScenario = mission.location === 'asteroid-refinery';
    const orbitalStationScenario = mission.location === 'orbital-station';
    const damagedVesselScenario = mission.location === 'damaged-vessel';
    const spinHabitatScenario = mission.location === 'spin-habitat';
    const jovianHarvesterScenario = mission.location === 'jovian-harvester';
    const iceMineScenario = mission.location === 'ice-mine';
    const solarYardScenario = mission.location === 'solar-yard';
    const latticeAnnexScenario = mission.location === 'lattice-annex';
    const momentumExchangeScenario = mission.location === 'momentum-exchange';
    const cryoReserveScenario = mission.location === 'cryo-reserve';
    const parallaxArrayScenario = mission.location === 'parallax-array';
    if (!refineryScenario && !orbitalStationScenario && !damagedVesselScenario && !spinHabitatScenario && !jovianHarvesterScenario && !iceMineScenario && !solarYardScenario && !latticeAnnexScenario && !momentumExchangeScenario && !cryoReserveScenario && !parallaxArrayScenario) {
      this.canvas.dataset.babylonScenario = 'ported:asteroid-refinery,orbital-station,damaged-vessel,spin-habitat,jovian-harvester,ice-mine,solar-yard,lattice-annex,momentum-exchange,cryo-reserve,parallax-array';
      this.releasePlayerPresentation('scenario-exit');
      this.releaseEnemyPresentation('scenario-exit');
      this.worldPresentation.release('scenario-exit');
      this.weaponVfx.release('scenario-exit');
      this.abilityVfx.release('scenario-exit');
      this.enemyTelegraphs.release('scenario-exit');
      this.enemyLifecycleVisuals.release('scenario-exit');
      this.protocolStatusVisuals.release('scenario-exit');
      this.orbitalStationPresentation.release('scenario-exit');
      this.damagedVesselPresentation.release('scenario-exit');
      this.spinHabitatPresentation.release('scenario-exit');
      this.jovianHarvesterPresentation.release('scenario-exit');
      this.iceMinePresentation.release('scenario-exit');
      this.solarYardPresentation.release('scenario-exit');
      this.latticeAnnexPresentation.release('scenario-exit');
      this.momentumExchangePresentation.release('scenario-exit');
      this.cryoReservePresentation.release('scenario-exit');
      this.parallaxArrayPresentation.release('scenario-exit');
      this.perseidCapstonePresentation.release('scenario-exit');
      this.k91CapstonePresentation.release('scenario-exit');
      this.orphelineCapstonePresentation.release('scenario-exit');
      this.hecateCapstonePresentation.release('scenario-exit');
      this.refineryLighting.setEnabled(false);
      this.refineryPostProcessing.release('scenario-exit');
      this.releaseRefineryEnvironment('scenario-exit');
      return;
    }

    this.canvas.dataset.babylonScenario = mission.location;
    this.resize(width, height, quality, budget);
    this.syncGraphicsRuntimeBudget(budget);
    if (refineryScenario) {
      this.orbitalStationPresentation.release('scenario-switch');
      this.damagedVesselPresentation.release('scenario-switch');
      this.spinHabitatPresentation.release('scenario-switch');
      this.jovianHarvesterPresentation.release('scenario-switch');
      this.iceMinePresentation.release('scenario-switch');
      this.solarYardPresentation.release('scenario-switch');
      this.latticeAnnexPresentation.release('scenario-switch');
      this.momentumExchangePresentation.release('scenario-switch');
      this.cryoReservePresentation.release('scenario-switch');
      this.parallaxArrayPresentation.release('scenario-switch');
      this.ensureRefineryEnvironment(state, quality);
    } else {
      this.refineryLighting.setEnabled(false);
      this.refineryPostProcessing.release('scenario-switch');
      this.releaseRefineryEnvironment('scenario-switch');
      if (!cryoReserveScenario) this.cryoReservePresentation.release('scenario-switch');
      if (!parallaxArrayScenario) this.parallaxArrayPresentation.release('scenario-switch');
      if (orbitalStationScenario) {
        this.damagedVesselPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      } else if (damagedVesselScenario) {
        this.orbitalStationPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      } else if (spinHabitatScenario) {
        this.orbitalStationPresentation.release('scenario-switch');
        this.damagedVesselPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      } else if (jovianHarvesterScenario) {
        this.orbitalStationPresentation.release('scenario-switch');
        this.damagedVesselPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      } else if (iceMineScenario) {
        this.orbitalStationPresentation.release('scenario-switch');
        this.damagedVesselPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      } else if (solarYardScenario) {
        this.orbitalStationPresentation.release('scenario-switch');
        this.damagedVesselPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      } else if (latticeAnnexScenario) {
        this.orbitalStationPresentation.release('scenario-switch');
        this.damagedVesselPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      } else if (momentumExchangeScenario) {
        this.orbitalStationPresentation.release('scenario-switch');
        this.damagedVesselPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
      } else {
        this.orbitalStationPresentation.release('scenario-switch');
        this.damagedVesselPresentation.release('scenario-switch');
        this.spinHabitatPresentation.release('scenario-switch');
        this.jovianHarvesterPresentation.release('scenario-switch');
        this.iceMinePresentation.release('scenario-switch');
        this.solarYardPresentation.release('scenario-switch');
        this.latticeAnnexPresentation.release('scenario-switch');
        this.momentumExchangePresentation.release('scenario-switch');
      }
    }
    this.ensurePlayerPresentation(state, quality);
    this.syncPlayerPresentation(state, operatorFaction, firingIntent);
    this.abilityVfx.sync(state, quality);
    let muzzlePosition: Vector3 | null = null;
    const activeWeapon = this.authoredWeapons.get(state.player.currentWeapon) ?? null;
    if (activeWeapon && this.canvas.dataset.babylonPlayerState === 'ready') {
      activeWeapon.muzzleSocket.computeWorldMatrix(true);
      muzzlePosition = activeWeapon.muzzleSocket.getAbsolutePosition();
    }
    this.weaponVfx.sync(state, muzzlePosition, quality);
    this.ensureEnemyCatalog(quality);
    this.syncEnemyPresentation(state, quality);
    this.enemyLifecycleVisuals.sync(state, mobileTargetId, quality, reducedTargetMotion);
    this.protocolStatusVisuals.sync(state, quality);
    this.enemyTelegraphs.sync(state, quality);
    this.worldPresentation.sync(state, mission, quality);
    if (refineryScenario) {
      this.refineryLighting.sync(state, budget);
      this.refineryPostProcessing.sync(mission.conditions.includes('low-visibility'), budget);
    } else if (orbitalStationScenario) {
      this.orbitalStationPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else if (damagedVesselScenario) {
      this.damagedVesselPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else if (spinHabitatScenario) {
      this.spinHabitatPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else if (jovianHarvesterScenario) {
      this.jovianHarvesterPresentation.sync(
        state,
        budget,
        mission.conditions.includes('low-visibility'),
        mission.conditions.includes('unstable-pressure'),
        mission.conditions.includes('damaged-grid'),
      );
    } else if (iceMineScenario) {
      this.iceMinePresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else if (solarYardScenario) {
      this.solarYardPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else if (latticeAnnexScenario) {
      this.latticeAnnexPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else if (momentumExchangeScenario) {
      this.momentumExchangePresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else if (cryoReserveScenario) {
      this.cryoReservePresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    } else {
      this.parallaxArrayPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));
    }
    if (mission.megastructure === 'generation-ship') {
      this.k91CapstonePresentation.release('scenario-switch');
      this.orphelineCapstonePresentation.release('scenario-switch');
      this.hecateCapstonePresentation.release('scenario-switch');
      this.perseidCapstonePresentation.sync(state, budget, mission);
    } else if (mission.megastructure === 'counterweight') {
      this.perseidCapstonePresentation.release('scenario-switch');
      this.orphelineCapstonePresentation.release('scenario-switch');
      this.hecateCapstonePresentation.release('scenario-switch');
      this.k91CapstonePresentation.sync(state, budget, mission);
    } else if (mission.megastructure === 'hidden-habitat') {
      this.perseidCapstonePresentation.release('scenario-switch');
      this.k91CapstonePresentation.release('scenario-switch');
      this.hecateCapstonePresentation.release('scenario-switch');
      this.orphelineCapstonePresentation.sync(state, budget, mission);
    } else if (mission.megastructure === 'shipbreaking-yard') {
      this.perseidCapstonePresentation.release('scenario-switch');
      this.k91CapstonePresentation.release('scenario-switch');
      this.orphelineCapstonePresentation.release('scenario-switch');
      this.hecateCapstonePresentation.sync(state, budget, mission);
    } else {
      this.perseidCapstonePresentation.release('scenario-switch');
      this.k91CapstonePresentation.release('scenario-switch');
      this.orphelineCapstonePresentation.release('scenario-switch');
      this.hecateCapstonePresentation.release('scenario-switch');
    }
    this.syncCamera(state, width / Math.max(1, height), cameraFeedback);
    this.scene.render();
    this.frames += 1;
    this.canvas.dataset.babylonFrames = String(this.frames);
    this.updateSceneTelemetry();
  }

  performanceStats(): CombatGraphicsPerformanceStats {
    return { drawCalls: 0, triangles: 0 };
  }

  screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection {
    const [clientX, clientY, rect, player] = args;
    if (rect.width <= 0 || rect.height <= 0) return null;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const ray = Ray.CreateNew(
      localX,
      localY,
      rect.width,
      rect.height,
      this.identity,
      this.camera.getViewMatrix(),
      this.camera.getProjectionMatrix(),
    );
    const denominator = ray.direction.y;
    if (Math.abs(denominator) <= 1e-6) return null;
    const distance = (FLOOR_Y - ray.origin.y) / denominator;
    if (!Number.isFinite(distance) || distance < 0) return null;

    const hitX = ray.origin.x + ray.direction.x * distance;
    const hitZ = ray.origin.z + ray.direction.z * distance;
    const dx = hitX / WORLD_SCALE - player.x;
    const dy = hitZ / WORLD_SCALE - player.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.01) return null;

    const direction = { x: dx / length, y: dy / length };
    this.canvas.dataset.babylonPointerDirection = `${direction.x.toFixed(3)},${direction.y.toFixed(3)}`;
    return direction;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.releasePlayerPresentation('renderer-dispose');
    this.releaseEnemyPresentation('renderer-dispose');
    this.worldPresentation.dispose();
    this.weaponVfx.dispose();
    this.abilityVfx.dispose();
    this.enemyTelegraphs.dispose();
    this.enemyLifecycleVisuals.dispose();
    this.protocolStatusVisuals.dispose();
    this.orbitalStationPresentation.dispose();
    this.damagedVesselPresentation.dispose();
    this.spinHabitatPresentation.dispose();
    this.jovianHarvesterPresentation.dispose();
    this.iceMinePresentation.dispose();
    this.solarYardPresentation.dispose();
    this.latticeAnnexPresentation.dispose();
    this.momentumExchangePresentation.dispose();
    this.cryoReservePresentation.dispose();
    this.parallaxArrayPresentation.dispose();
    this.perseidCapstonePresentation.dispose();
    this.k91CapstonePresentation.dispose();
    this.orphelineCapstonePresentation.dispose();
    this.hecateCapstonePresentation.dispose();
    this.refineryPostProcessing.dispose();
    this.refineryLighting.dispose();
    this.releaseRefineryEnvironment('renderer-dispose');
    void disposeBabylonGraphicsAssetRuntime(this.scene);
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.dataset.babylonScene = 'disposed';
    this.canvas.dataset.babylonDisposed = 'true';
  }


  private ensurePlayerPresentation(state: SimState, detailScale: number) {
    const assetDetailScale = this.coarse ? Math.min(detailScale, 0.55) : detailScale;
    const operatorFamily = state.build.operatorClass
      ? OPERATOR_CLASS_ASSET_FAMILIES[state.build.operatorClass]
      : OPERATOR_ASSET_FAMILY;
    const operatorSpec = selectGraphicsAssetSpec(operatorFamily, assetDetailScale);
    if (!operatorSpec) {
      this.canvas.dataset.babylonPlayerState = 'error';
      this.canvas.dataset.babylonPlayerError = 'operator-spec-unavailable';
      return;
    }

    const weaponSpecs = BABYLON_WEAPON_IDS.map(id => {
      const spec = selectGraphicsAssetSpec(WEAPON_ASSET_FAMILIES[id], assetDetailScale);
      if (!spec) throw new Error(`No authored Babylon weapon asset available for ${id}`);
      return { id, spec };
    });
    const signature = [
      state.build.operatorClass ?? 'generic',
      operatorSpec.id,
      ...weaponSpecs.map(item => item.spec.id),
    ].join(':');
    if (signature === this.playerPresentationSignature) return;

    this.playerPresentationSignature = signature;
    const generation = ++this.playerLoadGeneration;
    this.releaseMountedPlayerAssets();
    this.canvas.dataset.babylonPlayerState = 'loading';
    this.canvas.dataset.operatorVisual = 'authored-loading-babylon';
    this.canvas.dataset.weaponVisual = 'authored-loading-babylon';
    delete this.canvas.dataset.babylonPlayerError;
    void this.loadPlayerPresentation(state.build.operatorClass, operatorSpec, weaponSpecs, generation);
  }

  private async loadPlayerPresentation(
    operatorClass: SimState['build']['operatorClass'],
    operatorSpec: GraphicsAssetSpec,
    weaponSpecs: Array<{ id: WeaponId; spec: GraphicsAssetSpec }>,
    generation: number,
  ) {
    const runtime = getBabylonGraphicsAssetRuntime(this.scene);
    const preload = await runtime.preload([operatorSpec, ...weaponSpecs.map(item => item.spec)], 2);
    if (this.disposed || generation !== this.playerLoadGeneration) return;
    if (preload.failed > 0) {
      this.canvas.dataset.babylonPlayerState = 'error';
      this.canvas.dataset.operatorVisual = 'authored-fallback-babylon';
      this.canvas.dataset.weaponVisual = 'authored-fallback-babylon';
      this.canvas.dataset.babylonPlayerError = `preload-failed:${preload.failed}`;
      return;
    }

    const localInstances: BabylonGraphicsAssetInstance[] = [];
    const localMounts: TransformNode[] = [];
    try {
      const operatorInstance = await runtime.instantiate(operatorSpec);
      localInstances.push(operatorInstance);
      if (this.disposed || generation !== this.playerLoadGeneration) {
        localInstances.forEach(instance => instance.release());
        return;
      }

      const operatorMount = new TransformNode(`p27-b3-operator-${generation}`, this.scene);
      localMounts.push(operatorMount);
      operatorMount.parent = this.playerRoot;
      operatorMount.setEnabled(false);
      operatorInstance.rootNodes.forEach(root => {
        root.parent = operatorMount;
      });

      const rigCandidates = {
        hip: findInstanceTransform(operatorInstance, 'hip'),
        torso: findInstanceTransform(operatorInstance, 'torso'),
        helmet: findInstanceTransform(operatorInstance, 'helmet'),
        leftArm: findInstanceTransform(operatorInstance, 'arm-left'),
        rightArm: findInstanceTransform(operatorInstance, 'arm-right'),
        leftLeg: findInstanceTransform(operatorInstance, 'leg-left'),
        rightLeg: findInstanceTransform(operatorInstance, 'leg-right'),
        backpack: findInstanceTransform(operatorInstance, 'backpack'),
        weaponSocket: findInstanceTransform(operatorInstance, 'weapon-socket'),
      };
      if (!Object.values(rigCandidates).every(Boolean)) {
        throw new Error('Authored Babylon operator is missing the articulated rig/socket contract');
      }

      const rigBase = rigCandidates as Omit<BabylonOperatorRig, 'rest'>;
      const rest = new Map<TransformNode, BabylonRigRest>();
      for (const node of Object.values(rigBase)) rest.set(node, prepareRigNode(node));
      const rig: BabylonOperatorRig = { ...rigBase, rest };

      const loadedWeapons = new Map<WeaponId, BabylonWeaponVisual>();
      for (const { id, spec } of weaponSpecs) {
        const instance = await runtime.instantiate(spec);
        localInstances.push(instance);
        if (this.disposed || generation !== this.playerLoadGeneration) {
          localInstances.forEach(item => item.release());
          localMounts.forEach(item => item.dispose());
          return;
        }

        const mount = new TransformNode(`p27-b3-weapon-${id}-${generation}`, this.scene);
        localMounts.push(mount);
        mount.parent = this.weaponPivot;
        mount.setEnabled(false);
        instance.rootNodes.forEach(root => {
          root.parent = mount;
        });
        const muzzleSocket = findInstanceTransform(instance, 'muzzle-socket');
        if (!muzzleSocket) throw new Error(`Authored Babylon ${id} weapon is missing muzzle-socket`);
        loadedWeapons.set(id, {
          instance,
          assetId: spec.id,
          mount,
          muzzleSocket,
        });
      }

      if (this.disposed || generation !== this.playerLoadGeneration) {
        localInstances.forEach(instance => instance.release());
        localMounts.forEach(mount => mount.dispose());
        return;
      }

      this.operatorAssetInstance = operatorInstance;
      this.operatorMountRoot = operatorMount;
      this.authoredOperatorRig = rig;
      for (const [id, visual] of loadedWeapons) this.authoredWeapons.set(id, visual);
      this.weaponPivot.parent = rig.weaponSocket;
      this.weaponPivot.position.set(0, 0, 0);
      this.weaponPivot.rotation.set(0, 0, 0);
      this.weaponPivot.scaling.set(1, 1, 1);
      operatorMount.setEnabled(true);
      this.operatorAccent.setEnabled(true);
      this.weaponAccent.setEnabled(true);

      const stats = runtime.stats();
      this.canvas.dataset.babylonPlayerState = 'ready';
      this.canvas.dataset.operatorVisual = `authored-${operatorSpec.lod}-babylon`;
      this.canvas.dataset.operatorAsset = operatorSpec.id;
      this.canvas.dataset.operatorClassAsset = operatorClass ?? 'generic';
      this.canvas.dataset.operatorRig = 'articulated';
      this.canvas.dataset.operatorSocket = 'weapon-socket';
      this.canvas.dataset.weaponVisual = 'authored-babylon';
      this.canvas.dataset.weaponRoles = [...loadedWeapons.keys()].sort().join(',');
      this.canvas.dataset.weaponFallback = '';
      this.canvas.dataset.babylonPlayerAssets = `operator:${operatorSpec.id}|weapons:${weaponSpecs.map(item => item.spec.id).join(',')}`;
      this.canvas.dataset.babylonPlayerRuntime = [
        `cached:${stats.cachedAssets}`,
        `active:${stats.activeInstances}`,
        `bytes:${stats.estimatedCachedCompressedBytes}`,
      ].join('|');
      this.canvas.dataset.babylonPlayerReuse = 'shared-runtime+authored-rig+authored-sockets+shared-presentation-signals';
      this.updateSceneTelemetry();
    } catch (error) {
      this.weaponPivot.parent = this.playerRoot;
      localInstances.forEach(instance => instance.release());
      localMounts.forEach(mount => mount.dispose());
      if (this.disposed || generation !== this.playerLoadGeneration) return;
      this.canvas.dataset.babylonPlayerState = 'error';
      this.canvas.dataset.operatorVisual = 'authored-fallback-babylon';
      this.canvas.dataset.weaponVisual = 'authored-fallback-babylon';
      this.canvas.dataset.babylonPlayerError = error instanceof Error ? error.message : String(error);
    }
  }

  private syncPlayerPresentation(
    state: SimState,
    operatorFaction: CombatGraphicsRenderArgs[7],
    firingIntent: boolean,
  ) {
    const rig = this.authoredOperatorRig;
    const player = state.player;
    const current = this.authoredWeapons.get(player.currentWeapon) ?? null;
    if (!rig || !current || this.canvas.dataset.babylonPlayerState !== 'ready') return;

    const durability = player.hp + player.armor;
    if (Number.isFinite(this.lastPlayerDurability) && durability < this.lastPlayerDurability - 0.5 && !player.dead) {
      this.operatorHitUntil = state.time + 0.18;
    }
    this.lastPlayerDurability = durability;

    this.playerRoot.position.set(scaled(player.x), 0, scaled(player.y));
    this.playerRoot.rotation.y = Math.atan2(-player.aim.y, player.aim.x);

    for (const [node, rest] of rig.rest) {
      node.position.copyFrom(rest.position);
      node.rotation.copyFrom(rest.rotation);
    }

    const handling = weaponHandlingProfiles[player.currentWeapon];
    const variantId = state.weapons[player.currentWeapon].variantId;
    const variantPresentation = weaponVariantPresentation(variantId);
    const reloadHandling = weaponHandlingProfiles[player.reloadWeapon];
    const reloadDuration = Math.max(0.01, state.weapons[player.reloadWeapon].reloadSeconds * reloadHandling.reloadDurationMul);
    const hit = state.time < this.operatorHitUntil
      ? Math.max(0, Math.min(1, (this.operatorHitUntil - state.time) / 0.18))
      : 0;
    const motion = resolvePlayerHandlingAnimation({
      operatorClass: state.build.operatorClass,
      weapon: player.currentWeapon,
      weaponVariantId: variantId,
      time: state.time,
      vx: player.vx,
      vy: player.vy,
      aimX: player.aim.x,
      aimY: player.aim.y,
      moveX: player.move.x,
      moveY: player.move.y,
      weaponFlash: state.weaponFlash,
      fireCooldown: player.fireCooldown,
      weaponRate: state.weapons[player.currentWeapon].rate,
      firingIntent,
      reloadT: player.reloadT,
      reloadDuration,
      ventT: player.ventT,
      ventDuration: Math.max(0.01, handling.ventSeconds),
      heat: player.weaponHeat[player.currentWeapon] ?? 0,
      dodgeTime: player.dodgeTime,
      hit,
    });
    const { profile, speed, gait, idleBreath, aimOffset, aimForward, recoil, reload, charge, vent, overheat, dodge } = motion;
    const skill = resolvePlayerSkillAnimation({
      operatorClass: state.build.operatorClass,
      abilityIndex: state.lastAbilityIndex,
      elapsed: state.time - state.lastAbilityAt,
      dodge: player.dodgeTime,
      reload: player.reloadT,
      vent: player.ventT,
      hit,
      dead: player.dead,
    });

    rig.torso.position.y += idleBreath * 0.012;
    rig.backpack.position.y += idleBreath * 0.008;
    rig.helmet.rotation.z += idleBreath * 0.012;
    rig.leftLeg.rotation.z += gait * 0.42;
    rig.rightLeg.rotation.z -= gait * 0.42;
    rig.leftArm.rotation.z += profile.leftArm - gait * 0.075;
    rig.rightArm.rotation.z += profile.rightArm + gait * 0.065;
    rig.torso.rotation.z += profile.torsoLean + aimOffset * profile.aimLean;
    rig.hip.position.x += profile.hipOffset - Math.max(0, -aimForward) * 0.012;
    rig.helmet.rotation.z += aimOffset * profile.aimLean * 0.48;
    rig.weaponSocket.rotation.z += aimOffset * profile.aimLean * 0.34;
    rig.weaponSocket.position.y += profile.aimLift * (0.45 + Math.max(0, aimForward) * 0.55) + (variantPresentation?.aimLift ?? 0);
    rig.leftArm.rotation.x -= 0.12;
    rig.rightArm.rotation.x += 0.12;

    if (recoil > 0) {
      const kick = handling.recoilVisual * (variantPresentation?.recoilVisualMul ?? 1) * profile.recoilScale * recoil;
      rig.weaponSocket.position.x -= 0.1 * kick;
      rig.torso.rotation.z -= 0.055 * kick;
      rig.rightArm.rotation.z += 0.1 * kick;
      if (state.build.operatorClass === 'vanguard') {
        rig.leftArm.rotation.z -= 0.045 * kick;
        rig.hip.position.x -= 0.04 * kick;
      } else if (state.build.operatorClass === 'vector') {
        rig.hip.position.x -= 0.025 * kick;
        rig.helmet.rotation.z += 0.02 * kick;
      } else if (state.build.operatorClass === 'systems') {
        rig.rightArm.rotation.z += 0.035 * kick;
      }
    }

    if (reload > 0) {
      const cycle = Math.sin((1 - reload) * Math.PI);
      if (handling.reloadStyle === 'mag-swap') {
        rig.weaponSocket.rotation.z += 0.38 * cycle;
        rig.weaponSocket.position.y -= 0.06 * cycle;
        rig.leftArm.rotation.z += 0.46 * cycle;
      } else if (handling.reloadStyle === 'chamber-feed') {
        rig.weaponSocket.rotation.z += 0.58 * cycle;
        rig.weaponSocket.position.x -= 0.07 * cycle;
        rig.weaponSocket.position.y -= 0.11 * cycle;
        rig.leftArm.rotation.z += 0.72 * cycle;
        rig.rightArm.rotation.z -= 0.26 * cycle;
        rig.hip.position.x -= 0.025 * cycle;
      } else {
        rig.weaponSocket.rotation.z += 0.76 * cycle;
        rig.weaponSocket.position.y -= 0.15 * cycle;
        rig.leftArm.rotation.z += 0.82 * cycle;
        rig.rightArm.rotation.z -= 0.16 * cycle;
        rig.torso.rotation.z += 0.08 * cycle;
        rig.helmet.rotation.z += 0.035 * cycle;
      }
    }

    if (charge > 0) {
      const settle = Math.sin(charge * Math.PI * 0.5);
      rig.weaponSocket.position.x -= 0.035 * settle;
      rig.weaponSocket.position.y += 0.045 * settle;
      rig.weaponSocket.rotation.z -= 0.1 * settle;
      rig.torso.rotation.z += profile.chargeLean * settle;
      rig.helmet.rotation.z -= profile.chargeLean * 0.34 * settle;
      rig.leftArm.rotation.z -= 0.08 * settle;
    }

    if (vent > 0) {
      const cycle = Math.sin((1 - vent) * Math.PI);
      rig.weaponSocket.position.y -= 0.05 * cycle;
      rig.weaponSocket.rotation.z -= (handling.ventStyle === 'coil-quench' ? 0.34 : handling.ventStyle === 'chamber-dump' ? 0.22 : 0.12) * cycle;
      rig.backpack.rotation.z += (handling.ventStyle === 'fan-purge' ? 0.08 : 0.14) * cycle;
      rig.torso.rotation.z += profile.ventLean * cycle;
      if (state.build.operatorClass === 'systems') rig.leftArm.rotation.z += 0.12 * cycle;
      if (state.build.operatorClass === 'vanguard') rig.hip.position.x -= 0.03 * cycle;
    }

    if (overheat > 0) {
      const strain = overheat * profile.overheatStrain;
      const tremor = Math.sin(state.time * 27 + (state.build.operatorClass === 'vector' ? 1.7 : state.build.operatorClass === 'systems' ? 3.1 : 0));
      rig.torso.rotation.x += strain * 0.42;
      rig.torso.position.y -= strain * 0.16;
      rig.backpack.rotation.z += strain * (0.6 + tremor * 0.08);
      rig.weaponSocket.rotation.z += tremor * strain * 0.22;
      rig.rightArm.rotation.z += tremor * strain * 0.16;
    }

    if (skill.profile && skill.weight > 0) {
      const pose = skill.profile;
      const weight = skill.weight;
      const impulse = skill.impulse;
      rig.torso.rotation.z += pose.torsoLean * weight;
      rig.torso.position.y += pose.torsoDip * weight;
      rig.hip.position.x += pose.hipShift * weight;
      rig.weaponSocket.position.x += pose.socketReach * weight * (0.72 + impulse * 0.28);
      rig.weaponSocket.position.y += pose.socketLift * weight;
      rig.weaponSocket.rotation.z += pose.socketRoll * weight;
      rig.leftArm.rotation.z += pose.leftArm * weight;
      rig.rightArm.rotation.z += pose.rightArm * weight;
      rig.helmet.rotation.z -= pose.torsoLean * weight * 0.22;
      if (skill.phase === 'action') {
        rig.weaponSocket.position.x += pose.socketReach * impulse * 0.25;
        rig.torso.rotation.x -= Math.abs(pose.torsoLean) * impulse * 0.16;
      }
    }

    if (dodge > 0) {
      const weightedDodge = dodge * profile.dodgeWeight;
      if (state.build.operatorClass === 'vanguard') {
        rig.torso.rotation.z -= 0.22 * weightedDodge;
        rig.hip.position.x += 0.075 * weightedDodge;
        rig.leftArm.rotation.z -= 0.08 * weightedDodge;
      } else if (state.build.operatorClass === 'vector') {
        rig.torso.rotation.z -= 0.34 * weightedDodge;
        rig.hip.position.x += 0.13 * weightedDodge;
        rig.helmet.rotation.z += 0.08 * weightedDodge;
      } else {
        rig.torso.rotation.z -= 0.28 * weightedDodge;
        rig.hip.position.x += 0.1 * weightedDodge;
        rig.backpack.rotation.z += 0.16 * weightedDodge;
      }
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

    for (const [id, visual] of this.authoredWeapons) {
      const active = id === player.currentWeapon;
      visual.mount.setEnabled(active);
      visual.mount.scaling.set(active ? (variantPresentation?.silhouetteScaleX ?? 1) : 1, 1, 1);
    }

    const heat = Math.max(0, Math.min(1, player.weaponHeat[player.currentWeapon] ?? 0));
    const thermalCue = weaponVariantThermalCue(variantId, heat);
    const thermalWarningAt = variantPresentation?.thermalWarningAt ?? 0.72;
    const thermalCriticalAt = variantPresentation?.thermalCriticalAt ?? 0.98;
    const thermalLoad = Math.max(0, Math.min(1, (heat - thermalWarningAt) / Math.max(0.04, thermalCriticalAt - thermalWarningAt)));
    const reloadPulse = player.reloadT > 0 && player.reloadWeapon === player.currentWeapon
      ? Math.max(0, Math.min(1, player.reloadT / Math.max(0.01, state.weapons[player.currentWeapon].reloadSeconds)))
      : 0;
    const flash = Math.max(0, Math.min(1, state.weaponFlash * 8));
    const pulse = 0.75 + Math.sin(state.time * 11) * 0.12;
    const weaponColor = colorFromHex(weaponColors[player.currentWeapon]);
    const operatorColor = operatorFaction ? colorFromHex(factionColors[operatorFaction]) : weaponColor;

    this.operatorAccentMaterial.diffuseColor.copyFrom(operatorColor.scale(0.45));
    this.operatorAccentMaterial.emissiveColor.copyFrom(operatorColor.scale(0.18 + Math.min(0.35, heat * 0.16 + flash * 0.12)));
    this.weaponAccentMaterial.diffuseColor.copyFrom(weaponColor.scale(0.5));
    this.weaponAccentMaterial.emissiveColor.copyFrom(weaponColor.scale(
      0.28 + heat * 0.9 + flash * 0.8 + reloadPulse * pulse * 0.25 + thermalLoad * 0.24,
    ));
    this.weaponAccent.scaling.x = variantPresentation?.silhouetteScaleX ?? 1;

    current.muzzleSocket.computeWorldMatrix(true);
    const muzzle = current.muzzleSocket.getAbsolutePosition();
    const mode = player.dead
      ? 'down'
      : player.dodgeTime > 0
        ? 'dodge'
        : hit > 0
          ? 'hit'
          : player.ventT > 0
            ? 'vent'
            : player.reloadT > 0
              ? 'reload'
              : state.weaponFlash > 0
                ? 'recoil'
                : charge > 0.08
                  ? 'charge'
                  : overheat > 0.1
                    ? 'overheat'
                    : speed > 0.08
                      ? 'locomotion'
                      : 'idle';

    this.canvas.dataset.operatorStance = profile.id;
    this.canvas.dataset.operatorAnimation = mode;
    this.canvas.dataset.operatorBlend = [
      `move:${speed.toFixed(2)}`,
      `aim:${Math.abs(aimOffset).toFixed(2)}`,
      `recoil:${recoil.toFixed(2)}`,
      `reload:${reload.toFixed(2)}`,
      `charge:${charge.toFixed(2)}`,
      `vent:${vent.toFixed(2)}`,
      `overheat:${overheat.toFixed(2)}`,
      `dodge:${dodge.toFixed(2)}`,
      `hit:${hit.toFixed(2)}`,
    ].join(',');
    this.canvas.dataset.operatorSkillAnimation = skill.profile && skill.phase !== 'idle' ? `${skill.profile.id}:${skill.phase}` : 'idle';
    this.canvas.dataset.operatorSkillBlend = `weight:${skill.weight.toFixed(2)},impulse:${skill.impulse.toFixed(2)},recovery:${skill.recovery.toFixed(2)},cancel:${skill.interrupted ? 'interrupted' : skill.cancelReady ? 'ready' : 'locked'}`;
    this.canvas.dataset.weaponActive = player.currentWeapon;
    this.canvas.dataset.weaponAsset = current.assetId;
    this.canvas.dataset.weaponHeat = heat.toFixed(2);
    this.canvas.dataset.weaponThermalCue = thermalCue;
    this.canvas.dataset.weaponVariant = variantId ?? 'family-service';
    this.canvas.dataset.weaponHandling = `${handling.stance}:${handling.reloadStyle}:${handling.ventStyle}`;
    this.canvas.dataset.babylonWeaponMuzzleOrigin = 'muzzle-socket';
    this.canvas.dataset.babylonWeaponMuzzle = `${muzzle.x.toFixed(3)},${muzzle.y.toFixed(3)},${muzzle.z.toFixed(3)}`;
    this.canvas.dataset.babylonPlayerTracking = `sim:${player.currentWeapon}|class:${state.build.operatorClass ?? 'generic'}|aim:${player.aim.x.toFixed(3)},${player.aim.y.toFixed(3)}`;
    const runtimeStats = getBabylonGraphicsAssetRuntime(this.scene).stats();
    this.canvas.dataset.babylonPlayerRuntime = [
      `cached:${runtimeStats.cachedAssets}`,
      `active:${runtimeStats.activeInstances}`,
      `bytes:${runtimeStats.estimatedCachedCompressedBytes}`,
    ].join('|');
  }

  private releasePlayerPresentation(reason: string) {
    if (!this.operatorAssetInstance
      && this.authoredWeapons.size === 0
      && this.canvas.dataset.babylonPlayerState !== 'loading') {
      return;
    }
    this.playerPresentationSignature = '';
    this.playerLoadGeneration += 1;
    const released = this.authoredWeapons.size + (this.operatorAssetInstance ? 1 : 0);
    this.releaseMountedPlayerAssets();
    this.canvas.dataset.babylonPlayerState = 'released';
    this.canvas.dataset.operatorVisual = 'released-babylon';
    this.canvas.dataset.weaponVisual = 'released-babylon';
    this.canvas.dataset.babylonPlayerRelease = `${reason}:released-${released}`;
    const stats = getBabylonGraphicsAssetRuntime(this.scene).stats();
    this.canvas.dataset.babylonPlayerRuntime = [
      `cached:${stats.cachedAssets}`,
      `active:${stats.activeInstances}`,
      `bytes:${stats.estimatedCachedCompressedBytes}`,
    ].join('|');
    this.updateSceneTelemetry();
  }

  private releaseMountedPlayerAssets() {
    this.weaponPivot.parent = this.playerRoot;
    for (const visual of this.authoredWeapons.values()) {
      visual.instance.release();
      visual.mount.dispose();
    }
    this.authoredWeapons.clear();
    this.operatorAssetInstance?.release();
    this.operatorAssetInstance = null;
    this.operatorMountRoot?.dispose();
    this.operatorMountRoot = null;
    this.authoredOperatorRig = null;
    this.operatorAccent.setEnabled(false);
    this.weaponAccent.setEnabled(false);
    this.lastPlayerDurability = Number.NaN;
  }

  private ensureEnemyCatalog(detailScale: number) {
    const assetDetailScale = this.coarse ? Math.min(detailScale, 0.55) : detailScale;
    const selected = BABYLON_ENEMY_ROLES.map(role => {
      const spec = selectGraphicsAssetSpec(ENEMY_ASSET_FAMILIES[role], assetDetailScale);
      if (!spec) throw new Error(`No authored Babylon enemy asset available for ${role}`);
      return { role, spec };
    });
    const signature = selected.map(item => item.spec.id).join(':');
    if (signature === this.enemyCatalogSignature) return;

    this.enemyCatalogSignature = signature;
    const generation = ++this.enemyCatalogGeneration;
    this.enemyCatalogReady = false;
    this.canvas.dataset.babylonEnemyCatalogState = 'loading';
    this.canvas.dataset.babylonEnemyCatalogRoles = BABYLON_ENEMY_ROLES.join(',');
    this.canvas.dataset.babylonEnemyCatalogAssets = selected.map(item => item.spec.id).join(',');
    delete this.canvas.dataset.babylonEnemyCatalogError;

    const runtime = getBabylonGraphicsAssetRuntime(this.scene);
    void runtime.preload(selected.map(item => item.spec), 2).then(preload => {
      if (this.disposed || generation !== this.enemyCatalogGeneration) return;
      if (preload.failed > 0) {
        this.canvas.dataset.babylonEnemyCatalogState = 'fallback';
        this.canvas.dataset.babylonEnemyCatalogError = `preload-failed:${preload.failed}`;
        return;
      }
      this.enemyCatalogReady = true;
      this.canvas.dataset.babylonEnemyCatalogState = 'ready';
      this.canvas.dataset.babylonEnemyCatalogLod = [...new Set(selected.map(item => item.spec.lod))].sort().join(',');
      const stats = runtime.stats();
      this.canvas.dataset.babylonEnemyCatalogRuntime = [
        `cached:${stats.cachedAssets}`,
        `active:${stats.activeInstances}`,
        `bytes:${stats.estimatedCachedCompressedBytes}`,
      ].join('|');
      this.updateSceneTelemetry();
    }).catch(error => {
      if (this.disposed || generation !== this.enemyCatalogGeneration) return;
      this.canvas.dataset.babylonEnemyCatalogState = 'fallback';
      this.canvas.dataset.babylonEnemyCatalogError = error instanceof Error ? error.message : String(error);
    });
  }

  private createEnemyVisual(enemy: Enemy) {
    if (enemy.role === 'boss') throw new Error('P27-B4 Babylon enemy presentation excludes bosses');
    const role = enemy.role;
    const eliteScale = role === 'elite' ? 1.18 : 1;
    const bodyHeight = (role === 'suppressor' ? 1.25 : role === 'technician' ? 1.1 : 1.16) * eliteScale;
    const bodyWidth = (role === 'suppressor' ? 0.56 : role === 'elite' ? 0.5 : 0.43) * eliteScale;
    const baseBodyY = bodyHeight * 0.52;
    const baseHeadY = bodyHeight + 0.26 * eliteScale;

    const root = new TransformNode(`p27-b4-enemy-${enemy.id}`, this.scene);
    const fallbackRoot = new TransformNode(`p27-b4-enemy-fallback-${enemy.id}`, this.scene);
    fallbackRoot.parent = root;

    const shellMaterial = new StandardMaterial(`p27-b4-enemy-shell-${enemy.id}`, this.scene);
    shellMaterial.diffuseColor = colorFromHex(enemyRoleColors[role]).scale(0.72);
    shellMaterial.emissiveColor = colorFromHex(enemyRoleColors[role]).scale(0.06);
    shellMaterial.specularColor = Color3.Black();

    const headMaterial = new StandardMaterial(`p27-b4-enemy-head-${enemy.id}`, this.scene);
    headMaterial.diffuseColor = colorFromHex(0xb99080).scale(0.72);
    headMaterial.specularColor = Color3.Black();

    const accentMaterial = new StandardMaterial(`p27-b4-enemy-accent-${enemy.id}`, this.scene);
    accentMaterial.diffuseColor = colorFromHex(enemyRoleColors[role]).scale(0.58);
    accentMaterial.emissiveColor = colorFromHex(enemyRoleColors[role]).scale(0.24);
    accentMaterial.specularColor = Color3.Black();

    const body = MeshBuilder.CreateCylinder(`p27-b4-enemy-body-${enemy.id}`, {
      height: bodyHeight,
      diameterTop: bodyWidth * 1.55,
      diameterBottom: bodyWidth * 1.9,
      tessellation: 9,
    }, this.scene);
    body.parent = fallbackRoot;
    body.position.y = baseBodyY;
    body.material = shellMaterial;
    body.isPickable = false;

    const head = MeshBuilder.CreateSphere(`p27-b4-enemy-head-${enemy.id}`, {
      diameter: 0.46 * eliteScale,
      segments: 8,
    }, this.scene);
    head.parent = fallbackRoot;
    head.position.y = baseHeadY;
    head.material = headMaterial;
    head.isPickable = false;

    const weapon = MeshBuilder.CreateBox(`p27-b4-enemy-weapon-${enemy.id}`, {
      width: role === 'technician' ? 0.9 : role === 'suppressor' ? 0.8 : 0.72,
      height: role === 'suppressor' ? 0.16 : 0.11,
      depth: role === 'technician' ? 0.09 : 0.14,
    }, this.scene);
    weapon.parent = fallbackRoot;
    weapon.position.set(0.48 * eliteScale, 1.04 * eliteScale, 0.08);
    weapon.material = accentMaterial;
    weapon.isPickable = false;

    if (role === 'suppressor') {
      for (const side of [-1, 1]) {
        const shoulder = MeshBuilder.CreateBox(`p27-b4-suppressor-shoulder-${enemy.id}-${side}`, {
          width: 0.18,
          height: 0.18,
          depth: 0.34,
        }, this.scene);
        shoulder.parent = fallbackRoot;
        shoulder.position.set(0, 1.08, side * 0.34);
        shoulder.material = shellMaterial;
        shoulder.isPickable = false;
      }
    } else if (role === 'technician') {
      const antenna = MeshBuilder.CreateBox(`p27-b4-technician-antenna-${enemy.id}`, {
        width: 0.05,
        height: 0.5,
        depth: 0.05,
      }, this.scene);
      antenna.parent = fallbackRoot;
      antenna.position.set(-0.18, 1.35, -0.14);
      antenna.rotation.z = -0.18;
      antenna.material = accentMaterial;
      antenna.isPickable = false;
    } else if (role === 'elite') {
      for (const side of [-1, 1]) {
        const fin = MeshBuilder.CreateBox(`p27-b4-elite-fin-${enemy.id}-${side}`, {
          width: 0.08,
          height: 0.42,
          depth: 0.13,
        }, this.scene);
        fin.parent = fallbackRoot;
        fin.position.set(-0.1, 1.34, side * 0.28);
        fin.rotation.x = side * 0.12;
        fin.material = accentMaterial;
        fin.isPickable = false;
      }
    }

    const silhouette = enemyVariantSilhouette(enemy.variant);
    const variantCue = MeshBuilder.CreateBox(`p27-b4-variant-${silhouette}-${enemy.id}`, {
      width: silhouette === 'braced' ? 0.62 : silhouette === 'mobile' ? 0.4 : silhouette === 'drone' ? 0.34 : 0.18,
      height: silhouette === 'technical' ? 0.48 : silhouette === 'drone' ? 0.12 : 0.08,
      depth: silhouette === 'braced' ? 0.14 : silhouette === 'mobile' ? 0.08 : 0.12,
    }, this.scene);
    variantCue.parent = root;
    variantCue.position.set(
      silhouette === 'technical' ? -0.22 : 0,
      silhouette === 'drone' ? 0.72 : silhouette === 'technical' ? 1.48 : 1.22,
      silhouette === 'mobile' ? -0.34 : -0.24,
    );
    variantCue.rotation.z = silhouette === 'mobile' ? -0.28 : silhouette === 'technical' ? 0.16 : 0;
    variantCue.material = accentMaterial;
    variantCue.isPickable = false;

    const visual: BabylonEnemyVisual = {
      root,
      fallbackRoot,
      body,
      head,
      weapon,
      variantCue,
      shellMaterial,
      headMaterial,
      accentMaterial,
      role,
      variant: enemy.variant,
      assetInstance: null,
      assetMount: null,
      assetId: null,
      assetSignature: '',
      rig: null,
      loadGeneration: 0,
      loadState: 'fallback',
      lastDurability: enemy.hp + enemy.armor,
      lastArmor: enemy.armor,
      impactUntil: -1,
      armorBreakUntil: -1,
      lastTelegraph: enemy.telegraph,
      attackEventAt: -1,
      lastActive: false,
      activationEventAt: -1,
      lastDead: false,
      deathEventAt: -1,
      baseBodyY,
      baseHeadY,
    };
    this.enemyVisuals.set(enemy.id, visual);
    return visual;
  }

  private ensureEnemyAsset(visual: BabylonEnemyVisual, enemy: Enemy, detailScale: number) {
    if (enemy.role === 'boss') return;
    const assetDetailScale = this.coarse ? Math.min(detailScale, 0.55) : detailScale;
    const spec = selectGraphicsAssetSpec(ENEMY_ASSET_FAMILIES[enemy.role], assetDetailScale);
    if (!spec) return;
    const signature = `${enemy.role}:${spec.id}`;
    if (signature === visual.assetSignature) return;

    visual.assetSignature = signature;
    const generation = ++visual.loadGeneration;
    this.releaseMountedEnemyAsset(visual);
    visual.loadState = 'loading';
    visual.fallbackRoot.setEnabled(true);
    void this.loadEnemyAsset(visual, enemy, spec, generation);
  }

  private async loadEnemyAsset(
    visual: BabylonEnemyVisual,
    enemy: Enemy,
    spec: GraphicsAssetSpec,
    generation: number,
  ) {
    const runtime = getBabylonGraphicsAssetRuntime(this.scene);
    let instance: BabylonGraphicsAssetInstance | null = null;
    let mount: TransformNode | null = null;
    try {
      instance = await runtime.instantiate(spec);
      if (this.disposed || generation !== visual.loadGeneration || !this.enemyVisuals.has(enemy.id)) {
        instance.release();
        return;
      }

      mount = new TransformNode(`p27-b4-authored-enemy-${enemy.id}-${generation}`, this.scene);
      mount.parent = visual.root;
      mount.setEnabled(false);
      instance.rootNodes.forEach(root => {
        root.parent = mount;
      });

      const rigCandidates = {
        hip: findInstanceTransform(instance, 'hip'),
        torso: findInstanceTransform(instance, 'torso'),
        helmet: findInstanceTransform(instance, 'helmet'),
        leftArm: findInstanceTransform(instance, 'arm-left'),
        rightArm: findInstanceTransform(instance, 'arm-right'),
        leftLeg: findInstanceTransform(instance, 'leg-left'),
        rightLeg: findInstanceTransform(instance, 'leg-right'),
        backpack: findInstanceTransform(instance, 'backpack'),
        weaponSocket: findInstanceTransform(instance, 'weapon-socket'),
      };
      if (!Object.values(rigCandidates).every(Boolean)) {
        throw new Error(`Authored Babylon ${enemy.role} enemy is missing the articulated rig/socket contract`);
      }

      const rigBase = rigCandidates as Omit<BabylonOperatorRig, 'rest'>;
      const rest = new Map<TransformNode, BabylonRigRest>();
      for (const node of Object.values(rigBase)) rest.set(node, prepareRigNode(node));
      const rig: BabylonOperatorRig = { ...rigBase, rest };

      if (this.disposed || generation !== visual.loadGeneration || !this.enemyVisuals.has(enemy.id)) {
        instance.release();
        mount.dispose();
        return;
      }

      visual.assetInstance = instance;
      visual.assetMount = mount;
      visual.assetId = spec.id;
      visual.rig = rig;
      visual.loadState = 'authored';
      visual.fallbackRoot.setEnabled(false);
      mount.setEnabled(true);
    } catch (error) {
      instance?.release();
      mount?.dispose();
      if (this.disposed || generation !== visual.loadGeneration || !this.enemyVisuals.has(enemy.id)) return;
      visual.assetInstance = null;
      visual.assetMount = null;
      visual.assetId = null;
      visual.rig = null;
      visual.loadState = 'fallback';
      visual.fallbackRoot.setEnabled(true);
      this.canvas.dataset.babylonEnemyFallbackReason = error instanceof Error ? error.message : String(error);
    }
  }

  private syncEnemyPresentation(state: SimState, detailScale: number) {
    const seen = new Set<number>();
    let animationTelemetry: { priority: number; enemy: Enemy; motion: EnemyBossAnimationSignals; damage: EnemyDamageAnimationSignals } | null = null;

    for (const enemy of state.enemies) {
      if (enemy.role === 'boss') continue;
      seen.add(enemy.id);
      let visual = this.enemyVisuals.get(enemy.id);
      if (visual && (visual.role !== enemy.role || visual.variant !== enemy.variant)) {
        this.disposeEnemyVisual(visual, 'identity-change');
        this.enemyVisuals.delete(enemy.id);
        visual = undefined;
      }
      visual ??= this.createEnemyVisual(enemy);

      if (enemy.active && !visual.lastActive) visual.activationEventAt = state.time;
      visual.lastActive = enemy.active;
      if (enemy.dead && !visual.lastDead) visual.deathEventAt = state.time;
      visual.lastDead = enemy.dead;
      visual.root.setEnabled(enemy.active);
      if (!enemy.active) continue;

      this.ensureEnemyAsset(visual, enemy, detailScale);

      const durability = enemy.hp + enemy.armor;
      if (!enemy.dead && durability < visual.lastDurability - 0.5) visual.impactUntil = state.time + 0.18;
      if (!enemy.dead && visual.lastArmor > 0 && enemy.armor <= 0) visual.armorBreakUntil = state.time + 0.44;
      visual.lastDurability = durability;
      visual.lastArmor = enemy.armor;
      if (visual.lastTelegraph > 0 && enemy.telegraph <= 0 && !enemy.dead && enemy.statuses.disrupted <= 0 && enemy.statuses.stagger <= 0) {
        visual.attackEventAt = state.time;
      }
      visual.lastTelegraph = enemy.telegraph;

      const motion = resolveEnemyBossAnimation({
        role: enemy.role,
        id: enemy.id,
        time: state.time,
        vx: enemy.vx,
        vy: enemy.vy,
        telegraph: enemy.telegraph,
        sinceAttack: visual.attackEventAt >= 0 ? state.time - visual.attackEventAt : -1,
        sincePhaseChange: -1,
        combatClass: enemy.combatClass,
        protocolPulse: enemy.protocolPulse,
        modifierCount: enemy.protocols.length + enemy.mutations.length + enemy.commandTargetMutations.length + enemy.bossPhaseMutations.length,
        anchored: enemy.anchored,
        statuses: enemy.statuses,
        bossPhase: enemy.bossPhase,
        dead: enemy.dead,
      });
      const damage = resolveEnemyDamageAnimation({
        hit: state.time < visual.impactUntil ? clamp01((visual.impactUntil - state.time) / 0.18) : 0,
        staggerTimer: enemy.statuses.stagger,
        armorBreak: state.time < visual.armorBreakUntil ? clamp01((visual.armorBreakUntil - state.time) / 0.44) : 0,
        dead: enemy.dead,
      });
      const spawn = visual.activationEventAt >= 0 ? clamp01(1 - (state.time - visual.activationEventAt) / 0.42) : 0;

      visual.root.position.set(scaled(enemy.x), 0, scaled(enemy.y));
      const direction = enemy.telegraph > 0 || motion.commit > 0 || motion.recovery > 0 ? enemy.telegraphAim : { x: enemy.vx, y: enemy.vy };
      if (Math.hypot(direction.x, direction.y) > 0.01) visual.root.rotation.y = Math.atan2(-direction.y, direction.x);

      this.syncEnemyFallback(visual, enemy, state, motion, damage, spawn);
      if (visual.rig) this.syncAuthoredEnemyRig(visual, enemy, state, motion, damage, spawn);

      if (enemy.dead) {
        visual.root.scaling.set(1, Math.max(0.16, enemy.deathT * 0.32), 1);
        visual.shellMaterial.alpha = 0.35;
        visual.headMaterial.alpha = 0.35;
        visual.accentMaterial.alpha = 0.45;
      } else {
        visual.root.scaling.set(1, 1, 1);
        visual.shellMaterial.alpha = 1;
        visual.headMaterial.alpha = 1;
        visual.accentMaterial.alpha = 1;
      }

      const priority = enemy.role === 'elite' ? 4 : enemy.role === 'technician' ? 3 : enemy.role === 'suppressor' ? 2 : 1;
      if (!animationTelemetry || priority > animationTelemetry.priority) {
        animationTelemetry = { priority, enemy, motion, damage };
      }
    }

    for (const [id, visual] of this.enemyVisuals) {
      if (seen.has(id)) continue;
      this.disposeEnemyVisual(visual, 'despawn');
      this.enemyVisuals.delete(id);
    }

    const activeVisuals = [...this.enemyVisuals.values()].filter(visual => visual.root.isEnabled());
    const authored = activeVisuals.filter(visual => visual.loadState === 'authored').length;
    const fallback = activeVisuals.filter(visual => visual.loadState === 'fallback').length;
    const loading = activeVisuals.filter(visual => visual.loadState === 'loading').length;
    const roles = [...new Set(activeVisuals.map(visual => visual.role))].sort();
    const variants = [...new Set(activeVisuals.map(visual => `${visual.variant}:${enemyVariantSilhouette(visual.variant)}`))].sort();
    const assets = [...new Set(activeVisuals.map(visual => visual.assetId).filter((value): value is string => Boolean(value)))].sort();
    const runtimeStats = getBabylonGraphicsAssetRuntime(this.scene).stats();

    this.canvas.dataset.babylonEnemyState = activeVisuals.length === 0
      ? 'idle'
      : loading > 0 || !this.enemyCatalogReady
        ? 'loading'
        : 'ready';
    this.canvas.dataset.enemyVisual = authored > 0
      ? fallback > 0 ? 'authored+procedural-fallback-babylon' : 'authored-babylon'
      : 'procedural-fallback-babylon';
    this.canvas.dataset.enemyRoles = roles.join(',');
    this.canvas.dataset.enemyVariants = variants.join(',');
    this.canvas.dataset.enemyAssets = assets.join(',');
    this.canvas.dataset.enemyActive = String(activeVisuals.length);
    this.canvas.dataset.enemyAuthoredCount = String(authored);
    this.canvas.dataset.enemyFallbackCount = String(fallback);
    this.canvas.dataset.enemyLoadingCount = String(loading);
    this.canvas.dataset.babylonEnemyTracking = `active:${activeVisuals.length}|authored:${authored}|fallback:${fallback}|loading:${loading}`;
    this.canvas.dataset.babylonEnemyReuse = 'shared-runtime+role-assets+variant-silhouettes+shared-animation-signals';
    this.canvas.dataset.babylonEnemyCleanup = `released:${this.enemyReleaseCount}`;
    this.canvas.dataset.babylonEnemyRuntime = [
      `cached:${runtimeStats.cachedAssets}`,
      `active:${runtimeStats.activeInstances}`,
      `bytes:${runtimeStats.estimatedCachedCompressedBytes}`,
    ].join('|');

    if (animationTelemetry) {
      const { enemy, motion, damage } = animationTelemetry;
      this.canvas.dataset.enemyAnimation = `${motion.profile.id}:${motion.phase}`;
      this.canvas.dataset.enemyAnimationBlend = [
        `move:${motion.speed.toFixed(2)}`,
        `tell:${motion.tell.toFixed(2)}`,
        `commit:${motion.commit.toFixed(2)}`,
        `recovery:${motion.recovery.toFixed(2)}`,
        `hit:${damage.hit.toFixed(2)}`,
        `stagger:${damage.stagger.toFixed(2)}`,
        `armorBreak:${damage.armorBreak.toFixed(2)}`,
      ].join(',');
      this.canvas.dataset.enemyAnimationTarget = `${enemy.role}:${enemy.variant}`;
      this.canvas.dataset.enemyVariantSilhouette = enemyVariantSilhouette(enemy.variant);
      this.canvas.dataset.enemyFacing = 'telegraph-or-velocity';
      this.canvas.dataset.enemySpawnDeath = 'active-root+spawn-pose+death-rig+deterministic-release';
    } else {
      delete this.canvas.dataset.enemyAnimation;
      delete this.canvas.dataset.enemyAnimationBlend;
      delete this.canvas.dataset.enemyAnimationTarget;
      delete this.canvas.dataset.enemyVariantSilhouette;
    }
  }

  private syncEnemyFallback(
    visual: BabylonEnemyVisual,
    enemy: Enemy,
    state: SimState,
    motion: EnemyBossAnimationSignals,
    damage: EnemyDamageAnimationSignals,
    spawn: number,
  ) {
    const { profile } = motion;
    const burst = enemy.burst > 0 && enemy.fireCooldown <= 0.78 ? 0.55 : 0;
    const commit = Math.max(motion.commit, burst);
    const side = enemy.id % 2 === 0 ? 1 : -1;

    visual.body.position.y = visual.baseBodyY - spawn * 0.08;
    visual.head.position.y = visual.baseHeadY - spawn * 0.04;
    visual.body.rotation.set(0, 0, profile.torsoLean + profile.tellLean * motion.tell);
    visual.head.rotation.set(0, 0, -profile.tellLean * motion.tell * 0.2);
    visual.body.scaling.set(1, 1 - damage.stagger * 0.06 - spawn * 0.08, 1);
    visual.body.rotation.z += side * (damage.torsoSnap * 0.12 + damage.armorBreak * 0.08);
    visual.head.rotation.z -= side * (damage.hit * 0.1 + damage.stagger * 0.08);

    visual.weapon.position.set(
      0.48 + profile.tellReach * motion.tell - profile.commitKick * commit * 0.65,
      1.04 + profile.tellLift * motion.tell,
      0.08,
    );
    visual.weapon.rotation.set(0, 0, -profile.tellLean * motion.tell * 0.45 + profile.commitKick * commit * 0.5);

    const silhouette = enemyVariantSilhouette(enemy.variant);
    const speed = clamp01(Math.hypot(enemy.vx, enemy.vy) * 0.012);
    visual.variantCue.rotation.y = silhouette === 'drone' ? state.time * 1.8 : 0;
    visual.variantCue.rotation.z = (silhouette === 'mobile' ? -0.28 : silhouette === 'technical' ? 0.16 : 0)
      + (silhouette === 'mobile' ? Math.sin(state.time * 8 + enemy.id) * 0.08 * speed : 0);
    visual.accentMaterial.emissiveColor = colorFromHex(enemyRoleColors[visual.role]).scale(
      0.22 + damage.hit * 0.32 + damage.armorBreak * 0.24,
    );
  }

  private syncAuthoredEnemyRig(
    visual: BabylonEnemyVisual,
    enemy: Enemy,
    state: SimState,
    motion: EnemyBossAnimationSignals,
    damage: EnemyDamageAnimationSignals,
    spawn: number,
  ) {
    const rig = visual.rig;
    if (!rig) return;
    for (const [node, rest] of rig.rest) {
      node.position.copyFrom(rest.position);
      node.rotation.copyFrom(rest.rotation);
    }

    const { profile } = motion;
    const burst = enemy.burst > 0 && enemy.fireCooldown <= 0.78 ? 0.55 : 0;
    const commit = Math.max(motion.commit, burst);
    rig.torso.position.y += motion.idle;
    rig.backpack.position.y += motion.idle * 0.62;
    rig.helmet.rotation.z += motion.idle * 0.8;
    rig.leftLeg.rotation.z += motion.gait;
    rig.rightLeg.rotation.z -= motion.gait;
    rig.leftArm.rotation.z += profile.leftArm - motion.gait * 0.22;
    rig.rightArm.rotation.z += profile.rightArm + motion.gait * 0.18;
    rig.torso.rotation.z += profile.torsoLean;

    if (motion.tell > 0) {
      rig.torso.rotation.z += profile.tellLean * motion.tell;
      rig.torso.position.y += profile.tellLift * motion.tell * 0.32;
      rig.weaponSocket.position.x += profile.tellReach * motion.tell;
      rig.weaponSocket.position.y += profile.tellLift * motion.tell;
      rig.weaponSocket.rotation.z -= profile.tellLean * motion.tell * 0.48;
      rig.leftArm.rotation.z -= 0.16 * motion.tell;
      rig.rightArm.rotation.z += 0.12 * motion.tell;
      rig.helmet.rotation.z -= profile.tellLean * motion.tell * 0.24;
    }
    if (commit > 0) {
      rig.weaponSocket.position.x -= profile.commitKick * commit;
      rig.weaponSocket.rotation.z += profile.commitKick * commit * 0.72;
      rig.torso.rotation.z -= profile.commitKick * commit * 0.42;
      rig.torso.position.y -= profile.commitKick * commit * 0.1;
      rig.rightArm.rotation.z += profile.commitKick * commit * 0.8;
      rig.backpack.rotation.z -= profile.commitKick * commit * 0.28;
    } else if (motion.recovery > 0) {
      rig.weaponSocket.position.x -= profile.commitKick * motion.recovery * 0.22;
      rig.torso.rotation.z += profile.commitKick * motion.recovery * 0.12;
      rig.rightArm.rotation.z += profile.commitKick * motion.recovery * 0.18;
    }

    if (spawn > 0) {
      rig.hip.position.y -= 0.16 * spawn;
      rig.torso.position.y -= 0.08 * spawn;
      rig.leftArm.rotation.z += 0.12 * spawn;
      rig.rightArm.rotation.z -= 0.12 * spawn;
    }
    if (damage.hit > 0) {
      const side = enemy.id % 2 === 0 ? 1 : -1;
      rig.torso.rotation.z += side * 0.2 * damage.torsoSnap;
      rig.helmet.rotation.z -= side * 0.13 * damage.hit;
      rig.hip.position.x -= 0.065 * damage.hit;
    }
    if (damage.stagger > 0) {
      rig.torso.rotation.x += 0.14 * damage.stagger;
      rig.torso.position.y -= 0.07 * damage.stagger;
      rig.leftArm.rotation.z += 0.1 * damage.stagger;
      rig.rightArm.rotation.z -= 0.08 * damage.stagger;
      rig.weaponSocket.position.y -= 0.04 * damage.stagger;
    }
    if (damage.armorBreak > 0) {
      rig.torso.rotation.x -= 0.16 * damage.armorBreak;
      rig.torso.position.y += 0.04 * damage.armorBreak;
      rig.leftArm.rotation.z -= 0.24 * damage.armFlare;
      rig.rightArm.rotation.z += 0.24 * damage.armFlare;
      rig.weaponSocket.position.y += 0.07 * damage.armorBreak;
      rig.helmet.rotation.z += (enemy.id % 2 === 0 ? -1 : 1) * 0.08 * damage.armorBreak;
    }
    if (enemy.dead) {
      const fall = clamp01(1 - enemy.deathT);
      rig.hip.position.y -= 0.45 * fall;
      rig.torso.rotation.z = (enemy.id % 2 === 0 ? -1 : 1) * 1.1 * fall;
      rig.leftArm.rotation.z = -0.15;
      rig.rightArm.rotation.z = 0.12;
    }

    void state;
  }

  private releaseMountedEnemyAsset(visual: BabylonEnemyVisual) {
    visual.assetInstance?.release();
    visual.assetInstance = null;
    visual.assetMount?.dispose();
    visual.assetMount = null;
    visual.assetId = null;
    visual.rig = null;
    visual.fallbackRoot.setEnabled(true);
  }

  private disposeEnemyVisual(visual: BabylonEnemyVisual, reason: string) {
    visual.loadGeneration += 1;
    this.releaseMountedEnemyAsset(visual);
    visual.body.dispose();
    visual.head.dispose();
    visual.weapon.dispose();
    visual.variantCue.dispose();
    visual.shellMaterial.dispose();
    visual.headMaterial.dispose();
    visual.accentMaterial.dispose();
    visual.fallbackRoot.dispose();
    visual.root.dispose();
    this.enemyReleaseCount += 1;
    this.canvas.dataset.babylonEnemyLastRelease = `${reason}:${visual.role}:${visual.variant}`;
  }

  private releaseEnemyPresentation(reason: string) {
    if (this.enemyVisuals.size === 0 && this.canvas.dataset.babylonEnemyState === 'idle') return;
    for (const visual of this.enemyVisuals.values()) this.disposeEnemyVisual(visual, reason);
    this.enemyVisuals.clear();
    this.canvas.dataset.babylonEnemyState = 'released';
    this.canvas.dataset.enemyActive = '0';
    this.canvas.dataset.enemyAuthoredCount = '0';
    this.canvas.dataset.enemyFallbackCount = '0';
    this.canvas.dataset.enemyLoadingCount = '0';
    this.canvas.dataset.babylonEnemyCleanup = `released:${this.enemyReleaseCount}`;
    const stats = getBabylonGraphicsAssetRuntime(this.scene).stats();
    this.canvas.dataset.babylonEnemyRuntime = [
      `cached:${stats.cachedAssets}`,
      `active:${stats.activeInstances}`,
      `bytes:${stats.estimatedCachedCompressedBytes}`,
    ].join('|');
    this.updateSceneTelemetry();
  }

  private ensureRefineryEnvironment(state: SimState, detailScale: number) {
    const world = getWorldSize();
    const familyKeys = Object.keys(REFINERY_ASSET_FAMILIES) as RefineryFamilyKey[];
    const selected = familyKeys.map(key => {
      const spec = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES[key], detailScale);
      if (!spec) throw new Error(`No authored refinery asset available for ${key}`);
      return { key, spec };
    });
    const signature = [
      world.w,
      world.h,
      state.objects.length,
      ...selected.map(item => item.spec.id),
    ].join(':');
    if (signature === this.refineryEnvironmentSignature) return;
    this.refineryEnvironmentSignature = signature;
    const generation = ++this.refineryLoadGeneration;
    this.releaseMountedRefineryAssets();

    this.canvas.dataset.environmentVisual = 'authored-loading-babylon';
    this.canvas.dataset.babylonEnvironmentState = 'loading';
    delete this.canvas.dataset.babylonEnvironmentError;
    void this.loadRefineryEnvironment(state, world.w, world.h, selected, generation);
  }

  private async loadRefineryEnvironment(
    state: SimState,
    worldW: number,
    worldH: number,
    selected: Array<{ key: RefineryFamilyKey; spec: GraphicsAssetSpec }>,
    generation: number,
  ) {
    const runtime = getBabylonGraphicsAssetRuntime(this.scene);
    const preload = await runtime.preload(selected.map(item => item.spec), 2);
    if (this.disposed || generation !== this.refineryLoadGeneration) return;

    if (preload.failed > 0) {
      this.canvas.dataset.environmentVisual = 'authored-fallback-babylon';
      this.canvas.dataset.babylonEnvironmentState = 'error';
      this.canvas.dataset.babylonEnvironmentError = `preload-failed:${preload.failed}`;
      return;
    }

    const placements = refineryPlacements(state, worldW, worldH);
    const byKey = new Map(selected.map(item => [item.key, item.spec]));
    const loadRoot = new TransformNode(`p27-b2-refinery-shell-${generation}`, this.scene);
    loadRoot.setEnabled(false);
    const mountedInstances: BabylonGraphicsAssetInstance[] = [];
    let placementCount = 0;

    try {
      for (const key of Object.keys(placements) as RefineryFamilyKey[]) {
        const spec = byKey.get(key);
        if (!spec) throw new Error(`Missing selected authored refinery asset for ${key}`);

        for (let index = 0; index < placements[key].length; index += 1) {
          const placement = placements[key][index];
          const instance = await runtime.instantiate(spec);
          if (this.disposed || generation !== this.refineryLoadGeneration) {
            instance.release();
            mountedInstances.forEach(item => item.release());
            loadRoot.dispose();
            return;
          }

          const placementRoot = new TransformNode(`p27-b2-${key}-${index}`, this.scene);
          placementRoot.parent = loadRoot;
          placementRoot.position.set(placement.x, key === 'floor' ? 0.005 : key === 'floorGrate' ? 0.010 : 0, placement.z);
          placementRoot.rotation.y = placement.rotationY ?? 0;
          const scale = placement.scale ?? 1;
          placementRoot.scaling.set(scale, scale, scale);
          instance.rootNodes.forEach(root => {
            root.parent = placementRoot;
          });
          mountedInstances.push(instance);
          placementCount += 1;
        }
      }

      if (this.disposed || generation !== this.refineryLoadGeneration) {
        mountedInstances.forEach(item => item.release());
        loadRoot.dispose();
        return;
      }

      this.refineryAssetInstances.push(...mountedInstances);
      this.refineryMountRoot = loadRoot;
      loadRoot.setEnabled(true);

      const lods = [...new Set(selected.map(item => item.spec.lod))].sort();
      const stats = runtime.stats();
      this.canvas.dataset.environmentVisual = 'authored-refinery-babylon';
      this.canvas.dataset.environmentLod = lods.join(',');
      this.canvas.dataset.environmentKit = REFINERY_ENVIRONMENT_KIT;
      this.canvas.dataset.environmentInstances = String(placementCount);
      this.canvas.dataset.environmentTerminals = String(placements.terminal.length);
      this.canvas.dataset.environmentLandmark = 'ore-smelter-gantry';
      this.canvas.dataset.environmentServiceDetails = `service-conduit:${placements.serviceConduit.length}`;
      this.canvas.dataset.environmentSurfaceDetail = `wall-panel:${placements.wallPanel.length}+cable-tray:${placements.cableTray.length}`;
      this.canvas.dataset.environmentMachineDetail = `processor-functional:${placements.processor.length}+floor-grate:${placements.floorGrate.length}`;
      this.canvas.dataset.environmentComposition = 'clear-center-lane+processor-triangle+gantry-focal+perimeter-clutter';
      this.canvas.dataset.babylonEnvironmentState = 'ready';
      this.canvas.dataset.babylonEnvironmentAssets = String(selected.length);
      this.canvas.dataset.babylonEnvironmentPlacements = String(placementCount);
      this.canvas.dataset.babylonEnvironmentLod = lods.join(',');
      this.canvas.dataset.babylonEnvironmentReuse = 'cache-shared+geometry-shared+material-shared';
      this.canvas.dataset.babylonEnvironmentRuntime = [
        `cached:${stats.cachedAssets}`,
        `active:${stats.activeInstances}`,
        `bytes:${stats.estimatedCachedCompressedBytes}`,
      ].join('|');
      this.updateSceneTelemetry();
    } catch (error) {
      mountedInstances.forEach(item => item.release());
      loadRoot.dispose();
      if (this.disposed || generation !== this.refineryLoadGeneration) return;
      this.canvas.dataset.environmentVisual = 'authored-fallback-babylon';
      this.canvas.dataset.babylonEnvironmentState = 'error';
      this.canvas.dataset.babylonEnvironmentError = error instanceof Error ? error.message : String(error);
    }
  }

  private releaseRefineryEnvironment(reason: string) {
    if (!this.refineryMountRoot && this.refineryAssetInstances.length === 0 && this.canvas.dataset.babylonEnvironmentState !== 'loading') {
      return;
    }
    this.refineryEnvironmentSignature = '';
    this.refineryLoadGeneration += 1;
    const released = this.refineryAssetInstances.length;
    this.releaseMountedRefineryAssets();
    this.canvas.dataset.environmentVisual = 'released-babylon';
    this.canvas.dataset.environmentInstances = '0';
    this.canvas.dataset.environmentTerminals = '0';
    this.canvas.dataset.babylonEnvironmentState = 'released';
    this.canvas.dataset.babylonEnvironmentRelease = `${reason}:released-${released}`;
    const stats = getBabylonGraphicsAssetRuntime(this.scene).stats();
    this.canvas.dataset.babylonEnvironmentRuntime = [
      `cached:${stats.cachedAssets}`,
      `active:${stats.activeInstances}`,
      `bytes:${stats.estimatedCachedCompressedBytes}`,
    ].join('|');
    this.updateSceneTelemetry();
  }

  private releaseMountedRefineryAssets() {
    for (const instance of this.refineryAssetInstances.splice(0)) instance.release();
    this.refineryMountRoot?.dispose();
    this.refineryMountRoot = null;
  }

  private updateSceneTelemetry() {
    this.canvas.dataset.babylonSceneTelemetry = [
      `meshes:${this.scene.meshes.length}`,
      `materials:${this.scene.materials.length}`,
      `textures:${this.scene.textures.length}`,
      `roots:${this.scene.rootNodes.length}`,
    ].join('|');
  }

  private syncGraphicsRuntimeBudget(budget: RenderBudgetSnapshot) {
    const signature = budget.assetCacheCompressedByteBudget + ':' + budget.textureAnisotropy;
    if (signature === this.graphicsBudgetSignature) return;
    this.graphicsBudgetSignature = signature;
    getBabylonGraphicsAssetRuntime(this.scene).configureBudget({
      maxCachedCompressedBytes: budget.assetCacheCompressedByteBudget,
      maxTextureAnisotropy: budget.textureAnisotropy,
    });
    this.canvas.dataset.renderMemoryBudget = 'asset-cache:'
      + Math.round(budget.assetCacheCompressedByteBudget / (1024 * 1024))
      + 'mb+anisotropy:' + budget.textureAnisotropy + 'x+materials:shared-cache';
  }

  private resize(width: number, height: number, quality: number, budget: RenderBudgetSnapshot) {
    const qualityCap = quality < 0.55 ? 1.12 : this.coarse || quality < 0.8 ? 1.35 : 1.8;
    const maxRatio = Math.max(0.76, qualityCap * budget.pixelRatioScale);
    const nextRatio = Math.min(maxRatio, window.devicePixelRatio || 1);
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    const ratioChanged = Math.abs(nextRatio - this.pixelRatio) > 0.01;
    const sizeChanged = nextWidth !== this.width || nextHeight !== this.height;

    if (ratioChanged) {
      this.pixelRatio = nextRatio;
      this.engine.setHardwareScalingLevel(1 / nextRatio);
    }
    if (ratioChanged || sizeChanged) {
      this.width = nextWidth;
      this.height = nextHeight;
      this.engine.resize();
    }

    this.canvas.dataset.babylonViewport = [
      `${this.width.toFixed(0)}x${this.height.toFixed(0)}`,
      `ratio:${this.pixelRatio.toFixed(2)}`,
      `buffer:${this.renderCanvas.width}x${this.renderCanvas.height}`,
    ].join('@');
    this.canvas.dataset.renderTier = budget.tierName;
    this.canvas.dataset.graphicsQuality = budget.qualityMode;
    this.canvas.dataset.renderFrameMs = budget.smoothedFrameMs.toFixed(2);
    this.canvas.dataset.renderBudget = [
      `pixel:${budget.pixelRatioScale.toFixed(2)}`,
      `shadow:${budget.shadows ? budget.shadowMapSize : 0}`,
      `reflection:${budget.reflectionScale.toFixed(2)}`,
      `detail:${budget.detailScale.toFixed(2)}`,
    ].join('+');
  }

  private syncCamera(
    state: CombatGraphicsRenderArgs[0],
    aspect: number,
    cameraFeedback?: CombatGraphicsRenderArgs[10],
  ) {
    const px = state.player.x * WORLD_SCALE;
    const pz = state.player.y * WORLD_SCALE;
    const narrow = aspect < 1.15;
    const cameraHeight = narrow ? 18 : this.coarse ? 14.8 : 12.8;
    const cameraOffset = narrow ? 13.2 : this.coarse ? 11.2 : 9.8;
    const offsetX = cameraFeedback?.worldOffsetX ?? 0;
    const offsetZ = cameraFeedback?.worldOffsetZ ?? 0;

    this.camera.position.set(px + cameraOffset + offsetX, cameraHeight, pz + cameraOffset + offsetZ);
    this.cameraTarget.set(
      px + state.player.aim.x * 1.1 - offsetX * 0.2,
      0.62,
      pz + state.player.aim.y * 1.1 - offsetZ * 0.2,
    );
    this.camera.setTarget(this.cameraTarget);
    this.camera.getViewMatrix(true);
    this.camera.getProjectionMatrix(true);

    const layout = narrow ? 'narrow' : this.coarse ? 'coarse' : 'standard';
    this.canvas.dataset.babylonCameraLayout = layout;
    this.canvas.dataset.babylonCameraFraming = `${layout}:height-${cameraHeight.toFixed(1)}+offset-${cameraOffset.toFixed(1)}+fov-${CAMERA_FOV_DEGREES}`;
    this.canvas.dataset.cameraFeedback = cameraFeedback
      ? `${cameraFeedback.mode}:${cameraFeedback.magnitude.toFixed(2)}`
      : 'off:0.00';
  }
}

export function createBabylonCombatRenderer(
  renderCanvas: HTMLCanvasElement,
  coarse: boolean,
  backend: BabylonGraphicsBackendId = 'webgl2',
  telemetryCanvas: HTMLCanvasElement = renderCanvas,
) {
  return BabylonCombatRenderer.create(renderCanvas, coarse, backend, telemetryCanvas);
}
