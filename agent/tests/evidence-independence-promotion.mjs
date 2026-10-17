import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  analyzeEvidenceGraph,
  loadEvidenceGraph,
} from '../tools/evidence-independence.mjs';
import {
  buildEvidenceIndependenceDecision,
  runEvidenceIndependenceCalibration,
  validateEvidenceIndependencePolicy,
} from '../tools/evidence-independence-gate.mjs';
import { calibratePrCandidateBuildSurface } from '../tools/pr-candidate-build-surface.mjs';

const HEAD_SHA = '5555555555555555555555555555555555555555';

const graph = await loadEvidenceGraph('agent/evidence-independence.json');
const policy = JSON.parse(await readFile('agent/evidence-independence-policy.json', 'utf8'));
const trustedObserverWorkflow = await readFile('.github/workflows/ev9-trusted-pr-candidate-observer.yml', 'utf8');
const scope = validateEvidenceIndependencePolicy(policy, graph);
assert.deepEqual(scope.enforcedCriterionIds, ['candidate-workflows-use-exact-pr-head']);
assert.deepEqual(scope.excludedImportantCriteria.map(entry => entry.criterionId), ['candidate-evidence-rejects-cross-sha-proof']);
assert.match(scope.excludedImportantCriteria[0].reason, /circular/i);

assert.match(
  trustedObserverWorkflow,
  /verify-pr-candidate:[\s\S]*if: github\.event_name == 'pull_request_target'[\s\S]*ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}[\s\S]*persist-credentials: false/,
  'trusted PR-candidate observation must execute from the exact trusted base without persisted credentials',
);
assert.match(
  trustedObserverWorkflow,
  /Fetch candidate object as untrusted data[\s\S]*git fetch --no-tags --force origin "pull\/\$\{PR_NUMBER\}\/head"[\s\S]*test "\$\(git rev-parse HEAD\)" = "\$\{\{ github\.event\.pull_request\.base\.sha \}\}"/,
  'trusted observer bootstrap must fetch the candidate only as data and keep HEAD pinned to trusted base',
);

const calibration = runEvidenceIndependenceCalibration();
assert.equal(calibration.pass, true);
assert.equal(calibration.cases.length, 4);
assert.equal(calibration.stabilityMismatches, 0);
assert.equal(calibration.classificationMismatches, 0);
assert.equal(calibration.falsePositiveTrials, 2);
assert.equal(calibration.falsePositives, 0);
assert.equal(calibration.falsePositiveRate, 0);
assert.equal(calibration.falseNegativeTrials, 2);
assert.equal(calibration.falseNegatives, 0);
assert.equal(calibration.falseNegativeRate, 0);
assert.deepEqual(
  Object.fromEntries(calibration.cases.map(entry => [entry.id, entry.actualStatus])),
  {
    'independent-observer': 'independent',
    'circular-implementation': 'circular',
    'unsupported-supporting-only': 'unsupported',
    'independent-with-shared-infrastructure': 'independent',
  },
);
assert.equal(
  calibration.cases.find(entry => entry.id === 'independent-with-shared-infrastructure').actualSharedInfrastructureDependencies,
  1,
);

const producerSurfaceCalibration = calibratePrCandidateBuildSurface();
assert.equal(producerSurfaceCalibration.pass, true);
assert.equal(producerSurfaceCalibration.baselinePass, true);
assert.equal(producerSurfaceCalibration.falsePositiveTrials, 2);
assert.equal(producerSurfaceCalibration.falsePositives, 0);
assert.equal(producerSurfaceCalibration.falseNegativeTrials, 5);
assert.equal(producerSurfaceCalibration.falseNegatives, 0);
const createRequireAttack = producerSurfaceCalibration.dishonestMutations.find(entry => entry.id === 'create-require-dynamic-process-execution');
assert.equal(createRequireAttack?.detected, true);
assert.equal(createRequireAttack?.falseNegative, false);
assert.equal(createRequireAttack?.findings.some(entry => entry.kind === 'dynamic-process-execution'), true);

const repositoryReport = analyzeEvidenceGraph(graph, { candidateSha: HEAD_SHA });
const decision = buildEvidenceIndependenceDecision({
  policy,
  graph,
  report: repositoryReport,
  calibration,
  candidateSha: HEAD_SHA,
  env: {},
});
assert.equal(decision.mode, 'enforced');
assert.equal(decision.verdict, 'pass');
assert.equal(decision.blocking, false);
assert.equal(decision.wouldBlock, false);
assert.equal(decision.existingExactShaEvidenceRemainsAuthoritative, true);
assert.equal(decision.proofSynthesisAllowed, false);
assert.equal(decision.candidatePassGranted, false);
assert.deepEqual(decision.enforcedCriteria.map(entry => [entry.criterionId, entry.status]), [
  ['candidate-workflows-use-exact-pr-head', 'independent'],
]);
assert.deepEqual(decision.excludedImportantCriteria.map(entry => [entry.criterionId, entry.status]), [
  ['candidate-evidence-rejects-cross-sha-proof', 'circular'],
]);

