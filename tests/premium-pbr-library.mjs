import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import {
  PREMIUM_PBR_SURFACE_RESOLUTION,
  PREMIUM_PBR_SURFACE_ROOT,
  PREMIUM_PBR_SURFACES,
  writePremiumPbrSurfaceLibrary,
} from '../scripts/prepare-premium-pbr-library.mjs';

const KTX2_IDENTIFIER = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function byteRange(buffer, channel) {
  let min = 255;
  let max = 0;
  for (let offset = channel; offset < buffer.length; offset += 4) {
    min = Math.min(min, buffer[offset]);
    max = Math.max(max, buffer[offset]);
  }
  return { min, max, span: max - min };
}

function parseKtx2(buffer, label) {
  assert(buffer.subarray(0, 12).equals(KTX2_IDENTIFIER), `${label}: invalid KTX2 identifier`);
  const vkFormat = buffer.readUInt32LE(12);
  const width = buffer.readUInt32LE(20);
  const height = buffer.readUInt32LE(24);
  const faceCount = buffer.readUInt32LE(36);
  const levelCount = buffer.readUInt32LE(40);
  const supercompression = buffer.readUInt32LE(44);
  const dfdOffset = buffer.readUInt32LE(48);
  const dfdLength = buffer.readUInt32LE(52);
  const kvdOffset = buffer.readUInt32LE(56);
  const kvdLength = buffer.readUInt32LE(60);
  assert(vkFormat === 37 || vkFormat === 43, `${label}: expected RGBA8 UNORM/SRGB vkFormat, got ${vkFormat}`);
  assert(width === PREMIUM_PBR_SURFACE_RESOLUTION && height === PREMIUM_PBR_SURFACE_RESOLUTION, `${label}: unexpected base resolution ${width}x${height}`);
  assert(faceCount === 1, `${label}: expected a 2D texture`);
  assert(levelCount === Math.log2(PREMIUM_PBR_SURFACE_RESOLUTION) + 1, `${label}: missing full mip chain`);
  assert(supercompression === 2, `${label}: expected KTX2 Zstandard supercompression`);
  assert(dfdLength === 92, `${label}: unexpected RGBA8 DFD length ${dfdLength}`);
  assert(kvdOffset === dfdOffset + dfdLength, `${label}: DFD/KVD layout must be contiguous`);
  const transfer = buffer[dfdOffset + 14];
  const orientationLength = buffer.readUInt32LE(kvdOffset);
  const orientation = buffer.subarray(kvdOffset + 4, kvdOffset + 4 + orientationLength).toString('ascii');
  assert(orientation === 'KTXorientation\0rd\0', `${label}: expected deterministic rd orientation metadata`);
  assert(kvdLength >= 24, `${label}: missing KTX orientation metadata`);

  const levels = [];
  for (let level = 0; level < levelCount; level += 1) {
    const indexOffset = 80 + level * 24;
    const byteOffset = Number(buffer.readBigUInt64LE(indexOffset));
    const byteLength = Number(buffer.readBigUInt64LE(indexOffset + 8));
    const uncompressedByteLength = Number(buffer.readBigUInt64LE(indexOffset + 16));
    assert(byteOffset > 0 && byteLength > 0 && uncompressedByteLength > 0, `${label}: level ${level} has invalid byte ranges`);
    assert(byteOffset + byteLength <= buffer.length, `${label}: level ${level} extends beyond the KTX2 payload`);
    const pixels = zstdDecompressSync(buffer.subarray(byteOffset, byteOffset + byteLength));
    const levelWidth = Math.max(1, width >> level);
    const levelHeight = Math.max(1, height >> level);
    assert(uncompressedByteLength === levelWidth * levelHeight * 4, `${label}: level ${level} uncompressed byte count is wrong`);
    assert(pixels.length === uncompressedByteLength, `${label}: level ${level} Zstd round-trip length is wrong`);
    levels.push({ width: levelWidth, height: levelHeight, pixels, byteLength });
  }
  return { vkFormat, transfer, levels };
}

const first = await writePremiumPbrSurfaceLibrary();
assert(first.manifest.surfaces.length === 5, 'premium PBR library must contain five authored surface families');
assert(first.manifest.format === 'KTX2', 'premium PBR library manifest must declare KTX2 delivery');
assert(first.manifest.supercompression === 'Zstandard', 'premium PBR library manifest must declare Zstandard supercompression');
assert(first.manifest.mipmapped === true, 'premium PBR library must keep mipmaps enabled');
assert(first.manifest.ormPacking.occlusion === 'R', 'premium PBR ORM occlusion channel must remain R');
assert(first.manifest.ormPacking.roughness === 'G', 'premium PBR ORM roughness channel must remain G');
assert(first.manifest.ormPacking.metallic === 'B', 'premium PBR ORM metallic channel must remain B');

