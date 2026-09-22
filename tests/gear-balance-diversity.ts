import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gearBaseDefinitions, resolveGearBase } from '../src/game/gearBases';
import {
  gearAffixDefinitions,
  validateAffixSet,
} from '../src/game/gearAffixes';
import { gearStatDefinitions } from '../src/game/gearStats';
import {
  createDefaultProfile,
  deriveCombatBuild,
  itemBuildTags,
  itemStatDefinitions,
  materializeModifier,
  specializationGearSynergyDefinitions,
  type AffixId,
  type EquipmentSlot,
  type Item,
  type PlayerProfile,
  type Rarity,
} from '../src/game/meta';
import { reconstructItem } from '../src/game/reconstruction';

function baseById(id: string) {
  const base = gearBaseDefinitions.find(candidate => candidate.id === id);
  assert.ok(base, `Missing P8.5-L fixture base: ${id}`);
  return base;
}

function makeItem(
  baseId: string,
  rarity: Rarity,
  affixes: Array<{ id: AffixId; grade: 1 | 2 | 3 | 4 | 5 }> = [],
  equipmentQuality = 0,
): Item {
  const base = baseById(baseId);
  const augmentSlots = rarity === 'Field' ? 0 : rarity === 'Refined' ? 1 : 2;
  return {
    id: `p85l-${baseId}-${rarity.toLowerCase()}-${affixes.map(entry => entry.id).join('-') || 'clean'}`,
    baseId: base.id,
    name: base.name,
    slot: base.slot,
    equipmentClass: base.equipmentClass,
    rarity,
    levelRequirement: 20,
    core: `${base.core} Tradeoff: ${base.tradeoff}`,
    modifiers: affixes.map(entry => materializeModifier(entry.id, entry.grade)),
    recoveryLevel: 56,
    frameGeneration: 6,
    frameIdentity: base.frameIdentity,
    equipmentQuality,
    augmentSlots,
    augments: [],
    recoveryQuality: 5,
    recoverySource: 'P8.5-L regression fixture',
  };
}

function classForSlot(slot: EquipmentSlot) {
  if (slot === 'carbine') return 'systems' as const;
  if (slot === 'rail') return 'vector' as const;
  return 'vanguard' as const;
}

function profileWithItem(item: Item): PlayerProfile {
  const profile = createDefaultProfile();
  const activeClass = classForSlot(item.slot);
  const activeWeapon = activeClass === 'systems' ? 'carbine' : activeClass === 'vector' ? 'rail' : 'breacher';
  const inventory = profile.inventory.filter(entry => entry.slot !== item.slot && entry.slot !== activeWeapon);
  inventory.push(item);
  const equipped = { ...profile.equipped, carbine: null, breacher: null, rail: null, [item.slot]: item.id, [activeWeapon]: item.slot === activeWeapon ? item.id : null };
  if (item.slot !== activeWeapon) {
    const starter = createDefaultProfile().inventory.find(entry => entry.slot === activeWeapon)!;
    inventory.push(starter);
    equipped[activeWeapon] = starter.id;
  }
  return {
    ...profile,
    level: 20,
    operatorClass: activeClass,
    classSelectionComplete: true,
    specialization: null,
    specializationOverclock: false,
    inventory,
    equipped,
  };
}

function buildFor(item: Item) {
  return deriveCombatBuild(profileWithItem(item));
}

function validateFixture(item: Item) {
  const base = resolveGearBase(item.slot, item.baseId, item.frameIdentity);
  assert.ok(base, `Fixture base should resolve for ${item.id}`);
  assert.equal(validateAffixSet({
    slot: item.slot,
    recoveryLevel: item.recoveryLevel ?? 56,
    rarity: item.rarity,
    baseAllowedAffixes: base.allowedAffixGroups,
    affixes: item.modifiers.map(modifier => modifier.id),
    curatedSingular: item.rarity === 'Singular',
  }), true, `Fixture should obey current affix legality: ${item.id}`);
}

const railGoals = [
  makeItem('r2-hypervelocity-bed', 'Refined', [{ id: 'hypervelocity', grade: 5 }], 20),
  makeItem('r2-countermass-bed', 'Refined', [{ id: 'countermass', grade: 5 }], 20),
  makeItem('r2-thermal-reference', 'Refined', [{ id: 'cryoloop', grade: 5 }], 20),
  makeItem('r2-hypervelocity-bed', 'Refined', [{ id: 'tungsten', grade: 5 }], 20),
  makeItem('r2-hypervelocity-bed', 'Refined', [{ id: 'railFracture', grade: 5 }], 20),
] as const;

