import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weaponVariantBuildIntegration, weaponVariantBuildIntegrations, weaponVariantDefinition, type WeaponVariantId } from '../src/game/classArsenal';
import { classArsenalRecoveryAffixPreferences, createDefaultProfile, deriveCombatBuild, setOperatorClass, type Item, type OperatorClassId, type PlayerProfile } from '../src/game/meta';
import { gearAffixDefinition } from '../src/game/gearAffixes';
import { operatorNetworkNode } from '../src/game/operatorNetwork';
import { craftingBuildIntegration } from '../src/game/reconstruction';
import type { SingularTraitId, WeaponId } from '../src/game/sim';

type VariantCase = {
  id: WeaponVariantId;
  operatorClass: OperatorClassId;
  family: WeaponId;
  baseId: string;
  name: string;
  frameIdentity: NonNullable<Item['frameIdentity']>;
  expectedCraftAffix: Item['modifiers'][number]['id'];
  singularTrait: SingularTraitId;
};

const cases: VariantCase[] = [
  { id: 'carbine-burst', operatorClass: 'systems', family: 'carbine', baseId: 'm7-sustained-feed-spine', name: 'M-7 Sustained-Feed Spine', frameIdentity: 'carbine-feedline', expectedCraftAffix: 'extendedFeed', singularTrait: 'relayCrown' },
  { id: 'carbine-precision', operatorClass: 'systems', family: 'carbine', baseId: 'm7-dense-flight-receiver', name: 'M-7 Dense-Flight Receiver', frameIdentity: 'carbine-hypervelocity', expectedCraftAffix: 'hypervelocity', singularTrait: 'relayCrown' },
  { id: 'breacher-slug', operatorClass: 'vanguard', family: 'breacher', baseId: 'b4-dense-choke-cage', name: 'B-4 Dense-Choke Cage', frameIdentity: 'breacher-dense', expectedCraftAffix: 'overdrive', singularTrait: 'rheaBackblast' },
  { id: 'breacher-rapid', operatorClass: 'vanguard', family: 'breacher', baseId: 'b4-cryo-cycle-action', name: 'B-4 Cryo-Cycle Action', frameIdentity: 'breacher-cryo', expectedCraftAffix: 'cryoloop', singularTrait: 'rheaBackblast' },
  { id: 'rail-charge', operatorClass: 'vector', family: 'rail', baseId: 'r2-hypervelocity-bed', name: 'R-2 Hypervelocity Rail Bed', frameIdentity: 'rail-hypervelocity', expectedCraftAffix: 'hypervelocity', singularTrait: 'nullpoint' },
  { id: 'rail-repeater', operatorClass: 'vector', family: 'rail', baseId: 'r2-thermal-reference', name: 'R-2 Thermal Reference Rails', frameIdentity: 'rail-thermal', expectedCraftAffix: 'cryoloop', singularTrait: 'nullpoint' },
];

function profileFor(entry: VariantCase, patch: Partial<Item> = {}): PlayerProfile {
  const base = setOperatorClass(createDefaultProfile(), entry.operatorClass).profile;
  const equippedId = base.equipped[entry.family];
  assert.ok(equippedId, `${entry.operatorClass} must equip ${entry.family} before P14-D integration checks.`);
  return {
    ...base,
    level: 18,
    xp: 10200,
    inventory: base.inventory.map(item => item.id === equippedId ? {
      ...item,
      baseId: entry.baseId,
      name: entry.name,
      frameIdentity: entry.frameIdentity,
      recoveryLevel: 50,
      frameGeneration: 5,
      rarity: 'Refined',
      modifiers: [],
      ...patch,
    } : item),
  };
}

assert.equal(weaponVariantBuildIntegrations.length, 6, 'P14-D must integrate the complete six-variant class arsenal.');
assert.equal(new Set(weaponVariantBuildIntegrations.map(entry => entry.id)).size, 6, 'Every arsenal variant needs exactly one integration row.');

