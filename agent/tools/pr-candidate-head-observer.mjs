import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const OBSERVER_SCHEMA = 'ironshade-pr-candidate-head-observer:v2';
const CALIBRATION_SCHEMA = 'ironshade-pr-candidate-head-observer-calibration:v2';
const DEFAULT_WORKFLOW_PATH = '.github/workflows/pr-candidate.yml';
const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const PRODUCER_HEAD = '${{ needs.candidate-build.outputs.candidate-sha }}';
const PRODUCER_ARTIFACT = '${{ needs.candidate-build.outputs.artifact-name }}';
const SYNTHETIC_EVENT_SHA = '${{ github.sha }}';
const CHECKOUT_ACTION = 'actions/checkout@v7';
const EV18_BUILD_ACTIVE_SHA256 = 'bef616f94dd6b0ed9e6763ee33f16e67c43164c910c596624197ed5ac1204b59';
const REUSE_ENABLED_IF = "env.IRONSHADE_PROOF_CACHE_REUSE != '0'";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function uncomment(line) {
  let single = false;
  let double = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (double && char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && !escaped) double = !double;
    else if (char === '#' && !single && !double && (index === 0 || /\s/.test(line[index - 1]))) return line.slice(0, index).trimEnd();
    escaped = false;
  }
  return line.trimEnd();
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"')))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function keyValue(text) {
  const index = text.indexOf(':');
  if (index < 0) return null;
  const key = text.slice(0, index).trim();
  return key ? { key, value: unquote(text.slice(index + 1)) } : null;
}

function linesOf(text) {
  return text.replace(/\r\n/g, '\n').split('\n').map(raw => {
    const clean = uncomment(raw);
    return {
      raw,
      indent: clean.match(/^ */)?.[0].length ?? 0,
      text: clean.trim(),
      active: clean.trim().length > 0,
    };
  });
}

function nestedMap(lines, start, end, parentIndent) {
  const result = {};
  for (let index = start; index < end; index += 1) {
    const line = lines[index];
    if (!line.active) continue;
    if (line.indent <= parentIndent) break;
    if (line.indent !== parentIndent + 2) continue;
    const parsed = keyValue(line.text);
    if (parsed?.value) result[parsed.key] = parsed.value;
  }
  return result;
}

function blockScalar(lines, start, end, parentIndent) {
  const output = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index];
    if (line.active && line.indent <= parentIndent) break;
    if (!line.active) {
      output.push('');
      continue;
    }
    output.push(line.raw.slice(Math.min(parentIndent + 2, line.raw.match(/^ */)?.[0].length ?? 0)));
  }
  return output.join('\n').replace(/\n+$/g, '');
}

function parseStep(lines, start, end) {
  const step = { with: {}, env: {}, run: '' };
  const first = keyValue(lines[start].text.slice(2).trim());
  if (first?.value) step[first.key] = first.value;
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.active || line.indent !== 8) continue;
    const parsed = keyValue(line.text);
    if (!parsed) continue;
    if ((parsed.key === 'with' || parsed.key === 'env') && !parsed.value) step[parsed.key] = nestedMap(lines, index + 1, end, 8);
    else if (parsed.key === 'run' && ['|', '|-', '>', '>-'].includes(parsed.value)) step.run = blockScalar(lines, index + 1, end, 8);
    else if (parsed.value) step[parsed.key] = parsed.value;
  }
  return step;
}

function parseSteps(lines, start, end) {
  const starts = [];
  for (let index = start; index < end; index += 1) {
    if (lines[index].active && lines[index].indent === 6 && lines[index].text.startsWith('- ')) starts.push(index);
  }
  return starts.map((stepStart, position) => parseStep(lines, stepStart, starts[position + 1] ?? end));
}

