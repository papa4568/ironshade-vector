import json
from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match in {path}, found {count}')
    p.write_text(text.replace(old, new, 1))

# Make the calibration corpus explicitly account for network/registry inputs used by
# the authoritative proof before its networkless npm run build phase.
corpus_path = Path('agent/proof-cache-calibration-corpus.json')
corpus = json.loads(corpus_path.read_text())
proof = corpus['proofClasses'][0]
proof['requiredExternalInputs'] = [
    'external-network-availability',
    'npm-registry-response-identity',
]
proof['externalDependencyEvidence'] = [
    {
        'input': 'external-network-availability',
        'profilePatterns': [
            'docker pull "$base_image"',
            'docker build --tag "$image"',
            'npm ci --ignore-scripts --no-audit --no-fund',
        ],
    },
    {
        'input': 'npm-registry-response-identity',
        'profilePatterns': [
            'npm install --global npm@10.9.8',
            'npm ci --ignore-scripts --no-audit --no-fund',
        ],
    },
]
proof['knownClosureGaps'].extend([
    {
        'id': 'external-network-availability-not-bound',
        'input': 'external-network-availability',
        'reason': 'The authoritative proof needs external network access for the Docker base-image pull, the Docker build that installs the pinned npm CLI, and npm ci before the final networkless build; EV-6 does not bind network availability or endpoint reachability into its execution-context digest.',
        'blocksEligibility': True,
    },
    {
        'id': 'npm-registry-response-identity-not-bound',
        'input': 'npm-registry-response-identity',
        'reason': 'The authoritative proof resolves npm@10.9.8 and locked dependency fetches through the configured npm registry. package-lock integrity constrains locked project package bytes, but EV-6 does not bind the registry endpoint/response identity or the globally installed npm artifact digest into its execution-context digest.',
        'blocksEligibility': True,
    },
])
corpus_path.write_text(json.dumps(corpus, indent=2) + '\n')

