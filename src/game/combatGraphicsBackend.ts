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

export type MissionVisualReadiness = {
  generation: number;
  missionKey: string;
  phase: 'loading' | 'ready';
  mode: 'authored' | 'fallback';
  shell: 'loading' | 'authored' | 'fallback';
  world: 'loading' | 'authored' | 'fallback';
  reason: string | null;
};

export const LOCATION_FRAME_COST_SIGNATURE_VERSION = 'p28-p2-v1';
export const LOCATION_FRAME_COST_ROUTES = [
  'asteroid-refinery',
  'orbital-station',
  'damaged-vessel',
  'spin-habitat',
  'jovian-harvester',
  'ice-mine',
  'solar-yard',
  'lattice-annex',
  'momentum-exchange',
  'cryo-reserve',
  'parallax-array',
] as const;

export type LocationFrameCostSnapshot = {
  route: string;
  renderWidth: number;
  renderHeight: number;
  pixelRatio: number;
  rawFrameMs: number;
  smoothedFrameMs: number;
  tier: string;
  transition: string;
  transitionCount: number;
  drawCalls: number;
  triangles: number;
  activeMeshes: number;
  shadowMap: number;
  shadowCasters: number;
  ssao: 'on' | 'off';
  bloom: 'on' | 'off';
  ibl: 'on' | 'off';
  assetInstances: number;
  cachedAssets: number;
};

export function formatLocationFrameCostSignature(snapshot: LocationFrameCostSnapshot) {
  return [
    LOCATION_FRAME_COST_SIGNATURE_VERSION,
    `route:${snapshot.route}`,
    `resolution:${snapshot.renderWidth}x${snapshot.renderHeight}`,
    `pixelRatio:${snapshot.pixelRatio.toFixed(2)}`,
    `rawMs:${snapshot.rawFrameMs.toFixed(2)}`,
    `smoothMs:${snapshot.smoothedFrameMs.toFixed(2)}`,
    `tier:${snapshot.tier}`,
    `transition:${snapshot.transition}`,
    `transitionCount:${snapshot.transitionCount}`,
    `drawCalls:${snapshot.drawCalls}`,
    `triangles:${snapshot.triangles}`,
    `activeMeshes:${snapshot.activeMeshes}`,
    `shadowMap:${snapshot.shadowMap}`,
    `shadowCasters:${snapshot.shadowCasters}`,
    `ssao:${snapshot.ssao}`,
    `bloom:${snapshot.bloom}`,
    `ibl:${snapshot.ibl}`,
    `assetInstances:${snapshot.assetInstances}`,
    `cachedAssets:${snapshot.cachedAssets}`,
  ].join('|');
}

function datasetMetric(value: string | undefined, pattern: RegExp, fallback = 0) {
  const match = value?.match(pattern);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
  const selectedTierCost = qualityMode === 'performance' ? 2 : reducedEffects ? 1 : 0;
  if (RENDER_TIER_COST[tier] > selectedTierCost) return 'sustained-frame-pressure';
  if (qualityMode === 'performance') return 'performance-mode';
  if (reducedEffects) return 'reduced-effects';
  return 'none';
}

export interface CombatGraphicsLifecycle {
  dispose(): void;
}

export interface CombatGraphicsBackend extends CombatGraphicsLifecycle {
  readonly id: CombatGraphicsImplementationId;
  readonly loadedId: CombatGraphicsLoadedBackendId;
  render(...args: CombatGraphicsRenderArgs): void;
  missionVisualReadiness?(): MissionVisualReadiness;
  performanceStats(): CombatGraphicsPerformanceStats;
  screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection;
}

export interface CombatGraphicsBackendFactory {
  readonly id: CombatGraphicsBackendId;
  isSupported(): boolean;
  create(canvas: HTMLCanvasElement, coarse: boolean, options?: CombatGraphicsBackendCreateOptions): CombatGraphicsBackend;
}

type BabylonRuntimeCostSource = {
  engine?: {
    _drawCalls?: { current?: number };
  };
  scene?: {
    getActiveIndices?: () => number;
    getActiveMeshes?: () => { length: number };
  };
};

