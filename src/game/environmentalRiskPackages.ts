import type { LocationId, ObjectiveMode } from './campaign';
import type { EnvironmentalEventId } from './environmentalEvents';

export type EnvironmentalRiskPackageId =
  | 'arc-purge-interlock'
  | 'breach-shutter-trap'
  | 'restraint-swing'
  | 'gravity-defense-collapse'
  | 'spin-blackout'
  | 'compressor-flashover'
  | 'solar-thermal-cascade'
  | 'bore-purge-collapse';

export type EnvironmentalRiskPackageDefinition = {
  id: EnvironmentalRiskPackageId;
  name: string;
  shortName: string;
  description: string;
  minTier: number;
  events: [EnvironmentalEventId, EnvironmentalEventId];
  rewardMultiplier: number;
  riskRating: number;
  locations?: LocationId[];
  excludeObjectives?: ObjectiveMode[];
};

const definitions: EnvironmentalRiskPackageDefinition[] = [
  {
    id: 'arc-purge-interlock',
    name: 'Arc-Purge Interlock',
    shortName: 'ARC + PURGE',
    description: 'Life-support pressure loss overlaps a live conduit flashover, forcing movement while the atmosphere is unstable.',
    minTier: 9,
    events: ['life-support-purge', 'conduit-flashover'],
    rewardMultiplier: 1.08,
    riskRating: 4,
  },
  {
    id: 'breach-shutter-trap',
    name: 'Breach-Shutter Trap',
    shortName: 'BREACH + SHUTTER',
    description: 'A debris breach opens immediately before emergency shutters divide the combat space.',
    minTier: 10,
    events: ['debris-impact', 'emergency-shutters'],
    rewardMultiplier: 1.1,
    riskRating: 5,
    excludeObjectives: ['emergency-boarding'],
  },
  {
    id: 'restraint-swing',
    name: 'Restraint Swing Cascade',
    shortName: 'LOAD + SWING',
    description: 'Loose cargo becomes ballistic while a magnetic load sweeps the same maneuvering lane.',
    minTier: 10,
    events: ['cargo-restraint-failure', 'magnetic-load-swing'],
    rewardMultiplier: 1.11,
    riskRating: 5,
    locations: ['spin-habitat', 'jovian-harvester', 'asteroid-refinery', 'solar-yard'],
  },
  {
    id: 'gravity-defense-collapse',
    name: 'Gravity-Defense Collapse',
    shortName: 'MASS + DEFENSE',
    description: 'Transfer gravity collapses as dormant defense hardware reactivates into the low-g firing space.',
    minTier: 11,
    events: ['reactor-load-shed', 'dormant-defenses'],
    rewardMultiplier: 1.13,
    riskRating: 6,
    locations: ['orbital-station', 'asteroid-refinery', 'solar-yard'],
  },
  {
    id: 'spin-blackout',
    name: 'Spin Blackout',
    shortName: 'SPIN + GRID',
    description: 'Habitat overspeed destabilizes movement while dormant defenses energize the rotating deck.',
    minTier: 11,
    events: ['spin-overspeed', 'dormant-defenses'],
    rewardMultiplier: 1.13,
    riskRating: 6,
    locations: ['spin-habitat'],
  },
  {
    id: 'compressor-flashover',
    name: 'Compressor Flashover',
    shortName: 'BACKFLOW + ARC',
    description: 'Compressor backflow and electrical flashover overlap into a pressure-and-grid failure window.',
    minTier: 12,
    events: ['compressor-backflow', 'conduit-flashover'],
    rewardMultiplier: 1.16,
    riskRating: 7,
    locations: ['jovian-harvester', 'asteroid-refinery'],
  },
  {
    id: 'solar-thermal-cascade',
    name: 'Solar Thermal Cascade',
    shortName: 'THERMAL + RUNAWAY',
    description: 'Radiator saturation raises weapon heat while industrial machinery runs uncontrolled through the yard.',
    minTier: 12,
    events: ['radiator-saturation', 'crane-runaway'],
    rewardMultiplier: 1.16,
    riskRating: 7,
    locations: ['solar-yard'],
  },
  {
    id: 'bore-purge-collapse',
    name: 'Bore Purge Collapse',
    shortName: 'BORE + PURGE',
    description: 'A bore-wall collapse overlaps a life-support purge, combining debris denial with pressure loss.',
    minTier: 12,
    events: ['bore-collapse', 'life-support-purge'],
    rewardMultiplier: 1.16,
    riskRating: 7,
    locations: ['ice-mine'],
  },
];

export type EnvironmentalRiskSource = {
  seed: number;
  directiveTier?: number;
  operationTier?: number;
  tier?: number;
  location: LocationId;
  objectiveMode: ObjectiveMode;
};

function tierFor(source: EnvironmentalRiskSource) {
  return Math.max(1, Math.round(source.directiveTier ?? source.tier ?? source.operationTier ?? 1));
}

function isDirectiveSource(source: EnvironmentalRiskSource) {
  return typeof source.directiveTier === 'number' || typeof source.tier === 'number';
}

function legalFor(source: EnvironmentalRiskSource, definition: EnvironmentalRiskPackageDefinition) {
  const tier = tierFor(source);
  if (definition.minTier > tier) return false;
  if (definition.locations && !definition.locations.includes(source.location)) return false;
  if (definition.excludeObjectives?.includes(source.objectiveMode)) return false;
  return true;
}

function hash(seed: number, salt: number) {
  let value = (seed ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function environmentalRiskPackageForContract(source: EnvironmentalRiskSource): EnvironmentalRiskPackageDefinition | null {
  const tier = tierFor(source);
  if (!isDirectiveSource(source) || tier < 9) return null;
  const legal = definitions.filter(definition => legalFor(source, definition));
  if (legal.length === 0) return null;
  return legal[hash(source.seed, tier + 41) % legal.length]!;
}

export function environmentalRiskRewardMultiplierForContract(source: EnvironmentalRiskSource) {
  return environmentalRiskPackageForContract(source)?.rewardMultiplier ?? 1;
}

export function environmentalRiskForecastForContract(source: EnvironmentalRiskSource) {
  const definition = environmentalRiskPackageForContract(source);
  return definition ? [definition] : [];
}

export function environmentalRiskPackageDefinition(id: EnvironmentalRiskPackageId) {
  return definitions.find(definition => definition.id === id)!;
}
