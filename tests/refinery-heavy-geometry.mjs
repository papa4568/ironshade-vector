import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { measureGlb } from '../tools/heavy-asset-manifest.mjs';
import { REFINERY_HERO_DETAIL_FAMILIES, createMachinedFlangeGeometry, createRecessedLouverGeometry } from '../scripts/lib/refinery-hero-geometry.mjs';
import { REFINERY_PROCESSOR_LOD0_TARGET, buildRefineryProcessorLod0Glb } from '../scripts/prepare-refinery-processor-lod0.mjs';
import { REFINERY_CONDUIT_GANTRY_LOD0_TARGETS, buildRefineryConduitGantryLod0Glb } from '../scripts/prepare-refinery-conduit-gantry-lod0.mjs';
import { REFINERY_FLOOR_LOD0_TARGETS, buildRefineryFloorLod0Glb } from '../scripts/prepare-refinery-floor-lod0.mjs';
import { REFINERY_WALL_LOD0_TARGETS, buildRefineryWallLod0Glb } from '../scripts/prepare-refinery-wall-lod0.mjs';
import { REFINERY_PIPE_CABLE_LOD0_TARGETS, buildRefineryPipeCableLod0Glb } from '../scripts/prepare-refinery-pipe-cable-lod0.mjs';
import { REFINERY_TERMINAL_LOD0_TARGET, buildRefineryTerminalLod0Glb } from '../scripts/prepare-refinery-terminal-lod0.mjs';
import { REFINERY_CRATE_LOD0_TARGET, buildRefineryCrateLod0Glb } from '../scripts/prepare-refinery-crate-lod0.mjs';

