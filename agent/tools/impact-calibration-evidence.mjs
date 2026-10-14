import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseFailedNpmScript } from './impact-map-calibration.mjs';
import { loadImpactMap, selectAffectedVerification, validateImpactMap } from './select-affected-verification.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const HISTORICAL_WORKFLOW_NAME = 'PR Candidate Verification';
const HISTORICAL_WORKFLOW_PATH = '.github/workflows/pr-candidate.yml';
const HISTORICAL_PRODUCER_JOB = 'Candidate Build and Full Verification';
const HISTORICAL_FULL_STEP = 'Run full repository verification and production build once';
const HISTORICAL_FINAL_JOB = 'PR Candidate Verification';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalJson(value) {
  const normalize = entry => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(Object.keys(entry).sort((a, b) => a.localeCompare(b)).map(key => [key, normalize(entry[key])]));
  };
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function orderedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function run(command, { expectFailure = false, cwd = process.cwd(), env = {} } = {}) {
  const result = spawnSync('bash', ['-lc', command], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, CI: process.env.CI ?? '1', ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw result.error;
  if (expectFailure) assert(result.status !== 0, `expected command to fail: ${command}`);
  else assert(result.status === 0, `command failed (${result.status}): ${command}\n${output.slice(-4000)}`);
  return { status: result.status, output };
}

function git(args, { expectStatus = 0 } = {}) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.error) throw result.error;
  assert(result.status === expectStatus, `git ${args.join(' ')} failed with status ${result.status}: ${(result.stderr ?? '').slice(-2000)}`);
  return `${result.stdout ?? ''}`;
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertSameStringSet(actual, expected, label) {
  const actualSorted = orderedUnique(actual);
  const expectedSorted = orderedUnique(expected);
  assert(canonicalJson(actualSorted) === canonicalJson(expectedSorted), `${label} mismatch: expected ${expectedSorted.join(', ')}, got ${actualSorted.join(', ')}`);
}

