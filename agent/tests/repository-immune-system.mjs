import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  acceptAntibodyProposal,
  analyzeFailureMemory,
  canonicalJson,
  checkAntibodyRecurrence,
  clusterFailureRecords,
  proposeAntibodies,
  sha256Value,
  validateFailureMemory,
} from '../tools/repository-immune-system.mjs';

function failureRecord({
  id,
  observedOn = '2026-10-09',
  failureClass = 'candidate-artifact-integrity-drift',
  signatureKey = 'candidate-artifact-sha-mismatch',
  affectedDomain = 'candidate-artifact',
  escapeStage = 'downstream-consumer',
  discoveringProofId = 'candidate-artifact-integrity',
  fixClass = 'focused-regression',
  earlierProofKind = 'focused-regression',
  earlierProofId = 'candidate-artifact-integrity',
  detail = `synthetic failure ${id}`,
} = {}) {
  return {
    id,
    observedOn,
    failureClass,
    failureSignature: { kind: 'integrity-mismatch', key: signatureKey },
    rootCause: {
      code: 'stale-candidate-artifact',
      summary: 'A downstream consumer observed an artifact identity that did not match the exact candidate revision.',
    },
    affectedDomain,
    escapeStage,
    discoveringProof: { kind: 'invariant', id: discoveringProofId },
    fixClass,
    earlierProof: {
      kind: earlierProofKind,
      id: earlierProofId,
      gap: 'The reusable candidate artifact should have been rejected before downstream consumption.',
    },
    detail,
  };
}

const records = [
  failureRecord({ id: 'artifact-drift-b', observedOn: '2026-10-09', escapeStage: 'android-consumer' }),
  failureRecord({ id: 'artifact-drift-a', observedOn: '2026-10-08', escapeStage: 'browser-consumer' }),
  failureRecord({
    id: 'impact-miss-a',
    observedOn: '2026-10-07',
    failureClass: 'impact-map-false-negative',
    signatureKey: 'graphics-change-missed-render-verification',
    affectedDomain: 'affected-verification',
    escapeStage: 'full-verification',
    discoveringProofId: 'verify-full',
    fixClass: 'impact-map-rule',
    earlierProofKind: 'impact-map-rule',
    earlierProofId: 'graphics-impact-expansion',
  }),
];

const clustered = clusterFailureRecords(records, { maxSamplesPerClass: 3 });
const reversed = clusterFailureRecords([...records].reverse(), { maxSamplesPerClass: 3 });
assert.deepEqual(reversed, clustered, 'failure clustering must be deterministic regardless of input order');
assert.equal(sha256Value(reversed), sha256Value(clustered), 'deterministic clusters must have the same canonical digest');
assert.deepEqual(clustered.classes.map(entry => entry.failureClass), ['candidate-artifact-integrity-drift', 'impact-map-false-negative'], 'synthetic records must resolve into two stable failure classes');
const repeatedClass = clustered.classes.find(entry => entry.failureClass === 'candidate-artifact-integrity-drift');
assert.equal(repeatedClass.occurrenceCount, 2, 'repeated deterministic failure class must retain its occurrence count');
assert.deepEqual(repeatedClass.escapeStages, ['android-consumer', 'browser-consumer'], 'a compact class must retain the distinct stages where recurrence escaped');

const proposals = proposeAntibodies(clustered);
assert.equal(proposals.length, 1, 'only repeated failure classes should propose permanent antibodies');
const proposal = proposals[0];
assert.equal(proposal.kind, 'focused-regression', 'proposal must name a concrete reusable check kind');
assert.equal(proposal.suggestedCheck.id, 'candidate-artifact-integrity', 'proposal must point at the earlier proof that should catch recurrence');
assert.equal(proposal.reviewRequired, true, 'proposal must require explicit review');
assert.equal(proposal.acceptedForEnforcement, false, 'unreviewed proposal must never be enforceable');

const recurrence = failureRecord({ id: 'artifact-drift-recurrence', observedOn: '2026-10-10' });
assert.throws(
  () => checkAntibodyRecurrence([recurrence], [proposal], { enforce: true }),
  /has not been explicitly accepted and reviewed/,
  'a proposed antibody must not become an enforcement gate without explicit review',
);

