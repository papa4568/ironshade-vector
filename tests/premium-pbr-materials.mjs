import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import {
  PREMIUM_PBR_MIP_LEVELS,
  PREMIUM_PBR_SURFACES,
  PREMIUM_PBR_TEXTURE_SIZE,
  preparePremiumPbrMaterials,
} from '../scripts/prepare-premium-pbr-materials.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const KTX2_IDENTIFIER = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXPECTED_SURFACES = ['painted-metal', 'bare-metal', 'deck-plate', 'polymer-rubber', 'emissive-fixture'];
const tmpRoot = resolve(process.cwd(), '.premium-pbr-material-test-a');
const tmpRootB = resolve(process.cwd(), '.premium-pbr-material-test-b');
await rm(tmpRoot, { recursive: true, force: true });
await rm(tmpRootB, { recursive: true, force: true });

function parseKtx2(buffer, label) {
  assert(buffer.subarray(0, 12).equals(KTX2_IDENTIFIER), `${label}: invalid KTX2 identifier`);
  const vkFormat = buffer.readUInt32LE(12);
  const typeSize = buffer.readUInt32LE(16);
  const pixelWidth = buffer.readUInt32LE(20);
  const pixelHeight = buffer.readUInt32LE(24);
  const pixelDepth = buffer.readUInt32LE(28);
  const layerCount = buffer.readUInt32LE(32);
  const faceCount = buffer.readUInt32LE(36);
  const levelCount = buffer.readUInt32LE(40);
  const supercompressionScheme = buffer.readUInt32LE(44);
  const dfdByteOffset = buffer.readUInt32LE(48);
  const dfdByteLength = buffer.readUInt32LE(52);
  const kvdByteOffset = buffer.readUInt32LE(56);
  const kvdByteLength = buffer.readUInt32LE(60);
  const sgdByteOffset = Number(buffer.readBigUInt64LE(64));
  const sgdByteLength = Number(buffer.readBigUInt64LE(72));
  const levels = [];
  for (let index = 0; index < levelCount; index += 1) {
    const offset = 80 + index * 24;
    levels.push({
      byteOffset: Number(buffer.readBigUInt64LE(offset)),
      byteLength: Number(buffer.readBigUInt64LE(offset + 8)),
      uncompressedByteLength: Number(buffer.readBigUInt64LE(offset + 16)),
    });
  }
  return {
    vkFormat, typeSize, pixelWidth, pixelHeight, pixelDepth, layerCount, faceCount, levelCount,
    supercompressionScheme, dfdByteLength, kvdByteOffset, kvdByteLength, sgdByteOffset, sgdByteLength,
    levels, dfd: buffer.subarray(dfdByteOffset, dfdByteOffset + dfdByteLength),
  };
}

function channelStats(bytes, channel) {
  let min = 255;
  let max = 0;
  let sum = 0;
  for (let offset = channel; offset < bytes.length; offset += 4) {
    const value = bytes[offset];
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
  }
  return { min, max, mean: sum / (bytes.length / 4) };
}

function assertPixelDetail(surface, map, topLevel) {
  const r = channelStats(topLevel, 0);
  const g = channelStats(topLevel, 1);
  const b = channelStats(topLevel, 2);
  if (map === 'base-color') {
    assert(Math.max(r.max - r.min, g.max - g.min, b.max - b.min) >= 30, `${surface} base-color lacks visible authored range`);
  }
  if (map === 'normal') {
    assert(r.max - r.min >= 20 || g.max - g.min >= 20, `${surface} normal map is too flat`);
    assert(b.mean >= 225, `${surface} normal map must remain predominantly +Z tangent-space data`);
  }
  if (map === 'orm') {
    assert(r.max - r.min >= 18, `${surface} ORM occlusion lacks authored variation`);
    assert(g.max - g.min >= 18, `${surface} ORM roughness lacks authored variation`);
    if (surface === 'polymer-rubber') assert(b.mean < 20, 'polymer/rubber must stay dielectric in ORM metallic channel');
    if (surface === 'bare-metal') assert(b.mean > 220, 'bare metal must stay metallic in ORM metallic channel');
  }
  if (map === 'emissive') {
    assert(g.max > 180 && b.max > 210, 'emissive fixture must contain a bright cool light region');
    assert(r.max > 200, 'emissive fixture must retain a warm service/warning accent');
  }
}

const first = await preparePremiumPbrMaterials(tmpRoot);
assert(first.manifest.surfaces.length === 5, 'premium PBR material library must expose exactly five baseline surfaces');
assert(first.manifest.width === PREMIUM_PBR_TEXTURE_SIZE && first.manifest.height === PREMIUM_PBR_TEXTURE_SIZE, 'premium PBR resolution contract changed');
assert(first.manifest.mipLevels === PREMIUM_PBR_MIP_LEVELS, 'premium PBR mip chain contract changed');
assert(JSON.stringify(first.manifest.ormChannels) === JSON.stringify({ r: 'occlusion', g: 'roughness', b: 'metallic', a: 'unused' }), 'ORM packing contract changed');
assert(PREMIUM_PBR_SURFACES.map(surface => surface.id).join(',') === EXPECTED_SURFACES.join(','), 'premium PBR surface family list changed');

