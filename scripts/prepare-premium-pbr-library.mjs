import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { constants, zstdCompressSync } from 'node:zlib';

export const PREMIUM_PBR_SURFACE_ROOT = 'public/assets/materials/premium-pbr';
export const PREMIUM_PBR_SURFACE_RESOLUTION = 512;

const KTX2_IDENTIFIER = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const VK_FORMAT_R8G8B8A8_UNORM = 37;
const VK_FORMAT_R8G8B8A8_SRGB = 43;
const KTX_SS_ZSTD = 2;
const KHR_DF_MODEL_RGBSDA = 1;
const KHR_DF_PRIMARIES_BT709 = 1;
const KHR_DF_TRANSFER_LINEAR = 1;
const KHR_DF_TRANSFER_SRGB = 2;
const CHANNEL_IDS = [0, 1, 2, 15];

export const PREMIUM_PBR_SURFACES = [
  {
    id: 'painted-metal',
    label: 'Painted metal',
    maps: ['base-color', 'normal', 'orm'],
    baseSrgb: true,
    detailScale: 5.5,
  },
  {
    id: 'bare-metal',
    label: 'Bare metal',
    maps: ['base-color', 'normal', 'orm'],
    baseSrgb: true,
    detailScale: 7.5,
  },
  {
    id: 'deck-plate',
    label: 'Deck plate',
    maps: ['base-color', 'normal', 'orm'],
    baseSrgb: true,
    detailScale: 3.25,
  },
  {
    id: 'polymer-rubber',
    label: 'Polymer / rubber',
    maps: ['base-color', 'normal', 'orm'],
    baseSrgb: true,
    detailScale: 8,
  },
  {
    id: 'emissive-fixture',
    label: 'Emissive fixture',
    maps: ['base-color', 'normal', 'orm', 'emissive'],
    baseSrgb: true,
    detailScale: 4,
  },
];

