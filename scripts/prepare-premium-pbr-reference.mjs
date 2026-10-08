import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PREMIUM_PBR_REFERENCE_RELATIVE_PATH = 'environments/refinery-wall-service-panel-pbr-reference-lod0.glb';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(buffer) {
  let a = 1;
  let b = 0;
  for (const value of buffer) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function encodeStoredZlib(buffer) {
  if (buffer.length > 0xffff) throw new Error(`Stored zlib payload is too large: ${buffer.length}`);
  const blockHeader = Buffer.alloc(5);
  blockHeader[0] = 0x01;
  blockHeader.writeUInt16LE(buffer.length, 1);
  blockHeader.writeUInt16LE((~buffer.length) & 0xffff, 3);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler32(buffer), 0);
  return Buffer.concat([Buffer.from([0x78, 0x01]), blockHeader, buffer, checksum]);
}

function pngChunk(type, payload = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, payload])), 0);
  return Buffer.concat([length, typeBytes, payload, checksum]);
}

function encodeRgbaPng(width, height, pixels) {
  if (pixels.length !== width * height * 4) throw new Error(`RGBA payload mismatch: ${pixels.length} !== ${width * height * 4}`);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(scanlines, rowOffset + 1);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', encodeStoredZlib(scanlines)),
    pngChunk('IEND'),
  ]);
}

function texturePixels(kind) {
  const pixels = new Uint8Array(4 * 4 * 4);
  const write = (x, y, rgba) => pixels.set(rgba, (y * 4 + x) * 4);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const checker = (x + y) % 2 === 0;
      if (kind === 'base-color') write(x, y, checker ? [58, 67, 70, 255] : [91, 102, 101, 255]);
      else if (kind === 'normal') write(x, y, [x === 0 ? 118 : x === 3 ? 138 : 128, y === 0 ? 118 : y === 3 ? 138 : 128, 253, 255]);
      else if (kind === 'orm') write(x, y, checker ? [222, 92, 226, 255] : [174, 154, 188, 255]);
      else if (kind === 'emissive') write(x, y, x === 1 || x === 2 ? (y === 3 ? [255, 118, 36, 255] : [30, 188, 232, 255]) : [0, 2, 3, 255]);
      else throw new Error(`Unknown texture kind: ${kind}`);
    }
  }
  return pixels;
}

function makePanelGeometry() {
  const x = 0.70;
  const y = 0.55;
  const z = 0.08;
  const faces = [
    { n: [0, 0, 1], t: [1, 0, 0, 1], p: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]] },
    { n: [0, 0, -1], t: [-1, 0, 0, 1], p: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]] },
    { n: [1, 0, 0], t: [0, 0, -1, 1], p: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]] },
    { n: [-1, 0, 0], t: [0, 0, 1, 1], p: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]] },
    { n: [0, 1, 0], t: [1, 0, 0, 1], p: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]] },
    { n: [0, -1, 0], t: [1, 0, 0, 1], p: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]] },
  ];
  const positions = [];
  const normals = [];
  const tangents = [];
  const uvs = [];
  const indices = [];
  const faceUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const face of faces) {
    const base = positions.length / 3;
    for (let i = 0; i < 4; i += 1) {
      positions.push(...face.p[i]);
      normals.push(...face.n);
      tangents.push(...face.t);
      uvs.push(...faceUvs[i]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    tangents: new Float32Array(tangents),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    min: [-x, -y, -z],
    max: [x, y, z],
  };
}

function viewBytes(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function align(value, multiple = 4) {
  return Math.ceil(value / multiple) * multiple;
}

function packBinary(parts) {
  const packed = [];
  const views = [];
  let cursor = 0;
  for (const part of parts) {
    const aligned = align(cursor, part.alignment ?? 4);
    if (aligned > cursor) packed.push(Buffer.alloc(aligned - cursor));
    views.push({ buffer: 0, byteOffset: aligned, byteLength: part.data.length, ...(part.target ? { target: part.target } : {}) });
    packed.push(part.data);
    cursor = aligned + part.data.length;
  }
  const total = align(cursor, 4);
  if (total > cursor) packed.push(Buffer.alloc(total - cursor));
  return { buffer: Buffer.concat(packed), views };
}

function encodeGlb(gltf, binary) {
  const jsonBytes = Buffer.from(JSON.stringify(gltf), 'utf8');
  const json = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4)]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, bin]);
}

