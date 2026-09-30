import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
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
import { REFINERY_ASSET_FAMILIES } from './graphicsAssetManifest';
import { selectGraphicsAssetSpec, type GraphicsAssetSpec } from './graphicsAssets';
import { getWorldSize, type CombatObject, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;
const CAMERA_FOV_DEGREES = 42;
const CAMERA_FOV_RADIANS = CAMERA_FOV_DEGREES * Math.PI / 180;
const REFINERY_ENVIRONMENT_KIT = 'floor,floor-grate,bulkhead,processor,pipe-rack,wall-panel,cable-tray,service-conduit,gantry,crate,terminal';

type RefineryFamilyKey = keyof typeof REFINERY_ASSET_FAMILIES;

type RefineryPlacement = {
  x: number;
  z: number;
  rotationY?: number;
  scale?: number;
};

type RefineryPlacementGroups = Record<RefineryFamilyKey, RefineryPlacement[]>;

function scaled(value: number) {
  return value * WORLD_SCALE;
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

      return new BabylonCombatRenderer(canvas, coarse, engine, scene, camera);
    } catch (error) {
      engine.dispose();
      throw error;
    }
  }

  render(...args: CombatGraphicsRenderArgs): void {
    if (this.disposed) return;
    const [state, width, height, quality, , mission, , , , , cameraFeedback] = args;
    if (mission.location !== 'asteroid-refinery') {
      this.canvas.dataset.babylonScenario = 'refinery-only';
      this.releaseRefineryEnvironment('scenario-exit');
      return;
    }
    this.canvas.dataset.babylonScenario = 'asteroid-refinery';
    this.resize(width, height, quality);
    this.ensureRefineryEnvironment(state, quality);
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
    this.releaseRefineryEnvironment('renderer-dispose');
    void disposeBabylonGraphicsAssetRuntime(this.scene);
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.dataset.babylonScene = 'disposed';
    this.canvas.dataset.babylonDisposed = 'true';
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
