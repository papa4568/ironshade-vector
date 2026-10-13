import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const VITE_API = '${{ vars.VITE_API_BASE_URL }}';
const FULL_VERIFICATION_NAME = 'Run full repository verification and production build once';

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

function rootMappingPresent(lines, key) {
  return lines.some(line => line.indent === 0 && line.text === `${key}:`);
}

function jobMappingPresent(jobLines, key) {
  return jobLines?.some(line => line.indent === 4 && line.text === `${key}:`) ?? false;
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

  const checks = [
    {
      id: 'candidate-workflow-no-global-shell-injection',
      pass: !rootMappingPresent(lines, 'env') && !rootMappingPresent(lines, 'defaults'),
      evidence: 'workflow-level env/defaults must not inject Bash startup files or override the reviewed shell',
    },
    {
      id: 'candidate-build-no-job-shell-injection',
      pass: Boolean(producer)
        && !['env', 'defaults', 'container', 'services'].some(key => jobMappingPresent(producer, key)),
      evidence: 'candidate-build may not define job-level env/defaults/container/services that alter the reviewed host execution boundary',
    },
    {
      id: 'candidate-full-verification-exact-execution-context',
      pass: Boolean(full) && exactEnv && exactStepShape,
      evidence: 'full-verification must have only the reviewed id/env/run keys and the exact CANDIDATE_SHA/VITE_API_BASE_URL environment, with no BASH_ENV or custom shell',
    },
  ];
  return checks;
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

export async function selfTest() {
  const v7 = await loadV7();
  await v7.selfTest();

  const workflowText = readFileSync('.github/workflows/pr-candidate.yml', 'utf8');
  assert.equal(fullVerificationBoundary(workflowText).every(check => check.pass), true, 'live PR Candidate workflow must satisfy the reviewed producer execution boundary');
  assert.equal(fullVerificationBoundary(`# behavior-preserving v8 comment\n${workflowText}`).every(check => check.pass), true, 'behavior-preserving comment must not create a v8 false positive');

  const stepEnvAttack = replaceOnce(
    workflowText,
    `          VITE_API_BASE_URL: ${VITE_API}\n        run: |`,
    `          VITE_API_BASE_URL: ${VITE_API}\n          BASH_ENV: ./candidate-hook.sh\n        run: |`,
  );
  expectAttack(stepEnvAttack, 'candidate-full-verification-exact-execution-context', 'step-level BASH_ENV injection');

  const jobEnvAttack = replaceOnce(
    workflowText,
    '    timeout-minutes: 35\n    outputs:',
    '    timeout-minutes: 35\n    env:\n      BASH_ENV: ./candidate-hook.sh\n    outputs:',
  );
  expectAttack(jobEnvAttack, 'candidate-build-no-job-shell-injection', 'job-level BASH_ENV injection');

  const workflowEnvAttack = replaceOnce(
    workflowText,
    'permissions:\n',
    'env:\n  BASH_ENV: ./candidate-hook.sh\n\npermissions:\n',
  );
  expectAttack(workflowEnvAttack, 'candidate-workflow-no-global-shell-injection', 'workflow-level BASH_ENV injection');

  const customShellAttack = replaceOnce(
    workflowText,
    `          VITE_API_BASE_URL: ${VITE_API}\n        run: |`,
    `          VITE_API_BASE_URL: ${VITE_API}\n        shell: bash --rcfile ./candidate-hook.sh {0}\n        run: |`,
  );
  expectAttack(customShellAttack, 'candidate-full-verification-exact-execution-context', 'custom shell startup injection');

  const jobDefaultsAttack = replaceOnce(
    workflowText,
    '    timeout-minutes: 35\n    outputs:',
    '    timeout-minutes: 35\n    defaults:\n      run:\n        shell: bash --rcfile ./candidate-hook.sh {0}\n    outputs:',
  );
  expectAttack(jobDefaultsAttack, 'candidate-build-no-job-shell-injection', 'job-level default shell injection');

  const containerAttack = replaceOnce(
    workflowText,
    '    timeout-minutes: 35\n    outputs:',
    '    timeout-minutes: 35\n    container: candidate-controlled:latest\n    outputs:',
  );
  expectAttack(containerAttack, 'candidate-build-no-job-shell-injection', 'job-level container substitution');

  console.log('EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V8_SELF_TEST_PASS falsePositives=0 falseNegatives=0 executionBoundaryAttacks=6');
}

export async function verify() {
  const v7 = await loadV7();
  await v7.verify();

  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  const workflowText = execFileSync(
    '/usr/bin/git',
    ['show', `${candidateSha}:.github/workflows/pr-candidate.yml`],
    { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } },
  );
  const failed = fullVerificationBoundary(workflowText).filter(check => !check.pass);
  ok(failed.length === 0, `trusted PR candidate v8 observation failed: ${failed.map(check => `${check.id} (${check.evidence})`).join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V8_PASS candidate=${candidateSha} executionBoundaryChecks=3 falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v8.mjs <self-test|verify>');