export function validateImpactCalibrationCorpus(corpus, impactMap) {
  assert(corpus && typeof corpus === 'object' && !Array.isArray(corpus), 'impact calibration corpus must be an object');
  assert(corpus.schemaVersion === 1, 'impact calibration corpus schemaVersion must be 1');
  assert(corpus.mode === 'advisory', 'EV-15 corpus must remain advisory');
  assert(corpus.promotionTarget === 'EV-16', 'EV-15 corpus promotionTarget must be EV-16');
  assert(Number.isInteger(corpus.minimumIndependentMissesForWidening) && corpus.minimumIndependentMissesForWidening >= 2, 'minimumIndependentMissesForWidening must be at least 2');
  assert(corpus.errorBudget?.falsePositiveWidenings === 0, 'EV-15 false-positive widening budget must be zero');
  assert(corpus.errorBudget?.falseNegativeWidenings === 0, 'EV-15 false-negative widening budget must be zero');
  assert(Array.isArray(corpus.historicalObservations) && corpus.historicalObservations.length > 0, 'historicalObservations must be non-empty');
  assert(Array.isArray(corpus.executableMissProbes) && corpus.executableMissProbes.length >= 2, 'executableMissProbes must contain at least two probes');
  validateImpactMap(impactMap);

  const ids = new Set();
  for (const observation of corpus.historicalObservations) {
    assertString(observation.id, 'historical observation id');
    assert(!ids.has(observation.id), `duplicate corpus id ${observation.id}`);
    ids.add(observation.id);
    assert(SHA_PATTERN.test(observation.baseSha ?? ''), `${observation.id}.baseSha must be a full lowercase SHA`);
    assert(SHA_PATTERN.test(observation.candidateSha ?? ''), `${observation.id}.candidateSha must be a full lowercase SHA`);
    assert(observation.baseSha !== observation.candidateSha, `${observation.id}.baseSha must differ from candidateSha`);
    assert(Number.isInteger(observation.pullRequest) && observation.pullRequest > 0, `${observation.id}.pullRequest must be positive`);
    assert(Number.isInteger(observation.fullVerificationRunId) && observation.fullVerificationRunId > 0, `${observation.id}.fullVerificationRunId must be positive`);
    assert(observation.fullVerificationOutcome === 'success', `${observation.id} historical control must be a successful full-verification observation`);
    assert(Array.isArray(observation.changedFiles) && observation.changedFiles.length > 0, `${observation.id}.changedFiles must be non-empty`);
    observation.changedFiles.forEach(file => assertString(file, `${observation.id}.changedFiles`));
    assertString(observation.rationale, `${observation.id}.rationale`);
  }

  for (const probe of corpus.executableMissProbes) {
    assertString(probe.id, 'probe id');
    assert(!ids.has(probe.id), `duplicate corpus id ${probe.id}`);
    ids.add(probe.id);
    assertString(probe.targetPath, `${probe.id}.targetPath`);
    assert(Array.isArray(probe.changedFiles) && probe.changedFiles.length === 1 && probe.changedFiles[0] === probe.targetPath, `${probe.id}.changedFiles must contain only targetPath`);
    assertString(probe.expectedRuleId, `${probe.id}.expectedRuleId`);
    assert(impactMap.rules.some(rule => rule.id === probe.expectedRuleId), `${probe.id} references unknown impact rule ${probe.expectedRuleId}`);
    assert(probe.expectedMode === 'targeted', `${probe.id}.expectedMode must be targeted`);
    assert(Array.isArray(probe.expectedVerificationIds) && probe.expectedVerificationIds.length > 0, `${probe.id}.expectedVerificationIds must be non-empty`);
    probe.expectedVerificationIds.forEach(id => assert(impactMap.verifications[id], `${probe.id} references unknown verification ${id}`));
    assert(Array.isArray(probe.expectedDirectlyObservedVerificationIds), `${probe.id}.expectedDirectlyObservedVerificationIds must be an array`);
    assert(Array.isArray(probe.expectedOverSelectedVerificationIds), `${probe.id}.expectedOverSelectedVerificationIds must be an array`);
    const partition = orderedUnique([...probe.expectedDirectlyObservedVerificationIds, ...probe.expectedOverSelectedVerificationIds]);
    assertSameStringSet(partition, probe.expectedVerificationIds, `${probe.id} observation partition`);
    assert(probe.expectedDirectlyObservedVerificationIds.every(id => !probe.expectedOverSelectedVerificationIds.includes(id)), `${probe.id} observation partition must not overlap`);
    assertString(probe.mutationSuffix, `${probe.id}.mutationSuffix`);
    assertString(probe.expectedFailureScript, `${probe.id}.expectedFailureScript`);
    assertString(probe.expectedFailurePattern, `${probe.id}.expectedFailurePattern`);
    assert(probe.wideningAction === 'escalate-rule-to-full', `${probe.id}.wideningAction must be escalate-rule-to-full`);
  }

  assert(Array.isArray(corpus.decisionCalibration?.positive) && corpus.decisionCalibration.positive.length > 0, 'decisionCalibration.positive must be non-empty');
  assert(Array.isArray(corpus.decisionCalibration?.negative) && corpus.decisionCalibration.negative.length > 0, 'decisionCalibration.negative must be non-empty');
  return corpus;
}

export function recommendWidening({ missCount, independentTargetCount }, minimumIndependentMissesForWidening) {
  return missCount >= minimumIndependentMissesForWidening && independentTargetCount >= minimumIndependentMissesForWidening;
}

function calibrateDecision(corpus) {
  let falsePositiveWidenings = 0;
  let falseNegativeWidenings = 0;
  const cases = [];
  for (const [kind, entries] of Object.entries({ positive: corpus.decisionCalibration.positive, negative: corpus.decisionCalibration.negative })) {
    for (const entry of entries) {
      const observedRecommend = recommendWidening(entry, corpus.minimumIndependentMissesForWidening);
      const pass = observedRecommend === entry.expectedRecommend;
      if (!pass && entry.expectedRecommend) falseNegativeWidenings += 1;
      if (!pass && !entry.expectedRecommend) falsePositiveWidenings += 1;
      cases.push({ id: entry.id, kind, expectedRecommend: entry.expectedRecommend, observedRecommend, pass });
    }
  }
  return {
    cases,
    falsePositiveWidenings,
    falseNegativeWidenings,
    falsePositiveRate: corpus.decisionCalibration.negative.length === 0 ? 0 : falsePositiveWidenings / corpus.decisionCalibration.negative.length,
    falseNegativeRate: corpus.decisionCalibration.positive.length === 0 ? 0 : falseNegativeWidenings / corpus.decisionCalibration.positive.length,
    pass: falsePositiveWidenings <= corpus.errorBudget.falsePositiveWidenings && falseNegativeWidenings <= corpus.errorBudget.falseNegativeWidenings,
  };
}

