import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ATLAS_SIZE = 512;
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 2;
const CELL_WIDTH = ATLAS_SIZE / ATLAS_COLUMNS;
const CELL_HEIGHT = ATLAS_SIZE / ATLAS_ROWS;
const UV_INSET = 2;
const DECAL_MATERIAL_NAME = 'refinery-detail-atlas';
const DECAL_MESH_NAME = 'p28-b5-refinery-detail-atlas';
const ATLAS_URI = '../../materials/refinery-detail/refinery-decal-atlas.png';

export const REFINERY_DECAL_ATLAS = Object.freeze({
  id: 'refinery-decal-atlas-v1',
  relativePath: 'materials/refinery-detail/refinery-decal-atlas.png',
  width: ATLAS_SIZE,
  height: ATLAS_SIZE,
  columns: ATLAS_COLUMNS,
  rows: ATLAS_ROWS,
  details: Object.freeze({
    'panel-seam': Object.freeze({ column: 0, row: 0 }),
    'hazard-stripe': Object.freeze({ column: 1, row: 0 }),
    'service-label': Object.freeze({ column: 2, row: 0 }),
    grime: Object.freeze({ column: 3, row: 0 }),
    'heat-stain': Object.freeze({ column: 0, row: 1 }),
    'repair-mark': Object.freeze({ column: 1, row: 1 }),
  }),
});

const processorCards = Object.freeze([
  { detail: 'hazard-stripe', plane: 'xy', surface: 0.775, offset: 0.012, center: [0, 0.57], size: [1.36, 0.23] },
  { detail: 'service-label', plane: 'xy', surface: 0.775, offset: 0.012, center: [-0.42, 1.64], size: [0.62, 0.38] },
  { detail: 'heat-stain', plane: 'xy', surface: 0.775, offset: 0.012, center: [0.38, 1.23], size: [0.84, 0.92] },
  { detail: 'repair-mark', plane: 'xy', surface: 0.775, offset: 0.012, center: [0.42, 2.25], size: [0.72, 0.48] },
]);

const pipeRackCards = Object.freeze([
  { detail: 'panel-seam', plane: 'xy', surface: 0.47, offset: 0.012, center: [0, 1.12], size: [2.95, 0.065] },
  { detail: 'service-label', plane: 'xy', surface: 0.47, offset: 0.012, center: [-0.92, 1.12], size: [0.66, 0.18] },
  { detail: 'grime', plane: 'xy', surface: 0.47, offset: 0.012, center: [0.92, 1.12], size: [0.74, 0.22] },
]);

const gantryCards = Object.freeze([
  { detail: 'hazard-stripe', plane: 'xy', surface: 0.41, offset: 0.012, center: [0, 3.46], size: [3.35, 0.28] },
  { detail: 'repair-mark', plane: 'xy', surface: 0.41, offset: 0.012, center: [1.82, 3.46], size: [0.62, 0.28] },
]);

export const REFINERY_DECAL_TARGETS = Object.freeze([
  { family: 'processor', relativePath: 'environments/refinery-processor-lod1.glb', cards: processorCards },
  { family: 'processor', relativePath: 'environments/refinery-processor-lod2.glb', cards: processorCards },
  { family: 'pipeRack', relativePath: 'environments/refinery-pipe-rack-lod1.glb', cards: pipeRackCards },
  { family: 'pipeRack', relativePath: 'environments/refinery-pipe-rack-lod2.glb', cards: pipeRackCards },
  { family: 'gantry', relativePath: 'environments/refinery-smelter-gantry-lod1.glb', cards: gantryCards },
  { family: 'gantry', relativePath: 'environments/refinery-smelter-gantry-lod2.glb', cards: gantryCards },
]);

function align(value, multiple = 4) {
  return Math.ceil(value / multiple) * multiple;
}

function pad(buffer, multiple, fill) {
  const remainder = buffer.length % multiple;
  if (remainder === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(multiple - remainder, fill)]);
}

function parseGlb(buffer, label = 'GLB') {
  if (buffer.length < 28 || buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${label}: invalid GLB header`);
  if (buffer.readUInt32LE(4) !== 2) throw new Error(`${label}: expected glTF 2.0`);
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error(`${label}: GLB byte length mismatch`);
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${label}: JSON chunk is missing`);
  const jsonEnd = 20 + jsonLength;
  const gltf = JSON.parse(buffer.subarray(20, jsonEnd).toString('utf8').trim());
  if (buffer.readUInt32LE(jsonEnd + 4) !== 0x004e4942) throw new Error(`${label}: BIN chunk is missing`);
  const binaryLength = buffer.readUInt32LE(jsonEnd);
  const binary = buffer.subarray(jsonEnd + 8, jsonEnd + 8 + binaryLength);
  return { gltf, binary };
}

