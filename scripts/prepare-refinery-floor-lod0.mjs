import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_FLOOR_LOD0_TARGETS = Object.freeze([
  { family: 'floor', relativePath: 'environments/refinery-floor-panel-lod0.glb' },
  { family: 'floorGrate', relativePath: 'environments/refinery-floor-service-grate-lod0.glb' },
]);

const FOOTPRINT = 3.8;
const HALF_FOOTPRINT = FOOTPRINT / 2;

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
  ];
}

function floorPanelDefinition() {
  const geometries = [
    {
      meshName: 'refinery-floor-panel-lod0-deck',
      geometry: createChamferedBoxGeometry({ width: FOOTPRINT, height: 0.075, depth: FOOTPRINT, chamfer: 0.12 }),
      material: 0,
    },
    {
      meshName: 'refinery-floor-panel-lod0-service-inset',
      geometry: createChamferedBoxGeometry({ width: 1.18, height: 0.035, depth: 0.88, chamfer: 0.06 }),
      material: 1,
    },
    {
      meshName: 'refinery-floor-panel-lod0-long-bevel',
      geometry: createChamferedBoxGeometry({ width: 3.48, height: 0.026, depth: 0.075, chamfer: 0.018 }),
      material: 1,
    },
    {
      meshName: 'refinery-floor-panel-lod0-cross-bevel',
      geometry: createChamferedBoxGeometry({ width: 0.075, height: 0.026, depth: 3.48, chamfer: 0.018 }),
      material: 1,
    },
    {
      meshName: 'refinery-floor-panel-lod0-fastener',
      geometry: createCylinderGeometry({ radius: 0.045, height: 0.028, segments: 16 }),
      material: 1,
    },
  ];
  const nodes = [
    { name: 'refinery-floor-panel', mesh: 0 },
    { name: 'refinery-floor-service-plate', mesh: 1, translation: [0.92, 0.075, -0.88] },
    { name: 'refinery-floor-seam-north', mesh: 2, translation: [0, 0.076, -1.63] },
    { name: 'refinery-floor-seam-south', mesh: 2, translation: [0, 0.076, 1.63] },
    { name: 'refinery-floor-cross-seam-west', mesh: 3, translation: [-1.63, 0.076, 0] },
    { name: 'refinery-floor-cross-seam-east', mesh: 3, translation: [1.63, 0.076, 0] },
  ];
  for (const [index, [x, z]] of [
    [-1.68, -1.68],
    [1.68, -1.68],
    [-1.68, 1.68],
    [1.68, 1.68],
  ].entries()) {
    nodes.push({ name: `refinery-floor-fastener-${index + 1}`, mesh: 4, translation: [x, 0.075, z] });
  }
  return {
    family: 'floor',
    sceneName: 'refinery-floor-panel-lod0',
    geometries,
    nodes,
    maxY: 0.11,
    detail: 'chamfered deck perimeter, raised service inset, beveled seams, fasteners',
  };
}

