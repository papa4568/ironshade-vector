import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  buildAutomatedReviewRequest,
  extractAutomatedReviewResult,
  formatAutomatedReviewEnvelope,
  validateTechnicalEvidence,
} from './automated-independent-review.mjs';
import { validateIndependentReviewPacket } from './independent-review.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredEnv(name) {
  const value = process.env[name];
  assert(typeof value === 'string' && value.trim().length > 0, `${name} is required`);
  return value.trim();
}

async function github(path, { method = 'GET', body = null } = {}) {
  const token = requiredEnv('GITHUB_TOKEN');
  const response = await fetch(`https://api.github.com/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!response.ok) throw new Error(`GitHub API ${method} ${path} failed ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

function output(name, value) {
  const path = requiredEnv('GITHUB_OUTPUT');
  return import('node:fs').then(({ appendFileSync }) => appendFileSync(path, `${name}=${value}\n`));
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function waitForTechnicalEvidence({ outputDir = '.automated-review' } = {}) {
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const headSha = requiredEnv('HEAD_SHA');
  const prNumber = Number(requiredEnv('PR_NUMBER'));
  assert(Number.isInteger(prNumber) && prNumber > 0, 'PR_NUMBER must be positive');
  await mkdir(outputDir, { recursive: true });

  for (let attempt = 1; attempt <= 180; attempt += 1) {
    const runs = await github(`repos/${repository}/actions/workflows/pr-candidate.yml/runs?event=pull_request&head_sha=${headSha}&per_page=20`);
    const matching = (runs.workflow_runs ?? [])
      .filter(run => run.head_sha === headSha && (run.pull_requests ?? []).some(pr => pr.number === prNumber))
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const technicalRun = matching.at(-1);
    if (!technicalRun) {
      await delay(15000);
      continue;
    }

    const jobs = await github(`repos/${repository}/actions/runs/${technicalRun.id}/jobs?per_page=100`);
    const finalJobs = (jobs.jobs ?? []).filter(job => job.name === 'PR Candidate Verification').sort((a, b) => a.id - b.id);
    const finalJob = finalJobs.at(-1);
    if (!finalJob || finalJob.status !== 'completed') {
      await delay(15000);
      continue;
    }
    const technicalStep = (finalJob.steps ?? []).filter(step => step.name === 'Require exact candidate technical gates').at(-1);
    const reviewStep = (finalJob.steps ?? []).filter(step => step.name === 'Require actual exact-SHA independent-review pass').at(-1);
    assert(technicalStep?.conclusion === 'success', 'exact-SHA technical gate did not pass; automated review refuses to run');
    if (finalJob.conclusion === 'failure') {
      assert(reviewStep?.conclusion === 'failure', 'candidate verification failed outside the independent-review gate');
    } else {
      assert(finalJob.conclusion === 'success', `unexpected candidate verification conclusion ${finalJob.conclusion}`);
    }

    const artifacts = await github(`repos/${repository}/actions/runs/${technicalRun.id}/artifacts?per_page=100`);
    const evidence = {
      schemaVersion: 1,
      candidateSha: headSha,
      technicalRunId: technicalRun.id,
      technicalGate: {
        status: 'passed',
        marker: `PR_CANDIDATE_TECHNICAL_GATES_PASS candidate=${headSha} sourceRun=${technicalRun.id}`,
      },
      jobs: (jobs.jobs ?? []).map(({ id, name, status, conclusion, steps }) => ({ id, name, status, conclusion, steps })),
      artifacts: (artifacts.artifacts ?? []).map(({ id, name, size_in_bytes, digest, expired, workflow_run }) => ({ id, name, size_in_bytes, digest, expired, workflow_run })),
    };
    await writeFile(`${outputDir}/technical-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    await output('technical-run-id', technicalRun.id);
    await output('final-job-id', finalJob.id);
    console.log(`AUTOMATED_REVIEW_TECHNICAL_READY candidate=${headSha} run=${technicalRun.id} finalJob=${finalJob.id} conclusion=${finalJob.conclusion}`);
    return evidence;
  }
  throw new Error('timed out waiting for exact-SHA PR Candidate Verification technical evidence');
}

export async function invokeModel({ packetPath, evidencePath, base, head, model = 'gpt-5.4', outputDir = '.automated-review' }) {
  requiredEnv('GITHUB_TOKEN');
  const packet = JSON.parse(await readFile(packetPath, 'utf8'));
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  validateIndependentReviewPacket(packet);
  validateTechnicalEvidence(packet, evidence);
  const { execFileSync } = await import('node:child_process');
  assert(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() === head, 'checked-out HEAD does not match requested candidate');
  execFileSync('git', ['cat-file', '-e', `${base}^{commit}`]);
  const diff = execFileSync('git', ['diff', '--find-renames', '--find-copies', '--unified=16', `${base}...${head}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const request = buildAutomatedReviewRequest({ packet, evidence, diff, model });
  const prompt = request.messages.map(message => `${message.role.toUpperCase()}:\n${message.content}`).join('\n\n');
  await mkdir(outputDir, { recursive: true });
  await writeFile(`${outputDir}/model-request.json`, `${JSON.stringify({ ...request, transport: 'github-copilot-cli' })}\n`);

  const copilotHome = `${process.env.RUNNER_TEMP ?? '/tmp'}/ironshade-copilot-review-${requiredEnv('GITHUB_RUN_ID')}`;
  let responseText;
  try {
    responseText = execFileSync('copilot', [
      '-p', prompt,
      '-s',
      '--no-ask-user',
      '--no-custom-instructions',
      '--disable-builtin-mcps',
      '--deny-tool=write',
      '--deny-tool=shell',
      '--deny-tool=url',
      '--deny-tool=memory',
      '--no-remote',
      '--no-remote-export',
      '--stream=off',
      '--model', model,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, COPILOT_HOME: copilotHome },
    });
  } catch (error) {
    const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
    await writeFile(`${outputDir}/copilot-error.txt`, `${stdout}\n${stderr}`);
    throw new Error(`Copilot CLI independent review failed: ${stderr.trim() || error.message}`);
  }
  await writeFile(`${outputDir}/copilot-response.txt`, responseText);
  const result = extractAutomatedReviewResult({
    packet,
    response: { choices: [{ message: { content: responseText } }] },
    model,
    sourceRunId: Number(requiredEnv('GITHUB_RUN_ID')),
    technicalRunId: evidence.technicalRunId,
  });
  await writeFile(`${outputDir}/review-result.json`, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(`${outputDir}/review-comment.md`, formatAutomatedReviewEnvelope(result));
  await output('verdict', result.verdict);
  console.log(`AUTOMATED_INDEPENDENT_REVIEW_RESULT_${result.verdict.toUpperCase()} candidate=${result.candidateSha} findings=${result.findings.length}`);
  return result;
}

export async function publishResult({ outputDir = '.automated-review' } = {}) {
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const prNumber = Number(requiredEnv('PR_NUMBER'));
  const technicalRunId = Number(requiredEnv('TECHNICAL_RUN_ID'));
  const result = JSON.parse(await readFile(`${outputDir}/review-result.json`, 'utf8'));
  const commentBody = await readFile(`${outputDir}/review-comment.md`, 'utf8');
  const published = await github(`repos/${repository}/issues/${prNumber}/comments`, { method: 'POST', body: { body: commentBody } });
  console.log(`AUTOMATED_INDEPENDENT_REVIEW_PUBLISHED comment=${published.id} verdict=${result.verdict}`);
  if (result.verdict !== 'pass') return { published, rerun: false };

  const jobs = await github(`repos/${repository}/actions/runs/${technicalRunId}/jobs?per_page=100`);
  const finalJob = (jobs.jobs ?? []).filter(job => job.name === 'PR Candidate Verification').sort((a, b) => a.id - b.id).at(-1);
  assert(finalJob, 'final candidate job is missing');
  const technicalStep = (finalJob.steps ?? []).filter(step => step.name === 'Require exact candidate technical gates').at(-1);
  assert(finalJob.status === 'completed', 'final candidate job must be completed before rerun');
  assert(technicalStep?.conclusion === 'success', 'final candidate technical gate must already be success');
  if (finalJob.conclusion === 'success') {
    console.log('Final candidate job already passed; no rerun needed.');
    return { published, rerun: false };
  }
  assert(finalJob.conclusion === 'failure', `final candidate job has unsupported conclusion ${finalJob.conclusion}`);
  await github(`repos/${repository}/actions/jobs/${finalJob.id}/rerun`, { method: 'POST' });
  console.log(`AUTOMATED_INDEPENDENT_REVIEW_RERUN finalJob=${finalJob.id} technicalRun=${technicalRunId} verdict=pass`);
  return { published, rerun: true };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`unknown argument ${arg}`);
    options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = args[++index];
  }
  return options;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  const options = parseArgs(args);
  if (command === 'wait') return waitForTechnicalEvidence(options);
  if (command === 'invoke') return invokeModel(options);
  if (command === 'publish') return publishResult(options);
  throw new Error('usage: automated-independent-review-runner.mjs wait [--output-dir <dir>] | invoke --packet-path <path> --evidence-path <path> --base <sha> --head <sha> [--model <id>] [--output-dir <dir>] | publish [--output-dir <dir>]');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
