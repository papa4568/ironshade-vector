import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createInsetPanelGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_CRATE_LOD0_TARGET = Object.freeze({
  family: 'crate',
  relativePath: 'environments/refinery-crate-lod0.glb',
});

const ROTATE_Y_90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];

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

function centerY(geometry) {
  const offset = -((geometry.min[1] + geometry.max[1]) / 2);
  if (Math.abs(offset) < 1e-9) return geometry;
  const positions = new Float32Array(geometry.positions);
  for (let index = 1; index < positions.length; index += 3) positions[index] += offset;
  return {
    ...geometry,
    positions,
    min: [geometry.min[0], geometry.min[1] + offset, geometry.min[2]],
    max: [geometry.max[0], geometry.max[1] + offset, geometry.max[2]],
  };
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

function crateDefinition() {
  const geometries = [
    {
      meshName: 'refinery-crate-lod0-body',
      geometry: centerY(createChamferedBoxGeometry({ width: 1.02, height: 0.68, depth: 0.78, chamfer: 0.07 })),
      material: 1,
    },
    {
      meshName: 'refinery-crate-lod0-lid',
      geometry: centerY(createChamferedBoxGeometry({ width: 1.05, height: 0.16, depth: 0.82, chamfer: 0.07 })),
      material: 1,
    },
    {
      meshName: 'refinery-crate-lod0-spine-band',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.10, height: 0.84, depth: 0.82, chamfer: 0.025 })),
      material: 0,
    },
    {
      meshName: 'refinery-crate-lod0-corner-brace',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.09, height: 0.66, depth: 0.09, chamfer: 0.018 })),
      material: 0,
    },
    {
      meshName: 'refinery-crate-lod0-side-panel',
      geometry: createInsetPanelGeometry({ width: 0.56, height: 0.42, depth: 0.035, insetWidth: 0.42, insetHeight: 0.28, recess: 0.015 }),
      material: 0,
    },
    {
      meshName: 'refinery-crate-lod0-handle-mount',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.06, height: 0.16, depth: 0.10, chamfer: 0.014 })),
      material: 0,
    },
    {
      meshName: 'refinery-crate-lod0-handle-grip',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.05, height: 0.10, depth: 0.44, chamfer: 0.018 })),
      material: 2,
    },
    {
      meshName: 'refinery-crate-lod0-top-rail',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.72, height: 0.06, depth: 0.07, chamfer: 0.014 })),
      material: 0,
    },
    {
      meshName: 'refinery-crate-lod0-base-skid',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.78, height: 0.06, depth: 0.10, chamfer: 0.014 })),
      material: 0,
    },
    {
      meshName: 'refinery-crate-lod0-placard',
      geometry: createInsetPanelGeometry({ width: 0.32, height: 0.18, depth: 0.025, insetWidth: 0.22, insetHeight: 0.10, recess: 0.01 }),
      material: 2,
    },
    {
      meshName: 'refinery-crate-lod0-latch',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.05, height: 0.16, depth: 0.18, chamfer: 0.012 })),
      material: 0,
    },
  ];

  const nodes = [
    { name: 'refinery-crate-shell', mesh: 0, translation: [0, 0.34, 0] },
    { name: 'refinery-crate-lid', mesh: 1, translation: [0, 0.76, 0] },
    { name: 'refinery-crate-band', mesh: 2, translation: [0.10, 0.42, 0] },
    { name: 'refinery-crate-corner-brace-fl', mesh: 3, translation: [0.47, 0.35, 0.35] },
    { name: 'refinery-crate-corner-brace-fr', mesh: 3, translation: [0.47, 0.35, -0.35] },
    { name: 'refinery-crate-corner-brace-rl', mesh: 3, translation: [-0.47, 0.35, 0.35] },
    { name: 'refinery-crate-corner-brace-rr', mesh: 3, translation: [-0.47, 0.35, -0.35] },
    { name: 'refinery-crate-side-panel-front', mesh: 4, translation: [0.535, 0.47, 0], rotation: ROTATE_Y_90 },
    { name: 'refinery-crate-side-panel-rear', mesh: 4, translation: [-0.507, 0.47, 0], rotation: ROTATE_Y_90 },
    { name: 'refinery-crate-handle-front-left-mount', mesh: 5, translation: [0.545, 0.50, 0.20] },
    { name: 'refinery-crate-handle-front-right-mount', mesh: 5, translation: [0.545, 0.50, -0.20] },
    { name: 'refinery-crate-handle-front-grip', mesh: 6, translation: [0.555, 0.55, 0] },
    { name: 'refinery-crate-handle-rear-left-mount', mesh: 5, translation: [-0.495, 0.50, 0.20] },
    { name: 'refinery-crate-handle-rear-right-mount', mesh: 5, translation: [-0.495, 0.50, -0.20] },
    { name: 'refinery-crate-handle-rear-grip', mesh: 6, translation: [-0.50, 0.55, 0] },
    { name: 'refinery-crate-top-rail-left', mesh: 7, translation: [0, 0.81, 0.30] },
    { name: 'refinery-crate-top-rail-right', mesh: 7, translation: [0, 0.81, -0.30] },
    { name: 'refinery-crate-base-skid-left', mesh: 8, translation: [0, 0.03, 0.30] },
    { name: 'refinery-crate-base-skid-right', mesh: 8, translation: [0, 0.03, -0.30] },
    { name: 'refinery-crate-marker', mesh: 9, translation: [0.555, 0.54, 0], rotation: ROTATE_Y_90 },
    { name: 'refinery-crate-latch', mesh: 10, translation: [0.56, 0.27, 0] },
  ];

  return {
    sceneName: 'refinery-crate-lod0',
    geometries,
    nodes,
    gameplayDimensions: [1.05, 0.84, 0.82],
    legacyVisualBounds: { min: [-0.525, -0.02, -0.45], max: [0.585, 0.88, 0.45] },
    authoredVisualBounds: { min: [-0.525, 0, -0.41], max: [0.585, 0.84, 0.41] },
    detail: 'chamfered split body and lid, visible lid seam, structural spine band, four corner braces, recessed side panels, paired front/rear carry handles with polymer grips, top rails, base skids, preserved marker plate, and latch depth',
    premiumSurfaceBinding: 'refinery-structural:bare-metal|refinery-shell:painted-metal|refinery-hazard-emissive:polymer-rubber',
  };
}

