import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eliteProtocolDefinitions, type EnemyProtocolId, type EnhancedProtocolVariantId } from '../src/game/eliteProtocols';
import { resolveEnemyPresentation, type EnemyPresentationInput } from '../src/game/enemyPresentation';
import { enhancedProtocolVisualIds, enhancedProtocolVisualSpecFor, protocolVisualIds, protocolVisualSpecFor } from '../src/game/protocolVisualLanguage';

const base = (): EnemyPresentationInput => ({
  role: 'elite',
  combatClass: 'enhanced',
  mutations: [],
  protocols: [],
  statuses: {
    armorBreach: 0,
    disrupted: 0,
    marked: 0,
    stagger: 0,
    conductive: 0,
    vacuum: 0,
  },
  telegraph: 0,
  protocolPulse: 0,
  bossPhase: 1,
  dead: false,
  anchored: false,
});

assert.equal(protocolVisualIds.length, eliteProtocolDefinitions.length, 'every elite protocol must have physical visual language');
assert.equal(new Set(protocolVisualIds).size, protocolVisualIds.length, 'protocol visual ids must be unique');
assert.equal(enhancedProtocolVisualIds.length, 15, 'all named enhanced protocol variants must have visual accents');
assert.equal(new Set(enhancedProtocolVisualIds).size, enhancedProtocolVisualIds.length, 'enhanced visual ids must be unique');

const protocolPhysicalSignatures = new Set<string>();
const presentationSignatures = new Set<string>();
for (const definition of eliteProtocolDefinitions) {
  const spec = protocolVisualSpecFor(definition.id);
  assert.equal(spec.family, definition.family, `${definition.id} visual family must match gameplay family`);
  protocolPhysicalSignatures.add([
    spec.signature,
    spec.nodeCount,
    spec.radius.toFixed(2),
    spec.height.toFixed(2),
    spec.motion,
    spec.phase.toFixed(2),
  ].join(':'));

  const input = base();
  input.protocols = [{
    id: definition.id,
    enhanced: false,
    cooldown: 0,
    windup: 0.5,
  }];
  const presentation = resolveEnemyPresentation(input);
  for (const channel of ['animation', 'material', 'vfx', 'audio'] as const) {
    assert(presentation[channel].some(layer => layer.key === `protocol:${definition.id}`), `${definition.id} must publish ${channel} presentation`);
  }
  presentationSignatures.add(presentation.signature);
}
assert.equal(protocolPhysicalSignatures.size, eliteProtocolDefinitions.length, 'each protocol must have a distinct physical signature');
assert.equal(presentationSignatures.size, eliteProtocolDefinitions.length, 'each protocol must retain deterministic presentation identity');

const enhancedPairs: Array<[EnemyProtocolId, EnhancedProtocolVariantId]> = [
  ['reactivePlating', 'ablative-bloom'],
  ['breachmaker', 'cutline-pair'],
  ['magneticLock', 'twin-well-lock'],
  ['gravityAnchor', 'anchor-singularity'],
  ['countermassMobility', 'wake-anchor'],
  ['arcConduit', 'cascade-grid'],
  ['repairMesh', 'overlink-mesh'],
  ['droneEscort', 'dual-rack'],
  ['emergencyShutters', 'cross-shutter'],
  ['signalJammer', 'capacitor-scramble'],
  ['thermalOverrun', 'coolant-redline'],
  ['suppressionCoordinator', 'tech-bus-sync'],
  ['penetratorVolley', 'cross-fan-volley'],
  ['salvageInterdictor', 'mass-theft'],
  ['recoveryDenial', 'hard-lock-grid'],
];
const enhancedPhysicalSignatures = new Set<string>();
for (const [id, variantId] of enhancedPairs) {
  const variant = enhancedProtocolVisualSpecFor(variantId);
  enhancedPhysicalSignatures.add([variant.marker, variant.spokes, variant.scale.toFixed(2), variant.phase.toFixed(2)].join(':'));
  const input = base();
  input.protocols = [{
    id,
    enhanced: true,
    cooldown: 0,
    windup: 0.65,
    variantId,
  }];
  const presentation = resolveEnemyPresentation(input);
  const protocolLayers = presentation.animation.filter(layer => layer.source === 'protocol');
  assert(protocolLayers.some(layer => layer.key === `protocol:${id}:${variantId}` && layer.enhanced), `${variantId} must retain enhanced identity in the presentation contract`);
}
assert.equal(enhancedPhysicalSignatures.size, enhancedPairs.length, 'each enhanced variant must have a distinct physical accent signature');

