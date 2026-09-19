import type { Contract, LocationId } from './campaign';
import type { EnemyRole, EnemyVariant } from './sim';

export type EnemyCombatClass = 'standard' | 'enhanced' | 'elite' | 'command';
export type ProtocolFamily = 'defense' | 'pressure' | 'mass' | 'systems' | 'control' | 'fire' | 'objective';
export type EnemyProtocolId =
  | 'reactivePlating'
  | 'pressureHunter'
  | 'vacuumAdapted'
  | 'breachmaker'
  | 'magneticLock'
  | 'gravityAnchor'
  | 'countermassMobility'
  | 'arcConduit'
  | 'repairMesh'
  | 'droneEscort'
  | 'emergencyShutters'
  | 'sensorGhost'
  | 'signalJammer'
  | 'thermalOverrun'
  | 'suppressionCoordinator'
  | 'penetratorVolley'
  | 'salvageInterdictor'
  | 'recoveryDenial';

export type EnemyProtocolInstance = {
  id: EnemyProtocolId;
  enhanced: boolean;
  cooldown: number;
  windup: number;
};

type ProtocolDefinition = {
  id: EnemyProtocolId;
  name: string;
  shortName: string;
  family: ProtocolFamily;
  threatCost: number;
  rewardWeight: number;
  tell: string;
  counter: string;
  baseCooldown: number;
  enhanceable?: boolean;
  locations?: LocationId[];
  roles?: EnemyRole[];
  excludedVariants?: EnemyVariant[];
  objectiveModes?: Contract['objectiveMode'][];
};

