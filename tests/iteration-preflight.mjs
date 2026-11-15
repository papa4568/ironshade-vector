import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadImpactMap, selectAffectedVerification } from '../agent/tools/select-affected-verification.mjs';
import { collectIterationChangedFiles, parsePreflightArguments, planIterationPreflight, runIterationPreflight } from '../tools/iteration-preflight.mjs';

const focused = {
  mode: 'targeted', files: ['src/game/example.ts'], escalationReasons: [],
  verifications: [
    { id: 'presentation', command: 'npm run test:presentation', cost: 'focused' },
    { id: 'graphics', command: 'npm run test:graphics', cost: 'moderate' },
  ],
};
const full = {
  mode: 'full', files: ['agent/tools/new-tool.mjs'], escalationReasons: ['unclassified file'],
  verifications: [{ id: 'verify-full', command: 'npm run verify:full', cost: 'full' }],
};
assert.deepEqual(parsePreflightArguments(['--base', 'main', '--head', 'HEAD']), {
  base: 'main', head: 'HEAD', files: null, run: false, allowFull: false, json: false,
});
for (const invalid of [[], ['--base','main'], ['--files','a','--base','main','--head','HEAD'], ['--allow-full','--files','a'], ['--files','a','--run','--json'], ['--what']]) {
  assert.throws(() => parsePreflightArguments(invalid));
}
assert.equal(planIterationPreflight(focused).outcome, 'focused-checks');
assert.deepEqual(planIterationPreflight(focused).checks.map(check => check.id), ['presentation', 'graphics']);
assert.equal(planIterationPreflight(full).outcome, 'full-required');
assert.throws(() => planIterationPreflight({ ...full, verifications: [] }), /no command/);
assert.equal(planIterationPreflight({mode:'none',files:['a'],escalationReasons:[],verifications:[]}).outcome, 'no-checks-selected');
const executed = [];
const runner = command => { executed.push(command); return { status: 0 }; };
assert.equal(runIterationPreflight(focused, { runner }), 2);
assert.deepEqual(executed, ['npm run test:presentation', 'npm run test:graphics']);
assert.throws(() => runIterationPreflight(full, { runner }), /full verification required/);
assert.equal(executed.length, 2, 'full verification must never run implicitly');
assert.equal(runIterationPreflight(full, { allowFull: true, runner }), 1);
assert.equal(executed.at(-1), 'npm run verify:full');
assert.throws(() => runIterationPreflight({mode:'none',files:['a'],escalationReasons:[],verifications:[]}, { runner }), /no checks selected/);
const failed = [];
assert.throws(() => runIterationPreflight(focused, { runner: cmd => { failed.push(cmd); return {status:1}; } }), /presentation failed/);
assert.deepEqual(failed, ['npm run test:presentation']);
// Reproduce the EV-16 rollback miss found by independent review: a modified
// normal graphics file plus a deleted high-risk Android file must escalate to
// full verification. Omitting the deletion would incorrectly select targeted.
const fixture = await mkdtemp(join(tmpdir(), 'ironshade-preflight-delete-'));
try {
  const git = (...args) => execFileSync('git', args, { cwd: fixture, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  await mkdir(join(fixture, 'src/game'), { recursive: true });
  await mkdir(join(fixture, 'android/app'), { recursive: true });
  await writeFile(join(fixture, 'src/game/babylonRefineryPresentation.ts'), 'export const version=1;\n');
  await writeFile(join(fixture, 'android/app/build.gradle'), '// baseline\n');
  git('add', '.');
  git('-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'baseline');
  const base = git('rev-parse', 'HEAD');
  await writeFile(join(fixture, 'src/game/babylonRefineryPresentation.ts'), 'export const version=2;\n');
  await rm(join(fixture, 'android/app/build.gradle'));
  git('add', '-A');
  git('-c', 'user.name=CI', '-c', 'user.email=ci@example.test', 'commit', '-qm', 'graphics and android deletion');
  const changed = collectIterationChangedFiles({ base, head: git('rev-parse', 'HEAD'), cwd: fixture });
  assert(changed.includes('android/app/build.gradle'), 'deleted Android source is missing from range collector');
  assert(changed.includes('src/game/babylonRefineryPresentation.ts'), 'modified graphics source missing');
  const map = await loadImpactMap();
  const rollback = { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' };
  const omitted = selectAffectedVerification(changed.filter(path => path !== 'android/app/build.gradle'), map, { env: rollback });
  assert.equal(omitted.mode, 'targeted', 'fixture must actually exercise the previous rollback miss');
  const caught = selectAffectedVerification(changed, map, { env: rollback });
  assert.equal(caught.mode, 'full', 'a deleted high-risk Android path must escalate even with EV-16 rollback');
  assert(caught.escalationReasons.some(reason => reason.includes('high-risk-android')));
  assert.throws(() => runIterationPreflight(caught, { runner }), /full verification required/);
  assert.equal(runIterationPreflight(caught, { allowFull: true, runner }), caught.verifications.length);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
console.log('ITERATION_PREFLIGHT_REGRESSIONS_PASS');
