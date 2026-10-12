import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const PRODUCER_HEAD = '${{ needs.candidate-build.outputs.candidate-sha }}';
const PRODUCER_ARTIFACT = '${{ needs.candidate-build.outputs.artifact-name }}';
const IDENTITY_ARTIFACT_OUTPUT = '${{ steps.identity.outputs.artifact-name }}';
const SOURCE_BOUND_DIGEST_OUTPUT = '${{ steps.source-bound-dist.outputs.dist-sha256 }}';
const EVENT_SHA = '${{ github.sha }}';
const FULL_VERIFICATION_NAME = 'Run full repository verification and production build once';
const SOURCE_BOUND_DIGEST_NAME = 'Record source-bound candidate web digest';
const MANIFEST_NAME = 'Create exact candidate web artifact manifest';
const UPLOAD_NAME = 'Upload exact candidate web bundle';
const UPLOAD_ACTION = 'actions/upload-artifact@v7';
const UPLOAD_ARTIFACT_NAME = 'ironshade-vector-pr-candidate-web-${{ github.event.pull_request.head.sha }}';
const PRIMARY_BROWSER_IF = "needs.candidate-build.outputs.browser-required == 'true'";
const FINAL_IF = 'always()';
const REUSABLE_BROWSER_IF = "${{ always() && (needs.prepare-browser-candidate.result == 'success' || needs.prepare-browser-candidate.result == 'skipped') }}";
const SOURCE_BOUND_DIGEST_SCRIPT = [
  'set -euo pipefail',
  'dist_sha256="$(tar --sort=name --mtime=\'@0\' --owner=0 --group=0 --numeric-owner -cf - dist | sha256sum | cut -d\' \' -f1)"',
  'echo "dist-sha256=$dist_sha256" >> "$GITHUB_OUTPUT"',
];
const MANIFEST_SCRIPT = [
  'set -euo pipefail',
  'digest() {',
  'tar --sort=name --mtime=\'@0\' --owner=0 --group=0 --numeric-owner -cf - dist | sha256sum | cut -d\' \' -f1',
  '}',
  'test "$(digest)" = "$SOURCE_BOUND_DIST_SHA256"',
  'node agent/tools/candidate-artifact.mjs create \\',
  '--candidate "$CANDIDATE_SHA" \\',
  '--root dist \\',
  "--build-command 'npm run build' \\",
  '--output .candidate-artifact/candidate-web.json',
  'node agent/tools/candidate-artifact.mjs validate \\',
  '--candidate "$CANDIDATE_SHA" \\',
  '--root dist \\',
  '--manifest .candidate-artifact/candidate-web.json',
  'test "$(digest)" = "$SOURCE_BOUND_DIST_SHA256"',
];
const PRODUCER_ARTIFACT_WINDOW = [
  SOURCE_BOUND_DIGEST_NAME,
  'Capture EV-5 impact-map calibration shadow evidence',
  'Upload EV-5 impact-map calibration advisory evidence',
  'Compare EV-6 reuse prediction with the real rerun',
  'Upload EV-6 causal proof cache advisory evidence',
  'Capture EV-3 behavioral genome shadow evidence',
  'Upload EV-3 behavioral genome advisory evidence',
  'Record candidate identity',
  'Detect browser validation scope',
  MANIFEST_NAME,
  UPLOAD_NAME,
];
const EXACT_UPLOAD_BLOCK = [
  `      - name: ${UPLOAD_NAME}`,
  `        uses: ${UPLOAD_ACTION}`,
  '        with:',
  `          name: ${UPLOAD_ARTIFACT_NAME}`,
  '          path: |',
  '            dist/',
  '            .candidate-artifact/candidate-web.json',
  '          include-hidden-files: true',
  '          if-no-files-found: error',
  '          retention-days: 30',
].join('\n');

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

function uniqueStep(job, selector) {
  const steps = (job?.steps ?? []).filter(selector);
  return steps.length === 1 ? steps[0] : null;
}

function stepById(job, id) {
  return uniqueStep(job, step => step.id === id);
}

function stepByName(job, name) {
  return uniqueStep(job, step => step.name === name);
}

function stepIndex(job, step) {
  return step ? (job?.steps ?? []).indexOf(step) : -1;
}

function runLines(step) {
  return (step?.run ?? '').split('\n').map(line => line.trim()).filter(Boolean);
}

