import type { Scene } from '@babylonjs/core/scene';
import type { Contract } from './campaign';
import type { CombatCameraFeedbackSample } from './combatCameraFeedback';
import type { EquipmentFaction } from './factionGear';
import type { GraphicsQualityMode } from './renderQuality';
import type { Player, SimState } from './sim';

export type CombatGraphicsBackendId = 'babylon';
export type CombatGraphicsImplementationId = CombatGraphicsBackendId | 'webgl2' | 'webgpu';
export type CombatGraphicsLoadedBackendId = CombatGraphicsImplementationId | 'initializing';
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

export function normalizeProductionRenderQuality(
  quality: number,
  qualityMode: GraphicsQualityMode,
  reducedEffects: boolean,
) {
  const safeQuality = Number.isFinite(quality) ? Math.max(0.35, Math.min(1, quality)) : 1;
  if (qualityMode !== 'adaptive') return safeQuality;
  return reducedEffects ? 0.62 : 1;
}

const RENDER_TIER_COST = { high: 0, balanced: 1, performance: 2 } as const;

export function resolveRenderDowngradeReason(
  tier: string | undefined,
  qualityMode: GraphicsQualityMode,
  reducedEffects: boolean,
) {
  if (tier !== 'high' && tier !== 'balanced' && tier !== 'performance') return 'pending';
  const reasons: string[] = [];
  const selectedTierCost = qualityMode === 'performance' ? 2 : reducedEffects ? 1 : 0;
  if (qualityMode === 'performance') reasons.push('performance-mode');
  if (reducedEffects) reasons.push('reduced-effects');
  if (RENDER_TIER_COST[tier] > selectedTierCost) reasons.push('sustained-frame-pressure');
  return reasons.length ? reasons.join('+') : 'none';
}

export interface CombatGraphicsLifecycle {
  dispose(): void;
}

export interface CombatGraphicsBackend extends CombatGraphicsLifecycle {
  readonly id: CombatGraphicsImplementationId;
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

type BabylonRefineryBossPresentationHandle = {
  sync(state: SimState, qualityMode: GraphicsQualityMode): void;
  dispose(): void;
};

class BabylonCombatGraphicsBackend implements CombatGraphicsBackend {
  readonly id = 'babylon' as const;
  private delegate: CombatGraphicsBackend | null = null;
  private bossPresentation: BabylonRefineryBossPresentationHandle | null = null;
  private bossPresentationInitialization: Promise<void> | null = null;
  private disposed = false;
  private webGpuRenderSurface: HTMLCanvasElement | null = null;
  private webGpuFallbackInFlight = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly coarse: boolean,
    private readonly requestedBackend: BabylonGraphicsBackendId,
  ) {
    canvas.dataset.babylonInit = 'initializing';
    canvas.dataset.babylonDisposed = 'false';
    canvas.dataset.babylonDisposeCount ||= '0';
    canvas.dataset.babylonBackendRequested = requestedBackend;
    canvas.dataset.babylonBackendLoaded = 'initializing';
    canvas.dataset.babylonBackendFallback = '';
    canvas.dataset.babylonBackendFallbackReason = '';
    // Compact/coarse input remains a framing hint; it must never lower startup render quality.
    canvas.dataset.renderDeviceClassPolicy = coarse ? 'flagship-default:coarse-hint-ignored' : 'flagship-default';
    canvas.dataset.renderDowngradeReason = 'pending';
    void this.initialize();
  }

  get loadedId(): CombatGraphicsLoadedBackendId {
    return this.delegate?.loadedId ?? 'initializing';
  }

