import { protocolDefinition, protocolRewardValue, type EnemyProtocolId } from './eliteProtocols';
import type { CombatObject, Enemy, SimState, Vec2 } from './sim';
import { mutationHazardCadenceScale } from './t9Mutations';

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function enemyHasProtocol(enemy: Enemy, id: EnemyProtocolId) { return enemy.protocols.some(protocol => protocol.id === id); }
export function protocolRewardForEnemy(enemy: Enemy) { return enemy.protocols.reduce((total, protocol) => total + protocolRewardValue(protocol), 0); }
export function protocolAnchorsEnemy(enemy: Enemy) { return enemyHasProtocol(enemy, 'gravityAnchor') && enemy.statuses.disrupted <= 0; }
export function protocolVacuumImmune(enemy: Enemy) { return enemyHasProtocol(enemy, 'vacuumAdapted'); }
export function protocolIgnoresPressureRetreat(enemy: Enemy) { return enemyHasProtocol(enemy, 'pressureHunter') || enemyHasProtocol(enemy, 'vacuumAdapted'); }
export function protocolCarriesObjective(enemy: Enemy) { return enemyHasProtocol(enemy, 'salvageInterdictor'); }
export function protocolAimPenalty(enemy: Enemy) { return enemyHasProtocol(enemy, 'sensorGhost') && enemy.statuses.marked <= 0 && enemy.statuses.disrupted <= 0 ? 0.3 : 0; }
export function protocolMobilityScale(enemy: Enemy, pressure: number) { return pressure < 0.5 && protocolIgnoresPressureRetreat(enemy) ? 1.18 : 1; }

