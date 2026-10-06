import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REFINERY_PREMIUM_SURFACE_TARGETS = [
  { family: 'floor', relativePath: 'environments/refinery-floor-panel-lod1.glb' },
  { family: 'floor', relativePath: 'environments/refinery-floor-panel-lod2.glb' },
  { family: 'floorGrate', relativePath: 'environments/refinery-floor-service-grate-lod1.glb' },
  { family: 'floorGrate', relativePath: 'environments/refinery-floor-service-grate-lod2.glb' },
  { family: 'bulkhead', relativePath: 'environments/refinery-bulkhead-lod1.glb' },
  { family: 'bulkhead', relativePath: 'environments/refinery-bulkhead-lod2.glb' },
  { family: 'wallPanel', relativePath: 'environments/refinery-wall-service-panel-lod1.glb' },
  { family: 'wallPanel', relativePath: 'environments/refinery-wall-service-panel-lod2.glb' },
  { family: 'crate', relativePath: 'environments/refinery-crate-lod1.glb' },
  { family: 'crate', relativePath: 'environments/refinery-crate-lod2.glb' },
];

export const REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS = [
  { family: 'processor', phase: 'P28-B4', relativePath: 'environments/refinery-processor-lod1.glb' },
  { family: 'processor', phase: 'P28-B4', relativePath: 'environments/refinery-processor-lod2.glb' },
  { family: 'pipeRack', phase: 'P28-B4', relativePath: 'environments/refinery-pipe-rack-lod1.glb' },
  { family: 'pipeRack', phase: 'P28-B4', relativePath: 'environments/refinery-pipe-rack-lod2.glb' },
  { family: 'cableTray', phase: 'P28-B4', relativePath: 'environments/refinery-cable-tray-lod1.glb' },
  { family: 'cableTray', phase: 'P28-B4', relativePath: 'environments/refinery-cable-tray-lod2.glb' },
  { family: 'serviceConduit', phase: 'P28-B4', relativePath: 'environments/refinery-service-conduit-lod1.glb' },
  { family: 'serviceConduit', phase: 'P28-B4', relativePath: 'environments/refinery-service-conduit-lod2.glb' },
  { family: 'gantry', phase: 'P28-B4', relativePath: 'environments/refinery-smelter-gantry-lod1.glb' },
  { family: 'gantry', phase: 'P28-B4', relativePath: 'environments/refinery-smelter-gantry-lod2.glb' },
  { family: 'terminal', phase: 'P28-B4', relativePath: 'environments/refinery-terminal-lod1.glb' },
  { family: 'terminal', phase: 'P28-B4', relativePath: 'environments/refinery-terminal-lod2.glb' },
];

function bytes(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function align(value, multiple = 4) {
  return Math.ceil(value / multiple) * multiple;
}

function pad(buffer, multiple, fill) {
  const remainder = buffer.length % multiple;
  if (remainder === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(multiple - remainder, fill)]);
}

function parseGlb(buffer, label = 'GLB') {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${label}: invalid GLB header`);
  if (buffer.readUInt32LE(4) !== 2) throw new Error(`${label}: expected glTF 2.0`);
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error(`${label}: GLB byte length mismatch`);
  const jsonLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${label}: JSON chunk is missing`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

function texturedCubeGeometry() {
  const h = 0.5;
  const faces = [
    { n: [0, 0, 1], t: [1, 0, 0, 1], p: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]] },
    { n: [0, 0, -1], t: [-1, 0, 0, 1], p: [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]] },
    { n: [1, 0, 0], t: [0, 0, -1, 1], p: [[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]] },
    { n: [-1, 0, 0], t: [0, 0, 1, 1], p: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]] },
    { n: [0, 1, 0], t: [1, 0, 0, 1], p: [[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]] },
    { n: [0, -1, 0], t: [1, 0, 0, 1], p: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]] },
  ];
  const faceUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const positions = [];
  const normals = [];
  const tangents = [];
  const uvs = [];
  const indices = [];
  for (const face of faces) {
    const base = positions.length / 3;
    for (let vertex = 0; vertex < 4; vertex += 1) {
      positions.push(...face.p[vertex]);
      normals.push(...face.n);
      tangents.push(...face.t);
      uvs.push(...faceUvs[vertex]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function packGeometry(geometry) {
  const parts = [
    { data: bytes(geometry.positions), target: 34962 },
    { data: bytes(geometry.normals), target: 34962 },
    { data: bytes(geometry.tangents), target: 34962 },
    { data: bytes(geometry.uvs), target: 34962 },
    { data: bytes(geometry.indices), target: 34963 },
  ];
  const chunks = [];
  const views = [];
  let cursor = 0;
  for (const part of parts) {
    const offset = align(cursor);
    if (offset > cursor) chunks.push(Buffer.alloc(offset - cursor));
    views.push({ buffer: 0, byteOffset: offset, byteLength: part.data.length, target: part.target });
    chunks.push(part.data);
    cursor = offset + part.data.length;
  }
  const total = align(cursor);
  if (total > cursor) chunks.push(Buffer.alloc(total - cursor));
  return { binary: Buffer.concat(chunks), views };
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

export function upgradeRefineryPremiumSurfaceGlb(input, target) {
  const gltf = parseGlb(input, target.relativePath);
  if (gltf.extras?.ironshadeP28B5DecalAtlas?.version === 1 || gltf.extras?.ironshadeP28B6RouteDecals?.version === 1) return input;
  if (!Array.isArray(gltf.meshes) || gltf.meshes.length === 0) throw new Error(`${target.relativePath}: no meshes found`);
  const geometry = texturedCubeGeometry();
  const { binary, views } = packGeometry(geometry);
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives ?? []) {
      primitive.attributes = { POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 };
      primitive.indices = 4;
    }
  }
  gltf.accessors = [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: 24, type: 'VEC4' },
    { bufferView: 3, componentType: 5126, count: 24, type: 'VEC2' },
    { bufferView: 4, componentType: 5123, count: 36, type: 'SCALAR', min: [0], max: [23] },
  ];
  gltf.bufferViews = views;
  gltf.buffers = [{ byteLength: binary.length }];
  gltf.extras = {
    ...(gltf.extras ?? {}),
    [target.phase === 'P28-B4' ? 'ironshadeP28B4MachinerySurfaceGeometry' : 'ironshadeP28B2SurfaceGeometry']: {
      version: 1,
      family: target.family,
      uvSet: 'TEXCOORD_0',
      tangentSpace: true,
      unitBounds: [[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
      gameplayBoundsChanged: false,
    },
  };
  return encodeGlb(gltf, binary);
}

export async function writeRefineryPremiumSurfaceGeometry() {
  const results = [];
  for (const target of [...REFINERY_PREMIUM_SURFACE_TARGETS, ...REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS]) {
    const outputPath = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const input = await readFile(outputPath);
    const upgraded = upgradeRefineryPremiumSurfaceGlb(input, target);
    await writeFile(outputPath, upgraded);
    results.push({ ...target, bytes: upgraded.length });
  }
  const { writeRefineryDecalAtlas } = await import('./prepare-refinery-decal-atlas.mjs');
  await writeRefineryDecalAtlas();
  const { writeRefineryRouteDecals } = await import('./prepare-refinery-route-decals.mjs');
  await writeRefineryRouteDecals();
  console.log('[graphics] P28-B2/B4 premium refinery surface geometry ' + results.map(item => `${item.relativePath}=${item.bytes}b`).join(' '));
  return results;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryPremiumSurfaceGeometry();
