import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { analyzePrCandidateBuildSurface } from './pr-candidate-build-surface.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const OBSERVER_SCHEMA = 'ironshade-pr-candidate-head-observer:v2';
const CALIBRATION_SCHEMA = 'ironshade-pr-candidate-head-observer-calibration:v2';
const DEFAULT_WORKFLOW_PATH = '.github/workflows/pr-candidate.yml';
const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const PR_BASE = '${{ github.event.pull_request.base.sha }}';
const PRODUCER_HEAD = '${{ needs.candidate-build.outputs.candidate-sha }}';
const VITE_API_BASE_URL = '${{ vars.VITE_API_BASE_URL }}';
const FULL_VERIFICATION_OUTCOME = '${{ steps.full-verification.outcome }}';
const CHECKOUT_ACTION = 'actions/checkout@v7';
const SOURCE_AUTH_JOB = 'ev9-observer-source-authenticity';
const SOURCE_AUTH_WORKFLOW_PATTERN = /^papa4568\/ironshade-vector\/\.github\/workflows\/ev9-observer-source-authenticity\.yml@[a-f0-9]{40}$/;
const ENV_PREFLIGHT_STEP = 'Verify producer environment before executable setup';
const ENV_PREFLIGHT_SHELL = '/usr/bin/python3 -I -S -E {0}';
const ENV_PREFLIGHT_RUN_DIGEST = 'cfbf43003c9d70c5572c02f348edf3ed4f936a5f298a4574eb5e5879f6161fe3';
const ALLOWED_PRODUCER_GIT = new Set(['archive', 'diff', 'rev-parse']);
const NODE_ENTRYPOINT_PATTERN = /\bnode\s+(?:(?:--[^\s;&|()]+)\s+)*(?:(["'])([^"']+\.(?:mjs|cjs|js|mts|cts|ts))\1|([^\s;&|()"']+\.(?:mjs|cjs|js|mts|cts|ts)))(?=$|[\s;&|()])/g;
const SELF_OBSERVER_STEP_NAMES = new Set([
  'Run promoted causal evidence independence regressions',
  'Enforce promoted causal evidence independence scope',
]);
const SELF_OBSERVER_SOURCES = new Set([
  'agent/tests/pr-candidate-head-observer.mjs',
  'agent/tools/pr-candidate-head-observer.mjs',
  'agent/tools/pr-candidate-build-surface.mjs',
]);
const SELF_OBSERVER_LITERAL_FINDING_KINDS = new Set([
  'revision-changing-git-command',
  'revision-changing-git-process',
  'dynamic-process-execution',
]);
const APPROVED_DYNAMIC_PROCESS_SOURCES = new Map([
  ['agent/tests/independent-review.mjs', 'adc1557c34b01008122c53f03af0db5c9d5c3951'],
  ['agent/tools/acceptance-attack-compiler.mjs', '6dc80b7d6e43b119508f1d4b2dec4efc1bc1310e'],
  ['agent/tools/acceptance-attack-runtime-calibration.mjs', 'cdbc2e86f9948da388905698ff277e7258517afa'],
  ['agent/tools/candidate-evidence.mjs', '509de6365c1c72eb4e897177758091d9d24ff58a'],
  ['agent/tools/causal-proof-cache.mjs', '9eb3baa6a4bdb0aaeee43ab4f54fbe46c56f7a4a'],
  ['agent/tools/evidence-independence-promotion-gate.mjs', '5301ffdba4596b33a2eeff4cfcef4e4cdbbea817'],
  ['agent/tools/roadmap-shadow-simulator.mjs', '35f5312a4dc47dc7b6562a39f28f1a7695302f91'],
  ['agent/tools/select-affected-verification.mjs', '623f7d16f5247f93d4edc95263d9fc58e1556394'],
  ['agent/tools/select-review-task.mjs', 'd4afadaaeaa36ba1fd68c00f9cc45d903a1837b8'],
  ['scripts/run-behavioral-genome-shadow.mjs', 'ace21f66984c50e8bd00423e4f198b01bb57820e'],
]);
const REVIEWED_PRODUCER_RUN_CONTRACTS = new Map([
  [ENV_PREFLIGHT_STEP, { digest: ENV_PREFLIGHT_RUN_DIGEST, sourceRefs: [] }],
  ['Use npm 10.9.8', { digest: '96bfa528d6eb5606d619b6e35b90d0699886f3c3c747b737f009a72262fcff8c', sourceRefs: [] }],
  ['Install locked dependencies', { digest: '9514b3517c824a0127f135c25784c58557b6a032b154a5a28b501578c90fc70e', sourceRefs: [] }],
  ['Verify candidate artifact integrity contract', { digest: '29ab383128f5a7c8108ec244efc1eb6f742699abf14ea348f7fd01fa33423d22', sourceRefs: ['agent/tests/candidate-artifact.mjs'] }],
  ['Verify single-producer CI reuse contract', { digest: '409e0a77b8e07f79fa02bd6f45e1cf57210ede46f67c8a9868d530fc81e88d3d', sourceRefs: ['agent/tests/ci-proof-reuse.mjs'] }],
  ['Enforce mechanical architecture invariants', { digest: 'ba9efeafeaf9e1f469a7bf3aa08a9f71db23c909d835f35d84b7694433e76c55', sourceRefs: ['agent/tests/architecture-invariants.mjs', 'agent/tools/check-architecture-invariants.mjs'] }],
  ['Verify independent-review contracts', { digest: '3eab63769a5ed477c1fbb2e5ebaae008bda79fa13a5ee0d7fd6d1e9e1d66b255', sourceRefs: ['agent/tests/independent-review.mjs', 'agent/tools/select-review-task.mjs'] }],
  ['Enforce promoted acceptance attack scope', { digest: '05be4b25d93709808783ae98a34002318f8efb5ce724f699724b2813cd41e9d3', sourceRefs: ['agent/tools/acceptance-attack-gate.mjs'] }],
  ['Run promoted causal evidence independence regressions', { digest: '6d7f6af6756a4e27220efddfae4828a1be90ec289daf75c8efe9ce62c3ea686f', sourceRefs: ['agent/tests/evidence-independence-promotion.mjs', 'agent/tests/pr-candidate-head-observer.mjs'] }],
  ['Enforce promoted causal evidence independence scope', { digest: '9696fdc3af1a7a7dda83f01b87ac355bed10b75560e2ba4f67fb8b9e1ac45c40', sourceRefs: ['agent/tools/evidence-independence-promotion-gate.mjs'] }],
  ['Audit runtime dependencies once', { digest: 'ff5d35566e1acf1bf51e8405752ac224b81307ef3c5f2e286fde230a5423c018', sourceRefs: [] }],
  ['Capture EV-7 roadmap shadow simulator advisory evidence', { digest: '6c99764dbc0226eeb60f14bdc87241bf1237951393d08c3a7626273abab21607', sourceRefs: ['agent/tools/roadmap-shadow-simulator.mjs'] }],
  ['Predict EV-6 causal proof reuse in shadow mode', { digest: 'bad3b720e304dd4aae3adbfcbaa8baed75601cb0afbcb4bc9deb02e9810a0200', sourceRefs: ['agent/tools/causal-proof-cache.mjs'] }],
  ['Run full repository verification and production build once', { digest: 'f3566aeed8d4bcbfa84ddf9c779047e30405d9c49a9a22f66704961a421703c5', sourceRefs: [] }],
  ['Capture EV-5 impact-map calibration shadow evidence', { digest: '6c2eea423b708fdd3ce03676271ce6ed9e41e6ec72a6084250d9eba97f988507', sourceRefs: ['agent/tools/impact-map-calibration.mjs'], if: 'always()' }],
  ['Compare EV-6 reuse prediction with the real rerun', { digest: 'f729878282a5e44db1e05f7516f7d9fa12f68062ae527a7c6aa97dae1c0aa33e', sourceRefs: ['agent/tools/causal-proof-cache.mjs'], if: 'always()' }],
  ['Capture EV-3 behavioral genome shadow evidence', { digest: '3f2dfa428f202ea2b5f3ab01e9c8ee64d7bfb966d9d849a23a4ddb16f6373dfe', sourceRefs: ['scripts/run-behavioral-genome-shadow.mjs'] }],
  ['Record candidate identity', { digest: '40a5206029927f8ea80c96dfbc39f7e59c40ff0cb57fbf3ad1c57d27def67733', sourceRefs: [] }],
  ['Create exact candidate web artifact manifest', { digest: '6c9044c6f868ba88d705a6eb509f010497f36fd2ff3d29ba12a0c48db98e7c29', sourceRefs: ['agent/tools/candidate-artifact.mjs'] }],
  ['Detect browser validation scope', { digest: '891a22b8830062b3fc3a26a840b32103a90d03a0f5e53c4eb10dbf98c5242efe', sourceRefs: [] }],
]);
const REVIEWED_PRODUCER_ACTIONS = new Map([
  ['Check out exact candidate revision', 'actions/checkout@v7'],
  ['Set up Node 22', 'actions/setup-node@v7'],
  ['Upload promoted acceptance attack exact-SHA evidence', 'actions/upload-artifact@v7'],
  ['Upload promoted causal evidence independence exact-SHA evidence', 'actions/upload-artifact@v7'],
  ['Upload EV-7 roadmap shadow simulator advisory evidence', 'actions/upload-artifact@v7'],
  ['Upload EV-5 impact-map calibration advisory evidence', 'actions/upload-artifact@v7'],
  ['Upload EV-6 causal proof cache advisory evidence', 'actions/upload-artifact@v7'],
  ['Upload EV-3 behavioral genome advisory evidence', 'actions/upload-artifact@v7'],
  ['Upload exact candidate web bundle', 'actions/upload-artifact@v7'],
]);
const REVIEWED_PRODUCER_STEP_ENVS = new Map([
  ['Enforce promoted acceptance attack scope', { CANDIDATE_SHA: PR_HEAD }],
  ['Enforce promoted causal evidence independence scope', { CANDIDATE_SHA: PR_HEAD }],
  ['Capture EV-7 roadmap shadow simulator advisory evidence', { CANDIDATE_SHA: PR_HEAD }],
  ['Predict EV-6 causal proof reuse in shadow mode', { CANDIDATE_SHA: PR_HEAD, VITE_API_BASE_URL }],
  ['Run full repository verification and production build once', { CANDIDATE_SHA: PR_HEAD, VITE_API_BASE_URL }],
  ['Capture EV-5 impact-map calibration shadow evidence', { BASE_SHA: PR_BASE, HEAD_SHA: PR_HEAD, FULL_VERIFICATION_OUTCOME }],
  ['Compare EV-6 reuse prediction with the real rerun', { FULL_VERIFICATION_OUTCOME }],
  ['Capture EV-3 behavioral genome shadow evidence', { CANDIDATE_SHA: PR_HEAD }],
  ['Record candidate identity', { CANDIDATE_SHA: PR_HEAD }],
  ['Create exact candidate web artifact manifest', { CANDIDATE_SHA: PR_HEAD }],
  ['Detect browser validation scope', { BASE_SHA: PR_BASE, HEAD_SHA: PR_HEAD }],
]);

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
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (double && char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && !escaped) double = !double;
    else if (char === '#' && !single && !double && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
    escaped = false;
  }
  return line.trimEnd();
}

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"')))) return v.slice(1, -1);
  return v;
}

