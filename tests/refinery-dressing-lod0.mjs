import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { measureGlb } from '../tools/heavy-asset-manifest.mjs';
import { REFINERY_DRESSING_TARGETS, buildRefineryDressingGlb } from '../tools/prepare-refinery-dressing-lod0.mjs';

assert.equal(REFINERY_DRESSING_TARGETS.length, 8, 'P28-F4 needs eight separate authored silhouettes');
const allHashes = new Set();
const features = new Set();
let totalTriangles = 0;
for (const target of REFINERY_DRESSING_TARGETS) {
  const buffer = buildRefineryDressingGlb(target);
  assert.deepEqual(buffer, buildRefineryDressingGlb(target), target.family + ' must generate deterministically');
  const file = await readFile(resolve('public/assets/models', target.relativePath));
  assert.deepEqual(file, buffer, target.family + ' shipped art must be freshly derived from source');
  const measurement = measureGlb(file, target.id);
  const gltf = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8').trim());
  assert.equal(gltf.extras.ironshadeP28F4Dressing.collisionDimensionsChanged, false);
  assert.equal(gltf.extras.ironshadeP28F4Dressing.gameplayCoordinatesChanged, false);
  assert(measurement.triangles > 100, target.family + ' must use genuine geometry rather than a placeholder box');
  assert(!measurement.legacyCube, target.family + ' is a cube-derived asset');
  assert(measurement.meaningfulBytes > 2_000, target.family + ' has too little authored geometry payload');
  assert(gltf.materials.length >= 4, target.family + ' has incomplete PBR material slots');
  assert(gltf.nodes.length > 4, target.family + ' is missing authored components');
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      for (const attr of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0'])
        assert(Number.isInteger(primitive.attributes[attr]), target.family + ' missing ' + attr);
    }
    features.add(mesh.extras?.ironshadeHardSurfaceFeature);
  }
  allHashes.add(createHash('sha256').update(file).digest('hex'));
  totalTriangles += measurement.triangles;
}
assert.equal(allHashes.size, REFINERY_DRESSING_TARGETS.length, 'dressing families must not duplicate mesh payloads');
for (const required of ['cylinder-pipe', 'machined-open-flange', 'inset-panel', 'chamfered-solid', 'open-machined-louver'])
  assert(features.has(required), 'missing distinctive industrial silhouette geometry ' + required);

const registry = await readFile('src/game/graphicsAssetManifest.ts', 'utf8');
const renderer = await readFile('src/game/babylonCombatRenderer.ts', 'utf8');
const generator = await readFile('tools/prepare-refinery-dressing-lod0.mjs', 'utf8');
assert(generator.includes('await writeRefineryDressingAssets()'), 'authored art must be reproducible from its source generator');
for (const target of REFINERY_DRESSING_TARGETS) {
  assert(registry.includes("'/assets/models/" + target.relativePath + "'"), 'art missing runtime manifest: ' + target.family);
  assert(renderer.includes(target.family + ': ['), 'family missing from deterministic placement map: ' + target.family);
}

const leftDressingZ = [], rightDressingZ = [];
for (const target of REFINERY_DRESSING_TARGETS) {
  const match = renderer.match(new RegExp('^    ' + target.family + ': \\[\\n([\\s\\S]*?)^    \\],', 'm'));
  assert(match, target.family + ' is missing a deterministic placement group');
  const locations = [...match[1].matchAll(/x: width \* (0\.\d+), z: height \* (0\.\d+)/g)];
  assert.equal(locations.length, 2, target.family + ' must ship two visible wall-side instances');
  for (const location of locations) {
    const x = Number(location[1]), z = Number(location[2]);
    assert(z >= 0.10 && z <= 0.90, target.family + ' dressing must stay inside the peripheral route');
    if (x === 0.055) leftDressingZ.push(z);
    else if (x === 0.945) rightDressingZ.push(z);
    else assert.fail(target.family + ' must not obstruct center combat paths');
  }
}
for (const [wall, positions] of [['left', leftDressingZ], ['right', rightDressingZ]]) {
  assert.equal(positions.length, 8, wall + ' wall must contain eight distinct dressing families');
  positions.sort((a, b) => a - b);
  for (let index = 1; index < positions.length; index++) {
    assert(positions[index] - positions[index - 1] >= 0.09,
      wall + ' wall dressing silhouettes overlap: ' + positions[index - 1] + '/' + positions[index]);
  }
}

assert(renderer.includes('this.applyRefineryDressingSurfaces(instance)'), 'dressing must bind local premium PBR maps');
assert(renderer.includes('mesh.isPickable = false'), 'dressing must remain non-interactive');
assert(renderer.includes('this.refineryAssetInstances.push(...mountedInstances)'), 'dressing must release with existing environment owner');
assert(renderer.includes('this.canvas.dataset.refineryDressingInstances'), 'dressing instance telemetry missing');
assert(renderer.includes('void this.loadRefineryDressing(placements, dressingSelected, generation)'), 'secondary prop loading must not block the mandatory field');
assert(renderer.includes("this.canvas.dataset.refineryDressingState = 'waiting-for-gameplay'") &&
  renderer.includes("data.babylonPlayerState === 'ready'") &&
  renderer.includes("data.babylonEnemyState === 'ready'") &&
  renderer.includes("data.babylonWorldState === 'ready'"),
  'optional prop decoding must yield first priority to authored gameplay systems');
assert(renderer.includes('await new Promise<void>(resolve => setTimeout(resolve, 16))'),
  'decorative placement instantiation must cooperate with initial input and rendering tasks');
assert(renderer.includes('root.parent = this.refineryMountRoot') && renderer.includes("this.canvas.dataset.refineryDressingState = 'ready'"), 'secondary props must mount atomically under the existing disposal owner');
assert(renderer.includes("this.canvas.dataset.refineryDressingState = 'error'"), 'prop failures must remain isolated from combat readiness');
assert(renderer.includes('loadRoot.setEnabled(true)'), 'dressing must obey existing atomic world readiness');
assert(!renderer.includes('state.objects.push('), 'dressing may not mutate collision/simulation data');
console.log('P28_F4_REFINERY_DRESSING_PASS families=8 distinctMeshes=8 triangles=' + totalTriangles);
