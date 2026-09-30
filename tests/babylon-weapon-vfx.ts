import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import {
  BabylonWeaponVfx,
  babylonWeaponEffectsMode,
  babylonWeaponFireFxName,
  babylonWeaponImpactProfile,
  babylonWeaponProjectileProfile,
} from '../src/game/babylonWeaponVfx';
import {
  createSimulation,
  neutralCombatBuild,
  triggerFire,
  type CombatBuild,
  type WeaponId,
} from '../src/game/sim';
import type { OperatorClassId } from '../src/game/classArsenal';

const carbine = babylonWeaponProjectileProfile('carbine');
const breacher = babylonWeaponProjectileProfile('breacher');
const rail = babylonWeaponProjectileProfile('rail');
const enemy = babylonWeaponProjectileProfile('enemy');

assert.equal(carbine.mode, 'tracer', 'Carbine must retain a compact tracer presentation in Babylon.');
assert.equal(breacher.mode, 'scatter-slug', 'Breacher must retain a broad, short-trail primary-fire silhouette in Babylon.');
assert.equal(rail.mode, 'beam-lance', 'Rail must retain a long beam-like primary-fire silhouette in Babylon.');
assert.equal(enemy.mode, 'enemy-bolt', 'Enemy projectile fallback must remain visually separate from the three player families.');
assert(rail.trailScaleX > carbine.trailScaleX && carbine.trailScaleX > breacher.trailScaleX, 'Rail, Carbine, and Breacher trail lengths must remain family-distinct.');
assert(breacher.coreScaleX > carbine.coreScaleX && carbine.coreScaleX > rail.coreScaleX, 'Breacher, Carbine, and Rail core silhouettes must remain family-distinct.');

assert.equal(babylonWeaponFireFxName('carbine', 'carbine-burst'), 'burst-tracer');
assert.equal(babylonWeaponFireFxName('carbine', 'carbine-precision'), 'precision-tracer');
assert.equal(babylonWeaponFireFxName('breacher', 'breacher-slug'), 'slug-impact');
assert.equal(babylonWeaponFireFxName('breacher', 'breacher-rapid'), 'rapid-scatter');
assert.equal(babylonWeaponFireFxName('rail', 'rail-charge'), 'charge-lance');
assert.equal(babylonWeaponFireFxName('rail', 'rail-repeater'), 'repeater-lance');

assert.equal(
  babylonWeaponImpactProfile({ serial: 1, target: 'enemy', surface: 'armor', heavy: false }).language,
  'armor-spark',
  'Armored enemy hits must keep the shared cyan armor-spark language.',
);
assert.equal(
  babylonWeaponImpactProfile({ serial: 2, target: 'enemy', surface: 'steel', heavy: false }).language,
  'hull-spall',
  'Unarmored enemy hits must keep the warm hull-spall language.',
);
assert.equal(
  babylonWeaponImpactProfile({ serial: 3, target: 'enemy', surface: 'field', heavy: false }).language,
  'field-flash',
  'Field impacts must remain visually distinct from armor and hull hits.',
);
assert.equal(
  babylonWeaponImpactProfile({ serial: 4, target: 'object', material: 'bulkhead', objectKind: 'cover', heavy: true }).language,
  'metal-spark',
  'Bulkhead impacts must keep the metal-spark material language.',
);
assert.equal(
  babylonWeaponImpactProfile({ serial: 5, target: 'object', material: 'system', objectKind: 'conduit', heavy: false }).language,
  'electrical-flash',
  'System impacts must keep the electrical-flash material language.',
);
assert(
  babylonWeaponImpactProfile({ serial: 6, target: 'object', material: 'industrial', objectKind: 'cover', heavy: true }).heavyScale > 1,
  'Heavy impacts must amplify presentation only, without changing simulation damage.',
);