class BabylonCombatGraphicsBackend implements CombatGraphicsBackend {
  readonly id = 'babylon' as const;
  private delegate: CombatGraphicsBackend | null = null;
  private disposed = false;
  private webGpuRenderSurface: HTMLCanvasElement | null = null;
  private webGpuFallbackInFlight = false;
  private lastRenderAt = 0;
  private lastObservedRenderTier: string | null = null;
  private renderTierTransitionCount = 0;

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
    canvas.dataset.missionVisualReadiness = 'loading';
    canvas.dataset.missionVisualMode = 'authored';
    canvas.dataset.missionVisualShell = 'loading';
    canvas.dataset.missionVisualWorld = 'loading';
    canvas.dataset.missionVisualGeneration = '0';
    canvas.dataset.missionVisualMissionKey = 'initializing';
    canvas.dataset.missionVisualReason = '';
    canvas.dataset.renderTierTransition = 'none';
    canvas.dataset.renderTierTransitionCount = '0';
    canvas.dataset.renderLocationCostVersion = LOCATION_FRAME_COST_SIGNATURE_VERSION;
    canvas.dataset.renderLocationCostChannels = 'cpu:raw+smoothed|gpu:draw+triangles+active-meshes+shadows+ssao+bloom+ibl|assets:instances+cache';
    canvas.dataset.renderLocationCostRouteCoverage = LOCATION_FRAME_COST_ROUTES.join(',');
    canvas.dataset.renderLocationCostCaveat = 'runtime-frame-cost-not-physical-phone-fps';
    // Compact/coarse input remains a framing hint; it must never lower startup render quality.
    canvas.dataset.renderDeviceClassPolicy = coarse ? 'flagship-default:coarse-hint-ignored' : 'flagship-default';
    canvas.dataset.renderDowngradeReason = 'pending';
    void this.initialize();
  }

  get loadedId(): CombatGraphicsLoadedBackendId {
    return this.delegate?.loadedId ?? 'initializing';
  }

  render(...args: CombatGraphicsRenderArgs) {
    const now = performance.now();
    const rawFrameMs = this.lastRenderAt > 0 ? Math.max(0, now - this.lastRenderAt) : 1000 / 60;
    this.lastRenderAt = now;
    this.canvas.dataset.renderRawFrameMs = rawFrameMs.toFixed(2);
    const qualityMode = args[4];
    const reducedEffects = args[8] ?? false;
    const effectiveQuality = normalizeProductionRenderQuality(args[3], qualityMode, reducedEffects);
    this.canvas.dataset.renderQualityInput = `requested:${args[3].toFixed(2)}+effective:${effectiveQuality.toFixed(2)}`;
    if (!this.delegate) return;
    const normalizedArgs: CombatGraphicsRenderArgs = [...args];
    normalizedArgs[3] = effectiveQuality;
    this.delegate.render(...normalizedArgs);
    this.canvas.dataset.renderSmoothedFrameMs = this.canvas.dataset.renderFrameMs ?? '';
    const observedTier = this.canvas.dataset.renderTier ?? '';
    if (observedTier) {
      if (this.lastObservedRenderTier && observedTier !== this.lastObservedRenderTier) {
        this.renderTierTransitionCount += 1;
        this.canvas.dataset.renderTierTransition = `${this.lastObservedRenderTier}->${observedTier}`;
        this.canvas.dataset.renderTierTransitionCount = String(this.renderTierTransitionCount);
      }
      this.lastObservedRenderTier = observedTier;
    }
    this.canvas.dataset.renderDowngradeReason = resolveRenderDowngradeReason(
      this.canvas.dataset.renderTier,
      qualityMode,
      reducedEffects,
    );
    this.updateLocationFrameCostTelemetry(args[5].location, rawFrameMs);
  }

  missionVisualReadiness(): MissionVisualReadiness {
    return this.delegate?.missionVisualReadiness?.() ?? {
      generation: Number.parseInt(this.canvas.dataset.missionVisualGeneration ?? '0', 10) || 0,
      missionKey: this.canvas.dataset.missionVisualMissionKey || 'initializing',
      phase: 'loading',
      mode: 'authored',
      shell: 'loading',
      world: 'loading',
      reason: null,
    };
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
    const previousDisposeCount = Number.parseInt(this.canvas.dataset.babylonDisposeCount ?? '0', 10);
    this.canvas.dataset.babylonDisposeCount = String(Number.isFinite(previousDisposeCount) ? previousDisposeCount + 1 : 1);
    this.canvas.dataset.babylonDisposed = 'true';
  }

  private updateLocationFrameCostTelemetry(route: string, rawFrameMs: number) {
    if (!this.delegate) return;
    const runtime = this.delegate as CombatGraphicsBackend & BabylonRuntimeCostSource;
    const fallbackStats = runtime.engine?._drawCalls && runtime.scene?.getActiveIndices
      ? null
      : this.delegate.performanceStats();
    const drawCalls = Math.max(0, Math.round(runtime.engine?._drawCalls?.current ?? fallbackStats?.drawCalls ?? 0));
    const triangles = Math.max(0, Math.floor((runtime.scene?.getActiveIndices?.() ?? (fallbackStats?.triangles ?? 0) * 3) / 3));
    const activeMeshes = Math.max(
      0,
      Math.round(runtime.scene?.getActiveMeshes?.().length
        ?? datasetMetric(this.canvas.dataset.babylonSceneTelemetry, /(?:^|\|)meshes:(\d+)/)),
    );
    const viewport = this.canvas.dataset.babylonViewport ?? '';
    const renderWidth = Math.max(1, Math.round(datasetMetric(viewport, /buffer:(\d+)x\d+/, this.canvas.width || 1)));
    const renderHeight = Math.max(1, Math.round(datasetMetric(viewport, /buffer:\d+x(\d+)/, this.canvas.height || 1)));
    const pixelRatio = Math.max(0.01, datasetMetric(viewport, /@ratio:([0-9.]+)/, 1));
    const refinery = route === 'asteroid-refinery';
    const shadowMap = refinery
      ? Math.max(0, Math.round(datasetMetric(this.canvas.dataset.babylonLightingBudget, /(?:^|\|)shadow:(\d+)/)))
      : 0;
    const shadowCasters = refinery && shadowMap > 0
      ? Math.max(0, Math.round(datasetMetric(this.canvas.dataset.environmentShadowBudget, /casters-(\d+)/)))
      : 0;
    const runtimeStats = this.canvas.dataset.babylonEnemyRuntime ?? this.canvas.dataset.babylonPlayerRuntime ?? '';
    const assetInstances = Math.max(0, Math.round(datasetMetric(runtimeStats, /(?:^|\|)active:(\d+)/)));
    const cachedAssets = Math.max(0, Math.round(datasetMetric(runtimeStats, /(?:^|\|)cached:(\d+)/)));
    const smoothedFrameMs = Math.max(0, Number.parseFloat(this.canvas.dataset.renderSmoothedFrameMs ?? '') || 0);

    this.canvas.dataset.renderLocationCost = formatLocationFrameCostSignature({
      route,
      renderWidth,
      renderHeight,
      pixelRatio,
      rawFrameMs,
      smoothedFrameMs,
      tier: this.canvas.dataset.renderTier || 'pending',
      transition: this.canvas.dataset.renderTierTransition || 'none',
      transitionCount: this.renderTierTransitionCount,
      drawCalls,
      triangles,
      activeMeshes,
      shadowMap,
      shadowCasters,
      ssao: refinery && this.canvas.dataset.environmentSsao2?.startsWith('primary:') ? 'on' : 'off',
      bloom: refinery && this.canvas.dataset.environmentBloom?.startsWith('selective:') ? 'on' : 'off',
      ibl: refinery && Boolean(this.canvas.dataset.environmentIbl) && !this.canvas.dataset.environmentIbl?.startsWith('off:') ? 'on' : 'off',
      assetInstances,
      cachedAssets,
    });
  }

  private async initialize() {
    const [{ createBabylonCombatRenderer }, { createBabylonMissionVisualReadinessBackend }] = await Promise.all([
      import('./babylonCombatRenderer'),
      import('./babylonRefineryMissionReadiness'),
    ]);

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
        const guardedRenderer = createBabylonMissionVisualReadinessBackend(renderer, this.canvas);
        this.delegate = guardedRenderer;
        this.canvas.dataset.graphicsPathLoaded = guardedRenderer.loadedId;
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
    this.canvas.dataset.missionVisualReadiness = 'loading';
    this.canvas.dataset.missionVisualShell = 'loading';
    this.canvas.dataset.missionVisualWorld = 'loading';

    const failedRenderer = this.delegate;
    this.delegate = null;
    failedRenderer?.dispose();
    this.releaseWebGpuRenderSurface();

    try {
      await this.initializeWebGl2();
    } finally {
      this.webGpuFallbackInFlight = false;
    }
  }

  private async initializeWebGl2() {
    const [{ createBabylonCombatRenderer }, { createBabylonMissionVisualReadinessBackend }] = await Promise.all([
      import('./babylonCombatRenderer'),
      import('./babylonRefineryMissionReadiness'),
    ]);
    try {
      const renderer = await createBabylonCombatRenderer(this.canvas, this.coarse, 'webgl2', this.canvas);
      if (this.disposed) {
        renderer.dispose();
        return;
      }
      const guardedRenderer = createBabylonMissionVisualReadinessBackend(renderer, this.canvas);
      this.delegate = guardedRenderer;
      this.canvas.dataset.graphicsPathLoaded = guardedRenderer.loadedId;
      this.canvas.dataset.graphicsPathFallback = '';
      this.canvas.dataset.babylonInit = 'ready';
    } catch (error) {
      if (this.disposed) return;
      this.canvas.dataset.babylonInit = 'failed';
      this.canvas.dataset.babylonBackendLoaded = 'failed';
      this.canvas.dataset.babylonFallbackReason = error instanceof Error ? error.message : String(error);
      console.warn('P27-D8 Babylon WebGL2 fallback initialization failed; Canvas 2D safety rendering remains available.', error);
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