const uncoveredPolicy = structuredClone(policy);
uncoveredPolicy.excludedImportantCriteria = [];
assert.throws(
  () => validateEvidenceIndependencePolicy(uncoveredPolicy, graph),
  /must be enforced or explicitly excluded: candidate-evidence-rejects-cross-sha-proof/,
  'an important criterion cannot silently disappear from the promotion decision',
);

const unknownPolicy = structuredClone(policy);
unknownPolicy.enforcedCriterionIds = ['unknown-criterion'];
assert.throws(
  () => validateEvidenceIndependencePolicy(unknownPolicy, graph),
  /unknown/,
  'unknown enforced criteria must fail closed',
);

const circularGraph = structuredClone(graph);
const headSignal = circularGraph.signals.find(signal => signal.id === 'orchestration-head-observation');
headSignal.sourceDependencies = [
  { sourceId: 'pr-candidate-orchestrator', role: 'derives' },
  { sourceId: 'github-pr-event', role: 'shared-infrastructure' },
  { sourceId: 'git-cli', role: 'shared-infrastructure' },
];
const circularReport = analyzeEvidenceGraph(circularGraph, { candidateSha: HEAD_SHA });
const circularDecision = buildEvidenceIndependenceDecision({
  policy,
  graph: circularGraph,
  report: circularReport,
  calibration,
  candidateSha: HEAD_SHA,
  env: {},
});
assert.equal(circularDecision.enforcedCriteria[0].status, 'circular');
assert.equal(circularDecision.wouldBlock, true);
assert.equal(circularDecision.blocking, true);
assert.equal(circularDecision.verdict, 'fail');

const rollbackDecision = buildEvidenceIndependenceDecision({
  policy,
  graph: circularGraph,
  report: circularReport,
  calibration,
  candidateSha: HEAD_SHA,
  env: { IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT: '0' },
});
assert.equal(rollbackDecision.mode, 'advisory-rollback');
assert.equal(rollbackDecision.wouldBlock, true);
assert.equal(rollbackDecision.blocking, false);
assert.equal(rollbackDecision.verdict, 'disabled-advisory');
assert.equal(rollbackDecision.failedCriteria[0], 'candidate-workflows-use-exact-pr-head');
assert.equal(rollbackDecision.calibration.falsePositives, 0);
assert.equal(rollbackDecision.calibration.falseNegatives, 0);
assert.equal(rollbackDecision.proofSynthesisAllowed, false);
assert.equal(rollbackDecision.candidatePassGranted, false);

const unsupportedGraph = structuredClone(graph);
unsupportedGraph.signals.find(signal => signal.id === 'orchestration-head-observation').materiality = 'supporting';
const unsupportedReport = analyzeEvidenceGraph(unsupportedGraph, { candidateSha: HEAD_SHA });
const unsupportedDecision = buildEvidenceIndependenceDecision({
  policy,
  graph: unsupportedGraph,
  report: unsupportedReport,
  calibration,
  candidateSha: HEAD_SHA,
  env: {},
});
assert.equal(unsupportedDecision.enforcedCriteria[0].status, 'unsupported');
assert.equal(unsupportedDecision.blocking, true);

const malformedGraph = structuredClone(graph);
malformedGraph.signals.find(signal => signal.id === 'orchestration-head-observation').sourceDependencies = [
  { sourceId: 'agent-orchestration-workflow', role: 'shared-infrastructure' },
];
assert.throws(
  () => analyzeEvidenceGraph(malformedGraph, { candidateSha: HEAD_SHA }),
  /marks non-infrastructure source agent-orchestration-workflow as shared infrastructure/,
  'malformed evidence dependency claims must fail closed',
);

assert.throws(
  () => buildEvidenceIndependenceDecision({
    policy,
    graph,
    report: repositoryReport,
    calibration,
    candidateSha: '6666666666666666666666666666666666666666',
    env: {},
  }),
  /expected 6666666666666666666666666666666666666666/,
  'independence decisions must remain bound to the exact candidate SHA',
);

console.log(`EVIDENCE_INDEPENDENCE_PROMOTION_PASS enforced=${decision.enforcedCriteria.length} excluded=${decision.excludedImportantCriteria.length} calibrationCases=${calibration.cases.length} stable=${calibration.cases.filter(entry => entry.stable).length} falsePositives=${calibration.falsePositives}/${calibration.falsePositiveTrials} falseNegatives=${calibration.falseNegatives}/${calibration.falseNegativeTrials} producerSurfaceFalsePositives=${producerSurfaceCalibration.falsePositives}/${producerSurfaceCalibration.falsePositiveTrials} producerSurfaceFalseNegatives=${producerSurfaceCalibration.falseNegatives}/${producerSurfaceCalibration.falseNegativeTrials} createRequire=blocked circularBlocked=${circularDecision.blocking} unsupportedBlocked=${unsupportedDecision.blocking} rollback=${rollbackDecision.mode} exactSha=bound trustedObserverBase=pinned candidatePassGranted=false`);
