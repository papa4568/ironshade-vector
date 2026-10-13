import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeEvidenceGraph,
  canonicalJson,
  loadEvidenceGraph,
  sha256Value,
  validateEvidenceGraph,
} from './evidence-independence.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DEFAULT_GRAPH = 'agent/evidence-independence.json';
const DEFAULT_POLICY = 'agent/evidence-independence-policy.json';
const GATE_SCHEMA = 'ironshade-evidence-independence-gate:v1';
const REQUIRED_CALIBRATION_CASE_IDS = Object.freeze([
  'independent-observer',
  'circular-implementation',
  'unsupported-supporting-only',
  'independent-with-shared-infrastructure',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertUniqueStringArray(value, label, { minItems = 0 } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameStrings(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

export function validateEvidenceIndependencePolicy(policy, graph) {
  assertObject(policy, 'evidence independence policy');
  assert(policy.schemaVersion === 1, 'evidence independence policy schemaVersion must be 1');
  assert(typeof policy.enforcementEnabled === 'boolean', 'evidence independence policy enforcementEnabled must be boolean');
  assertObject(policy.rollback, 'evidence independence policy rollback');
  assert(
    policy.rollback.environmentVariable === 'IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT',
    'evidence independence rollback environment variable must remain IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT',
  );
  assert(policy.rollback.disabledValue === '0', 'evidence independence rollback disabled value must remain 0');
  assertString(policy.rollback.behavior, 'evidence independence rollback behavior');
  assertUniqueStringArray(policy.enforcedCriterionIds, 'evidence independence policy enforcedCriterionIds', { minItems: 1 });
  assert(Array.isArray(policy.excludedImportantCriteria), 'evidence independence policy excludedImportantCriteria must be an array');
  assertObject(policy.calibration, 'evidence independence policy calibration');
  assertUniqueStringArray(policy.calibration.requiredCaseIds, 'evidence independence policy calibration.requiredCaseIds', { minItems: 1 });
  assert(
    sameStrings(policy.calibration.requiredCaseIds, REQUIRED_CALIBRATION_CASE_IDS),
    `evidence independence calibration cases must remain ${REQUIRED_CALIBRATION_CASE_IDS.join(', ')}`,
  );
  assert(policy.calibration.stabilityRuns === 2, 'evidence independence calibration stabilityRuns must remain 2');
  assert(policy.calibration.falsePositiveBudget === 0, 'evidence independence calibration falsePositiveBudget must be zero');
  assert(policy.calibration.falseNegativeBudget === 0, 'evidence independence calibration falseNegativeBudget must be zero');

  const { criteria } = validateEvidenceGraph(graph);
  const importantCriterionIds = sorted(
    [...criteria.values()].filter(criterion => criterion.importance === 'important').map(criterion => criterion.id),
  );
  const enforced = new Set(policy.enforcedCriterionIds);
  const excluded = new Map();
  for (const [index, entry] of policy.excludedImportantCriteria.entries()) {
    assertObject(entry, `evidence independence policy excludedImportantCriteria[${index}]`);
    assertString(entry.criterionId, `evidence independence policy excludedImportantCriteria[${index}].criterionId`);
    assertString(entry.reason, `evidence independence policy excludedImportantCriteria[${index}].reason`);
    assert(!excluded.has(entry.criterionId), `duplicate excluded important criterion ${entry.criterionId}`);
    excluded.set(entry.criterionId, entry.reason);
  }

  for (const criterionId of enforced) {
    assert(criteria.has(criterionId), `enforced evidence independence criterion ${criterionId} is unknown`);
    assert(criteria.get(criterionId).importance === 'important', `enforced evidence independence criterion ${criterionId} must remain important`);
    assert(!excluded.has(criterionId), `criterion ${criterionId} cannot be both enforced and explicitly excluded`);
  }
  for (const criterionId of excluded.keys()) {
    assert(criteria.has(criterionId), `excluded evidence independence criterion ${criterionId} is unknown`);
    assert(criteria.get(criterionId).importance === 'important', `excluded evidence independence criterion ${criterionId} must remain important`);
  }

  const covered = new Set([...enforced, ...excluded.keys()]);
  const uncoveredImportant = importantCriterionIds.filter(criterionId => !covered.has(criterionId));
  assert(
    uncoveredImportant.length === 0,
    `important evidence independence criteria must be enforced or explicitly excluded: ${uncoveredImportant.join(', ')}`,
  );

  return {
    importantCriterionIds,
    enforcedCriterionIds: sorted(enforced),
    excludedImportantCriteria: sorted(excluded.keys()).map(criterionId => ({ criterionId, reason: excluded.get(criterionId) })),
  };
}

function calibrationGraph({ id, materiality, dependencies }) {
  return {
    $schema: './evidence-independence.schema.json',
    schemaVersion: 1,
    mode: 'advisory',
    sources: [
      { id: 'implementation', kind: 'implementation', path: `fixtures/${id}/implementation.mjs` },
      { id: 'observer', kind: 'observer', path: `fixtures/${id}/observer.mjs` },
      { id: 'runner', kind: 'shared-infrastructure', path: 'node' },
    ],
    signals: [
      {
        id: 'observed-state',
        description: `Calibration observation for ${id}.`,
        materiality,
        sourceDependencies: dependencies,
      },
    ],
    proofRecords: [
      {
        id: 'proof',
        description: `Calibration proof for ${id}.`,
        signalIds: ['observed-state'],
      },
    ],
    criteria: [
      {
        id: 'criterion',
        description: `Calibration criterion for ${id}.`,
        importance: 'important',
        implementationSourceIds: ['implementation'],
        proofRecordIds: ['proof'],
      },
    ],
  };
}

function calibrationCases() {
  return [
    {
      id: 'independent-observer',
      expectedStatus: 'independent',
      expectedEnforceable: true,
      expectedSharedInfrastructureDependencies: 0,
      graph: calibrationGraph({
        id: 'independent-observer',
        materiality: 'material',
        dependencies: [{ sourceId: 'observer', role: 'derives' }],
      }),
    },
    {
      id: 'circular-implementation',
      expectedStatus: 'circular',
      expectedEnforceable: false,
      expectedSharedInfrastructureDependencies: 0,
      graph: calibrationGraph({
        id: 'circular-implementation',
        materiality: 'material',
        dependencies: [{ sourceId: 'implementation', role: 'derives' }],
      }),
    },
    {
      id: 'unsupported-supporting-only',
      expectedStatus: 'unsupported',
      expectedEnforceable: false,
      expectedSharedInfrastructureDependencies: 0,
      graph: calibrationGraph({
        id: 'unsupported-supporting-only',
        materiality: 'supporting',
        dependencies: [{ sourceId: 'observer', role: 'derives' }],
      }),
    },
    {
      id: 'independent-with-shared-infrastructure',
      expectedStatus: 'independent',
      expectedEnforceable: true,
      expectedSharedInfrastructureDependencies: 1,
      graph: calibrationGraph({
        id: 'independent-with-shared-infrastructure',
        materiality: 'material',
        dependencies: [
          { sourceId: 'observer', role: 'derives' },
          { sourceId: 'runner', role: 'shared-infrastructure' },
        ],
      }),
    },
  ];
}

export function runEvidenceIndependenceCalibration() {
  const candidateSha = '4444444444444444444444444444444444444444';
  const caseResults = [];
  let falsePositiveTrials = 0;
  let falsePositives = 0;
  let falseNegativeTrials = 0;
  let falseNegatives = 0;
  let classificationMismatches = 0;
  let stabilityMismatches = 0;

  for (const calibrationCase of calibrationCases()) {
    const first = analyzeEvidenceGraph(calibrationCase.graph, { candidateSha });
    const second = analyzeEvidenceGraph(structuredClone(calibrationCase.graph), { candidateSha });
    const stable = canonicalJson(first) === canonicalJson(second);
    const criterion = first.criteria[0];
    const statusMatches = criterion?.status === calibrationCase.expectedStatus;
    const infrastructureMatches = first.summary.sharedInfrastructureDependencies === calibrationCase.expectedSharedInfrastructureDependencies;
    const actualEnforceable = criterion?.status === 'independent';

    if (!stable) stabilityMismatches += 1;
    if (!statusMatches || !infrastructureMatches) classificationMismatches += 1;
    if (calibrationCase.expectedEnforceable) {
      falseNegativeTrials += 1;
      if (!actualEnforceable) falseNegatives += 1;
    } else {
      falsePositiveTrials += 1;
      if (actualEnforceable) falsePositives += 1;
    }

    caseResults.push({
      id: calibrationCase.id,
      expectedStatus: calibrationCase.expectedStatus,
      actualStatus: criterion?.status ?? null,
      expectedEnforceable: calibrationCase.expectedEnforceable,
      actualEnforceable,
      expectedSharedInfrastructureDependencies: calibrationCase.expectedSharedInfrastructureDependencies,
      actualSharedInfrastructureDependencies: first.summary.sharedInfrastructureDependencies,
      stable,
      pass: stable && statusMatches && infrastructureMatches && actualEnforceable === calibrationCase.expectedEnforceable,
    });
  }

  return {
    schema: 'ironshade-evidence-independence-calibration:v1',
    requiredCaseIds: caseResults.map(result => result.id),
    stabilityRuns: 2,
    cases: caseResults,
    stabilityMismatches,
    classificationMismatches,
    falsePositiveTrials,
    falsePositives,
    falsePositiveRate: falsePositiveTrials === 0 ? 0 : falsePositives / falsePositiveTrials,
    falseNegativeTrials,
    falseNegatives,
    falseNegativeRate: falseNegativeTrials === 0 ? 0 : falseNegatives / falseNegativeTrials,
    pass: stabilityMismatches === 0 && classificationMismatches === 0 && falsePositives === 0 && falseNegatives === 0,
  };
}

export function resolveEvidenceIndependenceEnforcement(policy, enforcementOverride, env = process.env) {
  if (typeof enforcementOverride === 'boolean') return enforcementOverride;
  const raw = env.IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT;
  if (raw === undefined || raw === '') return policy.enforcementEnabled;
  assert(raw === '0' || raw === '1', 'IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT must be 0 or 1');
  return raw === '1';
}

export function buildEvidenceIndependenceDecision({
  policy,
  graph,
  report,
  calibration,
  candidateSha,
  policyPath = DEFAULT_POLICY,
  graphPath = DEFAULT_GRAPH,
  enforcementOverride,
  env = process.env,
} = {}) {
  assert(typeof candidateSha === 'string' && SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  const scope = validateEvidenceIndependencePolicy(policy, graph);
  assertObject(report, 'evidence independence report');
  assert(report.schema === 'ironshade-evidence-independence-report:v1', 'unsupported evidence independence report schema');
  assert(report.candidateSha === candidateSha, `evidence independence report is for ${report.candidateSha}, expected ${candidateSha}`);
  assertObject(calibration, 'evidence independence calibration');
  assert(calibration.schema === 'ironshade-evidence-independence-calibration:v1', 'unsupported evidence independence calibration schema');
  assert(sameStrings(calibration.requiredCaseIds, policy.calibration.requiredCaseIds), 'evidence independence calibration case set does not match policy');
  assert(calibration.stabilityRuns === policy.calibration.stabilityRuns, 'evidence independence calibration stability run count does not match policy');

  const resultsById = new Map(report.criteria.map(result => [result.criterionId, result]));
  const enforcedCriteria = scope.enforcedCriterionIds.map(criterionId => {
    const result = resultsById.get(criterionId);
    assert(result, `evidence independence report is missing enforced criterion ${criterionId}`);
    return {
      criterionId,
      status: result.status,
      independentPaths: result.independentPaths,
      pass: result.status === 'independent' && result.independentPaths.length > 0,
    };
  });
  const excludedImportantCriteria = scope.excludedImportantCriteria.map(entry => {
    const result = resultsById.get(entry.criterionId);
    assert(result, `evidence independence report is missing excluded criterion ${entry.criterionId}`);
    return {
      ...entry,
      status: result.status,
      independentPaths: result.independentPaths,
      circularPaths: result.circularPaths,
    };
  });

  const failedCriteria = enforcedCriteria.filter(entry => !entry.pass).map(entry => entry.criterionId);
  const calibrationFailures = [];
  if (calibration.stabilityMismatches !== 0) calibrationFailures.push(`stability mismatches ${calibration.stabilityMismatches}`);
  if (calibration.classificationMismatches !== 0) calibrationFailures.push(`classification mismatches ${calibration.classificationMismatches}`);
  if (calibration.falsePositives > policy.calibration.falsePositiveBudget) {
    calibrationFailures.push(`false positives ${calibration.falsePositives} exceed budget ${policy.calibration.falsePositiveBudget}`);
  }
  if (calibration.falseNegatives > policy.calibration.falseNegativeBudget) {
    calibrationFailures.push(`false negatives ${calibration.falseNegatives} exceed budget ${policy.calibration.falseNegativeBudget}`);
  }

  const enforcementEnabled = resolveEvidenceIndependenceEnforcement(policy, enforcementOverride, env);
  const wouldBlock = failedCriteria.length > 0 || calibrationFailures.length > 0;
  const blocking = enforcementEnabled && wouldBlock;
  const core = {
    schema: GATE_SCHEMA,
    candidateSha,
    mode: enforcementEnabled ? 'enforced' : 'advisory-rollback',
    enforcementEnabled,
    policyPath,
    policyDigest: sha256Value(policy),
    graphPath,
    graphDigest: report.graphSha256,
    enforcedCriteria,
    excludedImportantCriteria,
    calibration,
    failedCriteria,
    calibrationFailures,
    wouldBlock,
    blocking,
    verdict: enforcementEnabled ? (blocking ? 'fail' : 'pass') : 'disabled-advisory',
    rollback: {
      environmentVariable: policy.rollback.environmentVariable,
      disabledValue: policy.rollback.disabledValue,
      restoresAdvisoryBehavior: true,
    },
    existingExactShaEvidenceRemainsAuthoritative: true,
    proofSynthesisAllowed: false,
    candidatePassGranted: false,
  };
  return {
    ...core,
    reportDigest: sha256Value(core),
  };
}

export async function runEvidenceIndependenceGate({
  policyPath = DEFAULT_POLICY,
  graphPath = DEFAULT_GRAPH,
  candidateSha,
  enforcementOverride,
  env = process.env,
} = {}) {
  assert(typeof candidateSha === 'string' && SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  const graph = await loadEvidenceGraph(graphPath);
  const policy = JSON.parse(await readFile(resolve(policyPath), 'utf8'));
  validateEvidenceIndependencePolicy(policy, graph);
  const report = analyzeEvidenceGraph(graph, { candidateSha });
  const calibration = runEvidenceIndependenceCalibration();
  return buildEvidenceIndependenceDecision({
    policy,
    graph,
    report,
    calibration,
    candidateSha,
    policyPath,
    graphPath,
    enforcementOverride,
    env,
  });
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert(index + 1 < args.length, `${name} requires a value`);
  return args[index + 1];
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

async function main() {
  const [, , command, ...args] = process.argv;
  assert(command === 'gate', 'usage: evidence-independence-gate.mjs gate --candidate-sha <sha> [--graph <path>] [--policy <path>] [--output <path>]');
  const candidateSha = optionValue(args, '--candidate-sha');
  const graphPath = optionValue(args, '--graph', DEFAULT_GRAPH);
  const policyPath = optionValue(args, '--policy', DEFAULT_POLICY);
  const output = optionValue(args, '--output');
  const decision = await runEvidenceIndependenceGate({ candidateSha, graphPath, policyPath });
  if (output) await writeJson(output, decision);
  else process.stdout.write(canonicalJson(decision));
  console.log(
    `EVIDENCE_INDEPENDENCE_GATE verdict=${decision.verdict} candidate=${decision.candidateSha} mode=${decision.mode} enforced=${decision.enforcedCriteria.length} excluded=${decision.excludedImportantCriteria.length} falsePositives=${decision.calibration.falsePositives}/${decision.calibration.falsePositiveTrials} falseNegatives=${decision.calibration.falseNegatives}/${decision.calibration.falseNegativeTrials} candidatePassGranted=false`,
  );
  if (decision.blocking) throw new Error(`promoted evidence independence scope failed: ${[...decision.failedCriteria, ...decision.calibrationFailures].join('; ')}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EVIDENCE_INDEPENDENCE_GATE_ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