function pushEvent(state: SimState, text: string, duration = 1.7) { state.eventText = text; state.eventT = duration; }
function pulse(state: SimState, enemy: Enemy, text: string) {
  enemy.protocolPulse = 1.2;
  const effect = state.effects.find(item => !item.active);
  if (effect) Object.assign(effect, { active: true, x: enemy.x, y: enemy.y, kind: 'pulse', life: 0.45, maxLife: 0.45, radius: 58 });
  pushEvent(state, text);
}
function plantHazard(state: SimState, x: number, y: number, kind: 'shockGrid' | 'gravityWell' | 'coolantJet', life: number) {
  const hazard = state.hazards.find(item => !item.active);
  if (!hazard) return false;
  Object.assign(hazard, { active: true, x, y, radius: kind === 'gravityWell' ? 185 : kind === 'coolantJet' ? 150 : 120, life, kind, owner: kind === 'coolantJet' ? 'environment' : 'enemy' });
  return true;
}
function activateBarrier(state: SimState, enemy: Enemy, mirrored = false) {
  const barrier = state.objects.find(object => object.id.startsWith('protocol-shutter') && !object.active && object.hp > 0);
  if (!barrier) return false;
  barrier.active = true;
  barrier.x = clamp(enemy.x + enemy.strafeSign * (mirrored ? -125 : 125), 830, 1370);
  barrier.y = clamp(enemy.y + (mirrored ? -70 : 35), 225, 820);
  return true;
}
function breachNearestCover(state: SimState, enemy: Enemy) {
  const target = state.objects.filter(object => object.active && object.kind === 'cover' && object.destructible && object.hp > 0 && !object.id.startsWith('protocol-shutter')).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 720) return false;
  target.hp = 0;
  target.active = false;
  if (target.id === 'meridian-pressure-door') { const link = state.links.find(item => item.id === 'door-ab'); if (link) link.open = true; }
  return true;
}
function repairHardware(state: SimState, enemy: Enemy) {
  const target = state.objects.filter(object => !object.id.startsWith('enemy-tether') && (object.kind === 'conduit' || object.kind === 'anchorNode') && object.hp > 0 && (object.hp < object.maxHp || !object.active)).sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
  if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 520) return false;
  target.active = true;
  target.hp = Math.min(target.maxHp, target.hp + 34);
  if (target.kind === 'conduit' && target.hp > target.maxHp * 0.7) target.exposed = false;
  return true;
}
function deployDrone(state: SimState, enemy: Enemy) {
  const drone = state.enemies.find(item => (item.id === 9 || item.id === 10) && !item.active && !item.dead);
  if (!drone) return false;
  drone.active = true;
  drone.x = clamp(enemy.x + enemy.strafeSign * 65, 120, 2200);
  drone.y = clamp(enemy.y + 55, 190, 910);
  drone.fireCooldown = 0.8;
  drone.hazardCooldown = 1.8;
  return true;
}
function addEnemyProjectile(state: SimState, enemy: Enemy, direction: Vec2, speed: number, damage: number) {
  const projectile = state.projectiles.find(item => !item.active);
  if (!projectile) return;
  Object.assign(projectile, { active: true, x: enemy.x + direction.x * 26, y: enemy.y + direction.y * 26, vx: direction.x * speed, vy: direction.y * speed, radius: 6, damage, life: 2.8, owner: 'enemy', weapon: 'enemy', penetration: 0, armorDamage: 0.5, healthMultiplier: 1, knockback: 0.05, lastObjectId: null, lastObjectT: 0 });
}
function fireProtocolFan(state: SimState, enemy: Enemy, count: number, speed: number, damage: number, spacing: number) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index - (count - 1) / 2) * spacing;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    addEnemyProjectile(state, enemy, { x: enemy.telegraphAim.x * c - enemy.telegraphAim.y * s, y: enemy.telegraphAim.x * s + enemy.telegraphAim.y * c }, speed, damage);
  }
}
function processWindup(state: SimState, enemy: Enemy, dt: number) {
  const active = enemy.protocols.find(protocol => protocol.windup > 0);
  if (!active) return false;
  active.windup = Math.max(0, active.windup - dt);
  enemy.telegraph = active.windup;
  if (active.windup > 0) return true;
  if (active.id === 'thermalOverrun') {
    fireProtocolFan(state, enemy, active.enhanced ? 5 : 3, 500, 14, 0.085);
    enemy.statuses.stagger = Math.max(enemy.statuses.stagger, 0.52);
    if (active.enhanced) plantHazard(state, enemy.x - enemy.telegraphAim.x * 80, enemy.y - enemy.telegraphAim.y * 80, 'coolantJet', 3.4);
  } else if (active.id === 'penetratorVolley') {
    fireProtocolFan(state, enemy, active.enhanced ? 5 : 3, 640, 15, 0.065);
    if (active.enhanced) plantHazard(state, state.player.x + 90, state.player.y, 'shockGrid', 3.2);
  }
  enemy.telegraph = 0;
  return true;
}

