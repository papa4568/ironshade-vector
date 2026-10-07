import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
  createWedgeGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_WALL_LOD0_TARGETS = Object.freeze([
  { family: 'bulkhead', relativePath: 'environments/refinery-bulkhead-lod0.glb' },
  { family: 'wallPanel', relativePath: 'environments/refinery-wall-service-panel-lod0.glb' },
]);

const ROTATE_Y_90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const ROTATE_Z_NEG_90 = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];

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

function bulkheadDefinition() {
  const geometries = [
    {
      meshName: 'refinery-bulkhead-lod0-stile',
      geometry: createChamferedBoxGeometry({ width: 0.44, height: 2.9, depth: 0.38, chamfer: 0.075 }),
      material: 0,
    },
    {
      meshName: 'refinery-bulkhead-lod0-cap',
      geometry: createChamferedBoxGeometry({ width: 0.52, height: 0.34, depth: 3.8, chamfer: 0.09 }),
      material: 1,
    },
    {
      meshName: 'refinery-bulkhead-lod0-hazard-band',
      geometry: createChamferedBoxGeometry({ width: 0.08, height: 0.12, depth: 2.8, chamfer: 0.018 }),
      material: 2,
    },
    {
      meshName: 'refinery-bulkhead-lod0-stile-inset',
      geometry: createInsetPanelGeometry({ width: 0.25, height: 2.18, depth: 0.10, insetWidth: 0.13, insetHeight: 1.72, recess: 0.055 }),
      material: 1,
    },
    {
      meshName: 'refinery-bulkhead-lod0-gusset',
      geometry: createWedgeGeometry({ width: 0.30, height: 0.46, depth: 0.62 }),
      material: 0,
    },
    {
      meshName: 'refinery-bulkhead-lod0-cap-rib',
      geometry: createChamferedBoxGeometry({ width: 0.18, height: 0.22, depth: 0.12, chamfer: 0.028 }),
      material: 0,
    },
  ];
  const nodes = [
    { name: 'refinery-bulkhead-left', mesh: 0, translation: [0, 0, -1.75] },
    { name: 'refinery-bulkhead-right', mesh: 0, translation: [0, 0, 1.75] },
    { name: 'refinery-bulkhead-cap', mesh: 1, translation: [0, 2.58, 0] },
    { name: 'refinery-bulkhead-hazard', mesh: 2, translation: [0.24, 1.22, 0] },
    { name: 'refinery-bulkhead-inset-left', mesh: 3, translation: [0.21, 1.45, -1.75], rotation: ROTATE_Y_90 },
    { name: 'refinery-bulkhead-inset-right', mesh: 3, translation: [0.21, 1.45, 1.75], rotation: ROTATE_Y_90 },
    { name: 'refinery-bulkhead-gusset-left', mesh: 4, translation: [0.02, 2.34, -1.42] },
    { name: 'refinery-bulkhead-gusset-right', mesh: 4, translation: [0.02, 2.34, 1.42], scale: [1, 1, -1] },
  ];
  for (const [index, z] of [-1.45, -0.72, 0, 0.72, 1.45].entries()) {
    nodes.push({ name: `refinery-bulkhead-cap-rib-${index + 1}`, mesh: 5, translation: [0.18, 2.64, z] });
  }
  return {
    family: 'bulkhead',
    sceneName: 'refinery-bulkhead-lod0',
    geometries,
    nodes,
    visualBounds: { min: [-0.26, 0, -1.94], max: [0.28, 2.92, 1.94] },
    detail: 'chamfered portal stiles, recessed stile armor, reinforced gussets, segmented cap ribs',
    premiumSurfaceBinding: 'refinery-structural:painted-metal|refinery-shell:painted-metal',
  };
}

