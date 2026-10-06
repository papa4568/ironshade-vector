import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS,
  upgradeRefineryPremiumSurfaceGlb,
} from '../scripts/prepare-refinery-premium-surfaces.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseGlb(buffer, label) {
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${label}: invalid GLB magic`);
  assert(buffer.readUInt32LE(4) === 2, `${label}: expected glTF 2.0`);
  assert(buffer.readUInt32LE(8) === buffer.length, `${label}: byte length mismatch`);
  const jsonLength = buffer.readUInt32LE(12);
  assert(buffer.readUInt32LE(16) === 0x4e4f534a, `${label}: missing JSON chunk`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

const expectedFamilies = ['processor', 'pipeRack', 'cableTray', 'serviceConduit', 'gantry', 'terminal'];
const expectedMaterials = [
  'refinery-structural',
  'refinery-shell',
  'refinery-hazard-emissive',
  'refinery-screen-emissive',
];
const representativeNodes = {
  processor: { name: 'refinery-processor-core', translation: [0, 1.55, 0], scale: [1.9, 2.5, 1.55] },
  pipeRack: { name: 'refinery-pipe-main-a', translation: [0, 1.12, 0.38], scale: [3.7, 0.18, 0.18] },
  cableTray: { name: 'refinery-cable-tray-spine', translation: [0, 1.34, 0], scale: [0.14, 0.16, 3.2] },
  serviceConduit: { name: 'refinery-service-conduit-trunk', translation: [0, 0.30, 0], scale: [2.8, 0.18, 0.22] },
  gantry: { name: 'refinery-smelter-gantry-beam', translation: [0, 3.46, 0], scale: [5.8, 0.46, 0.82] },
  terminal: { name: 'refinery-terminal-console', translation: [0.20, 1.34, 0], scale: [0.72, 0.24, 0.88] },
};

assert(REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS.length === expectedFamilies.length * 2, `Expected 12 machinery LOD targets, got ${REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS.length}`);
assert(JSON.stringify([...new Set(REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS.map(target => target.family))]) === JSON.stringify(expectedFamilies), 'Machinery target families changed');
for (const family of expectedFamilies) {
  const familyTargets = REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS.filter(target => target.family === family);
  assert(familyTargets.length === 2, `${family}: expected exactly two authored machinery LOD targets`);
  assert(familyTargets.every(target => target.phase === 'P28-B4'), `${family}: machinery target phase changed`);
  assert(familyTargets.some(target => target.relativePath.endsWith('-lod1.glb')), `${family}: LOD1 target is missing`);
  assert(familyTargets.some(target => target.relativePath.endsWith('-lod2.glb')), `${family}: LOD2 target is missing`);
}

for (const target of REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS) {
  const path = resolve(process.cwd(), 'public/assets/models', target.relativePath);
  const bytes = await readFile(path);
  const gltf = parseGlb(bytes, target.relativePath);
  const rebuilt = upgradeRefineryPremiumSurfaceGlb(bytes, target);
  assert(bytes.equals(rebuilt), `${target.relativePath}: P28-B4 geometry upgrade is not deterministic/idempotent`);
  const marker = gltf.extras?.ironshadeP28B4MachinerySurfaceGeometry;
  assert(marker?.family === target.family, `${target.relativePath}: P28-B4 machinery marker is missing`);
  assert(marker?.gameplayBoundsChanged === false, `${target.relativePath}: gameplay bounds must remain unchanged`);
  assert(JSON.stringify(gltf.accessors?.[0]?.min) === JSON.stringify([-0.5, -0.5, -0.5]), `${target.relativePath}: position minimum changed`);
  assert(JSON.stringify(gltf.accessors?.[0]?.max) === JSON.stringify([0.5, 0.5, 0.5]), `${target.relativePath}: position maximum changed`);
  for (const mesh of gltf.meshes ?? []) {
    if (mesh.name === 'p28-b5-refinery-detail-atlas') continue;
    for (const primitive of mesh.primitives ?? []) {
      assert(primitive.attributes?.TANGENT === 2, `${target.relativePath}: TANGENT is missing`);
      assert(primitive.attributes?.TEXCOORD_0 === 3, `${target.relativePath}: TEXCOORD_0 is missing`);
      assert(primitive.indices === 4, `${target.relativePath}: index topology changed`);
    }
  }
  const baseMaterials = (gltf.materials ?? []).map(material => material.name).filter(name => name !== 'refinery-detail-atlas');
  assert(JSON.stringify(baseMaterials) === JSON.stringify(expectedMaterials), `${target.relativePath}: authored machinery material slots changed`);
  const expected = representativeNodes[target.family];
  const node = (gltf.nodes ?? []).find(candidate => candidate.name === expected.name);
  assert(node, `${target.relativePath}: representative machinery node ${expected.name} is missing`);
  assert(JSON.stringify(node.translation) === JSON.stringify(expected.translation), `${target.relativePath}: ${expected.name} translation changed`);
  assert(JSON.stringify(node.scale) === JSON.stringify(expected.scale), `${target.relativePath}: ${expected.name} scale changed`);
}

const renderer = await readFile(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');
const library = await readFile(resolve(process.cwd(), 'src/game/babylonPremiumPbrSurfaceLibrary.ts'), 'utf8');
const post = await readFile(resolve(process.cwd(), 'src/game/babylonRefineryPostProcessing.ts'), 'utf8');
const verifier = await readFile(resolve(process.cwd(), 'scripts/verify-authored-refinery.mjs'), 'utf8');
const runtimeSmoke = await readFile(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const telemetry = 'floor:bare-metal+deck-plate|floor-grate:bare-metal+painted-metal|bulkhead:painted-metal|processor:bare-metal+emissive-fixture+painted-metal|pipe-rack:bare-metal+emissive-fixture+painted-metal|wall-panel:bare-metal+painted-metal|cable-tray:bare-metal+emissive-fixture+painted-metal|service-conduit:bare-metal+emissive-fixture+painted-metal|gantry:bare-metal+emissive-fixture+painted-metal|crate:bare-metal+painted-metal+polymer-rubber|terminal:bare-metal+emissive-fixture+painted-metal';
for (const family of ['processor', 'pipeRack', 'cableTray', 'serviceConduit', 'gantry', 'terminal']) {
  assert(renderer.includes(`${family}: {`), `Renderer premium surface assignment is missing ${family}`);
}
assert(renderer.includes("'refinery-structural': 'painted-metal'") && renderer.includes("'refinery-shell': 'bare-metal'"), 'Machinery metal separation is missing');
assert(renderer.includes("'refinery-hazard-emissive': 'emissive-fixture'") && renderer.includes("'refinery-screen-emissive': 'emissive-fixture'"), 'Machinery emissive slots are not using the shared emissive fixture');
assert(renderer.includes(telemetry) && verifier.includes(telemetry), 'P28-B4 live machinery material telemetry is incomplete');
assert(library.includes("id: 'emissive-fixture'") && library.includes('emissiveUrl:'), 'Shared emissive fixture material lost its emissive texture');
assert(post.includes('refinery-(terminal|processor|pipe|cable-tray|service-conduit|smelter-gantry)'), 'Selective bloom does not include P28-B4 machinery emissive families');
assert(post.includes('excludeByDefault: true'), 'Selective bloom protection contract changed');
assert(runtimeSmoke.includes('authored:processor\\+terminal(?:\\+(?:pipe|cable-tray|service-conduit|gantry))*\\+muzzle'), 'Browser runtime smoke does not accept B4 machinery bloom-source telemetry');

console.log(`REFINERY_MACHINERY_PREMIUM_SURFACES_PASS targets=${REFINERY_MACHINERY_PREMIUM_SURFACE_TARGETS.length} families=${expectedFamilies.join('+')} surfaces=painted-metal+bare-metal+emissive-fixture bounds=unchanged bloom=selective`);
await import('./refinery-decal-atlas.mjs');
