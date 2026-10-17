import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runAntibodyGovernanceAssessment } from '../tools/antibody-governance.mjs';
import { verifyAntibodyGovernanceEvidence } from '../tools/antibody-governance-evidence.mjs';

const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const [policy, calibration, ev12Corpus, memory] = await Promise.all([
  readJson(new URL('../antibody-governance-policy.json', import.meta.url)),
  readJson(new URL('../antibody-governance-calibration-corpus.json', import.meta.url)),
  readJson(new URL('../failure-recurrence-calibration-corpus.json', import.meta.url)),
  readJson(new URL('../failure-memory.json', import.meta.url)),
]);
const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const live = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, { candidateSha });
assert(live.lifecycle.decisionRecordCount > 0, 'post-EV-13 governance must observe committed decision history');
assert.equal(live.lifecycle.committedDecisionAllowedInEv13, false, 'the historical EV-13 no-decision rule must remain intact');
assert.equal(live.governancePass, false, 'live post-EV-13 history must not synthesize the historical EV-13 closeout pass');
await verifyAntibodyGovernanceEvidence(live, policy, calibration, ev12Corpus, memory, {
  candidateSha,
  requireCurrentState: true,
});

const spoofedZero = await runAntibodyGovernanceAssessment(policy, calibration, ev12Corpus, memory, {
  candidateSha,
  decisionRecordCount: 0,
});
assert.equal(spoofedZero.lifecycle.decisionRecordCount, 0, 'fixture must reproduce the historical zero-count shape');
await assert.rejects(
  () => verifyAntibodyGovernanceEvidence(spoofedZero, policy, calibration, ev12Corpus, memory, {
    candidateSha,
    requireCurrentState: true,
  }),
  /does not match exact candidate policy\/corpus\/memory recomputation/,
  'post-EV-13 current-state verification must reject a caller-injected zero decision count',
);

console.log(`ANTIBODY_GOVERNANCE_CURRENT_STATE_TEST_PASS candidate=${candidateSha} decisions=${live.lifecycle.decisionRecordCount} spoofedZero=reject`);
