import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const VITE_API = '${{ vars.VITE_API_BASE_URL }}';
const FULL_VERIFICATION_NAME = 'Run full repository verification and production build once';
const UPLOAD_NAME = 'Upload exact candidate web bundle';
const EV9_REGRESSION_NAME = 'Run promoted causal evidence independence regressions';
const EV9_GATE_NAME = 'Enforce promoted causal evidence independence scope';
const EV9_UPLOAD_NAME = 'Upload promoted causal evidence independence exact-SHA evidence';
const EV9_GATE_ARTIFACT = 'evidence-independence-gate-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}';
const TRUSTED_CONSUMER_DEPENDENCIES = [
  'scripts',
  'agent/tools/candidate-artifact.mjs',
  'tests/android-fast-smoke-contract.mjs',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'capacitor.config.ts',
];
const EV9_LIVE_AGENT_PATHS = new Set([
  'agent/evidence-independence-policy.json',
  'agent/evidence-independence.json',
  'agent/tests/evidence-independence-promotion.mjs',
  'agent/tests/pr-candidate-head-observer.mjs',
  'agent/tools/evidence-independence-gate.mjs',
  'agent/tools/evidence-independence-promotion-gate.mjs',
  'agent/tools/pr-candidate-build-surface.mjs',
  'agent/tools/pr-candidate-head-observer.mjs',
]);
const EV9_REGRESSION_SCRIPT = [
  'node agent/tests/evidence-independence-promotion.mjs',
  'node agent/tests/pr-candidate-head-observer.mjs',
];
const EV9_GATE_SCRIPT = [
  'node agent/tools/evidence-independence-promotion-gate.mjs gate \\',
  '--candidate-sha "$CANDIDATE_SHA" \\',
  '--graph agent/evidence-independence.json \\',
  '--policy agent/evidence-independence-policy.json \\',
  '--output .agent-independence/promotion-gate.json',
];

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function loadV7() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v8_import__';
  try {
    return await import('./ev9-trusted-pr-candidate-observer-v7.mjs');
  } finally {
    process.argv[2] = command;
  }
}

async function loadParser() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v8_parser_import__';
  try {
    return await import('./ev9-trusted-pr-candidate-observer-v2.mjs');
  } finally {
    process.argv[2] = command;
  }
}

function normalizedLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n').map(raw => ({
    raw,
    indent: raw.match(/^ */)?.[0].length ?? 0,
    text: raw.trim(),
  }));
}

function section(lines, headerIndent, headerText) {
  const start = lines.findIndex(line => line.indent === headerIndent && line.text === headerText);
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.text) continue;
    if (line.indent <= headerIndent) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end);
}

function directMapping(lines, keyIndent, key) {
  const start = lines.findIndex(line => line.indent === keyIndent && line.text === `${key}:`);
  if (start < 0) return null;
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.text) continue;
    if (line.indent <= keyIndent) break;
    if (line.indent === keyIndent + 2) values.push(line.text);
  }
  return values;
}

function keyPresentAtIndent(lines, indent, key) {
  return lines.some(line => line.indent === indent && (line.text === `${key}:` || line.text.startsWith(`${key}: `)));
}

function rootMappingPresent(lines, key) {
  return keyPresentAtIndent(lines, 0, key);
}

function jobMappingPresent(jobLines, key) {
  return jobLines ? keyPresentAtIndent(jobLines, 4, key) : false;
}

