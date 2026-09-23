export const PERFORMANCE_BUDGET_VERSION = 'p16-a-v1';

export type PerformanceDeviceTier = 'flagship' | 'midrange' | 'minimum';
export type PerformanceCategory = 'cpu' | 'render' | 'gpu' | 'ui' | 'animation' | 'audio' | 'gc';

export type PerformanceDeviceProfile = {
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
};

type TimeBudget = {
  metric: 'p95-ms';
  limit: number;
};

type GpuBudget = {
  metric: 'p95-workload';
  drawCalls: number;
  triangles: number;
};

type GcBudget = {
  metric: 'heap+collections';
  heapMb: number;
  eventsPerMinute: number;
};

export type PerformanceTierBudget = {
  targetFrameMs: number;
  categories: {
    cpu: TimeBudget;
    render: TimeBudget;
    gpu: GpuBudget;
    ui: TimeBudget;
    animation: TimeBudget;
    audio: TimeBudget;
    gc: GcBudget;
  };
};

export const PERFORMANCE_DEVICE_TIERS: Record<PerformanceDeviceTier, PerformanceTierBudget> = {
  flagship: {
    targetFrameMs: 1000 / 60,
    categories: {
      cpu: { metric: 'p95-ms', limit: 5.5 },
      render: { metric: 'p95-ms', limit: 6.5 },
      gpu: { metric: 'p95-workload', drawCalls: 300, triangles: 1_600_000 },
      ui: { metric: 'p95-ms', limit: 2 },
      animation: { metric: 'p95-ms', limit: 1.5 },
      audio: { metric: 'p95-ms', limit: 0.9 },
      gc: { metric: 'heap+collections', heapMb: 512, eventsPerMinute: 18 },
    },
  },
  midrange: {
    targetFrameMs: 1000 / 60,
    categories: {
      cpu: { metric: 'p95-ms', limit: 6.2 },
      render: { metric: 'p95-ms', limit: 6.8 },
      gpu: { metric: 'p95-workload', drawCalls: 240, triangles: 1_150_000 },
      ui: { metric: 'p95-ms', limit: 2.2 },
      animation: { metric: 'p95-ms', limit: 1.6 },
      audio: { metric: 'p95-ms', limit: 1 },
      gc: { metric: 'heap+collections', heapMb: 384, eventsPerMinute: 20 },
    },
  },
  minimum: {
    targetFrameMs: 1000 / 60,
    categories: {
      cpu: { metric: 'p95-ms', limit: 6.8 },
      render: { metric: 'p95-ms', limit: 7.2 },
      gpu: { metric: 'p95-workload', drawCalls: 190, triangles: 820_000 },
      ui: { metric: 'p95-ms', limit: 2.4 },
      animation: { metric: 'p95-ms', limit: 1.8 },
      audio: { metric: 'p95-ms', limit: 1.1 },
      gc: { metric: 'heap+collections', heapMb: 320, eventsPerMinute: 22 },
    },
  },
};

export const PERFORMANCE_CATEGORIES: readonly PerformanceCategory[] = ['cpu', 'render', 'gpu', 'ui', 'animation', 'audio', 'gc'];

export function resolvePerformanceDeviceTier(profile: PerformanceDeviceProfile, override?: string | null): PerformanceDeviceTier {
  if (override === 'flagship' || override === 'midrange' || override === 'minimum') return override;
  const cores = Math.max(1, Math.floor(profile.hardwareConcurrency ?? 4));
  const memory = Math.max(0, profile.deviceMemoryGb ?? 0);
  if (cores >= 8 && (memory === 0 || memory >= 6)) return 'flagship';
  if (cores >= 6 && (memory === 0 || memory >= 4)) return 'midrange';
  return 'minimum';
}

export type PerformanceFrameMeasurement = {
  frameMs: number;
  cpuMs: number;
  renderMs: number;
  animationMs: number;
  audioMs: number;
  uiMs?: number;
  gpuDrawCalls?: number;
  gpuTriangles?: number;
  heapUsedMb?: number;
};

type PerformanceMetricSnapshot = {
  actual: number | null;
  limit: number;
  unit: string;
  overBudget: boolean;
};

export type PerformanceDiagnosticsSnapshot = {
  budgetVersion: typeof PERFORMANCE_BUDGET_VERSION;
  deviceTier: PerformanceDeviceTier;
  scenario: string;
  sampleCount: number;
  elapsedSeconds: number;
  targetFrameMs: number;
  frameP95Ms: number | null;
  status: 'warming' | 'within-budget' | 'over-budget';
  categories: {
    cpu: PerformanceMetricSnapshot;
    render: PerformanceMetricSnapshot;
    gpu: {
      drawCalls: PerformanceMetricSnapshot;
      triangles: PerformanceMetricSnapshot;
      available: boolean;
    };
    ui: PerformanceMetricSnapshot;
    animation: PerformanceMetricSnapshot;
    audio: PerformanceMetricSnapshot;
    gc: {
      heapMb: PerformanceMetricSnapshot;
      eventsPerMinute: PerformanceMetricSnapshot;
      observedCollections: number;
      available: boolean;
    };
  };
  regressions: PerformanceCategory[];
};

const WINDOW_SIZE = 240;
const MIN_BASELINE_SAMPLES = 45;
const GC_DROP_THRESHOLD_MB = 1;

function finite(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function percentile95(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1))];
}