function align(value, multiple) {
  return Math.ceil(value / multiple) * multiple;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hash01(x, y, seed) {
  let value = Math.imul((x + seed * 131) | 0, 374761393) ^ Math.imul((y - seed * 17) | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function distanceToGrid(value, period) {
  const wrapped = ((value % period) + period) % period;
  return Math.min(wrapped, period - wrapped);
}

function materialSignals(surfaceId, x, y, size) {
  const u = x / size;
  const v = y / size;
  const n0 = hash01(x, y, 11);
  const n1 = hash01(Math.floor(x / 3), Math.floor(y / 3), 23);
  const n2 = hash01(Math.floor(x / 11), Math.floor(y / 11), 47);

  if (surfaceId === 'painted-metal') {
    const seam = Math.min(distanceToGrid(x, 128), distanceToGrid(y, 128));
    const seamMask = 1 - smoothstep(1.5, 5.5, seam);
    const scratch = Math.abs(((x * 0.41 + y * 0.09) % 53) - 26.5) < 0.65 && n1 > 0.62 ? 1 : 0;
    const chip = n1 > 0.94 && n0 > 0.55 ? 1 : 0;
    return {
      base: [36 + n2 * 11 + chip * 52, 52 + n2 * 13 + chip * 42, 60 + n2 * 14 + chip * 35],
      height: 0.44 + seamMask * 0.11 - scratch * 0.08 + (n0 - 0.5) * 0.018,
      occlusion: 0.94 - seamMask * 0.18 - chip * 0.04,
      roughness: 0.44 + n1 * 0.16 + scratch * 0.2,
      metallic: chip ? 0.96 : 0.06,
      emissive: [0, 0, 0],
    };
  }

  if (surfaceId === 'bare-metal') {
    const brush = Math.sin((x + n2 * 6) * 0.73) * 0.5 + 0.5;
    const groove = 1 - smoothstep(0.8, 2.8, distanceToGrid(y + Math.sin(x / 37) * 2.2, 64));
    return {
      base: [110 + brush * 24, 117 + brush * 25, 119 + brush * 28],
      height: 0.5 + (brush - 0.5) * 0.035 - groove * 0.07 + (n0 - 0.5) * 0.01,
      occlusion: 0.97 - groove * 0.15,
      roughness: 0.19 + n1 * 0.2 + groove * 0.1,
      metallic: 0.98,
      emissive: [0, 0, 0],
    };
  }

  if (surfaceId === 'deck-plate') {
    const cellX = x % 64;
    const cellY = y % 64;
    const diagonalA = Math.abs(cellX - cellY);
    const diagonalB = Math.abs((63 - cellX) - cellY);
    const tread = Math.min(diagonalA, diagonalB) < 4 && cellX > 8 && cellX < 56 && cellY > 8 && cellY < 56 ? 1 : 0;
    const panelSeam = Math.min(distanceToGrid(x, 128), distanceToGrid(y, 128));
    const seamMask = 1 - smoothstep(1, 4.5, panelSeam);
    return {
      base: [54 + n2 * 12 + tread * 24, 59 + n2 * 12 + tread * 22, 61 + n2 * 13 + tread * 20],
      height: 0.42 + tread * 0.17 - seamMask * 0.11 + (n0 - 0.5) * 0.018,
      occlusion: 0.9 - seamMask * 0.22 + tread * 0.05,
      roughness: 0.47 + n1 * 0.18 - tread * 0.08,
      metallic: 0.82,
      emissive: [0, 0, 0],
    };
  }

  if (surfaceId === 'polymer-rubber') {
    const stipple = n0 > 0.6 ? (n0 - 0.6) * 0.22 : 0;
    const molding = 1 - smoothstep(1, 6, Math.min(distanceToGrid(x, 96), distanceToGrid(y, 96)));
    return {
      base: [24 + n2 * 12, 27 + n2 * 12, 29 + n2 * 13],
      height: 0.5 + stipple - molding * 0.045,
      occlusion: 0.92 - molding * 0.1,
      roughness: 0.72 + n1 * 0.18,
      metallic: 0.0,
      emissive: [0, 0, 0],
    };
  }

  const stripX = Math.abs(u - 0.5);
  const stripY = Math.abs(v - 0.5);
  const cyan = stripX < 0.055 && stripY < 0.41;
  const amber = stripY > 0.32 && stripY < 0.385 && stripX < 0.34;
  const recess = stripX < 0.085 && stripY < 0.44;
  return {
    base: recess ? [28, 38, 42] : [47 + n2 * 10, 52 + n2 * 10, 54 + n2 * 10],
    height: 0.45 + (recess ? 0.06 : 0) + (n0 - 0.5) * 0.012,
    occlusion: recess ? 0.78 : 0.95,
    roughness: recess ? 0.3 : 0.58 + n1 * 0.08,
    metallic: recess ? 0.25 : 0.72,
    emissive: cyan ? [26, 224, 255] : amber ? [255, 122, 34] : [0, 0, 0],
  };
}

function buildSurfaceMaps(surface, size) {
  const count = size * size;
  const base = new Uint8Array(count * 4);
  const normal = new Uint8Array(count * 4);
  const orm = new Uint8Array(count * 4);
  const emissive = new Uint8Array(count * 4);
  const heights = new Float32Array(count);
  const signals = new Array(count);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const signal = materialSignals(surface.id, x, y, size);
      signals[index] = signal;
      heights[index] = signal.height;
      const offset = index * 4;
      base[offset] = clampByte(signal.base[0]);
      base[offset + 1] = clampByte(signal.base[1]);
      base[offset + 2] = clampByte(signal.base[2]);
      base[offset + 3] = 255;
      orm[offset] = clampByte(signal.occlusion * 255);
      orm[offset + 1] = clampByte(signal.roughness * 255);
      orm[offset + 2] = clampByte(signal.metallic * 255);
      orm[offset + 3] = 255;
      emissive[offset] = signal.emissive[0];
      emissive[offset + 1] = signal.emissive[1];
      emissive[offset + 2] = signal.emissive[2];
      emissive[offset + 3] = 255;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = heights[y * size + ((x - 1 + size) % size)];
      const right = heights[y * size + ((x + 1) % size)];
      const up = heights[((y - 1 + size) % size) * size + x];
      const down = heights[((y + 1) % size) * size + x];
      const dx = (right - left) * surface.detailScale;
      const dy = (down - up) * surface.detailScale;
      const length = Math.hypot(dx, dy, 1) || 1;
      const offset = (y * size + x) * 4;
      normal[offset] = clampByte(((-dx / length) * 0.5 + 0.5) * 255);
      normal[offset + 1] = clampByte(((-dy / length) * 0.5 + 0.5) * 255);
      normal[offset + 2] = clampByte(((1 / length) * 0.5 + 0.5) * 255);
      normal[offset + 3] = 255;
    }
  }

  return { base, normal, orm, emissive };
}

function downsampleRgba(source, width, height) {
  const nextWidth = Math.max(1, width >> 1);
  const nextHeight = Math.max(1, height >> 1);
  const next = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    for (let x = 0; x < nextWidth; x += 1) {
      const totals = [0, 0, 0, 0];
      let samples = 0;
      for (let oy = 0; oy < 2; oy += 1) {
        for (let ox = 0; ox < 2; ox += 1) {
          const sx = Math.min(width - 1, x * 2 + ox);
          const sy = Math.min(height - 1, y * 2 + oy);
          const sourceOffset = (sy * width + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) totals[channel] += source[sourceOffset + channel];
          samples += 1;
        }
      }
      const targetOffset = (y * nextWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) next[targetOffset + channel] = clampByte(totals[channel] / samples);
    }
  }
  return { pixels: next, width: nextWidth, height: nextHeight };
}

