import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const WORKFLOW_PATH = '.github/workflows/pr-candidate.yml';
const PR_HEAD = '${{ github.event.pull_request.head.sha }}';
const EV9_GATE_ARTIFACT = 'evidence-independence-gate-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}';
const EV9_REGRESSION_SCRIPT = [
  'node agent/tests/evidence-independence-promotion.mjs',
  'node agent/tests/pr-candidate-head-observer.mjs',
];
const EV9_GATE_SCRIPT = [
  'node agent/tools/evidence-independence-promotion-gate.mjs gate \\',
  '--candidate-sha "$CANDIDATE_SHA" \\',
  '--graph agent/evidence-independence.json \\',
  '--policy agent/evidence-independence-policy.json \\',
  '--output .agent-independence/promotion-gate.json',
];

function integrationBlock() {
  return [
    '      - name: Run promoted causal evidence independence regressions',
    '        run: |',
    ...EV9_REGRESSION_SCRIPT.map(line => `          ${line}`),
    '',
    '      - name: Enforce promoted causal evidence independence scope',
    '        env:',
    `          CANDIDATE_SHA: ${PR_HEAD}`,
    '        run: |',
    ...EV9_GATE_SCRIPT.map(line => `          ${line}`),
    '',
    '      - name: Upload promoted causal evidence independence exact-SHA evidence',
    '        uses: actions/upload-artifact@v7',
    '        with:',
    `          name: ${EV9_GATE_ARTIFACT}`,
    '          path: .agent-independence/promotion-gate.json',
    '          if-no-files-found: error',
    '          include-hidden-files: true',
    '          retention-days: 30',
    '',
  ].join('\n');
}

function insertIntegrationAfterUpload(workflowText) {
  const marker = '\n  independent-review-context:';
  const index = workflowText.indexOf(marker);
  assert.notEqual(index, -1, 'v10 lifecycle self-test independent-review-context marker missing');
  return `${workflowText.slice(0, index)}\n${integrationBlock()}${workflowText.slice(index)}`;
}

function normalizeLifecycleFixture(workflowText) {
  const block = integrationBlock();
  const first = workflowText.indexOf(block);
  if (first < 0) return { workflowText, hadIntegration: false };
  const second = workflowText.indexOf(block, first + block.length);
  assert.equal(second, -1, 'v10 lifecycle self-test requires at most one exact EV-9 integration block');
  const before = workflowText.slice(0, first);
  const after = workflowText.slice(first + block.length);
  assert.equal(
    before.endsWith('\n') && after.startsWith('  independent-review-context:'),
    true,
    'v10 lifecycle self-test only strips the exact reviewed EV-9 block at the candidate-build publication boundary',
  );
  return {
    workflowText: `${before}${after}`,
    hadIntegration: true,
  };
}

async function loadV8() {
  const command = process.argv[2];
  process.argv[2] = '__ev9_v10_import__';
  try {
    return await import('./ev9-trusted-pr-candidate-observer-v8.mjs');
  } finally {
    process.argv[2] = command;
  }
}

export async function selfTest() {
  const original = readFileSync(WORKFLOW_PATH, 'utf8');
  const normalized = normalizeLifecycleFixture(original);
  const syntheticIntegrated = insertIntegrationAfterUpload(normalized.workflowText);
  const syntheticRoundTrip = normalizeLifecycleFixture(syntheticIntegrated);
  assert.equal(syntheticRoundTrip.hadIntegration, true, 'v10 lifecycle self-test must recognize the exact reviewed EV-9 integration block');
  assert.equal(syntheticRoundTrip.workflowText, normalized.workflowText, 'v10 lifecycle self-test must round-trip the exact reviewed EV-9 integration block');
  if (normalized.hadIntegration) {
    assert.equal(syntheticIntegrated, original, 'v10 lifecycle normalization must restore an already-integrated candidate byte-for-byte');
  }

  const v8 = await loadV8();
  try {
    writeFileSync(WORKFLOW_PATH, normalized.workflowText, 'utf8');
    await v8.selfTest();
  } finally {
    writeFileSync(WORKFLOW_PATH, original, 'utf8');
  }

  console.log(`EV9_TRUSTED_PR_CANDIDATE_OBSERVER_V10_SELF_TEST_PASS lifecycleNormalized=${normalized.hadIntegration ? 'integrated' : 'baseline'} verifySemantics=v8-delegated`);
}

export async function verify() {
  const v8 = await loadV8();
  await v8.verify();
}

const command = process.argv[2];
if (command === 'self-test') await selfTest();
else if (command === 'verify') await verify();
else if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  throw new Error('usage: node agent/tools/ev9-trusted-pr-candidate-observer-v10.mjs <self-test|verify>');
}
