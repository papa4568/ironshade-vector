import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { selectAffectedVerification } from '../tools/select-affected-verification.mjs';
import { calibrateImpactWidening, validateImpactWideningContract } from '../tools/impact-widening-promotion.mjs';

const impactMap = JSON.parse(await readFile(resolve('agent/impact-map.json'), 'utf8'));
const corpus = JSON.parse(await readFile(resolve('agent/impact-calibration-corpus.json'), 'utf8'));
const corpusGitBlobSha = execFileSync('git', ['hash-object', 'agent/impact-calibration-corpus.json'], { encoding: 'utf8' }).trim();
const promotion = impactMap.rules.find(rule => rule.promotion?.taskId === 'EV-16')?.promotion;
assert(promotion, 'EV-16 promotion metadata must exist');
const baselineMap = JSON.parse(execFileSync('git', ['cat-file', '-p', promotion.sourceImpactMapGitBlobSha], { encoding: 'utf8' }));

const contract = validateImpactWideningContract({ impactMap, baselineMap, corpus, corpusGitBlobSha });
assert.equal(contract.rule.id, 'ui-and-design-system');
assert.equal(contract.decision.falsePositives, 0);
assert.equal(contract.decision.falseNegatives, 0);

const calibration = calibrateImpactWidening({ impactMap, baselineMap, corpus });
assert.equal(calibration.falsePositives, 0);
assert.equal(calibration.falseNegatives, 0);
assert.equal(calibration.rollbackPass, true);
assert.equal(calibration.pass, true);

const active = selectAffectedVerification(['src/components/UiPrimitives.tsx'], impactMap, { env: {} });
assert.equal(active.mode, 'full');
assert.deepEqual(active.verifications.map(entry => entry.id), ['verify-full']);
const rollback = selectAffectedVerification(['src/components/UiPrimitives.tsx'], impactMap, {
  env: { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' },
});
assert.equal(rollback.mode, 'targeted');
assert.deepEqual(rollback.verifications.map(entry => entry.id), ['ui-readability', 'design-system']);

const extraPromotion = structuredClone(impactMap);
extraPromotion.rules.find(rule => rule.id === 'babylon-ability-vfx').promotion = structuredClone(promotion);
extraPromotion.rules.find(rule => rule.id === 'babylon-ability-vfx').risk = 'high';
assert.throws(
  () => validateImpactWideningContract({ impactMap: extraPromotion, baselineMap, corpus, corpusGitBlobSha }),
  /must promote exactly one impact rule/,
  'EV-16 must reject silent scope expansion',
);

const corpusDrift = structuredClone(impactMap);
corpusDrift.rules.find(rule => rule.id === 'ui-and-design-system').promotion.sourceCorpusGitBlobSha = 'f'.repeat(40);
assert.throws(
  () => validateImpactWideningContract({ impactMap: corpusDrift, baselineMap, corpus, corpusGitBlobSha }),
  /source corpus Git blob does not match/,
  'EV-16 must reject source-calibration drift',
);

const unrelatedDrift = structuredClone(impactMap);
unrelatedDrift.rules.find(rule => rule.id === 'babylon-ability-vfx').risk = 'high';
assert.throws(
  () => validateImpactWideningContract({ impactMap: unrelatedDrift, baselineMap, corpus, corpusGitBlobSha }),
  /changed unpromoted impact rule/,
  'EV-16 must reject unrelated impact-map changes inside the promotion contract',
);

console.log(`EV16_IMPACT_WIDENING_TEST_PASS rule=${contract.rule.id} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} rollback=${calibration.rollbackPass} scope=single-rule`);
