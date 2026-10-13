import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PR_BASE = '${{ github.event.pull_request.base.sha }}';
const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const BASE_ATTACK_COUNT = 42;
const CANDIDATE_LOCKED_INSTALL = 'npm ci --ignore-scripts --no-audit --no-fund';
const TRUSTED_LOCKED_INSTALL = 'npm ci --no-audit --no-fund';
const TRUSTED_CONSUMER_DEPENDENCIES = [
  'scripts',
  'agent/tools/candidate-artifact.mjs',
  'tests/android-fast-smoke-contract.mjs',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'capacitor.config.ts',
];
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

function normalizeProducerPrefix(prefix) {
  return prefix.map(step => {
    const normalized = JSON.parse(JSON.stringify(step));
    if (normalized.name === 'Install locked dependencies') normalized.run = '__TRUSTED_LOCKED_INSTALL__';
    return normalized;
  });
}

function producerPrefix(workflowText, parsePrCandidateWorkflow) {
  const jobs = parsePrCandidateWorkflow(workflowText);
  const producer = jobs.get('candidate-build');
  const fullVerification = uniqueStep(producer, step => step.id === 'full-verification');
  const fullIndex = fullVerification ? (producer?.steps ?? []).indexOf(fullVerification) : -1;
  if (!producer || fullIndex < 0) return null;
  return producer.steps.slice(0, fullIndex);
}

function producerPrefixChecks(candidateWorkflowText, trustedWorkflowText, parsePrCandidateWorkflow) {
  const candidatePrefix = producerPrefix(candidateWorkflowText, parsePrCandidateWorkflow);
  const trustedPrefix = producerPrefix(trustedWorkflowText, parsePrCandidateWorkflow);
  const candidateInstall = candidatePrefix?.filter(step => step.name === 'Install locked dependencies') ?? [];
  const trustedInstall = trustedPrefix?.filter(step => step.name === 'Install locked dependencies') ?? [];
  const candidateInstallExact = candidateInstall.length === 1 && candidateInstall[0].run === CANDIDATE_LOCKED_INSTALL;
  const trustedInstallExact = trustedInstall.length === 1
    && [CANDIDATE_LOCKED_INSTALL, TRUSTED_LOCKED_INSTALL].includes(trustedInstall[0].run);
  return [
    {
      id: 'producer-prebuild-steps-trusted-exact',
      pass: Boolean(candidatePrefix)
        && Boolean(trustedPrefix)
        && candidateInstallExact
        && trustedInstallExact
        && JSON.stringify(normalizeProducerPrefix(candidatePrefix)) === JSON.stringify(normalizeProducerPrefix(trustedPrefix)),
      evidence: 'every producer step before isolated full verification must match the trusted-base prefix exactly, except the required ignore-scripts hardening, so no candidate-controlled PATH/environment mutation can run before Docker',
    },
  ];
}

function reviewContextChecks(candidateWorkflowText, trustedWorkflowText, parsePrCandidateWorkflow) {
  const candidateReview = parsePrCandidateWorkflow(candidateWorkflowText).get('independent-review-context');
  const trustedReview = parsePrCandidateWorkflow(trustedWorkflowText).get('independent-review-context');
  return [
    {
      id: 'review-context-semantics-trusted-exact',
      pass: Boolean(candidateReview)
        && Boolean(trustedReview)
        && JSON.stringify(candidateReview) === JSON.stringify(trustedReview),
      evidence: 'the complete parsed independent-review-context job must match trusted base, including task resolution, packet generation, environment bindings, step order, and artifact upload semantics',
    },
  ];
}

function dependencyChecks(candidateRefs = {}, trustedRefs = {}) {
  return TRUSTED_CONSUMER_DEPENDENCIES.map(path => ({
    id: `consumer-dependency-trusted-exact:${path}`,
    pass: typeof candidateRefs[path] === 'string'
      && candidateRefs[path].length > 0
      && candidateRefs[path] === trustedRefs[path],
    evidence: `${path} must resolve to the exact trusted-base Git object because browser/Android consumer verification executes or loads it`,
  }));
}

function exactRefMap(candidateRefs = {}, trustedRefs = {}) {
  const sortEntries = refs => Object.entries(refs).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(sortEntries(candidateRefs)) === JSON.stringify(sortEntries(trustedRefs));
}

function agentTrustChecks(candidateRefs = {}, trustedRefs = {}) {
  return [
    {
      id: 'producer-prebuild-agent-code-trusted-exact',
      pass: exactRefMap(candidateRefs, trustedRefs),
      evidence: 'all agent code outside task metadata and the isolated EV-9 observer family must resolve to trusted-base Git objects, preventing reviewed pre-build commands from executing candidate-modified helper code',
    },
  ];
}

