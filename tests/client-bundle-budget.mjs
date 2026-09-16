import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const manifestPath = resolve(root, 'dist/.vite/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const records = Object.entries(manifest);
const entryRecord = records.find(([, record]) => record.isEntry);
assert(entryRecord, 'Production manifest has no entry chunk.');
const [, entry] = entryRecord;
const dynamic = records.filter(([, record]) => record.isDynamicEntry);
const dynamicKeys = dynamic.map(([key]) => key);
for (const expected of ['src/components/ShipHub.tsx', 'src/components/Armory.tsx', 'src/components/GameCanvas.tsx']) {
  assert(dynamicKeys.includes(expected), `${expected} is no longer emitted as a dynamic entry.`);
}

const assetsDir = resolve(root, 'dist/assets');
const jsFiles = readdirSync(assetsDir).filter(name => name.endsWith('.js'));
const entryPath = resolve(root, 'dist', entry.file);
const entrySource = readFileSync(entryPath);
const entryRaw = statSync(entryPath).size;
const entryGzip = gzipSync(entrySource).byteLength;
const threeChunk = jsFiles.find(name => name.startsWith('three-runtime-'));
assert(threeChunk, 'Three.js is not isolated in a deferred runtime chunk.');
assert(entryRaw < 700_000, `Boot entry regressed to ${(entryRaw / 1024).toFixed(1)} KiB; budget is < 683.6 KiB.`);
assert(entryGzip < 220_000, `Boot entry gzip regressed to ${(entryGzip / 1024).toFixed(1)} KiB; budget is < 214.8 KiB.`);
assert(jsFiles.length >= 5, `Expected navigation-level code splitting; found only ${jsFiles.length} JS chunks.`);

const chunkStats = jsFiles.map(name => {
  const file = resolve(assetsDir, name);
  const source = readFileSync(file);
  return { name, raw: statSync(file).size, gzip: gzipSync(source).byteLength };
}).sort((a, b) => b.raw - a.raw);

console.log(`CLIENT_BUNDLE_PASS entry=${(entryRaw / 1024).toFixed(1)}KiB gzip=${(entryGzip / 1024).toFixed(1)}KiB chunks=${jsFiles.length} three=${threeChunk}`);
console.log('CLIENT_BUNDLE_TOP ' + chunkStats.slice(0, 5).map(chunk => `${chunk.name}:${(chunk.raw / 1024).toFixed(1)}KiB/${(chunk.gzip / 1024).toFixed(1)}KiB`).join(' '));
