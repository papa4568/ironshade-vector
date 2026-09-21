import type { Contract } from './campaign';

export type BossPhaseMutationId = 'rupture-crown' | 'redline-sequence' | 'countermass-halo' | 'relay-tempest';
export type BossPhaseHazardKind = 'gravityWell' | 'shockGrid' | 'vectorWash';
export type BossPhaseMutationRuntime = { minTier: number; fireCadenceScale: number; pulseKind?: BossPhaseHazardKind; pulseInterval?: number; pulseLead?: number };

const runtime: Record<BossPhaseMutationId, BossPhaseMutationRuntime> = {
  'rupture-crown': { minTier: 9, fireCadenceScale: 1.04, pulseKind: 'vectorWash', pulseInterval: 7.4, pulseLead: 0.48 },
  'redline-sequence': { minTier: 9, fireCadenceScale: 1.22 },
  'countermass-halo': { minTier: 10, fireCadenceScale: 1.08, pulseKind: 'gravityWell', pulseInterval: 7, pulseLead: 0.42 },
  'relay-tempest': { minTier: 11, fireCadenceScale: 1.1, pulseKind: 'shockGrid', pulseInterval: 6.4, pulseLead: 0.34 },
};
export const bossPhaseMutationIds = Object.keys(runtime) as BossPhaseMutationId[];

export function bossPhaseMutationMinTier(id: BossPhaseMutationId) { return runtime[id].minTier; }

export function chooseBossPhaseMutations(contract: Pick<Contract, 'seed' | 'operationTier'>): BossPhaseMutationId[] {
  const tier = Math.max(1, Math.round(contract.operationTier ?? 1));
  if (tier < 9) return [];
  const legal = bossPhaseMutationIds.filter(id => runtime[id].minTier <= tier);
  const index = ((contract.seed ^ tier * 7919) >>> 0) % legal.length;
  const first = legal[index]!;
  if (tier < 12 || legal.length < 2) return [first];
  const step = 1 + (((contract.seed >>> 5) ^ tier * 97) >>> 0) % (legal.length - 1);
  return [first, legal[(index + step) % legal.length]!];
}

export function bossPhaseMutationForecastForContract(contract: Pick<Contract, 'seed' | 'operationTier'>) {
  return chooseBossPhaseMutations(contract);
}

export function bossPhaseFireCadenceScale(enemy: { bossPhase: 1 | 2; bossPhaseMutations: BossPhaseMutationId[] }) {
  if (enemy.bossPhase !== 2) return 1;
  return Math.min(1.36, enemy.bossPhaseMutations.reduce((scale, id) => scale * runtime[id].fireCadenceScale, 1));
}

export function bossPhasePulseDefinitions(enemy: { bossPhase: 1 | 2; bossPhaseMutations: BossPhaseMutationId[] }) {
  if (enemy.bossPhase !== 2) return [];
  return enemy.bossPhaseMutations.map(id => runtime[id]).filter(definition => definition.pulseKind && definition.pulseInterval);
}
