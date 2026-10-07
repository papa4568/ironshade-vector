import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFINERY_DECAL_ATLAS } from './prepare-refinery-decal-atlas.mjs';
import { writeRefineryFloorLod0Assets } from './prepare-refinery-floor-lod0.mjs';

const ATLAS_URI = 'refinery-decal-atlas.png';
const ATLAS_COLUMNS = REFINERY_DECAL_ATLAS.columns;
const ATLAS_ROWS = REFINERY_DECAL_ATLAS.rows;
const UV_INSET = 2;
const ATLAS_WIDTH = REFINERY_DECAL_ATLAS.width;
const ATLAS_HEIGHT = REFINERY_DECAL_ATLAS.height;
const CELL_WIDTH = ATLAS_WIDTH / ATLAS_COLUMNS;
const CELL_HEIGHT = ATLAS_HEIGHT / ATLAS_ROWS;
const ROUTE_MATERIAL_NAME = 'refinery-route-detail-atlas';
const ROUTE_MESH_NAME = 'p28-b6-refinery-route-detail-atlas';
const SURFACE_OFFSET = 0.012;

const floorCards = Object.freeze([
  {
    detail: 'panel-seam',
    plane: 'xz',
    surface: 0.09,
    offset: SURFACE_OFFSET,
    center: [0.42, -0.34],
    size: [3.08, 0.09],
    purpose: 'navigation-rhythm',
  },
]);

const floorGrateCards = Object.freeze([
  {
    detail: 'hazard-stripe',
    plane: 'xz',
    surface: 0.105,
    offset: SURFACE_OFFSET,
    center: [1.05, -1.12],
    size: [0.96, 0.24],
    purpose: 'route-edge',
  },
  {
    detail: 'service-label',
    plane: 'xz',
    surface: 0.105,
    offset: SURFACE_OFFSET,
    center: [-1.08, 1.05],
    size: [0.58, 0.34],
    purpose: 'service-node',
  },
]);

const bulkheadCards = Object.freeze([
  {
    detail: 'hazard-stripe',
    plane: 'yz',
    surface: 0.29,
    offset: SURFACE_OFFSET,
    center: [1.42, 0],
    size: [0.24, 2.55],
    purpose: 'threshold',
  },
  {
    detail: 'service-label',
    plane: 'yz',
    surface: 0.29,
    offset: SURFACE_OFFSET,
    center: [2.22, -1.16],
    size: [0.42, 0.64],
    purpose: 'threshold-id',
  },
]);

const wallPanelCards = Object.freeze([
  {
    detail: 'panel-seam',
    plane: 'yz',
    surface: 0.235,
    offset: SURFACE_OFFSET,
    center: [1.30, 0.02],
    size: [2.18, 0.055],
    purpose: 'panel-breakup',
  },
  {
    detail: 'grime',
    plane: 'yz',
    surface: 0.235,
    offset: SURFACE_OFFSET,
    center: [1.04, 0.66],
    size: [0.62, 0.72],
    purpose: 'wear-story',
  },
  {
    detail: 'repair-mark',
    plane: 'yz',
    surface: 0.235,
    offset: SURFACE_OFFSET,
    center: [0.50, -0.70],
    size: [0.42, 0.52],
    purpose: 'maintenance-history',
  },
]);

const terminalCards = Object.freeze([
  {
    detail: 'service-label',
    plane: 'yz',
    surface: 0.30,
    offset: SURFACE_OFFSET,
    center: [0.82, 0.02],
    size: [0.32, 0.46],
    purpose: 'interactable-hierarchy',
  },
  {
    detail: 'repair-mark',
    plane: 'yz',
    surface: 0.30,
    offset: SURFACE_OFFSET,
    center: [0.42, -0.19],
    size: [0.22, 0.28],
    purpose: 'focal-wear',
  },
]);

