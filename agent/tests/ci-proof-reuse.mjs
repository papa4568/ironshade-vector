import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [candidate, browser, android] = await Promise.all([
  readFile('.github/workflows/pr-candidate.yml', 'utf8'),
  readFile('.github/workflows/browser-e2e.yml', 'utf8'),
  readFile('.github/workflows/pr-android-apk.yml', 'utf8'),
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
assert.equal(
  countMatchingTrimmedLines(candidate, /^npm run build(?:\s+2>&1\s+\|\s+tee\s+\.agent-impact-calibration\/full-verification\.log)?$/),
  1,
  'PR candidate workflow must have exactly one full build producer',
);
assert.match(candidate, /Run full repository verification and production build once[\s\S]*set -o pipefail[\s\S]*npm run build 2>&1 \| tee \.agent-impact-calibration\/full-verification\.log/, 'The one authoritative full build may be observed through tee only when pipefail preserves its failure status');
assert.match(candidate, /Capture EV-5 impact-map calibration shadow evidence[\s\S]*if: always\(\)[\s\S]*impact-map-calibration\.mjs observe/, 'EV-5 must observe both successful and failed full-build outcomes without adding a second build');
assert.match(candidate, /Predict EV-6 causal proof reuse in shadow mode[\s\S]*continue-on-error: true[\s\S]*causal-proof-cache\.mjs predict[\s\S]*--proof full-repository-build/, 'EV-6 must predict reuse before the authoritative proof while remaining shadow-only');
assert.match(candidate, /Compare EV-6 reuse prediction with the real rerun[\s\S]*if: always\(\)[\s\S]*causal-proof-cache\.mjs observe[\s\S]*FULL_VERIFICATION_OUTCOME/, 'EV-6 must compare its prediction with the proof that actually reran');
assert.match(candidate, /Upload EV-6 causal proof cache advisory evidence[\s\S]*causal-proof-cache-\$\{\{ github\.event\.pull_request\.number \}\}-\$\{\{ github\.event\.pull_request\.head\.sha \}\}/, 'EV-6 evidence must remain exact-candidate named advisory output');
assert(candidate.indexOf('Predict EV-6 causal proof reuse in shadow mode') < candidate.indexOf('Run full repository verification and production build once'), 'EV-6 reuse prediction must be made before the real proof runs');
assert(candidate.indexOf('Run full repository verification and production build once') < candidate.indexOf('Compare EV-6 reuse prediction with the real rerun'), 'EV-6 comparison must happen only after the real proof reruns');
assert.doesNotMatch(candidate, /npm run verify:full/, 'PR candidate workflow must not add a second explicit full verification run');
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

console.log('CI_PROOF_REUSE_TEST_PASS prFullBuilds=1 fullBuildLogging=pipefail ev6Prediction=shadow-before-proof ev6Comparison=real-rerun browser=reuses-candidate android=reuses-candidate apk=reused-by-emulators reusableGuard=input producerConcurrency=job androidConcurrency=pr');
