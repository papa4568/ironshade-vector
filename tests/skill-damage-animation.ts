import assert from 'node:assert/strict';
import {
  classSkillAnimationProfiles,
  resolveEnemyDamageAnimation,
  resolvePlayerSkillAnimation,
  type SkillAnimationProfile,
} from '../src/game/skillDamageAnimation';
import type { OperatorClassId } from '../src/game/classSkills';

const classes: OperatorClassId[] = ['vanguard', 'vector', 'systems'];
const profiles = classes.flatMap(operatorClass => classSkillAnimationProfiles[operatorClass]);
assert.equal(profiles.length, 9, 'All nine class-owned skills need authored animation profiles');
assert.equal(new Set(profiles.map(profile => profile.id)).size, 9, 'Every class skill animation needs a distinct identity');

for (const profile of profiles) {
  const total = profile.anticipation + profile.action + profile.recovery;
  assert.ok(profile.anticipation >= 0.05 && profile.anticipation <= 0.16, `${profile.id} anticipation is outside the mobile readability budget`);
  assert.ok(profile.action >= 0.09 && profile.action <= 0.18, `${profile.id} action phase is outside the authored window`);
  assert.ok(profile.recovery >= 0.18 && profile.recovery <= 0.35, `${profile.id} recovery is outside the responsiveness budget`);
  assert.ok(total <= 0.66, `${profile.id} total presentation duration is too long`);
  assert.ok(profile.cancelWindow > profile.anticipation && profile.cancelWindow < total, `${profile.id} cancel window must land after anticipation and before recovery completes`);
}

const signatures = new Set(classes.map(operatorClass => {
  const profile = classSkillAnimationProfiles[operatorClass][0];
  return [profile.torsoLean, profile.socketReach, profile.leftArm, profile.hipShift].map(value => value.toFixed(3)).join(':');
}));
assert.equal(signatures.size, 3, 'Class slot-one skills need visibly different silhouettes');

function sample(operatorClass: OperatorClassId, abilityIndex: number, elapsed: number, overrides: Partial<Parameters<typeof resolvePlayerSkillAnimation>[0]> = {}) {
  return resolvePlayerSkillAnimation({
    operatorClass,
    abilityIndex,
    elapsed,
    dodge: 0,
    reload: 0,
    vent: 0,
    hit: 0,
    dead: false,
    ...overrides,
  });
}

for (const operatorClass of classes) {
  for (let index = 0; index < 3; index += 1) {
    const profile: SkillAnimationProfile = classSkillAnimationProfiles[operatorClass][index];
    assert.equal(sample(operatorClass, index, profile.anticipation * 0.5).phase, 'anticipation');
    assert.equal(sample(operatorClass, index, profile.anticipation + profile.action * 0.5).phase, 'action');
    assert.equal(sample(operatorClass, index, profile.anticipation + profile.action + profile.recovery * 0.5).phase, 'recovery');
    assert.equal(sample(operatorClass, index, profile.anticipation + profile.action + profile.recovery + 0.01).phase, 'idle');
  }
}

const vectorLock = classSkillAnimationProfiles.vector[1];
const lockedDodge = sample('vector', 1, vectorLock.anticipation * 0.6, { dodge: 0.1 });
assert.equal(lockedDodge.interrupted, false, 'Soft locomotion cancels should not erase anticipation before the authored cancel window');
const readyDodge = sample('vector', 1, vectorLock.cancelWindow + 0.01, { dodge: 0.1 });
assert.equal(readyDodge.cancelReady, true);
assert.equal(readyDodge.interrupted, true, 'Dodge should visually cancel once the skill cancel window is open');
const hardHit = sample('systems', 2, 0.02, { hit: 0.7 });
assert.equal(hardHit.interrupted, true, 'Hit reactions must override skill posing immediately');

const impact = resolveEnemyDamageAnimation({ hit: 0.8, staggerTimer: 0, armorBreak: 0, dead: false });
assert.ok(impact.torsoSnap > 0.7 && impact.armFlare === 0, 'Direct hits should snap the torso without faking armor failure');
const stagger = resolveEnemyDamageAnimation({ hit: 0.15, staggerTimer: 0.72, armorBreak: 0, dead: false });
assert.ok(stagger.stagger > 0.75 && stagger.torsoSnap > 0.5, 'Stagger needs a stronger sustained reaction than a light hit');
const armorBreak = resolveEnemyDamageAnimation({ hit: 0.2, staggerTimer: 0.25, armorBreak: 1, dead: false });
assert.ok(armorBreak.armorBreak === 1 && armorBreak.armFlare > 0.9, 'Armor break needs a distinct opening reaction');
assert.deepEqual(resolveEnemyDamageAnimation({ hit: 1, staggerTimer: 1, armorBreak: 1, dead: true }), { hit: 0, stagger: 0, armorBreak: 0, torsoSnap: 0, armFlare: 0 }, 'Death pose owns the rig after defeat');

console.log('SKILL_DAMAGE_ANIMATION_PASS skills=9 phases=anticipation/action/recovery cancel=readable reactions=hit/stagger/armor-break');
