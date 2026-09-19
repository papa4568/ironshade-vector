import type { Contract, ObjectiveMode } from './campaign';
import type { CombatObject, SimState } from './sim';
import { reserveNavigationLanes } from './mapNavigation';

export type MissionObjectiveStatus = {
  label: string;
  detail: string;
  progress: number;
  required: number;
  complete: boolean;
};

function patchObject(state: SimState, id: string, patch: Partial<CombatObject>) {
  const object = state.objects.find(item => item.id === id);
  if (object) Object.assign(object, patch);
}

function addObject(state: SimState, object: CombatObject) {
  if (!state.objects.some(item => item.id === object.id)) state.objects.push(object);
}

function systemObject(
  id: string,
  label: string,
  kind: CombatObject['kind'],
  x: number,
  y: number,
  w = 46,
  h = 58,
): CombatObject {
  return {
    id,
    label,
    kind,
    material: 'system',
    x,
    y,
    w,
    h,
    hp: kind === 'anchorNode' ? 92 : 40,
    maxHp: kind === 'anchorNode' ? 92 : 40,
    destructible: kind === 'anchorNode',
    active: true,
    exposed: false,
  };
}

function coverObject(
  id: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  material: CombatObject['material'] = 'bulkhead',
): CombatObject {
  return {
    id,
    label,
    kind: 'cover',
    material,
    x,
    y,
    w,
    h,
    hp: material === 'light' ? 68 : material === 'industrial' ? 190 : 9999,
    maxHp: material === 'light' ? 68 : material === 'industrial' ? 190 : 9999,
    destructible: material !== 'bulkhead',
    active: true,
    exposed: false,
  };
}

function configureDamagedVessel(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Bunk cargo rack', x: 430, y: 270, w: 150, h: 110, hp: 72, maxHp: 72 });
  patchObject(state, 'bulkhead-a', { label: 'Hab pressure trunk', x: 670, y: 335, w: 205, h: 72 });
  patchObject(state, 'crate-b', { label: 'Loose freight frame', x: 930, y: 680, w: 130, h: 120, hp: 66, maxHp: 66 });
  patchObject(state, 'bulkhead-b', { label: 'Cargo spine machinery', x: 1125, y: 425, w: 82, h: 275, hp: 205, maxHp: 205 });
  patchObject(state, 'conduit-a', { label: 'Life-support bus', x: 1010, y: 260, w: 72, h: 72 });
  patchObject(state, 'coolant-a', { label: 'Suit-loop manifold', x: 620, y: 690, w: 52, h: 88 });
  patchObject(state, 'service-plate', { label: 'Split hull service plate', x: 1360, y: 465, w: 96, h: 72, hp: 78, maxHp: 78 });
  patchObject(state, 'door-control', { label: 'Hab pressure interlock', x: 742, y: 500 });
  patchObject(state, 'gravity-control', { label: 'Cargo spin trim', x: 1260, y: 760 });
  patchObject(state, 'arena-cover', { label: 'Drive service cage', x: 1880, y: 510, w: 92, h: 270, hp: 205, maxHp: 205 });
  patchObject(state, 'arena-conduit', { label: 'Engine vault bus', x: 2070, y: 760 });
  patchObject(state, 'boss-seal', { label: 'Engine vault shutter', x: 1715, y: 700 });

  const serviceBreach = state.breaches.find(item => item.id === 'service-breach');
  if (serviceBreach) Object.assign(serviceBreach, { x: 1440, y: 505, radius: 540, strength: 880 });

  addObject(state, coverObject('vessel-rib-a-top', 'Pressure rib A', 820, 160, 42, 190));
  addObject(state, coverObject('vessel-rib-a-bottom', 'Pressure rib A', 820, 730, 42, 190));
  addObject(state, coverObject('vessel-rib-b-top', 'Pressure rib B', 1215, 160, 42, 155));
  addObject(state, coverObject('vessel-rib-b-bottom', 'Pressure rib B', 1215, 765, 42, 155));
  addObject(state, coverObject('vessel-side-locker', 'Pressure locker', 1010, 470, 110, 62, 'industrial'));
}

function configureRefinery(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Ore sample bin', x: 560, y: 285, w: 105, h: 105, hp: 82, maxHp: 82 });
  patchObject(state, 'bulkhead-a', { label: 'Crusher bearing', x: 760, y: 725, w: 135, h: 82 });
  patchObject(state, 'crate-b', { label: 'Transfer dolly', x: 980, y: 520, w: 110, h: 105, hp: 74, maxHp: 74 });
  patchObject(state, 'bulkhead-b', { label: 'Ore separator', x: 1285, y: 280, w: 135, h: 115, hp: 225, maxHp: 225 });
  patchObject(state, 'conduit-a', { label: 'Crusher drive bus', x: 1180, y: 790, w: 84, h: 72 });
  patchObject(state, 'coolant-a', { label: 'Quench riser', x: 850, y: 500, w: 58, h: 94 });
  patchObject(state, 'service-plate', { active: false });
  patchObject(state, 'door-control', { label: 'Ore transfer interlock', x: 690, y: 760 });
  patchObject(state, 'gravity-control', { label: 'Transfer gravitic trim', x: 1120, y: 215 });
  patchObject(state, 'arena-cover', { label: 'Foundry heat exchanger', x: 1960, y: 680, w: 140, h: 100, hp: 230, maxHp: 230 });
  patchObject(state, 'arena-conduit', { label: 'Foundry trunk', x: 1835, y: 300, w: 90, h: 76 });
  patchObject(state, 'boss-seal', { active: false });

  addObject(state, coverObject('refinery-island-a', 'Crusher drive housing', 690, 430, 150, 66, 'industrial'));
  addObject(state, coverObject('refinery-island-b', 'Ore lift pedestal', 1110, 690, 125, 78, 'industrial'));
  addObject(state, coverObject('refinery-island-c', 'Reactor feed manifold', 1360, 520, 108, 88, 'industrial'));
  addObject(state, coverObject('refinery-arena-island', 'Foundry coolant bank', 1780, 475, 125, 78, 'industrial'));

  const anchorA = systemObject('foundry-anchor-a', 'Foundry anchor node A', 'anchorNode', 1760, 270, 58, 58);
  const anchorB = systemObject('foundry-anchor-b', 'Foundry anchor node B', 'anchorNode', 2110, 690, 58, 58);
  anchorA.active = false;
  anchorB.active = false;
  addObject(state, anchorA);
  addObject(state, anchorB);

  const fieldAnchorA = systemObject('field-anchor-a', 'Stabilization node A', 'anchorNode', 1220, 420, 50, 50);
  const fieldAnchorB = systemObject('field-anchor-b', 'Stabilization node B', 'anchorNode', 1380, 690, 50, 50);
  fieldAnchorA.hp = 68;
  fieldAnchorA.maxHp = 68;
  fieldAnchorA.active = false;
  fieldAnchorB.hp = 68;
  fieldAnchorB.maxHp = 68;
  fieldAnchorB.active = false;
  addObject(state, fieldAnchorA);
  addObject(state, fieldAnchorB);

  const elite = state.enemies.find(enemy => enemy.id === 6);
  if (elite) {
    elite.label = 'Anchor Engineer';
    elite.variant = 'anchorEngineer';
    elite.hp = 150;
    elite.maxHp = 150;
    elite.armor = 112;
    elite.maxArmor = 112;
  }

  const skirmisher = state.enemies.find(enemy => enemy.id === 4);
  if (skirmisher) {
    skirmisher.label = 'Vector Skirmisher';
    skirmisher.variant = 'vectorSkirmisher';
    skirmisher.hp = 88;
    skirmisher.maxHp = 88;
    skirmisher.armor = 42;
    skirmisher.maxArmor = 42;
  }

  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (boss) {
    boss.variant = 'foundryMarshal';
    boss.hp = 610;
    boss.maxHp = 610;
    boss.armor = 210;
    boss.maxArmor = 210;
  }
}

