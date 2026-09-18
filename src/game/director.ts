import type { Contract } from './campaign';
import { applyEncounterLayout, getMissionObjectiveStatus } from './encounters';
import { createEnvironmentalEventRuntime, stepEnvironmentalEvents, type EnvironmentalEventRuntime } from './environmentalEvents';
import { applyThreatBudget } from './scaling';
import { getClassMechanicStatus, releaseBossGate, type EnemyRole, type EnemyVariant, type SimState } from './sim';

export type DirectorRuntime = { elapsed: number; deepElapsed: number; deep: boolean; reinforcementsReleased: boolean; gridTriggered: boolean; defenseTriggered: boolean; pressureWarned: boolean; pressureTriggered: boolean; gravityTriggered: boolean; locationEventA: boolean; locationEventB: boolean; thermalPulseUntil: number; clearSweepElapsed: number; clearSweepWarned: boolean; environmental: EnvironmentalEventRuntime };
export function createDirector(): DirectorRuntime { return { elapsed: 0, deepElapsed: 0, deep: false, reinforcementsReleased: false, gridTriggered: false, defenseTriggered: false, pressureWarned: false, pressureTriggered: false, gravityTriggered: false, locationEventA: false, locationEventB: false, thermalPulseUntil: 0, clearSweepElapsed: 0, clearSweepWarned: false, environmental: createEnvironmentalEventRuntime() }; }
function event(state: SimState, text: string, duration = 2.4) { state.eventText = text; state.eventT = duration; }
function setRole(state: SimState, id: number, role: EnemyRole, label: string) { const enemy = state.enemies.find(item => item.id === id); if (!enemy) return; enemy.role = role; enemy.label = label; enemy.anchored = role === 'elite' || role === 'boss'; }
function setTacticalEnemy(state: SimState, id: number, role: EnemyRole, variant: EnemyVariant, label: string, hp?: number, armor?: number) { const enemy = state.enemies.find(item => item.id === id); if (!enemy) return; enemy.role = role; enemy.variant = variant; enemy.label = label; enemy.anchored = role === 'elite'; if (typeof hp === 'number') { enemy.hp = hp; enemy.maxHp = hp; } if (typeof armor === 'number') { enemy.armor = armor; enemy.maxArmor = armor; } }
function configureTacticalRoster(state: SimState, contract: Contract) {
  if (contract.deepTarget === 'Transfer Adjudicator Iona Vale') { setTacticalEnemy(state, 1, 'technician', 'partitionRigger', 'Brake-Line Partition Rigger', 82, 40); setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Custody Longline Marksman', 76, 34); setTacticalEnemy(state, 3, 'assault', 'recoilBroker', 'Counterforce Broker', 90, 44); setTacticalEnemy(state, 4, 'assault', 'recoilBroker', 'Transfer Recoil Broker', 94, 48); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Flywheel Custody Repair Drone', 66, 30); setTacticalEnemy(state, 6, 'elite', 'impulseRigger', 'Brake-Line Senior Rigger', 168, 112); setTacticalEnemy(state, 7, 'technician', 'partitionRigger', 'Reserve Partition Rigger', 82, 38); setTacticalEnemy(state, 8, 'suppressor', 'marksman', 'Outbound Custody Marksman', 74, 32); return; }
  if (contract.deepTarget === 'Umbra Systems Marshal Oren Saal') { setTacticalEnemy(state, 1, 'technician', 'purgeOrchestrator', 'Umbra Purge Orchestrator', 84, 42); setTacticalEnemy(state, 2, 'assault', 'shieldBoarder', 'Cold-Line Shield Boarder', 94, 102); setTacticalEnemy(state, 3, 'technician', 'siphonTech', 'Capacitor Siphon Tech', 82, 40); setTacticalEnemy(state, 4, 'suppressor', 'marksman', 'Umbra Gallery Marksman', 74, 32); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Purge Network Repair Drone', 66, 30); setTacticalEnemy(state, 6, 'elite', 'boiloffTech', 'Senior Boiloff Controller', 166, 108); setTacticalEnemy(state, 7, 'technician', 'siphonTech', 'Reserve Siphon Tech', 80, 38); setTacticalEnemy(state, 8, 'technician', 'purgeOrchestrator', 'Reserve Purge Orchestrator', 82, 40); return; }
  if (contract.deepTarget === 'Custody Director Mara Teth') { setTacticalEnemy(state, 1, 'assault', 'custodyPorter', 'Custody Hardware Porter', 86, 42); setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Archive Geometry Marksman', 76, 34); setTacticalEnemy(state, 3, 'technician', 'geometryTech', 'Custody Geometry Tech', 82, 40); setTacticalEnemy(state, 4, 'assault', 'custodyPorter', 'Relay Hardware Porter', 88, 44); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Custody Relay Repair Drone', 66, 30); setTacticalEnemy(state, 6, 'elite', 'meleeExosuit', 'Custody Recovery Exosuit', 174, 122); setTacticalEnemy(state, 7, 'technician', 'geometryTech', 'Reserve Geometry Tech', 80, 38); setTacticalEnemy(state, 8, 'assault', 'custodyPorter', 'Reserve Custody Porter', 84, 40); return; }
  if (contract.location === 'orbital-station') { setTacticalEnemy(state, 1, 'assault', 'shieldBoarder', 'Meridian Shield Boarder', 92, 105); setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Longline Marksman', 72, 32); setTacticalEnemy(state, 3, 'technician', 'droneCarrier', 'Utility Drone Carrier', 82, 42); setTacticalEnemy(state, 4, 'assault', 'coverBreacher', 'Bulkhead Breacher', 96, 54); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Maintenance Repair Drone', 62, 26); setTacticalEnemy(state, 6, 'elite', 'meleeExosuit', 'Boarding Exosuit', 165, 118); setTacticalEnemy(state, 7, 'assault', 'salvageThief', 'Recovery Thief', 74, 28); setTacticalEnemy(state, 8, 'technician', 'gravitySpecialist', 'Mass-Control Specialist', 78, 38); }
  else if (contract.location === 'damaged-vessel') { setTacticalEnemy(state, 1, 'assault', 'vacuumSaboteur', 'Vacuum Raider', 88, 44); setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Hull-Lane Marksman', 72, 30); setTacticalEnemy(state, 3, 'technician', 'tetherOperator', 'Mag-Tether Operator', 78, 38); setTacticalEnemy(state, 4, 'assault', 'coverBreacher', 'Compartment Breacher', 94, 50); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Hull Repair Drone', 62, 24); setTacticalEnemy(state, 6, 'elite', 'meleeExosuit', 'Vacuum Boarding Exosuit', 160, 105); setTacticalEnemy(state, 7, 'assault', 'salvageThief', 'Manifest Thief', 72, 26); setTacticalEnemy(state, 8, 'assault', 'vacuumSaboteur', 'Reserve Vacuum Raider', 82, 38); }
  else if (contract.location === 'asteroid-refinery') { setTacticalEnemy(state, 1, 'assault', 'coverBreacher', 'Crusher Breacher', 96, 56); setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Gantry Marksman', 74, 34); setTacticalEnemy(state, 3, 'technician', 'repairDrone', 'Foundry Repair Drone', 64, 28); setTacticalEnemy(state, 5, 'technician', 'droneCarrier', 'Oreline Drone Carrier', 84, 44); setTacticalEnemy(state, 7, 'technician', 'gravitySpecialist', 'Transfer Mass Specialist', 80, 40); setTacticalEnemy(state, 8, 'elite', 'meleeExosuit', 'Crusher Exosuit', 166, 112); }
  else if (contract.location === 'spin-habitat') { setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Spoke Marksman', 74, 36); setTacticalEnemy(state, 5, 'technician', 'gravitySpecialist', 'Spin-Trim Specialist', 80, 42); setTacticalEnemy(state, 7, 'technician', 'droneCarrier', 'Ring Drone Carrier', 82, 44); setTacticalEnemy(state, 8, 'assault', 'shieldBoarder', 'Axis Shield Boarder', 92, 100); }
  else if (contract.location === 'jovian-harvester') { setTacticalEnemy(state, 1, 'assault', 'vacuumSaboteur', 'Storm Vacuum Raider', 90, 46); setTacticalEnemy(state, 2, 'technician', 'tetherOperator', 'Skimmer Tether Operator', 80, 40); setTacticalEnemy(state, 3, 'suppressor', 'marksman', 'Crown Marksman', 74, 32); setTacticalEnemy(state, 4, 'assault', 'coverBreacher', 'Pressure-Shell Breacher', 98, 54); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Skimmer Repair Drone', 64, 26); setTacticalEnemy(state, 6, 'elite', 'meleeExosuit', 'Storm Boarding Exosuit', 168, 110); setTacticalEnemy(state, 7, 'assault', 'salvageThief', 'Skimmer Salvage Thief', 74, 28); setTacticalEnemy(state, 8, 'technician', 'droneCarrier', 'Compressor Drone Carrier', 82, 40); }
  else if (contract.location === 'ice-mine') { setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Bore Marksman', 72, 30); setTacticalEnemy(state, 5, 'assault', 'coverBreacher', 'Tunnel Breacher', 94, 48); setTacticalEnemy(state, 7, 'assault', 'salvageThief', 'Cryobore Salvage Thief', 72, 26); setTacticalEnemy(state, 8, 'elite', 'meleeExosuit', 'Mining Exosuit', 162, 104); }
  else if (contract.location === 'solar-yard') { setTacticalEnemy(state, 5, 'technician', 'droneCarrier', 'Fabrication Drone Carrier', 82, 42); setTacticalEnemy(state, 7, 'suppressor', 'marksman', 'Sunline Marksman', 72, 30); setTacticalEnemy(state, 8, 'technician', 'gravitySpecialist', 'Mirror Mass Specialist', 78, 38); }
  else if (contract.location === 'lattice-annex') { setTacticalEnemy(state, 1, 'assault', 'shieldBoarder', 'Survey Shield Custodian', 96, 112); setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Metrology Marksman', 78, 36); setTacticalEnemy(state, 3, 'technician', 'gravitySpecialist', 'Reference Mass Technician', 82, 42); setTacticalEnemy(state, 4, 'assault', 'coverBreacher', 'Archive Breacher', 98, 56); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Khepri Maintenance Drone', 66, 30); setTacticalEnemy(state, 6, 'elite', 'meleeExosuit', 'Survey Recovery Exosuit', 178, 128); setTacticalEnemy(state, 7, 'technician', 'droneCarrier', 'Reference Drone Carrier', 88, 46); setTacticalEnemy(state, 8, 'suppressor', 'marksman', 'Vault Marksman', 80, 38); }
  else if (contract.location === 'momentum-exchange') { setTacticalEnemy(state, 1, 'assault', 'impulseRigger', 'Exchange Impulse Rigger', 94, 48); setTacticalEnemy(state, 2, 'suppressor', 'marksman', 'Transfer-Lane Marksman', 76, 34); setTacticalEnemy(state, 3, 'technician', 'gravitySpecialist', 'Countermass Technician', 84, 44); setTacticalEnemy(state, 4, 'assault', 'impulseRigger', 'Capture-Lane Rigger', 98, 52); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Flywheel Service Drone', 66, 28); setTacticalEnemy(state, 6, 'elite', 'meleeExosuit', 'Transfer Security Exosuit', 174, 122); }
  else if (contract.location === 'cryo-reserve') { setTacticalEnemy(state, 1, 'technician', 'boiloffTech', 'Boiloff Routing Tech', 84, 42); setTacticalEnemy(state, 2, 'assault', 'shieldBoarder', 'Tank-Farm Shield Boarder', 94, 104); setTacticalEnemy(state, 3, 'technician', 'boiloffTech', 'Cryopump Purge Tech', 86, 44); setTacticalEnemy(state, 4, 'suppressor', 'marksman', 'Cold-Gallery Marksman', 74, 32); setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Reserve Service Drone', 64, 26); setTacticalEnemy(state, 6, 'elite', 'meleeExosuit', 'Cryogenic Security Exosuit', 170, 118); }
}
function deployHazard(state: SimState, x: number, y: number, kind: 'shockGrid' | 'gravityWell' | 'vectorWash' | 'boiloffJet', life: number) { const hazard = state.hazards.find(item => !item.active); if (!hazard) return; Object.assign(hazard, { active: true, x, y, radius: kind === 'gravityWell' ? 185 : kind === 'vectorWash' ? 210 : kind === 'boiloffJet' ? 170 : 120, life, kind, owner: kind === 'vectorWash' || kind === 'boiloffJet' ? 'environment' as const : 'enemy' as const }); }
function triggerServiceBreach(state: SimState) { const breach = state.breaches.find(item => item.id === 'service-breach'); const sector = state.sectors.find(item => item.id === 'B'); if (!breach || !sector || breach.active) return; breach.active = true; breach.sealed = false; sector.rapidTimer = 5; sector.targetPressure = 0; sector.pressureState = 'decompressing'; for (const debris of state.debris) if (debris.sectorId === 'B') debris.active = true; event(state, 'TACTICAL ALERT // STRUCTURAL FAILURE // TRANSFER ZONE DECOMPRESSING', 3.8); }
function enforcePersistentConditions(state: SimState, contract: Contract) {
  if (!contract.conditions.includes('limited-atmosphere')) return;
  const caps = [0.74, 0.52, 0.68];
  state.sectors.forEach((sector, index) => {
    const cap = caps[index] ?? sector.targetPressure;
    sector.targetPressure = Math.min(sector.targetPressure, cap);
    sector.pressure = Math.min(sector.pressure, cap);
  });
}

export function applyMissionSetup(state: SimState, contract: Contract) {
  state.bossGateHold = true;
  const classStatus = getClassMechanicStatus(state);
  state.eventText = `${contract.locationName.toUpperCase()} // ${contract.objective.toUpperCase()}${classStatus.id !== 'none' ? ` // ${classStatus.label}` : ''}`;
  state.eventT = 4;
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (boss) boss.label = contract.deepTarget;
  if (contract.location === 'damaged-vessel') {
    state.sectors[0].label = 'FORE HAB'; state.sectors[1].label = 'CARGO SPINE'; state.sectors[2].label = 'ENGINE VAULT';
    state.sectors[0].gravity = 0.28; state.sectors[1].gravity = 0.08; state.sectors[2].gravity = 0.14;
    state.sectors[0].pressure = 0.76; state.sectors[1].pressure = 0.5; state.sectors[2].pressure = 0.66;
    for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  } else if (contract.location === 'asteroid-refinery') {
    state.sectors[0].label = 'CRUSHER DECK'; state.sectors[1].label = 'ORE TRANSFER'; state.sectors[2].label = 'REACTOR GANTRY';
    state.sectors[0].gravity = 0.62; state.sectors[1].gravity = 0.46; state.sectors[2].gravity = 0.32;
    const machinery = state.objects.find(object => object.id === 'bulkhead-b'); if (machinery) machinery.hp = 220;
  } else if (contract.location === 'spin-habitat') {
    state.sectors[0].label = 'RIM HAB'; state.sectors[1].label = 'SPOKE TRANSIT'; state.sectors[2].label = 'AXIS HUB';
    state.sectors[0].gravity = 1.02; state.sectors[1].gravity = 0.42; state.sectors[2].gravity = 0.06;
    state.sectors[0].pressure = 0.95; state.sectors[1].pressure = 0.9; state.sectors[2].pressure = 0.92;
  } else if (contract.location === 'jovian-harvester') {
    state.sectors[0].label = 'PRESSURE LOCK'; state.sectors[1].label = 'SKIMMER DECK'; state.sectors[2].label = 'COMPRESSOR CROWN';
    state.sectors[0].gravity = 0.55; state.sectors[1].gravity = 0.24; state.sectors[2].gravity = 0.18;
    state.sectors[0].pressure = 0.94; state.sectors[1].pressure = 0.62; state.sectors[2].pressure = 0.76;
  } else if (contract.location === 'ice-mine') {
    state.sectors[0].label = 'ACCESS BORE'; state.sectors[1].label = 'EXTRACTION TUNNEL'; state.sectors[2].label = 'SUBGLACIAL VAULT';
    state.sectors[0].gravity = 0.34; state.sectors[1].gravity = 0.22; state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.96; state.sectors[1].pressure = 0.9; state.sectors[2].pressure = 0.82;
  } else if (contract.location === 'solar-yard') {
    state.sectors[0].label = 'SHADE GANTRY'; state.sectors[1].label = 'FABRICATION SPINE'; state.sectors[2].label = 'SUNWARD YARD';
    state.sectors[0].gravity = 0.45; state.sectors[1].gravity = 0.28; state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.92; state.sectors[1].pressure = 0.84; state.sectors[2].pressure = 0.72;
  } else if (contract.location === 'lattice-annex') {
    state.sectors[0].label = 'COLD METROLOGY RING'; state.sectors[1].label = 'REFERENCE GALLERY'; state.sectors[2].label = 'SAMPLE VAULT'; state.sectors[0].gravity = 0.28; state.sectors[1].gravity = 0.11; state.sectors[2].gravity = 0.05; state.sectors[0].pressure = 0.9; state.sectors[1].pressure = 0.78; state.sectors[2].pressure = 0.7;
  } else if (contract.location === 'momentum-exchange') {
    state.sectors[0].label = 'BRAKE DECK'; state.sectors[1].label = 'TRANSFER TUNNEL'; state.sectors[2].label = 'COUNTERMASS CRADLE'; state.sectors[0].gravity = 0.32; state.sectors[1].gravity = 0.05; state.sectors[2].gravity = 0.12; state.sectors[0].pressure = 0.88; state.sectors[1].pressure = 0.76; state.sectors[2].pressure = 0.82;
  } else if (contract.location === 'cryo-reserve') {
    state.sectors[0].label = 'SERVICE COLLAR'; state.sectors[1].label = 'PROPELLANT GALLERY'; state.sectors[2].label = 'UMBRA TANK FARM'; state.sectors[0].gravity = 0.38; state.sectors[1].gravity = 0.16; state.sectors[2].gravity = 0.07; state.sectors[0].pressure = 0.92; state.sectors[1].pressure = 0.68; state.sectors[2].pressure = 0.56;
  } else {
    state.sectors[0].label = 'SPIN DECK'; state.sectors[1].label = 'TRANSFER BAY'; state.sectors[2].label = 'CRANE WELL';
  }
  for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  if (contract.conditions.includes('limited-atmosphere')) { state.sectors[0].pressure = Math.min(state.sectors[0].pressure, 0.74); state.sectors[1].pressure = Math.min(state.sectors[1].pressure, 0.52); state.sectors[2].pressure = Math.min(state.sectors[2].pressure, 0.68); for (const sector of state.sectors) sector.targetPressure = sector.pressure; }
  if (contract.conditions.includes('failing-gravity')) state.sectors[1].gravity = Math.min(state.sectors[1].gravity, 0.22);
  if (contract.archetype === 'boarding') { setRole(state, 1, 'assault', 'Boarding Vanguard'); setRole(state, 2, 'suppressor', 'Hold Suppressor'); setRole(state, 3, 'technician', 'Door Systems Tech'); setRole(state, 4, 'assault', 'Boarding Vanguard'); }
  else if (contract.archetype === 'stabilization') { setRole(state, 1, 'suppressor', 'Grid Rifleman'); setRole(state, 2, 'technician', 'Load Controller'); setRole(state, 3, 'technician', 'Systems Tech'); setRole(state, 4, 'assault', 'Reactor Guard'); }
  configureTacticalRoster(state, contract);
  if (contract.directiveModifierIds?.includes('repair-network')) setTacticalEnemy(state, 5, 'technician', 'repairDrone', 'Directive Repair Mesh Drone', 72, 34);
  applyEncounterLayout(state, contract);
  applyThreatBudget(state.enemies, contract);
  state.operationTier = contract.operationTier ?? 1;
  state.monsterLevel = contract.monsterLevel ?? Math.max(1, Math.round(1 + ((contract.operationTier ?? 1) - 1) * 19 / 11));
  state.maxRecoveryLevel = contract.maxRecoveryLevel ?? 12;
  state.monsterDamageScale = contract.monsterDamageScale ?? 1;
  if (boss && (contract.operationTier ?? 1) >= 9) boss.patternIndex = (contract.seed + (contract.operationTier ?? 1)) % 3;
}

function releaseReinforcements(state: SimState, contract: Contract) { const first = state.enemies.find(enemy => enemy.id === 7); const second = state.enemies.find(enemy => enemy.id === 8); if (!first || !second) return; const reserveCount = contract.reserveCount ?? 2; first.active = true; first.dead = false; first.x = contract.location === 'damaged-vessel' ? 1370 : 1450; first.y = 300; const specialized = first.variant !== 'standard' || second.variant !== 'standard'; if (contract.archetype === 'boarding') { if (first.variant === 'standard') { first.role = 'assault'; first.label = 'Reserve Breacher'; } if (reserveCount >= 2) { second.active = true; second.dead = false; if (second.variant === 'standard') { second.role = 'suppressor'; second.label = 'Reserve Suppressor'; } second.x = 1320; second.y = 790; } event(state, specialized ? 'TACTICAL ALERT // SPECIALIST BOARDING RESERVES ENTERING' : reserveCount >= 2 ? 'TACTICAL ALERT // BOARDING RESERVES ENTERING FROM TWO ROUTES' : 'TACTICAL ALERT // BOARDING RESERVE ENTERING'); } else if (contract.archetype === 'stabilization') { if (first.variant === 'standard') { first.role = 'technician'; first.label = 'Reserve Load Tech'; } if (reserveCount >= 2) { second.active = true; second.dead = false; second.x = 1320; second.y = 790; } event(state, specialized ? 'TACTICAL ALERT // SPECIALIST TECHNICAL RESERVES ENTERING' : reserveCount >= 2 ? 'TACTICAL ALERT // TECHNICAL RESERVES ENTERING GRID' : 'TACTICAL ALERT // TECHNICAL RESERVE ENTERING GRID'); } else { if (first.variant === 'standard') { first.role = 'suppressor'; first.label = 'Recovery Interdictor'; } if (reserveCount >= 2) { second.active = true; second.dead = false; second.x = 1320; second.y = 790; } event(state, specialized ? 'TACTICAL ALERT // SPECIALIST RECOVERY TEAM ENTERING' : reserveCount >= 2 ? 'TACTICAL ALERT // RECOVERY TEAM ENTERING FROM TWO ROUTES' : 'TACTICAL ALERT // RECOVERY INTERDICTOR ENTERING FROM AFT'); } }

function stepExtractionSweep(state: SimState, runtime: DirectorRuntime, objectiveComplete: boolean, dt: number) {
  if (!state.bossGateHold || runtime.deep || state.player.dead || !objectiveComplete) { runtime.clearSweepElapsed = 0; runtime.clearSweepWarned = false; return; }
  const hostiles = state.enemies.filter(enemy => enemy.role !== 'boss' && enemy.active && !enemy.dead);
  if (hostiles.length === 0) { runtime.clearSweepElapsed = 0; runtime.clearSweepWarned = false; return; }
  runtime.clearSweepElapsed += dt;
  const nearest = [...hostiles].sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  if (!runtime.clearSweepWarned && runtime.clearSweepElapsed >= 3) { runtime.clearSweepWarned = true; event(state, `EXTRACTION SWEEP // ${hostiles.length} HOSTILE${hostiles.length === 1 ? '' : 'S'} REMAIN // ${nearest.label.toUpperCase()}`, 3.2); }
  if (hostiles.length > 2 || !nearest) return;
  const distance = Math.hypot(nearest.x - state.player.x, nearest.y - state.player.y);
  if (runtime.clearSweepElapsed < 10 || (distance <= 620 && runtime.clearSweepElapsed < 18)) return;
  const side = nearest.id % 2 === 0 ? 1 : -1;
  nearest.x = Math.max(220, Math.min(2100, state.player.x + (state.player.x < 1200 ? 360 : -360)));
  nearest.y = Math.max(220, Math.min(840, state.player.y + side * 150));
  nearest.vx = 0; nearest.vy = 0; nearest.state = 'advance';
  event(state, `EXTRACTION SWEEP // ${nearest.label.toUpperCase()} REROUTED TO YOUR SECTOR`, 3.2);
  runtime.clearSweepElapsed = 4;
}

export function stepMissionDirector(state: SimState, runtime: DirectorRuntime, contract: Contract, dt: number) {
  runtime.elapsed += dt;
  if (runtime.deep) runtime.deepElapsed += dt;
  const objective = getMissionObjectiveStatus(state, contract);

  if (contract.location === 'spin-habitat') {
    if (!runtime.locationEventA && runtime.elapsed >= 10) {
      runtime.locationEventA = true;
      const stabilized = contract.objectiveMode === 'gravity-stabilization' && objective.complete;
      state.sectors[0].gravity = stabilized ? 0.58 : 0.08;
      state.sectors[1].gravity = stabilized ? 0.22 : 0.03;
      state.sectors[2].gravity = 0.01;
      event(state, stabilized ? 'RING SPINDOWN // CALIBRATED TRIMS LIMIT GRAVITY LOSS' : 'RING EMERGENCY SPINDOWN // RIM 0.08G // SPOKE 0.03G', 3.6);
    }
    if (!runtime.locationEventB && runtime.elapsed >= 22) {
      runtime.locationEventB = true;
      state.sectors[0].gravity = 0.86; state.sectors[1].gravity = 0.36; state.sectors[2].gravity = 0.05;
      event(state, 'SPIN BUS RECOVERED // RING GRAVITY RETURNING', 3);
    }
  } else if (contract.location === 'jovian-harvester') {
    if (!runtime.locationEventA && runtime.elapsed >= 9) {
      runtime.locationEventA = true;
      const seal = state.objects.find(object => object.id === 'service-seal');
      if (contract.objectiveMode === 'pressure-recovery' && seal?.exposed) event(state, 'STORM SHEAR ARRIVAL // RELIEF MANIFOLD HOLDS', 3);
      else {
        const breach = state.breaches.find(item => item.id === 'service-breach');
        const sector = state.sectors.find(item => item.id === 'B');
        if (breach && sector) { breach.active = true; breach.sealed = false; breach.strength = 1450; breach.radius = 760; sector.rapidTimer = 4.5; sector.targetPressure = 0; sector.pressureState = 'decompressing'; }
        event(state, 'JOVIAN STORM SHEAR // MAINTENANCE VENT OPEN // PRESSURE VECTOR HIGH', 3.8);
      }
    }
    if (!runtime.locationEventB && runtime.elapsed >= 21) {
      runtime.locationEventB = true;
      const breach = state.breaches.find(item => item.id === 'service-breach');
      const sector = state.sectors.find(item => item.id === 'B');
      if (breach?.active && sector) { breach.active = false; sector.rapidTimer = 0; sector.targetPressure = 0.62; }
      event(state, 'STORM RELIEF SHUTTERS RECOVERED // SKIMMER DECK RE-PRESSURIZING', 3);
    }
  } else if (contract.location === 'ice-mine') {
    if (!runtime.locationEventA && runtime.elapsed >= 14) {
      runtime.locationEventA = true;
      const brittle = state.objects.filter(object => object.id === 'ice-brittle-gate-a' || object.id === 'ice-brittle-gate-b');
      const opened = brittle.filter(object => object.active).length;
      for (const object of brittle) object.active = false;
      event(state, opened > 0 ? 'ICE SHEAR // BRITTLE SUPPORTS FAILED // NEW FIRING LANES OPEN' : 'ICE SHEAR // FRACTURE PATH ALREADY CLEARED', 3.2);
    }
  } else if (contract.location === 'solar-yard') {
    const shutter = state.objects.find(object => object.id === 'solar-shutter');
    if (!runtime.locationEventA && runtime.elapsed >= 10) {
      runtime.locationEventA = true;
      runtime.thermalPulseUntil = 18;
      event(state, shutter?.exposed ? 'SOLAR LOAD WINDOW // LOCAL THERMAL SHUTTERS ALREADY CLOSED' : 'SOLAR LOAD WINDOW // THERMAL SHUTTERS OPEN // WEAPON HEAT RISING', 3.6);
    }
    if (runtime.thermalPulseUntil > runtime.elapsed && !shutter?.exposed) {
      const weapon = state.player.currentWeapon;
      state.player.weaponHeat[weapon] = Math.min(1, state.player.weaponHeat[weapon] + 0.034 * dt);
    }
    if (!runtime.locationEventB && runtime.elapsed >= 18) {
      runtime.locationEventB = true;
      event(state, 'SOLAR ANGLE PASSED // RADIANT LOAD NORMALIZED', 2.8);
    }
  } else if (contract.location === 'momentum-exchange') {
    if (!runtime.locationEventA && runtime.elapsed >= 9) { runtime.locationEventA = true; if (objective.complete) event(state, 'CAPTURE DRUMS LOADED // FIRST COUNTERMASS WASH BLED INTO FLYWHEELS', 3); else { deployHazard(state, 1050, 520, 'vectorWash', 6); event(state, 'COUNTERMASS WASH // TRANSFER LANE IMPULSE FRONT LIVE', 3.5); } }
    if (!runtime.locationEventB && runtime.elapsed >= 20) { runtime.locationEventB = true; if (objective.complete) event(state, 'OUTBOUND REFERENCE HOLDS // SECOND WASH DAMPED', 2.8); else { deployHazard(state, 1370, 520, 'vectorWash', 6); event(state, 'TRANSFER REVERSAL // SECOND COUNTERMASS WASH CROSSING LANE', 3.4); } }
  } else if (contract.location === 'cryo-reserve') {
    if (!runtime.locationEventA && runtime.elapsed >= 10) { runtime.locationEventA = true; if (objective.complete) event(state, 'PURGE ROUTE LOCKED // BOILOFF REJECTED TO VACUUM', 3); else { deployHazard(state, 980, 520, 'boiloffJet', 6.5); event(state, 'CRYOGENIC BOILOFF // SERVICE GALLERY PURGE PLUME LIVE', 3.5); } }
    if (!runtime.locationEventB && runtime.elapsed >= 21) { runtime.locationEventB = true; if (objective.complete) event(state, 'THERMAL ROUTE STABLE // SECOND PURGE BYPASSED', 2.8); else { deployHazard(state, 1370, 620, 'boiloffJet', 6); event(state, 'RESERVE PRESSURE RISE // SECONDARY BOILOFF PURGE', 3.4); } }
  } else if (contract.location === 'lattice-annex') {
    if (!runtime.locationEventA && runtime.elapsed >= 10) {
      runtime.locationEventA = true;
      state.sectors[1].gravity = 0.03;
      state.sectors[2].gravity = 0.02;
      event(state, 'KHEPRI CALIBRATION MASS SHIFT // REFERENCE GALLERY ENTERING NEAR-ZERO-G', 3.4);
    }
    if (!runtime.locationEventB && runtime.elapsed >= 20) {
      runtime.locationEventB = true;
      state.sectors[1].gravity = 0.11;
      state.sectors[2].gravity = 0.05;
      for (const shutter of state.objects.filter(object => object.id.startsWith('lattice-shutter') && object.hp > 0)) shutter.active = true;
      event(state, 'KHEPRI REFERENCE INDEX // CALIBRATION SHUTTERS REPOSITIONED // FIRING LANES CHANGED', 3.2);
    }
  }

  const reinforcementTrigger = contract.encounterPattern === 'swarm' ? 1 : contract.encounterPattern === 'elite-led' ? 3 : 2;
  if (!runtime.reinforcementsReleased && state.kills >= reinforcementTrigger) {
    runtime.reinforcementsReleased = true;
    releaseReinforcements(state, contract);
  }

  if (contract.conditions.includes('damaged-grid') && !runtime.gridTriggered && runtime.elapsed >= 10) {
    runtime.gridTriggered = true;
    if (contract.objectiveMode === 'grid-isolation' && objective.complete) event(state, 'GRID ISOLATION HOLDS // ARC CASCADE PREVENTED', 2.4);
    else {
      deployHazard(state, 1110, 535, 'shockGrid', 7);
      event(state, 'TACTICAL ALERT // DAMAGED GRID ENERGIZED // ARC FIELD VISIBLE');
    }
  }

  if (contract.location !== 'jovian-harvester' && contract.conditions.includes('unstable-pressure') && !runtime.pressureWarned && runtime.elapsed >= 13) {
    runtime.pressureWarned = true;
    const serviceSeal = state.objects.find(object => object.id === 'service-seal');
    if (contract.objectiveMode === 'pressure-recovery' && serviceSeal?.exposed) event(state, 'STRUCTURAL LOAD RISING // SERVICE MANIFOLD HOLDING', 3.2);
    else event(state, 'STRUCTURAL WARNING // SERVICE PLATE FAILURE IN FOUR SECONDS', 4);
  }
  if (contract.location !== 'jovian-harvester' && contract.conditions.includes('unstable-pressure') && !runtime.pressureTriggered && runtime.elapsed >= 17) {
    runtime.pressureTriggered = true;
    const serviceSeal = state.objects.find(object => object.id === 'service-seal');
    if (contract.objectiveMode === 'pressure-recovery' && serviceSeal?.exposed) event(state, 'SERVICE MANIFOLD HOLDS // SECONDARY FAILURE CONTAINED', 2.6);
    else triggerServiceBreach(state);
  }

  if (contract.location !== 'spin-habitat' && contract.conditions.includes('failing-gravity') && !runtime.gravityTriggered && runtime.elapsed >= 15) {
    runtime.gravityTriggered = true;
    if (contract.objectiveMode === 'gravity-stabilization' && objective.complete) event(state, 'GRAVITY TRIMS HOLD // CASCADE ARRESTED', 2.4);
    else {
      const sector = state.sectors.find(item => item.id === 'B');
      if (sector) sector.gravity = 0.05;
      event(state, 'GRAVITY CONTROL FAILURE // TRANSFER ZONE 0.05G', 3);
    }
  }

  if (contract.conditions.includes('automated-defense') && !runtime.defenseTriggered && runtime.deep && runtime.deepElapsed >= 6) {
    runtime.defenseTriggered = true;
    deployHazard(state, 1900, 520, 'shockGrid', 8);
    event(state, 'OPTIONAL DEEP ZONE // AUTOMATED DEFENSE GRID ONLINE', 3);
  }

  stepEnvironmentalEvents(state, runtime.environmental, contract, dt, runtime.elapsed);
  enforcePersistentConditions(state, contract);
  stepExtractionSweep(state, runtime, objective.complete, dt);
}
export function continueIntoDeepZone(state: SimState, runtime: DirectorRuntime) { runtime.deep = true; runtime.deepElapsed = 0; releaseBossGate(state); event(state, 'EXTRACTION WAIVED // DEEP ZONE OPEN // HIGHER SALVAGE EXPOSURE', 3.5); }
