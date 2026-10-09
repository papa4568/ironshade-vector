import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHECK_KINDS = new Set([
  'architecture-invariant',
  'impact-map-rule',
  'focused-regression',
  'telemetry-check',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertDate(value, label) {
  assertString(value, label);
  assert(DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), `${label} must be YYYY-MM-DD`);
}

function assertIsoInstant(value, label) {
  assertString(value, label);
  assert(!Number.isNaN(Date.parse(value)) && /T/.test(value), `${label} must be an ISO date-time`);
}

function assertCheckKind(value, label) {
  assert(CHECK_KINDS.has(value), `${label} must be one of ${[...CHECK_KINDS].join(', ')}`);
}

export function normalizeObject(value) {
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

function validateProof(proof, label) {
  assertObject(proof, label);
  assertString(proof.kind, `${label}.kind`);
  assertString(proof.id, `${label}.id`);
}

function validateEarlierProof(proof, label) {
  assertObject(proof, label);
  assertCheckKind(proof.kind, `${label}.kind`);
  assertString(proof.id, `${label}.id`);
  assertString(proof.gap, `${label}.gap`);
}

export function validateFailureRecord(record, label = 'failure record') {
  assertObject(record, label);
  assertString(record.id, `${label}.id`);
  assertDate(record.observedOn, `${label}.observedOn`);
  assertString(record.failureClass, `${label}.failureClass`);
  assertObject(record.failureSignature, `${label}.failureSignature`);
  assertString(record.failureSignature.kind, `${label}.failureSignature.kind`);
  assertString(record.failureSignature.key, `${label}.failureSignature.key`);
  assertObject(record.rootCause, `${label}.rootCause`);
  assertString(record.rootCause.code, `${label}.rootCause.code`);
  assertString(record.rootCause.summary, `${label}.rootCause.summary`);
  assertString(record.affectedDomain, `${label}.affectedDomain`);
  assertString(record.escapeStage, `${label}.escapeStage`);
  validateProof(record.discoveringProof, `${label}.discoveringProof`);
  assertCheckKind(record.fixClass, `${label}.fixClass`);
  validateEarlierProof(record.earlierProof, `${label}.earlierProof`);
  if (record.detail !== undefined) assertString(record.detail, `${label}.detail`);
  return record;
}

function classIdentity(record) {
  return {
    failureSignature: record.failureSignature,
    rootCause: record.rootCause,
    affectedDomain: record.affectedDomain,
    fixClass: record.fixClass,
    earlierProof: record.earlierProof,
  };
}

function proofKey(proof) {
  return `${proof.kind}:${proof.id}`;
}

export function clusterFailureRecords(records, { maxSamplesPerClass = 3 } = {}) {
  assert(Array.isArray(records), 'failure records must be an array');
  assert(Number.isInteger(maxSamplesPerClass) && maxSamplesPerClass >= 1 && maxSamplesPerClass <= 10, 'maxSamplesPerClass must be an integer from 1 to 10');
  const seenIds = new Set();
  const sorted = records.map((record, index) => validateFailureRecord(record, `failure record[${index}]`)).sort((a, b) =>
    `${a.failureClass}:${a.observedOn}:${a.id}`.localeCompare(`${b.failureClass}:${b.observedOn}:${b.id}`),
  );
  for (const record of sorted) {
    assert(!seenIds.has(record.id), `duplicate failure record id ${record.id}`);
    seenIds.add(record.id);
  }

  const grouped = new Map();
  for (const record of sorted) {
    const group = grouped.get(record.failureClass) ?? [];
    group.push(record);
    grouped.set(record.failureClass, group);
  }

  const classes = [];
  for (const failureClass of [...grouped.keys()].sort((a, b) => a.localeCompare(b))) {
    const group = grouped.get(failureClass);
    const identity = classIdentity(group[0]);
    const identityDigest = sha256Value(identity);
    for (const record of group.slice(1)) {
      assert(
        sha256Value(classIdentity(record)) === identityDigest,
        `failure class ${failureClass} contains incompatible classification fields; split the failure class instead of over-clustering`,
      );
    }
    const escapeStages = [...new Set(group.map(record => record.escapeStage))].sort((a, b) => a.localeCompare(b));
    const proofMap = new Map();
    for (const record of group) proofMap.set(proofKey(record.discoveringProof), record.discoveringProof);
    const discoveringProofs = [...proofMap.values()].sort((a, b) => proofKey(a).localeCompare(proofKey(b)));
    const sampleOccurrences = group.slice(0, maxSamplesPerClass).map(record => ({
      id: record.id,
      observedOn: record.observedOn,
      escapeStage: record.escapeStage,
      discoveringProofId: record.discoveringProof.id,
      ...(record.detail ? { detail: record.detail } : {}),
    }));
    classes.push({
      failureClass,
      occurrenceCount: group.length,
      firstObservedOn: group[0].observedOn,
      lastObservedOn: group[group.length - 1].observedOn,
      failureSignature: identity.failureSignature,
      rootCause: identity.rootCause,
      affectedDomain: identity.affectedDomain,
      escapeStages,
      discoveringProofs,
      fixClass: identity.fixClass,
      earlierProof: identity.earlierProof,
      sampleOccurrences,
    });
  }

  return {
    $schema: './failure-memory.schema.json',
    schemaVersion: 1,
    mode: 'advisory',
    maxSamplesPerClass,
    classes,
  };
}

export function validateFailureMemory(memory) {
  assertObject(memory, 'failure memory');
  assert(memory.schemaVersion === 1, 'failure memory schemaVersion must be 1');
  assert(memory.mode === 'advisory', 'failure memory mode must remain advisory until promoted');
  assert(Number.isInteger(memory.maxSamplesPerClass) && memory.maxSamplesPerClass >= 1 && memory.maxSamplesPerClass <= 10, 'failure memory maxSamplesPerClass must be an integer from 1 to 10');
  assert(Array.isArray(memory.classes), 'failure memory classes must be an array');
  const classNames = new Set();
  let previousClass = null;
  for (const [index, entry] of memory.classes.entries()) {
    const label = `failure memory class[${index}]`;
    assertObject(entry, label);
    assertString(entry.failureClass, `${label}.failureClass`);
    assert(!classNames.has(entry.failureClass), `duplicate failure class ${entry.failureClass}`);
    classNames.add(entry.failureClass);
    if (previousClass !== null) assert(previousClass.localeCompare(entry.failureClass) < 0, 'failure memory classes must be sorted by failureClass');
    previousClass = entry.failureClass;
    assert(Number.isInteger(entry.occurrenceCount) && entry.occurrenceCount >= 1, `${label}.occurrenceCount must be a positive integer`);
    assertDate(entry.firstObservedOn, `${label}.firstObservedOn`);
    assertDate(entry.lastObservedOn, `${label}.lastObservedOn`);
    assert(entry.firstObservedOn <= entry.lastObservedOn, `${label} firstObservedOn must not follow lastObservedOn`);
    assertObject(entry.failureSignature, `${label}.failureSignature`);
    assertString(entry.failureSignature.kind, `${label}.failureSignature.kind`);
    assertString(entry.failureSignature.key, `${label}.failureSignature.key`);
    assertObject(entry.rootCause, `${label}.rootCause`);
    assertString(entry.rootCause.code, `${label}.rootCause.code`);
    assertString(entry.rootCause.summary, `${label}.rootCause.summary`);
    assertString(entry.affectedDomain, `${label}.affectedDomain`);
    assert(Array.isArray(entry.escapeStages) && entry.escapeStages.length > 0, `${label}.escapeStages must be a non-empty array`);
    assert(new Set(entry.escapeStages).size === entry.escapeStages.length, `${label}.escapeStages must not contain duplicates`);
    entry.escapeStages.forEach((stage, stageIndex) => assertString(stage, `${label}.escapeStages[${stageIndex}]`));
    assert(Array.isArray(entry.discoveringProofs) && entry.discoveringProofs.length > 0, `${label}.discoveringProofs must be a non-empty array`);
    const proofKeys = new Set();
    for (const [proofIndex, proof] of entry.discoveringProofs.entries()) {
      validateProof(proof, `${label}.discoveringProofs[${proofIndex}]`);
      const key = proofKey(proof);
      assert(!proofKeys.has(key), `${label}.discoveringProofs must not contain duplicates`);
      proofKeys.add(key);
    }
    assertCheckKind(entry.fixClass, `${label}.fixClass`);
    validateEarlierProof(entry.earlierProof, `${label}.earlierProof`);
    assert(Array.isArray(entry.sampleOccurrences), `${label}.sampleOccurrences must be an array`);
    assert(entry.sampleOccurrences.length <= memory.maxSamplesPerClass, `${label}.sampleOccurrences exceeds maxSamplesPerClass`);
    assert(entry.sampleOccurrences.length <= entry.occurrenceCount, `${label}.sampleOccurrences cannot exceed occurrenceCount`);
    const sampleIds = new Set();
    for (const [sampleIndex, sample] of entry.sampleOccurrences.entries()) {
      const sampleLabel = `${label}.sampleOccurrences[${sampleIndex}]`;
      assertObject(sample, sampleLabel);
      assertString(sample.id, `${sampleLabel}.id`);
      assert(!sampleIds.has(sample.id), `${label} has duplicate sample id ${sample.id}`);
      sampleIds.add(sample.id);
      assertDate(sample.observedOn, `${sampleLabel}.observedOn`);
      assertString(sample.escapeStage, `${sampleLabel}.escapeStage`);
      assertString(sample.discoveringProofId, `${sampleLabel}.discoveringProofId`);
      if (sample.detail !== undefined) assertString(sample.detail, `${sampleLabel}.detail`);
    }
  }
  return memory;
}

function targetForKind(kind) {
  if (kind === 'architecture-invariant') return 'agent architecture invariant contract';
  if (kind === 'impact-map-rule') return 'agent/impact-map.json';
  if (kind === 'telemetry-check') return 'runtime/verification telemetry contract';
  return 'focused regression suite';
}

export function proposeAntibodies(memory) {
  validateFailureMemory(memory);
  return memory.classes
    .filter(entry => entry.occurrenceCount >= 2)
    .map(entry => ({
      schema: 'ironshade-antibody-proposal:v1',
      id: `antibody-${entry.failureClass}`,
      status: 'proposed',
      reviewRequired: true,
      acceptedForEnforcement: false,
      kind: entry.earlierProof.kind,
      affectedDomain: entry.affectedDomain,
      sourceFailureClass: entry.failureClass,
      sourceOccurrenceCount: entry.occurrenceCount,
      matcher: {
        failureClass: entry.failureClass,
        failureSignature: entry.failureSignature,
      },
      suggestedCheck: {
        kind: entry.earlierProof.kind,
        id: entry.earlierProof.id,
        target: targetForKind(entry.earlierProof.kind),
        contract: `Reject recurrence of ${entry.failureClass} with signature ${entry.failureSignature.key}.`,
        closesGap: entry.earlierProof.gap,
      },
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function validateProposal(proposal) {
  assertObject(proposal, 'antibody proposal');
  assert(proposal.schema === 'ironshade-antibody-proposal:v1', 'unsupported antibody proposal schema');
  assertString(proposal.id, 'antibody proposal.id');
  assertCheckKind(proposal.kind, 'antibody proposal.kind');
  assertString(proposal.sourceFailureClass, 'antibody proposal.sourceFailureClass');
  assertObject(proposal.matcher, 'antibody proposal.matcher');
  assertString(proposal.matcher.failureClass, 'antibody proposal.matcher.failureClass');
  assertObject(proposal.matcher.failureSignature, 'antibody proposal.matcher.failureSignature');
  assertString(proposal.matcher.failureSignature.kind, 'antibody proposal.matcher.failureSignature.kind');
  assertString(proposal.matcher.failureSignature.key, 'antibody proposal.matcher.failureSignature.key');
  assertObject(proposal.suggestedCheck, 'antibody proposal.suggestedCheck');
  assertString(proposal.suggestedCheck.id, 'antibody proposal.suggestedCheck.id');
  return proposal;
}

export function acceptAntibodyProposal(proposal, review) {
  validateProposal(proposal);
  assert(proposal.status === 'proposed', 'only a proposed antibody can be accepted');
  assert(proposal.reviewRequired === true && proposal.acceptedForEnforcement === false, 'proposal must require explicit review before acceptance');
  assertObject(review, 'antibody review');
  assert(review.decision === 'accept', 'antibody review decision must be accept');
  assertString(review.reviewer, 'antibody review.reviewer');
  assertIsoInstant(review.reviewedAt, 'antibody review.reviewedAt');
  assertString(review.rationale, 'antibody review.rationale');
  return {
    ...proposal,
    status: 'accepted',
    acceptedForEnforcement: true,
    review: {
      decision: review.decision,
      reviewer: review.reviewer,
      reviewedAt: review.reviewedAt,
      rationale: review.rationale,
    },
  };
}

function matchesAntibody(record, antibody) {
  return record.failureClass === antibody.matcher.failureClass
    && record.failureSignature.kind === antibody.matcher.failureSignature.kind
    && record.failureSignature.key === antibody.matcher.failureSignature.key;
}

export function checkAntibodyRecurrence(records, antibodies, { enforce = false } = {}) {
  assert(Array.isArray(records), 'recurrence records must be an array');
  assert(Array.isArray(antibodies), 'antibodies must be an array');
  const validatedRecords = records.map((record, index) => validateFailureRecord(record, `recurrence record[${index}]`));
  const accepted = [];
  for (const antibody of antibodies) {
    validateProposal(antibody);
    if (antibody.status !== 'accepted' || antibody.acceptedForEnforcement !== true) {
      if (enforce) throw new Error(`antibody proposal ${antibody.id} has not been explicitly accepted and reviewed`);
      continue;
    }
    assertObject(antibody.review, `accepted antibody ${antibody.id}.review`);
    assert(antibody.review.decision === 'accept', `accepted antibody ${antibody.id} must retain an accept review decision`);
    assertString(antibody.review.reviewer, `accepted antibody ${antibody.id}.review.reviewer`);
    assertIsoInstant(antibody.review.reviewedAt, `accepted antibody ${antibody.id}.review.reviewedAt`);
    accepted.push(antibody);
  }
  const matches = [];
  for (const record of validatedRecords) {
    for (const antibody of accepted) {
      if (matchesAntibody(record, antibody)) matches.push({ recordId: record.id, antibodyId: antibody.id, failureClass: record.failureClass });
    }
  }
  const report = {
    schema: 'ironshade-antibody-recurrence-report:v1',
    checkedRecords: validatedRecords.length,
    acceptedAntibodies: accepted.map(entry => entry.id).sort((a, b) => a.localeCompare(b)),
    matches: matches.sort((a, b) => `${a.antibodyId}:${a.recordId}`.localeCompare(`${b.antibodyId}:${b.recordId}`)),
    status: matches.length > 0 ? 'fail' : 'pass',
  };
  if (enforce && matches.length > 0) {
    throw new Error(`accepted antibody caught recurrence: ${matches.map(match => `${match.failureClass}:${match.recordId}`).join(', ')}`);
  }
  return report;
}

export function analyzeFailureMemory(memory, { candidateSha = null } = {}) {
  validateFailureMemory(memory);
  if (candidateSha !== null) assert(SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase commit SHA');
  const proposals = proposeAntibodies(memory);
  const occurrences = memory.classes.reduce((sum, entry) => sum + entry.occurrenceCount, 0);
  const retainedSamples = memory.classes.reduce((sum, entry) => sum + entry.sampleOccurrences.length, 0);
  return {
    schema: 'ironshade-repository-immune-report:v1',
    mode: 'advisory',
    candidateSha,
    memorySha256: sha256Value(memory),
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    summary: {
      failureClasses: memory.classes.length,
      recurringFailureClasses: memory.classes.filter(entry => entry.occurrenceCount >= 2).length,
      occurrences,
      retainedSamples,
      maxSamplesPerClass: memory.maxSamplesPerClass,
      compactBytes: Buffer.byteLength(canonicalJson(memory), 'utf8'),
      antibodyProposals: proposals.length,
    },
    proposals,
  };
}

export async function loadFailureMemory(path = 'agent/failure-memory.json') {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function writeJson(path, value) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, canonicalJson(value), 'utf8');
}

function parseArguments(argv) {
  const command = argv[0];
  const options = { memory: 'agent/failure-memory.json', output: null, candidateSha: null, json: false };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--memory') options.memory = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument ${argument}`);
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command !== 'analyze') throw new Error('usage: repository-immune-system.mjs analyze [--memory path] [--candidate-sha sha] [--output path] [--json]');
  assertString(options.memory, '--memory');
  const memory = await loadFailureMemory(options.memory);
  const report = analyzeFailureMemory(memory, { candidateSha: options.candidateSha });
  if (options.output) await writeJson(options.output, report);
  if (options.json) process.stdout.write(canonicalJson(report));
  else console.log(`REPOSITORY_IMMUNE_REPORT classes=${report.summary.failureClasses} recurring=${report.summary.recurringFailureClasses} proposals=${report.summary.antibodyProposals} retained=${report.summary.retainedSamples}/${report.summary.occurrences} advisory=${!report.acceptedForEnforcement}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
