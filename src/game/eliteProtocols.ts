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

export type ExclusiveProtocolCombinationId =
  | 'breach-lock'
  | 'mass-pursuit'
  | 'fortress-mesh'
  | 'recovery-lockdown'
  | 'kill-corridor'
  | 'arc-blackout'
  | 'vacuum-hunt';

export type EnhancedProtocolVariantId =
  | 'ablative-bloom'
  | 'cutline-pair'
  | 'twin-well-lock'
  | 'anchor-singularity'
  | 'wake-anchor'
  | 'cascade-grid'
  | 'overlink-mesh'
  | 'dual-rack'
  | 'cross-shutter'
  | 'capacitor-scramble'
  | 'coolant-redline'
  | 'tech-bus-sync'
  | 'cross-fan-volley'
  | 'mass-theft'
  | 'hard-lock-grid';

export type EnemyProtocolInstance = {
  id: EnemyProtocolId;
  enhanced: boolean;
  cooldown: number;
  windup: number;
  combinationId?: ExclusiveProtocolCombinationId;
  variantId?: EnhancedProtocolVariantId;
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

export type EnhancedProtocolVariantDefinition = {
  id: EnhancedProtocolVariantId;
  protocolId: EnemyProtocolId;
  minTier: number;
};

export const enhancedProtocolVariants: EnhancedProtocolVariantDefinition[] = [
  { id: 'ablative-bloom', protocolId: 'reactivePlating', minTier: 10 },
  { id: 'cutline-pair', protocolId: 'breachmaker', minTier: 10 },
  { id: 'twin-well-lock', protocolId: 'magneticLock', minTier: 10 },
  { id: 'anchor-singularity', protocolId: 'gravityAnchor', minTier: 10 },
  { id: 'wake-anchor', protocolId: 'countermassMobility', minTier: 10 },
  { id: 'cascade-grid', protocolId: 'arcConduit', minTier: 10 },
  { id: 'overlink-mesh', protocolId: 'repairMesh', minTier: 10 },
  { id: 'dual-rack', protocolId: 'droneEscort', minTier: 10 },
  { id: 'cross-shutter', protocolId: 'emergencyShutters', minTier: 10 },
  { id: 'capacitor-scramble', protocolId: 'signalJammer', minTier: 10 },
  { id: 'coolant-redline', protocolId: 'thermalOverrun', minTier: 10 },
  { id: 'tech-bus-sync', protocolId: 'suppressionCoordinator', minTier: 10 },
  { id: 'cross-fan-volley', protocolId: 'penetratorVolley', minTier: 10 },
  { id: 'mass-theft', protocolId: 'salvageInterdictor', minTier: 10 },
  { id: 'hard-lock-grid', protocolId: 'recoveryDenial', minTier: 10 },
];

export type ExclusiveProtocolCombinationDefinition = {
  id: ExclusiveProtocolCombinationId;
  name: string;
  shortName: string;
  minTier: number;
  protocols: readonly EnemyProtocolId[];
  locations?: LocationId[];
  objectiveModes?: Contract['objectiveMode'][];
};

export const exclusiveProtocolCombinations: ExclusiveProtocolCombinationDefinition[] = [
  { id: 'breach-lock', name: 'Breach Lock', shortName: 'BREACH LOCK', minTier: 9, protocols: ['breachmaker', 'magneticLock'] },
  { id: 'mass-pursuit', name: 'Mass Pursuit', shortName: 'MASS HUNT', minTier: 9, protocols: ['magneticLock', 'countermassMobility'] },
  { id: 'fortress-mesh', name: 'Fortress Mesh', shortName: 'FORTRESS', minTier: 9, protocols: ['reactivePlating', 'repairMesh'] },
  { id: 'recovery-lockdown', name: 'Recovery Lockdown', shortName: 'RECOVERY LOCK', minTier: 9, protocols: ['salvageInterdictor', 'recoveryDenial'], objectiveModes: ['machinery-recovery', 'deep-salvage'] },
  { id: 'kill-corridor', name: 'Kill Corridor', shortName: 'KILL LANE', minTier: 10, protocols: ['emergencyShutters', 'suppressionCoordinator', 'penetratorVolley'] },
  { id: 'arc-blackout', name: 'Arc Blackout', shortName: 'BLACKOUT', minTier: 10, protocols: ['arcConduit', 'signalJammer', 'droneEscort'] },
  { id: 'vacuum-hunt', name: 'Vacuum Hunt', shortName: 'VAC HUNT', minTier: 10, protocols: ['pressureHunter', 'vacuumAdapted', 'countermassMobility'] },
];

const byId = new Map(eliteProtocolDefinitions.map(definition => [definition.id, definition]));
const combinationById = new Map(exclusiveProtocolCombinations.map(definition => [definition.id, definition]));
const enhancedVariantsByProtocol = new Map<EnemyProtocolId, EnhancedProtocolVariantDefinition[]>();
for (const definition of enhancedProtocolVariants) {
  const variants = enhancedVariantsByProtocol.get(definition.protocolId) ?? [];
  variants.push(definition);
  enhancedVariantsByProtocol.set(definition.protocolId, variants);
}
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
function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

export function protocolDefinition(id: EnemyProtocolId) { return byId.get(id)!; }
export function enhancedProtocolVariantDefinition(id: EnhancedProtocolVariantId) { return enhancedProtocolVariants.find(definition => definition.id === id)!; }
export function enhancedProtocolVariantForInstance(instance: EnemyProtocolInstance) { return instance.variantId ? enhancedProtocolVariantDefinition(instance.variantId) : undefined; }
export function protocolThreatCost(instance: EnemyProtocolInstance) { return protocolDefinition(instance.id).threatCost + (instance.enhanced ? 1 : 0); }
export function protocolRewardValue(instance: EnemyProtocolInstance) { return protocolDefinition(instance.id).rewardWeight + (instance.enhanced ? 1 : 0); }

function eligible(definition: ProtocolDefinition, contract: Contract, role: EnemyRole, variant: EnemyVariant) {
  if (definition.locations && !definition.locations.includes(contract.location)) return false;
  if (definition.roles && !definition.roles.includes(role)) return false;
  if (definition.excludedVariants?.includes(variant)) return false;
  if (definition.objectiveModes && !definition.objectiveModes.includes(contract.objectiveMode)) return false;
  return true;
}
function combinationEligible(definition: ExclusiveProtocolCombinationDefinition, contract: Contract, role: EnemyRole, variant: EnemyVariant, count: number) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < definition.minTier || definition.protocols.length > count) return false;
  if (definition.locations && !definition.locations.includes(contract.location)) return false;
  if (definition.objectiveModes && !definition.objectiveModes.includes(contract.objectiveMode)) return false;
  return definition.protocols.every(id => eligible(protocolDefinition(id), contract, role, variant));
}
function forecastCombinationEligible(definition: ExclusiveProtocolCombinationDefinition, contract: Contract) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < definition.minTier) return false;
  if (definition.locations && !definition.locations.includes(contract.location)) return false;
  if (definition.objectiveModes && !definition.objectiveModes.includes(contract.objectiveMode)) return false;
  return definition.protocols.every(id => {
    const protocol = protocolDefinition(id);
    if (protocol.locations && !protocol.locations.includes(contract.location)) return false;
    if (protocol.objectiveModes && !protocol.objectiveModes.includes(contract.objectiveMode)) return false;
    return true;
  });
}

