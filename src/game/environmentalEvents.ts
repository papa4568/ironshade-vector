import type { Contract, LocationId, ObjectiveMode } from './campaign';
import type { SimState } from './sim';

export type EnvironmentalEventId =
  | 'debris-impact'
  | 'emergency-shutters'
  | 'reactor-load-shed'
  | 'rival-boarders'
  | 'coolant-rupture'
  | 'salvage-drift'
  | 'dormant-defenses'
  | 'hull-tumble'
  | 'pressure-lock-entry'
  | 'conduit-flashover'
  | 'cargo-restraint-failure'
  | 'compressor-backflow'
  | 'spin-overspeed'
  | 'radiator-saturation'
  | 'bore-collapse'
  | 'crane-runaway'
  | 'life-support-purge'
  | 'magnetic-load-swing';

type PlannedEvent = { id: EnvironmentalEventId; at: number };
type GravitySnapshot = { id: string; value: number; forced: number };
type EnvironmentalEffect =
  | { kind: 'link'; remaining: number; id: string; previousOpen: boolean }
  | { kind: 'gravity'; remaining: number; values: GravitySnapshot[] }
  | { kind: 'pressure'; remaining: number; sectorId: string; pressure: number; targetPressure: number }
  | { kind: 'breach'; remaining: number; breachId: string; sectorId: string; pressure: number; targetPressure: number }
  | { kind: 'heat'; remaining: number; rate: number };

export type EnvironmentalEventRuntime = {
  plan: PlannedEvent[] | null;
  warned: EnvironmentalEventId[];
  fired: EnvironmentalEventId[];
  effects: EnvironmentalEffect[];
};

type EventDefinition = {
  id: EnvironmentalEventId;
  name: string;
  group: string;
  locations?: LocationId[];
  objectives?: ObjectiveMode[];
  excludeObjectives?: ObjectiveMode[];
  apply: (state: SimState, runtime: EnvironmentalEventRuntime, contract: Contract) => void;
};

