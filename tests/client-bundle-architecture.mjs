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

function collectGraph(startKeys, includeDynamic = false) {
  const visited = new Set();
  const pending = [...startKeys];
  while (pending.length) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    visited.add(key);
    const record = recordByKey.get(key);
    for (const importedKey of record?.imports ?? []) pending.push(importedKey);
    if (includeDynamic) {
      for (const importedKey of record?.dynamicImports ?? []) pending.push(importedKey);
    }
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

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

function glbExtensionUsage(path) {
  const bytes = readFileSync(path);
  assert(bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'glTF', `Invalid shipped GLB: ${path}`);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkType === 0x4e4f534a) {
      const json = JSON.parse(bytes.subarray(offset, offset + chunkLength).toString('utf8').replace(/[\u0000\s]+$/u, ''));
      return {
        used: Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [],
        required: Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [],
      };
    }
    offset += chunkLength;
  }
  throw new Error(`Shipped GLB has no JSON chunk: ${path}`);
}

const dynamic = records.filter(([, record]) => record.isDynamicEntry);
const dynamicKeys = dynamic.map(([key]) => key);
for (const expected of ['src/components/ShipHub.tsx', 'src/components/Armory.tsx']) {
  assert(dynamicKeys.includes(expected), `${expected} is no longer emitted as a dynamic entry.`);
}

const gameCanvasEntry = records.find(([, record]) => basename(record.file).startsWith('GameCanvas-') && record.file.endsWith('.js'));
assert(gameCanvasEntry, 'GameCanvas is no longer emitted as a deferred JS chunk.');
const [gameCanvasKey, gameCanvasRecord] = gameCanvasEntry;

const assetsDir = resolve(root, 'dist/assets');
const jsFiles = readdirSync(assetsDir).filter(name => name.endsWith('.js'));
const threeChunks = jsFiles.filter(name => name.startsWith('three-core-') || name.startsWith('three-webgl-'));
assert(threeChunks.some(name => name.startsWith('three-core-')), 'Three.js core is not isolated in its deferred chunk.');
assert(threeChunks.some(name => name.startsWith('three-webgl-')), 'Three.js WebGL renderer is not isolated in its deferred chunk.');
assert(threeChunks.length === 2, `Expected exactly two production Three.js runtime chunks; found ${threeChunks.length}.`);

const webGpuQaChunks = jsFiles.filter(name =>
  name.startsWith('three.webgpu-')
  || name.startsWith('three.tsl-')
  || name.startsWith('webGpuRefineryRenderer-'));
assert(webGpuQaChunks.length === 3, `Expected three deferred legacy WebGPU QA chunks; found ${webGpuQaChunks.length}.`);

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

const babylonWebGpuEntry = records.find(([key, record]) =>
  key.includes('@babylonjs/core/Engines/webgpuEngine')
  || basename(record.file).startsWith('webgpuEngine-'));
assert(babylonWebGpuEntry, 'Optional Babylon WebGPU engine chunk is missing.');
const [babylonWebGpuKey] = babylonWebGpuEntry;

const babylonLoaderEntry = records.find(([key, record]) =>
  key === 'src/game/babylonGltfLoader.ts'
  || basename(record.file).startsWith('babylonGltfLoader-'));
assert(babylonLoaderEntry, 'Babylon glTF loader boundary is missing.');
const [babylonLoaderKey, babylonLoaderRecord] = babylonLoaderEntry;
assert(babylonLoaderRecord.isDynamicEntry, 'Babylon glTF loader boundary must remain a dynamic entry.');

const appRecordEntry = records.find(([, record]) => basename(record.file).startsWith('App-'));
assert(appRecordEntry, 'The staged app chunk was not emitted.');
const [appKey] = appRecordEntry;

const bootStaticGraph = collectGraph([entryKey]);
const appStaticGraph = collectGraph([appKey]);
const gameCanvasStaticGraph = collectGraph([gameCanvasKey]);
const babylonStaticGraph = collectGraph([babylonKey]);
const babylonFullGraph = collectGraph([babylonKey], true);
const babylonIncrementalGraph = [...babylonFullGraph].filter(key => !gameCanvasStaticGraph.has(key));
const forbiddenBabylonRuntimePatterns = [
  /flowGraph/i,
  /(?:^|\/)Audio\//i,
  /webAudio/i,
  /audioSceneComponent/i,
  /@babylonjs\/core\/Debug\//i,
  /@babylonjs\/inspector/i,
  /@babylonjs\/gui/i,
  /@babylonjs\/serializers/i,
];
const forbiddenBabylonRuntime = babylonIncrementalGraph.filter(key => {
  const descriptor = `${key} ${recordByKey.get(key)?.file ?? ''}`;
  return forbiddenBabylonRuntimePatterns.some(pattern => pattern.test(descriptor));
});
assert(
  forbiddenBabylonRuntime.length === 0,
  `Unused/debug Babylon modules leaked into the deferred runtime graph: ${forbiddenBabylonRuntime.join(', ')}`,
);

