import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const babylonCorePackage = JSON.parse(await readFile(resolve(root, 'node_modules/@babylonjs/core/package.json'), 'utf8'));
const babylonKtx2Package = JSON.parse(await readFile(resolve(root, 'node_modules/@babylonjs/ktx2decoder/package.json'), 'utf8'));
const babylonKtx2UmdPackage = JSON.parse(await readFile(resolve(root, 'node_modules/babylonjs-ktx2decoder/package.json'), 'utf8'));
const meshoptimizerPackage = JSON.parse(await readFile(resolve(root, 'node_modules/meshoptimizer/package.json'), 'utf8'));

if (babylonCorePackage.version !== babylonKtx2Package.version || babylonCorePackage.version !== babylonKtx2UmdPackage.version) {
  throw new Error(
    `Babylon codec packages must match @babylonjs/core: core=${babylonCorePackage.version} scoped=${babylonKtx2Package.version} umd=${babylonKtx2UmdPackage.version}`,
  );
}

async function copyMeasured(source, destination, name) {
  const sourceStat = await stat(source);
  if (!sourceStat.isFile() || sourceStat.size <= 0) throw new Error(`Missing graphics codec asset: ${source}`);
  await copyFile(source, destination);
  return { name, bytes: sourceStat.size };
}

await rm(resolve(root, 'public/assets/codecs/basis'), { recursive: true, force: true });

const babylonTargetDir = resolve(root, 'public/assets/codecs/babylon');
await rm(babylonTargetDir, { recursive: true, force: true });
await mkdir(babylonTargetDir, { recursive: true });

const babylonCodecSources = [
  {
    source: resolve(root, 'node_modules/babylonjs-ktx2decoder/babylon.ktx2Decoder.js'),
    name: 'babylon.ktx2Decoder.js',
  },
  {
    source: resolve(root, 'node_modules/meshoptimizer/meshopt_decoder.cjs'),
    name: 'meshopt_decoder.js',
  },
  ...[
    'msc_basis_transcoder.js',
    'msc_basis_transcoder.wasm',
    'uastc_astc.wasm',
    'uastc_bc7.wasm',
    'uastc_r8_unorm.wasm',
    'uastc_rg8_unorm.wasm',
    'uastc_rgba8_srgb_v2.wasm',
    'uastc_rgba8_unorm_v2.wasm',
    'zstddec.wasm',
  ].map(name => ({
    source: resolve(root, 'node_modules/@babylonjs/ktx2decoder/wasm', name),
    name,
  })),
];

const babylonFiles = [];
for (const item of babylonCodecSources) {
  babylonFiles.push(await copyMeasured(
    item.source,
    resolve(babylonTargetDir, item.name),
    item.name,
  ));
}

const babylonTotalBytes = babylonFiles.reduce((sum, file) => sum + file.bytes, 0);
await writeFile(resolve(babylonTargetDir, 'manifest.json'), `${JSON.stringify({
  babylonVersion: babylonCorePackage.version,
  ktx2DecoderVersion: babylonKtx2Package.version,
  meshoptimizerVersion: meshoptimizerPackage.version,
  codec: 'babylon-glb-ktx2-meshopt',
  generated: true,
  files: babylonFiles,
  totalBytes: babylonTotalBytes,
}, null, 2)}\n`, 'utf8');

console.log(
  `GRAPHICS_CODECS_READY babylon=${babylonCorePackage.version} babylonFiles=${babylonFiles.length} babylonBytes=${babylonTotalBytes} meshopt=${meshoptimizerPackage.version}`,
);