function mipChain(basePixels, width, height) {
  const levels = [{ pixels: basePixels, width, height }];
  let current = levels[0];
  while (current.width > 1 || current.height > 1) {
    current = downsampleRgba(current.pixels, current.width, current.height);
    levels.push(current);
  }
  return levels;
}

function buildDfd(srgb) {
  const blockSize = 24 + 16 * 4;
  const totalSize = blockSize + 4;
  const dfd = Buffer.alloc(totalSize);
  dfd.writeUInt32LE(totalSize, 0);
  dfd.writeUInt32LE(0, 4);
  dfd.writeUInt16LE(2, 8);
  dfd.writeUInt16LE(blockSize, 10);
  dfd[12] = KHR_DF_MODEL_RGBSDA;
  dfd[13] = KHR_DF_PRIMARIES_BT709;
  dfd[14] = srgb ? KHR_DF_TRANSFER_SRGB : KHR_DF_TRANSFER_LINEAR;
  dfd[15] = 0;
  dfd[20] = 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const offset = 28 + channel * 16;
    dfd.writeUInt16LE(channel * 8, offset);
    dfd[offset + 2] = 7;
    dfd[offset + 3] = CHANNEL_IDS[channel];
    dfd.writeUInt32LE(0, offset + 8);
    dfd.writeUInt32LE(255, offset + 12);
  }
  return dfd;
}

function buildOrientationKvd() {
  const payload = Buffer.concat([Buffer.from('KTXorientation\0', 'ascii'), Buffer.from('rd\0', 'ascii')]);
  const paddedLength = align(payload.length, 4);
  const kvd = Buffer.alloc(4 + paddedLength);
  kvd.writeUInt32LE(payload.length, 0);
  payload.copy(kvd, 4);
  return kvd;
}

