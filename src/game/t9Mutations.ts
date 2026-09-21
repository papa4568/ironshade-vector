import type { Contract } from './campaign';
import type { Enemy } from './sim';

const mutationIds = ['reinforced-core', 'ablative-mantle', 'hunter-servo', 'redline-bus', 'countermass-rig', 'relay-reflex'] as const;
export type HighTierMutationId = (typeof mutationIds)[number];

const mutationStats = [
  [9, 2, 1.24, 1, 1, 1, 1],
  [9, 2, 1, 1.35, 1, 1, 1],
  [9, 2, 1, 1, 1.14, 1, 1],
  [10, 2, 1, 1, 1, 1.18, 1],
  [10, 3, 1.12, 1.18, 1.08, 1, 1],
  [11, 3, 1, 1, 1, 1.1, 1.22],
] as const;

function statsFor(id: HighTierMutationId) {
  return mutationStats[mutationIds.indexOf(id)]!;
}

export function mutationThreatCost(id: HighTierMutationId) {
  return statsFor(id)[1];
}

export function mutationThreatCostForEnemy(enemy: Pick<Enemy, 'mutations'>) {
  return enemy.mutations.reduce((total, id) => total + mutationThreatCost(id), 0);
}

export function chooseEnemyMutations(
  contract: Contract,
  enemy: Pick<Enemy, 'id' | 'role' | 'combatClass'>,
  limit: number,
) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < 9 || limit <= 0 || enemy.role === 'boss' || enemy.combatClass === 'command' || enemy.combatClass === 'standard') return [] as HighTierMutationId[];
  const eligible = mutationIds.filter(id => tier >= statsFor(id)[0]);
  const start = ((contract.seed ^ Math.imul(enemy.id, 104729)) >>> 0) % eligible.length;
  return Array.from({ length: Math.min(limit, eligible.length) }, (_, index) => eligible[(start + index) % eligible.length]!);
}

export function applyEnemyMutations(enemy: Enemy, ids: readonly HighTierMutationId[]) {
  enemy.mutations = [...ids];
  let hpScale = 1;
  let armorScale = 1;
  for (const id of ids) {
    const stats = statsFor(id);
    hpScale *= stats[2];
    armorScale *= stats[3];
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
  return enemy.mutations.reduce((scale, id) => scale * statsFor(id)[index], 1);
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
