import type { BossPhaseMutationId } from './bossPhaseMutations';

const presentation: Record<BossPhaseMutationId, { name: string; shortName: string }> = {
  'rupture-crown': { name: 'Rupture Crown', shortName: 'RUPTURE' },
  'redline-sequence': { name: 'Redline Sequence', shortName: 'REDLINE' },
  'countermass-halo': { name: 'Countermass Halo', shortName: 'HALO' },
  'relay-tempest': { name: 'Relay Tempest', shortName: 'TEMPEST' },
};

export function bossPhaseMutationPresentationFor(id: BossPhaseMutationId) { return presentation[id]; }
