import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  collectChangedFiles,
  globToRegExp,
  loadImpactMap,
  matchesGlob,
  selectAffectedVerification,
  validateImpactMap,
} from '../tools/select-affected-verification.mjs';

const impactMap = await loadImpactMap(resolve('agent/impact-map.json'));
const summary = validateImpactMap(impactMap);
assert(summary.ruleCount >= 10);
assert(summary.verificationCount >= 10);

assert(matchesGlob('agent/tools/example.mjs', 'agent/**'));
assert(matchesGlob('src/game/babylonCombatRenderer.ts', 'src/game/*.ts'));
assert(matchesGlob('vite.service.config.ts', 'vite*.config.*'));
assert(!matchesGlob('src/game/deep/example.ts', 'src/game/*.ts'));
assert(globToRegExp('public/assets/models/**').test('public/assets/models/refinery/processor.glb'));

const graphicsSelection = selectAffectedVerification([
  'src/game/graphicsAssetManifest.ts',
  'scripts/prepare-refinery-premium-surfaces.mjs',
], impactMap);
assert.equal(graphicsSelection.mode, 'targeted');
assert.equal(graphicsSelection.escalated, false);
assert.deepEqual(graphicsSelection.unknownFiles, []);
assert(graphicsSelection.domains.includes('graphics'));
assert(graphicsSelection.domains.includes('assets'));
assert.deepEqual(graphicsSelection.verifications.map(check => check.id), ['graphics-content', 'graphics-babylon']);

const refineryPresentationSelection = selectAffectedVerification([
  'src/game/babylonRefineryPresentation.ts',
], impactMap);
assert.equal(refineryPresentationSelection.mode, 'targeted');
assert(refineryPresentationSelection.domains.includes('refinery'));
assert(refineryPresentationSelection.verifications.some(check => check.id === 'refinery-lighting'));
assert(refineryPresentationSelection.verifications.some(check => check.id === 'refinery-post-processing'));
assert(!refineryPresentationSelection.verifications.some(check => check.id === 'graphics-content'));

const docsSelection = selectAffectedVerification([
  'docs/content-roadmap-archive.md',
  'docs/product-constraints.md',
], impactMap);
assert.equal(docsSelection.mode, 'none');
assert.equal(docsSelection.escalated, false);
assert.deepEqual(docsSelection.verifications, []);
assert.deepEqual(docsSelection.domains, ['documentation']);

const roadmapSelection = selectAffectedVerification(['docs/content-roadmap.md'], impactMap);
assert.equal(roadmapSelection.mode, 'targeted');
assert.deepEqual(roadmapSelection.verifications.map(check => check.id), ['roadmap-adapter']);

const unknownSelection = selectAffectedVerification(['mystery/new-subsystem.xyz'], impactMap);
assert.equal(unknownSelection.mode, 'full');
assert.equal(unknownSelection.escalated, true);
assert.deepEqual(unknownSelection.unknownFiles, ['mystery/new-subsystem.xyz']);
assert.deepEqual(unknownSelection.verifications.map(check => check.id), ['verify-full']);
assert(unknownSelection.escalationReasons[0].includes('unclassified files'));

const highRiskSelection = selectAffectedVerification(['package.json'], impactMap);
assert.equal(highRiskSelection.mode, 'full');
assert.equal(highRiskSelection.escalated, true);
assert.deepEqual(highRiskSelection.verifications.map(check => check.id), ['verify-full']);
assert(highRiskSelection.domains.includes('dependencies'));

const mixedHighRiskSelection = selectAffectedVerification([
  'src/game/graphicsAssetManifest.ts',
  '.github/workflows/browser-e2e.yml',
], impactMap);
assert.equal(mixedHighRiskSelection.mode, 'full');
assert.deepEqual(mixedHighRiskSelection.verifications.map(check => check.id), ['verify-full']);
assert(mixedHighRiskSelection.matchedRuleIds.includes('graphics-assets-and-generators'));
assert(mixedHighRiskSelection.matchedRuleIds.includes('high-risk-ci'));

const orderA = selectAffectedVerification([
  'src/game/graphicsAssetManifest.ts',
  'docs/product-constraints.md',
  'scripts/prepare-refinery-premium-surfaces.mjs',
], impactMap);
const orderB = selectAffectedVerification([
  'scripts/prepare-refinery-premium-surfaces.mjs',
  'src/game/graphicsAssetManifest.ts',
  'docs/product-constraints.md',
], impactMap);
assert.deepEqual(orderA, orderB);

const malformed = structuredClone(impactMap);
malformed.rules[0].verificationIds = ['missing-check'];
assert.throws(() => validateImpactMap(malformed), /references unknown verification missing-check/);

const gitFixture = await mkdtemp(join(tmpdir(), 'ironshade-impact-'));
try {
  execFileSync('git', ['init'], { cwd: gitFixture, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'impact@example.invalid'], { cwd: gitFixture });
  execFileSync('git', ['config', 'user.name', 'Impact Test'], { cwd: gitFixture });
  await mkdir(join(gitFixture, 'src/game'), { recursive: true });
  await writeFile(join(gitFixture, 'src/game/graphicsAssetManifest.ts'), 'export const value = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: gitFixture });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: gitFixture, stdio: 'ignore' });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: gitFixture, encoding: 'utf8' }).trim();

  await writeFile(join(gitFixture, 'src/game/graphicsAssetManifest.ts'), 'export const value = 2;\n');
  await mkdir(join(gitFixture, 'docs'), { recursive: true });
  await writeFile(join(gitFixture, 'docs/product-constraints.md'), '# changed\n');
  execFileSync('git', ['add', '.'], { cwd: gitFixture });
  execFileSync('git', ['commit', '-m', 'head'], { cwd: gitFixture, stdio: 'ignore' });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: gitFixture, encoding: 'utf8' }).trim();

  assert.deepEqual(
    collectChangedFiles({ base, head, cwd: gitFixture }).sort(),
    ['docs/product-constraints.md', 'src/game/graphicsAssetManifest.ts'],
  );
} finally {
  await rm(gitFixture, { recursive: true, force: true });
}

console.log(`AFFECTED_VERIFICATION_TEST_PASS rules=${summary.ruleCount} verifications=${summary.verificationCount} graphicsChecks=${graphicsSelection.verifications.length} refineryChecks=${refineryPresentationSelection.verifications.length} unknownMode=${unknownSelection.mode} gitDiff=pass`);
