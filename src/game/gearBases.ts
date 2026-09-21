import type { AffixId, EquipmentSlot } from './meta';
import type { FrameIdentityId } from './gearDepth';
import type { GearBaseDefinition } from './gearSchema';
import type { FrameGeneration } from './scaling';

type BaseSpec = Omit<GearBaseDefinition, 'generationRange'> & {
  generationRange: [FrameGeneration, FrameGeneration];
};

const base = (definition: BaseSpec): BaseSpec => definition;

export const gearBaseDefinitions: BaseSpec[] = [
  base({
    id: 'm7-countermass-receiver',
    slot: 'carbine',
    name: 'M-7 Countermass Receiver',
    equipmentClass: 'Counter-recoil coil carbine assembly',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'carbine-countermass',
    core: 'A stabilized service receiver built around repeatable recoil geometry and deliberate firing lanes.',
    tradeoff: 'Excellent recoil control gives up a small amount of projectile pace.',
    inherentStats: ['local.recoil-absorption'],
    implicitStats: ['local.projectile-velocity-penalty'],
    allowedAffixGroups: ['countermass', 'tungsten', 'extendedFeed', 'magRedirect'],
    buildTags: ['ballistics', 'recoil', 'penetration', 'defense'],
  }),
  base({
    id: 'm7-dense-flight-receiver',
    slot: 'carbine',
    name: 'M-7 Dense-Flight Receiver',
    equipmentClass: 'High-velocity coil carbine assembly',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'carbine-hypervelocity',
    core: 'A hot-running receiver that spends thermal margin on faster, harder projectile flight.',
    tradeoff: 'Velocity and penetration come with higher heat per shot.',
    inherentStats: ['local.projectile-velocity', 'local.penetration'],
    implicitStats: ['local.heat-per-shot-penalty'],
    allowedAffixGroups: ['hypervelocity', 'tungsten', 'overdrive', 'cryoloop'],
    buildTags: ['ballistics', 'projectile', 'penetration', 'thermal'],
  }),
  base({
    id: 'm7-sustained-feed-spine',
    slot: 'carbine',
    name: 'M-7 Sustained-Feed Spine',
    equipmentClass: 'Sustained-fire coil carbine assembly',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'carbine-feedline',
    core: 'A long-cycle feed spine built to keep a firing lane active and tie the carbine into operator systems.',
    tradeoff: 'More magazine endurance costs reload speed.',
    inherentStats: ['local.magazine-capacity'],
    implicitStats: ['local.reload-time-penalty'],
    allowedAffixGroups: ['extendedFeed', 'countermass', 'cryoloop', 'magRedirect'],
    buildTags: ['ballistics', 'systems', 'thermal', 'recoil'],
  }),

  base({
    id: 'b4-backblast-thruster',
    slot: 'breacher',
    name: 'B-4 Backblast Thruster Cage',
    equipmentClass: 'Recoil-mobility breach scattergun',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'breacher-thrust',
    core: 'A lively breacher cage that deliberately preserves discharge impulse as movement authority.',
    tradeoff: 'Extreme shove and mobility increase firing impulse.',
    inherentStats: ['local.knockback'],
    implicitStats: ['local.recoil-impulse-penalty'],
    allowedAffixGroups: ['breachPropulsion', 'overdrive', 'dodgeVent', 'countermass'],
    buildTags: ['ballistics', 'recoil', 'mobility', 'low-g'],
  }),
  base({
    id: 'b4-dense-choke-cage',
    slot: 'breacher',
    name: 'B-4 Dense-Choke Cage',
    equipmentClass: 'Close-output breach scattergun',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'breacher-dense',
    core: 'A heavy choke cage tuned for maximum close-range transfer into armor and hull plating.',
    tradeoff: 'Higher direct output carries heavier recoil.',
    inherentStats: ['local.direct-output'],
    implicitStats: ['local.recoil-penalty'],
    allowedAffixGroups: ['overdrive', 'tungsten', 'extendedFeed', 'countermass'],
    buildTags: ['ballistics', 'armor-break', 'penetration', 'recoil'],
  }),
  base({
    id: 'b4-cryo-cycle-action',
    slot: 'breacher',
    name: 'B-4 Cryo-Cycle Action',
    equipmentClass: 'Thermal-cycle breach scattergun',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'breacher-cryo',
    core: 'A closed-loop action that gives up peak impulse for repeated breaches and fast thermal recovery.',
    tradeoff: 'Cooling and reload speed trade away a small amount of direct output.',
    inherentStats: ['local.heat-dissipation', 'local.reload-speed'],
    implicitStats: ['local.direct-output-penalty'],
    allowedAffixGroups: ['cryoloop', 'dodgeVent', 'extendedFeed', 'countermass'],
    buildTags: ['ballistics', 'thermal', 'heat', 'venting'],
  }),

  base({
    id: 'r2-hypervelocity-bed',
    slot: 'rail',
    name: 'R-2 Hypervelocity Rail Bed',
    equipmentClass: 'High-velocity rail-lance assembly',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'rail-hypervelocity',
    core: 'A precision rail bed that spends thermal headroom on projectile velocity and straight-line penetration.',
    tradeoff: 'Faster, deeper shots run hotter.',
    inherentStats: ['local.projectile-velocity', 'local.penetration'],
    implicitStats: ['local.heat-per-shot-penalty'],
    allowedAffixGroups: ['hypervelocity', 'tungsten', 'markShear', 'railFracture'],
    buildTags: ['precision', 'projectile', 'penetration', 'armor-break'],
  }),
  base({
    id: 'r2-countermass-bed',
    slot: 'rail',
    name: 'R-2 Countermass Rail Bed',
    equipmentClass: 'Stabilized rail-lance assembly',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'rail-countermass',
    core: 'A stabilized accelerator that cancels most discharge movement to protect a clean firing solution.',
    tradeoff: 'Exceptional recoil absorption concedes some direct output.',
    inherentStats: ['local.recoil-absorption'],
    implicitStats: ['local.direct-output-penalty'],
    allowedAffixGroups: ['countermass', 'hypervelocity', 'markShear', 'tungsten'],
    buildTags: ['precision', 'recoil', 'penetration', 'defense'],
  }),
  base({
    id: 'r2-thermal-reference',
    slot: 'rail',
    name: 'R-2 Thermal Reference Rails',
    equipmentClass: 'Sustained-operation rail-lance assembly',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'rail-thermal',
    core: 'A cold-reference rail package for operators who value repeatable strings over a single maximum-energy shot.',
    tradeoff: 'Sustained cooling gives up some penetration.',
    inherentStats: ['local.heat-dissipation'],
    implicitStats: ['local.penetration-penalty'],
    allowedAffixGroups: ['cryoloop', 'railFracture', 'countermass', 'markShear'],
    buildTags: ['precision', 'thermal', 'heat', 'projectile'],
  }),

  base({
    id: 'pressure-integrity-shell',
    slot: 'suit',
    name: 'Pressure-Integrity Shell',
    equipmentClass: 'Heavy combat pressure suit',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'suit-pressure',
    core: 'A layered shell built to keep armor and seal performance predictable inside damaged pressure architecture.',
    tradeoff: 'Armor and pressure integrity reduce movement speed.',
    inherentStats: ['local.armor-reserve', 'environment.pressure-resistance'],
    implicitStats: ['local.movement-speed-penalty'],
    allowedAffixGroups: ['vacuumSeal', 'capacitorRecycler', 'dodgeVent', 'servoWeave'],
    buildTags: ['defense', 'pressure', 'vacuum', 'armor-break'],
  }),
  base({
    id: 'light-eva-weave',
    slot: 'suit',
    name: 'Light EVA Weave',
    equipmentClass: 'Mobility pressure suit',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'suit-eva',
    core: 'A low-mass maneuvering weave built around acceleration, braking authority, and low-gravity line changes.',
    tradeoff: 'Mobility and low-g control give up armor reserve.',
    inherentStats: ['local.movement-speed', 'environment.low-g-control'],
    implicitStats: ['local.armor-reserve-penalty'],
    allowedAffixGroups: ['servoWeave', 'dodgeVent', 'vacuumSeal', 'capacitorRecycler'],
    buildTags: ['mobility', 'low-g', 'vacuum', 'defense'],
  }),
  base({
    id: 'countermass-mobility-shell',
    slot: 'suit',
    name: 'Countermass Mobility Shell',
    equipmentClass: 'Vector-control pressure suit',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'suit-countermass',
    core: 'A maneuvering shell that spends passive pressure margin on aggressive vector correction.',
    tradeoff: 'Superior low-g vector authority reduces passive pressure protection.',
    inherentStats: ['environment.low-g-control', 'local.movement-speed'],
    implicitStats: ['environment.pressure-resistance-penalty'],
    allowedAffixGroups: ['servoWeave', 'dodgeVent', 'capacitorRecycler', 'vacuumSeal'],
    buildTags: ['mobility', 'low-g', 'pressure', 'recoil'],
  }),

  base({
    id: 'capacitor-reserve-bus',
    slot: 'rig',
    name: 'Capacitor Reserve Bus',
    equipmentClass: 'High-capacity power rig',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'rig-capacitor',
    core: 'A reserve-heavy systems bus that prioritizes stored charge and stable regeneration.',
    tradeoff: 'More capacitor headroom slightly increases ability cost.',
    inherentStats: ['local.capacitor-reserve', 'local.capacitor-regeneration'],
    implicitStats: ['local.ability-cost-penalty'],
    allowedAffixGroups: ['capacitorRecycler', 'magRedirect', 'arcDrone', 'cryoloop'],
    buildTags: ['capacitor', 'systems', 'relay', 'cooldown'],
  }),
  base({
    id: 'closed-loop-thermal-bus',
    slot: 'rig',
    name: 'Closed-Loop Thermal Bus',
    equipmentClass: 'Thermal-management systems rig',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'rig-thermal',
    core: 'A heat-first routing bus that turns rig volume into weapon cooling capacity.',
    tradeoff: 'Better heat rejection reduces capacitor reserve.',
    inherentStats: ['local.heat-dissipation'],
    implicitStats: ['local.capacitor-reserve-penalty'],
    allowedAffixGroups: ['cryoloop', 'capacitorRecycler', 'dodgeVent', 'arcDrone'],
    buildTags: ['thermal', 'heat', 'venting', 'systems'],
  }),
  base({
    id: 'pulse-control-bus',
    slot: 'rig',
    name: 'Pulse-Control Bus',
    equipmentClass: 'Fast-cycle systems rig',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'rig-pulse',
    core: 'A high-response control bus built to shorten operator ability loops rather than maximize stored energy.',
    tradeoff: 'Shorter ability cycles cost more capacitor per activation.',
    inherentStats: ['local.ability-cooldown'],
    implicitStats: ['local.ability-cost-penalty'],
    allowedAffixGroups: ['capacitorRecycler', 'magRedirect', 'arcDrone', 'dodgeVent'],
    buildTags: ['cooldown', 'systems', 'relay', 'capacitor'],
  }),

  base({
    id: 'survey-sensor-kernel',
    slot: 'implant',
    name: 'Survey Sensor Kernel',
    equipmentClass: 'Target-analysis neural implant',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'implant-sensor',
    core: 'A survey cognition layer that invests neural bandwidth in deeper target solutions and armor mapping.',
    tradeoff: 'Stronger Sensor Spike solutions recover slightly slower.',
    inherentStats: ['skill-family.mark-power'],
    implicitStats: ['skill-family.mark-cooldown-penalty'],
    allowedAffixGroups: ['markShear', 'magRedirect', 'capacitorRecycler', 'servoWeave'],
    buildTags: ['mark', 'precision', 'armor-break', 'systems'],
  }),
  base({
    id: 'predictive-ballistic-kernel',
    slot: 'implant',
    name: 'Predictive Ballistic Kernel',
    equipmentClass: 'Projectile-prediction neural implant',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'implant-ballistic',
    core: 'A predictive layer that pushes projectile timing and penetration decisions into the implant.',
    tradeoff: 'Ballistic prediction adds a small global ability-power tax.',
    inherentStats: ['global.projectile-velocity', 'global.penetration'],
    implicitStats: ['global.ability-cost-penalty'],
    allowedAffixGroups: ['markShear', 'servoWeave', 'capacitorRecycler', 'magRedirect'],
    buildTags: ['precision', 'projectile', 'penetration', 'mobility'],
  }),
  base({
    id: 'distributed-relay-kernel',
    slot: 'implant',
    name: 'Distributed Relay Kernel',
    equipmentClass: 'Network-routing neural implant',
    generation: 1,
    generationRange: [1, 6],
    frameIdentity: 'implant-relay',
    core: 'A distributed cognition kernel tuned for disruption chains, relay timing, and machinery-aware routing.',
    tradeoff: 'Stronger relay authority increases Arc Tap capacitor cost.',
    inherentStats: ['skill-family.relay-power', 'skill-family.relay-cooldown'],
    implicitStats: ['skill-family.relay-cost-penalty'],
    allowedAffixGroups: ['arcDrone', 'magRedirect', 'capacitorRecycler', 'markShear'],
    buildTags: ['relay', 'disruption', 'systems', 'cooldown'],
  }),
];

