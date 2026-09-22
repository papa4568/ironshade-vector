import type { CombatBuild } from './sim';
import type { FrameGeneration } from './scaling';
import type { ItemRarity } from './rarity';

export type GearSlot = 'carbine' | 'breacher' | 'rail' | 'suit' | 'rig' | 'implant';
export type GearRarity = ItemRarity;
export type EquipmentFactionKey = 'meridian' | 'heliostat' | 'longarc';
export type FrameIdentityId =
  | 'carbine-countermass' | 'carbine-hypervelocity' | 'carbine-feedline'
  | 'breacher-thrust' | 'breacher-dense' | 'breacher-cryo'
  | 'rail-hypervelocity' | 'rail-countermass' | 'rail-thermal'
  | 'suit-pressure' | 'suit-eva' | 'suit-countermass'
  | 'rig-capacitor' | 'rig-thermal' | 'rig-pulse'
  | 'implant-sensor' | 'implant-ballistic' | 'implant-relay';
export type AugmentId =
  | 'countermass-coupler' | 'ferrite-coupler' | 'coolant-coupler'
  | 'pressure-baffle-insert' | 'eva-flex-insert' | 'servo-damper-insert'
  | 'cap-buffer-board' | 'thermal-shunt-board' | 'relay-daughterboard'
  | 'predictive-kernel' | 'shear-kernel' | 'signal-filter-kernel';
export type AugmentResource = 'credits' | 'alloys' | 'electronics' | 'components';

export type FrameIdentityDefinition = {
  id: FrameIdentityId;
  slot: GearSlot;
  name: string;
  philosophy: string;
};

export type AugmentDefinition = {
  id: AugmentId;
  name: string;
  hardware: string;
  description: string;
  tradeoff: string;
  slots: GearSlot[];
  cost: Partial<Record<AugmentResource, number>>;
};

export const frameIdentityDefinitions: FrameIdentityDefinition[] = [
  { id: 'carbine-countermass', slot: 'carbine', name: 'Countermass Receiver', philosophy: 'Predictable recoil with a small loss of projectile pace.' },
  { id: 'carbine-hypervelocity', slot: 'carbine', name: 'Dense-Flight Receiver', philosophy: 'Projectile velocity and penetration at the cost of thermal comfort.' },
  { id: 'carbine-feedline', slot: 'carbine', name: 'Sustained Feed Spine', philosophy: 'Magazine endurance with slower service cycling.' },
  { id: 'breacher-thrust', slot: 'breacher', name: 'Backblast Thruster Cage', philosophy: 'Turns discharge impulse into extreme shove and movement authority.' },
  { id: 'breacher-dense', slot: 'breacher', name: 'Dense-Choke Cage', philosophy: 'Higher close-range output with heavier firing impulse.' },
  { id: 'breacher-cryo', slot: 'breacher', name: 'Cryo-Cycle Action', philosophy: 'Fast heat recovery and cycling with slightly lower peak output.' },
  { id: 'rail-hypervelocity', slot: 'rail', name: 'Hypervelocity Rail Bed', philosophy: 'Velocity and armor penetration with additional heat load.' },
  { id: 'rail-countermass', slot: 'rail', name: 'Countermass Rail Bed', philosophy: 'Exceptional recoil absorption with a small energy-output concession.' },
  { id: 'rail-thermal', slot: 'rail', name: 'Thermal Reference Rails', philosophy: 'Sustained rail operation with slightly less penetration.' },
  { id: 'suit-pressure', slot: 'suit', name: 'Pressure-Integrity Shell', philosophy: 'Armor and seal integrity over raw mobility.' },
  { id: 'suit-eva', slot: 'suit', name: 'Light EVA Weave', philosophy: 'Mobility and low-g control with less plate reserve.' },
  { id: 'suit-countermass', slot: 'suit', name: 'Countermass Mobility Shell', philosophy: 'Low-g vector authority with reduced passive pressure protection.' },
  { id: 'rig-capacitor', slot: 'rig', name: 'Capacitor Reserve Bus', philosophy: 'Large capacitor headroom with slightly slower recharge response.' },
  { id: 'rig-thermal', slot: 'rig', name: 'Closed-Loop Thermal Bus', philosophy: 'Weapon heat rejection with less capacitor reserve.' },
  { id: 'rig-pulse', slot: 'rig', name: 'Pulse-Control Bus', philosophy: 'Shorter ability cycles with slightly higher ability power cost.' },
  { id: 'implant-sensor', slot: 'implant', name: 'Survey Sensor Kernel', philosophy: 'Stronger Sensor Spike solutions with slower retarget cadence.' },
  { id: 'implant-ballistic', slot: 'implant', name: 'Predictive Ballistic Kernel', philosophy: 'Projectile prediction and penetration with minor neural load.' },
  { id: 'implant-relay', slot: 'implant', name: 'Distributed Relay Kernel', philosophy: 'Arc Tap authority and cycling with a modest capacitor tax.' },
];

