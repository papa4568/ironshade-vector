import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE_ATTACK_COUNT = 35;

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function loadV4() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v5_import__';
  try {
    return await import('./ev9-trusted-pr-candidate-observer-v4.mjs');
  } finally {
    process.argv[2] = command;
  }
}

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n');
}

function downstreamTrustedChecks(candidateInputs, trustedInputs) {
  return [
    {
      id: 'browser-consumer-workflow-trusted-exact',
      pass: normalizeText(candidateInputs.browserWorkflowText) === normalizeText(trustedInputs.browserWorkflowText),
      evidence: 'the browser reusable workflow must be byte-equivalent to the exact trusted-base workflow, so candidate code cannot replace or bypass the verified player journey or artifact-consumption semantics',
    },
    {
      id: 'android-consumer-workflow-trusted-exact',
      pass: normalizeText(candidateInputs.androidWorkflowText) === normalizeText(trustedInputs.androidWorkflowText),
      evidence: 'the Android reusable workflow must be byte-equivalent to the exact trusted-base workflow, so candidate code cannot replace packaging, APK validation, emulator actions, smoke scripts, or artifact-consumption semantics',
    },
  ];
}

export async function observeTrustedPrCandidateContractV5(candidateInputs, trustedInputs) {
  const v4 = await loadV4();
  const baseResult = await v4.observeTrustedPrCandidateContractV4(candidateInputs);
  const additions = downstreamTrustedChecks(candidateInputs, trustedInputs);
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
  const v4 = await loadV4();
  await v4.selfTest();

  const trusted = liveFixture();
  assert.equal((await observeTrustedPrCandidateContractV5(trusted, trusted)).pass, true, 'live downstream consumer workflows must match the reviewed trusted reference');

  const benign = {
    ...trusted,
    workflowText: `# behavior-preserving PR-candidate control\n${trusted.workflowText}`,
  };
  assert.equal((await observeTrustedPrCandidateContractV5(benign, trusted)).pass, true, 'behavior-preserving PR-candidate comment must not create a false positive');

  const browserInjection = `      - name: Candidate-controlled browser bypass\n        run: echo bypass\n\n      - name: Start production preview`;
  const androidInjection = `      - name: Candidate-controlled Android bundle rewrite\n        run: rm -rf dist\n\n      - name: Generate native Android project from verified bundle`;
  const emulatorAction = 'uses: ReactiveCircus/android-emulator-runner@v2.38.0';
  const attacks = [
    [
      { ...trusted, browserWorkflowText: replaceOnce(trusted.browserWorkflowText, 'node scripts/verify-authored-operator.mjs', 'echo browser-player-journey-bypass') },
      'browser-consumer-workflow-trusted-exact',
    ],
    [
      { ...trusted, browserWorkflowText: replaceOnce(trusted.browserWorkflowText, '      - name: Start production preview', browserInjection) },
      'browser-consumer-workflow-trusted-exact',
    ],
    [
      { ...trusted, androidWorkflowText: replaceOnce(trusted.androidWorkflowText, 'npx cap sync android', 'echo android-generation-bypass') },
      'android-consumer-workflow-trusted-exact',
    ],
    [
      { ...trusted, androidWorkflowText: replaceOnce(trusted.androidWorkflowText, 'if ./gradlew assembleDebug --no-daemon --stacktrace; then', 'if true; then') },
      'android-consumer-workflow-trusted-exact',
    ],
    [
      { ...trusted, androidWorkflowText: replaceOnce(trusted.androidWorkflowText, emulatorAction, 'uses: actions/checkout@v7') },
      'android-consumer-workflow-trusted-exact',
    ],
    [
      { ...trusted, androidWorkflowText: replaceLast(trusted.androidWorkflowText, emulatorAction, 'uses: actions/checkout@v7') },
      'android-consumer-workflow-trusted-exact',
    ],
    [
      { ...trusted, androidWorkflowText: replaceOnce(trusted.androidWorkflowText, '      - name: Generate native Android project from verified bundle', androidInjection) },
      'android-consumer-workflow-trusted-exact',
    ],
  ];

  for (const [candidateInputs, expected] of attacks) {
    const result = await observeTrustedPrCandidateContractV5(candidateInputs, trusted);
    assert.equal(result.pass, false, `dishonest downstream consumer mutation must fail: ${expected}`);
    assert.equal(result.failedCheckIds.includes(expected), true, `dishonest downstream consumer mutation must trigger ${expected}`);
  }

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V5_SELF_TEST_PASS falsePositives=0 falseNegatives=0 attacks=${BASE_ATTACK_COUNT + attacks.length}`);
}

export async function verify() {
  const v4 = await loadV4();
  await v4.verify();

  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  const git = (...args) => execFileSync('/usr/bin/git', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } }).trim();
  const candidateInputs = {
    workflowText: git('show', `${candidateSha}:.github/workflows/pr-candidate.yml`),
    browserWorkflowText: git('show', `${candidateSha}:.github/workflows/browser-e2e.yml`),
    androidWorkflowText: git('show', `${candidateSha}:.github/workflows/pr-android-apk.yml`),
  };
  const trustedInputs = {
    workflowText: readFileSync('.github/workflows/pr-candidate.yml', 'utf8'),
    browserWorkflowText: readFileSync('.github/workflows/browser-e2e.yml', 'utf8'),
    androidWorkflowText: readFileSync('.github/workflows/pr-android-apk.yml', 'utf8'),
  };
  const failed = downstreamTrustedChecks(candidateInputs, trustedInputs).filter(entry => !entry.pass).map(entry => entry.id);
  ok(failed.length === 0, `trusted PR candidate v5 observation failed: ${failed.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V5_PASS candidate=${candidateSha} downstreamChecks=2 falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v5.mjs <self-test|verify>');
