import type { CampaignState, Contract } from './campaign';
import { chooseEnemyProtocols, protocolThreatCost, type EnemyCombatClass } from './eliteProtocols';
import { applyEnemyMutations, chooseEnemyMutations, mutationThreatCost, mutationThreatCostForEnemy } from './t9Mutations';
import type { Enemy, EnemyRole, EnemyVariant } from './sim';

export type EncounterPattern = 'swarm' | 'mixed' | 'elite-led';
export type FrameGeneration = 1 | 2 | 3 | 4 | 5 | 6;
export type OperationScaling = { operationTier: number; monsterLevel: number; encounterRating: number; threatBudget: number; maxRecoveryLevel: number; maxFrameGeneration: FrameGeneration; eliteProtocolSlots: number; environmentalEventSlots: number; combatEffectiveness: number; monsterDamageScale: number; operationRewardMultiplier: number; encounterPattern: EncounterPattern; reserveCount: number };
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function frameGenerationForRecovery(recoveryLevel: number, operatorLevel = 10): FrameGeneration { if (operatorLevel >= 15 && recoveryLevel >= 55) return 6; if (operatorLevel >= 12 && recoveryLevel >= 43) return 5; if (recoveryLevel >= 43) return 4; if (recoveryLevel >= 31) return 3; if (recoveryLevel >= 19) return 2; return 1; }
export function monsterLevelForTier(operationTier: number) { const tier = clamp(Math.round(operationTier), 1, 12); return clamp(Math.round(1 + (tier - 1) * 19 / 11), 1, 20); }
export function standardTierCapForOperator(operatorLevel = 10) {
  const targetMonsterLevel = Math.min(20, Math.max(1, Math.round(operatorLevel)) + 2);
  let cap = 1;
  for (let tier = 1; tier <= 12; tier += 1) {
    if (monsterLevelForTier(tier) <= targetMonsterLevel) cap = tier;
  }
  return cap;
}
function isRotatingStandardContract(contract: Contract) {
  return !contract.directiveTier && !contract.daily && !contract.storyArc && !contract.campaignChapter && !contract.commandTrace && !contract.escalationStage && !contract.megastructure;
}
function tierForContract(contract: Contract, campaign: CampaignState, operatorLevel: number) {
  if (contract.directiveTier) return clamp(contract.directiveTier, 1, 12);
  const baseline = clamp(1 + Math.floor(campaign.contractsCompleted / 2), 1, 12);
  let tier = baseline;
  if (contract.daily) tier = Math.max(tier, 3 + (contract.seed % 4));
  if (contract.storyArc) tier = Math.max(tier, 2 + (contract.storyStep ?? 0));
  if (contract.campaignChapter === 'black-lattice') tier = Math.max(tier, 3 + Math.floor((contract.campaignStep ?? 0) / 2));
  if (contract.campaignChapter === 'dead-reckoning') tier = Math.max(tier, 7 + Math.floor((contract.campaignStep ?? 0) / 2));
  if (contract.campaignChapter === 'dead-reckoning-interdiction') tier = Math.max(tier, 9 + Math.floor((contract.campaignStep ?? 0) / 2));
  if (contract.campaignChapter === 'parallax-debt') tier = Math.max(tier, 8 + Math.floor((contract.campaignStep ?? 0) / 3));
  if (contract.commandTrace) tier = Math.max(tier, 10);
  if (contract.escalationStage) tier = Math.max(tier, 4 + contract.escalationStage * 2);
  if (contract.megastructure) tier = Math.max(tier, 5 + Math.min(3, Math.floor(campaign.contractsCompleted / 5)));
  if (contract.priority) tier += 1;
  if (contract.storyFinale || contract.campaignFinale || contract.escalationFinale) tier += 1;
  if (isRotatingStandardContract(contract)) tier = Math.min(tier, standardTierCapForOperator(operatorLevel));
  return clamp(tier, 1, 12);
}
function patternFor(contract: Contract, tier: number): EncounterPattern { if (tier <= 2) return 'swarm'; const roll = ((contract.seed >>> 3) + tier) % 3; if (roll === 2 && tier >= 4) return 'elite-led'; return roll === 0 ? 'swarm' : 'mixed'; }

