import { createDefaultCampaign, generateContracts } from '../src/game/campaign';
import { groundLootPresentation, lootColor, lootLabel, rollGroundLoot, type GroundLootReceipt } from '../src/game/fieldLoot';
import { modifierCountForRarity } from '../src/game/lootQuality';
import { awardRecovery, createDefaultProfile, deriveCombatBuild, directiveChaseSingularChance, directiveSingularNames, levelRequirementForRecovery, locationSingularNames, maxOperatorLevel, parallaxDebtGearIdentities, type Item } from '../src/game/meta';
import { applyThreatBudget, operationScalingFor, standardTierCapForOperator } from '../src/game/scaling';
import { createSimulation, type Telemetry } from '../src/game/sim';
import { compareRarity, rarityClassToken, rarityDefinition, rarityOrder } from '../src/game/rarity';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const campaign = createDefaultCampaign();
const base = generateContracts(campaign)[0];
assert(base, 'expected a generated contract');
const low = operationScalingFor({ ...base, directiveTier: 1 }, campaign, 1);
const high = operationScalingFor({ ...base, directiveTier: 12 }, campaign, 20);
assert(low.monsterLevel === 1, `tier 1 monster level should be 1, saw ${low.monsterLevel}`);
assert(high.monsterLevel === 20, `tier 12 monster level should be 20, saw ${high.monsterLevel}`);
assert(high.combatEffectiveness >= 1.55, `tier 12 effectiveness too low: ${high.combatEffectiveness}`);
assert(high.monsterDamageScale >= 1.35, `tier 12 damage scale too low: ${high.monsterDamageScale}`);
assert(high.operationRewardMultiplier > low.operationRewardMultiplier, 'higher tier should reward more materials');

const cautiousCampaign = { ...campaign, contractsCompleted: 30, reputation: { meridian: 12, heliostat: 12, longarc: 12 } };
const cautiousContract = generateContracts(cautiousCampaign)[0];
const cautious = operationScalingFor(cautiousContract, cautiousCampaign, 11);
assert(cautious.operationTier <= standardTierCapForOperator(11), 'standard board exceeded LV11 tier cap');
assert(cautious.monsterLevel <= 13, 'standard board should stay within +2 monster levels at LV11');
const explicitHardMode = operationScalingFor({ ...base, directiveTier: 12 }, cautiousCampaign, 11);
assert(explicitHardMode.operationTier === 12 && explicitHardMode.monsterLevel === 20, 'explicit Directive tiers must remain uncapped by standard-board safety.');

const lowState = createSimulation();
const highState = createSimulation();
applyThreatBudget(lowState.enemies, { ...base, ...low });
applyThreatBudget(highState.enemies, { ...base, ...high });
const lowEnemy = lowState.enemies.find(enemy => enemy.id === 1)!;
const highEnemy = highState.enemies.find(enemy => enemy.id === 1)!;
const lowBoss = lowState.enemies.find(enemy => enemy.role === 'boss')!;
const highBoss = highState.enemies.find(enemy => enemy.role === 'boss')!;
assert(highEnemy.maxHp > lowEnemy.maxHp * 1.45, `regular monster life did not scale enough: ${lowEnemy.maxHp} -> ${highEnemy.maxHp}`);
assert(highBoss.maxHp > lowBoss.maxHp * 1.35, `boss life did not scale enough: ${lowBoss.maxHp} -> ${highBoss.maxHp}`);

