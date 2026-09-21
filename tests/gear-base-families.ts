import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gearBaseDefinition, gearBaseDefinitions, gearBasesForSlot, rollGearBase } from '../src/game/gearBases';
import { createDefaultProfile, deriveCombatBuild, type EquipmentSlot, type Item } from '../src/game/meta';

const slots: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];

assert.equal(gearBaseDefinitions.length, 18, 'P8.5-C should author three strategic bases for every equipment slot.');
assert.equal(new Set(gearBaseDefinitions.map(base => base.id)).size, gearBaseDefinitions.length, 'Base IDs must be unique.');
assert.equal(new Set(gearBaseDefinitions.map(base => base.name)).size, gearBaseDefinitions.length, 'Base family names must stay distinct in the Armory.');

for (const slot of slots) {
  const families = gearBasesForSlot(slot);
  assert.equal(families.length, 3, `${slot} should expose exactly three authored base families.`);
  assert.equal(new Set(families.map(base => base.frameIdentity)).size, 3, `${slot} bases should own distinct frame identities.`);
  for (const family of families) {
    assert.deepEqual(family.generationRange, [1, 6], `${family.id} should remain viable across the current generation ladder.`);
    assert.ok(family.inherentStats.length > 0, `${family.id} needs inherent stats.`);
    assert.ok(family.implicitStats.length > 0, `${family.id} needs an implicit/tradeoff stat.`);
    assert.ok(family.allowedAffixGroups.length >= 4, `${family.id} needs a meaningful legal affix pool.`);
    assert.ok(family.buildTags.length >= 4, `${family.id} needs build tags.`);
    assert.ok(family.tradeoff.length >= 12, `${family.id} needs an explicit strategic tradeoff.`);
  }
}

assert.notDeepEqual(
  gearBaseDefinition('b4-backblast-thruster')?.allowedAffixGroups,
  gearBaseDefinition('b4-dense-choke-cage')?.allowedAffixGroups,
  'Same-slot bases should not share one undifferentiated affix pool.',
);
assert.equal(gearBaseDefinition('b4-frame')?.id, 'b4-dense-choke-cage', 'Legacy base IDs should migrate to a deterministic family.');

const forced = rollGearBase('breacher', () => 0.99, 6, ['overdrive', 'breachPropulsion']);
assert.equal(forced.id, 'b4-backblast-thruster', 'Forced onboarding affixes must choose a compatible authored family.');

function breacherBuild(baseId: string, frameGeneration: 1 | 2 | 3 | 4 | 5 | 6) {
  const base = gearBaseDefinition(baseId);
  assert.ok(base && base.slot === 'breacher');
  const profile = createDefaultProfile();
  const equippedId = profile.equipped.breacher;
  assert.ok(equippedId);
  const inventory = profile.inventory.map(item => item.id === equippedId ? {
    ...item,
    baseId: base.id,
    name: base.name,
    equipmentClass: base.equipmentClass,
    core: base.core,
    frameIdentity: base.frameIdentity,
    frameGeneration,
    equipmentQuality: 0,
    modifiers: [],
    augments: [],
  } satisfies Item : item);
  return deriveCombatBuild({ ...profile, inventory });
}

const lowGenerationDense = breacherBuild('b4-dense-choke-cage', 1);
const highGenerationCryo = breacherBuild('b4-cryo-cycle-action', 6);
assert.ok(
  lowGenerationDense.weapon.breacher.damageMul > highGenerationCryo.weapon.breacher.damageMul,
  'A later-generation base must not automatically invalidate a lower-generation specialist for direct output.',
);
assert.ok(
  highGenerationCryo.weapon.breacher.heatDissipationMul > lowGenerationDense.weapon.breacher.heatDissipationMul,
  'The later-generation alternative should still win its intended thermal niche.',
);

const source = readFileSync('src/game/meta.ts', 'utf8');
const generationSource = readFileSync('src/game/gearGeneration.ts', 'utf8');
assert.ok(source.includes('generateGearPlan({'), 'Live loot must route through the centralized gear generation pipeline.');
assert.ok(generationSource.includes('gearBasesForSlot(slot, frameGeneration)'), 'Centralized loot generation must choose from authored base families.');
assert.ok(generationSource.includes('base.allowedAffixGroups'), 'Live loot affixes must come from the selected base family.');
assert.ok(generationSource.includes('validateGeneratedGearPlan'), 'Generated gear must pass centralized validation before materialization.');
assert.ok(!source.includes('const frameGenerationNames:'), 'The old generation-name ladder should no longer own base identity.');
assert.ok(!source.includes('const baseNames:'), 'The old one-base-per-slot table should be removed.');

console.log('GEAR_BASE_FAMILIES_PASS slots=6 bases=18 generation=choice-not-ladder');
