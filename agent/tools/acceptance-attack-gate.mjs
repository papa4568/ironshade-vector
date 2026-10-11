import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exerciseAttackPlan } from './acceptance-attack-compiler.mjs';
import {
  exerciseRuntimeCalibration,
  validateRuntimeCalibrationConfig,
} from './acceptance-attack-runtime-calibration.mjs';

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
    assert(scope.enforcedTemplateIds.length === 1, `${scope.id} runtime calibration currently supports exactly one enforced template per scope`);
    validateRuntimeCalibrationConfig(scope.runtimeCalibration);
    assert(
      scope.enforcedTemplateIds[0] === scope.runtimeCalibration.attack.templateId,
      `${scope.id} runtime calibration attack must match its enforced template`,
    );
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

export function resolveEnforcementEnabled(policy, enforcementOverride, env = process.env) {
  if (typeof enforcementOverride === 'boolean') return enforcementOverride;
  const raw = env.IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT;
  if (raw === undefined || raw === '') return policy.enforcementEnabled;
  assert(raw === '0' || raw === '1', 'IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT must be 0 or 1');
  return raw === '1';
}

export function evaluateAcceptanceAttackScope({ shadowReport, runtimeReport }, scope) {
  assert(shadowReport && typeof shadowReport === 'object', `${scope.id} shadow attack report is required`);
  assert(shadowReport.taskId === scope.taskId, `${scope.id} shadow report task ${shadowReport.taskId} does not match ${scope.taskId}`);
  assert(shadowReport.baseline && shadowReport.baseline.exitCode === 0, `${scope.id} shadow baseline must pass verification`);
  assert(shadowReport.isolation?.sourceUnchanged === true, `${scope.id} shadow exercise must leave source unchanged`);
  assert(shadowReport.isolation?.sandboxRemoteDetached === true, `${scope.id} shadow clone must detach its source remote`);
  assert(Array.isArray(shadowReport.results) && shadowReport.results.length > 0, `${scope.id} shadow attack results must be non-empty`);

  assert(runtimeReport && typeof runtimeReport === 'object', `${scope.id} runtime calibration report is required`);
  assert(runtimeReport.baseline?.passed === true, `${scope.id} real runtime baseline must pass with its expected marker`);
  assert(runtimeReport.isolation?.sourceUnchanged === true, `${scope.id} runtime calibration must leave source unchanged`);
  assert(runtimeReport.isolation?.sandboxRemoteDetached === true, `${scope.id} runtime calibration clone must detach its source remote`);
  assert(runtimeReport.attack?.templateId === scope.enforcedTemplateIds[0], `${scope.id} runtime attack must exercise ${scope.enforcedTemplateIds[0]}`);
  assert(Array.isArray(runtimeReport.negativeControls) && runtimeReport.negativeControls.length > 0, `${scope.id} runtime calibration must include measured negative controls`);

  const resultsByTemplate = new Map();
  for (const result of shadowReport.results) {
    assert(typeof result.templateId === 'string' && result.templateId, `${scope.id} shadow result templateId must be non-empty`);
    assert(!resultsByTemplate.has(result.templateId), `${scope.id} duplicate shadow attack result ${result.templateId}`);
    assert(result.outcome === 'caught' || result.outcome === 'proof-gap', `${scope.id} shadow attack ${result.templateId} has invalid outcome ${result.outcome}`);
    resultsByTemplate.set(result.templateId, result);
  }
  for (const templateId of scope.enforcedTemplateIds) {
    assert(resultsByTemplate.has(templateId), `${scope.id} promoted template ${templateId} must remain visible in EV-1 shadow evidence`);
  }

  const unsupportedResults = shadowReport.results.filter(result => !scope.enforcedTemplateIds.includes(result.templateId));
  const advisorySurvivors = unsupportedResults.filter(result => result.outcome === 'proof-gap');
  const promoted = runtimeReport.calibration;
  assert(Number.isInteger(promoted.falsePositiveTrials) && promoted.falsePositiveTrials > 0, `${scope.id} false-positive trials must be measured`);
  assert(Number.isInteger(promoted.falsePositives) && promoted.falsePositives >= 0, `${scope.id} false positives must be measured`);
  assert(Number.isInteger(promoted.falseNegativeTrials) && promoted.falseNegativeTrials > 0, `${scope.id} false-negative trials must be measured`);
  assert(Number.isInteger(promoted.falseNegatives) && promoted.falseNegatives >= 0, `${scope.id} false negatives must be measured`);

  const blockingReasons = [];
  if (promoted.falsePositives > scope.calibration.promotedFalsePositiveBudget) {
    blockingReasons.push(`false positives ${promoted.falsePositives} exceed budget ${scope.calibration.promotedFalsePositiveBudget}`);
  }
  if (promoted.falseNegatives > scope.calibration.promotedFalseNegativeBudget) {
    blockingReasons.push(`false negatives ${promoted.falseNegatives} exceed budget ${scope.calibration.promotedFalseNegativeBudget}`);
  }
  if (runtimeReport.attack.detected !== true) {
    blockingReasons.push(runtimeReport.attack.failureReason ?? 'promoted dishonest runtime attack was not detected for the expected criterion');
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
        falsePositiveTrials: promoted.falsePositiveTrials,
        falsePositives: promoted.falsePositives,
        falsePositiveRate: promoted.falsePositiveRate,
        falseNegativeTrials: promoted.falseNegativeTrials,
        falseNegatives: promoted.falseNegatives,
        falseNegativeRate: promoted.falseNegativeRate,
      },
    },
    enforcedResults: [{
      templateId: runtimeReport.attack.templateId,
      detected: runtimeReport.attack.detected,
      falseNegative: runtimeReport.attack.falseNegative,
      nonZeroExit: runtimeReport.attack.nonZeroExit,
      matchedFailurePatterns: [...runtimeReport.attack.matchedPatterns],
      expectedFailurePatterns: [...runtimeReport.attack.expectedFailurePatterns],
    }],
    negativeControls: runtimeReport.negativeControls.map(control => ({
      id: control.id,
      passed: control.passed,
      falsePositive: control.falsePositive,
      markerMatched: control.markerMatched,
    })),
    advisory: {
      unsupportedTemplateIds: unsupportedResults.map(result => result.templateId).sort(),
      caught: unsupportedResults.filter(result => result.outcome === 'caught').length,
      survivors: advisorySurvivors.map(result => result.templateId).sort(),
    },
    isolation: {
      shadowSourceUnchanged: true,
      shadowRemoteDetached: true,
      runtimeSourceUnchanged: true,
      runtimeRemoteDetached: true,
      dependencyStrategy: runtimeReport.isolation?.dependencyIsolation?.strategy ?? null,
    },
    pass: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function buildAcceptanceAttackDecision({
  policy,
  candidateSha,
  policyPath = DEFAULT_POLICY,
  scopeResults,
  enforcementOverride,
  env = process.env,
} = {}) {
  assert(typeof candidateSha === 'string' && SHA_RE.test(candidateSha), 'candidateSha must be a full lowercase Git SHA');
  assert(Array.isArray(scopeResults) && scopeResults.length > 0, 'acceptance attack scopeResults must be non-empty');
  const enforcementEnabled = resolveEnforcementEnabled(policy, enforcementOverride, env);
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
  const scopeResults = [];

  for (const scope of policy.scopes) {
    const shadowReport = await exerciseAttackPlan({
      taskId: scope.taskId,
      fixturePath: scope.fixturePath,
      roadmapPath: scope.roadmapPath,
      templatesPath: scope.templatesPath,
      repoRoot: resolvedRoot,
    });
    assert(
      shadowReport.isolation.sourceHead === candidateSha,
      `${scope.id} shadow attack exercise ran against ${shadowReport.isolation.sourceHead}, expected exact candidate ${candidateSha}`,
    );
    const runtimeReport = await exerciseRuntimeCalibration({
      candidateSha,
      config: scope.runtimeCalibration,
      repoRoot: resolvedRoot,
    });
    assert(
      runtimeReport.isolation.sourceHead === candidateSha,
      `${scope.id} runtime calibration ran against ${runtimeReport.isolation.sourceHead}, expected exact candidate ${candidateSha}`,
    );
    scopeResults.push({
      ...evaluateAcceptanceAttackScope({ shadowReport, runtimeReport }, scope),
      sourceHead: candidateSha,
      planDigest: shadowReport.planDigest,
      fullShadowSummary: shadowReport.summary,
      runtimeCalibrationEvidence: runtimeReport,
    });
  }

  return buildAcceptanceAttackDecision({
    policy,
    candidateSha,
    policyPath,
    scopeResults,
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