assert(maxOperatorLevel === 20, `operator cap should be 20, saw ${maxOperatorLevel}`);
assert(levelRequirementForRecovery(12) === 1, 'RL12 should remain starter-tier compatible');
assert(levelRequirementForRecovery(56) === 20, 'RL56 should require level 20');
assert(levelRequirementForRecovery(40) > levelRequirementForRecovery(24), 'gear requirements should climb with recovery level');
assert(modifierCountForRarity('Field', 5, () => 0) === 0, 'Field items should remain clean bases without explicit modifiers');
assert(modifierCountForRarity('Refined', 0, () => 0) === 2 && modifierCountForRarity('Refined', 0, () => 0.99) === 1, 'Refined items should have one or two modifiers');
assert(modifierCountForRarity('Prototype', 0, () => 0) === 6 && modifierCountForRarity('Prototype', 0, () => 0.2) === 5 && modifierCountForRarity('Prototype', 0, () => 0.9) === 4, 'Prototype items should use the 4/5/6 modifier structure');
const rarityDefinitions = rarityOrder.map(rarityDefinition);
assert(rarityOrder.join('|') === 'Field|Refined|Prototype|Singular', 'rarity order must remain Field -> Refined -> Prototype -> Singular');
assert(rarityDefinitions.every((definition, index) => definition.rank === index), 'rarity ranks must match the authored order');
assert(new Set(rarityDefinitions.map(definition => definition.token)).size === 4 && new Set(rarityDefinitions.map(definition => definition.icon)).size === 4 && new Set(rarityDefinitions.map(definition => definition.shape)).size === 4, 'rarities need distinct token, icon, and shape cues');
assert(rarityDefinitions.every(definition => definition.meaning.length >= 60 && definition.accessibleLabel.length >= 20), 'rarity contract needs plain-language meaning and accessible text');
assert(compareRarity('Field', 'Singular') < 0 && compareRarity('Singular', 'Prototype') > 0, 'rarity comparison must respect contract order');
assert(rarityClassToken('Prototype') === 'rarity-prototype', 'rarity CSS token drifted from the shared contract');
assert(lootColor('Refined') === rarityDefinition('Refined').colorValue && lootLabel('Singular') === rarityDefinition('Singular').worldLabel, 'world loot presentation must use the shared rarity contract');
const worldLootPresentations = rarityOrder.map(groundLootPresentation);
assert(new Set(worldLootPresentations.map(presentation => presentation.shape)).size === 4, 'world loot must preserve all four non-color rarity silhouettes');
assert(worldLootPresentations.every((presentation, index) => index === 0 || (presentation.beaconScale > worldLootPresentations[index - 1].beaconScale && presentation.ringScale > worldLootPresentations[index - 1].ringScale)), 'higher rarity world loot should receive a strictly stronger beacon and ground-ring hierarchy');
assert(groundLootPresentation('Field').pickupCue === 'loot' && groundLootPresentation('Refined').pickupCue === 'loot' && groundLootPresentation('Prototype').pickupCue === 'rareLoot' && groundLootPresentation('Singular').pickupCue === 'rareLoot', 'pickup audio must distinguish ordinary from high-value recoveries');

function sequenceRandom(values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}
function seededRandom(seedValue: number) {
  let value = seedValue >>> 0;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}
function sampleGroundLoot(input: Parameters<typeof rollGroundLoot>[0], iterations = 50000) {
  const random = seededRandom(0x51ed270b ^ input.enemyId * 7919 ^ input.operationTier * 104729);
  const counts = { drops: 0, Field: 0, Refined: 0, Prototype: 0, Singular: 0 };
  for (let index = 0; index < iterations; index += 1) {
    const drop = rollGroundLoot({ ...input, sequence: index }, random);
    if (!drop) continue;
    counts.drops += 1;
    counts[drop.rarity] += 1;
  }
  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value / iterations])) as Record<keyof typeof counts, number>;
}

const bossFloor = rollGroundLoot({ enemyId: 99, enemyLabel: 'Command Target', role: 'boss', combatClass: 'command', x: 100, y: 100, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 0 }, () => 0.99);
assert(bossFloor?.rarity === 'Prototype' && bossFloor.recoveryQualityFloor >= 4, 'boss should guarantee a Rare-equivalent Prototype floor instead of a Singular');
const bossChase = rollGroundLoot({ enemyId: 99, enemyLabel: 'Command Target', role: 'boss', combatClass: 'command', x: 100, y: 100, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 1 }, () => 0);
assert(bossChase?.rarity === 'Singular', 'boss should still be able to produce a chase Singular');
const eliteDrop = rollGroundLoot({ enemyId: 6, enemyLabel: 'Elite', role: 'elite', combatClass: 'elite', x: 100, y: 100, operationTier: 8, maxRecoveryLevel: 40, monsterLevel: 14, sequence: 0 }, sequenceRandom([0.5, 0.2]));
assert(eliteDrop?.rarity === 'Prototype' && eliteDrop.recoveryQualityFloor >= 4, 'elite rarity bias should be able to produce a high-quality Prototype');
const normalDrop = rollGroundLoot({ enemyId: 1, enemyLabel: 'Raider', role: 'assault', combatClass: 'standard', x: 100, y: 100, operationTier: 6, maxRecoveryLevel: 32, monsterLevel: 11, sequence: 0 }, sequenceRandom([0, 0.9]));
assert(normalDrop, 'standard monsters should sometimes produce field loot');

