from pathlib import Path
import json
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


def write(path, text):
    Path(path).write_text(text)


proof_script = r'''#!/usr/bin/env bash
set -euo pipefail

candidate_sha="${CANDIDATE_SHA:-}"
if [[ ! "$candidate_sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo "FULL_REPOSITORY_BUILD_PROOF_FAIL invalid CANDIDATE_SHA=$candidate_sha" >&2
  exit 2
fi

log_path="${FULL_VERIFICATION_LOG:-.agent-impact-calibration/full-verification.log}"
base_image='node:22.23.2-bookworm'
snapshot="$(mktemp -d)"
image="ironshade-candidate-node:${candidate_sha}"
cleanup() {
  rm -rf "$snapshot"
  docker image rm "$image" >/dev/null 2>&1 || true
}
trap cleanup EXIT

mkdir -p "$(dirname "$log_path")"
test "$(git rev-parse HEAD)" = "$candidate_sha"
git archive --format=tar "$candidate_sha" | tar -xf - -C "$snapshot"
test ! -e "$snapshot/.git"

docker pull "$base_image" >/dev/null
base_image_ref="$(docker image inspect --format '{{index .RepoDigests 0}}' "$base_image")"
docker_engine_version="$(docker version --format '{{.Server.Version}}')"
test -n "$base_image_ref"
test -n "$docker_engine_version"
echo "FULL_REPOSITORY_BUILD_PROOF_RUNTIME baseImage=$base_image baseImageRef=$base_image_ref dockerEngine=$docker_engine_version network=none home=/tmp npmIgnoreScripts=true user=$(id -u):$(id -g)"

docker build --tag "$image" - <<DOCKERFILE
FROM ${base_image_ref}
RUN npm install --global npm@10.9.8 \
    && test "\$(npm --version)" = '10.9.8'
DOCKERFILE

docker run --rm \
  --volume "$snapshot:/workspace" \
  --workdir /workspace \
  --env HOME=/tmp \
  --user "$(id -u):$(id -g)" \
  "$image" \
  npm ci --ignore-scripts --no-audit --no-fund

set -o pipefail
set +e
docker run --rm \
  --network none \
  --volume "$snapshot:/workspace" \
  --workdir /workspace \
  --env HOME=/tmp \
  --env npm_config_ignore_scripts=true \
  --env VITE_API_BASE_URL \
  --user "$(id -u):$(id -g)" \
  "$image" \
  npm run build 2>&1 | tee "$log_path"
status=${PIPESTATUS[0]}
set -e
if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

test -d "$snapshot/dist"
test ! -L "$snapshot/dist"
rm -rf dist
cp -a "$snapshot/dist" dist
test "$(git rev-parse HEAD)" = "$candidate_sha"
echo "FULL_REPOSITORY_BUILD_PROOF_PASS candidate=$candidate_sha baseImageRef=$base_image_ref dockerEngine=$docker_engine_version"
'''
write('scripts/run-full-repository-build-proof.sh', proof_script)

# Make the authoritative producer and EV-17 execute one shared proof envelope.
pr_path = Path('.github/workflows/pr-candidate.yml')
pr = pr_path.read_text()
pattern = re.compile(
    r"(      - name: Run full repository verification and production build once\n"
    r"        id: full-verification\n"
    r"        env:\n"
    r"          CANDIDATE_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\n"
    r"          VITE_API_BASE_URL: \$\{\{ vars\.VITE_API_BASE_URL \}\}\n)"
    r"        run: \|\n.*?"
    r"(?=\n      - name: Record source-bound candidate web digest)",
    re.S,
)
pr, count = pattern.subn(r"\1        run: bash scripts/run-full-repository-build-proof.sh\n", pr)
if count != 1:
    raise SystemExit(f'pr-candidate proof envelope: expected one match, found {count}')
pr_path.write_text(pr)