export function exclusiveProtocolCombinationForEnemy(contract: Contract, role: EnemyRole, variant: EnemyVariant, count: number, enemyId: number) {
  if (count < 2) return undefined;
  const bias = new Set((contract.directiveProtocolBias ?? []) as EnemyProtocolId[]);
  const candidates = exclusiveProtocolCombinations.filter(definition => combinationEligible(definition, contract, role, variant, count));
  candidates.sort((a, b) => {
    const aBias = a.protocols.reduce((total, id) => total + Number(bias.has(id)), 0);
    const bBias = b.protocols.reduce((total, id) => total + Number(bias.has(id)), 0);
    if (aBias !== bBias) return bBias - aBias;
    return hash32(contract.seed ^ enemyId * 2654435761 ^ hashText(a.id)) - hash32(contract.seed ^ enemyId * 2654435761 ^ hashText(b.id));
  });
  return candidates[0];
}
export function exclusiveProtocolCombinationForInstances(protocols: readonly EnemyProtocolInstance[]) {
  const combinationId = protocols.find(protocol => protocol.combinationId)?.combinationId;
  return combinationId ? combinationById.get(combinationId) : undefined;
}
export function exclusiveProtocolCombinationForecastForContract(contract: Contract) {
  return exclusiveProtocolCombinations.filter(definition => forecastCombinationEligible(definition, contract)).map(definition => definition.name).slice(0, 3);
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
    return hash32(contract.seed ^ enemyId * 7919 ^ hashText(a.id)) - hash32(contract.seed ^ enemyId * 7919 ^ hashText(b.id));
  });
  const result: EnemyProtocolInstance[] = [];
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  const enhancedChance = tier >= 12 ? 42 : tier >= 10 ? 24 : 0;
  const createInstance = (definition: ProtocolDefinition, combinationId?: ExclusiveProtocolCombinationId) => {
    const roll = hash32(contract.seed ^ enemyId * 2654435761 ^ hashText(definition.id)) % 100;
    const variantCandidates = (enhancedVariantsByProtocol.get(definition.id) ?? []).filter(variant => tier >= variant.minTier);
    const variant = !!definition.enhanceable && enhancedChance > 0 && roll < enhancedChance
      ? [...variantCandidates].sort((a, b) => hash32(contract.seed ^ enemyId * 104729 ^ hashText(a.id)) - hash32(contract.seed ^ enemyId * 104729 ^ hashText(b.id)))[0]
      : undefined;
    const cooldownJitter = (hash32(contract.seed ^ enemyId * 131 ^ result.length * 17) % 140) / 100;
    return {
      id: definition.id,
      enhanced: !!variant,
      cooldown: 1.6 + cooldownJitter,
      windup: 0,
      ...(combinationId ? { combinationId } : {}),
      ...(variant ? { variantId: variant.id } : {}),
    } satisfies EnemyProtocolInstance;
  };

  const exclusive = exclusiveProtocolCombinationForEnemy(contract, role, variant, count, enemyId);
  if (exclusive) {
    for (const id of exclusive.protocols) {
      const definition = protocolDefinition(id);
      result.push(createInstance(definition, exclusive.id));
      chosenFamilies.add(definition.family);
    }
  }

  for (const definition of candidates) {
    if (result.length >= count || result.some(protocol => protocol.id === definition.id) || chosenFamilies.has(definition.family)) continue;
    chosenFamilies.add(definition.family);
    result.push(createInstance(definition));
  }
  return result;
}

