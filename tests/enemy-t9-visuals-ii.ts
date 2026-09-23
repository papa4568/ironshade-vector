import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { enemyMutationAudioProfiles } from '../src/game/feedback';
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

const expected = {
  'redline-bus': ['redline-tension', 'bus-hot', 'redline-pulse', 'power-bus-rise'],
  'countermass-rig': ['countermass-ready', 'mass-field', 'countermass-orbit', 'mass-thrum'],
  'relay-reflex': ['relay-ready', 'relay-charge', 'relay-snap', 'relay-click'],
} as const;

const signatures = new Set<string>();
for (const [id, cues] of Object.entries(expected) as Array<[keyof typeof expected, (typeof expected)[keyof typeof expected]]>) {
  const input = base();
  input.mutations = [id];
  const presentation = resolveEnemyPresentation(input);
  assert.equal(presentation.animation.find(layer => layer.source === 'mutation')?.cue, cues[0], `${id} animation cue`);
  assert.equal(presentation.material.find(layer => layer.source === 'mutation')?.cue, cues[1], `${id} material cue`);
  assert.equal(presentation.vfx.find(layer => layer.source === 'mutation')?.cue, cues[2], `${id} vfx cue`);
  assert.equal(presentation.audio.find(layer => layer.source === 'mutation')?.cue, cues[3], `${id} audio cue`);
  assert.equal(enemyMutationAudioProfiles[id].priority, 'background', `${id} audio must stay duckable below combat warnings`);
  assert(enemyMutationAudioProfiles[id].layers.length >= 2, `${id} must have layered mutation audio`);
  signatures.add(presentation.signature);
}
assert.equal(signatures.size, 3, 'P13-C mutations must remain visually distinct');

const priorityInput = base();
priorityInput.mutations = ['redline-bus', 'countermass-rig', 'relay-reflex'];
priorityInput.statuses.disrupted = 0.8;
priorityInput.telegraph = 0.9;
const priorityPresentation = resolveEnemyPresentation(priorityInput);
assert.equal(priorityPresentation.animation[0]?.source, 'status', 'priority-4 status must remain above P13-C mutation animation');
assert(priorityPresentation.animation.some(layer => layer.source === 'telegraph'), 'attack telegraph must remain present');
assert(priorityPresentation.animation.filter(layer => layer.source === 'mutation').every(layer => layer.priority === 2), 'P13-C mutation animation remains lower priority');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
const feedbackSource = readFileSync(resolve(process.cwd(), 'src/game/feedback.ts'), 'utf8');

for (const token of ['redline-tension', 'countermass-ready', 'relay-ready']) {
  assert(rendererSource.includes(token), `Three.js renderer must consume ${token}`);
  assert(canvasSource.includes(token), `Canvas fallback must consume ${token}`);
}
for (const hardware of ['mutation-redline-bus', 'mutation-countermass-rig', 'mutation-relay-reflex']) {
  assert(rendererSource.includes(hardware), `Three.js renderer must author ${hardware}`);
}
assert(rendererSource.includes('reducedEffects ? 0 : state.time * 0.45'), 'Countermass secondary orbit motion must stop in reduced-effects mode');
assert(rendererSource.includes('snap.visible = !reducedEffects || side > 0'), 'Relay secondary snap VFX must reduce in reduced-effects mode');
assert(canvasSource.includes('const snapCount = reducedEffects ? 1 : 2'), 'Canvas Relay fallback must reduce secondary snap density');
assert(canvasSource.includes('presentationMutationAudioIds'), 'all six mutation audio cues must share the presentation feedback path');
for (const id of ['redline-bus', 'countermass-rig', 'relay-reflex']) {
  assert(feedbackSource.includes(`'${id}'`), `mutation audio registry must include ${id}`);
}
assert(feedbackSource.includes("'utility', profile.priority"), 'mutation audio must remain on the duckable utility bus');
assert(canvasSource.includes('feedback.mutation(freshMutation.cue)'), 'fresh P13-C mutations must emit their one-shot authored audio read');
assert(
  /drawEnemyMutationPresentation\(ctx,[\s\S]{0,500}drawEnemySilhouette\(ctx,[\s\S]{0,500}drawEnemyTelegraph\(ctx/.test(canvasSource),
  'Canvas attack telegraph must still draw after mutation effects and silhouette',
);
assert(!rendererSource.includes('applyEnemyMutations('), 'presentation renderer must not mutate T9 gameplay stats');

console.log('T9_VISUALS_II_PASS mutations=3 channels=animation+material+vfx+audio priority=tells-first authored+fallback=1 reduced-effects=preserved');
