import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_PIPE_CABLE_LOD0_TARGETS = Object.freeze([
  { family: 'pipeRack', relativePath: 'environments/refinery-pipe-rack-lod0.glb' },
  { family: 'cableTray', relativePath: 'environments/refinery-cable-tray-lod0.glb' },
]);

const ROTATE_Z_NEG_90 = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
const ROTATE_X_90 = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
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

function pipeRackDefinition() {
  const geometries = [
    {
      meshName: 'refinery-pipe-rack-lod0-spine',
      geometry: createChamferedBoxGeometry({ width: 3.8, height: 0.20, depth: 0.24, chamfer: 0.055 }),
      material: 0,
    },
    {
      meshName: 'refinery-pipe-rack-lod0-main-pipe',
      geometry: createCylinderGeometry({ radius: 0.18, height: 3.70, segments: 32 }),
      material: 1,
    },
    {
      meshName: 'refinery-pipe-rack-lod0-secondary-pipe',
      geometry: createCylinderGeometry({ radius: 0.10, height: 3.46, segments: 28 }),
      material: 1,
    },
    {
      meshName: 'refinery-pipe-rack-lod0-support',
      geometry: createChamferedBoxGeometry({ width: 0.18, height: 1.44, depth: 0.82, chamfer: 0.045 }),
      material: 0,
    },
    {
      meshName: 'refinery-pipe-rack-lod0-crossbar',
      geometry: createChamferedBoxGeometry({ width: 0.22, height: 0.12, depth: 1.12, chamfer: 0.025 }),
      material: 0,
    },
    {
      meshName: 'refinery-pipe-rack-lod0-collar',
      geometry: createCylinderGeometry({ radius: 0.235, height: 0.16, segments: 28 }),
      material: 0,
    },
    {
      meshName: 'refinery-pipe-rack-lod0-valve',
      geometry: createCylinderGeometry({ radius: 0.26, height: 0.08, segments: 24 }),
      material: 0,
    },
    {
      meshName: 'refinery-pipe-rack-lod0-warning',
      geometry: createChamferedBoxGeometry({ width: 1.72, height: 0.055, depth: 0.08, chamfer: 0.018 }),
      material: 2,
    },
  ];

  const nodes = [
    { name: 'refinery-pipe-rack-spine', mesh: 0, translation: [0, 1.35, 0] },
    { name: 'refinery-pipe-main-a', mesh: 1, translation: [-1.85, 1.12, 0.38], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-pipe-main-b', mesh: 1, translation: [-1.85, 1.72, -0.38], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-pipe-secondary-a', mesh: 2, translation: [-1.73, 1.48, 0.16], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-pipe-secondary-b', mesh: 2, translation: [-1.73, 1.36, -0.17], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-pipe-support-left', mesh: 3, translation: [-1.45, 0, 0] },
    { name: 'refinery-pipe-support-right', mesh: 3, translation: [1.45, 0, 0] },
    { name: 'refinery-pipe-crossbar-left', mesh: 4, translation: [-1.45, 0.92, 0] },
    { name: 'refinery-pipe-crossbar-right', mesh: 4, translation: [1.45, 0.92, 0] },
    { name: 'refinery-pipe-warning', mesh: 7, translation: [0, 1.452, 0.17] },
  ];

  for (const [pipeName, y, z] of [
    ['main-a', 1.12, 0.38],
    ['main-b', 1.72, -0.38],
  ]) {
    for (const [index, x] of [-1.02, 0.92].entries()) {
      nodes.push({
        name: `refinery-pipe-${pipeName}-coupling-${index + 1}`,
        mesh: 5,
        translation: [x - 0.08, y, z],
        rotation: ROTATE_Z_NEG_90,
      });
    }
  }
  nodes.push(
    { name: 'refinery-pipe-valve-body', mesh: 5, translation: [0.25, 1.72, -0.38], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-pipe-valve-wheel', mesh: 6, translation: [0.34, 1.72, -0.63], rotation: ROTATE_Y_90 },
  );

  return {
    family: 'pipeRack',
    sceneName: 'refinery-pipe-rack-lod0',
    geometries,
    nodes,
    visualBounds: { min: [-1.9, 0, -0.66], max: [1.9, 2.0, 0.66] },
    detail: 'round segmented process pipes, dual secondary lines, chamfered support frames, couplings, crossbars, and valve hardware',
    premiumSurfaceBinding: 'refinery-structural:painted-metal|refinery-shell:bare-metal|refinery-hazard-emissive:emissive-fixture',
  };
}

function cableTrayDefinition() {
  const geometries = [
    {
      meshName: 'refinery-cable-tray-lod0-spine',
      geometry: createChamferedBoxGeometry({ width: 0.14, height: 0.16, depth: 3.20, chamfer: 0.035 }),
      material: 0,
    },
    {
      meshName: 'refinery-cable-tray-lod0-rail',
      geometry: createChamferedBoxGeometry({ width: 0.11, height: 0.28, depth: 3.20, chamfer: 0.028 }),
      material: 0,
    },
    {
      meshName: 'refinery-cable-tray-lod0-rung',
      geometry: createChamferedBoxGeometry({ width: 0.46, height: 0.06, depth: 0.11, chamfer: 0.018 }),
      material: 0,
    },
    {
      meshName: 'refinery-cable-tray-lod0-power-cable',
      geometry: createCylinderGeometry({ radius: 0.065, height: 2.92, segments: 24 }),
      material: 2,
    },
    {
      meshName: 'refinery-cable-tray-lod0-data-cable',
      geometry: createCylinderGeometry({ radius: 0.055, height: 2.72, segments: 24 }),
      material: 3,
    },
    {
      meshName: 'refinery-cable-tray-lod0-clamp',
      geometry: createChamferedBoxGeometry({ width: 0.34, height: 0.34, depth: 0.10, chamfer: 0.035 }),
      material: 1,
    },
    {
      meshName: 'refinery-cable-tray-lod0-drop',
      geometry: createCylinderGeometry({ radius: 0.06, height: 1.08, segments: 20 }),
      material: 2,
    },
    {
      meshName: 'refinery-cable-tray-lod0-junction',
      geometry: createInsetPanelGeometry({ width: 0.34, height: 0.42, depth: 0.12, insetWidth: 0.18, insetHeight: 0.22, recess: 0.055 }),
      material: 1,
    },
  ];

  const nodes = [
    { name: 'refinery-cable-tray-spine', mesh: 0, translation: [0, 1.26, 0] },
    { name: 'refinery-cable-tray-rail-left', mesh: 1, translation: [-0.19, 1.23, 0] },
    { name: 'refinery-cable-tray-rail-right', mesh: 1, translation: [0.19, 1.23, 0] },
    { name: 'refinery-cable-tray-power', mesh: 3, translation: [0.11, 1.36, -1.46], rotation: ROTATE_X_90 },
    { name: 'refinery-cable-tray-data', mesh: 4, translation: [-0.08, 1.49, -1.36], rotation: ROTATE_X_90 },
    { name: 'refinery-cable-tray-clamp', mesh: 5, translation: [0, 1.24, 0] },
    { name: 'refinery-cable-tray-clamp-forward', mesh: 5, translation: [0, 1.24, 1.18] },
    { name: 'refinery-cable-tray-clamp-aft', mesh: 5, translation: [0, 1.24, -1.18] },
    { name: 'refinery-cable-tray-drop', mesh: 6, translation: [0.12, 0.18, -1.08] },
    { name: 'refinery-cable-tray-junction', mesh: 7, translation: [0.23, 0.76, -1.08], rotation: ROTATE_Y_90 },
  ];

  for (const [index, z] of [-1.35, -0.90, -0.45, 0, 0.45, 0.90, 1.35].entries()) {
    nodes.push({ name: `refinery-cable-tray-rung-${index + 1}`, mesh: 2, translation: [0, 1.25, z] });
  }

  return {
    family: 'cableTray',
    sceneName: 'refinery-cable-tray-lod0',
    geometries,
    nodes,
    visualBounds: { min: [-0.245, 0.18, -1.60], max: [0.29, 1.58, 1.60] },
    detail: 'twin side rails, seven tray rungs, round power/data cable runs, layered clamps, vertical drop, and recessed junction hardware',
    premiumSurfaceBinding: 'refinery-structural:painted-metal|refinery-shell:bare-metal|refinery-hazard-emissive:emissive-fixture|refinery-screen-emissive:emissive-fixture',
  };
}

function definitionForFamily(family) {
  if (family === 'pipeRack') return pipeRackDefinition();
  if (family === 'cableTray') return cableTrayDefinition();
  throw new Error(`Unsupported P28-C3 refinery pipe/cable family ${family}`);
}

export function buildRefineryPipeCableLod0Glb(target) {
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
      generator: 'Ironshade Vector P28-C3 refinery pipe/cable LOD0 authoring',
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
      ironshadeP28C3PipeCableLod0: {
        version: 1,
        family: target.family,
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        repeatedPlacementStable: true,
        visualBounds: definition.visualBounds,
        gameplayBoundsChanged: false,
        recoveryLods: [1, 2],
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: materialSlots.map(material => material.name),
        premiumSurfaceBinding: definition.premiumSurfaceBinding,
        detail: definition.detail,
        sourcePath: 'scripts/prepare-refinery-pipe-cable-lod0.mjs',
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

export async function writeRefineryPipeCableLod0Assets() {
  const results = [];
  for (const target of REFINERY_PIPE_CABLE_LOD0_TARGETS) {
    const outputPath = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const glb = buildRefineryPipeCableLod0Glb(target);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, glb);
    results.push({ ...target, bytes: glb.length });
  }
  console.log('[graphics] P28-C3 refinery pipe/cable LOD0 ' + results.map(item => `${item.relativePath}=${item.bytes}b`).join(' '));
  return results;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryPipeCableLod0Assets();
