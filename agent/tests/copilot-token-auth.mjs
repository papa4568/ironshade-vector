import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/agent-orchestration.yml', 'utf8');
const verifier = workflow.split('  automated-independent-verifier:')[1]?.split('  publish-independent-review:')[0] ?? '';
assert.ok(verifier, 'automated verifier job must exist');
assert.doesNotMatch(verifier, /copilot-requests:\s*write/, 'PAT-authenticated verifier must not request Actions Copilot billing permission');
assert.match(verifier, /COPILOT_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.COPILOT_GITHUB_TOKEN\s*\}\}/, 'verifier must use the user-bound Copilot token secret');
console.log('COPILOT_TOKEN_AUTH_TEST_PASS');