export const eliteProtocolDefinitions: ProtocolDefinition[] = [
  { id: 'reactivePlating', name: 'Reactive Plating', shortName: 'PLATING', family: 'defense', threatCost: 3, rewardWeight: 1, tell: 'Armor panels flash and re-knit between pressure cycles.', counter: 'Sustain armor pressure or disrupt the unit before the repair pulse.', baseCooldown: 7.2, enhanceable: true },
  { id: 'pressureHunter', name: 'Pressure Hunter', shortName: 'PRESSURE', family: 'pressure', threatCost: 3, rewardWeight: 1, tell: 'Suit vents flare when local atmosphere drops.', counter: 'Repressurize the room, seal the breach, or stagger the pursuer.', baseCooldown: 7.8, locations: ['orbital-station', 'damaged-vessel', 'jovian-harvester'] },
  { id: 'vacuumAdapted', name: 'Vacuum Adapted', shortName: 'VAC-ADAPT', family: 'pressure', threatCost: 3, rewardWeight: 1, tell: 'Hard-vac trim remains stable during decompression.', counter: 'Restore pressure or use Magnetic Impulse to break its line.', baseCooldown: 8.4, locations: ['damaged-vessel', 'jovian-harvester', 'ice-mine', 'solar-yard', 'cryo-reserve'] },
  { id: 'breachmaker', name: 'Breachmaker', shortName: 'BREACH', family: 'pressure', threatCost: 4, rewardWeight: 1, tell: 'Demolition hardware locks onto nearby cover.', counter: 'Disrupt the carrier or reposition before the firing lane opens.', baseCooldown: 7.4, enhanceable: true, locations: ['orbital-station', 'damaged-vessel', 'asteroid-refinery', 'ice-mine', 'lattice-annex'] },
  { id: 'magneticLock', name: 'Magnetic Lock', shortName: 'MAG-LOCK', family: 'mass', threatCost: 4, rewardWeight: 1, tell: 'A blue mass-reference reticle forms on the operator vector.', counter: 'Sensor Spike or Arc disruption prevents the lock; move clear of the well.', baseCooldown: 6.6, enhanceable: true, locations: ['orbital-station', 'spin-habitat', 'jovian-harvester', 'lattice-annex', 'momentum-exchange'] },
  { id: 'gravityAnchor', name: 'Gravity Anchor', shortName: 'ANCHOR', family: 'mass', threatCost: 4, rewardWeight: 1, tell: 'Anchor vanes flare and the unit resists pressure and impulse.', counter: 'Arc Tap or Sensor Spike disables the anchor before Magnetic Impulse.', baseCooldown: 7.6, enhanceable: true, locations: ['asteroid-refinery', 'spin-habitat', 'solar-yard', 'lattice-annex', 'momentum-exchange'] },
  { id: 'countermassMobility', name: 'Countermass Mobility', shortName: 'COUNTERMASS', family: 'mass', threatCost: 3, rewardWeight: 1, tell: 'Countermass pods precess before a lateral vector burst.', counter: 'Magnetic Impulse interrupts committed movement; walls limit the escape.', baseCooldown: 5.8, enhanceable: true, locations: ['spin-habitat', 'jovian-harvester', 'ice-mine', 'momentum-exchange'] },
  { id: 'arcConduit', name: 'Arc Conduit', shortName: 'ARC-LINK', family: 'systems', threatCost: 4, rewardWeight: 1, tell: 'Visible arcs bridge the unit to floor hardware.', counter: 'Arc Tap turns the conductive network into a disruption path.', baseCooldown: 6.4, enhanceable: true, locations: ['orbital-station', 'asteroid-refinery', 'solar-yard', 'lattice-annex'] },
  { id: 'repairMesh', name: 'Repair Mesh', shortName: 'REPAIR', family: 'systems', threatCost: 3, rewardWeight: 1, tell: 'Green repair tracers link damaged armor and machinery.', counter: 'Disrupt the mesh or destroy repaired hardware faster than it cycles.', baseCooldown: 6.8, enhanceable: true, locations: ['orbital-station', 'asteroid-refinery', 'solar-yard', 'lattice-annex', 'momentum-exchange', 'cryo-reserve'] },
  { id: 'droneEscort', name: 'Drone Escort', shortName: 'ESCORT', family: 'systems', threatCost: 4, rewardWeight: 1, tell: 'Docking lights open on a limited support-drone rack.', counter: 'Kill the finite drones or disrupt the carrier before launch.', baseCooldown: 8.2, enhanceable: true, locations: ['orbital-station', 'asteroid-refinery', 'jovian-harvester', 'solar-yard', 'lattice-annex'], excludedVariants: ['droneCarrier'] },
  { id: 'emergencyShutters', name: 'Emergency Shutters', shortName: 'SHUTTERS', family: 'control', threatCost: 4, rewardWeight: 1, tell: 'Amber lane markers illuminate before portable shutters rise.', counter: 'Destroy or penetrate the shutters, or reposition before closure.', baseCooldown: 8.8, enhanceable: true, locations: ['orbital-station', 'damaged-vessel', 'spin-habitat', 'lattice-annex', 'momentum-exchange', 'cryo-reserve'] },
  { id: 'sensorGhost', name: 'Sensor Ghost', shortName: 'GHOST', family: 'control', threatCost: 3, rewardWeight: 1, tell: 'The silhouette doubles on assisted targeting returns.', counter: 'Sensor Spike resolves the true return; manual aim remains available.', baseCooldown: 8.1, locations: ['spin-habitat', 'ice-mine', 'lattice-annex'] },
  { id: 'signalJammer', name: 'Signal Jammer', shortName: 'JAMMER', family: 'control', threatCost: 4, rewardWeight: 1, tell: 'A violet interference ring expands around the unit.', counter: 'Break range or Arc-disrupt the jammer before its pulse.', baseCooldown: 7.1, enhanceable: true, locations: ['orbital-station', 'jovian-harvester', 'solar-yard', 'lattice-annex'] },
  { id: 'thermalOverrun', name: 'Thermal Overrun', shortName: 'REDLINE', family: 'fire', threatCost: 4, rewardWeight: 1, tell: 'Weapon coils glow before a committed burst and forced cooldown.', counter: 'Break line of sight or interrupt the telegraph, then punish self-stagger.', baseCooldown: 7.5, enhanceable: true, locations: ['asteroid-refinery', 'jovian-harvester', 'solar-yard', 'cryo-reserve'] },
  { id: 'suppressionCoordinator', name: 'Suppression Coordinator', shortName: 'COORD', family: 'fire', threatCost: 4, rewardWeight: 1, tell: 'Squad firing markers synchronize around the coordinator.', counter: 'Disrupt or kill the coordinator to break the synchronized window.', baseCooldown: 8, enhanceable: true, locations: ['orbital-station', 'asteroid-refinery', 'spin-habitat', 'ice-mine'] },
  { id: 'penetratorVolley', name: 'Penetrator Volley', shortName: 'PEN-VOLLEY', family: 'fire', threatCost: 4, rewardWeight: 1, tell: 'A long straight-line firing solution locks before the volley.', counter: 'Dodge the visible solution, use hard cover, or interrupt it.', baseCooldown: 7.2, enhanceable: true, locations: ['orbital-station', 'asteroid-refinery', 'ice-mine', 'lattice-annex', 'momentum-exchange', 'cryo-reserve'] },
  { id: 'salvageInterdictor', name: 'Salvage Interdictor', shortName: 'INTERDICT', family: 'objective', threatCost: 4, rewardWeight: 2, tell: 'Recovery-tag telemetry is copied to the hostile unit.', counter: 'Intercept the carrier; death restores the package tag.', baseCooldown: 5.4, enhanceable: true, objectiveModes: ['machinery-recovery', 'deep-salvage'], excludedVariants: ['salvageThief'] },
  { id: 'recoveryDenial', name: 'Recovery Denial', shortName: 'DENIAL', family: 'objective', threatCost: 4, rewardWeight: 2, tell: 'A denial grid forms around tagged objective hardware.', counter: 'Disrupt the projector, isolate the grid, or approach from another lane.', baseCooldown: 6.3, enhanceable: true, objectiveModes: ['machinery-recovery', 'deep-salvage'] },
];