const pools: Record<GearSlot, FrameIdentityId[]> = {
  carbine: ['carbine-countermass', 'carbine-hypervelocity', 'carbine-feedline'],
  breacher: ['breacher-thrust', 'breacher-dense', 'breacher-cryo'],
  rail: ['rail-hypervelocity', 'rail-countermass', 'rail-thermal'],
  suit: ['suit-pressure', 'suit-eva', 'suit-countermass'],
  rig: ['rig-capacitor', 'rig-thermal', 'rig-pulse'],
  implant: ['implant-sensor', 'implant-ballistic', 'implant-relay'],
};

export const equipmentQualityCap = 20;
export const equipmentQualityPerPoint = 0.01;
export const augmentSocketCap = 2;

const clampQuality = (quality: number) => Math.max(0, Math.min(equipmentQualityCap, Math.round(quality)));
export const equipmentQualityMultiplier = (quality: number) => 1 + clampQuality(quality) * equipmentQualityPerPoint;
const qualityScale = equipmentQualityMultiplier;
const generationValue = (generation: FrameGeneration, values: [number, number, number, number]) => values[Math.min(values.length - 1, generation - 1)] * (generation >= 5 ? 1.12 : 1);
const percent = (value: number) => Math.round(value * 100);

export function rollEquipmentQuality(random: () => number) {
  const roll = Math.max(0, Math.min(0.999999, random()));
  return clampQuality(Math.floor(roll * 9));
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function frameIdentityDefinition(id: FrameIdentityId) {
  return frameIdentityDefinitions.find(definition => definition.id === id)!;
}

export function inferFrameIdentity(slot: GearSlot, key: string): FrameIdentityId {
  const normalized = key.toLowerCase();
  if (slot === 'carbine') {
    if (/counter|compliance|palisade|stable/.test(normalized)) return 'carbine-countermass';
    if (/hyper|flux|ghost|arcspindle/.test(normalized)) return 'carbine-hypervelocity';
  }
  if (slot === 'breacher') {
    if (/backblast|redline|longarc/.test(normalized)) return 'breacher-thrust';
    if (/sunforge|dense|dockbreaker/.test(normalized)) return 'breacher-dense';
  }
  if (slot === 'rail') {
    if (/hyper|needle|null|helios|khepri/.test(normalized)) return 'rail-hypervelocity';
    if (/counter|bondhouse|stabilized/.test(normalized)) return 'rail-countermass';
  }
  if (slot === 'suit') {
    if (/pressure|mantle|stormskin|meridian|rated/.test(normalized)) return 'suit-pressure';
    if (/eva|glass|convoy|khepri|calibration/.test(normalized)) return 'suit-eva';
  }
  if (slot === 'rig') {
    if (/thermal|helios|cryo|open-cycle/.test(normalized)) return 'rig-thermal';
    if (/capacitor|redundant|meridian/.test(normalized)) return 'rig-capacitor';
  }
  if (slot === 'implant') {
    if (/sensor|survey|deadreckon|threat-control/.test(normalized)) return 'implant-sensor';
    if (/route|predictive/.test(normalized)) return 'implant-ballistic';
  }
  const pool = pools[slot];
  return pool[hashText(`${slot}:${key}`) % pool.length];
}

export function resolveFrameIdentity(slot: GearSlot, identity: FrameIdentityId | undefined, key: string) {
  return identity && frameIdentityDefinition(identity).slot === slot ? identity : inferFrameIdentity(slot, key);
}

export function rollFrameIdentity(slot: GearSlot, random: () => number) {
  const pool = pools[slot];
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function factionFrameIdentity(faction: EquipmentFactionKey, slot: GearSlot): FrameIdentityId {
  const map: Record<EquipmentFactionKey, Record<GearSlot, FrameIdentityId>> = {
    meridian: { carbine: 'carbine-countermass', breacher: 'breacher-dense', rail: 'rail-countermass', suit: 'suit-pressure', rig: 'rig-capacitor', implant: 'implant-sensor' },
    heliostat: { carbine: 'carbine-hypervelocity', breacher: 'breacher-dense', rail: 'rail-hypervelocity', suit: 'suit-eva', rig: 'rig-thermal', implant: 'implant-relay' },
    longarc: { carbine: 'carbine-feedline', breacher: 'breacher-thrust', rail: 'rail-countermass', suit: 'suit-eva', rig: 'rig-pulse', implant: 'implant-ballistic' },
  };
  return map[faction][slot];
}

export function singularFrameIdentity(slot: GearSlot, baseId: string) {
  return inferFrameIdentity(slot, `singular:${baseId}`);
}

/** @deprecated P8.5-B compatibility shim for old callers. New drops use rollEquipmentQuality. */
export function equipmentQualityForRecovery(_recoveryQuality: number, _generation: FrameGeneration, _rarity: GearRarity) {
  return 0;
}

export function augmentSlotCount(rarity: GearRarity, _generation: FrameGeneration) {
  if (rarity === 'Field') return 0;
  if (rarity === 'Refined') return 1;
  return augmentSocketCap;
}

export function frameImplicitDescription(identity: FrameIdentityId, generation: FrameGeneration, quality: number) {
  const q = qualityScale(quality);
  switch (identity) {
    case 'carbine-countermass': return `${frameIdentityDefinition(identity).name} // ${percent(generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q)}% recoil absorption; projectile velocity -2%.`;
    case 'carbine-hypervelocity': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.04, 0.06, 0.08, 0.1]) * q)}% projectile velocity and added penetration; +3% heat/shot.`;
    case 'carbine-feedline': return `${frameIdentityDefinition(identity).name} // +${Math.max(1, Math.round(generationValue(generation, [2, 3, 4, 5]) * q))} magazine capacity; +4% reload time.`;
    case 'breacher-thrust': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% knockback; +4% recoil impulse.`;
    case 'breacher-dense': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.03, 0.05, 0.07, 0.09]) * q)}% direct output; +5% recoil.`;
    case 'breacher-cryo': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% heat dissipation and faster reload; -2% direct output.`;
    case 'rail-hypervelocity': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.05, 0.08, 0.11, 0.14]) * q)}% velocity and precision penetration; +4% heat/shot.`;
    case 'rail-countermass': return `${frameIdentityDefinition(identity).name} // ${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% recoil absorption; -3% direct output.`;
    case 'rail-thermal': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.1, 0.15, 0.2, 0.25]) * q)}% heat dissipation; small penetration concession.`;
    case 'suit-pressure': return `${frameIdentityDefinition(identity).name} // additional armor and ${percent(generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q)}% pressure resistance; -2% movement speed.`;
    case 'suit-eva': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q)}% movement speed and strong low-g control; -4 armor reserve.`;
    case 'suit-countermass': return `${frameIdentityDefinition(identity).name} // low-g vector control and modest movement gain; reduced passive pressure resistance.`;
    case 'rig-capacitor': return `${frameIdentityDefinition(identity).name} // expanded capacitor ceiling and modest regeneration; +3% ability cost.`;
    case 'rig-thermal': return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.06, 0.09, 0.12, 0.15]) * q)}% weapon heat dissipation; -4 capacitor reserve.`;
    case 'rig-pulse': return `${frameIdentityDefinition(identity).name} // shorter ability cycles; +3% ability cost.`;
    case 'implant-sensor': return `${frameIdentityDefinition(identity).name} // stronger Sensor Spike solution; +2% mark cooldown.`;
    case 'implant-ballistic': return `${frameIdentityDefinition(identity).name} // predictive projectile velocity and penetration; +1% ability cost.`;
    case 'implant-relay': return `${frameIdentityDefinition(identity).name} // stronger/faster Arc Tap routing; +3% Arc Tap cost.`;
  }
}

