import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import {
  evaluateAcceptanceAttackScope,
  runAcceptanceAttackGate,
  validateAcceptanceAttackPolicy,
} from '../tools/acceptance-attack-gate.mjs';

const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const policy = validateAcceptanceAttackPolicy(JSON.parse(await readFile('agent/acceptance-attack-policy.json', 'utf8')));
assert.equal(policy.enforcementEnabled, true, 'EV-8 policy must enable the measured promoted scope by default');
assert.equal(policy.scopes.length, 1, 'EV-8 must promote only the measured deterministic subset');
const [scope] = policy.scopes;
assert.deepEqual(scope.enforcedTemplateIds, ['hidden-serialization'], 'unsupported EV-1 templates must remain advisory');
assert.equal(scope.calibration.promotedFalsePositiveBudget, 0);
assert.equal(scope.calibration.promotedFalseNegativeBudget, 0);

const gate = await runAcceptanceAttackGate({ candidateSha });
assert.equal(gate.schema, 'ironshade-acceptance-attack-gate:v1');
assert.equal(gate.candidateSha, candidateSha, 'gate evidence must bind to the exact repository HEAD');
assert.equal(gate.mode, 'enforced');
assert.equal(gate.enforcementEnabled, true);
assert.equal(gate.verdict, 'pass');
assert.equal(gate.blocking, false);
assert.equal(gate.candidatePassGranted, false, 'the attack gate may block but must never synthesize candidate acceptance');
assert.equal(gate.scopes.length, 1);
const [result] = gate.scopes;
assert.equal(result.sourceHead, candidateSha, 'attack exercise source head must equal the exact candidate SHA');
assert.equal(result.pass, true);
assert.deepEqual(result.enforcedTemplateIds, ['hidden-serialization']);
assert.deepEqual(result.enforcedResults, [
  {
    templateId: 'hidden-serialization',
    outcome: 'caught',
    criterionId: 'P28-PLOAD1:criterion:1',
  },
]);
assert.deepEqual(result.calibration.promoted, {
  falsePositiveTrials: 1,
  falsePositives: 0,
  falsePositiveRate: 0,
  falseNegativeTrials: 1,
  falseNegatives: 0,
  falseNegativeRate: 0,
});
assert.equal(result.fullShadowSummary.total, 6, 'all EV-1 variants must remain visible in shadow evidence');
assert.equal(result.fullShadowSummary.caught, 1);
assert.equal(result.fullShadowSummary.proofGaps, 5);
assert.deepEqual(
  result.advisory.survivors,
  ['fake-telemetry', 'false-readiness', 'omitted-resource-work', 'skipped-quality-work', 'special-cased-test-route'],
  'unsupported dishonest variants must stay advisory instead of becoming accidental blockers',
);
assert.equal(result.isolation.sourceUnchanged, true);
assert.equal(result.isolation.sandboxRemoteDetached, true);

const simulatedSurvivor = evaluateAcceptanceAttackScope({
  taskId: scope.taskId,
  baseline: { exitCode: 0 },
  isolation: { sourceUnchanged: true, sandboxRemoteDetached: true },
  results: [
    {
      templateId: 'hidden-serialization',
      outcome: 'proof-gap',
      criterionId: 'P28-PLOAD1:criterion:1',
    },
  ],
}, scope);
assert.equal(simulatedSurvivor.pass, false, 'a surviving promoted dishonest mutation must fail closed');
assert.equal(simulatedSurvivor.calibration.promoted.falseNegatives, 1);
assert.match(simulatedSurvivor.blockingReasons.join('\n'), /false negatives 1 exceed budget 0/);

assert.throws(
  () => evaluateAcceptanceAttackScope({
    taskId: scope.taskId,
    baseline: { exitCode: 0 },
    isolation: { sourceUnchanged: true, sandboxRemoteDetached: true },
    results: [
      {
        templateId: 'fake-telemetry',
        outcome: 'proof-gap',
        criterionId: 'P28-PLOAD1:criterion:1',
      },
    ],
  }, scope),
  /enforced template hidden-serialization was not exercised/,
  'missing promoted mutations must fail closed instead of being treated as a pass',
);

const rollback = await runAcceptanceAttackGate({ candidateSha, enforcementOverride: false });
assert.equal(rollback.mode, 'advisory-rollback');
assert.equal(rollback.enforcementEnabled, false);
assert.equal(rollback.verdict, 'disabled-advisory');
assert.equal(rollback.blocking, false);
assert.equal(rollback.rollback.restoresAdvisoryBehavior, true);
assert.equal(rollback.candidatePassGranted, false);
assert.equal(rollback.scopes[0].fullShadowSummary.total, 6, 'rollback must retain the pre-promotion shadow exercise');
assert.equal(rollback.scopes[0].sourceHead, candidateSha);

assert.throws(
  () => validateAcceptanceAttackPolicy({ ...policy, scopes: [{ ...scope, enforcedTemplateIds: [] }] }),
  /enforcedTemplateIds must be non-empty/,
  'an empty promoted scope must fail closed',
);
assert.throws(
  () => validateAcceptanceAttackPolicy({
    ...policy,
    scopes: [{
      ...scope,
      calibration: { ...scope.calibration, promotedFalseNegativeBudget: 1 },
    }],
  }),
  /promoted false-negative budget must be zero/,
  'promotion policy must not relax the zero false-negative requirement',
);

console.log(`ACCEPTANCE_ATTACK_PROMOTION_REGRESSIONS_PASS candidate=${candidateSha} scope=${scope.id} falsePositives=0/1 falseNegatives=0/1 advisorySurvivors=${result.advisory.survivors.length} rollback=advisory sourceUnchanged=true remoteDetached=true`);
