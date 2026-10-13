import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  anchorReviewIdentity,
  buildPrompt,
  normalizeReviewEnums,
  packetFromTaskGraph,
  parseReview,
  persistReviewEvidence,
} from './ao6-trusted-independent-review-v2.mjs';
import { exactCandidatePacket } from './trusted-independent-review-v3.mjs';

const ok = (value, message) => { if (!value) throw new Error(message); };
const env = name => { const value = process.env[name]?.trim(); ok(value, `${name} is required`); return value; };
const positive = (value, name) => { const parsed = Number(value); ok(Number.isInteger(parsed) && parsed > 0, `${name} must be positive`); return parsed; };
const transientStatuses = new Set([502, 503, 504]);
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function githubRequest(path, { method = 'GET', body = null, json = true } = {}) {
  let failure = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`https://api.github.com/${path.replace(/^\//, '')}`, {
      method,
      headers: {
        Accept: json ? 'application/vnd.github+json' : 'text/plain',
        Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    if (response.ok) return json ? (text ? JSON.parse(text) : null) : text;

    failure = new Error(`GitHub API ${method} ${path} failed ${response.status}: ${text}`);
    const retryable = method === 'GET' && transientStatuses.has(response.status) && attempt < 4;
    if (!retryable) throw failure;
    await sleep(250 * attempt);
  }
  throw failure ?? new Error(`GitHub API ${method} ${path} failed`);
}

const api = (path, method = 'GET', body = null) => githubRequest(path, { method, body, json: true });
const apiText = path => githubRequest(path, { json: false });

async function diffText(repo, pr) {
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}`, {
    headers: {
      Accept: 'application/vnd.github.v3.diff',
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GitHub diff failed ${response.status}: ${text}`);
  return text;
}

function normalizeTrustedReviewKeys(value) {
  if (Array.isArray(value)) return value.map(normalizeTrustedReviewKeys);
  if (!value || typeof value !== 'object') return value;
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.replace(/[\r\n\t]+/g, '').trim();
    ok(key, 'trusted review contains an empty JSON key after control-whitespace normalization');
    ok(!Object.hasOwn(normalized, key), `trusted review JSON keys collide after control-whitespace normalization: ${JSON.stringify(rawKey)} -> ${JSON.stringify(key)}`);
    normalized[key] = normalizeTrustedReviewKeys(rawValue);
  }
  return normalized;
}

function compactJobs(jobs) {
  return jobs.map(job => ({
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    steps: (job.steps ?? []).map(step => ({ name: step.name, status: step.status, conclusion: step.conclusion })),
  }));
}

function latestNamedJob(jobs, name) {
  return jobs.filter(job => job.name === name).sort((left, right) => left.id - right.id).at(-1);
}

function requireProducerResults(jobs) {
  ok(latestNamedJob(jobs, 'Candidate Build and Full Verification')?.conclusion === 'success', 'candidate build/full verification did not pass');
  ok(latestNamedJob(jobs, 'Independent Review Context')?.conclusion === 'success', 'independent review context did not pass');
  ok(latestNamedJob(jobs, 'Android PR / Android PR Verification')?.conclusion === 'success', 'Android aggregate verification did not pass');
  const browser = latestNamedJob(jobs, 'Browser E2E');
  ok(browser && ['success', 'skipped'].includes(browser.conclusion), 'browser verification is neither successful nor scope-skipped');
}