export function applyFrameIdentity(build: CombatBuild, item: { slot: GearSlot; frameGeneration?: FrameGeneration; frameIdentity?: FrameIdentityId; equipmentQuality?: number; baseId: string; name: string }) {
  const generation = item.frameGeneration ?? 1;
  const identity = resolveFrameIdentity(item.slot, item.frameIdentity, `${item.baseId}:${item.name}`);
  const q = qualityScale(item.equipmentQuality ?? 0);
  const weapon = item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail' ? build.weapon[item.slot] : null;
  if (identity === 'carbine-countermass' && weapon) { weapon.recoilMul *= 1 - generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q; weapon.speedMul *= 0.98; }
  if (identity === 'carbine-hypervelocity' && weapon) { weapon.speedMul *= 1 + generationValue(generation, [0.04, 0.06, 0.08, 0.1]) * q; weapon.penetrationAdd += Math.round(generationValue(generation, [2, 4, 6, 8]) * q); weapon.heatPerShotMul *= 1.03; }
  if (identity === 'carbine-feedline' && weapon) { weapon.magazineAdd += Math.max(1, Math.round(generationValue(generation, [2, 3, 4, 5]) * q)); weapon.reloadMul *= 1.04; }
  if (identity === 'breacher-thrust' && weapon) { weapon.knockbackMul *= 1 + generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q; weapon.recoilMul *= 1.04; }
  if (identity === 'breacher-dense' && weapon) { weapon.damageMul *= 1 + generationValue(generation, [0.03, 0.05, 0.07, 0.09]) * q; weapon.recoilMul *= 1.05; }
  if (identity === 'breacher-cryo' && weapon) { weapon.heatDissipationMul *= 1 + generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q; weapon.reloadMul *= 1 - generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q; weapon.damageMul *= 0.98; }
  if (identity === 'rail-hypervelocity' && weapon) { weapon.speedMul *= 1 + generationValue(generation, [0.05, 0.08, 0.11, 0.14]) * q; weapon.penetrationAdd += Math.round(generationValue(generation, [4, 7, 10, 13]) * q); weapon.heatPerShotMul *= 1.04; }
  if (identity === 'rail-countermass' && weapon) { weapon.recoilMul *= 1 - generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q; weapon.damageMul *= 0.97; }
  if (identity === 'rail-thermal' && weapon) { weapon.heatDissipationMul *= 1 + generationValue(generation, [0.1, 0.15, 0.2, 0.25]) * q; weapon.penetrationAdd -= Math.max(1, generation - 1); }
  if (identity === 'suit-pressure') { build.player.maxArmorAdd += Math.round(generationValue(generation, [5, 8, 11, 14]) * q); build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q); build.player.moveSpeedMul *= 0.98; }
  if (identity === 'suit-eva') { build.player.moveSpeedMul *= 1 + generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q; build.player.lowGControl += generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q; build.player.maxArmorAdd -= 4; }
  if (identity === 'suit-countermass') { build.player.moveSpeedMul *= 1 + generationValue(generation, [0.01, 0.02, 0.03, 0.04]) * q; build.player.lowGControl += generationValue(generation, [0.12, 0.17, 0.22, 0.27]) * q; build.player.vacuumResistance = Math.max(0, build.player.vacuumResistance - 0.03); }
  if (identity === 'rig-capacitor') { build.player.maxCapAdd += Math.round(generationValue(generation, [6, 9, 12, 15]) * q); build.player.capRegenMul *= 1 + generationValue(generation, [0.02, 0.04, 0.06, 0.08]) * q; for (const ability of build.abilities) ability.costMul *= 1.03; }
  if (identity === 'rig-thermal') { for (const stats of Object.values(build.weapon)) stats.heatDissipationMul *= 1 + generationValue(generation, [0.06, 0.09, 0.12, 0.15]) * q; build.player.maxCapAdd -= 4; }
  if (identity === 'rig-pulse') { for (const ability of build.abilities) { ability.cooldownMul *= 1 - generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q; ability.costMul *= 1.03; } }
  if (identity === 'implant-sensor') { build.abilities[1].powerMul *= 1 + generationValue(generation, [0.05, 0.075, 0.1, 0.125]) * q; build.abilities[1].cooldownMul *= 1.02; }
  if (identity === 'implant-ballistic') { for (const stats of Object.values(build.weapon)) { stats.speedMul *= 1 + generationValue(generation, [0.015, 0.025, 0.035, 0.045]) * q; stats.penetrationAdd += Math.max(1, Math.round(generation * q)); } for (const ability of build.abilities) ability.costMul *= 1.01; }
  if (identity === 'implant-relay') { build.abilities[2].powerMul *= 1 + generationValue(generation, [0.04, 0.06, 0.08, 0.1]) * q; build.abilities[2].cooldownMul *= 1 - generationValue(generation, [0.015, 0.025, 0.035, 0.045]) * q; build.abilities[2].costMul *= 1.03; }
}

