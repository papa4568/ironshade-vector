import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { REFINERY_DECAL_TARGETS } from '../scripts/prepare-refinery-decal-atlas.mjs';
import { REFINERY_ROUTE_DECAL_TARGETS } from '../scripts/prepare-refinery-route-decals.mjs';
import { buildKtx2RgbaZstd } from './p28f1-refinery-surface-source.mjs';

// Preserve the existing 4x2 atlas UV cell layout: presentation detail may
// change, but route-card geometry, physical bounds, and telegraphs may not.
export const REFINERY_F5_DECAL_ATLAS = Object.freeze({
  size: 2048,
  file: 'refinery-decal-atlas-f5.png',
  path: 'public/assets/models/environments/refinery-decal-atlas-f5.png',
});
export const REFINERY_F5_EFFECT_ATLAS = Object.freeze({
  size: 1024,
  file: 'refinery-local-effects-f5.ktx2',
  path: 'public/assets/effects/refinery-local-effects-f5.ktx2',
  kinds: Object.freeze(['dust', 'sparks', 'vapor', 'debris']),
});

export const REFINERY_F5_LIVE_MODEL_PATHS = Object.freeze([...new Set([...REFINERY_DECAL_TARGETS, ...REFINERY_ROUTE_DECAL_TARGETS].map(item => item.relativePath))].sort());

