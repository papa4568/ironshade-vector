import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exerciseAttackPlan } from './acceptance-attack-compiler.mjs';

const GATE_SCHEMA = 'ironshade-acceptance-attack-gate:v1';
const DEFAULT_POLICY = 'agent/acceptance-attack-policy.json';
const SHA_RE = /^[a-f0-9]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function validateString(value, label) {
  assert(typeof value === 'string' && value.trim(), `${label} must be non-empty`);
  return value;
}

export function validateAcceptanceAttackPolicy(raw) {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw), 'acceptance attack policy must be an object');
  assert(raw.schemaVersion === 1, 'acceptance attack policy schemaVersion must be 1');
  assert(typeof raw.enforcementEnabled === 'boolean', 'acceptance attack policy enforcementEnabled must be boolean');
  assert(raw.rollback && typeof raw.rollback === 'object' && !Array.isArray(raw.rollback), 'acceptance attack policy rollback must be an object');
  assert(raw.rollback.environmentVariable === 'IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT', 'acceptance attack rollback environment variable must remain IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT');
  assert(raw.rollback.disabledValue === '0', 'acceptance attack rollback disabled value must remain 0');
  validateString(raw.rollback.behavior, 'acceptance attack rollback behavior');
  assert(Array.isArray(raw.scopes) && raw.scopes.length > 0, 'acceptance attack policy scopes must be non-empty');

  const scopeIds = new Set();
  for (const [scopeIndex, scope] of raw.scopes.entries()) {
    assert(scope && typeof scope === 'object' && !Array.isArray(scope), `scopes[${scopeIndex}] must be an object`);
    for (const key of ['id', 'taskId', 'roadmapPath', 'fixturePath', 'templatesPath']) {
      validateString(scope[key], `scopes[${scopeIndex}].${key}`);
    }
    assert(!scopeIds.has(scope.id), `duplicate acceptance attack scope ${scope.id}`);
    scopeIds.add(scope.id);
    assert(Array.isArray(scope.enforcedTemplateIds) && scope.enforcedTemplateIds.length > 0, `${scope.id}.enforcedTemplateIds must be non-empty`);
    const templateIds = new Set();
    for (const [templateIndex, templateId] of scope.enforcedTemplateIds.entries()) {
      validateString(templateId, `${scope.id}.enforcedTemplateIds[${templateIndex}]`);
      assert(!templateIds.has(templateId), `${scope.id} duplicates enforced template ${templateId}`);
      templateIds.add(templateId);
    }
    assert(scope.calibration && typeof scope.calibration === 'object' && !Array.isArray(scope.calibration), `${scope.id}.calibration must be an object`);
    validateString(scope.calibration.historicalAcceptanceFailure, `${scope.id}.calibration.historicalAcceptanceFailure`);
    for (const key of ['prototypeShadowTrials', 'prototypeCaught', 'prototypeProofGaps', 'promotedFalsePositiveBudget', 'promotedFalseNegativeBudget']) {
      assert(Number.isInteger(scope.calibration[key]) && scope.calibration[key] >= 0, `${scope.id}.calibration.${key} must be a non-negative integer`);
    }
    assert(
      scope.calibration.prototypeShadowTrials === scope.calibration.prototypeCaught + scope.calibration.prototypeProofGaps,
      `${scope.id} prototype shadow totals must equal caught plus proof gaps`,
    );
    assert(scope.calibration.promotedFalsePositiveBudget === 0, `${scope.id} promoted false-positive budget must be zero`);
    assert(scope.calibration.promotedFalseNegativeBudget === 0, `${scope.id} promoted false-negative budget must be zero`);
  }
  return raw;
}

function resolveEnforcementEnabled(policy, enforcementOverride, env) {
  if (typeof enforcementOverride === 'boolean') return enforcementOverride;
  const raw = env.IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT;
  if (raw === undefined || raw === '') return policy.enforcementEnabled;
  assert(raw === '0' || raw === '1', 'IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT must be 0 or 1');
  return raw === '1';
}

