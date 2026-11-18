// AO-19: exact-object, one-PR product-regression review exception.
// This file is staged as untrusted review data until a separate owner-authenticated
// trusted-main promotion copies the exact reviewed blob into protected agent/tools/.
// No code in the candidate PR may authorize its own review.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const HOTFIX_PR = 449;
export const HOTFIX_TASK_ID = 'P28-F6';
export const HOTFIX_BRANCH = 'fix/p28f6-resume-touch-fire-fallback';
export const HOTFIX_REPO = 'papa4568/ironshade-vector';
export const HOTFIX_BLOBS = Object.freeze({
  'src/components/GameCanvas.tsx': '61472f987bc30d4b954e3e433f04943ce2c59aae',
  'src/game/combatInputCapabilities.ts': '280ccff293bf497c0e678af1d42d738caa56b88f',
  'tests/combat-input-capabilities.ts': 'b15ff1982ac3d460df5c3d0ed85cb2b677d06d64',
  'tests/gameplay-regressions.ts': 'a6090b087b7f123f7edd6d082c457212c9b44c30',
  'tests/hud-layout-presets.ts': '24b11224b931cdc95c31df6375a2b4f5456ff134',
});
const SHA = /^[0-9a-f]{40}$/;
const FILES = Object.keys(HOTFIX_BLOBS).sort();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const checkSha = (value, label) => assert(SHA.test(value ?? ''), label + ' must be a full Git SHA');

export const HOTFIX_TASK = Object.freeze({
  id: HOTFIX_TASK_ID,
  title: 'P28-F6 narrowly pinned Android post-resume FIRE regression repair (not P28-G9)',
  status: 'verifying',
  affectedDomains: ['combat-input', 'android-lifecycle', 'regressions'],
  acceptance: [
    'Only PR #449 on the exact reviewed five 100644 product/test blob objects may use this isolated P28-F6 review contract; no unrelated changes, roadmap changes, reviewer source edits, or workflow edits are eligible.',
    'When Android HOME/WebView resumes after a slow frame and no assisted target is locked, a physical FIRE touch produces a real manual projectile and increments simulation shot telemetry; an acquired target still fires using the original assisted targeting.',
    'Both immediate and held FIRE paths use the same fallback; gameplay and HUD regressions preserve targeting, occlusion, boss gating and control interactions.',
    'The exact candidate passes full repository build, desktop/mobile browser journeys, Android debug APK and API 35/36 including Babylon renderer reentry, mission reentry, heavy-cache preservation and genuine post-resume touch FIRE.',
    'EV-9 protected source/producer security and Agent Orchestration remain intact; a trusted independent verifier judges this P28-F6 hotfix without passing or closing P28-G9 Parallax Array.',
    'This route is inert for any other PR, changed blob, changed scope, or non-open pull request. It grants neither owner permission to merge nor Android release signing.'
  ],
  proofs: [
    { id: 'real-fire-regressions', kind: 'test', required: true, description: 'Exact-head gameplay, HUD and input regressions include real simulated projectile/telemetry and assisted-lock checks.' },
    { id: 'closed-full-build', kind: 'build', required: true, description: 'Authoritative exact-head full repository proof succeeds.' },
    { id: 'browser-both', kind: 'ci', required: true, description: 'Desktop and mobile-landscape browser E2E succeed on the exact candidate.' },
    { id: 'android-api35-36', kind: 'artifact', required: true, description: 'Same exact candidate APK passes Android API35 real post-resume FIRE and API36 large-screen verification.' },
    { id: 'security-boundaries', kind: 'invariant', required: true, description: 'Trusted-base EV-9 and orchestration validations pass; no candidate-authored trusted reviewer code changes.' },
    { id: 'independent-hotfix-review', kind: 'review', required: true, description: 'Read-only trusted-main reviewer verifies P28-F6 hotfix contract on exact SHA, not unfinished P28-G9.' },
  ],
});

export function verifyPinnedHotfixIdentity({ prNumber, repo, state = 'open', branch, baseSha, headSha, files }) {
  assert(prNumber === HOTFIX_PR, 'only reviewed PR #449 is eligible');
  assert(repo === HOTFIX_REPO, 'review repository mismatch');
  assert(state === 'open', 'hotfix route only applies to an open PR');
  assert(branch === HOTFIX_BRANCH, 'hotfix source branch mismatch');
  checkSha(baseSha, 'trusted PR base');
  checkSha(headSha, 'exact candidate head');
  assert(baseSha !== headSha, 'no patch from base to head');
  assert(Array.isArray(files) && files.length === FILES.length, 'hotfix file count mismatch');
  assert(same([...files.map(f => f.path)].sort(), FILES), 'hotfix changed path inventory drift');
  for (const f of files) {
    assert(f.status === 'modified', 'hotfix files must be modifications, not additions/renames/removals');
    assert(f.mode === '100644' && f.type === 'blob', 'hotfix Git mode/type must remain a 100644 blob');
    assert(f.sha === HOTFIX_BLOBS[f.path], 'unreviewed hotfix file object: ' + f.path);
  }
  return HOTFIX_TASK;
}