# Record the exact execution envelope used for calibration and fail closed on dynamic Docker inputs
# that EV-6 does not currently bind into its runtime digest.
corpus_path = Path('agent/proof-cache-calibration-corpus.json')
corpus = json.loads(corpus_path.read_text())
proof = corpus['proofClasses'][0]
proof['calibrationCommand'] = 'bash scripts/run-full-repository-build-proof.sh'
proof['executionProfilePath'] = 'scripts/run-full-repository-build-proof.sh'
proof['requiredEnvironmentInputs'] = [
    'runner-image-os',
    'runner-image-version',
    'node-version',
    'npm-version',
    'platform',
    'architecture',
    'VITE_API_BASE_URL',
    'docker-base-image-identity',
    'docker-engine-version',
]
proof['knownClosureGaps'] = [
    {
        'id': 'docker-base-image-identity-not-bound',
        'input': 'docker-base-image-identity',
        'reason': 'The authoritative proof now shares one repository-closed Docker execution script with EV-17, but EV-6 does not bind the immutable pulled node:22.23.2-bookworm image identity into its execution-context digest.',
        'blocksEligibility': True,
    },
    {
        'id': 'docker-engine-version-not-bound',
        'input': 'docker-engine-version',
        'reason': 'The authoritative proof executes through Docker, but EV-6 does not bind the Docker engine version into its execution-context digest.',
        'blocksEligibility': True,
    },
]
corpus_path.write_text(json.dumps(corpus, indent=2) + '\n')

# Calibration tool: validate the shared execution profile, execute it for every measured trial,
# and report the unclosed Docker runtime inputs instead of incorrectly granting EV-18 eligibility.
tool_path = Path('agent/tools/proof-cache-calibration-evidence.mjs')
tool = tool_path.read_text()
tool = replace_once(
    tool,
    "  computeClosure,\n  validateHistoryAgainstGit,",
    "  computeClosure,\n  isRepositoryPathInClosure,\n  validateHistoryAgainstGit,",
    'tool import',
)
tool = replace_once(
    tool,
    "    assert(entry.expectedCommand === proof.command, `${entry.proofId} expectedCommand drifted`);\n",
    "    assert(entry.expectedCommand === proof.command, `${entry.proofId} expectedCommand drifted`);\n"
    "    assertString(entry.calibrationCommand, `${entry.proofId}.calibrationCommand`);\n"
    "    assertString(entry.executionProfilePath, `${entry.proofId}.executionProfilePath`);\n"
    "    assert(entry.calibrationCommand.includes(entry.executionProfilePath), `${entry.proofId}.calibrationCommand must execute the declared profile`);\n",
    'tool calibration contract',
)
tool = replace_once(
    tool,
    "function runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure }) {\n  const context = baselineClosure.executionContext;\n",
    "function runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure }) {\n"
    "  const context = baselineClosure.executionContext;\n"
    "  const proof = policy.proofClasses.find(entry => entry.id === proofEntry.proofId);\n"
    "  assert(proof, `unknown proof class ${proofEntry.proofId}`);\n"
    "  const executionProfileInRepositoryClosure = isRepositoryPathInClosure(proofEntry.executionProfilePath, proof);\n",
    'tool runtime audit prelude',
)
tool = replace_once(
    tool,
    "    architecture: typeof context.arch === 'string' && context.arch.length > 0,\n    VITE_API_BASE_URL: Object.hasOwn(context.env ?? {}, 'VITE_API_BASE_URL'),\n",
    "    architecture: typeof context.arch === 'string' && context.arch.length > 0,\n"
    "    VITE_API_BASE_URL: Object.hasOwn(context.env ?? {}, 'VITE_API_BASE_URL'),\n"
    "    'docker-base-image-identity': false,\n"
    "    'docker-engine-version': false,\n",
    'tool missing docker inputs',
)
tool = replace_once(
    tool,
    "    runnerImageIdentityBound: captured['runner-image-os'] && captured['runner-image-version'],\n    invalidationControls,\n",
    "    runnerImageIdentityBound: captured['runner-image-os'] && captured['runner-image-version'],\n"
    "    executionProfilePath: proofEntry.executionProfilePath,\n"
    "    executionProfileInRepositoryClosure,\n"
    "    invalidationControls,\n",
    'tool execution profile audit',
)
tool = replace_once(
    tool,
    "    && runtimeAudit.requiredInputsClosed\n    && runtimeAudit.invalidationControlsPass !== false\n",
    "    && runtimeAudit.requiredInputsClosed\n"
    "    && runtimeAudit.executionProfileInRepositoryClosure !== false\n"
    "    && runtimeAudit.invalidationControlsPass !== false\n",
    'tool eligibility profile condition',
)
tool = replace_once(
    tool,
    "  if (!runtimeAudit.requiredInputsClosed) reasons.push(`runtime closure missing required inputs: ${runtimeAudit.missingInputs.join(', ')}`);\n  if (runtimeAudit.invalidationControlsPass === false) reasons.push('one or more declared runtime inputs do not invalidate the closure digest');\n",
    "  if (!runtimeAudit.requiredInputsClosed) reasons.push(`runtime closure missing required inputs: ${runtimeAudit.missingInputs.join(', ')}`);\n"
    "  if (runtimeAudit.executionProfileInRepositoryClosure === false) reasons.push('authoritative proof execution profile is outside the repository closure');\n"
    "  if (runtimeAudit.invalidationControlsPass === false) reasons.push('one or more declared runtime inputs do not invalidate the closure digest');\n",
    'tool eligibility reasons',
)
tool = replace_once(
    tool,
    "    const execution = run(proofEntry.expectedCommand, { expectedOutcome: probe.expectedOutcome });\n",
    "    const execution = run(proofEntry.calibrationCommand, { env: { CANDIDATE_SHA: syntheticSha }, expectedOutcome: probe.expectedOutcome });\n",
    'tool probe execution',
)
tool = replace_once(
    tool,
    "      const baselineExecution = run(proofEntry.expectedCommand, { expectedOutcome: 'success' });\n",
    "      const baselineExecution = run(proofEntry.calibrationCommand, { env: { CANDIDATE_SHA: candidateSha }, expectedOutcome: 'success' });\n",
    'tool baseline execution',
)
tool = replace_once(
    tool,
    "      command: proofEntry.expectedCommand,\n      repositoryClosure: proofEntry.expectedRepositoryClosure,\n",
    "      command: proofEntry.expectedCommand,\n"
    "      calibrationCommand: proofEntry.calibrationCommand,\n"
    "      executionProfilePath: proofEntry.executionProfilePath,\n"
    "      repositoryClosure: proofEntry.expectedRepositoryClosure,\n",
    'tool report profile',
)
tool = replace_once(
    tool,
    "  if (executeProofs) assert(report.eligibleProofClasses.length === corpus.proofClasses.length, 'EV-17 measured proof class did not satisfy the calibrated EV-18 eligibility boundary');\n",
    "  if (executeProofs) {\n"
    "    assert(report.eligibleProofClasses.length + report.unresolvedProofClasses.length === corpus.proofClasses.length, 'EV-17 eligibility accounting is incomplete');\n"
    "    for (const unresolved of report.unresolvedProofClasses) assert(unresolved.reasons.length > 0, `${unresolved.proofId} is unresolved without a fail-closed reason`);\n"
    "  }\n",
    'tool final eligibility assertion',
)
tool_path.write_text(tool)