function rounded(value: number | null, digits = 3) {
  if (value == null) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function metric(actual: number | null, limit: number, unit: string, canEvaluate: boolean): PerformanceMetricSnapshot {
  return {
    actual: rounded(actual),
    limit,
    unit,
    overBudget: canEvaluate && actual != null && actual > limit,
  };
}

export class PerformanceDiagnostics {
  readonly tier: PerformanceDeviceTier;
  readonly scenario: string;
  readonly budget: PerformanceTierBudget;
  private readonly frameMs: number[] = [];
  private readonly cpuMs: number[] = [];
  private readonly renderMs: number[] = [];
  private readonly uiMs: number[] = [];
  private readonly animationMs: number[] = [];
  private readonly audioMs: number[] = [];
  private readonly gpuDrawCalls: number[] = [];
  private readonly gpuTriangles: number[] = [];
  private readonly heapUsedMb: number[] = [];
  private elapsedMs = 0;
  private gcCollections = 0;
  private lastHeapUsedMb: number | null = null;

  constructor(tier: PerformanceDeviceTier, scenario: string) {
    this.tier = tier;
    this.scenario = scenario;
    this.budget = PERFORMANCE_DEVICE_TIERS[tier];
  }

  sample(measurement: PerformanceFrameMeasurement) {
    const push = (target: number[], value: number | undefined) => {
      const next = finite(value);
      if (next == null) return;
      target.push(next);
      if (target.length > WINDOW_SIZE) target.splice(0, target.length - WINDOW_SIZE);
    };

    push(this.frameMs, measurement.frameMs);
    push(this.cpuMs, measurement.cpuMs);
    push(this.renderMs, measurement.renderMs);
    push(this.uiMs, measurement.uiMs);
    push(this.animationMs, measurement.animationMs);
    push(this.audioMs, measurement.audioMs);
    push(this.gpuDrawCalls, measurement.gpuDrawCalls);
    push(this.gpuTriangles, measurement.gpuTriangles);

    const heap = finite(measurement.heapUsedMb);
    if (heap != null) {
      if (this.lastHeapUsedMb != null && this.lastHeapUsedMb - heap >= GC_DROP_THRESHOLD_MB) this.gcCollections += 1;
      this.lastHeapUsedMb = heap;
      push(this.heapUsedMb, heap);
    }

    const frame = finite(measurement.frameMs);
    if (frame != null) this.elapsedMs += frame;
  }

  snapshot(): PerformanceDiagnosticsSnapshot {
    const enoughSamples = this.frameMs.length >= MIN_BASELINE_SAMPLES;
    const budget = this.budget.categories;
    const elapsedMinutes = Math.max(this.elapsedMs / 60_000, 1 / 60);
    const gcRate = this.heapUsedMb.length ? this.gcCollections / elapsedMinutes : null;

    const categories: PerformanceDiagnosticsSnapshot['categories'] = {
      cpu: metric(percentile95(this.cpuMs), budget.cpu.limit, 'ms-p95', enoughSamples),
      render: metric(percentile95(this.renderMs), budget.render.limit, 'ms-p95', enoughSamples),
      gpu: {
        drawCalls: metric(percentile95(this.gpuDrawCalls), budget.gpu.drawCalls, 'draw-calls-p95', enoughSamples),
        triangles: metric(percentile95(this.gpuTriangles), budget.gpu.triangles, 'triangles-p95', enoughSamples),
        available: this.gpuDrawCalls.length > 0 && this.gpuTriangles.length > 0,
      },
      ui: metric(percentile95(this.uiMs), budget.ui.limit, 'ms-p95', enoughSamples),
      animation: metric(percentile95(this.animationMs), budget.animation.limit, 'ms-p95', enoughSamples),
      audio: metric(percentile95(this.audioMs), budget.audio.limit, 'ms-p95', enoughSamples),
      gc: {
        heapMb: metric(percentile95(this.heapUsedMb), budget.gc.heapMb, 'heap-mb-p95', enoughSamples),
        eventsPerMinute: metric(gcRate, budget.gc.eventsPerMinute, 'collections-per-minute', enoughSamples && this.elapsedMs >= 10_000),
        observedCollections: this.gcCollections,
        available: this.heapUsedMb.length > 0,
      },
    };

    const regressions: PerformanceCategory[] = [];
    if (categories.cpu.overBudget) regressions.push('cpu');
    if (categories.render.overBudget) regressions.push('render');
    if (categories.gpu.drawCalls.overBudget || categories.gpu.triangles.overBudget) regressions.push('gpu');
    if (categories.ui.overBudget) regressions.push('ui');
    if (categories.animation.overBudget) regressions.push('animation');
    if (categories.audio.overBudget) regressions.push('audio');
    if (categories.gc.heapMb.overBudget || categories.gc.eventsPerMinute.overBudget) regressions.push('gc');

    return {
      budgetVersion: PERFORMANCE_BUDGET_VERSION,
      deviceTier: this.tier,
      scenario: this.scenario,
      sampleCount: this.frameMs.length,
      elapsedSeconds: rounded(this.elapsedMs / 1000, 2) ?? 0,
      targetFrameMs: rounded(this.budget.targetFrameMs, 3) ?? this.budget.targetFrameMs,
      frameP95Ms: rounded(percentile95(this.frameMs)),
      status: enoughSamples ? (regressions.length ? 'over-budget' : 'within-budget') : 'warming',
      categories,
      regressions,
    };
  }
}
