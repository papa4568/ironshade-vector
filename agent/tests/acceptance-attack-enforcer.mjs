import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  evaluateAcceptanceAttackEnforcement,
  runRegisteredAcceptanceAttack,
  validateAcceptanceAttackPolicy,
} from '../tools/acceptance-attack-enforcer.mjs';
import { loadCandidateTask } from '../tools/candidate-evidence.mjs';
import { selectExperimentalReviewTask } from '../tools/experimental-review-task.mjs';

const policy = validateAcceptanceAttackPolicy(JSON.parse(await readFile('agent/acceptance-attack-policy.json', 'utf8')));
assert.deepEqual(policy.enforcedTemplates, ['hidden-serialization']);
assert.equal(policy.registrations.length, 1);

const roadmapRaw = await readFile('docs/experimental-verification-roadmap.md', 'utf8');
const activeExperimental = selectExperimentalReviewTask(roadmapRaw);
assert.equal(activeExperimental?.task.id, 'EV-8', 'EV-8 must be the first executable experimental promotion');
assert.equal(activeExperimental?.mode, 'experimental');
assert.equal(activeExperimental.task.acceptance.length, 5, 'EV-8 review contract must preserve all roadmap acceptance bullets');
assert.equal(activeExperimental.task.proofs.length, 6, 'EV-8 review contract must preserve all final proof kinds');
const candidateTask = await loadCandidateTask('EV-8');
assert.equal(candidateTask.source, 'docs/experimental-verification-roadmap.md', 'EV-8 exact-candidate evidence must come from the experimental roadmap');
assert.equal(candidateTask.task.id, 'EV-8');
assert.equal(candidateTask.task.proofs.length, 6);
const closeoutRoadmap = roadmapRaw.replace(/- \[ \] \*\*EV-8[\s\S]*?(?=\n- \[ \] \*\*EV-9)/, '');
const closeoutExperimental = selectExperimentalReviewTask(closeoutRoadmap, { baseMarkdown: roadmapRaw });
assert.equal(closeoutExperimental?.task.id, 'EV-8', 'EV-8 closeout must preserve the removed base task identity');
assert.equal(closeoutExperimental?.mode, 'experimental-closeout');

const registration = policy.registrations[0];
const { report, enforcement } = await runRegisteredAcceptanceAttack({ policy, registration });
assert.equal(report.summary.total, 6);
assert.equal(report.summary.caught, 1, 'promotion calibration expects exactly the hidden-serialization dishonest variant to be caught');
assert.equal(report.summary.proofGaps, 5, 'unsupported EV-1 attack classes must remain visible as advisory proof gaps');
assert.equal(report.isolation.sourceUnchanged, true, 'disposable attack execution must not change source state');
assert.equal(report.isolation.sandboxRemoteDetached, true, 'disposable attack execution must not retain a source remote');
assert.equal(enforcement.blocking, false);
assert.equal(enforcement.verdict, 'promoted-scope-pass');
assert.equal(enforcement.measurement.honestControls, 1);
assert.equal(enforcement.measurement.falsePositives, 0);
assert.equal(enforcement.measurement.falsePositiveRate, 0);
assert.equal(enforcement.measurement.dishonestControls, 1);
assert.equal(enforcement.measurement.truePositives, 1);
assert.equal(enforcement.measurement.falseNegatives, 0);
assert.equal(enforcement.measurement.falseNegativeRate, 0);
assert.equal(enforcement.measurement.unsupportedAdvisoryAttacks, 5);
assert.equal(enforcement.measurement.unsupportedAdvisoryProofGaps, 5);
assert.equal(enforcement.candidatePassGranted, false, 'the promoted attack check never synthesizes candidate acceptance');

const missedDishonestVariant = structuredClone(report);
const hiddenSerialization = missedDishonestVariant.results.find(result => result.templateId === 'hidden-serialization');
assert(hiddenSerialization, 'fixture must contain hidden-serialization result');
hiddenSerialization.outcome = 'proof-gap';
const blocked = evaluateAcceptanceAttackEnforcement(missedDishonestVariant, policy);
assert.equal(blocked.blocking, true, 'a surviving promoted dishonest variant must block');
assert.equal(blocked.verdict, 'blocked-proof-gap');
assert.equal(blocked.measurement.falseNegatives, 1);
assert.equal(blocked.measurement.falseNegativeRate, 1);

const rollbackPolicy = { ...structuredClone(policy), enabled: false };
const rollback = evaluateAcceptanceAttackEnforcement(missedDishonestVariant, rollbackPolicy);
assert.equal(rollback.blocking, false, 'rollback must restore pre-EV-8 advisory behavior');
assert.equal(rollback.verdict, 'rollback-advisory-pass');
assert.equal(rollback.measurement.falseNegatives, 1, 'rollback must not hide the same measured proof gap');

const missingPromotedAttack = structuredClone(report);
missingPromotedAttack.results = missingPromotedAttack.results.filter(result => result.templateId !== 'hidden-serialization');
assert.throws(
  () => evaluateAcceptanceAttackEnforcement(missingPromotedAttack, policy),
  /was not exercised; refusing to under-test promoted scope/,
  'missing promoted attack execution must fail closed',
);

const sourceChanged = structuredClone(report);
sourceChanged.isolation.sourceUnchanged = false;
assert.throws(
  () => evaluateAcceptanceAttackEnforcement(sourceChanged, policy),
  /source repository must remain unchanged/,
  'source mutation must fail closed',
);

const evidenceDir = process.env.ACCEPTANCE_ATTACK_EVIDENCE_DIR;
if (evidenceDir) {
  const directory = resolve(evidenceDir);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'ev8-enforcement.json'), `${JSON.stringify({
    schema: 'ironshade-ev8-promotion-evidence:v1',
    promotion: policy.promotion,
    registration,
    measurement: enforcement.measurement,
    isolation: enforcement.isolation,
    promotedVerdict: enforcement.verdict,
    rollbackVerdict: rollback.verdict,
    syntheticSurvivorVerdict: blocked.verdict,
    candidatePassGranted: enforcement.candidatePassGranted,
  }, null, 2)}\n`);
}

console.log('ACCEPTANCE_ATTACK_ENFORCER_REGRESSIONS_PASS promoted=hidden-serialization fp=0/1 fn=0/1 advisoryProofGaps=5 rollback=advisory isolation=source-unchanged+remote-detached exactCandidate=EV-8 failClosed=missing-attack+source-mutation');
