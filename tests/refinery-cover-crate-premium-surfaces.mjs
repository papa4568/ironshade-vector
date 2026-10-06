import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_PREMIUM_SURFACE_TARGETS,
  upgradeRefineryPremiumSurfaceGlb,
} from '../scripts/prepare-refinery-premium-surfaces.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer, label) {
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${label}: invalid GLB magic`);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

const crateTargets = REFINERY_PREMIUM_SURFACE_TARGETS.filter(target => target.family === 'crate');
assert(crateTargets.length === 2, `Expected two crate premium-surface targets, got ${crateTargets.length}`);
for (const target of crateTargets) {
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const gltf = parseGlb(bytes, target.relativePath);
  assert(bytes.equals(upgradeRefineryPremiumSurfaceGlb(bytes, target)), `${target.relativePath}: upgrade is not deterministic/idempotent`);
  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.family === 'crate', `${target.relativePath}: premium geometry marker is missing`);
  assert(gltf.extras?.ironshadeP28B2SurfaceGeometry?.gameplayBoundsChanged === false, `${target.relativePath}: gameplay bounds must remain unchanged`);
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      assert(primitive.attributes?.TANGENT === 2, `${target.relativePath}: TANGENT is missing`);
      assert(primitive.attributes?.TEXCOORD_0 === 3, `${target.relativePath}: TEXCOORD_0 is missing`);
    }
  }
  const shell = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-shell');
  const band = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-band');
  const marker = (gltf.nodes ?? []).find(node => node.name === 'refinery-crate-marker');
  assert(JSON.stringify(shell?.scale) === JSON.stringify([1.05, 0.84, 0.82]), `${target.relativePath}: shell scale changed`);
  assert(JSON.stringify(band?.scale) === JSON.stringify([0.12, 0.90, 0.90]), `${target.relativePath}: band scale changed`);
  assert(marker?.mesh === 2, `${target.relativePath}: marker must retain the authored third material slot`);
}

const renderer = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const world = await readFile(resolve(process.cwd(), 'src/game/babylonWorldPresentation.ts'), 'utf8');
const verifier = await readFile(resolve(process.cwd(), 'scripts/verify-authored-refinery.mjs'), 'utf8');
const telemetry = 'crate:bare-metal+painted-metal+polymer-rubber';
assert(renderer.includes("'refinery-hazard-emissive': 'polymer-rubber'"), 'Crate marker slot is not bound to polymer/rubber');
assert(renderer.includes(telemetry), 'Crate premium-surface telemetry is missing');
for (const surface of ['painted-metal', 'bare-metal', 'polymer-rubber']) {
  assert(world.includes(`surfaces.get('${surface}')`), `Premium refinery cover does not use ${surface}`);
}
assert(world.includes("mission.location === 'asteroid-refinery'"), 'Premium cover treatment is not scoped to the refinery');
assert(world.includes('coverVisibility'), 'Cover readability transparency contract was not preserved');
assert(world.includes('Math.max(0.15, scaled(object.w))') && world.includes('Math.max(0.15, scaled(object.h))'), 'Cover simulation footprint sizing changed');
assert(verifier.includes('canvas.dataset.babylonCoverPremiumSurfaces'), 'Live verifier does not inspect premium cover surfaces');
assert(verifier.includes('lastState.coverPremiumCount < 1'), 'Live verifier does not require a rendered premium cover');

console.log('REFINERY_COVER_CRATE_PREMIUM_SURFACES_PASS crate-lods=2 cover=painted-metal+bare-metal+polymer-rubber bounds=simulation-owned');