for (const entry of cases) {
  const integration = weaponVariantBuildIntegration(entry.id);
  const definition = weaponVariantDefinition(entry.id);
  assert.equal(integration.family, entry.family);
  assert.equal(definition.family, entry.family);
  assert.equal(integration.progressionNodeIds.length, 4, `${entry.id} must inherit the complete owned-family progression lane.`);
  for (const nodeId of integration.progressionNodeIds) {
    const node = operatorNetworkNode(nodeId);
    assert.ok(node, `Missing P14-D progression node ${nodeId} for ${entry.id}.`);
    assert.equal(node.weaponFamily, entry.family, `${entry.id} progression must not escape its class-owned family.`);
  }
  assert.ok(integration.preferredAffixes.length >= 3, `${entry.id} needs a useful affix/crafting preference set.`);
  for (const affixId of integration.preferredAffixes) {
    assert.ok(gearAffixDefinition(affixId).allowedSlots.includes(entry.family), `${entry.id} preference ${affixId} must be legal for ${entry.family}.`);
  }

  const profile = profileFor(entry);
  const build = deriveCombatBuild(profile);
  assert.equal(build.classSkillFamily.weaponVariant, entry.id);
  assert.ok(build.classSkillFamily.sources.includes(`variant-build:${entry.id}`), `${entry.id} must shape the live class skill package.`);

  const preferredLoot = classArsenalRecoveryAffixPreferences(profile, entry.family);
  assert.deepEqual(preferredLoot, [...integration.preferredAffixes], `${entry.id} must bias owned-family recoveries toward its existing affix hooks.`);
  assert.deepEqual(classArsenalRecoveryAffixPreferences(profile, 'suit'), [], 'Universal support slots must not receive weapon-variant loot bias.');

  const familyItem = profile.inventory.find(item => item.id === profile.equipped[entry.family]);
  assert.ok(familyItem);
  const crafting = craftingBuildIntegration(profile, familyItem, 2);
  assert.equal(crafting.weaponVariant, entry.id);
  assert.ok(crafting.variantAffixIds.includes(entry.expectedCraftAffix), `${entry.id} reconstruction must expose at least one legal preferred affix.`);
  assert.ok(crafting.variantRule?.includes(entry.id.toUpperCase()), `${entry.id} reconstruction should explain the active firing package.`);

  const progressed = { ...profile, allocatedNodes: [...integration.progressionNodeIds] };
  const progressedBuild = deriveCombatBuild(progressed);
  const progressionSource = `network:${integration.progressionNodeIds[integration.progressionNodeIds.length - 1]}`;
  assert.ok(progressedBuild.classSkillFamily.sources.includes(progressionSource), `${entry.id} must consume the owned-family progression lane.`);
  assert.notDeepEqual(progressedBuild.weapon[entry.family], build.weapon[entry.family], `${entry.id} family progression must change live weapon stats.`);

  const singularProfile = profileFor(entry, {
    rarity: 'Singular',
    singularTrait: entry.singularTrait,
    singularEffect: 'P14-D fixed signature.',
    singularRule: 'P14-D fixed authored package.',
    singularOpportunityCost: 'Variant identity remains fixed while ordinary modifier editing is unavailable.',
  });
  const singularBuild = deriveCombatBuild(singularProfile);
  assert.equal(singularBuild.classSkillFamily.singularLinked, true);
  assert.ok(singularBuild.classSkillFamily.sources.includes(`variant-singular:${entry.id}`), `${entry.id} Singulars must feed their firing-package interaction into class skills.`);
}

const metaSource = readFileSync(new URL('../src/game/meta.ts', import.meta.url), 'utf8');
const lootPreferenceCalls = metaSource.match(/classArsenalRecoveryAffixPreferences\(profile, slot\)/g)?.length ?? 0;
assert.ok(lootPreferenceCalls >= 3, 'Victory, contract, and field recoveries must all route class-owned weapon loot through variant affix preferences.');

console.log(`P14_D_BUILD_INTEGRATION_PASS variants=${weaponVariantBuildIntegrations.length} surfaces=progression,crafting-affixes,skills,singulars,class-owned-loot`);
