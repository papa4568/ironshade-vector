import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Scene } from '@babylonjs/core/scene';
import {
  BabylonEnemyLifecycleVisuals,
  babylonEnemyLifecycleEffectsMode,
} from '../src/game/babylonEnemyLifecycleVisuals';
import {
  createSimulation,
  neutralCombatBuild,
  type Enemy,
  type SimState,
} from '../src/game/sim';

function isolatedState(overrides: Partial<Enemy> = {}) {
  const state = createSimulation(structuredClone(neutralCombatBuild));
  const enemy = state.enemies.find(candidate => candidate.role !== 'boss') ?? state.enemies[0];
  assert.ok(enemy, 'P27-B10 needs a representative enemy fixture.');
  Object.assign(enemy, {
    active: true,
    dead: false,
    role: 'assault',
    variant: 'standard',
    combatClass: 'standard',
    x: state.player.x + 160,
    y: state.player.y,
    hp: enemy.maxHp,
    armor: enemy.maxArmor,
    telegraph: 0,
    protocolPulse: 0,
    bossPhase: 1,
    ...overrides,
  });
  enemy.protocols = [];
  enemy.mutations = [];
  enemy.commandTargetMutations = [];
  enemy.bossPhaseMutations = [];
  for (const key of Object.keys(enemy.statuses) as Array<keyof typeof enemy.statuses>) {
    enemy.statuses[key] = 0;
  }
  state.enemies = [enemy];
  return { state, enemy };
}

function snapshot(state: SimState) {
  return structuredClone({
    time: state.time,
    player: state.player,
    enemies: state.enemies,
    projectiles: state.projectiles,
    hazards: state.hazards,
    effects: state.effects,
    impactEvent: state.impactEvent,
    telemetry: state.telemetry,
  });
}

function syncReadOnly(
  visuals: BabylonEnemyLifecycleVisuals,
  state: SimState,
  targetId: number | null,
  detailScale: number,
  reducedTargetMotion = false,
) {
  const before = snapshot(state);
  visuals.sync(state, targetId, detailScale, reducedTargetMotion);
  assert.deepEqual(snapshot(state), before, 'Babylon B10 presentation must not mutate simulation state.');
}

assert.equal(babylonEnemyLifecycleEffectsMode(1, false), 'full');
assert.equal(babylonEnemyLifecycleEffectsMode(0.55, false), 'reduced');
assert.equal(babylonEnemyLifecycleEffectsMode(1, true), 'full');