function wilson95(successes, trials) {
  if (trials === 0) return { lower: 0, upper: 1 };
  const z = 1.959963984540054;
  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const centre = (p + (z * z) / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denominator;
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
}

function verifyHistoricalGitRange(observation) {
  git(['cat-file', '-e', `${observation.baseSha}^{commit}`]);
  git(['cat-file', '-e', `${observation.candidateSha}^{commit}`]);
  git(['merge-base', '--is-ancestor', observation.baseSha, observation.candidateSha]);
  const changedFiles = git(['diff', '--name-only', `${observation.baseSha}...${observation.candidateSha}`])
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(Boolean);
  assertSameStringSet(changedFiles, observation.changedFiles, `${observation.id} exact Git changed-file range`);
  return {
    baseSha: observation.baseSha,
    candidateSha: observation.candidateSha,
    changedFiles: orderedUnique(changedFiles),
    changedFilesDigest: sha256(orderedUnique(changedFiles)),
    authenticated: true,
  };
}

export function validateHistoricalRunEvidence(observation, { runRecord, jobs, pullRequest, pullRequestCommits, pullRequestFiles }) {
  assert(Number(runRecord?.id) === observation.fullVerificationRunId, `${observation.id} workflow run id mismatch`);
  assert(runRecord.name === HISTORICAL_WORKFLOW_NAME, `${observation.id} must reference ${HISTORICAL_WORKFLOW_NAME}`);
  assert(runRecord.path === HISTORICAL_WORKFLOW_PATH, `${observation.id} workflow path mismatch`);
  assert(runRecord.event === 'pull_request', `${observation.id} historical run must be a pull_request run`);
  assert(runRecord.status === 'completed', `${observation.id} historical run must be completed`);
  assert(runRecord.conclusion === observation.fullVerificationOutcome, `${observation.id} historical run conclusion mismatch`);
  assert(runRecord.head_sha === observation.candidateSha, `${observation.id} historical run head SHA mismatch`);

  assert(Number(pullRequest?.number) === observation.pullRequest, `${observation.id} pull request number mismatch`);
  assert(pullRequest.base?.sha === observation.baseSha, `${observation.id} pull request base SHA mismatch`);
  assert(pullRequest.head?.ref === runRecord.head_branch, `${observation.id} workflow head branch does not match pull request head branch`);
  assert(Array.isArray(pullRequestCommits) && pullRequestCommits.some(commit => commit?.sha === observation.candidateSha), `${observation.id} candidate SHA is not a commit in PR #${observation.pullRequest}`);
  assertSameStringSet((pullRequestFiles ?? []).map(file => file?.filename).filter(Boolean), observation.changedFiles, `${observation.id} GitHub PR changed files`);

  const producer = jobs.find(job => job.name === HISTORICAL_PRODUCER_JOB);
  assert(producer?.status === 'completed' && producer?.conclusion === 'success', `${observation.id} historical producer job did not pass`);
  const fullStep = producer.steps?.find(step => step.name === HISTORICAL_FULL_STEP);
  assert(fullStep?.status === 'completed' && fullStep?.conclusion === 'success', `${observation.id} authoritative full-verification step did not pass`);
  const final = jobs.find(job => job.name === HISTORICAL_FINAL_JOB);
  assert(final?.status === 'completed' && final?.conclusion === 'success', `${observation.id} historical final candidate gate did not pass`);

  return {
    authenticated: true,
    workflowRunId: runRecord.id,
    workflowName: runRecord.name,
    workflowPath: runRecord.path,
    workflowConclusion: runRecord.conclusion,
    workflowHeadSha: runRecord.head_sha,
    pullRequest: pullRequest.number,
    pullRequestBaseSha: pullRequest.base.sha,
    pullRequestHeadBranch: pullRequest.head.ref,
    candidateCommitInPullRequest: true,
    producerJobId: producer.id,
    fullVerificationStep: HISTORICAL_FULL_STEP,
    finalCandidateJobId: final.id,
  };
}

async function githubJson(path) {
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const token = process.env.GITHUB_TOKEN?.trim();
  assert(repository, 'GITHUB_REPOSITORY is required to authenticate historical EV-15 evidence');
  assert(token, 'GITHUB_TOKEN is required to authenticate historical EV-15 evidence');
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ironshade-ev15-impact-calibration',
    },
  });
  assert(response.ok, `GitHub API ${path} failed with ${response.status}: ${(await response.text()).slice(0, 1000)}`);
  return response.json();
}

