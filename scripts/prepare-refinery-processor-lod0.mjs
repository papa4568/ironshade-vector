import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
  createWedgeGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_PROCESSOR_LOD0_TARGET = Object.freeze({
  family: 'processor',
  relativePath: 'environments/refinery-processor-lod0.glb',
});

const ROTATE_Y_90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const ROTATE_X_90 = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];

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

function refineryMaterials() {
  return [
    {
      name: 'refinery-structural',
      pbrMetallicRoughness: {
        baseColorFactor: [0.18, 0.24, 0.25, 1],
        metallicFactor: 0.82,
        roughnessFactor: 0.34,
      },
    },
    {
      name: 'refinery-shell',
      pbrMetallicRoughness: {
        baseColorFactor: [0.48, 0.53, 0.52, 1],
        metallicFactor: 0.96,
        roughnessFactor: 0.26,
      },
    },
    {
      name: 'refinery-hazard-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.58, 0.27, 0.045, 1],
        metallicFactor: 0.42,
        roughnessFactor: 0.31,
      },
      emissiveFactor: [0.34, 0.12, 0.015],
    },
    {
      name: 'refinery-screen-emissive',
      pbrMetallicRoughness: {
        baseColorFactor: [0.03, 0.19, 0.22, 1],
        metallicFactor: 0.28,
        roughnessFactor: 0.22,
      },
      emissiveFactor: [0.02, 0.33, 0.41],
    },
  ];
}

function processorDefinition() {
  const geometries = [
    {
      meshName: 'refinery-processor-lod0-base',
      geometry: createChamferedBoxGeometry({ width: 2.80, height: 0.56, depth: 2.20, chamfer: 0.13 }),
      material: 0,
    },
    {
      meshName: 'refinery-processor-lod0-core',
      geometry: createChamferedBoxGeometry({ width: 1.90, height: 2.50, depth: 1.55, chamfer: 0.16 }),
      material: 1,
    },
    {
      meshName: 'refinery-processor-lod0-sidecar',
      geometry: createChamferedBoxGeometry({ width: 1.00, height: 1.55, depth: 0.46, chamfer: 0.09 }),
      material: 0,
    },
    {
      meshName: 'refinery-processor-lod0-rib',
      geometry: createChamferedBoxGeometry({ width: 0.18, height: 1.92, depth: 0.12, chamfer: 0.035 }),
      material: 0,
    },
    {
      meshName: 'refinery-processor-lod0-intake',
      geometry: createWedgeGeometry({ width: 0.78, height: 0.92, depth: 1.02 }),
      material: 1,
    },
    {
      meshName: 'refinery-processor-lod0-exhaust',
      geometry: createCylinderGeometry({ radius: 0.21, height: 1.34, segments: 32 }),
      material: 1,
    },
    {
      meshName: 'refinery-processor-lod0-exhaust-collar',
      geometry: createCylinderGeometry({ radius: 0.27, height: 0.13, segments: 32 }),
      material: 0,
    },
    {
      meshName: 'refinery-processor-lod0-service-line',
      geometry: createCylinderGeometry({ radius: 0.08, height: 1.45, segments: 24 }),
      material: 1,
    },
    {
      meshName: 'refinery-processor-lod0-vent',
      geometry: createChamferedBoxGeometry({ width: 0.58, height: 0.10, depth: 1.00, chamfer: 0.025 }),
      material: 0,
    },
    {
      meshName: 'refinery-processor-lod0-access-panel',
      geometry: createInsetPanelGeometry({ width: 0.82, height: 0.82, depth: 0.08, insetWidth: 0.52, insetHeight: 0.50, recess: 0.04 }),
      material: 1,
    },
    {
      meshName: 'refinery-processor-lod0-status',
      geometry: createInsetPanelGeometry({ width: 0.74, height: 0.56, depth: 0.08, insetWidth: 0.48, insetHeight: 0.30, recess: 0.025 }),
      material: 3,
    },
    {
      meshName: 'refinery-processor-lod0-maintenance-screen',
      geometry: createInsetPanelGeometry({ width: 0.42, height: 0.34, depth: 0.06, insetWidth: 0.27, insetHeight: 0.19, recess: 0.018 }),
      material: 3,
    },
    {
      meshName: 'refinery-processor-lod0-hazard-band',
      geometry: createChamferedBoxGeometry({ width: 1.70, height: 0.16, depth: 0.08, chamfer: 0.018 }),
      material: 2,
    },
    {
      meshName: 'refinery-processor-lod0-fixture',
      geometry: createInsetPanelGeometry({ width: 0.34, height: 0.16, depth: 0.055, insetWidth: 0.22, insetHeight: 0.08, recess: 0.015 }),
      material: 2,
    },
    {
      meshName: 'refinery-processor-lod0-top-cap',
      geometry: createChamferedBoxGeometry({ width: 2.04, height: 0.18, depth: 1.68, chamfer: 0.075 }),
      material: 0,
    },
  ];

  const nodes = [
    { name: 'refinery-processor-base', mesh: 0, translation: [0, 0, 0] },
    { name: 'refinery-processor-core', mesh: 1, translation: [0, 0.30, 0] },
    { name: 'refinery-processor-sidecar-left', mesh: 2, translation: [-0.30, 0.475, 1.16] },
    { name: 'refinery-processor-sidecar-right', mesh: 2, translation: [-0.30, 0.475, -1.16] },
    { name: 'refinery-processor-rib-left', mesh: 3, translation: [0.28, 0.49, 0.86] },
    { name: 'refinery-processor-rib-right', mesh: 3, translation: [0.28, 0.49, -0.86] },
    { name: 'refinery-processor-ore-intake', mesh: 4, translation: [-1.34, 0.72, 0] },
    { name: 'refinery-processor-exhaust-stack', mesh: 5, translation: [-0.62, 2.43, 0.54] },
    { name: 'refinery-processor-exhaust-collar', mesh: 6, translation: [-0.62, 3.42, 0.54] },
    { name: 'refinery-processor-service-line', mesh: 7, translation: [1.12, 0.66, -0.725], rotation: ROTATE_X_90 },
    { name: 'refinery-processor-top-vent', mesh: 8, translation: [0.62, 2.50, 0] },
    { name: 'refinery-processor-access-panel-forward', mesh: 9, translation: [0.01, 1.62, 0.795] },
    { name: 'refinery-processor-access-panel-aft', mesh: 9, translation: [-0.38, 1.22, -0.795], rotation: [0, 1, 0, 0] },
    { name: 'refinery-processor-status', mesh: 10, translation: [0.99, 1.72, 0], rotation: ROTATE_Y_90 },
    { name: 'refinery-processor-maintenance-screen', mesh: 11, translation: [1.00, 1.06, -0.62], rotation: ROTATE_Y_90 },
    { name: 'refinery-processor-hazard-band', mesh: 12, translation: [0, 0.54, 1.13] },
    { name: 'refinery-processor-warning-fixture-left', mesh: 13, translation: [0.99, 2.28, 0.48], rotation: ROTATE_Y_90 },
    { name: 'refinery-processor-warning-fixture-right', mesh: 13, translation: [0.99, 2.28, -0.48], rotation: ROTATE_Y_90 },
    { name: 'refinery-processor-top-cap', mesh: 14, translation: [0, 2.62, 0] },
  ];

  return {
    sceneName: 'refinery-processor-lod0',
    geometries,
    nodes,
    legacyVisualBounds: { min: [-1.73, 0, -1.39], max: [1.40, 3.77, 1.39] },
    interactionOrigin: [0, 0, 0],
    detail: 'beveled base/core housings, separated sidecars, intake wedge, cylindrical exhaust and service line, recessed access panels, screens, hazard band, and paired emissive warning fixtures',
    premiumSurfaceBinding: 'refinery-structural:painted-metal|refinery-shell:bare-metal|refinery-hazard-emissive:emissive-fixture|refinery-screen-emissive:emissive-fixture',
  };
}

