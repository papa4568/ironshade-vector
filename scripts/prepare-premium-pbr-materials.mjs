import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zstdCompressSync } from 'node:zlib';

export const PREMIUM_PBR_TEXTURE_SIZE = 512;
export const PREMIUM_PBR_MIP_LEVELS = 10;
export const PREMIUM_PBR_ROOT_RELATIVE_PATH = 'materials/premium-pbr';

const KTX2_IDENTIFIER = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const VK_FORMAT_R8G8B8A8_UNORM = 37;
const VK_FORMAT_R8G8B8A8_SRGB = 43;
const KTX_SS_ZSTD = 2;

export const PREMIUM_PBR_SURFACES = [
  { id: 'painted-metal', maps: ['base-color', 'normal', 'orm'], seed: 11 },
  { id: 'bare-metal', maps: ['base-color', 'normal', 'orm'], seed: 23 },
  { id: 'deck-plate', maps: ['base-color', 'normal', 'orm'], seed: 37 },
  { id: 'polymer-rubber', maps: ['base-color', 'normal', 'orm'], seed: 53 },
  { id: 'emissive-fixture', maps: ['base-color', 'normal', 'orm', 'emissive'], seed: 71 },
];

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hash2(x, y, seed) {
  let value = Math.imul((x + 1) ^ (seed * 374761393), 668265263) ^ Math.imul((y + 1) ^ (seed * 2246822519), 3266489917);
  value ^= value >>> 15;
  value = Math.imul(value, 2246822519);
  value ^= value >>> 13;
  return (value >>> 0) / 0xffffffff;
}

function signedNoise(x, y, seed) {
  return hash2(x, y, seed) * 2 - 1;
}

function lineDistance(value, period, offset = 0) {
  const wrapped = ((value - offset) % period + period) % period;
  return Math.min(wrapped, period - wrapped);
}

function normalizeNormal(nx, ny, nz = 1) {
  const length = Math.hypot(nx, ny, nz) || 1;
  return [
    clampByte((nx / length * 0.5 + 0.5) * 255),
    clampByte((ny / length * 0.5 + 0.5) * 255),
    clampByte((nz / length * 0.5 + 0.5) * 255),
    255,
  ];
}

function paintedMetalPixel(map, x, y, seed) {
  const seamX = lineDistance(x, 128, 5) < 2;
  const seamY = lineDistance(y, 128, 9) < 2;
  const bolt = Math.hypot((x % 128) - 18, (y % 128) - 18) < 5;
  const scratch = ((x * 3 + y * 11 + seed) % 197) < 2 && ((x + y) % 29) < 19;
  const grain = signedNoise(x, y, seed) * 7;
  if (map === 'base-color') {
    if (bolt) return [126, 132, 132, 255];
    if (scratch) return [92, 96, 94, 255];
    if (seamX || seamY) return [25, 34, 38, 255];
    return [clampByte(54 + grain), clampByte(69 + grain), clampByte(73 + grain), 255];
  }
  if (map === 'normal') {
    const grooveX = seamX ? (x % 128 < 5 ? -0.46 : 0.46) : 0;
    const grooveY = seamY ? (y % 128 < 9 ? -0.46 : 0.46) : 0;
    return normalizeNormal(grooveX + signedNoise(x, y, seed + 1) * 0.06, grooveY + signedNoise(y, x, seed + 2) * 0.06, 1);
  }
  if (map === 'orm') {
    const ao = seamX || seamY ? 148 : bolt ? 184 : 226;
    const roughness = scratch ? 92 : bolt ? 118 : clampByte(164 + grain * 2);
    const metallic = scratch || bolt ? 226 : 58;
    return [ao, roughness, metallic, 255];
  }
  throw new Error(`painted-metal does not support ${map}`);
}