async function githubPages(path) {
  const values = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await githubJson(`${path}${separator}per_page=100&page=${page}`);
    assert(Array.isArray(batch), `GitHub API ${path} pagination must return an array`);
    values.push(...batch);
    if (batch.length < 100) return values;
  }
  throw new Error(`GitHub API ${path} exceeded EV-15 pagination bound`);
}

async function authenticateHistoricalObservation(observation) {
  const [runRecord, jobsPayload, pullRequest, pullRequestCommits, pullRequestFiles] = await Promise.all([
    githubJson(`/actions/runs/${observation.fullVerificationRunId}`),
    githubJson(`/actions/runs/${observation.fullVerificationRunId}/jobs?per_page=100`),
    githubJson(`/pulls/${observation.pullRequest}`),
    githubPages(`/pulls/${observation.pullRequest}/commits`),
    githubPages(`/pulls/${observation.pullRequest}/files`),
  ]);
  const jobs = jobsPayload?.jobs;
  assert(Array.isArray(jobs), `${observation.id} historical jobs payload is malformed`);
  const github = validateHistoricalRunEvidence(observation, { runRecord, jobs, pullRequest, pullRequestCommits, pullRequestFiles });
  const gitRange = verifyHistoricalGitRange(observation);
  return { github, gitRange, authenticated: github.authenticated && gitRange.authenticated };
}

