import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MAP_LOAD_PHASES,
  MAP_LOAD_REGRESSION_ROUTES,
  MAP_LOAD_TIMING_CAVEAT,
  MapLoadReadinessTelemetry,
} from '../src/game/mapLoadReadinessTelemetry';
import { resolveMissionVisualReadiness } from '../src/game/babylonRefineryMissionReadiness';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function phaseOrder(signature: string) {
  const fields = signature.split('|');
  return fields
    .map(field => field.slice(0, field.indexOf(':')))
    .filter((field): field is (typeof MAP_LOAD_PHASES)[number] => MAP_LOAD_PHASES.includes(field as (typeof MAP_LOAD_PHASES)[number]));
}

const tracker = new MapLoadReadinessTelemetry();
const cold = tracker.begin({
  missionKey: 'deep-salvage:101',
  route: 'asteroid-refinery',
  objectiveMode: 'deep-salvage',
  backendReadyMs: 14.25,
  criticalAssetsAlreadyReady: false,
  now: 100,
});
assert(cold.entryMode === 'cold', 'P28-PLOAD2 first Deep Salvage refinery entry must be classified as cold');
assert(cold.phases['backend-ready'] === 'ready', 'P28-PLOAD2 cold entry must retain backend-ready as the first phase');
assert(cold.phases['family-preload-decode'] === 'pending', 'P28-PLOAD2 cold refinery entry must wait for family preload/decode');
assert(cold.phases['placement-instantiation'] === 'pending', 'P28-PLOAD2 cold refinery entry must wait for placement instantiation');
assert(cold.phases['mapped-world-ready'] === 'pending', 'P28-PLOAD2 cold refinery entry must wait for mapped world objects');
assert(cold.phases['mission-visual-ready'] === 'pending', 'P28-PLOAD2 cold refinery entry must not begin playable');

const earlyShell = resolveMissionVisualReadiness({
  refinery: true,
  elapsedMs: 80,
  environmentState: 'loading',
  environmentError: undefined,
  worldState: 'ready',
  mappedCount: 4,
  authoredCount: 4,
  fallbackCount: 0,
});
assert(earlyShell.phase === 'loading', 'P28-PLOAD2 Deep Salvage cannot become playable while the authored refinery shell is still loading');
const earlyWorld = resolveMissionVisualReadiness({
  refinery: true,
  elapsedMs: 100,
  environmentState: 'ready',
  environmentError: undefined,
  worldState: 'ready',
  mappedCount: 4,
  authoredCount: 3,
  fallbackCount: 0,
});
assert(earlyWorld.phase === 'loading', 'P28-PLOAD2 Deep Salvage cannot become playable before mapped world objects settle');

tracker.recordMeasured('family-preload-decode', 18.5);
tracker.recordMeasured('placement-instantiation', 42.25);
tracker.recordElapsed('mapped-world-ready', 180);
tracker.completeMission(190, false);
const coldReady = tracker.snapshot();
assert(coldReady, 'P28-PLOAD2 cold profile must remain available after readiness');
assert(
  coldReady.phaseSignature === 'p28-pload2-v1|route:asteroid-refinery|objective:deep-salvage|entry:cold|backend-ready:ready|family-preload-decode:ready|placement-instantiation:ready|mapped-world-ready:ready|mission-visual-ready:ready',
  `P28-PLOAD2 cold Deep Salvage signature changed: ${coldReady.phaseSignature}`,
);
assert(
  coldReady.timingSignature === 'diagnostic-ms:p28-pload2-v1|backend-ready:14.25|family-preload-decode:18.50|placement-instantiation:42.25|mapped-world-ready:80.00|mission-visual-ready:90.00',
  `P28-PLOAD2 deterministic timing harness changed: ${coldReady.timingSignature}`,
);

const duplicate = tracker.begin({
  missionKey: 'deep-salvage:101',
  route: 'asteroid-refinery',
  objectiveMode: 'deep-salvage',
  backendReadyMs: 99,
  criticalAssetsAlreadyReady: false,
  now: 999,
});
assert(duplicate.generation === coldReady.generation, 'P28-PLOAD2 repeated render frames for one mission must not create redundant map-load generations');

const warm = tracker.begin({
  missionKey: 'deep-salvage:102',
  route: 'asteroid-refinery',
  objectiveMode: 'deep-salvage',
  backendReadyMs: 999,
  criticalAssetsAlreadyReady: true,
  now: 200,
});
assert(warm.entryMode === 'repeat', 'P28-PLOAD2 same-route re-entry must be classified separately from cold entry');
assert(warm.phases['backend-ready'] === 'reused' && warm.timings['backend-ready'] === 0, 'P28-PLOAD2 repeat entry must expose backend reuse instead of inventing a new backend load');
assert(
  warm.phases['family-preload-decode'] === 'reused'
    && warm.phases['placement-instantiation'] === 'reused'
    && warm.timings['family-preload-decode'] === 0
    && warm.timings['placement-instantiation'] === 0,
  'P28-PLOAD2 same-route warm entry must expose retained critical refinery assets without redundant reload work',
);
tracker.recordElapsed('mapped-world-ready', 206);
tracker.completeMission(208, false);
const warmReady = tracker.snapshot();
assert(warmReady?.timingSignature.includes('mission-visual-ready:8.00'), 'P28-PLOAD2 repeat entry must measure readiness independently from the cold profile');

