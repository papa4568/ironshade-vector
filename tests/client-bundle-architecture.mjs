import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const manifestPath = resolve(root, 'dist/.vite/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const records = Object.entries(manifest);
const recordByKey = new Map(records);
const entryRecord = records.find(([, record]) => record.isEntry);
assert(entryRecord, 'Production manifest has no entry chunk.');
const [entryKey, entry] = entryRecord;

function keysForChunkFiles(files) {
  return new Set(records
    .filter(([, record]) => files.includes(basename(record.file)))
    .map(([key]) => key));
}

function collectStaticGraph(startKeys) {
  const visited = new Set();
  const pending = [...startKeys];
  while (pending.length) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    visited.add(key);
    const record = recordByKey.get(key);
    for (const importedKey of record?.imports ?? []) pending.push(importedKey);
  }
  return visited;
}

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [path] : [];
  });
}

const dynamic = records.filter(([, record]) => record.isDynamicEntry);
const dynamicKeys = dynamic.map(([key]) => key);
for (const expected of ['src/components/ShipHub.tsx', 'src/components/Armory.tsx']) {
  assert(dynamicKeys.includes(expected), `${expected} is no longer emitted as a dynamic entry.`);
}
const gameCanvasEntry = records.find(([, record]) => basename(record.file).startsWith('GameCanvas-') && record.file.endsWith('.js'));
assert(gameCanvasEntry, 'GameCanvas is no longer emitted as a deferred JS chunk.');
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

const babylonChunkPrefixes = ['babylon-core-', 'babylon-post-', 'babylon-loaders-', 'babylon-webgpu-'];
const babylonRuntimeChunks = babylonChunkPrefixes.map(prefix => {
  const matches = jsFiles.filter(name => name.startsWith(prefix));
  assert(matches.length === 1, `Expected exactly one ${prefix} runtime chunk; found ${matches.length}: ${matches.join(',')}.`);
  return matches[0];
});
const babylonRuntimeKeys = keysForChunkFiles(babylonRuntimeChunks);
assert(
  babylonRuntimeKeys.size === babylonRuntimeChunks.length,
  'Every explicit Babylon runtime chunk must be represented in the Vite manifest.',
);

const babylonEntry = records.find(([key, record]) =>
  key === 'src/game/babylonCombatRenderer.ts'
  || basename(record.file).startsWith('babylonCombatRenderer-'));
assert(babylonEntry, 'Babylon QA backend is no longer emitted as a deferred entry.');
const [babylonKey, babylonRecord] = babylonEntry;
assert(babylonRecord.isDynamicEntry, 'Babylon QA backend must remain a dynamic entry.');
assert(
  (gameCanvasRecord.dynamicImports ?? []).includes(babylonKey)
    && !(gameCanvasRecord.imports ?? []).includes(babylonKey),
  'GameCanvas must lazy-load Babylon instead of synchronously importing it.',
);

const threeManifestKeys = keysForChunkFiles(threeChunks);
const webGpuManifestKeys = keysForChunkFiles(webGpuQaChunks);
const bootStaticGraph = collectStaticGraph([entryKey]);
assert(!bootStaticGraph.has(gameCanvasKey), 'GameCanvas leaked into the synchronous boot graph.');

const appRecordEntry = records.find(([, record]) => basename(record.file).startsWith('App-'));
assert(appRecordEntry, 'The staged app chunk was not emitted.');
const [appKey, appRecord] = appRecordEntry;
const appSource = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
assert(
  appSource.includes("const loadGameCanvas = () => import('./components/GameCanvas')")
    && appSource.includes('const GameCanvas = lazy(loadGameCanvas)'),
  'App no longer lazy-loads GameCanvas through the combat route.',
);
const appStaticGraph = collectStaticGraph([appKey]);
assert(!appStaticGraph.has(gameCanvasKey), 'GameCanvas leaked into the synchronous App graph.');

const mainSource = readFileSync(resolve(root, 'src/main.tsx'), 'utf8');
const runtimeStaticImports = mainSource.split('\n').filter(line => {
  const trimmed = line.trim();
  return trimmed.startsWith('import ') && !trimmed.startsWith('import type ');
}).join('\n');
for (const [label, sourcePath, prefix] of [['save recovery', './game/saveRecovery', 'saveRecovery-'], ['app', './App', 'App-']]) {
  assert(mainSource.includes(`import('${sourcePath}')`), `The ${label} module is no longer dynamically imported during staged boot.`);
  assert(!runtimeStaticImports.includes(`from '${sourcePath}'`), `The ${label} module leaked back into a static boot import.`);
  const stagedRecord = records.find(([, record]) => basename(record.file).startsWith(prefix));
  assert(stagedRecord, `The staged ${label} chunk was not emitted.`);
  const [stagedKey] = stagedRecord;
  assert(!bootStaticGraph.has(stagedKey), `The ${label} chunk leaked back into the synchronous boot graph.`);
}