const standardRates = sampleGroundLoot({ enemyId: 1, enemyLabel: 'Raider', role: 'assault', combatClass: 'standard', x: 0, y: 0, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 0 });
const enhancedRates = sampleGroundLoot({ enemyId: 2, enemyLabel: 'Enhanced Raider', role: 'assault', combatClass: 'enhanced', x: 0, y: 0, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 0 });
const eliteRates = sampleGroundLoot({ enemyId: 3, enemyLabel: 'Elite Raider', role: 'elite', combatClass: 'elite', x: 0, y: 0, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 0 });
const bossRates = sampleGroundLoot({ enemyId: 4, enemyLabel: 'Command Target', role: 'boss', combatClass: 'command', x: 0, y: 0, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 0 });
const modifiedEnhancedRates = sampleGroundLoot({ enemyId: 5, enemyLabel: 'Modified Enhanced Raider', role: 'assault', combatClass: 'enhanced', x: 0, y: 0, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, modifierCount: 4, sequence: 0 });
assert(standardRates.drops > 0.19 && standardRates.drops < 0.24, `standard T12 equipment rate drifted: ${standardRates.drops}`);
assert(standardRates.Prototype > 0.008 && standardRates.Prototype < 0.017 && standardRates.Singular < 0.002, 'standard enemies are producing too many chase rarities');
assert(enhancedRates.drops > 0.44 && enhancedRates.drops < 0.52, `enhanced T12 equipment rate drifted: ${enhancedRates.drops}`);
assert(enhancedRates.Prototype > 0.075 && enhancedRates.Prototype < 0.115 && enhancedRates.Singular < 0.007, 'enhanced enemies are producing too many chase rarities');
assert(eliteRates.drops > 0.95 && eliteRates.drops < 0.995, `elite T12 equipment rate drifted: ${eliteRates.drops}`);
assert(eliteRates.Prototype > 0.49 && eliteRates.Prototype < 0.57 && eliteRates.Singular > 0.015 && eliteRates.Singular < 0.035, 'elite rarity bias drifted outside intended PoE2-style bands');
assert(bossRates.drops === 1 && bossRates.Prototype > 0.82 && bossRates.Prototype < 0.89 && bossRates.Singular > 0.12 && bossRates.Singular < 0.18, 'bosses should guarantee Prototype-or-better while keeping Singular a chase outcome');
assert(modifiedEnhancedRates.drops > enhancedRates.drops + 0.04, 'monster modifiers should materially increase item quantity pressure');
assert(modifiedEnhancedRates.Prototype + modifiedEnhancedRates.Singular > enhancedRates.Prototype + enhancedRates.Singular + 0.02, 'monster modifiers should materially increase rarity pressure');

const profile = createDefaultProfile();
const starterRig = profile.inventory.find(item => item.slot === 'rig')!;
const bloom: Item = { ...starterRig, id: 'test-bloom', name: 'Bloom Vector Rig', rarity: 'Singular', singularTrait: 'magBloom', singularEffect: 'test', modifiers: [] };
const bloomProfile = { ...profile, inventory: [...profile.inventory, bloom], equipped: { ...profile.equipped, rig: bloom.id } };
const bloomBuild = deriveCombatBuild(bloomProfile);
assert(bloomBuild.abilities[0].costMul >= 1.25 && bloomBuild.abilities[0].cooldownMul >= 1.08, 'MAG Bloom tradeoff should be active when equipped');