{
  const { state, enemy } = isolatedState();
  state.time = 10;
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const visuals = new BabylonEnemyLifecycleVisuals(scene, canvas, false);
  try {
    syncReadOnly(visuals, state, null, 1);
    assert.equal(scene.getMeshByName('p27-b10-spawn-ring-' + enemy.id)?.isEnabled(), true, 'Fresh activation must publish the shared spawn cue.');
    assert.equal(scene.getMeshByName('p27-b10-health-back-' + enemy.id)?.isEnabled(), true, 'Desktop parity keeps active hostile durability visible.');
    assert.match(canvas.dataset.babylonEnemyLifecyclePresentation ?? '', /spawn/);
    assert.equal(canvas.dataset.babylonEnemyLifecycleSimulationOwnership, 'read-only-presentation');

    state.time = 11.1;
    syncReadOnly(visuals, state, null, 1);
    assert.equal(scene.getMeshByName('p27-b10-spawn-ring-' + enemy.id)?.isEnabled(), false, 'Spawn cue must end after the shared 0.95-second envelope.');

    enemy.combatClass = 'elite';
    enemy.protocols = [{
      id: 'gravityAnchor',
      enhanced: true,
      cooldown: 0,
      windup: 0.72,
      variantId: 'anchor-singularity',
    }];
    enemy.mutations = ['reinforced-core'];
    enemy.protocolPulse = 0.76;
    enemy.telegraph = 0.42;
    syncReadOnly(visuals, state, null, 1);
    const danger = scene.getMeshByName('p27-b10-danger-ring-' + enemy.id);
    assert.equal(danger?.isEnabled(), true, 'Stacked command threats must retain the shared readiness cue.');
    assert.match(canvas.dataset.babylonEnemyLifecyclePresentation ?? '', /readiness/);
    const dangerMaterial = danger?.material as StandardMaterial | null;
    assert.ok((dangerMaterial?.alpha ?? 1) < 0.8, 'Attack telegraphs must remain visually authoritative over lifecycle readiness.');

    enemy.telegraph = 0;
    enemy.protocolPulse = 0;
    enemy.dead = true;
    enemy.deathT = 0.6;
    state.time = 12;
    syncReadOnly(visuals, state, enemy.id, 1);
    assert.equal(scene.getMeshByName('p27-b10-disabled-ring-' + enemy.id)?.isEnabled(), true, 'Death must transition into a persistent disabled read.');
    assert.equal(scene.getMeshByName('p27-b10-target-ring-' + enemy.id)?.isEnabled(), false, 'Dead enemies must release target-lock readability.');
    assert.equal(scene.getMeshByName('p27-b10-health-back-' + enemy.id)?.isEnabled(), false, 'Dead enemies must not retain a live health bar.');

    enemy.deathT = 0;
    state.time = 14;
    syncReadOnly(visuals, state, null, 1);
    assert.equal(scene.getMeshByName('p27-b10-disabled-ring-' + enemy.id)?.isEnabled(), true, 'Persistent disabled hardware must survive after the transient collapse.');

    state.enemies = [];
    syncReadOnly(visuals, state, null, 1);
    assert.equal(scene.getTransformNodeByName('p27-b10-lifecycle-root-' + enemy.id), null, 'Despawn must deterministically release B10 world cues.');
    assert.equal(canvas.dataset.babylonEnemyLifecycleTracked, '0');
    assert.match(canvas.dataset.babylonEnemyLifecycleCleanup ?? '', /released:1/);
  } finally {
    visuals.dispose();
    scene.dispose();
    engine.dispose();
  }
}

