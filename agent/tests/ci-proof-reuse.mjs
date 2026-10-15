import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [candidate, browser, android, legacyProof, closedProof] = await Promise.all([
  readFile('.github/workflows/pr-candidate.yml', 'utf8'),
  readFile('.github/workflows/browser-e2e.yml', 'utf8'),
  readFile('.github/workflows/pr-android-apk.yml', 'utf8'),
  readFile('scripts/run-full-repository-build-proof.sh', 'utf8'),
  readFile('scripts/run-full-repository-build-proof-closed.sh', 'utf8'),
]);

function countExactLine(text, line) {
  return text.split(/\r?\n/).filter(entry => entry.trim() === line).length;
}

function countMatchingTrimmedLines(text, pattern) {
  return text.split(/\r?\n/).filter(entry => pattern.test(entry.trim())).length;
}

assert.match(candidate, /name: PR Candidate Verification/);
assert.match(candidate, /pull_request:/);
assert.match(candidate, /group: pr-candidate-build-\$\{\{ github\.event\.pull_request\.number \}\}/, 'Only stale candidate-build producers should be cancelled by PR; downstream reusable jobs must not hold the next producer behind them');
assert.doesNotMatch(candidate, /group: pr-candidate-\$\{\{ github\.event\.pull_request\.number \}\}/, 'Do not put whole-run PR concurrency around reusable downstream workflows');
assert.doesNotMatch(candidate, /npm run verify:full/, 'PR candidate workflow must not add a second explicit full verification run');
assert.equal(countMatchingTrimmedLines(candidate, /^npm run build(?:\s+2>&1\s+\|\s+tee\s+.*)?$/), 0, 'PR workflow must never inline a second full build');

assert.match(candidate, /IRONSHADE_PROOF_CACHE_REUSE: \$\{\{ vars\.IRONSHADE_PROOF_CACHE_REUSE \}\}/, 'EV-18 rollback switch must be repository-configurable');
assert.equal(countExactLine(candidate, 'uses: actions/cache/restore@v5'), 1, 'EV-18 must perform one exact cache restore');
assert.equal(countExactLine(candidate, 'uses: actions/cache/save@v5'), 1, 'EV-18 must save one validated real-proof result');
assert.doesNotMatch(candidate, /restore-keys:/, 'EV-18 may not use prefix/partial cache restoration');
assert.match(candidate, /Prepare EV-18 closed proof inputs[\s\S]*prepare-full-repository-build-proof-closed\.sh/, 'EV-18 must complete causal preflight before reuse decision');
assert.match(candidate, /Compute EV-18 exact closure cache key[\s\S]*proof-cache-promotion\.mjs request/, 'EV-18 must derive the exact key from the closed proof closure');
assert.match(candidate, /Validate EV-18 cache candidate[\s\S]*proof-cache-promotion\.mjs decide/, 'EV-18 must validate cache provenance before reuse');
const producerStart = candidate.indexOf('Run authoritative full repository verification or reuse validated closed proof');
assert(producerStart >= 0, 'The authoritative EV-18 producer step is missing');
const producerEnd = candidate.indexOf('\n      - name: ', producerStart + 1);
const producerBlock = candidate.slice(producerStart, producerEnd === -1 ? candidate.length : producerEnd);
assert.match(producerBlock, /proof-cache-promotion\.mjs materialize/, 'A validated hit must materialize the cached verified dist');
assert.match(producerBlock, /bash scripts\/run-full-repository-build-proof-closed\.sh/, 'A cache miss or rejected entry must rerun the closed proof');
assert.match(producerBlock, /bash scripts\/run-full-repository-build-proof\.sh/, 'Rollback must run the pre-EV-18 legacy proof');
assert.match(candidate, /Record EV-18 real-proof cache entry[\s\S]*proof-cache-promotion\.mjs record/, 'Only a real successful closed proof may create cache provenance');
assert.match(candidate, /Save EV-18 validated proof cache[\s\S]*actions\/cache\/save@v5/, 'A real successful closed proof must be eligible for exact-key persistence');
assert.match(candidate, /Upload EV-18 proof-cache decision evidence[\s\S]*proof-cache-ev18-\$\{\{ github\.event\.pull_request\.number \}\}-\$\{\{ github\.event\.pull_request\.head\.sha \}\}/, 'EV-18 must publish exact-candidate reuse/fallback evidence');

