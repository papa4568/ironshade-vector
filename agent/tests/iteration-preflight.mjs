import assert from 'node:assert/strict';
import { parsePreflightArguments, planIterationPreflight, runIterationPreflight } from '../tools/iteration-preflight.mjs';

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
console.log('ITERATION_PREFLIGHT_REGRESSIONS_PASS');