export function evaluateFinalCandidateEvidence(final, logs, sha) {
  ok(final?.status === 'completed', 'final candidate job incomplete');
  const steps = Array.isArray(final.steps) ? final.steps : [];
  const technical = steps.filter(step => step.name === 'Require exact candidate technical gates').at(-1);
  const review = steps.filter(step => step.name === 'Require actual exact-SHA independent-review pass').at(-1);

  if (technical) {
    ok(technical.conclusion === 'success', 'exact-SHA technical gate did not pass');
    ok(
      final.conclusion === 'success' || (final.conclusion === 'failure' && review?.conclusion === 'failure'),
      'candidate failed outside review gate',
    );
    return {
      source: 'structured-steps',
      technicalGatePassed: true,
      reviewOnlyFailure: final.conclusion === 'failure',
    };
  }

  ok(steps.length === 0, 'final candidate job has partial step metadata but no technical gate step');
  ok(typeof logs === 'string' && logs.trim(), 'final candidate step metadata is absent and job log is unavailable');
  const technicalMarker = `PR_CANDIDATE_TECHNICAL_GATES_PASS candidate=${sha} `;
  const technicalIndex = logs.indexOf(technicalMarker);
  ok(technicalIndex >= 0, 'exact-SHA technical gate did not pass');

  if (final.conclusion === 'success') {
    const completeMarker = `PR_CANDIDATE_VERIFICATION_PASS candidate=${sha} `;
    ok(logs.indexOf(completeMarker, technicalIndex) > technicalIndex, 'successful final candidate job is missing exact-SHA completion marker');
    return {
      source: 'job-log-fallback',
      technicalGatePassed: true,
      reviewOnlyFailure: false,
    };
  }

  ok(final.conclusion === 'failure', 'candidate failed outside review gate');
  const reviewCommand = 'Run node agent/tools/review-comment-gate.mjs gate';
  const reviewIndex = logs.indexOf(reviewCommand, technicalIndex);
  ok(reviewIndex > technicalIndex, 'candidate failed outside review gate');
  const reviewFailureIndex = logs.indexOf('##[error]Process completed with exit code 1.', reviewIndex);
  ok(reviewFailureIndex > reviewIndex, 'candidate failed outside review gate');
  return {
    source: 'job-log-fallback',
    technicalGatePassed: true,
    reviewOnlyFailure: true,
  };
}

async function exactRun(repo, workflow, sha, pr) {
  const list = await api(`repos/${repo}/actions/workflows/${workflow}/runs?event=pull_request&head_sha=${sha}&per_page=30`);
  const runs = (list.workflow_runs ?? [])
    .filter(run => run.head_sha === sha && (run.pull_requests ?? []).some(pull => pull.number === pr))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
  const run = runs.at(-1);
  ok(run, `missing ${workflow} exact-SHA run`);
  return run;
}

export function extractEv12CalibrationMarkers(logs, sha) {
  ok(typeof logs === 'string' && logs.trim(), 'EV-12 calibration log is unavailable');
  const marker = prefix => logs
    .split(/\r?\n/)
    .map(line => line.slice(Math.max(0, line.indexOf(prefix))))
    .find(line => line.startsWith(prefix));
  const regression = marker('FAILURE_RECURRENCE_CALIBRATION_PASS ');
  const report = marker('FAILURE_RECURRENCE_CALIBRATION mode=');
  const evidencePass = marker('FAILURE_RECURRENCE_CALIBRATION_EVIDENCE_PASS ');
  ok(regression, 'EV-12 regression PASS marker is missing');
  ok(report?.includes(`candidate=${sha}`) && report.includes('pass=true') && report.includes('blocking=false'), 'EV-12 exact-SHA calibration report marker is invalid');
  ok(evidencePass?.includes(`candidate=${sha}`) && evidencePass.includes('calibrationPass=true') && evidencePass.includes('blocking=false'), 'EV-12 exact-SHA evidence PASS marker is invalid');
  return { regression, report, evidencePass };
}

