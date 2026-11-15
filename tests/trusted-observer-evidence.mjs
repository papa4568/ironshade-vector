import assert from 'node:assert/strict';
import { parseObserverReceiptArgs, verifyTrustedObserverEvidence } from '../tools/trusted-observer-evidence.mjs';

const sha = 'a'.repeat(40), base = 'b'.repeat(40), pr = 448;
const marker = 'EV9_TRUSTED_V11_VERIFY_PASS mode=ev18-hardened-steady candidate=' + sha + ' trustedBase=' + base;
const good = {
  runs: [{
    id: 19, workflow_id: 382383641, path: '.github/workflows/ev9-trusted-pr-candidate-observer.yml',
    event: 'pull_request_target', head_sha: sha, status: 'completed', conclusion: 'success',
    pull_requests: [{ number: pr, head: { sha }, base: { sha: base } }],
  }],
  jobs: [{ id: 81, run_id: 19, name: 'verify-pr-candidate', status: 'completed',
    conclusion: 'success', steps: [{ name: 'Verify trusted exact candidate source', conclusion: 'success' }] }],
  logs: '2026-11-15T... ' + marker + '\n',
  sha, base, pr,
};
const evidence = verifyTrustedObserverEvidence(good);
assert.equal(evidence.workflowRunId, 19);
assert.equal(evidence.verificationJobId, 81);
assert.equal(evidence.candidateSha, sha);
assert.equal(evidence.marker, marker);
assert.deepEqual(parseObserverReceiptArgs(['--base', base, '--head', sha, '--pr', '448']), {base,head:sha,pr});
for (const args of [
  [], ['--base', base], ['--base', base, '--head', sha, '--pr', 'oops'],
  ['--base', base, '--head', sha, '--pr', '448', '--pr', '448'],
  ['--base', base, '--head', sha, '--pr', '448', '--bad', 'x'],
]) assert.throws(() => parseObserverReceiptArgs(args));
const reject = patch => assert.throws(() => verifyTrustedObserverEvidence({ ...good, ...patch }));
reject({ runs: [{...good.runs[0], event: 'pull_request'}] });
reject({ runs: [{...good.runs[0], head_sha: base}] });
reject({ runs: [{...good.runs[0], workflow_id: 123}] });
reject({ runs: [{...good.runs[0], status: 'in_progress', conclusion: null}] });
reject({ runs: [{...good.runs[0], conclusion: 'failure'}] });
reject({ runs: [{...good.runs[0], pull_requests: [{number:445,head:{sha},base:{sha:base}}]}] });
reject({ runs: [{...good.runs[0], pull_requests: [{number:pr,head:{sha},base:{sha}}]}] });
reject({ runs: [...good.runs, good.runs[0]] });
reject({ jobs: [{...good.jobs[0], name: 'self-test'}] });
reject({ jobs: [{...good.jobs[0], conclusion: 'skipped'}] });
reject({ jobs: [{...good.jobs[0], run_id: 42}] });
reject({ jobs: [{...good.jobs[0], steps: [{name:'Verify trusted exact candidate source',conclusion:'skipped'}]}] });
reject({ logs: 'EV9_TRUSTED_V11_VERIFY_PASS mode=ev18-hardened-steady candidate=' + base + ' trustedBase=' + base });
console.log('TRUSTED_EV9_EVIDENCE_REGRESSIONS_PASS');
