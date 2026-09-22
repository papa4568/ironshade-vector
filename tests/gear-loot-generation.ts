import {
  generateGearPlan,
  validateGeneratedGearPlan,
  type GeneratedGearPlan,
} from '../src/game/gearGeneration';
import { factionFrames } from '../src/game/factionGear';
import { factionFrameIdentity } from '../src/game/gearDepth';
import { gearBaseDefinitions } from '../src/game/gearBases';
import { rarityModifierBudget } from '../src/game/gearAffixes';
import type { EquipmentSlot } from '../src/game/meta';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function seeded(seedValue: number) {
  let value = seedValue >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

const slots: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];
const rarityRank = { Field: 0, Refined: 1, Prototype: 2 } as const;

function priority(plan: GeneratedGearPlan) {
  return [
    rarityRank[plan.rarity],
    plan.affixes.length,
    plan.affixes.reduce((sum, affix) => sum + affix.grade, 0),
    plan.equipmentQuality,
  ];
}

function atLeast(left: GeneratedGearPlan, right: GeneratedGearPlan) {
  const a = priority(left);
  const b = priority(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index];
  }
  return true;
}

for (const [slotIndex, slot] of slots.entries()) {
  const field = generateGearPlan({
    slot,
    recoveryLevel: 56,
    recoveryQuality: 5,
    frameOperatorLevel: 20,
    random: seeded(0x1000 + slotIndex),
    forcedRarity: 'Field',
  });
  assert(validateGeneratedGearPlan(field), `${slot} Field plan should validate.`);
  assert(field.affixes.length === 0, `${slot} Field plan must remain a clean base.`);
  assert(field.augmentSlots === 0, `${slot} Field plan must not gain Augment sockets from frame generation.`);

  const refined = generateGearPlan({
    slot,
    recoveryLevel: 32,
    recoveryQuality: 3,
    frameOperatorLevel: 14,
    random: seeded(0x2000 + slotIndex),
    forcedRarity: 'Refined',
    source: 'enhanced',
  });
  assert(validateGeneratedGearPlan(refined), `${slot} Refined plan should validate.`);
  assert(refined.affixes.length >= rarityModifierBudget('Refined').minGenerated && refined.affixes.length <= 2, `${slot} Refined plan must honor the one-to-two modifier budget.`);
  assert(refined.augmentSlots === 1, `${slot} Refined plan must keep exactly one fixed Augment socket.`);

  const prototype = generateGearPlan({
    slot,
    recoveryLevel: 56,
    recoveryQuality: 5,
    frameOperatorLevel: 20,
    random: seeded(0x3000 + slotIndex),
    forcedRarity: 'Prototype',
    source: 'boss',
  });
  assert(validateGeneratedGearPlan(prototype), `${slot} Prototype plan should validate.`);
  assert(prototype.affixes.length >= 4 && prototype.affixes.length <= 6, `${slot} Prototype plan must meet the 4-6 anti-junk modifier budget.`);
  assert(new Set(prototype.affixes.map(affix => affix.id)).size === prototype.affixes.length, `${slot} Prototype affixes must be unique.`);
  assert(prototype.affixes.every(affix => prototype.base.allowedAffixGroups.includes(affix.id)), `${slot} Prototype affixes must remain legal for the selected base.`);
  assert(prototype.augmentSlots === 2, `${slot} Prototype plan must cap Augment customization at two fixed sockets.`);
}

for (let seed = 1; seed <= 120; seed += 1) {
  const standard = generateGearPlan({
    slot: slots[seed % slots.length],
    recoveryLevel: 48,
    recoveryQuality: 3,
    frameOperatorLevel: 18,
    random: seeded(seed * 7919),
    source: 'standard',
  });
  const deep = generateGearPlan({
    slot: slots[seed % slots.length],
    recoveryLevel: 48,
    recoveryQuality: 3,
    frameOperatorLevel: 18,
    random: seeded(seed * 7919),
    source: 'deep',
  });
  assert(validateGeneratedGearPlan(standard) && validateGeneratedGearPlan(deep), 'Standard and deep opportunity samples must both validate.');
  assert(atLeast(deep, standard), 'Deep opportunity rolls must never downgrade the first valid standard candidate.');
}

for (const faction of ['meridian', 'heliostat', 'longarc'] as const) {
  for (const [slotIndex, slot] of slots.entries()) {
    const plan = generateGearPlan({
      slot,
      recoveryLevel: 48,
      recoveryQuality: 4,
      frameOperatorLevel: 18,
      random: seeded(0x5000 + slotIndex * 31 + faction.length),
      forcedRarity: 'Refined',
      faction,
      preferredAffixes: factionFrames[faction][slot].preferredAffixes,
      source: 'deep',
    });
    assert(validateGeneratedGearPlan(plan), `${faction} ${slot} plan should validate.`);
    assert(plan.base.frameIdentity === factionFrameIdentity(faction, slot), `${faction} ${slot} should preserve faction frame identity bias.`);
  }
}

for (const base of gearBaseDefinitions) {
  const prototype = generateGearPlan({
    slot: base.slot,
    recoveryLevel: 56,
    recoveryQuality: 5,
    frameOperatorLevel: 20,
    random: seeded(base.id.length * 104729),
    forcedRarity: 'Prototype',
    forcedAffixes: [base.allowedAffixGroups[0]],
    source: 'elite',
  });
  assert(validateGeneratedGearPlan(prototype), `Prototype anti-junk generation failed for ${base.id}.`);
}

console.log(`GEAR_LOOT_GENERATION_PASS slots=${slots.length} deepComparisons=120 bases=${gearBaseDefinitions.length}`);