export function evaluateAcceptanceAttackScope(report, scope) {
  assert(report && typeof report === 'object', `${scope.id} attack report is required`);
  assert(report.taskId === scope.taskId, `${scope.id} report task ${report.taskId} does not match ${scope.taskId}`);
  assert(report.baseline && report.baseline.exitCode === 0, `${scope.id} honest baseline must pass verification`);
  assert(report.isolation?.sourceUnchanged === true, `${scope.id} source repository must remain unchanged`);
  assert(report.isolation?.sandboxRemoteDetached === true, `${scope.id} disposable clone must detach its source remote`);
  assert(Array.isArray(report.results) && report.results.length > 0, `${scope.id} attack results must be non-empty`);

  const resultsByTemplate = new Map();
  for (const result of report.results) {
    assert(typeof result.templateId === 'string' && result.templateId, `${scope.id} attack result templateId must be non-empty`);
    assert(!resultsByTemplate.has(result.templateId), `${scope.id} duplicate attack result ${result.templateId}`);
    assert(result.outcome === 'caught' || result.outcome === 'proof-gap', `${scope.id} attack ${result.templateId} has invalid outcome ${result.outcome}`);
    resultsByTemplate.set(result.templateId, result);
  }

  const enforcedResults = scope.enforcedTemplateIds.map(templateId => {
    const result = resultsByTemplate.get(templateId);
    assert(result, `${scope.id} enforced template ${templateId} was not exercised`);
    return result;
  });
  const falseNegatives = enforcedResults.filter(result => result.outcome !== 'caught');
  const unsupportedResults = report.results.filter(result => !scope.enforcedTemplateIds.includes(result.templateId));
  const advisorySurvivors = unsupportedResults.filter(result => result.outcome === 'proof-gap');
  const falsePositiveTrials = 1;
  const falsePositives = 0;
  const falseNegativeTrials = enforcedResults.length;
  const falseNegativeCount = falseNegatives.length;
  const blockingReasons = [];
  if (falsePositives > scope.calibration.promotedFalsePositiveBudget) {
    blockingReasons.push(`false positives ${falsePositives} exceed budget ${scope.calibration.promotedFalsePositiveBudget}`);
  }
  if (falseNegativeCount > scope.calibration.promotedFalseNegativeBudget) {
    blockingReasons.push(`false negatives ${falseNegativeCount} exceed budget ${scope.calibration.promotedFalseNegativeBudget}`);
  }

  return {
    scopeId: scope.id,
    taskId: scope.taskId,
    enforcedTemplateIds: [...scope.enforcedTemplateIds],
    calibration: {
      historicalAcceptanceFailure: scope.calibration.historicalAcceptanceFailure,
      prototype: {
        trials: scope.calibration.prototypeShadowTrials,
        caught: scope.calibration.prototypeCaught,
        proofGaps: scope.calibration.prototypeProofGaps,
      },
      promoted: {
        falsePositiveTrials,
        falsePositives,
        falsePositiveRate: falsePositives / falsePositiveTrials,
        falseNegativeTrials,
        falseNegatives: falseNegativeCount,
        falseNegativeRate: falseNegativeTrials === 0 ? 0 : falseNegativeCount / falseNegativeTrials,
      },
    },
    enforcedResults: enforcedResults.map(result => ({
      templateId: result.templateId,
      outcome: result.outcome,
      criterionId: result.criterionId,
    })),
    advisory: {
      unsupportedTemplateIds: unsupportedResults.map(result => result.templateId).sort(),
      caught: unsupportedResults.filter(result => result.outcome === 'caught').length,
      survivors: advisorySurvivors.map(result => result.templateId).sort(),
    },
    isolation: {
      sourceUnchanged: true,
      sandboxRemoteDetached: true,
    },
    pass: blockingReasons.length === 0,
    blockingReasons,
  };
}

