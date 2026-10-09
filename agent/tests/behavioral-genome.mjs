import assert from 'node:assert/strict';
import {
  BEHAVIOR_DOMAINS,
  assertExplainedBehavioralDelta,
  buildBehavioralGenome,
  compareBehavioralGenomes,
} from '../tools/behavioral-genome.mjs';

const candidateSha = 'a'.repeat(40);
const baseObservations = {
  schema: 'ironshade-behavior-observations:v1',
  routeId: 'ev3-core-route-v1',
  excludedObservations: [
    { path: 'rendererState.wallClockMs', reason: 'host scheduling is nondeterministic and is not semantic behavior' },
  ],
  domains: {
    simulation: { time: 2, playerHp: 100, activeEnemies: 8, trace: [{ t: 1, x: 250.00001, y: 540 }] },
    missionProgression: { contracts: ['orbital-station:salvage', 'damaged-vessel:boarding'], chapter: 1 },
    rendererState: { selectedId: 'babylon', loadedId: 'webgl2', quality: 'high' },
    assetLoadReadiness: { initialBlocked: true, detail: 'authored-assets', released: true },
    resourceOwnership: { cachedAssets: 1, activeInstances: 0, disposeCount: 1 },
    performanceBands: { start: 'high', pressure: 'performance', recovery: 'high', detailScale: 0.50001 },
  },
};

const first = buildBehavioralGenome(baseObservations, { candidateSha });
const second = buildBehavioralGenome(structuredClone(baseObservations), { candidateSha });
assert.equal(first.genomeDigest, second.genomeDigest, 'unchanged deterministic observations must produce the same root genome');
for (const domain of BEHAVIOR_DOMAINS) {
  assert.equal(first.domains[domain].digest, second.domains[domain].digest, `${domain} digest must repeat deterministically`);
}
assert.equal(first.candidateSha, candidateSha, 'genome evidence must retain the exact candidate SHA');

const normalizedNoise = structuredClone(baseObservations);
normalizedNoise.domains.simulation.trace[0].x = 250.00004;
normalizedNoise.domains.performanceBands.detailScale = 0.50004;
normalizedNoise.excludedObservations[0].reason = 'different runner timing explanation remains outside the hash';
const normalizedGenome = buildBehavioralGenome(normalizedNoise, { candidateSha });
assert.equal(first.genomeDigest, normalizedGenome.genomeDigest, 'sub-precision numeric jitter and explicitly excluded noise must not weaken repeatability');

const presentationChange = structuredClone(baseObservations);
presentationChange.domains.rendererState.quality = 'balanced';
presentationChange.domains.assetLoadReadiness.detail = 'backend-fallback';
const presentationGenome = buildBehavioralGenome(presentationChange, { candidateSha: 'b'.repeat(40) });
const presentationReport = compareBehavioralGenomes(first, presentationGenome, {
  declaredDomains: ['rendererState', 'assetLoadReadiness'],
});
assert.deepEqual(
  presentationReport.changedDomains,
  ['rendererState', 'assetLoadReadiness'],
  'intentional presentation/loading change must alter only the declared presentation/load branches',
);
assertExplainedBehavioralDelta(presentationReport);

const simulationMutation = structuredClone(baseObservations);
simulationMutation.domains.simulation.playerHp = 91;
const simulationGenome = buildBehavioralGenome(simulationMutation, { candidateSha: 'c'.repeat(40) });
const unexplained = compareBehavioralGenomes(first, simulationGenome, {
  declaredDomains: ['rendererState', 'assetLoadReadiness'],
});
assert.deepEqual(unexplained.changedDomains, ['simulation'], 'injected simulation behavior must alter the simulation branch');
assert.deepEqual(unexplained.unexplainedDomains, ['simulation'], 'undeclared simulation change must remain unexplained');
assert.equal(unexplained.accepted, false, 'unexplained behavior delta must fail comparison');
assert.throws(() => assertExplainedBehavioralDelta(unexplained), /unexplained behavioral genome delta: simulation/);

const meaningfulNumericChange = structuredClone(baseObservations);
meaningfulNumericChange.domains.performanceBands.detailScale = 0.51;
const numericGenome = buildBehavioralGenome(meaningfulNumericChange, { candidateSha: 'd'.repeat(40) });
assert.notEqual(first.domains.performanceBands.digest, numericGenome.domains.performanceBands.digest, 'meaningful normalized numeric changes must alter their domain digest');

console.log(`BEHAVIORAL_GENOME_REGRESSIONS_PASS domains=${BEHAVIOR_DOMAINS.length} repeat=stable declared=presentation+load injected=simulation-fails normalization=4dp exactSha=bound`);
