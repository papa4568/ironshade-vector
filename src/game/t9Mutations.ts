import type { Contract } from './campaign';
import type { Enemy } from './sim';

export type HighTierMutationId =
  | 'reinforced-core'
  | 'ablative-mantle'
  | 'hunter-servo'
  | 'redline-bus'
  | 'countermass-rig'
  | 'relay-reflex';

export type HighTierMutationDefinition = {
  id: HighTierMutationId;
  minTier: number;
  threatCost: number;
  hpScale?: number;
  armorScale?: number;
  mobilityScale?: number;
  fireCadenceScale?: number;
  hazardCadenceScale?: number;
};

export const highTierMutationDefinitions: readonly HighTierMutationDefinition[] = [
  { id: 'reinforced-core', minTier: 9, threatCost: 2, hpScale: 1.24 },
  { id: 'ablative-mantle', minTier: 9, threatCost: 2, armorScale: 1.35 },
  { id: 'hunter-servo', minTier: 9, threatCost: 2, mobilityScale: 1.14 },
  { id: 'redline-bus', minTier: 10, threatCost: 2, fireCadenceScale: 1.18 },
  { id: 'countermass-rig', minTier: 10, threatCost: 3, hpScale: 1.12, armorScale: 1.18, mobilityScale: 1.08 },
  { id: 'relay-reflex', minTier: 11, threatCost: 3, fireCadenceScale: 1.1, hazardCadenceScale: 1.22 },
];

const byId = new Map(highTierMutationDefinitions.map(definition => [definition.id, definition]));

function hash32(value: number) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function tierFor(contract: Contract) {
  return contract.operationTier ?? contract.directiveTier ?? 1;
}

function rank(contract: Contract, enemyId: number, id: HighTierMutationId) {
  return hash32(contract.seed ^ enemyId * 104729 ^ hashText(id));
}

export function mutationDefinition(id: HighTierMutationId) {
  return byId.get(id)!;
}

export function mutationThreatCost(id: HighTierMutationId) {
  return mutationDefinition(id).threatCost;
}

export function mutationThreatCostForEnemy(enemy: Pick<Enemy, 'mutations'>) {
  return enemy.mutations.reduce((total, id) => total + mutationThreatCost(id), 0);
}

export function mutationForecastForContract(contract: Contract) {
  const tier = tierFor(contract);
  if (tier < 9) return [] as HighTierMutationId[];
  return highTierMutationDefinitions
    .filter(definition => tier >= definition.minTier)
    .sort((a, b) => b.minTier - a.minTier || rank(contract, 0, a.id) - rank(contract, 0, b.id))
    .slice(0, tier >= 11 ? 4 : 3)
    .map(definition => definition.id);
}

export function chooseEnemyMutations(
  contract: Contract,
  enemy: Pick<Enemy, 'id' | 'role' | 'combatClass'>,
  limit: number,
) {
  const tier = tierFor(contract);
  if (tier < 9 || limit <= 0 || enemy.role === 'boss' || enemy.combatClass === 'command' || enemy.combatClass === 'standard') {
    return [] as HighTierMutationId[];
  }
  return highTierMutationDefinitions
    .filter(definition => tier >= definition.minTier)
    .sort((a, b) => rank(contract, enemy.id, a.id) - rank(contract, enemy.id, b.id))
    .slice(0, limit)
    .map(definition => definition.id);
}

export function applyEnemyMutations(enemy: Enemy, ids: readonly HighTierMutationId[]) {
  enemy.mutations = [...ids];
  let hpScale = 1;
  let armorScale = 1;
  for (const id of ids) {
    const definition = mutationDefinition(id);
    hpScale *= definition.hpScale ?? 1;
    armorScale *= definition.armorScale ?? 1;
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

function mutationScale(enemy: Pick<Enemy, 'mutations'>, key: 'mobilityScale' | 'fireCadenceScale' | 'hazardCadenceScale') {
  return enemy.mutations.reduce((scale, id) => scale * (mutationDefinition(id)[key] ?? 1), 1);
}

export function mutationMobilityScale(enemy: Pick<Enemy, 'mutations'>) {
  return mutationScale(enemy, 'mobilityScale');
}

export function mutationFireCadenceScale(enemy: Pick<Enemy, 'mutations'>) {
  return mutationScale(enemy, 'fireCadenceScale');
}

export function mutationHazardCadenceScale(enemy: Pick<Enemy, 'mutations'>) {
  return mutationScale(enemy, 'hazardCadenceScale');
}