assert(!bootStaticGraph.has(gameCanvasKey), 'GameCanvas leaked into the synchronous boot graph.');
assert(!appStaticGraph.has(gameCanvasKey), 'GameCanvas leaked into the synchronous App graph.');
assert(!bootStaticGraph.has(babylonKey), 'Babylon renderer leaked into the synchronous boot graph.');
assert(!appStaticGraph.has(babylonKey), 'Babylon renderer leaked into the synchronous App graph.');
assert(!gameCanvasStaticGraph.has(babylonKey), 'Babylon renderer leaked into GameCanvas synchronous imports.');

assert(
  babylonFullGraph.has(babylonLoaderKey) && !babylonStaticGraph.has(babylonLoaderKey),
  'Babylon glTF loaders must remain dynamically deferred behind the Babylon renderer.',
);
assert(
  babylonFullGraph.has(babylonWebGpuKey) && !babylonStaticGraph.has(babylonWebGpuKey),
  'Optional Babylon WebGPU engine code must remain dynamically deferred from the Babylon WebGL2 renderer path.',
);
for (const key of [babylonLoaderKey, babylonWebGpuKey]) {
  assert(!bootStaticGraph.has(key), 'Babylon optional runtime leaked into the synchronous boot graph.');
  assert(!appStaticGraph.has(key), 'Babylon optional runtime leaked into the synchronous App graph.');
}

const appSource = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
assert(
  appSource.includes("const loadGameCanvas = () => import('./components/GameCanvas')")
    && appSource.includes('const GameCanvas = lazy(loadGameCanvas)'),
  'App no longer lazy-loads GameCanvas through the combat route.',
);

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

const threeManifestKeys = keysForChunkFiles(threeChunks);
const webGpuManifestKeys = keysForChunkFiles(webGpuQaChunks);
for (const key of threeManifestKeys) {
  assert(!bootStaticGraph.has(key), 'Three.js production runtime is no longer deferred from the boot entry.');
}
for (const key of webGpuManifestKeys) {
  assert(!bootStaticGraph.has(key), 'Legacy WebGPU QA runtime leaked into the synchronous boot graph.');
}

const babylonRendererSource = readFileSync(resolve(root, 'src/game/babylonCombatRenderer.ts'), 'utf8');
const babylonAssetsSource = readFileSync(resolve(root, 'src/game/babylonGraphicsAssets.ts'), 'utf8');
const babylonLoaderSource = readFileSync(resolve(root, 'src/game/babylonGltfLoader.ts'), 'utf8');
const babylonPostSource = readFileSync(resolve(root, 'src/game/babylonRefineryPostProcessing.ts'), 'utf8');
assert(
  babylonRendererSource.includes("from '@babylonjs/core/")
    && babylonRendererSource.includes("from './babylonRefineryPostProcessing'")
    && babylonPostSource.includes("from '@babylonjs/core/Layers/glowLayer'")
    && babylonAssetsSource.includes("import('./babylonGltfLoader')")
    && babylonLoaderSource.includes("import '@babylonjs/loaders/glTF/2.0/glTFLoader'")
    && !babylonLoaderSource.includes("import '@babylonjs/loaders/glTF';")
    && babylonRendererSource.includes("import('@babylonjs/core/Engines/webgpuEngine')"),
  'Babylon core/post/loaders/WebGPU source boundaries no longer match the deferred renderer architecture.',
);

const shippedGlbs = collectFiles(resolve(root, 'dist/assets/models')).filter(path => path.endsWith('.glb'));
assert(shippedGlbs.length > 0, 'Production build contains no authored GLBs to validate.');
const authoredGltfExtensions = new Set();
for (const path of shippedGlbs) {
  const usage = glbExtensionUsage(path);
  for (const extension of [...usage.used, ...usage.required]) authoredGltfExtensions.add(extension);
}
assert(
  authoredGltfExtensions.size === 0,
  `Authored GLBs now require explicit Babylon loader extension registration: ${[...authoredGltfExtensions].sort().join(', ')}`,
);

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

// Architecture guardrail: byte evidence is captured separately from the built APK by P27-D2.
assert(jsFiles.length >= 10, `Expected navigation, Three.js, Babylon, and authored-asset code splitting; found only ${jsFiles.length} JS chunks.`);

console.log(
  'CLIENT_BUNDLE_ARCHITECTURE_PASS ' +
  `chunks=${jsFiles.length} three=${threeChunks.join(',')} webgpuQa=${webGpuQaChunks.join(',')} ` +
  `babylonRenderer=${basename(babylonRecord.file)} babylonLoaders=${basename(babylonLoaderRecord.file)} ` +
  `babylonWebgpu=${basename(babylonWebGpuEntry[1].file)} corePost=renderer-deferred forbiddenBabylon=none glbExtensions=none glbs=${shippedGlbs.length} ` +
  `graphicsRuntime=${graphicsRuntimeChunks.join(',')}`,
);
