import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveEnemyPresentation, type EnemyPresentationInput } from '../src/game/enemyPresentation';
import {
  dangerousEnemyCombinationReadiness,
  resolveEnemyLifecyclePresentation,
} from '../src/game/enemyLifecyclePresentation';

const basePresentation = (): EnemyPresentationInput => ({
  role: 'elite',
  combatClass: 'elite',
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
  anchored: true,
});

const lifecycleEnemy = () => ({
  active: true,
  dead: false,
  deathT: 0,
  role: 'elite' as const,
  combatClass: 'elite' as const,
  protocols: [] as Array<{ id: 'gravityAnchor'; enhanced: boolean; cooldown: number; windup: number; variantId?: 'anchor-singularity' }>,
  mutations: [] as Array<'reinforced-core'>,
  commandTargetMutations: [] as never[],
  bossPhaseMutations: [] as never[],
  protocolPulse: 0,
  telegraph: 0,
  bossPhase: 1 as const,
});

const channels = ['animation', 'material', 'vfx', 'audio'] as const;

const spawning = lifecycleEnemy();
const spawnSignals = resolveEnemyLifecyclePresentation(spawning, { sinceActivated: 0.12, sincePhaseChange: -1, sinceDeath: -1 });
assert(spawnSignals.spawn > 0.8, 'fresh hostile activation must publish a strong bounded spawn signal');
const spawnContract = resolveEnemyPresentation(basePresentation(), spawnSignals);
for (const channel of channels) {
  assert(spawnContract[channel].some(layer => layer.key === 'spawn:activation'), `spawn must publish ${channel} through P13-A`);
}

const dangerous = lifecycleEnemy();
dangerous.mutations = ['reinforced-core'];
dangerous.protocols = [{ id: 'gravityAnchor', enhanced: true, cooldown: 0, windup: 0.72, variantId: 'anchor-singularity' }];
dangerous.protocolPulse = 0.76;
dangerous.telegraph = 0.42;
const readiness = dangerousEnemyCombinationReadiness(dangerous);
assert(readiness > 0.7, 'stacked elite modifier windup must become visibly dangerous before execution');
const dangerSignals = resolveEnemyLifecyclePresentation(dangerous, { sinceActivated: 2, sincePhaseChange: -1, sinceDeath: -1 });
const dangerInput = basePresentation();
dangerInput.mutations = ['reinforced-core'];
dangerInput.protocols = dangerous.protocols;
dangerInput.protocolPulse = dangerous.protocolPulse;
dangerInput.telegraph = dangerous.telegraph;
const dangerContract = resolveEnemyPresentation(dangerInput, dangerSignals);
for (const channel of channels) {
  assert(dangerContract[channel].some(layer => layer.key === 'readiness:stacked-threat'), `danger readiness must publish ${channel} through P13-A`);
}
assert.equal(dangerContract.animation[0]?.priority, 4, 'danger readiness must remain in the top combat-information priority band');

const boss = { ...lifecycleEnemy(), role: 'boss' as const, combatClass: 'command' as const, bossPhase: 2 as const };
const phaseSignals = resolveEnemyLifecyclePresentation(boss, { sinceActivated: 3, sincePhaseChange: 0.55, sinceDeath: -1 });
assert(phaseSignals.phaseTransition > 0.99, 'boss phase transition must peak independently from HUD text');
const bossInput = basePresentation();
bossInput.role = 'boss';
bossInput.combatClass = 'command';
bossInput.bossPhase = 2;
const phaseContract = resolveEnemyPresentation(bossInput, phaseSignals);
for (const channel of channels) {
  assert(phaseContract[channel].some(layer => layer.key === 'boss:phase-transition'), `boss phase transition must publish ${channel} through P13-A`);
}

const disabled = lifecycleEnemy();
disabled.dead = true;
disabled.deathT = 0.6;
const disableSignals = resolveEnemyLifecyclePresentation(disabled, { sinceActivated: 4, sincePhaseChange: -1, sinceDeath: 0.2 });
assert(disableSignals.disable > 0.7 && disableSignals.persistentDisabled === 1, 'disable must transition into a persistent post-death read');
const disabledInput = basePresentation();
disabledInput.dead = true;
const disabledContract = resolveEnemyPresentation(disabledInput, disableSignals);
assert(disabledContract.animation.some(layer => layer.key === 'death:disabled'), 'fresh disable must retain collapse animation');
assert(disabledContract.animation.some(layer => layer.key === 'death:persistent'), 'dead enemies must retain persistent visual identity');
assert(disabledContract.audio.length === 1 && disabledContract.audio[0]?.key === 'death:disabled', 'death audio must be one-shot only');

