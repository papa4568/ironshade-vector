import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertDeclaredBehavior,
  compareBehavioralGenomes,
  createBehavioralGenome,
} from '../tools/behavioral-genome.mjs';

const config = JSON.parse(await readFile(new URL('../behavioral-genome.config.json', import.meta.url), 'utf8'));
const baseObservations = {
  schema: 'ironshade-behavior-observations:v1',
  route: 'ev3-representative-route-v1',
  domains: {
    simulation: {
      time: 2.0000004,
      player: { x: 420.0004, y: 540, hp: 100, armor: 60, capacitor: 100, currentWeapon: 'carbine' },
      activeEnemies: 8,
      activeHazards: 0,
      telemetry: { kills: 0, damageDealt: 0, damageTaken: 0 },
    },
    mission: {
      contract: { location: 'orbital-station', objectiveMode: 'machinery-recovery', seed: 101 },
      elapsed: 10.0000004,
      deepElapsed: 0,
      deep: false,
      reinforcementsReleased: false,
      gridTriggered: false,
      pressureTriggered: false,
      gravityTriggered: false,
    },
    presentation: {
      high: { tierName: 'high', pixelRatioScale: 1, detailScale: 1, shadows: true },
      pressure: { tierName: 'performance', pixelRatioScale: 0.68, detailScale: 0.5, shadows: false },
      selectedAsset: { id: 'operator-meridian-lod2', lod: 2 },
    },
    load: {
      selectedAssetId: 'operator-meridian-lod2',
      selectedLod: 2,
      loadCount: 1,
      firstReady: true,
      secondReady: true,
      cachedAssets: 1,
      loadDurationMs: 18.472,
    },
    resources: {
      peakActiveInstances: 2,
      peakNativeMeshInstances: 6,
      activeAfterOneRelease: 1,
      activeAfterAllRelease: 0,
      nativeAfterAllRelease: 0,
      cachedCompressedBytes: 600000,
    },
    performance: {
      high: { rawFrameMs: 16.7004, smoothedFrameMs: 16.7004, tier: 'high', transitionCount: 0 },
      pressure: { rawFrameMs: 160.004, smoothedFrameMs: 144.119, tier: 'performance', transition: 'high->performance', transitionCount: 1 },
    },
  },
};

const repeatObservations = structuredClone(baseObservations);
repeatObservations.domains.load.loadDurationMs = 91.008;
repeatObservations.domains.simulation.time = 2.0000001;
repeatObservations.domains.simulation.player.x = 420.0001;
repeatObservations.domains.performance.pressure.smoothedFrameMs = 144.121;

const base = createBehavioralGenome(baseObservations, config, { candidateSha: 'a'.repeat(40) });
const repeat = createBehavioralGenome(repeatObservations, config, { candidateSha: 'a'.repeat(40) });
assert.equal(repeat.rootDigest, base.rootDigest, 'unchanged deterministic behavior must produce the same genome despite excluded/normalized noise');
assert.notEqual(repeat.observationsSha256, base.observationsSha256, 'raw observation identity should still expose that the noisy captures differed');
const repeatComparison = compareBehavioralGenomes(base, repeat, { declaredDomains: [] });
assert.equal(repeatComparison.status, 'pass', 'repeat route capture must compare cleanly');
assert.deepEqual(repeatComparison.changedDomains, [], 'repeat route capture must not create semantic domain deltas');
assertDeclaredBehavior(repeatComparison);

const rendererLoadObservations = structuredClone(baseObservations);
rendererLoadObservations.domains.presentation.pressure.detailScale = 0.42;
rendererLoadObservations.domains.presentation.selectedAsset = { id: 'operator-meridian-lod1', lod: 1 };
rendererLoadObservations.domains.load.selectedAssetId = 'operator-meridian-lod1';
rendererLoadObservations.domains.load.selectedLod = 1;
const rendererLoad = createBehavioralGenome(rendererLoadObservations, config, { candidateSha: 'b'.repeat(40) });
const declaredChange = compareBehavioralGenomes(base, rendererLoad, { declaredDomains: ['presentation', 'load'] });
assert.equal(declaredChange.status, 'pass', 'declared renderer/loading changes must remain explainable');
assert.deepEqual(declaredChange.changedDomains, ['load', 'presentation'], 'renderer/loading change must alter only the declared presentation/load branches');
assert.deepEqual(declaredChange.unexplainedDomains, [], 'declared renderer/loading change must not leak into other domains');
assertDeclaredBehavior(declaredChange);

const simulationMutationObservations = structuredClone(rendererLoadObservations);
simulationMutationObservations.domains.simulation.player.hp = 91;
const simulationMutation = createBehavioralGenome(simulationMutationObservations, config, { candidateSha: 'c'.repeat(40) });
const unexplained = compareBehavioralGenomes(base, simulationMutation, { declaredDomains: ['presentation', 'load'] });
assert.equal(unexplained.status, 'fail', 'unexplained simulation changes must fail comparison');
assert.deepEqual(unexplained.unexplainedDomains, ['simulation'], 'simulation mutation must identify the unexplained simulation branch');
assert.throws(() => assertDeclaredBehavior(unexplained), /unexplained behavioral genome delta: simulation/, 'enforcement helper must reject unexplained simulation drift');

assert.throws(
  () => createBehavioralGenome(baseObservations, config, { candidateSha: 'not-a-sha' }),
  /candidateSha must be a full lowercase commit SHA/,
  'genome evidence must require an exact candidate SHA',
);
assert.equal(base.acceptedForEnforcement, false, 'EV-3 must remain advisory');
assert.equal(base.candidatePassGranted, false, 'EV-3 must never grant candidate acceptance while advisory');
assert.deepEqual(Object.keys(base.domains).sort(), ['load', 'mission', 'performance', 'presentation', 'resources', 'simulation'], 'EV-3 must fingerprint all required behavior families');

console.log('BEHAVIORAL_GENOME_PASS repeat=stable declared=presentation+load unexplained-simulation=rejected noise=excluded+normalized exact-sha=bound mode=advisory');
