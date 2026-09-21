import type { HighTierMutationId } from './t9Mutations';

type HighTierMutationPresentation = {
  name: string;
  shortName: string;
};

const presentation: Record<HighTierMutationId, HighTierMutationPresentation> = {
  'reinforced-core': { name: 'Reinforced Core', shortName: 'CORE+' },
  'ablative-mantle': { name: 'Ablative Mantle', shortName: 'MANTLE' },
  'hunter-servo': { name: 'Hunter Servo', shortName: 'SERVO' },
  'redline-bus': { name: 'Redline Bus', shortName: 'RED-BUS' },
  'countermass-rig': { name: 'Countermass Rig', shortName: 'CM-RIG' },
  'relay-reflex': { name: 'Relay Reflex', shortName: 'REFLEX' },
};

export function mutationPresentationFor(id: HighTierMutationId) {
  return presentation[id];
}
