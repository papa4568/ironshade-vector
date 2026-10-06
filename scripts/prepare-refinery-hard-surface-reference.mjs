import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HARD_SURFACE_REFERENCE_FEATURES,
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
  createWedgeGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_HARD_SURFACE_REFERENCE_RELATIVE_PATH = 'environments/refinery-processor-hard-surface-reference-lod0.glb';

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

function packParts(parts) {
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
  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

function referenceMaterials() {
  return [
    {
      name: 'refinery-painted-metal',
      pbrMetallicRoughness: {
        baseColorFactor: [0.18, 0.24, 0.25, 1],
        metallicFactor: 0.82,
        roughnessFactor: 0.34,
      },
    },
    {
      name: 'refinery-bare-metal',
      pbrMetallicRoughness: {
        baseColorFactor: [0.48, 0.53, 0.52, 1],
        metallicFactor: 0.96,
        roughnessFactor: 0.26,
      },
    },
    {
      name: 'refinery-dark-polymer',
      pbrMetallicRoughness: {
        baseColorFactor: [0.035, 0.05, 0.055, 1],
        metallicFactor: 0.08,
        roughnessFactor: 0.68,
      },
    },
    {
      name: 'refinery-emissive-fixture',
      pbrMetallicRoughness: {
        baseColorFactor: [0.025, 0.10, 0.13, 1],
        metallicFactor: 0.28,
        roughnessFactor: 0.22,
      },
      emissiveFactor: [0.12, 0.76, 0.94],
    },
  ];
}

export function buildRefineryHardSurfaceReferenceGlb() {
  const geometryRecords = [
    { geometry: createChamferedBoxGeometry(), material: 0, meshName: 'p28-c0-chamfered-processor-body' },
    { geometry: createCylinderGeometry(), material: 1, meshName: 'p28-c0-service-pipe' },
    { geometry: createWedgeGeometry(), material: 2, meshName: 'p28-c0-wedge-armor' },
    { geometry: createInsetPanelGeometry(), material: 3, meshName: 'p28-c0-inset-control-panel' },
  ];
  const parts = [];
  for (const { geometry } of geometryRecords) {
    parts.push(
      { data: bytes(geometry.positions), target: 34962 },
      { data: bytes(geometry.normals), target: 34962 },
      { data: bytes(geometry.tangents), target: 34962 },
      { data: bytes(geometry.uvs), target: 34962 },
      { data: bytes(geometry.indices), target: 34963 },
    );
  }
  const { binary, views } = packParts(parts);
  const accessors = [];
  const meshes = [];
  for (let index = 0; index < geometryRecords.length; index += 1) {
    const { geometry, material, meshName } = geometryRecords[index];
    const baseView = index * 5;
    const baseAccessor = accessors.length;
    accessors.push(
      { bufferView: baseView, componentType: 5126, count: geometry.positions.length / 3, type: 'VEC3', min: geometry.min, max: geometry.max },
      { bufferView: baseView + 1, componentType: 5126, count: geometry.normals.length / 3, type: 'VEC3' },
      { bufferView: baseView + 2, componentType: 5126, count: geometry.tangents.length / 4, type: 'VEC4' },
      { bufferView: baseView + 3, componentType: 5126, count: geometry.uvs.length / 2, type: 'VEC2' },
      { bufferView: baseView + 4, componentType: 5123, count: geometry.indices.length, type: 'SCALAR', min: [0], max: [geometry.positions.length / 3 - 1] },
    );
    meshes.push({
      name: meshName,
      primitives: [{
        attributes: {
          POSITION: baseAccessor,
          NORMAL: baseAccessor + 1,
          TANGENT: baseAccessor + 2,
          TEXCOORD_0: baseAccessor + 3,
        },
        indices: baseAccessor + 4,
        material,
      }],
      extras: { ironshadeHardSurfaceFeature: geometry.feature },
    });
  }

  const nodes = [
    { name: 'refinery-processor-core', mesh: 0 },
    { name: 'refinery-processor-service-pipe', mesh: 1, translation: [0.78, 0.46, 0.42] },
    { name: 'refinery-processor-wedge-armor', mesh: 2, translation: [-0.78, 0.48, 0.22] },
    { name: 'refinery-processor-inset-control-panel', mesh: 3, translation: [0, 1.05, 0.92] },
    { name: 'environment-root', children: [0, 1, 2, 3] },
  ];

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Ironshade Vector P28-C0 reusable hard-surface authoring',
    },
    scene: 0,
    scenes: [{ name: 'refinery-hard-surface-reference', nodes: [4] }],
    nodes,
    meshes,
    materials: referenceMaterials(),
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: binary.length }],
    extras: {
      ironshadeP28C0HardSurfaceGeometry: {
        version: 1,
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        geometryFeatures: HARD_SURFACE_REFERENCE_FEATURES,
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: ['refinery-painted-metal', 'refinery-bare-metal', 'refinery-dark-polymer', 'refinery-emissive-fixture'],
        sourcePath: 'scripts/lib/hard-surface-geometry.mjs',
      },
    },
  };
  return encodeGlb(gltf, binary);
}

export async function writeRefineryHardSurfaceReference() {
  const outputPath = resolve(process.cwd(), 'public/assets/models', REFINERY_HARD_SURFACE_REFERENCE_RELATIVE_PATH);
  const glb = buildRefineryHardSurfaceReferenceGlb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] P28-C0 hard-surface reference ${REFINERY_HARD_SURFACE_REFERENCE_RELATIVE_PATH}=${glb.length}b`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryHardSurfaceReference();