function clamp(value) { return Math.max(0, Math.min(255, Math.round(value))); }
function hash(x, y, seed) {
  let h = Math.imul(x + seed * 73, 0x45d9f3b) ^ Math.imul(y - seed * 37, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function distanceToLine(v, period) {
  const phase = ((v % period) + period) % period;
  return Math.min(phase, period - phase);
}
function put(bytes, width, x, y, r, g, b, a) {
  const i = (y * width + x) * 4;
  bytes[i] = clamp(r); bytes[i + 1] = clamp(g); bytes[i + 2] = clamp(b); bytes[i + 3] = clamp(a);
}

export function createRefineryF5DecalPixels() {
  const size = REFINERY_F5_DECAL_ATLAS.size;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const row = Math.floor(y / 1024);
    const localY = y % 1024;
    const v = localY / 1024;
    for (let x = 0; x < size; x += 1) {
      const column = Math.floor(x / 512);
      const localX = x % 512;
      const u = localX / 512;
      const tile = row * 4 + column;
      const grain = hash(x, y, 13) - 0.5;
      const pit = hash(Math.floor(x / 5), Math.floor(y / 7), 37);
      const edge = smooth(0, 0.04, Math.min(u, v, 1 - u, 1 - v));
      const scuff = (hash(Math.floor(x / 3), Math.floor(y / 83), 61) > 0.93
        && distanceToLine(localX + localY * 0.27, 109) < 1.8) ? 1 : 0;
      let color = [0, 0, 0, 0];
      if (tile === 0) {
        const seam = Math.abs(u - 0.5) < 0.024 || Math.abs(v - 0.5) < 0.015;
        const bolt = Math.hypot((u - 0.5) * 2.7, ((v * 8) % 1 - 0.5) * 1.5) < 0.13;
        if (seam || bolt) color = bolt ? [172 + grain * 32, 166, 146, 210] : [25 + grain * 22, 32, 35, 166];
      } else if (tile === 1) {
        if (v > 0.08 && v < 0.92 && u > 0.025 && u < 0.975) {
          const amber = Math.floor((u * 16 + v * 9) / 0.8) % 2 === 0;
          const chip = pit > 0.87 || scuff;
          color = amber ? [214 - chip * 95 + grain * 42, 157 - chip * 83, 46 + grain * 25, 222 - chip * 90]
            : [30 + grain * 25 + chip * 38, 35 + grain * 24, 35, 218 - chip * 75];
        }
      } else if (tile === 2) {
        if (u > 0.08 && u < 0.92 && v > 0.22 && v < 0.78) {
          const rim = u < 0.095 || u > 0.905 || v < 0.235 || v > 0.765;
          const code = v > 0.52 && v < 0.68 && u > 0.16 && u < 0.82 && hash(Math.floor(u * 260), 1, 77) > 0.43;
          const rule = v > 0.34 && v < 0.375 && u > 0.14 && u < 0.83;
          color = rim || code || rule ? [39 + grain * 17, 52, 58, 216] : [186 + grain * 19, 192 + grain * 17, 174, 202];
        }
      } else if (tile === 3) {
        const pool = Math.max(0, 1 - Math.hypot((u - 0.43) * 1.5, (v - 0.53) * 1.25));
        const drip = Math.max(0, 1 - Math.abs(u - (0.18 + Math.sin(v * 13) * 0.03)) * 70) * Math.max(0, v - 0.2);
        const fracture = pit > 0.69 ? 1 : 0.15;
        color = [37 + grain * 17, 44 + grain * 19, 40 + grain * 20,
          Math.max(pool * 116 * fracture, drip * 162) * edge];
      } else if (tile === 4) {
        const d = Math.hypot((u - 0.52) * 1.9, (v - 0.49) * 1.75);
        const ring = Math.max(0, 1 - Math.abs(d - 0.63) * 5);
        const char = Math.max(0, 1 - d * 1.5);
        const crack = scuff && d < 0.85;
        color = [60 + ring * 47 + grain * 25, 51 + ring * 20 + grain * 18,
          64 + ring * 35 + grain * 24,
          Math.max(ring * 132, char * 98, crack ? 154 : 0) * edge];
      } else if (tile === 5) {
        if (u > 0.1 && u < 0.9 && v > 0.15 && v < 0.85) {
          const weld = Math.abs(u - 0.13) < 0.018 || Math.abs(u - 0.87) < 0.018
            || Math.abs(v - 0.18) < 0.012 || Math.abs(v - 0.82) < 0.012;
          const stitch = distanceToLine(localY + localX * 0.18, 48) < 3 && u > 0.72;
          color = weld || stitch ? [88 + grain * 28, 87, 76, 215] : [132 + grain * 40 - scuff * 66, 130 + grain * 31, 120, 163];
        }
      } else if (tile === 6) {
        const stain = Math.max(0, 1 - Math.hypot((u - 0.54) * 2.3, (v - 0.4) * 1.5));
        color = [24 + grain * 25, 55 + grain * 31, 57 + grain * 28, stain * 95 * edge];
      } else {
        const d = Math.hypot((u - 0.35) * 2.1, (v - 0.65) * 1.45);
        color = [105 + grain * 33, 55 + grain * 21, 29 + grain * 15, Math.max(0, 1 - d) * 130 * edge];
      }
      put(pixels, size, x, y, ...color);
    }
  }
  return pixels;
}

function pngChunk(type, data) {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0);
  b.write(type, 4, 4, 'ascii');
  data.copy(b, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < data.length + 8; i += 1) {
    crc ^= b[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  b.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return b;
}
export function createRefineryF5DecalPng() {
  const { size } = REFINERY_F5_DECAL_ATLAS;
  const pixels = createRefineryF5DecalPixels();
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const offset = y * (size * 4 + 1);
    pixels.copy(scanlines, offset + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createRefineryF5EffectPixels() {
  const size = REFINERY_F5_EFFECT_ATLAS.size;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const row = Math.floor(y / 512);
    const v = (y % 512) / 512;
    for (let x = 0; x < size; x += 1) {
      const col = Math.floor(x / 512);
      const u = (x % 512) / 512;
      const tile = row * 2 + col;
      const h = hash(x, y, tile + 91);
      const n = hash(Math.floor(x / 9), Math.floor(y / 13), tile + 87);
      const dx = u - 0.5; const dy = v - 0.5;
      const d = Math.hypot(dx, dy);
      let color;
      if (tile === 0) {
        const alpha = Math.max(0, 1 - d * 2) ** 1.8 * (0.14 + n * 0.64 + h * 0.22);
        color = [178 + h * 32, 172 + h * 24, 148 + h * 20, alpha * 170];
      } else if (tile === 1) {
        const shaft = Math.abs(dx + dy * 0.32 + Math.sin(dy * 29) * 0.009);
        const branch = Math.abs(dx - dy * 0.55 - 0.09) < 0.012 && dy > 0;
        const alpha = Math.max(0, 1 - d * 1.5) * Math.max(branch ? 0.6 : 0, 1 - shaft * 110);
        color = [255, 153 + h * 72, 46 + h * 30, alpha * 238];
      } else if (tile === 2) {
        const lobe = Math.max(0, 1 - Math.hypot(dx * 2.4 + Math.sin(v * 11) * 0.15, dy * 1.75));
        const alpha = lobe ** 1.6 * (0.21 + n * 0.5 + h * 0.18);
        color = [169 + n * 31, 193 + n * 29, 199 + n * 27, alpha * 100];
      } else {
        const angle = Math.atan2(dy, dx);
        const radius = 0.28 + Math.sin(angle * 5) * 0.065 + Math.cos(angle * 3) * 0.035;
        const alpha = d < radius ? 210 : 0;
        color = [75 + n * 44 + h * 17, 79 + n * 36, 76 + n * 28, alpha];
      }
      put(pixels, size, x, y, ...color);
    }
  }
  return pixels;
}

export function patchRefineryF5AtlasGlb(bytes, path) {
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(path + ': malformed source GLB');
  }
  const jsonLength = bytes.readUInt32LE(12);
  const binAt = 20 + jsonLength;
  const gltf = JSON.parse(bytes.subarray(20, binAt).toString('utf8').trim());
  const targets = (gltf.images ?? []).filter(image => image.uri === 'refinery-decal-atlas.png' || image.uri === REFINERY_F5_DECAL_ATLAS.file);
  if (targets.length === 0) throw new Error(path + ': no live refinery decal atlas binding');
  targets.forEach(image => { image.uri = REFINERY_F5_DECAL_ATLAS.file; });
  gltf.extras = { ...(gltf.extras ?? {}), ironshadeP28F5Atlases: {
    resolution: 2048, atlas: REFINERY_F5_DECAL_ATLAS.file, placed: true,
    originalUvLayoutPreserved: true, gameplayBoundsChanged: false, telegraphOpacityUnchanged: true,
  } };
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonPad = Buffer.alloc((4 - json.length % 4) % 4, 0x20);
  const rest = bytes.subarray(binAt);
  const result = Buffer.concat([Buffer.alloc(12), Buffer.from([0, 0, 0, 0, 0x4a, 0x53, 0x4f, 0x4e]), json, jsonPad, rest]);
  result.write('glTF', 0); result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8); result.writeUInt32LE(json.length + jsonPad.length, 12);
  return result;
}

export async function writeRefineryF5Atlases() {
  const decal = createRefineryF5DecalPng();
  const effect = buildKtx2RgbaZstd(createRefineryF5EffectPixels(), 1024, 1024, true);
  for (const [file, bytes] of [[REFINERY_F5_DECAL_ATLAS.path, decal], [REFINERY_F5_EFFECT_ATLAS.path, effect]]) {
    const output = resolve(process.cwd(), file);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, bytes);
  }
  for (const target of REFINERY_F5_LIVE_MODEL_PATHS) {
    const output = resolve(process.cwd(), 'public/assets/models', target);
    await writeFile(output, patchRefineryF5AtlasGlb(await readFile(output), target));
  }
  console.log('P28_F5_ATLASES_READY decals=' + decal.length + ' effects=' + effect.length + ' liveModels=' + REFINERY_F5_LIVE_MODEL_PATHS.length);
  return { decalBytes: decal.length, effectBytes: effect.length, liveModels: REFINERY_F5_LIVE_MODEL_PATHS.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeRefineryF5Atlases();
}
