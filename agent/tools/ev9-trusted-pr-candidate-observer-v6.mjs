import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PR_BASE = '${{ github.event.pull_request.base.sha }}';
const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const BASE_ATTACK_COUNT = 42;
const SCOPE_SCRIPT = [
  'set -euo pipefail',
  'browser_required=false',
  'while IFS= read -r path; do',
  'case "$path" in',
  'src/*|tests/*|scripts/*|package.json|package-lock.json|.nvmrc|vite.config.ts|index.html|.github/workflows/browser-e2e.yml|.github/workflows/pr-candidate.yml)',
  'browser_required=true',
  'break',
  ';;',
  'esac',
  'done < <(git diff --name-only "$BASE_SHA...$HEAD_SHA")',
  'echo "browser-required=$browser_required" >> "$GITHUB_OUTPUT"',
  'echo "PR_CANDIDATE_BROWSER_REQUIRED value=$browser_required"',
];

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function loadV5() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v6_import__';
  try {
    return await import('./ev9-trusted-pr-candidate-observer-v5.mjs');
  } finally {
    process.argv[2] = command;
  }
}

async function loadParser() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v6_parser_import__';
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

function runLines(step) {
  return (step?.run ?? '').split('\n').map(line => line.trim()).filter(Boolean);
}

function exactRun(step, expected) {
  return JSON.stringify(runLines(step)) === JSON.stringify(expected);
}

function scopeChecks(workflowText, parsePrCandidateWorkflow) {
  const jobs = parsePrCandidateWorkflow(workflowText);
  const producer = jobs.get('candidate-build');
  const scope = uniqueStep(producer, step => step.id === 'scope');
  return [
    {
      id: 'browser-scope-semantics-trusted-exact',
      pass: Boolean(scope)
        && scope.name === 'Detect browser validation scope'
        && scope.shell === 'bash'
        && scope.env?.BASE_SHA === PR_BASE
        && scope.env?.HEAD_SHA === PR_HEAD
        && !Object.hasOwn(scope, 'if')
        && !Object.hasOwn(scope, 'continue-on-error')
        && exactRun(scope, SCOPE_SCRIPT),
      evidence: 'browser-required must be computed by the exact reviewed fail-closed diff classifier, including PR-candidate workflow changes, and may not be candidate-forced false',
    },
  ];
}

export async function observeTrustedPrCandidateContractV6(candidateInputs, trustedInputs) {
  const v5 = await loadV5();
  const parser = await loadParser();
  const baseResult = await v5.observeTrustedPrCandidateContractV5(candidateInputs, trustedInputs);
  const additions = scopeChecks(candidateInputs.workflowText, parser.parsePrCandidateWorkflow);
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

function liveFixture() {
  return {
    workflowText: readFileSync('.github/workflows/pr-candidate.yml', 'utf8'),
    browserWorkflowText: readFileSync('.github/workflows/browser-e2e.yml', 'utf8'),
    androidWorkflowText: readFileSync('.github/workflows/pr-android-apk.yml', 'utf8'),
  };
}

export async function selfTest() {
  const v5 = await loadV5();
  const trusted = liveFixture();
  await v5.selfTest();
  assert.equal((await observeTrustedPrCandidateContractV6(trusted, trusted)).pass, true, 'live browser scope must satisfy the trusted exact semantics');

  const benign = {
    ...trusted,
    workflowText: `# behavior-preserving PR-candidate scope control\n${trusted.workflowText}`,
  };
  assert.equal((await observeTrustedPrCandidateContractV6(benign, trusted)).pass, true, 'behavior-preserving workflow comment must not create a false positive');

  const attacks = [
    {
      ...trusted,
      workflowText: replaceOnce(trusted.workflowText, '                browser_required=true', '                browser_required=false'),
    },
    {
      ...trusted,
      workflowText: replaceOnce(trusted.workflowText, '|.github/workflows/pr-candidate.yml)', ')'),
    },
    {
      ...trusted,
      workflowText: replaceOnce(trusted.workflowText, 'echo "browser-required=$browser_required" >> "$GITHUB_OUTPUT"', 'echo "browser-required=false" >> "$GITHUB_OUTPUT"'),
    },
  ];

  for (const candidateInputs of attacks) {
    const result = await observeTrustedPrCandidateContractV6(candidateInputs, trusted);
    assert.equal(result.pass, false, 'browser scope suppression mutation must fail');
    assert.equal(result.failedCheckIds.includes('browser-scope-semantics-trusted-exact'), true, 'browser scope suppression mutation must trigger exact scope semantics check');
  }

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V6_SELF_TEST_PASS falsePositives=0 falseNegatives=0 attacks=${BASE_ATTACK_COUNT + attacks.length}`);
}

export async function verify() {
  const v5 = await loadV5();
  const parser = await loadParser();
  await v5.verify();
  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  const git = (...args) => execFileSync('/usr/bin/git', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } }).trim();
  const workflowText = git('show', `${candidateSha}:.github/workflows/pr-candidate.yml`);
  const failed = scopeChecks(workflowText, parser.parsePrCandidateWorkflow).filter(entry => !entry.pass).map(entry => entry.id);
  ok(failed.length === 0, `trusted PR candidate v6 observation failed: ${failed.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V6_PASS candidate=${candidateSha} scopeChecks=1 falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v6.mjs <self-test|verify>');