export function buildRefineryCrateLod0Glb(target = REFINERY_CRATE_LOD0_TARGET) {
  if (target.family !== 'crate') throw new Error(`Unsupported P28-C7 refinery crate family ${target.family}`);
  const definition = crateDefinition();
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
      generator: 'Ironshade Vector P28-C7 refinery crate LOD0 authoring',
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
      ironshadeP28C7CrateLod0: {
        version: 1,
        family: 'crate',
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        gameplayDimensions: definition.gameplayDimensions,
        legacyVisualBounds: definition.legacyVisualBounds,
        authoredVisualBounds: definition.authoredVisualBounds,
        gameplayCoordinatesChanged: false,
        gameplayDimensionsChanged: false,
        collisionDimensionsChanged: false,
        recoveryLods: [1, 2],
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: materialSlots.map(material => material.name),
        premiumSurfaceBinding: definition.premiumSurfaceBinding,
        detail: definition.detail,
        sourcePath: 'scripts/prepare-refinery-crate-lod0.mjs',
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

export async function writeRefineryCrateLod0Asset() {
  const outputPath = resolve(process.cwd(), 'public/assets/models', REFINERY_CRATE_LOD0_TARGET.relativePath);
  const glb = buildRefineryCrateLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] P28-C7 refinery crate LOD0 ${REFINERY_CRATE_LOD0_TARGET.relativePath}=${glb.length}b`);
  return { ...REFINERY_CRATE_LOD0_TARGET, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryCrateLod0Asset();
