import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const api = readFileSync('netlify/functions/api.ts', 'utf8');
assert.match(api, /getWithMetadata\(METRICS_KEY/, 'metrics update must read an ETag before writing');
assert.match(api, /onlyIfMatch: version\.etag/, 'existing metrics writes must be conditional');
assert.match(api, /onlyIfNew: true/, 'first metrics write must be create-only');
assert.match(api, /Metrics update contention exceeded retry budget/, 'metrics update must fail rather than silently lose a contended write');
assert.equal(existsSync('.github/workflows/fix-three-objective-beacon.yml'), false, 'completed objective-beacon migration workflow must stay retired');
assert.equal(existsSync('scripts/apply-three-objective-beacon.mjs'), false, 'completed objective-beacon migration script must stay retired');
console.log('SERVICE_REGRESSIONS_PASS metrics=conditional staleMigration=removed');