function kv(text) {
  const index = text.indexOf(':');
  if (index < 0) return null;
  const key = text.slice(0, index).trim();
  return key ? { key, value: unquote(text.slice(index + 1)) } : null;
}

function linesOf(text) {
  return text.replace(/\r\n/g, '\n').split('\n').map((raw, index) => {
    const clean = uncomment(raw);
    return { raw, index, indent: clean.match(/^ */)?.[0].length ?? 0, text: clean.trim(), active: clean.trim().length > 0 };
  });
}

function nestedMap(lines, start, end, parentIndent) {
  const result = {};
  for (let i = start; i < end; i += 1) {
    const line = lines[i];
    if (!line.active) continue;
    if (line.indent <= parentIndent) break;
    if (line.indent !== parentIndent + 2) continue;
    const parsed = kv(line.text);
    if (parsed?.value) result[parsed.key] = parsed.value;
  }
  return result;
}

function blockScalar(lines, start, end, parentIndent) {
  const output = [];
  for (let i = start; i < end; i += 1) {
    const line = lines[i];
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
  const first = kv(lines[start].text.slice(2).trim());
  if (first?.value) step[first.key] = first.value;
  for (let i = start + 1; i < end; i += 1) {
    const line = lines[i];
    if (!line.active || line.indent !== 8) continue;
    const parsed = kv(line.text);
    if (!parsed) continue;
    if ((parsed.key === 'with' || parsed.key === 'env') && !parsed.value) step[parsed.key] = nestedMap(lines, i + 1, end, 8);
    else if (parsed.key === 'run' && ['|', '|-', '>', '>-'].includes(parsed.value)) step.run = blockScalar(lines, i + 1, end, 8);
    else if (parsed.value) step[parsed.key] = parsed.value;
  }
  return step;
}

function parseSteps(lines, start, end) {
  const starts = [];
  for (let i = start; i < end; i += 1) if (lines[i].active && lines[i].indent === 6 && lines[i].text.startsWith('- ')) starts.push(i);
  return starts.map((startIndex, position) => parseStep(lines, startIndex, starts[position + 1] ?? end));
}

function parseJob(lines, start, end, id) {
  const job = { id, with: {}, outputs: {}, env: {}, steps: [] };
  for (let i = start + 1; i < end; i += 1) {
    const line = lines[i];
    if (!line.active || line.indent !== 4) continue;
    const parsed = kv(line.text);
    if (!parsed) continue;
    if ((parsed.key === 'with' || parsed.key === 'outputs' || parsed.key === 'env') && !parsed.value) job[parsed.key] = nestedMap(lines, i + 1, end, 4);
    else if (parsed.key === 'steps' && !parsed.value) job.steps = parseSteps(lines, i + 1, end);
    else if (parsed.value) job[parsed.key] = parsed.value;
  }
  return job;
}

export function parsePrCandidateWorkflow(workflowText) {
  assert(typeof workflowText === 'string' && workflowText.trim(), 'PR candidate workflow text must be non-empty');
  const lines = linesOf(workflowText);
  const jobsIndex = lines.findIndex(line => line.active && line.indent === 0 && line.text === 'jobs:');
  assert(jobsIndex >= 0, 'PR candidate workflow is missing top-level jobs mapping');
  const starts = [];
  for (let i = jobsIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.active) continue;
    if (line.indent === 0) break;
    if (line.indent === 2 && /^[A-Za-z0-9_-]+:$/.test(line.text)) starts.push({ index: i, id: line.text.slice(0, -1) });
  }
  assert(starts.length > 0, 'PR candidate workflow has no jobs');
  const jobs = new Map();
  starts.forEach((entry, position) => jobs.set(entry.id, parseJob(lines, entry.index, starts[position + 1]?.index ?? lines.length, entry.id)));
  return { jobs };
}