export function stepEnemyProtocols(state: SimState, enemy: Enemy, dt: number, distance: number, toward: Vec2, pressure: number) {
  enemy.protocolPulse = Math.max(0, enemy.protocolPulse - dt);
  const mutationCadence = mutationHazardCadenceScale(enemy);
  for (const protocol of enemy.protocols) protocol.cooldown = Math.max(0, protocol.cooldown - dt * mutationCadence);
  if (processWindup(state, enemy, dt) || enemy.statuses.disrupted > 0) return;

  for (const protocol of enemy.protocols) {
    if (protocol.cooldown > 0) continue;
    const definition = protocolDefinition(protocol.id);
    let acted = false;
    if (protocol.id === 'reactivePlating' && enemy.armor > 0 && enemy.armor < enemy.maxArmor) {
      enemy.armor = Math.min(enemy.maxArmor, enemy.armor + 16);
      if (protocol.enhanced) { const ally = state.enemies.find(item => item.active && !item.dead && item.id !== enemy.id && item.armor > 0 && item.armor < item.maxArmor && Math.hypot(item.x - enemy.x, item.y - enemy.y) < 300); if (ally) ally.armor = Math.min(ally.maxArmor, ally.armor + 10); }
      pulse(state, enemy, `REACTIVE PLATING${protocol.enhanced ? ' // ALLY PATCH' : ''} // ARMOR MESH RE-KNITTING`); acted = true;
    } else if (protocol.id === 'pressureHunter' && pressure < 0.5) { pulse(state, enemy, 'PRESSURE HUNTER // LOW-PRESSURE PURSUIT LOCKED'); acted = true; }
    else if (protocol.id === 'vacuumAdapted' && pressure < 0.2) { pulse(state, enemy, 'VACUUM-ADAPTED FRAME // DECOMPRESSION MOBILITY MAINTAINED'); acted = true; }
    else if (protocol.id === 'breachmaker') { const first = breachNearestCover(state, enemy); const second = protocol.enhanced ? breachNearestCover(state, enemy) : false; if (first || second) { pulse(state, enemy, `BREACHMAKER // ${second ? 'DUAL ' : ''}DEMOLITION LANE OPENED`); acted = true; } }
    else if (protocol.id === 'magneticLock') { plantHazard(state, state.player.x + state.player.vx * 0.45, state.player.y + state.player.vy * 0.45, 'gravityWell', 4.2); if (protocol.enhanced) plantHazard(state, state.player.x - 145, state.player.y + 70, 'gravityWell', 3.8); pulse(state, enemy, `MAGNETIC LOCK // ${protocol.enhanced ? 'PAIRED ' : ''}MASS WELL PROJECTED`); acted = true; }
    else if (protocol.id === 'gravityAnchor') { if (protocol.enhanced && distance < 360) plantHazard(state, enemy.x, enemy.y, 'gravityWell', 3.2); pulse(state, enemy, `GRAVITY ANCHOR // VECTOR RESISTANCE ONLINE${protocol.enhanced ? ' // LOCAL WELL' : ''}`); acted = true; }
    else if (protocol.id === 'countermassMobility') { const sideways = { x: -toward.y * enemy.strafeSign, y: toward.x * enemy.strafeSign }; enemy.vx += sideways.x * 320; enemy.vy += sideways.y * 320; if (protocol.enhanced) plantHazard(state, enemy.x - sideways.x * 70, enemy.y - sideways.y * 70, 'gravityWell', 2.4); pulse(state, enemy, `COUNTERMASS MOBILITY // LATERAL VECTOR BURST${protocol.enhanced ? ' // WAKE WELL' : ''}`); acted = true; }
    else if (protocol.id === 'arcConduit') { plantHazard(state, state.player.x + state.player.vx * 0.25, state.player.y + state.player.vy * 0.25, 'shockGrid', 4.4); if (protocol.enhanced) plantHazard(state, state.player.x + 140, state.player.y - 80, 'shockGrid', 3.6); pulse(state, enemy, `ARC CONDUIT // ${protocol.enhanced ? 'DUAL ' : ''}GRID PATH ENERGIZED`); acted = true; }
    else if (protocol.id === 'repairMesh') { const hardware = repairHardware(state, enemy); const repairedArmor = !hardware && enemy.armor > 0 && enemy.armor < enemy.maxArmor; if (repairedArmor) enemy.armor = Math.min(enemy.maxArmor, enemy.armor + 13); if (protocol.enhanced) { const ally = state.enemies.find(item => item.active && !item.dead && item.id !== enemy.id && item.armor > 0 && item.armor < item.maxArmor && Math.hypot(item.x - enemy.x, item.y - enemy.y) < 340); if (ally) ally.armor = Math.min(ally.maxArmor, ally.armor + 11); } if (hardware || repairedArmor || protocol.enhanced) { pulse(state, enemy, `REPAIR MESH // FIELD RECONSTRUCTION${protocol.enhanced ? ' // ALLY LINK' : ''}`); acted = true; } }
    else if (protocol.id === 'droneEscort') { const first = deployDrone(state, enemy); const second = protocol.enhanced ? deployDrone(state, enemy) : false; if (first || second) { pulse(state, enemy, `DRONE ESCORT // ${second ? 'TWO ' : ''}SUPPORT UNIT${second ? 'S' : ''} RELEASED`); acted = true; } }
    else if (protocol.id === 'emergencyShutters') { const first = activateBarrier(state, enemy); const second = protocol.enhanced ? activateBarrier(state, enemy, true) : false; if (first || second) { pulse(state, enemy, `EMERGENCY SHUTTERS // ${second ? 'TWO ' : ''}FIRING LANE${second ? 'S' : ''} CLOSED`); acted = true; } }
    else if (protocol.id === 'sensorGhost') { pulse(state, enemy, enemy.statuses.marked > 0 ? 'SENSOR GHOST // TRUE RETURN RESOLVED BY MARK' : 'SENSOR GHOST // ASSISTED RETURN SPLIT // MARK TO RESOLVE'); acted = true; }
    else if (protocol.id === 'signalJammer' && distance < 380) { state.player.disrupted = Math.max(state.player.disrupted, 0.85); if (protocol.enhanced) state.player.capacitor = Math.max(0, state.player.capacitor - 8); pulse(state, enemy, `SIGNAL JAMMER // CONTROL BUS NOISE${protocol.enhanced ? ' // CAPACITOR DESYNC' : ''}`); acted = true; }
    else if ((protocol.id === 'thermalOverrun' || protocol.id === 'penetratorVolley') && enemy.telegraph <= 0) { protocol.windup = protocol.id === 'thermalOverrun' ? 1.05 : 1.2; enemy.telegraph = protocol.windup; enemy.telegraphAim = toward; pulse(state, enemy, protocol.id === 'thermalOverrun' ? `THERMAL OVERRUN // REDLINE BURST CHARGING${protocol.enhanced ? ' // COOLANT DUMP ARMED' : ''}` : `PENETRATOR VOLLEY // STRAIGHT-LINE SOLUTION${protocol.enhanced ? ' // CROSS-FAN' : ''}`); acted = true; }
    else if (protocol.id === 'suppressionCoordinator') { let coordinated = 0; for (const ally of state.enemies) { if (!ally.active || ally.dead || ally.id === enemy.id || Math.hypot(ally.x - enemy.x, ally.y - enemy.y) > 540) continue; if (ally.role === 'suppressor' || ally.role === 'assault') { ally.fireCooldown = Math.min(ally.fireCooldown, 0.08); ally.burst = Math.max(ally.burst, 1); coordinated += 1; } if (protocol.enhanced && ally.role === 'technician') ally.hazardCooldown = Math.min(ally.hazardCooldown, 0.1); } if (coordinated > 0) { pulse(state, enemy, `SUPPRESSION COORDINATOR // ${coordinated} FIRETEAM VECTOR${protocol.enhanced ? ' // TECH BUS SYNC' : ''}`); acted = true; } }
    else if (protocol.id === 'salvageInterdictor' && !enemy.carriedObjectId) { const tagged = state.objects.find(object => object.kind === 'salvageNode' && object.active && object.exposed); if (tagged) { tagged.exposed = false; enemy.carriedObjectId = tagged.id; if (protocol.enhanced) plantHazard(state, state.player.x, state.player.y, 'gravityWell', 3.2); pulse(state, enemy, `SALVAGE INTERDICTOR // ${tagged.label.toUpperCase()} TAKEN // INTERCEPT`); acted = true; } }
    else if (protocol.id === 'recoveryDenial') { const tagged = state.objects.find(object => object.kind === 'salvageNode' && object.active && object.exposed); if (tagged) { plantHazard(state, tagged.x + tagged.w / 2, tagged.y + tagged.h / 2, 'shockGrid', 4.8); if (protocol.enhanced) activateBarrier(state, enemy); pulse(state, enemy, `RECOVERY DENIAL // TAGGED HARDWARE GRIDDED${protocol.enhanced ? ' // SHUTTER DEPLOYED' : ''}`); acted = true; } }
    protocol.cooldown = acted ? definition.baseCooldown : 2.1;
    if (acted) break;
  }
}

export function getProtocolShutterTemplate(): Pick<CombatObject, 'kind' | 'material' | 'w' | 'h' | 'hp' | 'maxHp' | 'destructible' | 'active' | 'exposed'> {
  return { kind: 'cover', material: 'industrial', w: 54, h: 168, hp: 110, maxHp: 110, destructible: true, active: false, exposed: false };
}