# Regression test: the measured behavior remains safe, but the real proof class must now fail closed
# until the mutable Docker runtime inputs are part of the EV-6 causal closure.
test = r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { validateProofCachePolicy } from '../tools/causal-proof-cache.mjs';
import {
  evaluateProofClassEligibility,
  validateProofCacheCalibrationCorpus,
} from '../tools/proof-cache-calibration-evidence.mjs';

const policy = validateProofCachePolicy(JSON.parse(await readFile(resolve('agent/proof-cache.json'), 'utf8')));
const corpus = validateProofCacheCalibrationCorpus(
  JSON.parse(await readFile(resolve('agent/proof-cache-calibration-corpus.json'), 'utf8')),
  policy,
);

assert.equal(corpus.mode, 'advisory');
assert.equal(policy.mode, 'shadow');
assert.equal(corpus.proofClasses.length, 1);
const proofEntry = corpus.proofClasses[0];
assert.equal(proofEntry.proofId, 'full-repository-build');
assert.equal(proofEntry.expectedCommand, 'npm run build');
assert.equal(proofEntry.calibrationCommand, 'bash scripts/run-full-repository-build-proof.sh');
assert.equal(proofEntry.executionProfilePath, 'scripts/run-full-repository-build-proof.sh');
assert.deepEqual(proofEntry.knownClosureGaps.map(entry => entry.id), [
  'docker-base-image-identity-not-bound',
  'docker-engine-version-not-bound',
]);
assert.equal(proofEntry.knownClosureGaps.every(entry => entry.blocksEligibility === true), true);