function checkoutSteps(job) {
  return job.steps.filter(step => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'));
}

function uniqueCheckout(job, expectedRef) {
  const steps = checkoutSteps(job);
  return steps.length === 1 && steps[0].uses === CHECKOUT_ACTION && steps[0].with.ref === expectedRef;
}

function scriptLines(script) {
  return script.split('\n').map(uncomment).filter(line => line.trim()).map(line => line.trim());
}

function producerGitCommands(job) {
  const commands = [];
  job.steps.forEach((step, stepIndex) => {
    if (typeof step.run !== 'string' || !step.run.trim()) return;
    for (const line of scriptLines(step.run)) {
      for (const match of line.matchAll(/\bgit\s+([^\s;&|()]+)/g)) commands.push({ stepIndex, stepId: step.id ?? null, stepName: step.name ?? null, subcommand: match[1], line });
    }
  });
  return commands;
}

function producerLocalSourceRefs(script) {
  const refs = new Set();
  for (const line of scriptLines(script)) {
    for (const match of line.matchAll(NODE_ENTRYPOINT_PATTERN)) {
      const token = match[2] ?? match[3];
      if (!token || token.includes('://')) continue;
      refs.add(token.replace(/^\.\//, '').replaceAll('\\', '/'));
    }
  }
  return [...refs].sort();
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameStringMap(left, right) {
  if (!left || typeof left !== 'object' || Array.isArray(left) || !right || typeof right !== 'object' || Array.isArray(right)) return false;
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return leftEntries.length === rightEntries.length
    && leftEntries.every(([key, value], index) => key === rightEntries[index][0] && value === rightEntries[index][1]);
}

function canonicalRunDigest(script) {
  return sha256(scriptLines(script).join('\n'));
}

function gitBlobSha(text) {
  const header = `blob ${Buffer.byteLength(text)}\0`;
  return createHash('sha1').update(header).update(text).digest('hex');
}

function sourceTextForReview(source, sourceOverrides) {
  if (Object.prototype.hasOwnProperty.call(sourceOverrides, source)) return sourceOverrides[source];
  try {
    return readFileSync(resolve(source), 'utf8');
  } catch {
    return null;
  }
}

function approvedReviewedFinding(finding, sourceOverrides, { selfObserverStep = false } = {}) {
  if (selfObserverStep && SELF_OBSERVER_SOURCES.has(finding.source) && SELF_OBSERVER_LITERAL_FINDING_KINDS.has(finding.kind)) return true;
  if (finding.kind !== 'dynamic-process-execution') return false;
  const expectedBlobSha = APPROVED_DYNAMIC_PROCESS_SOURCES.get(finding.source);
  if (!expectedBlobSha) return false;
  const text = sourceTextForReview(finding.source, sourceOverrides);
  return text !== null && gitBlobSha(text) === expectedBlobSha;
}

function classifyProducerRunSteps(job) {
  const remainingReviewedNames = new Set(REVIEWED_PRODUCER_RUN_CONTRACTS.keys());
  const steps = job.steps.flatMap((step, stepIndex) => {
    if (typeof step.run !== 'string' || !step.run.trim()) return [];
    const stepName = step.name ?? null;
    const directSourceRefs = producerLocalSourceRefs(step.run);
    const runDigest = canonicalRunDigest(step.run);
    const stepIf = step.if ?? null;
    const contract = stepName && remainingReviewedNames.has(stepName)
      ? REVIEWED_PRODUCER_RUN_CONTRACTS.get(stepName)
      : null;
    const expectedSourceRefs = contract ? [...contract.sourceRefs].sort() : null;
    const expectedRunDigest = contract?.digest ?? null;
    const expectedIf = contract?.if ?? null;
    const reviewed = contract !== null
      && stepIf === expectedIf
      && runDigest === expectedRunDigest
      && sameStringArray(directSourceRefs, expectedSourceRefs);
    if (reviewed) remainingReviewedNames.delete(stepName);
    return [{ stepIndex, step, reviewed, directSourceRefs, expectedSourceRefs, runDigest, expectedRunDigest, stepIf, expectedIf }];
  });
  return { steps, missingReviewedRunSteps: [...remainingReviewedNames].sort() };
}

function analyzeProducerRunSurface(job, sourceOverrides = {}) {
  const packageJsonText = readFileSync(resolve('package.json'), 'utf8');
  const packageJson = JSON.parse(packageJsonText);
  const classification = classifyProducerRunSteps(job);
  const reports = classification.steps.map(({ stepIndex, step, reviewed, directSourceRefs, expectedSourceRefs, runDigest, expectedRunDigest, stepIf, expectedIf }) => {
    const syntheticPackage = structuredClone(packageJson);
    syntheticPackage.scripts ??= {};
    syntheticPackage.scripts['ev9:producer-step'] = step.run;
    syntheticPackage.scripts.build = 'npm run ev9:producer-step';
    const report = analyzePrCandidateBuildSurface({
      packageJsonText: `${JSON.stringify(syntheticPackage, null, 2)}\n`,
      sourceOverrides,
    });
    const selfObserverStep = SELF_OBSERVER_STEP_NAMES.has(step.name ?? '');
    const analyzerBlockingFindings = reviewed
      ? report.findings.filter(finding => !approvedReviewedFinding(finding, sourceOverrides, { selfObserverStep }))
      : report.findings;
    const contractFindings = reviewed ? [] : [{
      kind: 'unreviewed-producer-run-step',
      source: `candidate-build step ${stepIndex}${step.name ? ` (${step.name})` : ''}`,
      evidence: expectedRunDigest
        ? 'producer run body, executable entrypoints, or execution condition differ from the reviewed contract'
        : 'producer run step is not part of the reviewed contract',
    }];
    const blockingFindings = [...contractFindings, ...analyzerBlockingFindings];
    return {
      stepIndex,
      stepId: step.id ?? null,
      stepName: step.name ?? null,
      reviewed,
      selfObserverStep,
      runDigest,
      expectedRunDigest,
      directSourceRefs,
      expectedSourceRefs,
      stepIf,
      expectedIf,
      pass: blockingFindings.length === 0,
      findings: report.findings,
      approvedFindings: reviewed ? report.findings.filter(finding => approvedReviewedFinding(finding, sourceOverrides, { selfObserverStep })) : [],
      blockingFindings,
      reachablePackageScripts: report.reachablePackageScripts,
      reachableSourceFiles: report.reachableSourceFiles,
    };
  });
  return {
    reviewedRunContracts: Object.fromEntries([...REVIEWED_PRODUCER_RUN_CONTRACTS].map(([name, contract]) => [name, { digest: contract.digest, sourceRefs: [...contract.sourceRefs].sort(), if: contract.if ?? null }])),
    approvedDynamicProcessSources: Object.fromEntries(APPROVED_DYNAMIC_PROCESS_SOURCES),
    selfObserverBoundary: {
      stepNames: [...SELF_OBSERVER_STEP_NAMES].sort(),
      sourcePaths: [...SELF_OBSERVER_SOURCES].sort(),
      allowedLiteralFindingKinds: [...SELF_OBSERVER_LITERAL_FINDING_KINDS].sort(),
      rationale: 'The semantic observer cannot independently prove its own implementation text. Its detector and attack literals are reported but do not self-block; exact-SHA trusted independent review remains the external proof for this boundary.',
    },
    reviewedRunStepCount: reports.filter(report => report.reviewed).length,
    unreviewedRunStepCount: reports.filter(report => !report.reviewed).length,
    missingReviewedRunSteps: classification.missingReviewedRunSteps,
    reports,
    pass: classification.missingReviewedRunSteps.length === 0 && reports.every(report => report.pass),
  };
}

function producerActionContract(job) {
  const remaining = new Set(REVIEWED_PRODUCER_ACTIONS.keys());
  const reports = job.steps.flatMap((step, stepIndex) => {
    if (typeof step.uses !== 'string' || !step.uses.trim()) return [];
    const stepName = step.name ?? null;
    const expectedUses = stepName && remaining.has(stepName) ? REVIEWED_PRODUCER_ACTIONS.get(stepName) : null;
    const reviewed = expectedUses !== null && step.uses === expectedUses;
    if (reviewed) remaining.delete(stepName);
    return [{ stepIndex, stepName, uses: step.uses, expectedUses, reviewed }];
  });
  return {
    reviewedActions: Object.fromEntries(REVIEWED_PRODUCER_ACTIONS),
    missingReviewedActions: [...remaining].sort(),
    unreviewedActions: reports.filter(report => !report.reviewed),
    reports,
    pass: remaining.size === 0 && reports.every(report => report.reviewed),
  };
}

function producerEnvironmentContract(job) {
  const jobEnv = job.env ?? {};
  const reports = job.steps.map((step, stepIndex) => {
    const stepName = step.name ?? null;
    const actualEnv = step.env ?? {};
    const expectedEnv = stepName && REVIEWED_PRODUCER_STEP_ENVS.has(stepName)
      ? REVIEWED_PRODUCER_STEP_ENVS.get(stepName)
      : {};
    return {
      stepIndex,
      stepName,
      actualEnv,
      expectedEnv,
      pass: sameStringMap(actualEnv, expectedEnv),
    };
  });
  return {
    jobEnv,
    expectedJobEnv: {},
    expectedStepEnvs: Object.fromEntries(REVIEWED_PRODUCER_STEP_ENVS),
    reports,
    pass: sameStringMap(jobEnv, {}) && reports.every(report => report.pass),
  };
}

function producerEnvironmentPreflightContract(job) {
  const preflightIndices = job.steps.flatMap((step, index) => step.name === ENV_PREFLIGHT_STEP ? [index] : []);
  const checkoutIndex = job.steps.findIndex(step => step.name === 'Check out exact candidate revision' && step.uses === CHECKOUT_ACTION);
  const preflightIndex = preflightIndices[0] ?? -1;
  const step = preflightIndex >= 0 ? job.steps[preflightIndex] : null;
  const runDigest = step && typeof step.run === 'string' ? canonicalRunDigest(step.run) : null;
  const pass = preflightIndices.length === 1
    && checkoutIndex >= 0
    && preflightIndex === checkoutIndex + 1
    && step.if === undefined
    && step.shell === ENV_PREFLIGHT_SHELL
    && sameStringMap(step.env ?? {}, {})
    && runDigest === ENV_PREFLIGHT_RUN_DIGEST;
  return {
    stepName: ENV_PREFLIGHT_STEP,
    checkoutIndex,
    preflightIndices,
    requiredShell: ENV_PREFLIGHT_SHELL,
    actualShell: step?.shell ?? null,
    expectedRunDigest: ENV_PREFLIGHT_RUN_DIGEST,
    runDigest,
    pass,
  };
}

function installScriptsDisabled(job) {
  const steps = job.steps.filter(step => step.name === 'Install locked dependencies');
  return steps.length === 1
    && steps[0].if === undefined
    && (steps[0].run ?? '').trim() === 'npm ci --ignore-scripts --no-audit --no-fund';
}

function sealedBuildContract(job) {
  const steps = job.steps.filter(step => step.id === 'full-verification');
  if (steps.length !== 1) return false;
  const step = steps[0];
  const script = step.run ?? '';
  const installBlock = [
    'docker run --rm \\',
    '  --volume "$snapshot:/workspace" \\',
    '  --workdir /workspace \\',
    '  --env HOME=/tmp \\',
    '  --user "$(id -u):$(id -g)" \\',
    '  "$image" \\',
    '  npm ci --ignore-scripts --no-audit --no-fund',
  ].join('\n');
  const buildBlock = [
    'docker run --rm \\',
    '  --network none \\',
    '  --volume "$snapshot:/workspace" \\',
    '  --workdir /workspace \\',
    '  --env HOME=/tmp \\',
    '  --env npm_config_ignore_scripts=true \\',
    '  --env VITE_API_BASE_URL \\',
    '  --user "$(id -u):$(id -g)" \\',
    '  "$image" \\',
    '  npm run build 2>&1 | tee .agent-impact-calibration/full-verification.log',
  ].join('\n');
  const archive = 'git archive --format=tar "$CANDIDATE_SHA" | tar -xf - -C "$snapshot"';
  const noGit = 'test ! -e "$snapshot/.git"';
  const copyDist = 'cp -a "$snapshot/dist" dist';
  const archiveIndex = script.indexOf(archive);
  const noGitIndex = script.indexOf(noGit);
  const installIndex = script.indexOf(installBlock);
  const buildIndex = script.indexOf(buildBlock);
  const copyIndex = script.indexOf(copyDist);
  const explicitBuildCount = (script.match(/(^|\n)\s*npm run build\b/g) ?? []).length;
  return step.if === undefined
    && step.env.CANDIDATE_SHA === PR_HEAD
    && scriptLines(script).includes('set -euo pipefail')
    && script.includes('snapshot="$(mktemp -d)"')
    && script.includes('test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"')
    && archiveIndex >= 0
    && noGitIndex > archiveIndex
    && installIndex > noGitIndex
    && buildIndex > installIndex
    && copyIndex > buildIndex
    && explicitBuildCount === 1
    && !script.includes('$GITHUB_WORKSPACE:/workspace')
    && !script.includes('${GITHUB_WORKSPACE}:/workspace');
}

function identityContract(job) {
  const steps = job.steps.filter(step => step.id === 'identity');
  if (steps.length !== 1) return false;
  const step = steps[0];
  const commands = scriptLines(step.run ?? '');
  return job.outputs['candidate-sha'] === '${{ steps.identity.outputs.candidate-sha }}'
    && step.if === undefined
    && step.env.CANDIDATE_SHA === PR_HEAD
    && !commands.some(command => /^(if\b|then\b|else\b|elif\b|fi\b|for\b|while\b|until\b|case\b|esac\b|function\b|\{|\})/.test(command))
    && commands.includes('set -euo pipefail')
    && commands.includes('echo "candidate-sha=$CANDIDATE_SHA" >> "$GITHUB_OUTPUT"')
    && commands.includes('test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"');
}

function sourceAuthenticityContract(parsed, producer) {
  const sourceAuth = parsed.jobs.get(SOURCE_AUTH_JOB);
  const uses = sourceAuth?.uses ?? null;
  const candidateSha = sourceAuth?.with?.candidate_sha ?? null;
  const producerNeeds = producer?.needs ?? null;
  const pass = Boolean(sourceAuth)
    && SOURCE_AUTH_WORKFLOW_PATTERN.test(uses ?? '')
    && candidateSha === PR_HEAD
    && producerNeeds === SOURCE_AUTH_JOB;
  return {
    jobPresent: Boolean(sourceAuth),
    uses,
    candidateSha,
    producerNeeds,
    pass,
  };
}

function check(id, description, pass, evidence) {
  return { id, description, pass, evidence };
}

export function observePrCandidateHeadContract({ workflowText, candidateSha, sourceOverrides = {} }) {
  assert(typeof candidateSha === 'string' && SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  const parsed = parsePrCandidateWorkflow(workflowText);
  const producer = parsed.jobs.get('candidate-build');
  const review = parsed.jobs.get('independent-review-context');
  const browser = parsed.jobs.get('browser-e2e');
  const android = parsed.jobs.get('android');
  const final = parsed.jobs.get('candidate-verification');
  for (const [id, job] of [['candidate-build', producer], ['independent-review-context', review], ['browser-e2e', browser], ['android', android], ['candidate-verification', final]]) assert(job, `PR candidate workflow is missing ${id} job`);

  const checkoutRefs = [...parsed.jobs.values()].flatMap(job => checkoutSteps(job).map(step => step.with.ref ?? null));
  const gitCommands = producerGitCommands(producer);
  const producerRunSurface = analyzeProducerRunSurface(producer, sourceOverrides);
  const producerActions = producerActionContract(producer);
  const producerEnvironment = producerEnvironmentContract(producer);
  const producerEnvironmentPreflight = producerEnvironmentPreflightContract(producer);
  const sourceAuthenticity = sourceAuthenticityContract(parsed, producer);
  const allowedRefs = new Set([PR_HEAD, PRODUCER_HEAD]);
  const checks = [
    check('candidate-build-checkout', 'Producer checks out the immutable PR head exactly once.', uniqueCheckout(producer, PR_HEAD), 'candidate-build must contain exactly one actions/checkout@v7 step bound to github.event.pull_request.head.sha'),
    check('candidate-build-environment-preflight', 'Producer environment is checked before Node/npm setup can execute candidate-controlled preload hooks.', producerEnvironmentPreflight.pass, 'candidate-build must execute the digest-pinned isolated-Python environment preflight immediately after checkout, unconditionally, before setup-node or npm'),
    check('candidate-build-install-scripts-disabled', 'Dependency installation cannot execute candidate-controlled lifecycle scripts before verification.', installScriptsDisabled(producer), 'candidate-build locked dependency install must use npm ci --ignore-scripts --no-audit --no-fund'),
    check('candidate-build-shell-git-safety', 'Producer shell steps cannot source another Git revision before or during build.', gitCommands.every(entry => ALLOWED_PRODUCER_GIT.has(entry.subcommand)), 'candidate-build direct Git invocations are fail-closed and limited to read-only archive/diff/rev-parse; revision-changing Git commands are rejected'),
    check('candidate-build-action-safety', 'Producer action steps and immutable source-auth dependency retain the reviewed contract.', producerActions.pass && sourceAuthenticity.pass, 'candidate-build action steps must match the reviewed name/action pairs exactly, and candidate-build must depend on an immutable full-SHA ev9-observer-source-authenticity reusable workflow bound to the PR head'),
    check('candidate-build-environment-safety', 'Producer job and step environments retain the reviewed exact map and cannot inject executable preload hooks.', producerEnvironment.pass, 'candidate-build job env must remain empty and every step env map must exactly match the reviewed contract; added NODE_OPTIONS, BASH_ENV, PYTHONPATH, loader, or other environment entries fail closed'),
    check('candidate-build-transitive-step-safety', 'Every producer run step retains its reviewed executable contract and has no unapproved transitive executable finding.', producerRunSurface.pass, 'candidate-build run bodies, executable Node entrypoints, and execution conditions are pinned; changed, skipped, or added run steps fail closed, and non-self transitive sources are analyzed through agent/tools/pr-candidate-build-surface.mjs'),
    check('candidate-build-sealed-runtime', 'The full build executes from an exact-SHA Git archive with no Git metadata and no build-time network.', sealedBuildContract(producer), 'full-verification must archive CANDIDATE_SHA into an isolated workspace, install with lifecycle scripts disabled, and run the only npm build inside a network-disabled container that mounts only that Git-less snapshot'),
    check('candidate-identity-runtime-assertion', 'Producer identity output is tied to an unconditional runtime HEAD assertion.', identityContract(producer), 'id: identity must bind CANDIDATE_SHA to PR head and assert git rev-parse HEAD under set -euo pipefail'),
    check('review-context-consumer', 'Review context consumes producer exact SHA.', uniqueCheckout(review, PRODUCER_HEAD), 'independent-review-context checkout must use producer candidate-sha output'),
    check('browser-consumer', 'Browser workflow consumes producer exact SHA.', browser.uses === './.github/workflows/browser-e2e.yml' && browser.with.candidate_sha === PRODUCER_HEAD, 'browser-e2e candidate_sha must use producer candidate-sha output'),
    check('android-consumer', 'Android workflow consumes producer exact SHA.', android.uses === './.github/workflows/pr-android-apk.yml' && android.with.candidate_sha === PRODUCER_HEAD, 'android candidate_sha must use producer candidate-sha output'),
    check('final-evidence-checkout', 'Final evidence job checks out immutable PR head exactly once.', uniqueCheckout(final, PR_HEAD), 'candidate-verification checkout must use PR head'),
    check('no-synthetic-merge-ref', 'All checkout actions are bound to PR head or producer exact SHA.', checkoutRefs.length > 0 && checkoutRefs.every(ref => allowedRefs.has(ref)), 'checkout refs must not use github.sha or synthetic merge refs'),
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
    producerGitCommands: gitCommands,
    allowedProducerGitSubcommands: [...ALLOWED_PRODUCER_GIT].sort(),
    sourceAuthenticity,
    producerActions,
    producerEnvironment,
    producerEnvironmentPreflight,
    producerRunSurface,
    unreviewedProducerSurface: producerRunSurface,
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

function removeJobBlock(text, jobId, nextJobId) {
  const startMarker = `  ${jobId}:\n`;
  const nextMarker = `  ${nextJobId}:\n`;
  const start = text.indexOf(startMarker);
  const next = text.indexOf(nextMarker, start + startMarker.length);
  assert(start >= 0 && next > start, `${jobId} job block mutation target is missing`);
  return `${text.slice(0, start)}${text.slice(next)}`;
}

export function calibratePrCandidateHeadObserver({ workflowText, candidateSha }) {
  const baseline = observePrCandidateHeadContract({ workflowText, candidateSha });
  const benign = [
    { id: 'comment-only-change', workflowText: `# EV-9 behavior-preserving observer control\n${workflowText}` },
    { id: 'fetch-depth-nonsemantic-for-head-identity', workflowText: replaceOnce(workflowText, 'fetch-depth: 0', 'fetch-depth: 1', 'fetch depth control') },
    { id: 'comment-mentions-synthetic-ref', workflowText: `# ref: \${{ github.sha }}\n# refs/pull/123/merge is documentation only\n${workflowText}` },
    { id: 'shell-comment-mentions-git-checkout', workflowText: replaceOnce(workflowText, '          set -euo pipefail\n          mkdir -p .agent-impact-calibration', '          # git checkout ${{ github.sha }} is documentation only\n          set -euo pipefail\n          mkdir -p .agent-impact-calibration', 'shell comment control') },
  ];
  const indirectHelperSource = [
    "import { spawnSync } from 'node:",
    "child_process';\n",
    "spawnSync('git', ['checkout', 'deadbeef'], { stdio: 'ignore' });\n",
    "spawnSync('git', ['checkout', process.env.CANDIDATE_SHA ?? 'HEAD'], { stdio: 'ignore' });\n",
  ].join('');
  const indirectProducerWorkflow = replaceOnce(
    workflowText,
    '      - name: Set up Node 22',
    '      - name: Dishonest indirect producer revision switch\n        run: node scripts/ev9-indirect-producer-step.mjs\n\n      - name: Set up Node 22',
    'indirect producer step',
  );
  const sameNameIndirectWorkflow = replaceOnce(
    workflowText,
    '      - name: Verify candidate artifact integrity contract\n        run: node agent/tests/candidate-artifact.mjs',
    '      - name: Verify candidate artifact integrity contract\n        run: node scripts/ev9-indirect-producer-step.mjs',
    'reviewed-name indirect producer step',
  );
  const installPreloadWorkflow = replaceOnce(
    workflowText,
    '      - name: Install locked dependencies\n        run: npm ci --ignore-scripts --no-audit --no-fund',
    '      - name: Install locked dependencies\n        env:\n          NODE_OPTIONS: --require=./payload.cjs\n        run: npm ci --ignore-scripts --no-audit --no-fund',
    'dependency install NODE_OPTIONS preload',
  );
  const jobPreloadWorkflow = replaceOnce(
    workflowText,
    '    timeout-minutes: 35\n    outputs:',
    '    timeout-minutes: 35\n    env:\n      NODE_OPTIONS: --require=./payload.cjs\n    outputs:',
    'candidate-build job NODE_OPTIONS preload',
  );
  const skippedPreflightWorkflow = replaceOnce(
    workflowText,
    `      - name: ${ENV_PREFLIGHT_STEP}\n        shell: ${ENV_PREFLIGHT_SHELL}\n        run: |`,
    `      - name: ${ENV_PREFLIGHT_STEP}\n        if: \${{ false }}\n        shell: ${ENV_PREFLIGHT_SHELL}\n        run: |`,
    'environment preflight skip',
  );
  const skippedPromotionGateWorkflow = replaceOnce(
    workflowText,
    '      - name: Enforce promoted causal evidence independence scope\n        env:',
    '      - name: Enforce promoted causal evidence independence scope\n        if: ${{ false }}\n        env:',
    'promoted enforcement step skip',
  );
  const sourceAuthRemovedWorkflow = replaceOnce(
    removeJobBlock(workflowText, SOURCE_AUTH_JOB, 'candidate-build'),
    `  candidate-build:\n    needs: ${SOURCE_AUTH_JOB}`,
    '  candidate-build:',
    'source-auth dependency removal',
  );
  const dishonest = [
    { id: 'source-auth-job-and-dependency-removed', workflowText: sourceAuthRemovedWorkflow, expected: ['candidate-build-action-safety'] },
    { id: 'browser-consumer-synthetic-event-sha', workflowText: replaceOnce(workflowText, `candidate_sha: ${PRODUCER_HEAD}`, 'candidate_sha: ${{ github.sha }}', 'browser consumer'), expected: ['browser-consumer'] },
    { id: 'comment-spoofs-exact-head-ref', workflowText: replaceOnce(workflowText, `ref: ${PR_HEAD}`, `ref: \${{ github.sha }}\n          # ref: ${PR_HEAD}`, 'comment-spoofed candidate build ref'), expected: ['candidate-build-checkout', 'no-synthetic-merge-ref'] },
    { id: 'later-checkout-overrides-producer', workflowText: replaceOnce(workflowText, '      - name: Set up Node 22', `      - name: Dishonest later checkout\n        uses: ${CHECKOUT_ACTION}\n        with:\n          ref: \${{ github.sha }}\n\n      - name: Set up Node 22`, 'later producer checkout'), expected: ['candidate-build-checkout', 'candidate-build-action-safety', 'no-synthetic-merge-ref'] },
    { id: 'identity-assertion-commented-out', workflowText: replaceOnce(workflowText, '          echo "artifact-name=$artifact_name" >> "$GITHUB_OUTPUT"\n          test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"', '          echo "artifact-name=$artifact_name" >> "$GITHUB_OUTPUT"\n          # test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"\n          echo "identity assertion removed"', 'identity assertion comment spoof'), expected: ['candidate-identity-runtime-assertion'] },
    { id: 'build-switches-and-restores-revision', workflowText: replaceOnce(workflowText, '            npm run build 2>&1 | tee .agent-impact-calibration/full-verification.log', '            git checkout "${{ github.sha }}"\n            npm run build 2>&1 | tee .agent-impact-calibration/full-verification.log\n            git checkout "${{ github.event.pull_request.head.sha }}"', 'build revision switch and restore'), expected: ['candidate-build-shell-git-safety', 'candidate-build-sealed-runtime'] },
    { id: 'transitive-build-script-sees-host-repository', workflowText: replaceOnce(workflowText, '            --network none \\\n            --volume "$snapshot:/workspace" \\', '            --network none \\\n            --volume "$GITHUB_WORKSPACE:/workspace" \\', 'transitive build host repository mount'), expected: ['candidate-build-sealed-runtime'] },
    { id: 'install-lifecycle-scripts-enabled', workflowText: replaceOnce(workflowText, '        run: npm ci --ignore-scripts --no-audit --no-fund', '        run: npm ci --no-audit --no-fund', 'candidate install lifecycle bypass'), expected: ['candidate-build-install-scripts-disabled'] },
    { id: 'dependency-install-node-options-preload', workflowText: installPreloadWorkflow, expected: ['candidate-build-environment-safety'] },
    { id: 'candidate-build-job-node-options-preload', workflowText: jobPreloadWorkflow, expected: ['candidate-build-environment-safety'] },
    { id: 'environment-preflight-skipped', workflowText: skippedPreflightWorkflow, expected: ['candidate-build-environment-preflight', 'candidate-build-transitive-step-safety'] },
    { id: 'promoted-enforcement-step-skipped', workflowText: skippedPromotionGateWorkflow, expected: ['candidate-build-transitive-step-safety'] },
    {
      id: 'indirect-added-producer-step-revision-switch',
      workflowText: indirectProducerWorkflow,
      sourceOverrides: { 'scripts/ev9-indirect-producer-step.mjs': indirectHelperSource },
      expected: ['candidate-build-transitive-step-safety'],
    },
    {
      id: 'indirect-reviewed-name-producer-step-revision-switch',
      workflowText: sameNameIndirectWorkflow,
      sourceOverrides: { 'scripts/ev9-indirect-producer-step.mjs': indirectHelperSource },
      expected: ['candidate-build-transitive-step-safety'],
    },
    {
      id: 'reviewed-entrypoint-source-revision-switch',
      workflowText,
      sourceOverrides: { 'agent/tests/candidate-artifact.mjs': indirectHelperSource },
      expected: ['candidate-build-transitive-step-safety'],
    },
  ];
  const negativeControls = benign.map(variant => {
    const report = observePrCandidateHeadContract({ workflowText: variant.workflowText, candidateSha });
    return { id: variant.id, passed: report.pass, falsePositive: !report.pass, failedCheckIds: report.failedCheckIds };
  });
  const dishonestMutations = dishonest.map(variant => {
    const report = observePrCandidateHeadContract({ workflowText: variant.workflowText, candidateSha, sourceOverrides: variant.sourceOverrides ?? {} });
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