export const REFINERY_ROUTE_DECAL_TARGETS = Object.freeze([
  { family: 'floor', routeRole: 'navigation-rhythm', opacity: 0.34, relativePath: 'environments/refinery-floor-panel-lod0.glb', cards: floorCards },
  { family: 'floor', routeRole: 'navigation-rhythm', opacity: 0.34, relativePath: 'environments/refinery-floor-panel-lod1.glb', cards: floorCards },
  { family: 'floor', routeRole: 'navigation-rhythm', opacity: 0.34, relativePath: 'environments/refinery-floor-panel-lod2.glb', cards: floorCards },
  { family: 'floorGrate', routeRole: 'service-threshold', opacity: 0.46, relativePath: 'environments/refinery-floor-service-grate-lod0.glb', cards: floorGrateCards },
  { family: 'floorGrate', routeRole: 'service-threshold', opacity: 0.46, relativePath: 'environments/refinery-floor-service-grate-lod1.glb', cards: floorGrateCards },
  { family: 'floorGrate', routeRole: 'service-threshold', opacity: 0.46, relativePath: 'environments/refinery-floor-service-grate-lod2.glb', cards: floorGrateCards },
  { family: 'bulkhead', routeRole: 'threshold-hierarchy', opacity: 0.72, relativePath: 'environments/refinery-bulkhead-lod1.glb', cards: bulkheadCards },
  { family: 'bulkhead', routeRole: 'threshold-hierarchy', opacity: 0.72, relativePath: 'environments/refinery-bulkhead-lod2.glb', cards: bulkheadCards },
  { family: 'wallPanel', routeRole: 'wall-breakup', opacity: 0.62, relativePath: 'environments/refinery-wall-service-panel-lod1.glb', cards: wallPanelCards },
  { family: 'wallPanel', routeRole: 'wall-breakup', opacity: 0.62, relativePath: 'environments/refinery-wall-service-panel-lod2.glb', cards: wallPanelCards },
  { family: 'terminal', routeRole: 'interactable-hierarchy', opacity: 0.76, relativePath: 'environments/refinery-terminal-lod1.glb', cards: terminalCards },
  { family: 'terminal', routeRole: 'interactable-hierarchy', opacity: 0.76, relativePath: 'environments/refinery-terminal-lod2.glb', cards: terminalCards },
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

function detailUv(detail) {
  const cell = REFINERY_DECAL_ATLAS.details[detail];
  if (!cell) throw new Error(`Unknown refinery decal detail ${detail}`);
  const u0 = (cell.column * CELL_WIDTH + UV_INSET) / ATLAS_WIDTH;
  const u1 = ((cell.column + 1) * CELL_WIDTH - UV_INSET) / ATLAS_WIDTH;
  const v0 = (cell.row * CELL_HEIGHT + UV_INSET) / ATLAS_HEIGHT;
  const v1 = ((cell.row + 1) * CELL_HEIGHT - UV_INSET) / ATLAS_HEIGHT;
  return [u0, v0, u1, v1];
}

function pushQuad(positions, normals, card) {
  const [a, b] = card.center;
  const [width, height] = card.size;
  const a0 = a - width / 2;
  const a1 = a + width / 2;
  const b0 = b - height / 2;
  const b1 = b + height / 2;
  const surface = card.surface + card.offset;

  if (card.plane === 'xy') {
    positions.push(a0, b0, surface, a1, b0, surface, a1, b1, surface, a0, b1, surface);
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
    return;
  }
  if (card.plane === 'yz') {
    positions.push(surface, a0, b0, surface, a1, b0, surface, a1, b1, surface, a0, b1);
    normals.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
    return;
  }
  if (card.plane === 'xz') {
    positions.push(a0, surface, b0, a0, surface, b1, a1, surface, b1, a1, surface, b0);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    return;
  }
  throw new Error(`Unsupported P28-B6 decal plane ${card.plane}`);
}

function mergedCardGeometry(cards) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (const card of cards) {
    const base = positions.length / 3;
    pushQuad(positions, normals, card);
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

export function upgradeRefineryRouteDecalGlb(input, target) {
  const { gltf, binary } = parseGlb(input, target.relativePath);
  if (gltf.extras?.ironshadeP28B6RouteDecals?.version === 1) return input;
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
  const sampler = gltf.samplers.push({ name: 'p28-b6-refinery-route-decal-sampler', magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }) - 1;
  const image = gltf.images.push({ name: 'p28-b6-refinery-route-decal-atlas', uri: ATLAS_URI, mimeType: 'image/png' }) - 1;
  const texture = gltf.textures.push({ name: 'p28-b6-refinery-route-decal-atlas', sampler, source: image }) - 1;
  const groundCards = target.cards.filter(card => card.plane === 'xz');
  const material = gltf.materials.push({
    name: ROUTE_MATERIAL_NAME,
    doubleSided: true,
    alphaMode: 'BLEND',
    pbrMetallicRoughness: {
      baseColorFactor: [1, 1, 1, target.opacity],
      baseColorTexture: { index: texture },
      metallicFactor: 0,
      roughnessFactor: 1,
    },
    extras: {
      ironshadeDetailLayer: 'P28-B6',
      atlas: REFINERY_DECAL_ATLAS.id,
      routeRole: target.routeRole,
      cuePriority: groundCards.length ? 'gameplay-cues-win:low-opacity-ground-detail' : 'no-floor-cue-overlap',
      emissive: false,
    },
  }) - 1;

  const geometry = mergedCardGeometry(target.cards);
  const packed = appendGeometry(gltf, binary, geometry);
  const mesh = gltf.meshes.push({
    name: ROUTE_MESH_NAME,
    primitives: [{ attributes: packed.attributes, indices: packed.indices, material }],
    extras: {
      batching: 'merged-card-mesh-per-asset',
      cardCount: target.cards.length,
      routeRole: target.routeRole,
    },
  }) - 1;
  const node = gltf.nodes.push({ name: `${ROUTE_MESH_NAME}-${target.family}`, mesh }) - 1;
  const sceneIndex = Number.isInteger(gltf.scene) ? gltf.scene : 0;
  gltf.scenes[sceneIndex].nodes ??= [];
  gltf.scenes[sceneIndex].nodes.push(node);

  const detailSet = [...new Set(target.cards.map(card => card.detail))];
  const planeSet = [...new Set(target.cards.map(card => card.plane))];
  gltf.extras = {
    ...(gltf.extras ?? {}),
    ironshadeP28B6RouteDecals: {
      version: 1,
      atlas: REFINERY_DECAL_ATLAS.id,
      family: target.family,
      route: 'deep-salvage-refinery-showcase',
      routeRole: target.routeRole,
      details: detailSet,
      purposes: [...new Set(target.cards.map(card => card.purpose))],
      planes: planeSet,
      cardCount: target.cards.length,
      batching: 'merged-card-mesh-per-asset',
      surfaceOffset: SURFACE_OFFSET,
      alphaBlend: true,
      opacity: target.opacity,
      emissive: false,
      gameplayBoundsChanged: false,
      routeLayoutChanged: false,
      cuePriority: groundCards.length ? 'gameplay-cues-win:low-opacity-ground-detail' : 'no-floor-cue-overlap',
      repeatedMarkPolicy: target.family === 'floor'
        ? 'continuous-structural-seam-rhythm'
        : 'mixed-atlas-details+authored-module-rotation',
      baseCounts,
    },
  };
  return encodeGlb(gltf, packed.binary);
}

export async function writeRefineryRouteDecals() {
  await writeRefineryFloorLod0Assets();
  const results = [];
  for (const target of REFINERY_ROUTE_DECAL_TARGETS) {
    const outputPath = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const input = await readFile(outputPath);
    const upgraded = upgradeRefineryRouteDecalGlb(input, target);
    await writeFile(outputPath, upgraded);
    results.push({
      family: target.family,
      routeRole: target.routeRole,
      relativePath: target.relativePath,
      cards: target.cards.length,
      bytes: upgraded.length,
    });
  }
  console.log('[graphics] P28-B6 Deep Salvage route decals ' + results.map(item => `${item.relativePath}:${item.cards}cards=${item.bytes}b`).join(' '));
  return results;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryRouteDecals();
