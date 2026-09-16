import { createDefaultCampaign, generateContracts } from '../src/game/campaign';
import { rollGroundLoot, type GroundLootReceipt } from '../src/game/fieldLoot';
import { awardRecovery, createDefaultProfile, deriveCombatBuild, levelRequirementForRecovery, locationSingularNames, maxOperatorLevel, type Item } from '../src/game/meta';
import { applyThreatBudget, operationScalingFor } from '../src/game/scaling';
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

const bossDrop = rollGroundLoot({ enemyId: 99, enemyLabel: 'Command Target', role: 'boss', combatClass: 'command', x: 100, y: 100, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 0 }, () => 0.99);
assert(bossDrop?.rarity === 'Singular' && bossDrop.recoveryQualityFloor >= 4, 'boss should guarantee a high-quality Singular ground drop');
const eliteDrop = rollGroundLoot({ enemyId: 6, enemyLabel: 'Elite', role: 'elite', combatClass: 'elite', x: 100, y: 100, operationTier: 8, maxRecoveryLevel: 40, monsterLevel: 14, sequence: 0 }, () => 0.99);
assert(eliteDrop?.rarity === 'Prototype' && eliteDrop.recoveryQualityFloor >= 4, 'elite should guarantee a high-quality Prototype ground drop');
const normalDrop = rollGroundLoot({ enemyId: 1, enemyLabel: 'Raider', role: 'assault', combatClass: 'standard', x: 100, y: 100, operationTier: 6, maxRecoveryLevel: 32, monsterLevel: 11, sequence: 0 }, () => 0);
assert(normalDrop, 'standard monsters should sometimes produce field loot');

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
assert(recovered.loot.some(item => item.recoverySource?.startsWith('Ground drop //') && item.rarity === 'Singular'), 'collected boss ground drop should materialize as Singular gear at extraction');

let leveling = createDefaultProfile();
for (let run = 0; run < 70 && leveling.level < 20; run += 1) leveling = awardRecovery(leveling, telemetry, false, 0, { operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget }).profile;
assert(leveling.level === 20, `progression should reach level 20, stopped at ${leveling.level}`);

console.log(`LOOT_DIFFICULTY_PASS lowEff=${low.combatEffectiveness.toFixed(2)} highEff=${high.combatEffectiveness.toFixed(2)} highDamage=${high.monsterDamageScale.toFixed(2)} level=${leveling.level} bossDrop=${bossDrop.rarity}`);
