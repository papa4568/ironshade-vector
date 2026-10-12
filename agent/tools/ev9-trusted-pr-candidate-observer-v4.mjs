import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const FINAL_IF = 'always()';
const UPLOAD_ACTION = 'actions/upload-artifact@v7';
const EVENT_SHA = '${{ github.sha }}';
const BASE_ATTACK_COUNT = 27;

const FINAL_TECHNICAL_NAME = 'Require exact candidate technical gates';
const FINAL_CHECKOUT_NAME = 'Check out exact candidate revision for final evidence';
const FINAL_SETUP_NODE_NAME = 'Set up Node 22 for final evidence';
const FINAL_DOWNLOAD_PACKET_NAME = 'Download exact candidate independent-review packet';
const FINAL_FETCH_COMMENTS_NAME = 'Fetch trusted PR conversation evidence';
const FINAL_REVIEW_GATE_NAME = 'Require actual exact-SHA independent-review pass';
const FINAL_EVIDENCE_NAME = 'Generate complete exact-candidate evidence';
const FINAL_UPLOAD_EVIDENCE_NAME = 'Upload complete candidate evidence';
const FINAL_REVIEW_PACKET_ARTIFACT = 'independent-review-context-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}';
const FINAL_EVIDENCE_ARTIFACT = 'agent-candidate-evidence-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}';

const FINAL_STEP_SEQUENCE = [
  FINAL_TECHNICAL_NAME,
  FINAL_CHECKOUT_NAME,
  FINAL_SETUP_NODE_NAME,
  FINAL_DOWNLOAD_PACKET_NAME,
  FINAL_FETCH_COMMENTS_NAME,
  FINAL_REVIEW_GATE_NAME,
  FINAL_EVIDENCE_NAME,
  FINAL_UPLOAD_EVIDENCE_NAME,
];
const FINAL_TECHNICAL_ENV = {
  BUILD_RESULT: '${{ needs.candidate-build.result }}',
  REVIEW_CONTEXT_RESULT: '${{ needs.independent-review-context.result }}',
  BROWSER_RESULT: '${{ needs.browser-e2e.result }}',
  ANDROID_RESULT: '${{ needs.android.result }}',
  BROWSER_REQUIRED: '${{ needs.candidate-build.outputs.browser-required }}',
  CANDIDATE_SHA: '${{ needs.candidate-build.outputs.candidate-sha }}',
};
const FINAL_TECHNICAL_SCRIPT = [
  'set -euo pipefail',
  'test "$BUILD_RESULT" = \'success\'',
  'test "$REVIEW_CONTEXT_RESULT" = \'success\'',
  'test "$ANDROID_RESULT" = \'success\'',
  'if [[ "$BROWSER_REQUIRED" == \'true\' ]]; then',
  'test "$BROWSER_RESULT" = \'success\'',
  'else',
  'test "$BROWSER_RESULT" = \'skipped\'',
  'fi',
  'echo "PR_CANDIDATE_TECHNICAL_GATES_PASS candidate=$CANDIDATE_SHA fullVerification=once reviewContext=$REVIEW_CONTEXT_RESULT browser=$BROWSER_RESULT android=$ANDROID_RESULT"',
];
const FINAL_FETCH_COMMENTS_ENV = {
  GH_TOKEN: '${{ github.token }}',
  PR_NUMBER: '${{ github.event.pull_request.number }}',
};
const FINAL_FETCH_COMMENTS_SCRIPT = [
  'set -euo pipefail',
  'gh api --paginate --slurp \\',
  "-H 'Accept: application/vnd.github+json' \\",
  '"repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments?per_page=100" \\',
  "| jq 'add // []' > .independent-review/pr-comments.json",
];
const FINAL_REVIEW_GATE_SCRIPT = [
  'node agent/tools/review-comment-gate.mjs gate \\',
  '--packet .independent-review/review-packet.json \\',
  '--comments .independent-review/pr-comments.json \\',
  '--output .independent-review/review-result.json',
  'node agent/tools/independent-review.mjs validate-result \\',
  '--packet .independent-review/review-packet.json \\',
  '--result .independent-review/review-result.json',
];
const FINAL_EVIDENCE_ENV = {
  BASE_SHA: '${{ github.event.pull_request.base.sha }}',
  HEAD_SHA: PR_HEAD,
  HEAD_BRANCH: '${{ github.event.pull_request.head.ref }}',
};
const FINAL_EVIDENCE_SCRIPT = [
  'set -euo pipefail',
  "TASK_ID=\"$(node --input-type=module -e \"import { readFileSync } from 'node:fs'; console.log(JSON.parse(readFileSync('.independent-review/review-packet.json', 'utf8')).taskId)\")\"",
  'node agent/tools/candidate-evidence.mjs manifest \\',
  '--task "$TASK_ID" \\',
  '--base "$BASE_SHA" \\',
  '--head "$HEAD_SHA" \\',
  '--branch "$HEAD_BRANCH" \\',
  '--output .agent-evidence/candidate-manifest.json',
  'node agent/tools/candidate-evidence.mjs ledger \\',
  '--manifest .agent-evidence/candidate-manifest.json \\',
  '--pass-kinds test,build,ci,artifact,review,invariant \\',
  "--workflow 'PR Candidate Verification' \\",
  '--run-id "$GITHUB_RUN_ID" \\',
  "--job 'candidate-verification' \\",
  '--output .agent-evidence/verification-ledger.json',
  'node agent/tools/candidate-evidence.mjs validate \\',
  '--manifest .agent-evidence/candidate-manifest.json \\',
  '--ledger .agent-evidence/verification-ledger.json \\',
  '--verify-git',
  'echo "PR_CANDIDATE_VERIFICATION_PASS candidate=$HEAD_SHA task=$TASK_ID independentReview=pass"',
];
const EXACT_FINAL_EVIDENCE_UPLOAD_BLOCK = [
  `      - name: ${FINAL_UPLOAD_EVIDENCE_NAME}`,
  `        uses: ${UPLOAD_ACTION}`,
  '        with:',
  `          name: ${FINAL_EVIDENCE_ARTIFACT}`,
  '          path: |',
  '            .agent-evidence/',
  '            .independent-review/review-result.json',
  '          include-hidden-files: true',
  '          if-no-files-found: error',
  '          retention-days: 30',
].join('\n');

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function loadModule(path) {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v4_import__';
  try {
    return await import(path);
  } finally {
    process.argv[2] = command;
  }
}