function announce(state: SimState, text: string, duration = 3) {
  state.eventText = text;
  state.eventT = duration;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function spawnHazard(state: SimState, x: number, y: number, kind: 'shockGrid' | 'gravityWell' | 'coolantJet', life: number) {
  const hazard = state.hazards.find(item => !item.active);
  if (!hazard) return false;
  Object.assign(hazard, {
    active: true,
    x: clamp(x, 150, 2140),
    y: clamp(y, 190, 860),
    radius: kind === 'gravityWell' ? 185 : kind === 'coolantJet' ? 150 : 120,
    life,
    kind,
    owner: 'environment' as const,
  });
  return true;
}

function wakeDebris(state: SimState, sectorId: string, vx: number, vy: number) {
  let index = 0;
  for (const debris of state.debris) {
    if (debris.sectorId !== sectorId) continue;
    debris.active = true;
    debris.vx = vx + index * 18;
    debris.vy = vy + (index % 2 === 0 ? 55 : -55);
    index += 1;
  }
}

function activateReserve(state: SimState, label: string, x: number, y: number) {
  const reserve = state.enemies.find(enemy => (enemy.id === 7 || enemy.id === 8) && !enemy.active && !enemy.dead);
  if (!reserve) return false;
  reserve.active = true;
  reserve.dead = false;
  reserve.x = x;
  reserve.y = y;
  reserve.fireCooldown = 0.7;
  reserve.label = label;
  return true;
}

function pushGravityEffect(state: SimState, runtime: EnvironmentalEventRuntime, changes: Array<{ id: string; forced: number }>, duration: number) {
  const values: GravitySnapshot[] = [];
  for (const change of changes) {
    const sector = state.sectors.find(item => item.id === change.id);
    if (!sector) continue;
    values.push({ id: change.id, value: sector.gravity, forced: change.forced });
    sector.gravity = change.forced;
  }
  if (values.length > 0) runtime.effects.push({ kind: 'gravity', remaining: duration, values });
}

function pushPressureEffect(state: SimState, runtime: EnvironmentalEventRuntime, sectorId: string, pressure: number, duration: number) {
  const sector = state.sectors.find(item => item.id === sectorId);
  if (!sector) return;
  runtime.effects.push({ kind: 'pressure', remaining: duration, sectorId, pressure: sector.pressure, targetPressure: sector.targetPressure });
  sector.pressure = clamp(pressure, 0.08, 1);
  sector.targetPressure = sector.pressure;
}

function debrisImpact(state: SimState, runtime: EnvironmentalEventRuntime) {
  const breach = state.breaches.find(item => item.id === 'service-breach');
  const sector = state.sectors.find(item => item.id === 'B');
  wakeDebris(state, 'B', 230, -40);
  if (breach && sector && !breach.active) {
    runtime.effects.push({ kind: 'breach', remaining: 7.5, breachId: breach.id, sectorId: sector.id, pressure: sector.pressure, targetPressure: sector.targetPressure });
    breach.active = true;
    breach.sealed = false;
    breach.strength = Math.max(720, Math.min(breach.strength, 980));
    breach.radius = Math.max(520, breach.radius);
    sector.rapidTimer = 2.8;
    sector.targetPressure = 0;
    sector.pressureState = 'decompressing';
    announce(state, 'DIRECTOR EVENT // DEBRIS IMPACT // TEMPORARY COMPARTMENT BREACH OPEN', 3.5);
  } else announce(state, 'DIRECTOR EVENT // DEBRIS IMPACT // LOOSE CARGO NOW BALLISTIC', 3.2);
}

function emergencyShutters(state: SimState, runtime: EnvironmentalEventRuntime) {
  const link = state.links.find(item => item.id === 'door-ab');
  if (!link) return;
  runtime.effects.push({ kind: 'link', remaining: 7.5, id: link.id, previousOpen: link.open });
  link.open = false;
  announce(state, 'DIRECTOR EVENT // EMERGENCY SHUTTERS // BATTLEFIELD DIVIDED FOR 7 SECONDS', 3.4);
}

function reactorLoadShed(state: SimState, runtime: EnvironmentalEventRuntime) {
  pushGravityEffect(state, runtime, [{ id: 'B', forced: 0.03 }], 7.5);
  announce(state, 'DIRECTOR EVENT // REACTOR LOAD SHED // TRANSFER GRAVITY COLLAPSED', 3.2);
}

function rivalBoarders(state: SimState) {
  const deployed = activateReserve(state, 'Rival Faction Interdictor', 1540, 235);
  announce(state, deployed ? 'DIRECTOR EVENT // RIVAL BOARDING TEAM // THIRD-PARTY CONTACT ENTERING' : 'DIRECTOR EVENT // RIVAL BOARDING SIGNAL // ACTIVE RESERVES REROUTING', 3.2);
}

function coolantRupture(state: SimState) {
  const x = state.player.x + state.player.aim.x * 180;
  const y = state.player.y + state.player.aim.y * 180;
  spawnHazard(state, x, y, 'coolantJet', 7);
  announce(state, 'DIRECTOR EVENT // COOLANT RUPTURE // THRUST PLUME CROSSING THE DECK', 3.2);
}

function salvageDrift(state: SimState) {
  const breach = state.breaches.find(item => item.active) ?? state.breaches.find(item => item.id === 'service-breach');
  let moved = 0;
  for (const object of state.objects) {
    if (object.kind !== 'salvageNode' || !object.active || object.exposed) continue;
    const dx = (breach?.x ?? 1180) - object.x;
    const dy = (breach?.y ?? 520) - object.y;
    const length = Math.hypot(dx, dy) || 1;
    object.x = clamp(object.x + dx / length * 120, 180, 2040);
    object.y = clamp(object.y + dy / length * 90, 210, 820);
    moved += 1;
  }
  announce(state, moved > 0 ? 'DIRECTOR EVENT // SALVAGE RESTRAINTS FAILED // UNTAGGED MACHINERY DRIFTING' : 'DIRECTOR EVENT // SALVAGE RESTRAINT ALARM // RECOVERY LOAD ALREADY SECURED', 3.2);
}

function dormantDefenses(state: SimState) {
  spawnHazard(state, 980, 390, 'shockGrid', 6.5);
  spawnHazard(state, 1320, 690, 'shockGrid', 6.5);
  announce(state, 'DIRECTOR EVENT // POWER RESTORED // DORMANT DEFENSE GRID REACTIVATED', 3.3);
}

function hullTumble(state: SimState, runtime: EnvironmentalEventRuntime) {
  pushGravityEffect(state, runtime, state.sectors.map(sector => ({ id: sector.id, forced: Math.min(sector.gravity, 0.08) })), 7);
  state.player.vx += 230;
  state.player.vy -= 150;
  for (const enemy of state.enemies) {
    if (!enemy.active || enemy.dead || enemy.role === 'boss') continue;
    enemy.vx += 170;
    enemy.vy -= 110;
  }
  announce(state, 'DIRECTOR EVENT // HULL TUMBLE // ATTITUDE CONTROL LOST // LOCAL GRAVITY MINIMAL', 3.5);
}

function pressureLockEntry(state: SimState) {
  const deployed = activateReserve(state, 'Unexpected Pressure-Lock Breacher', 790, 820);
  announce(state, deployed ? 'DIRECTOR EVENT // PRESSURE LOCK CYCLED // HOSTILE ENTRY FROM SERVICE ROUTE' : 'DIRECTOR EVENT // PRESSURE LOCK CYCLED // HOSTILE LINE REORIENTING', 3.2);
}

function conduitFlashover(state: SimState) {
  const conduit = state.objects.find(object => object.kind === 'conduit' && object.active);
  const x = conduit ? conduit.x + conduit.w / 2 : 1160;
  const y = conduit ? conduit.y + conduit.h / 2 : 520;
  spawnHazard(state, x, y, 'shockGrid', 6);
  announce(state, 'DIRECTOR EVENT // CONDUIT FLASHOVER // ARC FIELD AROUND LIVE MACHINERY', 3.2);
}

function cargoRestraintFailure(state: SimState) {
  wakeDebris(state, 'B', -250, 80);
  announce(state, 'DIRECTOR EVENT // CARGO RESTRAINT FAILURE // DEBRIS STREAM ACROSS TRANSFER ZONE', 3.2);
}

function compressorBackflow(state: SimState, runtime: EnvironmentalEventRuntime) {
  const sector = state.sectors.find(item => item.id === 'B');
  if (!sector) return;
  pushPressureEffect(state, runtime, 'B', Math.min(0.98, sector.pressure + 0.2), 7);
  announce(state, 'DIRECTOR EVENT // COMPRESSOR BACKFLOW // PRESSURE GRADIENT REVERSED', 3.2);
}

function spinOverspeed(state: SimState, runtime: EnvironmentalEventRuntime) {
  const a = state.sectors.find(item => item.id === 'A');
  const b = state.sectors.find(item => item.id === 'B');
  pushGravityEffect(state, runtime, [
    { id: 'A', forced: Math.min(1.2, (a?.gravity ?? 0.8) + 0.28) },
    { id: 'B', forced: Math.min(0.95, (b?.gravity ?? 0.4) + 0.3) },
  ], 7);
  announce(state, 'DIRECTOR EVENT // SPIN OVERSPEED // RIM LOAD AND STOPPING DISTANCE INCREASED', 3.4);
}

function radiatorSaturation(state: SimState, runtime: EnvironmentalEventRuntime) {
  runtime.effects.push({ kind: 'heat', remaining: 8, rate: 0.05 });
  announce(state, 'DIRECTOR EVENT // RADIATOR SATURATION // ACTIVE WEAPON HEAT LOAD RISING', 3.3);
}

function boreCollapse(state: SimState) {
  const brittle = state.objects.find(object => object.active && object.id.includes('ice-brittle'));
  if (brittle) brittle.active = false;
  wakeDebris(state, 'B', 120, 170);
  announce(state, brittle ? 'DIRECTOR EVENT // BORE COLLAPSE // BRITTLE WALL FAILED // ROUTE CHANGED' : 'DIRECTOR EVENT // BORE COLLAPSE // ICE DEBRIS ENTERING TUNNEL', 3.3);
}

function craneRunaway(state: SimState) {
  const cover = state.objects.find(object => object.active && object.kind === 'cover' && object.destructible && object.material === 'industrial');
  if (cover) cover.active = false;
  wakeDebris(state, 'B', 190, 120);
  announce(state, cover ? 'DIRECTOR EVENT // MACHINERY RUNAWAY // INDUSTRIAL COVER TORN FROM MOUNTS' : 'DIRECTOR EVENT // MACHINERY RUNAWAY // MOVING MASS IN FIRING LANE', 3.3);
}

function lifeSupportPurge(state: SimState, runtime: EnvironmentalEventRuntime) {
  const sector = state.sectors.find(item => item.id === 'B');
  if (!sector) return;
  pushPressureEffect(state, runtime, 'B', Math.max(0.28, sector.pressure - 0.2), 7);
  announce(state, 'DIRECTOR EVENT // LIFE-SUPPORT PURGE // TEMPORARY ATMOSPHERE DEFICIT', 3.2);
}

function magneticLoadSwing(state: SimState) {
  spawnHazard(state, state.player.x + 190, state.player.y - 70, 'gravityWell', 5.5);
  spawnHazard(state, state.player.x - 170, state.player.y + 90, 'gravityWell', 5.5);
  announce(state, 'DIRECTOR EVENT // MAGNETIC LOAD SWING // TWIN MASS WELLS ACTIVE', 3.2);
}

const environmentalEvents: EventDefinition[] = [
  { id: 'debris-impact', name: 'Debris Impact Breach', group: 'pressure', apply: debrisImpact },
  { id: 'emergency-shutters', name: 'Emergency Shutter Partition', group: 'doors', excludeObjectives: ['emergency-boarding'], apply: emergencyShutters },
  { id: 'reactor-load-shed', name: 'Reactor Gravity Load Shed', group: 'gravity', locations: ['orbital-station', 'asteroid-refinery', 'solar-yard'], apply: reactorLoadShed },
  { id: 'rival-boarders', name: 'Rival Faction Boarding Team', group: 'reinforcement', apply: rivalBoarders },
  { id: 'coolant-rupture', name: 'Coolant System Rupture', group: 'hazard', apply: coolantRupture },
  { id: 'salvage-drift', name: 'Salvage Machinery Drift', group: 'machinery', objectives: ['deep-salvage', 'machinery-recovery'], apply: salvageDrift },
  { id: 'dormant-defenses', name: 'Dormant Defense Reactivation', group: 'power', apply: dormantDefenses },
  { id: 'hull-tumble', name: 'Damaged Hull Tumble', group: 'gravity', locations: ['damaged-vessel'], apply: hullTumble },
  { id: 'pressure-lock-entry', name: 'Unexpected Pressure-Lock Entry', group: 'reinforcement', apply: pressureLockEntry },
  { id: 'conduit-flashover', name: 'Live Conduit Flashover', group: 'power', apply: conduitFlashover },
  { id: 'cargo-restraint-failure', name: 'Cargo Restraint Failure', group: 'debris', apply: cargoRestraintFailure },
  { id: 'compressor-backflow', name: 'Compressor Backflow', group: 'pressure', locations: ['jovian-harvester', 'asteroid-refinery'], apply: compressorBackflow },
  { id: 'spin-overspeed', name: 'Habitat Spin Overspeed', group: 'gravity', locations: ['spin-habitat'], apply: spinOverspeed },
  { id: 'radiator-saturation', name: 'Radiator Saturation', group: 'thermal', locations: ['solar-yard'], apply: radiatorSaturation },
  { id: 'bore-collapse', name: 'Bore Wall Collapse', group: 'structure', locations: ['ice-mine'], apply: boreCollapse },
  { id: 'crane-runaway', name: 'Industrial Machinery Runaway', group: 'structure', locations: ['orbital-station', 'asteroid-refinery', 'solar-yard'], apply: craneRunaway },
  { id: 'life-support-purge', name: 'Life-Support Purge', group: 'pressure', apply: lifeSupportPurge },
  { id: 'magnetic-load-swing', name: 'Magnetic Load Swing', group: 'hazard', locations: ['spin-habitat', 'jovian-harvester', 'asteroid-refinery', 'solar-yard'], apply: magneticLoadSwing },
];

export const environmentalEventCount = environmentalEvents.length;

function hash(seed: number, salt: number) {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function appliesToContract(definition: EventDefinition, contract: Contract) {
  if (definition.locations && !definition.locations.includes(contract.location)) return false;
  if (definition.objectives && !definition.objectives.includes(contract.objectiveMode)) return false;
  if (definition.excludeObjectives?.includes(contract.objectiveMode)) return false;
  return true;
}

function buildPlan(contract: Contract): PlannedEvent[] {
  const desired = Math.max(1, Math.min(4, contract.environmentalEventSlots ?? (contract.megastructure || contract.escalationStage || contract.daily ? 3 : 2)));
  const directiveBias = contract.directiveEventBias ?? [];
  const candidates = environmentalEvents
    .filter(definition => appliesToContract(definition, contract))
    .map((definition, index) => { const rank = directiveBias.indexOf(definition.id); return { definition, score: rank >= 0 ? rank : 100 + hash(contract.seed, index + 11) }; })
    .sort((a, b) => a.score - b.score);
  const selected: EventDefinition[] = [];
  const groups = new Set<string>();
  for (const candidate of candidates) {
    if (groups.has(candidate.definition.group)) continue;
    selected.push(candidate.definition);
    groups.add(candidate.definition.group);
    if (selected.length >= desired) break;
  }
  const bases = [8, 19, 32, 45];
  return selected.map((definition, index) => ({ id: definition.id, at: bases[index] + hash(contract.seed, 70 + index) % 4 }));
}

export function createEnvironmentalEventRuntime(): EnvironmentalEventRuntime {
  return { plan: null, warned: [], fired: [], effects: [] };
}

export function getEnvironmentalEventForecast(contract: Contract) {
  return buildPlan(contract).map(item => environmentalEvents.find(definition => definition.id === item.id)?.name ?? item.id);
}

function calibratedGravityForEvent(state: SimState, sectorId: string, fallback: number) {
  const sector = state.sectors.find(item => item.id === sectorId);
  if (!sector) return fallback;
  const calibrated: Record<string, number> = { 'SPIN DECK': 1, 'TRANSFER BAY': 0.34, 'FORE HAB': 0.28, 'CARGO SPINE': 0.08, 'CRUSHER DECK': 0.62, 'ORE TRANSFER': 0.46, 'RIM HAB': 1.02, 'SPOKE TRANSIT': 0.42, 'PRESSURE LOCK': 0.55, 'SKIMMER DECK': 0.24, 'ACCESS BORE': 0.34, 'EXTRACTION TUNNEL': 0.22, 'SHADE GANTRY': 0.45, 'FABRICATION SPINE': 0.28 };
  const controlId = sectorId === 'A' ? 'gravity-control-a' : sectorId === 'B' ? 'gravity-control-b' : '';
  const calibratedDuringEvent = controlId ? state.objects.find(object => object.id === controlId)?.exposed : false;
  return calibratedDuringEvent ? calibrated[sector.label] ?? fallback : fallback;
}

function stepEffects(state: SimState, runtime: EnvironmentalEventRuntime, contract: Contract, dt: number) {
  for (const effect of runtime.effects) {
    effect.remaining -= dt;
    if (effect.kind === 'link') {
      const link = state.links.find(item => item.id === effect.id);
      if (link && effect.remaining > 0) link.open = false;
    } else if (effect.kind === 'gravity') {
      if (effect.remaining > 0) for (const value of effect.values) {
        const sector = state.sectors.find(item => item.id === value.id);
        if (sector) sector.gravity = value.forced;
      }
    } else if (effect.kind === 'heat' && effect.remaining > 0) {
      const weapon = state.player.currentWeapon;
      state.player.weaponHeat[weapon] = Math.min(1, state.player.weaponHeat[weapon] + effect.rate * dt);
    }
  }

  const expired = runtime.effects.filter(effect => effect.remaining <= 0);
  for (const effect of expired) {
    if (effect.kind === 'link') {
      const link = state.links.find(item => item.id === effect.id);
      if (link) link.open = effect.previousOpen;
    } else if (effect.kind === 'gravity') {
      for (const value of effect.values) {
        const sector = state.sectors.find(item => item.id === value.id);
        if (sector) sector.gravity = calibratedGravityForEvent(state, value.id, value.value);
      }
    } else if (effect.kind === 'pressure') {
      const sector = state.sectors.find(item => item.id === effect.sectorId);
      const serviceSeal = state.objects.find(object => object.id === 'service-seal');
      const serviceBreach = state.breaches.find(item => item.id === 'service-breach');
      const playerSecuredPressure = effect.sectorId === 'B' && !!serviceSeal?.exposed && !serviceBreach?.active;
      if (sector && playerSecuredPressure) {
        const recoveryTarget = contract.conditions.includes('limited-atmosphere') ? 0.52 : 0.72;
        sector.targetPressure = Math.max(sector.targetPressure, recoveryTarget);
      } else if (sector) {
        sector.pressure = effect.pressure;
        sector.targetPressure = effect.targetPressure;
      }
    } else if (effect.kind === 'breach') {
      const breach = state.breaches.find(item => item.id === effect.breachId);
      const sector = state.sectors.find(item => item.id === effect.sectorId);
      const serviceSeal = state.objects.find(object => object.id === 'service-seal');
      const playerSealed = effect.breachId === 'service-breach' && !!serviceSeal?.exposed && !breach?.active;
      if (breach?.active) {
        breach.active = false;
        breach.sealed = true;
      }
      if (sector) {
        sector.rapidTimer = 0;
        if (playerSealed) {
          const recoveryTarget = contract.conditions.includes('limited-atmosphere') ? 0.52 : 0.72;
          sector.targetPressure = Math.max(sector.targetPressure, recoveryTarget);
        } else {
          sector.pressure = effect.pressure;
          sector.targetPressure = effect.targetPressure;
        }
      }
    }
  }
  runtime.effects = runtime.effects.filter(effect => effect.remaining > 0);
}

export function stepEnvironmentalEvents(state: SimState, runtime: EnvironmentalEventRuntime, contract: Contract, dt: number, elapsed: number) {
  if (!runtime.plan) runtime.plan = buildPlan(contract);
  stepEffects(state, runtime, contract, dt);
  for (const planned of runtime.plan) {
    if (!runtime.warned.includes(planned.id) && elapsed >= planned.at - 2.5) {
      runtime.warned.push(planned.id);
      const definition = environmentalEvents.find(item => item.id === planned.id);
      if (definition) announce(state, `DIRECTOR FORECAST // ${definition.name.toUpperCase()} // IMPACT IN 2 SECONDS`, 2.3);
    }
    if (runtime.fired.includes(planned.id) || elapsed < planned.at) continue;
    runtime.fired.push(planned.id);
    const definition = environmentalEvents.find(item => item.id === planned.id);
    definition?.apply(state, runtime, contract);
  }
}
