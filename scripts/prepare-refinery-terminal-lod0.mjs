import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
} from './lib/hard-surface-geometry.mjs';

export const REFINERY_TERMINAL_LOD0_TARGET = Object.freeze({
  family: 'terminal',
  relativePath: 'environments/refinery-terminal-lod0.glb',
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

function terminalDefinition() {
  const geometries = [
    {
      meshName: 'refinery-terminal-lod0-pedestal',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.58, height: 1.24, depth: 0.72, chamfer: 0.065 })),
      material: 0,
    },
    {
      meshName: 'refinery-terminal-lod0-console',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.72, height: 0.24, depth: 0.88, chamfer: 0.055 })),
      material: 1,
    },
    {
      meshName: 'refinery-terminal-lod0-screen',
      geometry: createInsetPanelGeometry({ width: 0.62, height: 0.32, depth: 0.04, insetWidth: 0.49, insetHeight: 0.22, recess: 0.018 }),
      material: 3,
    },
    {
      meshName: 'refinery-terminal-lod0-beacon-mount',
      geometry: createInsetPanelGeometry({ width: 0.16, height: 0.10, depth: 0.16, insetWidth: 0.10, insetHeight: 0.06, recess: 0.025 }),
      material: 2,
    },
    {
      meshName: 'refinery-terminal-lod0-side-light',
      geometry: createInsetPanelGeometry({ width: 0.08, height: 0.34, depth: 0.08, insetWidth: 0.045, insetHeight: 0.25, recess: 0.022 }),
      material: 2,
    },
    {
      meshName: 'refinery-terminal-lod0-pedestal-panel',
      geometry: createInsetPanelGeometry({ width: 0.42, height: 0.50, depth: 0.055, insetWidth: 0.29, insetHeight: 0.34, recess: 0.025 }),
      material: 1,
    },
    {
      meshName: 'refinery-terminal-lod0-console-rib',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.06, height: 0.22, depth: 0.10, chamfer: 0.018 })),
      material: 0,
    },
    {
      meshName: 'refinery-terminal-lod0-keypad',
      geometry: createInsetPanelGeometry({ width: 0.20, height: 0.13, depth: 0.035, insetWidth: 0.13, insetHeight: 0.075, recess: 0.012 }),
      material: 3,
    },
    {
      meshName: 'refinery-terminal-lod0-status-strip',
      geometry: createInsetPanelGeometry({ width: 0.26, height: 0.07, depth: 0.032, insetWidth: 0.19, insetHeight: 0.035, recess: 0.010 }),
      material: 2,
    },
    {
      meshName: 'refinery-terminal-lod0-service-port',
      geometry: centerY(createCylinderGeometry({ radius: 0.055, height: 0.055, segments: 24 })),
      material: 0,
    },
    {
      meshName: 'refinery-terminal-lod0-base-foot',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.16, height: 0.08, depth: 0.18, chamfer: 0.025 })),
      material: 0,
    },
    {
      meshName: 'refinery-terminal-lod0-screen-shroud',
      geometry: centerY(createChamferedBoxGeometry({ width: 0.10, height: 0.38, depth: 0.72, chamfer: 0.025 })),
      material: 0,
    },
  ];

  const nodes = [
    { name: 'refinery-terminal-pedestal', mesh: 0, translation: [0, 0.62, 0] },
    { name: 'refinery-terminal-console', mesh: 1, translation: [0.20, 1.34, 0] },
    { name: 'refinery-terminal-screen', mesh: 2, translation: [0.57, 1.42, 0], rotation: ROTATE_Y_90 },
    { name: 'objective-beacon-mount', mesh: 3, translation: [0, 1.78, 0] },
    { name: 'refinery-terminal-side-light', mesh: 4, translation: [0.28, 0.86, -0.38] },
    { name: 'refinery-terminal-pedestal-service-panel', mesh: 5, translation: [0.285, 0.74, 0], rotation: ROTATE_Y_90 },
    { name: 'refinery-terminal-console-rib-left', mesh: 6, translation: [0.19, 1.34, 0.37] },
    { name: 'refinery-terminal-console-rib-right', mesh: 6, translation: [0.19, 1.34, -0.37] },
    { name: 'refinery-terminal-keypad', mesh: 7, translation: [0.545, 1.22, -0.23], rotation: ROTATE_Y_90 },
    { name: 'refinery-terminal-status-strip', mesh: 8, translation: [0.545, 1.22, 0.23], rotation: ROTATE_Y_90 },
    { name: 'refinery-terminal-service-port', mesh: 9, translation: [0.285, 0.39, 0.24], rotation: ROTATE_Y_90 },
    { name: 'refinery-terminal-foot-left', mesh: 10, translation: [0, 0.04, 0.25] },
    { name: 'refinery-terminal-foot-right', mesh: 10, translation: [0, 0.04, -0.25] },
    { name: 'refinery-terminal-screen-shroud', mesh: 11, translation: [0.50, 1.42, 0] },
  ];

  return {
    sceneName: 'refinery-terminal-lod0',
    geometries,
    nodes,
    legacyVisualBounds: { min: [-0.29, 0, -0.44], max: [0.59, 1.83, 0.44] },
    interactionOrigin: [0, 0, 0],
    cueAnchors: {
      screen: [0.57, 1.42, 0],
      objectiveBeaconMount: [0, 1.78, 0],
      sideLight: [0.28, 0.86, -0.38],
    },
    detail: 'chamfered pedestal and console housings, recessed pedestal service panel, deep inset display bezel, keypad and status fixtures, screen shroud, console ribs, service port, feet, side light, and preserved objective beacon mount',
    premiumSurfaceBinding: 'refinery-structural:painted-metal|refinery-shell:bare-metal|refinery-hazard-emissive:emissive-fixture|refinery-screen-emissive:emissive-fixture',
  };
}

export function buildRefineryTerminalLod0Glb(target = REFINERY_TERMINAL_LOD0_TARGET) {
  if (target.family !== 'terminal') throw new Error(`Unsupported P28-C6 refinery terminal family ${target.family}`);
  const definition = terminalDefinition();
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
    .filter(node => [2, 3, 4, 7, 8].includes(node.mesh))
    .map(node => node.name);
  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Ironshade Vector P28-C6 refinery terminal LOD0 authoring',
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
      ironshadeP28C6TerminalLod0: {
        version: 1,
        family: 'terminal',
        lodTier: 0,
        deterministic: true,
        stablePivot: 'environment-root',
        legacyVisualBounds: definition.legacyVisualBounds,
        interactionOrigin: definition.interactionOrigin,
        cueAnchors: definition.cueAnchors,
        gameplayCoordinatesChanged: false,
        gameplayBoundsChanged: false,
        interactionCueAlignmentChanged: false,
        recoveryLods: [1, 2],
        attributes: ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'],
        materialSlots: materialSlots.map(material => material.name),
        emissiveNodeNames,
        selectiveGlowNamePrefix: 'refinery-terminal',
        premiumSurfaceBinding: definition.premiumSurfaceBinding,
        detail: definition.detail,
        sourcePath: 'scripts/prepare-refinery-terminal-lod0.mjs',
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

export async function writeRefineryTerminalLod0Asset() {
  const outputPath = resolve(process.cwd(), 'public/assets/models', REFINERY_TERMINAL_LOD0_TARGET.relativePath);
  const glb = buildRefineryTerminalLod0Glb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] P28-C6 refinery terminal LOD0 ${REFINERY_TERMINAL_LOD0_TARGET.relativePath}=${glb.length}b`);
  return { ...REFINERY_TERMINAL_LOD0_TARGET, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) await writeRefineryTerminalLod0Asset();
