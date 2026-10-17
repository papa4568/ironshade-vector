import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SOURCE_KINDS = new Set(['implementation', 'observer', 'shared-infrastructure']);
const DEPENDENCY_ROLES = new Set(['derives', 'shared-infrastructure']);
const IMPORTANCE_LEVELS = new Set(['important', 'advisory']);

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

function uniqueById(entries, label) {
  const map = new Map();
  for (const entry of entries) {
    assertObject(entry, label);
    assertString(entry.id, `${label}.id`);
    assert(!map.has(entry.id), `duplicate ${label} id ${entry.id}`);
    map.set(entry.id, entry);
  }
  return map;
}

export function validateEvidenceGraph(graph) {
  assertObject(graph, 'evidence graph');
  assert(graph.schemaVersion === 1, 'evidence graph schemaVersion must be 1');
  assert(graph.mode === 'advisory', 'evidence graph mode must be advisory until promoted');
  assert(Array.isArray(graph.sources), 'evidence graph sources must be an array');
  assert(Array.isArray(graph.signals), 'evidence graph signals must be an array');
  assert(Array.isArray(graph.proofRecords), 'evidence graph proofRecords must be an array');
  assert(Array.isArray(graph.criteria), 'evidence graph criteria must be an array');

  const sources = uniqueById(graph.sources, 'source');
  const signals = uniqueById(graph.signals, 'signal');
  const proofRecords = uniqueById(graph.proofRecords, 'proofRecord');
  const criteria = uniqueById(graph.criteria, 'criterion');

  for (const source of sources.values()) {
    assert(SOURCE_KINDS.has(source.kind), `source ${source.id} has invalid kind ${source.kind}`);
    assertString(source.path, `source ${source.id}.path`);
    if (source.description !== undefined) assertString(source.description, `source ${source.id}.description`);
  }

  for (const signal of signals.values()) {
    assertString(signal.description, `signal ${signal.id}.description`);
    assert(signal.materiality === 'material' || signal.materiality === 'supporting', `signal ${signal.id} has invalid materiality`);
    assert(Array.isArray(signal.sourceDependencies), `signal ${signal.id}.sourceDependencies must be an array`);
    assert(signal.sourceDependencies.length > 0, `signal ${signal.id} must declare at least one source dependency`);
    let derivesCount = 0;
    for (const dependency of signal.sourceDependencies) {
      assertObject(dependency, `signal ${signal.id} dependency`);
      assertString(dependency.sourceId, `signal ${signal.id} dependency.sourceId`);
      assert(sources.has(dependency.sourceId), `signal ${signal.id} references unknown source ${dependency.sourceId}`);
      assert(DEPENDENCY_ROLES.has(dependency.role), `signal ${signal.id} dependency ${dependency.sourceId} has invalid role ${dependency.role}`);
      const source = sources.get(dependency.sourceId);
      if (dependency.role === 'shared-infrastructure') {
        assert(
          source.kind === 'shared-infrastructure',
          `signal ${signal.id} marks non-infrastructure source ${dependency.sourceId} as shared infrastructure`,
        );
      } else {
        assert(source.kind !== 'shared-infrastructure', `signal ${signal.id} must mark shared infrastructure ${dependency.sourceId} with the shared-infrastructure role`);
        derivesCount += 1;
      }
    }
    assert(derivesCount > 0, `signal ${signal.id} must have at least one deriving observer or implementation source`);
  }

  for (const proof of proofRecords.values()) {
    assertString(proof.description, `proofRecord ${proof.id}.description`);
    assertStringArray(proof.signalIds, `proofRecord ${proof.id}.signalIds`, { minItems: 1 });
    for (const signalId of proof.signalIds) {
      assert(signals.has(signalId), `proofRecord ${proof.id} references unknown signal ${signalId}`);
    }
  }

  for (const criterion of criteria.values()) {
    assertString(criterion.description, `criterion ${criterion.id}.description`);
    assert(IMPORTANCE_LEVELS.has(criterion.importance), `criterion ${criterion.id} has invalid importance ${criterion.importance}`);
    assertStringArray(criterion.implementationSourceIds, `criterion ${criterion.id}.implementationSourceIds`, { minItems: 1 });
    assertStringArray(criterion.proofRecordIds, `criterion ${criterion.id}.proofRecordIds`, { minItems: 1 });
    for (const sourceId of criterion.implementationSourceIds) {
      assert(sources.has(sourceId), `criterion ${criterion.id} references unknown implementation source ${sourceId}`);
      assert(
        sources.get(sourceId).kind === 'implementation',
        `criterion ${criterion.id} implementation source ${sourceId} must have kind implementation`,
      );
    }
    for (const proofId of criterion.proofRecordIds) {
      assert(proofRecords.has(proofId), `criterion ${criterion.id} references unknown proofRecord ${proofId}`);
    }
  }

  return { sources, signals, proofRecords, criteria };
}