const byId = new Map(eliteProtocolDefinitions.map(definition => [definition.id, definition]));
const locationBias: Record<LocationId, EnemyProtocolId[]> = {
  'orbital-station': ['reactivePlating', 'emergencyShutters', 'suppressionCoordinator', 'magneticLock', 'arcConduit', 'penetratorVolley'],
  'damaged-vessel': ['pressureHunter', 'vacuumAdapted', 'breachmaker', 'emergencyShutters', 'reactivePlating'],
  'asteroid-refinery': ['breachmaker', 'repairMesh', 'thermalOverrun', 'gravityAnchor', 'arcConduit', 'suppressionCoordinator'],
  'spin-habitat': ['gravityAnchor', 'countermassMobility', 'sensorGhost', 'magneticLock', 'suppressionCoordinator', 'emergencyShutters'],
  'jovian-harvester': ['vacuumAdapted', 'pressureHunter', 'magneticLock', 'countermassMobility', 'thermalOverrun', 'signalJammer'],
  'ice-mine': ['sensorGhost', 'countermassMobility', 'penetratorVolley', 'suppressionCoordinator', 'vacuumAdapted', 'breachmaker'],
  'solar-yard': ['arcConduit', 'droneEscort', 'repairMesh', 'thermalOverrun', 'signalJammer', 'gravityAnchor'],
  'lattice-annex': ['sensorGhost', 'gravityAnchor', 'arcConduit', 'emergencyShutters', 'signalJammer', 'penetratorVolley'],
  'momentum-exchange': ['countermassMobility', 'penetratorVolley', 'repairMesh', 'emergencyShutters', 'reactivePlating', 'magneticLock'],
  'cryo-reserve': ['vacuumAdapted', 'thermalOverrun', 'repairMesh', 'emergencyShutters', 'reactivePlating', 'penetratorVolley'],
  'parallax-array': ['gravityAnchor', 'countermassMobility', 'sensorGhost', 'penetratorVolley', 'signalJammer', 'arcConduit'],
};