export async function observeVerificationTargetRead(command, targetPath) {
  const sandbox = await mkdtemp(join(tmpdir(), 'ironshade-ev15-observe-'));
  const logPath = join(sandbox, 'reads.log');
  const observerPath = resolve('agent/tools/verification-file-observer.cjs');
  const absoluteTarget = resolve(targetPath);
  try {
    const nodeOptions = [process.env.NODE_OPTIONS?.trim(), `--require=${observerPath}`].filter(Boolean).join(' ');
    const result = run(command, {
      env: {
        NODE_OPTIONS: nodeOptions,
        IRONSHADE_OBSERVED_FILE: absoluteTarget,
        IRONSHADE_OBSERVATION_LOG: logPath,
      },
    });
    let observations = [];
    try {
      observations = (await readFile(logPath, 'utf8')).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const matching = observations.filter(value => resolve(value) === absoluteTarget);
    return {
      outcome: 'success',
      command,
      outputDigest: sha256(result.output),
      directTargetObserved: matching.length > 0,
      targetReadObservationCount: matching.length,
    };
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

async function runProbe(probe, impactMap) {
  const selection = selectAffectedVerification(probe.changedFiles, impactMap);
  assert(selection.mode === probe.expectedMode, `${probe.id} expected mode ${probe.expectedMode}, got ${selection.mode}`);
  assert(selection.matchedRuleIds.includes(probe.expectedRuleId), `${probe.id} did not match ${probe.expectedRuleId}`);
  const selectedIds = selection.verifications.map(entry => entry.id);
  assert(canonicalJson(selectedIds) === canonicalJson(probe.expectedVerificationIds), `${probe.id} focused verification drifted: ${selectedIds.join(', ')}`);

  const targetPath = resolve(probe.targetPath);
  const original = await readFile(targetPath, 'utf8');
  const originalDigest = sha256(original);
  const trackedBefore = run('git status --porcelain --untracked-files=no').output;
  assert(trackedBefore.trim() === '', `${probe.id} requires a clean tracked workspace before baseline observation`);

  const baselineFocused = [];
  for (const verification of selection.verifications) {
    baselineFocused.push({ id: verification.id, ...(await observeVerificationTargetRead(verification.command, probe.targetPath)) });
  }
  const trackedAfterBaseline = run('git status --porcelain --untracked-files=no').output;
  assert(trackedAfterBaseline === trackedBefore, `${probe.id} baseline focused checks changed tracked state`);

  const mutatedFocused = [];
  let full = null;
  let trackedDuringProbe = '';
  try {
    await writeFile(targetPath, `${original}${probe.mutationSuffix}`, 'utf8');
    for (const verification of selection.verifications) {
      mutatedFocused.push({ id: verification.id, ...(await observeVerificationTargetRead(verification.command, probe.targetPath)) });
    }
    full = run('npm run verify:full', { expectFailure: true });
    trackedDuringProbe = run('git status --porcelain --untracked-files=no').output;
  } finally {
    run('git restore --source=HEAD --worktree -- .');
  }

  assert(full, `${probe.id} did not execute full verification`);
  const restored = await readFile(targetPath, 'utf8');
  const trackedAfter = run('git status --porcelain --untracked-files=no').output;
  const failedScript = parseFailedNpmScript(full.output);
  const criterionMatched = full.output.includes(probe.expectedFailurePattern);
  const sourceRestored = sha256(restored) === originalDigest && trackedAfter === trackedBefore;
  assert(sourceRestored, `${probe.id} rollback did not restore the exact candidate tracked state: ${trackedAfter || '<clean expected>'}`);
  assert(failedScript === probe.expectedFailureScript, `${probe.id} expected full verification to fail in ${probe.expectedFailureScript}, got ${failedScript ?? 'unknown'}`);
  assert(criterionMatched, `${probe.id} full verification failed without the expected typecheck criterion`);

  const observationRows = selectedIds.map(id => {
    const baseline = baselineFocused.find(entry => entry.id === id);
    const mutated = mutatedFocused.find(entry => entry.id === id);
    assert(baseline && mutated, `${probe.id} missing focused observation for ${id}`);
    assert(baseline.directTargetObserved === mutated.directTargetObserved, `${probe.id} target-read observation for ${id} changed between baseline and mutation`);
    return {
      id,
      baseline,
      mutated,
      directTargetObserved: mutated.directTargetObserved,
      overSelectedForTarget: !mutated.directTargetObserved,
    };
  });
  const directlyObservedVerificationIds = observationRows.filter(entry => entry.directTargetObserved).map(entry => entry.id);
  const overSelectedVerificationIds = observationRows.filter(entry => entry.overSelectedForTarget).map(entry => entry.id);
  assertSameStringSet(directlyObservedVerificationIds, probe.expectedDirectlyObservedVerificationIds, `${probe.id} directly observed focused checks`);
  assertSameStringSet(overSelectedVerificationIds, probe.expectedOverSelectedVerificationIds, `${probe.id} measured over-selected focused checks`);

  return {
    id: probe.id,
    targetPath: probe.targetPath,
    ruleId: probe.expectedRuleId,
    selection: {
      mode: selection.mode,
      verificationIds: selectedIds,
      domains: selection.domains,
    },
    focusedVerification: observationRows,
    fullVerification: {
      outcome: 'failure',
      command: 'npm run verify:full',
      failedScript,
      criterionMatched,
      outputDigest: sha256(full.output),
    },
    comparison: {
      falseNegative: true,
      reason: `all predicted focused checks passed, but full verification failed in unpredicted ${failedScript}`,
      overSelectionMethod: 'runtime-file-read-observation',
      selectedVerificationCount: selectedIds.length,
      directlyObservedVerificationCount: directlyObservedVerificationIds.length,
      directlyObservedVerificationIds,
      overSelectedVerificationCount: overSelectedVerificationIds.length,
      overSelectedVerificationIdsForThisTrial: overSelectedVerificationIds,
      overSelectionRateForThisTrial: selectedIds.length === 0 ? 0 : overSelectedVerificationIds.length / selectedIds.length,
      overSelectionInterpretation: 'A selected focused check is counted as over-selected for this target only when the real focused command never reads the changed target during either baseline or mutated execution. A check that reads the target is not counted as over-selected even when it misses this injected defect.',
    },
    rollback: {
      trackedMutationObserved: trackedDuringProbe.trim().length > 0,
      sourceRestored,
    },
    wideningAction: probe.wideningAction,
  };
}

function summarizeRuleClass(ruleId, entries) {
  const missCount = entries.filter(entry => entry.comparison.falseNegative).length;
  const selectedVerificationCount = entries.reduce((sum, entry) => sum + entry.comparison.selectedVerificationCount, 0);
  const overSelectedVerificationCount = entries.reduce((sum, entry) => sum + entry.comparison.overSelectedVerificationCount, 0);
  return {
    ruleId,
    trialCount: entries.length,
    independentTargetCount: new Set(entries.map(entry => entry.targetPath)).size,
    missCount,
    observedMissRate: entries.length === 0 ? 0 : missCount / entries.length,
    missRateWilson95: wilson95(missCount, entries.length),
    selectedVerificationCount,
    directlyObservedVerificationCount: selectedVerificationCount - overSelectedVerificationCount,
    overSelectedVerificationCount,
    observedOverSelectionRate: selectedVerificationCount === 0 ? 0 : overSelectedVerificationCount / selectedVerificationCount,
    overSelectionRateWilson95: wilson95(overSelectedVerificationCount, selectedVerificationCount),
    overSelectionMethod: 'runtime-file-read-observation',
    evidenceProbeIds: entries.map(entry => entry.id).sort(),
  };
}

export async function runImpactCalibrationEvidence({ candidateSha, executeProbes = true } = {}) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  const head = run('git rev-parse HEAD').output.trim();
  assert(head === candidateSha, `candidateSha ${candidateSha} does not match checked-out HEAD ${head}`);

  const [impactMap, corpusRaw, impactMapRaw] = await Promise.all([
    loadImpactMap(resolve('agent/impact-map.json')),
    readFile(resolve('agent/impact-calibration-corpus.json'), 'utf8'),
    readFile(resolve('agent/impact-map.json'), 'utf8'),
  ]);
  const corpus = validateImpactCalibrationCorpus(JSON.parse(corpusRaw), impactMap);
  const decisionCalibration = calibrateDecision(corpus);
  assert(decisionCalibration.pass, 'EV-15 widening decision calibration exceeded its zero-error budget');

  const historical = [];
  for (const observation of corpus.historicalObservations) {
    const selection = selectAffectedVerification(observation.changedFiles, impactMap);
    const authentication = await authenticateHistoricalObservation(observation);
    assert(authentication.authenticated, `${observation.id} historical evidence did not authenticate`);
    historical.push({
      ...observation,
      authentication,
      currentPrediction: {
        mode: selection.mode,
        ruleIds: selection.matchedRuleIds,
        verificationIds: selection.verifications.map(entry => entry.id),
        unknownFiles: selection.unknownFiles,
      },
      comparison: {
        falseNegative: false,
        overSelectionKnown: false,
        reason: 'Authenticated successful full verification proves no observed miss for this historical candidate. It does not prove any selected check unnecessary, so historical over-selection remains unknown and cannot justify narrowing.',
      },
    });
  }

  const probes = [];
  if (executeProbes) {
    for (const probe of corpus.executableMissProbes) probes.push(await runProbe(probe, impactMap));
  }

  const byRule = new Map();
  for (const entry of probes) {
    const group = byRule.get(entry.ruleId) ?? [];
    group.push(entry);
    byRule.set(entry.ruleId, group);
  }
  const ruleClassMetrics = [...byRule.entries()].map(([ruleId, entries]) => summarizeRuleClass(ruleId, entries));

  const safeWideningCandidates = [];
  for (const [ruleId, entries] of byRule) {
    const metrics = ruleClassMetrics.find(entry => entry.ruleId === ruleId);
    if (!recommendWidening({ missCount: metrics.missCount, independentTargetCount: metrics.independentTargetCount }, corpus.minimumIndependentMissesForWidening)) continue;
    assert(entries.every(entry => entry.wideningAction === 'escalate-rule-to-full'), `${ruleId} probes disagree on widening action`);
    safeWideningCandidates.push({
      ruleId,
      action: 'set-risk-high',
      resultingVerification: 'verify-full',
      missCount: metrics.missCount,
      trialCount: metrics.trialCount,
      observedMissRate: metrics.observedMissRate,
      missRateWilson95: metrics.missRateWilson95,
      selectedVerificationCount: metrics.selectedVerificationCount,
      overSelectedVerificationCount: metrics.overSelectedVerificationCount,
      observedOverSelectionRate: metrics.observedOverSelectionRate,
      overSelectionRateWilson95: metrics.overSelectionRateWilson95,
      overSelectionMethod: metrics.overSelectionMethod,
      evidenceProbeIds: metrics.evidenceProbeIds,
      scopeLimit: 'Evidence proves a deterministic client-TypeScript typecheck gap for this rule class and measures direct target observation by its currently selected checks. It does not justify narrowing any existing check or widening any unmeasured rule class.',
    });
  }

  const calibratedRuleIds = new Set(safeWideningCandidates.map(entry => entry.ruleId));
  const unresolvedClasses = impactMap.rules
    .filter(rule => !calibratedRuleIds.has(rule.id))
    .map(rule => ({
      ruleId: rule.id,
      currentRisk: rule.risk,
      status: rule.risk === 'high' ? 'already-fail-safe' : 'unresolved',
      reason: rule.risk === 'high'
        ? 'Current policy already escalates this class to full verification; EV-15 provides no evidence for narrowing.'
        : 'No two independent executable full-verification miss probes establish a widening for this class; preserve current behavior until separately calibrated.',
    }));

  const totalSelected = probes.reduce((sum, entry) => sum + entry.comparison.selectedVerificationCount, 0);
  const totalOverSelected = probes.reduce((sum, entry) => sum + entry.comparison.overSelectedVerificationCount, 0);
  const report = {
    schema: 'ironshade-impact-calibration-evidence:v1',
    schemaVersion: 1,
    taskId: 'EV-15',
    mode: 'advisory',
    candidateSha,
    corpusDigest: sha256(JSON.parse(corpusRaw)),
    impactMapDigest: sha256(impactMapRaw),
    historicalObservations: historical,
    executableMissProbes: probes,
    ruleClassMetrics,
    metrics: {
      historicalObservationCount: historical.length,
      authenticatedHistoricalObservationCount: historical.filter(entry => entry.authentication.authenticated).length,
      executableProbeCount: probes.length,
      falseNegativeCount: probes.filter(entry => entry.comparison.falseNegative).length,
      falseNegativeRate: probes.length === 0 ? 0 : probes.filter(entry => entry.comparison.falseNegative).length / probes.length,
      selectedVerificationObservationCount: totalSelected,
      overSelectedVerificationCount: totalOverSelected,
      measuredOverSelectionRate: totalSelected === 0 ? 0 : totalOverSelected / totalSelected,
      overSelectionMethod: 'runtime-file-read-observation',
      decisionCalibration,
    },
    safeWideningCandidates,
    unresolvedClasses,
    confidenceLimits: {
      method: corpus.confidence.interval,
      note: corpus.confidence.interpretation,
      minimumIndependentMissesForWidening: corpus.minimumIndependentMissesForWidening,
    },
    rollback: {
      defaultImpactMapChanged: false,
      enforcementEnabled: false,
      sourceMutationsRestored: probes.every(entry => entry.rollback.sourceRestored),
      rollbackAction: 'remove EV-15 calibration-only corpus/tool/test/workflow and file-observer helper; agent/impact-map.json and existing candidate proof gates remain unchanged',
    },
    acceptedForEnforcement: false,
    candidatePassGranted: false,
  };

  assert(report.metrics.authenticatedHistoricalObservationCount === report.metrics.historicalObservationCount, 'every EV-15 historical observation must authenticate independently');
  assert(report.safeWideningCandidates.length <= 1, 'EV-15 must not silently expand beyond the single measured widening candidate');
  assert(report.rollback.defaultImpactMapChanged === false && report.rollback.enforcementEnabled === false, 'EV-15 must remain calibration-only');
  assert(report.rollback.sourceMutationsRestored, 'EV-15 probe mutations must be rolled back exactly');
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  let candidateSha = null;
  let output = null;
  let noProbes = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--candidate-sha') candidateSha = args[++index] ?? null;
    else if (arg === '--output') output = args[++index] ?? null;
    else if (arg === '--no-probes') noProbes = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  const report = await runImpactCalibrationEvidence({ candidateSha, executeProbes: !noProbes });
  if (output) {
    const outputPath = resolve(output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV15_IMPACT_CALIBRATION_PASS candidate=${report.candidateSha} historical=${report.metrics.historicalObservationCount}/${report.metrics.authenticatedHistoricalObservationCount} probes=${report.metrics.executableProbeCount} misses=${report.metrics.falseNegativeCount} overSelected=${report.metrics.overSelectedVerificationCount}/${report.metrics.selectedVerificationObservationCount} widenings=${report.safeWideningCandidates.length} fp=${report.metrics.decisionCalibration.falsePositiveWidenings} fn=${report.metrics.decisionCalibration.falseNegativeWidenings} advisory=true`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EV15_IMPACT_CALIBRATION_ERROR ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