function bareMetalPixel(map, x, y, seed) {
  const brush = Math.sin((x + seed) * 0.33) * 8 + signedNoise(x * 2, y, seed) * 5;
  const longScratch = ((y * 5 + x + seed * 13) % 251) < 2;
  const darkBand = lineDistance(y, 96, 17) < 1;
  if (map === 'base-color') {
    const value = darkBand ? 79 : longScratch ? 163 : clampByte(126 + brush);
    return [value, clampByte(value + 4), clampByte(value + 6), 255];
  }
  if (map === 'normal') {
    const nx = Math.sin((x + seed) * 0.33) * 0.07 + (longScratch ? 0.35 : 0);
    const ny = darkBand ? -0.22 : signedNoise(x, y, seed + 4) * 0.025;
    return normalizeNormal(nx, ny, 1);
  }
  if (map === 'orm') return [darkBand ? 192 : 238, longScratch ? 112 : clampByte(90 + Math.abs(brush) * 3), 244, 255];
  throw new Error(`bare-metal does not support ${map}`);
}

function deckPlatePixel(map, x, y, seed) {
  const cellX = x % 64;
  const cellY = y % 64;
  const border = cellX < 3 || cellX > 60 || cellY < 3 || cellY > 60;
  const centerX = cellX - 32;
  const centerY = cellY - 32;
  const diagonalA = Math.abs(centerY - centerX * 0.42) < 5 && Math.abs(centerX) < 24;
  const diagonalB = Math.abs(centerY + centerX * 0.42) < 5 && Math.abs(centerX) < 24;
  const tread = diagonalA || diagonalB;
  const wear = signedNoise(x, y, seed) * 9;
  if (map === 'base-color') {
    if (border) return [31, 36, 37, 255];
    if (tread) return [91, 96, 94, 255];
    return [clampByte(55 + wear), clampByte(61 + wear), clampByte(61 + wear), 255];
  }
  if (map === 'normal') {
    const edgeX = cellX < 5 ? -0.32 : cellX > 59 ? 0.32 : 0;
    const edgeY = cellY < 5 ? -0.32 : cellY > 59 ? 0.32 : 0;
    const treadLift = tread ? 0.16 : 0;
    return normalizeNormal(edgeX + treadLift * Math.sign(centerX || 1), edgeY + treadLift * Math.sign(centerY || 1), 1);
  }
  if (map === 'orm') return [border ? 122 : tread ? 206 : 184, tread ? 126 : clampByte(172 + wear), 216, 255];
  throw new Error(`deck-plate does not support ${map}`);
}

function polymerRubberPixel(map, x, y, seed) {
  const pebbleX = x % 18 - 9;
  const pebbleY = y % 18 - 9;
  const pebble = Math.max(0, 1 - Math.hypot(pebbleX, pebbleY) / 8);
  const ridge = lineDistance(x + Math.floor(y / 24) * 7, 72, 10) < 3;
  const noise = signedNoise(x, y, seed);
  if (map === 'base-color') {
    const value = ridge ? 60 : clampByte(30 + pebble * 24 + noise * 5);
    return [value, clampByte(value + 2), clampByte(value + 3), 255];
  }
  if (map === 'normal') return normalizeNormal(pebbleX / 8 * pebble * 0.18 + (ridge ? 0.18 : 0), pebbleY / 8 * pebble * 0.18, 1);
  if (map === 'orm') return [ridge ? 190 : 225, clampByte(228 - pebble * 26 + noise * 5), 4, 255];
  throw new Error(`polymer-rubber does not support ${map}`);
}

function emissiveFixturePixel(map, x, y, seed) {
  const panelX = x % 128;
  const panelY = y % 128;
  const frame = panelX < 8 || panelX > 119 || panelY < 8 || panelY > 119;
  const lightBar = panelY >= 45 && panelY <= 82 && panelX >= 18 && panelX <= 109;
  const divider = lightBar && lineDistance(panelX, 30, 18) < 2;
  const warning = panelX > 98 && panelY < 34 && ((x + y) % 18 < 9);
  const grain = signedNoise(x, y, seed) * 4;
  if (map === 'base-color') {
    if (lightBar) return divider ? [34, 43, 45, 255] : [72, 92, 93, 255];
    if (warning) return [135, 74, 32, 255];
    if (frame) return [28, 32, 34, 255];
    return [clampByte(48 + grain), clampByte(55 + grain), clampByte(57 + grain), 255];
  }
  if (map === 'normal') {
    const nx = panelX < 10 ? -0.34 : panelX > 117 ? 0.34 : 0;
    const ny = panelY < 10 ? -0.34 : panelY > 117 ? 0.34 : lightBar ? 0.08 : 0;
    return normalizeNormal(nx, ny, 1);
  }
  if (map === 'orm') return [frame ? 152 : 224, lightBar ? 108 : warning ? 144 : 164, frame || warning ? 198 : 126, 255];
  if (map === 'emissive') {
    if (divider) return [4, 12, 14, 255];
    if (lightBar) {
      const pulse = Math.sin((x + y + seed) * 0.075) * 12;
      return [clampByte(34 + pulse), clampByte(205 + pulse), clampByte(236 + pulse), 255];
    }
    if (warning) return [238, 92, 18, 255];
    return [0, 1, 2, 255];
  }
  throw new Error(`emissive-fixture does not support ${map}`);
}