function parseJob(lines, start, end) {
  const job = { with: {}, outputs: {}, steps: [] };
  for (let index = start + 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.active || line.indent !== 4) continue;
    const parsed = keyValue(line.text);
    if (!parsed) continue;
    if ((parsed.key === 'with' || parsed.key === 'outputs') && !parsed.value) job[parsed.key] = nestedMap(lines, index + 1, end, 4);
    else if (parsed.key === 'steps' && !parsed.value) job.steps = parseSteps(lines, index + 1, end);
    else if (parsed.value) job[parsed.key] = parsed.value;
  }
  return job;
}

export function parsePrCandidateWorkflow(workflowText) {
  assert(typeof workflowText === 'string' && workflowText.trim(), 'workflowText must be non-empty');
  const lines = linesOf(workflowText);
  const jobsRoot = lines.findIndex(line => line.active && line.indent === 0 && line.text === 'jobs:');
  assert(jobsRoot >= 0, 'workflow must define jobs');
  const starts = [];
  for (let index = jobsRoot + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.active && line.indent === 0) break;
    if (line.active && line.indent === 2 && /^[A-Za-z0-9_-]+:$/.test(line.text)) starts.push(index);
  }
  const jobs = new Map();
  for (let position = 0; position < starts.length; position += 1) {
    const start = starts[position];
    const end = starts[position + 1] ?? lines.length;
    jobs.set(lines[start].text.slice(0, -1), parseJob(lines, start, end));
  }
  return { jobs };
}

function uniqueStep(job, selector) {
  const matches = (job?.steps ?? []).filter(selector);
  return matches.length === 1 ? matches[0] : null;
}

function stepByName(job, name) {
  return uniqueStep(job, step => step.name === name);
}

function checkoutSteps(job) {
  return (job?.steps ?? []).filter(step => step.uses?.startsWith('actions/checkout@'));
}

function uniqueCheckout(job, ref) {
  const steps = checkoutSteps(job);
  return steps.length === 1 && steps[0].uses === CHECKOUT_ACTION && steps[0].with?.ref === ref;
}

function failClosed(step) {
  return Boolean(step) && !Object.hasOwn(step, 'if') && !Object.hasOwn(step, 'continue-on-error');
}

function runLines(step) {
  return (step?.run ?? '').split('\n').map(line => uncomment(line).trim()).filter(Boolean);
}

function hasLines(step, expected) {
  const lines = runLines(step);
  return expected.every(line => lines.includes(line));
}

function installScriptsDisabled(producer) {
  const install = stepByName(producer, 'Install locked dependencies');
  return failClosed(install)
    && !Object.hasOwn(install, 'shell')
    && Object.keys(install.env ?? {}).length === 0
    && runLines(install).length === 1
    && runLines(install)[0] === 'npm ci --ignore-scripts --no-audit --no-fund';
}

function ev18PreflightContract(producer) {
  const preflight = stepByName(producer, 'Prepare EV-18 closed proof inputs');
  return Boolean(preflight)
    && preflight.if === REUSE_ENABLED_IF
    && preflight.env?.CANDIDATE_SHA === PR_HEAD
    && runLines(preflight).length === 1
    && runLines(preflight)[0] === 'bash scripts/prepare-full-repository-build-proof-closed.sh';
}

function ev18RequestContract(producer) {
  const request = stepByName(producer, 'Compute EV-18 exact closure cache key');
  return Boolean(request)
    && request.if === REUSE_ENABLED_IF
    && request.id === 'proof-cache-request'
    && request.env?.CANDIDATE_SHA === PR_HEAD
    && hasLines(request, [
      'node agent/tools/proof-cache-promotion.mjs request \\',
      '--candidate-sha "$CANDIDATE_SHA" \\',
      '--output .agent-proof-cache-ev18/request.json \\',
      '--github-output "$GITHUB_OUTPUT"',
    ]);
}

function ev18RestoreContract(producer) {
  const restore = stepByName(producer, 'Restore EV-18 exact closure proof cache');
  return Boolean(restore)
    && restore.if === REUSE_ENABLED_IF
    && restore.id === 'proof-cache-restore'
    && restore.uses === 'actions/cache/restore@v5'
    && restore.with?.path === '.agent-proof-cache-ev18/cache'
    && restore.with?.key === '${{ steps.proof-cache-request.outputs.cache-key }}'
    && !Object.hasOwn(restore.with ?? {}, 'restore-keys');
}