for (const key of threeManifestKeys) {
  assert(!bootStaticGraph.has(key), 'Three.js production runtime is no longer deferred from the boot entry.');
}
for (const key of webGpuManifestKeys) {
  assert(!bootStaticGraph.has(key), 'Legacy WebGPU QA runtime leaked into the synchronous boot graph.');
}
for (const key of babylonRuntimeKeys) {
  assert(!bootStaticGraph.has(key), 'Babylon runtime leaked into the synchronous boot graph.');
  assert(!appStaticGraph.has(key), 'Babylon runtime leaked into the synchronous App graph.');
}
assert(!bootStaticGraph.has(babylonKey), 'Babylon QA runtime leaked into the synchronous boot graph.');
assert(!appStaticGraph.has(babylonKey), 'Babylon QA runtime leaked into the synchronous App graph.');

const babylonCoreKey = [...babylonRuntimeKeys].find(key => basename(recordByKey.get(key)?.file ?? '').startsWith('babylon-core-'));
const babylonPostKey = [...babylonRuntimeKeys].find(key => basename(recordByKey.get(key)?.file ?? '').startsWith('babylon-post-'));
const babylonLoadersKey = [...babylonRuntimeKeys].find(key => basename(recordByKey.get(key)?.file ?? '').startsWith('babylon-loaders-'));
const babylonWebGpuKey = [...babylonRuntimeKeys].find(key => basename(recordByKey.get(key)?.file ?? '').startsWith('babylon-webgpu-'));
assert(babylonCoreKey && babylonPostKey && babylonLoadersKey && babylonWebGpuKey, 'Babylon chunk keys could not be classified.');

const babylonStaticGraph = collectStaticGraph([babylonKey]);
assert(babylonStaticGraph.has(babylonCoreKey), 'Babylon core must load only after the deferred Babylon renderer is selected.');
assert(babylonStaticGraph.has(babylonPostKey), 'Babylon post-processing must load only after the deferred Babylon renderer is selected.');
assert(!babylonStaticGraph.has(babylonLoadersKey), 'Babylon loaders must remain dynamically deferred until authored assets are requested.');
assert(!babylonStaticGraph.has(babylonWebGpuKey), 'Optional Babylon WebGPU engine code must remain dynamically deferred from the Babylon WebGL2 path.');

const graphicsRuntimePrefixes = ['GLTFLoader-', 'KTX2Loader-', 'meshopt_decoder.module-', 'SkeletonUtils-'];
const graphicsRuntimeChunks = jsFiles.filter(name => graphicsRuntimePrefixes.some(prefix => name.startsWith(prefix)));
assert(graphicsRuntimeChunks.length === graphicsRuntimePrefixes.length, `Expected ${graphicsRuntimePrefixes.length} authored-asset runtime chunks; found ${graphicsRuntimeChunks.length}.`);

const graphicsManifestKeys = keysForChunkFiles(graphicsRuntimeChunks);
for (const key of graphicsManifestKeys) {
  assert(!bootStaticGraph.has(key), 'Authored-asset loaders must remain deferred from the boot entry.');
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const dependencyNames = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
  ...Object.keys(packageJson.optionalDependencies ?? {}),
]);
for (const forbiddenPackage of ['@babylonjs/inspector', '@babylonjs/gui', '@babylonjs/materials', '@babylonjs/serializers']) {
  assert(!dependencyNames.has(forbiddenPackage), `Unused Babylon package must not ship: ${forbiddenPackage}.`);
}

const sourceFiles = collectSourceFiles(resolve(root, 'src'));
const sourceText = sourceFiles.map(path => readFileSync(path, 'utf8')).join('\n');
const forbiddenImports = [
  /from\s+['"]@babylonjs\/core['"]/,
  /import\(\s*['"]@babylonjs\/core['"]\s*\)/,
  /@babylonjs\/core\/Debug\//,
  /@babylonjs\/inspector/,
  /@babylonjs\/gui/,
  /@babylonjs\/materials/,
  /@babylonjs\/serializers/,
];
for (const forbiddenImport of forbiddenImports) {
  assert(!forbiddenImport.test(sourceText), `Production source contains forbidden broad/debug Babylon import: ${forbiddenImport}.`);
}

// Architecture-only guardrail: this verifies intentional code splitting and staged boot loading.
// Byte-cost evidence is captured separately from the built Android APK by the P27-D2 delivery report.
assert(jsFiles.length >= 14, `Expected navigation, Three.js, Babylon, and authored-asset code splitting; found only ${jsFiles.length} JS chunks.`);

console.log(
  'CLIENT_BUNDLE_ARCHITECTURE_PASS ' +
  `chunks=${jsFiles.length} three=${threeChunks.join(',')} webgpuQa=${webGpuQaChunks.join(',')} ` +
  `babylon=${babylonRuntimeChunks.join(',')} babylonDeferred=core+post+loaders+webgpu forbiddenBabylon=none ` +
  `graphicsRuntime=${graphicsRuntimeChunks.join(',')}`,
);