railGoals.forEach(validateFixture);
const railSignatures = railGoals.map(item => [
  item.frameIdentity,
  itemBuildTags(item).join('|'),
  itemStatDefinitions(item).map(definition => definition.id).sort().join('|'),
].join('::'));
assert.equal(new Set(railSignatures).size, 5, 'P8.5-L requires at least five same-slot Rail items with distinct semantic build routes.');

const railBaseline = buildFor(makeItem('r2-thermal-reference', 'Field'));
const [flightBuild, controlBuild, thermalBuild, armorBuild, fragmentBuild] = railGoals.map(buildFor);
assert.ok(flightBuild.weapon.rail.speedMul > railBaseline.weapon.rail.speedMul && flightBuild.classSkillFamily.rangeMul > railBaseline.classSkillFamily.rangeMul, 'Hypervelocity Rail route must improve projectile flight and class-skill reach.');
assert.ok(controlBuild.weapon.rail.recoilMul < railBaseline.weapon.rail.recoilMul && controlBuild.classSkillFamily.controlMul > railBaseline.classSkillFamily.controlMul, 'Countermass Rail route must trade toward recoil/control.');
assert.ok(thermalBuild.weapon.rail.heatDissipationMul > railBaseline.weapon.rail.heatDissipationMul && thermalBuild.classSkillFamily.recoveryMul > railBaseline.classSkillFamily.recoveryMul, 'Thermal Rail route must improve heat/recovery.');
assert.ok(armorBuild.weapon.rail.armorDamageMul > railBaseline.weapon.rail.armorDamageMul && armorBuild.weapon.rail.penetrationAdd > railBaseline.weapon.rail.penetrationAdd, 'Tungsten Rail route must improve armor work.');
assert.equal(fragmentBuild.mechanics.railFragment, true, 'Fracture Rail route must enable its build-defining projectile mechanic.');
assert.ok(fragmentBuild.mechanics.railFragmentScale > 0, 'Fracture Rail route must carry a non-zero runtime scale.');

const greatRefined = makeItem('r2-hypervelocity-bed', 'Refined', [{ id: 'hypervelocity', grade: 5 }], 20);
const poorPrototype = makeItem('r2-thermal-reference', 'Prototype', [
  { id: 'cryoloop', grade: 1 },
  { id: 'railFracture', grade: 1 },
  { id: 'countermass', grade: 1 },
  { id: 'markShear', grade: 1 },
], 0);
validateFixture(greatRefined);
validateFixture(poorPrototype);
const greatRefinedBuild = buildFor(greatRefined);
const poorPrototypeBuild = buildFor(poorPrototype);
assert.ok(greatRefinedBuild.weapon.rail.speedMul > poorPrototypeBuild.weapon.rail.speedMul, 'A great Refined Hypervelocity Rail must beat a poor Prototype for projectile-flight builds.');
assert.ok(greatRefinedBuild.classSkillFamily.rangeMul > poorPrototypeBuild.classSkillFamily.rangeMul, 'A great Refined Hypervelocity Rail must beat a poor Prototype for class-skill reach.');

const baseSystemTags = new Set(gearBaseDefinitions.flatMap(base => base.buildTags));
const affixSystemTags = new Set(gearAffixDefinitions.flatMap(affix => affix.buildTags));
const specializationSystemTags = new Set(specializationGearSynergyDefinitions.flatMap(definition => definition.preferredTags));
for (const stat of gearStatDefinitions) {
  const systems = [
    stat.tags.some(tag => baseSystemTags.has(tag)),
    stat.tags.some(tag => affixSystemTags.has(tag)),
    stat.tags.some(tag => specializationSystemTags.has(tag)),
  ].filter(Boolean).length;
  assert.ok(systems >= 2, `Gear stat must connect to at least two semantic build systems: ${stat.id} only connects to ${systems}`);
}

for (const affix of gearAffixDefinitions) {
  const base = gearBaseDefinitions.find(candidate => candidate.allowedAffixGroups.includes(affix.id) && affix.allowedSlots.includes(candidate.slot));
  assert.ok(base, `Every affix needs a legal authored base: ${affix.id}`);
  const baselineItem = makeItem(base.id, 'Field');
  const affixItem = makeItem(base.id, 'Refined', [{ id: affix.id, grade: 3 }]);
  validateFixture(affixItem);
  const baselineBuild = buildFor(baselineItem);
  const appliedBuild = buildFor(affixItem);
  assert.notDeepEqual(appliedBuild, baselineBuild, `Affix must change the actual combat build: ${affix.id}`);
}

