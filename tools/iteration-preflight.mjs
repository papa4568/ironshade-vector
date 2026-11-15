import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadImpactMap, selectAffectedVerification } from '../agent/tools/select-affected-verification.mjs';
import { collectReviewChangedFiles } from './review-scope.mjs';

// Keep deletions and rename source paths: absent high-risk files must still
// trigger the same full-verification fallback as modified high-risk files.
export const collectIterationChangedFiles = collectReviewChangedFiles;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parsePreflightArguments(argv) {
  const options = { base: null, head: null, files: null, run: false, allowFull: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--base', '--head', '--files'].includes(arg)) {
      assert(argv[i + 1] && !argv[i + 1].startsWith('--'), arg + ' needs a value');
      options[arg.slice(2)] = argv[++i];
    } else if (arg === '--run') options.run = true;
    else if (arg === '--allow-full') options.allowFull = true;
    else if (arg === '--json') options.json = true;
    else throw new Error('unknown argument ' + arg);
  }
  const usingFiles = options.files !== null;
  const usingRange = options.base !== null || options.head !== null;
  assert(usingFiles !== usingRange, 'provide either --files or both --base and --head');
  if (usingRange) assert(options.base && options.head, '--base and --head must be supplied together');
  assert(!options.json || !options.run, '--json cannot be combined with --run');
  assert(!options.allowFull || options.run, '--allow-full requires --run');
  return options;
}

export function planIterationPreflight(selection) {
  assert(selection && ['full', 'targeted', 'none'].includes(selection.mode), 'invalid affected-verification selection');
  const checks = selection.verifications.map(({ id, command, cost }) => ({ id, command, cost }));
  assert(selection.mode === 'none' || checks.length > 0, 'selected verification has no command');
  return {
    mode: selection.mode,
    outcome: selection.mode === 'full' ? 'full-required' : selection.mode === 'targeted' ? 'focused-checks' : 'no-checks-selected',
    changedFiles: selection.files,
    escalationReasons: selection.escalationReasons,
    checks,
    note: 'Iteration aid only; exact-candidate build, browser, Android/APK, visuals, security, and independent review remain mandatory when applicable.',
  };
}

export function runIterationPreflight(selection, { allowFull = false, runner = spawnSync } = {}) {
  const plan = planIterationPreflight(selection);
  if (plan.mode === 'full' && !allowFull) {
    throw new Error('full verification required; rerun --run --allow-full only for a credible candidate: ' + plan.escalationReasons.join(' | '));
  }
  if (plan.mode === 'none') throw new Error('no checks selected; inspect impact coverage instead of claiming success');
  for (const check of plan.checks) {
    const result = runner(check.command, { shell: true, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('verification ' + check.id + ' failed (exit ' + (result.status ?? 'unknown') + '): ' + check.command);
  }
  return plan.checks.length;
}

async function main() {
  const options = parsePreflightArguments(process.argv.slice(2));
  const files = options.files !== null
    ? options.files.split(',').map(file => file.trim()).filter(Boolean)
    : collectIterationChangedFiles({ base: options.base, head: options.head });
  assert(files.length > 0, 'no changed files to inspect');
  const selection = selectAffectedVerification(files, await loadImpactMap());
  const plan = planIterationPreflight(selection);
  if (options.json) return void console.log(JSON.stringify(plan, null, 2));
  console.log('ITERATION_PREFLIGHT mode=' + plan.mode + ' outcome=' + plan.outcome + ' files=' + plan.changedFiles.length);
  for (const reason of plan.escalationReasons) console.log('ITERATION_ESCALATION ' + reason);
  for (const check of plan.checks) console.log('ITERATION_CHECK ' + check.id + ' ' + check.command);
  console.log(plan.note);
  if (options.run) {
    const count = runIterationPreflight(selection, { allowFull: options.allowFull });
    console.log('ITERATION_CHECKS_PASSED count=' + count + '; final candidate gates still required');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('ITERATION_PREFLIGHT_ERROR ' + error.message);
    process.exitCode = 1;
  });
}