const directiveChase = directiveSingularNames(12);
assert(directiveSingularNames(8).length === 0, 'directive-only Singular pool must stay locked below T9');
assert(directiveChase.length === 6, `high-tier directives should expose six exclusive Singulars, saw ${directiveChase.length}`);
assert(directiveChase.includes('Sixth-Vector M-12') && directiveChase.includes('Backstep Kestrel B-9') && directiveChase.includes('Cold Doublet R-7') && directiveChase.includes('Falling Star Harness') && directiveChase.includes('Bloom Vector Rig') && directiveChase.includes('Cascade Sight Link'), 'directive pool should cover every equipment slot with the authored chase set');
assert(directiveChaseSingularChance(9, false) === 0.03 && directiveChaseSingularChance(12, true) === 0.18, 'directive chase odds should scale from 3% safe at T9 to 18% deep at T12');
const stationUniques = locationSingularNames('orbital-station', 20);
assert(!stationUniques.includes('Sixth-Vector M-12') && !stationUniques.includes('Cascade Sight Link'), 'directive-only Singulars must not leak back into ordinary location pools');

const telemetry: Telemetry = { damageDealt: 8000, damageTaken: 60, deaths: 0, kills: 7, eliteKills: 1, eliteProtocolsDefeated: 2, killIntervalTotal: 15, killIntervalSamples: 6, lastKillAt: 20, protocolCombinations: {}, weaponShots: { carbine: 100, breacher: 10, rail: 5 }, abilityUses: [2, 2, 2], encounterStart: 0, bossStart: 20, duration: 40, trace: [], nextTraceAt: 0 };
const receipt: GroundLootReceipt = { id: 'boss-ground', enemyId: 99, enemyLabel: 'Command Target', rarity: 'Singular', source: 'boss', recoveryQualityFloor: 5, recoveryLevel: 56, monsterLevel: 20 };
const recovered = awardRecovery(profile, telemetry, true, 0, { deepTarget: base.deepTarget, location: base.location, locationName: base.locationName, operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget, actualDepth: true }, [receipt]);
assert(recovered.loot.some(item => item.recoverySource?.startsWith('Ground drop //') && item.rarity === 'Singular'), 'collected boss Singular should materialize as Singular gear at extraction');

const repeatProfile = { ...createDefaultProfile(), runsCompleted: 1 };
let directiveHit: Item | undefined;
for (let run = 1; run <= 120 && !directiveHit; run += 1) {
  const candidateProfile = { ...createDefaultProfile(), level: 20, xp: 999999, runsCompleted: run };
  const result = awardRecovery(candidateProfile, telemetry, true, 0, { location: 'orbital-station', locationName: 'Kestrel Station', operationTier: 12, directiveTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget, actualDepth: true });
  directiveHit = result.loot.find(item => item.recoverySource?.startsWith('Directive chase //'));
}
assert(directiveHit, 'deterministic T12 sample should eventually materialize a directive-only Singular');
assert(directiveHit.rarity === 'Singular' && directiveChase.includes(directiveHit.name), 'directive chase payout must materialize from the exclusive pool');

const overflowReceipts: GroundLootReceipt[] = Array.from({ length: 14 }, (_, index) => ({ id: `ground-${index}`, enemyId: index + 1, enemyLabel: `Raider ${index + 1}`, rarity: 'Field', source: 'standard', recoveryQualityFloor: 1, recoveryLevel: 24, monsterLevel: 8 }));
const overflowRecovery = awardRecovery(repeatProfile, telemetry, false, 0, { location: base.location, locationName: base.locationName, operationTier: 6, maxRecoveryLevel: 32, threatBudget: 52 }, overflowReceipts);
assert(overflowRecovery.loot.filter(item => item.recoverySource?.startsWith('Ground drop //')).length === overflowReceipts.length, 'field loot must not be silently truncated at extraction');
const bossPrototypeReceipt: GroundLootReceipt = { id: 'boss-prototype', enemyId: 99, enemyLabel: 'Command Target', rarity: 'Prototype', source: 'boss', recoveryQualityFloor: 5, recoveryLevel: 56, monsterLevel: 20 };
const deepFieldRecovery = awardRecovery(repeatProfile, telemetry, true, 0, { deepTarget: 'Unpooled Command Target', location: 'unpooled-location', locationName: 'Unpooled Site', operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget, actualDepth: true }, [bossPrototypeReceipt]);
assert(deepFieldRecovery.loot.length === 2, `field-loot deep run should add one contract recovery, saw ${deepFieldRecovery.loot.length}`);

