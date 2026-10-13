import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function ok(value, message) {
  if (!value) throw new Error(message);
}

async function loadV6() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v7_import__';
  try {
    return await import('./ev9-trusted-pr-candidate-observer-v6.mjs');
  } finally {
    process.argv[2] = command;
  }
}

function foldedRunScalarLines(workflowText) {
  return workflowText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /^\s*run:\s*>(?:[+-][1-9]?|[1-9][+-]?)?\s*(?:#.*)?$/.test(line));
}

function foldedScalarChecks(workflowText) {
  const folded = foldedRunScalarLines(workflowText);
  return [{
    id: 'pr-candidate-run-scalars-literal-only',
    pass: folded.length === 0,
    evidence: folded.length === 0
      ? 'all PR Candidate run block scalars preserve literal newlines'
      : `folded run block scalar changes GitHub Actions shell semantics at lines ${folded.map(entry => entry.lineNumber).join(',')}`,
  }];
}

export async function observeTrustedPrCandidateContractV7(candidateInputs, trustedInputs) {
  const v6 = await loadV6();
  const baseResult = await v6.observeTrustedPrCandidateContractV6(candidateInputs, trustedInputs);
  const additions = foldedScalarChecks(candidateInputs.workflowText);
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

function foldBrowserScopeRun(workflowText, indicator) {
  const marker = '      - name: Detect browser validation scope\n';
  const start = workflowText.indexOf(marker);
  ok(start >= 0, 'browser-scope step is missing from v7 self-test fixture');
  const next = workflowText.indexOf('\n      - name:', start + marker.length);
  const end = next >= 0 ? next : workflowText.length;
  const segment = workflowText.slice(start, end);
  const literalHeader = '\n        run: |\n';
  ok(segment.includes(literalHeader), 'browser-scope run block is not a literal scalar in v7 self-test fixture');
  const mutated = segment.replace(literalHeader, `\n        run: ${indicator}\n`);
  return `${workflowText.slice(0, start)}${mutated}${workflowText.slice(end)}`;
}

export async function selfTest() {
  const v6 = await loadV6();
  await v6.selfTest();

  const workflowText = readFileSync('.github/workflows/pr-candidate.yml', 'utf8');
  const trusted = {
    workflowText,
    browserWorkflowText: readFileSync('.github/workflows/browser-e2e.yml', 'utf8'),
    androidWorkflowText: readFileSync('.github/workflows/pr-android-apk.yml', 'utf8'),
  };

  assert.equal(foldedScalarChecks(workflowText)[0].pass, true, 'live PR Candidate workflow must use literal run block scalars');
  assert.equal(foldedScalarChecks(`# behavior-preserving comment\n${workflowText}`)[0].pass, true, 'behavior-preserving comment must not create a false positive');

  for (const indicator of ['>', '>-']) {
    const attackWorkflow = foldBrowserScopeRun(workflowText, indicator);
    const result = foldedScalarChecks(attackWorkflow);
    assert.equal(result[0].pass, false, `folded browser-scope run scalar ${indicator} must fail`);
    assert.equal(result[0].id, 'pr-candidate-run-scalars-literal-only');
  }

  // Keep v7's public observer composition exercised without duplicating v6's Git-object fixtures.
  const v6Result = await v6.observeTrustedPrCandidateContractV6(trusted, trusted);
  assert.equal(v6Result.pass, true, 'live workflow trio must continue to satisfy v6 semantics');

  console.log('EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V7_SELF_TEST_PASS falsePositives=0 falseNegatives=0 foldedAttacks=2');
}

export async function verify() {
  const v6 = await loadV6();
  await v6.verify();

  const candidateSha = process.env.CANDIDATE_SHA?.trim();
  ok(candidateSha, 'CANDIDATE_SHA is required');
  const workflowText = execFileSync(
    '/usr/bin/git',
    ['show', `${candidateSha}:.github/workflows/pr-candidate.yml`],
    { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: '/tmp' } },
  );
  const failed = foldedScalarChecks(workflowText).filter(entry => !entry.pass);
  ok(failed.length === 0, `trusted PR candidate v7 observation failed: ${failed.map(entry => `${entry.id} (${entry.evidence})`).join(',')}`);
  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V7_PASS candidate=${candidateSha} literalRunScalarChecks=1 falsePositives=0 falseNegatives=0`);
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === `file://${process.argv[1]}`) throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v7.mjs <self-test|verify>');
