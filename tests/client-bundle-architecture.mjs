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
for (const expected of ['src/components/ShipHub.tsx', 'src/components/Armory.tsx']) {
  assert(dynamicKeys.includes(expected), `${expected} is no longer emitted as a dynamic entry.`);
}
const gameCanvasEntry = records.find(([key]) => key === 'src/components/GameCanvas.tsx');
assert(gameCanvasEntry, 'src/components/GameCanvas.tsx is no longer emitted as a deferred chunk.');
const [gameCanvasKey, gameCanvasRecord] = gameCanvasEntry;
assert(basename(gameCanvasRecord.file).startsWith('GameCanvas-'), 'GameCanvas is no longer isolated in its own deferred chunk.');

const assetsDir = resolve(root, 'dist/assets');
const jsFiles = readdirSync(assetsDir).filter(name => name.endsWith('.js'));
const threeChunks = jsFiles.filter(name => name.startsWith('three-core-') || name.startsWith('three-webgl-'));
assert(threeChunks.some(name => name.startsWith('three-core-')), 'Three.js core is not isolated in its deferred chunk.');
assert(threeChunks.some(name => name.startsWith('three-webgl-')), 'Three.js WebGL renderer is not isolated in its deferred chunk.');
assert(threeChunks.length === 2, `Expected exactly two production Three.js runtime chunks; found ${threeChunks.length}.`);
const webGpuQaChunks = jsFiles.filter(name => name.startsWith('three.webgpu-') || name.startsWith('three.tsl-') || name.startsWith('webGpuRefineryRenderer-'));
assert(webGpuQaChunks.length === 3, `Expected three deferred WebGPU QA chunks; found ${webGpuQaChunks.length}.`);

const threeManifestKeys = new Set(records
  .filter(([, record]) => threeChunks.includes(basename(record.file)))
  .map(([key]) => key));
const bootImports = new Set(entry.imports ?? []);
assert(!bootImports.has(gameCanvasKey), 'GameCanvas leaked into the synchronous boot graph.');
const appRecordEntry = records.find(([, record]) => basename(record.file).startsWith('App-'));
assert(appRecordEntry, 'The staged app chunk was not emitted.');
const [, appRecord] = appRecordEntry;
assert(
  new Set(appRecord.dynamicImports ?? []).has(gameCanvasKey),
  'The staged app chunk no longer reaches GameCanvas through a dynamic import.',
);
const mainSource = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');
const runtimeStaticImports = mainSource.split('\n').filter(line => { const trimmed = line.trim(); return trimmed.startsWith('import ') && !trimmed.startsWith('import type '); }).join('\n');
for (const [label, sourcePath, prefix] of [['save recovery', './game/saveRecovery', 'saveRecovery-'], ['app', './App', 'App-']]) {
  assert(mainSource.includes(`import('${sourcePath}')`), `The ${label} module is no longer dynamically imported during staged boot.`);
  assert(!runtimeStaticImports.includes(`from '${sourcePath}'`), `The ${label} module leaked back into a static boot import.`);
  const stagedRecord = records.find(([, record]) => basename(record.file).startsWith(prefix));
  assert(stagedRecord, `The staged ${label} chunk was not emitted.`);
  const [stagedKey] = stagedRecord;
  assert(!bootImports.has(stagedKey), `The ${label} chunk leaked back into the synchronous boot graph.`);
}
assert([...threeManifestKeys].every(key => !bootImports.has(key)), 'Three.js production runtime is no longer deferred from the boot entry.');
const webGpuManifestKeys = new Set(records
  .filter(([, record]) => webGpuQaChunks.includes(basename(record.file)))
  .map(([key]) => key));
assert([...webGpuManifestKeys].every(key => !bootImports.has(key)), 'WebGPU QA runtime leaked into the synchronous boot graph.');

const graphicsRuntimePrefixes = ['GLTFLoader-', 'KTX2Loader-', 'meshopt_decoder.module-', 'SkeletonUtils-'];
const graphicsRuntimeChunks = jsFiles.filter(name => graphicsRuntimePrefixes.some(prefix => name.startsWith(prefix)));
assert(graphicsRuntimeChunks.length === graphicsRuntimePrefixes.length, `Expected ${graphicsRuntimePrefixes.length} authored-asset runtime chunks; found ${graphicsRuntimeChunks.length}.`);

const graphicsManifestKeys = new Set(records
  .filter(([, record]) => graphicsRuntimeChunks.includes(basename(record.file)))
  .map(([key]) => key));
assert([...graphicsManifestKeys].every(key => !bootImports.has(key)), 'Authored-asset loaders must remain deferred from the boot entry.');

// Architecture-only guardrail: this verifies intentional code splitting and staged boot loading.
// It does not measure, compare, warn on, or cap bundle/chunk byte sizes.
assert(jsFiles.length >= 10, `Expected navigation, Three.js, and authored-asset code splitting; found only ${jsFiles.length} JS chunks.`);

console.log(
  'CLIENT_BUNDLE_ARCHITECTURE_PASS ' +
  `chunks=${jsFiles.length} three=${threeChunks.join(',')} webgpuQa=${webGpuQaChunks.join(',')} graphicsRuntime=${graphicsRuntimeChunks.join(',')}`,
);
