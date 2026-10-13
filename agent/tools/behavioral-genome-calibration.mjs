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

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const CASE_KINDS = new Set(['noise-control', 'semantic-change']);
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function pathSegments(path) {
  assertString(path, 'calibration mutation path');
  const segments = path.split('.').filter(Boolean);
  assert(segments.length >= 3 && segments[0] === 'domains', `calibration mutation path must stay inside observations.domains: ${path}`);
  for (const segment of segments) {
    assert(!FORBIDDEN_PATH_SEGMENTS.has(segment), `calibration mutation path contains forbidden segment ${segment}`);
  }
  return segments;
}

function mutateAtPath(root, path, value) {
  const segments = pathSegments(path);
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    assertObject(cursor[segment], `calibration mutation parent ${segments.slice(0, index + 1).join('.')}`);
    cursor = cursor[segment];
  }
  const key = segments.at(-1);
  assert(Object.hasOwn(cursor, key), `calibration mutation target does not exist: ${path}`);
  cursor[key] = structuredClone(value);
}

export function validateBehavioralGenomeCalibrationCorpus(corpus, config) {
  assertObject(corpus, 'behavioral genome calibration corpus');
  assert(corpus.schemaVersion === 1, 'behavioral genome calibration corpus schemaVersion must be 1');
  assert(corpus.mode === 'advisory', 'behavioral genome calibration corpus must remain advisory in EV-10');
  assertString(corpus.route, 'behavioral genome calibration corpus route');
  assert(Array.isArray(corpus.requiredDomains), 'behavioral genome calibration corpus requiredDomains must be an array');
  assert(new Set(corpus.requiredDomains).size === corpus.requiredDomains.length, 'behavioral genome calibration requiredDomains must not contain duplicates');
  assert.deepEqual?.(undefined, undefined);
  const expectedDomains = [...config.requiredDomains].sort((a, b) => a.localeCompare(b));
  const corpusDomains = [...corpus.requiredDomains].sort((a, b) => a.localeCompare(b));
  assert(canonicalJson(corpusDomains) === canonicalJson(expectedDomains), 'behavioral genome calibration requiredDomains must exactly match the genome config');
  assert(Number.isInteger(corpus.falsePositiveBudget) && corpus.falsePositiveBudget >= 0, 'falsePositiveBudget must be a non-negative integer');
  assert(Number.isInteger(corpus.falseNegativeBudget) && corpus.falseNegativeBudget >= 0, 'falseNegativeBudget must be a non-negative integer');
  assertObject(corpus.baselineObservations, 'behavioral genome calibration baselineObservations');
  assert(corpus.baselineObservations.route === corpus.route, 'calibration baseline route must match corpus route');
  assert(Array.isArray(corpus.cases) && corpus.cases.length > 0, 'behavioral genome calibration cases must be a non-empty array');
  assert(Array.isArray(corpus.unresolvedCases), 'behavioral genome calibration unresolvedCases must be an array');

  const caseIds = new Set();
  const semanticCoverage = new Set();
  let noiseControls = 0;
  for (const entry of corpus.cases) {
    assertObject(entry, 'behavioral genome calibration case');
    assertString(entry.id, 'behavioral genome calibration case id');
    assert(!caseIds.has(entry.id), `duplicate behavioral genome calibration case id ${entry.id}`);
    caseIds.add(entry.id);
    assert(CASE_KINDS.has(entry.kind), `behavioral genome calibration case ${entry.id} has invalid kind ${entry.kind}`);
    assertString(entry.description, `behavioral genome calibration case ${entry.id} description`);
    assert(Array.isArray(entry.mutations) && entry.mutations.length > 0, `behavioral genome calibration case ${entry.id} mutations must be non-empty`);
    assert(Array.isArray(entry.expectedChangedDomains), `behavioral genome calibration case ${entry.id} expectedChangedDomains must be an array`);
    assert(new Set(entry.expectedChangedDomains).size === entry.expectedChangedDomains.length, `behavioral genome calibration case ${entry.id} expectedChangedDomains must not contain duplicates`);
    for (const domain of entry.expectedChangedDomains) {
      assert(config.requiredDomains.includes(domain), `behavioral genome calibration case ${entry.id} names unknown domain ${domain}`);
      semanticCoverage.add(domain);
    }
    if (entry.kind === 'noise-control') {
      noiseControls += 1;
      assert(entry.expectedChangedDomains.length === 0, `noise control ${entry.id} must expect no changed domains`);
    } else {
      assert(entry.expectedChangedDomains.length > 0, `semantic change ${entry.id} must expect at least one changed domain`);
    }
    for (const mutation of entry.mutations) {
      assertObject(mutation, `behavioral genome calibration case ${entry.id} mutation`);
      pathSegments(mutation.path);
    }
  }
  assert(noiseControls > 0, 'behavioral genome calibration requires at least one noise control');
  for (const domain of config.requiredDomains) {
    assert(semanticCoverage.has(domain), `behavioral genome calibration requires a semantic-change case for ${domain}`);
  }

  const unresolvedIds = new Set();
  for (const entry of corpus.unresolvedCases) {
    assertObject(entry, 'behavioral genome calibration unresolved case');
    assertString(entry.id, 'behavioral genome calibration unresolved case id');
    assert(!unresolvedIds.has(entry.id), `duplicate behavioral genome calibration unresolved case id ${entry.id}`);
    unresolvedIds.add(entry.id);
    assert(Array.isArray(entry.domains) && entry.domains.length > 0, `unresolved case ${entry.id} domains must be non-empty`);
    for (const domain of entry.domains) assert(config.requiredDomains.includes(domain), `unresolved case ${entry.id} names unknown domain ${domain}`);
    assertString(entry.reason, `unresolved case ${entry.id} reason`);
    assertString(entry.ev11Constraint, `unresolved case ${entry.id} ev11Constraint`);
  }
  return corpus;
}