export async function observeTrustedPrCandidateContractV6(candidateInputs, trustedInputs) {
  const v5 = await loadV5();
  const parser = await loadParser();
  const baseResult = await v5.observeTrustedPrCandidateContractV5(candidateInputs, trustedInputs);
  const additions = [
    ...scopeChecks(candidateInputs.workflowText, parser.parsePrCandidateWorkflow),
    ...producerPrefixChecks(candidateInputs.workflowText, trustedInputs.workflowText, parser.parsePrCandidateWorkflow),
    ...reviewContextChecks(candidateInputs.workflowText, trustedInputs.workflowText, parser.parsePrCandidateWorkflow),
    ...dependencyChecks(candidateInputs.dependencyRefs, trustedInputs.dependencyRefs),
    ...agentTrustChecks(candidateInputs.agentRefs, trustedInputs.agentRefs),
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

function gitCommand(...args) {
  return execFileSync('/usr/bin/git', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } }).trim();
}

function gitObjectRefs(revision = 'HEAD') {
  return Object.fromEntries(TRUSTED_CONSUMER_DEPENDENCIES.map(path => [path, gitCommand('rev-parse', `${revision}:${path}`)]));
}

function allowedAgentMutation(path) {
  return path === 'agent/task-graph.json'
    || /^agent\/tools\/ev9-trusted-pr-candidate-observer(?:-v\d+)?\.mjs$/.test(path);
}

function gitAgentRefs(revision = 'HEAD') {
  const tree = gitCommand('ls-tree', '-r', revision, '--', 'agent');
  const refs = {};
  for (const line of tree.split('\n').filter(Boolean)) {
    const match = line.match(/^\d+\s+\w+\s+([a-f0-9]{40})\t(.+)$/);
    ok(match, `unexpected git ls-tree entry: ${line}`);
    const [, objectSha, path] = match;
    if (!allowedAgentMutation(path)) refs[path] = objectSha;
  }
  return refs;
}

function liveFixture() {
  return {
    workflowText: readFileSync('.github/workflows/pr-candidate.yml', 'utf8'),
    browserWorkflowText: readFileSync('.github/workflows/browser-e2e.yml', 'utf8'),
    androidWorkflowText: readFileSync('.github/workflows/pr-android-apk.yml', 'utf8'),
    dependencyRefs: gitObjectRefs(),
    agentRefs: gitAgentRefs(),
  };
}

