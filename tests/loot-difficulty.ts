import { createDefaultCampaign, generateContracts } from '../src/game/campaign';
import { rollGroundLoot, type GroundLootReceipt } from '../src/game/fieldLoot';
import { modifierCountForRarity } from '../src/game/lootQuality';
import { awardRecovery, createDefaultProfile, deriveCombatBuild, levelRequirementForRecovery, locationSingularNames, maxOperatorLevel, type Item } from '../src/game/meta';
import { applyThreatBudget, operationScalingFor, standardTierCapForOperator } from '../src/game/scaling';
import { createSimulation, type Telemetry } from '../src/game/sim';

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

const stationUniques = locationSingularNames('orbital-station', 20);
assert(stationUniques.includes('Sixth-Vector M-12') && stationUniques.includes('Cascade Sight Link'), 'new skill-transform Singulars should be in chase pools');

const telemetry: Telemetry = { damageDealt: 8000, damageTaken: 60, deaths: 0, kills: 7, eliteKills: 1, eliteProtocolsDefeated: 2, killIntervalTotal: 15, killIntervalSamples: 6, lastKillAt: 20, protocolCombinations: {}, weaponShots: { carbine: 100, breacher: 10, rail: 5 }, abilityUses: [2, 2, 2], encounterStart: 0, bossStart: 20, duration: 40, trace: [], nextTraceAt: 0 };
const receipt: GroundLootReceipt = { id: 'boss-ground', enemyId: 99, enemyLabel: 'Command Target', rarity: 'Singular', source: 'boss', recoveryQualityFloor: 5, recoveryLevel: 56, monsterLevel: 20 };
const recovered = awardRecovery(profile, telemetry, true, 0, { deepTarget: base.deepTarget, location: base.location, locationName: base.locationName, operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget, actualDepth: true }, [receipt]);
assert(recovered.loot.some(item => item.recoverySource?.startsWith('Ground drop //') && item.rarity === 'Singular'), 'collected boss Singular should materialize as Singular gear at extraction');

const repeatProfile = { ...createDefaultProfile(), runsCompleted: 1 };
const overflowReceipts: GroundLootReceipt[] = Array.from({ length: 14 }, (_, index) => ({ id: `ground-${index}`, enemyId: index + 1, enemyLabel: `Raider ${index + 1}`, rarity: 'Field', source: 'standard', recoveryQualityFloor: 1, recoveryLevel: 24, monsterLevel: 8 }));
const overflowRecovery = awardRecovery(repeatProfile, telemetry, false, 0, { location: base.location, locationName: base.locationName, operationTier: 6, maxRecoveryLevel: 32, threatBudget: 52 }, overflowReceipts);
assert(overflowRecovery.loot.filter(item => item.recoverySource?.startsWith('Ground drop //')).length === overflowReceipts.length, 'field loot must not be silently truncated at extraction');
const bossPrototypeReceipt: GroundLootReceipt = { id: 'boss-prototype', enemyId: 99, enemyLabel: 'Command Target', rarity: 'Prototype', source: 'boss', recoveryQualityFloor: 5, recoveryLevel: 56, monsterLevel: 20 };
const deepFieldRecovery = awardRecovery(repeatProfile, telemetry, true, 0, { deepTarget: 'Unpooled Command Target', location: 'unpooled-location', locationName: 'Unpooled Site', operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget, actualDepth: true }, [bossPrototypeReceipt]);
assert(deepFieldRecovery.loot.length === 2, `field-loot deep run should add one contract recovery, saw ${deepFieldRecovery.loot.length}`);

let leveling = createDefaultProfile();
for (let run = 0; run < 70 && leveling.level < 20; run += 1) leveling = awardRecovery(leveling, telemetry, false, 0, { operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget }).profile;
assert(leveling.level === 20, `progression should reach level 20, stopped at ${leveling.level}`);

console.log(`LOOT_DIFFICULTY_PASS lowEff=${low.combatEffectiveness.toFixed(2)} highEff=${high.combatEffectiveness.toFixed(2)} highDamage=${high.monsterDamageScale.toFixed(2)} level=${leveling.level} bossFloor=${bossFloor.rarity} bossSingularRate=${(bossRates.Singular * 100).toFixed(1)}%`);