const safeTrials = [
  { kind: 'baseline', closureRelation: 'same', prediction: 'baseline', outcome: 'success', classification: 'baseline' },
  { kind: 'same-closure-control', closureRelation: 'same', prediction: 'hit', outcome: 'success', classification: 'agreement' },
  { kind: 'invalidation-control', closureRelation: 'different', prediction: 'miss', outcome: 'success', classification: 'false-miss' },
  { kind: 'invalidation-defect', closureRelation: 'different', prediction: 'miss', outcome: 'failure', classification: 'correct-invalidation' },
];

const closedRuntime = {
  requiredInputsClosed: true,
  missingInputs: [],
  executionProfileInRepositoryClosure: true,
  invalidationControlsPass: true,
};
const blockedByDockerClosure = evaluateProofClassEligibility({
  corpus,
  proofEntry,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(blockedByDockerClosure.eligible, false, 'known Docker closure gaps must block EV-18 eligibility');
assert.equal(blockedByDockerClosure.falseHits, 0);
assert.equal(blockedByDockerClosure.falseMisses, 1);
assert.equal(blockedByDockerClosure.sameClosureRunCount, 2);
assert.equal(blockedByDockerClosure.sameClosureDisagreements, 0);
assert.match(blockedByDockerClosure.reasons.join('\n'), /immutable pulled node:22\.23\.2-bookworm image identity/);
assert.match(blockedByDockerClosure.reasons.join('\n'), /Docker engine version/);

const noGapProof = { ...proofEntry, knownClosureGaps: [] };
const eligibleWhenClosureIsActuallyComplete = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(eligibleWhenClosureIsActuallyComplete.eligible, true, 'decision boundary should permit a class only after all runtime inputs are closed');

const falseHitTrials = safeTrials.map(entry => ({ ...entry }));
falseHitTrials[1] = { ...falseHitTrials[1], outcome: 'failure', classification: 'false-hit' };
const falseHitResult = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: falseHitTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 0,
});
assert.equal(falseHitResult.eligible, false);
assert.equal(falseHitResult.falseHits, 1);
assert.equal(falseHitResult.sameClosureDisagreements, 1);

const missingRuntime = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: {
    requiredInputsClosed: false,
    missingInputs: ['docker-base-image-identity', 'docker-engine-version'],
    executionProfileInRepositoryClosure: true,
    invalidationControlsPass: true,
  },
  historicalDisagreementCount: 0,
});
assert.equal(missingRuntime.eligible, false);
assert.match(missingRuntime.reasons.join('\n'), /docker-base-image-identity/);
assert.match(missingRuntime.reasons.join('\n'), /docker-engine-version/);

const profileOutsideClosure = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: { ...closedRuntime, executionProfileInRepositoryClosure: false },
  historicalDisagreementCount: 0,
});
assert.equal(profileOutsideClosure.eligible, false);
assert.match(profileOutsideClosure.reasons.join('\n'), /execution profile is outside/);

const runtimeInvalidationFailure = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: { ...closedRuntime, invalidationControlsPass: false },
  historicalDisagreementCount: 0,
});
assert.equal(runtimeInvalidationFailure.eligible, false);
assert.match(runtimeInvalidationFailure.reasons.join('\n'), /runtime inputs do not invalidate/);

const historicalDisagreement = evaluateProofClassEligibility({
  corpus,
  proofEntry: noGapProof,
  trialRows: safeTrials,
  runtimeAudit: closedRuntime,
  historicalDisagreementCount: 1,
});
assert.equal(historicalDisagreement.eligible, false);
assert.match(historicalDisagreement.reasons.join('\n'), /retained history/);

const mutatedCorpus = structuredClone(corpus);
mutatedCorpus.mode = 'enforced';
assert.throws(() => validateProofCacheCalibrationCorpus(mutatedCorpus, policy), /must remain advisory/);

