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

const graphicsRuntimePrefixes = ['GLTFLoader-', 'KTX2Loader-', 'meshopt_decoder.module-', 'SkeletonUtils-'];
const graphicsRuntimeChunks = jsFiles.filter(name => graphicsRuntimePrefixes.some(prefix => name.startsWith(prefix)));
assert(graphicsRuntimeChunks.length === graphicsRuntimePrefixes.length, `Expected ${graphicsRuntimePrefixes.length} authored-asset runtime chunks; found ${graphicsRuntimeChunks.length}.`);
const graphicsRuntimeStats = graphicsRuntimeChunks.map(name => {
  const file = resolve(assetsDir, name);
  const source = readFileSync(file);
  return { name, raw: statSync(file).size, gzip: gzipSync(source).byteLength };
});
const graphicsRuntimeRaw = graphicsRuntimeStats.reduce((sum, chunk) => sum + chunk.raw, 0);
const graphicsRuntimeGzip = graphicsRuntimeStats.reduce((sum, chunk) => sum + chunk.gzip, 0);
const graphicsManifestKeys = new Set(records
  .filter(([, record]) => graphicsRuntimeChunks.includes(basename(record.file)))
  .map(([key]) => key));
assert([...graphicsManifestKeys].every(key => !bootImports.has(key)), 'Authored-asset loaders must remain deferred from the boot entry.');

assert(entryRaw < 360_000, `Boot entry regressed to ${(entryRaw / 1024).toFixed(1)} KiB; budget is < 351.6 KiB.`);
assert(entryGzip < 110_000, `Boot entry gzip regressed to ${(entryGzip / 1024).toFixed(1)} KiB; budget is < 107.4 KiB.`);
// The production GLTF/KTX2/Meshopt path makes additional Three core exports reachable only after combat starts.
// Keep that deliberate deferred cost bounded separately instead of hiding it in the boot budget.
assert(threeRaw < 620_000, `Combined deferred Three.js + authored-asset core regressed to ${(threeRaw / 1024).toFixed(1)} KiB; budget is < 605.5 KiB.`);
assert(threeGzip < 160_000, `Combined deferred Three.js + authored-asset core gzip regressed to ${(threeGzip / 1024).toFixed(1)} KiB; budget is < 156.3 KiB.`);
assert(threeMaxRaw < 500_000, `Largest Three.js chunk regressed to ${(threeMaxRaw / 1024).toFixed(1)} KiB; budget is < 488.3 KiB.`);
assert(graphicsRuntimeRaw < 150_000, `Deferred authored-asset loaders regressed to ${(graphicsRuntimeRaw / 1024).toFixed(1)} KiB; budget is < 146.5 KiB.`);
assert(graphicsRuntimeGzip < 52_000, `Deferred authored-asset loaders gzip regressed to ${(graphicsRuntimeGzip / 1024).toFixed(1)} KiB; budget is < 50.8 KiB.`);
assert(jsFiles.length >= 10, `Expected navigation, Three.js, and authored-asset code splitting; found only ${jsFiles.length} JS chunks.`);

const chunkStats = jsFiles.map(name => {
  const file = resolve(assetsDir, name);
  const source = readFileSync(file);
  return { name, raw: statSync(file).size, gzip: gzipSync(source).byteLength };
}).sort((a, b) => b.raw - a.raw);

console.log(`CLIENT_BUNDLE_PASS entry=${(entryRaw / 1024).toFixed(1)}KiB gzip=${(entryGzip / 1024).toFixed(1)}KiB chunks=${jsFiles.length} threeTotal=${(threeRaw / 1024).toFixed(1)}KiB/${(threeGzip / 1024).toFixed(1)}KiB threeMax=${(threeMaxRaw / 1024).toFixed(1)}KiB graphicsRuntime=${(graphicsRuntimeRaw / 1024).toFixed(1)}KiB/${(graphicsRuntimeGzip / 1024).toFixed(1)}KiB`);
console.log('CLIENT_BUNDLE_TOP ' + chunkStats.slice(0, 10).map(chunk => `${chunk.name}:${(chunk.raw / 1024).toFixed(1)}KiB/${(chunk.gzip / 1024).toFixed(1)}KiB`).join(' '));
