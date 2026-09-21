import type { Contract } from './campaign';

export type BossPhaseMutationId = 'rupture-crown' | 'redline-sequence' | 'countermass-halo' | 'relay-tempest';
export type BossPhaseHazardKind = 'gravityWell' | 'shockGrid' | 'vectorWash';

export type BossPhaseMutationDefinition = {
  id: BossPhaseMutationId;
  name: string;
  shortName: string;
  minTier: number;
  description: string;
  transitionText: string;
  fireCadenceScale: number;
  pulseKind?: BossPhaseHazardKind;
  pulseInterval?: number;
  pulseLead?: number;
};

const definitions: Record<BossPhaseMutationId, BossPhaseMutationDefinition> = {
  'rupture-crown': {
    id: 'rupture-crown',
    name: 'Rupture Crown',
    shortName: 'RUPTURE',
    minTier: 9,
    description: 'Phase two opens with a controlled pressure break, then repeats predictive countermass washes.',
    transitionText: 'PRESSURE CROWN RUPTURED',
    fireCadenceScale: 1.04,
    pulseKind: 'vectorWash',
    pulseInterval: 7.4,
    pulseLead: 0.48,
  },
  'redline-sequence': {
    id: 'redline-sequence',
    name: 'Redline Sequence',
    shortName: 'REDLINE',
    minTier: 9,
    description: 'Phase two immediately accelerates the command firing loop and keeps attack recovery compressed.',
    transitionText: 'REDLINE ATTACK SEQUENCE',
    fireCadenceScale: 1.22,
  },
  'countermass-halo': {
    id: 'countermass-halo',
    name: 'Countermass Halo',
    shortName: 'HALO',
    minTier: 10,
    description: 'Phase two projects predictive mass wells that punish stationary firing lanes.',
    transitionText: 'COUNTERMASS HALO ONLINE',
    fireCadenceScale: 1.08,
    pulseKind: 'gravityWell',
    pulseInterval: 7,
    pulseLead: 0.42,
  },
  'relay-tempest': {
    id: 'relay-tempest',
    name: 'Relay Tempest',
    shortName: 'TEMPEST',
    minTier: 11,
    description: 'Phase two drives recurring arc-denial pulses through the arena while the boss attack loop stays elevated.',
    transitionText: 'RELAY TEMPEST ONLINE',
    fireCadenceScale: 1.1,
    pulseKind: 'shockGrid',
    pulseInterval: 6.4,
    pulseLead: 0.34,
  },
};

export const bossPhaseMutationIds = Object.keys(definitions) as BossPhaseMutationId[];

function mix(value: number) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function bossPhaseMutationDefinition(id: BossPhaseMutationId) {
  return definitions[id];
}

export function chooseBossPhaseMutations(contract: Pick<Contract, 'seed' | 'operationTier'>): BossPhaseMutationId[] {
  const tier = Math.max(1, Math.round(contract.operationTier ?? 1));
  if (tier < 9) return [];
  const legal = bossPhaseMutationIds.filter(id => definitions[id].minTier <= tier);
  const count = tier >= 12 ? Math.min(2, legal.length) : Math.min(1, legal.length);
  if (count === 0) return [];

  const chosen: BossPhaseMutationId[] = [];
  let state = mix((contract.seed >>> 0) ^ (tier * 0x9e3779b1));
  let cursor = state % legal.length;
  while (chosen.length < count) {
    const candidate = legal[cursor % legal.length]!;
    if (!chosen.includes(candidate)) chosen.push(candidate);
    state = mix(state + 0x6d2b79f5 + chosen.length * 97);
    cursor = (cursor + 1 + (state % Math.max(1, legal.length - 1))) % legal.length;
  }
  return chosen;
}

export function bossPhaseMutationForecastForContract(contract: Pick<Contract, 'seed' | 'operationTier'>) {
  return chooseBossPhaseMutations(contract);
}

export function bossPhaseFireCadenceScale(enemy: { bossPhase: 1 | 2; bossPhaseMutations: BossPhaseMutationId[] }) {
  if (enemy.bossPhase !== 2 || enemy.bossPhaseMutations.length === 0) return 1;
  return Math.min(1.36, enemy.bossPhaseMutations.reduce((scale, id) => scale * definitions[id].fireCadenceScale, 1));
}

export function bossPhasePulseDefinitions(enemy: { bossPhase: 1 | 2; bossPhaseMutations: BossPhaseMutationId[] }) {
  if (enemy.bossPhase !== 2) return [];
  return enemy.bossPhaseMutations
    .map(id => definitions[id])
    .filter(definition => !!definition.pulseKind && !!definition.pulseInterval);
}
