import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const world = await readFile(resolve(process.cwd(), 'src/game/babylonWorldPresentation.ts'), 'utf8');
const mappings = await readFile(resolve(process.cwd(), 'src/game/refineryWorldObjectAssets.ts'), 'utf8');
const manifest = await readFile(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
const imageGrade = await readFile(resolve(process.cwd(), 'scripts/p28a5-image-grade-capture.mjs'), 'utf8');
const verifier = await readFile(resolve(process.cwd(), 'scripts/verify-authored-refinery.mjs'), 'utf8');

const expectedMappings = {
  cover: 'crate',
  conduit: 'serviceConduit',
  coolant: 'pipeRack',
  breachPlate: 'wallPanel',
  doorControl: 'terminal',
  gravityControl: 'terminal',
  sealControl: 'terminal',
  powerControl: 'terminal',
  salvageNode: 'crate',
  anchorNode: 'processor',
};
for (const [kind, family] of Object.entries(expectedMappings)) {
  assert(mappings.includes(`${kind}: '${family}'`), `P28-C8 refinery mapping ${kind} -> ${family} is missing`);
}
for (const family of new Set(Object.values(expectedMappings))) {
  assert(manifest.includes(`${family}: {`), `P28-C8 mapped refinery family ${family} is not registered`);
}

assert(mappings.includes('object.w * worldScale') && mappings.includes('object.h * worldScale'), 'P28-C8 authored fitting must remain driven by simulation-owned object dimensions');
assert(mappings.includes('rotationY: rotate ? Math.PI / 2 : 0'), 'P28-C8 long-axis authored fitting must be deterministic');
assert(world.includes("mission.location === 'asteroid-refinery'"), 'P28-C8 authored world mapping must remain scoped to the refinery');
assert(world.includes('refineryWorldObjectAssetFamily(object)') && world.includes('refineryWorldObjectFit(object, WORLD_SCALE)'), 'P28-C8 Babylon world presentation is not consuming the authored mapping contract');
assert(world.includes('private readonly authoredWorldObjects') && world.includes('private readonly refineryObjectRequests'), 'P28-C8 authored world-object lifecycle state is missing');
assert(world.includes('getBabylonGraphicsAssetRuntime(this.scene).instantiate(spec)'), 'P28-C8 mapped objects must use the shared Babylon asset runtime');
assert(world.includes('this.authoredWorldObjects.set(object.id'), 'P28-C8 mapped authored instances are not retained by simulation object id');
assert(world.includes("this.canvas.dataset.refineryWorldVisual = 'authored-family-mapped'"), 'P28-C8 authored-world telemetry mode is missing');
assert(world.includes('this.ensureObjectFallback(object'), 'P28-C8 deterministic failure/unmapped fallback is missing');
assert(world.includes("this.canvas.dataset.refineryWorldFallbackReason"), 'P28-C8 load-failure reason telemetry is missing');

const fallbackStart = world.indexOf('private ensureObjectFallback(');
const fallbackEnd = world.indexOf('private async loadRefineryWorldObject(', fallbackStart);
assert(fallbackStart >= 0 && fallbackEnd > fallbackStart, 'P28-C8 fallback/load method boundaries are missing');
const fallbackSource = world.slice(fallbackStart, fallbackEnd);
assert(fallbackSource.includes('MeshBuilder.CreateBox'), 'P28-C8 explicit procedural fallback no longer creates the deterministic box fallback');
assert(fallbackSource.includes('Math.max(0.15, scaled(object.w))') && fallbackSource.includes('Math.max(0.15, scaled(object.h))'), 'P28-C8 fallback footprint no longer preserves simulation dimensions');

const syncStart = world.indexOf('private syncObjects(');
const syncEnd = world.indexOf('private ensureObjective()', syncStart);
assert(syncStart >= 0 && syncEnd > syncStart, 'P28-C8 syncObjects boundary is missing');
const syncSource = world.slice(syncStart, syncEnd);
assert(!syncSource.includes('MeshBuilder.CreateBox'), 'P28-C8 mapped sync path must not construct generic boxes directly');
assert(syncSource.includes('scaled(object.x + object.w / 2)') && syncSource.includes('scaled(object.y + object.h / 2)'), 'P28-C8 presentation must retain simulation-owned interaction/object centers');
assert(syncSource.includes('authored.mount.scaling.set(fit.scaleX, fit.scaleY * durabilityScale, fit.scaleZ)'), 'P28-C8 authored object footprint/durability fitting is missing');
assert(syncSource.includes('const mappedFamily = refineryScenario ? refineryWorldObjectFamilyKey(object) : null'), 'P28-C8 refinery mapping gate is missing');

assert(verifier.includes('refineryWorldVisual') && verifier.includes('refineryWorldMappedCount') && verifier.includes('refineryWorldAuthoredCount') && verifier.includes('refineryWorldFallbackCount'), 'P28-C8 live refinery verifier does not inspect world-family mapping telemetry');
assert(verifier.includes('mapped world-object coverage'), 'P28-C8 live verifier does not require authored mapped coverage');
assert(imageGrade.includes("visualDetail: 'p28-c8-refinery-world-authored-mappings'"), 'P28-C8 Flagship image-grade capture is not tagged for the world-mapping candidate');

console.log(`REFINERY_WORLD_AUTHORED_MAPPINGS_PASS mappedKinds=${Object.keys(expectedMappings).length} families=${[...new Set(Object.values(expectedMappings))].sort().join('+')} center=simulation-owned fallback=load-failure+unmapped`);
