import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const CHECKOUT_ACTION = 'actions/checkout@v7';
const DOWNLOAD_ACTION = 'actions/download-artifact@v8';
const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const PRODUCER_HEAD = '${{ needs.candidate-build.outputs.candidate-sha }}';
const INPUT_CANDIDATE_SHA = '${{ inputs.candidate_sha }}';
const INPUT_CANDIDATE_ARTIFACT = '${{ inputs.candidate_artifact_name }}';
const BROWSER_CANDIDATE_SHA = '${{ steps.candidate.outputs.candidate-sha }}';
const BROWSER_CANDIDATE_ARTIFACT = '${{ steps.candidate.outputs.artifact-name }}';

const IDENTITY_SCRIPT = [
  'set -euo pipefail',
  'artifact_name="ironshade-vector-pr-candidate-web-${CANDIDATE_SHA}"',
  'echo "candidate-sha=$CANDIDATE_SHA" >> "$GITHUB_OUTPUT"',
  'echo "artifact-name=$artifact_name" >> "$GITHUB_OUTPUT"',
  'test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"',
];
const BROWSER_RESOLVER_SCRIPT = [
  'set -euo pipefail',
  'candidate_sha="${INPUT_SHA:-$DEFAULT_SHA}"',
  'artifact_name="${INPUT_ARTIFACT:-ironshade-vector-browser-candidate-web-$candidate_sha}"',
  'echo "candidate-sha=$candidate_sha" >> "$GITHUB_OUTPUT"',
  'echo "artifact-name=$artifact_name" >> "$GITHUB_OUTPUT"',
];
const BUNDLE_VERIFY_SCRIPT = [
  'set -euo pipefail',
  'node agent/tools/candidate-artifact.mjs validate \\',
  '--candidate "$CANDIDATE_SHA" \\',
  '--root dist \\',
  '--manifest .candidate-artifact/candidate-web.json',
];
const BROWSER_BUNDLE_VERIFY_SCRIPT = [
  'set -euo pipefail',
  'test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"',
  ...BUNDLE_VERIFY_SCRIPT.slice(1),
];

function ok(value, message) {
  if (!value) throw new Error(message);
}

function uncomment(line) {
  let single = false;
  let double = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (double && char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && !escaped) double = !double;
    else if (char === '#' && !single && !double && (index === 0 || /\s/.test(line[index - 1]))) return line.slice(0, index).trimEnd();
    escaped = false;
  }
  return line.trimEnd();
}

function unquote(value) {
  const text = value.trim();
  if (text.length >= 2 && ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')))) return text.slice(1, -1);
  return text;
}

function keyValue(text) {
  const index = text.indexOf(':');
  if (index < 0) return null;
  const key = text.slice(0, index).trim();
  return key ? { key, value: unquote(text.slice(index + 1)) } : null;
}

function linesOf(text) {
  return text.replace(/\r\n/g, '\n').split('\n').map(raw => {
    const clean = uncomment(raw);
    return { raw, indent: clean.match(/^ */)?.[0].length ?? 0, text: clean.trim(), active: clean.trim().length > 0 };
  });
}

function nestedMap(lines, start, end, parentIndent) {
  const result = {};
  for (let index = start; index < end; index += 1) {
    const line = lines[index];
    if (!line.active) continue;
    if (line.indent <= parentIndent) break;
    if (line.indent !== parentIndent + 2) continue;
    const parsed = keyValue(line.text);
    if (parsed?.value) result[parsed.key] = parsed.value;
  }
  return result;
}

function blockScalar(lines, start, end, parentIndent) {
  const values = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index];
    if (line.active && line.indent <= parentIndent) break;
    if (line.indent > parentIndent && line.active) values.push(line.text);
  }
  return values.join('\n');
}

function parseStep(lines, start, end) {
  const step = { with: {}, env: {} };
  const first = keyValue(lines[start].text.slice(2).trim());
  if (first?.value) step[first.key] = first.value;
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.active || line.indent !== 8) continue;
    const parsed = keyValue(line.text);
    if (!parsed) continue;
    if ((parsed.key === 'with' || parsed.key === 'env') && !parsed.value) step[parsed.key] = nestedMap(lines, index + 1, end, 8);
    else if (parsed.key === 'run' && ['|', '|-', '>', '>-'].includes(parsed.value)) step.run = blockScalar(lines, index + 1, end, 8);
    else if (parsed.value) step[parsed.key] = parsed.value;
  }
  return step;
}

