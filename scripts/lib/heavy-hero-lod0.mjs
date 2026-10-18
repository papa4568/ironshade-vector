import { deflateSync } from 'node:zlib';
import { createMachinedFlangeGeometry, createRecessedLouverGeometry } from './refinery-hero-geometry.mjs';

// P28-F3: authored, visible, rig-owned mesh and material payload.
// The simulation owns bounds, hits, phase timing and the weapon socket.
const FAMILIES = Object.freeze({
  vanguard:   { seed: 17, plate: [91, 114, 123], glow: [246, 113, 38], ring: [0.19, 0.115, 0.066, 60], vent: [0.34, 0.26, 0.046, 11], mount: 'torso', badge: 'backpack' },
  vector:     { seed: 31, plate: [72, 99, 136], glow: [80, 207, 255], ring: [0.125, 0.071, 0.048, 64], vent: [0.20, 0.38, 0.035, 13], mount: 'backpack', badge: 'helmet' },
  systems:    { seed: 47, plate: [92, 127, 98], glow: [55, 234, 131], ring: [0.115, 0.064, 0.045, 68], vent: [0.30, 0.25, 0.040, 15], mount: 'backpack', badge: 'torso' },
  assault:    { seed: 59, plate: [125, 73, 62], glow: [255, 106, 64], ring: [0.155, 0.085, 0.056, 72], vent: [0.31, 0.24, 0.044, 12], mount: 'torso', badge: 'arm-left' },
  suppressor: { seed: 71, plate: [78, 111, 131], glow: [64, 188, 255], ring: [0.145, 0.073, 0.054, 76], vent: [0.29, 0.37, 0.042, 14], mount: 'backpack', badge: 'arm-left' },
  technician: { seed: 83, plate: [111, 127, 97], glow: [73, 228, 196], ring: [0.104, 0.058, 0.037, 80], vent: [0.26, 0.34, 0.035, 16], mount: 'backpack', badge: 'helmet' },
  elite:      { seed: 97, plate: [109, 75, 102], glow: [246, 77, 135], ring: [0.21, 0.132, 0.079, 84], vent: [0.40, 0.34, 0.055, 17], mount: 'torso', badge: 'backpack' },
  boss:       { seed: 109, plate: [139, 91, 64], glow: [255, 96, 45], ring: [0.27, 0.162, 0.100, 96], vent: [0.48, 0.41, 0.063, 19], mount: 'torso', badge: 'backpack' },
});