function fullVerificationBoundary(workflowText) {
  const lines = normalizedLines(workflowText);
  const producer = section(lines, 2, 'candidate-build:');
  const full = producer ? section(producer, 6, `- name: ${FULL_VERIFICATION_NAME}`) : null;
  const env = full ? directMapping(full, 8, 'env') : null;
  const directKeys = full
    ? full.filter(line => line.indent === 8 && line.text.includes(':')).map(line => line.text.split(':', 1)[0])
    : [];
  const exactEnv = env !== null
    && env.length === 2
    && env[0] === `CANDIDATE_SHA: ${PR_HEAD}`
    && env[1] === `VITE_API_BASE_URL: ${VITE_API}`;
  const exactStepShape = JSON.stringify(directKeys) === JSON.stringify(['id', 'env', 'run']);
  return [
    {
      id: 'candidate-workflow-no-global-shell-injection',
      pass: !rootMappingPresent(lines, 'env') && !rootMappingPresent(lines, 'defaults'),
      evidence: 'workflow-level env/defaults must not inject Bash startup files or override the reviewed shell',
    },
    {
      id: 'candidate-build-no-job-shell-injection',
      pass: Boolean(producer) && !['env', 'defaults', 'container', 'services'].some(key => jobMappingPresent(producer, key)),
      evidence: 'candidate-build may not define job-level env/defaults/container/services that alter the reviewed host execution boundary',
    },
    {
      id: 'candidate-full-verification-exact-execution-context',
      pass: Boolean(full) && exactEnv && exactStepShape,
      evidence: 'full-verification must have only the reviewed id/env/run keys and the exact CANDIDATE_SHA/VITE_API_BASE_URL environment, with no BASH_ENV or custom shell',
    },
  ];
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
  const left = Object.entries(actual ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const right = Object.entries(expected).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(left) === JSON.stringify(right);
}

function failClosedStep(step) {
  return Boolean(step) && !Object.hasOwn(step, 'if') && !Object.hasOwn(step, 'continue-on-error');
}

function liveIntegrationChecks(workflowText, ev9ChangedPaths, parsePrCandidateWorkflow) {
  const producer = parsePrCandidateWorkflow(workflowText).get('candidate-build');
  const steps = producer?.steps ?? [];
  const upload = stepByName(producer, UPLOAD_NAME);
  const regressions = stepByName(producer, EV9_REGRESSION_NAME);
  const gate = stepByName(producer, EV9_GATE_NAME);
  const evidence = stepByName(producer, EV9_UPLOAD_NAME);
  const uploadIndex = upload ? steps.indexOf(upload) : -1;
  const integrationIndexes = [regressions, gate, evidence].map(step => step ? steps.indexOf(step) : -1);
  const changed = ev9ChangedPaths.length > 0;
  const absent = regressions === null && gate === null && evidence === null;
  const exactSequence = changed
    && uploadIndex >= 0
    && JSON.stringify(integrationIndexes) === JSON.stringify([uploadIndex + 1, uploadIndex + 2, uploadIndex + 3]);
  const regressionExact = failClosedStep(regressions)
    && exactMap(regressions?.env, {})
    && !Object.hasOwn(regressions, 'shell')
    && exactRun(regressions, EV9_REGRESSION_SCRIPT);
  const gateExact = failClosedStep(gate)
    && !Object.hasOwn(gate, 'shell')
    && exactMap(gate?.env, { CANDIDATE_SHA: PR_HEAD })
    && exactRun(gate, EV9_GATE_SCRIPT);
  const uploadExact = failClosedStep(evidence)
    && evidence?.uses === 'actions/upload-artifact@v7'
    && exactMap(evidence?.with, {
      name: EV9_GATE_ARTIFACT,
      path: '.agent-independence/promotion-gate.json',
      'if-no-files-found': 'error',
      'include-hidden-files': 'true',
      'retention-days': '30',
    });
  return [
    {
      id: 'ev9-live-integration-required-iff-implementation-changed',
      pass: changed ? exactSequence : absent,
      evidence: changed
        ? `EV-9 implementation changes (${ev9ChangedPaths.join(',')}) require the exact three-step promotion block immediately after source-bound artifact publication`
        : 'non-EV-9 candidates must not inject the EV-9 live promotion block',
    },
    {
      id: 'ev9-live-regressions-fail-closed-exact',
      pass: changed ? regressionExact : true,
      evidence: 'EV-9 promotion regressions must run unconditionally with the reviewed commands after artifact publication',
    },
    {
      id: 'ev9-live-gate-fail-closed-exact',
      pass: changed ? gateExact : true,
      evidence: 'EV-9 promotion gate must run unconditionally for the exact PR head with the reviewed graph/policy/output arguments',
    },
    {
      id: 'ev9-live-evidence-upload-exact',
      pass: changed ? uploadExact : true,
      evidence: 'EV-9 exact-SHA promotion evidence must be uploaded with the reviewed artifact identity and fail-closed settings',
    },
  ];
}

function gitCommand(...args) {
  return execFileSync('/usr/bin/git', args, { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } }).trim();
}