function parseGlb(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

function assertGeometry(geom) {
  const vertices = geom.positions.length / 3;
  assert(vertices > 150, geom.feature + ': real geometry required');
  assert.equal(geom.normals.length, vertices * 3);
  assert.equal(geom.tangents.length, vertices * 4);
  assert.equal(geom.uvs.length, vertices * 2);
  assert.equal(geom.indices.length % 3, 0);
  const allNormals = [];
  for (let i = 0; i < vertices; i++) {
    const normal = [...geom.normals.slice(i * 3, i * 3 + 3)];
    const tangent = [...geom.tangents.slice(i * 4, i * 4 + 3)];
    assert(Math.abs(Math.hypot(...normal) - 1) < 1e-5, geom.feature + ': unit normal');
    assert(Math.abs(Math.hypot(...tangent) - 1) < 1e-5, geom.feature + ': unit tangent');
    assert(Math.abs(normal.reduce((sum, n, j) => sum + n * tangent[j], 0)) < 1e-5, geom.feature + ': tangent orthogonality');
    if (i % 17 === 0) allNormals.push(normal);
  }
  assert(allNormals.length >= 10);
}
const ring = createMachinedFlangeGeometry({ outerRadius: .24, innerRadius: .17, height: .12 });
const grille = createRecessedLouverGeometry({ width: .65, height: .6, depth: .05 });
assertGeometry(ring);
assertGeometry(grille);
assert(ring.min[0] < -.23 && ring.max[0] > .23, 'machined flange must retain true outer silhouette');
assert(grille.min[2] < 0 && grille.max[2] > 0, 'louver assembly must carry physical depth');
assert(ring.positions.length / 3 > 2500, 'machined annulus profile unexpectedly collapsed');
assert(grille.positions.length / 3 > 1400, 'vent opening geometry unexpectedly collapsed');

const families = [
  [REFINERY_PROCESSOR_LOD0_TARGET, buildRefineryProcessorLod0Glb],
  ...REFINERY_CONDUIT_GANTRY_LOD0_TARGETS.map(target => [target, buildRefineryConduitGantryLod0Glb]),
  ...REFINERY_FLOOR_LOD0_TARGETS.map(target => [target, buildRefineryFloorLod0Glb]),
  ...REFINERY_WALL_LOD0_TARGETS.map(target => [target, buildRefineryWallLod0Glb]),
  ...REFINERY_PIPE_CABLE_LOD0_TARGETS.map(target => [target, buildRefineryPipeCableLod0Glb]),
  [REFINERY_TERMINAL_LOD0_TARGET, buildRefineryTerminalLod0Glb],
  [REFINERY_CRATE_LOD0_TARGET, buildRefineryCrateLod0Glb],
];
assert.deepEqual(new Set(families.map(([target]) => target.family)), new Set(REFINERY_HERO_DETAIL_FAMILIES), 'P28-F2 must populate every currently shipped refinery hero LOD0 family');
let totalBytes = 0, totalTriangles = 0, totalVertices = 0;
for (const [target, build] of families) {
  const built = build(target);
  const disk = await readFile(resolve(process.cwd(), 'public/assets/models', target.relativePath));
  // P28-B6 owns the final route-decal augmentation for floor/wall. That
  // pipeline regenerates the authored base LOD0 first, then appends one live
  // atlas-bound card mesh. Requiring byte equality with the unlayered source
  // would incorrectly reject the very route markings that must ship.
  if (['floor', 'floorGrate', 'bulkhead', 'wallPanel'].includes(target.family)) {
    const authored = parseGlb(built);
    const shipped = parseGlb(disk);
    assert.equal(shipped.extras?.ironshadeP28B6RouteDecals?.version, 1, target.family + ': shipped route atlas layer is missing');
    assert.deepEqual(shipped.meshes.slice(0, authored.meshes.length), authored.meshes, target.family + ': base authored meshes were mutated by route-atlas layering');
    assert.deepEqual(shipped.nodes.slice(0, authored.nodes.length - 1), authored.nodes.slice(0, -1), target.family + ': authored mechanical node transforms changed during decal layering');
    const binary = source => {
      const start = 20 + source.readUInt32LE(12);
      const size = source.readUInt32LE(start);
      return source.subarray(start + 8, start + 8 + size);
    };
    const baseBytes = binary(built);
    assert(binary(disk).subarray(0, baseBytes.length).equals(baseBytes), target.family + ': route atlas overlay replaced real mechanical source buffers');
  } else {
    assert(built.equals(disk), target.family + ': deterministic shipped geometry differs from build output');
  }
  assert(built.length >= 170_000, target.family + ': LOD0 must ship substantial real mesh payload, not legacy cube assembly');
  const gltf = parseGlb(built);
  const measured = measureGlb(built, target.relativePath);
  const newMeshes = (gltf.meshes ?? []).filter(mesh => mesh.name?.includes('-p28f2-'));
  const newNodes = (gltf.nodes ?? []).filter(node => node.name?.includes('-p28f2-'));
  assert.equal(newMeshes.length, 2, target.family + ': missing authored annular or vent mesh');
  assert(newNodes.length >= 3, target.family + ': detailed meshes not placed in the live scene graph');
  const features = new Set(newMeshes.map(mesh => mesh.extras?.ironshadeHardSurfaceFeature));
  assert.deepEqual(features, new Set(['machined-open-flange', 'open-machined-louver']), target.family + ': missing true open-bore or vent geometry');
  assert(measured.vertices > 3500 && measured.triangles > 1100, target.family + ': actual source geometry is not materially dense');
  assert.equal(measured.unusedBufferViewBytes, 0, target.family + ': unreferenced binary padding detected');
  assert(!measured.legacyCube, target.family + ': cannot count cube-derived placeholder mesh');
  for (const node of newNodes) {
    assert(Number.isInteger(node.mesh) && node.mesh >= 0 && node.mesh < gltf.meshes.length, target.family + ': live node must bind actual mesh');
    assert.equal(node.translation.length, 3);
  }
  const usedNewMeshes = new Set(newNodes.map(node => node.mesh));
  for (const mesh of newMeshes) assert(usedNewMeshes.has(gltf.meshes.indexOf(mesh)), target.family + ': dead mesh not permitted');
  totalBytes += built.length;
  totalVertices += measured.vertices;
  totalTriangles += measured.triangles;
  console.log(`P28_F2_FAMILY family=${target.family} bytes=${built.length} vertices=${measured.vertices} triangles=${measured.triangles} nodes=${newNodes.length}`);
}
assert(totalBytes > 2_000_000 && totalTriangles > 18_000, 'refinery LOD0 art pack must contain substantial used authored mesh data');
console.log(`P28_F2_HERO_GEOMETRY_PASS families=${families.length} bytes=${totalBytes} vertices=${totalVertices} triangles=${totalTriangles} anchors=preserved recovery=lod1+lod2`);
