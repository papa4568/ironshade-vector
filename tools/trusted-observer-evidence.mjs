import assert from 'node:assert/strict';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReviewChangedFiles, requiresOrchestrationReview } from './review-scope.mjs';

const TRUSTED_WORKFLOW = '.github/workflows/ev9-trusted-pr-candidate-observer.yml';
const TRUSTED_WORKFLOW_ID = 382383641;
const REPO = 'papa4568/ironshade-vector';
const SHA = /^[a-f0-9]{40}$/;

function ok(condition, message) { assert(condition, message); }

export function verifyTrustedObserverEvidence({ runs, jobs, logs, sha, base, pr }) {
  ok(SHA.test(sha) && SHA.test(base) && Number.isInteger(pr) && pr > 0, 'trusted observer identity invalid');
  ok(Array.isArray(runs), 'trusted observer run inventory missing');
  const matching = runs.filter(run => (
    run.workflow_id === TRUSTED_WORKFLOW_ID &&
    run.path === TRUSTED_WORKFLOW &&
    run.event === 'pull_request_target' &&
    run.head_sha === sha &&
    (run.pull_requests || []).some(pull => pull.number === pr &&
      pull.head?.sha === sha && pull.base?.sha === base)
  ));
  ok(matching.length === 1, 'expected exactly one exact-head, owner-trusted EV-9 target run');
  const run = matching[0];
  ok(run.status === 'completed' && run.conclusion === 'success', 'trusted EV-9 observer not completed successfully');
  ok(Array.isArray(jobs), 'trusted EV-9 job inventory missing');
  const verifyJobs = jobs.filter(job => job.name === 'verify-pr-candidate');
  ok(verifyJobs.length === 1, 'trusted EV-9 verify job is missing or ambiguous');
  const job = verifyJobs[0];
  ok(job.status === 'completed' && job.conclusion === 'success', 'trusted EV-9 verify job did not pass');
  ok(job.run_id === undefined || job.run_id === run.id, 'trusted EV-9 job has wrong run ID');
  ok(Array.isArray(job.steps) && job.steps.some(step =>
    step.name.includes('Verify') && step.conclusion === 'success'
  ), 'trusted EV-9 job did not execute a successful verifier step');
  const marker = 'EV9_TRUSTED_V11_VERIFY_PASS mode=ev18-hardened-steady candidate=' +
    sha + ' trustedBase=' + base;
  ok(typeof logs === 'string' && logs.includes(marker), 'trusted EV-9 execution log lacks exact-head pass marker');
  return {
    repository: REPO, task: 'AO-18', prNumber: pr, candidateSha: sha, trustedBaseSha: base,
    workflowPath: TRUSTED_WORKFLOW, workflowId: TRUSTED_WORKFLOW_ID,
    workflowRunId: run.id, verificationJobId: job.id, marker,
    evidenceKind: 'read-only GitHub Actions pull_request_target job and log',
  };
}

export function trustedObserverStepOutputs(evidence) {
  ok(Number.isInteger(evidence?.workflowRunId) && evidence.workflowRunId > 0, 'trusted observer run id invalid');
  ok(Number.isInteger(evidence?.verificationJobId) && evidence.verificationJobId > 0, 'trusted observer job id invalid');
  ok(SHA.test(evidence.candidateSha) && SHA.test(evidence.trustedBaseSha), 'trusted observer SHA identity invalid');
  ok(evidence.marker === 'EV9_TRUSTED_V11_VERIFY_PASS mode=ev18-hardened-steady candidate=' +
    evidence.candidateSha + ' trustedBase=' + evidence.trustedBaseSha, 'trusted observer pass marker malformed');
  return [
    'target_run_id=' + evidence.workflowRunId,
    'target_job_id=' + evidence.verificationJobId,
    'candidate_sha=' + evidence.candidateSha,
    'trusted_base_sha=' + evidence.trustedBaseSha,
    'verification_marker=' + evidence.marker,
  ].join('\n') + '\n';
}

