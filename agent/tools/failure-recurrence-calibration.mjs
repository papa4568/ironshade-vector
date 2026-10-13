import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson,
  clusterFailureRecords,
  proposeAntibodies,
  sha256Value,
  validateFailureMemory,
  validateFailureRecord,
} from './repository-immune-system.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const GOVERNANCE = new Set(['eligible-for-ev13-review', 'advisory-only']);
const METRIC_KEYS = [
  'overClusteringPairs',
  'underClusteringPairs',
  'recurrenceFalsePositiveRecords',
  'recurrenceFalseNegativeRecords',
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

function assertNonNegativeInteger(value, label) {
  assert(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`);
}

function assertMetricObject(value, label) {
  assertObject(value, label);
  for (const key of METRIC_KEYS) assertNonNegativeInteger(value[key], `${label}.${key}`);
}

function emptyMetrics() {
  return Object.fromEntries(METRIC_KEYS.map(key => [key, 0]));
}

function sameMetrics(left, right) {
  return METRIC_KEYS.every(key => left[key] === right[key]);
}

function classIdentityFromRecord(record) {
  return {
    failureSignature: record.failureSignature,
    rootCause: record.rootCause,
    affectedDomain: record.affectedDomain,
    fixClass: record.fixClass,
    earlierProof: record.earlierProof,
  };
}

function classIdentityFromMemory(entry) {
  return {
    failureSignature: entry.failureSignature,
    rootCause: entry.rootCause,
    affectedDomain: entry.affectedDomain,
    fixClass: entry.fixClass,
    earlierProof: entry.earlierProof,
  };
}

function flattenTruthGroups(corpus) {
  return corpus.truthGroups.flatMap(group => group.records.map(record => ({
    truthId: group.truthId,
    governance: group.governance,
    rationale: group.rationale,
    record,
  })));
}

export function validateFailureRecurrenceCalibrationCorpus(corpus, repositoryMemory) {
  assertObject(corpus, 'failure recurrence calibration corpus');
  assert(corpus.schemaVersion === 1, 'failure recurrence calibration corpus schemaVersion must be 1');
  assert(corpus.mode === 'advisory', 'EV-12 calibration corpus must remain advisory');
  assertNonNegativeInteger(corpus.minRecurrenceCount, 'minRecurrenceCount');
  assert(corpus.minRecurrenceCount >= 2, 'minRecurrenceCount must be at least 2');
  assert(Number.isInteger(corpus.calibrationMaxSamplesPerClass) && corpus.calibrationMaxSamplesPerClass >= 1 && corpus.calibrationMaxSamplesPerClass <= 10, 'calibrationMaxSamplesPerClass must be an integer from 1 to 10');
  assert(Number.isInteger(corpus.calibrationMaxSerializedBytes) && corpus.calibrationMaxSerializedBytes >= 1024, 'calibrationMaxSerializedBytes must be at least 1024');
  assertMetricObject(corpus.eligibleErrorBudget, 'eligibleErrorBudget');
  assertMetricObject(corpus.expectedMeasuredErrors, 'expectedMeasuredErrors');
  assert(Array.isArray(corpus.truthGroups) && corpus.truthGroups.length > 0, 'truthGroups must be a non-empty array');

  const truthIds = new Set();
  const recordIds = new Set();
  for (const [groupIndex, group] of corpus.truthGroups.entries()) {
    const label = `truthGroups[${groupIndex}]`;
    assertObject(group, label);
    assertString(group.truthId, `${label}.truthId`);
    assert(!truthIds.has(group.truthId), `duplicate truthId ${group.truthId}`);
    truthIds.add(group.truthId);
    assert(GOVERNANCE.has(group.governance), `${label}.governance must be eligible-for-ev13-review or advisory-only`);
    assertString(group.rationale, `${label}.rationale`);
    assert(Array.isArray(group.records) && group.records.length > 0, `${label}.records must be non-empty`);
    if (group.governance === 'eligible-for-ev13-review') {
      assert(group.records.length >= corpus.minRecurrenceCount, `${group.truthId} needs at least minRecurrenceCount records before EV-13 governance review`);
    }
    for (const [recordIndex, record] of group.records.entries()) {
      validateFailureRecord(record, `${label}.records[${recordIndex}]`);
      assert(!recordIds.has(record.id), `duplicate calibration record id ${record.id}`);
      recordIds.add(record.id);
    }
  }

  const actualClassCounts = new Map();
  for (const { record } of flattenTruthGroups(corpus)) {
    actualClassCounts.set(record.failureClass, (actualClassCounts.get(record.failureClass) ?? 0) + 1);
  }
  for (const [failureClass, count] of actualClassCounts) {
    assert(count <= corpus.calibrationMaxSamplesPerClass, `calibration class ${failureClass} has ${count} records, exceeding calibrationMaxSamplesPerClass and preventing exact record mapping`);
  }

  assert(Array.isArray(corpus.sourceMemoryBindings), 'sourceMemoryBindings must be an array');
  validateFailureMemory(repositoryMemory);
  for (const [index, binding] of corpus.sourceMemoryBindings.entries()) {
    const label = `sourceMemoryBindings[${index}]`;
    assertObject(binding, label);
    assertString(binding.truthId, `${label}.truthId`);
    assert(truthIds.has(binding.truthId), `${label}.truthId must name a calibration truth group`);
    assertString(binding.failureClass, `${label}.failureClass`);
    assertNonNegativeInteger(binding.minimumHistoricalOccurrences, `${label}.minimumHistoricalOccurrences`);
    assert(binding.minimumHistoricalOccurrences >= 1, `${label}.minimumHistoricalOccurrences must be at least 1`);
  }

  assert(Array.isArray(corpus.rejectionControls) && corpus.rejectionControls.length > 0, 'rejectionControls must be a non-empty array');
  const rejectionIds = new Set();
  for (const [index, control] of corpus.rejectionControls.entries()) {
    const label = `rejectionControls[${index}]`;
    assertObject(control, label);
    assertString(control.id, `${label}.id`);
    assert(!rejectionIds.has(control.id), `duplicate rejection control id ${control.id}`);
    rejectionIds.add(control.id);
    assertString(control.expectedErrorIncludes, `${label}.expectedErrorIncludes`);
    assert(Array.isArray(control.records) && control.records.length >= 2, `${label}.records must contain at least two records`);
    control.records.forEach((record, recordIndex) => validateFailureRecord(record, `${label}.records[${recordIndex}]`));
  }

  assertObject(corpus.compactionProbe, 'compactionProbe');
  assert(Number.isInteger(corpus.compactionProbe.occurrences) && corpus.compactionProbe.occurrences >= 2, 'compactionProbe.occurrences must be at least 2');
  assert(Number.isInteger(corpus.compactionProbe.maxSamplesPerClass) && corpus.compactionProbe.maxSamplesPerClass >= 1 && corpus.compactionProbe.maxSamplesPerClass <= 10, 'compactionProbe.maxSamplesPerClass must be an integer from 1 to 10');
  assert(Number.isInteger(corpus.compactionProbe.maxSerializedBytes) && corpus.compactionProbe.maxSerializedBytes >= 1024, 'compactionProbe.maxSerializedBytes must be at least 1024');
  assert(Number.isInteger(corpus.compactionProbe.rejectSerializedBytes) && corpus.compactionProbe.rejectSerializedBytes >= 1024, 'compactionProbe.rejectSerializedBytes must be at least 1024');
  assert(corpus.compactionProbe.rejectSerializedBytes < corpus.compactionProbe.maxSerializedBytes, 'compactionProbe.rejectSerializedBytes must be smaller than maxSerializedBytes');
  assertObject(corpus.compactionProbe.recordTemplate, 'compactionProbe.recordTemplate');
  validateFailureRecord({ id: 'ev12-compaction-template-validation', ...corpus.compactionProbe.recordTemplate }, 'compactionProbe.recordTemplate');
  return corpus;
}

function buildActualClassMap(memory) {
  const classByRecord = new Map();
  const counts = new Map();
  for (const entry of memory.classes) {
    counts.set(entry.failureClass, entry.occurrenceCount);
    assert(entry.sampleOccurrences.length === entry.occurrenceCount, `calibration class ${entry.failureClass} did not retain every measured record; increase calibrationMaxSamplesPerClass`);
    for (const sample of entry.sampleOccurrences) classByRecord.set(sample.id, entry.failureClass);
  }
  return { classByRecord, counts };
}

function measurePairwise(flat, classByRecord, metrics, issuesByTruth) {
  const cases = [];
  for (let leftIndex = 0; leftIndex < flat.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < flat.length; rightIndex += 1) {
      const left = flat[leftIndex];
      const right = flat[rightIndex];
      const expectedSame = left.truthId === right.truthId;
      const actualSame = classByRecord.get(left.record.id) === classByRecord.get(right.record.id);
      if (expectedSame === actualSame) continue;
      const kind = actualSame ? 'over-clustering' : 'under-clustering';
      const metricKey = actualSame ? 'overClusteringPairs' : 'underClusteringPairs';
      metrics[metricKey] += 1;
      issuesByTruth.get(left.truthId)[metricKey] += 1;
      if (right.truthId !== left.truthId) issuesByTruth.get(right.truthId)[metricKey] += 1;
      cases.push({
        kind,
        leftRecordId: left.record.id,
        rightRecordId: right.record.id,
        leftTruthId: left.truthId,
        rightTruthId: right.truthId,
        actualFailureClass: actualSame ? classByRecord.get(left.record.id) : null,
      });
    }
  }
  return cases;
}

function measureRecurrence(flat, groupsByTruth, classByRecord, classCounts, minRecurrenceCount, metrics, issuesByTruth) {
  const cases = [];
  for (const entry of flat) {
    const expectedRecurring = groupsByTruth.get(entry.truthId).records.length >= minRecurrenceCount;
    const actualClass = classByRecord.get(entry.record.id);
    const actualRecurring = (classCounts.get(actualClass) ?? 0) >= minRecurrenceCount;
    if (expectedRecurring === actualRecurring) continue;
    const kind = actualRecurring ? 'false-positive' : 'false-negative';
    const metricKey = actualRecurring ? 'recurrenceFalsePositiveRecords' : 'recurrenceFalseNegativeRecords';
    metrics[metricKey] += 1;
    issuesByTruth.get(entry.truthId)[metricKey] += 1;
    cases.push({
      kind,
      recordId: entry.record.id,
      truthId: entry.truthId,
      actualFailureClass: actualClass,
      expectedRecurring,
      actualRecurring,
    });
  }
  return cases;
}

function measureEligibleScope(corpus, issuesByTruth) {
  const metrics = emptyMetrics();
  for (const group of corpus.truthGroups) {
    if (group.governance !== 'eligible-for-ev13-review') continue;
    const issues = issuesByTruth.get(group.truthId);
    for (const key of METRIC_KEYS) metrics[key] += issues[key];
  }
  return metrics;
}

function evaluateSourceBindings(corpus, repositoryMemory) {
  return corpus.sourceMemoryBindings.map(binding => {
    const group = corpus.truthGroups.find(entry => entry.truthId === binding.truthId);
    const memoryClass = repositoryMemory.classes.find(entry => entry.failureClass === binding.failureClass);
    const historicalRecords = group.records.filter(record => record.source === 'historical');
    const identityMatches = Boolean(memoryClass)
      && historicalRecords.length > 0
      && historicalRecords.every(record => sha256Value(classIdentityFromRecord(record)) === sha256Value(classIdentityFromMemory(memoryClass)));
    const occurrenceCountMatches = Boolean(memoryClass) && memoryClass.occurrenceCount >= binding.minimumHistoricalOccurrences;
    return {
      truthId: binding.truthId,
      failureClass: binding.failureClass,
      memoryClassFound: Boolean(memoryClass),
      historicalRecords: historicalRecords.length,
      minimumHistoricalOccurrences: binding.minimumHistoricalOccurrences,
      memoryOccurrenceCount: memoryClass?.occurrenceCount ?? 0,
      identityMatches,
      occurrenceCountMatches,
      pass: Boolean(memoryClass) && identityMatches && occurrenceCountMatches,
    };
  });
}

function runRejectionControls(corpus) {
  return corpus.rejectionControls.map(control => {
    let error = null;
    try {
      clusterFailureRecords(control.records, {
        maxSamplesPerClass: corpus.calibrationMaxSamplesPerClass,
        maxSerializedBytes: corpus.calibrationMaxSerializedBytes,
      });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    return {
      id: control.id,
      expectedErrorIncludes: control.expectedErrorIncludes,
      observedError: error,
      pass: typeof error === 'string' && error.includes(control.expectedErrorIncludes),
    };
  });
}

function buildCompactionRecords(probe) {
  return Array.from({ length: probe.occurrences }, (_, index) => ({
    id: `ev12-compact-${String(index).padStart(3, '0')}`,
    ...structuredClone(probe.recordTemplate),
    observedOn: index < Math.ceil(probe.occurrences / 2) ? '2026-10-12' : '2026-10-13',
    detail: `EV-12 bounded compaction occurrence ${index}`,
  }));
}

function measureCompaction(corpus) {
  const probe = corpus.compactionProbe;
  const records = buildCompactionRecords(probe);
  const options = {
    maxSamplesPerClass: probe.maxSamplesPerClass,
    maxSerializedBytes: probe.maxSerializedBytes,
  };
  const forward = clusterFailureRecords(records, options);
  const reverse = clusterFailureRecords([...records].reverse(), options);
  const deterministic = canonicalJson(forward) === canonicalJson(reverse);
  const entry = forward.classes[0];
  const compactBytes = Buffer.byteLength(canonicalJson(forward), 'utf8');
  let rejectBudgetError = null;
  try {
    clusterFailureRecords(records, {
      maxSamplesPerClass: probe.maxSamplesPerClass,
      maxSerializedBytes: probe.rejectSerializedBytes,
    });
  } catch (caught) {
    rejectBudgetError = caught instanceof Error ? caught.message : String(caught);
  }
  const rejectBudgetPass = typeof rejectBudgetError === 'string' && rejectBudgetError.includes('exceeds maxSerializedBytes');
  const pass = deterministic
    && forward.classes.length === 1
    && entry.occurrenceCount === probe.occurrences
    && entry.sampleOccurrences.length === probe.maxSamplesPerClass
    && compactBytes <= probe.maxSerializedBytes
    && rejectBudgetPass;
  return {
    occurrences: probe.occurrences,
    retainedSamples: entry.sampleOccurrences.length,
    maxSamplesPerClass: probe.maxSamplesPerClass,
    compactBytes,
    maxSerializedBytes: probe.maxSerializedBytes,
    deterministic,
    forwardDigest: sha256Value(forward),
    reverseDigest: sha256Value(reverse),
    rejectSerializedBytes: probe.rejectSerializedBytes,
    rejectBudgetPass,
    pass,
  };
}

export function runFailureRecurrenceCalibration(corpus, repositoryMemory, { candidateSha } = {}) {
  validateFailureRecurrenceCalibrationCorpus(corpus, repositoryMemory);
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');

  const sourceMemoryBefore = canonicalJson(repositoryMemory);
  const flat = flattenTruthGroups(corpus);
  const groupsByTruth = new Map(corpus.truthGroups.map(group => [group.truthId, group]));
  const measuredMemory = clusterFailureRecords(flat.map(entry => entry.record), {
    maxSamplesPerClass: corpus.calibrationMaxSamplesPerClass,
    maxSerializedBytes: corpus.calibrationMaxSerializedBytes,
  });
  const { classByRecord, counts: classCounts } = buildActualClassMap(measuredMemory);
  const measuredErrors = emptyMetrics();
  const issuesByTruth = new Map(corpus.truthGroups.map(group => [group.truthId, emptyMetrics()]));
  const pairwiseCases = measurePairwise(flat, classByRecord, measuredErrors, issuesByTruth);
  const recurrenceCases = measureRecurrence(
    flat,
    groupsByTruth,
    classByRecord,
    classCounts,
    corpus.minRecurrenceCount,
    measuredErrors,
    issuesByTruth,
  );
  const eligibleMetrics = measureEligibleScope(corpus, issuesByTruth);
  const sourceMemoryBindings = evaluateSourceBindings(corpus, repositoryMemory);
  const rejectionControls = runRejectionControls(corpus);
  const compaction = measureCompaction(corpus);
  const proposals = proposeAntibodies(measuredMemory);

  const stableForGovernance = corpus.truthGroups
    .filter(group => group.governance === 'eligible-for-ev13-review')
    .filter(group => group.records.length >= corpus.minRecurrenceCount)
    .filter(group => METRIC_KEYS.every(key => issuesByTruth.get(group.truthId)[key] === 0))
    .map(group => ({
      truthId: group.truthId,
      failureClasses: [...new Set(group.records.map(record => record.failureClass))].sort((a, b) => a.localeCompare(b)),
      measuredOccurrences: group.records.length,
      rationale: group.rationale,
      status: 'eligible-for-ev13-review',
    }))
    .sort((a, b) => a.truthId.localeCompare(b.truthId));

  const stableIds = new Set(stableForGovernance.map(entry => entry.truthId));
  const advisoryOnly = corpus.truthGroups
    .filter(group => !stableIds.has(group.truthId))
    .map(group => ({
      truthId: group.truthId,
      declaredGovernance: group.governance,
      rationale: group.rationale,
      measuredIssues: issuesByTruth.get(group.truthId),
      status: 'advisory-only',
    }))
    .sort((a, b) => a.truthId.localeCompare(b.truthId));

  const expectedEligibleCount = corpus.truthGroups.filter(group => group.governance === 'eligible-for-ev13-review').length;
  const expectedErrorsMatch = sameMetrics(measuredErrors, corpus.expectedMeasuredErrors);
  const eligibleWithinBudget = METRIC_KEYS.every(key => eligibleMetrics[key] <= corpus.eligibleErrorBudget[key]);
  const sourceMemoryUnchanged = canonicalJson(repositoryMemory) === sourceMemoryBefore;
  const calibrationPass = expectedErrorsMatch
    && eligibleWithinBudget
    && stableForGovernance.length === expectedEligibleCount
    && sourceMemoryBindings.every(entry => entry.pass)
    && rejectionControls.every(entry => entry.pass)
    && compaction.pass
    && sourceMemoryUnchanged;

  return {
    schema: 'ironshade-failure-recurrence-calibration:v1',
    mode: 'advisory',
    blocking: false,
    candidateSha,
    corpusSha256: sha256Value(corpus),
    sourceFailureMemorySha256: sha256Value(repositoryMemory),
    measuredMemorySha256: sha256Value(measuredMemory),
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    minRecurrenceCount: corpus.minRecurrenceCount,
    calibrationPass,
    measuredErrors,
    expectedMeasuredErrors: structuredClone(corpus.expectedMeasuredErrors),
    expectedErrorsMatch,
    eligibleScope: {
      errorBudget: structuredClone(corpus.eligibleErrorBudget),
      measuredErrors: eligibleMetrics,
      withinBudget: eligibleWithinBudget,
      stableForGovernance,
    },
    advisoryOnly,
    pairwiseCases,
    recurrenceCases,
    sourceMemoryBindings,
    rejectionControls,
    compaction,
    proposalFailureClasses: proposals.map(proposal => ({
      failureClass: proposal.sourceFailureClass,
      proposalId: proposal.id,
      acceptedForEnforcement: proposal.acceptedForEnforcement,
    })),
    rollback: {
      sourceFailureMemoryUnchanged,
      ev4ModeRemainsAdvisory: repositoryMemory.mode === 'advisory',
      enforcementChanged: false,
      disablePath: 'Remove the EV-12 calibration workflow and calibration-only corpus/tool/tests; EV-4 failure memory and antibody semantics remain unchanged.',
    },
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
    corpus: 'agent/failure-recurrence-calibration-corpus.json',
    memory: 'agent/failure-memory.json',
    output: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--corpus') options.corpus = argv[++index] ?? null;
    else if (argument === '--memory') options.memory = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [corpus, memory] = await Promise.all([readJson(options.corpus), readJson(options.memory)]);
  const report = runFailureRecurrenceCalibration(corpus, memory, { candidateSha: options.candidateSha });
  if (options.output) await writeJson(options.output, report);
  if (options.json) process.stdout.write(canonicalJson(report));
  else console.log(`FAILURE_RECURRENCE_CALIBRATION mode=${report.mode} blocking=${report.blocking} candidate=${report.candidateSha} pass=${report.calibrationPass} over=${report.measuredErrors.overClusteringPairs} under=${report.measuredErrors.underClusteringPairs} recurrenceFp=${report.measuredErrors.recurrenceFalsePositiveRecords} recurrenceFn=${report.measuredErrors.recurrenceFalseNegativeRecords} eligible=${report.eligibleScope.stableForGovernance.map(entry => entry.truthId).join(',')}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
