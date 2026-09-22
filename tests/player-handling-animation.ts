import assert from 'node:assert/strict';
import {
  playerHandlingAnimationProfiles,
  resolvePlayerHandlingAnimation,
  type HandlingOperatorClass,
} from '../src/game/playerHandlingAnimation';
import type { WeaponId } from '../src/game/sim';

const classes: Exclude<HandlingOperatorClass, null>[] = ['vanguard', 'vector', 'systems'];
const stanceIds = new Set(classes.map(operatorClass => playerHandlingAnimationProfiles[operatorClass].id));
assert.equal(stanceIds.size, classes.length, 'Each class needs a distinct handling stance');

const armSignatures = new Set(classes.map(operatorClass => {
  const profile = playerHandlingAnimationProfiles[operatorClass];
  return `${profile.leftArm.toFixed(3)}:${profile.rightArm.toFixed(3)}`;
}));
assert.equal(armSignatures.size, classes.length, 'Each class needs a distinct upper-body silhouette');

const dodgeWeights = new Set(classes.map(operatorClass => playerHandlingAnimationProfiles[operatorClass].dodgeWeight));
assert.equal(dodgeWeights.size, classes.length, 'Each class needs distinct dodge weight');

function sample(operatorClass: HandlingOperatorClass, weapon: WeaponId, overrides: Partial<Parameters<typeof resolvePlayerHandlingAnimation>[0]> = {}) {
  return resolvePlayerHandlingAnimation({
    operatorClass,
    weapon,
    time: 2.35,
    vx: 180,
    vy: 40,
    aimX: 0,
    aimY: 1,
    moveX: 1,
    moveY: 0,
    weaponFlash: 0.06,
    fireCooldown: 0.45,
    weaponRate: weapon === 'rail' ? 0.82 : weapon === 'breacher' ? 1.25 : 7.8,
    firingIntent: false,
    reloadT: 0,
    reloadDuration: 1.6,
    ventT: 0,
    ventDuration: 0.9,
    heat: 0.4,
    dodgeTime: 0,
    hit: 0,
    ...overrides,
  });
}

const vanguard = sample('vanguard', 'breacher');
const vector = sample('vector', 'rail');
const systems = sample('systems', 'carbine');
assert.equal(vanguard.aimOffset, 1);
assert.equal(vector.aimOffset, 1);
assert.equal(systems.aimOffset, 1);
assert.notEqual(vanguard.profile.aimLean, vector.profile.aimLean);
assert.notEqual(vector.profile.aimLean, systems.profile.aimLean);

assert.equal(sample('vector', 'rail', { firingIntent: true, fireCooldown: 1.22 }).charge, 0, 'Rail charge starts after a committed shot');
assert.ok(sample('vector', 'rail', { firingIntent: true, fireCooldown: 0.1 }).charge > 0.8, 'Rail charge should visibly rise between held-fire shots');
assert.equal(sample('systems', 'carbine', { firingIntent: true, fireCooldown: 0.02 }).charge, 0, 'Carbine should not reuse rail charge posture');
assert.equal(sample('vanguard', 'breacher', { firingIntent: true, fireCooldown: 0.1 }).charge, 0, 'Breacher should not reuse rail charge posture');

assert.equal(sample('systems', 'carbine', { heat: 0.7 }).overheat, 0);
assert.ok(sample('systems', 'carbine', { heat: 0.92 }).overheat > 0.7, 'High heat needs readable overheat strain');

const reload = sample('vanguard', 'breacher', { reloadT: 0.8, reloadDuration: 1.6 }).reload;
const vent = sample('systems', 'carbine', { ventT: 0.45, ventDuration: 0.9 }).vent;
const dodge = sample('vector', 'rail', { dodgeTime: 0.09 }).dodge;
assert.equal(reload, 0.5);
assert.equal(vent, 0.5);
assert.equal(dodge, 0.5);

for (const operatorClass of classes) {
  const profile = playerHandlingAnimationProfiles[operatorClass];
  assert.ok(profile.recoilScale >= 0.75 && profile.recoilScale <= 1.25, `${operatorClass} recoil presentation is out of bounds`);
  assert.ok(profile.dodgeWeight >= 0.7 && profile.dodgeWeight <= 1.25, `${operatorClass} dodge presentation is out of bounds`);
  assert.ok(Math.abs(profile.aimLean) <= 0.2, `${operatorClass} aim offset is too extreme for mobile readability`);
  assert.ok(profile.overheatStrain > 0 && profile.overheatStrain <= 0.16, `${operatorClass} overheat strain is out of bounds`);
}

console.log(`PLAYER_HANDLING_ANIMATION_PASS stances=${stanceIds.size} charge=rail-only overheat=readable dodgeWeights=${dodgeWeights.size}`);