export function parseObserverReceiptArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const option = argv[i];
    ok(['--base', '--head', '--pr'].includes(option), 'unknown trusted observer argument');
    ok(argv[i + 1] && !argv[i + 1].startsWith('--') && !(option in args), 'missing or duplicate trusted observer argument');
    args[option] = argv[i + 1];
  }
  ok(SHA.test(args['--base'] || '') && SHA.test(args['--head'] || ''), 'exact full base/head SHAs required');
  const pr = Number(args['--pr']);
  ok(Number.isInteger(pr) && pr > 0 && String(pr) === args['--pr'], 'valid PR number required');
  return { base: args['--base'], head: args['--head'], pr };
}

async function main() {
  const { base, head, pr } = parseObserverReceiptArgs(process.argv.slice(2));
  const files = collectReviewChangedFiles({ base, head });
  if (!requiresOrchestrationReview(files)) {
    console.log('TRUSTED_EV9_OBSERVATION_NOT_APPLICABLE process=false');
    return;
  }
  const token = process.env.GITHUB_TOKEN;
  ok(typeof token === 'string' && token.length > 0, 'read-only GitHub Actions token required');
  ok(process.env.GITHUB_REPOSITORY === REPO, 'unexpected source repository');
  async function api(path, asText = false) {
    const response = await fetch('https://api.github.com/repos/' + REPO + path, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    ok(response.ok, 'read-only trusted EV-9 evidence unavailable (HTTP ' + response.status + ')');
    return asText ? response.text() : response.json();
  }
  let found;
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await api('/actions/runs?event=pull_request_target&head_sha=' + head + '&per_page=100');
    ok(Array.isArray(result.workflow_runs) && result.total_count === result.workflow_runs.length,
      'trusted EV-9 run inventory truncated');
    const matches = result.workflow_runs.filter(run =>
      run.workflow_id === TRUSTED_WORKFLOW_ID && run.path === TRUSTED_WORKFLOW &&
      run.event === 'pull_request_target' && run.head_sha === head &&
      (run.pull_requests || []).some(pull => pull.number === pr));
    ok(matches.length <= 1, 'ambiguous trusted EV-9 target run');
    if (matches.length === 1 && matches[0].status === 'completed') {
      ok(matches[0].conclusion === 'success', 'trusted EV-9 target failed');
      found = matches[0];
      break;
    }
    if (attempt < 9) await new Promise(done => setTimeout(done, 5000));
  }
  ok(found, 'trusted EV-9 target observation missing or unfinished');
  const jobPayload = await api('/actions/runs/' + found.id + '/jobs?per_page=100');
  ok(jobPayload.total_count === jobPayload.jobs?.length, 'trusted EV-9 jobs inventory truncated');
  const jobs = jobPayload.jobs;
  const verifyJob = jobs.find(job => job.name === 'verify-pr-candidate');
  ok(verifyJob?.id, 'trusted EV-9 verify job missing');
  const logs = await api('/actions/jobs/' + verifyJob.id + '/logs', true);
  const evidence = verifyTrustedObserverEvidence({
    runs: [found], jobs, logs, sha: head, base, pr,
  });
  await mkdir('.iteration-evidence', { recursive: true });
  await writeFile('.iteration-evidence/trusted-ev9.json', JSON.stringify(evidence, null, 2) + '\n');
  // Outputs are derived only after the authenticated target run, job and
  // exact-base/candidate log marker have passed. GitHub job/artifact metadata
  // can now carry the actual run and job identities to a read-only reviewer.
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, trustedObserverStepOutputs(evidence));
  }
  console.log('TRUSTED_EV9_TARGET_OBSERVATION_PASS candidate=' + head +
    ' run=' + evidence.workflowRunId + ' job=' + evidence.verificationJobId);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('TRUSTED_EV9_TARGET_OBSERVATION_FAIL ' + error.message);
    process.exitCode = 1;
  });
}
