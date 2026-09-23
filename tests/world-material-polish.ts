import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  biomeWorldState,
  hazardWorldPresentation,
  interactableWorldPresentation,
  materialWorldResponse,
  worldMaterialQualityProfile,
} from '../src/game/worldMaterialPolish';
import type { CombatObject, Hazard, SimState } from '../src/game/sim';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const high = worldMaterialQualityProfile('high');
const balanced = worldMaterialQualityProfile('balanced');
const performance = worldMaterialQualityProfile('performance');

assert(high.materialDepthScale > balanced.materialDepthScale && balanced.materialDepthScale > performance.materialDepthScale, 'world material depth should scale down before gameplay-critical cues');
assert(performance.interactableCueOpacity >= 0.64, 'Performance mode must retain readable interactable cues');
assert(performance.hazardCueOpacity >= 0.7, 'Performance mode must retain readable hazard silhouettes');
assert(performance.pickupBeamScale < balanced.pickupBeamScale && performance.pickupBeamScale > 0, 'Performance mode should trim pickup beam cost without removing pickup readability');
assert(performance.stateMotionScale < high.stateMotionScale && performance.stateMotionScale >= 0.5, 'Performance mode should reduce biome motion rather than eliminate state animation');

const interactableKinds: CombatObject['kind'][] = ['doorControl', 'gravityControl', 'sealControl', 'powerControl', 'salvageNode'];
const interactableProfiles = interactableKinds.map(kind => interactableWorldPresentation(kind));
assert(interactableProfiles.every(Boolean), 'all priority interactables need in-world presentations');
assert(new Set(interactableProfiles.map(profile => profile?.shape)).size >= 4, 'priority interactables should use multiple non-color glyph silhouettes');
assert(interactableWorldPresentation('cover') === null, 'generic cover should not receive an interactable cue');

const hazardKinds: Hazard['kind'][] = ['shockGrid', 'gravityWell', 'coolantJet', 'vacuumWake', 'vectorWash', 'boiloffJet'];
const hazardProfiles = hazardKinds.map(kind => hazardWorldPresentation(kind));
assert(hazardProfiles.every(profile => profile.color > 0 && profile.pulseHz > 0), 'every hazard needs color-independent motion plus a visible accent');
assert(new Set(hazardProfiles.map(profile => `${profile.shape}:${profile.scaleX}:${profile.scaleZ}`)).size === hazardKinds.length, 'each hazard should have a distinct silhouette/footprint signature');

const bulkhead = materialWorldResponse('bulkhead');
const system = materialWorldResponse('system');
const industrial = materialWorldResponse('industrial');
assert(bulkhead.metalness > industrial.metalness && system.roughness < industrial.roughness, 'world material response should preserve readable bulkhead/system/industrial depth');

type BiomeSignals = Parameters<typeof biomeWorldState>[1];
const baseSignals: BiomeSignals = {
  time: 0,
  sectors: [{ id: 'A', label: 'A', x: 0, y: 0, w: 1, h: 1, pressure: 1, pressureState: 'normal', gravity: 1, rapidTimer: 0, targetPressure: 1 }],
  breaches: [],
  hazards: [],
  objects: [],
};

const solarSurge = biomeWorldState('solar-yard', { ...baseSignals, time: 12 });
assert(solarSurge.id === 'solar-surge' && solarSurge.audioCue === 'machinery', 'Solar Yard surge must drive a coupled visual/audio biome state');

const spinImbalance = biomeWorldState('spin-habitat', {
  ...baseSignals,
  sectors: [{ ...baseSignals.sectors[0], gravity: 0.72 }],
});
assert(spinImbalance.id === 'spin-imbalance' && spinImbalance.audioCue === 'gravity', 'Spin Habitat gravity drift must drive a coupled visual/audio state');

const pressureCritical = biomeWorldState('damaged-vessel', {
  ...baseSignals,
  sectors: [{ ...baseSignals.sectors[0], pressure: 0.35, pressureState: 'decompressing' }],
});
assert(pressureCritical.id === 'pressure-critical' && pressureCritical.audioCue === 'breach' && pressureCritical.severity === 1, 'pressure crises must outrank secondary biome presentation');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
assert(rendererSource.includes("dataset.interactableReadability = 'shape-coded+state-emissive+floor-cue:quality-safe'"), 'Three.js runtime QA must expose priority-interactable readability');
assert(rendererSource.includes("dataset.hazardReadability = 'shape-coded+floor-bound+quality-safe'"), 'Three.js runtime QA must expose hazard readability');
assert(rendererSource.includes("dataset.worldReadability = 'interactables:shape+state|hazards:shape+motion|loot:shape+rarity'"), 'Three.js runtime QA must expose the shared world readability language');
assert(rendererSource.includes('worldQuality.pickupBeamScale'), 'pickup beam cost must follow the P15-D quality profile');
assert(rendererSource.includes('worldQuality.materialDepthScale'), 'material depth must follow the P15-D quality profile');
assert(rendererSource.includes('biomeState.motionHz * worldQuality.stateMotionScale'), 'biome state animation must respect adaptive quality');

const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
assert(canvasSource.includes('interactableWorldPresentation(object.kind)'), 'Canvas fallback must preserve interactable glyph readability');
assert(canvasSource.includes('hazardWorldPresentation(hazard.kind)'), 'Canvas fallback must preserve hazard shape coding');
assert(canvasSource.includes('biomeState.id !== previous.biomeStateToken'), 'biome state transitions must have a dedicated audio cue path');
assert(canvasSource.includes('biomeState.audioCue !== environmentEventCue'), 'biome state audio must avoid duplicating same-frame environment cues');

console.log('WORLD_MATERIAL_POLISH_PASS interactables=shape+state hazards=shape+motion materials=depth biome=animation+audio quality=adaptive');