function command(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
export function verifyPinnedHotfixGit({ baseRef, headRef, event }) {
  assert(event?.action !== 'closed', 'closed PR event is not a hotfix review');
  const pr = event?.pull_request;
  assert(pr && (event.number === HOTFIX_PR || pr.number === HOTFIX_PR), 'hotfix PR event is missing');
  assert(pr.base?.ref === 'main', 'hotfix must target main');
  assert(pr.base?.sha === baseRef && pr.head?.sha === headRef, 'event base/head differs from Git checkout');
  assert(pr.head?.repo?.full_name === HOTFIX_REPO, 'hotfix PR must originate in reviewed repository');
  command(['merge-base', '--is-ancestor', baseRef, headRef]);
  const changed = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', baseRef, headRef], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean).sort();
  const files = changed.map(path => {
    const raw = command(['ls-tree', headRef, '--', path]);
    const match = raw.match(/^(\d+)\s+(\w+)\s+([a-f0-9]{40})\t(.+)$/);
    assert(match && match[4] === path, 'hotfix target file absent: ' + path);
    const fromBase = command(['ls-tree', baseRef, '--', path]);
    assert(fromBase, 'hotfix path did not exist in trusted base: ' + path);
    return { path, mode: match[1], type: match[2], sha: match[3], status: 'modified' };
  });
  return verifyPinnedHotfixIdentity({
    prNumber: HOTFIX_PR, repo: pr.head.repo.full_name, state: pr.state ?? 'open',
    branch: pr.head.ref, baseSha: baseRef, headSha: headRef, files,
  });
}

function eventAtPath(path) {
  if (!path) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function maybePinnedHotfixReview({ baseRef, headRef, eventPath }) {
  const event = eventAtPath(eventPath);
  const prNumber = event?.pull_request?.number ?? event?.number;
  if (!event?.pull_request || prNumber !== HOTFIX_PR) return null;
  assert(baseRef && headRef, 'exact hotfix review requires base and head Git refs');
  verifyPinnedHotfixGit({ baseRef, headRef, event });
  return { taskId: HOTFIX_TASK_ID, source: 'agent/tools/p28f6-hotfix-review-contract.mjs', mode: 'product-hotfix' };
}
export function candidatePinnedHotfixTask({ baseRef, eventPath }) {
  const headRef = command(['rev-parse', 'HEAD']);
  const selection = maybePinnedHotfixReview({ baseRef, headRef, eventPath });
  assert(selection?.taskId === HOTFIX_TASK_ID, 'candidate has no authorized P28-F6 hotfix review identity');
  return HOTFIX_TASK;
}
export function verifyPinnedHotfixPull({ pull, files, candidateSha, baseSha, headTree }) {
  assert(pull?.number === HOTFIX_PR && pull?.base?.ref === 'main', 'trusted reviewer PR/base mismatch');
  assert(pull.head?.repo?.full_name === HOTFIX_REPO, 'trusted reviewer source repository mismatch');
  assert(pull.base.sha === baseSha && pull.head.sha === candidateSha, 'trusted reviewer exact SHA/base mismatch');
  assert(pull.head.ref === HOTFIX_BRANCH, 'trusted reviewer branch mismatch');
  assert(pull.state === 'open', 'cannot review a closed hotfix');
  assert(headTree?.truncated === false && Array.isArray(headTree.tree), 'trusted reviewer needs complete Git object tree');
  const entries = new Map(headTree.tree.map(entry => [entry.path, entry]));
  verifyPinnedHotfixIdentity({
    prNumber: pull.number, repo: pull.head.repo.full_name, state: pull.state,
    branch: pull.head.ref, baseSha, headSha: candidateSha,
    files: files.map(file => {
      const entry = entries.get(file.filename);
      assert(entry && entry.sha === file.sha, 'GitHub file listing differs from exact candidate Git tree');
      return { path: file.filename, mode: entry.mode, type: entry.type, sha: entry.sha, status: file.status };
    }),
  });
  return HOTFIX_TASK;
}
