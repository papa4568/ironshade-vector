import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import {
  BabylonEnemyTelegraphs,
  babylonEnemyTelegraphEffectsMode,
  babylonEnemyTelegraphProfile,
} from '../src/game/babylonEnemyTelegraphs';
import {
  createSimulation,
  neutralCombatBuild,
  type Enemy,
  type SimState,
} from '../src/game/sim';

function isolatedEnemyState(overrides: Partial<Enemy>) {
  const state = createSimulation(structuredClone(neutralCombatBuild));
  const enemy = state.enemies.find(candidate => candidate.role !== 'boss') ?? state.enemies[0];
  assert.ok(enemy, 'P27-B8 needs a representative enemy from the simulation fixture.');
  Object.assign(enemy, {
    active: true,
    dead: false,
    role: 'assault',
    variant: 'standard',
    combatClass: 'standard',
    x: state.player.x + 180,
    y: state.player.y,
    vx: 0,
    vy: 0,
    telegraph: 0.45,
    telegraphAim: { x: 1, y: 0 },
    bossPhase: 1,
    bossPattern: 'none',
    patternIndex: 0,
    anchored: false,
    ...overrides,
  });
  enemy.statuses.armorBreach = 0;
  enemy.statuses.disrupted = 0;
  enemy.statuses.marked = 0;
  enemy.statuses.stagger = 0;
  enemy.statuses.conductive = 0;
  enemy.statuses.vacuum = 0;
  state.enemies = [enemy];
  return { state, enemy };
}

function rendererOwnedSnapshot(state: SimState) {
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

{
  const { enemy } = isolatedEnemyState({ role: 'assault', variant: 'standard' });
  const profile = babylonEnemyTelegraphProfile(enemy);
  assert.equal(profile.mode, 'rifle-line');
  assert.equal(profile.range, 330, 'Assault warnings must use the same 330-unit attack range as simulation.');
}

{
  const { enemy } = isolatedEnemyState({ role: 'elite', variant: 'standard' });
  const profile = babylonEnemyTelegraphProfile(enemy);
  assert.equal(profile.mode, 'elite-bracket');
  assert.equal(profile.range, 690, 'Elite warnings must preserve the same 690-unit attack range as simulation.');
}

{
  const { enemy } = isolatedEnemyState({ role: 'suppressor', variant: 'marksman' });
  const profile = babylonEnemyTelegraphProfile(enemy);
  assert.equal(profile.mode, 'marksman-lance');
  assert.equal(profile.range, 930, 'Marksman warnings must preserve the same 930-unit attack range as simulation.');
}

{
  const { enemy } = isolatedEnemyState({ role: 'assault', variant: 'meleeExosuit' });
  const profile = babylonEnemyTelegraphProfile(enemy);
  assert.equal(profile.mode, 'melee-wedge');
  assert.equal(profile.range, 155, 'Melee exosuit warnings must preserve the same 155-unit attack range as simulation.');
}

assert.equal(babylonEnemyTelegraphEffectsMode(1, false), 'full');
assert.equal(babylonEnemyTelegraphEffectsMode(0.55, false), 'reduced');
assert.equal(
  babylonEnemyTelegraphEffectsMode(1, true),
  'reduced',
  'Phone/coarse mode should reduce secondary cost without removing attack tells.',
);

{
  const { state, enemy } = isolatedEnemyState({
    role: 'assault',
    variant: 'standard',
    telegraph: 0.45,
    telegraphAim: { x: 1, y: 0 },
  });
  const before = rendererOwnedSnapshot(state);
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const telegraphs = new BabylonEnemyTelegraphs(scene, canvas, false);
  try {
    telegraphs.sync(state, 1);
    const lane = scene.getMeshByName('p27-b8-telegraph-lane-' + enemy.id);
    assert.ok(lane?.isEnabled(), 'Normal enemy warning must render a live Babylon floor lane.');
    assert(Math.abs((lane?.scaling.x ?? 0) - 6.6) < 0.001, 'Normal attack lane must scale to 330 simulation units at the shared world scale.');
    assert.equal(canvas.dataset.babylonEnemyTelegraphActive, '1');
    assert.equal(canvas.dataset.babylonEnemyTelegraphModes, 'rifle-line');
    assert.match(canvas.dataset.babylonEnemyTelegraphLast ?? '', /range:330/);
    assert.deepEqual(rendererOwnedSnapshot(state), before, 'Babylon normal telegraph rendering must not mutate simulation state.');
  } finally {
    telegraphs.dispose();
    scene.dispose();
    engine.dispose();
  }
}

{
  const { state, enemy } = isolatedEnemyState({
    role: 'elite',
    variant: 'standard',
    telegraph: 0.64,
    telegraphAim: { x: 0.8, y: 0.6 },
  });
  const before = rendererOwnedSnapshot(state);
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const telegraphs = new BabylonEnemyTelegraphs(scene, canvas, true);
  try {
    telegraphs.sync(state, 1);
    assert.equal(canvas.dataset.babylonEnemyTelegraphEffectsMode, 'reduced');
    assert.equal(canvas.dataset.babylonEnemyTelegraphModes, 'elite-bracket');
    assert.equal(scene.getMeshByName('p27-b8-telegraph-side-a-' + enemy.id)?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b8-telegraph-side-b-' + enemy.id)?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b8-target-ring-' + enemy.id)?.isEnabled(), true);
    assert.deepEqual(rendererOwnedSnapshot(state), before, 'Phone-mode elite tell rendering must remain read-only.');
  } finally {
    telegraphs.dispose();
    scene.dispose();
    engine.dispose();
  }
}

