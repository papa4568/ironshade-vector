import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
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
import type {
  CombatGraphicsBackend,
  CombatGraphicsPerformanceStats,
  CombatGraphicsPointerDirection,
  CombatGraphicsPointerProjectionArgs,
  CombatGraphicsRenderArgs,
} from './combatGraphicsBackend';
import { weaponVariantPresentation, weaponVariantThermalCue } from './classArsenal';
import {
  OPERATOR_ASSET_FAMILY,
  OPERATOR_CLASS_ASSET_FAMILIES,
  REFINERY_ASSET_FAMILIES,
  WEAPON_ASSET_FAMILIES,
} from './graphicsAssetManifest';
import { selectGraphicsAssetSpec, type GraphicsAssetSpec } from './graphicsAssets';
import { resolvePlayerHandlingAnimation } from './playerHandlingAnimation';
import { getWorldSize, weaponHandlingProfiles, type CombatObject, type SimState, type WeaponId } from './sim';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;
const CAMERA_FOV_DEGREES = 42;
const CAMERA_FOV_RADIANS = CAMERA_FOV_DEGREES * Math.PI / 180;
const REFINERY_ENVIRONMENT_KIT = 'floor,floor-grate,bulkhead,processor,pipe-rack,wall-panel,cable-tray,service-conduit,gantry,crate,terminal';
const BABYLON_WEAPON_IDS: readonly WeaponId[] = ['carbine', 'breacher', 'rail'];
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

  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly canvas: HTMLCanvasElement;
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
  private readonly refineryAssetInstances: BabylonGraphicsAssetInstance[] = [];
  private refineryMountRoot: TransformNode | null = null;
  private refineryEnvironmentSignature = '';
  private refineryLoadGeneration = 0;
  private disposed = false;
  private frames = 0;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  private constructor(
    canvas: HTMLCanvasElement,
    coarse: boolean,
    engine: Engine,
    scene: Scene,
    camera: FreeCamera,
  ) {
    this.canvas = canvas;
    this.coarse = coarse;
    this.engine = engine;
    this.scene = scene;
    this.camera = camera;

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

  static create(canvas: HTMLCanvasElement, coarse: boolean) {
    const engine = new Engine(canvas, !coarse, {
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: true,
    }, false);

    if (engine.webGLVersion !== 2) {
      const version = engine.webGLVersion;
      engine.dispose();
      throw new Error(`Babylon QA backend requires WebGL2; initialized WebGL${version}.`);
    }

    try {
      const scene = new Scene(engine);
      scene.useRightHandedSystem = true;
      scene.clearColor = new Color4(0.035, 0.055, 0.065, 1);
      const camera = new FreeCamera('p27-b1-babylon-camera', new Vector3(9.8, 12.8, 9.8), scene);
      camera.fov = CAMERA_FOV_RADIANS;
      camera.minZ = 0.1;
      camera.maxZ = 180;
      camera.setTarget(new Vector3(0, 0.62, 0));
      scene.activeCamera = camera;

      const migrationLight = new HemisphericLight('p27-b2-refinery-preview-light', new Vector3(-0.5, 1, 0.35), scene);
      migrationLight.intensity = 0.82;

      canvas.dataset.babylonBackend = 'webgl2';
      canvas.dataset.babylonInit = 'ready';
      canvas.dataset.babylonScene = 'active';
      canvas.dataset.babylonDisposed = 'false';
      canvas.dataset.babylonFrames = '0';
      canvas.dataset.babylonCameraParity = 'three-combat-v1';
      canvas.dataset.babylonInputParity = 'ground-plane-raycast-v1';
      canvas.dataset.babylonEnvironmentState = 'idle';
      canvas.dataset.babylonPlayerState = 'idle';

      return new BabylonCombatRenderer(canvas, coarse, engine, scene, camera);
    } catch (error) {
      engine.dispose();
      throw error;
    }
  }

  render(...args: CombatGraphicsRenderArgs): void {
    if (this.disposed) return;
    const [state, width, height, quality, , mission, , operatorFaction, , firingIntent = false, cameraFeedback] = args;
    if (mission.location !== 'asteroid-refinery') {
      this.canvas.dataset.babylonScenario = 'refinery-only';
      this.releasePlayerPresentation('scenario-exit');
      this.releaseRefineryEnvironment('scenario-exit');
      return;
    }
    this.canvas.dataset.babylonScenario = 'asteroid-refinery';
    this.resize(width, height, quality);
    this.ensureRefineryEnvironment(state, quality);
    this.ensurePlayerPresentation(state, quality);
    this.syncPlayerPresentation(state, operatorFaction, firingIntent);
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
    this.canvas.dataset.weaponActive = player.currentWeapon;
    this.canvas.dataset.weaponAsset = current.assetId;
    this.canvas.dataset.weaponHeat = heat.toFixed(2);
    this.canvas.dataset.weaponThermalCue = thermalCue;
    this.canvas.dataset.weaponVariant = variantId ?? 'family-service';
    this.canvas.dataset.weaponHandling = `${handling.stance}:${handling.reloadStyle}:${handling.ventStyle}`;
    this.canvas.dataset.babylonWeaponMuzzleOrigin = 'muzzle-socket';
    this.canvas.dataset.babylonWeaponMuzzle = `${muzzle.x.toFixed(3)},${muzzle.y.toFixed(3)},${muzzle.z.toFixed(3)}`;
    this.canvas.dataset.babylonPlayerTracking = `sim:${player.currentWeapon}|class:${state.build.operatorClass ?? 'generic'}|aim:${player.aim.x.toFixed(3)},${player.aim.y.toFixed(3)}`;
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

  private resize(width: number, height: number, quality: number) {
    const qualityCap = quality < 0.55 ? 1.12 : this.coarse || quality < 0.8 ? 1.35 : 1.8;
    const nextRatio = Math.min(qualityCap, window.devicePixelRatio || 1);
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
      `buffer:${this.canvas.width}x${this.canvas.height}`,
    ].join('@');
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

export function createBabylonCombatRenderer(canvas: HTMLCanvasElement, coarse: boolean) {
  return BabylonCombatRenderer.create(canvas, coarse);
}