function hash32(value: number) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function protocolDefinition(id: EnemyProtocolId) { return byId.get(id)!; }
export function protocolThreatCost(instance: EnemyProtocolInstance) { return protocolDefinition(instance.id).threatCost + (instance.enhanced ? 1 : 0); }
export function protocolRewardValue(instance: EnemyProtocolInstance) { return protocolDefinition(instance.id).rewardWeight + (instance.enhanced ? 1 : 0); }

function eligible(definition: ProtocolDefinition, contract: Contract, role: EnemyRole, variant: EnemyVariant) {
  if (definition.locations && !definition.locations.includes(contract.location)) return false;
  if (definition.roles && !definition.roles.includes(role)) return false;
  if (definition.excludedVariants?.includes(variant)) return false;
  if (definition.objectiveModes && !definition.objectiveModes.includes(contract.objectiveMode)) return false;
  return true;
}

export function chooseEnemyProtocols(contract: Contract, role: EnemyRole, variant: EnemyVariant, count: number, enemyId: number) {
  const directiveBias = (contract.directiveProtocolBias ?? []).filter(id => byId.has(id as EnemyProtocolId)) as EnemyProtocolId[];
  const bias = [...directiveBias, ...(locationBias[contract.location] ?? [])].filter((id, index, all) => all.indexOf(id) === index);
  const chosenFamilies = new Set<ProtocolFamily>();
  const candidates = eliteProtocolDefinitions.filter(definition => eligible(definition, contract, role, variant)).sort((a, b) => {
    const aBias = bias.indexOf(a.id);
    const bBias = bias.indexOf(b.id);
    const aRank = aBias < 0 ? 99 : aBias;
    const bRank = bBias < 0 ? 99 : bBias;
    if (aRank !== bRank) return aRank - bRank;
    return hash32(contract.seed ^ enemyId * 7919 ^ a.id.length * 104729) - hash32(contract.seed ^ enemyId * 7919 ^ b.id.length * 104729);
  });
  const result: EnemyProtocolInstance[] = [];
  for (const definition of candidates) {
    if (result.length >= count || chosenFamilies.has(definition.family)) continue;
    chosenFamilies.add(definition.family);
    const tier = contract.operationTier ?? 1;
    const enhancedChance = tier >= 12 ? 42 : tier >= 10 ? 24 : 0;
    const roll = hash32(contract.seed ^ enemyId * 2654435761 ^ definition.id.length * 31337) % 100;
    const enhanced = !!definition.enhanceable && enhancedChance > 0 && roll < enhancedChance;
    const cooldownJitter = (hash32(contract.seed ^ enemyId * 131 ^ result.length * 17) % 140) / 100;
    result.push({ id: definition.id, enhanced, cooldown: 1.6 + cooldownJitter, windup: 0 });
  }
  return result;
}

export function protocolForecastForContract(contract: Contract) {
  const bias = locationBias[contract.location] ?? [];
  const objectiveAdds: EnemyProtocolId[] = contract.objectiveMode === 'machinery-recovery' || contract.objectiveMode === 'deep-salvage' ? ['salvageInterdictor', 'recoveryDenial'] : [];
  const seen = new Set<ProtocolFamily>();
  const names: string[] = [];
  for (const id of [...bias, ...objectiveAdds]) {
    const definition = protocolDefinition(id);
    if (seen.has(definition.family)) continue;
    seen.add(definition.family);
    names.push(definition.name);
    if (names.length >= 5) break;
  }
  return names;
}

export function combatClassLabel(value: EnemyCombatClass) {
  if (value === 'command') return 'COMMAND';
  if (value === 'elite') return 'ELITE';
  if (value === 'enhanced') return 'ENHANCED';
  return 'STANDARD';
}

export function protocolTierSummary(operationTier: number, capacity: number) {
  if (capacity <= 0) return 'Standard classes only';
  if (operationTier <= 4) return 'Enhanced/Elite // normally 1 protocol';
  if (operationTier <= 7) return 'Enhanced/Elite // 1–2 protocols';
  if (operationTier <= 9) return 'Elite packages // up to 3 protocols';
  return 'High-tier Elite // 2–4 protocols · Enhanced variants possible';
}
