import type { EliteMutationId } from './eliteMutations';

type EliteMutationPresentation = {
  name: string;
  shortName: string;
  description: string;
};

const presentation: Record<EliteMutationId, EliteMutationPresentation> = {
  'layered-carapace': { name: 'Layered Carapace', shortName: 'CARAPACE', description: 'Extra armor laminate and hull mass trade speed for durability.' },
  'redline-servos': { name: 'Redline Servos', shortName: 'REDLINE', description: 'Actuators run above nominal limits for faster movement and attack cycling.' },
  'countermass-brace': { name: 'Countermass Brace', shortName: 'BRACED', description: 'Countermass bracing resists knockback and shortens stagger windows.' },
  'vacuum-predator': { name: 'Vacuum Predator', shortName: 'VAC-PRED', description: 'Low pressure sharply accelerates pursuit and ability cadence.' },
  'berserk-loop': { name: 'Berserk Loop', shortName: 'BERSERK', description: 'Below half integrity, movement and attack cycling surge.' },
  'siege-frame': { name: 'Siege Frame', shortName: 'SIEGE', description: 'A T12 heavy frame gains major hull mass and extreme displacement resistance.' },
};

export function eliteMutationPresentationFor(id: EliteMutationId) {
  return presentation[id];
}
