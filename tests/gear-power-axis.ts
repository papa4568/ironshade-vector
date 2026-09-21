import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { equipmentQualityForRecovery, rollEquipmentQuality } from '../src/game/gearDepth';
import { createDefaultProfile, deriveCombatBuild, materializeModifier, type Item } from '../src/game/meta';

function breacherProfile(patch: Partial<Item>) {
  const profile = createDefaultProfile();
  const equippedId = profile.equipped.breacher;
  assert.ok(equippedId, 'Vanguard default profile must own an equipped Breacher.');
  return {
    ...profile,
    inventory: profile.inventory.map(item => item.id === equippedId ? {
      ...item,
      frameGeneration: 1 as const,
      frameIdentity: 'breacher-dense' as const,
      equipmentQuality: 0,
      recoveryQuality: 0 as const,
      modifiers: [],
      augments: [],
      ...patch,
    } : item),
  };
}

// Recovery Quality is provenance/drop bias, not a persistent combat multiplier.
const routine = deriveCombatBuild(breacherProfile({ recoveryQuality: 0 }));
const prime = deriveCombatBuild(breacherProfile({ recoveryQuality: 5 }));
assert.deepEqual(prime, routine, 'Changing only Recovery Quality must not change derived combat power.');

// Frame Generation may progress the chosen frame's inherent properties, but must not add a second universal bonus.
const gen1 = deriveCombatBuild(breacherProfile({ frameGeneration: 1 }));
const gen6 = deriveCombatBuild(breacherProfile({ frameGeneration: 6 }));
assert.ok(gen6.weapon.breacher.damageMul > gen1.weapon.breacher.damageMul, 'Higher generation should still progress the selected Breacher base/frame inherent.');
assert.equal(gen6.weapon.breacher.knockbackMul, gen1.weapon.breacher.knockbackMul, 'Frame Generation must not apply the old separate universal Breacher knockback bonus.');
assert.equal(gen6.classSkillFamily.powerMul, gen1.classSkillFamily.powerMul, 'Frame Generation must not generically multiply class-skill power.');
assert.equal(gen6.classSkillFamily.recoveryMul, gen1.classSkillFamily.recoveryMul, 'Frame Generation must not generically multiply class-skill recovery.');
assert.equal(gen6.classSkillFamily.frameGeneration, 6, 'Frame Generation remains visible metadata for future base-family progression.');

// Equipment Quality scales the base/frame inherent only; it does not add a generic skill-depth multiplier.
const q0 = deriveCombatBuild(breacherProfile({ equipmentQuality: 0 }));
const q20 = deriveCombatBuild(breacherProfile({ equipmentQuality: 20 }));
assert.ok(q20.weapon.breacher.damageMul > q0.weapon.breacher.damageMul, 'Equipment Quality should improve inherent/base-frame output.');
assert.equal(q20.classSkillFamily.powerMul, q0.classSkillFamily.powerMul, 'Equipment Quality must not generically multiply class-skill power.');
assert.equal(q20.classSkillFamily.recoveryMul, q0.classSkillFamily.recoveryMul, 'Equipment Quality must not generically multiply class-skill recovery.');

// Modifier Grade remains the explicit-affix strength axis.
const grade1 = deriveCombatBuild(breacherProfile({ modifiers: [materializeModifier('overdrive', 1)] }));
const grade5 = deriveCombatBuild(breacherProfile({ modifiers: [materializeModifier('overdrive', 5)] }));
assert.ok(grade5.weapon.breacher.damageMul > grade1.weapon.breacher.damageMul, 'Higher Modifier Grade must remain stronger for the same affix.');

// New drop quality is independent of Recovery Quality, rarity, and Frame Generation.
assert.equal(rollEquipmentQuality(() => 0), 0);
assert.equal(rollEquipmentQuality(() => 0.999999), 8);
assert.equal(equipmentQualityForRecovery(0, 1, 'Field'), equipmentQualityForRecovery(5, 6, 'Singular'), 'Legacy quality fallback must no longer encode other power axes.');

const metaSource = readFileSync('src/game/meta.ts', 'utf8');
assert.ok(!metaSource.includes('applyFrameGeneration(build, item)'), 'Combat derivation must not retain the universal Frame Generation bonus.');
assert.ok(!metaSource.includes('equipmentQualityForRecovery(recoveryQuality, frameGeneration'), 'Live drop generation must not derive Equipment Quality from Recovery Quality/Frame Generation.');
assert.ok(metaSource.includes('rollEquipmentQuality(random)'), 'Live drop generation should use the independent Equipment Quality roll.');

console.log('GEAR_POWER_AXIS_PASS recovery=provenance generation=base quality=inherent grade=affix');