assert.equal(babylonWeaponEffectsMode(1, false), 'full', 'Desktop/high-detail mode should keep secondary impact sparks.');
assert.equal(babylonWeaponEffectsMode(0.55, false), 'reduced', 'Low detail should suppress secondary weapon VFX first.');
assert.equal(babylonWeaponEffectsMode(1, true), 'reduced', 'Coarse/mobile presentation should keep primary cues while reducing secondary sparks.');

function liveFamilySnapshot(operatorClass: OperatorClassId, expectedWeapon: WeaponId) {
  const build: CombatBuild = { ...neutralCombatBuild, operatorClass };
  const state = createSimulation(build);
  assert.equal(state.player.currentWeapon, expectedWeapon, `${operatorClass} must boot into ${expectedWeapon} before the Babylon VFX parity probe.`);
  state.player.aim = { x: 1, y: 0 };

  const beforeShots = state.telemetry.weaponShots[expectedWeapon];
  assert.equal(triggerFire(state), true, `${expectedWeapon} representative primary fire must succeed before Babylon rendering.`);
  const playerProjectiles = state.projectiles.filter(projectile => projectile.active && projectile.owner === 'player');
  assert(playerProjectiles.length > 0, `${expectedWeapon} primary fire must create simulation-owned projectile state.`);
  assert.equal(state.telemetry.weaponShots[expectedWeapon], beforeShots + 1, `${expectedWeapon} shot timing must remain simulation-owned.`);
  assert(state.weaponFlash > 0, `${expectedWeapon} primary fire must expose the shared simulation muzzle timing signal.`);

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const vfx = new BabylonWeaponVfx(scene, canvas, false);
  try {
    vfx.sync(state, new Vector3(1.5, 1.1, 0.25), 1);
    assert.equal(canvas.dataset.babylonWeaponMuzzleFx, 'authored-socket-live', `${expectedWeapon} must render a live muzzle cue from the authored socket origin.`);
    assert.equal(canvas.dataset.babylonWeaponProjectileFamilies, expectedWeapon, `${expectedWeapon} must render its simulation projectile family in Babylon.`);
    assert.equal(Number(canvas.dataset.babylonWeaponProjectileCount), playerProjectiles.length, `${expectedWeapon} Babylon projectile count must stay synchronized with simulation state.`);
    assert.equal(Number(canvas.dataset.babylonWeaponShotCount), state.telemetry.weaponShots[expectedWeapon], `${expectedWeapon} Babylon shot telemetry must stay synchronized with simulation timing.`);
    assert.equal(canvas.dataset.babylonWeaponFireFx, babylonWeaponFireFxName(expectedWeapon, state.weapons[expectedWeapon].variantId), `${expectedWeapon} must select the matching Babylon family fire language.`);
    assert.equal(scene.getMeshByName('p27-b6-projectile-core-0')?.isEnabled(), true, `${expectedWeapon} must produce an enabled Babylon projectile mesh.`);
  } finally {
    vfx.dispose();
    scene.dispose();
    engine.dispose();
  }

  return {
    operatorClass,
    weapon: expectedWeapon,
    projectiles: playerProjectiles.length,
    shots: state.telemetry.weaponShots[expectedWeapon],
  };
}

const liveFamilies = [
  liveFamilySnapshot('systems', 'carbine'),
  liveFamilySnapshot('vanguard', 'breacher'),
  liveFamilySnapshot('vector', 'rail'),
];
assert.deepEqual(
  liveFamilies.map(entry => entry.weapon).sort(),
  ['breacher', 'carbine', 'rail'],
  'P27-B6 must exercise live Babylon primary-fire rendering for all three player weapon families.',
);

console.log(`P27_B6_BABYLON_WEAPON_VFX_PASS families=${liveFamilies.map(entry => entry.weapon).join('+')} live=${liveFamilies.map(entry => `${entry.weapon}:${entry.projectiles}p/${entry.shots}s`).join(',')} muzzle=authored-socket projectiles=sim-state impact=shared-event reduced=secondary-sparks-only simulation=unchanged`);
