import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import type {
  CombatGraphicsBackend,
  CombatGraphicsPerformanceStats,
  CombatGraphicsPointerDirection,
  CombatGraphicsPointerProjectionArgs,
  CombatGraphicsRenderArgs,
} from './combatGraphicsBackend';

export class BabylonCombatRenderer implements CombatGraphicsBackend {
  readonly id = 'babylon' as const;
  readonly loadedId = 'babylon' as const;

  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private disposed = false;
  private frames = 0;
  private width = 0;
  private height = 0;

  private constructor(canvas: HTMLCanvasElement, engine: Engine, scene: Scene) {
    this.canvas = canvas;
    this.engine = engine;
    this.scene = scene;
  }

  static create(canvas: HTMLCanvasElement, coarse: boolean) {
    const engine = new Engine(canvas, !coarse, {
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: true,
    }, true);

    if (engine.webGLVersion !== 2) {
      const version = engine.webGLVersion;
      engine.dispose();
      throw new Error(`Babylon QA backend requires WebGL2; initialized WebGL${version}.`);
    }

    try {
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0.035, 0.055, 0.065, 1);
      const camera = new FreeCamera('p27-a2-babylon-camera', new Vector3(0, 8, -12), scene);
      camera.setTarget(new Vector3(0, 0, 0));
      scene.activeCamera = camera;

      canvas.dataset.babylonBackend = 'webgl2';
      canvas.dataset.babylonInit = 'ready';
      canvas.dataset.babylonScene = 'active';
      canvas.dataset.babylonDisposed = 'false';
      canvas.dataset.babylonFrames = '0';

      return new BabylonCombatRenderer(canvas, engine, scene);
    } catch (error) {
      engine.dispose();
      throw error;
    }
  }

  render(...args: CombatGraphicsRenderArgs): void {
    if (this.disposed) return;
    const [, width, height] = args;
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.engine.resize();
    }
    this.scene.render();
    this.frames += 1;
    this.canvas.dataset.babylonFrames = String(this.frames);
  }

  performanceStats(): CombatGraphicsPerformanceStats {
    return { drawCalls: 0, triangles: 0 };
  }

  screenDirection(..._args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection {
    return null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.dataset.babylonScene = 'disposed';
    this.canvas.dataset.babylonDisposed = 'true';
  }
}

export function createBabylonCombatRenderer(canvas: HTMLCanvasElement, coarse: boolean) {
  return BabylonCombatRenderer.create(canvas, coarse);
}