function ev18DecisionContract(producer) {
  const decision = stepByName(producer, 'Validate EV-18 cache candidate');
  return Boolean(decision)
    && decision.if === REUSE_ENABLED_IF
    && decision.id === 'proof-cache-decision'
    && hasLines(decision, [
      'set -euo pipefail',
      'node agent/tools/proof-cache-promotion.mjs decide \\',
      '--request .agent-proof-cache-ev18/request.json \\',
      '--cache-dir .agent-proof-cache-ev18/cache \\',
      '--output .agent-proof-cache-ev18/decision.json \\',
      '--github-output "$GITHUB_OUTPUT"',
    ]);
}

function sourceBoundBuildContract(producer) {
  const build = stepByName(producer, 'Run authoritative full repository verification or reuse validated closed proof');
  if (!failClosed(build) || build?.id !== 'full-verification') return false;
  if (build?.env?.CANDIDATE_SHA !== PR_HEAD) return false;
  const activeRun = runLines(build).join('\n');
  return ev18PreflightContract(producer)
    && ev18RequestContract(producer)
    && ev18RestoreContract(producer)
    && ev18DecisionContract(producer)
    && sha256(activeRun) === EV18_BUILD_ACTIVE_SHA256;
}

function outputContract(producer) {
  return producer?.outputs?.['candidate-sha'] === '${{ steps.identity.outputs.candidate-sha }}'
    && producer?.outputs?.['artifact-name'] === '${{ steps.identity.outputs.artifact-name }}';
}

function identityContract(producer) {
  const identity = uniqueStep(producer, step => step.id === 'identity');
  if (!failClosed(identity) || identity?.env?.CANDIDATE_SHA !== PR_HEAD) return false;
  const commands = runLines(identity);
  return commands.includes('set -euo pipefail')
    && commands.includes('echo "candidate-sha=$CANDIDATE_SHA" >> "$GITHUB_OUTPUT"')
    && commands.includes('echo "artifact-name=$artifact_name" >> "$GITHUB_OUTPUT"')
    && commands.includes('test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"');
}

function reusableConsumer(job, workflowPath) {
  return job?.uses === workflowPath
    && job?.with?.candidate_sha === PRODUCER_HEAD
    && job?.with?.candidate_artifact_name === PRODUCER_ARTIFACT;
}

function check(id, description, pass, evidence) {
  return { id, description, pass: Boolean(pass), evidence };
}