function analyzeSignal(signal, implementationSourceIds, sources) {
  const implementationSet = new Set(implementationSourceIds);
  const derivingSources = signal.sourceDependencies
    .filter(dependency => dependency.role === 'derives')
    .map(dependency => dependency.sourceId)
    .sort((a, b) => a.localeCompare(b));
  const circularSources = derivingSources
    .filter(sourceId => implementationSet.has(sourceId))
    .sort((a, b) => a.localeCompare(b));
  const independentObserverSources = derivingSources
    .filter(sourceId => !implementationSet.has(sourceId))
    .sort((a, b) => a.localeCompare(b));
  const sharedInfrastructureSources = signal.sourceDependencies
    .filter(dependency => dependency.role === 'shared-infrastructure')
    .map(dependency => dependency.sourceId)
    .sort((a, b) => a.localeCompare(b));

  return {
    signalId: signal.id,
    materiality: signal.materiality,
    independent: signal.materiality === 'material' && circularSources.length === 0 && independentObserverSources.length > 0,
    circularSources,
    independentObserverSources,
    sharedInfrastructureSources,
    paths: derivingSources.map(sourceId => ({
      sourceId,
      sourceKind: sources.get(sourceId).kind,
      relationship: implementationSet.has(sourceId) ? 'circular' : 'independent-observer',
    })),
  };
}

export function analyzeEvidenceGraph(graph, { candidateSha = null } = {}) {
  const { sources, signals, proofRecords, criteria } = validateEvidenceGraph(graph);
  if (candidateSha !== null) assert(SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase commit SHA');

  const criterionResults = [];
  let sharedInfrastructureDependencyCount = 0;

  for (const criterion of [...criteria.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const proofResults = [];
    const independentPaths = [];
    const circularPaths = [];

    for (const proofId of criterion.proofRecordIds) {
      const proof = proofRecords.get(proofId);
      const signalResults = proof.signalIds
        .map(signalId => analyzeSignal(signals.get(signalId), criterion.implementationSourceIds, sources))
        .sort((a, b) => a.signalId.localeCompare(b.signalId));
      sharedInfrastructureDependencyCount += signalResults.reduce(
        (sum, result) => sum + result.sharedInfrastructureSources.length,
        0,
      );
      for (const result of signalResults) {
        if (result.independent) independentPaths.push({ proofRecordId: proofId, signalId: result.signalId });
        if (result.materiality === 'material' && result.circularSources.length > 0) {
          circularPaths.push({ proofRecordId: proofId, signalId: result.signalId, sourceIds: result.circularSources });
        }
      }
      proofResults.push({
        proofRecordId: proofId,
        independent: signalResults.some(result => result.independent),
        signals: signalResults,
      });
    }

    const status = independentPaths.length > 0 ? 'independent' : circularPaths.length > 0 ? 'circular' : 'unsupported';
    criterionResults.push({
      criterionId: criterion.id,
      importance: criterion.importance,
      status,
      implementationSourceIds: [...criterion.implementationSourceIds].sort((a, b) => a.localeCompare(b)),
      independentPaths: independentPaths.sort((a, b) => `${a.proofRecordId}:${a.signalId}`.localeCompare(`${b.proofRecordId}:${b.signalId}`)),
      circularPaths: circularPaths.sort((a, b) => `${a.proofRecordId}:${a.signalId}`.localeCompare(`${b.proofRecordId}:${b.signalId}`)),
      proofRecords: proofResults.sort((a, b) => a.proofRecordId.localeCompare(b.proofRecordId)),
    });
  }

  const important = criterionResults.filter(result => result.importance === 'important');
  const failedImportant = important.filter(result => result.status !== 'independent');
  const summary = {
    criteria: criterionResults.length,
    importantCriteria: important.length,
    independentCriteria: criterionResults.filter(result => result.status === 'independent').length,
    circularCriteria: criterionResults.filter(result => result.status === 'circular').length,
    unsupportedCriteria: criterionResults.filter(result => result.status === 'unsupported').length,
    sharedInfrastructureDependencies: sharedInfrastructureDependencyCount,
  };

  return {
    schema: 'ironshade-evidence-independence-report:v1',
    mode: 'advisory',
    candidateSha,
    graphSha256: sha256Value(graph),
    acceptedForEnforcement: failedImportant.length === 0,
    failedImportantCriteria: failedImportant.map(result => result.criterionId),
    summary,
    criteria: criterionResults,
  };
}

export function assertIndependentEvidence(report) {
  assertObject(report, 'evidence independence report');
  assert(report.schema === 'ironshade-evidence-independence-report:v1', 'unsupported evidence independence report schema');
  assert(
    report.acceptedForEnforcement === true,
    `important criteria lack independent evidence: ${(report.failedImportantCriteria ?? []).join(', ') || 'unknown'}`,
  );
  return report;
}

export async function loadEvidenceGraph(path = 'agent/evidence-independence.json') {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const options = {
    graph: 'agent/evidence-independence.json',
    candidateSha: null,
    output: null,
    enforce: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--graph') options.graph = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--enforce') options.enforce = true;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  assertString(options.graph, '--graph');
  const graph = await loadEvidenceGraph(options.graph);
  const report = analyzeEvidenceGraph(graph, { candidateSha: options.candidateSha });
  if (options.output) await writeJson(options.output, report);
  if (options.json) process.stdout.write(canonicalJson(report));
  else {
    console.log(
      `EVIDENCE_INDEPENDENCE_REPORT mode=${report.mode} criteria=${report.summary.criteria} independent=${report.summary.independentCriteria} circular=${report.summary.circularCriteria} acceptedForEnforcement=${report.acceptedForEnforcement}`,
    );
  }
  if (options.enforce) assertIndependentEvidence(report);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