function requireValid(value, message) {
  if (!value) throw new Error('P28-F3 ' + message);
}
function align4(value) { return (value + 3) & ~3; }
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(name, bytes) {
  const type = Buffer.from(name, 'ascii');
  const header = Buffer.alloc(8);
  header.writeUInt32BE(bytes.length, 0);
  type.copy(header, 4);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, bytes])));
  return Buffer.concat([header, bytes, checksum]);
}
function noise(x, y, seed) {
  let n = (Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) & 255;
}
function clamp8(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function imagePng(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const rgba = pixel(x, y);
      for (let c = 0; c < 4; c++) raw[row + 1 + x * 4 + c] = clamp8(rgba[c]);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
function authoredMaps(family) {
  const { seed, plate, glow } = FAMILIES[family];
  const size = 256;
  const detail = (x, y) => noise(x, y, seed);
  const wear = (x, y) => {
    const seam = x % 64 < 3 || y % 64 < 3;
    const scratch = (x * 7 + seed * 13 + Math.floor(y / 5)) % 113 < 2;
    const milling = ((x * 3 + y + seed) % 17) < 3;
    return { seam, scratch, milling, grain: detail(x, y) - 128 };
  };
  return [
    imagePng(size, (x, y) => {
      const w = wear(x, y);
      const variation = w.grain * 0.22 + (w.milling ? 13 : -3);
      const lift = w.scratch ? 52 : w.seam ? -46 : 0;
      return plate.map((value, c) => value + variation + lift + c * 2).concat(255);
    }),
    imagePng(size, (x, y) => {
      const a = detail(x, y) - 128;
      const b = detail(x + 1, y + 1) - 128;
      const groove = x % 64 < 3 || y % 64 < 3;
      return [128 + a * 0.12 + (groove ? 19 : 0), 128 + b * 0.12 - (groove ? 19 : 0), 251, 255];
    }),
    imagePng(size, (x, y) => {
      const w = wear(x, y);
      return [w.seam ? 166 : clamp8(229 + w.grain * 0.08), w.scratch ? 211 : w.milling ? 107 : 141, w.seam ? 89 : 213, 255];
    }),
    imagePng(size, (x, y) => {
      const bar = (x % 64 >= 25 && x % 64 <= 31 && y % 64 >= 10 && y % 64 <= 52);
      const diode = (Math.floor(x / 16) + 2 * Math.floor(y / 16) + seed) % 23 === 0;
      return (bar || diode) ? [...glow, 255] : [3, 7, 9, 255];
    }),
  ];
}
function parseGlb(buffer) {
  requireValid(Buffer.isBuffer(buffer) && buffer.toString('ascii', 0, 4) === 'glTF' &&
    buffer.readUInt32LE(4) === 2 && buffer.readUInt32LE(8) === buffer.length, 'invalid source GLB');
  let cursor = 12;
  let gltf, binary;
  while (cursor < buffer.length) {
    const length = buffer.readUInt32LE(cursor);
    const type = buffer.readUInt32LE(cursor + 4);
    cursor += 8;
    requireValid(cursor + length <= buffer.length, 'truncated GLB chunk');
    if (type === 0x4e4f534a) gltf = JSON.parse(buffer.subarray(cursor, cursor + length).toString('utf8').trim());
    if (type === 0x004e4942) binary = Buffer.from(buffer.subarray(cursor, cursor + length));
    cursor += length;
  }
  requireValid(gltf && binary && gltf.buffers?.length === 1, 'source must use embedded single buffer');
  return { gltf, binary };
}
function encodeGlb(gltf, binary) {
  const raw = Buffer.from(JSON.stringify(gltf));
  const json = Buffer.concat([raw, Buffer.alloc(align4(raw.length) - raw.length, 0x20)]);
  const bin = Buffer.concat([binary, Buffer.alloc(align4(binary.length) - binary.length)]);
  const output = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
  output.write('glTF');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  json.copy(output, 20);
  const offset = 20 + json.length;
  output.writeUInt32LE(bin.length, offset);
  output.writeUInt32LE(0x004e4942, offset + 4);
  bin.copy(output, offset + 8);
  return output;
}
function floatBytes(values) {
  const data = new Float32Array(values);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
function indexBytes(values) {
  requireValid(values.length && Math.max(...values) < 65536, 'mesh index exceeds Uint16');
  const data = new Uint16Array(values);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
export function upgradeHeroLod0(source, family) {
  const config = FAMILIES[family];
  requireValid(config, 'unknown hero family: ' + family);
  const { gltf, binary: original } = parseGlb(source);
  requireValid(!(gltf.extras?.ironshadeP28F3HeavyHero), 'hero already upgraded');
  const attached = new Map(gltf.nodes.map((node, index) => [node.name, index]));
  for (const anchor of [config.mount, config.badge, 'weapon-socket']) requireValid(attached.has(anchor), family + ': missing preserved rig anchor ' + anchor);
  let cursor = original.length;
  const chunks = [original];
  function view(buffer, target) {
    const padding = align4(cursor) - cursor;
    if (padding) chunks.push(Buffer.alloc(padding));
    cursor += padding;
    const index = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: buffer.length, ...(target ? { target } : {}) });
    chunks.push(buffer);
    cursor += buffer.length;
    return index;
  }
  function accessor(buffer, target, componentType, count, type, min, max) {
    const index = gltf.accessors.length;
    gltf.accessors.push({ bufferView: view(buffer, target), componentType, count, type,
      ...(min ? { min } : {}), ...(max ? { max } : {}) });
    return index;
  }
  const geometry = [
    ['breacher-machined-collar', createMachinedFlangeGeometry({
      outerRadius: config.ring[0], innerRadius: config.ring[1], height: config.ring[2], segments: config.ring[3],
    })],
    ['armored-heat-exchanger', createRecessedLouverGeometry({
      width: config.vent[0], height: config.vent[1], depth: config.vent[2], slats: config.vent[3],
    })],
  ];
  const textures = authoredMaps(family);
  const firstTexture = gltf.textures.length;
  const firstImage = gltf.images.length;
  for (const [i, bytes] of textures.entries()) {
    gltf.images.push({ name: family + '-f3-' + ['albedo', 'normal', 'orm', 'emissive'][i],
      mimeType: 'image/png', bufferView: view(bytes) });
    gltf.textures.push({ source: firstImage + i, sampler: 0 });
  }
  const material = gltf.materials.length;
  gltf.materials.push({
    name: family + '-f3-authored-hardsurface',
    pbrMetallicRoughness: {
      baseColorTexture: { index: firstTexture },
      metallicRoughnessTexture: { index: firstTexture + 2 },
      metallicFactor: 0.78,
      roughnessFactor: 0.46,
    },
    normalTexture: { index: firstTexture + 1, scale: 0.85 },
    occlusionTexture: { index: firstTexture + 2, strength: 0.9 },
    emissiveTexture: { index: firstTexture + 3 },
    emissiveFactor: [0.14, 0.14, 0.14],
    doubleSided: false,
  });
  const meshIds = [];
  for (const [name, shape] of geometry) {
    const count = shape.positions.length / 3;
    requireValid(count >= 1000 && shape.indices.length % 3 === 0, family + ': premium mesh collapsed');
    const attributes = {
      POSITION: accessor(floatBytes(shape.positions), 34962, 5126, count, 'VEC3', shape.min, shape.max),
      NORMAL: accessor(floatBytes(shape.normals), 34962, 5126, count, 'VEC3'),
      TANGENT: accessor(floatBytes(shape.tangents), 34962, 5126, count, 'VEC4'),
      TEXCOORD_0: accessor(floatBytes(shape.uvs), 34962, 5126, count, 'VEC2'),
    };
    const indices = accessor(indexBytes(shape.indices), 34963, 5123, shape.indices.length, 'SCALAR');
    meshIds.push(gltf.meshes.length);
    gltf.meshes.push({ name: family + '-p28f3-' + name, primitives: [{ attributes, indices, material }],
      extras: { triangles: shape.indices.length / 3, vertices: count, ironshadeHeroFeature: shape.feature } });
  }
  const placements = [
    [config.mount, meshIds[0], [0.19, 0.10, 0.0], [1, 1, 1]],
    [config.mount, meshIds[1], [0.29, -0.12, 0.0], [1, 1, 1]],
    [config.badge, meshIds[0], [-0.20, 0.04, 0.18], [0.7, 0.85, 0.7]],
    [config.badge, meshIds[1], [-0.20, 0.04, -0.18], [0.72, 0.86, 0.72]],
  ];
  for (const [i, [anchor, mesh, translation, scale]] of placements.entries()) {
    const parent = attached.get(anchor);
    const id = gltf.nodes.length;
    gltf.nodes.push({ name: family + '-p28f3-detail-' + i, mesh, translation, scale });
    gltf.nodes[parent].children ??= [];
    gltf.nodes[parent].children.push(id);
  }
  const padding = align4(cursor) - cursor;
  if (padding) chunks.push(Buffer.alloc(padding));
  const outputBinary = Buffer.concat(chunks);
  gltf.buffers[0].byteLength = outputBinary.length;
  // Existing D1-D8 contracts are used by the animation/hero regressions.
  // Regenerate their actual totals after attaching new renderable geometry.
  // A stale pre-upgrade count would misrepresent source art contribution.
  const meshTriangles = mesh => (mesh.primitives ?? []).reduce((total, primitive) =>
    total + ((gltf.accessors[primitive.indices]?.count ?? gltf.accessors[primitive.attributes?.POSITION]?.count ?? 0) / 3), 0);
  const sourceTriangles = gltf.meshes.reduce((total, mesh) => total + meshTriangles(mesh), 0);
  const meshNodeTriangles = gltf.nodes.reduce((total, node) =>
    total + (Number.isInteger(node.mesh) ? meshTriangles(gltf.meshes[node.mesh]) : 0), 0);
  for (const contract of Object.values(gltf.extras ?? {})) {
    if (contract && Number.isInteger(contract.sourceTriangles) && Number.isInteger(contract.meshNodeTriangles)) {
      contract.sourceTriangles = sourceTriangles;
      contract.meshNodeTriangles = meshNodeTriangles;
    }
  }
  gltf.extras ??= {};
  gltf.extras.ironshadeP28F3HeavyHero = {
    family, version: 1, lodTier: 0, production: true,
    visualOnly: true, hitboxOwnership: 'simulation', preservedWeaponSocket: 'weapon-socket',
    meshNames: meshIds.map(index => gltf.meshes[index].name),
    authoredTextureDimensions: [256, 256], pbrChannels: ['base-color', 'normal', 'orm', 'emissive'],
    placedNodes: placements.length,
  };
  return encodeGlb(gltf, outputBinary);
}