export async function selfTest() {
  const v5 = await loadV5();
  const trusted = liveFixture();
  await v5.selfTest();
  assert.equal((await observeTrustedPrCandidateContractV6(trusted, trusted)).pass, true, 'live browser scope, producer prefix, review context, and trusted dependency closure must satisfy exact semantics');

  const benign = {
    ...trusted,
    workflowText: `# behavior-preserving PR-candidate scope control\n${trusted.workflowText}`,
    dependencyRefs: { ...trusted.dependencyRefs },
    agentRefs: { ...trusted.agentRefs },
  };
  assert.equal((await observeTrustedPrCandidateContractV6(benign, trusted)).pass, true, 'behavior-preserving workflow comment must not create a false positive');

  const agentAttackPath = 'agent/tests/candidate-artifact.mjs';
  ok(trusted.agentRefs[agentAttackPath], `self-test trusted agent fixture is missing ${agentAttackPath}`);
  const fullVerificationHeader = '      - name: Run full repository verification and production build once\n        id: full-verification';
  const injectedDockerStep = `      - name: Inject fake Docker before isolated build\n        shell: bash\n        run: |\n          mkdir -p "$RUNNER_TEMP/fake-bin"\n          printf '%s\\n' '#!/bin/sh' 'exit 0' > "$RUNNER_TEMP/fake-bin/docker"\n          chmod +x "$RUNNER_TEMP/fake-bin/docker"\n          echo "$RUNNER_TEMP/fake-bin" >> "$GITHUB_PATH"\n\n${fullVerificationHeader}`;
  const attacks = [
    {
      expected: 'browser-scope-semantics-trusted-exact',
      candidateInputs: {
        ...trusted,
        workflowText: replaceOnce(trusted.workflowText, '                browser_required=true', '                browser_required=false'),
      },
    },
    {
      expected: 'browser-scope-semantics-trusted-exact',
      candidateInputs: {
        ...trusted,
        workflowText: replaceOnce(trusted.workflowText, '|.github/workflows/pr-candidate.yml)', ')'),
      },
    },
    {
      expected: 'browser-scope-semantics-trusted-exact',
      candidateInputs: {
        ...trusted,
        workflowText: replaceOnce(trusted.workflowText, 'echo "browser-required=$browser_required" >> "$GITHUB_OUTPUT"', 'echo "browser-required=false" >> "$GITHUB_OUTPUT"'),
      },
    },
    {
      expected: 'producer-prebuild-steps-trusted-exact',
      candidateInputs: {
        ...trusted,
        workflowText: replaceOnce(trusted.workflowText, fullVerificationHeader, injectedDockerStep),
      },
    },
    {
      expected: 'review-context-semantics-trusted-exact',
      candidateInputs: {
        ...trusted,
        workflowText: replaceOnce(
          trusted.workflowText,
          '          const selection = await selectReviewTask();',
          '          const selection = { taskId: "AO-8", mode: "bypass", source: "candidate" };',
        ),
      },
    },
    {
      expected: 'review-context-semantics-trusted-exact',
      candidateInputs: {
        ...trusted,
        workflowText: replaceOnce(trusted.workflowText, '            --verify-git', '            --skip-git-verification'),
      },
    },
    {
      expected: 'review-context-semantics-trusted-exact',
      candidateInputs: {
        ...trusted,
        workflowText: replaceOnce(
          trusted.workflowText,
          '          name: independent-review-context-${{ github.event.pull_request.number }}-${{ needs.candidate-build.outputs.candidate-sha }}',
          '          name: independent-review-context-untrusted',
        ),
      },
    },
    {
      expected: 'producer-prebuild-agent-code-trusted-exact',
      candidateInputs: {
        ...trusted,
        agentRefs: {
          ...trusted.agentRefs,
          [agentAttackPath]: '0000000000000000000000000000000000000000',
        },
      },
    },
    ...TRUSTED_CONSUMER_DEPENDENCIES.map(path => ({
      expected: `consumer-dependency-trusted-exact:${path}`,
      candidateInputs: {
        ...trusted,
        dependencyRefs: {
          ...trusted.dependencyRefs,
          [path]: '0000000000000000000000000000000000000000',
        },
      },
    })),
  ];

  for (const { candidateInputs, expected } of attacks) {
    const result = await observeTrustedPrCandidateContractV6(candidateInputs, trusted);
    assert.equal(result.pass, false, `trusted observer attack must fail: ${expected}`);
    assert.equal(result.failedCheckIds.includes(expected), true, `trusted observer attack must trigger ${expected}`);
  }

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V6_SELF_TEST_PASS falsePositives=0 falseNegatives=0 attacks=${BASE_ATTACK_COUNT + attacks.length}`);
}

export async function verify() {
  const v5 = await loadV5();
  const parser = await loadParser();
  await v5.verify();
  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  const trustedBaseSha = process.env.TRUSTED_BASE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  ok(trustedBaseSha, 'TRUSTED_BASE_SHA is required');
  ok(gitCommand('rev-parse', 'HEAD') === trustedBaseSha, 'trusted observer must execute from the exact trusted base SHA');
  const workflowText = gitCommand('show', `${candidateSha}:.github/workflows/pr-candidate.yml`);
  const trustedWorkflowText = gitCommand('show', `${trustedBaseSha}:.github/workflows/pr-candidate.yml`);
  const candidateRefs = gitObjectRefs(candidateSha);
  const trustedRefs = gitObjectRefs(trustedBaseSha);
  const candidateAgentRefs = gitAgentRefs(candidateSha);
  const trustedAgentRefs = gitAgentRefs(trustedBaseSha);
  const failed = [
    ...scopeChecks(workflowText, parser.parsePrCandidateWorkflow),
    ...producerPrefixChecks(workflowText, trustedWorkflowText, parser.parsePrCandidateWorkflow),
    ...reviewContextChecks(workflowText, trustedWorkflowText, parser.parsePrCandidateWorkflow),
    ...dependencyChecks(candidateRefs, trustedRefs),
    ...agentTrustChecks(candidateAgentRefs, trustedAgentRefs),
  ].filter(entry => !entry.pass).map(entry => entry.id);
  ok(failed.length === 0, `trusted PR candidate v6 observation failed: ${failed.join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V6_PASS candidate=${candidateSha} scopeChecks=1 producerPrefixChecks=1 reviewContextChecks=1 dependencyChecks=${TRUSTED_CONSUMER_DEPENDENCIES.length} agentTrustChecks=1 falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v6.mjs <self-test|verify>');
