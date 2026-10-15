import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { validateProofCachePolicy } from '../tools/causal-proof-cache.mjs';
import {
  evaluateClosureCalibration,
  validateProofCacheClosureCalibrationCorpus,
} from '../tools/proof-cache-closure-calibration-evidence.mjs';

const [policyRaw, corpusRaw, preflight, closedBuild, candidateWorkflow] = await Promise.all([
  readFile(resolve('agent/proof-cache.json'), 'utf8'),
  readFile(resolve('agent/proof-cache-closure-calibration-corpus.json'), 'utf8'),
  readFile(resolve('scripts/prepare-full-repository-build-proof-closed.sh'), 'utf8'),
  readFile(resolve('scripts/run-full-repository-build-proof-closed.sh'), 'utf8'),
  readFile(resolve('.github/workflows/pr-candidate.yml'), 'utf8'),
]);

const policy = validateProofCachePolicy(JSON.parse(policyRaw));
const corpus = validateProofCacheClosureCalibrationCorpus(JSON.parse(corpusRaw), policy);
assert.equal(policy.mode, 'shadow');
assert.equal(corpus.mode, 'advisory');
assert.equal(corpus.taskId, 'EV-21');
assert.equal(corpus.promotionTarget, 'EV-18');
assert.equal(corpus.proofClasses.length, 1);

const legacy = policy.proofClasses.find(entry => entry.id === 'full-repository-build');
const closed = policy.proofClasses.find(entry => entry.id === 'full-repository-build-closed');
assert.ok(legacy, 'EV-17 legacy proof class must remain available');
assert.ok(closed, 'EV-21 closed proof class must exist');
assert.deepEqual(legacy.runtimeClosure.environmentVariables, ['ImageOS', 'ImageVersion', 'VITE_API_BASE_URL']);
assert.deepEqual(closed.runtimeClosure.environmentVariables, [
  'ImageOS',
  'ImageVersion',
  'VITE_API_BASE_URL',
  'IRONSHADE_PROOF_BASE_IMAGE_REF',
  'IRONSHADE_PROOF_PREPARED_IMAGE_ID',
  'IRONSHADE_PROOF_NPM_CLI_TREE_SHA256',
  'IRONSHADE_PROOF_DOCKER_ENGINE_VERSION',
  'IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256',
]);

const proofEntry = corpus.proofClasses[0];
assert.equal(proofEntry.proofId, 'full-repository-build-closed');
assert.deepEqual(proofEntry.requiredBoundInputs.map(entry => entry.id), [
  'docker-base-image-identity',
  'prepared-toolchain-image-identity',
  'npm-cli-artifact-identity',
  'docker-engine-version',
  'installed-dependency-tree-identity',
]);
assert.deepEqual(proofEntry.eliminatedInputs.map(entry => entry.id), [
  'external-network-availability',
  'npm-registry-response-identity',
]);

assert.match(preflight, /docker pull "\$base_image"/);
assert.match(preflight, /docker build --pull=false/);
assert.match(preflight, /npm install --global npm@10\.9\.8/);
assert.match(preflight, /npm ci --ignore-scripts --no-audit --no-fund/);
assert.match(preflight, /IRONSHADE_PROOF_BASE_IMAGE_REF/);
assert.match(preflight, /IRONSHADE_PROOF_PREPARED_IMAGE_ID/);
assert.match(preflight, /IRONSHADE_PROOF_NPM_CLI_TREE_SHA256/);
assert.match(preflight, /IRONSHADE_PROOF_DOCKER_ENGINE_VERSION/);
assert.match(preflight, /IRONSHADE_PROOF_DEPENDENCY_TREE_SHA256/);
assert.match(preflight, /completed-before-cache-decision/);
assert.match(preflight, /registryResultBoundBy/);

assert.match(closedBuild, /--network none/);
assert.match(closedBuild, /npm run build 2>&1 \| tee "\$log_path"/);
assert.doesNotMatch(closedBuild, /docker pull /);
assert.doesNotMatch(closedBuild, /docker build /);
assert.doesNotMatch(closedBuild, /npm ci /);
assert.doesNotMatch(closedBuild, /npm install /);
assert.match(closedBuild, /prepared image identity changed after preflight/);
assert.match(closedBuild, /npm CLI identity changed after preflight/);
assert.match(closedBuild, /dependency tree identity changed after preflight/);

assert.match(candidateWorkflow, /--proof full-repository-build/);
assert.match(candidateWorkflow, /run: bash scripts\/run-full-repository-build-proof\.sh/);
assert.doesNotMatch(candidateWorkflow, /--proof full-repository-build-closed/);
assert.doesNotMatch(candidateWorkflow, /run: bash scripts\/run-full-repository-build-proof-closed\.sh/);

