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

assert.match(candidate, /name: PR Candidate Verification/);
assert.match(candidate, /pull_request:/);
assert.equal(countExactLine(candidate, 'run: npm run build'), 1, 'PR candidate workflow must have exactly one full build producer');
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
assert.doesNotMatch(android, /\n  pull_request:/, 'Android workflow must not independently trigger on PRs after orchestration cutover');
assert.doesNotMatch(android, /npm run verify:full/, 'Android packaging must consume the already verified bundle, not rerun full verification');
assert.doesNotMatch(android, /run: npm run build/, 'Android packaging must not rebuild the candidate web bundle');
assert.match(android, /Download exact candidate web bundle/);
assert.match(android, /candidate-artifact\.mjs validate/);
assert.match(android, /npx cap sync android/);
assert.match(android, /Download PR APK/);
assert.match(android, /sha256sum -c Ironshade-Vector-Android-Smoke\.sha256/);

console.log('CI_PROOF_REUSE_TEST_PASS prFullBuilds=1 browser=reuses-candidate android=reuses-candidate apk=reused-by-emulators reusableGuard=input');