function encodeGlb(gltf, binary) {
  const json = pad(Buffer.from(JSON.stringify(gltf), 'utf8'), 4, 0x20);
  const bin = pad(binary, 4, 0);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function setPixel(rgba, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= ATLAS_SIZE || y >= ATLAS_SIZE) return;
  const offset = (y * ATLAS_SIZE + x) * 4;
  rgba[offset] = r;
  rgba[offset + 1] = g;
  rgba[offset + 2] = b;
  rgba[offset + 3] = a;
}

function cellOrigin(detail) {
  const cell = REFINERY_DECAL_ATLAS.details[detail];
  return [cell.column * CELL_WIDTH, cell.row * CELL_HEIGHT];
}

function paintPanelSeam(rgba) {
  const [ox, oy] = cellOrigin('panel-seam');
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      const seam = Math.abs(x - CELL_WIDTH / 2) <= 3 || Math.abs(y - CELL_HEIGHT / 2) <= 2;
      const rivet = ((x - CELL_WIDTH / 2) ** 2 + ((y % 48) - 24) ** 2) < 16;
      if (seam) setPixel(rgba, ox + x, oy + y, 28, 31, 31, 150);
      if (rivet) setPixel(rgba, ox + x, oy + y, 162, 158, 142, 190);
    }
  }
}

function paintHazard(rgba) {
  const [ox, oy] = cellOrigin('hazard-stripe');
  for (let y = 12; y < CELL_HEIGHT - 12; y += 1) {
    for (let x = 8; x < CELL_WIDTH - 8; x += 1) {
      const yellow = Math.floor((x + y * 0.58) / 22) % 2 === 0;
      setPixel(rgba, ox + x, oy + y, yellow ? 214 : 34, yellow ? 151 : 35, yellow ? 47 : 31, 198);
    }
  }
}

function paintServiceLabel(rgba) {
  const [ox, oy] = cellOrigin('service-label');
  for (let y = 58; y < CELL_HEIGHT - 58; y += 1) {
    for (let x = 14; x < CELL_WIDTH - 14; x += 1) {
      const border = x < 18 || x > CELL_WIDTH - 19 || y < 62 || y > CELL_HEIGHT - 63;
      const bar = y > 92 && y < 98 || y > 112 && y < 118 || y > 132 && y < 138;
      const tab = x < 34 && y > 158 && y < 178;
      if (border) setPixel(rgba, ox + x, oy + y, 45, 53, 53, 210);
      else if (bar) setPixel(rgba, ox + x, oy + y, 55, 61, 60, 195);
      else if (tab) setPixel(rgba, ox + x, oy + y, 210, 119, 40, 210);
      else setPixel(rgba, ox + x, oy + y, 190, 193, 174, 178);
    }
  }
}

function paintGrime(rgba) {
  const [ox, oy] = cellOrigin('grime');
  const cx = CELL_WIDTH * 0.52;
  const cy = CELL_HEIGHT * 0.52;
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      const dx = (x - cx) / (CELL_WIDTH * 0.5);
      const dy = (y - cy) / (CELL_HEIGHT * 0.5);
      const radial = Math.max(0, 1 - Math.hypot(dx, dy));
      const noise = ((x * 37 + y * 17 + ((x * y) % 97)) % 101) / 100;
      const alpha = Math.round(118 * radial * Math.max(0, noise - 0.28));
      if (alpha > 4) setPixel(rgba, ox + x, oy + y, 43, 36, 27, alpha);
    }
  }
}

function paintHeat(rgba) {
  const [ox, oy] = cellOrigin('heat-stain');
  const cx = CELL_WIDTH / 2;
  const cy = CELL_HEIGHT / 2;
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      const dx = (x - cx) / (CELL_WIDTH * 0.48);
      const dy = (y - cy) / (CELL_HEIGHT * 0.46);
      const d = Math.hypot(dx, dy);
      if (d >= 1) continue;
      const ring = Math.max(0, 1 - Math.abs(d - 0.56) * 2.4);
      const core = Math.max(0, 1 - d * 1.45);
      const alpha = Math.round(118 * Math.max(ring * 0.78, core * 0.35));
      const hot = d < 0.48;
      setPixel(rgba, ox + x, oy + y, hot ? 97 : 56, hot ? 63 : 72, hot ? 43 : 86, alpha);
    }
  }
}

