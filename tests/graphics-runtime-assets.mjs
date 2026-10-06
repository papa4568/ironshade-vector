import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

await import('./graphics-runtime-assets-base.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = resolve(process.cwd(), 'dist/assets/materials/premium-pbr');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
assert(manifest.encoding === 'ktx2-zstd-rgba8', `premium PBR runtime encoding must stay KTX2+Zstd, got ${manifest.encoding}`);
assert(manifest.width === 512 && manifest.height === 512 && manifest.mipLevels === 10, 'premium PBR runtime textures must ship the authored 512px/10-mip contract');
assert(manifest.surfaces?.length === 5, 'premium PBR runtime manifest must ship all five shared surfaces');
assert(manifest.ormChannels?.r === 'occlusion' && manifest.ormChannels?.g === 'roughness' && manifest.ormChannels?.b === 'metallic', 'premium PBR runtime ORM channel contract changed');

const identifier = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
let textureCount = 0;
let textureBytes = 0;
for (const surface of manifest.surfaces) {
  for (const [map, filename] of Object.entries(surface.maps ?? {})) {
    assert(filename.endsWith('.ktx2'), `${surface.id}/${map}: runtime material map must use KTX2`);
    const path = resolve(root, filename);
    const fileStat = await stat(path);
    assert(fileStat.isFile() && fileStat.size > 0, `${surface.id}/${map}: runtime KTX2 is missing`);
    const header = await readFile(path);
    assert(header.subarray(0, 12).equals(identifier), `${surface.id}/${map}: runtime payload is not KTX2`);
    assert(header.readUInt32LE(40) === 10, `${surface.id}/${map}: runtime KTX2 mip chain is incomplete`);
    assert(header.readUInt32LE(44) === 2, `${surface.id}/${map}: runtime KTX2 is not Zstd-supercompressed`);
    textureCount += 1;
    textureBytes += fileStat.size;
  }
}
assert(textureCount === 16, `premium PBR runtime texture count changed: ${textureCount}`);
assert(textureBytes === manifest.totalBytes, `premium PBR runtime byte count mismatch: ${textureBytes} !== ${manifest.totalBytes}`);
console.log(`PREMIUM_PBR_RUNTIME_ASSETS_PASS surfaces=${manifest.surfaces.length} textures=${textureCount} bytes=${textureBytes} mips=${manifest.mipLevels}`);