function floorGrateDefinition() {
  const geometries = [
    {
      meshName: 'refinery-floor-service-grate-lod0-subdeck',
      geometry: createChamferedBoxGeometry({ width: FOOTPRINT, height: 0.022, depth: FOOTPRINT, chamfer: 0.10 }),
      material: 0,
    },
    {
      meshName: 'refinery-floor-service-grate-lod0-frame-x',
      geometry: createChamferedBoxGeometry({ width: 3.48, height: 0.10, depth: 0.16, chamfer: 0.035 }),
      material: 1,
    },
    {
      meshName: 'refinery-floor-service-grate-lod0-frame-z',
      geometry: createChamferedBoxGeometry({ width: 0.16, height: 0.10, depth: 3.48, chamfer: 0.035 }),
      material: 1,
    },
    {
      meshName: 'refinery-floor-service-grate-lod0-slat',
      geometry: createChamferedBoxGeometry({ width: 0.11, height: 0.080, depth: 2.92, chamfer: 0.024 }),
      material: 0,
    },
    {
      meshName: 'refinery-floor-service-grate-lod0-crossbar',
      geometry: createChamferedBoxGeometry({ width: 2.92, height: 0.052, depth: 0.10, chamfer: 0.020 }),
      material: 1,
    },
    {
      meshName: 'refinery-floor-service-grate-lod0-fastener',
      geometry: createCylinderGeometry({ radius: 0.042, height: 0.024, segments: 16 }),
      material: 1,
    },
  ];
  const nodes = [
    { name: 'refinery-floor-service-grate', mesh: 0 },
    { name: 'refinery-floor-service-grate-frame-north', mesh: 1, translation: [0, 0.022, -1.66] },
    { name: 'refinery-floor-service-grate-frame-south', mesh: 1, translation: [0, 0.022, 1.66] },
    { name: 'refinery-floor-service-grate-frame-west', mesh: 2, translation: [-1.66, 0.022, 0] },
    { name: 'refinery-floor-service-grate-frame-east', mesh: 2, translation: [1.66, 0.022, 0] },
  ];
  for (const [index, x] of [-1.35, -0.90, -0.45, 0, 0.45, 0.90, 1.35].entries()) {
    nodes.push({ name: `refinery-floor-service-grate-slat-${index + 1}`, mesh: 3, translation: [x, 0.025, 0] });
  }
  for (const [index, z] of [-1.0, 0, 1.0].entries()) {
    nodes.push({ name: `refinery-floor-service-grate-crossbar-${index + 1}`, mesh: 4, translation: [0, 0.030, z] });
  }
  for (const [index, [x, z]] of [
    [-1.68, -1.68],
    [1.68, -1.68],
    [-1.68, 1.68],
    [1.68, 1.68],
  ].entries()) {
    nodes.push({ name: `refinery-floor-service-grate-fastener-${index + 1}`, mesh: 5, translation: [x, 0.122, z] });
  }
  return {
    family: 'floorGrate',
    sceneName: 'refinery-floor-service-grate-lod0',
    geometries,
    nodes,
    maxY: 0.146,
    detail: 'deep perimeter frame, seven raised grate slats, cross braces, fasteners',
  };
}

function definitionForFamily(family) {
  if (family === 'floor') return floorPanelDefinition();
  if (family === 'floorGrate') return floorGrateDefinition();
  throw new Error(`Unsupported P28-C1 refinery floor family ${family}`);
}

export function buildRefineryFloorLod0Glb(target) {
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
      generator: 'Ironshade Vector P28-C1 refinery floor LOD0 authoring',
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
      ironshadeP28C1FloorLod0: {
        version: 1,
        family: target.family,
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        footprintMeters: [FOOTPRINT, FOOTPRINT],
        visualBounds: { min: [-HALF_FOOTPRINT, 0, -HALF_FOOTPRINT], max: [HALF_FOOTPRINT, definition.maxY, HALF_FOOTPRINT] },
        gameplayBoundsChanged: false,
        recoveryLods: [1, 2],
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: materialSlots.map(material => material.name),
        premiumSurfaceBinding: target.family === 'floor'
          ? 'refinery-structural:deck-plate|refinery-shell:bare-metal'
          : 'refinery-structural:bare-metal|refinery-shell:painted-metal',
        detail: definition.detail,
        sourcePath: 'scripts/prepare-refinery-floor-lod0.mjs',
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

export async function writeRefineryFloorLod0Assets() {
  const results = [];
  for (const target of REFINERY_FLOOR_LOD0_TARGETS) {
    const outputPath = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const glb = buildRefineryFloorLod0Glb(target);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, glb);
    results.push({ ...target, bytes: glb.length });
  }
  console.log('[graphics] P28-C1 refinery floor LOD0 ' + results.map(item => `${item.relativePath}=${item.bytes}b`).join(' '));
  return results;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryFloorLod0Assets();
