import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChamferedBoxGeometry, createCylinderGeometry, createInsetPanelGeometry } from '../scripts/lib/hard-surface-geometry.mjs';
import { createMachinedFlangeGeometry, createRecessedLouverGeometry } from '../scripts/lib/refinery-hero-geometry.mjs';

// Presentation-only props. Every rendered node references real PBR-ready geometry;
// repeated placements share the Babylon asset cache and native mesh instances.
export const REFINERY_DRESSING_TARGETS = Object.freeze([
  { family: 'valveSkid', id: 'valve-skid' },
  { family: 'junctionBox', id: 'junction-box' },
  { family: 'ventBank', id: 'vent-bank' },
  { family: 'toolCart', id: 'tool-cart' },
  { family: 'canisterRack', id: 'canister-rack' },
  { family: 'guardRail', id: 'guard-rail' },
  { family: 'hoseReel', id: 'hose-reel' },
  { family: 'serviceCabinet', id: 'service-cabinet' },
].map(target => Object.freeze({
  ...target,
  relativePath: 'environments/refinery-dressing-' + target.id + '-lod0.glb',
})));

const QZ = [0, 0, -Math.SQRT1_2, Math.SQRT1_2];
const QX = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const QY = [0, Math.SQRT1_2, 0, Math.SQRT1_2];

const surfaceMaterials = [
  { name: 'refinery-structural', pbrMetallicRoughness: { baseColorFactor: [0.18, 0.24, 0.25, 1], metallicFactor: 0.82, roughnessFactor: 0.34 } },
  { name: 'refinery-shell', pbrMetallicRoughness: { baseColorFactor: [0.48, 0.53, 0.52, 1], metallicFactor: 0.96, roughnessFactor: 0.26 } },
  { name: 'refinery-hazard-emissive', pbrMetallicRoughness: { baseColorFactor: [0.58, 0.27, 0.045, 1], metallicFactor: 0.42, roughnessFactor: 0.31 }, emissiveFactor: [0.34, 0.12, 0.015] },
  { name: 'refinery-screen-emissive', pbrMetallicRoughness: { baseColorFactor: [0.03, 0.19, 0.22, 1], metallicFactor: 0.28, roughnessFactor: 0.22 }, emissiveFactor: [0.02, 0.33, 0.41] },
];

