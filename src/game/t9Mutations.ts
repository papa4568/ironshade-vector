import type { Contract } from './campaign';
import type { Enemy } from './sim';

export type HighTierMutationId =
  | 'reinforced-core'
  | 'ablative-mantle'
  | 'hunter-servo'
  | 'redline-bus'
  | 'countermass-rig'
  | 'relay-reflex';

export const highTierMutationIds: readonly HighTierMutationId[] = [
  'reinforced-core',
  'ablative-mantle',
  'hunter-servo',
  'redline-bus',
  'countermass-rig',
  'relay-reflex',
];

type MutationStats = readonly [
  minTier: number,
  threatCost: number,
  hpScale?: number,
  armorScale?: number,
  mobilityScale?: number,
  fireCadenceScale?: number,
  hazardCadenceScale?: number,
];

const mutationStats: Record<HighTierMutationId, MutationStats> = {
  'reinforced-core': [9, 2, 1.24],
  'ablative-mantle': [9, 2, 1, 1.35],
  'hunter-servo': [9, 2, 1, 1, 1.14],
  'redline-bus': [10, 2, 1, 1, 1, 1.18],
  'countermass-rig': [10, 3, 1.12, 1.18, 1.08],
  'relay-reflex': [11, 3, 1, 1, 1, 1.1, 1.22],
};

function hash32(value: number) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function tierFor(contract: Contract) {
  return contract.operationTier ?? contract.directiveTier ?? 1;
}

function rank(contract: Contract, enemyId: number, id: HighTierMutationId) {
  return hash32(contract.seed ^ Math.imul(enemyId, 104729) ^ Math.imul(highTierMutationIds.indexOf(id) + 1, -1640531527));
}

export function mutationThreatCost(id: HighTierMutationId) {
  return mutationStats[id][1];
}

export function mutationThreatCostForEnemy(enemy: Pick<Enemy, 'mutations'>) {
  return enemy.mutations.reduce((total, id) => total + mutationThreatCost(id), 0);
}

export function chooseEnemyMutations(
  contract: Contract,
  enemy: Pick<Enemy, 'id' | 'role' | 'combatClass'>,
  limit: number,
) {
  const tier = tierFor(contract);
  if (tier < 9 || limit <= 0 || enemy.role === 'boss' || enemy.combatClass === 'command' || enemy.combatClass === 'standard') return [] as HighTierMutationId[];
  return highTierMutationIds
    .filter(id => tier >= mutationStats[id][0])
    .sort((a, b) => rank(contract, enemy.id, a) - rank(contract, enemy.id, b))
    .slice(0, limit);
}

export function applyEnemyMutations(enemy: Enemy, ids: readonly HighTierMutationId[]) {
  enemy.mutations = [...ids];
  let hpScale = 1;
  let armorScale = 1;
  for (const id of ids) {
    hpScale *= mutationStats[id][2] ?? 1;
    armorScale *= mutationStats[id][3] ?? 1;
  }
  if (hpScale !== 1) {
    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpScale));
    enemy.hp = enemy.maxHp;
  }
  if (armorScale !== 1 && enemy.maxArmor > 0) {
    enemy.maxArmor = Math.max(1, Math.round(enemy.maxArmor * armorScale));
    enemy.armor = enemy.maxArmor;
  }
}

function mutationScale(enemy: Pick<Enemy, 'mutations'>, index: 4 | 5 | 6) {
  return enemy.mutations.reduce((scale, id) => scale * (mutationStats[id][index] ?? 1), 1);
}

export function mutationMobilityScale(enemy: Pick<Enemy, 'mutations'>) {
  return mutationScale(enemy, 4);
}

export function mutationFireCadenceScale(enemy: Pick<Enemy, 'mutations'>) {
  return mutationScale(enemy, 5);
}

export function mutationHazardCadenceScale(enemy: Pick<Enemy, 'mutations'>) {
  return mutationScale(enemy, 6);
}
