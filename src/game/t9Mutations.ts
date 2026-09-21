import type { Contract } from './campaign';
import type { Enemy } from './sim';

export type HighTierMutationId = 'reinforced-core' | 'ablative-mantle' | 'hunter-servo' | 'redline-bus' | 'countermass-rig' | 'relay-reflex';

const ids: readonly HighTierMutationId[] = ['reinforced-core', 'ablative-mantle', 'hunter-servo', 'redline-bus', 'countermass-rig', 'relay-reflex'];
const stats = [
  [9, 2, 1.24, 1, 1, 1, 1],
  [9, 2, 1, 1.35, 1, 1, 1],
  [9, 2, 1, 1, 1.14, 1, 1],
  [10, 2, 1, 1, 1, 1.18, 1],
  [10, 3, 1.12, 1.18, 1.08, 1, 1],
  [11, 3, 1, 1, 1, 1.1, 1.22],
];
const cfg = (id: HighTierMutationId) => stats[ids.indexOf(id)]!;

export const mutationThreatCost = (id: HighTierMutationId) => cfg(id)[1]!;
export const mutationThreatCostForEnemy = (enemy: Pick<Enemy, 'mutations'>) => enemy.mutations.reduce((total, id) => total + mutationThreatCost(id), 0);

export function chooseEnemyMutations(contract: Contract, enemy: Pick<Enemy, 'id' | 'role' | 'combatClass'>, limit: number) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < 9 || limit <= 0 || enemy.role === 'boss' || enemy.combatClass === 'command' || enemy.combatClass === 'standard') return [] as HighTierMutationId[];
  const pool = ids.filter(id => tier >= cfg(id)[0]!);
  const start = (contract.seed ^ Math.imul(enemy.id, 7919)) >>> 0;
  return Array.from({ length: Math.min(limit, pool.length) }, (_, index) => pool[(start + index) % pool.length]!);
}

export function applyEnemyMutations(enemy: Enemy, mutationIds: readonly HighTierMutationId[]) {
  enemy.mutations = [...mutationIds];
  let hp = 1, armor = 1;
  for (const id of mutationIds) { const values = cfg(id); hp *= values[2]!; armor *= values[3]!; }
  if (hp !== 1) { enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hp)); enemy.hp = enemy.maxHp; }
  if (armor !== 1 && enemy.maxArmor > 0) { enemy.maxArmor = Math.max(1, Math.round(enemy.maxArmor * armor)); enemy.armor = enemy.maxArmor; }
}

const scale = (enemy: Pick<Enemy, 'mutations'>, index: 4 | 5 | 6) => enemy.mutations.reduce((value, id) => value * cfg(id)[index]!, 1);
export const mutationMobilityScale = (enemy: Pick<Enemy, 'mutations'>) => scale(enemy, 4);
export const mutationFireCadenceScale = (enemy: Pick<Enemy, 'mutations'>) => scale(enemy, 5);
export const mutationHazardCadenceScale = (enemy: Pick<Enemy, 'mutations'>) => scale(enemy, 6);