function wallPanelDefinition() {
  const geometries = [
    {
      meshName: 'refinery-wall-service-panel-lod0-shell',
      geometry: createInsetPanelGeometry({ width: 2.75, height: 2.56, depth: 0.18, insetWidth: 2.18, insetHeight: 1.76, recess: 0.08 }),
      material: 1,
    },
    {
      meshName: 'refinery-wall-service-panel-lod0-frame',
      geometry: createChamferedBoxGeometry({ width: 0.24, height: 2.70, depth: 0.16, chamfer: 0.04 }),
      material: 0,
    },
    {
      meshName: 'refinery-wall-service-panel-lod0-vent',
      geometry: createInsetPanelGeometry({ width: 0.72, height: 0.62, depth: 0.08, insetWidth: 0.54, insetHeight: 0.34, recess: 0.045 }),
      material: 0,
    },
    {
      meshName: 'refinery-wall-service-panel-lod0-rail',
      geometry: createChamferedBoxGeometry({ width: 0.07, height: 0.07, depth: 0.72, chamfer: 0.018 }),
      material: 0,
    },
    {
      meshName: 'refinery-wall-service-panel-lod0-junction',
      geometry: createInsetPanelGeometry({ width: 0.42, height: 0.36, depth: 0.10, insetWidth: 0.26, insetHeight: 0.19, recess: 0.055 }),
      material: 1,
    },
    {
      meshName: 'refinery-wall-service-panel-lod0-signage',
      geometry: createChamferedBoxGeometry({ width: 0.05, height: 0.28, depth: 0.72, chamfer: 0.016 }),
      material: 2,
    },
    {
      meshName: 'refinery-wall-service-panel-lod0-status',
      geometry: createChamferedBoxGeometry({ width: 0.05, height: 0.24, depth: 0.44, chamfer: 0.016 }),
      material: 3,
    },
    {
      meshName: 'refinery-wall-service-panel-lod0-fastener',
      geometry: createCylinderGeometry({ radius: 0.045, height: 0.08, segments: 16 }),
      material: 0,
    },
  ];
  const nodes = [
    { name: 'refinery-wall-service-panel-shell', mesh: 0, translation: [0, 1.28, 0], rotation: ROTATE_Y_90 },
    { name: 'refinery-wall-service-panel-frame-left', mesh: 1, translation: [0.10, -0.07, -1.22] },
    { name: 'refinery-wall-service-panel-frame-right', mesh: 1, translation: [0.10, -0.07, 1.22] },
    { name: 'refinery-wall-service-panel-vent', mesh: 2, translation: [0.14, 1.24, 0], rotation: ROTATE_Y_90 },
    { name: 'refinery-wall-service-panel-vent-upper', mesh: 3, translation: [0.14, 1.445, 0] },
    { name: 'refinery-wall-service-panel-vent-lower', mesh: 3, translation: [0.14, 0.965, 0] },
    { name: 'refinery-wall-service-panel-junction', mesh: 4, translation: [0.16, 0.52, 0.62], rotation: ROTATE_Y_90 },
    { name: 'refinery-wall-service-panel-signage', mesh: 5, translation: [0.14, 1.72, 0.58] },
    { name: 'refinery-wall-service-panel-status', mesh: 6, translation: [0.14, 0.70, -0.68] },
  ];
  for (const [index, [y, z]] of [
    [0.27, -1.10],
    [2.25, -1.10],
    [0.27, 1.10],
    [2.25, 1.10],
  ].entries()) {
    nodes.push({
      name: `refinery-wall-service-panel-fastener-${index + 1}`,
      mesh: 7,
      translation: [0.14, y, z],
      rotation: ROTATE_Z_NEG_90,
    });
  }
  return {
    family: 'wallPanel',
    sceneName: 'refinery-wall-service-panel-lod0',
    geometries,
    nodes,
    visualBounds: { min: [-0.09, -0.07, -1.375], max: [0.22, 2.63, 1.375] },
    detail: 'recessed wall shell, chamfered side frames, deep vent inset, service junction, layered rails and fasteners',
    premiumSurfaceBinding: 'refinery-structural:bare-metal|refinery-shell:painted-metal',
  };
}

function definitionForFamily(family) {
  if (family === 'bulkhead') return bulkheadDefinition();
  if (family === 'wallPanel') return wallPanelDefinition();
  throw new Error(`Unsupported P28-C2 refinery wall family ${family}`);
}

export function buildRefineryWallLod0Glb(target) {
  const definition = definitionForFamily(target.family);
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
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Ironshade Vector P28-C2 refinery wall LOD0 authoring',
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
      ironshadeP28C2WallLod0: {
        version: 1,
        family: target.family,
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        visualBounds: definition.visualBounds,
        gameplayBoundsChanged: false,
        recoveryLods: [1, 2],
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: materialSlots.map(material => material.name),
        premiumSurfaceBinding: definition.premiumSurfaceBinding,
        detail: definition.detail,
        sourcePath: 'scripts/prepare-refinery-wall-lod0.mjs',
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

export async function writeRefineryWallLod0Assets() {
  const results = [];
  for (const target of REFINERY_WALL_LOD0_TARGETS) {
    const outputPath = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const glb = buildRefineryWallLod0Glb(target);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, glb);
    results.push({ ...target, bytes: glb.length });
  }
  console.log('[graphics] P28-C2 refinery wall LOD0 ' + results.map(item => `${item.relativePath}=${item.bytes}b`).join(' '));
  return results;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryWallLod0Assets();