const combo = base();
combo.protocolPulse = 0.9;
combo.protocols = [
  { id: 'emergencyShutters', enhanced: true, cooldown: 0, windup: 0.6, variantId: 'cross-shutter', combinationId: 'kill-corridor' },
  { id: 'suppressionCoordinator', enhanced: true, cooldown: 0, windup: 0.55, variantId: 'tech-bus-sync', combinationId: 'kill-corridor' },
  { id: 'penetratorVolley', enhanced: true, cooldown: 0, windup: 0.7, variantId: 'cross-fan-volley', combinationId: 'kill-corridor' },
];
const comboPresentation = resolveEnemyPresentation(combo);
for (const id of ['emergencyShutters', 'suppressionCoordinator', 'penetratorVolley']) {
  assert(comboPresentation.animation.some(layer => layer.key.includes(id)), `${id} must remain independently readable inside a protocol combination`);
}

const priority = base();
priority.protocols = [{ id: 'gravityAnchor', enhanced: true, cooldown: 0, windup: 0.8, variantId: 'anchor-singularity' }];
priority.statuses.disrupted = 0.8;
priority.telegraph = 0.92;
const priorityPresentation = resolveEnemyPresentation(priority);
assert.equal(priorityPresentation.animation[0]?.source, 'status', 'priority-4 status must stay above protocol animation');
assert(priorityPresentation.animation.some(layer => layer.source === 'telegraph'), 'attack telegraph must remain present above protocol hardware');
assert(priorityPresentation.animation.some(layer => layer.source === 'protocol'), 'protocol hardware must remain composed under higher-priority tells');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
const visualSource = readFileSync(resolve(process.cwd(), 'src/game/protocolVisualLanguage.ts'), 'utf8');

assert(rendererSource.includes('createEnemyProtocolVisuals'), 'Three.js must author physical protocol hardware');
assert(rendererSource.includes('syncEnemyProtocolPresentation'), 'Three.js must animate protocol hardware');
assert(rendererSource.includes('protocol-enhanced-ring'), 'Three.js must expose enhanced protocol accents');
assert(rendererSource.includes('dataset.enemyProtocolPresentation'), 'Three.js must expose protocol QA telemetry');
assert(rendererSource.includes('reducedTargetMotion ? 0 : state.time'), 'generic protocol ring motion must stop in reduced-effects mode');
assert(rendererSource.includes('const spokeCount = reducedEffects ? Math.min(2, variant.spokes) : variant.spokes'), 'enhanced protocol secondary detail must reduce under reduced effects');

assert(canvasSource.includes('drawEnemyProtocolPresentation'), 'Canvas fallback must render protocol hardware');
assert(canvasSource.includes('const markerCount = reducedEffects ? Math.min(2, variant.spokes) : variant.spokes'), 'Canvas enhanced protocol detail must reduce under reduced effects');
assert(
  /drawEnemyProtocolPresentation\(ctx,[\s\S]{0,250}drawEnemyMutationPresentation\(ctx,[\s\S]{0,250}drawEnemySilhouette\(ctx,[\s\S]{0,250}drawEnemyTelegraph\(ctx/.test(canvasSource),
  'Canvas attack telegraph must draw after protocol and mutation presentation',
);

for (const definition of eliteProtocolDefinitions) {
  assert(visualSource.includes(`${definition.id}:`), `protocol visual registry must include ${definition.id}`);
}
for (const [, variantId] of enhancedPairs) {
  assert(visualSource.includes(`'${variantId}'`), `enhanced visual registry must include ${variantId}`);
}

for (const forbidden of ['stepSimulation(', 'stepEnemyProtocols(', 'chooseEnemyProtocols(']) {
  assert(!visualSource.includes(forbidden), `protocol visual language must not mutate simulation through ${forbidden}`);
  assert(!rendererSource.includes(`protocolVisualLanguage.${forbidden}`), 'renderer protocol presentation must stay simulation-read-only');
}

console.log('PROTOCOL_VISUALS_PASS protocols=18 enhanced=15 authored+fallback=1 combos=readable priority=tells-first reduced-effects=preserved simulationMutation=0');