export function operationScalingFor(contract: Contract, campaign: CampaignState, operatorLevel = 10): OperationScaling {
  const operationTier = tierForContract(contract, campaign, operatorLevel);
  const monsterLevel = monsterLevelForTier(operationTier);
  const basePattern = patternFor(contract, operationTier);
  const encounterPattern = contract.directiveTargetClass === 'elite-led' ? 'elite-led' : (contract.encounterPattern ?? basePattern);
  let environmentalEventSlots = operationTier <= 2 ? 1 : operationTier <= 5 ? 2 : operationTier <= 8 ? 3 : 4;
  if (contract.daily || contract.escalationStage || contract.megastructure) environmentalEventSlots = Math.min(4, environmentalEventSlots + 1);
  environmentalEventSlots = Math.min(4, environmentalEventSlots + (contract.directiveEventBonus ?? 0));
  const maxRecoveryLevel = 8 + operationTier * 4;
  const encounterPressureBonus = Math.max(0, contract.encounterPressureBonus ?? 0);
  const threatBudget = 28 + operationTier * 4 + (contract.archetype === 'boarding' ? 4 : contract.archetype === 'stabilization' ? 2 : 0) + (contract.escalationStage ? 4 : 0) + (contract.megastructure ? 4 : 0) + encounterPressureBonus + (contract.directiveThreatBonus ?? 0);
  const encounterRating = 10 + operationTier * 5 + (contract.storyFinale || contract.campaignFinale || contract.escalationFinale ? 5 : contract.megastructure ? 3 : 0) + Math.ceil(encounterPressureBonus * 0.5) + Math.min(12, (contract.directiveRiskScore ?? 0));
  const baseProtocolSlots = operationTier <= 2 ? 0 : operationTier <= 4 ? 1 : operationTier <= 7 ? 2 : operationTier <= 9 ? 3 : 4;
  const eliteProtocolSlots = Math.min(4, baseProtocolSlots + (contract.directiveProtocolBonus ?? 0));
  const levelDelta = clamp(monsterLevel - Math.max(1, operatorLevel), -4, 4);
  const directivePressure = Math.min(0.16, Math.max(0, contract.directiveRiskScore ?? 0) * 0.008);
  const combatEffectiveness = clamp(1 + (operationTier - 1) * 0.055 + levelDelta * 0.025 + directivePressure, 0.9, 1.85);
  const monsterDamageScale = clamp(1 + (operationTier - 1) * 0.035 + Math.max(0, levelDelta) * 0.02 + directivePressure * 0.45, 0.95, 1.55);
  const operationRewardMultiplier = (1 + (operationTier - 1) * 0.04) * (contract.chapterRewardMultiplier ?? 1) * (contract.directiveMaterialMultiplier ?? 1);
  const baseReserveCount = contract.reserveCount ?? (encounterPattern === 'elite-led' ? 1 : encounterPattern === 'swarm' ? 2 : operationTier >= 4 ? 2 : 1);
  const reserveCount = Math.min(2, Math.max(0, baseReserveCount) + (contract.directiveReserveBonus ?? 0));
  return { operationTier, monsterLevel, encounterRating, threatBudget, maxRecoveryLevel, maxFrameGeneration: frameGenerationForRecovery(maxRecoveryLevel, operatorLevel), eliteProtocolSlots, environmentalEventSlots, combatEffectiveness, monsterDamageScale, operationRewardMultiplier, encounterPattern, reserveCount };
}
export function withOperationScaling(contract: Contract, campaign: CampaignState, operatorLevel = 10): Contract { return { ...contract, ...operationScalingFor(contract, campaign, operatorLevel) }; }