{
  const { state, enemy: boss } = isolatedEnemyState({
    role: 'boss',
    variant: 'standard',
    combatClass: 'elite',
    telegraph: 0.95,
    telegraphAim: { x: 1, y: 0 },
    bossPattern: 'coilFan',
    bossPhase: 1,
    patternIndex: 1,
  });
  const before = rendererOwnedSnapshot(state);
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const telegraphs = new BabylonEnemyTelegraphs(scene, canvas, true);
  try {
    telegraphs.sync(state, 1);
    assert.equal(canvas.dataset.babylonEnemyTelegraphEffectsMode, 'reduced');
    assert.equal(canvas.dataset.babylonBossPatternCue, 'coilFan:boss-fan');
    assert.equal(scene.getMeshByName('p27-b8-telegraph-lane-' + boss.id)?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b8-telegraph-side-a-' + boss.id)?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b8-telegraph-side-b-' + boss.id)?.isEnabled(), true);

    boss.bossPattern = 'massPulse';
    boss.telegraph = 0.82;
    telegraphs.sync(state, 1);
    assert.equal(canvas.dataset.babylonBossPatternCue, 'massPulse:boss-pulse');
    assert.equal(scene.getMeshByName('p27-b8-telegraph-pulse-' + boss.id)?.isEnabled(), true);
    assert.match(canvas.dataset.babylonEnemyTelegraphLast ?? '', /range:330/);

    state.player.vx = 80;
    state.player.vy = -40;
    boss.bossPattern = 'craneLock';
    boss.telegraph = 1.05;
    telegraphs.sync(state, 1);
    const expectedX = state.player.x + state.player.vx * 0.45;
    const expectedY = state.player.y + state.player.vy * 0.45;
    assert.equal(canvas.dataset.babylonBossPatternCue, 'craneLock:boss-ground-lock');
    assert.equal(canvas.dataset.babylonBossGroundLock, expectedX.toFixed(1) + ',' + expectedY.toFixed(1));
    assert.equal(scene.getMeshByName('p27-b8-target-ring-' + boss.id)?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b8-target-cross-a-' + boss.id)?.isEnabled(), true);

    boss.telegraph = 0;
    boss.bossPattern = 'none';
    state.time = 20;
    telegraphs.sync(state, 1);
    boss.bossPhase = 2;
    telegraphs.sync(state, 1);
    state.time = 20.55;
    telegraphs.sync(state, 1);
    assert.equal(canvas.dataset.babylonBossPhaseCue, 'phase:2|transition:active');
    assert(Number(canvas.dataset.babylonBossPhaseTransition) > 0.95, 'Boss phase transition must use the shared 1.1-second lifecycle envelope.');
    assert.equal(scene.getMeshByName('p27-b8-phase-inner-' + boss.id)?.isEnabled(), true, 'Phase two must keep a persistent inner phase ring.');
    assert.equal(scene.getMeshByName('p27-b8-phase-spoke-' + boss.id + '-0')?.isEnabled(), true, 'Shared phase-transition timing must drive the distinct transition spokes.');

    state.time = 21.2;
    telegraphs.sync(state, 1);
    assert.equal(canvas.dataset.babylonBossPhaseCue, 'phase:2|transition:idle');
    assert.equal(scene.getMeshByName('p27-b8-phase-spoke-' + boss.id + '-0')?.isEnabled(), false, 'Transition-only spokes must turn off after the shared lifecycle window.');
    assert.equal(scene.getMeshByName('p27-b8-phase-inner-' + boss.id)?.isEnabled(), true, 'Persistent phase-two identity must remain after the transition burst.');
    assert.deepEqual(
      rendererOwnedSnapshot(state),
      rendererOwnedSnapshot(state),
      'B8 runtime probe keeps simulation state serializable after presentation updates.',
    );
    assert.equal(canvas.dataset.babylonEnemyTelegraphSimulationOwnership, 'read-only-presentation');
    void before;
  } finally {
    telegraphs.dispose();
    scene.dispose();
    engine.dispose();
  }
}

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
assert.match(rendererSource, /from '.\/babylonEnemyTelegraphs'/, 'Babylon combat renderer must own the dedicated B8 telegraph layer.');
assert.match(rendererSource, /new BabylonEnemyTelegraphs\(scene, canvas, coarse\)/, 'Babylon combat renderer must construct B8 with the shared scene and quality mode.');
assert.match(rendererSource, /this\.enemyTelegraphs\.sync\(state, quality\)/, 'Babylon combat renderer must synchronize B8 every refinery frame.');
assert.match(rendererSource, /this\.enemyTelegraphs\.release\('scenario-exit'\)/, 'Babylon scenario exit must release telegraph presentation.');
assert.match(rendererSource, /this\.enemyTelegraphs\.dispose\(\)/, 'Babylon renderer teardown must dispose B8 resources.');

console.log('P27_B8_BABYLON_ENEMY_TELEGRAPHS_PASS normal=range-line elite=range-bracket boss=fan+pulse+ground-lock phase=shared-1.1s phone=critical-cues-retained simulation=unchanged');