function parseSteps(lines, start, end) {
  const starts = [];
  for (let index = start; index < end; index += 1) {
    if (lines[index].active && lines[index].indent === 6 && lines[index].text.startsWith('- ')) starts.push(index);
  }
  return starts.map((startIndex, position) => parseStep(lines, startIndex, starts[position + 1] ?? end));
}

function parseJob(lines, start, end, id) {
  const job = { id, with: {}, outputs: {}, steps: [] };
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.active || line.indent !== 4) continue;
    const parsed = keyValue(line.text);
    if (!parsed) continue;
    if ((parsed.key === 'with' || parsed.key === 'outputs') && !parsed.value) job[parsed.key] = nestedMap(lines, index + 1, end, 4);
    else if (parsed.key === 'steps' && !parsed.value) job.steps = parseSteps(lines, index + 1, end);
    else if (parsed.value) job[parsed.key] = parsed.value;
  }
  return job;
}

function parseWorkflowJobs(workflowText, label = 'workflow') {
  ok(typeof workflowText === 'string' && workflowText.trim(), `${label} text must be non-empty`);
  const lines = linesOf(workflowText);
  const jobsIndex = lines.findIndex(line => line.active && line.indent === 0 && line.text === 'jobs:');
  ok(jobsIndex >= 0, `${label} is missing top-level jobs mapping`);
  const starts = [];
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.active) continue;
    if (line.indent === 0) break;
    if (line.indent === 2 && /^[A-Za-z0-9_-]+:$/.test(line.text)) starts.push({ index, id: line.text.slice(0, -1) });
  }
  ok(starts.length > 0, `${label} has no jobs`);
  const jobs = new Map();
  starts.forEach((entry, position) => jobs.set(entry.id, parseJob(lines, entry.index, starts[position + 1]?.index ?? lines.length, entry.id)));
  return jobs;
}

export function parsePrCandidateWorkflow(workflowText) {
  return parseWorkflowJobs(workflowText, 'PR candidate workflow');
}