export const augmentDefinitions: AugmentDefinition[] = [
  { id: 'countermass-coupler', name: 'Countermass Coupler', hardware: 'Weapon coupler', description: '-6% recoil on this weapon.', tradeoff: '-2% direct weapon output.', slots: ['carbine', 'breacher', 'rail'], cost: { credits: 70, alloys: 1, components: 1 } },
  { id: 'ferrite-coupler', name: 'Ferrite Bypass Coupler', hardware: 'Weapon coupler', description: '+5 penetration on this weapon.', tradeoff: '+4% heat per shot.', slots: ['carbine', 'breacher', 'rail'], cost: { credits: 75, alloys: 1, electronics: 1 } },
  { id: 'coolant-coupler', name: 'Coolant Return Coupler', hardware: 'Weapon coupler', description: '+8% heat dissipation.', tradeoff: '+3% reload time.', slots: ['carbine', 'breacher', 'rail'], cost: { credits: 70, electronics: 2 } },
  { id: 'pressure-baffle-insert', name: 'Pressure Baffle Insert', hardware: 'Suit insert', description: '+6 armor reserve.', tradeoff: '-2% movement speed.', slots: ['suit'], cost: { credits: 65, alloys: 2 } },
  { id: 'eva-flex-insert', name: 'EVA Flex Insert', hardware: 'Suit insert', description: '+3% movement speed.', tradeoff: '-4 armor reserve.', slots: ['suit'], cost: { credits: 65, alloys: 1, electronics: 1 } },
  { id: 'servo-damper-insert', name: 'Servo Damper Insert', hardware: 'Suit insert', description: 'Improves low-g control.', tradeoff: '-3 armor reserve.', slots: ['suit'], cost: { credits: 75, electronics: 2 } },
  { id: 'cap-buffer-board', name: 'Capacitor Buffer Board', hardware: 'Rig daughterboard', description: '+8 capacitor reserve.', tradeoff: '-3% capacitor regeneration.', slots: ['rig'], cost: { credits: 80, electronics: 2, components: 1 } },
  { id: 'thermal-shunt-board', name: 'Thermal Shunt Board', hardware: 'Rig daughterboard', description: '+7% weapon heat dissipation.', tradeoff: '+2% ability cooldown.', slots: ['rig'], cost: { credits: 80, electronics: 2 } },
  { id: 'relay-daughterboard', name: 'Relay Daughterboard', hardware: 'Rig daughterboard', description: '-5% Arc Tap cooldown.', tradeoff: '-4 capacitor reserve.', slots: ['rig'], cost: { credits: 90, electronics: 2, components: 1 } },
  { id: 'predictive-kernel', name: 'Predictive Kernel', hardware: 'Implant kernel', description: '+3% projectile velocity.', tradeoff: '+2% recoil.', slots: ['implant'], cost: { credits: 75, electronics: 2 } },
  { id: 'shear-kernel', name: 'Shear Analysis Kernel', hardware: 'Implant kernel', description: '+8% Sensor Spike power.', tradeoff: '+5% Sensor Spike cooldown.', slots: ['implant'], cost: { credits: 80, electronics: 2, components: 1 } },
  { id: 'signal-filter-kernel', name: 'Signal Filter Kernel', hardware: 'Implant kernel', description: '-4% ability cost.', tradeoff: '+2% ability cooldown.', slots: ['implant'], cost: { credits: 80, electronics: 2 } },
];