disabled.deathT = 0;
const persistentSignals = resolveEnemyLifecyclePresentation(disabled, { sinceActivated: 8, sincePhaseChange: -1, sinceDeath: 2 });
const persistentContract = resolveEnemyPresentation(disabledInput, persistentSignals);
assert.equal(persistentSignals.disable, 0, 'disable transient must expire');
assert.equal(persistentSignals.persistentDisabled, 1, 'post-disable presentation must remain');
assert.equal(persistentContract.audio.length, 0, 'persistent disabled state must not leak sustained audio');
assert(persistentContract.material.some(layer => layer.key === 'death:persistent'), 'persistent disabled hardware/material read must survive');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
const feedbackSource = readFileSync(resolve(process.cwd(), 'src/game/feedback.ts'), 'utf8');
const lifecycleSource = readFileSync(resolve(process.cwd(), 'src/game/enemyLifecyclePresentation.ts'), 'utf8');

assert(rendererSource.includes('syncEnemyLifecyclePresentation'), 'Three.js must render lifecycle hardware/VFX');
assert(rendererSource.includes('enemy-lifecycle-presentation'), 'Three.js must keep lifecycle presentation on the shared enemy root for authored and procedural rigs');
assert(rendererSource.includes('dataset.enemyLifecyclePresentation'), 'Three.js must expose lifecycle QA telemetry');
assert(rendererSource.includes("reducedTargetMotion ? 'preserved' : 'full'"), 'Three.js must preserve lifecycle identity in reduced-effects mode');
assert(rendererSource.includes('syncAuthoredEnemyAnimation(visual, enemy, state, motion, presentation, lifecycle)'), 'authored enemy animation must consume lifecycle signals');

assert(canvasSource.includes('drawEnemyLifecyclePresentation'), 'Canvas fallback must render lifecycle presentation');
assert(canvasSource.includes('CanvasEnemyLifecycleMemory'), 'Canvas fallback must track presentation-only activation/phase/death edges');
assert(canvasSource.includes('drawEnemyProtocolPresentation(ctx, state, enemy, pos, true)'), 'disabled Canvas enemies must retain readable hardware state without secondary motion');
assert(
  /drawEnemyStatusPresentation\(ctx,[\s\S]{0,220}drawEnemyLifecyclePresentation\(ctx,[\s\S]{0,220}drawEnemyTelegraph\(ctx/.test(canvasSource),
  'Canvas attack telegraph must remain authoritative over lifecycle presentation',
);
assert(canvasSource.includes('dataset.enemyLifecyclePresentation'), 'Canvas runtime must expose lifecycle QA telemetry');
assert(canvasSource.includes("enemyLifecycleReducedEffects = profileSettingsRef.current.effectIntensity === 'reduced' ? 'preserved' : 'full'"), 'Canvas reduced-effects mode must preserve lifecycle identity');

for (const cue of ['enemy-spawn', 'elite-spawn', 'boss-spawn', 'danger-ready', 'enemy-disable', 'boss-disable']) {
  assert(feedbackSource.includes(`'${cue}'`), `feedback mix must own ${cue} lifecycle audio`);
}
assert(canvasSource.includes("feedback.threat('danger-ready')"), 'dangerous-combination readiness audio must fire on fresh readiness');
assert(canvasSource.includes("'boss-disable' : 'enemy-disable'"), 'disable audio must distinguish bosses from other hostiles');

for (const forbidden of ['stepSimulation(', 'stepEnemy(', 'finishEnemyDeath(', 'stepBoss(']) {
  assert(!lifecycleSource.includes(forbidden), `lifecycle presentation must not mutate gameplay through ${forbidden}`);
}

console.log('ENEMY_LIFECYCLE_VISUALS_PASS spawn+phase+readiness+disable+persistent=1 channels=animation+material+vfx+audio authored+fallback=1 priority=tells-first reduced-effects=preserved simulationMutation=0');
