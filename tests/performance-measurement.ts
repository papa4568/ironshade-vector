import {
  PERFORMANCE_BUDGET_VERSION,
  PERFORMANCE_CATEGORIES,
  PERFORMANCE_DEVICE_TIERS,
  PerformanceDiagnostics,
  resolvePerformanceDeviceTier,
  type PerformanceCategory,
  type PerformanceDeviceTier,
} from '../src/game/performanceDiagnostics';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(PERFORMANCE_BUDGET_VERSION === 'p16-a-v1', 'performance baseline version must be explicit and stable');
assert(PERFORMANCE_CATEGORIES.join(',') === 'cpu,render,gpu,ui,animation,audio,gc', 'P16-A must keep separate CPU/render/GPU/UI/animation/audio/GC categories');

for (const [tier, budget] of Object.entries(PERFORMANCE_DEVICE_TIERS)) {
  assert(Math.abs(budget.targetFrameMs - 1000 / 60) < 0.01, `${tier} must target 60 fps frame pacing`);
  assert(Object.keys(budget.categories).sort().join(',') === [...PERFORMANCE_CATEGORIES].sort().join(','), `${tier} budget must cover every P16-A category`);
  assert(budget.categories.cpu.limit > 0 && budget.categories.render.limit > 0, `${tier} CPU/render limits must be positive`);
  assert(budget.categories.gpu.drawCalls > 0 && budget.categories.gpu.triangles > 0, `${tier} GPU workload limits must be explicit`);
  assert(budget.categories.gc.heapMb > 0 && budget.categories.gc.eventsPerMinute > 0, `${tier} GC limits must be explicit`);
}

assert(resolvePerformanceDeviceTier({ hardwareConcurrency: 8, deviceMemoryGb: 8 }) === 'flagship', '8-core/8GB profile should classify as flagship');
assert(resolvePerformanceDeviceTier({ hardwareConcurrency: 6, deviceMemoryGb: 4 }) === 'midrange', '6-core/4GB profile should classify as midrange');
assert(resolvePerformanceDeviceTier({ hardwareConcurrency: 4, deviceMemoryGb: 3 }) === 'minimum', '4-core/3GB profile should classify as minimum');
assert(resolvePerformanceDeviceTier({ hardwareConcurrency: 2, deviceMemoryGb: 2 }, 'flagship') === 'flagship', 'explicit QA tier override should be deterministic');

function healthyDiagnostics(tier: PerformanceDeviceTier, scenario: string) {
  const diagnostics = new PerformanceDiagnostics(tier, scenario);
  const budget = PERFORMANCE_DEVICE_TIERS[tier].categories;
  for (let index = 0; index < 180; index += 1) {
    diagnostics.sample({
      frameMs: 15.8 + (index % 5) * 0.08,
      cpuMs: budget.cpu.limit * 0.62,
      renderMs: budget.render.limit * 0.64,
      uiMs: budget.ui.limit * 0.55,
      animationMs: budget.animation.limit * 0.58,
      audioMs: budget.audio.limit * 0.5,
      gpuDrawCalls: budget.gpu.drawCalls * 0.68,
      gpuTriangles: budget.gpu.triangles * 0.66,
      heapUsedMb: budget.gc.heapMb * (0.42 + (index % 11) * 0.002),
    });
  }
  return diagnostics;
}

for (const tier of Object.keys(PERFORMANCE_DEVICE_TIERS) as PerformanceDeviceTier[]) {
  const first = healthyDiagnostics(tier, 'asteroid-refinery:desktop:webgl').snapshot();
  const second = healthyDiagnostics(tier, 'asteroid-refinery:desktop:webgl').snapshot();
  assert(first.status === 'within-budget', `${tier} representative healthy baseline should remain within budget`);
  assert(first.regressions.length === 0, `${tier} healthy baseline should report no regressions`);
  assert(first.sampleCount === 180 && first.frameP95Ms != null, `${tier} baseline must expose comparable sample/frame diagnostics`);
  assert(JSON.stringify(first) === JSON.stringify(second), `${tier} identical representative samples must produce comparable deterministic diagnostics`);
}

const categories: PerformanceCategory[] = ['cpu', 'render', 'gpu', 'ui', 'animation', 'audio', 'gc'];
for (const category of categories) {
  const tier: PerformanceDeviceTier = 'midrange';
  const budget = PERFORMANCE_DEVICE_TIERS[tier].categories;
  const diagnostics = new PerformanceDiagnostics(tier, `regression-${category}`);
  for (let index = 0; index < 180; index += 1) {
    diagnostics.sample({
      frameMs: 16,
      cpuMs: category === 'cpu' ? budget.cpu.limit * 1.25 : budget.cpu.limit * 0.5,
      renderMs: category === 'render' ? budget.render.limit * 1.25 : budget.render.limit * 0.5,
      uiMs: category === 'ui' ? budget.ui.limit * 1.25 : budget.ui.limit * 0.5,
      animationMs: category === 'animation' ? budget.animation.limit * 1.25 : budget.animation.limit * 0.5,
      audioMs: category === 'audio' ? budget.audio.limit * 1.25 : budget.audio.limit * 0.5,
      gpuDrawCalls: category === 'gpu' ? budget.gpu.drawCalls * 1.25 : budget.gpu.drawCalls * 0.5,
      gpuTriangles: category === 'gpu' ? budget.gpu.triangles * 1.25 : budget.gpu.triangles * 0.5,
      heapUsedMb: category === 'gc' ? budget.gc.heapMb * 1.25 : budget.gc.heapMb * 0.45,
    });
  }
  const snapshot = diagnostics.snapshot();
  assert(snapshot.status === 'over-budget', `${category} regression should mark the scenario over budget`);
  assert(snapshot.regressions.includes(category), `${category} regression must be identified against its explicit budget`);
}

console.log(`PERFORMANCE_MEASUREMENT_PASS version=${PERFORMANCE_BUDGET_VERSION} tiers=${Object.keys(PERFORMANCE_DEVICE_TIERS).join('+')} categories=${PERFORMANCE_CATEGORIES.join('+')} scenarios=comparable regression-detection=explicit`);
