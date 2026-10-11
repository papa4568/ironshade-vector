import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  anchorReviewIdentity,
  buildPrompt,
  normalizeReviewEnums,
  normalizeReviewKeys,
  packetFromProductRoadmaps,
  packetFromTaskGraph,
  parseReview,
  persistReviewEvidence,
} from './ao6-trusted-independent-review-v2.mjs';
import { selectExperimentalReviewTask } from './experimental-review-task.mjs';

const ok = (value, message) => { if (!value) throw new Error(message); };
const env = name => { const value = process.env[name]?.trim(); ok(value, `${name} is required`); return value; };
const positive = (value, name) => { const parsed = Number(value); ok(Number.isInteger(parsed) && parsed > 0, `${name} must be positive`); return parsed; };

async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GitHub API ${method} ${path} failed ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

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

function decodeContentFile(file, label) {
  ok(file?.encoding === 'base64' && typeof file.content === 'string', `${label} payload is invalid`);
  return Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

export async function exactCandidatePacket(repo, candidateSha, taskId, baseSha = null) {
  if (/^AO-\d+$/.test(taskId)) {
    const file = await api(`repos/${repo}/contents/agent/task-graph.json?ref=${encodeURIComponent(candidateSha)}`);
    return packetFromTaskGraph(JSON.parse(decodeContentFile(file, 'exact candidate task graph')), taskId, candidateSha);
  }

  if (/^EV-\d+$/.test(taskId)) {
    const roadmapFile = await api(`repos/${repo}/contents/docs/experimental-verification-roadmap.md?ref=${encodeURIComponent(candidateSha)}`);
    const headMarkdown = decodeContentFile(roadmapFile, 'exact candidate experimental roadmap');
    let baseMarkdown = null;
    if (baseSha) {
      const baseRoadmapFile = await api(`repos/${repo}/contents/docs/experimental-verification-roadmap.md?ref=${encodeURIComponent(baseSha)}`);
      baseMarkdown = decodeContentFile(baseRoadmapFile, 'exact base experimental roadmap');
    }
    const selection = selectExperimentalReviewTask(headMarkdown, { baseMarkdown });
    ok(selection?.task?.id === taskId, `experimental task ${taskId} is not the first executable exact-candidate or closeout EV item`);
    return packetFromTaskGraph({ tasks: [selection.task] }, taskId, candidateSha);
  }

  if (/^P\d+(?:-[A-Z0-9]+)+$/.test(taskId)) {
    const [roadmapFile, metadataFile] = await Promise.all([
      api(`repos/${repo}/contents/docs/content-roadmap.md?ref=${encodeURIComponent(candidateSha)}`),
      api(`repos/${repo}/contents/agent/roadmap-metadata.json?ref=${encodeURIComponent(candidateSha)}`),
    ]);
    const headMarkdown = decodeContentFile(roadmapFile, 'exact candidate product roadmap');
    const headMetadata = JSON.parse(decodeContentFile(metadataFile, 'exact candidate roadmap metadata'));

    let baseMarkdown = null;
    let baseMetadata = null;
    if (baseSha) {
      const [baseRoadmapFile, baseMetadataFile] = await Promise.all([
        api(`repos/${repo}/contents/docs/content-roadmap.md?ref=${encodeURIComponent(baseSha)}`),
        api(`repos/${repo}/contents/agent/roadmap-metadata.json?ref=${encodeURIComponent(baseSha)}`),
      ]);
      baseMarkdown = decodeContentFile(baseRoadmapFile, 'exact base product roadmap');
      baseMetadata = JSON.parse(decodeContentFile(baseMetadataFile, 'exact base roadmap metadata'));
    }

    return packetFromProductRoadmaps({
      headMarkdown,
      headMetadata,
      baseMarkdown,
      baseMetadata,
      taskId,
      candidateSha,
    });
  }

  throw new Error(`unsupported trusted review task id ${taskId}`);
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

async function exactRun(repo, workflow, sha, pr) {
  const list = await api(`repos/${repo}/actions/workflows/${workflow}/runs?event=pull_request&head_sha=${sha}&per_page=30`);
  const runs = (list.workflow_runs ?? [])
    .filter(run => run.head_sha === sha && (run.pull_requests ?? []).some(pull => pull.number === pr))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
  const run = runs.at(-1);
  ok(run, `missing ${workflow} exact-SHA run`);
  return run;
}

async function evidence(repo, sha, pr) {
  const candidate = await exactRun(repo, 'pr-candidate.yml', sha, pr);
  const candidateJobs = (await api(`repos/${repo}/actions/runs/${candidate.id}/jobs?per_page=100`)).jobs ?? [];
  const final = candidateJobs.filter(job => job.name === 'PR Candidate Verification').sort((a, b) => a.id - b.id).at(-1);
  ok(final?.status === 'completed', 'final candidate job incomplete');
  const technical = (final.steps ?? []).filter(step => step.name === 'Require exact candidate technical gates').at(-1);
  const review = (final.steps ?? []).filter(step => step.name === 'Require actual exact-SHA independent-review pass').at(-1);
  ok(technical?.conclusion === 'success', 'exact-SHA technical gate did not pass');
  ok(
    final.conclusion === 'success' || (final.conclusion === 'failure' && review?.conclusion === 'failure'),
    'candidate failed outside review gate',
  );

  const orchestration = await exactRun(repo, 'agent-orchestration.yml', sha, pr);
  const orchestrationJobs = (await api(`repos/${repo}/actions/runs/${orchestration.id}/jobs?per_page=100`)).jobs ?? [];
  const validation = orchestrationJobs.filter(job => job.name === 'validate-agent-orchestration').sort((a, b) => a.id - b.id).at(-1);
  ok(validation?.conclusion === 'success', 'Agent Orchestration validation did not pass');

  const artifacts = (await api(`repos/${repo}/actions/runs/${candidate.id}/artifacts?per_page=100`)).artifacts ?? [];
  return {
    candidateRun: { id: candidate.id, conclusion: candidate.conclusion, jobs: compactJobs(candidateJobs) },
    orchestrationRun: { id: orchestration.id, conclusion: orchestration.conclusion, jobs: compactJobs(orchestrationJobs) },
    artifacts: artifacts.map(artifact => ({ id: artifact.id, name: artifact.name, digest: artifact.digest, expired: artifact.expired })),
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
  for (const check of result.acceptanceChecks) {
    ok(packet.acceptance.some(item => item.index === check.index), `unknown acceptance check ${check.index}`);
    ok(['satisfied', 'not_satisfied'].includes(check.status) && check.notes?.trim(), `invalid acceptance check ${check.index}`);
  }
  ok(Array.isArray(result.proofChecks) && result.proofChecks.length === packet.requiredProofs.length, 'proofChecks mismatch');
  for (const check of result.proofChecks) {
    ok(packet.requiredProofs.some(proof => proof.id === check.proofId), `unknown proof check ${check.proofId}`);
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
  const ev = await evidence(repo, sha, pr);
  const diff = await diffText(repo, pr);
  ok(diff.trim(), 'candidate diff is empty');

  const home = `${process.env.RUNNER_TEMP ?? '/tmp'}/ironshade-trusted-review-v3-${env('GITHUB_RUN_ID')}`;
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
  const result = validate(anchorReviewIdentity(normalizeProofCheckIds(normalizeReviewEnums(normalizeReviewKeys(parseReview(response))), packet), packet), packet);
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
  const baseExperimental = [
    '# Experimental verification roadmap',
    '',
    '## Active experimental queue',
    '',
    '- [ ] **EV-8 — Promote acceptance attacks**',
    '  - Measure dishonest variants.',
    '  - Preserve rollback.',
    '',
    '- [ ] **EV-9 — Promote independence**',
    '  - Resolve circular evidence.',
  ].join('\n');
  const active = selectExperimentalReviewTask(baseExperimental);
  ok(active?.task.id === 'EV-8' && active.mode === 'experimental', 'active EV review selection failed');
  ok(active.task.proofs.some(proof => proof.id === 'independent-review' && proof.required), 'EV review proof contract is missing independent review');
  const closeout = selectExperimentalReviewTask(
    baseExperimental.replace('- [ ] **EV-8 — Promote acceptance attacks**\n  - Measure dishonest variants.\n  - Preserve rollback.\n\n', ''),
    { baseMarkdown: baseExperimental },
  );
  ok(closeout?.task.id === 'EV-8' && closeout.mode === 'experimental-closeout', 'EV closeout review selection failed');
  let combinedRejected = false;
  try {
    selectExperimentalReviewTask('# Experimental\n\n## Active experimental queue\n\n', { baseMarkdown: baseExperimental });
  } catch {
    combinedRejected = true;
  }
  ok(combinedRejected, 'EV closeout must reject removal of multiple promotion items');
  const packet = packetFromTaskGraph({ tasks: [active.task] }, 'EV-8', 'a'.repeat(40));
  ok(packet.taskId === 'EV-8' && packet.acceptance.length === 2, 'EV trusted packet did not preserve acceptance');
  ok(packet.requiredProofs.length >= 6, 'EV trusted packet did not preserve final proof obligations');
  const prompt = buildPrompt(packet, { candidateRun: { conclusion: 'failure' } }, 'diff');
  ok(prompt.includes('read-only adversarial verifier'), 'trusted prompt contract missing');
  console.log('TRUSTED_INDEPENDENT_REVIEW_V3_SELF_TEST_PASS');
}

async function main() {
  const command = process.argv[2];
  if (command === 'self-test') selfTest();
  else if (command === 'run') await run();
  else throw new Error('usage: trusted-independent-review-v3.mjs self-test | run');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
