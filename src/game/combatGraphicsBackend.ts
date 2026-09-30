import type { Contract } from './campaign';
import type { CombatCameraFeedbackSample } from './combatCameraFeedback';
import type { EquipmentFaction } from './factionGear';
import type { GraphicsQualityMode } from './renderQuality';
import type { Player, SimState } from './sim';
import { ThreeCombatRenderer } from './threeCombatRenderer';

export type CombatGraphicsBackendId = 'webgl2' | 'webgpu' | 'babylon';
export type CombatGraphicsLoadedBackendId = CombatGraphicsBackendId | 'initializing';

export type CombatGraphicsRenderArgs = [
  state: SimState,
  width: number,
  height: number,
  quality: number,
  qualityMode: GraphicsQualityMode,
  mission: Contract,
  mobileTargetId: number | null,
  operatorFaction: EquipmentFaction | null,
  reducedTargetMotion?: boolean,
  firingIntent?: boolean,
  cameraFeedback?: CombatCameraFeedbackSample,
];

export type CombatGraphicsPerformanceStats = {
  drawCalls: number;
  triangles: number;
};

export type CombatGraphicsPointerProjectionArgs = [
  clientX: number,
  clientY: number,
  rect: DOMRect,
  player: Player,
];

export type CombatGraphicsPointerDirection = {
  x: number;
  y: number;
} | null;

export interface CombatGraphicsLifecycle {
  dispose(): void;
}

export interface CombatGraphicsBackend extends CombatGraphicsLifecycle {
  readonly id: CombatGraphicsBackendId;
  readonly loadedId: CombatGraphicsLoadedBackendId;
  render(...args: CombatGraphicsRenderArgs): void;
  performanceStats(): CombatGraphicsPerformanceStats;
  screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection;
}

export interface CombatGraphicsBackendFactory {
  readonly id: CombatGraphicsBackendId;
  isSupported(): boolean;
  create(canvas: HTMLCanvasElement, coarse: boolean): CombatGraphicsBackend;
}

class WebGl2CombatGraphicsBackend implements CombatGraphicsBackend {
  readonly id = 'webgl2' as const;
  readonly loadedId = 'webgl2' as const;
  private readonly renderer: ThreeCombatRenderer;

  constructor(canvas: HTMLCanvasElement, coarse: boolean) {
    this.renderer = new ThreeCombatRenderer(canvas, coarse);
  }

  render(...args: CombatGraphicsRenderArgs) {
    return this.renderer.render(...args);
  }

  performanceStats() {
    return this.renderer.performanceStats();
  }

  screenDirection(...args: CombatGraphicsPointerProjectionArgs) {
    return this.renderer.screenDirection(...args);
  }

  dispose() {
    this.renderer.dispose();
  }
}

class WebGpuRefineryCombatGraphicsBackend implements CombatGraphicsBackend {
  readonly id = 'webgpu' as const;
  private delegate: CombatGraphicsBackend | null = null;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly coarse: boolean) {
    canvas.dataset.webgpuInit = 'initializing';
    void this.initialize();
  }

  get loadedId(): CombatGraphicsLoadedBackendId {
    return this.delegate?.loadedId ?? 'initializing';
  }

  render(...args: CombatGraphicsRenderArgs) {
    return this.delegate?.render(...args);
  }

  performanceStats() {
    return this.delegate?.performanceStats() ?? { drawCalls: 0, triangles: 0 };
  }

  screenDirection(...args: CombatGraphicsPointerProjectionArgs) {
    return this.delegate?.screenDirection(...args) ?? null;
  }

  dispose() {
    this.disposed = true;
    this.delegate?.dispose();
    this.delegate = null;
  }

  private async initialize() {
    try {
      const { createWebGpuRefineryRenderer } = await import('./webGpuRefineryRenderer');
      const renderer = await createWebGpuRefineryRenderer(this.canvas, this.coarse);
      if (this.disposed) {
        renderer.dispose();
        return;
      }
      this.delegate = renderer;
      this.canvas.dataset.graphicsPathLoaded = renderer.loadedId;
      this.canvas.dataset.graphicsPathFallback = renderer.loadedId === 'webgpu'
        ? ''
        : 'webgpu->webgl2:renderer-fallback';
    } catch (error) {
      if (this.disposed) return;
      console.warn('P21-F1 WebGPU refinery backend unavailable; falling back to production WebGL2.', error);
      this.canvas.dataset.webgpuInit = 'fallback';
      this.canvas.dataset.webgpuFallbackReason = error instanceof Error ? error.message : String(error);
      try {
        const fallback = new WebGl2CombatGraphicsBackend(this.canvas, this.coarse);
        this.delegate = fallback;
        this.canvas.dataset.graphicsPathLoaded = fallback.loadedId;
        this.canvas.dataset.graphicsPathFallback = 'webgpu->webgl2:init-fallback';
      } catch (fallbackError) {
        this.canvas.dataset.webgpuInit = 'failed';
        this.canvas.dataset.webgpuFallbackReason = `${this.canvas.dataset.webgpuFallbackReason}; ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
        console.warn('P21-F1 WebGPU and WebGL2 renderer initialization both failed.', fallbackError);
      }
    }
  }
}

class BabylonCombatGraphicsBackend implements CombatGraphicsBackend {
  readonly id = 'babylon' as const;
  private delegate: CombatGraphicsBackend | null = null;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly coarse: boolean) {
    canvas.dataset.babylonInit = 'initializing';
    canvas.dataset.babylonDisposed = 'false';
    void this.initialize();
  }

  get loadedId(): CombatGraphicsLoadedBackendId {
    return this.delegate?.loadedId ?? 'initializing';
  }

  render(...args: CombatGraphicsRenderArgs) {
    return this.delegate?.render(...args);
  }

  performanceStats() {
    return this.delegate?.performanceStats() ?? { drawCalls: 0, triangles: 0 };
  }

  screenDirection(...args: CombatGraphicsPointerProjectionArgs) {
    return this.delegate?.screenDirection(...args) ?? null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.delegate?.dispose();
    this.delegate = null;
    this.canvas.dataset.babylonDisposed = 'true';
  }

  private async initialize() {
    try {
      const { createBabylonCombatRenderer } = await import('./babylonCombatRenderer');
      const renderer = createBabylonCombatRenderer(this.canvas, this.coarse);
      if (this.disposed) {
        renderer.dispose();
        return;
      }
      this.delegate = renderer;
      this.canvas.dataset.graphicsPathLoaded = renderer.loadedId;
      this.canvas.dataset.graphicsPathFallback = '';
      this.canvas.dataset.babylonInit = 'ready';
    } catch (error) {
      if (this.disposed) return;
      console.warn('P27-A2 Babylon QA backend unavailable; falling back to production WebGL2.', error);
      this.canvas.dataset.babylonInit = 'fallback';
      this.canvas.dataset.babylonFallbackReason = error instanceof Error ? error.message : String(error);
      try {
        const fallback = new WebGl2CombatGraphicsBackend(this.canvas, this.coarse);
        this.delegate = fallback;
        this.canvas.dataset.graphicsPathLoaded = fallback.loadedId;
        this.canvas.dataset.graphicsPathFallback = 'babylon->webgl2:init-fallback';
      } catch (fallbackError) {
        this.canvas.dataset.babylonInit = 'failed';
        this.canvas.dataset.babylonFallbackReason = `${this.canvas.dataset.babylonFallbackReason}; ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
        console.warn('P27-A2 Babylon and WebGL2 renderer initialization both failed.', fallbackError);
      }
    }
  }
}