assert.equal(validateAffixSet({
  slot: 'rail',
  recoveryLevel: 56,
  rarity: 'Field',
  baseAllowedAffixes: baseById('r2-hypervelocity-bed').allowedAffixGroups,
  affixes: ['hypervelocity'],
}), false, 'Field gear must reject explicit modifiers.');
assert.equal(validateAffixSet({
  slot: 'rail',
  recoveryLevel: 56,
  rarity: 'Refined',
  baseAllowedAffixes: baseById('r2-hypervelocity-bed').allowedAffixGroups,
  affixes: ['hypervelocity', 'hypervelocity'],
}), false, 'Duplicate affixes must remain invalid.');
assert.equal(validateAffixSet({
  slot: 'rail',
  recoveryLevel: 56,
  rarity: 'Refined',
  baseAllowedAffixes: baseById('r2-thermal-reference').allowedAffixGroups,
  affixes: ['hypervelocity'],
}), false, 'Affixes illegal for a base must remain invalid.');
assert.equal(validateAffixSet({
  slot: 'rig',
  recoveryLevel: 56,
  rarity: 'Prototype',
  baseAllowedAffixes: baseById('closed-loop-thermal-bus').allowedAffixGroups,
  affixes: ['cryoloop', 'dodgeVent'],
}), false, 'Conflicting thermal routes must remain invalid.');

const richWallet = { credits: 99999, alloys: 9999, electronics: 9999, components: 9999 } as any;
const cappedRefined = makeItem('m7-dense-flight-receiver', 'Refined', [
  { id: 'hypervelocity', grade: 3 },
  { id: 'tungsten', grade: 3 },
]);
validateFixture(cappedRefined);
const cappedProfile = profileWithItem(cappedRefined);
const cappedCraft = reconstructItem(cappedProfile, richWallet, 2, cappedRefined.id, { kind: 'add', family: 'core' });
assert.match(cappedCraft.message, /2-modifier reconstruction limit/i, 'Reconstruction must honor Refined rarity boundaries.');
assert.equal(cappedCraft.profile.inventory.find(item => item.id === cappedRefined.id)!.modifiers.length, 2, 'Rejected reconstruction must not mutate a capped Refined item.');

const singularFixture = { ...greatRefined, id: 'p85l-singular-fixed', rarity: 'Singular' as const };
const singularProfile = profileWithItem(singularFixture);
const singularCraft = reconstructItem(singularProfile, richWallet, 2, singularFixture.id, { kind: 'grade', modifierId: 'hypervelocity' });
assert.match(singularCraft.message, /Singular modifier packages are fixed/i, 'Singular modifier packages must remain outside ordinary crafting mutation.');

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const buildScript = packageJson.scripts.build ?? '';
for (const gate of [
  'test:gear-loot-generation',
  'test:gear-balance-diversity',
  'test:gear-singular-audit',
  'test:save-migration',
  'test:ui',
]) assert.ok(buildScript.includes(gate), `Production build must retain the P8.5-L regression dependency: ${gate}`);

const uiGate = readFileSync('tests/ui-readability.ts', 'utf8');
assert.ok(uiGate.includes('BUILD LINKS') && uiGate.includes('ANDROID_MOBILE_LAYOUT_PASS') && uiGate.includes('ANDROID ITEM INSPECTOR SINGLE SCROLLER'), 'P8.5-L release gate must retain build-link and touch/mobile UI regression coverage.');
const singularGate = readFileSync('tests/gear-singular-audit.ts', 'utf8');
assert.ok(singularGate.includes('simulation hook') || singularGate.includes('hasTrait'), 'P8.5-L release gate must retain Singular runtime-hook coverage.');
const saveGate = readFileSync('tests/save-data-migration.ts', 'utf8');
assert.ok(saveGate.includes('legacyStateMigrationSmoke') && saveGate.includes('recoveryPreservationSmoke'), 'P8.5-L release gate must retain save migration and recovery coverage.');
const androidWorkflow = readFileSync('.github/workflows/android-apk.yml', 'utf8');
assert.ok(androidWorkflow.includes('npm run build') && androidWorkflow.includes('Smoke test APK on Android emulator') && androidWorkflow.includes('Ironshade-Vector-Android-Beta.apk') && androidWorkflow.includes("'tests/**'"), 'P8.5-L code/test changes must flow through the full Android build + emulator smoke + APK artifact workflow.');

console.log(`GEAR_BALANCE_DIVERSITY_PASS railGoals=${railGoals.length} affixRuntime=${gearAffixDefinitions.length} statConnectivity=${gearStatDefinitions.length} refinedSpecialist=true release=android+touch+save+singular`);
