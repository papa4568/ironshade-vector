import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const codecRoot = resolve(process.cwd(), 'dist/assets/codecs/basis');
const manifest = JSON.parse(await readFile(resolve(codecRoot, 'manifest.json'), 'utf8'));
assert(manifest.codec === 'basis-universal', 'graphics codec manifest must identify Basis Universal');
assert(manifest.threeVersion === '0.186.0', `graphics codec version must match locked Three.js 0.186.0, got ${manifest.threeVersion}`);
assert(Array.isArray(manifest.files) && manifest.files.length === 2, 'graphics codec manifest must contain JS and WASM transcoder files');

let totalBytes = 0;
for (const expected of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  const fileStat = await stat(resolve(codecRoot, expected));
  assert(fileStat.isFile() && fileStat.size > 0, `missing runtime graphics codec ${expected}`);
  totalBytes += fileStat.size;
}

assert(totalBytes === manifest.totalBytes, 'graphics codec manifest byte count does not match build output');
assert(totalBytes <= 700_000, `Basis runtime codec budget exceeded: ${totalBytes} bytes`);

console.log(`GRAPHICS_RUNTIME_ASSETS_PASS codec=basis files=2 bytes=${totalBytes} three=${manifest.threeVersion}`);