function exactRun(step, expected) {
  return JSON.stringify(runLines(step)) === JSON.stringify(expected);
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function failClosedStep(step) {
  return Boolean(step)
    && !Object.hasOwn(step, 'if')
    && !Object.hasOwn(step, 'continue-on-error');
}

function exactJobExecution(job, expectedIf = null) {
  if (!job || Object.hasOwn(job, 'continue-on-error')) return false;
  if (expectedIf === null) return !Object.hasOwn(job, 'if');
  return job.if === expectedIf;
}

function allFailClosedSteps(job, selectors) {
  return selectors.every(selector => failClosedStep(
    selector.id ? stepById(job, selector.id) : stepByName(job, selector.name),
  ));
}

function artifactChecks(workflowText, parsePrCandidateWorkflow) {
  const jobs = parsePrCandidateWorkflow(workflowText);
  const producer = jobs.get('candidate-build');
  const browser = jobs.get('browser-e2e');
  const android = jobs.get('android');
  const fullVerificationSteps = (producer?.steps ?? []).filter(step => step.name === FULL_VERIFICATION_NAME);
  const fullVerification = fullVerificationSteps.length === 1 ? fullVerificationSteps[0] : null;
  const sourceBoundDigest = stepById(producer, 'source-bound-dist');
  const manifest = stepByName(producer, MANIFEST_NAME);
  const upload = stepByName(producer, UPLOAD_NAME);
  const fullIndex = stepIndex(producer, fullVerification);
  const digestIndex = stepIndex(producer, sourceBoundDigest);
  const manifestIndex = stepIndex(producer, manifest);
  const uploadIndex = stepIndex(producer, upload);
  const artifactWindow = fullIndex >= 0 && uploadIndex > fullIndex
    ? producer.steps.slice(fullIndex + 1, uploadIndex + 1).map(step => step.name ?? null)
    : [];
  return [
    {
      id: 'candidate-snapshot-build-fail-closed',
      pass: failClosedStep(fullVerification),
      evidence: 'exact candidate snapshot verification/build must run unconditionally and fail the producer job on any error',
    },
    {
      id: 'candidate-source-bound-digest-immediate',
      pass: failClosedStep(sourceBoundDigest)
        && sourceBoundDigest?.shell === 'bash'
        && exactRun(sourceBoundDigest, SOURCE_BOUND_DIGEST_SCRIPT)
        && digestIndex === fullIndex + 1,
      evidence: 'the exact snapshot build must be bound immediately to an immutable SHA-256 step output before any later producer step can touch dist',
    },
    {
      id: 'candidate-artifact-producer-window-exact-sequence',
      pass: JSON.stringify(artifactWindow) === JSON.stringify(PRODUCER_ARTIFACT_WINDOW),
      evidence: 'the post-build producer window through publication must contain only the reviewed steps in the reviewed order, rejecting injected mutation steps',
    },
    {
      id: 'candidate-manifest-revalidates-source-bound-digest',
      pass: failClosedStep(manifest)
        && manifest?.env?.CANDIDATE_SHA === PR_HEAD
        && manifest?.env?.SOURCE_BOUND_DIST_SHA256 === SOURCE_BOUND_DIGEST_OUTPUT
        && exactRun(manifest, MANIFEST_SCRIPT),
      evidence: 'manifest creation must verify the immutable source-bound digest before and after candidate manifest tooling runs',
    },
    {
      id: 'candidate-artifact-publish-protected-window',
      pass: failClosedStep(upload)
        && uploadIndex === manifestIndex + 1
        && upload?.uses === UPLOAD_ACTION
        && upload?.with?.name === UPLOAD_ARTIFACT_NAME
        && upload?.with?.path === '|'
        && upload?.with?.['include-hidden-files'] === 'true'
        && upload?.with?.['if-no-files-found'] === 'error'
        && upload?.with?.['retention-days'] === '30'
        && countOccurrences(workflowText, EXACT_UPLOAD_BLOCK) === 1,
      evidence: 'the exact source-bound dist and manifest must be uploaded immediately after digest revalidation with the reviewed artifact action and paths',
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

function executionChecks(inputs, parsePrCandidateWorkflow) {
  const jobs = parsePrCandidateWorkflow(inputs.workflowText);
  const producer = jobs.get('candidate-build');
  const review = jobs.get('independent-review-context');
  const browser = jobs.get('browser-e2e');
  const android = jobs.get('android');
  const final = jobs.get('candidate-verification');

  const browserJobs = parsePrCandidateWorkflow(inputs.browserWorkflowText);
  const browserConsumer = browserJobs.get('browser-e2e');

  const androidJobs = parsePrCandidateWorkflow(inputs.androidWorkflowText);
  const androidApk = androidJobs.get('android-pr-apk');
  const android35 = androidJobs.get('android-pr-api35-smoke');
  const android36 = androidJobs.get('android-pr-api36-large-screen');
  const androidFinal = androidJobs.get('android-pr-verification');

  const producerSteps = [
    { name: 'Check out exact candidate revision' },
    { id: 'full-verification' },
    { id: 'source-bound-dist' },
    { id: 'identity' },
    { id: 'scope' },
    { name: MANIFEST_NAME },
    { name: UPLOAD_NAME },
  ];
  const reviewSteps = [
    { name: 'Check out exact candidate read-only' },
    { id: 'review-task' },
    { name: 'Generate exact candidate review packet' },
    { name: 'Upload read-only independent review context' },
  ];
  const finalSteps = [
    { name: 'Require exact candidate technical gates' },
    { name: 'Check out exact candidate revision for final evidence' },
    { name: 'Download exact candidate independent-review packet' },
    { name: 'Fetch trusted PR conversation evidence' },
    { name: 'Require actual exact-SHA independent-review pass' },
    { name: 'Generate complete exact-candidate evidence' },
    { name: 'Upload complete candidate evidence' },
  ];
  const browserSteps = [
    { id: 'candidate' },
    { name: 'Check out exact candidate revision' },
    { name: 'Download exact candidate web bundle' },
    { name: 'Verify exact candidate web bundle' },
    { name: 'Verify browser player journey' },
  ];
  const androidApkSteps = [
    { name: 'Check out exact candidate revision' },
    { name: 'Download exact candidate web bundle' },
    { name: 'Verify exact candidate web bundle' },
    { name: 'Generate native Android project from verified bundle' },
    { name: 'Build installable debug APK' },
    { name: 'Verify and stage APK' },
    { name: 'Verify Android delivery contract' },
    { name: 'Upload PR APK' },
  ];
  const android35Steps = [
    { name: 'Check out exact candidate revision' },
    { name: 'Download PR APK' },
    { name: 'Verify APK digest' },
    { name: 'Run API 35 product smoke' },
  ];
  const android36Steps = [
    { name: 'Check out exact candidate revision' },
    { name: 'Download PR APK' },
    { name: 'Verify APK digest' },
    { name: 'Run Android 16 large-screen smoke' },
  ];

  return [
    {
      id: 'required-job-execution-fail-closed',
      pass: exactJobExecution(producer)
        && exactJobExecution(review)
        && exactJobExecution(browser, PRIMARY_BROWSER_IF)
        && exactJobExecution(android)
        && exactJobExecution(final, FINAL_IF),
      evidence: 'producer, review, browser, Android, and final jobs must keep their reviewed execution conditions and may not mask job failures',
    },
    {
      id: 'candidate-required-steps-fail-closed',
      pass: allFailClosedSteps(producer, producerSteps),
      evidence: 'producer checkout, exact snapshot build, source-bound digest, identity, scope, artifact manifest, and artifact upload must not be conditionally skipped or error-masked',
    },
    {
      id: 'review-required-steps-fail-closed',
      pass: allFailClosedSteps(review, reviewSteps),
      evidence: 'independent-review context checkout, task resolution, packet generation, and upload must not be conditionally skipped or error-masked',
    },
    {
      id: 'final-required-steps-fail-closed',
      pass: allFailClosedSteps(final, finalSteps),
      evidence: 'final technical, exact-head, trusted-review, and evidence steps must not be conditionally skipped or error-masked',
    },
    {
      id: 'browser-required-execution-fail-closed',
      pass: exactJobExecution(browserConsumer, REUSABLE_BROWSER_IF)
        && allFailClosedSteps(browserConsumer, browserSteps),
      evidence: 'browser exact-candidate resolver, checkout, artifact validation, and player journey must keep the reviewed job condition and run fail-closed',
    },
    {
      id: 'android-required-execution-fail-closed',
      pass: exactJobExecution(androidApk)
        && exactJobExecution(android35)
        && exactJobExecution(android36)
        && exactJobExecution(androidFinal, FINAL_IF)
        && allFailClosedSteps(androidApk, androidApkSteps)
        && allFailClosedSteps(android35, android35Steps)
        && allFailClosedSteps(android36, android36Steps)
        && failClosedStep(stepByName(androidFinal, 'Require all Android PR gates')),
      evidence: 'Android APK, API 35, API 36, and aggregate gates plus their candidate-binding and product-smoke steps must run fail-closed',
    },
  ];
}

export async function observeTrustedPrCandidateContractV3(inputs) {
  const base = await loadBaseObserver();
  const baseResult = base.observeTrustedPrCandidateContract(inputs);
  const additions = [
    ...artifactChecks(inputs.workflowText, base.parsePrCandidateWorkflow),
    ...executionChecks(inputs, base.parsePrCandidateWorkflow),
  ];
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
  const sourceBoundDigestHeader = `      - name: ${SOURCE_BOUND_DIGEST_NAME}\n        id: source-bound-dist`;
  const identityHeader = '      - name: Record candidate identity\n        id: identity';
  const manifestHeader = `      - name: ${MANIFEST_NAME}\n        env:`;
  const uploadHeader = `      - name: ${UPLOAD_NAME}\n        uses: ${UPLOAD_ACTION}`;
  const finalReviewHeader = '      - name: Require actual exact-SHA independent-review pass\n        run: |';
  const browserVerifyHeader = '      - name: Verify exact candidate web bundle\n        shell: bash';
  const android35SmokeHeader = '      - name: Run API 35 product smoke\n        uses: ReactiveCircus/android-emulator-runner@v2.38.0';
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
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, sourceBoundDigestHeader, `      - name: Mutate built dist before source binding\n        run: echo compromised >> dist/index.html\n\n${sourceBoundDigestHeader}`) },
      'candidate-source-bound-digest-immediate',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, manifestHeader, `      - name: Mutate source-bound dist before manifest\n        run: echo compromised >> dist/index.html\n\n${manifestHeader}`) },
      'candidate-artifact-producer-window-exact-sequence',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, 'SOURCE_BOUND_DIST_SHA256: ${{ steps.source-bound-dist.outputs.dist-sha256 }}', 'SOURCE_BOUND_DIST_SHA256: ${{ github.sha }}') },
      'candidate-manifest-revalidates-source-bound-digest',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, uploadHeader, `      - name: Mutate dist after manifest validation\n        run: echo compromised >> dist/index.html\n\n${uploadHeader}`) },
      'candidate-artifact-publish-protected-window',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, '            dist/\n            .candidate-artifact/candidate-web.json', '            dist/\n            substituted/') },
      'candidate-artifact-publish-protected-window',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, '  candidate-build:\n    name:', '  candidate-build:\n    if: false\n    name:') },
      'required-job-execution-fail-closed',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, identityHeader, '      - name: Record candidate identity\n        if: false\n        id: identity') },
      'candidate-required-steps-fail-closed',
    ],
    [
      { ...baseline, workflowText: replaceOnce(baseline.workflowText, finalReviewHeader, '      - name: Require actual exact-SHA independent-review pass\n        if: false\n        run: |') },
      'final-required-steps-fail-closed',
    ],
    [
      { ...baseline, browserWorkflowText: replaceOnce(baseline.browserWorkflowText, browserVerifyHeader, '      - name: Verify exact candidate web bundle\n        if: false\n        shell: bash') },
      'browser-required-execution-fail-closed',
    ],
    [
      { ...baseline, androidWorkflowText: replaceOnce(baseline.androidWorkflowText, android35SmokeHeader, '      - name: Run API 35 product smoke\n        if: false\n        uses: ReactiveCircus/android-emulator-runner@v2.38.0') },
      'android-required-execution-fail-closed',
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
  const inputs = {
    workflowText: git('show', `${candidateSha}:.github/workflows/pr-candidate.yml`),
    browserWorkflowText: git('show', `${candidateSha}:.github/workflows/browser-e2e.yml`),
    androidWorkflowText: git('show', `${candidateSha}:.github/workflows/pr-android-apk.yml`),
  };
  const checks = [
    ...artifactChecks(inputs.workflowText, base.parsePrCandidateWorkflow),
    ...executionChecks(inputs, base.parsePrCandidateWorkflow),
  ];
  const failedCheckIds = checks.filter(entry => !entry.pass).map(entry => entry.id);
  ok(failedCheckIds.length === 0, `trusted PR candidate v3 observation failed: ${failedCheckIds.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V3_PASS candidate=${candidateSha} checks=${checks.length} falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v3.mjs <self-test|verify>');