function gitObjectRefs(revision) {
  return Object.fromEntries(TRUSTED_CONSUMER_DEPENDENCIES.map(path => [path, gitCommand('rev-parse', `${revision}:${path}`)]));
}

function allowedAgentMutation(path) {
  return path === 'agent/task-graph.json'
    || /^agent\/tools\/ev9-trusted-pr-candidate-observer(?:-v\d+)?\.mjs$/.test(path)
    || EV9_LIVE_AGENT_PATHS.has(path);
}

function gitAgentRefs(revision) {
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

function changedEv9Paths(baseSha, candidateSha) {
  const changed = gitCommand('diff', '--name-only', baseSha, candidateSha, '--').split('\n').filter(Boolean);
  return changed.filter(path => EV9_LIVE_AGENT_PATHS.has(path)).sort((a, b) => a.localeCompare(b));
}

function trustedInputsFor(revision) {
  return {
    workflowText: gitCommand('show', `${revision}:.github/workflows/pr-candidate.yml`),
    browserWorkflowText: gitCommand('show', `${revision}:.github/workflows/browser-e2e.yml`),
    androidWorkflowText: gitCommand('show', `${revision}:.github/workflows/pr-android-apk.yml`),
    dependencyRefs: gitObjectRefs(revision),
    agentRefs: gitAgentRefs(revision),
  };
}

function replaceOnce(text, find, replacement) {
  const index = text.indexOf(find);
  ok(index >= 0, `v8 self-test mutation target missing: ${find}`);
  return `${text.slice(0, index)}${replacement}${text.slice(index + find.length)}`;
}

function expectAttack(workflowText, expectedCheckId, label) {
  const failed = fullVerificationBoundary(workflowText).filter(check => !check.pass).map(check => check.id);
  assert.equal(failed.includes(expectedCheckId), true, `${label} must fail ${expectedCheckId}; failed=${failed.join(',')}`);
}

function fullVerificationHeader(extraLines = []) {
  return [
    `      - name: ${FULL_VERIFICATION_NAME}`,
    '        id: full-verification',
    '        env:',
    `          CANDIDATE_SHA: ${PR_HEAD}`,
    `          VITE_API_BASE_URL: ${VITE_API}`,
    ...extraLines,
    '        run: bash scripts/run-full-repository-build-proof.sh',
  ].join('\n');
}

function integrationBlock() {
  return [
    `      - name: ${EV9_REGRESSION_NAME}`,
    '        run: |',
    ...EV9_REGRESSION_SCRIPT.map(line => `          ${line}`),
    '',
    `      - name: ${EV9_GATE_NAME}`,
    '        env:',
    `          CANDIDATE_SHA: ${PR_HEAD}`,
    '        run: |',
    ...EV9_GATE_SCRIPT.map(line => `          ${line}`),
    '',
    `      - name: ${EV9_UPLOAD_NAME}`,
    '        uses: actions/upload-artifact@v7',
    '        with:',
    `          name: ${EV9_GATE_ARTIFACT}`,
    '          path: .agent-independence/promotion-gate.json',
    '          if-no-files-found: error',
    '          include-hidden-files: true',
    '          retention-days: 30',
    '',
  ].join('\n');
}

function removeIntegration(workflowText) {
  const startMarker = `\n      - name: ${EV9_REGRESSION_NAME}\n`;
  const endMarker = '\n  independent-review-context:';
  const start = workflowText.indexOf(startMarker);
  if (start < 0) return workflowText;
  const end = workflowText.indexOf(endMarker, start + startMarker.length);
  ok(end > start, 'v8 self-test live integration end marker missing');
  return `${workflowText.slice(0, start)}${workflowText.slice(end)}`;
}

function insertIntegrationAfterUpload(workflowText) {
  const marker = '\n  independent-review-context:';
  const index = workflowText.indexOf(marker);
  ok(index >= 0, 'v8 self-test independent-review-context marker missing');
  return `${workflowText.slice(0, index)}\n${integrationBlock()}${workflowText.slice(index)}`;
}

function insertIntegrationBeforeUpload(workflowText) {
  const marker = `      - name: ${UPLOAD_NAME}\n`;
  const index = workflowText.indexOf(marker);
  ok(index >= 0, 'v8 self-test artifact upload marker missing');
  return `${workflowText.slice(0, index)}${integrationBlock()}${workflowText.slice(index)}`;
}

export async function selfTest() {
  const v7 = await loadV7();
  const parser = await loadParser();
  await v7.selfTest();

  const workflowText = readFileSync('.github/workflows/pr-candidate.yml', 'utf8');
  assert.equal(fullVerificationBoundary(workflowText).every(check => check.pass), true, 'live PR Candidate workflow must satisfy the reviewed producer execution boundary');
  assert.equal(fullVerificationBoundary(`# behavior-preserving v8 comment\n${workflowText}`).every(check => check.pass), true, 'behavior-preserving comment must not create a v8 false positive');

  const stepEnvAttack = replaceOnce(workflowText, fullVerificationHeader(), fullVerificationHeader(['          BASH_ENV: ./candidate-hook.sh']));
  expectAttack(stepEnvAttack, 'candidate-full-verification-exact-execution-context', 'step-level BASH_ENV injection');

  const jobEnvAttack = replaceOnce(workflowText, '    timeout-minutes: 35\n    outputs:', '    timeout-minutes: 35\n    env:\n      BASH_ENV: ./candidate-hook.sh\n    outputs:');
  expectAttack(jobEnvAttack, 'candidate-build-no-job-shell-injection', 'job-level BASH_ENV injection');

  const workflowEnvAttack = replaceOnce(workflowText, 'permissions:\n', 'env:\n  BASH_ENV: ./candidate-hook.sh\n\npermissions:\n');
  expectAttack(workflowEnvAttack, 'candidate-workflow-no-global-shell-injection', 'workflow-level BASH_ENV injection');

  const customShellAttack = replaceOnce(workflowText, fullVerificationHeader(), fullVerificationHeader(['        shell: bash --rcfile ./candidate-hook.sh {0}']));
  expectAttack(customShellAttack, 'candidate-full-verification-exact-execution-context', 'custom shell startup injection');

  const jobDefaultsAttack = replaceOnce(workflowText, '    timeout-minutes: 35\n    outputs:', '    timeout-minutes: 35\n    defaults:\n      run:\n        shell: bash --rcfile ./candidate-hook.sh {0}\n    outputs:');
  expectAttack(jobDefaultsAttack, 'candidate-build-no-job-shell-injection', 'job-level default shell injection');

  const containerAttack = replaceOnce(workflowText, '    timeout-minutes: 35\n    outputs:', '    timeout-minutes: 35\n    container: candidate-controlled:latest\n    outputs:');
  expectAttack(containerAttack, 'candidate-build-no-job-shell-injection', 'job-level container substitution');

  const changedPath = [...EV9_LIVE_AGENT_PATHS][0];
  const withoutIntegration = removeIntegration(workflowText);
  const noIntegration = liveIntegrationChecks(withoutIntegration, [changedPath], parser.parsePrCandidateWorkflow);
  assert.equal(noIntegration.find(check => check.id === 'ev9-live-integration-required-iff-implementation-changed')?.pass, false, 'EV-9 implementation change without live integration must fail');

  const integrated = insertIntegrationAfterUpload(withoutIntegration);
  assert.equal(liveIntegrationChecks(integrated, [changedPath], parser.parsePrCandidateWorkflow).every(check => check.pass), true, 'exact post-publication EV-9 live integration must pass');
  if (workflowText.includes(`- name: ${EV9_REGRESSION_NAME}`)) {
    assert.equal(liveIntegrationChecks(workflowText, [changedPath], parser.parsePrCandidateWorkflow).every(check => check.pass), true, 'live EV-9 candidate integration must satisfy the reviewed block');
  }

  const beforeUpload = insertIntegrationBeforeUpload(withoutIntegration);
  assert.equal(liveIntegrationChecks(beforeUpload, [changedPath], parser.parsePrCandidateWorkflow).find(check => check.id === 'ev9-live-integration-required-iff-implementation-changed')?.pass, false, 'pre-publication EV-9 integration must fail');

  const bypassGate = replaceOnce(integrated, 'node agent/tools/evidence-independence-promotion-gate.mjs gate \\', 'echo bypass \\');
  assert.equal(liveIntegrationChecks(bypassGate, [changedPath], parser.parsePrCandidateWorkflow).find(check => check.id === 'ev9-live-gate-fail-closed-exact')?.pass, false, 'neutralized EV-9 gate must fail');

  const live = trustedInputsFor('HEAD');
  const baseline = await v7.observeTrustedPrCandidateContractV7(live, live);
  assert.equal(baseline.pass, true, 'filtered trusted-agent baseline must satisfy v7 semantics');
  const unrelatedPath = 'agent/tests/candidate-artifact.mjs';
  assert.ok(live.agentRefs[unrelatedPath], `trusted agent fixture missing ${unrelatedPath}`);
  assert.equal(live.agentRefs[changedPath], undefined, 'allowed EV-9 live path must be excluded from trusted agent pin map');
  const unrelatedAttack = await v7.observeTrustedPrCandidateContractV7({
    ...live,
    agentRefs: { ...live.agentRefs, [unrelatedPath]: '0000000000000000000000000000000000000000' },
  }, live);
  assert.equal(unrelatedAttack.pass, false, 'unrelated agent helper mutation must remain rejected');
  assert.equal(unrelatedAttack.failedCheckIds.includes('producer-prebuild-agent-code-trusted-exact'), true, 'unrelated agent helper mutation must trigger trusted agent-code check');

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V8_SELF_TEST_PASS falsePositives=0 falseNegatives=0 executionBoundaryAttacks=6 liveIntegrationAttacks=3 allowedEv9Paths=${EV9_LIVE_AGENT_PATHS.size}`);
}

export async function verify() {
  const v7 = await loadV7();
  const parser = await loadParser();
  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  const trustedBaseSha = process.env.TRUSTED_BASE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  ok(trustedBaseSha, 'TRUSTED_BASE_SHA is required');
  ok(gitCommand('rev-parse', 'HEAD') === trustedBaseSha, 'trusted observer must execute from the exact trusted base SHA');

  const candidateInputs = trustedInputsFor(candidateSha);
  const trustedInputs = trustedInputsFor(trustedBaseSha);
  const v7Result = await v7.observeTrustedPrCandidateContractV7(candidateInputs, trustedInputs);
  ok(v7Result.pass, `trusted PR candidate v7-compatible observation failed: ${v7Result.failedCheckIds.join(',')}`);

  const boundaryFailures = fullVerificationBoundary(candidateInputs.workflowText).filter(check => !check.pass);
  ok(boundaryFailures.length === 0, `trusted PR candidate v8 execution boundary failed: ${boundaryFailures.map(check => `${check.id} (${check.evidence})`).join(',')}`);

  const ev9Paths = changedEv9Paths(trustedBaseSha, candidateSha);
  const integrationFailures = liveIntegrationChecks(candidateInputs.workflowText, ev9Paths, parser.parsePrCandidateWorkflow).filter(check => !check.pass);
  ok(integrationFailures.length === 0, `trusted PR candidate EV-9 live integration failed: ${integrationFailures.map(check => `${check.id} (${check.evidence})`).join(',')}`);

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V8_PASS candidate=${candidateSha} executionBoundaryChecks=3 ev9ChangedPaths=${ev9Paths.length} liveIntegrationChecks=4 falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v8.mjs <self-test|verify>');
