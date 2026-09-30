import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import {
  BabylonProtocolStatusVisuals,
  babylonProtocolStatusEffectsMode,
} from '../src/game/babylonProtocolStatusVisuals';
import {
  createSimulation,
  neutralCombatBuild,
  type Enemy,
  type SimState,
} from '../src/game/sim';

function isolatedEnemyState(overrides: Partial<Enemy>) {
  const state = createSimulation(structuredClone(neutralCombatBuild));
  const enemy = state.enemies.find(candidate => candidate.role !== 'boss') ?? state.enemies[0];
  assert.ok(enemy, 'P27-B9 needs a representative enemy from the simulation fixture.');
  Object.assign(enemy, {
    active: true,
    dead: false,
    role: 'elite',
    variant: 'standard',
    combatClass: 'enhanced',
    x: state.player.x + 180,
    y: state.player.y,
    vx: 0,
    vy: 0,
    telegraph: 0,
    protocolPulse: 0.8,
    mutations: [],
    protocols: [],
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

function syncReadOnly(visuals: BabylonProtocolStatusVisuals, state: SimState, detailScale: number) {
  const before = rendererOwnedSnapshot(state);
  visuals.sync(state, detailScale);
  assert.deepEqual(rendererOwnedSnapshot(state), before, 'Babylon protocol/status presentation must remain read-only.');
}

assert.equal(babylonProtocolStatusEffectsMode(1, false), 'full');
assert.equal(babylonProtocolStatusEffectsMode(0.55, false), 'reduced');
assert.equal(
  babylonProtocolStatusEffectsMode(1, true),
  'reduced',
  'Phone/coarse mode must retain critical shapes while reducing secondary presentation cost.',
);

{
  const { state, enemy } = isolatedEnemyState({});
  enemy.protocols = [{
    id: 'emergencyShutters',
    enhanced: true,
    cooldown: 0,
    windup: 0.6,
    variantId: 'cross-shutter',
    combinationId: 'kill-corridor',
  }];
  enemy.mutations = ['reinforced-core', 'hunter-servo'];
  enemy.statuses.disrupted = 0.8;
  enemy.statuses.marked = 0.72;
  state.player.weaponHeat[state.player.currentWeapon] = 0.92;
  state.player.disrupted = 0.78;

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const visuals = new BabylonProtocolStatusVisuals(scene, canvas, false);
  try {
    syncReadOnly(visuals, state, 0.55);
    assert.equal(canvas.dataset.babylonProtocolStatusEffectsMode, 'reduced');
    assert.equal(canvas.dataset.babylonEnemyProtocols, 'emergencyShutters:cross-shutter');
    assert.equal(canvas.dataset.babylonEnemyMutations, 'hunter-servo,reinforced-core');
    assert.equal(canvas.dataset.babylonEnemyStatuses, 'disrupted,marked');
    assert.equal(canvas.dataset.babylonPlayerStatuses, 'disrupted,thermal');
    assert.equal(canvas.dataset.babylonPlayerStatusDominant, 'disrupted');
    assert.equal(canvas.dataset.babylonProtocolStatusSimulationOwnership, 'read-only-presentation');

    const housing = scene.getMeshByName('p27-b9-protocol-housing-' + enemy.id + '-0');
    assert.equal(housing?.isEnabled(), true, 'Performance tier must retain protocol hardware.');
    assert((housing?.scaling.x ?? 0) > (housing?.scaling.z ?? 0) * 3, 'Protocol clamp hardware must remain shape-coded without relying on hue.');
    assert.equal(scene.getMeshByName('p27-b9-protocol-field-' + enemy.id + '-0')?.isEnabled(), true, 'Performance tier must retain protocol field geometry.');
    assert.equal(scene.getMeshByName('p27-b9-protocol-enhanced-ring-' + enemy.id + '-0')?.isEnabled(), true, 'Enhanced protocol identity must retain its ring.');
    assert.equal(scene.getMeshByName('p27-b9-protocol-enhanced-spoke-' + enemy.id + '-0-0')?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-protocol-enhanced-spoke-' + enemy.id + '-0-1')?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-protocol-enhanced-spoke-' + enemy.id + '-0-2')?.isEnabled(), false, 'Performance tier should trim secondary enhanced spokes after preserving the physical marker.');

    assert.equal(scene.getMeshByName('p27-b9-mutation-reinforced-core-brace-left-' + enemy.id)?.isEnabled(), true, 'Reinforced Core must retain brace hardware.');
    assert.equal(scene.getMeshByName('p27-b9-mutation-reinforced-core-core-glow-' + enemy.id)?.isEnabled(), true, 'Reinforced Core must retain its field.');
    assert.equal(scene.getMeshByName('p27-b9-mutation-hunter-servo-housing-' + enemy.id)?.isEnabled(), true, 'Hunter Servo must remain physically distinct.');
    assert.equal(scene.getMeshByName('p27-b9-mutation-hunter-servo-reticle-' + enemy.id)?.isEnabled(), true, 'Hunter Servo must retain its tracking reticle.');
    assert.equal(scene.getMeshByName('p27-b9-mutation-hunter-servo-streak-right-' + enemy.id)?.isEnabled(), false, 'Performance tier should trim duplicate servo streak detail.');

    const disruptedMarker = scene.getMeshByName('p27-b9-enemy-status-marker-disrupted-' + enemy.id);
    const markedMarker = scene.getMeshByName('p27-b9-enemy-status-marker-marked-' + enemy.id);
    assert.equal(disruptedMarker?.isEnabled(), true);
    assert.equal(markedMarker?.isEnabled(), true);
    assert.notEqual(
      disruptedMarker?.getTotalVertices(),
      markedMarker?.getTotalVertices(),
      'Enemy statuses must remain distinguishable by marker geometry, not just color.',
    );
    const disruptedNodes = [0, 1, 2, 3].filter(index =>
      scene.getMeshByName('p27-b9-enemy-status-node-disrupted-' + enemy.id + '-' + index)?.isEnabled()).length;
    assert.equal(disruptedNodes, 3, 'Performance tier must keep the critical marker while trimming one secondary status node.');

    assert.equal(scene.getMeshByName('p27-b9-player-status-field-disrupted')?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-player-status-field-thermal')?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-player-status-marker-disrupted-0')?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-player-status-marker-disrupted-1')?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-player-status-marker-disrupted-2')?.isEnabled(), false, 'Performance tier must retain two player-status shape markers.');

    enemy.telegraph = 0.7;
    syncReadOnly(visuals, state, 0.55);
    const statusMaterial = disruptedMarker?.material;
    assert.ok(statusMaterial && 'alpha' in statusMaterial && Number(statusMaterial.alpha) < 0.8, 'Attack telegraph priority must dim overlapping status material rather than obscure the tell.');

    visuals.release('test-exit');
    assert.equal(scene.getTransformNodeByName('p27-b9-enemy-signal-root-' + enemy.id)?.isEnabled(), false);
    assert.equal(canvas.dataset.babylonPlayerStatusDominant, 'none');
  } finally {
    visuals.dispose();
    scene.dispose();
    engine.dispose();
  }
}