const legacyBaseAliases: Partial<Record<string, string>> = {
  'm7-frame': 'm7-countermass-receiver',
  'b4-frame': 'b4-dense-choke-cage',
  'r2-frame': 'r2-hypervelocity-bed',
  'pressure-suit': 'pressure-integrity-shell',
  'utility-suit': 'pressure-integrity-shell',
  'power-rig': 'capacitor-reserve-bus',
  'utility-rig': 'capacitor-reserve-bus',
  'sensor-implant': 'survey-sensor-kernel',
  'operator-link': 'survey-sensor-kernel',
};

export function gearBaseDefinition(baseId: string) {
  const canonical = legacyBaseAliases[baseId] ?? baseId;
  return gearBaseDefinitions.find(definition => definition.id === canonical);
}

export function gearBasesForSlot(slot: EquipmentSlot, generation?: FrameGeneration) {
  return gearBaseDefinitions.filter(definition => definition.slot === slot
    && (!generation || (generation >= definition.generationRange[0] && generation <= definition.generationRange[1])));
}

export function gearBaseForFrameIdentity(slot: EquipmentSlot, frameIdentity: FrameIdentityId) {
  return gearBaseDefinitions.find(definition => definition.slot === slot && definition.frameIdentity === frameIdentity);
}

export function resolveGearBase(slot: EquipmentSlot, baseId: string, frameIdentity?: FrameIdentityId) {
  const exact = gearBaseDefinition(baseId);
  if (exact?.slot === slot) return exact;
  if (frameIdentity) return gearBaseForFrameIdentity(slot, frameIdentity);
  return undefined;
}

export function rollGearBase(slot: EquipmentSlot, random: () => number, generation: FrameGeneration, requiredAffixes: AffixId[] = []) {
  const generationPool = gearBasesForSlot(slot, generation);
  const compatible = generationPool.filter(definition => requiredAffixes.every(id => definition.allowedAffixGroups.includes(id)));
  const pool = compatible.length > 0 ? compatible : generationPool;
  const roll = Math.max(0, Math.min(0.999999, random()));
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}