function configureSpinHabitat(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Rim provisions rack', x: 470, y: 720, w: 115, h: 105, hp: 70, maxHp: 70 });
  patchObject(state, 'bulkhead-a', { label: 'Ring bearing housing', x: 690, y: 260, w: 95, h: 225 });
  patchObject(state, 'crate-b', { label: 'Spoke cargo trolley', x: 990, y: 300, w: 120, h: 105, hp: 66, maxHp: 66 });
  patchObject(state, 'bulkhead-b', { label: 'Spin-drive service bank', x: 1180, y: 620, w: 175, h: 78, hp: 205, maxHp: 205 });
  patchObject(state, 'conduit-a', { label: 'Ring drive bus', x: 1120, y: 245, w: 78, h: 70 });
  patchObject(state, 'coolant-a', { label: 'Bearing coolant loop', x: 835, y: 680, w: 54, h: 90 });
  patchObject(state, 'service-plate', { label: 'Rim pressure panel', x: 1370, y: 760, w: 100, h: 60, hp: 78, maxHp: 78 });
  patchObject(state, 'door-control', { label: 'Spoke pressure interlock', x: 735, y: 520 });
  patchObject(state, 'gravity-control', { label: 'Spoke spin trim', x: 1280, y: 245 });
  patchObject(state, 'arena-cover', { label: 'Axis momentum wheel', x: 1880, y: 470, w: 120, h: 120, hp: 205, maxHp: 205 });
  patchObject(state, 'arena-conduit', { label: 'Axis power trunk', x: 2040, y: 720 });
  const breach = state.breaches.find(item => item.id === 'service-breach');
  if (breach) Object.assign(breach, { x: 1430, y: 790, radius: 520, strength: 900 });
  addObject(state, coverObject('spin-ring-wall-a', 'Ring pressure rib', 760, 160, 46, 210));
  addObject(state, coverObject('spin-ring-wall-b', 'Ring pressure rib', 760, 690, 46, 230));
  addObject(state, coverObject('spin-spoke-brace-a', 'Spoke brace', 1010, 470, 165, 54, 'industrial'));
  addObject(state, coverObject('spin-spoke-brace-b', 'Spoke brace', 1285, 420, 145, 54, 'industrial'));
  for (const [id, label, x, y, w, h] of [
    ['meridian-barricade-a', 'Portable Palisade A', 900, 570, 104, 42],
    ['meridian-barricade-b', 'Portable Palisade B', 1210, 330, 104, 42],
    ['meridian-pressure-door', 'Emergency pressure lane', 760, 455, 42, 170],
    ['commander-barricade-a', 'Command Palisade A', 1750, 310, 118, 46],
    ['commander-barricade-b', 'Command Palisade B', 2010, 650, 118, 46],
    ['commander-pressure-door-a', 'Command pressure shutter A', 1850, 430, 46, 160],
    ['commander-pressure-door-b', 'Command pressure shutter B', 2080, 350, 46, 160],
  ] as const) {
    const barrier = coverObject(id, label, x, y, w, h, 'industrial');
    barrier.active = false;
    barrier.hp = id.includes('pressure-door') ? 145 : 112;
    barrier.maxHp = barrier.hp;
    addObject(state, barrier);
  }
  const palisadeA = state.enemies.find(enemy => enemy.id === 1);
  if (palisadeA) { palisadeA.label = 'Meridian Palisade Trooper'; palisadeA.variant = 'barricadeTrooper'; palisadeA.armor = 82; palisadeA.maxArmor = 82; }
  const lockTech = state.enemies.find(enemy => enemy.id === 3);
  if (lockTech) { lockTech.role = 'technician'; lockTech.label = 'Meridian Lock Technician'; lockTech.variant = 'pressureLockTech'; lockTech.armor = 66; lockTech.maxArmor = 66; }
  const palisadeB = state.enemies.find(enemy => enemy.id === 4);
  if (palisadeB) { palisadeB.label = 'Meridian Recovery Trooper'; palisadeB.variant = 'barricadeTrooper'; palisadeB.armor = 78; palisadeB.maxArmor = 78; }
  const bulwark = state.enemies.find(enemy => enemy.id === 6);
  if (bulwark) { bulwark.label = 'Meridian Recovery Bulwark'; bulwark.variant = 'barricadeTrooper'; bulwark.armor = 142; bulwark.maxArmor = 142; }
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (boss) { boss.variant = 'meridianCommander'; boss.hp = 680; boss.maxHp = 680; boss.armor = 320; boss.maxArmor = 320; }
}