{
  const { state, enemy } = isolatedEnemyState({});
  enemy.protocols = [{
    id: 'penetratorVolley',
    enhanced: true,
    cooldown: 0,
    windup: 0.7,
    variantId: 'cross-fan-volley',
    combinationId: 'kill-corridor',
  }];
  enemy.mutations = ['redline-bus', 'countermass-rig', 'relay-reflex'];
  enemy.statuses.conductive = 0.84;
  enemy.statuses.vacuum = 0.66;

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const visuals = new BabylonProtocolStatusVisuals(scene, canvas, false);
  try {
    syncReadOnly(visuals, state, 1);
    assert.equal(canvas.dataset.babylonProtocolStatusEffectsMode, 'full');
    assert.equal(scene.getMeshByName('p27-b9-protocol-enhanced-spoke-' + enemy.id + '-0-3')?.isEnabled(), true, 'Full tier must retain all authored enhanced spokes.');
    assert.equal(scene.getMeshByName('p27-b9-mutation-redline-bus-spine-' + enemy.id)?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-mutation-countermass-rig-pod-left-' + enemy.id)?.isEnabled(), true);
    assert.equal(scene.getMeshByName('p27-b9-mutation-relay-reflex-node-1-' + enemy.id)?.isEnabled(), true);
    const conductiveNodes = [0, 1, 2, 3, 4].filter(index =>
      scene.getMeshByName('p27-b9-enemy-status-node-conductive-' + enemy.id + '-' + index)?.isEnabled()).length;
    assert.equal(conductiveNodes, 5, 'Full tier must retain the complete conductive status node signature.');
  } finally {
    visuals.dispose();
    scene.dispose();
    engine.dispose();
  }
}

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
const visualSource = readFileSync('src/game/babylonProtocolStatusVisuals.ts', 'utf8');

assert.match(rendererSource, /from '.\/babylonProtocolStatusVisuals'/, 'Babylon combat renderer must own the dedicated B9 presentation layer.');
assert.match(rendererSource, /new BabylonProtocolStatusVisuals\(scene, canvas, coarse\)/, 'Babylon renderer must construct B9 with shared quality mode.');
assert.match(rendererSource, /this\.protocolStatusVisuals\.sync\(state, quality\)/, 'Babylon renderer must synchronize B9 every refinery frame.');
assert.match(rendererSource, /this\.protocolStatusVisuals\.release\('scenario-exit'\)/, 'Babylon scenario exit must release B9 presentation.');
assert.match(rendererSource, /this\.protocolStatusVisuals\.dispose\(\)/, 'Babylon teardown must dispose B9 resources.');
assert.match(packageSource, /test:babylon-protocol-status/, 'Production build contract must include the targeted B9 regression.');
assert.match(visualSource, /protocolVisualSpecFor/, 'B9 must consume existing protocol visual presentation data.');
assert.match(visualSource, /resolveEnemyPresentation/, 'B9 must consume the shared enemy presentation priority contract.');
assert.match(visualSource, /resolvePlayerStatusVisuals/, 'B9 must consume existing player status presentation data.');
for (const forbidden of ['stepSimulation(', 'dealEnemyDamage(', 'stepEnemyProtocols(', 'chooseEnemyProtocols(']) {
  assert.equal(visualSource.includes(forbidden), false, 'B9 Babylon presentation must not own simulation mutation through ' + forbidden);
}

console.log('P27_B9_BABYLON_PROTOCOL_STATUS_PASS protocols=shape-coded enhanced=performance-safe mutations=6 enemy-status=geometry-coded player-status=stacked priority=telegraphs-first simulation=unchanged');