assert.equal(countExactLine(candidate, 'bash scripts/run-full-repository-build-proof-closed.sh'), 1, 'The closed real proof fallback must have one authoritative call site');
assert.equal(countExactLine(candidate, 'bash scripts/run-full-repository-build-proof.sh'), 1, 'The pre-EV-18 legacy proof must exist only as rollback');
assert.equal(countMatchingTrimmedLines(legacyProof, /^npm run build 2>&1 \| tee "\$log_path"$/), 1, 'Legacy rollback proof must retain exactly one real production build');
assert.equal(countMatchingTrimmedLines(closedProof, /^npm run build 2>&1 \| tee "\$log_path"$/), 1, 'Closed fallback proof must retain exactly one real production build');
assert.match(legacyProof, /set -o pipefail[\s\S]*npm run build 2>&1 \| tee "\$log_path"[\s\S]*status=\$\{PIPESTATUS\[0\]\}/, 'Legacy rollback must preserve proof failure status');
assert.match(closedProof, /--network none[\s\S]*npm run build 2>&1 \| tee "\$log_path"/, 'Promoted proof class must remain networkless after preflight');

assert.match(candidate, /Capture EV-5 impact-map calibration shadow evidence[\s\S]*if: always\(\)[\s\S]*FULL_VERIFICATION_OUTCOME: \$\{\{ steps\.full-verification\.outcome \}\}[\s\S]*impact-map-calibration\.mjs observe/, 'EV-5 must continue observing the authoritative producer outcome without causing another build');
assert.doesNotMatch(candidate, /Predict EV-6 causal proof reuse in shadow mode/, 'The authoritative producer must not keep a misleading EV-6 real-rerun comparison after EV-18 promotion');
assert.doesNotMatch(candidate, /Compare EV-6 reuse prediction with the real rerun/, 'EV-6 shadow comparison must not claim a rerun when EV-18 may reuse');

assert.match(candidate, /name: ironshade-vector-pr-candidate-web-\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
assert.match(candidate, /uses: \.\/\.github\/workflows\/browser-e2e\.yml/);
assert.match(candidate, /uses: \.\/\.github\/workflows\/pr-android-apk\.yml/);
assert.match(candidate, /candidate_sha: \$\{\{ needs\.candidate-build\.outputs\.candidate-sha \}\}/);
assert.match(candidate, /candidate_artifact_name: \$\{\{ needs\.candidate-build\.outputs\.artifact-name \}\}/);

assert.match(browser, /workflow_call:/, 'Browser E2E must be reusable by the candidate orchestrator');
assert.doesNotMatch(browser, /\n  pull_request:/, 'Browser E2E must not independently trigger on PRs after orchestration cutover');
assert.match(browser, /if: \$\{\{ inputs\.candidate_sha == '' \}\}/, 'Standalone browser producer must be skipped whenever a reusable caller supplies candidate_sha; reusable workflows inherit the caller event name');
assert.doesNotMatch(browser, /if: github\.event_name != 'workflow_call'/, 'Do not use event_name to detect reusable invocation because the called workflow inherits the caller event');
assert.equal(countExactLine(browser, 'run: npm run build'), 1, 'Browser workflow may build once only for standalone push/dispatch runs');
assert.match(browser, /Download exact candidate web bundle/);
assert.match(browser, /candidate-artifact\.mjs validate/);
assert.match(browser, /needs: prepare-browser-candidate/);

assert.match(android, /workflow_call:/, 'Android validation must be reusable by the candidate orchestrator');
assert.match(android, /group: pr-android-\$\{\{ github\.event\.pull_request\.number \|\| inputs\.candidate_sha \}\}/, 'Android reusable workflow must cancel stale validation for the same PR');
assert.doesNotMatch(android, /\n  pull_request:/, 'Android workflow must not independently trigger on PRs after orchestration cutover');
assert.doesNotMatch(android, /npm run verify:full/, 'Android packaging must consume the already verified bundle, not rerun full verification');
assert.doesNotMatch(android, /run: npm run build/, 'Android packaging must not rebuild the candidate web bundle');
assert.match(android, /Download exact candidate web bundle/);
assert.match(android, /candidate-artifact\.mjs validate/);
assert.match(android, /npx cap sync android/);
assert.match(android, /Download PR APK/);
assert.match(android, /sha256sum -c Ironshade-Vector-Android-Smoke\.sha256/);

console.log('CI_PROOF_REUSE_TEST_PASS producer=ev18-closed-proof cache=exact-key fallback=closed rollback=legacy browser=reuses-candidate android=reuses-candidate apk=reused-by-emulators producerConcurrency=job androidConcurrency=pr');