export function observePrCandidateHeadContract({ workflowText, candidateSha } = {}) {
  assert(typeof candidateSha === 'string' && SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  const parsed = parsePrCandidateWorkflow(workflowText);
  const producer = parsed.jobs.get('candidate-build');
  const review = parsed.jobs.get('independent-review-context');
  const browser = parsed.jobs.get('browser-e2e');
  const android = parsed.jobs.get('android');
  const final = parsed.jobs.get('candidate-verification');
  const checkoutRefs = [...parsed.jobs.values()].flatMap(job => checkoutSteps(job).map(step => step.with?.ref).filter(Boolean));
  const allowedRefs = new Set([PR_HEAD, PRODUCER_HEAD]);
  const checks = [
    check('candidate-build-checkout', 'Producer checks out the immutable PR head exactly once.', uniqueCheckout(producer, PR_HEAD), 'candidate-build must contain exactly one actions/checkout@v7 step bound to github.event.pull_request.head.sha'),
    check('candidate-build-install-scripts-disabled', 'Producer dependency installation is fail-closed against lifecycle hooks.', installScriptsDisabled(producer), 'candidate-build must use the reviewed npm ci --ignore-scripts command unconditionally'),
    check('candidate-build-source-bound-snapshot', 'Every EV-18 producer path remains bound to the exact PR-head request and reviewed fallback/reuse envelope.', sourceBoundBuildContract(producer), 'EV-18 preflight/request/cache decision and full-verification rollback/reuse/fallback paths must match the reviewed exact-head producer contract'),
    check('candidate-output-contract', 'Producer exposes the runtime-asserted exact SHA and artifact identity.', outputContract(producer), 'candidate-build outputs candidate-sha and artifact-name must come from the identity step'),
    check('candidate-identity-runtime-assertion', 'Producer identity output is tied to an unconditional runtime HEAD assertion.', identityContract(producer), 'id: identity must bind CANDIDATE_SHA to PR head, emit candidate/artifact outputs, and assert git rev-parse HEAD'),
    check('review-context-consumer', 'Independent review context consumes the producer exact SHA.', uniqueCheckout(review, PRODUCER_HEAD), 'independent-review-context must contain exactly one checkout bound to producer candidate-sha'),
    check('browser-consumer', 'Browser validation consumes the producer exact SHA and exact artifact.', reusableConsumer(browser, './.github/workflows/browser-e2e.yml'), 'browser-e2e must receive producer candidate-sha and artifact-name outputs'),
    check('android-consumer', 'Android validation consumes the producer exact SHA and exact artifact.', reusableConsumer(android, './.github/workflows/pr-android-apk.yml'), 'android must receive producer candidate-sha and artifact-name outputs'),
    check('final-evidence-checkout', 'Final candidate verification checks out the immutable PR head exactly once.', uniqueCheckout(final, PR_HEAD), 'candidate-verification must contain exactly one actions/checkout@v7 step bound to the PR head'),
    check('no-synthetic-merge-ref', 'Every checkout is bound to the PR head or producer exact SHA.', checkoutRefs.length > 0 && checkoutRefs.every(ref => allowedRefs.has(ref)), 'checkout refs may not use github.sha or a synthetic pull-request merge ref'),
  ];
  const failedCheckIds = checks.filter(entry => !entry.pass).map(entry => entry.id);
  const core = {
    schema: OBSERVER_SCHEMA,
    candidateSha,
    criterionId: 'candidate-workflows-use-exact-pr-head',
    workflowPath: DEFAULT_WORKFLOW_PATH,
    workflowSha256: sha256(workflowText),
    observerSource: 'agent/tools/pr-candidate-head-observer.mjs',
    parsingMode: 'structured-jobs-steps',
    checks,
    checkoutRefs,
    failedCheckIds,
    pass: failedCheckIds.length === 0,
    candidatePassGranted: false,
  };
  return { ...core, reportDigest: sha256(JSON.stringify(core)) };
}

function replaceOnce(text, find, replacement, label) {
  const index = text.indexOf(find);
  assert(index >= 0, `${label} mutation target is missing`);
  return `${text.slice(0, index)}${replacement}${text.slice(index + find.length)}`;
}

function replaceNth(text, find, replacement, occurrence, label) {
  let from = 0;
  let index = -1;
  for (let count = 0; count < occurrence; count += 1) {
    index = text.indexOf(find, from);
    assert(index >= 0, `${label} mutation target occurrence ${occurrence} is missing`);
    from = index + find.length;
  }
  return `${text.slice(0, index)}${replacement}${text.slice(index + find.length)}`;
}

export function calibratePrCandidateHeadObserver({ workflowText, candidateSha } = {}) {
  const baseline = observePrCandidateHeadContract({ workflowText, candidateSha });
  const benign = [
    { id: 'comment-only-change', workflowText: `# EV-9 behavior-preserving observer control\n${workflowText}` },
    { id: 'fetch-depth-nonsemantic-for-head-identity', workflowText: replaceOnce(workflowText, 'fetch-depth: 0', 'fetch-depth: 1', 'fetch-depth control') },
    { id: 'comment-mentions-synthetic-ref', workflowText: `# ref: ${SYNTHETIC_EVENT_SHA}\n# refs/pull/123/merge is documentation only\n${workflowText}` },
    { id: 'identity-comment-mentions-checkout', workflowText: replaceOnce(workflowText, '          set -euo pipefail\n          artifact_name=', `          # git checkout ${SYNTHETIC_EVENT_SHA} is documentation only\n          set -euo pipefail\n          artifact_name=`, 'identity comment control') },
  ];

  const dishonest = [
    {
      id: 'producer-synthetic-event-sha',
      workflowText: replaceNth(workflowText, `ref: ${PR_HEAD}`, `ref: ${SYNTHETIC_EVENT_SHA}`, 1, 'producer checkout'),
      expected: ['candidate-build-checkout', 'no-synthetic-merge-ref'],
    },
    {
      id: 'comment-spoofs-exact-head-ref',
      workflowText: replaceNth(workflowText, `ref: ${PR_HEAD}`, `ref: ${SYNTHETIC_EVENT_SHA}\n          # ref: ${PR_HEAD}`, 1, 'comment-spoofed producer checkout'),
      expected: ['candidate-build-checkout', 'no-synthetic-merge-ref'],
    },
    {
      id: 'later-checkout-overrides-producer',
      workflowText: replaceOnce(workflowText, '      - name: Set up Node 22', `      - name: Dishonest later checkout\n        uses: ${CHECKOUT_ACTION}\n        with:\n          ref: ${SYNTHETIC_EVENT_SHA}\n\n      - name: Set up Node 22`, 'later checkout'),
      expected: ['candidate-build-checkout', 'no-synthetic-merge-ref'],
    },
    {
      id: 'source-bound-build-uses-synthetic-event-sha',
      workflowText: replaceOnce(workflowText, '      - name: Run authoritative full repository verification or reuse validated closed proof\n        id: full-verification\n        env:\n          CANDIDATE_SHA: ${'${{ github.event.pull_request.head.sha }}'}', `      - name: Run authoritative full repository verification or reuse validated closed proof\n        id: full-verification\n        env:\n          CANDIDATE_SHA: ${SYNTHETIC_EVENT_SHA}`, 'source-bound proof candidate binding'),
      expected: ['candidate-build-source-bound-snapshot'],
    },
    {
      id: 'source-bound-build-comment-spoof',
      workflowText: replaceOnce(workflowText, '            bash scripts/run-full-repository-build-proof.sh', '            # bash scripts/run-full-repository-build-proof.sh\n            echo "legacy proof delegation removed"', 'source-bound proof comment spoof'),
      expected: ['candidate-build-source-bound-snapshot'],
    },
    {
      id: 'source-bound-build-quoted-string-spoof',
      workflowText: replaceOnce(workflowText, '            bash scripts/run-full-repository-build-proof.sh', "            echo 'bash scripts/run-full-repository-build-proof.sh'", 'source-bound proof quoted-string spoof'),
      expected: ['candidate-build-source-bound-snapshot'],
    },
    {
      id: 'cache-request-synthetic-candidate',
      workflowText: replaceOnce(workflowText, '            --candidate-sha "$CANDIDATE_SHA" \\', `            --candidate-sha "${SYNTHETIC_EVENT_SHA}" \\`, 'cache request candidate binding'),
      expected: ['candidate-build-source-bound-snapshot'],
    },
    {
      id: 'cache-materialize-without-validated-decision',
      workflowText: replaceOnce(workflowText, "          elif [[ '${{ steps.proof-cache-decision.outputs.reuse }}' == 'true' ]]; then", "          elif [[ 'true' == 'true' ]]; then", 'validated reuse decision'),
      expected: ['candidate-build-source-bound-snapshot'],
    },
    {
      id: 'closed-proof-fallback-removed',
      workflowText: replaceOnce(workflowText, '            bash scripts/run-full-repository-build-proof-closed.sh', '            echo "closed proof fallback removed"', 'closed proof fallback'),
      expected: ['candidate-build-source-bound-snapshot'],
    },
    {
      id: 'identity-assertion-commented-out',
      workflowText: replaceOnce(workflowText, '          test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"\n\n      - name: Detect browser validation scope', '          # test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"\n          echo "identity assertion removed"\n\n      - name: Detect browser validation scope', 'identity assertion'),
      expected: ['candidate-identity-runtime-assertion'],
    },
    {
      id: 'review-context-synthetic-event-sha',
      workflowText: replaceOnce(workflowText, `ref: ${PRODUCER_HEAD}`, `ref: ${SYNTHETIC_EVENT_SHA}`, 'review-context checkout'),
      expected: ['review-context-consumer', 'no-synthetic-merge-ref'],
    },
    {
      id: 'browser-consumer-synthetic-event-sha',
      workflowText: replaceNth(workflowText, `candidate_sha: ${PRODUCER_HEAD}`, `candidate_sha: ${SYNTHETIC_EVENT_SHA}`, 1, 'browser candidate SHA'),
      expected: ['browser-consumer'],
    },
    {
      id: 'android-consumer-synthetic-event-sha',
      workflowText: replaceNth(workflowText, `candidate_sha: ${PRODUCER_HEAD}`, `candidate_sha: ${SYNTHETIC_EVENT_SHA}`, 2, 'android candidate SHA'),
      expected: ['android-consumer'],
    },
    {
      id: 'browser-artifact-substitution',
      workflowText: replaceNth(workflowText, `candidate_artifact_name: ${PRODUCER_ARTIFACT}`, 'candidate_artifact_name: substituted-artifact', 1, 'browser artifact identity'),
      expected: ['browser-consumer'],
    },
    {
      id: 'final-evidence-synthetic-event-sha',
      workflowText: replaceNth(workflowText, `ref: ${PR_HEAD}`, `ref: ${SYNTHETIC_EVENT_SHA}`, 2, 'final checkout'),
      expected: ['final-evidence-checkout', 'no-synthetic-merge-ref'],
    },
  ];

  const negativeControls = benign.map(variant => {
    const report = observePrCandidateHeadContract({ workflowText: variant.workflowText, candidateSha });
    return { id: variant.id, passed: report.pass, falsePositive: !report.pass, failedCheckIds: report.failedCheckIds };
  });
  const dishonestMutations = dishonest.map(variant => {
    const report = observePrCandidateHeadContract({ workflowText: variant.workflowText, candidateSha });
    const detected = !report.pass && variant.expected.every(id => report.failedCheckIds.includes(id));
    return { id: variant.id, detected, falseNegative: !detected, failedCheckIds: report.failedCheckIds, expectedFailedCheckIds: variant.expected };
  });
  const falsePositives = negativeControls.filter(entry => entry.falsePositive).length;
  const falseNegatives = dishonestMutations.filter(entry => entry.falseNegative).length;
  const core = {
    schema: CALIBRATION_SCHEMA,
    candidateSha,
    baselinePass: baseline.pass,
    baselineFailedCheckIds: baseline.failedCheckIds,
    falsePositiveTrials: negativeControls.length,
    falsePositives,
    falsePositiveRate: negativeControls.length ? falsePositives / negativeControls.length : 0,
    falseNegativeTrials: dishonestMutations.length,
    falseNegatives,
    falseNegativeRate: dishonestMutations.length ? falseNegatives / dishonestMutations.length : 0,
    negativeControls,
    dishonestMutations,
    pass: baseline.pass && falsePositives === 0 && falseNegatives === 0,
    candidatePassGranted: false,
  };
  return { ...core, reportDigest: sha256(JSON.stringify(core)) };
}

export async function loadAndObservePrCandidateHeadContract({ workflowPath = DEFAULT_WORKFLOW_PATH, candidateSha } = {}) {
  const workflowText = await readFile(resolve(workflowPath), 'utf8');
  return {
    observation: observePrCandidateHeadContract({ workflowText, candidateSha }),
    calibration: calibratePrCandidateHeadObserver({ workflowText, candidateSha }),
  };
}
