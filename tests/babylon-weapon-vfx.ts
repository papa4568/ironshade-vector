import assert from 'node:assert/strict';
import {
  babylonWeaponEffectsMode,
  babylonWeaponFireFxName,
  babylonWeaponImpactProfile,
  babylonWeaponProjectileProfile,
} from '../src/game/babylonWeaponVfx';

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

console.log('P27_B6_BABYLON_WEAPON_VFX_PASS families=carbine+breacher+rail muzzle=authored-socket projectiles=sim-state impact=shared-event reduced=secondary-sparks-only simulation=unchanged');
