import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gearBaseDefinitions } from '../src/game/gearBases';
import { createDefaultProfile, itemBuildAffinities, itemBuildTags, itemStatDefinitions, materializeModifier } from '../src/game/meta';
import {
  affixStatProfile,
  gearAffixSemanticIds,
  gearBuildTags,
  gearStatDefinition,
  gearStatDefinitions,
  validateGearStatRegistry,
} from '../src/game/gearStats';

const requiredTags = [
  'ballistics', 'penetration', 'armor-break', 'precision', 'projectile', 'recoil',
  'mobility', 'low-g', 'thermal', 'heat', 'venting', 'capacitor', 'cooldown',
  'systems', 'disruption', 'relay', 'mark', 'pressure', 'vacuum', 'defense',
];

assert.deepEqual([...gearBuildTags], requiredTags, 'P8.5-D must keep the shared roadmap build-tag vocabulary canonical.');
assert.equal(validateGearStatRegistry(), true, 'Shared gear stat registry should be internally valid.');
assert.equal(new Set(gearStatDefinitions.map(definition => definition.id)).size, gearStatDefinitions.length, 'Gear stat IDs must be unique.');
assert.ok(gearStatDefinitions.length >= 50, 'P8.5-D should cover base, affix, global, skill-family, environment, and rule semantics.');
assert.equal(gearStatDefinition('global.attack-speed').label, 'Attack Speed', 'Attack Speed must live in the shared gear/stat registry instead of a parallel progression table.');

for (const definition of gearStatDefinitions) {
  assert.equal(gearStatDefinition(definition.id).id, definition.id, `Stat lookup failed for ${definition.id}.`);
  assert.ok(definition.tags.length > 0, `${definition.id} needs at least one build tag.`);
}

for (const base of gearBaseDefinitions) {
  const statIds = [...base.inherentStats, ...base.implicitStats];
  assert.ok(statIds.length > 1, `${base.id} should expose its inherent and tradeoff stat semantics.`);
  for (const statId of statIds) assert.equal(gearStatDefinition(statId).id, statId, `${base.id} references an unregistered stat.`);
  const semanticTags = new Set(statIds.flatMap(statId => gearStatDefinition(statId).tags));
  assert.ok([...semanticTags].every(tag => base.buildTags.includes(tag)), `${base.id} build tags should include the tags implied by its stat definitions.`);
}

for (const id of gearAffixSemanticIds) {
  const profile = affixStatProfile(id);
  const modifier = materializeModifier(id, 3);
  assert.deepEqual(modifier.statIds, [...profile.stats], `${id} loot metadata should consume the shared stat profile.`);
  assert.deepEqual(modifier.tradeoffStatIds, [...profile.tradeoffs], `${id} tradeoff metadata should consume the shared stat profile.`);
  assert.deepEqual(modifier.buildTags, profile.buildTags, `${id} build tags should come from the shared stat profile.`);
}

assert.deepEqual(affixStatProfile('extendedFeed').classAffinities, ['vanguard', 'systems'], 'Shared semantics should preserve the dual-class Extended Feed affinity.');
assert.deepEqual(affixStatProfile('markShear').classAffinities, ['vector'], 'Mark Shear should retain its Vector affinity inside the shared semantic registry.');
assert.deepEqual(affixStatProfile('arcDrone').classAffinities, ['systems'], 'Relay Microdrone should retain its Systems affinity inside the shared semantic registry.');

const profile = createDefaultProfile();
const carbine = profile.inventory.find(item => item.slot === 'carbine');
assert.ok(carbine, 'Default profile should provide a weapon for semantic UI coverage.');
const semanticItem = {
  ...carbine,
  modifiers: [materializeModifier('hypervelocity', 3)],
};
assert.ok(itemBuildTags(semanticItem).includes('projectile'), 'Item build tags should combine base and explicit-modifier semantics.');
assert.ok(itemStatDefinitions(semanticItem).some(definition => definition.scope === 'local-affix'), 'Item stat presentation should expose explicit local-affix scope.');
assert.ok(itemBuildAffinities(semanticItem).includes('vector'), 'Class build links should consume the shared affix semantic registry.');

const metaSource = readFileSync('src/game/meta.ts', 'utf8');
const baseSource = readFileSync('src/game/gearBases.ts', 'utf8');
const reconstructionSource = readFileSync('src/game/reconstruction.ts', 'utf8');
const craftingRulesSource = readFileSync('src/game/craftingRules.ts', 'utf8');
const armorySource = readFileSync('src/components/Armory.tsx', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');

assert.ok(metaSource.includes('affixStatProfile(id)') && metaSource.includes('gearStatDefinition(statId).scope'), 'Combat and loot must read shared affix/stat semantics.');
assert.ok(metaSource.includes('itemBuildTags') && !metaSource.includes('modifierClassAffinity'), 'Build-link semantics should no longer depend on the old separate modifier affinity table.');
assert.ok(baseSource.includes('buildTagsForStats') && baseSource.includes('mergeBuildTags'), 'Base families must merge registry-derived stat tags.');
assert.ok(reconstructionSource.includes('legalCraftingAffixes') && craftingRulesSource.includes('affixStatProfile(id).stats.length > 0'), 'Crafting candidates must validate through the shared stat registry via the canonical P10-A rules contract.');
assert.ok(armorySource.includes('BUILD TAGS') && armorySource.includes('STAT SCOPE') && armorySource.includes('itemStatDefinitions'), 'Armory must expose registry tags and stat scope.');
assert.ok(packageSource.includes('test:gear-stat-registry'), 'Production build must gate on the P8.5-D registry regression.');

console.log(`GEAR_STAT_REGISTRY_PASS stats=${gearStatDefinitions.length} affixes=${gearAffixSemanticIds.length} tags=${gearBuildTags.length}`);
