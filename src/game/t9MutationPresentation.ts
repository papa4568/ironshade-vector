import type { Contract } from './campaign';
import type { HighTierMutationId } from './t9Mutations';

type HighTierMutationPresentation = {
  name: string;
  shortName: string;
  minTier: number;
};

const presentation: Record<HighTierMutationId, HighTierMutationPresentation> = {
  'reinforced-core': { name: 'Reinforced Core', shortName: 'CORE+', minTier: 9 },
  'ablative-mantle': { name: 'Ablative Mantle', shortName: 'MANTLE', minTier: 9 },
  'hunter-servo': { name: 'Hunter Servo', shortName: 'SERVO', minTier: 9 },
  'redline-bus': { name: 'Redline Bus', shortName: 'RED-BUS', minTier: 10 },
  'countermass-rig': { name: 'Countermass Rig', shortName: 'CM-RIG', minTier: 10 },
  'relay-reflex': { name: 'Relay Reflex', shortName: 'REFLEX', minTier: 11 },
};

const ids = Object.keys(presentation) as HighTierMutationId[];

function hash32(value: number) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function mutationPresentationFor(id: HighTierMutationId) {
  return presentation[id];
}

export function mutationForecastForContract(contract: Contract) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < 9) return [] as HighTierMutationId[];
  return ids
    .filter(id => tier >= presentation[id].minTier)
    .sort((a, b) => presentation[b].minTier - presentation[a].minTier || hash32(contract.seed ^ Math.imul(ids.indexOf(a) + 1, 374761393)) - hash32(contract.seed ^ Math.imul(ids.indexOf(b) + 1, 374761393)))
    .slice(0, tier >= 11 ? 4 : 3);
}
