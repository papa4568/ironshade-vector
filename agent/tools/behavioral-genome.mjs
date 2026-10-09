import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
export const BEHAVIOR_DOMAINS = [
  'simulation',
  'missionProgression',
  'rendererState',
  'assetLoadReadiness',
  'resourceOwnership',
  'performanceBands',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function normalizeNumber(value) {
  if (!Number.isFinite(value)) throw new Error('behavior observations must not contain non-finite numbers');
  return Number(value.toFixed(4));
}

export function normalizeBehaviorValue(value) {
  if (typeof value === 'number') return normalizeNumber(value);
  if (Array.isArray(value)) return value.map(normalizeBehaviorValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .map(key => [key, normalizeBehaviorValue(value[key])]),
  );
}

export function canonicalJson(value) {
  return `${JSON.stringify(normalizeBehaviorValue(value), null, 2)}\n`;
}

export function sha256Value(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function validateExcludedObservations(excluded) {
  assert(Array.isArray(excluded), 'excludedObservations must be an array');
  const paths = new Set();
  for (const [index, entry] of excluded.entries()) {
    assertObject(entry, `excludedObservations[${index}]`);
    assertString(entry.path, `excludedObservations[${index}].path`);
    assertString(entry.reason, `excludedObservations[${index}].reason`);
    assert(!paths.has(entry.path), `duplicate excluded observation path ${entry.path}`);
    paths.add(entry.path);
  }
}

export function validateBehaviorObservations(document) {
  assertObject(document, 'behavior observations');
  assert(document.schema === 'ironshade-behavior-observations:v1', 'unsupported behavior observation schema');
  assertString(document.routeId, 'routeId');
  assertObject(document.domains, 'domains');
  validateExcludedObservations(document.excludedObservations ?? []);
  const keys = Object.keys(document.domains).sort((a, b) => a.localeCompare(b));
  const expected = [...BEHAVIOR_DOMAINS].sort((a, b) => a.localeCompare(b));
  assert(keys.join(',') === expected.join(','), `domains must be exactly ${BEHAVIOR_DOMAINS.join(', ')}`);
  for (const domain of BEHAVIOR_DOMAINS) assertObject(document.domains[domain], `domains.${domain}`);
  return document;
}

export function buildBehavioralGenome(document, { candidateSha = null } = {}) {
  validateBehaviorObservations(document);
  if (candidateSha !== null) assert(SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase commit SHA');
  const domains = {};
  for (const domain of BEHAVIOR_DOMAINS) {
    const observations = normalizeBehaviorValue(document.domains[domain]);
    domains[domain] = {
      digest: sha256Value(observations),
      observations,
    };
  }
  const rootMaterial = Object.fromEntries(BEHAVIOR_DOMAINS.map(domain => [domain, domains[domain].digest]));
  return {
    schema: 'ironshade-behavioral-genome:v1',
    mode: 'advisory',
    candidateSha,
    routeId: document.routeId,
    normalization: {
      numericPrecisionDecimals: 4,
      objectKeys: 'sorted',
      excludedObservationsHashed: false,
    },
    excludedObservations: [...(document.excludedObservations ?? [])]
      .sort((a, b) => a.path.localeCompare(b.path)),
    domains,
    genomeDigest: sha256Value(rootMaterial),
  };
}

export function compareBehavioralGenomes(base, candidate, { declaredDomains = [] } = {}) {
  assertObject(base, 'base genome');
  assertObject(candidate, 'candidate genome');
  assert(base.schema === 'ironshade-behavioral-genome:v1', 'unsupported base genome schema');
  assert(candidate.schema === 'ironshade-behavioral-genome:v1', 'unsupported candidate genome schema');
  assert(base.routeId === candidate.routeId, 'behavioral genomes must use the same routeId');
  const declared = [...new Set(declaredDomains)].sort((a, b) => a.localeCompare(b));
  for (const domain of declared) assert(BEHAVIOR_DOMAINS.includes(domain), `unknown declared behavior domain ${domain}`);
  const changedDomains = BEHAVIOR_DOMAINS.filter(domain => base.domains?.[domain]?.digest !== candidate.domains?.[domain]?.digest);
  const unexplainedDomains = changedDomains.filter(domain => !declared.includes(domain));
  return {
    schema: 'ironshade-behavioral-genome-comparison:v1',
    mode: 'advisory',
    routeId: base.routeId,
    baseCandidateSha: base.candidateSha ?? null,
    candidateSha: candidate.candidateSha ?? null,
    baseGenomeDigest: base.genomeDigest,
    candidateGenomeDigest: candidate.genomeDigest,
    declaredDomains: declared,
    changedDomains,
    unexplainedDomains,
    accepted: unexplainedDomains.length === 0,
  };
}

export function assertExplainedBehavioralDelta(report) {
  assertObject(report, 'behavioral genome comparison');
  assert(report.schema === 'ironshade-behavioral-genome-comparison:v1', 'unsupported behavioral genome comparison schema');
  assert(report.accepted === true, `unexplained behavioral genome delta: ${(report.unexplainedDomains ?? []).join(', ') || 'unknown'}`);
  return report;
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const command = argv[0];
  const options = { input: null, base: null, candidate: null, candidateSha: null, output: null, declare: [], enforce: false, json: false };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--input') options.input = argv[++index] ?? null;
    else if (argument === '--base') options.base = argv[++index] ?? null;
    else if (argument === '--candidate') options.candidate = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--declare') options.declare = (argv[++index] ?? '').split(',').map(value => value.trim()).filter(Boolean);
    else if (argument === '--enforce') options.enforce = true;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return { command, options };
}

async function readJson(path) {
  assertString(path, 'JSON path');
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command === 'create') {
    const document = await readJson(options.input);
    const genome = buildBehavioralGenome(document, { candidateSha: options.candidateSha });
    if (options.output) await writeJson(options.output, genome);
    if (options.json) process.stdout.write(canonicalJson(genome));
    else console.log(`BEHAVIORAL_GENOME_CREATE route=${genome.routeId} digest=${genome.genomeDigest} candidate=${genome.candidateSha ?? 'none'}`);
    return;
  }
  if (command === 'compare') {
    const base = await readJson(options.base);
    const candidate = await readJson(options.candidate);
    const report = compareBehavioralGenomes(base, candidate, { declaredDomains: options.declare });
    if (options.output) await writeJson(options.output, report);
    if (options.json) process.stdout.write(canonicalJson(report));
    else console.log(`BEHAVIORAL_GENOME_COMPARE changed=${report.changedDomains.join(',') || 'none'} unexplained=${report.unexplainedDomains.join(',') || 'none'} accepted=${report.accepted}`);
    if (options.enforce) assertExplainedBehavioralDelta(report);
    return;
  }
  throw new Error('usage: behavioral-genome.mjs <create|compare> ...');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