function checkoutSteps(job) {
  return (job?.steps ?? []).filter(step => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'));
}

function uniqueCheckout(job, expectedRef) {
  const steps = checkoutSteps(job);
  return steps.length === 1 && steps[0].uses === CHECKOUT_ACTION && steps[0].with.ref === expectedRef;
}

function stepById(job, id) {
  const steps = (job?.steps ?? []).filter(step => step.id === id);
  return steps.length === 1 ? steps[0] : null;
}

function stepByName(job, name) {
  const steps = (job?.steps ?? []).filter(step => step.name === name);
  return steps.length === 1 ? steps[0] : null;
}

function uniqueActionStep(job, action, expectedName) {
  const steps = (job?.steps ?? []).filter(step => step.uses === action && step.with?.name === expectedName);
  return steps.length === 1;
}

function runLines(step) {
  return (step?.run ?? '').split('\n').map(line => line.trim()).filter(Boolean);
}

function exactRun(step, expected) {
  return JSON.stringify(runLines(step)) === JSON.stringify(expected);
}

function check(id, pass, evidence) {
  return { id, pass, evidence };
}

export function observeTrustedPrCandidateContract({ workflowText, browserWorkflowText, androidWorkflowText }) {
  const jobs = parsePrCandidateWorkflow(workflowText);
  const producer = jobs.get('candidate-build');
  const review = jobs.get('independent-review-context');
  const browser = jobs.get('browser-e2e');
  const android = jobs.get('android');
  const final = jobs.get('candidate-verification');
  const identity = stepById(producer, 'identity');
  const required = [['candidate-build', producer], ['independent-review-context', review], ['browser-e2e', browser], ['android', android], ['candidate-verification', final]];

  const browserJobs = parseWorkflowJobs(browserWorkflowText, 'browser reusable workflow');
  const browserConsumer = browserJobs.get('browser-e2e');
  const browserResolver = stepById(browserConsumer, 'candidate');
  const browserVerify = stepByName(browserConsumer, 'Verify exact candidate web bundle');

  const androidJobs = parseWorkflowJobs(androidWorkflowText, 'Android reusable workflow');
  const androidApk = androidJobs.get('android-pr-apk');
  const android35 = androidJobs.get('android-pr-api35-smoke');
  const android36 = androidJobs.get('android-pr-api36-large-screen');
  const androidVerify = stepByName(androidApk, 'Verify exact candidate web bundle');

  const checks = [
    check('required-jobs-present', required.every(([, job]) => Boolean(job)), 'trusted observation requires producer, review, browser, Android, and final jobs'),
    check('candidate-build-exact-head', Boolean(producer) && uniqueCheckout(producer, PR_HEAD), 'candidate-build must contain exactly one actions/checkout@v7 bound to the PR head'),
    check('candidate-output-exact-head', producer?.outputs?.['candidate-sha'] === '${{ steps.identity.outputs.candidate-sha }}', 'candidate-build must expose its runtime-asserted candidate-sha output'),
    check(
      'candidate-identity-runtime-exact-head',
      Boolean(identity) && identity.env?.CANDIDATE_SHA === PR_HEAD && exactRun(identity, IDENTITY_SCRIPT),
      'identity step must be the exact fail-closed script that binds, publishes, and runtime-asserts the PR head SHA',
    ),
    check('review-context-exact-producer', Boolean(review) && uniqueCheckout(review, PRODUCER_HEAD), 'independent-review-context must check out the producer candidate-sha output'),
    check('browser-exact-producer', browser?.uses === './.github/workflows/browser-e2e.yml' && browser?.with?.candidate_sha === PRODUCER_HEAD, 'browser consumer must receive the producer candidate-sha output'),
    check('android-exact-producer', android?.uses === './.github/workflows/pr-android-apk.yml' && android?.with?.candidate_sha === PRODUCER_HEAD, 'Android consumer must receive the producer candidate-sha output'),
    check('final-exact-head', Boolean(final) && uniqueCheckout(final, PR_HEAD), 'final evidence checkout must use the immutable PR head'),
    check(
      'browser-resolver-exact-input',
      Boolean(browserResolver)
        && browserResolver.env?.INPUT_SHA === INPUT_CANDIDATE_SHA
        && browserResolver.env?.INPUT_ARTIFACT === INPUT_CANDIDATE_ARTIFACT
        && exactRun(browserResolver, BROWSER_RESOLVER_SCRIPT),
      'browser reusable workflow must resolve the supplied candidate SHA and artifact with the reviewed fail-closed resolver',
    ),
    check('browser-reusable-exact-input', Boolean(browserConsumer) && uniqueCheckout(browserConsumer, BROWSER_CANDIDATE_SHA), 'browser reusable workflow must check out the resolved candidate SHA'),
    check('browser-artifact-exact-input', Boolean(browserConsumer) && uniqueActionStep(browserConsumer, DOWNLOAD_ACTION, BROWSER_CANDIDATE_ARTIFACT), 'browser reusable workflow must download the resolved candidate artifact'),
    check(
      'browser-bundle-verification-exact-input',
      Boolean(browserVerify) && browserVerify.env?.CANDIDATE_SHA === BROWSER_CANDIDATE_SHA && exactRun(browserVerify, BROWSER_BUNDLE_VERIFY_SCRIPT),
      'browser reusable workflow must fail closed unless checkout and candidate artifact both match the resolved candidate SHA',
    ),
    check(
      'android-reusable-exact-input',
      Boolean(androidApk) && Boolean(android35) && Boolean(android36)
        && uniqueCheckout(androidApk, INPUT_CANDIDATE_SHA)
        && uniqueCheckout(android35, INPUT_CANDIDATE_SHA)
        && uniqueCheckout(android36, INPUT_CANDIDATE_SHA),
      'Android APK, API 35, and API 36 jobs must each check out the supplied candidate SHA',
    ),
    check('android-artifact-exact-input', Boolean(androidApk) && uniqueActionStep(androidApk, DOWNLOAD_ACTION, INPUT_CANDIDATE_ARTIFACT), 'Android reusable workflow must download the supplied candidate artifact'),
    check(
      'android-bundle-verification-exact-input',
      Boolean(androidVerify) && androidVerify.env?.CANDIDATE_SHA === INPUT_CANDIDATE_SHA && exactRun(androidVerify, BUNDLE_VERIFY_SCRIPT),
      'Android reusable workflow must validate the supplied artifact against the supplied candidate SHA before packaging',
    ),
  ];
  const allowedRefs = new Set([PR_HEAD, PRODUCER_HEAD]);
  const checkoutRefs = [...jobs.values()].flatMap(job => checkoutSteps(job).map(step => step.with.ref ?? null));
  checks.push(check('no-synthetic-checkout-ref', checkoutRefs.length > 0 && checkoutRefs.every(ref => allowedRefs.has(ref)), 'PR candidate checkout refs may use only PR head or producer exact SHA'));
  const failedCheckIds = checks.filter(entry => !entry.pass).map(entry => entry.id);
  return { checks, checkoutRefs, failedCheckIds, pass: failedCheckIds.length === 0 };
}

function replaceOnce(text, find, replacement) {
  const index = text.indexOf(find);
  ok(index >= 0, `self-test mutation target missing: ${find}`);
  return `${text.slice(0, index)}${replacement}${text.slice(index + find.length)}`;
}

function prCandidateFixture() {
  return `name: PR Candidate Verification\non:\n  pull_request:\njobs:\n  candidate-build:\n    outputs:\n      candidate-sha: \${{ steps.identity.outputs.candidate-sha }}\n    steps:\n      - name: Check out exact candidate revision\n        uses: actions/checkout@v7\n        with:\n          ref: ${PR_HEAD}\n      - name: Record candidate identity\n        id: identity\n        shell: bash\n        env:\n          CANDIDATE_SHA: ${PR_HEAD}\n        run: |\n          set -euo pipefail\n          artifact_name="ironshade-vector-pr-candidate-web-\${CANDIDATE_SHA}"\n          echo "candidate-sha=$CANDIDATE_SHA" >> "$GITHUB_OUTPUT"\n          echo "artifact-name=$artifact_name" >> "$GITHUB_OUTPUT"\n          test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"\n  independent-review-context:\n    steps:\n      - name: Check out exact candidate read-only\n        uses: actions/checkout@v7\n        with:\n          ref: ${PRODUCER_HEAD}\n  browser-e2e:\n    uses: ./.github/workflows/browser-e2e.yml\n    with:\n      candidate_sha: ${PRODUCER_HEAD}\n  android:\n    uses: ./.github/workflows/pr-android-apk.yml\n    with:\n      candidate_sha: ${PRODUCER_HEAD}\n  candidate-verification:\n    steps:\n      - name: Check out exact candidate revision for final evidence\n        uses: actions/checkout@v7\n        with:\n          ref: ${PR_HEAD}\n`;
}

function browserFixture() {
  return `name: Browser E2E\njobs:\n  browser-e2e:\n    steps:\n      - name: Resolve exact candidate identity\n        id: candidate\n        shell: bash\n        env:\n          INPUT_SHA: ${INPUT_CANDIDATE_SHA}\n          INPUT_ARTIFACT: ${INPUT_CANDIDATE_ARTIFACT}\n          DEFAULT_SHA: \${{ github.sha }}\n        run: |\n          set -euo pipefail\n          candidate_sha="\${INPUT_SHA:-$DEFAULT_SHA}"\n          artifact_name="\${INPUT_ARTIFACT:-ironshade-vector-browser-candidate-web-$candidate_sha}"\n          echo "candidate-sha=$candidate_sha" >> "$GITHUB_OUTPUT"\n          echo "artifact-name=$artifact_name" >> "$GITHUB_OUTPUT"\n      - name: Check out exact candidate revision\n        uses: actions/checkout@v7\n        with:\n          ref: ${BROWSER_CANDIDATE_SHA}\n      - name: Download exact candidate web bundle\n        uses: ${DOWNLOAD_ACTION}\n        with:\n          name: ${BROWSER_CANDIDATE_ARTIFACT}\n          path: .\n      - name: Verify exact candidate web bundle\n        shell: bash\n        env:\n          CANDIDATE_SHA: ${BROWSER_CANDIDATE_SHA}\n        run: |\n          set -euo pipefail\n          test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"\n          node agent/tools/candidate-artifact.mjs validate \\\n            --candidate "$CANDIDATE_SHA" \\\n            --root dist \\\n            --manifest .candidate-artifact/candidate-web.json\n`;
}

function androidFixture() {
  const job = id => `  ${id}:\n    steps:\n      - name: Check out exact candidate revision\n        uses: actions/checkout@v7\n        with:\n          ref: ${INPUT_CANDIDATE_SHA}\n`;
  return `name: PR Android APK\njobs:\n  android-pr-apk:\n    steps:\n      - name: Check out exact candidate revision\n        uses: actions/checkout@v7\n        with:\n          ref: ${INPUT_CANDIDATE_SHA}\n      - name: Download exact candidate web bundle\n        uses: ${DOWNLOAD_ACTION}\n        with:\n          name: ${INPUT_CANDIDATE_ARTIFACT}\n          path: .\n      - name: Verify exact candidate web bundle\n        shell: bash\n        env:\n          CANDIDATE_SHA: ${INPUT_CANDIDATE_SHA}\n        run: |\n          set -euo pipefail\n          node agent/tools/candidate-artifact.mjs validate \\\n            --candidate "$CANDIDATE_SHA" \\\n            --root dist \\\n            --manifest .candidate-artifact/candidate-web.json\n${job('android-pr-api35-smoke')}${job('android-pr-api36-large-screen')}`;
}

export function selfTest() {
  const baseline = {
    workflowText: prCandidateFixture(),
    browserWorkflowText: browserFixture(),
    androidWorkflowText: androidFixture(),
  };
  assert.equal(observeTrustedPrCandidateContract(baseline).pass, true);
  const benign = {
    ...baseline,
    workflowText: `# behavior-preserving workflow comment\n${replaceOnce(baseline.workflowText, IDENTITY_SCRIPT.at(-1), `# behavior-preserving identity comment\n          ${IDENTITY_SCRIPT.at(-1)}`)}`,
  };
  assert.equal(observeTrustedPrCandidateContract(benign).pass, true);

  const attacks = [
    [{ ...baseline, workflowText: replaceOnce(baseline.workflowText, `ref: ${PR_HEAD}`, 'ref: ${{ github.sha }}') }, 'candidate-build-exact-head'],
    [{ ...baseline, workflowText: replaceOnce(baseline.workflowText, `candidate-sha: \${{ steps.identity.outputs.candidate-sha }}`, 'candidate-sha: ${{ github.sha }}') }, 'candidate-output-exact-head'],
    [{ ...baseline, workflowText: replaceOnce(baseline.workflowText, IDENTITY_SCRIPT.at(-1), `${IDENTITY_SCRIPT.at(-1)} || true`) }, 'candidate-identity-runtime-exact-head'],
    [{ ...baseline, workflowText: replaceOnce(baseline.workflowText, `candidate_sha: ${PRODUCER_HEAD}`, 'candidate_sha: ${{ github.sha }}') }, 'browser-exact-producer'],
    [{ ...baseline, workflowText: replaceOnce(baseline.workflowText, `      - name: Check out exact candidate revision for final evidence\n        uses: ${CHECKOUT_ACTION}\n        with:\n          ref: ${PR_HEAD}`, `      - name: Check out exact candidate revision for final evidence\n        uses: ${CHECKOUT_ACTION}\n        with:\n          ref: \${{ github.sha }}`) }, 'final-exact-head'],
    [{ ...baseline, browserWorkflowText: replaceOnce(baseline.browserWorkflowText, 'candidate_sha="${INPUT_SHA:-$DEFAULT_SHA}"', 'candidate_sha="$DEFAULT_SHA"') }, 'browser-resolver-exact-input'],
    [{ ...baseline, browserWorkflowText: replaceOnce(baseline.browserWorkflowText, `ref: ${BROWSER_CANDIDATE_SHA}`, 'ref: ${{ github.sha }}') }, 'browser-reusable-exact-input'],
    [{ ...baseline, androidWorkflowText: replaceOnce(baseline.androidWorkflowText, `ref: ${INPUT_CANDIDATE_SHA}`, 'ref: ${{ github.sha }}') }, 'android-reusable-exact-input'],
  ];
  for (const [inputs, expected] of attacks) {
    const result = observeTrustedPrCandidateContract(inputs);
    assert.equal(result.pass, false, `dishonest mutation must fail: ${expected}`);
    assert.equal(result.failedCheckIds.includes(expected), true, `dishonest mutation must trigger ${expected}`);
  }
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_SELF_TEST_PASS falsePositives=0 falseNegatives=0 attacks=${attacks.length}`);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  ok(value, `${name} is required`);
  return value;
}

export function verify() {
  const candidateSha = requiredEnv('CANDIDATE_SHA');
  const trustedBaseSha = requiredEnv('TRUSTED_BASE_SHA');
  ok(SHA_PATTERN.test(candidateSha), 'candidate SHA must be a full lowercase Git SHA');
  ok(SHA_PATTERN.test(trustedBaseSha), 'trusted base SHA must be a full lowercase Git SHA');
  const git = (...args) => execFileSync('/usr/bin/git', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } }).trim();
  ok(git('rev-parse', 'HEAD') === trustedBaseSha, 'trusted observer workspace must remain checked out at the exact PR base SHA');
  const workflowText = git('show', `${candidateSha}:.github/workflows/pr-candidate.yml`);
  const browserWorkflowText = git('show', `${candidateSha}:.github/workflows/browser-e2e.yml`);
  const androidWorkflowText = git('show', `${candidateSha}:.github/workflows/pr-android-apk.yml`);
  const result = observeTrustedPrCandidateContract({ workflowText, browserWorkflowText, androidWorkflowText });
  ok(result.pass, `trusted PR candidate observation failed: ${result.failedCheckIds.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_PASS candidate=${candidateSha} trustedBase=${trustedBaseSha} checks=${result.checks.length} falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') selfTest();
else if (command === 'verify') verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v2.mjs <self-test|verify>');