export function augmentDefinition(id: AugmentId) {
  return augmentDefinitions.find(definition => definition.id === id)!;
}

export function availableAugments(slot: GearSlot) {
  return augmentDefinitions.filter(definition => definition.slots.includes(slot));
}

export function normalizeAugments(slot: GearSlot, ids: AugmentId[], limit: number) {
  const unique = new Set<AugmentId>();
  for (const id of ids) if (augmentDefinition(id).slots.includes(slot)) unique.add(id);
  return [...unique].slice(0, Math.max(0, limit));
}

export function applyAugments(build: CombatBuild, slot: GearSlot, ids: AugmentId[]) {
  const weapon = slot === 'carbine' || slot === 'breacher' || slot === 'rail' ? build.weapon[slot] : null;
  for (const id of ids) {
    if (id === 'countermass-coupler' && weapon) { weapon.recoilMul *= 0.94; weapon.damageMul *= 0.98; }
    if (id === 'ferrite-coupler' && weapon) { weapon.penetrationAdd += 5; weapon.heatPerShotMul *= 1.04; }
    if (id === 'coolant-coupler' && weapon) { weapon.heatDissipationMul *= 1.08; weapon.reloadMul *= 1.03; }
    if (id === 'pressure-baffle-insert') { build.player.maxArmorAdd += 6; build.player.moveSpeedMul *= 0.98; }
    if (id === 'eva-flex-insert') { build.player.moveSpeedMul *= 1.03; build.player.maxArmorAdd -= 4; }
    if (id === 'servo-damper-insert') { build.player.lowGControl += 0.12; build.player.maxArmorAdd -= 3; }
    if (id === 'cap-buffer-board') { build.player.maxCapAdd += 8; build.player.capRegenMul *= 0.97; }
    if (id === 'thermal-shunt-board') { for (const stats of Object.values(build.weapon)) stats.heatDissipationMul *= 1.07; for (const ability of build.abilities) ability.cooldownMul *= 1.02; }
    if (id === 'relay-daughterboard') { build.abilities[2].cooldownMul *= 0.95; build.player.maxCapAdd -= 4; }
    if (id === 'predictive-kernel') { for (const stats of Object.values(build.weapon)) { stats.speedMul *= 1.03; stats.recoilMul *= 1.02; } }
    if (id === 'shear-kernel') { build.abilities[1].powerMul *= 1.08; build.abilities[1].cooldownMul *= 1.05; }
    if (id === 'signal-filter-kernel') { for (const ability of build.abilities) { ability.costMul *= 0.96; ability.cooldownMul *= 1.02; } }
  }
}
