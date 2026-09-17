import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { basename, resolve } from 'node:path';

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

const threeChunks = jsFiles.filter(name => name.startsWith('three-core-') || name.startsWith('three-webgl-'));
assert(threeChunks.some(name => name.startsWith('three-core-')), 'Three.js core is not isolated in its deferred chunk.');
assert(threeChunks.some(name => name.startsWith('three-webgl-')), 'Three.js WebGL renderer is not isolated in its deferred chunk.');
assert(threeChunks.length === 2, `Expected exactly two Three.js runtime chunks; found ${threeChunks.length}.`);

const threeStats = threeChunks.map(name => {
  const file = resolve(assetsDir, name);
  const source = readFileSync(file);
  return { name, raw: statSync(file).size, gzip: gzipSync(source).byteLength };
});
const threeRaw = threeStats.reduce((sum, chunk) => sum + chunk.raw, 0);
const threeGzip = threeStats.reduce((sum, chunk) => sum + chunk.gzip, 0);
const threeMaxRaw = Math.max(...threeStats.map(chunk => chunk.raw));

const threeManifestKeys = new Set(records
  .filter(([, record]) => threeChunks.includes(basename(record.file)))
  .map(([key]) => key));
const bootImports = new Set(entry.imports ?? []);
assert([...threeManifestKeys].every(key => !bootImports.has(key)), 'Three.js runtime is no longer deferred from the boot entry.');

assert(entryRaw < 360_000, `Boot entry regressed to ${(entryRaw / 1024).toFixed(1)} KiB; budget is < 351.6 KiB.`);
assert(entryGzip < 110_000, `Boot entry gzip regressed to ${(entryGzip / 1024).toFixed(1)} KiB; budget is < 107.4 KiB.`);
assert(threeRaw < 550_000, `Combined deferred Three.js runtime regressed to ${(threeRaw / 1024).toFixed(1)} KiB; budget is < 537.1 KiB.`);
assert(threeGzip < 140_000, `Combined deferred Three.js gzip regressed to ${(threeGzip / 1024).toFixed(1)} KiB; budget is < 136.7 KiB.`);
assert(threeMaxRaw < 500_000, `Largest Three.js chunk regressed to ${(threeMaxRaw / 1024).toFixed(1)} KiB; budget is < 488.3 KiB.`);
assert(jsFiles.length >= 6, `Expected navigation and Three.js code splitting; found only ${jsFiles.length} JS chunks.`);

const chunkStats = jsFiles.map(name => {
  const file = resolve(assetsDir, name);
  const source = readFileSync(file);
  return { name, raw: statSync(file).size, gzip: gzipSync(source).byteLength };
}).sort((a, b) => b.raw - a.raw);

console.log(`CLIENT_BUNDLE_PASS entry=${(entryRaw / 1024).toFixed(1)}KiB gzip=${(entryGzip / 1024).toFixed(1)}KiB chunks=${jsFiles.length} threeTotal=${(threeRaw / 1024).toFixed(1)}KiB/${(threeGzip / 1024).toFixed(1)}KiB threeMax=${(threeMaxRaw / 1024).toFixed(1)}KiB`);
console.log('CLIENT_BUNDLE_TOP ' + chunkStats.slice(0, 6).map(chunk => `${chunk.name}:${(chunk.raw / 1024).toFixed(1)}KiB/${(chunk.gzip / 1024).toFixed(1)}KiB`).join(' '));