const root = resolve(process.cwd(), PREMIUM_PBR_SURFACE_ROOT);
const firstBytes = new Map();
for (const surface of first.manifest.surfaces) {
  for (const [map, entry] of Object.entries(surface.maps)) {
    firstBytes.set(`${surface.id}:${map}`, await readFile(resolve(root, entry.file)));
  }
}
const firstManifestBytes = await readFile(resolve(root, 'manifest.json'));
const second = await writePremiumPbrSurfaceLibrary();
const secondManifestBytes = await readFile(resolve(root, 'manifest.json'));
assert(firstManifestBytes.equals(secondManifestBytes), 'premium PBR manifest generation must be deterministic');
assert(first.totalBytes === second.totalBytes, 'premium PBR total payload must be deterministic');

let compressedBytes = 0;
let uncompressedBytes = 0;
for (const surface of PREMIUM_PBR_SURFACES) {
  const manifestSurface = second.manifest.surfaces.find(item => item.id === surface.id);
  assert(manifestSurface, `premium PBR manifest is missing ${surface.id}`);
  assert(Object.keys(manifestSurface.maps).length === surface.maps.length, `${surface.id}: unexpected map count`);

  for (const map of surface.maps) {
    const entry = manifestSurface.maps[map];
    assert(entry, `${surface.id}: missing ${map} map`);
    const file = await readFile(resolve(root, entry.file));
    const before = firstBytes.get(`${surface.id}:${map}`);
    assert(before?.equals(file), `${surface.id}:${map} changed across deterministic rebuilds`);
    assert(file.length === entry.bytes, `${surface.id}:${map} manifest byte size drifted`);
    assert(file.length > 512, `${surface.id}:${map} KTX2 payload is implausibly small`);

    const parsed = parseKtx2(file, `${surface.id}:${map}`);
    const expectsSrgb = map === 'base-color' || map === 'emissive';
    assert(parsed.vkFormat === (expectsSrgb ? 43 : 37), `${surface.id}:${map} has the wrong RGBA8 color-space format`);
    assert(parsed.transfer === (expectsSrgb ? 2 : 1), `${surface.id}:${map} has the wrong DFD transfer function`);
    const base = parsed.levels[0].pixels;
    const expectedBaseBytes = PREMIUM_PBR_SURFACE_RESOLUTION * PREMIUM_PBR_SURFACE_RESOLUTION * 4;
    assert(base.length === expectedBaseBytes, `${surface.id}:${map} base mip payload is incomplete`);
    assert(parsed.levels.at(-1)?.width === 1 && parsed.levels.at(-1)?.height === 1, `${surface.id}:${map} mip chain must terminate at 1x1`);
    compressedBytes += parsed.levels.reduce((sum, level) => sum + level.byteLength, 0);
    uncompressedBytes += parsed.levels.reduce((sum, level) => sum + level.pixels.length, 0);

    if (map === 'base-color') {
      const red = byteRange(base, 0);
      const green = byteRange(base, 1);
      const blue = byteRange(base, 2);
      assert(Math.max(red.span, green.span, blue.span) >= 8, `${surface.id}: base color lacks authored visible variation`);
    } else if (map === 'normal') {
      const x = byteRange(base, 0);
      const y = byteRange(base, 1);
      const z = byteRange(base, 2);
      assert(x.span >= 4 && y.span >= 4, `${surface.id}: normal map lacks tangent-space relief variation`);
      assert(z.min >= 128, `${surface.id}: normal map contains invalid back-facing Z values`);
    } else if (map === 'orm') {
      const ao = byteRange(base, 0);
      const roughness = byteRange(base, 1);
      const metallic = byteRange(base, 2);
      assert(ao.span >= 8, `${surface.id}: ORM AO channel lacks contact/detail variation`);
      assert(roughness.span >= 8, `${surface.id}: ORM roughness channel lacks material response variation`);
      if (surface.id === 'polymer-rubber') assert(metallic.max <= 4, 'polymer/rubber must remain dielectric');
      else assert(metallic.max >= 64, `${surface.id}: metallic response is unexpectedly absent`);
    } else if (map === 'emissive') {
      const red = byteRange(base, 0);
      const green = byteRange(base, 1);
      const blue = byteRange(base, 2);
      assert(red.max >= 200 && green.max >= 180 && blue.max >= 200, 'emissive fixture must preserve cyan/amber authored peaks');
    }
  }
}

assert(compressedBytes < uncompressedBytes, `premium PBR KTX2 payload should benefit from Zstd compression (${compressedBytes} >= ${uncompressedBytes})`);
console.log(`premium PBR surface library checks passed (${second.totalBytes} bytes across ${second.manifest.surfaces.length} surfaces)`);