const roleThreat: Record<EnemyRole, number> = { assault: 6, suppressor: 7, technician: 7, elite: 14, boss: 0 };
const combatClassThreat: Record<EnemyCombatClass, number> = { standard: 0, enhanced: 3, elite: 5, command: 0 };
const variantThreat: Partial<Record<EnemyVariant, number>> = { shieldBoarder: 4, tetherOperator: 3, droneCarrier: 3, coverBreacher: 3, marksman: 3, vacuumSaboteur: 3, repairDrone: 2, gravitySpecialist: 3, meleeExosuit: 5, salvageThief: 2, vectorSkirmisher: 2, anchorEngineer: 5, barricadeTrooper: 3, pressureLockTech: 3, tetherRigger: 3, maintenanceDrone: 2, gravityDrone: 3, impulseRigger: 3, boiloffTech: 3, partitionRigger: 4, recoilBroker: 3, siphonTech: 4, purgeOrchestrator: 4, custodyPorter: 4, geometryTech: 4 };
export function enemyThreatCost(enemy: Enemy) { return roleThreat[enemy.role] + (variantThreat[enemy.variant] ?? 0) + combatClassThreat[enemy.combatClass] + enemy.protocols.reduce((total, protocol) => total + protocolThreatCost(protocol), 0) + mutationThreatCostForEnemy(enemy); }
function authoredEliteRequired(contract: Contract) { if (contract.megastructureStage === 2 || contract.storyFinale || contract.campaignFinale || contract.escalationFinale) return true; return ['Recovery Commander Sable Voss', 'Salvage Captain Rhea Kade', 'Foundry Marshal Cael', 'HELIOS-9 Yardmind', 'Transfer Adjudicator Iona Vale', 'Umbra Systems Marshal Oren Saal', 'Custody Director Mara Teth'].includes(contract.deepTarget); }
function deterministicRank(contract: Contract, enemy: Enemy) { let value = (contract.seed ^ enemy.id * 7919 ^ (contract.operationTier ?? 1) * 104729) >>> 0; value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return value >>> 0; }

