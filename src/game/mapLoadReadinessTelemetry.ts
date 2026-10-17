import type { LocationId, ObjectiveMode } from './campaign';

export const MAP_LOAD_PHASE_SIGNATURE_VERSION = 'p28-pload2-v1';
export const MAP_LOAD_TIMING_CAVEAT = 'diagnostic-ms-not-physical-phone-acceptance';
export const MAP_LOAD_PHASES = [
  'backend-ready',
  'family-preload-decode',
  'placement-instantiation',
  'mapped-world-ready',
  'mission-visual-ready',
] as const;

export type MapLoadPhase = (typeof MAP_LOAD_PHASES)[number];
export type MapLoadPhaseState = 'pending' | 'ready' | 'reused' | 'fallback' | 'not-applicable';
export type MapLoadEntryMode = 'cold' | 'repeat';

export const MAP_LOAD_REGRESSION_ROUTES = [
  { route: 'asteroid-refinery', objectiveMode: 'deep-salvage' },
  { route: 'spin-habitat', objectiveMode: 'gravity-stabilization' },
  { route: 'jovian-harvester', objectiveMode: 'deep-salvage' },
] as const satisfies ReadonlyArray<{ route: LocationId; objectiveMode: ObjectiveMode }>;

type ActiveMapLoad = {
  generation: number;
  missionKey: string;
  route: LocationId;
  objectiveMode: ObjectiveMode;
  entryMode: MapLoadEntryMode;
  startedAt: number;
  phases: Record<MapLoadPhase, MapLoadPhaseState>;
  timings: Record<MapLoadPhase, number | null>;
};

export type MapLoadTelemetrySnapshot = Omit<ActiveMapLoad, 'startedAt'> & {
  phaseSignature: string;
  timingSignature: string;
};

function blankPhases(): Record<MapLoadPhase, MapLoadPhaseState> {
  return {
    'backend-ready': 'pending',
    'family-preload-decode': 'pending',
    'placement-instantiation': 'pending',
    'mapped-world-ready': 'pending',
    'mission-visual-ready': 'pending',
  };
}

function blankTimings(): Record<MapLoadPhase, number | null> {
  return {
    'backend-ready': null,
    'family-preload-decode': null,
    'placement-instantiation': null,
    'mapped-world-ready': null,
    'mission-visual-ready': null,
  };
}

function finiteMs(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export class MapLoadReadinessTelemetry {
  private readonly seenRoutes = new Set<LocationId>();
  private generation = 0;
  private active: ActiveMapLoad | null = null;

  begin(input: {
    missionKey: string;
    route: LocationId;
    objectiveMode: ObjectiveMode;
    backendReadyMs: number;
    criticalAssetsAlreadyReady: boolean;
    now: number;
  }): MapLoadTelemetrySnapshot {
    if (this.active?.missionKey === input.missionKey) return this.snapshot()!;

    const phases = blankPhases();
    const timings = blankTimings();
    const entryMode: MapLoadEntryMode = this.seenRoutes.has(input.route) ? 'repeat' : 'cold';
    this.seenRoutes.add(input.route);
    this.generation += 1;

    phases['backend-ready'] = this.generation === 1 ? 'ready' : 'reused';
    timings['backend-ready'] = this.generation === 1 ? finiteMs(input.backendReadyMs) : 0;

    if (input.route !== 'asteroid-refinery') {
      phases['family-preload-decode'] = 'not-applicable';
      phases['placement-instantiation'] = 'not-applicable';
    } else if (input.criticalAssetsAlreadyReady) {
      phases['family-preload-decode'] = 'reused';
      phases['placement-instantiation'] = 'reused';
      timings['family-preload-decode'] = 0;
      timings['placement-instantiation'] = 0;
    }

    this.active = {
      generation: this.generation,
      missionKey: input.missionKey,
      route: input.route,
      objectiveMode: input.objectiveMode,
      entryMode,
      startedAt: input.now,
      phases,
      timings,
    };
    return this.snapshot()!;
  }

  recordMeasured(phase: MapLoadPhase, durationMs: number, state: Extract<MapLoadPhaseState, 'ready' | 'fallback'> = 'ready') {
    if (!this.active || this.active.phases[phase] !== 'pending') return;
    this.active.phases[phase] = state;
    this.active.timings[phase] = finiteMs(durationMs);
  }

  recordElapsed(phase: MapLoadPhase, now: number, state: Extract<MapLoadPhaseState, 'ready' | 'fallback'> = 'ready') {
    if (!this.active || this.active.phases[phase] !== 'pending') return;
    this.recordMeasured(phase, now - this.active.startedAt, state);
  }

  completeMission(now: number, fallback: boolean) {
    if (!this.active) return;
    if (fallback) {
      if (this.active.route === 'asteroid-refinery') {
        for (const phase of ['family-preload-decode', 'placement-instantiation'] as const) {
          this.recordElapsed(phase, now, 'fallback');
        }
      }
      this.recordElapsed('mapped-world-ready', now, 'fallback');
    }
    this.recordElapsed('mission-visual-ready', now, fallback ? 'fallback' : 'ready');
  }

  snapshot(): MapLoadTelemetrySnapshot | null {
    const active = this.active;
    if (!active) return null;
    const phaseSignature = [
      MAP_LOAD_PHASE_SIGNATURE_VERSION,
      `route:${active.route}`,
      `objective:${active.objectiveMode}`,
      `entry:${active.entryMode}`,
      ...MAP_LOAD_PHASES.map(phase => `${phase}:${active.phases[phase]}`),
    ].join('|');
    const timingSignature = [
      `diagnostic-ms:${MAP_LOAD_PHASE_SIGNATURE_VERSION}`,
      ...MAP_LOAD_PHASES.map(phase => {
        const state = active.phases[phase];
        if (state === 'not-applicable') return `${phase}:na`;
        if (state === 'pending') return `${phase}:pending`;
        return `${phase}:${finiteMs(active.timings[phase] ?? 0).toFixed(2)}`;
      }),
    ].join('|');
    return {
      generation: active.generation,
      missionKey: active.missionKey,
      route: active.route,
      objectiveMode: active.objectiveMode,
      entryMode: active.entryMode,
      phases: { ...active.phases },
      timings: { ...active.timings },
      phaseSignature,
      timingSignature,
    };
  }
}

export function publishMapLoadReadinessTelemetry(canvas: HTMLCanvasElement, snapshot: MapLoadTelemetrySnapshot) {
  canvas.dataset.mapLoadGeneration = String(snapshot.generation);
  canvas.dataset.mapLoadMissionKey = snapshot.missionKey;
  canvas.dataset.mapLoadRoute = snapshot.route;
  canvas.dataset.mapLoadObjectiveMode = snapshot.objectiveMode;
  canvas.dataset.mapLoadEntryMode = snapshot.entryMode;
  canvas.dataset.mapLoadPhaseSignature = snapshot.phaseSignature;
  canvas.dataset.mapLoadPhaseTiming = snapshot.timingSignature;
  canvas.dataset.mapLoadTimingCaveat = MAP_LOAD_TIMING_CAVEAT;

  const root = canvas.closest<HTMLElement>('.game-root');
  if (!root) return;
  root.dataset.mapLoadGeneration = String(snapshot.generation);
  root.dataset.mapLoadRoute = snapshot.route;
  root.dataset.mapLoadEntryMode = snapshot.entryMode;
  root.dataset.mapLoadPhaseSignature = snapshot.phaseSignature;
  root.dataset.mapLoadPhaseTiming = snapshot.timingSignature;
}
