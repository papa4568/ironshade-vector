import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PRODUCER_HEAD = '${{ needs.candidate-build.outputs.candidate-sha }}';
const PRODUCER_ARTIFACT = '${{ needs.candidate-build.outputs.artifact-name }}';
const IDENTITY_ARTIFACT_OUTPUT = '${{ steps.identity.outputs.artifact-name }}';
const EVENT_SHA = '${{ github.sha }}';
const FULL_VERIFICATION_NAME = 'Run full repository verification and production build once';

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function loadBaseObserver() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v3_import__';
  try {
    return await import('./ev9-trusted-pr-candidate-observer-v2.mjs');
  } finally {
    process.argv[2] = command;
  }
}

function artifactChecks(workflowText, parsePrCandidateWorkflow) {
  const jobs = parsePrCandidateWorkflow(workflowText);
  const producer = jobs.get('candidate-build');
  const browser = jobs.get('browser-e2e');
  const android = jobs.get('android');
  const fullVerificationSteps = (producer?.steps ?? []).filter(step => step.name === FULL_VERIFICATION_NAME);
  const fullVerification = fullVerificationSteps.length === 1 ? fullVerificationSteps[0] : null;
  return [
    {
      id: 'candidate-snapshot-build-fail-closed',
      pass: Boolean(fullVerification)
        && !Object.hasOwn(fullVerification, 'if')
        && !Object.hasOwn(fullVerification, 'continue-on-error'),
      evidence: 'exact candidate snapshot verification/build must run unconditionally and fail the producer job on any error',
    },
    {
      id: 'candidate-artifact-output-exact-head',
      pass: producer?.outputs?.['artifact-name'] === IDENTITY_ARTIFACT_OUTPUT,
      evidence: 'candidate-build must expose the artifact name published by the exact-head identity step',
    },
    {
      id: 'browser-artifact-exact-producer',
      pass: browser?.with?.candidate_artifact_name === PRODUCER_ARTIFACT,
      evidence: 'browser consumer must receive the producer artifact-name output',
    },
    {
      id: 'android-artifact-exact-producer',
      pass: android?.with?.candidate_artifact_name === PRODUCER_ARTIFACT,
      evidence: 'Android consumer must receive the producer artifact-name output',
    },
  ];
}

export async function observeTrustedPrCandidateContractV3(inputs) {
  const base = await loadBaseObserver();
  const baseResult = base.observeTrustedPrCandidateContract(inputs);
  const additions = artifactChecks(inputs.workflowText, base.parsePrCandidateWorkflow);
  const failedCheckIds = [
    ...baseResult.failedCheckIds,
    ...additions.filter(entry => !entry.pass).map(entry => entry.id),
  ];
  return {
    ...baseResult,
    checks: [...baseResult.checks, ...additions],
    failedCheckIds,
    pass: failedCheckIds.length === 0,
  };
}

function replaceOnce(text, find, replacement) {
  const index = text.indexOf(find);
  ok(index >= 0, `self-test mutation target missing: ${find}`);
  return `${text.slice(0, index)}${replacement}${text.slice(index + find.length)}`;
}

function replaceLast(text, find, replacement) {
  const index = text.lastIndexOf(find);
  ok(index >= 0, `self-test mutation target missing: ${find}`);
  return `${text.slice(0, index)}${replacement}${text.slice(index + find.length)}`;
}

function liveFixture() {
  return {
    workflowText: readFileSync('.github/workflows/pr-candidate.yml', 'utf8'),
    browserWorkflowText: readFileSync('.github/workflows/browser-e2e.yml', 'utf8'),
    androidWorkflowText: readFileSync('.github/workflows/pr-android-apk.yml', 'utf8'),
  };
}

export async function selfTest() {
  const base = await loadBaseObserver();
  base.selfTest();

  const baseline = liveFixture();
  assert.equal((await observeTrustedPrCandidateContractV3(baseline)).pass, true, 'live candidate workflow must satisfy the complete trusted observer contract');

  const benign = {
    ...baseline,
    workflowText: `# behavior-preserving artifact-wiring control\n${baseline.workflowText}`,
  };
  assert.equal((await observeTrustedPrCandidateContractV3(benign)).pass, true, 'behavior-preserving workflow comment must not create a false positive');

  const reviewCheckout = `      - name: Check out exact candidate read-only\n        uses: actions/checkout@v7\n        with:\n          ref: ${PRODUCER_HEAD}`;
  const artifactHandoff = `candidate_artifact_name: ${PRODUCER_ARTIFACT}`;
  const shaHandoff = `candidate_sha: ${PRODUCER_HEAD}`;
  const fullVerificationHeader = `      - name: ${FULL_VERIFICATION_NAME}\n        id: full-verification`;
  const attacks = [
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, fullVerificationHeader, `      - name: ${FULL_VERIFICATION_NAME}\n        if: false\n        id: full-verification`) },
      'candidate-snapshot-build-fail-closed',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, fullVerificationHeader, `      - name: ${FULL_VERIFICATION_NAME}\n        continue-on-error: true\n        id: full-verification`) },
      'candidate-snapshot-build-fail-closed',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, `artifact-name: ${IDENTITY_ARTIFACT_OUTPUT}`, 'artifact-name: unrelated-artifact') },
      'candidate-artifact-output-exact-head',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, artifactHandoff, 'candidate_artifact_name: unrelated-browser-artifact') },
      'browser-artifact-exact-producer',
    ],
    [
      { ...baseline, workflowText: replaceLast(baseline.workflowText, artifactHandoff, 'candidate_artifact_name: unrelated-android-artifact') },
      'android-artifact-exact-producer',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, reviewCheckout, reviewCheckout.replace(PRODUCER_HEAD, EVENT_SHA)) },
      'review-context-exact-producer',
    ],
    [
      { ...baseline, workflowText: replaceLast(baseline.workflowText, shaHandoff, `candidate_sha: ${EVENT_SHA}`) },
      'android-exact-producer',
    ],
  ];

  for (const [inputs, expected] of attacks) {
    const result = await observeTrustedPrCandidateContractV3(inputs);
    assert.equal(result.pass, false, `dishonest mutation must fail: ${expected}`);
    assert.equal(result.failedCheckIds.includes(expected), true, `dishonest mutation must trigger ${expected}`);
  }

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V3_SELF_TEST_PASS falsePositives=0 falseNegatives=0 attacks=${10 + attacks.length}`);
}

export async function verify() {
  const base = await loadBaseObserver();
  base.verify();

  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  const git = (...args) => execFileSync('/usr/bin/git', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } }).trim();
  const workflowText = git('show', `${candidateSha}:.github/workflows/pr-candidate.yml`);
  const checks = artifactChecks(workflowText, base.parsePrCandidateWorkflow);
  const failedCheckIds = checks.filter(entry => !entry.pass).map(entry => entry.id);
  ok(failedCheckIds.length === 0, `trusted PR candidate artifact observation failed: ${failedCheckIds.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V3_PASS candidate=${candidateSha} artifactChecks=${checks.length} falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v3.mjs <self-test|verify>');