async function exactExperimentalEvidence(repo, sha, pr, taskId) {
  if (taskId !== 'EV-12') return null;
  const run = await exactRun(repo, 'ev12-failure-recurrence-calibration.yml', sha, pr);
  ok(run.conclusion === 'success', 'EV-12 exact-SHA calibration workflow did not pass');
  const jobs = (await api(`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`)).jobs ?? [];
  const calibration = latestNamedJob(jobs, 'Exact Candidate Failure Recurrence Calibration');
  ok(calibration?.conclusion === 'success', 'EV-12 exact-SHA calibration job did not pass');
  const logs = await apiText(`repos/${repo}/actions/jobs/${calibration.id}/logs`);
  const markers = extractEv12CalibrationMarkers(logs, sha);
  const artifacts = (await api(`repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`)).artifacts ?? [];
  const expectedName = `failure-recurrence-calibration-${pr}-${sha}`;
  const artifact = artifacts.find(entry => entry.name === expectedName);
  ok(artifact && !artifact.expired && /^sha256:[0-9a-f]{64}$/i.test(artifact.digest ?? ''), 'EV-12 exact-SHA calibration artifact is missing, expired, or lacks a digest');
  return {
    taskId,
    workflow: 'EV-12 Failure Recurrence Calibration',
    run: { id: run.id, conclusion: run.conclusion, jobs: compactJobs(jobs) },
    markers,
    artifact: { id: artifact.id, name: artifact.name, digest: artifact.digest, expired: artifact.expired },
  };
}

async function evidence(repo, sha, pr, taskId) {
  const candidate = await exactRun(repo, 'pr-candidate.yml', sha, pr);
  const candidateJobs = (await api(`repos/${repo}/actions/runs/${candidate.id}/jobs?per_page=100`)).jobs ?? [];
  requireProducerResults(candidateJobs);
  const final = latestNamedJob(candidateJobs, 'PR Candidate Verification');
  ok(final, 'final candidate job missing');
  const needsLogFallback = !Array.isArray(final.steps) || final.steps.length === 0;
  const finalLogs = needsLogFallback ? await apiText(`repos/${repo}/actions/jobs/${final.id}/logs`) : null;
  const finalGateEvidence = evaluateFinalCandidateEvidence(final, finalLogs, sha);

  const orchestration = await exactRun(repo, 'agent-orchestration.yml', sha, pr);
  const orchestrationJobs = (await api(`repos/${repo}/actions/runs/${orchestration.id}/jobs?per_page=100`)).jobs ?? [];
  const validation = latestNamedJob(orchestrationJobs, 'validate-agent-orchestration');
  ok(validation?.conclusion === 'success', 'Agent Orchestration validation did not pass');

  const artifacts = (await api(`repos/${repo}/actions/runs/${candidate.id}/artifacts?per_page=100`)).artifacts ?? [];
  const experimentalEvidence = await exactExperimentalEvidence(repo, sha, pr, taskId);
  return {
    candidateRun: { id: candidate.id, conclusion: candidate.conclusion, jobs: compactJobs(candidateJobs) },
    orchestrationRun: { id: orchestration.id, conclusion: orchestration.conclusion, jobs: compactJobs(orchestrationJobs) },
    artifacts: artifacts.map(artifact => ({ id: artifact.id, name: artifact.name, digest: artifact.digest, expired: artifact.expired })),
    experimentalEvidence,
    finalGateEvidence,
    finalJobId: final.id,
  };
}

function normalizeProofCheckIds(result, packet) {
  if (!Array.isArray(result?.proofChecks)) return result;
  const known = new Map();
  for (const proof of packet.requiredProofs) {
    const compact = proof.id.replace(/\s+/g, '');
    ok(!known.has(compact), `trusted packet proof ids collide after whitespace normalization: ${proof.id}`);
    known.set(compact, proof.id);
  }
  for (const check of result.proofChecks) {
    if (typeof check?.proofId !== 'string') continue;
    const exact = known.get(check.proofId.replace(/\s+/g, ''));
    if (exact) check.proofId = exact;
  }
  return result;
}