function pixelFor(surfaceId, map, x, y, seed) {
  if (surfaceId === 'painted-metal') return paintedMetalPixel(map, x, y, seed);
  if (surfaceId === 'bare-metal') return bareMetalPixel(map, x, y, seed);
  if (surfaceId === 'deck-plate') return deckPlatePixel(map, x, y, seed);
  if (surfaceId === 'polymer-rubber') return polymerRubberPixel(map, x, y, seed);
  if (surfaceId === 'emissive-fixture') return emissiveFixturePixel(map, x, y, seed);
  throw new Error(`Unknown premium PBR surface ${surfaceId}`);
}

function makeBaseLevel(surfaceId, map, seed, size = PREMIUM_PBR_TEXTURE_SIZE) {
  const bytes = Buffer.allocUnsafe(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const rgba = pixelFor(surfaceId, map, x, y, seed);
      const offset = (y * size + x) * 4;
      bytes[offset] = rgba[0];
      bytes[offset + 1] = rgba[1];
      bytes[offset + 2] = rgba[2];
      bytes[offset + 3] = rgba[3];
    }
  }
  return bytes;
}

function srgbToLinear(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  const c = Math.max(0, Math.min(1, value));
  return clampByte((c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
}

function downsample(previous, previousSize, map) {
  const size = Math.max(1, previousSize >> 1);
  const next = Buffer.allocUnsafe(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const samples = [];
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const sx = Math.min(previousSize - 1, x * 2 + dx);
          const sy = Math.min(previousSize - 1, y * 2 + dy);
          const offset = (sy * previousSize + sx) * 4;
          samples.push([previous[offset], previous[offset + 1], previous[offset + 2], previous[offset + 3]]);
        }
      }
      let rgba;
      if (map === 'normal') {
        let nx = 0;
        let ny = 0;
        let nz = 0;
        for (const sample of samples) {
          nx += sample[0] / 255 * 2 - 1;
          ny += sample[1] / 255 * 2 - 1;
          nz += sample[2] / 255 * 2 - 1;
        }
        rgba = normalizeNormal(nx / 4, ny / 4, nz / 4);
      } else if (map === 'base-color' || map === 'emissive') {
        rgba = [0, 1, 2].map(channel => linearToSrgb(samples.reduce((sum, sample) => sum + srgbToLinear(sample[channel]), 0) / 4));
        rgba.push(Math.round(samples.reduce((sum, sample) => sum + sample[3], 0) / 4));
      } else {
        rgba = [0, 1, 2, 3].map(channel => Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / 4));
      }
      next.set(rgba, (y * size + x) * 4);
    }
  }
  return next;
}

function makeMipChain(surfaceId, map, seed) {
  const levels = [];
  let size = PREMIUM_PBR_TEXTURE_SIZE;
  let pixels = makeBaseLevel(surfaceId, map, seed, size);
  while (true) {
    levels.push({ size, pixels });
    if (size === 1) break;
    pixels = downsample(pixels, size, map);
    size = Math.max(1, size >> 1);
  }
  if (levels.length !== PREMIUM_PBR_MIP_LEVELS) throw new Error(`Expected ${PREMIUM_PBR_MIP_LEVELS} mip levels, got ${levels.length}`);
  return levels;
}