console.log('EV17_PROOF_CACHE_CALIBRATION_TEST_PASS advisory=pass dockerProfile=pass noEligibility=pass falseHit=pass falseMissMeasured=pass runtimeGap=pass reuse=disabled');
'''
write('agent/tests/proof-cache-calibration-evidence.mjs', test)

# Exact-SHA workflow must measure the real Dockerized proof and expect the fail-closed no-promotion result.
workflow_path = Path('.github/workflows/ev17-proof-cache-calibration.yml')
workflow = workflow_path.read_text()
workflow = workflow.replace(
    "      - 'agent/tests/proof-cache-calibration-evidence.mjs'\n",
    "      - 'agent/tests/proof-cache-calibration-evidence.mjs'\n"
    "      - 'scripts/run-full-repository-build-proof.sh'\n"
    "      - '.github/workflows/pr-candidate.yml'\n",
)
if workflow.count("'scripts/run-full-repository-build-proof.sh'") != 2:
    raise SystemExit('EV-17 workflow path coverage did not update both pull_request and push')
workflow = replace_once(
    workflow,
    "        env:\n          CANDIDATE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}\n        run: |\n",
    "        env:\n"
    "          CANDIDATE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}\n"
    "          VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}\n"
    "        run: |\n",
    'EV-17 workflow environment',
)
workflow = replace_once(
    workflow,
    "          if (JSON.stringify(report.eligibleProofClasses) !== JSON.stringify(['full-repository-build']) || report.unresolvedProofClasses.length !== 0) fail('EV-18 eligibility scope drifted');\n",
    "          if (report.eligibleProofClasses.length !== 0 || report.unresolvedProofClasses.length !== 1 || report.unresolvedProofClasses[0].proofId !== 'full-repository-build') fail('EV-18 must fail closed while Docker runtime identity is outside the closure');\n",
    'EV-17 workflow eligibility assertion',
)
workflow = replace_once(
    workflow,
    "          if (proof.runtimeClosureAudit.requiredInputsClosed !== true || proof.runtimeClosureAudit.missingInputs.length !== 0 || proof.runtimeClosureAudit.runnerImageIdentityBound !== true || proof.runtimeClosureAudit.invalidationControlsPass !== true) fail('runtime closure audit failed');\n",
    "          if (proof.runtimeClosureAudit.requiredInputsClosed !== false || JSON.stringify(proof.runtimeClosureAudit.missingInputs) !== JSON.stringify(['docker-base-image-identity','docker-engine-version']) || proof.runtimeClosureAudit.runnerImageIdentityBound !== true || proof.runtimeClosureAudit.executionProfileInRepositoryClosure !== true || proof.runtimeClosureAudit.invalidationControlsPass !== true) fail('runtime closure audit failed closed incorrectly');\n",
    'EV-17 workflow runtime assertion',
)
workflow = replace_once(
    workflow,
    "          if (proof.knownClosureGaps.length !== 0) fail('eligible proof class retains an unresolved closure gap');\n",
    "          if (JSON.stringify(proof.knownClosureGaps.map(entry => entry.id)) !== JSON.stringify(['docker-base-image-identity-not-bound','docker-engine-version-not-bound']) || !proof.knownClosureGaps.every(entry => entry.blocksEligibility === true)) fail('Docker closure gaps drifted');\n"
    "          if (proof.calibrationCommand !== 'bash scripts/run-full-repository-build-proof.sh' || proof.executionProfilePath !== 'scripts/run-full-repository-build-proof.sh') fail('calibration is not executing the authoritative production proof profile');\n",
    'EV-17 workflow gap assertion',
)
workflow_path.write_text(workflow)

# Permanent agent contract: the calibration now measures the authoritative proof envelope and records a no-promotion result.
agents_path = Path('AGENTS.md')
agents = agents_path.read_text()
old_bullet = "- `agent/proof-cache-calibration-corpus.json`, `agent/tools/proof-cache-calibration-evidence.mjs`, `agent/tests/proof-cache-calibration-evidence.mjs`, and `.github/workflows/ev17-proof-cache-calibration.yml` — EV-17 exact-SHA advisory proof-cache calibration contract. It reruns each measured proof across an exact-candidate baseline, an excluded-input same-closure control covering every EV-6 repository exclusion category, a benign included-input invalidation, and a representative failing invalidation; measures false hits, false misses, and same-closure disagreement; audits retained same-closure history plus runner/image/toolchain/environment closure; proves each captured runtime dimension invalidates the closure digest; restores the exact candidate after every disposable mutation; and may name only proof classes that satisfy the reviewed EV-18 eligibility boundary.\n"
new_bullet = "- `agent/proof-cache-calibration-corpus.json`, `agent/tools/proof-cache-calibration-evidence.mjs`, `agent/tests/proof-cache-calibration-evidence.mjs`, `scripts/run-full-repository-build-proof.sh`, and `.github/workflows/ev17-proof-cache-calibration.yml` — EV-17 exact-SHA advisory proof-cache calibration contract. The authoritative PR producer and EV-17 both execute the same Dockerized full-repository-build profile, whose static container/network/HOME/npm/user settings live in an included repository-closure script. EV-17 reruns that real proof across an exact-candidate baseline, an excluded-input same-closure control covering every EV-6 repository exclusion category, a benign included-input invalidation, and a representative failing invalidation; measures false hits, false misses, and same-closure disagreement; audits retained history and declared runtime dimensions; and restores the exact candidate after every disposable mutation. EV-17 found no proof class eligible for EV-18 because the EV-6 execution-context digest still omits the immutable pulled Docker base-image identity and Docker engine version; reuse therefore remains shadow-only and EV-18 is blocked until those dynamic inputs are causally bound and recalibrated.\n"
agents = replace_once(agents, old_bullet, new_bullet, 'AGENTS EV-17 contract')
agents_path.write_text(agents)

# Roadmap: retain EV-18 as uncompleted but explicitly blocked by EV-17's reviewed no-promotion evidence.
roadmap_path = Path('docs/experimental-verification-roadmap.md')
roadmap = roadmap_path.read_text()
roadmap = replace_once(
    roadmap,
    "- [ ] **EV-18 — Reuse One Validated Proof Class**\n  - Enable reuse for one proof class justified by EV-17, requiring exact input/context digests, immutable candidate identity, auditable cache provenance, and fail-closed fallback to the real proof for any unknown or inconsistent dependency.\n",
    "- [ ] **EV-18 — Reuse One Validated Proof Class**\n"
    "  - **Blocked by EV-17 calibration evidence:** no proof class is currently eligible. The real full-repository-build proof depends on a pulled Docker base-image identity and Docker engine version that EV-6 does not bind into its causal execution-context digest. Do not enable reuse until a separately reviewed calibration closes those dynamic inputs.\n"
    "  - Enable reuse for one proof class justified by EV-17, requiring exact input/context digests, immutable candidate identity, auditable cache provenance, and fail-closed fallback to the real proof for any unknown or inconsistent dependency.\n",
    'roadmap EV-18 block',
)
roadmap_path.write_text(roadmap)

# Replace the provisional EV-17 archive closeout with the corrected no-promotion record while retaining
# the immutable earlier evidence and the trusted review failure that exposed the gap.
archive_path = Path('docs/experimental-verification-archive.md')
archive = archive_path.read_text()
heading = '## EV-17 — Calibrate EV-6 Proof-Cache Closure'
if archive.count(heading) != 1:
    raise SystemExit(f'expected one EV-17 archive heading, found {archive.count(heading)}')
prefix = archive.split(heading, 1)[0].rstrip()
entry = r'''