function dressingDefinition(family) {
  const geometries = [];
  const nodes = [];
  function mesh(name, geometry, material) {
    geometries.push({ name, geometry, material });
    return geometries.length - 1;
  }
  function place(name, index, translation, rotation) {
    nodes.push({ name, mesh: index, translation, ...(rotation ? { rotation } : {}) });
  }
  const box = (name, width, height, depth, material = 0) =>
    mesh(name, createChamferedBoxGeometry({ width, height, depth, chamfer: Math.min(width, height, depth) * 0.18 }), material);
  const cylinder = (name, radius, height, material = 1) =>
    mesh(name, createCylinderGeometry({ radius, height, segments: 36 }), material);
  const ring = (name, outerRadius, innerRadius, height, material = 0) =>
    mesh(name, createMachinedFlangeGeometry({ outerRadius, innerRadius, height, segments: 44 }), material);
  const inset = (name, width, height, material = 1) =>
    mesh(name, createInsetPanelGeometry({ width, height, depth: 0.09, insetWidth: width * 0.72, insetHeight: height * 0.72, recess: 0.035 }), material);

  switch (family) {
    case 'valveSkid': {
      const skid = box('machined-skid', 1.22, 0.15, 0.64);
      const tube = cylinder('pressure-line', 0.13, 1.16);
      const rim = ring('handwheel-open-bore', 0.29, 0.18, 0.08, 2);
      const stem = cylinder('wheel-stem', 0.08, 0.24);
      const support = box('pipe-stand', 0.13, 0.62, 0.15);
      const collar = ring('gasket-collar', 0.21, 0.14, 0.10);
      place('valve-foot', skid, [0, 0, 0]);
      place('valve-pipe', tube, [-0.58, 0.59, 0], QZ);
      for (const x of [-0.37, 0.37]) place('valve-pipe-collar-' + x, collar, [x, 0.59, 0], QZ);
      for (const x of [-0.38, 0.38]) place('valve-support-' + x, support, [x, 0.15, 0]);
      place('valve-handwheel', rim, [0.2, 0.87, -0.15]);
      place('valve-handwheel-stem', stem, [0.2, 0.63, -0.15]);
      break;
    }
    case 'junctionBox': {
      const shell = box('double-junction-shell', 0.84, 0.68, 0.30, 1);
      const face = inset('junction-hinged-door', 0.72, 0.58);
      const cable = cylinder('flex-cable', 0.055, 0.88, 0);
      const latch = box('locking-latch', 0.09, 0.18, 0.12, 0);
      const status = box('junction-status-rail', 0.48, 0.045, 0.045, 3);
      place('junction-chassis', shell, [0, 0.18, 0]);
      place('junction-front', face, [0, 0.52, 0.18]);
      place('junction-lock', latch, [0.31, 0.49, 0.25]);
      place('junction-status', status, [0, 0.76, 0.19]);
      for (const x of [-0.22, 0, 0.22]) place('junction-wire-' + x, cable, [x, 0.09, -0.12], QX);
      break;
    }
    case 'ventBank': {
      const surround = box('vent-mounting-frame', 1.35, 0.12, 0.76);
      const openLouvers = mesh('real-open-vent-louvers', createRecessedLouverGeometry({ width: 1.08, height: 0.56, depth: 0.11, slats: 13 }), 1);
      const fastener = cylinder('vent-bolt', 0.035, 0.065);
      const duct = box('vent-offset-duct', 0.94, 0.35, 0.56);
      place('vent-base', surround, [0, 0.38, 0]);
      place('vent-duct', duct, [0, 0.03, 0]);
      place('vent-blades', openLouvers, [0, 0.55, 0]);
      for (const x of [-0.56, 0.56]) for (const z of [-0.27, 0.27])
        place('vent-mount-bolt', fastener, [x, 0.49, z]);
      break;
    }
    case 'toolCart': {
      const tray = box('open-rolling-tray', 1.04, 0.09, 0.58, 1);
      const grip = box('handgrip', 0.09, 0.09, 0.66);
      const wheel = cylinder('castor', 0.18, 0.10, 0);
      const leg = box('cart-upright', 0.09, 0.68, 0.09);
      const lip = box('separate-tray-lip', 0.95, 0.11, 0.06);
      place('cart-bed', tray, [0, 0.60, 0]);
      for (const x of [-0.42, 0.42]) for (const z of [-0.23, 0.23]) {
        place('cart-upright', leg, [x, 0.12, z]);
        place('cart-castor', wheel, [x, 0.18, z], QX);
      }
      for (const z of [-0.25, 0.25]) place('cart-lip', lip, [0, 0.70, z]);
      place('cart-push-handle', grip, [0.58, 0.92, 0]);
      break;
    }
    case 'canisterRack': {
      const base = box('bottle-pallet', 1.20, 0.12, 0.53);
      const bottle = cylinder('pressure-bottle', 0.14, 0.72, 1);
      const crown = ring('cylinder-neck-collar', 0.15, 0.07, 0.09);
      const strap = box('tank-retainer', 1.18, 0.055, 0.09, 2);
      const block = box('separate-tank-bracket', 0.10, 0.90, 0.10);
      place('canister-platform', base, [0, 0, 0]);
      for (const x of [-0.43, -0.14, 0.14, 0.43]) {
        place('canister-pressure-tank', bottle, [x, 0.12, 0]);
        place('canister-neck', crown, [x, 0.84, 0]);
      }
      for (const x of [-0.56, 0.56]) place('canister-frame', block, [x, 0.12, 0]);
      for (const z of [-0.2, 0.2]) place('canister-retaining-band', strap, [0, 0.58, z]);
      break;
    }
    case 'guardRail': {
      const post = box('rail-post', 0.13, 1.04, 0.13);
      const upper = box('hollow-guard-top-rail', 2.4, 0.11, 0.11, 1);
      const middle = box('guard-middle-rail', 2.35, 0.075, 0.08);
      const foot = box('guard-footplate', 0.31, 0.08, 0.35);
      const stripe = box('warning-tab', 0.34, 0.045, 0.115, 2);
      for (const x of [-1.15, 0, 1.15]) {
        place('guard-post', post, [x, 0.08, 0]);
        place('guard-anchor-plate', foot, [x, 0, 0]);
      }
      place('guard-top', upper, [0, 0.96, 0]);
      place('guard-cross', middle, [0, 0.55, 0]);
      for (const x of [-0.75, 0.75]) place('guard-warning-tab', stripe, [x, 1.075, 0]);
      break;
    }
    case 'hoseReel': {
      const flange = ring('deep-open-reel-drum', 0.47, 0.27, 0.10, 1);
      const hub = cylinder('axle-spindle', 0.11, 0.58);
      const bracket = box('reel-bracket', 0.13, 0.70, 0.16);
      const base = box('hose-reel-foot', 1.17, 0.10, 0.62);
      const hose = ring('coiled-rubber-hose', 0.34, 0.23, 0.14, 0);
      place('reel-base', base, [0, 0, 0]);
      for (const z of [-0.25, 0.25]) place('reel-support', bracket, [0, 0.1, z]);
      place('hose-spindle', hub, [0, 0.73, -0.28], QX);
      for (const y of [0.51, 0.70, 0.89]) place('reel-coil', hose, [0, y, 0]);
      for (const z of [-0.24, 0.24]) place('reel-rim', flange, [0, 0.73, z], QX);
      break;
    }
    case 'serviceCabinet': {
      const shell = box('tool-locker-body', 1.12, 1.38, 0.54, 1);
      const door = inset('folded-metal-door', 0.44, 1.15, 0);
      const hinge = cylinder('real-door-hinge', 0.036, 0.15);
      const handle = box('door-handle', 0.035, 0.24, 0.06);
      const header = box('cabinet-header-sign', 0.96, 0.14, 0.06, 2);
      const foot = box('cabinet-leg', 0.14, 0.14, 0.14);
      place('cabinet-frame', shell, [0, 0.14, 0]);
      for (const x of [-0.28, 0.28]) {
        place('cabinet-door', door, [x, 0.82, 0.31]);
        place('cabinet-grip', handle, [x + (x < 0 ? 0.15 : -0.15), 0.79, 0.38]);
        for (const y of [0.43, 1.30]) place('cabinet-hinge', hinge, [x + (x < 0 ? -0.21 : 0.21), y, 0.30]);
      }
      place('cabinet-header', header, [0, 1.38, 0.31]);
      for (const x of [-0.43, 0.43]) for (const z of [-0.22, 0.22])
        place('cabinet-foot', foot, [x, 0, z]);
      break;
    }
    default:
      throw new Error('Unknown refinery dressing family ' + family);
  }
  return { geometries, nodes };
}