# Validate and audit the declared external dependencies against the repository-closed
# execution profile, then include them in the fail-closed required-input accounting.
tool_path = 'agent/tools/proof-cache-calibration-evidence.mjs'
replace_once(
    tool_path,
    "    assert(Array.isArray(entry.requiredEnvironmentInputs) && entry.requiredEnvironmentInputs.length > 0, `${entry.proofId}.requiredEnvironmentInputs must be non-empty`);\n    assert(Array.isArray(entry.knownClosureGaps), `${entry.proofId}.knownClosureGaps must be an array`);",
    "    assert(Array.isArray(entry.requiredEnvironmentInputs) && entry.requiredEnvironmentInputs.length > 0, `${entry.proofId}.requiredEnvironmentInputs must be non-empty`);\n    assert(Array.isArray(entry.requiredExternalInputs) && entry.requiredExternalInputs.length > 0, `${entry.proofId}.requiredExternalInputs must be non-empty`);\n    assert(Array.isArray(entry.externalDependencyEvidence) && entry.externalDependencyEvidence.length === entry.requiredExternalInputs.length, `${entry.proofId}.externalDependencyEvidence must cover every required external input`);\n    const externalInputs = new Set();\n    for (const dependency of entry.externalDependencyEvidence) {\n      assertString(dependency.input, `${entry.proofId}.externalDependencyEvidence.input`);\n      assert(entry.requiredExternalInputs.includes(dependency.input), `${entry.proofId}.externalDependencyEvidence references undeclared input ${dependency.input}`);\n      assert(!externalInputs.has(dependency.input), `${entry.proofId}.externalDependencyEvidence duplicates ${dependency.input}`);\n      externalInputs.add(dependency.input);\n      assert(Array.isArray(dependency.profilePatterns) && dependency.profilePatterns.length > 0, `${entry.proofId}.${dependency.input}.profilePatterns must be non-empty`);\n      for (const pattern of dependency.profilePatterns) assertString(pattern, `${entry.proofId}.${dependency.input}.profilePatterns`);\n    }\n    for (const input of entry.requiredExternalInputs) assert(externalInputs.has(input), `${entry.proofId}.externalDependencyEvidence is missing ${input}`);\n    assert(Array.isArray(entry.knownClosureGaps), `${entry.proofId}.knownClosureGaps must be an array`);",
    'external dependency corpus validation',
)
replace_once(
    tool_path,
    "function runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure }) {",
    "function runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure, executionProfileText }) {",
    'runtime audit signature',
)
replace_once(
    tool_path,
    "    'docker-base-image-identity': false,\n    'docker-engine-version': false,\n  };\n  const missingInputs = proofEntry.requiredEnvironmentInputs.filter(input => captured[input] !== true);",
    "    'docker-base-image-identity': false,\n    'docker-engine-version': false,\n    'external-network-availability': false,\n    'npm-registry-response-identity': false,\n  };\n  const requiredInputs = [...proofEntry.requiredEnvironmentInputs, ...proofEntry.requiredExternalInputs];\n  const missingInputs = requiredInputs.filter(input => captured[input] !== true);\n  const externalDependencyAudit = proofEntry.externalDependencyEvidence.map(dependency => {\n    const observedPatterns = dependency.profilePatterns.filter(pattern => executionProfileText.includes(pattern));\n    const knownBlockingGap = proofEntry.knownClosureGaps.some(gap => gap.input === dependency.input && gap.blocksEligibility === true);\n    return {\n      input: dependency.input,\n      profilePatterns: dependency.profilePatterns,\n      observedPatterns,\n      profileReferencesInput: observedPatterns.length === dependency.profilePatterns.length,\n      boundByExecutionContext: captured[dependency.input] === true,\n      knownBlockingGap,\n    };\n  });\n  const externalDependencyAccountingPass = externalDependencyAudit.every(entry => entry.profileReferencesInput && (entry.boundByExecutionContext || entry.knownBlockingGap));",
    'runtime missing/external accounting',
)
replace_once(
    tool_path,
    "    requiredInputs: proofEntry.requiredEnvironmentInputs,\n    captured,\n    missingInputs,\n    requiredInputsClosed: missingInputs.length === 0,",
    "    requiredInputs,\n    requiredEnvironmentInputs: proofEntry.requiredEnvironmentInputs,\n    requiredExternalInputs: proofEntry.requiredExternalInputs,\n    captured,\n    missingInputs,\n    requiredInputsClosed: missingInputs.length === 0,\n    externalDependencyAudit,\n    externalDependencyAccountingPass,",
    'runtime audit output',
)
replace_once(
    tool_path,
    "    && runtimeAudit.executionProfileInRepositoryClosure !== false\n    && runtimeAudit.invalidationControlsPass !== false",
    "    && runtimeAudit.executionProfileInRepositoryClosure !== false\n    && runtimeAudit.externalDependencyAccountingPass !== false\n    && runtimeAudit.invalidationControlsPass !== false",
    'eligibility external accounting condition',
)
replace_once(
    tool_path,
    "  if (runtimeAudit.executionProfileInRepositoryClosure === false) reasons.push('authoritative proof execution profile is outside the repository closure');\n  if (runtimeAudit.invalidationControlsPass === false) reasons.push('one or more declared runtime inputs do not invalidate the closure digest');",
    "  if (runtimeAudit.executionProfileInRepositoryClosure === false) reasons.push('authoritative proof execution profile is outside the repository closure');\n  if (runtimeAudit.externalDependencyAccountingPass === false) reasons.push('authoritative proof has an external dependency that is neither closure-bound nor declared as a blocking gap');\n  if (runtimeAudit.invalidationControlsPass === false) reasons.push('one or more declared runtime inputs do not invalidate the closure digest');",
    'eligibility external accounting reason',
)
replace_once(
    tool_path,
    "    const baselineClosure = computeClosure({ policy, proofId: proofEntry.proofId, revision: candidateSha });\n    const runtimeAudit = runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure });",
    "    const baselineClosure = computeClosure({ policy, proofId: proofEntry.proofId, revision: candidateSha });\n    const executionProfileText = await readFile(resolve(proofEntry.executionProfilePath), 'utf8');\n    const runtimeAudit = runtimeClosureAudit({ proofEntry, policy, candidateSha, baselineClosure, executionProfileText });",
    'execution profile audit load',
)

# Extend regression expectations to the newly declared external gaps and accounting.
test_path = 'agent/tests/proof-cache-calibration-evidence.mjs'
replace_once(
    test_path,
    "assert.deepEqual(proofEntry.knownClosureGaps.map(entry => entry.id), [\n  'docker-base-image-identity-not-bound',\n  'docker-engine-version-not-bound',\n]);",
    "assert.deepEqual(proofEntry.requiredExternalInputs, [\n  'external-network-availability',\n  'npm-registry-response-identity',\n]);\nassert.deepEqual(proofEntry.externalDependencyEvidence.map(entry => entry.input), proofEntry.requiredExternalInputs);\nassert.deepEqual(proofEntry.knownClosureGaps.map(entry => entry.id), [\n  'docker-base-image-identity-not-bound',\n  'docker-engine-version-not-bound',\n  'external-network-availability-not-bound',\n  'npm-registry-response-identity-not-bound',\n]);",
    'test gap inventory',
)
replace_once(
    test_path,
    "  executionProfileInRepositoryClosure: true,\n  invalidationControlsPass: true,",
    "  executionProfileInRepositoryClosure: true,\n  externalDependencyAccountingPass: true,\n  invalidationControlsPass: true,",
    'closed runtime fixture',
)
replace_once(
    test_path,
    "assert.match(blockedByDockerClosure.reasons.join('\\n'), /Docker engine version/);",
    "assert.match(blockedByDockerClosure.reasons.join('\\n'), /Docker engine version/);\nassert.match(blockedByDockerClosure.reasons.join('\\n'), /external network access/);\nassert.match(blockedByDockerClosure.reasons.join('\\n'), /npm@10\\.9\\.8/);",
    'blocking reason assertions',
)
replace_once(
    test_path,
    "    missingInputs: ['docker-base-image-identity', 'docker-engine-version'],\n    executionProfileInRepositoryClosure: true,\n    invalidationControlsPass: true,",
    "    missingInputs: ['docker-base-image-identity', 'docker-engine-version', 'external-network-availability', 'npm-registry-response-identity'],\n    executionProfileInRepositoryClosure: true,\n    externalDependencyAccountingPass: true,\n    invalidationControlsPass: true,",
    'missing runtime fixture',
)
replace_once(
    test_path,
    "assert.match(missingRuntime.reasons.join('\\n'), /docker-engine-version/);",
    "assert.match(missingRuntime.reasons.join('\\n'), /docker-engine-version/);\nassert.match(missingRuntime.reasons.join('\\n'), /external-network-availability/);\nassert.match(missingRuntime.reasons.join('\\n'), /npm-registry-response-identity/);",
    'missing runtime assertions',
)
replace_once(
    test_path,
    "console.log('EV17_PROOF_CACHE_CALIBRATION_TEST_PASS advisory=pass dockerProfile=pass noEligibility=pass falseHit=pass falseMissMeasured=pass runtimeGap=pass reuse=disabled');",
    "console.log('EV17_PROOF_CACHE_CALIBRATION_TEST_PASS advisory=pass dockerProfile=pass externalDependencies=accounted noEligibility=pass falseHit=pass falseMissMeasured=pass runtimeGap=pass reuse=disabled');",
    'test pass marker',
)