function paintRepair(rgba) {
  const [ox, oy] = cellOrigin('repair-mark');
  for (let y = 42; y < CELL_HEIGHT - 42; y += 1) {
    for (let x = 18; x < CELL_WIDTH - 18; x += 1) {
      const border = x < 23 || x > CELL_WIDTH - 24 || y < 47 || y > CELL_HEIGHT - 48;
      const weld = Math.abs((x + y * 0.22) - 84) < 2 || Math.abs((x - y * 0.18) - 24) < 2;
      const bolt = [[30, 56], [98, 56], [30, 200], [98, 200]].some(([bx, by]) => (x - bx) ** 2 + (y - by) ** 2 < 20);
      const value = 126 + ((x * 11 + y * 7) % 28);
      if (border || weld) setPixel(rgba, ox + x, oy + y, 71, 72, 67, 205);
      else if (bolt) setPixel(rgba, ox + x, oy + y, 205, 190, 156, 220);
      else setPixel(rgba, ox + x, oy + y, value, value - 5, value - 13, 156);
    }
  }
}

export function createRefineryDecalAtlasPng() {
  const rgba = Buffer.alloc(ATLAS_SIZE * ATLAS_SIZE * 4);
  paintPanelSeam(rgba);
  paintHazard(rgba);
  paintServiceLabel(rgba);
  paintGrime(rgba);
  paintHeat(rgba);
  paintRepair(rgba);

  const scanlines = Buffer.alloc((ATLAS_SIZE * 4 + 1) * ATLAS_SIZE);
  for (let y = 0; y < ATLAS_SIZE; y += 1) {
    const rowOffset = y * (ATLAS_SIZE * 4 + 1);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * ATLAS_SIZE * 4, (y + 1) * ATLAS_SIZE * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ATLAS_SIZE, 0);
  ihdr.writeUInt32BE(ATLAS_SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function detailUv(detail) {
  const cell = REFINERY_DECAL_ATLAS.details[detail];
  if (!cell) throw new Error(`Unknown refinery decal detail ${detail}`);
  const u0 = (cell.column * CELL_WIDTH + UV_INSET) / ATLAS_SIZE;
  const u1 = ((cell.column + 1) * CELL_WIDTH - UV_INSET) / ATLAS_SIZE;
  const v0 = (cell.row * CELL_HEIGHT + UV_INSET) / ATLAS_SIZE;
  const v1 = ((cell.row + 1) * CELL_HEIGHT - UV_INSET) / ATLAS_SIZE;
  return [u0, v0, u1, v1];
}

function mergedCardGeometry(cards) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (const card of cards) {
    if (card.plane !== 'xy') throw new Error(`P28-B5 decals must remain vertical; unsupported plane ${card.plane}`);
    const base = positions.length / 3;
    const [cx, cy] = card.center;
    const [width, height] = card.size;
    const z = card.surface + card.offset;
    const x0 = cx - width / 2;
    const x1 = cx + width / 2;
    const y0 = cy - height / 2;
    const y1 = cy + height / 2;
    positions.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z);
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
    const [u0, v0, u1, v1] = detailUv(card.detail);
    uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function bounds(values, width) {
  const min = Array(width).fill(Number.POSITIVE_INFINITY);
  const max = Array(width).fill(Number.NEGATIVE_INFINITY);
  for (let i = 0; i < values.length; i += width) {
    for (let component = 0; component < width; component += 1) {
      min[component] = Math.min(min[component], values[i + component]);
      max[component] = Math.max(max[component], values[i + component]);
    }
  }
  return { min, max };
}

function appendGeometry(gltf, binary, geometry) {
  gltf.bufferViews ??= [];
  gltf.accessors ??= [];
  const chunks = [binary];
  let cursor = align(binary.length);
  if (cursor > binary.length) chunks.push(Buffer.alloc(cursor - binary.length));

  const addPart = (data, target) => {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const offset = align(cursor);
    if (offset > cursor) chunks.push(Buffer.alloc(offset - cursor));
    const viewIndex = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    chunks.push(bytes);
    cursor = offset + bytes.length;
    return viewIndex;
  };

  const positionView = addPart(geometry.positions, 34962);
  const normalView = addPart(geometry.normals, 34962);
  const uvView = addPart(geometry.uvs, 34962);
  const indexView = addPart(geometry.indices, 34963);
  const positionBounds = bounds(geometry.positions, 3);
  const accessorBase = gltf.accessors.length;
  gltf.accessors.push(
    { bufferView: positionView, componentType: 5126, count: geometry.positions.length / 3, type: 'VEC3', ...positionBounds },
    { bufferView: normalView, componentType: 5126, count: geometry.normals.length / 3, type: 'VEC3' },
    { bufferView: uvView, componentType: 5126, count: geometry.uvs.length / 2, type: 'VEC2' },
    { bufferView: indexView, componentType: 5123, count: geometry.indices.length, type: 'SCALAR', min: [0], max: [geometry.positions.length / 3 - 1] },
  );
  const merged = Buffer.concat(chunks);
  const padded = pad(merged, 4, 0);
  gltf.buffers = [{ ...(gltf.buffers?.[0] ?? {}), byteLength: padded.length }];
  return {
    binary: padded,
    attributes: { POSITION: accessorBase, NORMAL: accessorBase + 1, TEXCOORD_0: accessorBase + 2 },
    indices: accessorBase + 3,
  };
}

export function upgradeRefineryDecalGlb(input, target) {
  const { gltf, binary } = parseGlb(input, target.relativePath);
  if (gltf.extras?.ironshadeP28B5DecalAtlas?.version === 1) return input;
  if (!Array.isArray(gltf.meshes) || gltf.meshes.length === 0) throw new Error(`${target.relativePath}: no base meshes found`);
  if (!Array.isArray(gltf.scenes) || gltf.scenes.length === 0) throw new Error(`${target.relativePath}: no scene found`);

  const baseCounts = {
    nodes: gltf.nodes?.length ?? 0,
    meshes: gltf.meshes.length,
    materials: gltf.materials?.length ?? 0,
    textures: gltf.textures?.length ?? 0,
    images: gltf.images?.length ?? 0,
    samplers: gltf.samplers?.length ?? 0,
    accessors: gltf.accessors?.length ?? 0,
    bufferViews: gltf.bufferViews?.length ?? 0,
    binaryBytes: binary.length,
  };

  gltf.samplers ??= [];
  gltf.images ??= [];
  gltf.textures ??= [];
  gltf.materials ??= [];
  gltf.nodes ??= [];
  const sampler = gltf.samplers.push({ name: 'p28-b5-refinery-decal-sampler', magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }) - 1;
  const image = gltf.images.push({ name: 'p28-b5-refinery-decal-atlas', uri: ATLAS_URI, mimeType: 'image/png' }) - 1;
  const texture = gltf.textures.push({ name: 'p28-b5-refinery-decal-atlas', sampler, source: image }) - 1;
  gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed ?? []), 'KHR_materials_unlit'])];
  const material = gltf.materials.push({
    name: DECAL_MATERIAL_NAME,
    doubleSided: true,
    alphaMode: 'BLEND',
    pbrMetallicRoughness: {
      baseColorFactor: [1, 1, 1, 0.82],
      baseColorTexture: { index: texture },
      metallicFactor: 0,
      roughnessFactor: 1,
    },
    extensions: { KHR_materials_unlit: {} },
    extras: {
      ironshadeDetailLayer: 'P28-B5',
      atlas: REFINERY_DECAL_ATLAS.id,
      telegraphPolicy: 'vertical-only+alpha-blend+non-emissive',
    },
  }) - 1;

  const geometry = mergedCardGeometry(target.cards);
  const packed = appendGeometry(gltf, binary, geometry);
  const mesh = gltf.meshes.push({
    name: DECAL_MESH_NAME,
    primitives: [{ attributes: packed.attributes, indices: packed.indices, material }],
    extras: { batching: 'merged-card-mesh-per-asset', cardCount: target.cards.length },
  }) - 1;
  const node = gltf.nodes.push({ name: `${DECAL_MESH_NAME}-${target.family}`, mesh }) - 1;
  const sceneIndex = Number.isInteger(gltf.scene) ? gltf.scene : 0;
  gltf.scenes[sceneIndex].nodes ??= [];
  gltf.scenes[sceneIndex].nodes.push(node);

  gltf.extras = {
    ...(gltf.extras ?? {}),
    ironshadeP28B5DecalAtlas: {
      version: 1,
      atlas: REFINERY_DECAL_ATLAS.id,
      family: target.family,
      details: [...new Set(target.cards.map(card => card.detail))],
      cardCount: target.cards.length,
      batching: 'merged-card-mesh-per-asset',
      surfaceOffset: 0.012,
      placement: 'vertical-only',
      alphaBlend: true,
      emissive: false,
      gameplayBoundsChanged: false,
      combatTelegraphOverlap: false,
      baseCounts,
    },
  };
  return encodeGlb(gltf, packed.binary);
}

export async function writeRefineryDecalAtlas() {
  const atlasPath = resolve(process.cwd(), 'public/assets', REFINERY_DECAL_ATLAS.relativePath);
  await mkdir(resolve(atlasPath, '..'), { recursive: true });
  const atlas = createRefineryDecalAtlasPng();
  await writeFile(atlasPath, atlas);

  const results = [];
  for (const target of REFINERY_DECAL_TARGETS) {
    const outputPath = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const input = await readFile(outputPath);
    const upgraded = upgradeRefineryDecalGlb(input, target);
    await writeFile(outputPath, upgraded);
    results.push({ family: target.family, relativePath: target.relativePath, cards: target.cards.length, bytes: upgraded.length });
  }
  console.log('[graphics] P28-B5 refinery decal atlas ' + results.map(item => `${item.relativePath}:${item.cards}cards=${item.bytes}b`).join(' '));
  return { atlasBytes: atlas.length, targets: results };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryDecalAtlas();