export const productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'webgl2';

export type CombatGraphicsPathSelection = {
  mode: 'production-default' | 'qa-explicit';
  requestedId: CombatGraphicsBackendId | null;
  selectedId: CombatGraphicsBackendId;
};

export function resolveCombatGraphicsPathSelection(search: string): CombatGraphicsPathSelection {
  const params = new URLSearchParams(search);
  const requested = params.get('graphicsPath');
  if (
    params.get('graphicsCompare') === '1'
    && (requested === 'webgl2' || requested === 'webgpu' || requested === 'babylon')
  ) {
    return { mode: 'qa-explicit', requestedId: requested, selectedId: requested };
  }
  return { mode: 'production-default', requestedId: null, selectedId: productionCombatGraphicsBackendId };
}

export const webgl2CombatGraphicsBackendFactory: CombatGraphicsBackendFactory = {
  id: 'webgl2',
  isSupported: () => ThreeCombatRenderer.isSupported(),
  create: (canvas, coarse) => new WebGl2CombatGraphicsBackend(canvas, coarse),
};

export const webgpuRefineryCombatGraphicsBackendFactory: CombatGraphicsBackendFactory = {
  id: 'webgpu',
  isSupported: () => {
    if (typeof navigator === 'undefined') return false;
    return !!(navigator as Navigator & { gpu?: unknown }).gpu;
  },
  create: (canvas, coarse) => new WebGpuRefineryCombatGraphicsBackend(canvas, coarse),
};

export const babylonCombatGraphicsBackendFactory: CombatGraphicsBackendFactory = {
  id: 'babylon',
  isSupported: () => typeof WebGL2RenderingContext !== 'undefined',
  create: (canvas, coarse) => new BabylonCombatGraphicsBackend(canvas, coarse),
};

export function selectCombatGraphicsBackendFactory(
  factories: readonly CombatGraphicsBackendFactory[] = [
    webgl2CombatGraphicsBackendFactory,
    webgpuRefineryCombatGraphicsBackendFactory,
    babylonCombatGraphicsBackendFactory,
  ],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
) {
  const selected = factories.find(factory => factory.id === selectedId && factory.isSupported());
  if (selected) return selected;
  if (selectedId !== productionCombatGraphicsBackendId) {
    return factories.find(factory => factory.id === productionCombatGraphicsBackendId && factory.isSupported()) ?? null;
  }
  return null;
}

export function createCombatGraphicsBackend(
  canvas: HTMLCanvasElement,
  coarse: boolean,
  factories: readonly CombatGraphicsBackendFactory[] = [
    webgl2CombatGraphicsBackendFactory,
    webgpuRefineryCombatGraphicsBackendFactory,
  ],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
) {
  return selectCombatGraphicsBackendFactory(factories, selectedId)?.create(canvas, coarse) ?? null;
}