## EV-17 — Calibrate EV-6 Proof-Cache Closure

Completed 2026-10-14 as an advisory calibration of the EV-6 causal proof-cache mechanism. The original EV-6 prototype record above remains unchanged advisory history; proof reuse remains disabled.

### Implemented

- Added `agent/proof-cache-calibration-corpus.json`, `agent/tools/proof-cache-calibration-evidence.mjs`, `agent/tests/proof-cache-calibration-evidence.mjs`, and `.github/workflows/ev17-proof-cache-calibration.yml` as the exact-SHA calibration contract for the current `full-repository-build` proof class.
- Added `scripts/run-full-repository-build-proof.sh` and made both the authoritative PR producer and EV-17 calibration execute that one Dockerized production proof profile. Its static container settings (`--network none`, `HOME=/tmp`, `npm_config_ignore_scripts=true`, user mapping, locked npm version, and `VITE_API_BASE_URL` pass-through) are therefore versioned in a path included by the EV-6 repository closure rather than duplicated in workflow-only text.
- The shared proof profile explicitly pulls `node:22.23.2-bookworm`, resolves the pulled immutable repo digest for that execution, records the Docker engine version, installs from the exact candidate archive, and runs the real `npm run build` inside the same isolated container profile used by final-candidate verification.
- Calibration reruns the real Dockerized proof on the exact candidate baseline plus an excluded-input same-closure control spanning every EV-6 repository exclusion category, a benign included-input invalidation, and a representative included TypeScript defect. Every trial still reruns the real proof; no result may grant candidate acceptance or cached-proof reuse.
- Retained EV-6 history is validated against immutable Git SHAs, same-closure disagreement is measured, declared runner/image/toolchain/environment dimensions are checked for closure invalidation, and disposable probe commits are restored to the exact candidate state.

