from pathlib import Path

path = Path('agent/tools/trusted-independent-review-v4.mjs')
text = path.read_text()

old = '''function requireProducerResults(jobs) {
  ok(latestNamedJob(jobs, 'Candidate Build and Full Verification')?.conclusion === 'success', 'candidate build/full verification did not pass');
  ok(latestNamedJob(jobs, 'Independent Review Context')?.conclusion === 'success', 'independent review context did not pass');
  ok(latestNamedJob(jobs, 'Android PR / Android PR Verification')?.conclusion === 'success', 'Android aggregate verification did not pass');
  const browser = latestNamedJob(jobs, 'Browser E2E');
  ok(browser && ['success', 'skipped'].includes(browser.conclusion), 'browser verification is neither successful nor scope-skipped');
}
'''
new = '''function browserVerificationPassed(jobs) {
  const direct = latestNamedJob(jobs, 'Browser E2E');
  if (direct && ['success', 'skipped'].includes(direct.conclusion)) return true;
  const reusable = jobs
    .filter(job => /^Browser E2E \/ browser-e2e(?: \\(.+\\))?$/.test(job.name ?? ''))
    .sort((left, right) => left.id - right.id);
  return reusable.length > 0 && reusable.every(job => job.conclusion === 'success');
}

function requireProducerResults(jobs) {
  ok(latestNamedJob(jobs, 'Candidate Build and Full Verification')?.conclusion === 'success', 'candidate build/full verification did not pass');
  ok(latestNamedJob(jobs, 'Independent Review Context')?.conclusion === 'success', 'independent review context did not pass');
  ok(latestNamedJob(jobs, 'Android PR / Android PR Verification')?.conclusion === 'success', 'Android aggregate verification did not pass');
  ok(browserVerificationPassed(jobs), 'browser verification is neither successful nor scope-skipped');
}
'''
if text.count(old) != 1:
    raise SystemExit(f'expected one producer-results block, found {text.count(old)}')
text = text.replace(old, new, 1)

anchor = "  ok(evaluateFinalCandidateEvidence(structuredFinal, null, packet.candidateSha).source === 'structured-steps', 'structured technical evidence should remain authoritative');\n\n"
insert = '''  const producerBaseJobs = [
    { id: 1, name: 'Candidate Build and Full Verification', conclusion: 'success' },
    { id: 2, name: 'Independent Review Context', conclusion: 'success' },
    { id: 3, name: 'Android PR / Android PR Verification', conclusion: 'success' },
  ];
  requireProducerResults([...producerBaseJobs, { id: 4, name: 'Browser E2E', conclusion: 'skipped' }]);
  requireProducerResults([
    ...producerBaseJobs,
    { id: 4, name: 'Browser E2E / Prepare Browser Candidate', conclusion: 'skipped' },
    { id: 5, name: 'Browser E2E / browser-e2e (mobile-landscape)', conclusion: 'success' },
    { id: 6, name: 'Browser E2E / browser-e2e (desktop)', conclusion: 'success' },
  ]);
  let reusableBrowserFailureRejected = false;
  try {
    requireProducerResults([
      ...producerBaseJobs,
      { id: 5, name: 'Browser E2E / browser-e2e (mobile-landscape)', conclusion: 'success' },
      { id: 6, name: 'Browser E2E / browser-e2e (desktop)', conclusion: 'failure' },
    ]);
  } catch (error) {
    reusableBrowserFailureRejected = /browser verification/.test(String(error));
  }
  ok(reusableBrowserFailureRejected, 'reusable browser evidence must fail closed when any browser matrix leaf fails');
  let prepareOnlyRejected = false;
  try {
    requireProducerResults([...producerBaseJobs, { id: 4, name: 'Browser E2E / Prepare Browser Candidate', conclusion: 'skipped' }]);
  } catch (error) {
    prepareOnlyRejected = /browser verification/.test(String(error));
  }
  ok(prepareOnlyRejected, 'reusable browser preparation alone must not count as browser verification');

'''
if text.count(anchor) != 1:
    raise SystemExit(f'expected one self-test anchor, found {text.count(anchor)}')
text = text.replace(anchor, anchor + insert, 1)
path.write_text(text)
