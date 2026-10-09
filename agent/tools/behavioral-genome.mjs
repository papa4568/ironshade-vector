import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const REQUIRED_DOMAINS = ['simulation', 'mission', 'presentation', 'load', 'resources', 'performance'];
const NORMALIZER_KINDS = new Set(['round', 'bucket']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function clone(value) {
  return structuredClone(value);
}

function normalizeObject(value) {
  if (Array.isArray(value)) return value.map(normalizeObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .map(key => [key, normalizeObject(value[key])]),
  );
}

export function canonicalJson(value) {
  return `${JSON.stringify(normalizeObject(value), null, 2)}\n`;
}

export function sha256Value(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function pathSegments(path) {
  assertString(path, 'observation path');
  return path.split('.').filter(Boolean);
}

function readAtPath(root, path) {
  let value = root;
  for (const segment of pathSegments(path)) {
    if (!value || typeof value !== 'object' || !(segment in value)) return { found: false, value: undefined };
    value = value[segment];
  }
  return { found: true, value };
}

function writeAtPath(root, path, value) {
  const segments = pathSegments(path);
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    assertObject(cursor[segment], `normalizer parent ${segments.slice(0, index + 1).join('.')}`);
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = value;
}

function deleteAtPath(root, path) {
  const segments = pathSegments(path);
  let cursor = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) return false;
    cursor = cursor[segment];
  }
  if (!cursor || typeof cursor !== 'object') return false;
  return delete cursor[segments.at(-1)];
}

export function validateBehavioralGenomeConfig(config) {
  assertObject(config, 'behavioral genome config');
  assert(config.schemaVersion === 1, 'behavioral genome config schemaVersion must be 1');
  assert(config.mode === 'advisory', 'behavioral genome config mode must remain advisory until promoted');
  assert(Array.isArray(config.requiredDomains), 'behavioral genome config requiredDomains must be an array');
  assert(
    REQUIRED_DOMAINS.every(domain => config.requiredDomains.includes(domain)),
    `behavioral genome config must include domains: ${REQUIRED_DOMAINS.join(', ')}`,
  );
  assert(new Set(config.requiredDomains).size === config.requiredDomains.length, 'behavioral genome requiredDomains must not contain duplicates');
  assertObject(config.domains, 'behavioral genome config domains');

  for (const domain of config.requiredDomains) {
    const rule = config.domains[domain];
    assertObject(rule, `behavioral genome domain ${domain}`);
    assert(Array.isArray(rule.excludePaths ?? []), `behavioral genome domain ${domain}.excludePaths must be an array`);
    for (const path of rule.excludePaths ?? []) assertString(path, `behavioral genome domain ${domain}.excludePaths entry`);
    assertObject(rule.normalizers ?? {}, `behavioral genome domain ${domain}.normalizers`);
    for (const [path, normalizer] of Object.entries(rule.normalizers ?? {})) {
      assertString(path, `behavioral genome domain ${domain} normalizer path`);
      assertObject(normalizer, `behavioral genome domain ${domain} normalizer ${path}`);
      assert(NORMALIZER_KINDS.has(normalizer.kind), `behavioral genome domain ${domain} normalizer ${path} has invalid kind ${normalizer.kind}`);
      if (normalizer.kind === 'round') {
        assert(Number.isInteger(normalizer.decimals) && normalizer.decimals >= 0 && normalizer.decimals <= 8, `round normalizer ${domain}.${path} decimals must be 0..8`);
      } else {
        assert(typeof normalizer.size === 'number' && Number.isFinite(normalizer.size) && normalizer.size > 0, `bucket normalizer ${domain}.${path} size must be positive`);
      }
    }
  }
  return config;
}

function normalizeDomain(domain, value, rule) {
  assertObject(value, `behavior observations domain ${domain}`);
  const normalized = clone(value);
  for (const path of rule.excludePaths ?? []) deleteAtPath(normalized, path);
  for (const [path, normalizer] of Object.entries(rule.normalizers ?? {})) {
    const current = readAtPath(normalized, path);
    if (!current.found) continue;
    assert(typeof current.value === 'number' && Number.isFinite(current.value), `normalizer ${domain}.${path} requires a finite number`);
    const next = normalizer.kind === 'round'
      ? Number(current.value.toFixed(normalizer.decimals))
      : Math.round(current.value / normalizer.size) * normalizer.size;
    writeAtPath(normalized, path, Number(next.toFixed(8)));
  }
  return normalizeObject(normalized);
}

export function validateBehaviorObservations(observations, config) {
  assertObject(observations, 'behavior observations');
  assert(observations.schema === 'ironshade-behavior-observations:v1', 'unsupported behavior observations schema');
  assertString(observations.route, 'behavior observations route');
  assertObject(observations.domains, 'behavior observations domains');
  for (const domain of config.requiredDomains) {
    assertObject(observations.domains[domain], `behavior observations domain ${domain}`);
  }
  return observations;
}

export function createBehavioralGenome(observations, config, { candidateSha } = {}) {
  validateBehavioralGenomeConfig(config);
  validateBehaviorObservations(observations, config);
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');

  const domains = {};
  for (const domain of [...config.requiredDomains].sort((a, b) => a.localeCompare(b))) {
    const normalized = normalizeDomain(domain, observations.domains[domain], config.domains[domain]);
    domains[domain] = {
      digest: sha256Value({ domain, normalized }),
      normalized,
    };
  }
  const domainDigests = Object.fromEntries(Object.entries(domains).map(([domain, entry]) => [domain, entry.digest]));
  const configSha256 = sha256Value(config);
  const rootDigest = sha256Value({
    schema: 'ironshade-behavioral-genome-root:v1',
    route: observations.route,
    configSha256,
    domains: domainDigests,
  });

  return {
    schema: 'ironshade-behavioral-genome:v1',
    mode: 'advisory',
    candidateSha,
    route: observations.route,
    configSha256,
    observationsSha256: sha256Value(observations),
    rootDigest,
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    domains,
  };
}