  render(...args: CombatGraphicsRenderArgs) {
    const qualityMode = args[4];
    const reducedEffects = args[8] ?? false;
    const effectiveQuality = normalizeProductionRenderQuality(args[3], qualityMode, reducedEffects);
    this.canvas.dataset.renderQualityInput = `requested:${args[3].toFixed(2)}+effective:${effectiveQuality.toFixed(2)}`;
    const delegate = this.delegate;
    if (!delegate) return;
    const normalizedArgs: CombatGraphicsRenderArgs = [...args];
    normalizedArgs[3] = effectiveQuality;
    const state = normalizedArgs[0];
    const bossNeeded = state.enemies.some(enemy => enemy.role === 'boss' && enemy.active)
      || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('p28d8BossQa') === '1');
    if (bossNeeded && !this.bossPresentation) void this.initializeBossPresentation(delegate);
    try {
      this.bossPresentation?.sync(state, qualityMode);
    } catch (error) {
      this.canvas.dataset.babylonBossPresentation = 'failed';
      this.canvas.dataset.babylonBossFallbackReason = error instanceof Error ? error.message : String(error);
      this.bossPresentation?.dispose();
      this.bossPresentation = null;
    }
    delegate.render(...normalizedArgs);
    this.canvas.dataset.renderDowngradeReason = resolveRenderDowngradeReason(
      this.canvas.dataset.renderTier,
      qualityMode,
      reducedEffects,
    );
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
    this.bossPresentation?.dispose();
    this.bossPresentation = null;
    this.delegate?.dispose();
    this.delegate = null;
    this.releaseWebGpuRenderSurface();
    const previousDisposeCount = Number.parseInt(this.canvas.dataset.babylonDisposeCount ?? '0', 10);
    this.canvas.dataset.babylonDisposeCount = String(Number.isFinite(previousDisposeCount) ? previousDisposeCount + 1 : 1);
    this.canvas.dataset.babylonDisposed = 'true';
  }

  private async initialize() {
    const { createBabylonCombatRenderer } = await import('./babylonCombatRenderer');

    if (this.requestedBackend === 'webgpu') {
      let webGpuReady = false;
      let pendingRuntimeFailure: string | null = null;
      try {
        const renderSurface = this.createWebGpuRenderSurface();
        const renderer = await createBabylonCombatRenderer(
          renderSurface,
          this.coarse,
          'webgpu',
          this.canvas,
          reason => {
            if (!webGpuReady) {
              pendingRuntimeFailure = reason;
              return;
            }
            void this.fallbackFromWebGpu(reason);
          },
        );
        if (pendingRuntimeFailure) {
          renderer.dispose();
          throw new Error(pendingRuntimeFailure);
        }
        if (this.disposed) {
          renderer.dispose();
          this.releaseWebGpuRenderSurface();
          return;
        }
        this.delegate = renderer;
        this.canvas.dataset.graphicsPathLoaded = renderer.loadedId;
        this.canvas.dataset.graphicsPathFallback = '';
        this.canvas.dataset.babylonInit = 'ready';
        webGpuReady = true;
        return;
      } catch (error) {
        if (this.disposed) {
          this.releaseWebGpuRenderSurface();
          return;
        }
        const failureStage = this.canvas.dataset.babylonBackendFailureStage
          ?? this.canvas.dataset.babylonBackendInitStage
          ?? 'webgpu-init';
        const fallbackKind = failureStage === 'webgpu-support'
          ? 'unsupported'
          : failureStage === 'runtime-device-lost' ? 'runtime-device-lost' : 'init-fallback';
        this.canvas.dataset.babylonBackendFallback = `webgpu->webgl2:${fallbackKind}`;
        this.canvas.dataset.babylonBackendFallbackReason = error instanceof Error ? error.message : String(error);
        this.bossPresentation?.dispose();
        this.bossPresentation = null;
        this.delegate?.dispose();
        this.delegate = null;
        this.releaseWebGpuRenderSurface();
        console.warn('P27-D1 Babylon WebGPU unavailable; recreating with Babylon WebGL2.', error);
      }
    }

    await this.initializeWebGl2();
  }

  private async fallbackFromWebGpu(reason: string) {
    if (this.disposed || this.webGpuFallbackInFlight || this.requestedBackend !== 'webgpu') return;
    this.webGpuFallbackInFlight = true;
    this.canvas.dataset.babylonBackendFallback = 'webgpu->webgl2:runtime-device-lost';
    this.canvas.dataset.babylonBackendFallbackReason = reason;
    this.canvas.dataset.babylonBackendLoaded = 'initializing';
    this.canvas.dataset.babylonInit = 'initializing';

    const failedRenderer = this.delegate;
    this.delegate = null;
    this.bossPresentation?.dispose();
    this.bossPresentation = null;
    failedRenderer?.dispose();
    this.releaseWebGpuRenderSurface();

    try {
      await this.initializeWebGl2();
    } finally {
      this.webGpuFallbackInFlight = false;
    }
  }

  private async initializeWebGl2() {
    const { createBabylonCombatRenderer } = await import('./babylonCombatRenderer');
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
      this.bossPresentation?.dispose();
      this.bossPresentation = null;
      this.delegate?.dispose();
      this.delegate = null;
      this.canvas.dataset.babylonInit = 'failed';
      this.canvas.dataset.babylonBackendLoaded = 'failed';
      this.canvas.dataset.babylonFallbackReason = error instanceof Error ? error.message : String(error);
      console.warn('P27-D8 Babylon WebGL2 fallback initialization failed; Canvas 2D safety rendering remains available.', error);
    }
  }

  private initializeBossPresentation(renderer: CombatGraphicsBackend) {
    if (this.disposed || this.bossPresentation) return Promise.resolve();
    if (this.bossPresentationInitialization) return this.bossPresentationInitialization;
    const initialization = (async () => {
      try {
        const { BabylonRefineryBossPresentation } = await import('./babylonRefineryBossPresentation');
        if (this.disposed || this.delegate !== renderer || this.bossPresentation) return;
        const scene = (renderer as unknown as { scene?: Scene }).scene;
        if (!scene || scene.isDisposed) throw new Error('Babylon combat renderer scene unavailable for refinery boss presentation');
        this.bossPresentation = new BabylonRefineryBossPresentation(scene, this.canvas);
      } catch (error) {
        if (this.disposed || this.delegate !== renderer) return;
        this.canvas.dataset.babylonBossPresentation = 'failed';
        this.canvas.dataset.babylonBossFallbackReason = error instanceof Error ? error.message : String(error);
      }
    })();
    this.bossPresentationInitialization = initialization;
    void initialization.finally(() => {
      if (this.bossPresentationInitialization === initialization) this.bossPresentationInitialization = null;
    });
    return initialization;
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

export const productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'babylon';

export type CombatGraphicsPathSelection = {
  mode: 'production-default' | 'qa-explicit';
  requestedId: CombatGraphicsBackendId | null;
  selectedId: CombatGraphicsBackendId;
  babylonBackendRequested: BabylonGraphicsBackendId;
};

export function resolveCombatGraphicsPathSelection(search: string): CombatGraphicsPathSelection {
  const params = new URLSearchParams(search);
  const requested = params.get('graphicsPath');
  if (params.get('graphicsCompare') === '1' && requested === 'babylon') {
    return {
      mode: 'qa-explicit',
      requestedId: 'babylon',
      selectedId: 'babylon',
      babylonBackendRequested: params.get('babylonBackend') === 'webgpu' ? 'webgpu' : 'webgl2',
    };
  }
  return {
    mode: 'production-default',
    requestedId: null,
    selectedId: productionCombatGraphicsBackendId,
    babylonBackendRequested: 'webgl2',
  };
}

export const babylonCombatGraphicsBackendFactory: CombatGraphicsBackendFactory = {
  id: 'babylon',
  isSupported: () => typeof WebGL2RenderingContext !== 'undefined',
  create: (canvas, coarse, options) => new BabylonCombatGraphicsBackend(canvas, coarse, options?.babylonBackend ?? 'webgl2'),
};

export function selectCombatGraphicsBackendFactory(
  factories: readonly CombatGraphicsBackendFactory[] = [babylonCombatGraphicsBackendFactory],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
) {
  return factories.find(factory => factory.id === selectedId && factory.isSupported()) ?? null;
}

export function createCombatGraphicsBackend(
  canvas: HTMLCanvasElement,
  coarse: boolean,
  factories: readonly CombatGraphicsBackendFactory[] = [babylonCombatGraphicsBackendFactory],
  selectedId: CombatGraphicsBackendId = productionCombatGraphicsBackendId,
  options?: CombatGraphicsBackendCreateOptions,
) {
  return selectCombatGraphicsBackendFactory(factories, selectedId)?.create(canvas, coarse, options) ?? null;
}
