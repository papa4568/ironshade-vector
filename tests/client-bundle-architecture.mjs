import { readFileSync, readdirSync } from 'node:fs';
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
const threeChunks = jsFiles.filter(name => name.startsWith('three-core-') || name.startsWith('three-webgl-'));
assert(threeChunks.some(name => name.startsWith('three-core-')), 'Three.js core is not isolated in its deferred chunk.');
assert(threeChunks.some(name => name.startsWith('three-webgl-')), 'Three.js WebGL renderer is not isolated in its deferred chunk.');
assert(threeChunks.length === 2, `Expected exactly two Three.js runtime chunks; found ${threeChunks.length}.`);

const threeManifestKeys = new Set(records
  .filter(([, record]) => threeChunks.includes(basename(record.file)))
  .map(([key]) => key));
const bootImports = new Set(entry.imports ?? []);
assert([...threeManifestKeys].every(key => !bootImports.has(key)), 'Three.js runtime is no longer deferred from the boot entry.');

const graphicsRuntimePrefixes = ['GLTFLoader-', 'KTX2Loader-', 'meshopt_decoder.module-', 'SkeletonUtils-'];
const graphicsRuntimeChunks = jsFiles.filter(name => graphicsRuntimePrefixes.some(prefix => name.startsWith(prefix)));
assert(graphicsRuntimeChunks.length === graphicsRuntimePrefixes.length, `Expected ${graphicsRuntimePrefixes.length} authored-asset runtime chunks; found ${graphicsRuntimeChunks.length}.`);

const graphicsManifestKeys = new Set(records
  .filter(([, record]) => graphicsRuntimeChunks.includes(basename(record.file)))
  .map(([key]) => key));
assert([...graphicsManifestKeys].every(key => !bootImports.has(key)), 'Authored-asset loaders must remain deferred from the boot entry.');

// Architecture-only guardrail: this verifies intentional code splitting and deferred loading.
// It does not measure, compare, warn on, or cap bundle/chunk byte sizes.
assert(jsFiles.length >= 10, `Expected navigation, Three.js, and authored-asset code splitting; found only ${jsFiles.length} JS chunks.`);

console.log(
  'CLIENT_BUNDLE_ARCHITECTURE_PASS ' +
  `chunks=${jsFiles.length} three=${threeChunks.join(',')} graphicsRuntime=${graphicsRuntimeChunks.join(',')}`,
);
