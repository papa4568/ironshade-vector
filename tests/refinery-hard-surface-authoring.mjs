import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  HARD_SURFACE_REFERENCE_FEATURES,
  createChamferedBoxGeometry,
  createCylinderGeometry,
  createInsetPanelGeometry,
  createWedgeGeometry,
} from '../scripts/lib/hard-surface-geometry.mjs';
import {
  REFINERY_HARD_SURFACE_REFERENCE_RELATIVE_PATH,
  buildRefineryHardSurfaceReferenceGlb,
} from '../scripts/prepare-refinery-hard-surface-reference.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer, label) {
  assert(buffer.length >= 28, `${label}: GLB too small`);
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${label}: invalid GLB magic`);
  assert(buffer.readUInt32LE(4) === 2, `${label}: expected glTF 2.0`);
  assert(buffer.readUInt32LE(8) === buffer.length, `${label}: byte length mismatch`);
  const jsonLength = buffer.readUInt32LE(12);
  assert(buffer.readUInt32LE(16) === 0x4e4f534a, `${label}: missing JSON chunk`);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
  const binHeader = 20 + jsonLength;
  assert(buffer.readUInt32LE(binHeader + 4) === 0x004e4942, `${label}: missing BIN chunk`);
  const binLength = buffer.readUInt32LE(binHeader);
  const binary = buffer.subarray(binHeader + 8, binHeader + 8 + binLength);
  return { json, binary };
}

function componentCount(type) {
  return type === 'VEC4' ? 4 : type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1;
}

function readAccessor(json, binary, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  assert(accessor, `missing accessor ${accessorIndex}`);
  const view = json.bufferViews?.[accessor.bufferView];
  assert(view, `accessor ${accessorIndex} is missing bufferView`);
  const count = accessor.count * componentCount(accessor.type);
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  if (accessor.componentType === 5126) return new Float32Array(binary.buffer, binary.byteOffset + offset, count);
  if (accessor.componentType === 5123) return new Uint16Array(binary.buffer, binary.byteOffset + offset, count);
  throw new Error(`unsupported componentType ${accessor.componentType}`);
}

function validateGeometry(geometry) {
  const vertices = geometry.positions.length / 3;
  assert(vertices >= 24, `${geometry.feature}: geometry payload is unexpectedly sparse`);
  assert(geometry.normals.length === vertices * 3, `${geometry.feature}: normal count mismatch`);
  assert(geometry.tangents.length === vertices * 4, `${geometry.feature}: tangent count mismatch`);
  assert(geometry.uvs.length === vertices * 2, `${geometry.feature}: UV0 count mismatch`);
  assert(geometry.indices.length % 3 === 0, `${geometry.feature}: triangle index count must be divisible by 3`);
  for (let vertex = 0; vertex < vertices; vertex += 1) {
    const n = geometry.normals.subarray(vertex * 3, vertex * 3 + 3);
    const t = geometry.tangents.subarray(vertex * 4, vertex * 4 + 3);
    const normalLength = Math.hypot(...n);
    const tangentLength = Math.hypot(...t);
    const orthogonality = Math.abs(n[0] * t[0] + n[1] * t[1] + n[2] * t[2]);
    assert(Math.abs(normalLength - 1) < 1e-5, `${geometry.feature}: normal ${vertex} is not unit length`);
    assert(Math.abs(tangentLength - 1) < 1e-5, `${geometry.feature}: tangent ${vertex} is not unit length`);
    assert(orthogonality < 1e-5, `${geometry.feature}: tangent ${vertex} is not orthogonal to its normal`);
  }
}

const sourceGeometries = [
  createChamferedBoxGeometry(),
  createCylinderGeometry(),
  createWedgeGeometry(),
  createInsetPanelGeometry(),
];
assert(JSON.stringify(sourceGeometries.map(geometry => geometry.feature)) === JSON.stringify(HARD_SURFACE_REFERENCE_FEATURES), 'P28-C0 reusable feature registry changed');
for (const geometry of sourceGeometries) validateGeometry(geometry);
assert(sourceGeometries[0].positions.some((value, index) => index % 3 === 0 && Math.abs(Math.abs(value) - 1.3) < 1e-5), 'Chamfered solid lost its outer silhouette');
assert(sourceGeometries[1].positions.length / 3 >= 180, 'Cylinder/pipe support lost rounded segment density');
assert(sourceGeometries[2].normals.some((value, index) => index % 3 === 1 && Math.abs(value) > 0.2 && Math.abs(value) < 0.95), 'Wedge support lost its non-orthogonal sloped normal');
assert(sourceGeometries[3].min[2] < 0 && sourceGeometries[3].max[2] > 0, 'Inset panel support lost front/back depth');

const outputPath = resolve(process.cwd(), 'public/assets/models', REFINERY_HARD_SURFACE_REFERENCE_RELATIVE_PATH);
const disk = await readFile(outputPath);
const rebuilt = buildRefineryHardSurfaceReferenceGlb();
assert(disk.equals(rebuilt), 'P28-C0 hard-surface reference is not deterministic across rebuilds');
const { json, binary } = parseGlb(disk, REFINERY_HARD_SURFACE_REFERENCE_RELATIVE_PATH);
const marker = json.extras?.ironshadeP28C0HardSurfaceGeometry;
assert(marker?.version === 1 && marker?.lodTier === 0 && marker?.deterministic === true, 'P28-C0 reference metadata is missing');
assert(marker?.stablePivot === 'environment-root', 'P28-C0 stable environment pivot contract changed');
assert(JSON.stringify(marker?.geometryFeatures) === JSON.stringify(HARD_SURFACE_REFERENCE_FEATURES), 'P28-C0 reference feature telemetry is incomplete');
assert((json.meshes?.length ?? 0) === 4, `P28-C0 reference expected four reusable geometry meshes; got ${json.meshes?.length ?? 0}`);
assert((json.materials?.length ?? 0) === 4, `P28-C0 reference expected four material slots; got ${json.materials?.length ?? 0}`);
const materialNames = json.materials.map(material => material.name);
assert(JSON.stringify(materialNames) === JSON.stringify(marker.materialSlots), 'P28-C0 material slot mapping changed');
const root = json.nodes?.find(node => node.name === 'environment-root');
assert(root && !root.translation && !root.rotation && !root.scale, 'P28-C0 environment-root must remain an identity pivot');
const core = json.nodes?.find(node => node.name === 'refinery-processor-core');
assert(core?.mesh === 0 && !core.translation && !core.rotation && !core.scale, 'P28-C0 reference core must remain grounded on the identity pivot');

for (let meshIndex = 0; meshIndex < json.meshes.length; meshIndex += 1) {
  const mesh = json.meshes[meshIndex];
  const primitive = mesh.primitives?.[0];
  const expectedFeature = HARD_SURFACE_REFERENCE_FEATURES[meshIndex];
  assert(mesh.extras?.ironshadeHardSurfaceFeature === expectedFeature, `${mesh.name}: hard-surface feature marker changed`);
  assert(Number.isInteger(primitive?.attributes?.POSITION), `${mesh.name}: POSITION missing`);
  assert(Number.isInteger(primitive?.attributes?.NORMAL), `${mesh.name}: NORMAL missing`);
  assert(Number.isInteger(primitive?.attributes?.TANGENT), `${mesh.name}: TANGENT missing`);
  assert(Number.isInteger(primitive?.attributes?.TEXCOORD_0), `${mesh.name}: TEXCOORD_0 missing`);
  assert(Number.isInteger(primitive?.indices), `${mesh.name}: indices missing`);
  assert(primitive.material === meshIndex, `${mesh.name}: material mapping changed`);
  const positions = readAccessor(json, binary, primitive.attributes.POSITION);
  const normals = readAccessor(json, binary, primitive.attributes.NORMAL);
  const tangents = readAccessor(json, binary, primitive.attributes.TANGENT);
  const uvs = readAccessor(json, binary, primitive.attributes.TEXCOORD_0);
  assert(positions.length / 3 >= 24, `${mesh.name}: generated reference geometry payload is unexpectedly sparse`);
  assert(normals.length === positions.length, `${mesh.name}: generated normal payload mismatch`);
  assert(tangents.length / 4 === positions.length / 3, `${mesh.name}: generated tangent payload mismatch`);
  assert(uvs.length / 2 === positions.length / 3, `${mesh.name}: generated UV0 payload mismatch`);
}

const bodyBounds = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
assert(Math.abs(bodyBounds.min[1]) < 1e-6 && Math.abs(bodyBounds.max[1] - 0.5) < 1e-6, 'P28-C0 reference core no longer rests on the authored ground pivot');
assert(bodyBounds.min[0] < -1.2 && bodyBounds.max[0] > 1.2 && bodyBounds.min[2] < -0.8 && bodyBounds.max[2] > 0.8, 'P28-C0 reference core bounds changed unexpectedly');

console.log(`REFINERY_HARD_SURFACE_AUTHORING_PASS path=${REFINERY_HARD_SURFACE_REFERENCE_RELATIVE_PATH} features=${HARD_SURFACE_REFERENCE_FEATURES.join('+')} meshes=${json.meshes.length} materials=${json.materials.length} bytes=${disk.length}`);
