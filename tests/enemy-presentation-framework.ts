import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveEnemyPresentation, type EnemyPresentationInput } from '../src/game/enemyPresentation';

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

const channels = ['animation', 'material', 'vfx', 'audio'] as const;

const reinforcedInput = base();
reinforcedInput.mutations = ['reinforced-core'];
const reinforced = resolveEnemyPresentation(reinforcedInput);
for (const channel of channels) {
  assert(reinforced[channel].some(layer => layer.key === 'mutation:reinforced-core'), `reinforced-core must publish ${channel} presentation`);
}
assert.equal(reinforced.animation.find(layer => layer.key === 'mutation:reinforced-core')?.cue, 'core-braced');
assert.equal(reinforced.material.find(layer => layer.key === 'mutation:reinforced-core')?.cue, 'reinforced-core-plates');

const layeredInput = base();
layeredInput.mutations = ['relay-reflex', 'reinforced-core', 'hunter-servo'];
layeredInput.statuses.disrupted = 0.7;
layeredInput.statuses.marked = 0.35;
layeredInput.telegraph = 0.8;
layeredInput.protocolPulse = 0.9;
layeredInput.protocols = [{
  id: 'gravityAnchor',
  enhanced: true,
  cooldown: 0,
  windup: 0.6,
  variantId: 'anchor-singularity',
}];
const before = JSON.stringify(layeredInput);
const layered = resolveEnemyPresentation(layeredInput);
assert.equal(JSON.stringify(layeredInput), before, 'presentation resolution must not mutate deterministic combat state');
for (const channel of channels) {
  assert(layered[channel].some(layer => layer.source === 'mutation'), `${channel} must compose mutation state`);
  assert(layered[channel].some(layer => layer.source === 'protocol'), `${channel} must compose protocol state`);
  assert(layered[channel].some(layer => layer.source === 'status'), `${channel} must compose status state`);
  assert(layered[channel].some(layer => layer.source === 'telegraph'), `${channel} must compose telegraph state`);
}
assert(layered.audio.some(layer => layer.key.includes('gravityAnchor') && layer.enhanced), 'enhanced protocol presentation must retain enhanced identity');
assert.equal(layered.dominant, 'status:disrupted', 'highest-priority readable state should dominate QA telemetry');

const reorderedInput = base();
reorderedInput.mutations = ['hunter-servo', 'reinforced-core', 'relay-reflex'];
reorderedInput.statuses.disrupted = 0.7;
reorderedInput.statuses.marked = 0.35;
reorderedInput.telegraph = 0.8;
reorderedInput.protocolPulse = 0.9;
reorderedInput.protocols = [{
  id: 'gravityAnchor',
  enhanced: true,
  cooldown: 0,
  windup: 0.6,
  variantId: 'anchor-singularity',
}];
assert.equal(resolveEnemyPresentation(reorderedInput).signature, layered.signature, 'presentation signature must be deterministic regardless of mutation storage order');

const statusInput = base();
statusInput.statuses = {
  armorBreach: 0.6,
  disrupted: 0.4,
  marked: 0.8,
  stagger: 0.5,
  conductive: 0.7,
  vacuum: 0.9,
};
const statusContract = resolveEnemyPresentation(statusInput);
for (const status of ['armorBreach', 'disrupted', 'marked', 'stagger', 'conductive', 'vacuum']) {
  for (const channel of channels) assert(statusContract[channel].some(layer => layer.key === `status:${status}`), `${status} must publish ${channel} presentation`);
}

const bossInput = base();
bossInput.role = 'boss';
bossInput.bossPhase = 2;
const boss = resolveEnemyPresentation(bossInput);
for (const channel of channels) assert(boss[channel].some(layer => layer.key === 'boss:phase-2'), `boss phase two must publish ${channel} presentation`);

const deadInput = layeredInput;
deadInput.dead = true;
const dead = resolveEnemyPresentation(deadInput);
assert(dead.audio.length === 1 && dead.audio[0]?.source === 'death', 'dead enemies must stop sustained presentation audio and emit only their death cue');
assert(dead.vfx.some(layer => layer.source === 'mutation') && dead.vfx.some(layer => layer.source === 'death'), 'visual state may persist through disable/death presentation');

const source = readFileSync(resolve(process.cwd(), 'src/game/enemyPresentation.ts'), 'utf8');
for (const forbidden of ['stepSimulation', 'applyEnemyMutations', 'stepEnemyProtocols']) {
  assert(!source.includes(forbidden), `presentation framework must not call simulation mutator ${forbidden}`);
}
assert(source.includes('signatureFor') && source.includes('sortLayers'), 'presentation framework must expose deterministic composition/QA behavior');

console.log('ENEMY_PRESENTATION_FRAMEWORK_PASS channels=animation+material+vfx+audio deterministic=1 simulationMutation=0');