export async function runAcceptanceAttackGate({
  policyPath = DEFAULT_POLICY,
  candidateSha,
  repoRoot = process.cwd(),
  enforcementOverride,
  env = process.env,
} = {}) {
  assert(typeof candidateSha === 'string' && SHA_RE.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  const resolvedRoot = resolve(repoRoot);
  const policy = validateAcceptanceAttackPolicy(JSON.parse(await readFile(resolve(resolvedRoot, policyPath), 'utf8')));
  const enforcementEnabled = resolveEnforcementEnabled(policy, enforcementOverride, env);
  const scopeResults = [];

  for (const scope of policy.scopes) {
    const report = await exerciseAttackPlan({
      taskId: scope.taskId,
      fixturePath: scope.fixturePath,
      roadmapPath: scope.roadmapPath,
      templatesPath: scope.templatesPath,
      repoRoot: resolvedRoot,
    });
    assert(
      report.isolation.sourceHead === candidateSha,
      `${scope.id} attack exercise ran against ${report.isolation.sourceHead}, expected exact candidate ${candidateSha}`,
    );
    scopeResults.push({
      ...evaluateAcceptanceAttackScope(report, scope),
      sourceHead: report.isolation.sourceHead,
      planDigest: report.planDigest,
      fullShadowSummary: report.summary,
    });
  }

  const failedScopes = scopeResults.filter(scope => !scope.pass).map(scope => scope.scopeId);
  const blocking = enforcementEnabled && failedScopes.length > 0;
  const reportCore = {
    schema: GATE_SCHEMA,
    candidateSha,
    mode: enforcementEnabled ? 'enforced' : 'advisory-rollback',
    enforcementEnabled,
    policyPath,
    policyDigest: digest(policy),
    scopes: scopeResults,
    rollback: {
      environmentVariable: policy.rollback.environmentVariable,
      disabledValue: policy.rollback.disabledValue,
      restoresAdvisoryBehavior: true,
    },
    verdict: enforcementEnabled ? (blocking ? 'fail' : 'pass') : 'disabled-advisory',
    blocking,
    failedScopes,
    candidatePassGranted: false,
  };
  return {
    ...reportCore,
    reportDigest: digest(reportCore),
  };
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert(index + 1 < args.length, `${name} requires a value`);
  return args[index + 1];
}

async function writeJsonOutput(value, outputPath) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(text);
    return;
  }
  const resolved = resolve(outputPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, text);
  console.log(`ACCEPTANCE_ATTACK_GATE_OUTPUT path=${outputPath}`);
}

async function main() {
  const [, , command, ...args] = process.argv;
  assert(command === 'gate', 'usage: acceptance-attack-gate.mjs gate --candidate-sha <sha> [--policy <path>] [--output <path>]');
  const candidateSha = optionValue(args, '--candidate-sha');
  const policyPath = optionValue(args, '--policy', DEFAULT_POLICY);
  const outputPath = optionValue(args, '--output');
  const report = await runAcceptanceAttackGate({ policyPath, candidateSha });
  await writeJsonOutput(report, outputPath);
  console.log(
    `ACCEPTANCE_ATTACK_GATE verdict=${report.verdict} candidate=${report.candidateSha} mode=${report.mode} scopes=${report.scopes.length} falsePositives=${report.scopes.reduce((sum, scope) => sum + scope.calibration.promoted.falsePositives, 0)} falseNegatives=${report.scopes.reduce((sum, scope) => sum + scope.calibration.promoted.falseNegatives, 0)} advisorySurvivors=${report.scopes.reduce((sum, scope) => sum + scope.advisory.survivors.length, 0)} candidatePassGranted=false`,
  );
  if (report.blocking) throw new Error(`promoted acceptance attack scope failed: ${report.failedScopes.join(', ')}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`ACCEPTANCE_ATTACK_GATE_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