function configureJovianHarvester(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Skimmer valve crate', x: 430, y: 300, w: 110, h: 100, hp: 68, maxHp: 68 });
  patchObject(state, 'bulkhead-a', { label: 'Storm truss footing', x: 650, y: 650, w: 150, h: 72 });
  patchObject(state, 'crate-b', { label: 'Separator service rack', x: 965, y: 735, w: 115, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, 'bulkhead-b', { label: 'Compressor pressure shell', x: 1210, y: 300, w: 155, h: 92, hp: 215, maxHp: 215 });
  patchObject(state, 'conduit-a', { label: 'Electrostatic skimmer bus', x: 1090, y: 520, w: 80, h: 72 });
  patchObject(state, 'coolant-a', { label: 'Cryopump return riser', x: 790, y: 430, w: 55, h: 92 });
  patchObject(state, 'service-plate', { label: 'Storm relief plate', x: 1390, y: 190, w: 84, h: 68, hp: 72, maxHp: 72 });
  patchObject(state, 'door-control', { label: 'Inner storm lock', x: 610, y: 250 });
  patchObject(state, 'gravity-control', { label: 'Compressor mass trim', x: 1300, y: 760 });
  patchObject(state, 'arena-cover', { label: 'Compressor crown', x: 1910, y: 360, w: 155, h: 86, hp: 220, maxHp: 220 });
  patchObject(state, 'arena-conduit', { label: 'Harvester crown bus', x: 2050, y: 735 });
  const breach = state.breaches.find(item => item.id === 'service-breach');
  if (breach) Object.assign(breach, { x: 1450, y: 220, radius: 760, strength: 1450 });
  addObject(state, coverObject('gas-truss-a', 'Maintenance truss A', 720, 470, 155, 52, 'industrial'));
  addObject(state, coverObject('gas-truss-b', 'Maintenance truss B', 980, 330, 145, 52, 'industrial'));
  addObject(state, coverObject('gas-truss-c', 'Maintenance truss C', 1260, 650, 155, 52, 'industrial'));
}

function configureIceMine(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Cryobore tool pallet', x: 370, y: 500, w: 105, h: 95, hp: 62, maxHp: 62 });
  patchObject(state, 'bulkhead-a', { label: 'Haulage motor', x: 655, y: 420, w: 120, h: 76 });
  patchObject(state, 'crate-b', { label: 'Volatile sample cage', x: 945, y: 270, w: 105, h: 95, hp: 60, maxHp: 60 });
  patchObject(state, 'bulkhead-b', { label: 'Cryobore separator', x: 1260, y: 660, w: 145, h: 90, hp: 180, maxHp: 180 });
  patchObject(state, 'conduit-a', { label: 'Thaw-grid trunk', x: 1110, y: 260, w: 74, h: 68 });
  patchObject(state, 'coolant-a', { label: 'Volatile chill line', x: 875, y: 690, w: 54, h: 88 });
  patchObject(state, 'service-plate', { label: 'Fractured bore pressure plate', x: 1375, y: 505, w: 88, h: 64, hp: 66, maxHp: 66 });
  patchObject(state, 'door-control', { label: 'Access-bore lock', x: 580, y: 520 });
  patchObject(state, 'gravity-control', { label: 'Deep-bore haulage trim', x: 1280, y: 280 });
  patchObject(state, 'arena-cover', { label: 'Subglacial separator drum', x: 1880, y: 580, w: 135, h: 92, hp: 180, maxHp: 180 });
  patchObject(state, 'arena-conduit', { label: 'Vault thaw bus', x: 2060, y: 300 });
  const breach = state.breaches.find(item => item.id === 'service-breach');
  if (breach) Object.assign(breach, { x: 1430, y: 535, radius: 500, strength: 780 });
  addObject(state, coverObject('ice-wall-a-top', 'Bore wall', 540, 160, 55, 245));
  addObject(state, coverObject('ice-wall-a-bottom', 'Bore wall', 540, 635, 55, 285));
  addObject(state, coverObject('ice-wall-b-top', 'Extraction wall', 1035, 160, 55, 155));
  addObject(state, coverObject('ice-wall-b-bottom', 'Extraction wall', 1035, 535, 55, 385));
  addObject(state, coverObject('ice-brittle-gate-a', 'Brittle ice support A', 760, 445, 115, 58, 'light'));
  addObject(state, coverObject('ice-brittle-gate-b', 'Brittle ice support B', 1190, 455, 110, 58, 'light'));
  const riggerA = state.enemies.find(enemy => enemy.id === 1);
  if (riggerA) { riggerA.label = 'Long Arc Backblast Rigger'; riggerA.variant = 'vectorSkirmisher'; riggerA.hp = 86; riggerA.maxHp = 86; }
  const tether = state.enemies.find(enemy => enemy.id === 3);
  if (tether) { tether.role = 'technician'; tether.label = 'Long Arc Tether Hand'; tether.variant = 'tetherRigger'; tether.hp = 76; tether.maxHp = 76; }
  const riggerB = state.enemies.find(enemy => enemy.id === 4);
  if (riggerB) { riggerB.label = 'Long Arc Recoil Cutter'; riggerB.variant = 'vectorSkirmisher'; riggerB.hp = 90; riggerB.maxHp = 90; }
  const foreman = state.enemies.find(enemy => enemy.id === 6);
  if (foreman) { foreman.label = 'Long Arc Jury-Rig Foreman'; foreman.variant = 'tetherRigger'; foreman.armor = 96; foreman.maxArmor = 96; }
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (boss) { boss.variant = 'salvageCaptain'; boss.hp = 605; boss.maxHp = 605; boss.armor = 165; boss.maxArmor = 165; }
}

function configureSolarYard(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Mirror actuator crate', x: 460, y: 265, w: 115, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, 'bulkhead-a', { label: 'Shade gantry bearing', x: 690, y: 690, w: 150, h: 74 });
  patchObject(state, 'crate-b', { label: 'Printer spindle pallet', x: 980, y: 510, w: 110, h: 100, hp: 68, maxHp: 68 });
  patchObject(state, 'bulkhead-b', { label: 'Fabrication heat bank', x: 1240, y: 265, w: 150, h: 100, hp: 210, maxHp: 210 });
  patchObject(state, 'conduit-a', { label: 'Sunward fabrication bus', x: 1120, y: 760, w: 82, h: 72 });
  patchObject(state, 'coolant-a', { label: 'Radiator coolant riser', x: 845, y: 420, w: 58, h: 92 });
  patchObject(state, 'service-plate', { label: 'Radiator pressure plate', x: 1390, y: 650, w: 88, h: 66, hp: 74, maxHp: 74 });
  patchObject(state, 'door-control', { label: 'Shade-side pressure lock', x: 650, y: 280 });
  patchObject(state, 'gravity-control', { label: 'Fabrication gantry trim', x: 1300, y: 760 });
  patchObject(state, 'arena-cover', { label: 'Sunward print carriage', x: 1910, y: 500, w: 155, h: 88, hp: 225, maxHp: 225 });
  patchObject(state, 'arena-conduit', { label: 'Sunward power trunk', x: 2060, y: 285 });
  const breach = state.breaches.find(item => item.id === 'service-breach');
  if (breach) Object.assign(breach, { x: 1440, y: 680, radius: 520, strength: 840 });
  addObject(state, systemObject('solar-shutter', 'Local thermal shutters', 'doorControl', 930, 220));
  addObject(state, coverObject('solar-radiator-a', 'Radiator bank A', 760, 420, 135, 58, 'industrial'));
  addObject(state, coverObject('solar-radiator-b', 'Radiator bank B', 1160, 610, 145, 58, 'industrial'));
  for (const [id, label, x, y] of [
    ['yard-door-a', 'Autonomous fabrication shutter A', 1760, 345],
    ['yard-door-b', 'Autonomous fabrication shutter B', 2020, 610],
  ] as const) {
    const door = coverObject(id, label, x, y, 52, 170, 'industrial');
    door.active = false;
    door.hp = 150;
    door.maxHp = 150;
    addObject(state, door);
  }
  const interceptor = state.enemies.find(enemy => enemy.id === 1);
  if (interceptor) { interceptor.label = 'Maintenance Interceptor'; interceptor.variant = 'maintenanceDrone'; interceptor.hp = 68; interceptor.maxHp = 68; interceptor.armor = 34; interceptor.maxArmor = 34; }
  const gravityDrone = state.enemies.find(enemy => enemy.id === 2);
  if (gravityDrone) { gravityDrone.label = 'Mass-Trim Drone'; gravityDrone.variant = 'gravityDrone'; gravityDrone.hp = 72; gravityDrone.maxHp = 72; }
  const serviceDrone = state.enemies.find(enemy => enemy.id === 3);
  if (serviceDrone) { serviceDrone.label = 'Fabrication Service Drone'; serviceDrone.variant = 'maintenanceDrone'; serviceDrone.hp = 64; serviceDrone.maxHp = 64; }
  const cutterDrone = state.enemies.find(enemy => enemy.id === 4);
  if (cutterDrone) { cutterDrone.label = 'Arc-Cutter Drone'; cutterDrone.variant = 'maintenanceDrone'; }
  const relay = state.enemies.find(enemy => enemy.id === 6);
  if (relay) { relay.label = 'Autonomous Control Relay'; relay.variant = 'gravityDrone'; relay.hp = 132; relay.maxHp = 132; relay.armor = 92; relay.maxArmor = 92; }
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (boss) { boss.variant = 'yardmind'; boss.hp = 560; boss.maxHp = 560; boss.armor = 235; boss.maxArmor = 235; boss.x = 2060; boss.y = 520; }
}

function configureMomentumExchange(state: SimState) { patchObject(state, 'crate-a', { label: 'Capture-collar pallet', x: 410, y: 300, w: 120, h: 96, hp: 72, maxHp: 72 }); patchObject(state, 'bulkhead-a', { label: 'Inbound flywheel housing', x: 650, y: 660, w: 165, h: 72, hp: 210, maxHp: 210 }); patchObject(state, 'crate-b', { label: 'Transfer cradle dolly', x: 980, y: 270, w: 118, h: 100, hp: 70, maxHp: 70 }); patchObject(state, 'bulkhead-b', { label: 'Outbound flywheel housing', x: 1240, y: 690, w: 165, h: 72, hp: 210, maxHp: 210 }); patchObject(state, 'conduit-a', { label: 'Countermass bus', x: 1110, y: 510, w: 82, h: 72 }); patchObject(state, 'coolant-a', { label: 'Flywheel bearing loop', x: 850, y: 420, w: 58, h: 92 }); patchObject(state, 'service-plate', { label: 'Transfer-lane service panel', x: 1400, y: 300, w: 90, h: 68, hp: 74, maxHp: 74 }); patchObject(state, 'door-control', { label: 'Inbound capture collar', x: 610, y: 275 }); patchObject(state, 'gravity-control', { label: 'Outbound mass trim', x: 1320, y: 760 }); patchObject(state, 'arena-cover', { label: 'Deep counterweight cradle', x: 1910, y: 520, w: 150, h: 90, hp: 225, maxHp: 225 }); patchObject(state, 'arena-conduit', { label: 'Exchange reference bus', x: 2070, y: 285 }); addObject(state, coverObject('momentum-rail-a', 'Electromagnetic transfer rail A', 760, 370, 180, 48, 'industrial')); addObject(state, coverObject('momentum-rail-b', 'Electromagnetic transfer rail B', 1090, 640, 180, 48, 'industrial')); addObject(state, coverObject('momentum-baffle', 'Countermass service baffle', 1410, 470, 110, 58, 'light')); }
function configureParallaxArray(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Inertial reference case', x: 430, y: 285, w: 116, h: 92, hp: 74, maxHp: 74 });
  patchObject(state, 'bulkhead-a', { label: 'Near-baseline mass carriage', x: 690, y: 660, w: 160, h: 74, hp: 230, maxHp: 230 });
  patchObject(state, 'crate-b', { label: 'Cross-track calibration rack', x: 1010, y: 710, w: 116, h: 94, hp: 72, maxHp: 72 });
  patchObject(state, 'bulkhead-b', { label: 'Reference interferometer housing', x: 1260, y: 300, w: 165, h: 86, hp: 240, maxHp: 240 });
  patchObject(state, 'conduit-a', { label: 'Baseline timing bus', x: 1130, y: 520, w: 84, h: 72 });
  patchObject(state, 'coolant-a', { label: 'Inertial standard coolant loop', x: 850, y: 390, w: 56, h: 92 });
  patchObject(state, 'service-plate', { label: 'Reference service hatch', x: 1400, y: 700, w: 92, h: 66, hp: 78, maxHp: 78 });
  patchObject(state, 'door-control', { label: 'Near-baseline isolation gate', x: 610, y: 760 });
  patchObject(state, 'gravity-control', { label: 'Cross-track mass trim', x: 1330, y: 245 });
  patchObject(state, 'arena-cover', { label: 'Deep-reference carriage', x: 1910, y: 565, w: 165, h: 92, hp: 235, maxHp: 235 });
  patchObject(state, 'arena-conduit', { label: 'Deep-baseline timing trunk', x: 2070, y: 300 });
  for (const [id, x, y] of [['parallax-frame-a', 760, 340], ['parallax-frame-b', 1080, 690], ['parallax-frame-c', 1370, 390]] as const) addObject(state, coverObject(id, 'Long-baseline reference frame', x, y, 72, 150, 'industrial'));
}

function configureCryoReserve(state: SimState) { patchObject(state, 'crate-a', { label: 'Valve service cassette', x: 400, y: 700, w: 110, h: 96, hp: 68, maxHp: 68 }); patchObject(state, 'bulkhead-a', { label: 'LH2 tank saddle', x: 650, y: 290, w: 145, h: 88, hp: 220, maxHp: 220 }); patchObject(state, 'crate-b', { label: 'Insulation repair rack', x: 960, y: 730, w: 110, h: 98, hp: 66, maxHp: 66 }); patchObject(state, 'bulkhead-b', { label: 'Methane reserve saddle', x: 1230, y: 290, w: 150, h: 90, hp: 220, maxHp: 220 }); patchObject(state, 'conduit-a', { label: 'Cryopump power trunk', x: 1100, y: 520, w: 82, h: 72 }); patchObject(state, 'coolant-a', { label: 'Boiloff return header', x: 820, y: 520, w: 58, h: 94 }); patchObject(state, 'service-plate', { label: 'Vacuum-jacket service plate', x: 1390, y: 700, w: 90, h: 68, hp: 72, maxHp: 72 }); patchObject(state, 'door-control', { label: 'Service collar lock', x: 610, y: 760 }); patchObject(state, 'gravity-control', { label: 'Tank-farm mass trim', x: 1310, y: 245 }); patchObject(state, 'arena-cover', { label: 'Umbra transfer manifold', x: 1900, y: 560, w: 150, h: 90, hp: 215, maxHp: 215 }); patchObject(state, 'arena-conduit', { label: 'Reserve pump bus', x: 2070, y: 300 }); addObject(state, coverObject('cryo-tank-a', 'Vacuum-jacket tank A', 760, 390, 125, 78, 'industrial')); addObject(state, coverObject('cryo-tank-b', 'Vacuum-jacket tank B', 1010, 610, 125, 78, 'industrial')); addObject(state, coverObject('cryo-tank-c', 'Vacuum-jacket tank C', 1320, 410, 125, 78, 'industrial')); addObject(state, coverObject('cryo-insulation', 'Brittle insulation screen', 1450, 650, 105, 52, 'light')); }
function configureInterdictionCommand(state: SimState, contract: Contract) { const boss = state.enemies.find(enemy => enemy.role === 'boss'); if (!boss) return; if (contract.deepTarget === 'Transfer Adjudicator Iona Vale') { for (const [id, x, y] of [['transfer-partition-a', 930, 300], ['transfer-partition-b', 1180, 610], ['transfer-partition-c', 1880, 430]] as const) { const partition = coverObject(id, 'Movable custody pressure partition', x, y, 58, 180, 'industrial'); partition.active = false; partition.hp = 125; partition.maxHp = 125; addObject(state, partition); } boss.variant = 'transferAdjudicator'; boss.hp = 700; boss.maxHp = 700; boss.armor = 225; boss.maxArmor = 225; boss.anchored = false; } else if (contract.deepTarget === 'Umbra Systems Marshal Oren Saal') { for (const [id, x, y] of [['siphon-node-a', 980, 390], ['siphon-node-b', 1280, 680], ['boss-siphon-a', 1800, 315], ['boss-siphon-b', 2110, 700]] as const) { const node = systemObject(id, 'Capacitor siphon relay', 'anchorNode', x, y, 48, 48); node.active = false; node.hp = 68; node.maxHp = 68; addObject(state, node); } boss.variant = 'umbraMarshal'; boss.hp = 690; boss.maxHp = 690; boss.armor = 210; boss.maxArmor = 210; boss.anchored = false; } else if (contract.deepTarget === 'Custody Director Mara Teth') { for (const [id, x, y] of [['custody-shutter-a', 1030, 330], ['custody-shutter-b', 1320, 610], ['custody-shutter-c', 1900, 450]] as const) { const shutter = coverObject(id, 'Custody geometry shutter', x, y, 54, 170, 'industrial'); shutter.active = false; shutter.hp = 125; shutter.maxHp = 125; addObject(state, shutter); } for (const [id, x, y] of [['custody-reference-a', 1740, 280], ['custody-reference-b', 1980, 510], ['custody-reference-c', 2150, 735]] as const) { const node = systemObject(id, 'Custody reference relay', 'anchorNode', x, y, 50, 50); node.active = true; node.exposed = true; node.hp = 72; node.maxHp = 72; addObject(state, node); } boss.variant = 'custodyDirector'; boss.hp = 710; boss.maxHp = 710; boss.armor = 215; boss.maxArmor = 215; boss.anchored = false; } }

function objectivePosition(contract: Contract, index: number) {
  const positionsByLocation: Partial<Record<Contract['location'], Array<{ x: number; y: number }>>> = {
    'damaged-vessel': [{ x: 560, y: 255 }, { x: 1010, y: 800 }, { x: 1360, y: 690 }],
    'asteroid-refinery': [{ x: 530, y: 760 }, { x: 930, y: 245 }, { x: 1350, y: 760 }],
    'spin-habitat': [{ x: 465, y: 760 }, { x: 930, y: 260 }, { x: 1360, y: 700 }],
    'jovian-harvester': [{ x: 430, y: 285 }, { x: 930, y: 760 }, { x: 1370, y: 270 }],
    'ice-mine': [{ x: 390, y: 530 }, { x: 900, y: 350 }, { x: 1360, y: 690 }],
    'solar-yard': [{ x: 500, y: 270 }, { x: 980, y: 760 }, { x: 1380, y: 330 }],
    'lattice-annex': [{ x: 480, y: 720 }, { x: 990, y: 270 }, { x: 1420, y: 710 }],
    'momentum-exchange': [{ x: 520, y: 710 }, { x: 980, y: 280 }, { x: 1390, y: 720 }],
    'cryo-reserve': [{ x: 500, y: 280 }, { x: 980, y: 760 }, { x: 1390, y: 300 }],
    'parallax-array': [{ x: 500, y: 300 }, { x: 980, y: 760 }, { x: 1400, y: 300 }],
  };
  const positions = positionsByLocation[contract.location] ?? [{ x: 540, y: 270 }, { x: 1040, y: 785 }, { x: 1375, y: 300 }];
  return positions[index] ?? positions[positions.length - 1];
}

function objectiveNames(contract: Contract) {
  const authored: Partial<Record<Contract['location'], { pressure: string; grid: [string, string]; gravity: [string, string]; machinery: [string, string]; boarding: [string, string]; salvage: [string, string, string]; reference?: [string, string, string] }>> = {
    'spin-habitat': { pressure: 'Rim pressure manifold', grid: ['Rim spin-bus isolator', 'Spoke spin-bus isolator'], gravity: ['Rim gravity trim', 'Spoke gravity trim'], machinery: ['Bearing-control package', 'Attitude-flywheel package'], boarding: ['Spoke pressure interlock', 'Axis pressure lock'], salvage: ['Rim recovery cache', 'Spoke recovery cache', 'Axis recovery cache'] },
    'jovian-harvester': { pressure: 'Storm relief manifold', grid: ['Skimmer bus isolator', 'Compressor bus isolator'], gravity: ['Maintenance-deck mass trim', 'Compressor-crown mass trim'], machinery: ['Skimmer compressor package', 'Separator package'], boarding: ['Inner storm lock', 'Outer maintenance lock'], salvage: ['Intake recovery package', 'Separator recovery package', 'Compressor recovery package'] },
    'ice-mine': { pressure: 'Bore pressure manifold', grid: ['Upper thaw-grid isolator', 'Deep thaw-grid isolator'], gravity: ['Haulage gravity trim', 'Deep-bore gravity trim'], machinery: ['Cryobore cutter package', 'Volatile separator package'], boarding: ['Access-bore lock', 'Deep-tunnel lock'], salvage: ['Access-bore cache', 'Extraction-tunnel cache', 'Subglacial vault cache'] },
    'solar-yard': { pressure: 'Radiator pressure manifold', grid: ['Shade-side solar isolator', 'Sunward solar isolator'], gravity: ['Shade-gantry gravity trim', 'Fabrication-spine gravity trim'], machinery: ['Mirror actuator package', 'Printer spindle package'], boarding: ['Shade-side pressure lock', 'Sunward pressure lock'], salvage: ['Shade-gantry package', 'Fabrication-spine package', 'Sunward yard package'] },
    'lattice-annex': { pressure: 'Khepri sample-vault manifold', grid: ['Cold-ring archive isolator', 'Sample-vault archive isolator'], gravity: ['Metrology-ring mass trim', 'Reference-gallery mass trim'], machinery: ['Precision carriage package', 'Cryogenic reference package'], boarding: ['Reference gallery interlock', 'Sample vault pressure lock'], salvage: ['Cold-ring metrology archive', 'Reference-gallery archive', 'Sample-vault custody record'] },
    'momentum-exchange': { pressure: 'Transfer pressure manifold', grid: ['Inbound bus isolator', 'Outbound bus isolator'], gravity: ['Inbound mass trim', 'Outbound mass trim'], machinery: ['Capture flywheel package', 'Transfer cradle package'], boarding: ['Inbound capture collar', 'Outbound pressure lock'], salvage: ['Inbound ledger core', 'Transfer timing core', 'Countermass reference core'] },
    'cryo-reserve': { pressure: 'Vacuum-jacket manifold', grid: ['Cryopump isolator A', 'Cryopump isolator B'], gravity: ['Service-collar mass trim', 'Tank-farm mass trim'], machinery: ['Cryopump package', 'Boiloff separator package'], boarding: ['Service collar lock', 'Tank-farm pressure lock'], salvage: ['Valve archive', 'Propellant ledger core', 'Umbra pump controller'] },
    'parallax-array': { pressure: 'Array pressure manifold', grid: ['Near-baseline timing isolator', 'Deep-reference timing isolator'], gravity: ['Near-baseline mass trim', 'Cross-track mass trim'], machinery: ['Inertial standard package', 'Interferometer package'], boarding: ['Near-baseline isolation gate', 'Deep-reference pressure lock'], salvage: ['Reference ledger A', 'Reference ledger B', 'Reference ledger C'], reference: ['Near-baseline reference pylon', 'Cross-track reference pylon', 'Deep-baseline reference pylon'] },
  };
  return authored[contract.location] ?? { pressure: 'Emergency pressure manifold', grid: ['Grid isolator A', 'Grid isolator B'], gravity: ['Deck gravity trim', 'Transfer gravity trim'], machinery: ['Machinery package A', 'Machinery package B'], boarding: ['Pressure interlock A', 'Pressure interlock B'], salvage: ['Recovery package A', 'Recovery package B', 'Recovery package C'] };
}

function configureObjectiveObjects(state: SimState, contract: Contract) {
  const names = objectiveNames(contract);
  const addAt = (id: string, label: string, kind: CombatObject['kind'], index: number) => {
    const pos = objectivePosition(contract, index);
    addObject(state, systemObject(id, label, kind, pos.x, pos.y));
  };

  if (contract.objectiveMode === 'pressure-recovery') {
    const pos = objectivePosition(contract, 2);
    addObject(state, systemObject('service-seal', names.pressure, 'sealControl', pos.x, pos.y));
    const breach = state.breaches.find(item => item.id === 'service-breach');
    const sector = state.sectors.find(item => item.id === 'B');
    if (breach && sector) {
      breach.active = true;
      breach.sealed = false;
      breach.strength = Math.min(breach.strength, 650);
      breach.radius = Math.min(breach.radius, 480);
      sector.pressure = Math.min(sector.pressure, 0.34);
      sector.targetPressure = 0;
      sector.pressureState = 'leaking';
    }
  } else if (contract.objectiveMode === 'grid-isolation') {
    addAt('grid-isolator-a', names.grid[0], 'powerControl', 0);
    addAt('grid-isolator-b', names.grid[1], 'powerControl', 2);
  } else if (contract.objectiveMode === 'gravity-stabilization') {
    addAt('gravity-control-a', names.gravity[0], 'gravityControl', 0);
    patchObject(state, 'gravity-control', { id: 'gravity-control-b', label: names.gravity[1], exposed: false });
  } else if (contract.objectiveMode === 'machinery-recovery') {
    addAt('salvage-node-a', names.machinery[0], 'salvageNode', 0);
    addAt('salvage-node-b', names.machinery[1], 'salvageNode', 2);
  } else if (contract.objectiveMode === 'emergency-boarding') {
    patchObject(state, 'door-control', { label: names.boarding[0], exposed: false });
    addAt('boarding-lock', names.boarding[1], 'doorControl', 2);
  } else if (contract.objectiveMode === 'momentum-capture') { addAt('capture-drum-a', 'Inbound capture drum', 'gravityControl', 0); addAt('capture-drum-b', 'Outbound capture drum', 'gravityControl', 2); }
  else if (contract.objectiveMode === 'thermal-routing') { addAt('purge-valve-a', 'LH2 purge valve', 'doorControl', 0); addAt('purge-valve-b', 'Methane purge valve', 'doorControl', 2); }
  else if (contract.objectiveMode === 'reference-alignment') { const labels = names.reference ?? ['Reference pylon A', 'Reference pylon B', 'Reference pylon C']; addAt('reference-node-a', labels[0], 'gravityControl', 0); addAt('reference-node-b', labels[1], 'gravityControl', 1); addAt('reference-node-c', labels[2], 'gravityControl', 2); }
  else {
    addAt('salvage-node-a', names.salvage[0], 'salvageNode', 0);
    addAt('salvage-node-b', names.salvage[1], 'salvageNode', 1);
    addAt('salvage-node-c', names.salvage[2], 'salvageNode', 2);
  }
}

function configureLatticeAnnex(state: SimState) {
  patchObject(state, 'crate-a', { label: 'Reference sample trolley', x: 470, y: 280, w: 120, h: 92, hp: 74, maxHp: 74 });
  patchObject(state, 'bulkhead-a', { label: 'Cold metrology plinth', x: 720, y: 650, w: 150, h: 82 });
  patchObject(state, 'crate-b', { label: 'Survey archive rack', x: 980, y: 330, w: 118, h: 110, hp: 72, maxHp: 72 });
  patchObject(state, 'bulkhead-b', { label: 'Reference carriage housing', x: 1250, y: 610, w: 150, h: 92, hp: 220, maxHp: 220 });
  patchObject(state, 'conduit-a', { label: 'Metrology timing bus', x: 1130, y: 255, w: 82, h: 72 });
  patchObject(state, 'coolant-a', { label: 'Cryogenic reference loop', x: 850, y: 720, w: 54, h: 92 });
  patchObject(state, 'door-control', { label: 'Reference gallery interlock', x: 690, y: 770 });
  patchObject(state, 'gravity-control', { label: 'Calibration mass trim', x: 1320, y: 260 });
  patchObject(state, 'arena-cover', { label: 'Sample vault carriage', x: 1920, y: 650, w: 145, h: 86, hp: 215, maxHp: 215 });
  patchObject(state, 'arena-conduit', { label: 'Vault timing trunk', x: 1830, y: 285, w: 88, h: 74 });
  addObject(state, coverObject('khepri-plinth-a', 'Reference plinth A', 610, 470, 116, 64, 'industrial'));
  addObject(state, coverObject('khepri-plinth-b', 'Reference plinth B', 1030, 690, 116, 64, 'industrial'));
  addObject(state, coverObject('khepri-plinth-c', 'Reference plinth C', 1450, 390, 116, 64, 'industrial'));
  for (const [id, x, y] of [['lattice-shutter-a', 1680, 300], ['lattice-shutter-b', 2030, 690]] as const) { const shutter = coverObject(id, 'Khepri calibration shutter', x, y, 58, 180, 'industrial'); shutter.active = false; shutter.hp = 150; shutter.maxHp = 150; addObject(state, shutter); }
  for (const [id, x, y] of [['lattice-reference-a', 1740, 250], ['lattice-reference-b', 1970, 500], ['lattice-reference-c', 2160, 745]] as const) { const node = systemObject(id, 'Metrology reference pylon', 'anchorNode', x, y, 54, 54); node.active = false; node.hp = 82; node.maxHp = 82; addObject(state, node); }
}

function configureStoryFinale(state: SimState, contract: Contract) {
  const replayTarget = contract.directiveTargetClass === 'command-target' ? contract.deepTarget : '';
  if ((!contract.storyFinale || !contract.storyArc) && !['Pressure Broker Naima Rusk', 'Bond Arbiter Edrin Shaw', 'PRISM-6 Forge Chorus'].includes(replayTarget)) return;
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (!boss) return;

  if (contract.storyArc === 'vanishing-wake' || replayTarget === 'Pressure Broker Naima Rusk') {
    boss.variant = 'pressureBroker'; boss.hp = 650; boss.maxHp = 650; boss.armor = 185; boss.maxArmor = 185;
    const enforcer = state.enemies.find(enemy => enemy.id === 1); if (enforcer) enforcer.label = 'Rusk Recovery Enforcer';
    const tech = state.enemies.find(enemy => enemy.id === 3); if (tech) { tech.role = 'technician'; tech.label = 'Illegal Manifold Tech'; }
    for (const [id, x, y] of [['story-pressure-shutter-a', 1780, 330], ['story-pressure-shutter-b', 2040, 640]] as const) { const shutter = coverObject(id, 'Broker pressure shutter', x, y, 54, 170, 'industrial'); shutter.active = false; shutter.hp = 135; shutter.maxHp = 135; addObject(state, shutter); }
  } else if (contract.storyArc === 'terms-of-survival' || replayTarget === 'Bond Arbiter Edrin Shaw') {
    boss.variant = 'bondArbiter'; boss.hp = 720; boss.maxHp = 720; boss.armor = 350; boss.maxArmor = 350;
    const guard = state.enemies.find(enemy => enemy.id === 1); if (guard) guard.label = 'Arbitration Palisade';
    const tech = state.enemies.find(enemy => enemy.id === 3); if (tech) { tech.role = 'technician'; tech.label = 'Archive Seal Officer'; }
  } else {
    boss.variant = 'forgeChorus'; boss.hp = 620; boss.maxHp = 620; boss.armor = 240; boss.maxArmor = 240; boss.x = 2060; boss.y = 520;
    const drone = state.enemies.find(enemy => enemy.id === 1); if (drone) { drone.variant = 'maintenanceDrone'; drone.label = 'PRISM Process Drone'; }
    const relay = state.enemies.find(enemy => enemy.id === 6); if (relay) { relay.variant = 'gravityDrone'; relay.label = 'PRISM Phase Relay'; }
  }
}

function configureCampaignFinale(state: SimState, contract: Contract) {
  const directiveReplay = contract.directiveTargetClass === 'command-target' && contract.deepTarget === 'Survey Custodian Veyra Senn';
  if ((!contract.campaignFinale || contract.campaignChapter !== 'black-lattice') && !directiveReplay) return;
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (!boss) return;
  boss.variant = 'latticeCustodian';
  boss.hp = 790;
  boss.maxHp = 790;
  boss.armor = 285;
  boss.maxArmor = 285;
  boss.anchored = false;
  boss.x = 2020;
  boss.y = 520;
  for (const node of state.objects.filter(object => object.id.startsWith('lattice-reference'))) { node.active = true; node.exposed = false; node.hp = node.maxHp; }
  const tech = state.enemies.find(enemy => enemy.id === 3); if (tech) { tech.role = 'technician'; tech.label = 'Khepri Reference Technician'; }
  const elite = state.enemies.find(enemy => enemy.id === 6); if (elite) { elite.role = 'elite'; elite.variant = 'meleeExosuit'; elite.label = 'Vault Recovery Exosuit'; elite.hp = 195; elite.maxHp = 195; elite.armor = 150; elite.maxArmor = 150; }
}

function configureParallaxFinale(state: SimState, contract: Contract) {
  if (contract.campaignChapter !== 'parallax-debt' || !contract.campaignFinale) return;
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (!boss) return;
  boss.variant = 'baselineKeeper'; boss.hp = 860; boss.maxHp = 860; boss.armor = 300; boss.maxArmor = 300; boss.anchored = false; boss.x = 2030; boss.y = 520;
  for (const [id, x, y] of [['baseline-anchor-a', 1770, 300], ['baseline-anchor-b', 2040, 720]] as const) { const node = systemObject(id, 'Live baseline servo', 'anchorNode', x, y, 52, 52); node.active = true; node.exposed = true; node.hp = 82; node.maxHp = 82; addObject(state, node); }
}

function configureEscalationFinale(state: SimState, contract: Contract) {
  if (!contract.escalationFinale) return;
  const boss = state.enemies.find(enemy => enemy.role === 'boss');
  if (!boss) return;
  boss.variant = 'cascadeCustodian';
  boss.hp = 760;
  boss.maxHp = 760;
  boss.armor = 270;
  boss.maxArmor = 270;
  boss.anchored = false;
  const tech = state.enemies.find(enemy => enemy.id === 3);
  if (tech) { tech.role = 'technician'; tech.label = 'Cascade Grid Technician'; }
  const elite = state.enemies.find(enemy => enemy.id === 6);
  if (elite) { elite.role = 'elite'; elite.label = 'Failure-State Marshal'; }
  addObject(state, coverObject('cascade-baffle-a', 'Emergency bus baffle A', 1770, 330, 118, 48, 'industrial'));
  addObject(state, coverObject('cascade-baffle-b', 'Emergency bus baffle B', 2020, 650, 118, 48, 'industrial'));
}

function configureMegastructureStage(state: SimState, contract: Contract) {
  if (!contract.megastructure || !contract.megastructureStage) return;
  const positions = [{ x: 610, y: 790 }, { x: 960, y: 250 }, { x: 1320, y: 760 }, { x: 1210, y: 270 }];
  const position = positions[(contract.megastructureStage - 1) % positions.length];
  addObject(state, systemObject('mega-optional-cache', contract.megastructureOptionalLabel ?? 'Optional derelict archive', 'salvageNode', position.x, position.y));
  if (contract.megastructureStage === 2) {
    const elite = state.enemies.find(enemy => enemy.id === 6);
    if (elite) {
      elite.active = true;
      elite.dead = false;
      elite.role = 'elite';
      elite.variant = 'meleeExosuit';
      elite.label = 'Derelict Security Exosuit';
      elite.hp = 190;
      elite.maxHp = 190;
      elite.armor = 145;
      elite.maxArmor = 145;
    }
  }
}

export function applyEncounterLayout(state: SimState, contract: Contract) {
  if (contract.location === 'damaged-vessel') configureDamagedVessel(state);
  else if (contract.location === 'asteroid-refinery') configureRefinery(state);
  else if (contract.location === 'spin-habitat') configureSpinHabitat(state);
  else if (contract.location === 'jovian-harvester') configureJovianHarvester(state);
  else if (contract.location === 'ice-mine') configureIceMine(state);
  else if (contract.location === 'solar-yard') configureSolarYard(state);
  else if (contract.location === 'lattice-annex') configureLatticeAnnex(state);
  else if (contract.location === 'momentum-exchange') configureMomentumExchange(state);
  else if (contract.location === 'cryo-reserve') configureCryoReserve(state);
  else if (contract.location === 'parallax-array') configureParallaxArray(state);

  configureInterdictionCommand(state, contract);
  configureObjectiveObjects(state, contract);
  configureMegastructureStage(state, contract);
  configureStoryFinale(state, contract);
  configureCampaignFinale(state, contract);
  configureParallaxFinale(state, contract);
  configureEscalationFinale(state, contract);
  reserveNavigationLanes(state, contract.location);
}

function exposedCount(state: SimState, ids: string[]) {
  return ids.reduce((count, id) => count + (state.objects.find(object => object.id === id)?.exposed ? 1 : 0), 0);
}

export function getNextMissionObjectiveTarget(state: SimState, contract: Contract) {
  if (contract.objectiveMode === 'pressure-recovery') {
    const seal = state.objects.find(object => object.id === 'service-seal');
    const breach = state.breaches.find(item => item.id === 'service-breach');
    if (seal && (!seal.exposed || breach?.active)) return seal;
    return null;
  }

  const ids = contract.objectiveMode === 'grid-isolation'
    ? ['grid-isolator-a', 'grid-isolator-b']
    : contract.objectiveMode === 'gravity-stabilization'
      ? ['gravity-control-a', 'gravity-control-b']
      : contract.objectiveMode === 'machinery-recovery'
        ? ['salvage-node-a', 'salvage-node-b']
        : contract.objectiveMode === 'emergency-boarding'
          ? ['door-control', 'boarding-lock']
          : contract.objectiveMode === 'momentum-capture'
            ? ['capture-drum-a', 'capture-drum-b']
            : contract.objectiveMode === 'thermal-routing'
              ? ['purge-valve-a', 'purge-valve-b']
              : contract.objectiveMode === 'reference-alignment'
                ? ['reference-node-a', 'reference-node-b', 'reference-node-c']
                : ['salvage-node-a', 'salvage-node-b', 'salvage-node-c'];

  let target: CombatObject | null = null;
  let bestDistance = Infinity;
  for (const id of ids) {
    const object = state.objects.find(item => item.id === id);
    if (!object || !object.active || object.exposed) continue;
    const distance = Math.hypot(object.x + object.w / 2 - state.player.x, object.y + object.h / 2 - state.player.y);
    if (distance < bestDistance) { target = object; bestDistance = distance; }
  }
  return target;
}

export function getMissionObjectiveStatus(state: SimState, contract: Contract): MissionObjectiveStatus {
  const mode: ObjectiveMode = contract.objectiveMode;

  if (mode === 'pressure-recovery') {
    const seal = state.objects.find(object => object.id === 'service-seal');
    const breach = state.breaches.find(item => item.id === 'service-breach');
    const sector = state.sectors.find(item => item.id === 'B');
    const sealed = !!seal?.exposed;
    const ruptureOpen = !!breach?.active;
    const recovered = sealed && !ruptureOpen && (sector?.pressure ?? 0) >= 0.46;
    const progress = Number(sealed) + Number(recovered);
    return {
      label: 'Pressure recovery',
      detail: !sealed ? 'Reach the emergency pressure manifold' : ruptureOpen ? 'Service rupture reopened — re-seal the manifold' : !recovered ? 'Hold while atmosphere recovers above 46%' : 'Pressure shell stabilized',
      progress,
      required: 2,
      complete: progress >= 2,
    };
  }

  if (mode === 'grid-isolation') {
    const progress = exposedCount(state, ['grid-isolator-a', 'grid-isolator-b']);
    return {
      label: 'Grid isolation',
      detail: progress < 2 ? 'Isolate both live grid branches' : 'Damaged grid isolated',
      progress,
      required: 2,
      complete: progress >= 2,
    };
  }

  if (mode === 'gravity-stabilization') {
    const progress = exposedCount(state, ['gravity-control-a', 'gravity-control-b']);
    return {
      label: 'Gravity stabilization',
      detail: progress < 2 ? 'Calibrate both gravity trims' : 'Gravity trims synchronized',
      progress,
      required: 2,
      complete: progress >= 2,
    };
  }

  if (mode === 'machinery-recovery') {
    const progress = exposedCount(state, ['salvage-node-a', 'salvage-node-b']);
    return {
      label: 'Machinery recovery',
      detail: progress < 2 ? 'Tag both intact machinery packages' : 'Recovery packages tagged',
      progress,
      required: 2,
      complete: progress >= 2,
    };
  }

  if (mode === 'emergency-boarding') { const progress = exposedCount(state, ['door-control', 'boarding-lock']); return { label: 'Pressure-gate boarding', detail: progress < 2 ? 'Cycle both pressure interlocks' : 'Cargo route pressure-gated', progress, required: 2, complete: progress >= 2 }; }
  if (mode === 'momentum-capture') { const progress = exposedCount(state, ['capture-drum-a', 'capture-drum-b']); return { label: 'Momentum capture', detail: progress < 2 ? 'Load both counter-momentum references' : 'Capture drums synchronized', progress, required: 2, complete: progress >= 2 }; }
  if (mode === 'thermal-routing') { const progress = exposedCount(state, ['purge-valve-a', 'purge-valve-b']); return { label: 'Thermal routing', detail: progress < 2 ? 'Route both cryogenic purge branches' : 'Boiloff routed clear of service gallery', progress, required: 2, complete: progress >= 2 }; }
  if (mode === 'reference-alignment') { const progress = exposedCount(state, ['reference-node-a', 'reference-node-b', 'reference-node-c']); return { label: 'Reference alignment', detail: progress < 3 ? 'Align all three physical reference pylons' : 'Long-baseline references converged', progress, required: 3, complete: progress >= 3 }; }

  const progress = exposedCount(state, ['salvage-node-a', 'salvage-node-b', 'salvage-node-c']);
  return {
    label: 'Deep salvage',
    detail: progress < 3 ? 'Tag all three recovery packages' : 'Recovery manifest complete',
    progress,
    required: 3,
    complete: progress >= 3,
  };
}