async function loadV3() {
  return loadModule('./ev9-trusted-pr-candidate-observer-v3.mjs');
}

async function loadV2() {
  return loadModule('./ev9-trusted-pr-candidate-observer-v2.mjs');
}

function uniqueStep(job, selector) {
  const steps = (job?.steps ?? []).filter(selector);
  return steps.length === 1 ? steps[0] : null;
}

function stepByName(job, name) {
  return uniqueStep(job, step => step.name === name);
}

function runLines(step) {
  return (step?.run ?? '').split('\n').map(line => line.trim()).filter(Boolean);
}

function exactRun(step, expected) {
  return JSON.stringify(runLines(step)) === JSON.stringify(expected);
}

function exactMap(actual, expected) {
  const actualEntries = Object.entries(actual ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(actualEntries) === JSON.stringify(expectedEntries);
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function failClosedStep(step) {
  return Boolean(step)
    && !Object.hasOwn(step, 'if')
    && !Object.hasOwn(step, 'continue-on-error');
}

function exactRunStep(step, expectedRun, expectedEnv = {}) {
  return failClosedStep(step)
    && !Object.hasOwn(step, 'shell')
    && exactMap(step.env, expectedEnv)
    && exactRun(step, expectedRun);
}

function finalSemanticChecks(workflowText, parsePrCandidateWorkflow) {
  const jobs = parsePrCandidateWorkflow(workflowText);
  const final = jobs.get('candidate-verification');
  const technical = stepByName(final, FINAL_TECHNICAL_NAME);
  const checkout = stepByName(final, FINAL_CHECKOUT_NAME);
  const setupNode = stepByName(final, FINAL_SETUP_NODE_NAME);
  const downloadPacket = stepByName(final, FINAL_DOWNLOAD_PACKET_NAME);
  const fetchComments = stepByName(final, FINAL_FETCH_COMMENTS_NAME);
  const reviewGate = stepByName(final, FINAL_REVIEW_GATE_NAME);
  const evidence = stepByName(final, FINAL_EVIDENCE_NAME);
  const uploadEvidence = stepByName(final, FINAL_UPLOAD_EVIDENCE_NAME);
  const sequence = (final?.steps ?? []).map(step => step.name ?? null);

  return [
    {
      id: 'final-required-step-sequence-exact',
      pass: final?.if === FINAL_IF
        && JSON.stringify(sequence) === JSON.stringify(FINAL_STEP_SEQUENCE),
      evidence: 'the final job must keep exactly the reviewed technical, exact-head, trusted-review, and evidence steps in order',
    },
    {
      id: 'final-technical-gate-semantics-exact',
      pass: exactRunStep(technical, FINAL_TECHNICAL_SCRIPT, FINAL_TECHNICAL_ENV),
      evidence: 'the final technical gate must execute the reviewed fail-closed producer, review-context, browser, and Android result checks',
    },
    {
      id: 'final-exact-head-context-semantics-exact',
      pass: failClosedStep(checkout)
        && checkout?.uses === 'actions/checkout@v7'
        && exactMap(checkout?.with, { ref: PR_HEAD, 'fetch-depth': '0', 'persist-credentials': 'false' })
        && failClosedStep(setupNode)
        && setupNode?.uses === 'actions/setup-node@v7'
        && exactMap(setupNode?.with, { 'node-version': '22.23.2' })
        && failClosedStep(downloadPacket)
        && downloadPacket?.uses === 'actions/download-artifact@v7'
        && exactMap(downloadPacket?.with, { name: FINAL_REVIEW_PACKET_ARTIFACT, path: '.independent-review' }),
      evidence: 'the final evidence context must use exact-head checkout, the reviewed Node runtime, and the exact-head review packet',
    },
    {
      id: 'final-trusted-review-gate-semantics-exact',
      pass: exactRunStep(fetchComments, FINAL_FETCH_COMMENTS_SCRIPT, FINAL_FETCH_COMMENTS_ENV)
        && exactRunStep(reviewGate, FINAL_REVIEW_GATE_SCRIPT),
      evidence: 'the final review gate must fetch trusted PR comments and run the reviewed exact-SHA gate and result validator without masking or shell substitution',
    },
    {
      id: 'final-evidence-generation-semantics-exact',
      pass: exactRunStep(evidence, FINAL_EVIDENCE_SCRIPT, FINAL_EVIDENCE_ENV),
      evidence: 'complete candidate evidence must be generated and git-validated for the exact PR head after review passes',
    },
    {
      id: 'final-evidence-upload-semantics-exact',
      pass: failClosedStep(uploadEvidence)
        && uploadEvidence?.uses === UPLOAD_ACTION
        && exactMap(uploadEvidence?.with, {
          name: FINAL_EVIDENCE_ARTIFACT,
          path: '|',
          'include-hidden-files': 'true',
          'if-no-files-found': 'error',
          'retention-days': '30',
        })
        && countOccurrences(workflowText, EXACT_FINAL_EVIDENCE_UPLOAD_BLOCK) === 1,
      evidence: 'the final job must publish exactly the validated candidate evidence and review result with fail-closed artifact settings',
    },
  ];
}

export async function observeTrustedPrCandidateContractV4(inputs) {
  const v3 = await loadV3();
  const v2 = await loadV2();
  const baseResult = await v3.observeTrustedPrCandidateContractV3(inputs);
  const additions = finalSemanticChecks(inputs.workflowText, v2.parsePrCandidateWorkflow);
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

function replaceStepRun(text, stepName, replacementLines) {
  const header = `      - name: ${stepName}\n`;
  const stepStart = text.indexOf(header);
  ok(stepStart >= 0, `self-test step missing: ${stepName}`);
  const runMarker = '        run: |\n';
  const runStart = text.indexOf(runMarker, stepStart);
  ok(runStart >= 0, `self-test run block missing: ${stepName}`);
  const bodyStart = runStart + runMarker.length;
  const nextStepMarker = text.indexOf('\n      - name:', bodyStart);
  const bodyEnd = nextStepMarker >= 0 ? nextStepMarker + 1 : text.length;
  const replacement = `${replacementLines.map(line => `          ${line}`).join('\n')}\n`;
  return `${text.slice(0, bodyStart)}${replacement}${text.slice(bodyEnd)}`;
}

function liveFixture() {
  return {
    workflowText: readFileSync('.github/workflows/pr-candidate.yml', 'utf8'),
    browserWorkflowText: readFileSync('.github/workflows/browser-e2e.yml', 'utf8'),
    androidWorkflowText: readFileSync('.github/workflows/pr-android-apk.yml', 'utf8'),
  };
}

export async function selfTest() {
  const v3 = await loadV3();
  await v3.selfTest();
  const baseline = liveFixture();
  assert.equal((await observeTrustedPrCandidateContractV4(baseline)).pass, true, 'live candidate workflow must satisfy v4 final-gate semantics');

  const benign = {
    ...baseline,
    workflowText: `# behavior-preserving final-gate control\n${baseline.workflowText}`,
  };
  assert.equal((await observeTrustedPrCandidateContractV4(benign)).pass, true, 'behavior-preserving workflow comment must not create a false positive');

  const uploadHeader = `      - name: ${FINAL_UPLOAD_EVIDENCE_NAME}\n        uses: ${UPLOAD_ACTION}`;
  const reviewHeader = `      - name: ${FINAL_REVIEW_GATE_NAME}\n        run: |`;
  const finalCheckoutBlock = `      - name: ${FINAL_CHECKOUT_NAME}\n        uses: actions/checkout@v7\n        with:\n          ref: ${PR_HEAD}\n          fetch-depth: 0\n          persist-credentials: false`;
  const attacks = [
    [
      { ...baseline, workflowText: replaceStepRun(baseline.workflowText, FINAL_TECHNICAL_NAME, ['echo bypass']) },
      'final-technical-gate-semantics-exact',
    ],
    [
      { ...baseline, workflowText: replaceStepRun(baseline.workflowText, FINAL_FETCH_COMMENTS_NAME, ['echo bypass']) },
      'final-trusted-review-gate-semantics-exact',
    ],
    [
      { ...baseline, workflowText: replaceStepRun(baseline.workflowText, FINAL_REVIEW_GATE_NAME, ['echo bypass']) },
      'final-trusted-review-gate-semantics-exact',
    ],
    [
      { ...baseline, workflowText: replaceStepRun(baseline.workflowText, FINAL_EVIDENCE_NAME, ['echo bypass']) },
      'final-evidence-generation-semantics-exact',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, reviewHeader, `      - name: ${FINAL_REVIEW_GATE_NAME}\n        shell: bash {0} || true\n        run: |`) },
      'final-trusted-review-gate-semantics-exact',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, uploadHeader, `      - name: Inject final bypass\n        run: echo bypass\n\n${uploadHeader}`) },
      'final-required-step-sequence-exact',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, '            .agent-evidence/\n            .independent-review/review-result.json', '            .agent-evidence/\n            substituted-review.json') },
      'final-evidence-upload-semantics-exact',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, finalCheckoutBlock, finalCheckoutBlock.replace(PR_HEAD, EVENT_SHA)) },
      'final-exact-head-context-semantics-exact',
    ],
  ];

  for (const [inputs, expected] of attacks) {
    const result = await observeTrustedPrCandidateContractV4(inputs);
    assert.equal(result.pass, false, `dishonest final-gate mutation must fail: ${expected}`);
    assert.equal(result.failedCheckIds.includes(expected), true, `dishonest final-gate mutation must trigger ${expected}`);
  }

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V4_SELF_TEST_PASS falsePositives=0 falseNegatives=0 attacks=${BASE_ATTACK_COUNT + attacks.length}`);
}

export async function verify() {
  const v3 = await loadV3();
  const v2 = await loadV2();
  await v3.verify();
  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  const git = (...args) => execFileSync('/usr/bin/git', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } }).trim();
  const workflowText = git('show', `${candidateSha}:.github/workflows/pr-candidate.yml`);
  const failed = finalSemanticChecks(workflowText, v2.parsePrCandidateWorkflow).filter(entry => !entry.pass).map(entry => entry.id);
  ok(failed.length === 0, `trusted PR candidate v4 observation failed: ${failed.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V4_PASS candidate=${candidateSha} finalChecks=6 falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v4.mjs <self-test|verify>');
