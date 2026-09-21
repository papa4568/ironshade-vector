import type { Contract, DirectiveTargetClass } from './campaign';
import type { Enemy } from './sim';

export type CommandTargetMutationId = 'siege-authority' | 'pursuit-governor' | 'countermass-interlock' | 'relay-command-crown';
export type CommandTargetHazardKind = 'gravityWell' | 'shockGrid' | 'vectorWash';

export type CommandTargetMutationDefinition = {
  id: CommandTargetMutationId;
  name: string;
  shortName: string;
  description: string;
  minTier: number;
  hpScale: number;
  armorScale: number;
  fireCadenceScale: number;
  pulseKind?: CommandTargetHazardKind;
  pulseInterval?: number;
  pulseLead?: number;
};

const definitions: Record<CommandTargetMutationId, CommandTargetMutationDefinition> = {
  'siege-authority': {
    id: 'siege-authority',
    name: 'Siege Authority Core',
    shortName: 'SIEGE CORE',
    description: 'A hardened command core reinforces the target for the entire engagement instead of waiting for a phase transition.',
    minTier: 6,
    hpScale: 1.16,
    armorScale: 1.28,
    fireCadenceScale: 1.02,
  },
  'pursuit-governor': {
    id: 'pursuit-governor',
    name: 'Pursuit Governor',
    shortName: 'PURSUIT',
    description: 'A predictive pursuit governor accelerates command recovery and periodically vents countermass wash across the operator lane.',
    minTier: 7,
    hpScale: 1.08,
    armorScale: 1.14,
    fireCadenceScale: 1.12,
    pulseKind: 'vectorWash',
    pulseInterval: 8.4,
    pulseLead: 0.46,
  },
  'countermass-interlock': {
    id: 'countermass-interlock',
    name: 'Countermass Interlock',
    shortName: 'MASS LOCK',
    description: 'An integrated mass-control interlock hardens the chassis and projects recurring gravity wells throughout the fight.',
    minTier: 8,
    hpScale: 1.1,
    armorScale: 1.18,
    fireCadenceScale: 1.06,
    pulseKind: 'gravityWell',
    pulseInterval: 7.8,
    pulseLead: 0.4,
  },
  'relay-command-crown': {
    id: 'relay-command-crown',
    name: 'Relay Command Crown',
    shortName: 'RELAY CROWN',
    description: 'A command relay crown keeps firing logic hot while seeding recurring shock-grid denial around the operator.',
    minTier: 9,
    hpScale: 1.08,
    armorScale: 1.16,
    fireCadenceScale: 1.08,
    pulseKind: 'shockGrid',
    pulseInterval: 7.2,
    pulseLead: 0.34,
  },
};

export const commandTargetMutationIds = Object.keys(definitions) as CommandTargetMutationId[];

export type CommandTargetMutationSource = Pick<Contract, 'seed'>
  & Partial<Pick<Contract, 'operationTier' | 'directiveTier' | 'directiveTargetClass'>>
  & { tier?: number; targetClass?: DirectiveTargetClass };

export function commandTargetMutationDefinition(id: CommandTargetMutationId) {
  return definitions[id];
}

export function commandTargetMutationName(id: CommandTargetMutationId) {
  return definitions[id].name;
}

export function commandTargetMutationMinTier(id: CommandTargetMutationId) {
  return definitions[id].minTier;
}

function tierFor(source: CommandTargetMutationSource) {
  return Math.max(1, Math.round(source.operationTier ?? source.directiveTier ?? source.tier ?? 1));
}

function targetClassFor(source: CommandTargetMutationSource) {
  return source.directiveTargetClass ?? source.targetClass;
}

export function chooseCommandTargetMutations(source: CommandTargetMutationSource): CommandTargetMutationId[] {
  const tier = tierFor(source);
  if (targetClassFor(source) !== 'command-target' || tier < 6) return [];
  const legal = commandTargetMutationIds.filter(id => definitions[id].minTier <= tier);
  const index = ((source.seed ^ Math.imul(tier, 104729) ^ 0x51c3a7d9) >>> 0) % legal.length;
  return [legal[index]!];
}

export function commandTargetMutationForecastForContract(source: CommandTargetMutationSource) {
  return chooseCommandTargetMutations(source);
}

export function applyCommandTargetMutations(enemy: Enemy, ids: readonly CommandTargetMutationId[]) {
  enemy.commandTargetMutations = [...ids];
  let hpScale = 1;
  let armorScale = 1;
  for (const id of ids) {
    hpScale *= definitions[id].hpScale;
    armorScale *= definitions[id].armorScale;
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

export function commandTargetFireCadenceScale(enemy: Pick<Enemy, 'commandTargetMutations'>) {
  return Math.min(1.18, enemy.commandTargetMutations.reduce((scale, id) => scale * definitions[id].fireCadenceScale, 1));
}

export function commandTargetPulseDefinitions(enemy: Pick<Enemy, 'commandTargetMutations'>) {
  return enemy.commandTargetMutations
    .map(id => definitions[id])
    .filter(definition => definition.pulseKind && definition.pulseInterval);
}

export function commandTargetInitialCooldown(ids: readonly CommandTargetMutationId[]) {
  const intervals = ids.map(id => definitions[id].pulseInterval).filter((value): value is number => typeof value === 'number');
  return intervals.length > 0 ? Math.max(3.2, Math.min(...intervals) * 0.58) : 999;
}
