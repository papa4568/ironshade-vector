import type { Contract } from './campaign';
import type { Enemy } from './sim';

export type EliteMutationId =
  | 'layered-carapace'
  | 'redline-servos'
  | 'countermass-brace'
  | 'vacuum-predator'
  | 'berserk-loop'
  | 'siege-frame';

export type EliteMutationDefinition = {
  id: EliteMutationId;
  minTier: number;
  threatCost: number;
  hpScale: number;
  armorScale: number;
};

export const eliteMutationDefinitions: readonly EliteMutationDefinition[] = [
  { id: 'layered-carapace', minTier: 9, threatCost: 3, hpScale: 1.04, armorScale: 1.28 },
  { id: 'redline-servos', minTier: 9, threatCost: 3, hpScale: 1, armorScale: 1 },
  { id: 'countermass-brace', minTier: 9, threatCost: 3, hpScale: 1.08, armorScale: 1 },
  { id: 'vacuum-predator', minTier: 10, threatCost: 4, hpScale: 1, armorScale: 1 },
  { id: 'berserk-loop', minTier: 11, threatCost: 4, hpScale: 1.06, armorScale: 1 },
  { id: 'siege-frame', minTier: 12, threatCost: 5, hpScale: 1.24, armorScale: 1.12 },
];

const byId = new Map(eliteMutationDefinitions.map(definition => [definition.id, definition]));

function hash32(value: number) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function eliteMutationDefinition(id: EliteMutationId) {
  return byId.get(id)!;
}

export function eliteMutationThreatCost(id: EliteMutationId) {
  return eliteMutationDefinition(id).threatCost;
}

export function eliteMutationStatScales(id: EliteMutationId) {
  const definition = eliteMutationDefinition(id);
  return { hp: definition.hpScale, armor: definition.armorScale };
}

export function chooseEliteMutationForEnemy(contract: Contract, enemy: Enemy) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < 9 || enemy.role === 'boss' || enemy.combatClass !== 'elite') return undefined;
  const eligible = eliteMutationDefinitions.filter(definition => tier >= definition.minTier);
  if (eligible.length === 0) return undefined;
  const rank = hash32(contract.seed ^ Math.imul(enemy.id, 2246822519) ^ Math.imul(tier, 3266489917));
  return eligible[rank % eligible.length]!.id;
}

export function eliteMutationForecastForContract(contract: Contract) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < 9) return [] as EliteMutationId[];
  const eligible = eliteMutationDefinitions.filter(definition => tier >= definition.minTier);
  const limit = tier >= 12 ? 3 : tier >= 10 ? 2 : 1;
  return [...eligible]
    .sort((a, b) => hash32(contract.seed ^ Math.imul(tier, 668265263) ^ Math.imul(a.id.length, 374761393)) - hash32(contract.seed ^ Math.imul(tier, 668265263) ^ Math.imul(b.id.length, 374761393)))
    .slice(0, limit)
    .map(definition => definition.id);
}

export function eliteMutationMobilityScale(enemy: Enemy, pressure: number) {
  switch (enemy.mutationId) {
    case 'layered-carapace': return 0.94;
    case 'redline-servos': return 1.18;
    case 'countermass-brace': return 0.96;
    case 'vacuum-predator': return pressure < 0.5 ? 1.24 : 1.03;
    case 'berserk-loop': return enemy.maxHp > 0 && enemy.hp <= enemy.maxHp * 0.5 ? 1.18 : 1;
    case 'siege-frame': return 0.9;
    default: return 1;
  }
}

export function eliteMutationCooldownRate(enemy: Enemy, pressure: number) {
  switch (enemy.mutationId) {
    case 'redline-servos': return 1.14;
    case 'vacuum-predator': return pressure < 0.5 ? 1.18 : 1.03;
    case 'berserk-loop': return enemy.maxHp > 0 && enemy.hp <= enemy.maxHp * 0.5 ? 1.35 : 1;
    default: return 1;
  }
}

export function eliteMutationKnockbackScale(enemy: Enemy) {
  switch (enemy.mutationId) {
    case 'countermass-brace': return 0.55;
    case 'siege-frame': return 0.35;
    default: return 1;
  }
}

export function eliteMutationStaggerScale(enemy: Enemy) {
  switch (enemy.mutationId) {
    case 'countermass-brace': return 0.72;
    case 'siege-frame': return 0.65;
    default: return 1;
  }
}