const switched = tracker.begin({
  missionKey: 'harvester:201',
  route: 'jovian-harvester',
  objectiveMode: 'deep-salvage',
  backendReadyMs: 999,
  criticalAssetsAlreadyReady: false,
  now: 300,
});
assert(switched.entryMode === 'cold', 'P28-PLOAD2 first representative detailed-route visit must be cold for that route');
assert(
  switched.phases['family-preload-decode'] === 'not-applicable'
    && switched.phases['placement-instantiation'] === 'not-applicable'
    && switched.phases['mapped-world-ready'] === 'pending',
  'P28-PLOAD2 non-refinery detailed routes must preserve the common phase schema while refinery-only work is explicitly not applicable',
);
const nonRefineryEarly = resolveMissionVisualReadiness({
  refinery: false,
  elapsedMs: 30,
  environmentState: undefined,
  environmentError: undefined,
  worldState: 'loading',
  mappedCount: 0,
  authoredCount: 0,
  fallbackCount: 0,
});
assert(nonRefineryEarly.phase === 'loading', 'P28-PLOAD2 representative routes must not become playable before their world presentation is ready');
const nonRefineryTimeout = resolveMissionVisualReadiness({
  refinery: false,
  elapsedMs: 60_000,
  environmentState: undefined,
  environmentError: undefined,
  worldState: 'loading',
  mappedCount: 0,
  authoredCount: 0,
  fallbackCount: 0,
});
assert(
  nonRefineryTimeout.phase === 'ready' && nonRefineryTimeout.mode === 'fallback',
  'P28-PLOAD2 representative routes must expose the existing timeout fallback as a terminal readiness result',
);
tracker.completeMission(60_300, true);
const nonRefineryFallback = tracker.snapshot();
assert(
  nonRefineryFallback?.phases['mapped-world-ready'] === 'fallback'
    && nonRefineryFallback.phases['mission-visual-ready'] === 'fallback'
    && !nonRefineryFallback.phaseSignature.includes(':pending'),
  `P28-PLOAD2 timeout fallback must complete every applicable phase instead of publishing a playable pending signature: ${nonRefineryFallback?.phaseSignature}`,
);

const repeatAfterRouteSwitch = tracker.begin({
  missionKey: 'deep-salvage:103',
  route: 'asteroid-refinery',
  objectiveMode: 'deep-salvage',
  backendReadyMs: 999,
  criticalAssetsAlreadyReady: false,
  now: 60_400,
});
assert(repeatAfterRouteSwitch.entryMode === 'repeat', 'P28-PLOAD2 returning to Deep Salvage after another route must remain a repeat profile');
assert(
  repeatAfterRouteSwitch.phases['family-preload-decode'] === 'pending'
    && repeatAfterRouteSwitch.phases['placement-instantiation'] === 'pending',
  'P28-PLOAD2 repeat entry after route teardown must make cache/reload churn visible instead of pretending the shell stayed mounted',
);

for (const [index, profile] of MAP_LOAD_REGRESSION_ROUTES.entries()) {
  const routeTracker = new MapLoadReadinessTelemetry();
  const snapshot = routeTracker.begin({
    missionKey: `route-harness:${index}`,
    route: profile.route,
    objectiveMode: profile.objectiveMode,
    backendReadyMs: 5,
    criticalAssetsAlreadyReady: false,
    now: 0,
  });
  assert(
    phaseOrder(snapshot.phaseSignature).join('|') === MAP_LOAD_PHASES.join('|'),
    `P28-PLOAD2 ${profile.route} must emit the same ordered map-load phase schema`,
  );
}
assert(MAP_LOAD_TIMING_CAVEAT.includes('not-physical-phone-acceptance'), 'P28-PLOAD2 timing evidence must remain explicitly diagnostic rather than emulator/desktop FPS acceptance');

const root = process.cwd();
const rendererSource = readFileSync(resolve(root, 'src/game/babylonCombatRenderer.ts'), 'utf8');
const worldSource = readFileSync(resolve(root, 'src/game/babylonWorldPresentation.ts'), 'utf8');
const readinessSource = readFileSync(resolve(root, 'src/game/babylonRefineryMissionReadiness.ts'), 'utf8');
const coreSource = readFileSync(resolve(root, 'src/game/combatGraphicsBackendCore.ts'), 'utf8');
assert(
  coreSource.includes('mapLoadBackendReadyMs')
    && rendererSource.includes('mapLoadFamilyPreloadMs')
    && rendererSource.includes('mapLoadPlacementInstantiationMs'),
  'P28-PLOAD2 runtime must publish backend, family preload/decode, and placement-instantiation timing inputs',
);
assert(
  rendererSource.includes('if (signature === this.refineryEnvironmentSignature) return;')
    && rendererSource.includes('Promise.allSettled(batch.map(task => runtime.instantiate(task.spec)))'),
  'P28-PLOAD2 regressions must retain same-signature deduplication and bounded placement work instead of serialized/redundant reloads',
);
assert(
  worldSource.includes('current?.assetId === spec.id || this.refineryObjectRequests.get(object.id) === spec.id'),
  'P28-PLOAD2 mapped-world readiness must retain object/spec request deduplication during repeated render frames',
);
assert(
  readinessSource.includes("if (resolved.phase === 'ready' && resolved.mode === 'authored')")
    && readinessSource.includes("this.visualGate.block('authored-assets')")
    && readinessSource.includes("this.mapLoadTelemetry.completeMission(now, resolved.mode === 'fallback')"),
  'P28-PLOAD2 playable-state gating and final readiness timing must share the same resolved visual-readiness decision',
);

console.log('P28_PLOAD2_MAP_LOAD_READINESS_PASS cold+repeat=separate phase-order=stable playable-gate=critical-visuals fallback-signature=terminal timing=diagnostic-only routes=asteroid-refinery,spin-habitat,jovian-harvester');