const safeTrials = [
  { kind: 'baseline', closureRelation: 'same', prediction: 'baseline', outcome: 'success', classification: 'baseline' },
  { kind: 'same-closure-control', closureRelation: 'same', prediction: 'hit', outcome: 'success', classification: 'agreement' },
  { kind: 'invalidation-control', closureRelation: 'different', prediction: 'miss', outcome: 'success', classification: 'false-miss' },
  { kind: 'invalidation-defect', closureRelation: 'different', prediction: 'miss', outcome: 'failure', classification: 'correct-invalidation' },
];
const closedAudit = {
  requiredBoundInputsClosed: true,
  missingBoundInputs: [],
  identityInvalidationControlsPass: true,
  eliminatedInputs: {
    externalNetworkAvailability: true,
    npmRegistryResponseIdentity: true,
  },
  profilesInRepositoryClosurePass: true,
  authoritativeProducerUnchanged: true,
};

const eligible = evaluateClosureCalibration({
  corpus,
  trialRows: safeTrials,
  closureAudit: closedAudit,
  historicalDisagreementCount: 0,
});
assert.equal(eligible.eligible, true);
assert.equal(eligible.falseHits, 0);
assert.equal(eligible.falseMisses, 1);
assert.equal(eligible.sameClosureRunCount, 2);
assert.equal(eligible.sameClosureDisagreements, 0);
assert.equal(eligible.detectedInvalidationDefectCount, 1);

const falseHitTrials = safeTrials.map(entry => ({ ...entry }));
falseHitTrials[1] = { ...falseHitTrials[1], outcome: 'failure', classification: 'false-hit' };
const falseHit = evaluateClosureCalibration({ corpus, trialRows: falseHitTrials, closureAudit: closedAudit, historicalDisagreementCount: 0 });
assert.equal(falseHit.eligible, false);
assert.equal(falseHit.falseHits, 1);
assert.equal(falseHit.sameClosureDisagreements, 1);

const missingIdentity = evaluateClosureCalibration({
  corpus,
  trialRows: safeTrials,
  closureAudit: { ...closedAudit, requiredBoundInputsClosed: false, missingBoundInputs: ['prepared-toolchain-image-identity'] },
  historicalDisagreementCount: 0,
});
assert.equal(missingIdentity.eligible, false);
assert.match(missingIdentity.reasons.join('\n'), /prepared-toolchain-image-identity/);

const identityControlFailure = evaluateClosureCalibration({
  corpus,
  trialRows: safeTrials,
  closureAudit: { ...closedAudit, identityInvalidationControlsPass: false },
  historicalDisagreementCount: 0,
});
assert.equal(identityControlFailure.eligible, false);
assert.match(identityControlFailure.reasons.join('\n'), /bound identity dimensions/);

const networkStillCausal = evaluateClosureCalibration({
  corpus,
  trialRows: safeTrials,
  closureAudit: {
    ...closedAudit,
    eliminatedInputs: { ...closedAudit.eliminatedInputs, externalNetworkAvailability: false },
  },
  historicalDisagreementCount: 0,
});
assert.equal(networkStillCausal.eligible, false);
assert.match(networkStillCausal.reasons.join('\n'), /external network availability/);

const registryStillCausal = evaluateClosureCalibration({
  corpus,
  trialRows: safeTrials,
  closureAudit: {
    ...closedAudit,
    eliminatedInputs: { ...closedAudit.eliminatedInputs, npmRegistryResponseIdentity: false },
  },
  historicalDisagreementCount: 0,
});
assert.equal(registryStillCausal.eligible, false);
assert.match(registryStillCausal.reasons.join('\n'), /npm registry response/);

const prematurePromotion = evaluateClosureCalibration({
  corpus,
  trialRows: safeTrials,
  closureAudit: { ...closedAudit, authoritativeProducerUnchanged: false },
  historicalDisagreementCount: 0,
});
assert.equal(prematurePromotion.eligible, false);
assert.match(prematurePromotion.reasons.join('\n'), /authoritative producer/);

const disagreement = evaluateClosureCalibration({
  corpus,
  trialRows: safeTrials,
  closureAudit: closedAudit,
  historicalDisagreementCount: 1,
});
assert.equal(disagreement.eligible, false);
assert.match(disagreement.reasons.join('\n'), /retained history/);

const enforcedCorpus = structuredClone(corpus);
enforcedCorpus.mode = 'enforced';
assert.throws(() => validateProofCacheClosureCalibrationCorpus(enforcedCorpus, policy), /must remain advisory/);

console.log('EV21_PROOF_CACHE_CLOSURE_CALIBRATION_TEST_PASS shadow=pass legacyPreserved=pass boundInputs=5 eliminatedInputs=2 networklessBuild=pass falseHit=blocked falseMiss=measured defectInvalidation=pass promotion=disabled');
