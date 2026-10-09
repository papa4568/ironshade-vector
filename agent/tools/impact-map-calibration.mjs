import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectChangedFiles,
  loadImpactMap,
  selectAffectedVerification,
  validateImpactMap,
} from './select-affected-verification.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const OUTCOMES = new Set(['success', 'failure', 'skipped', 'cancelled']);
const SOURCES = new Set(['candidate', 'historical', 'synthetic']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label, { minItems = 0 } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function orderedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function pathFamily(filePath) {
  assertString(filePath, 'file path');
  const normalized = filePath.replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return normalized;
  if (['src', 'public', 'agent', '.github'].includes(parts[0]) && parts.length >= 3) {
    return `${parts[0]}/${parts[1]}/**`;
  }
  return `${parts[0]}/**`;
}

export function validateCalibrationConfig(config) {
  assertObject(config, 'impact calibration config');
  assert(config.schemaVersion === 1, 'impact calibration schemaVersion must be 1');
  assert(config.mode === 'advisory', 'impact calibration mode must remain advisory until promoted');
  assertObject(config.confidence, 'impact calibration confidence');
  assert(
    Number.isInteger(config.confidence.minimumTrustedFailureObservations)
      && config.confidence.minimumTrustedFailureObservations >= 1
      && config.confidence.minimumTrustedFailureObservations <= 100,
    'minimumTrustedFailureObservations must be an integer from 1 to 100',
  );
  assert(
    typeof config.confidence.failClosedThreshold === 'number'
      && config.confidence.failClosedThreshold > 0
      && config.confidence.failClosedThreshold <= 1,
    'failClosedThreshold must be greater than 0 and at most 1',
  );
  assert(Array.isArray(config.trustedObservations), 'trustedObservations must be an array');
  assert(config.trustedObservations.length <= 100, 'trustedObservations must remain bounded to 100 entries');
  config.trustedObservations.forEach((observation, index) => validateObservation(observation, `trustedObservations[${index}]`, { requireTrusted: true }));
  return config;
}

export function validateObservation(observation, label = 'impact observation', { requireTrusted = false } = {}) {
  assertObject(observation, label);
  assertString(observation.id, `${label}.id`);
  assert(SOURCES.has(observation.source), `${label}.source must be candidate, historical, or synthetic`);
  assertString(observation.candidateSha, `${label}.candidateSha`);
  assert(SHA_PATTERN.test(observation.candidateSha), `${label}.candidateSha must be a full lowercase SHA`);
  assertStringArray(observation.changedFiles, `${label}.changedFiles`, { minItems: 1 });
  assertObject(observation.prediction, `${label}.prediction`);
  assert(['none', 'targeted', 'full'].includes(observation.prediction.mode), `${label}.prediction.mode is invalid`);
  assertStringArray(observation.prediction.domains, `${label}.prediction.domains`);
  assertStringArray(observation.prediction.verificationIds, `${label}.prediction.verificationIds`);
  assertStringArray(observation.prediction.pathFamilies, `${label}.prediction.pathFamilies`, { minItems: 1 });
  assertObject(observation.fullVerification, `${label}.fullVerification`);
  assert(OUTCOMES.has(observation.fullVerification.outcome), `${label}.fullVerification.outcome is invalid`);
  if (observation.fullVerification.failedScript !== null) assertString(observation.fullVerification.failedScript, `${label}.fullVerification.failedScript`);
  assertStringArray(observation.fullVerification.observedVerificationIds, `${label}.fullVerification.observedVerificationIds`);
  assertStringArray(observation.fullVerification.observedDomains, `${label}.fullVerification.observedDomains`);
  assertObject(observation.comparison, `${label}.comparison`);
  assert(typeof observation.comparison.falseNegative === 'boolean', `${label}.comparison.falseNegative must be boolean`);
  if (observation.comparison.reason !== null) assertString(observation.comparison.reason, `${label}.comparison.reason`);
  assert(typeof observation.trustedForCalibration === 'boolean', `${label}.trustedForCalibration must be boolean`);
  if (requireTrusted) assert(observation.trustedForCalibration === true, `${label} must be trusted for calibration`);
  return observation;
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

export function parseFailedNpmScript(logText) {
  if (typeof logText !== 'string' || logText.length === 0) return null;
  const scripts = [];
  const normalized = stripAnsi(logText);
  for (const match of normalized.matchAll(/^>\s+[^\s@]+@[^\s]+\s+([^\s]+)\s*$/gm)) {
    const script = match[1];
    if (!['build', 'build:prod', 'verify:full'].includes(script)) scripts.push(script);
  }
  return scripts.at(-1) ?? null;
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function verificationIdsForScript(script, impactMap) {
  if (!script) return [];
  validateImpactMap(impactMap);
  const pattern = new RegExp(`npm\\s+run\\s+${regexEscape(script)}(?=\\s|$|&&|\\|\\||;)`);
  return Object.entries(impactMap.verifications)
    .filter(([, verification]) => pattern.test(verification.command))
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));
}

export function domainsForVerificationIds(verificationIds, impactMap) {
  validateImpactMap(impactMap);
  const ids = new Set(verificationIds);
  const domains = [];
  for (const rule of impactMap.rules) {
    if (rule.verificationIds.some(id => ids.has(id))) domains.push(...rule.domains);
  }
  return orderedUnique(domains);
}

export function createImpactObservation({
  id,
  source = 'candidate',
  candidateSha,
  changedFiles,
  impactMap,
  fullVerificationOutcome,
  fullVerificationLog = '',
  trustedForCalibration = false,
}) {
  assertString(id, 'observation id');
  assert(SOURCES.has(source), 'observation source must be candidate, historical, or synthetic');
  assertString(candidateSha, 'candidateSha');
  assert(SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase SHA');
  assert(OUTCOMES.has(fullVerificationOutcome), 'fullVerificationOutcome is invalid');
  validateImpactMap(impactMap);
  assertStringArray(changedFiles, 'changedFiles', { minItems: 1 });

  const selection = selectAffectedVerification(changedFiles, impactMap);
  const failedScript = fullVerificationOutcome === 'failure' ? parseFailedNpmScript(fullVerificationLog) : null;
  const observedVerificationIds = failedScript ? verificationIdsForScript(failedScript, impactMap) : [];
  const observedDomains = observedVerificationIds.length > 0
    ? domainsForVerificationIds(observedVerificationIds, impactMap)
    : (fullVerificationOutcome === 'failure' ? ['full-verification'] : []);
  const predictedVerificationIds = selection.verifications.map(verification => verification.id);

  let falseNegative = false;
  let reason = null;
  if (fullVerificationOutcome === 'failure' && selection.mode !== 'full') {
    if (observedVerificationIds.length === 0) {
      falseNegative = true;
      reason = failedScript
        ? `full verification failed in unmapped script ${failedScript} while impact prediction was ${selection.mode}`
        : `full verification failed without a mapped failing script while impact prediction was ${selection.mode}`;
    } else {
      const missing = observedVerificationIds.filter(idValue => !predictedVerificationIds.includes(idValue));
      if (missing.length > 0) {
        falseNegative = true;
        reason = `full verification exposed unpredicted checks: ${missing.join(', ')}`;
      }
    }
  }

  return validateObservation({
    id,
    source,
    candidateSha,
    changedFiles: [...changedFiles].map(file => file.replaceAll('\\', '/')).sort((a, b) => a.localeCompare(b)),
    prediction: {
      mode: selection.mode,
      domains: selection.domains,
      verificationIds: predictedVerificationIds,
      pathFamilies: orderedUnique(changedFiles.map(pathFamily)),
    },
    fullVerification: {
      outcome: fullVerificationOutcome,
      failedScript,
      observedVerificationIds,
      observedDomains,
    },
    comparison: {
      falseNegative,
      reason,
    },
    trustedForCalibration,
  });
}

export function calibrationMetrics(observations, config) {
  validateCalibrationConfig(config);
  assert(Array.isArray(observations), 'observations must be an array');
  const trusted = observations
    .map((observation, index) => validateObservation(observation, `observations[${index}]`))
    .filter(observation => observation.trustedForCalibration && observation.fullVerification.outcome === 'failure')
    .sort((a, b) => a.id.localeCompare(b.id));
  const falseNegativeCount = trusted.filter(observation => observation.comparison.falseNegative).length;
  const confidence = trusted.length === 0 ? 1 : (trusted.length - falseNegativeCount) / trusted.length;
  const sufficientSample = trusted.length >= config.confidence.minimumTrustedFailureObservations;
  const failClosed = sufficientSample && confidence < config.confidence.failClosedThreshold;
  return {
    schema: 'ironshade-impact-calibration-status:v1',
    trustedFailureObservations: trusted.length,
    falseNegativeCount,
    falseNegativeRate: trusted.length === 0 ? 0 : falseNegativeCount / trusted.length,
    confidence,
    threshold: config.confidence.failClosedThreshold,
    minimumTrustedFailureObservations: config.confidence.minimumTrustedFailureObservations,
    sufficientSample,
    failClosed,
    fallbackVerificationIds: failClosed ? ['verify-full'] : [],
  };
}

export function applyCalibrationStatus(selection, status, impactMap) {
  validateImpactMap(impactMap);
  assertObject(selection, 'selection');
  assertObject(status, 'calibration status');
  assert(status.schema === 'ironshade-impact-calibration-status:v1', 'unsupported calibration status schema');
  assert(typeof status.failClosed === 'boolean', 'calibration status failClosed must be boolean');
  if (!status.failClosed || selection.mode === 'full') return selection;
  const verificationIds = impactMap.fallback.highRiskVerificationIds;
  return {
    ...selection,
    mode: 'full',
    escalated: true,
    escalationReasons: [
      ...selection.escalationReasons,
      `impact calibration confidence ${status.confidence} is below threshold ${status.threshold}; fail closed to full verification`,
    ],
    verifications: verificationIds.map(id => ({ id, ...impactMap.verifications[id] })),
    calibrationFallback: {
      applied: true,
      confidence: status.confidence,
      threshold: status.threshold,
      verificationIds,
    },
  };
}

export function proposeConservativeExpansions(observations, impactMap) {
  validateImpactMap(impactMap);
  assert(Array.isArray(observations), 'observations must be an array');
  const groups = new Map();
  for (const [index, observation] of observations.entries()) {
    validateObservation(observation, `observations[${index}]`);
    if (!observation.comparison.falseNegative) continue;
    const observedDomains = observation.fullVerification.observedDomains.length > 0
      ? observation.fullVerification.observedDomains
      : ['full-verification'];
    for (const family of observation.prediction.pathFamilies) {
      for (const domain of observedDomains) {
        const key = `${family}\u0000${domain}`;
        const group = groups.get(key) ?? { family, domain, observationIds: [] };
        group.observationIds.push(observation.id);
        groups.set(key, group);
      }
    }
  }

  return [...groups.values()]
    .sort((a, b) => `${a.family}:${a.domain}`.localeCompare(`${b.family}:${b.domain}`))
    .map(group => {
      const proposalKey = sha256({ pathFamily: group.family, observedDomain: group.domain }).slice(0, 12);
      const suggestedRule = {
        id: `calibration-${proposalKey}`,
        include: [group.family],
        domains: [group.domain],
        verificationIds: [...impactMap.fallback.highRiskVerificationIds],
        risk: 'high',
        reason: `EV-5 calibration observed an impact-map false negative for ${group.family} in ${group.domain}; widen verification until the rule is reviewed.`,
      };
      return {
        schema: 'ironshade-impact-expansion-proposal:v1',
        id: `impact-expansion-${proposalKey}`,
        status: 'proposed',
        reviewRequired: true,
        automaticApply: false,
        coverageDirection: 'widen-only',
        pathFamily: group.family,
        observedDomain: group.domain,
        occurrenceCount: group.observationIds.length,
        observationIds: [...group.observationIds].sort((a, b) => a.localeCompare(b)),
        suggestedRule,
      };
    });
}

export function buildCalibrationReport({ observation, config, impactMap }) {
  validateObservation(observation);
  validateCalibrationConfig(config);
  validateImpactMap(impactMap);
  const history = [...config.trustedObservations, observation];
  const status = calibrationMetrics(history, config);
  const predictedSelection = selectAffectedVerification(observation.changedFiles, impactMap);
  const recommendedSelection = applyCalibrationStatus(predictedSelection, status, impactMap);
  return {
    schema: 'ironshade-impact-calibration-report:v1',
    schemaVersion: 1,
    mode: 'advisory',
    candidateSha: observation.candidateSha,
    observation,
    metrics: status,
    proposals: proposeConservativeExpansions(history, impactMap),
    recommendedSelection: {
      mode: recommendedSelection.mode,
      verificationIds: recommendedSelection.verifications.map(verification => verification.id),
      escalationReasons: recommendedSelection.escalationReasons,
      calibrationFallback: recommendedSelection.calibrationFallback ?? null,
    },
    acceptedForEnforcement: false,
    candidatePassGranted: false,
  };
}

export async function loadCalibrationConfig(configPath = resolve('agent/impact-calibration.json')) {
  const raw = await readFile(configPath, 'utf8');
  return validateCalibrationConfig(JSON.parse(raw));
}

async function readOptionalFile(filePath) {
  if (!filePath) return '';
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

async function writeJson(outputPath, value) {
  const destination = resolve(outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const command = argv[0] ?? null;
  const options = {
    command,
    configPath: null,
    impactMapPath: null,
    base: null,
    head: null,
    files: null,
    candidateSha: null,
    outcome: null,
    logPath: null,
    outputPath: null,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--config') options.configPath = argv[++index] ?? null;
    else if (argument === '--impact-map') options.impactMapPath = argv[++index] ?? null;
    else if (argument === '--base') options.base = argv[++index] ?? null;
    else if (argument === '--head') options.head = argv[++index] ?? null;
    else if (argument === '--files') options.files = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--outcome') options.outcome = argv[++index] ?? null;
    else if (argument === '--log') options.logPath = argv[++index] ?? null;
    else if (argument === '--output') options.outputPath = argv[++index] ?? null;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const config = await loadCalibrationConfig(options.configPath ? resolve(options.configPath) : undefined);
  const impactMap = await loadImpactMap(options.impactMapPath ? resolve(options.impactMapPath) : undefined);

  if (options.command === 'status') {
    const status = calibrationMetrics(config.trustedObservations, config);
    if (options.outputPath) await writeJson(options.outputPath, status);
    console.log(`IMPACT_CALIBRATION_STATUS trustedFailures=${status.trustedFailureObservations} misses=${status.falseNegativeCount} confidence=${status.confidence} threshold=${status.threshold} failClosed=${status.failClosed}`);
    return;
  }

  if (options.command !== 'observe') throw new Error('usage: impact-map-calibration.mjs <observe|status> [options]');
  assertString(options.candidateSha, '--candidate-sha');
  assert(OUTCOMES.has(options.outcome), '--outcome must be success, failure, skipped, or cancelled');
  assertString(options.outputPath, '--output');

  let changedFiles;
  if (options.files) {
    changedFiles = options.files.split(',').map(file => file.trim()).filter(Boolean);
  } else if (options.base && options.head) {
    changedFiles = collectChangedFiles({ base: options.base, head: options.head });
  } else {
    throw new Error('provide --files or both --base and --head');
  }
  assert(changedFiles.length > 0, 'no changed files were found');
  const fullVerificationLog = await readOptionalFile(options.logPath ? resolve(options.logPath) : null);
  const observation = createImpactObservation({
    id: `candidate:${options.candidateSha}`,
    source: 'candidate',
    candidateSha: options.candidateSha,
    changedFiles,
    impactMap,
    fullVerificationOutcome: options.outcome,
    fullVerificationLog,
    trustedForCalibration: false,
  });
  const report = buildCalibrationReport({ observation, config, impactMap });
  await writeJson(options.outputPath, report);
  console.log(`IMPACT_CALIBRATION_REPORT candidate=${options.candidateSha} prediction=${observation.prediction.mode} outcome=${observation.fullVerification.outcome} falseNegative=${observation.comparison.falseNegative} proposals=${report.proposals.length} confidence=${report.metrics.confidence} failClosed=${report.metrics.failClosed}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`IMPACT_CALIBRATION_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