export function applyThreatBudget(enemies: Enemy[], contract: Contract) {
  const budget = contract.threatBudget ?? 34;
  const pattern = contract.encounterPattern ?? 'mixed';
  const effectiveness = contract.combatEffectiveness ?? 1;
  const tier = contract.operationTier ?? 1;
  const protocolCapacity = contract.eliteProtocolSlots ?? 0;
  const regular = enemies.filter(enemy => enemy.role !== 'boss' && enemy.id <= 8);
  for (const enemy of enemies) { enemy.protocols = []; enemy.mutations = []; enemy.protocolPulse = 0; enemy.combatClass = enemy.role === 'boss' ? 'command' : enemy.role === 'elite' ? 'elite' : 'standard'; }
  for (const enemy of regular) { enemy.effectiveness = effectiveness; enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * effectiveness)); enemy.hp = enemy.maxHp; enemy.maxArmor = Math.max(0, Math.round(enemy.maxArmor * effectiveness)); enemy.armor = enemy.maxArmor; }
  const boss = enemies.find(enemy => enemy.role === 'boss');
  if (boss) { const bossEffectiveness = Math.max(1, 1 + (effectiveness - 1) * 0.82); boss.effectiveness = bossEffectiveness; boss.maxHp = Math.max(1, Math.round(boss.maxHp * bossEffectiveness)); boss.hp = boss.maxHp; boss.maxArmor = Math.max(0, Math.round(boss.maxArmor * bossEffectiveness)); boss.armor = boss.maxArmor; }

  const reserveCommitment = (contract.reserveCount ?? 1) * 3;
  const environmentCommitment = (contract.environmentalEventSlots ?? 1) * 2;
  const protocolCommitment = protocolCapacity <= 0 ? 0 : Math.min(28, protocolCapacity * 4 + Math.max(0, tier - 5) + (contract.directiveProtocolDensity ?? 0) * 3);
  const mutationCommitment = tier < 9 ? 0 : tier === 9 ? 2 : tier === 10 ? 4 : tier === 11 ? 6 : 8;
  const bodyBudget = Math.max(22, budget - reserveCommitment - environmentCommitment - protocolCommitment - mutationCommitment);
  const core = regular.filter(enemy => enemy.id <= 6);
  for (const enemy of core) enemy.active = false;
  const forcedElite = authoredEliteRequired(contract) ? core.find(enemy => enemy.role === 'elite') : undefined;
  const forcedRepair = contract.directiveModifierIds?.includes('repair-network') ? core.find(enemy => enemy.variant === 'repairDrone') : undefined;
  const ordered = [...core].sort((a, b) => { if (pattern === 'swarm') return enemyThreatCost(a) - enemyThreatCost(b) || a.id - b.id; if (pattern === 'elite-led') { const eliteDelta = Number(b.role === 'elite') - Number(a.role === 'elite'); return eliteDelta || enemyThreatCost(b) - enemyThreatCost(a) || a.id - b.id; } return a.id - b.id; });
  const selected = new Set<number>(); let spent = 0;
  const select = (enemy: Enemy) => { if (selected.has(enemy.id)) return; selected.add(enemy.id); enemy.active = true; enemy.dead = false; spent += enemyThreatCost(enemy); };
  if (forcedElite) select(forcedElite);
  if (forcedRepair) select(forcedRepair);
  for (const enemy of ordered) { if (selected.has(enemy.id)) continue; if (selected.size < 4 || spent + enemyThreatCost(enemy) <= bodyBudget) select(enemy); }

  let protocolBudget = protocolCommitment;
  const active = core.filter(enemy => selected.has(enemy.id));
  const packageEnemy = (enemy: Enemy, combatClass: EnemyCombatClass, wantedCount: number) => {
    if (wantedCount <= 0 || protocolBudget <= 0) return false;
    const options = chooseEnemyProtocols(contract, enemy.role, enemy.variant, wantedCount, enemy.id);
    if (options.length === 0) return false;
    const classDelta = Math.max(0, combatClassThreat[combatClass] - combatClassThreat[enemy.combatClass]);
    let localCost = classDelta;
    const accepted = [];
    const combinationId = options.find(option => option.combinationId)?.combinationId;
    if (combinationId) {
      const bundle = options.filter(option => option.combinationId === combinationId);
      const bundleCost = bundle.reduce((total, option) => total + protocolThreatCost(option), 0);
      if (localCost + bundleCost > protocolBudget) return false;
      accepted.push(...bundle);
      localCost += bundleCost;
    }
    for (const option of options) {
      if (option.combinationId) continue;
      const nextCost = protocolThreatCost(option);
      if (localCost + nextCost > protocolBudget) continue;
      accepted.push(option);
      localCost += nextCost;
    }
    if (accepted.length === 0) return false;
    enemy.combatClass = combatClass; enemy.protocols = accepted; protocolBudget -= localCost; return true;
  };
  const activeElite = active.find(enemy => enemy.role === 'elite');
  if (activeElite && protocolCapacity > 0) packageEnemy(activeElite, 'elite', protocolCapacity);
  const candidates = active.filter(enemy => enemy !== activeElite).sort((a, b) => deterministicRank(contract, a) - deterministicRank(contract, b));
  if (!activeElite && tier >= 8 && candidates[0]) packageEnemy(candidates[0], 'elite', Math.min(protocolCapacity, tier >= 10 ? 3 : 2));
  const enhancedLimit = Math.min(3, (tier >= 9 ? 2 : protocolCapacity > 0 ? 1 : 0) + ((contract.directiveProtocolDensity ?? 0) > 0 ? 1 : 0)); let enhanced = 0;
  for (const enemy of candidates) { if (enemy.combatClass !== 'standard' || enhanced >= enhancedLimit) continue; const count = tier >= 7 ? Math.min(2, protocolCapacity) : 1; if (packageEnemy(enemy, 'enhanced', count)) enhanced += 1; }
  if (tier >= 6 && protocolBudget > 0) { const reserve = regular.filter(enemy => enemy.id >= 7).sort((a, b) => deterministicRank(contract, a) - deterministicRank(contract, b))[0]; if (reserve) packageEnemy(reserve, 'enhanced', 1); }

  let mutationBudget = mutationCommitment;
  const mutationLimit = tier >= 11 ? 2 : 1;
  const mutationCandidates = active
    .filter(enemy => enemy.role !== 'boss' && (enemy.combatClass === 'elite' || enemy.combatClass === 'enhanced'))
    .sort((a, b) => Number(b.combatClass === 'elite') - Number(a.combatClass === 'elite') || deterministicRank(contract, a) - deterministicRank(contract, b));
  for (const enemy of mutationCandidates) {
    if (mutationBudget <= 0) break;
    const chosen = [];
    for (const id of chooseEnemyMutations(contract, enemy, mutationLimit)) {
      const cost = mutationThreatCost(id);
      if (cost > mutationBudget) continue;
      chosen.push(id);
      mutationBudget -= cost;
    }
    if (chosen.length > 0) applyEnemyMutations(enemy, chosen);
  }
}

export function recoveryLevelForSource(maxRecoveryLevel: number, options: { deep: boolean; boss: boolean; eliteKills: number }) { const baseline = Math.max(1, maxRecoveryLevel - 5); const sourceBonus = (options.deep ? 2 : 0) + Math.min(2, Math.max(0, options.eliteKills)) + (options.boss ? 3 : 0); return Math.min(maxRecoveryLevel, baseline + sourceBonus); }
