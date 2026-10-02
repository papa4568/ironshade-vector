import type { Contract } from './campaign';
import type { CombatCameraFeedbackSample } from './combatCameraFeedback';
import type { EquipmentFaction } from './factionGear';
import type { GraphicsQualityMode } from './renderQuality';
import type { Player, SimState } from './sim';
import { ThreeCombatRenderer } from './threeCombatRenderer';

export type CombatGraphicsBackendId = 'webgl2' | 'webgpu' | 'babylon';
export type CombatGraphicsLoadedBackendId = CombatGraphicsBackendId | 'initializing';
export type BabylonGraphicsBackendId = 'webgl2' | 'webgpu';

export type CombatGraphicsBackendCreateOptions = {
  babylonBackend?: BabylonGraphicsBackendId;
};

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
  create(canvas: HTMLCanvasElement, coarse: boolean, options?: CombatGraphicsBackendCreateOptions): CombatGraphicsBackend;
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
  private webGpuRenderSurface: HTMLCanvasElement | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coarse: boolean,
    private readonly requestedBackend: BabylonGraphicsBackendId,
  ) {
    canvas.dataset.babylonInit = 'initializing';
    canvas.dataset.babylonDisposed = 'false';
    canvas.dataset.babylonBackendRequested = requestedBackend;
    canvas.dataset.babylonBackendLoaded = 'initializing';
    canvas.dataset.babylonBackendFallback = '';
    canvas.dataset.babylonBackendFallbackReason = '';
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
    this.releaseWebGpuRenderSurface();
    this.canvas.dataset.babylonDisposed = 'true';
  }

  private async initialize() {
    const { createBabylonCombatRenderer } = await import('./babylonCombatRenderer');

    if (this.requestedBackend === 'webgpu') {
      try {
        const renderSurface = this.createWebGpuRenderSurface();
        const renderer = await createBabylonCombatRenderer(renderSurface, this.coarse, 'webgpu', this.canvas);
        if (this.disposed) {
          renderer.dispose();
          this.releaseWebGpuRenderSurface();
          return;
        }
        this.delegate = renderer;
        this.canvas.dataset.graphicsPathLoaded = renderer.loadedId;
        this.canvas.dataset.graphicsPathFallback = '';
        this.canvas.dataset.babylonInit = 'ready';
        return;
      } catch (error) {
        if (this.disposed) {
          this.releaseWebGpuRenderSurface();
          return;
        }
        const failureStage = this.canvas.dataset.babylonBackendInitStage ?? 'webgpu-init';
        const fallbackKind = failureStage === 'webgpu-support' ? 'unsupported' : 'init-fallback';
        this.canvas.dataset.babylonBackendFallback = `webgpu->webgl2:${fallbackKind}`;
        this.canvas.dataset.babylonBackendFallbackReason = error instanceof Error ? error.message : String(error);
        this.releaseWebGpuRenderSurface();
        console.warn('P27-D1 Babylon WebGPU unavailable; recreating with Babylon WebGL2.', error);
      }
    }

    try {
      const renderer = await createBabylonCombatRenderer(this.canvas, this.coarse, 'webgl2', this.canvas);
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
      this.canvas.dataset.babylonInit = 'failed';
      this.canvas.dataset.babylonBackendLoaded = 'failed';
      this.canvas.dataset.babylonFallbackReason = error instanceof Error ? error.message : String(error);
      console.warn('P27-D1 Babylon WebGL2 fallback initialization failed; Three.js fallback is intentionally disabled for the Babylon QA path.', error);
    }
  }

  private createWebGpuRenderSurface() {
    const surface = this.canvas.ownerDocument.createElement('canvas');
    surface.setAttribute('aria-hidden', 'true');
    surface.dataset.babylonRenderSurface = 'webgpu';
    surface.style.position = 'absolute';
    surface.style.inset = '0';
    surface.style.width = '100%';
    surface.style.height = '100%';
    surface.style.display = 'block';
    surface.style.pointerEvents = 'none';
    this.canvas.insertAdjacentElement('afterend', surface);
    this.webGpuRenderSurface = surface;
    return surface;
  }

  private releaseWebGpuRenderSurface() {
    this.webGpuRenderSurface?.remove();
    this.webGpuRenderSurface = null;
  }
}

export const productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'webgl2';

export type CombatGraphicsPathSelection = {
  mode: 'production-default' | 'qa-explicit';
  requestedId: CombatGraphicsBackendId | null;
  selectedId: CombatGraphicsBackendId;
  babylonBackendRequested: BabylonGraphicsBackendId | null;
};

export function resolveCombatGraphicsPathSelection(search: string): CombatGraphicsPathSelection {
  const params = new URLSearchParams(search);
  const requested = params.get('graphicsPath');
  if (
    params.get('graphicsCompare') === '1'
    && (requested === 'webgl2' || requested === 'webgpu' || requested === 'babylon')
  ) {
    const requestedBabylonBackend = params.get('babylonBackend');
    return {
      mode: 'qa-explicit',
      requestedId: requested,
      selectedId: requested,
      babylonBackendRequested: requested === 'babylon'
        ? requestedBabylonBackend === 'webgpu' ? 'webgpu' : 'webgl2'
        : null,
    };
  }
  return {
    mode: 'production-default',
    requestedId: null,
    selectedId: productionCombatGraphicsBackendId,
    babylonBackendRequested: null,
  };
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
  create: (canvas, coarse, options) => new BabylonCombatGraphicsBackend(canvas, coarse, options?.babylonBackend ?? 'webgl2'),
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
    babylonCombatGraphicsBackendFactory,
  ],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
  options?: CombatGraphicsBackendCreateOptions,
) {
  return selectCombatGraphicsBackendFactory(factories, selectedId)?.create(canvas, coarse, options) ?? null;
}
