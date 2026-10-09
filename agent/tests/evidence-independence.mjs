import assert from 'node:assert/strict';

import {
  analyzeEvidenceGraph,
  assertIndependentEvidence,
  loadEvidenceGraph,
  sha256Value,
  validateEvidenceGraph,
} from '../tools/evidence-independence.mjs';
import {
  buildCandidateManifest,
  buildVerificationLedger,
  validateVerificationLedger,
} from '../tools/candidate-evidence.mjs';

const HEAD_SHA = '2222222222222222222222222222222222222222';
const BASE_SHA = '1111111111111111111111111111111111111111';

function graphWithSignalDependencies(sourceDependencies) {
  return {
    $schema: './evidence-independence.schema.json',
    schemaVersion: 1,
    mode: 'advisory',
    sources: [
      { id: 'implementation', kind: 'implementation', path: 'src/implementation.ts' },
      { id: 'observer', kind: 'observer', path: 'tests/observer.mjs' },
      { id: 'runner', kind: 'shared-infrastructure', path: 'node' },
    ],
    signals: [
      {
        id: 'observed-state',
        description: 'A material state observation.',
        materiality: 'material',
        sourceDependencies,
      },
    ],
    proofRecords: [
      {
        id: 'proof',
        description: 'Representative proof record.',
        signalIds: ['observed-state'],
      },
    ],
    criteria: [
      {
        id: 'criterion',
        description: 'Representative important acceptance criterion.',
        importance: 'important',
        implementationSourceIds: ['implementation'],
        proofRecordIds: ['proof'],
      },
    ],
  };
}

const circularGraph = graphWithSignalDependencies([
  { sourceId: 'implementation', role: 'derives' },
  { sourceId: 'runner', role: 'shared-infrastructure' },
]);
const circularReport = analyzeEvidenceGraph(circularGraph, { candidateSha: HEAD_SHA });
assert.equal(circularReport.acceptedForEnforcement, false);
assert.equal(circularReport.summary.circularCriteria, 1);
assert.deepEqual(circularReport.failedImportantCriteria, ['criterion']);
assert.deepEqual(circularReport.criteria[0].circularPaths[0].sourceIds, ['implementation']);
assert.throws(
  () => assertIndependentEvidence(circularReport),
  /important criteria lack independent evidence: criterion/,
  'a material observation derived from the implementation under test must be rejected for enforcement',
);

const independentGraph = graphWithSignalDependencies([
  { sourceId: 'observer', role: 'derives' },
  { sourceId: 'runner', role: 'shared-infrastructure' },
]);
const firstIndependentReport = analyzeEvidenceGraph(independentGraph, { candidateSha: HEAD_SHA });
const secondIndependentReport = analyzeEvidenceGraph(structuredClone(independentGraph), { candidateSha: HEAD_SHA });
assert.deepEqual(secondIndependentReport, firstIndependentReport, 'unchanged evidence graphs must analyze deterministically');
assert.equal(firstIndependentReport.acceptedForEnforcement, true);
assert.equal(firstIndependentReport.summary.independentCriteria, 1);
assert.equal(firstIndependentReport.summary.sharedInfrastructureDependencies, 1);
assert.deepEqual(firstIndependentReport.criteria[0].proofRecords[0].signals[0].sharedInfrastructureSources, ['runner']);
assert.doesNotThrow(() => assertIndependentEvidence(firstIndependentReport));

const mislabeledInfrastructure = graphWithSignalDependencies([
  { sourceId: 'observer', role: 'shared-infrastructure' },
]);
assert.throws(
  () => validateEvidenceGraph(mislabeledInfrastructure),
  /marks non-infrastructure source observer as shared infrastructure/,
  'shared-infrastructure exemptions must not be usable to disguise an observer or implementation dependency',
);

const repositoryGraph = await loadEvidenceGraph('agent/evidence-independence.json');
const repositoryReport = analyzeEvidenceGraph(repositoryGraph, { candidateSha: HEAD_SHA });
assert.equal(repositoryReport.mode, 'advisory');
assert.equal(repositoryReport.summary.criteria, 2);
assert.equal(repositoryReport.summary.independentCriteria, 1);
assert.equal(repositoryReport.summary.circularCriteria, 1);
assert.equal(repositoryReport.acceptedForEnforcement, false, 'the initial repository graph must remain advisory while a circular proof is visible');
assert.match(repositoryReport.graphSha256, /^[a-f0-9]{64}$/);

const fixtureTask = {
  id: 'EV-2-FIXTURE',
  title: 'Causal evidence compatibility fixture',
  acceptance: ['independence evidence can be attached without replacing exact-SHA proof validation'],
  affectedDomains: ['verification'],
  proofs: [
    {
      id: 'fixture-test',
      kind: 'test',
      required: true,
      description: 'Fixture test passes.',
      command: 'node agent/tests/evidence-independence.mjs',
    },
  ],
};
const fixtureImpact = {
  mode: 'targeted',
  escalated: false,
  domains: ['verification'],
  verifications: [{ id: 'agent-orchestration' }],
  unknownFiles: [],
  escalationReasons: [],
};
const manifest = buildCandidateManifest({
  repository: 'papa4568/ironshade-vector',
  task: fixtureTask,
  taskSource: 'fixture',
  baseSha: BASE_SHA,
  headSha: HEAD_SHA,
  branch: 'fixture/ev-2',
  changedFiles: ['agent/evidence-independence.json'],
  impactSelection: fixtureImpact,
});
const independenceArtifact = {
  name: 'causal-evidence-independence-report.json',
  kind: 'evidence-independence',
  candidateSha: HEAD_SHA,
  sha256: sha256Value(repositoryReport),
  location: 'github-actions://run/12345/causal-evidence-independence',
};
const ledger = buildVerificationLedger({
  manifest,
  passedKinds: ['test'],
  workflow: 'Agent Orchestration',
  runId: 12345,
  job: 'validate-agent-orchestration',
  artifacts: [independenceArtifact],
});
const ledgerSummary = validateVerificationLedger(manifest, ledger);
assert.equal(ledgerSummary.complete, true);
assert.equal(ledgerSummary.artifactCount, 1);

const wrongCandidateLedger = structuredClone(ledger);
wrongCandidateLedger.artifacts[0].candidateSha = '3333333333333333333333333333333333333333';
assert.throws(
  () => validateVerificationLedger(manifest, wrongCandidateLedger),
  /artifact causal-evidence-independence-report.json is for a different candidate SHA/,
  'independence evidence must retain the candidate ledger exact-SHA binding',
);

console.log(`EVIDENCE_INDEPENDENCE_REGRESSIONS_PASS circularRejected=${circularReport.summary.circularCriteria} independentAccepted=${firstIndependentReport.summary.independentCriteria} sharedInfrastructureDistinguished=${firstIndependentReport.summary.sharedInfrastructureDependencies} repositoryAdvisory=${!repositoryReport.acceptedForEnforcement} candidateReference=exact-sha`);