function validate(result, packet) {
  ok(result && typeof result === 'object' && !Array.isArray(result), 'review must be object');
  ok(
    result.schemaVersion === 1
      && result.taskId === packet.taskId
      && result.candidateSha === packet.candidateSha
      && result.mode === 'read-only-adversarial',
    'review identity mismatch',
  );
  ok(['pass', 'fail'].includes(result.verdict), 'invalid verdict');
  ok(Array.isArray(result.acceptanceChecks) && result.acceptanceChecks.length === packet.acceptance.length, 'acceptanceChecks mismatch');
  const acceptanceIndexes = new Set();
  for (const check of result.acceptanceChecks) {
    ok(packet.acceptance.some(item => item.index === check.index), `unknown acceptance check ${check.index}`);
    ok(!acceptanceIndexes.has(check.index), `duplicate acceptance check ${check.index}`);
    acceptanceIndexes.add(check.index);
    ok(['satisfied', 'not_satisfied'].includes(check.status) && check.notes?.trim(), `invalid acceptance check ${check.index}`);
  }
  ok(Array.isArray(result.proofChecks) && result.proofChecks.length === packet.requiredProofs.length, 'proofChecks mismatch');
  const proofIds = new Set();
  for (const check of result.proofChecks) {
    ok(packet.requiredProofs.some(proof => proof.id === check.proofId), `unknown proof check ${check.proofId}`);
    ok(!proofIds.has(check.proofId), `duplicate proof check ${check.proofId}`);
    proofIds.add(check.proofId);
    ok(['credible', 'insufficient'].includes(check.status) && check.notes?.trim(), `invalid proof check ${check.proofId}`);
  }
  ok(Array.isArray(result.findings), 'findings must be array');
  for (const finding of result.findings) {
    ok(['blocking', 'major', 'minor'].includes(finding.severity), 'invalid finding severity');
    ok(finding.summary?.trim() && Array.isArray(finding.evidence) && finding.evidence.length > 0, 'invalid finding');
  }
  if (result.verdict === 'pass') {
    ok(result.acceptanceChecks.every(check => check.status === 'satisfied'), 'PASS requires all acceptance satisfied');
    ok(result.proofChecks.every(check => check.status === 'credible'), 'PASS requires all proofs credible');
    ok(!result.findings.some(finding => finding.severity === 'blocking' || finding.severity === 'major'), 'PASS cannot have blocking/major findings');
  }
  return result;
}

