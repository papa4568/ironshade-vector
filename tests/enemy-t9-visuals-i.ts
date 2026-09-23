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
  'reinforced-core': ['core-braced', 'reinforced-core-plates', 'core-pressure-glow', 'load-bearing-hum'],
  'ablative-mantle': ['mantle-settle', 'ablative-shell', 'mantle-shed-sparks', 'ceramic-rattle'],
  'hunter-servo': ['hunter-ready', 'servo-heat', 'tracking-streak', 'servo-whine'],
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
assert.equal(signatures.size, 3, 'P13-B mutations must remain visually distinct');

const priorityInput = base();
priorityInput.mutations = ['reinforced-core', 'ablative-mantle', 'hunter-servo'];
priorityInput.statuses.disrupted = 0.8;
priorityInput.telegraph = 0.9;
const priorityPresentation = resolveEnemyPresentation(priorityInput);
assert.equal(priorityPresentation.animation[0]?.source, 'status', 'priority-4 status must remain above mutation animation');
assert(priorityPresentation.animation.some(layer => layer.source === 'telegraph'), 'attack telegraph must remain present');
assert(priorityPresentation.animation.find(layer => layer.source === 'mutation')?.priority === 2, 'mutation animation remains lower priority');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
const feedbackSource = readFileSync(resolve(process.cwd(), 'src/game/feedback.ts'), 'utf8');

for (const token of ['core-braced', 'mantle-settle', 'hunter-ready']) {
  assert(rendererSource.includes(token), `Three.js renderer must consume ${token}`);
  assert(canvasSource.includes(token), `Canvas fallback must consume ${token}`);
}
assert(rendererSource.includes('syncEnemyMutationPresentation'), 'Three.js renderer must run the shared P13-B mutation presentation path');
assert(rendererSource.includes('enemyMutationPresentation'), 'Three.js runtime QA telemetry must expose active mutation presentation');
assert(canvasSource.includes('drawEnemyMutationPresentation'), 'Canvas fallback must render mutation-specific visual language');
assert(
  /drawEnemyMutationPresentation\(ctx,[\s\S]{0,500}drawEnemySilhouette\(ctx,[\s\S]{0,500}drawEnemyTelegraph\(ctx/.test(canvasSource),
  'Canvas attack telegraph must draw after mutation effects and silhouette so the warning stays readable',
);
assert(feedbackSource.includes('feedback') === false || feedbackSource.includes('enemyMutationAudioProfiles'), 'mutation audio profiles must remain data-driven');
assert(feedbackSource.includes("'utility', profile.priority"), 'mutation audio must use the duckable utility bus rather than the threat bus');
assert(canvasSource.includes('feedback.mutation(freshMutation.cue)'), 'fresh P13-B mutations must emit their one-shot authored audio read');
assert(!rendererSource.includes('applyEnemyMutations('), 'presentation renderer must not mutate T9 gameplay stats');

console.log('T9_VISUALS_I_PASS mutations=3 channels=animation+material+vfx+audio priority=tells-first authored+fallback=1');