export function buildRefineryProcessorLod0Glb(target = REFINERY_PROCESSOR_LOD0_TARGET) {
  if (target.family !== 'processor') throw new Error(`Unsupported P28-C5 refinery processor family ${target.family}`);
  const definition = processorDefinition();
  const parts = [];
  for (const record of definition.geometries) {
    const { geometry } = record;
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
  let totalTriangles = 0;
  let totalVertices = 0;
  for (let index = 0; index < definition.geometries.length; index += 1) {
    const { geometry, material, meshName } = definition.geometries[index];
    const baseView = index * 5;
    const baseAccessor = accessors.length;
    totalTriangles += geometry.indices.length / 3;
    totalVertices += geometry.positions.length / 3;
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

  const nodes = [...definition.nodes];
  const rootIndex = nodes.length;
  nodes.push({ name: 'environment-root', children: definition.nodes.map((_, index) => index) });
  const materialSlots = refineryMaterials();
  const emissiveNodeNames = definition.nodes
    .filter(node => [10, 11, 12, 13].includes(node.mesh))
    .map(node => node.name);
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Ironshade Vector P28-C5 refinery processor LOD0 authoring',
    },
    scene: 0,
    scenes: [{ name: definition.sceneName, nodes: [rootIndex] }],
    nodes,
    meshes,
    materials: materialSlots,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: binary.length }],
    extras: {
      ironshadeP28C5ProcessorLod0: {
        version: 1,
        family: 'processor',
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        legacyVisualBounds: definition.legacyVisualBounds,
        interactionOrigin: definition.interactionOrigin,
        gameplayCoordinatesChanged: false,
        gameplayBoundsChanged: false,
        recoveryLods: [1, 2],
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: materialSlots.map(material => material.name),
        emissiveNodeNames,
        selectiveGlowNamePrefix: 'refinery-processor',
        premiumSurfaceBinding: definition.premiumSurfaceBinding,
        detail: definition.detail,
        sourcePath: 'scripts/prepare-refinery-processor-lod0.mjs',
        sourceGeometryPath: 'scripts/lib/hard-surface-geometry.mjs',
        uniqueGeometryMeshes: definition.geometries.length,
        authoredNodeCount: definition.nodes.length,
        sourceVertices: totalVertices,
        sourceTriangles: totalTriangles,
      },
    },
  };
  return encodeGlb(gltf, binary);
}

export async function writeRefineryProcessorLod0Asset() {
  const outputPath = resolve(process.cwd(), 'public/assets/models', REFINERY_PROCESSOR_LOD0_TARGET.relativePath);
  const glb = buildRefineryProcessorLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] P28-C5 refinery processor LOD0 ${REFINERY_PROCESSOR_LOD0_TARGET.relativePath}=${glb.length}b`);
  return { ...REFINERY_PROCESSOR_LOD0_TARGET, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryProcessorLod0Asset();
