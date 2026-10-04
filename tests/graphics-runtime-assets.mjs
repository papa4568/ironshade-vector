import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const retiredThreeCodecRoot = resolve(process.cwd(), 'dist/assets/codecs/basis');
let retiredThreeCodecPresent = true;
try {
  await access(retiredThreeCodecRoot, constants.F_OK);
} catch {
  retiredThreeCodecPresent = false;
}
assert(!retiredThreeCodecPresent, 'retired Three Basis codec directory must not ship in production output');

const babylonCodecRoot = resolve(process.cwd(), 'dist/assets/codecs/babylon');
const babylonManifest = JSON.parse(await readFile(resolve(babylonCodecRoot, 'manifest.json'), 'utf8'));
assert(babylonManifest.codec === 'babylon-glb-ktx2-meshopt', 'Babylon codec manifest must identify the authored-asset decoder stack');
assert(babylonManifest.babylonVersion === '9.28.0', `Babylon codec version must match locked Babylon.js 9.28.0, got ${babylonManifest.babylonVersion}`);
assert(babylonManifest.ktx2DecoderVersion === '9.28.0', 'Babylon KTX2 decoder must match the locked engine version');
assert(babylonManifest.meshoptimizerVersion === '1.1.1', 'Babylon Meshopt decoder must match the locked meshoptimizer version');
const babylonFiles = [
  'babylon.ktx2Decoder.js',
  'meshopt_decoder.js',
  'msc_basis_transcoder.js',
  'msc_basis_transcoder.wasm',
  'uastc_astc.wasm',
  'uastc_bc7.wasm',
  'uastc_r8_unorm.wasm',
  'uastc_rg8_unorm.wasm',
  'uastc_rgba8_srgb_v2.wasm',
  'uastc_rgba8_unorm_v2.wasm',
  'zstddec.wasm',
];
assert(Array.isArray(babylonManifest.files) && babylonManifest.files.length === babylonFiles.length, 'Babylon codec manifest must contain every local Meshopt/KTX2 decoder dependency');
let babylonTotalBytes = 0;
for (const expected of babylonFiles) {
  const fileStat = await stat(resolve(babylonCodecRoot, expected));
  assert(fileStat.isFile() && fileStat.size > 0, `missing runtime Babylon graphics codec ${expected}`);
  babylonTotalBytes += fileStat.size;
}
assert(babylonTotalBytes === babylonManifest.totalBytes, 'Babylon graphics codec manifest byte count does not match build output');
assert(babylonTotalBytes <= 1_250_000, `Babylon local codec payload budget exceeded: ${babylonTotalBytes} bytes`);
console.log(`GRAPHICS_RUNTIME_ASSETS_PASS three=retired babylonFiles=${babylonFiles.length} babylonBytes=${babylonTotalBytes} babylon=${babylonManifest.babylonVersion} meshopt=${babylonManifest.meshoptimizerVersion}`);