let compressedBytes = 0;
let rawBytes = 0;
for (const surface of PREMIUM_PBR_SURFACES) {
  assert(surface.maps.includes('base-color') && surface.maps.includes('normal') && surface.maps.includes('orm'), `${surface.id}: core PBR maps are incomplete`);
  assert((surface.id === 'emissive-fixture') === surface.maps.includes('emissive'), `${surface.id}: emissive map contract is wrong`);
  for (const map of surface.maps) {
    const label = `${surface.id}-${map}`;
    const file = await readFile(resolve(tmpRoot, 'materials/premium-pbr', `${label}.ktx2`));
    const ktx = parseKtx2(file, label);
    assert(ktx.typeSize === 1 && ktx.pixelWidth === PREMIUM_PBR_TEXTURE_SIZE && ktx.pixelHeight === PREMIUM_PBR_TEXTURE_SIZE, `${label}: KTX2 dimensions/type are invalid`);
    assert(ktx.pixelDepth === 0 && ktx.layerCount === 0 && ktx.faceCount === 1, `${label}: KTX2 must be a non-array 2D texture`);
    assert(ktx.levelCount === PREMIUM_PBR_MIP_LEVELS, `${label}: full mip pyramid is required`);
    assert(ktx.supercompressionScheme === 2, `${label}: KTX2 must use Zstandard supercompression`);
    assert(ktx.kvdByteOffset === 0 && ktx.kvdByteLength === 0 && ktx.sgdByteOffset === 0 && ktx.sgdByteLength === 0, `${label}: unexpected metadata/global supercompression data`);
    assert(ktx.vkFormat === (map === 'base-color' || map === 'emissive' ? 43 : 37), `${label}: vkFormat must preserve sRGB vs linear intent`);
    assert(ktx.dfd.readUInt32LE(0) === ktx.dfdByteLength && ktx.dfd[12] === 1 && ktx.dfd[13] === 1, `${label}: KTX2 DFD must use RGBSDA + BT709`);
    assert(ktx.dfd[14] === (map === 'base-color' || map === 'emissive' ? 2 : 1), `${label}: KTX2 DFD transfer function is wrong`);
    assert(ktx.dfd[20] === 4, `${label}: KTX2 DFD must describe RGBA8 texels`);

    let previousOffset = -1;
    for (let level = ktx.levelCount - 1; level >= 0; level -= 1) {
      const entry = ktx.levels[level];
      assert(entry.byteOffset > previousOffset, `${label}: physical mip data must be smallest-to-largest while index remains base-to-smallest`);
      previousOffset = entry.byteOffset;
    }

    let topLevel = null;
    for (let level = 0; level < ktx.levelCount; level += 1) {
      const size = Math.max(1, PREMIUM_PBR_TEXTURE_SIZE >> level);
      const expectedLength = size * size * 4;
      const entry = ktx.levels[level];
      const inflated = zstdDecompressSync(file.subarray(entry.byteOffset, entry.byteOffset + entry.byteLength));
      assert(entry.uncompressedByteLength === expectedLength, `${label} mip ${level}: uncompressed byte length mismatch`);
      assert(inflated.length === expectedLength, `${label} mip ${level}: Zstd payload did not inflate to RGBA8 size`);
      if (level === 0) topLevel = inflated;
      compressedBytes += entry.byteLength;
      rawBytes += expectedLength;
    }
    assertPixelDetail(surface.id, map, topLevel);
  }
}

assert(compressedBytes < rawBytes * 0.72, `premium PBR KTX2 payloads should materially compress; ratio=${(compressedBytes / rawBytes).toFixed(3)}`);
const second = await preparePremiumPbrMaterials(tmpRootB);
assert(JSON.stringify(second.manifest) === JSON.stringify(first.manifest), 'premium PBR generation manifest must remain deterministic');
for (const surface of PREMIUM_PBR_SURFACES) {
  for (const map of surface.maps) {
    const filename = `${surface.id}-${map}.ktx2`;
    const rebuiltA = await readFile(resolve(tmpRoot, 'materials/premium-pbr', filename));
    const rebuiltB = await readFile(resolve(tmpRootB, 'materials/premium-pbr', filename));
    assert(rebuiltA.equals(rebuiltB), `${filename}: KTX2 generation must be byte-deterministic`);
  }
}
await rm(tmpRoot, { recursive: true, force: true });
await rm(tmpRootB, { recursive: true, force: true });

console.log(`PREMIUM_PBR_MATERIALS_PASS surfaces=${first.manifest.surfaces.length} textures=${first.reports.length} size=${PREMIUM_PBR_TEXTURE_SIZE} mips=${PREMIUM_PBR_MIP_LEVELS} ratio=${(compressedBytes / rawBytes).toFixed(3)}`);