const bytes = view => Buffer.from(view.buffer, view.byteOffset, view.byteLength);
function pad(buffer, fill) {
  const extra = (4 - buffer.length % 4) % 4;
  return extra ? Buffer.concat([buffer, Buffer.alloc(extra, fill)]) : buffer;
}
export function buildRefineryDressingGlb(target) {
  if (!REFINERY_DRESSING_TARGETS.some(item => item.family === target?.family && item.relativePath === target.relativePath))
    throw new Error('Unknown P28-F4 dressing target');
  const { geometries, nodes } = dressingDefinition(target.family);
  // The art builder is deterministic even across Node and the standalone authoring
  // runtime: floating-point libm implementations can differ by one Float32 ULP
  // on a machined cylinder's sin/cos vertices. Snap below visible precision so
  // exact shipped GLBs always reproduce from this canonical authoring source.
  for (const { geometry } of geometries) {
    for (const name of ['positions', 'normals', 'tangents', 'uvs']) {
      const values = geometry[name];
      for (let index = 0; index < values.length; index += 1) {
        const snapped = Math.round(values[index] * 100_000) / 100_000;
        values[index] = snapped === 0 ? 0 : snapped;
      }
    }
    geometry.min = [0, 1, 2].map(axis => Math.min(...Array.from({ length: geometry.positions.length / 3 }, (_, index) => geometry.positions[index * 3 + axis])));
    geometry.max = [0, 1, 2].map(axis => Math.max(...Array.from({ length: geometry.positions.length / 3 }, (_, index) => geometry.positions[index * 3 + axis])));
  }
  const binParts = [], views = [], accessors = [], meshes = [];
  let cursor = 0, triangleCount = 0;
  for (const item of geometries) {
    const geo = item.geometry, attributes = {};
    const parts = [
      ['POSITION', geo.positions, 5126, 'VEC3', 3, 34962],
      ['NORMAL', geo.normals, 5126, 'VEC3', 3, 34962],
      ['TANGENT', geo.tangents, 5126, 'VEC4', 4, 34962],
      ['TEXCOORD_0', geo.uvs, 5126, 'VEC2', 2, 34962],
      ['indices', geo.indices, 5123, 'SCALAR', 1, 34963],
    ];
    let indexAccessor;
    for (const [attribute, data, componentType, type, components, glTarget] of parts) {
      const part = bytes(data);
      const extra = (4 - cursor % 4) % 4;
      if (extra) { binParts.push(Buffer.alloc(extra)); cursor += extra; }
      const viewIndex = views.length;
      views.push({ buffer: 0, byteOffset: cursor, byteLength: part.length, target: glTarget });
      binParts.push(part); cursor += part.length;
      const accessor = { bufferView: viewIndex, componentType, count: data.length / components, type };
      if (attribute === 'POSITION') { accessor.min = geo.min; accessor.max = geo.max; }
      if (attribute === 'indices') {
        accessor.min = [0]; accessor.max = [geo.positions.length / 3 - 1];
      }
      accessors.push(accessor);
      if (attribute === 'indices') indexAccessor = accessors.length - 1;
      else attributes[attribute] = accessors.length - 1;
    }
    triangleCount += geo.indices.length / 3;
    meshes.push({
      name: item.name,
      primitives: [{ attributes, indices: indexAccessor, material: item.material }],
      extras: { ironshadeHardSurfaceFeature: geo.feature },
    });
  }
  const binary = pad(Buffer.concat(binParts), 0);
  const gltfNodes = [...nodes, { name: 'environment-root', children: nodes.map((_, index) => index) }];
  const gltf = {
    asset: { version: '2.0', generator: 'Ironshade Vector P28-F4 authored dressing' },
    scene: 0,
    scenes: [{ name: 'refinery-dressing-' + target.id + '-lod0', nodes: [nodes.length] }],
    nodes: gltfNodes, meshes, materials: surfaceMaterials, accessors, bufferViews: views,
    buffers: [{ byteLength: binary.length }],
    extras: {
      ironshadeP28F4Dressing: {
        family: target.family, collisionDimensionsChanged: false, gameplayCoordinatesChanged: false,
        authoredNodeCount: nodes.length, uniqueGeometryMeshes: geometries.length,
        sourceTriangles: triangleCount, sourceGeometryPath: 'scripts/lib/hard-surface-geometry.mjs',
        locallyPackaged: true, stablePivot: 'environment-root',
      },
    },
  };
  const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, binary]);
}

export async function writeRefineryDressingAssets() {
  const outputs = [];
  for (const target of REFINERY_DRESSING_TARGETS) {
    const file = resolve(process.cwd(), 'public/assets/models', target.relativePath);
    const glb = buildRefineryDressingGlb(target);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, glb);
    outputs.push({ ...target, bytes: glb.length });
  }
  console.log('[graphics] P28-F4 authored refinery dressing ' +
    outputs.map(item => item.family + '=' + item.bytes + 'b').join(' '));
  return outputs;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await writeRefineryDressingAssets();
