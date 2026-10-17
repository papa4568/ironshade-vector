import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson,
  compareBehavioralGenomes,
  createBehavioralGenome,
  sha256Value,
  validateBehavioralGenomeConfig,
} from './behavioral-genome.mjs';
import {
  runBehavioralGenomeCalibration,
  validateBehavioralGenomeCalibrationCorpus,
} from './behavioral-genome-calibration.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DOMAIN_CLASSIFICATIONS = new Set(['blocking', 'declaration-required', 'informational']);
const DEFAULT_POLICY = 'agent/behavioral-genome-promotion-policy.json';
const DEFAULT_CONFIG = 'agent/behavioral-genome.config.json';
const DEFAULT_CORPUS = 'agent/behavioral-genome-calibration-corpus.json';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function sortedUnique(values, label) {
  assert(Array.isArray(values), `${label} must be an array`);
  for (const value of values) assertString(value, `${label} entry`);
  assert(new Set(values).size === values.length, `${label} must not contain duplicates`);
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function validateBehavioralGenomePromotionPolicy(policy, config, corpus) {
  assertObject(policy, 'behavioral genome promotion policy');
  assert(policy.schemaVersion === 1, 'behavioral genome promotion policy schemaVersion must be 1');
  assert(typeof policy.enforcementEnabled === 'boolean', 'behavioral genome promotion policy enforcementEnabled must be boolean');
  assertString(policy.route, 'behavioral genome promotion policy route');

  validateBehavioralGenomeConfig(config);
  validateBehavioralGenomeCalibrationCorpus(corpus, config);
  assert(policy.route === corpus.route, 'behavioral genome promotion policy route must match EV-10 corpus route');

  assertObject(policy.calibration, 'behavioral genome promotion policy calibration');
  assert(policy.calibration.configSha256 === sha256Value(config), 'behavioral genome promotion policy config digest must remain pinned to EV-10 calibration');
  assert(policy.calibration.corpusSha256 === sha256Value(corpus), 'behavioral genome promotion policy corpus digest must remain pinned to EV-10 calibration');
  assert(policy.calibration.falsePositiveBudget === 0, 'behavioral genome promotion false-positive budget must remain zero');
  assert(policy.calibration.falseNegativeBudget === 0, 'behavioral genome promotion false-negative budget must remain zero');
  assert(policy.calibration.falsePositiveBudget === corpus.falsePositiveBudget, 'behavioral genome promotion false-positive budget must match EV-10');
  assert(policy.calibration.falseNegativeBudget === corpus.falseNegativeBudget, 'behavioral genome promotion false-negative budget must match EV-10');

  const requiredDomains = sortedUnique(config.requiredDomains, 'behavioral genome requiredDomains');
  const validatedDomains = sortedUnique(policy.calibration.validatedDomains, 'behavioral genome promotion validatedDomains');
  assert(canonicalJson(validatedDomains) === canonicalJson(requiredDomains), 'EV-11 may promote only the EV-10 validated domain set');

  assertObject(policy.domains, 'behavioral genome promotion domains');
  assert(canonicalJson(Object.keys(policy.domains).sort()) === canonicalJson(requiredDomains), 'behavioral genome promotion domains must exactly cover the configured domain set');
  for (const domain of requiredDomains) {
    const entry = policy.domains[domain];
    assertObject(entry, `behavioral genome promotion domain ${domain}`);
    assert(DOMAIN_CLASSIFICATIONS.has(entry.classification), `behavioral genome promotion domain ${domain} has unsupported classification ${entry.classification}`);
  }

  assertObject(policy.declarations, 'behavioral genome promotion declarations');
  assertString(policy.declarations.directory, 'behavioral genome promotion declarations.directory');
  assert(policy.declarations.schemaVersion === 1, 'behavioral genome promotion declaration schemaVersion must be 1');
  assert(Array.isArray(policy.advisoryConstraints) && policy.advisoryConstraints.length > 0, 'behavioral genome promotion advisoryConstraints must be non-empty');
  const unresolvedIds = sortedUnique(corpus.unresolvedCases.map(entry => entry.id), 'EV-10 unresolved case ids');
  const advisoryIds = sortedUnique(policy.advisoryConstraints.map(entry => entry.id), 'behavioral genome promotion advisory constraint ids');
  assert(canonicalJson(advisoryIds) === canonicalJson(unresolvedIds), 'EV-11 advisory constraints must exactly preserve EV-10 unresolved scope');
  for (const entry of policy.advisoryConstraints) {
    assertObject(entry, 'behavioral genome promotion advisory constraint');
    assert(entry.classification === 'informational', `EV-10 unresolved scope ${entry.id} must remain informational`);
    assertString(entry.reason, `behavioral genome promotion advisory constraint ${entry.id} reason`);
  }

  assertObject(policy.rollback, 'behavioral genome promotion rollback');
  assert(policy.rollback.environmentVariable === 'IRONSHADE_BEHAVIORAL_GENOME_ENFORCEMENT', 'behavioral genome rollback environment variable must remain IRONSHADE_BEHAVIORAL_GENOME_ENFORCEMENT');
  assert(policy.rollback.disabledValue === '0', 'behavioral genome rollback disabled value must remain 0');
  assertString(policy.rollback.behavior, 'behavioral genome promotion rollback behavior');
  return policy;
}

export function resolveBehavioralGenomeEnforcement(policy, enforcementOverride, env = process.env) {
  if (typeof enforcementOverride === 'boolean') return enforcementOverride;
  const raw = env.IRONSHADE_BEHAVIORAL_GENOME_ENFORCEMENT;
  if (raw === undefined || raw === '') return policy.enforcementEnabled;
  assert(raw === '0' || raw === '1', 'IRONSHADE_BEHAVIORAL_GENOME_ENFORCEMENT must be 0 or 1');
  return raw === '1';
}

export function validateBehavioralGenomeDeclaration(declaration, policy, taskId) {
  if (declaration === null || declaration === undefined) {
    return { domains: [], rationale: null, digest: null };
  }
  assertObject(declaration, 'behavioral genome declaration');
  assert(declaration.schemaVersion === policy.declarations.schemaVersion, `behavioral genome declaration schemaVersion must be ${policy.declarations.schemaVersion}`);
  assertString(declaration.taskId, 'behavioral genome declaration taskId');
  assert(declaration.taskId === taskId, `behavioral genome declaration taskId ${declaration.taskId} does not match selected task ${taskId}`);
  const domains = sortedUnique(declaration.domains, 'behavioral genome declaration domains');
  for (const domain of domains) {
    assert(policy.calibration.validatedDomains.includes(domain), `behavioral genome declaration names unsupported domain ${domain}`);
  }
  assertString(declaration.rationale, 'behavioral genome declaration rationale');
  return { domains, rationale: declaration.rationale.trim(), digest: sha256Value(declaration) };
}

export function calibrateBehavioralGenomePromotion(policy, config, corpus, { candidateSha } = {}) {
  validateBehavioralGenomePromotionPolicy(policy, config, corpus);
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  const ev10 = runBehavioralGenomeCalibration(corpus, config, { candidateSha });
  const noiseCases = ev10.cases.filter(entry => entry.kind === 'noise-control');
  const semanticCases = ev10.cases.filter(entry => entry.kind === 'semantic-change');
  const falsePositiveTrials = noiseCases.length;
  const falsePositives = noiseCases.filter(entry => entry.detectedChangedDomains.length > 0).length;
  const falseNegativeTrials = semanticCases.reduce((sum, entry) => sum + entry.expectedChangedDomains.length, 0);
  const falseNegatives = semanticCases.reduce((sum, entry) => sum + entry.missedDomains.length, 0);
  const calibrationPass = ev10.calibrationPass
    && falsePositives <= policy.calibration.falsePositiveBudget
    && falseNegatives <= policy.calibration.falseNegativeBudget
    && canonicalJson(ev10.validatedDomains) === canonicalJson([...policy.calibration.validatedDomains].sort((a, b) => a.localeCompare(b)));
  return {
    schema: 'ironshade-behavioral-genome-promotion-calibration:v1',
    candidateSha,
    route: policy.route,
    policySha256: sha256Value(policy),
    configSha256: sha256Value(config),
    corpusSha256: sha256Value(corpus),
    falsePositiveTrials,
    falsePositives,
    falsePositiveRate: falsePositiveTrials === 0 ? 0 : falsePositives / falsePositiveTrials,
    falseNegativeTrials,
    falseNegatives,
    falseNegativeRate: falseNegativeTrials === 0 ? 0 : falseNegatives / falseNegativeTrials,
    validatedDomains: [...ev10.validatedDomains],
    unresolvedCaseIds: ev10.unresolvedCases.map(entry => entry.id).sort((a, b) => a.localeCompare(b)),
    calibrationPass,
    candidatePassGranted: false,
  };
}

export function evaluateBehavioralGenomePromotion({
  policy,
  config,
  corpus,
  baseObservations,
  candidateObservations,
  baseSha,
  candidateSha,
  taskId,
  declaration = null,
  enforcementOverride,
  env = process.env,
} = {}) {
  validateBehavioralGenomePromotionPolicy(policy, config, corpus);
  assert(SHA_PATTERN.test(baseSha ?? ''), 'baseSha must be a full lowercase commit SHA');
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  assert(baseSha !== candidateSha, 'behavioral genome promotion requires distinct base and candidate SHAs');
  assertString(taskId, 'behavioral genome promotion taskId');

  const calibration = calibrateBehavioralGenomePromotion(policy, config, corpus, { candidateSha });
  assert(calibration.calibrationPass, 'EV-10 calibration no longer satisfies the EV-11 promotion policy');
  const declared = validateBehavioralGenomeDeclaration(declaration, policy, taskId);
  const baseGenome = createBehavioralGenome(baseObservations, config, { candidateSha: baseSha });
  const candidateGenome = createBehavioralGenome(candidateObservations, config, { candidateSha });
  assert(baseGenome.route === policy.route, `base behavioral genome route ${baseGenome.route} does not match promotion route ${policy.route}`);
  assert(candidateGenome.route === policy.route, `candidate behavioral genome route ${candidateGenome.route} does not match promotion route ${policy.route}`);

  const comparison = compareBehavioralGenomes(baseGenome, candidateGenome, { declaredDomains: declared.domains });
  const domainResults = [...config.requiredDomains]
    .sort((a, b) => a.localeCompare(b))
    .map(domain => {
      const changed = comparison.changedDomains.includes(domain);
      const declaredHere = declared.domains.includes(domain);
      const policyClassification = policy.domains[domain].classification;
      let outcome = 'unchanged';
      let wouldBlock = false;
      if (changed && policyClassification === 'blocking') {
        outcome = 'blocking';
        wouldBlock = true;
      } else if (changed && policyClassification === 'declaration-required' && !declaredHere) {
        outcome = 'blocking-undeclared';
        wouldBlock = true;
      } else if (changed && policyClassification === 'declaration-required' && declaredHere) {
        outcome = 'declared';
      } else if (changed) {
        outcome = 'informational-change';
      } else if (declaredHere) {
        outcome = 'informational-declared-but-unchanged';
      }
      return {
        domain,
        policyClassification,
        changed,
        declared: declaredHere,
        outcome,
        wouldBlock,
      };
    });

  const blockingDomains = domainResults.filter(entry => entry.wouldBlock).map(entry => entry.domain);
  const enforcementEnabled = resolveBehavioralGenomeEnforcement(policy, enforcementOverride, env);
  const wouldBlock = blockingDomains.length > 0;
  const blocking = enforcementEnabled && wouldBlock;
  const reportCore = {
    schema: 'ironshade-behavioral-genome-promotion-gate:v1',
    baseSha,
    candidateSha,
    taskId,
    route: policy.route,
    mode: enforcementEnabled ? 'enforced' : 'advisory-rollback',
    enforcementEnabled,
    policySha256: sha256Value(policy),
    configSha256: sha256Value(config),
    corpusSha256: sha256Value(corpus),
    baseObservationsSha256: sha256Value(baseObservations),
    candidateObservationsSha256: sha256Value(candidateObservations),
    baseRootDigest: baseGenome.rootDigest,
    candidateRootDigest: candidateGenome.rootDigest,
    declaration: {
      present: declaration !== null && declaration !== undefined,
      digest: declared.digest,
      domains: declared.domains,
      rationale: declared.rationale,
    },
    changedDomains: comparison.changedDomains,
    unexplainedDomains: comparison.unexplainedDomains,
    declaredButUnchanged: comparison.declaredButUnchanged,
    domainResults,
    blockingDomains,
    advisoryConstraints: policy.advisoryConstraints.map(entry => ({ ...entry })),
    calibration,
    rollback: {
      environmentVariable: policy.rollback.environmentVariable,
      disabledValue: policy.rollback.disabledValue,
      restoresPreviousBlockingBehavior: true,
    },
    wouldBlock,
    blocking,
    verdict: enforcementEnabled ? (blocking ? 'fail' : 'pass') : 'disabled-advisory',
    candidatePassGranted: false,
  };
  return {
    ...reportCore,
    reportSha256: sha256Value(reportCore),
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function readOptionalJson(path) {
  if (!path) return null;
  try {
    return await readJson(path);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const command = argv[0] ?? null;
  const options = {
    policy: DEFAULT_POLICY,
    config: DEFAULT_CONFIG,
    corpus: DEFAULT_CORPUS,
    baseObservations: null,
    candidateObservations: null,
    baseSha: null,
    candidateSha: null,
    taskId: null,
    declaration: null,
    output: null,
    json: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--policy') options.policy = argv[++index] ?? null;
    else if (argument === '--config') options.config = argv[++index] ?? null;
    else if (argument === '--corpus') options.corpus = argv[++index] ?? null;
    else if (argument === '--base-observations') options.baseObservations = argv[++index] ?? null;
    else if (argument === '--candidate-observations') options.candidateObservations = argv[++index] ?? null;
    else if (argument === '--base-sha') options.baseSha = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--task-id') options.taskId = argv[++index] ?? null;
    else if (argument === '--declaration') options.declaration = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  const [policy, config, corpus] = await Promise.all([
    readJson(options.policy),
    readJson(options.config),
    readJson(options.corpus),
  ]);
  let report;
  if (command === 'calibrate') {
    report = calibrateBehavioralGenomePromotion(policy, config, corpus, { candidateSha: options.candidateSha });
    if (!report.calibrationPass) throw new Error('behavioral genome promotion calibration failed');
  } else if (command === 'gate') {
    assertString(options.baseObservations, '--base-observations');
    assertString(options.candidateObservations, '--candidate-observations');
    const [baseObservations, candidateObservations, declaration] = await Promise.all([
      readJson(options.baseObservations),
      readJson(options.candidateObservations),
      readOptionalJson(options.declaration),
    ]);
    report = evaluateBehavioralGenomePromotion({
      policy,
      config,
      corpus,
      baseObservations,
      candidateObservations,
      baseSha: options.baseSha,
      candidateSha: options.candidateSha,
      taskId: options.taskId,
      declaration,
    });
    if (report.blocking) throw new Error(`behavioral genome promotion blocked undeclared/forbidden domains: ${report.blockingDomains.join(', ')}`);
  } else {
    throw new Error('usage: behavioral-genome-promotion-gate.mjs <calibrate|gate> ...');
  }
  if (options.output) await writeJson(options.output, report);
  if (options.json) process.stdout.write(canonicalJson(report));
  else if (command === 'calibrate') {
    console.log(`BEHAVIORAL_GENOME_PROMOTION_CALIBRATION_PASS candidate=${report.candidateSha} falsePositives=${report.falsePositives}/${report.falsePositiveTrials} falseNegatives=${report.falseNegatives}/${report.falseNegativeTrials} domains=${report.validatedDomains.join(',')}`);
  } else {
    console.log(`BEHAVIORAL_GENOME_PROMOTION_GATE verdict=${report.verdict} task=${report.taskId} base=${report.baseSha} candidate=${report.candidateSha} changed=${report.changedDomains.join(',') || 'none'} blocking=${report.blockingDomains.join(',') || 'none'} enforcement=${report.enforcementEnabled} candidatePassGranted=false`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(`BEHAVIORAL_GENOME_PROMOTION_ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
