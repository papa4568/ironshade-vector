import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const babylonPackage = JSON.parse(await readFile(resolve(root, 'node_modules/@babylonjs/core/package.json'), 'utf8'));
const babylonKtx2Package = JSON.parse(await readFile(resolve(root, 'node_modules/babylonjs-ktx2decoder/package.json'), 'utf8'));
const meshoptimizerPackage = JSON.parse(await readFile(resolve(root, 'node_modules/meshoptimizer/package.json'), 'utf8'));

async function copyRuntimeFile(source, target) {
  await copyFile(source, target);
  const info = await stat(target);
  if (!info.isFile() || info.size <= 0) throw new Error(`graphics codec copy failed: ${target}`);
  return info.size;
}

await rm(resolve(root, 'public/assets/codecs/basis'), { recursive: true, force: true });

const babylonTargetDir = resolve(root, 'public/assets/codecs/babylon');
await rm(babylonTargetDir, { recursive: true, force: true });
await mkdir(babylonTargetDir, { recursive: true });
const babylonSources = [
  ['node_modules/@babylonjs/core/Materials/Textures/Loaders/babylon.ktx2Decoder.js', 'babylon.ktx2Decoder.js'],
  ['node_modules/meshoptimizer/meshopt_decoder.js', 'meshopt_decoder.js'],
  ['node_modules/babylonjs-ktx2decoder/msc_basis_transcoder.js', 'msc_basis_transcoder.js'],
  ['node_modules/babylonjs-ktx2decoder/msc_basis_transcoder.wasm', 'msc_basis_transcoder.wasm'],
  ['node_modules/babylonjs-ktx2decoder/uastc_astc.wasm', 'uastc_astc.wasm'],
  ['node_modules/babylonjs-ktx2decoder/uastc_bc7.wasm', 'uastc_bc7.wasm'],
  ['node_modules/babylonjs-ktx2decoder/uastc_r8_unorm.wasm', 'uastc_r8_unorm.wasm'],
  ['node_modules/babylonjs-ktx2decoder/uastc_rg8_unorm.wasm', 'uastc_rg8_unorm.wasm'],
  ['node_modules/babylonjs-ktx2decoder/uastc_rgba8_srgb_v2.wasm', 'uastc_rgba8_srgb_v2.wasm'],
  ['node_modules/babylonjs-ktx2decoder/uastc_rgba8_unorm_v2.wasm', 'uastc_rgba8_unorm_v2.wasm'],
  ['node_modules/babylonjs-ktx2decoder/zstddec.wasm', 'zstddec.wasm'],
];
let babylonTotalBytes = 0;
for (const [source, filename] of babylonSources) {
  babylonTotalBytes += await copyRuntimeFile(resolve(root, source), resolve(babylonTargetDir, filename));
}
await writeFile(resolve(babylonTargetDir, 'manifest.json'), JSON.stringify({
  codec: 'babylon-glb-ktx2-meshopt',
  babylonVersion: babylonPackage.version,
  ktx2DecoderVersion: babylonKtx2Package.version,
  meshoptimizerVersion: meshoptimizerPackage.version,
  files: babylonSources.map(([, filename]) => filename),
  totalBytes: babylonTotalBytes,
}, null, 2));

console.log(`GRAPHICS_CODECS_READY babylon=${babylonPackage.version} meshopt=${meshoptimizerPackage.version} files=${babylonSources.length} bytes=${babylonTotalBytes}`);
