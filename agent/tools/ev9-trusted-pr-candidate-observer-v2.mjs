import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const CHECKOUT_ACTION = 'actions/checkout@v7';
const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const PRODUCER_HEAD = '${{ needs.candidate-build.outputs.candidate-sha }}';

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

function parseStep(lines, start, end) {
  const step = { with: {} };
  const first = keyValue(lines[start].text.slice(2).trim());
  if (first?.value) step[first.key] = first.value;
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.active || line.indent !== 8) continue;
    const parsed = keyValue(line.text);
    if (!parsed) continue;
    if (parsed.key === 'with' && !parsed.value) step.with = nestedMap(lines, index + 1, end, 8);
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

export function parsePrCandidateWorkflow(workflowText) {
  ok(typeof workflowText === 'string' && workflowText.trim(), 'PR candidate workflow text must be non-empty');
  const lines = linesOf(workflowText);
  const jobsIndex = lines.findIndex(line => line.active && line.indent === 0 && line.text === 'jobs:');
  ok(jobsIndex >= 0, 'PR candidate workflow is missing top-level jobs mapping');
  const starts = [];
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.active) continue;
    if (line.indent === 0) break;
    if (line.indent === 2 && /^[A-Za-z0-9_-]+:$/.test(line.text)) starts.push({ index, id: line.text.slice(0, -1) });
  }
  ok(starts.length > 0, 'PR candidate workflow has no jobs');
  const jobs = new Map();
  starts.forEach((entry, position) => jobs.set(entry.id, parseJob(lines, entry.index, starts[position + 1]?.index ?? lines.length, entry.id)));
  return jobs;
}

function checkoutSteps(job) {
  return job.steps.filter(step => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'));
}

function uniqueCheckout(job, expectedRef) {
  const steps = checkoutSteps(job);
  return steps.length === 1 && steps[0].uses === CHECKOUT_ACTION && steps[0].with.ref === expectedRef;
}

function check(id, pass, evidence) {
  return { id, pass, evidence };
}

export function observeTrustedPrCandidateContract({ workflowText }) {
  const jobs = parsePrCandidateWorkflow(workflowText);
  const producer = jobs.get('candidate-build');
  const review = jobs.get('independent-review-context');
  const browser = jobs.get('browser-e2e');
  const android = jobs.get('android');
  const final = jobs.get('candidate-verification');
  const required = [['candidate-build', producer], ['independent-review-context', review], ['browser-e2e', browser], ['android', android], ['candidate-verification', final]];
  const checks = [
    check('required-jobs-present', required.every(([, job]) => Boolean(job)), 'trusted observation requires producer, review, browser, Android, and final jobs'),
    check('candidate-build-exact-head', Boolean(producer) && uniqueCheckout(producer, PR_HEAD), 'candidate-build must contain exactly one actions/checkout@v7 bound to the PR head'),
    check('candidate-output-exact-head', producer?.outputs?.['candidate-sha'] === '${{ steps.identity.outputs.candidate-sha }}', 'candidate-build must expose its runtime-asserted candidate-sha output'),
    check('review-context-exact-producer', Boolean(review) && uniqueCheckout(review, PRODUCER_HEAD), 'independent-review-context must check out the producer candidate-sha output'),
    check('browser-exact-producer', browser?.uses === './.github/workflows/browser-e2e.yml' && browser?.with?.candidate_sha === PRODUCER_HEAD, 'browser consumer must use the producer candidate-sha output'),
    check('android-exact-producer', android?.uses === './.github/workflows/pr-android-apk.yml' && android?.with?.candidate_sha === PRODUCER_HEAD, 'Android consumer must use the producer candidate-sha output'),
    check('final-exact-head', Boolean(final) && uniqueCheckout(final, PR_HEAD), 'final evidence checkout must use the immutable PR head'),
  ];
  const allowedRefs = new Set([PR_HEAD, PRODUCER_HEAD]);
  const checkoutRefs = [...jobs.values()].flatMap(job => checkoutSteps(job).map(step => step.with.ref ?? null));
  checks.push(check('no-synthetic-checkout-ref', checkoutRefs.length > 0 && checkoutRefs.every(ref => allowedRefs.has(ref)), 'checkout refs may use only PR head or producer exact SHA'));
  const failedCheckIds = checks.filter(entry => !entry.pass).map(entry => entry.id);
  return { checks, checkoutRefs, failedCheckIds, pass: failedCheckIds.length === 0 };
}

function replaceOnce(text, find, replacement) {
  const index = text.indexOf(find);
  ok(index >= 0, `self-test mutation target missing: ${find}`);
  return `${text.slice(0, index)}${replacement}${text.slice(index + find.length)}`;
}

function fixture() {
  return `name: PR Candidate Verification\non:\n  pull_request:\njobs:\n  candidate-build:\n    outputs:\n      candidate-sha: \${{ steps.identity.outputs.candidate-sha }}\n    steps:\n      - name: Check out exact candidate revision\n        uses: actions/checkout@v7\n        with:\n          ref: ${PR_HEAD}\n  independent-review-context:\n    steps:\n      - name: Check out exact candidate read-only\n        uses: actions/checkout@v7\n        with:\n          ref: ${PRODUCER_HEAD}\n  browser-e2e:\n    uses: ./.github/workflows/browser-e2e.yml\n    with:\n      candidate_sha: ${PRODUCER_HEAD}\n  android:\n    uses: ./.github/workflows/pr-android-apk.yml\n    with:\n      candidate_sha: ${PRODUCER_HEAD}\n  candidate-verification:\n    steps:\n      - name: Check out exact candidate revision for final evidence\n        uses: actions/checkout@v7\n        with:\n          ref: ${PR_HEAD}\n`;
}

export function selfTest() {
  const baseline = fixture();
  assert.equal(observeTrustedPrCandidateContract({ workflowText: baseline }).pass, true);
  assert.equal(observeTrustedPrCandidateContract({ workflowText: `# behavior-preserving control\n${baseline}` }).pass, true);
  const attacks = [
    [replaceOnce(baseline, `ref: ${PR_HEAD}`, 'ref: ${{ github.sha }}'), 'candidate-build-exact-head'],
    [replaceOnce(baseline, `candidate-sha: \${{ steps.identity.outputs.candidate-sha }}`, 'candidate-sha: ${{ github.sha }}'), 'candidate-output-exact-head'],
    [replaceOnce(baseline, `candidate_sha: ${PRODUCER_HEAD}`, 'candidate_sha: ${{ github.sha }}'), 'browser-exact-producer'],
    [replaceOnce(baseline, `      - name: Check out exact candidate revision for final evidence\n        uses: ${CHECKOUT_ACTION}\n        with:\n          ref: ${PR_HEAD}`, `      - name: Check out exact candidate revision for final evidence\n        uses: ${CHECKOUT_ACTION}\n        with:\n          ref: \${{ github.sha }}`), 'final-exact-head'],
  ];
  for (const [workflowText, expected] of attacks) {
    const result = observeTrustedPrCandidateContract({ workflowText });
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
  const result = observeTrustedPrCandidateContract({ workflowText });
  ok(result.pass, `trusted PR candidate observation failed: ${result.failedCheckIds.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_PASS candidate=${candidateSha} trustedBase=${trustedBaseSha} checks=${result.checks.length} falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') selfTest();
else if (command === 'verify') verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v2.mjs <self-test|verify>');