{
  const { state, enemy } = isolatedState();
  state.time = 20;
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const visuals = new BabylonEnemyLifecycleVisuals(scene, canvas, true);
  try {
    syncReadOnly(visuals, state, null, 1, true);
    assert.equal(canvas.dataset.babylonEnemyLifecycleEffectsMode, 'full');
    assert.match(canvas.dataset.babylonEnemyReadability ?? '', /mobile-lod2/);
    assert.equal(scene.getMeshByName('p27-b10-health-back-' + enemy.id)?.isEnabled(), false, 'Pristine untargeted common enemies must shed redundant mobile bars.');

    syncReadOnly(visuals, state, enemy.id, 1, true);
    assert.equal(scene.getMeshByName('p27-b10-target-ring-' + enemy.id)?.isEnabled(), true, 'Assisted target lock must remain visible in reduced-motion mobile mode.');
    assert.equal(scene.getMeshByName('p27-b10-target-spoke-' + enemy.id + '-0')?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b10-target-spoke-' + enemy.id + '-2')?.isEnabled(), true, 'Target identity must use geometry rather than hue alone.');
    assert.equal(scene.getMeshByName('p27-b10-health-back-' + enemy.id)?.isEnabled(), true, 'Focused mobile enemies must retain their durability bar.');
    assert.match(canvas.dataset.babylonEnemyFocusedTarget ?? '', new RegExp('^' + enemy.id + ':assault:standard$'));
    assert.equal(canvas.dataset.babylonEnemyLifecycleReducedEffects, 'preserved');

    enemy.hp = enemy.maxHp * 0.49;
    syncReadOnly(visuals, state, null, 1, true);
    assert.equal(scene.getMeshByName('p27-b10-health-back-' + enemy.id)?.isEnabled(), true, 'Critical durability must remain readable without target lock.');
    assert.equal(scene.getMeshByName('p27-b10-critical-bracket-' + enemy.id + '--1')?.isEnabled(), true, 'Critical damage state must add shape-coded brackets.');

    enemy.hp = enemy.maxHp;
    enemy.armor = 0;
    syncReadOnly(visuals, state, null, 1, true);
    assert.equal(scene.getMeshByName('p27-b10-armor-break-bracket-' + enemy.id + '-1')?.isEnabled(), true, 'Armor break must retain its independent shape-coded marker.');
    assert.equal(scene.getMeshByName('p27-b10-health-back-' + enemy.id)?.isEnabled(), true, 'Armor break must preserve priority mobile durability.');
  } finally {
    visuals.dispose();
    scene.dispose();
    engine.dispose();
  }
}

{
  const { state, enemy } = isolatedState({
    role: 'boss',
    combatClass: 'elite',
    bossPhase: 1,
    variant: 'standard',
  });
  state.time = 30;
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const visuals = new BabylonEnemyLifecycleVisuals(scene, canvas, false);
  try {
    syncReadOnly(visuals, state, null, 1);
    state.time = 31;
    enemy.bossPhase = 2;
    syncReadOnly(visuals, state, null, 1);
    state.time = 31.55;
    syncReadOnly(visuals, state, null, 1);
    assert.equal(scene.getMeshByName('p27-b10-phase-ring-' + enemy.id)?.isEnabled(), true, 'Boss lifecycle must consume the shared phase-transition envelope.');
    assert.match(canvas.dataset.babylonEnemyLifecyclePresentation ?? '', /phase/);
    assert.equal(canvas.dataset.babylonEnemyLifecycleTarget, 'boss:standard');

    state.time = 32.2;
    syncReadOnly(visuals, state, null, 1);
    assert.equal(scene.getMeshByName('p27-b10-phase-ring-' + enemy.id)?.isEnabled(), false, 'Lifecycle phase hardware must retire after the shared transition window.');
  } finally {
    visuals.dispose();
    scene.dispose();
    engine.dispose();
  }
}

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
const visualSource = readFileSync('src/game/babylonEnemyLifecycleVisuals.ts', 'utf8');

assert.match(rendererSource, /from '.\/babylonEnemyLifecycleVisuals'/, 'Babylon renderer must own the dedicated B10 lifecycle/readability layer.');
assert.match(rendererSource, /new BabylonEnemyLifecycleVisuals\(scene, canvas, coarse\)/);
assert.match(rendererSource, /this\.enemyLifecycleVisuals\.sync\(state, mobileTargetId, quality, reducedTargetMotion\)/, 'Babylon must consume the existing assisted-target and reduced-motion inputs.');
assert.match(rendererSource, /this\.enemyLifecycleVisuals\.release\('scenario-exit'\)/);
assert.match(rendererSource, /this\.enemyLifecycleVisuals\.dispose\(\)/);
assert.match(packageSource, /test:babylon-enemy-lifecycle/, 'Production build must execute the B10 targeted regression.');
assert.match(visualSource, /resolveEnemyLifecyclePresentation/, 'B10 must consume the shared lifecycle contract.');
assert.match(visualSource, /resolveEnemyHudReadability/, 'B10 must consume the shared mobile readability policy.');
assert.match(visualSource, /enemyHudReadabilityTelemetry/, 'B10 must expose the shared mobile-readability QA contract.');
for (const forbidden of ['stepSimulation(', 'dealEnemyDamage(', 'finishEnemyDeath(', 'stepEnemy(', 'stepBoss(']) {
  assert.equal(visualSource.includes(forbidden), false, 'B10 presentation must not mutate gameplay through ' + forbidden);
}

console.log('P27_B10_BABYLON_ENEMY_LIFECYCLE_PASS spawn=shared readiness=shared damage=critical+armor-break death=persistent despawn=released target=shape-coded mobile=priority-bars reduced-motion=identity-preserved boss-phase=shared simulation=unchanged');