const accepted = acceptAntibodyProposal(proposal, {
  decision: 'accept',
  reviewer: 'repository-reviewer',
  reviewedAt: '2026-10-09T16:30:00Z',
  rationale: 'The repeated class has a stable signature and the focused regression directly observes the failure before downstream consumption.',
});
assert.equal(accepted.status, 'accepted', 'reviewed proposal must become an accepted antibody');
assert.equal(accepted.acceptedForEnforcement, true, 'explicit acceptance is required before enforcement');
const recurrenceReport = checkAntibodyRecurrence([recurrence], [accepted]);
assert.equal(recurrenceReport.status, 'fail', 'accepted antibody must catch recurrence of the same deterministic class');
assert.deepEqual(recurrenceReport.matches, [{ recordId: recurrence.id, antibodyId: accepted.id, failureClass: recurrence.failureClass }]);
assert.throws(
  () => checkAntibodyRecurrence([recurrence], [accepted], { enforce: true }),
  /accepted antibody caught recurrence: candidate-artifact-integrity-drift:artifact-drift-recurrence/,
  'accepted antibody enforcement must fail closed on recurrence',
);
const unrelated = failureRecord({
  id: 'unrelated-impact-miss',
  failureClass: 'impact-map-false-negative',
  signatureKey: 'graphics-change-missed-render-verification',
  affectedDomain: 'affected-verification',
  escapeStage: 'full-verification',
  discoveringProofId: 'verify-full',
  fixClass: 'impact-map-rule',
  earlierProofKind: 'impact-map-rule',
  earlierProofId: 'graphics-impact-expansion',
});
assert.equal(checkAntibodyRecurrence([unrelated], [accepted], { enforce: true }).status, 'pass', 'accepted antibody must not reject unrelated failure classes');

const manyRecords = Array.from({ length: 100 }, (_, index) => failureRecord({
  id: `compact-repeat-${String(index).padStart(3, '0')}`,
  observedOn: index < 50 ? '2026-10-08' : '2026-10-09',
  detail: `bounded sample detail ${index}`,
}));
const compact = clusterFailureRecords(manyRecords, { maxSamplesPerClass: 3 });
const compactReverse = clusterFailureRecords([...manyRecords].reverse(), { maxSamplesPerClass: 3 });
assert.deepEqual(compactReverse, compact, 'large repeated classes must compact deterministically');
assert.equal(compact.classes[0].occurrenceCount, 100, 'compaction must retain total occurrence count');
assert.equal(compact.classes[0].sampleOccurrences.length, 3, 'compaction must retain only the configured bounded sample count');
const compactText = canonicalJson(compact);
assert(compactText.length < 7000, 'one hundred repeated failures must remain compact enough for future agents to consume');
assert(!compactText.includes('compact-repeat-099'), 'bounded memory must not replay every historical occurrence');

const repositoryMemory = JSON.parse(await readFile(new URL('../failure-memory.json', import.meta.url), 'utf8'));
validateFailureMemory(repositoryMemory);
const repositoryClass = repositoryMemory.classes.find(entry => entry.failureClass === 'android-screenshot-capture-transport-timeout');
assert(repositoryClass, 'repository failure memory must retain the historical EV-2 API 36 screenshot class');
assert.equal(repositoryClass.occurrenceCount, 2, 'historical API 36 screenshot failure class must record both observed occurrences');
const repositoryReport = analyzeFailureMemory(repositoryMemory, { candidateSha: 'e'.repeat(40) });
assert.equal(repositoryReport.summary.recurringFailureClasses, 1, 'repository memory must identify the repeated historical class');
assert.equal(repositoryReport.proposals.length, 1, 'repository memory must propose one reusable antibody for the repeated historical class');
assert.equal(repositoryReport.proposals[0].kind, 'focused-regression', 'historical screenshot recurrence must propose a focused regression');
assert.equal(repositoryReport.proposals[0].suggestedCheck.id, 'android-screenshot-capture-contract', 'proposal must name the earlier screenshot proof that should catch recurrence');
assert.equal(repositoryReport.acceptedForEnforcement, false, 'repository immune report must remain advisory');
assert.equal(repositoryReport.candidatePassGranted, false, 'repository immune report must never grant candidate acceptance');
assert.equal(repositoryReport.candidateSha, 'e'.repeat(40), 'repository immune evidence must support exact-SHA binding');

console.log(`REPOSITORY_IMMUNE_SYSTEM_PASS clusters=${clustered.classes.length} recurring=${repositoryReport.summary.recurringFailureClasses} proposal=${repositoryReport.proposals[0].kind} review=required recurrence=caught compact=${compact.classes[0].sampleOccurrences.length}/${compact.classes[0].occurrenceCount} advisory=true`);
