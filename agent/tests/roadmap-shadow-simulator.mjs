import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadRoadmapAdapter } from '../tools/roadmap-adapter.mjs';

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
assert.deepEqual(config.scenarios.map(scenario => scenario.taskId), ['P28-G2', 'P28-G3']);
assert.throws(
  () => validateRoadmapShadowConfig({ ...config, mode: 'enforced' }),
  /mode must remain advisory/,
  'EV-7 must reject accidental promotion in its config contract',
);

const report = await buildRoadmapShadowReport({ candidateSha: '1'.repeat(40) });
assert.equal(report.schema, 'ironshade-roadmap-shadow-simulator-report:v1');
const { roadmapTasks } = await loadRoadmapAdapter();
const futureTaskIds = new Set(roadmapTasks.slice(1).map(task => task.id));
const archivedTasks = (await readFile(resolve('docs/content-roadmap-archive.md'), 'utf8'));
const expectedIds = config.scenarios.map(scenario => scenario.taskId).filter(id => futureTaskIds.has(id));
const expectedSkipped = config.scenarios.filter(scenario => !futureTaskIds.has(scenario.taskId)).map(scenario => ({
  taskId: scenario.taskId,
  reason: roadmapTasks[0]?.id === scenario.taskId ? 'current-task' : 'archived-task',
}));
assert.equal(report.scenarioCount, expectedIds.length);
assert.deepEqual(report.summary.taskIds, expectedIds);
assert.deepEqual(report.skippedScenarios, expectedSkipped);
assert(expectedSkipped.every(scenario =>
  scenario.reason === 'current-task' || archivedTasks.includes(`- [x] **${scenario.taskId} —`)),
  'EV-7 may skip a historical shadow probe only if that product task is currently active or archived');
assert(Number.isFinite(report.summary.maximumFrictionScore) && report.summary.maximumFrictionScore >= 0);
assert.equal(report.summary.missingExtensionPointCount, 0, 'current architecture should expose the configured clean extension points');
assert.equal(report.summary.requiredBoundaryViolationCount, 0, 'current architecture should not require configured forbidden dependencies');
assert.equal(report.temporaryProbesPersisted, false);
assert.equal(report.validatedAgainstRealLaterWork, false);
assert.equal(report.acceptedForEnforcement, false);
assert.equal(report.candidatePassGranted, false);
assert.equal(report.blocking, false);

// Archived and current probes must never be credited as predictive future work.
// An unrecognized product ID remains a hard error instead of silently vanishing.
const unknownTaskConfig = structuredClone(config);
unknownTaskConfig.scenarios[1].taskId = 'P28-Z999';
await assert.rejects(
  buildRoadmapShadowReport({ candidateSha: '1'.repeat(40), config: unknownTaskConfig }),
  /is neither an active nor archived roadmap task/,
);

const spinScenario = config.scenarios[1];
const spinClean = await analyzeRoadmapShadowScenario(spinScenario);
const spinSource = await readFile(resolve('src/game/babylonSpinHabitatPresentation.ts'), 'utf8');
const coupledSpin = `import type { CombatGraphicsBackend } from './babylonCombatRenderer';\n${spinSource}`;
const spinCoupled = await analyzeRoadmapShadowScenario(spinScenario, {
  sourceOverrides: {
    'src/game/babylonSpinHabitatPresentation.ts': coupledSpin,
  },
});
assert.equal(spinClean.requiredBoundaryViolations.length, 0);
assert.equal(spinCoupled.requiredBoundaryViolations.length, 1);
assert(spinCoupled.frictionScore > spinClean.frictionScore, 'renderer back-dependency coupling must increase future friction');

const damagedScenario = config.scenarios[0];
const damagedClean = await analyzeRoadmapShadowScenario(damagedScenario);
const damagedSource = await readFile(resolve('src/game/babylonDamagedVesselPresentation.ts'), 'utf8');
const coupledDamaged = damagedSource.replace(
  'sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean)',
  'sync(state: SimState, lowVisibility: boolean)',
);
assert.notEqual(coupledDamaged, damagedSource, 'damaged-vessel integration mutation must remove the render-budget extension point');
const damagedCoupled = await analyzeRoadmapShadowScenario(damagedScenario, {
  sourceOverrides: { 'src/game/babylonDamagedVesselPresentation.ts': coupledDamaged },
});
assert.equal(damagedClean.missingExtensionPoints.length, 0);
assert.equal(damagedCoupled.missingExtensionPoints.length, 1);
assert(damagedCoupled.frictionScore > damagedClean.frictionScore, 'loss of location render-budget extension must increase advisory friction');

const broadRewriteScenario = structuredClone(spinScenario);
broadRewriteScenario.expectedSurfaces.push(
  'src/game/sim.ts',
  'src/game/campaign.ts',
  'src/game/renderQuality.ts',
);
const broadRewrite = await analyzeRoadmapShadowScenario(broadRewriteScenario);
assert.equal(broadRewrite.rewritePressure.level, 'high');
assert(broadRewrite.frictionScore > spinClean.frictionScore, 'broad rewrite pressure must score worse than a clean extension point');

const synthesized = synthesizeProbeSource(damagedScenario, '/tmp/ironshade-ev7-probe', resolve('.'));
assert.match(synthesized, /BabylonDamagedVesselPresentation/);
assert.match(synthesized, /BABYLON_DAMAGED_VESSEL_IDENTITY/);
assert.doesNotMatch(synthesized, /docs\/content-roadmap/, 'temporary integration probes must compile against implementation boundaries, not roadmap text');

const isolation = await compileRoadmapShadowProbe(damagedScenario);
assert.equal(isolation.outsideRepository, true);
assert.equal(isolation.persisted, false);
assert.equal(isolation.repositoryUnchanged, true);
assert(['passed', 'failed'].includes(isolation.status), 'probe compilation records a result without changing repository state');

const compileFailureScore = await analyzeRoadmapShadowScenario(damagedScenario, {
  compileResult: {
    status: 'failed',
    outsideRepository: true,
    persisted: false,
    diagnostics: 'synthetic probe failure',
    repositoryUnchanged: true,
  },
});
assert(compileFailureScore.frictionScore > damagedClean.frictionScore, 'probe compilation failure must increase advisory friction');

console.log(`ROADMAP_SHADOW_SIMULATOR_TEST_PASS scenarios=${report.scenarioCount} cleanDamaged=${damagedClean.frictionScore} coupledDamaged=${damagedCoupled.frictionScore} cleanSpin=${spinClean.frictionScore} coupledSpin=${spinCoupled.frictionScore} rewrite=${broadRewrite.frictionScore} isolation=${isolation.status} blocking=${report.blocking}`);
