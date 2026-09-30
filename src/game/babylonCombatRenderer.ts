import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import type {
  CombatGraphicsBackend,
  CombatGraphicsPerformanceStats,
  CombatGraphicsPointerDirection,
  CombatGraphicsPointerProjectionArgs,
  CombatGraphicsRenderArgs,
} from './combatGraphicsBackend';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;
const CAMERA_FOV_DEGREES = 42;
const CAMERA_FOV_RADIANS = CAMERA_FOV_DEGREES * Math.PI / 180;

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

      canvas.dataset.babylonBackend = 'webgl2';
      canvas.dataset.babylonInit = 'ready';
      canvas.dataset.babylonScene = 'active';
      canvas.dataset.babylonDisposed = 'false';
      canvas.dataset.babylonFrames = '0';
      canvas.dataset.babylonCameraParity = 'three-combat-v1';
      canvas.dataset.babylonInputParity = 'ground-plane-raycast-v1';

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
      return;
    }
    this.canvas.dataset.babylonScenario = 'asteroid-refinery';
    this.resize(width, height, quality);
    this.syncCamera(state, width / Math.max(1, height), cameraFeedback);
    this.scene.render();
    this.frames += 1;
    this.canvas.dataset.babylonFrames = String(this.frames);
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
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.dataset.babylonScene = 'disposed';
    this.canvas.dataset.babylonDisposed = 'true';
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
