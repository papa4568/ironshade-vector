import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exerciseAttackPlan } from './acceptance-attack-compiler.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export function validateAcceptanceAttackPolicy(policy) {
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'acceptance attack policy must be an object');
  assert(policy.schemaVersion === 1, 'acceptance attack policy schemaVersion must be 1');
  assert(policy.promotion === 'EV-8', 'acceptance attack policy promotion must be EV-8');
  assert(typeof policy.enabled === 'boolean', 'acceptance attack policy enabled must be boolean');
  assert(policy.mode === 'enforced-subset', 'acceptance attack policy mode must be enforced-subset');
  assert(Array.isArray(policy.enforcedTemplates) && policy.enforcedTemplates.length > 0, 'acceptance attack policy enforcedTemplates must not be empty');
  assert(new Set(policy.enforcedTemplates).size === policy.enforcedTemplates.length, 'acceptance attack policy enforcedTemplates must be unique');
  policy.enforcedTemplates.forEach((templateId, index) => assert(typeof templateId === 'string' && templateId.trim(), `enforcedTemplates[${index}] must be non-empty`));
  assert(Array.isArray(policy.registrations) && policy.registrations.length > 0, 'acceptance attack policy registrations must not be empty');
  for (const [index, registration] of policy.registrations.entries()) {
    assert(registration && typeof registration === 'object' && !Array.isArray(registration), `registrations[${index}] must be an object`);
    for (const key of ['taskId', 'roadmap', 'fixture', 'reason']) assert(typeof registration[key] === 'string' && registration[key].trim(), `registrations[${index}].${key} must be non-empty`);
  }
  assert(policy.unsupportedTemplatesRemainAdvisory === true, 'unsupported attack templates must remain advisory');
  assert(policy.rollback?.strategy === 'set enabled=false', 'acceptance attack policy rollback strategy must be set enabled=false');
  return policy;
}

export function evaluateAcceptanceAttackEnforcement(report, policy) {
  validateAcceptanceAttackPolicy(policy);
  assert(report && typeof report === 'object' && Array.isArray(report.results), 'acceptance attack report results must be an array');
  assert(report.baseline?.exitCode === 0, 'honest control baseline must pass before promotion can be evaluated');
  assert(report.isolation?.sourceUnchanged === true, 'acceptance attack source repository must remain unchanged');
  assert(report.isolation?.sandboxRemoteDetached === true, 'acceptance attack disposable clone must remain remote-detached');

  const byTemplate = new Map();
  for (const result of report.results) {
    assert(typeof result.templateId === 'string' && result.templateId, 'attack result templateId must be non-empty');
    assert(!byTemplate.has(result.templateId), `duplicate attack result for template ${result.templateId}`);
    assert(result.outcome === 'caught' || result.outcome === 'proof-gap', `attack ${result.templateId} has invalid outcome ${result.outcome}`);
    byTemplate.set(result.templateId, result);
  }

  const enforced = policy.enforcedTemplates.map(templateId => {
    const result = byTemplate.get(templateId);
    assert(result, `enforced attack template ${templateId} was not exercised; refusing to under-test promoted scope`);
    return result;
  });
  const advisory = report.results.filter(result => !policy.enforcedTemplates.includes(result.templateId));
  const falsePositives = report.baseline.exitCode === 0 ? 0 : 1;
  const truePositives = enforced.filter(result => result.outcome === 'caught').length;
  const falseNegatives = enforced.filter(result => result.outcome === 'proof-gap').length;
  const advisoryProofGaps = advisory.filter(result => result.outcome === 'proof-gap').length;
  const blocking = policy.enabled && falseNegatives > 0;

  return {
    schema: 'ironshade-acceptance-attack-enforcement:v1',
    promotion: policy.promotion,
    enabled: policy.enabled,
    mode: policy.enabled ? 'enforced-subset' : 'rollback-advisory',
    promotedTemplates: [...policy.enforcedTemplates],
    measurement: {
      honestControls: 1,
      falsePositives,
      falsePositiveRate: ratio(falsePositives, 1),
      dishonestControls: enforced.length,
      truePositives,
      falseNegatives,
      falseNegativeRate: ratio(falseNegatives, enforced.length),
      unsupportedAdvisoryAttacks: advisory.length,
      unsupportedAdvisoryProofGaps: advisoryProofGaps,
    },
    isolation: {
      sourceUnchanged: report.isolation.sourceUnchanged,
      sandboxRemoteDetached: report.isolation.sandboxRemoteDetached,
    },
    blocking,
    verdict: blocking ? 'blocked-proof-gap' : policy.enabled ? 'promoted-scope-pass' : 'rollback-advisory-pass',
    candidatePassGranted: false,
  };
}

export async function runRegisteredAcceptanceAttack({ policy, registration, repoRoot = process.cwd() }) {
  const report = await exerciseAttackPlan({
    taskId: registration.taskId,
    roadmapPath: registration.roadmap,
    fixturePath: registration.fixture,
    repoRoot,
  });
  const enforcement = evaluateAcceptanceAttackEnforcement(report, policy);
  return { report, enforcement };
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert(index + 1 < args.length, `${name} requires a value`);
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const policyPath = optionValue(args, '--policy', 'agent/acceptance-attack-policy.json');
  const outputPath = optionValue(args, '--output');
  assert(outputPath, '--output is required');
  const policy = validateAcceptanceAttackPolicy(JSON.parse(await readFile(resolve(policyPath), 'utf8')));
  const requestedTask = optionValue(args, '--task');
  const registrations = requestedTask ? policy.registrations.filter(entry => entry.taskId === requestedTask) : policy.registrations;
  assert(registrations.length > 0, `no acceptance attack policy registration matches task ${requestedTask ?? '(all)'}`);

  const exercises = [];
  for (const registration of registrations) exercises.push({ registration, ...(await runRegisteredAcceptanceAttack({ policy, registration })) });
  const blocking = exercises.some(entry => entry.enforcement.blocking);
  const result = {
    schema: 'ironshade-acceptance-attack-promotion-run:v1',
    promotion: policy.promotion,
    enabled: policy.enabled,
    blocking,
    exercises,
  };
  await writeFile(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const summary = exercises.map(entry => `${entry.registration.taskId}:${entry.enforcement.verdict}:fp=${entry.enforcement.measurement.falsePositives}:fn=${entry.enforcement.measurement.falseNegatives}:advisoryGaps=${entry.enforcement.measurement.unsupportedAdvisoryProofGaps}`).join(',');
  console.log(`ACCEPTANCE_ATTACK_PROMOTION_${blocking ? 'BLOCKED' : 'PASS'} promotion=${policy.promotion} enabled=${policy.enabled} ${summary}`);
  if (blocking) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`ACCEPTANCE_ATTACK_PROMOTION_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