function makeDfd(isSrgb) {
  const descriptorBlockSize = 88;
  const dfd = Buffer.alloc(92);
  dfd.writeUInt32LE(92, 0);
  dfd.writeUInt32LE(0, 4);
  dfd.writeUInt16LE(2, 8);
  dfd.writeUInt16LE(descriptorBlockSize, 10);
  dfd[12] = 1;
  dfd[13] = 1;
  dfd[14] = isSrgb ? 2 : 1;
  dfd[20] = 4;
  const channels = [0, 1, 2, 15];
  for (let index = 0; index < channels.length; index += 1) {
    const offset = 28 + index * 16;
    dfd.writeUInt16LE(index * 8, offset);
    dfd[offset + 2] = 7;
    dfd[offset + 3] = channels[index];
    dfd.writeUInt32LE(0, offset + 8);
    dfd.writeUInt32LE(255, offset + 12);
  }
  return dfd;
}

function align(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

export function encodeKtx2(levels, { srgb }) {
  const dfd = makeDfd(srgb);
  const levelCount = levels.length;
  const dfdOffset = 80 + levelCount * 24;
  const dataStart = align(dfdOffset + dfd.length, 8);
  const compressed = levels.map(level => zstdCompressSync(level.pixels));
  const payloadOffsets = new Array(levelCount);
  let cursor = dataStart;
  for (let index = levelCount - 1; index >= 0; index -= 1) {
    payloadOffsets[index] = cursor;
    cursor += compressed[index].length;
  }

  const output = Buffer.alloc(cursor);
  KTX2_IDENTIFIER.copy(output, 0);
  let offset = 12;
  const write32 = value => { output.writeUInt32LE(value, offset); offset += 4; };
  write32(srgb ? VK_FORMAT_R8G8B8A8_SRGB : VK_FORMAT_R8G8B8A8_UNORM);
  write32(1);
  write32(levels[0].size);
  write32(levels[0].size);
  write32(0);
  write32(0);
  write32(1);
  write32(levelCount);
  write32(KTX_SS_ZSTD);
  write32(dfdOffset);
  write32(dfd.length);
  write32(0);
  write32(0);
  output.writeBigUInt64LE(0n, offset); offset += 8;
  output.writeBigUInt64LE(0n, offset); offset += 8;
  for (let index = 0; index < levelCount; index += 1) {
    output.writeBigUInt64LE(BigInt(payloadOffsets[index]), offset); offset += 8;
    output.writeBigUInt64LE(BigInt(compressed[index].length), offset); offset += 8;
    output.writeBigUInt64LE(BigInt(levels[index].pixels.length), offset); offset += 8;
  }
  dfd.copy(output, dfdOffset);
  for (let index = levelCount - 1; index >= 0; index -= 1) compressed[index].copy(output, payloadOffsets[index]);
  return output;
}

export async function preparePremiumPbrMaterials(root = resolve(process.cwd(), 'public/assets')) {
  const outputRoot = resolve(root, PREMIUM_PBR_ROOT_RELATIVE_PATH);
  await mkdir(outputRoot, { recursive: true });
  const reports = [];
  for (const surface of PREMIUM_PBR_SURFACES) {
    for (const map of surface.maps) {
      const levels = makeMipChain(surface.id, map, surface.seed);
      const srgb = map === 'base-color' || map === 'emissive';
      const data = encodeKtx2(levels, { srgb });
      const filename = `${surface.id}-${map}.ktx2`;
      await writeFile(resolve(outputRoot, filename), data);
      reports.push({ surface: surface.id, map, filename, bytes: data.length, mipLevels: levels.length, width: levels[0].size, srgb });
    }
  }
  const manifest = {
    version: 1,
    encoding: 'ktx2-zstd-rgba8',
    width: PREMIUM_PBR_TEXTURE_SIZE,
    height: PREMIUM_PBR_TEXTURE_SIZE,
    mipLevels: PREMIUM_PBR_MIP_LEVELS,
    ormChannels: { r: 'occlusion', g: 'roughness', b: 'metallic', a: 'unused' },
    surfaces: PREMIUM_PBR_SURFACES.map(surface => ({ id: surface.id, maps: Object.fromEntries(surface.maps.map(map => [map, `${surface.id}-${map}.ktx2`])) })),
    totalBytes: reports.reduce((sum, report) => sum + report.bytes, 0),
  };
  await writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { outputRoot, manifest, reports };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const result = await preparePremiumPbrMaterials();
  console.log(`PREMIUM_PBR_MATERIALS_PREPARED surfaces=${result.manifest.surfaces.length} textures=${result.reports.length} size=${result.manifest.width} mips=${result.manifest.mipLevels} bytes=${result.manifest.totalBytes}`);
}
