import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  analyzeRoadmapShadowScenario,
  buildRoadmapShadowReport,
  compileRoadmapShadowProbe,
  loadRoadmapShadowConfig,
  synthesizeProbeSource,
  validateRoadmapShadowConfig,
} from '../tools/roadmap-shadow-simulator.mjs';

const config = await loadRoadmapShadowConfig();
assert.equal(config.mode, 'advisory');
assert.equal(config.scenarios.length, 2, 'EV-7 must pressure-test at least two real future roadmap tasks');
assert.deepEqual(config.scenarios.map(scenario => scenario.taskId), ['P28-PLOAD2', 'P28-G1']);
assert.throws(
  () => validateRoadmapShadowConfig({ ...config, mode: 'enforced' }),
  /mode must remain advisory/,
  'EV-7 must reject accidental promotion in its config contract',
);

const report = await buildRoadmapShadowReport({ candidateSha: '1'.repeat(40) });
assert.equal(report.schema, 'ironshade-roadmap-shadow-simulator-report:v1');
assert.equal(report.scenarioCount, 2);
assert.deepEqual(report.summary.taskIds, ['P28-PLOAD2', 'P28-G1']);
assert.equal(report.summary.missingExtensionPointCount, 0, 'current architecture should expose the configured clean extension points');
assert.equal(report.summary.requiredBoundaryViolationCount, 0, 'current architecture should not require configured forbidden dependencies');
assert.equal(report.temporaryProbesPersisted, false);
assert.equal(report.validatedAgainstRealLaterWork, false);
assert.equal(report.acceptedForEnforcement, false);
assert.equal(report.candidatePassGranted, false);
assert.equal(report.blocking, false);

const loadScenario = config.scenarios[0];
const loadClean = await analyzeRoadmapShadowScenario(loadScenario);
const backendCoreSource = await readFile(resolve('src/game/combatGraphicsBackendCore.ts'), 'utf8');
const coupledBackendCore = backendCoreSource.replace(
  'missionVisualReadiness?(): MissionVisualReadiness;',
  '// deliberately coupled: readiness is no longer visible at the shared backend boundary',
);
assert.notEqual(coupledBackendCore, backendCoreSource, 'load-readiness coupling mutation must alter the shared core extension point');
const loadCoupled = await analyzeRoadmapShadowScenario(loadScenario, {
  sourceOverrides: {
    'src/game/combatGraphicsBackendCore.ts': coupledBackendCore,
  },
});
assert.equal(loadClean.missingExtensionPoints.length, 0);
assert.equal(loadCoupled.missingExtensionPoints.length, 1);
assert(loadCoupled.frictionScore > loadClean.frictionScore, 'implementation-only coupling must increase future friction');

const orbitalScenario = config.scenarios[1];
const orbitalClean = await analyzeRoadmapShadowScenario(orbitalScenario);
const orbitalSource = await readFile(resolve('src/game/babylonOrbitalStationPresentation.ts'), 'utf8');
const coupledOrbital = `import type { CombatGraphicsBackend } from './babylonCombatRenderer';\n${orbitalSource}`;
const orbitalCoupled = await analyzeRoadmapShadowScenario(orbitalScenario, {
  sourceOverrides: {
    'src/game/babylonOrbitalStationPresentation.ts': coupledOrbital,
  },
});
assert.equal(orbitalClean.requiredBoundaryViolations.length, 0);
assert.equal(orbitalCoupled.requiredBoundaryViolations.length, 1);
assert(orbitalCoupled.frictionScore > orbitalClean.frictionScore, 'renderer back-dependency coupling must increase future friction');

const broadRewriteScenario = structuredClone(orbitalScenario);
broadRewriteScenario.expectedSurfaces.push(
  'src/game/sim.ts',
  'src/game/campaign.ts',
  'src/game/renderQuality.ts',
);
const broadRewrite = await analyzeRoadmapShadowScenario(broadRewriteScenario);
assert.equal(broadRewrite.rewritePressure.level, 'high');
assert(broadRewrite.frictionScore > orbitalClean.frictionScore, 'broad rewrite pressure must score worse than a clean extension point');

const synthesized = synthesizeProbeSource(loadScenario, '/tmp/ironshade-ev7-probe', resolve('.'));
assert.match(synthesized, /CombatGraphicsBackend/);
assert.match(synthesized, /MissionVisualReadiness/);
assert.doesNotMatch(synthesized, /docs\/content-roadmap/, 'temporary integration probes must compile against implementation boundaries, not roadmap text');

const isolation = await compileRoadmapShadowProbe(loadScenario);
assert.equal(isolation.outsideRepository, true);
assert.equal(isolation.persisted, false);
assert.equal(isolation.repositoryUnchanged, true);
assert(['passed', 'failed'].includes(isolation.status), 'probe compilation records a result without changing repository state');

const compileFailureScore = await analyzeRoadmapShadowScenario(loadScenario, {
  compileResult: {
    status: 'failed',
    outsideRepository: true,
    persisted: false,
    diagnostics: 'synthetic probe failure',
    repositoryUnchanged: true,
  },
});
assert(compileFailureScore.frictionScore > loadClean.frictionScore, 'probe compilation failure must increase advisory friction');

console.log(`ROADMAP_SHADOW_SIMULATOR_TEST_PASS scenarios=${report.scenarioCount} cleanLoad=${loadClean.frictionScore} coupledLoad=${loadCoupled.frictionScore} cleanOrbital=${orbitalClean.frictionScore} coupledOrbital=${orbitalCoupled.frictionScore} rewrite=${broadRewrite.frictionScore} isolation=${isolation.status} blocking=${report.blocking}`);