export function enhancedProtocolVariantForecastForContract(contract: Contract) {
  const tier = contract.operationTier ?? contract.directiveTier ?? 1;
  if (tier < 10) return [];
  const directiveBias = (contract.directiveProtocolBias ?? []).filter(id => byId.has(id as EnemyProtocolId)) as EnemyProtocolId[];
  const objectiveAdds: EnemyProtocolId[] = contract.objectiveMode === 'machinery-recovery' || contract.objectiveMode === 'deep-salvage' ? ['salvageInterdictor', 'recoveryDenial'] : [];
  const candidates = [...directiveBias, ...(locationBias[contract.location] ?? []), ...objectiveAdds].filter((id, index, all) => all.indexOf(id) === index);
  const names: EnhancedProtocolVariantId[] = [];
  for (const id of candidates) {
    const protocol = protocolDefinition(id);
    if (!protocol.enhanceable) continue;
    if (protocol.locations && !protocol.locations.includes(contract.location)) continue;
    if (protocol.objectiveModes && !protocol.objectiveModes.includes(contract.objectiveMode)) continue;
    const variant = (enhancedVariantsByProtocol.get(id) ?? []).find(item => tier >= item.minTier);
    if (!variant) continue;
    names.push(variant.id);
    if (names.length >= 4) break;
  }
  return names;
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
  if (operationTier <= 8) return 'Elite packages // up to 3 protocols';
  if (operationTier === 9) return 'T9 Elite // exclusive 2–3 protocol packages online';
  return 'High-tier Elite // exclusive packages · 2–4 protocols · named Enhanced variants';
}