### Measured behavior and correction

An early implementation attempt failed closed because the baseline build left tracked generated state before the first disposable probe. The evidence runner was corrected to restore the complete tracked checkout to the exact candidate after the baseline and after every probe; the criterion was not weakened.

Implementation candidate `616dd3103cfa1b01060cd85721c1321a22cf5b14` measured four trials with zero false hits, one conservative false miss, and zero same-closure disagreements, then received a trusted EV-17 pass after its Android prerequisites became green. That evidence was useful for repository-input behavior, but it was not sufficient to promote reuse because the calibration command still ran directly on the host.

Closeout candidate `c3878808994081f2322c4ff19a9e574b81f7e92c` reproduced the four-trial metrics, full verification/build, APK, API 35 smoke, API 36 large-screen smoke, and Android aggregate. Trusted independent review run `38675014331` correctly failed it with a major finding: the authoritative full-repository-build proof is Dockerized, while the calibration and EV-6 causal closure did not cover that actual execution context, including the pulled base-image identity and container runtime inputs. That failure is retained as evidence and was fixed rather than rerun away.

The corrected EV-17 contract now measures the exact shared Dockerized proof envelope. The static execution settings are repository-closed through `scripts/run-full-repository-build-proof.sh`, but the current EV-6 execution-context digest still does not bind two dynamic causal inputs: the immutable pulled Docker base-image identity and Docker engine version. EV-17 therefore fails closed with `eligibleProofClasses=[]` and keeps `full-repository-build` unresolved even when the observed reruns show zero unsafe hits/disagreements. This is the intended no-promotion result, not a calibration failure.

### False-positive / false-negative semantics

The error budget remains zero false hits and zero same-closure disagreements. A benign included-source change intentionally produces a cache miss followed by a successful real Dockerized build; this is recorded as one conservative false miss rather than an unsafe hit. The representative TypeScript defect produces a miss and a failing real Dockerized build, proving fail-closed invalidation. The same-closure excluded-input control must predict a hit but still rerun and succeed. Any disagreement, representative defect escape, missing runtime input, or closure gap blocks eligibility.

### Isolation and rollback

EV-17 changes verification/governance only. Disposable probe commits are reset back to the exact candidate after every trial, tracked state must be clean, retained observations are recomputed against immutable Git SHAs, and the proof continues to rerun for every candidate. No cache result is accepted and no product/runtime behavior changes.

Rollback is deterministic: remove the EV-17 calibration workflow/corpus/tool/test and restore `.github/workflows/pr-candidate.yml`'s equivalent inline Docker proof commands (or keep the shared script as a behavior-preserving refactor). EV-6 then returns to its pre-EV-17 advisory shadow state with the authoritative full repository build still executing exactly once. No browser, Android/APK, exact-SHA, architecture-invariant, promoted-gate, or trusted-review obligation is waived.

This archive transition follows the repository's independent-review self-reference rule. It records immutable predecessor evidence and the trusted-review defect that changed the conclusion. The resulting corrected closeout SHA must pass fresh exact-head technical gates and a fresh trusted EV-17 independent review; no predecessor verdict is inherited.

### Promotion status

Calibration complete; **no cached proof class was promoted or found eligible for EV-18**. EV-6 remains shadow-only. EV-18 stays uncompleted and blocked until the pulled Docker base-image identity and Docker engine version are causally bound into the proof closure and independently recalibrated. Under the roadmap's top-to-bottom-unless-blocked rule, the next actionable experimental item is EV-19 — Validate EV-7 Roadmap Shadow Predictions.
'''
archive_path.write_text(prefix + entry.rstrip() + '\n')