# Keep permanent operator/roadmap/archive documentation aligned with the measured no-promotion conclusion.
replace_once(
    'AGENTS.md',
    'EV-17 found no proof class eligible for EV-18 because the EV-6 execution-context digest still omits the immutable pulled Docker base-image identity and Docker engine version; reuse therefore remains shadow-only and EV-18 is blocked until those dynamic inputs are causally bound and recalibrated.',
    'EV-17 found no proof class eligible for EV-18 because the authoritative proof has four currently unbound causal inputs: immutable pulled Docker base-image identity, Docker engine version, external network availability for proof setup, and npm-registry response/artifact identity. The final `npm run build` container is networkless, but Docker/image/toolchain/dependency acquisition occurs earlier and remains causal to the proof outcome. Reuse therefore remains shadow-only and EV-18 is blocked until all four inputs are causally bound or eliminated and independently recalibrated.',
    'AGENTS EV-17 closure summary',
)
replace_once(
    'docs/experimental-verification-roadmap.md',
    'The real full-repository-build proof depends on a pulled Docker base-image identity and Docker engine version that EV-6 does not bind into its causal execution-context digest. Do not enable reuse until a separately reviewed calibration closes those dynamic inputs.',
    'The real full-repository-build proof depends on four causal inputs that EV-6 does not bind into its execution-context digest: pulled Docker base-image identity, Docker engine version, external network availability during proof setup, and npm-registry response/artifact identity. Do not enable reuse until a separately reviewed calibration binds or eliminates all of those inputs.',
    'roadmap EV-18 block',
)
replace_once(
    'docs/experimental-verification-archive.md',
    'The corrected EV-17 contract now measures the exact shared Dockerized proof envelope. The static execution settings are repository-closed through `scripts/run-full-repository-build-proof.sh`, but the current EV-6 execution-context digest still does not bind two dynamic causal inputs: the immutable pulled Docker base-image identity and Docker engine version. EV-17 therefore fails closed with `eligibleProofClasses=[]` and keeps `full-repository-build` unresolved even when the observed reruns show zero unsafe hits/disagreements. This is the intended no-promotion result, not a calibration failure.',
    'The corrected EV-17 contract now measures the exact shared Dockerized proof envelope. The static execution settings are repository-closed through `scripts/run-full-repository-build-proof.sh`, but the current EV-6 execution-context digest still does not bind four causal inputs: the immutable pulled Docker base-image identity, Docker engine version, external network availability during Docker/npm setup, and npm-registry response/artifact identity. The final `npm run build` executes with `--network none`, but the preceding Docker pull, Docker build/npm CLI install, and `npm ci` can still change the proof outcome independently of the current EV-6 digest. EV-17 therefore fails closed with `eligibleProofClasses=[]` and keeps `full-repository-build` unresolved even when the observed reruns show zero unsafe hits/disagreements. This is the intended no-promotion result, not a calibration failure.',
    'archive corrected closure paragraph',
)
replace_once(
    'docs/experimental-verification-archive.md',
    'Calibration complete; **no cached proof class was promoted or found eligible for EV-18**. EV-6 remains shadow-only. EV-18 stays uncompleted and blocked until the pulled Docker base-image identity and Docker engine version are causally bound into the proof closure and independently recalibrated.',
    'Calibration complete; **no cached proof class was promoted or found eligible for EV-18**. EV-6 remains shadow-only. EV-18 stays uncompleted and blocked until Docker base-image identity, Docker engine version, external setup-network availability, and npm-registry response/artifact identity are causally bound or eliminated from the proof and independently recalibrated.',
    'archive promotion status',
)