const parallaxFieldReceipt: GroundLootReceipt = { id: 'parallax-field', enemyId: 21, enemyLabel: 'Parallax Shear Runner', rarity: 'Field', source: 'standard', recoveryQualityFloor: 2, recoveryLevel: 48, monsterLevel: 17 };
const parallaxPrototypeReceipt: GroundLootReceipt = { id: 'parallax-prototype', enemyId: 22, enemyLabel: 'Reference Shear Technician', rarity: 'Prototype', source: 'elite', recoveryQualityFloor: 4, recoveryLevel: 52, monsterLevel: 18 };
const parallaxRecovery = awardRecovery(repeatProfile, telemetry, false, 0, {
  campaignChapter: 'parallax-debt',
  location: 'parallax-array',
  locationName: 'Cislunar Parallax Array',
  operationTier: 10,
  maxRecoveryLevel: 52,
  threatBudget: 70,
  actualDepth: false,
}, [parallaxFieldReceipt, parallaxPrototypeReceipt]);
const parallaxDrops = parallaxRecovery.loot.filter(item => item.recoverySource?.startsWith('Ground drop //'));
assert(parallaxDrops.length === 2, 'Parallax field receipts should both materialize at extraction.');
for (const item of parallaxDrops) {
  const identity = parallaxDebtGearIdentities[item.slot];
  assert(item.baseId === identity.baseId, `Parallax ${item.slot} should use its Chapter 3 base identity.`);
  assert(item.name === identity.name, `Parallax ${item.slot} should use its Chapter 3 frame name.`);
  assert(item.frameIdentity === identity.frameIdentity, `Parallax ${item.slot} should use its authored frame identity.`);
}
const parallaxPrototype = parallaxDrops.find(item => item.rarity === 'Prototype');
assert(parallaxPrototype, 'Parallax Prototype field receipt should remain Prototype after materialization.');
assert(parallaxPrototype.modifiers.some(modifier => modifier.id === parallaxDebtGearIdentities[parallaxPrototype.slot].prototypeAffix), 'Parallax Prototype should carry the slot-specific Chapter 3 signature modifier.');

const sharedLocationRecovery = awardRecovery(repeatProfile, telemetry, false, 0, {
  location: 'parallax-array',
  locationName: 'Cislunar Parallax Array',
  operationTier: 10,
  maxRecoveryLevel: 52,
  threatBudget: 70,
  actualDepth: false,
}, [parallaxFieldReceipt]);
const sharedLocationDrop = sharedLocationRecovery.loot.find(item => item.recoverySource?.startsWith('Ground drop //'));
assert(sharedLocationDrop, 'Control recovery should materialize the shared-location field receipt.');
assert(!sharedLocationDrop.baseId.startsWith('parallax-'), 'Parallax gear identity must remain chapter-scoped instead of leaking through shared locations.');

let leveling = createDefaultProfile();
for (let run = 0; run < 70 && leveling.level < 20; run += 1) leveling = awardRecovery(leveling, telemetry, false, 0, { operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget }).profile;
assert(leveling.level === 20, `progression should reach level 20, stopped at ${leveling.level}`);

console.log(`LOOT_DIFFICULTY_PASS lowEff=${low.combatEffectiveness.toFixed(2)} highEff=${high.combatEffectiveness.toFixed(2)} highDamage=${high.monsterDamageScale.toFixed(2)} level=${leveling.level} bossFloor=${bossFloor.rarity} bossSingularRate=${(bossRates.Singular * 100).toFixed(1)}%`);
