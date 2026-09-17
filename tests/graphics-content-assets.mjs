import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const MODEL_ROOT = resolve(process.cwd(), 'public/assets/models');
const CLASS_BUDGETS = {
  operators: { maxBytes: 2_500_000, maxTriangles: 45_000 },
  enemies: { maxBytes: 1_500_000, maxTriangles: 30_000 },
  bosses: { maxBytes: 3_500_000, maxTriangles: 60_000 },
  weapons: { maxBytes: 800_000, maxTriangles: 12_000 },
  environments: { maxBytes: 1_200_000, maxTriangles: 20_000 },
};
const REQUIRED_OPERATOR_CLIPS = ['idle', 'locomotion', 'aim', 'fire', 'reload', 'dodge', 'hit', 'death'];

async function collectGlbs(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectGlbs(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) files.push(path);
  }
  return files.sort();
}

function parseGlb(buffer, label) {
  assert(buffer.byteLength >= 20, `${label}: GLB is too small`);
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${label}: invalid GLB magic`);
  assert(buffer.readUInt32LE(4) === 2, `${label}: GLB version must be 2`);
  assert(buffer.readUInt32LE(8) === buffer.byteLength, `${label}: declared GLB length does not match file length`);

  let offset = 12;
  let json = null;
  while (offset < buffer.byteLength) {
    assert(offset + 8 <= buffer.byteLength, `${label}: truncated GLB chunk header`);
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    assert(offset + length <= buffer.byteLength, `${label}: truncated GLB chunk body`);
    if (type === 0x4e4f534a) {
      const text = buffer.subarray(offset, offset + length).toString('utf8').replace(/[\u0000\u0020]+$/g, '');
      json = JSON.parse(text);
    }
    offset += length;
  }
  assert(json, `${label}: missing JSON chunk`);
  return json;
}

function countTriangles(json, label) {
  const accessors = json.accessors ?? [];
  let triangles = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4;
      assert(mode === 4, `${label}: only TRIANGLES primitives are allowed for authored mobile assets`);
      if (Number.isInteger(primitive.indices)) {
        const accessor = accessors[primitive.indices];
        assert(accessor && Number.isFinite(accessor.count), `${label}: invalid index accessor`);
        triangles += Math.floor(accessor.count / 3);
      } else {
        const positionAccessorIndex = primitive.attributes?.POSITION;
        const accessor = accessors[positionAccessorIndex];
        assert(accessor && Number.isFinite(accessor.count), `${label}: missing POSITION accessor`);
        triangles += Math.floor(accessor.count / 3);
      }
    }
  }
  return triangles;
}

function positionBounds(json, label) {
  const accessors = json.accessors ?? [];
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  let found = false;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const positionAccessorIndex = primitive.attributes?.POSITION;
      const accessor = accessors[positionAccessorIndex];
      if (!accessor?.min || !accessor?.max) continue;
      found = true;
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], accessor.min[axis]);
        max[axis] = Math.max(max[axis], accessor.max[axis]);
      }
    }
  }
  assert(found, `${label}: POSITION min/max bounds are required`);
  return { min, max };
}

function assetClassFor(path) {
  const relativePath = relative(MODEL_ROOT, path).replaceAll('\\', '/');
  const top = relativePath.split('/')[0];
  const budget = CLASS_BUDGETS[top];
  assert(budget, `${relativePath}: unknown authored asset class directory ${top}`);
  return { relativePath, budget, top };
}

const glbs = await collectGlbs(MODEL_ROOT);
assert(glbs.length > 0, 'no authored GLB assets were found under public/assets/models');

const loader = new GLTFLoader();
const reports = [];
for (const path of glbs) {
  const data = await readFile(path);
  const { relativePath, budget, top } = assetClassFor(path);
  const filename = relativePath.split('/').at(-1);
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*-lod[0-2]\.glb$/.test(filename), `${relativePath}: filename must be kebab-case and end in -lod0/1/2.glb`);
  assert(data.byteLength <= budget.maxBytes, `${relativePath}: payload ${data.byteLength} exceeds ${budget.maxBytes} byte budget`);

  const json = parseGlb(data, relativePath);
  const triangles = countTriangles(json, relativePath);
  assert(triangles > 0, `${relativePath}: asset contains no triangles`);
  assert(triangles <= budget.maxTriangles, `${relativePath}: ${triangles} triangles exceeds ${budget.maxTriangles} triangle budget`);
  assert((json.meshes?.length ?? 0) > 0, `${relativePath}: asset contains no meshes`);
  assert((json.materials?.length ?? 0) > 0, `${relativePath}: asset contains no materials`);
  assert((json.buffers?.length ?? 0) === 1, `${relativePath}: runtime GLB should use a single embedded buffer`);

  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const gltf = await loader.parseAsync(arrayBuffer, '');
  assert(gltf.scene, `${relativePath}: GLTFLoader did not produce a scene`);
  const instance = clone(gltf.scene);
  let runtimeMeshes = 0;
  let runtimeSkinnedMeshes = 0;
  instance.traverse(child => {
    if (child.isMesh) runtimeMeshes += 1;
    if (child.isSkinnedMesh) runtimeSkinnedMeshes += 1;
  });
  assert(runtimeMeshes > 0, `${relativePath}: cloned runtime scene contains no meshes`);

  const bounds = positionBounds(json, relativePath);
  if (top === 'operators') {
    const height = bounds.max[1] - bounds.min[1];
    assert(Math.abs(bounds.min[1]) <= 0.02, `${relativePath}: operator feet must rest on authored ground origin; minY=${bounds.min[1]}`);
    assert(height >= 1.5 && height <= 2.6, `${relativePath}: operator height ${height.toFixed(2)}m is outside mobile gameplay scale`);
    assert((json.skins?.length ?? 0) > 0, `${relativePath}: operator must contain an authored skeleton/skin`);
    assert(runtimeSkinnedMeshes > 0, `${relativePath}: runtime clone must contain a SkinnedMesh`);
    const nodeNames = new Set((json.nodes ?? []).map(node => node.name));
    assert(nodeNames.has('weapon-socket'), `${relativePath}: operator must expose a weapon-socket node`);
    const clipNames = new Set((json.animations ?? []).map(animation => animation.name));
    for (const clip of REQUIRED_OPERATOR_CLIPS) {
      assert(clipNames.has(clip), `${relativePath}: missing required operator animation clip ${clip}`);
    }
  }

  reports.push({ relativePath, bytes: data.byteLength, triangles, meshes: runtimeMeshes, skinnedMeshes: runtimeSkinnedMeshes, animations: json.animations?.length ?? 0 });
}

const totalBytes = reports.reduce((sum, report) => sum + report.bytes, 0);
const totalTriangles = reports.reduce((sum, report) => sum + report.triangles, 0);
console.log(`GRAPHICS_CONTENT_PASS assets=${reports.length} bytes=${totalBytes} triangles=${totalTriangles} ${reports.map(report => `${report.relativePath}:${report.triangles}t/${report.skinnedMeshes}s/${report.animations}a`).join(' ')}`);