function buildDomainMetrics(requiredDomains) {
  return Object.fromEntries(requiredDomains.map(domain => [domain, {
    semanticTrials: 0,
    detectedSemanticTrials: 0,
    falsePositives: 0,
    falseNegatives: 0,
  }]));
}

export function runBehavioralGenomeCalibration(corpus, config, { candidateSha } = {}) {
  validateBehavioralGenomeConfig(config);
  validateBehavioralGenomeCalibrationCorpus(corpus, config);
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');

  const baselineGenome = createBehavioralGenome(corpus.baselineObservations, config, { candidateSha });
  const metrics = buildDomainMetrics(config.requiredDomains);
  const cases = [];

  for (const entry of corpus.cases) {
    const observations = structuredClone(corpus.baselineObservations);
    for (const mutation of entry.mutations) mutateAtPath(observations, mutation.path, mutation.value);
    const genome = createBehavioralGenome(observations, config, { candidateSha });
    const comparison = compareBehavioralGenomes(baselineGenome, genome, { declaredDomains: [] });
    const expected = [...entry.expectedChangedDomains].sort((a, b) => a.localeCompare(b));
    const detected = [...comparison.changedDomains].sort((a, b) => a.localeCompare(b));
    const unexpectedDomains = detected.filter(domain => !expected.includes(domain));
    const missedDomains = expected.filter(domain => !detected.includes(domain));

    for (const domain of config.requiredDomains) {
      const expectedHere = expected.includes(domain);
      const detectedHere = detected.includes(domain);
      if (expectedHere) {
        metrics[domain].semanticTrials += 1;
        if (detectedHere) metrics[domain].detectedSemanticTrials += 1;
        else metrics[domain].falseNegatives += 1;
      } else if (detectedHere) {
        metrics[domain].falsePositives += 1;
      }
    }

    cases.push({
      id: entry.id,
      kind: entry.kind,
      description: entry.description,
      expectedChangedDomains: expected,
      detectedChangedDomains: detected,
      unexpectedDomains,
      missedDomains,
      pass: unexpectedDomains.length === 0 && missedDomains.length === 0,
    });
  }

  const falsePositives = Object.values(metrics).reduce((sum, entry) => sum + entry.falsePositives, 0);
  const falseNegatives = Object.values(metrics).reduce((sum, entry) => sum + entry.falseNegatives, 0);
  const validatedDomains = config.requiredDomains
    .filter(domain => metrics[domain].semanticTrials > 0 && metrics[domain].falsePositives === 0 && metrics[domain].falseNegatives === 0)
    .sort((a, b) => a.localeCompare(b));
  const calibrationPass = falsePositives <= corpus.falsePositiveBudget
    && falseNegatives <= corpus.falseNegativeBudget
    && validatedDomains.length === config.requiredDomains.length
    && cases.every(entry => entry.pass);

  const promotionScope = Object.fromEntries(
    [...config.requiredDomains].sort((a, b) => a.localeCompare(b)).map(domain => [domain, {
      status: validatedDomains.includes(domain) ? 'eligible-for-ev11-review' : 'advisory-only',
      measuredSemanticTrials: metrics[domain].semanticTrials,
      falsePositives: metrics[domain].falsePositives,
      falseNegatives: metrics[domain].falseNegatives,
      excludePaths: [...(config.domains[domain].excludePaths ?? [])],
      normalizers: structuredClone(config.domains[domain].normalizers ?? {}),
      unresolvedCaseIds: corpus.unresolvedCases.filter(entry => entry.domains.includes(domain)).map(entry => entry.id).sort((a, b) => a.localeCompare(b)),
    }]),
  );

  return {
    schema: 'ironshade-behavioral-genome-calibration:v1',
    mode: 'advisory',
    candidateSha,
    route: corpus.route,
    configSha256: sha256Value(config),
    corpusSha256: sha256Value(corpus),
    falsePositiveBudget: corpus.falsePositiveBudget,
    falseNegativeBudget: corpus.falseNegativeBudget,
    falsePositives,
    falseNegatives,
    calibrationPass,
    validatedDomains,
    domainMetrics: metrics,
    promotionScope,
    unresolvedCases: structuredClone(corpus.unresolvedCases),
    cases,
    acceptedForEnforcement: false,
    candidatePassGranted: false,
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const options = {
    candidateSha: null,
    config: 'agent/behavioral-genome.config.json',
    corpus: 'agent/behavioral-genome-calibration-corpus.json',
    output: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--config') options.config = argv[++index] ?? null;
    else if (argument === '--corpus') options.corpus = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [config, corpus] = await Promise.all([readJson(options.config), readJson(options.corpus)]);
  const report = runBehavioralGenomeCalibration(corpus, config, { candidateSha: options.candidateSha });
  if (options.output) await writeJson(options.output, report);
  if (options.json) process.stdout.write(canonicalJson(report));
  else console.log(`BEHAVIORAL_GENOME_CALIBRATION mode=${report.mode} candidate=${report.candidateSha} pass=${report.calibrationPass} falsePositives=${report.falsePositives} falseNegatives=${report.falseNegatives} validated=${report.validatedDomains.join(',')}`);
  if (!report.calibrationPass) process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
