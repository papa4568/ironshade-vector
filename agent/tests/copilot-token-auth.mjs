import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/agent-orchestration.yml', 'utf8');
const verifier = workflow.split('  automated-independent-verifier:')[1]?.split('  publish-independent-review:')[0] ?? '';
assert.ok(verifier, 'automated verifier job must exist');
assert.doesNotMatch(verifier, /copilot-requests:\s*write/, 'PAT-authenticated verifier must not request Actions Copilot billing permission');
assert.match(verifier, /COPILOT_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.COPILOT_GITHUB_TOKEN\s*\}\}/, 'verifier must use the user-bound Copilot token secret');
assert.match(verifier, /--model auto/, 'verifier must use Copilot auto model selection so free and student plans remain compatible');
assert.doesNotMatch(verifier, /--model gpt-5\.4/, 'verifier must not pin a model unavailable to auto-only Copilot plans');
console.log('COPILOT_TOKEN_AUTH_TEST_PASS');