export function buildKtx2RgbaZstd(basePixels, width, height, srgb) {
  const levels = mipChain(basePixels, width, height);
  const compressed = levels.map(level => zstdCompressSync(Buffer.from(level.pixels), {
    pledgedSrcSize: level.pixels.byteLength,
    params: {
      [constants.ZSTD_c_compressionLevel]: 12,
      [constants.ZSTD_c_checksumFlag]: 1,
    },
  }));
  const headerSize = 80;
  const levelIndexSize = levels.length * 24;
  const dfd = buildDfd(srgb);
  const dfdOffset = headerSize + levelIndexSize;
  const kvd = buildOrientationKvd();
  const kvdOffset = dfdOffset + dfd.length;
  const dataStart = align(kvdOffset + kvd.length, 8);
  const levelEntries = new Array(levels.length);
  const dataParts = [];
  let cursor = dataStart;

  for (let level = levels.length - 1; level >= 0; level -= 1) {
    const aligned = align(cursor, 4);
    if (aligned > cursor) dataParts.push(Buffer.alloc(aligned - cursor));
    cursor = aligned;
    const bytes = compressed[level];
    levelEntries[level] = {
      offset: cursor,
      length: bytes.length,
      uncompressedLength: levels[level].pixels.byteLength,
    };
    dataParts.push(bytes);
    cursor += bytes.length;
  }

  const fixed = Buffer.alloc(dataStart);
  KTX2_IDENTIFIER.copy(fixed, 0);
  fixed.writeUInt32LE(srgb ? VK_FORMAT_R8G8B8A8_SRGB : VK_FORMAT_R8G8B8A8_UNORM, 12);
  fixed.writeUInt32LE(1, 16);
  fixed.writeUInt32LE(width, 20);
  fixed.writeUInt32LE(height, 24);
  fixed.writeUInt32LE(0, 28);
  fixed.writeUInt32LE(0, 32);
  fixed.writeUInt32LE(1, 36);
  fixed.writeUInt32LE(levels.length, 40);
  fixed.writeUInt32LE(KTX_SS_ZSTD, 44);
  fixed.writeUInt32LE(dfdOffset, 48);
  fixed.writeUInt32LE(dfd.length, 52);
  fixed.writeUInt32LE(kvdOffset, 56);
  fixed.writeUInt32LE(kvd.length, 60);
  fixed.writeBigUInt64LE(0n, 64);
  fixed.writeBigUInt64LE(0n, 72);

  for (let level = 0; level < levelEntries.length; level += 1) {
    const offset = headerSize + level * 24;
    const entry = levelEntries[level];
    fixed.writeBigUInt64LE(BigInt(entry.offset), offset);
    fixed.writeBigUInt64LE(BigInt(entry.length), offset + 8);
    fixed.writeBigUInt64LE(BigInt(entry.uncompressedLength), offset + 16);
  }
  dfd.copy(fixed, dfdOffset);
  kvd.copy(fixed, kvdOffset);
  return Buffer.concat([fixed, ...dataParts]);
}

function mapSrgb(map) {
  return map === 'base-color' || map === 'emissive';
}

function mapPixels(maps, map) {
  if (map === 'base-color') return maps.base;
  if (map === 'normal') return maps.normal;
  if (map === 'orm') return maps.orm;
  if (map === 'emissive') return maps.emissive;
  throw new Error(`Unknown premium PBR map ${map}`);
}

export async function writePremiumPbrSurfaceLibrary() {
  const root = resolve(process.cwd(), PREMIUM_PBR_SURFACE_ROOT);
  await mkdir(root, { recursive: true });
  const manifest = {
    version: 1,
    format: 'KTX2',
    supercompression: 'Zstandard',
    resolution: PREMIUM_PBR_SURFACE_RESOLUTION,
    mipmapped: true,
    ormPacking: { occlusion: 'R', roughness: 'G', metallic: 'B' },
    surfaces: [],
  };

  for (const surface of PREMIUM_PBR_SURFACES) {
    const maps = buildSurfaceMaps(surface, PREMIUM_PBR_SURFACE_RESOLUTION);
    const output = { id: surface.id, label: surface.label, maps: {} };
    for (const map of surface.maps) {
      const filename = `${surface.id}-${map}.ktx2`;
      const ktx2 = buildKtx2RgbaZstd(
        mapPixels(maps, map),
        PREMIUM_PBR_SURFACE_RESOLUTION,
        PREMIUM_PBR_SURFACE_RESOLUTION,
        mapSrgb(map),
      );
      await writeFile(resolve(root, filename), ktx2);
      output.maps[map] = { file: filename, bytes: ktx2.length, srgb: mapSrgb(map) };
    }
    manifest.surfaces.push(output);
  }

  await writeFile(resolve(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const totalBytes = manifest.surfaces.reduce(
    (sum, surface) => sum + Object.values(surface.maps).reduce((mapSum, map) => mapSum + map.bytes, 0),
    0,
  );
  console.log(`PREMIUM_PBR_SURFACE_LIBRARY_READY surfaces=${manifest.surfaces.length} resolution=${manifest.resolution} bytes=${totalBytes}`);
  return { root, manifest, totalBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  await writePremiumPbrSurfaceLibrary();
}