function validateGenome(genome, label) {
  assertObject(genome, label);
  assert(genome.schema === 'ironshade-behavioral-genome:v1', `${label} has unsupported schema`);
  assert(genome.mode === 'advisory', `${label} must remain advisory`);
  assert(SHA_PATTERN.test(genome.candidateSha ?? ''), `${label}.candidateSha must be a full lowercase commit SHA`);
  assertString(genome.route, `${label}.route`);
  assertString(genome.configSha256, `${label}.configSha256`);
  assertString(genome.rootDigest, `${label}.rootDigest`);
  assertObject(genome.domains, `${label}.domains`);
  for (const domain of REQUIRED_DOMAINS) {
    assertObject(genome.domains[domain], `${label}.domains.${domain}`);
    assertString(genome.domains[domain].digest, `${label}.domains.${domain}.digest`);
  }
  return genome;
}

export function compareBehavioralGenomes(baseGenome, candidateGenome, { declaredDomains = [] } = {}) {
  validateGenome(baseGenome, 'base genome');
  validateGenome(candidateGenome, 'candidate genome');
  assert(baseGenome.route === candidateGenome.route, 'behavioral genomes must use the same route');
  assert(baseGenome.configSha256 === candidateGenome.configSha256, 'behavioral genomes must use the same config digest');
  assert(Array.isArray(declaredDomains), 'declaredDomains must be an array');
  const uniqueDeclared = [...new Set(declaredDomains)].sort((a, b) => a.localeCompare(b));
  for (const domain of uniqueDeclared) assert(REQUIRED_DOMAINS.includes(domain), `unknown declared behavior domain ${domain}`);

  const changedDomains = REQUIRED_DOMAINS
    .filter(domain => baseGenome.domains[domain].digest !== candidateGenome.domains[domain].digest)
    .sort((a, b) => a.localeCompare(b));
  const unexplainedDomains = changedDomains.filter(domain => !uniqueDeclared.includes(domain));
  const declaredButUnchanged = uniqueDeclared.filter(domain => !changedDomains.includes(domain));
  const status = unexplainedDomains.length === 0 ? 'pass' : 'fail';

  return {
    schema: 'ironshade-behavioral-genome-comparison:v1',
    mode: 'advisory',
    route: candidateGenome.route,
    baseCandidateSha: baseGenome.candidateSha,
    candidateSha: candidateGenome.candidateSha,
    baseRootDigest: baseGenome.rootDigest,
    candidateRootDigest: candidateGenome.rootDigest,
    declaredDomains: uniqueDeclared,
    changedDomains,
    unexplainedDomains,
    declaredButUnchanged,
    status,
    acceptedForEnforcement: false,
    candidatePassGranted: false,
  };
}

export function assertDeclaredBehavior(report) {
  assertObject(report, 'behavioral genome comparison');
  assert(report.schema === 'ironshade-behavioral-genome-comparison:v1', 'unsupported behavioral genome comparison schema');
  assert(report.status === 'pass', `unexplained behavioral genome delta: ${(report.unexplainedDomains ?? []).join(', ') || 'unknown'}`);
  return report;
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
  const command = argv[0] ?? null;
  const options = {
    observations: null,
    config: 'agent/behavioral-genome.config.json',
    candidateSha: null,
    base: null,
    candidate: null,
    declaredDomains: [],
    output: null,
    enforce: false,
    json: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--observations') options.observations = argv[++index] ?? null;
    else if (argument === '--config') options.config = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--base') options.base = argv[++index] ?? null;
    else if (argument === '--candidate') options.candidate = argv[++index] ?? null;
    else if (argument === '--declared-domains') {
      const raw = argv[++index] ?? '';
      options.declaredDomains = raw ? raw.split(',').map(value => value.trim()).filter(Boolean) : [];
    } else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--enforce') options.enforce = true;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  let report;
  if (command === 'create') {
    assertString(options.observations, '--observations');
    assertString(options.config, '--config');
    const [observations, config] = await Promise.all([readJson(options.observations), readJson(options.config)]);
    report = createBehavioralGenome(observations, config, { candidateSha: options.candidateSha });
    if (!options.json) {
      console.log(`BEHAVIORAL_GENOME_REPORT mode=${report.mode} route=${report.route} candidate=${report.candidateSha} root=${report.rootDigest}`);
    }
  } else if (command === 'compare') {
    assertString(options.base, '--base');
    assertString(options.candidate, '--candidate');
    const [baseGenome, candidateGenome] = await Promise.all([readJson(options.base), readJson(options.candidate)]);
    report = compareBehavioralGenomes(baseGenome, candidateGenome, { declaredDomains: options.declaredDomains });
    if (!options.json) {
      console.log(`BEHAVIORAL_GENOME_COMPARE status=${report.status} changed=${report.changedDomains.join(',') || 'none'} unexplained=${report.unexplainedDomains.join(',') || 'none'}`);
    }
    if (options.enforce) assertDeclaredBehavior(report);
  } else {
    throw new Error('usage: behavioral-genome.mjs <create|compare> ...');
  }
  if (options.output) await writeJson(options.output, report);
  if (options.json) process.stdout.write(canonicalJson(report));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