async function run() {
  const repo = env('GITHUB_REPOSITORY');
  const pr = positive(env('PR_NUMBER'), 'PR_NUMBER');
  const sha = env('CANDIDATE_SHA');
  const taskId = process.env.TASK_ID?.trim() || 'AO-6';
  const model = process.env.MODEL?.trim() || 'auto';
  ok(env('GITHUB_REF_NAME') === 'main', 'trusted verifier must run from main');

  const pull = await api(`repos/${repo}/pulls/${pr}`);
  ok(pull.state === 'open' && pull.head?.sha === sha, `PR #${pr} head mismatch`);
  const main = await api(`repos/${repo}/branches/main`);
  ok(main.commit?.sha === env('GITHUB_SHA'), 'workflow SHA is not current main');

  const packet = await exactCandidatePacket(repo, sha, taskId, pull.base?.sha ?? null);
  const ev = await evidence(repo, sha, pr, taskId);
  const diff = await diffText(repo, pr);
  ok(diff.trim(), 'candidate diff is empty');

  const home = `${process.env.RUNNER_TEMP ?? '/tmp'}/ironshade-trusted-review-v4-${env('GITHUB_RUN_ID')}`;
  const response = execFileSync(
    'copilot',
    ['-s', '--no-ask-user', '--no-custom-instructions', '--disable-builtin-mcps', '--deny-tool=write', '--deny-tool=shell', '--deny-tool=url', '--deny-tool=memory', '--no-remote', '--no-remote-export', '--stream=off', '--model', model],
    {
      encoding: 'utf8',
      input: buildPrompt(packet, ev, diff),
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, COPILOT_HOME: home },
    },
  );

  mkdirSync('.trusted-review', { recursive: true });
  writeFileSync('.trusted-review/raw-response.txt', response, 'utf8');
  const result = validate(anchorReviewIdentity(normalizeProofCheckIds(normalizeReviewEnums(normalizeTrustedReviewKeys(parseReview(response))), packet), packet), packet);
  Object.assign(result, {
    reviewerKind: 'trusted-main-copilot-actions',
    sourceWorkflow: 'AO-6 Trusted Independent Review',
    sourceRunId: positive(env('GITHUB_RUN_ID'), 'GITHUB_RUN_ID'),
    trustedWorkflowSha: env('GITHUB_SHA'),
    technicalRunId: ev.candidateRun.id,
    orchestrationRunId: ev.orchestrationRun.id,
    model,
  });
  const body = `<!-- ironshade-independent-review:trusted-main-actions:v1 -->\n<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;
  persistReviewEvidence({ result, body });
  const posted = await api(`repos/${repo}/issues/${pr}/comments`, 'POST', { body });
  console.log(`TRUSTED_INDEPENDENT_REVIEW_${result.verdict.toUpperCase()} candidate=${sha} comment=${posted.id}`);
  if (result.verdict === 'pass') await api(`repos/${repo}/actions/jobs/${ev.finalJobId}/rerun`, 'POST');
  else process.exitCode = 2;
}

function selfTest() {
  const packet = packetFromTaskGraph({
    tasks: [{
      id: 'EV-12',
      acceptance: ['measure recurrence calibration', 'preserve advisory rollback'],
      proofs: [
        { id: 'experimental-regressions', kind: 'test', description: 'calibration regressions', required: true },
        { id: 'independent-review', kind: 'review', description: 'trusted review', required: true },
      ],
    }],
  }, 'EV-12', 'a'.repeat(40));

  const structuredFinal = {
    status: 'completed',
    conclusion: 'failure',
    steps: [
      { name: 'Require exact candidate technical gates', conclusion: 'success' },
      { name: 'Require actual exact-SHA independent-review pass', conclusion: 'failure' },
    ],
  };
  ok(evaluateFinalCandidateEvidence(structuredFinal, null, packet.candidateSha).source === 'structured-steps', 'structured technical evidence should remain authoritative');

  const fallbackLog = [
    `PR_CANDIDATE_TECHNICAL_GATES_PASS candidate=${packet.candidateSha} fullVerification=once reviewContext=success browser=skipped android=success`,
    '##[group]Run node agent/tools/review-comment-gate.mjs gate \\',
    'no trusted independent review result exists for task EV-12 candidate aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '##[error]Process completed with exit code 1.',
  ].join('\n');
  const fallbackFinal = { status: 'completed', conclusion: 'failure', steps: [] };
  const fallback = evaluateFinalCandidateEvidence(fallbackFinal, fallbackLog, packet.candidateSha);
  ok(fallback.source === 'job-log-fallback' && fallback.reviewOnlyFailure, 'missing step metadata should use exact final-job log fallback');

  let missingMarkerRejected = false;
  try {
    evaluateFinalCandidateEvidence(fallbackFinal, '##[group]Run node agent/tools/review-comment-gate.mjs gate\n##[error]Process completed with exit code 1.', packet.candidateSha);
  } catch (error) {
    missingMarkerRejected = /technical gate did not pass/.test(String(error));
  }
  ok(missingMarkerRejected, 'log fallback must reject missing technical-pass marker');

  let unrelatedFailureRejected = false;
  try {
    evaluateFinalCandidateEvidence(fallbackFinal, `${fallbackLog.split('\n')[0]}\n##[error]Process completed with exit code 1.`, packet.candidateSha);
  } catch (error) {
    unrelatedFailureRejected = /failed outside review gate/.test(String(error));
  }
  ok(unrelatedFailureRejected, 'log fallback must reject failure before the review gate');

  let partialMetadataRejected = false;
  try {
    evaluateFinalCandidateEvidence({ status: 'completed', conclusion: 'failure', steps: [{ name: 'Set up job', conclusion: 'success' }] }, fallbackLog, packet.candidateSha);
  } catch (error) {
    partialMetadataRejected = /partial step metadata/.test(String(error));
  }
  ok(partialMetadataRejected, 'partial structured metadata must fail closed instead of falling back');

  const successfulFallbackLog = [
    fallbackLog.split('\n')[0],
    `PR_CANDIDATE_VERIFICATION_PASS candidate=${packet.candidateSha} task=EV-12 independentReview=pass`,
  ].join('\n');
  const successfulFallback = evaluateFinalCandidateEvidence({ status: 'completed', conclusion: 'success', steps: [] }, successfulFallbackLog, packet.candidateSha);
  ok(!successfulFallback.reviewOnlyFailure, 'successful log fallback must require the exact completion marker');

  const ev12Log = [
    '2026-10-13T20:32:33Z FAILURE_RECURRENCE_CALIBRATION_PASS globalOver=1 globalUnder=1 recurrenceFp=2 recurrenceFn=2 eligibleOver=0 eligibleUnder=0 stable=android-screenshot-capture-transport-timeout,candidate-artifact-integrity-drift compaction=3/100 blocking=false mode=advisory',
    `2026-10-13T20:32:33Z FAILURE_RECURRENCE_CALIBRATION mode=advisory blocking=false candidate=${packet.candidateSha} pass=true over=1 under=1 recurrenceFp=2 recurrenceFn=2 eligible=android-screenshot-capture-transport-timeout,candidate-artifact-integrity-drift`,
    `2026-10-13T20:32:33Z FAILURE_RECURRENCE_CALIBRATION_EVIDENCE_PASS candidate=${packet.candidateSha} calibrationPass=true requirePass=true blocking=false`,
  ].join('\n');
  const ev12Markers = extractEv12CalibrationMarkers(ev12Log, packet.candidateSha);
  ok(ev12Markers.regression.includes('eligibleOver=0') && ev12Markers.regression.includes('compaction=3/100'), 'EV-12 regression marker lost measured calibration evidence');
  let wrongEv12CandidateRejected = false;
  try {
    extractEv12CalibrationMarkers(ev12Log, 'b'.repeat(40));
  } catch (error) {
    wrongEv12CandidateRejected = /report marker is invalid/.test(String(error));
  }
  ok(wrongEv12CandidateRejected, 'EV-12 marker extraction must reject a different candidate SHA');

  const validReview = {
    schemaVersion: 1,
    taskId: packet.taskId,
    candidateSha: packet.candidateSha,
    mode: 'read-only-adversarial',
    verdict: 'pass',
    acceptanceChecks: packet.acceptance.map(item => ({ index: item.index, status: 'satisfied', notes: 'checked' })),
    proofChecks: packet.requiredProofs.map(proof => ({ proofId: proof.id, status: 'credible', notes: 'checked' })),
    findings: [],
  };
  validate(validReview, packet);
  const prompt = buildPrompt(packet, { candidateRun: { conclusion: 'failure' }, finalGateEvidence: fallback, experimentalEvidence: { taskId: 'EV-12', markers: ev12Markers } }, 'diff');
  ok(prompt.includes('read-only adversarial verifier'), 'trusted prompt contract missing');
  ok(prompt.includes('FAILURE_RECURRENCE_CALIBRATION_EVIDENCE_PASS'), 'trusted prompt must include exact-SHA EV-12 calibration evidence');
  console.log('TRUSTED_INDEPENDENT_REVIEW_V4_SELF_TEST_PASS');
}

async function main() {
  const command = process.argv[2];
  if (command === 'self-test') selfTest();
  else if (command === 'run') await run();
  else throw new Error('usage: trusted-independent-review-v4.mjs self-test | run');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}