export function buildPremiumPbrReferenceGlb() {
  const geometry = makePanelGeometry();
  const textures = [
    { name: 'premium-base-color', data: encodeRgbaPng(4, 4, texturePixels('base-color')) },
    { name: 'premium-normal', data: encodeRgbaPng(4, 4, texturePixels('normal')) },
    { name: 'premium-orm', data: encodeRgbaPng(4, 4, texturePixels('orm')) },
    { name: 'premium-emissive', data: encodeRgbaPng(4, 4, texturePixels('emissive')) },
  ];
  const { buffer, views } = packBinary([
    { data: viewBytes(geometry.positions), target: 34962 },
    { data: viewBytes(geometry.normals), target: 34962 },
    { data: viewBytes(geometry.tangents), target: 34962 },
    { data: viewBytes(geometry.uvs), target: 34962 },
    { data: viewBytes(geometry.indices), target: 34963 },
    ...textures.map(texture => ({ data: texture.data })),
  ]);
  const gltf = {
    asset: { version: '2.0', generator: 'Ironshade Vector deterministic premium PBR reference generator' },
    scene: 0,
    scenes: [{ name: 'premium-pbr-reference', nodes: [1] }],
    nodes: [
      { name: 'refinery-wall-service-panel-shell', mesh: 0 },
      { name: 'environment-root', children: [0] },
    ],
    meshes: [{
      name: 'premium-pbr-reference-panel',
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 },
        indices: 4,
        material: 0,
      }],
    }],
    materials: [{
      name: 'premium-pbr-reference',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        baseColorTexture: { index: 0, texCoord: 0 },
        metallicFactor: 1,
        roughnessFactor: 1,
        metallicRoughnessTexture: { index: 2, texCoord: 0 },
      },
      normalTexture: { index: 1, texCoord: 0, scale: 1 },
      occlusionTexture: { index: 2, texCoord: 0, strength: 1 },
      emissiveTexture: { index: 3, texCoord: 0 },
      emissiveFactor: [0.55, 0.9, 1],
    }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    textures: textures.map((_, source) => ({ sampler: 0, source })),
    images: textures.map((texture, index) => ({ name: texture.name, bufferView: 5 + index, mimeType: 'image/png' })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: geometry.min, max: geometry.max },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 24, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: 24, type: 'VEC2' },
      { bufferView: 4, componentType: 5123, count: 36, type: 'SCALAR', min: [0], max: [23] },
    ],
    bufferViews: views,
    buffers: [{ byteLength: buffer.length }],
    extras: {
      ironshadePremiumPbrReference: {
        uvSet: 'TEXCOORD_0',
        tangentSpace: true,
        textureChannels: ['baseColor', 'normal', 'orm', 'emissive'],
        ormPacking: { occlusion: 'R', roughness: 'G', metallic: 'B' },
        ktx2RuntimeCompatible: true,
      },
    },
  };
  return encodeGlb(gltf, buffer);
}

export async function writePremiumPbrReference() {
  const outputPath = resolve(process.cwd(), 'public/assets/models', PREMIUM_PBR_REFERENCE_RELATIVE_PATH);
  const glb = buildPremiumPbrReferenceGlb();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, glb);
  console.log(`[graphics] wrote ${PREMIUM_PBR_REFERENCE_RELATIVE_PATH} (${glb.length} bytes)`);
  return { outputPath, bytes: glb.length };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  await writePremiumPbrReference();
  const { writePremiumCharacterSourceReference } = await import('./prepare-premium-character-source.mjs');
  await writePremiumCharacterSourceReference();
  const { writeVanguardOperatorLod0 } = await import('./prepare-vanguard-operator-lod0.mjs');
  await writeVanguardOperatorLod0();
  const { writePremiumPbrSurfaceLibrary } = await import('./prepare-premium-pbr-library.mjs');
  await writePremiumPbrSurfaceLibrary();
}