import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_CONDUIT_GANTRY_LOD0_TARGETS = Object.freeze([
  { family: 'serviceConduit', relativePath: 'environments/refinery-service-conduit-lod0.glb' },
  { family: 'gantry', relativePath: 'environments/refinery-smelter-gantry-lod0.glb' },
]);

const ROTATE_Z_NEG_90 = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
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

function serviceConduitDefinition() {
  const geometries = [
    {
      meshName: 'refinery-service-conduit-lod0-trunk',
      geometry: createCylinderGeometry({ radius: 0.11, height: 2.8, segments: 32 }),
      material: 1,
    },
    {
      meshName: 'refinery-service-conduit-lod0-upper',
      geometry: createCylinderGeometry({ radius: 0.06, height: 2.35, segments: 28 }),
      material: 1,
    },
    {
      meshName: 'refinery-service-conduit-lod0-aux',
      geometry: createCylinderGeometry({ radius: 0.04, height: 2.12, segments: 24 }),
      material: 2,
    },
    {
      meshName: 'refinery-service-conduit-lod0-support',
      geometry: createChamferedBoxGeometry({ width: 0.16, height: 0.36, depth: 0.48, chamfer: 0.035 }),
      material: 0,
    },
    {
      meshName: 'refinery-service-conduit-lod0-coupling',
      geometry: createCylinderGeometry({ radius: 0.145, height: 0.10, segments: 28 }),
      material: 0,
    },
    {
      meshName: 'refinery-service-conduit-lod0-valve-body',
      geometry: createCylinderGeometry({ radius: 0.16, height: 0.14, segments: 28 }),
      material: 0,
    },
    {
      meshName: 'refinery-service-conduit-lod0-valve-wheel',
      geometry: createCylinderGeometry({ radius: 0.17, height: 0.05, segments: 32 }),
      material: 2,
    },
    {
      meshName: 'refinery-service-conduit-lod0-junction',
      geometry: createInsetPanelGeometry({ width: 0.30, height: 0.26, depth: 0.16, insetWidth: 0.18, insetHeight: 0.14, recess: 0.045 }),
      material: 1,
    },
    {
      meshName: 'refinery-service-conduit-lod0-status',
      geometry: createInsetPanelGeometry({ width: 0.18, height: 0.10, depth: 0.06, insetWidth: 0.11, insetHeight: 0.055, recess: 0.018 }),
      material: 3,
    },
  ];

  const nodes = [
    { name: 'refinery-service-conduit-trunk', mesh: 0, translation: [-1.4, 0.30, 0], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-service-conduit-upper', mesh: 1, translation: [-1.175, 0.68, 0], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-service-conduit-aux', mesh: 2, translation: [-1.06, 0.51, -0.13], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-service-conduit-support-left', mesh: 3, translation: [-1.05, 0, 0] },
    { name: 'refinery-service-conduit-support-right', mesh: 3, translation: [1.05, 0, 0] },
    { name: 'refinery-service-conduit-junction', mesh: 7, translation: [-0.34, 0.49, -0.16] },
    { name: 'refinery-service-conduit-status', mesh: 8, translation: [-0.72, 0.70, 0.18] },
  ];

  for (const [index, x] of [-0.97, 0.83].entries()) {
    nodes.push({
      name: `refinery-service-conduit-trunk-coupling-${index + 1}`,
      mesh: 4,
      translation: [x, 0.30, 0],
      rotation: ROTATE_Z_NEG_90,
    });
  }
  nodes.push(
    { name: 'refinery-service-conduit-valve-body', mesh: 5, translation: [0.65, 0.72, 0], rotation: ROTATE_Z_NEG_90 },
    { name: 'refinery-service-conduit-valve-wheel', mesh: 6, translation: [0.695, 0.72, 0], rotation: ROTATE_Z_NEG_90 },
  );

  return {
    family: 'serviceConduit',
    sceneName: 'refinery-service-conduit-lod0',
    geometries,
    nodes,
    visualBounds: { min: [-1.4, 0, -0.24], max: [1.4, 0.89, 0.24] },
    routeClearancePreserved: true,
    detail: 'round segmented service runs, secondary line, chamfered supports, couplings, valve hardware, recessed junction and status fixtures',
    premiumSurfaceBinding: 'refinery-structural:painted-metal|refinery-shell:bare-metal|refinery-hazard-emissive:emissive-fixture|refinery-screen-emissive:emissive-fixture',
  };
}

function gantryDefinition() {
  const geometries = [
    {
      meshName: 'refinery-smelter-gantry-lod0-post',
      geometry: createChamferedBoxGeometry({ width: 0.36, height: 3.56, depth: 0.58, chamfer: 0.065 }),
      material: 0,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-post-rib',
      geometry: createChamferedBoxGeometry({ width: 0.08, height: 2.72, depth: 0.62, chamfer: 0.022 }),
      material: 1,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-beam',
      geometry: createChamferedBoxGeometry({ width: 5.80, height: 0.46, depth: 0.82, chamfer: 0.075 }),
      material: 1,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-service-rail',
      geometry: createChamferedBoxGeometry({ width: 4.60, height: 0.12, depth: 0.12, chamfer: 0.024 }),
      material: 0,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-carriage',
      geometry: createChamferedBoxGeometry({ width: 0.92, height: 0.42, depth: 0.62, chamfer: 0.055 }),
      material: 1,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-roller',
      geometry: createCylinderGeometry({ radius: 0.12, height: 0.40, segments: 24 }),
      material: 0,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-drop-line',
      geometry: createCylinderGeometry({ radius: 0.05, height: 1.28, segments: 20 }),
      material: 2,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-foot',
      geometry: createChamferedBoxGeometry({ width: 0.36, height: 0.12, depth: 0.58, chamfer: 0.03 }),
      material: 1,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-cap',
      geometry: createChamferedBoxGeometry({ width: 0.54, height: 0.16, depth: 0.74, chamfer: 0.035 }),
      material: 1,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-hazard',
      geometry: createChamferedBoxGeometry({ width: 3.90, height: 0.10, depth: 0.08, chamfer: 0.018 }),
      material: 2,
    },
    {
      meshName: 'refinery-smelter-gantry-lod0-status',
      geometry: createInsetPanelGeometry({ width: 0.28, height: 0.16, depth: 0.06, insetWidth: 0.17, insetHeight: 0.09, recess: 0.018 }),
      material: 3,
    },
  ];

  const nodes = [
    { name: 'refinery-smelter-gantry-left', mesh: 0, translation: [-2.60, 0, 0] },
    { name: 'refinery-smelter-gantry-right', mesh: 0, translation: [2.60, 0, 0] },
    { name: 'refinery-smelter-gantry-rib-left', mesh: 1, translation: [-2.60, 0.42, 0] },
    { name: 'refinery-smelter-gantry-rib-right', mesh: 1, translation: [2.60, 0.42, 0] },
    { name: 'refinery-smelter-gantry-beam', mesh: 2, translation: [0, 3.23, 0] },
    { name: 'refinery-smelter-gantry-service-rail', mesh: 3, translation: [0, 2.97, -0.42] },
    { name: 'refinery-smelter-gantry-carriage', mesh: 4, translation: [0.72, 2.71, 0] },
    { name: 'refinery-smelter-gantry-drop-line', mesh: 6, translation: [0.72, 1.51, 0] },
    { name: 'refinery-smelter-gantry-foot-left', mesh: 7, translation: [-2.60, 0, 0] },
    { name: 'refinery-smelter-gantry-foot-right', mesh: 7, translation: [2.60, 0, 0] },
    { name: 'refinery-smelter-gantry-cap-left', mesh: 8, translation: [-2.60, 3.20, 0] },
    { name: 'refinery-smelter-gantry-cap-right', mesh: 8, translation: [2.60, 3.20, 0] },
    { name: 'refinery-smelter-gantry-hazard', mesh: 9, translation: [0, 3.12, 0.43] },
    { name: 'refinery-smelter-gantry-status', mesh: 10, translation: [1.48, 3.45, 0.44] },
    { name: 'refinery-smelter-gantry-roller-left', mesh: 5, translation: [0.46, 2.92, -0.22], rotation: ROTATE_X_90 },
    { name: 'refinery-smelter-gantry-roller-right', mesh: 5, translation: [0.98, 2.92, -0.22], rotation: ROTATE_X_90 },
  ];

  return {
    family: 'gantry',
    sceneName: 'refinery-smelter-gantry-lod0',
    geometries,
    nodes,
    visualBounds: { min: [-2.9, 0, -0.48], max: [2.9, 3.69, 0.47] },
    routeClearancePreserved: true,
    detail: 'chamfered uprights and crown beam, layered post ribs and caps, service rail, carriage rollers, preserved drop line, foot plates, hazard strip, and recessed status fixture',
    premiumSurfaceBinding: 'refinery-structural:painted-metal|refinery-shell:bare-metal|refinery-hazard-emissive:emissive-fixture|refinery-screen-emissive:emissive-fixture',
  };
}

function definitionForFamily(family) {
  if (family === 'serviceConduit') return serviceConduitDefinition();
  if (family === 'gantry') return gantryDefinition();
  throw new Error(`Unsupported P28-C4 refinery conduit/gantry family ${family}`);
}

export function buildRefineryConduitGantryLod0Glb(target) {
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
      generator: 'Ironshade Vector P28-C4 refinery conduit/gantry LOD0 authoring',
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
      ironshadeP28C4ConduitGantryLod0: {
        version: 1,
        family: target.family,
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        repeatedPlacementStable: true,
        visualBounds: definition.visualBounds,
        gameplayBoundsChanged: false,
        routeClearancePreserved: definition.routeClearancePreserved,
        recoveryLods: [1, 2],
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: materialSlots.map(material => material.name),
        premiumSurfaceBinding: definition.premiumSurfaceBinding,
        detail: definition.detail,
        sourcePath: 'scripts/prepare-refinery-conduit-gantry-lod0.mjs',
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

export async function writeRefineryConduitGantryLod0Assets() {
  const results = [];
  for (const target of REFINERY_CONDUIT_GANTRY_LOD0_TARGETS) {
    const outputPath = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const glb = buildRefineryConduitGantryLod0Glb(target);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, glb);
    results.push({ ...target, bytes: glb.length });
  }
  console.log('[graphics] P28-C4 refinery conduit/gantry LOD0 ' + results.map(item => `${item.relativePath}=${item.bytes}b`).join(' '));
  return results;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryConduitGantryLod0Assets();
