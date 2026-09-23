export const BOOT_DIAGNOSTICS_VERSION = 'p16-d-v1';

export type BootStage =
  | 'entry'
  | 'recovery-module-ready'
  | 'recovery-complete'
  | 'recovery-blocked'
  | 'app-module-ready'
  | 'app-render-requested'
  | 'first-frame'
  | 'startup-failed';

export type BootStageTiming = {
  stage: BootStage;
  atMs: number;
  durationMs: number;
};

export type BootDiagnosticReport = {
  version: typeof BOOT_DIAGNOSTICS_VERSION;
  totalMs: number;
  stages: BootStageTiming[];
};

type Clock = () => number;

function defaultClock() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

function cloneReport(stages: BootStageTiming[]): BootDiagnosticReport {
  const copied = stages.map(stage => ({ ...stage }));
  return {
    version: BOOT_DIAGNOSTICS_VERSION,
    totalMs: copied.at(-1)?.atMs ?? 0,
    stages: copied,
  };
}

export function createBootDiagnostics(clock: Clock = defaultClock) {
  const startedAt = clock();
  let previousAt = startedAt;
  const stages: BootStageTiming[] = [];

  return {
    mark(stage: BootStage) {
      const measuredAt = clock();
      const atMs = Math.max(0, measuredAt - startedAt);
      const durationMs = Math.max(0, measuredAt - previousAt);
      previousAt = measuredAt;
      stages.push({ stage, atMs, durationMs });
      return cloneReport(stages);
    },
    report() {
      return cloneReport(stages);
    },
  };
}

export function publishBootDiagnostics(report: BootDiagnosticReport) {
  const latest = report.stages.at(-1);

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.bootDiagnosticsVersion = report.version;
    root.dataset.bootStage = latest?.stage ?? 'pending';
    root.dataset.bootTotalMs = report.totalMs.toFixed(1);
    root.dataset.bootReport = JSON.stringify(report);
  }

  if (typeof window !== 'undefined') {
    (window as Window & { __IRONSHADE_BOOT_DIAGNOSTICS__?: BootDiagnosticReport }).__IRONSHADE_BOOT_DIAGNOSTICS__ = report;
  }
}
