import type { CombatBuild, SingularTraitId, SpecializationId, Telemetry, WeaponId } from './sim';
import { factionFrames, factionGearChance, factionSetDefinitions, type EquipmentFaction } from './factionGear';
import { frameGenerationForRecovery, recoveryLevelForSource, type FrameGeneration } from './scaling';
import { modifierCountForRarity, modifierFamilyFor, modifierPowerFactor, modifierTradeoffFactor, rollModifierGrade, rollRarityForQuality, rollRecoveryQuality, type ModifierFamily, type ModifierGrade, type RecoveryQualityGrade } from './lootQuality';
import { applyAugments, applyFrameIdentity, augmentSlotCount, equipmentQualityForRecovery, factionFrameIdentity, frameImplicitDescription, inferFrameIdentity, normalizeAugments, rollFrameIdentity, singularFrameIdentity, type AugmentId, type FrameIdentityId } from './gearDepth';
import type { GroundLootReceipt } from './fieldLoot';

export type EquipmentSlot = WeaponId | 'suit' | 'rig' | 'implant';
export type Rarity = 'Field' | 'Refined' | 'Prototype' | 'Singular';
export type AbilityId = 'mag' | 'mark' | 'arc';
export type OperatorClassId = 'vanguard' | 'vector' | 'systems';
export type MobileAimAssist = 'light' | 'balanced';
export type AffixId = 'hypervelocity' | 'countermass' | 'overdrive' | 'cryoloop' | 'extendedFeed' | 'tungsten' | 'vacuumSeal' | 'servoWeave' | 'capacitorRecycler' | 'railFracture' | 'dodgeVent' | 'magRedirect' | 'breachPropulsion' | 'markShear' | 'arcDrone';
export type ItemModifier = { id: AffixId; label: string; description: string; mechanical: boolean; family?: ModifierFamily; grade?: ModifierGrade };
export type Item = { id: string; baseId: string; name: string; slot: EquipmentSlot; equipmentClass: string; rarity: Rarity; levelRequirement: number; core: string; modifiers: ItemModifier[]; faction?: EquipmentFaction; singularTrait?: SingularTraitId; singularEffect?: string; recoveryLevel?: number; frameGeneration?: FrameGeneration; frameIdentity?: FrameIdentityId; frameImplicit?: string; equipmentQuality?: number; augmentSlots?: number; augments?: AugmentId[]; recoveryQuality?: RecoveryQualityGrade; recoverySource?: string };
export type EffectIntensity = 'full' | 'reduced';
export type ProfileSettings = { aimAssist: MobileAimAssist; rightStickFire: boolean; screenShake: boolean; effectIntensity: EffectIntensity; effectsVolume: number; uiVolume: number; haptics: boolean; telemetrySharing: boolean; tutorialComplete: boolean };
export type PlayerProfile = { version: 3; xp: number; level: number; progressionPoints: number; allocatedNodes: string[]; abilityMods: Record<AbilityId, string | null>; operatorClass?: OperatorClassId; specialization: SpecializationId | null; specializationOverclock: boolean; inventory: Item[]; equipped: Record<EquipmentSlot, string | null>; settings: ProfileSettings; runsCompleted: number };
export type VictoryReward = { profile: PlayerProfile; xpGained: number; levelsGained: number; loot: Item[] };
export type ProgressionNode = { id: string; branch: 'Ballistics' | 'Mobility' | 'Systems' | 'Survival' | 'Engineering' | 'Awareness'; name: string; description: string; major?: boolean; requires?: string };
export type AbilityMod = { id: string; ability: AbilityId; name: string; description: string; tradeoff: string };
export type SpecializationDefinition = { id: SpecializationId; operatorClass: OperatorClassId; name: string; identity: string; description: string; tradeoff: string; overclock: string; overclockTradeoff: string };
export type OperatorClassDefinition = { id: OperatorClassId; name: string; identity: string; description: string; trait: string; branchAffinities: ProgressionNode['branch'][]; specializationIds: SpecializationId[]; resonanceTier1: string; resonanceTier2: string };
export type GearResonanceState = { classId: OperatorClassId; count: number; tier: 0 | 1 | 2; nextAt: 2 | 4 | null; matchingItemIds: string[] };

const STORAGE_KEY = 'ironshade-vector-profile-v3';
const starterItems: Item[] = [
  { id: 'starter-carbine', baseId: 'm7-frame', name: 'M-7 Service Frame', slot: 'carbine', equipmentClass: 'Coil carbine assembly', rarity: 'Field', levelRequirement: 1, core: 'Stable automatic coil assembly with neutral recoil and thermal behavior.', modifiers: [] },
  { id: 'starter-breacher', baseId: 'b4-frame', name: 'B-4 Service Frame', slot: 'breacher', equipmentClass: 'Breach scattergun assembly', rarity: 'Field', levelRequirement: 1, core: 'Close-range scatter assembly tuned for predictable thrust and spread.', modifiers: [] },
  { id: 'starter-rail', baseId: 'r2-frame', name: 'R-2 Service Rails', slot: 'rail', equipmentClass: 'Rail-lance assembly', rarity: 'Field', levelRequirement: 1, core: 'High-velocity rails with standard capacitor draw and penetration.', modifiers: [] },
  { id: 'starter-suit', baseId: 'utility-suit', name: 'Dockworker Pressure Suit', slot: 'suit', equipmentClass: 'Combat pressure suit', rarity: 'Field', levelRequirement: 1, core: 'Balanced protection with ordinary maneuvering servos.', modifiers: [] },
  { id: 'starter-rig', baseId: 'utility-rig', name: 'QS Utility Rig', slot: 'rig', equipmentClass: 'Power and thermal rig', rarity: 'Field', levelRequirement: 1, core: 'Standard capacitor bus and thermal routing.', modifiers: [] },
  { id: 'starter-implant', baseId: 'operator-link', name: 'Operator Sensor Link', slot: 'implant', equipmentClass: 'Neural systems implant', rarity: 'Field', levelRequirement: 1, core: 'Basic targeting, telemetry, and electronic-control interface.', modifiers: [] },
];
const affixes: Record<AffixId, ItemModifier> = {
  hypervelocity: { id: 'hypervelocity', label: 'Hypervelocity rails', description: '+18% projectile velocity and +12 penetration, but +10% recoil.', mechanical: false },
  countermass: { id: 'countermass', label: 'Countermass buffer', description: '-22% recoil, but -7% direct weapon damage.', mechanical: false },
  overdrive: { id: 'overdrive', label: 'Open-coil overdrive', description: '+14% weapon damage, +20% recoil, and +12% heat per shot.', mechanical: false },
  cryoloop: { id: 'cryoloop', label: 'Cryogenic return loop', description: '+30% heat dissipation, but -8 penetration.', mechanical: false },
  extendedFeed: { id: 'extendedFeed', label: 'Extended feed geometry', description: '+6 magazine capacity, but +12% reload time.', mechanical: false },
  tungsten: { id: 'tungsten', label: 'Tungsten penetrator stack', description: '+30% armor damage and +14 penetration, but +8% heat per shot.', mechanical: false },
  vacuumSeal: { id: 'vacuumSeal', label: 'Layered vacuum seal', description: 'Strongly reduces vacuum exposure damage and decompression pull.', mechanical: false },
  servoWeave: { id: 'servoWeave', label: 'Vector servo weave', description: '+8% movement speed and improved low-gravity braking.', mechanical: false },
  capacitorRecycler: { id: 'capacitorRecycler', label: 'Capacitor recycler', description: '+20% capacitor regeneration and -10% ability power cost.', mechanical: false },
  railFracture: { id: 'railFracture', label: 'Fracture cascade', description: 'Rail rounds fragment after penetrating a target, creating two lower-energy follow-up vectors.', mechanical: true },
  dodgeVent: { id: 'dodgeVent', label: 'Kinetic heat shunt', description: 'Every dodge vents a portion of the current weapon heat.', mechanical: true },
  magRedirect: { id: 'magRedirect', label: 'Revector field', description: 'Magnetic Impulse captures nearby hostile projectiles and redirects them into the fight.', mechanical: true },
  breachPropulsion: { id: 'breachPropulsion', label: 'Backblast coupling', description: 'Breacher recoil becomes a stronger mobility impulse below 0.15g.', mechanical: true },
  markShear: { id: 'markShear', label: 'Shear-map optics', description: 'Marked targets expose weak armor paths, greatly increasing armor damage against them.', mechanical: true },
  arcDrone: { id: 'arcDrone', label: 'Relay microdrone', description: 'A microdrone periodically attacks electronically disrupted targets.', mechanical: true },
};

function gradePercent(value: number) { return Math.max(1, Math.round(value)); }
function gradedDescription(id: AffixId, grade: ModifierGrade) {
  const power = modifierPowerFactor(grade);
  const tradeoff = modifierTradeoffFactor(grade);
  if (id === 'hypervelocity') return `+${gradePercent(18 * power)}% projectile velocity and +${gradePercent(12 * power)} penetration, but +${gradePercent(10 * tradeoff)}% recoil.`;
  if (id === 'countermass') return `-${gradePercent(22 * power)}% recoil, but -${gradePercent(7 * tradeoff)}% direct weapon damage.`;
  if (id === 'overdrive') return `+${gradePercent(14 * power)}% weapon damage, +${gradePercent(20 * tradeoff)}% recoil, and +${gradePercent(12 * tradeoff)}% heat per shot.`;
  if (id === 'cryoloop') return `+${gradePercent(30 * power)}% heat dissipation, but -${gradePercent(8 * tradeoff)} penetration on weapon frames.`;
  if (id === 'extendedFeed') return `+${Math.max(1, Math.round(6 * power))} magazine capacity, but +${gradePercent(12 * tradeoff)}% reload time.`;
  if (id === 'tungsten') return `+${gradePercent(30 * power)}% armor damage and +${gradePercent(14 * power)} penetration, but +${gradePercent(8 * tradeoff)}% heat per shot.`;
  if (id === 'vacuumSeal') return `+${gradePercent(55 * power)}% vacuum/decompression resistance before suit caps.`;
  if (id === 'servoWeave') return `+${gradePercent(8 * power)}% movement speed and stronger low-gravity braking.`;
  if (id === 'capacitorRecycler') return `+${gradePercent(20 * power)}% capacitor regeneration and -${gradePercent(10 * power)}% ability power cost.`;
  if (id === 'railFracture') return `Rail rounds fragment after penetration; fragment energy retains ${gradePercent(35 * power)}% of the triggering round.`;
  if (id === 'dodgeVent') return `Every dodge vents ${gradePercent(22 * power)}% of current weapon heat.`;
  if (id === 'magRedirect') return `Magnetic Impulse redirects hostile projectiles; redirected kinetic payload scales to ${gradePercent(100 * power)}% of the standard return.`;
  if (id === 'breachPropulsion') return `Below 0.15g, Breacher recoil becomes a ${(1 + 0.6 * power).toFixed(2)}x mobility impulse.`;
  if (id === 'markShear') return `Marked targets expose weak armor paths; marked-hit amplification reaches ${gradePercent((0.18 + 0.16 * power) * 100)}%.`;
  return `A relay microdrone attacks disrupted targets for ${gradePercent(8 * power)} damage per cycle.`;
}
export function materializeModifier(id: AffixId, grade: ModifierGrade = 3): ItemModifier { const base = affixes[id]; return { ...base, family: modifierFamilyFor(id), grade, description: gradedDescription(id, grade) }; }

const frameGenerationNames: Record<EquipmentSlot, Record<FrameGeneration, string[]>> = {
  carbine: { 1: ['Dockline M-7 Spine', 'Transit Burst Frame', 'Service Coil Cage'], 2: ['M-8 Countermass Cage', 'Transit M-8 Driver', 'Dockline M-8 Spine'], 3: ['M-9 Hypervelocity Receiver', 'Aster M-9 Coil Spine', 'M-9 Command Cage'], 4: ['M-10 Vector Carbine Spine', 'M-10 Dense-Flight Cage', 'M-10 Recoil-Balanced Driver'], 5: ['M-11 Residual-Flight Spine', 'M-11 Reference Driver', 'M-11 Momentum Cage'], 6: ['M-12 Cross-System Spine', 'M-12 Mature Reference Driver', 'M-12 Open-Bus Cage'] },
  breacher: { 1: ['Kestrel Backblast Frame', 'Breachline B-4 Cage', 'Dockline Scatter Assembly'], 2: ['Kestrel B-5 Counterthrust', 'B-5 Pressure Cage', 'B-5 Dockbreaker Frame'], 3: ['Kestrel B-6 Redline Frame', 'B-6 Dense Scatter Cage', 'B-6 Vector Breacher'], 4: ['Kestrel B-7 Command Scatter', 'B-7 Countermass Breacher', 'B-7 Deep-Pressure Frame'], 5: ['Kestrel B-8 Pendulum Cage', 'B-8 Reference Breacher', 'B-8 Counter-Impulse Frame'], 6: ['Kestrel B-9 Crossfeed Cage', 'B-9 Mature Breacher', 'B-9 Open-Impulse Frame'] },
  rail: { 1: ['Helix Split-Rail', 'Aster Penetrator Rails', 'Needleline Accelerator'], 2: ['Helix R-3 Dense Rails', 'R-3 Aster Accelerator', 'R-3 Needleline Pair'], 3: ['Helix R-4 Hypervelocity Rails', 'R-4 Survey Accelerator', 'R-4 Longline Pair'], 4: ['Helix R-5 Reference Rails', 'R-5 Null-Line Accelerator', 'R-5 Vector Lance Rails'], 5: ['Helix R-6 Cryoline Rails', 'R-6 Residual Accelerator', 'R-6 Cold-Reference Pair'], 6: ['Helix R-7 Split-Reference Rails', 'R-7 Mature Accelerator', 'R-7 Cross-System Pair'] },
  suit: { 1: ['Kestrel Pressure Skin', 'Transit EVA Harness', 'Spinward Assault Suit'], 2: ['Mk II Pressure Harness', 'Reinforced Transit EVA', 'Spinward Mk II Suit'], 3: ['Mk III Vector Pressure Skin', 'Deep-Vacuum Mk III Harness', 'Mk III Assault Shell'], 4: ['Mk IV Recovery Pressure Skin', 'Mk IV Vector EVA', 'Mk IV Deep-Zone Shell'], 5: ['Mk V Residual Pressure Skin', 'Mk V Umbra EVA', 'Mk V Transfer Shell'], 6: ['Mk VI Cross-System Pressure Skin', 'Mk VI Mature EVA', 'Mk VI Open-Bus Shell'] },
  rig: { 1: ['Closed-Loop Thermal Rig', 'Arc Capacitor Pack', 'Vector Utility Bus'], 2: ['Series II Thermal Bus', 'Series II Capacitor Rack', 'Series II Vector Rig'], 3: ['Series III Closed-Loop Rig', 'Series III Pulse Bus', 'Series III Recovery Rack'], 4: ['Series IV Vector Bus', 'Series IV Thermal Governor', 'Series IV Deep-Load Rig'], 5: ['Series V Residual Bus', 'Series V Boiloff Governor', 'Series V Countermass Rig'], 6: ['Series VI Crossfeed Bus', 'Series VI Mature Governor', 'Series VI Open-Route Rig'] },
  implant: { 1: ['Shearline Sensor Link', 'Relay Cognition Node', 'Predictive Vector Implant'], 2: ['Gen II Shearline Link', 'Gen II Relay Node', 'Gen II Predictive Implant'], 3: ['Gen III Vector Cognition Node', 'Gen III Shear-Mapping Link', 'Gen III Relay Implant'], 4: ['Gen IV Reference Cognition Node', 'Gen IV Distributed Link', 'Gen IV Predictive Kernel'], 5: ['Gen V Residual Cognition Node', 'Gen V Mass-Return Link', 'Gen V Cold-Route Kernel'], 6: ['Gen VI Cross-System Node', 'Gen VI Mature Relay Link', 'Gen VI Open-Reference Kernel'] },
};
function frameImplicitFor(slot: EquipmentSlot, generation: FrameGeneration, identity?: FrameIdentityId, quality = 0) { const resolved = identity ?? inferFrameIdentity(slot, `${slot}:${generation}`); return frameImplicitDescription(resolved, generation, quality); }

const baseNames: Record<EquipmentSlot, { baseId: string; equipmentClass: string; names: string[]; core: string; affixes: AffixId[] }> = {
  carbine: { baseId: 'm7-frame', equipmentClass: 'Coil carbine assembly', names: ['Dockline M-7 Spine', 'Transit Burst Frame', 'Service Coil Cage'], core: 'Automatic coil assembly; alters the existing M-7 physical model.', affixes: ['hypervelocity', 'countermass', 'overdrive', 'cryoloop', 'extendedFeed', 'tungsten', 'magRedirect'] },
  breacher: { baseId: 'b4-frame', equipmentClass: 'Breach scattergun assembly', names: ['Kestrel Backblast Frame', 'Breachline B-4 Cage', 'Dockline Scatter Assembly'], core: 'Close-range pressure weapon; trades stopping power, recoil, and heat.', affixes: ['overdrive', 'countermass', 'cryoloop', 'extendedFeed', 'tungsten', 'breachPropulsion', 'dodgeVent'] },
  rail: { baseId: 'r2-frame', equipmentClass: 'Rail-lance assembly', names: ['Helix Split-Rail', 'Aster Penetrator Rails', 'Needleline Accelerator'], core: 'Precision electromagnetic assembly; emphasizes penetration, capacitor demand, and recoil.', affixes: ['hypervelocity', 'countermass', 'overdrive', 'cryoloop', 'tungsten', 'railFracture', 'markShear'] },
  suit: { baseId: 'pressure-suit', equipmentClass: 'Combat pressure suit', names: ['Kestrel Pressure Skin', 'Transit EVA Harness', 'Spinward Assault Suit'], core: 'Layered protection and maneuvering package.', affixes: ['vacuumSeal', 'servoWeave', 'dodgeVent', 'capacitorRecycler'] },
  rig: { baseId: 'power-rig', equipmentClass: 'Power and thermal rig', names: ['Closed-Loop Thermal Rig', 'Arc Capacitor Pack', 'Vector Utility Bus'], core: 'Routes heat, capacitor charge, and ability power.', affixes: ['cryoloop', 'capacitorRecycler', 'dodgeVent', 'magRedirect', 'arcDrone'] },
  implant: { baseId: 'sensor-implant', equipmentClass: 'Neural systems implant', names: ['Shearline Sensor Link', 'Relay Cognition Node', 'Predictive Vector Implant'], core: 'Targeting and electronic-warfare augmentation.', affixes: ['markShear', 'arcDrone', 'magRedirect', 'capacitorRecycler', 'servoWeave'] },
};

export function affixPoolForSlot(slot: EquipmentSlot) { return [...baseNames[slot].affixes]; }

type SingularTemplate = Omit<Item, 'id' | 'levelRequirement'>;
const singular = (template: SingularTemplate): SingularTemplate => template;

const bossSingularPools: Record<string, SingularTemplate[]> = {
  'Recovery Commander Sable Voss': [
    singular({ baseId: 'voss-palisade-m7', name: 'Palisade Doctrine M-7', slot: 'carbine', equipmentClass: 'Meridian command carbine assembly', rarity: 'Singular', core: 'A pressure-rated command frame built around sustained armor work and controlled recoil behind portable cover.', modifiers: [{ ...affixes.tungsten }, { ...affixes.countermass }, { ...affixes.extendedFeed }], singularTrait: 'palisadeDoctrine', singularEffect: 'Stationary carbine fire rebuilds small amounts of armor, rewarding deliberate firing positions.' }),
    singular({ baseId: 'voss-pressure-mantle', name: 'Compact Pressure Mantle', slot: 'suit', equipmentClass: 'Meridian recovery pressure suit', rarity: 'Singular', core: 'Layered Compact recovery armor designed to stay mobile while pressure lanes and barricades change around the operator.', modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: 'pressureMantle', singularEffect: 'Cycling pressure controls or sealing a rupture restores armor and clears vacuum exposure.' }),
    singular({ baseId: 'voss-lockstep-rig', name: 'Lockstep Command Rig', slot: 'rig', equipmentClass: 'Meridian pressure-control rig', rarity: 'Singular', core: 'A command bus that couples thermal control, capacitor recovery, and magnetic interception.', modifiers: [{ ...affixes.magRedirect }, { ...affixes.cryoloop }, { ...affixes.capacitorRecycler }], singularTrait: 'lockstepArc', singularEffect: 'Arc Tap through machinery restores armor and capacitor while propagating disruption.' }),
  ],
  'Salvage Captain Rhea Kade': [
    singular({ baseId: 'rhea-backblast-b4', name: "Rhea's Backblast Kestrel", slot: 'breacher', equipmentClass: 'Long Arc recoil-mobility scatter assembly', rarity: 'Singular', core: 'A field-cut Kestrel frame that treats every discharge as both a weapon event and a movement decision.', modifiers: [{ ...affixes.breachPropulsion }, { ...affixes.countermass }, { ...affixes.dodgeVent }], singularTrait: 'rheaBackblast', singularEffect: 'Breacher shots produce extreme controlled backblast and accelerate the next dodge cycle.' }),
    singular({ baseId: 'rhea-tether-link', name: 'Tetherhand Sensor Link', slot: 'implant', equipmentClass: 'Long Arc magnetic-rigging implant', rarity: 'Singular', core: 'Predictive rigging telemetry built to read movement, magnetic vectors, and exposed armor paths as one problem.', modifiers: [{ ...affixes.magRedirect }, { ...affixes.servoWeave }, { ...affixes.markShear }], singularTrait: 'tetherhand', singularEffect: 'Sensor Spike leaves a short magnetic tether well on the marked target.' }),
    singular({ baseId: 'rhea-scrapline-suit', name: 'Scrapline Countermass Suit', slot: 'suit', equipmentClass: 'Long Arc salvage pressure suit', rarity: 'Singular', core: 'A patched maneuvering shell with exceptional low-g recovery and emergency heat shedding.', modifiers: [{ ...affixes.servoWeave }, { ...affixes.dodgeVent }, { ...affixes.vacuumSeal }], singularTrait: 'scraplineDodge', singularEffect: 'Dodges below 0.35g travel farther and recover faster, turning low gravity into an offensive resource.' }),
  ],
  'HELIOS-9 Yardmind': [
    singular({ baseId: 'helios-thermal-governor', name: 'HELIOS-9 Thermal Governor', slot: 'rig', equipmentClass: 'Autonomous fabrication thermal rig', rarity: 'Singular', core: 'Recovered process-control hardware that treats operator heat, capacitor load, and relay drones as one thermal network.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: 'thermalGovernor', singularEffect: 'Manual venting dumps heat from every weapon and advances all ability cooldowns.' }),
    singular({ baseId: 'helios-machine-sight', name: 'Machine-Sight Cognition Node', slot: 'implant', equipmentClass: 'Industrial control cognition implant', rarity: 'Singular', core: 'A legal-safe reconstruction of the Yardmind targeting layer, retaining its machine-to-machine disruption logic.', modifiers: [{ ...affixes.arcDrone }, { ...affixes.markShear }, { ...affixes.magRedirect }], singularTrait: 'machineSight', singularEffect: 'Arc Tap through machinery seeks an additional disrupted target beyond the normal propagation radius.' }),
    singular({ baseId: 'helios-fracture-rails', name: 'Sunward Fracture Rails', slot: 'rail', equipmentClass: 'Solar-yard precision rail assembly', rarity: 'Singular', core: 'Fabrication rails tuned for extreme projectile velocity, thermal recovery, and controlled post-penetration fragmentation.', modifiers: [{ ...affixes.railFracture }, { ...affixes.hypervelocity }, { ...affixes.cryoloop }], singularTrait: 'sunwardFracture', singularEffect: 'High-heat Rail Lance shots split into two narrow secondary vectors at the muzzle.' }),
  ],
  'Transfer Adjudicator Iona Vale': [
    singular({ baseId: 'vale-vector-spool-m11', name: 'Vale Vector-Spool M-11', slot: 'carbine', equipmentClass: 'Transfer-lane strafe carbine assembly', rarity: 'Singular', core: 'An adjudicator receiver that stabilizes only when the operator carries a lateral movement vector across the firing solution.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.servoWeave }], singularTrait: 'inertiaSpool', singularEffect: 'While moving fast across the aim line, carbine fire gains damage and velocity while shedding most recoil.' }),
    singular({ baseId: 'vale-clutchstep-harness', name: 'Clutchstep Countermass Harness', slot: 'suit', equipmentClass: 'Field-consuming countermass maneuvering suit', rarity: 'Singular', core: 'A clutch-timed harness built to collapse a nearby mass field during a committed dodge and bank the recovered impulse.', modifiers: [{ ...affixes.countermass }, { ...affixes.dodgeVent }, { ...affixes.capacitorRecycler }], singularTrait: 'clutchstep', singularEffect: 'Dodging near a gravity or countermass field consumes it, restores capacitor, and shortens dodge recovery.' }),
    singular({ baseId: 'vale-flywheel-ledger-rig', name: 'Flywheel Ledger Rig', slot: 'rig', equipmentClass: 'Rail recoil accounting rig', rarity: 'Singular', core: 'A transfer-control bus that books rail discharge impulse back into the capacitor ledger instead of cancelling it.', modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.overdrive }, { ...affixes.magRedirect }], singularTrait: 'recoilLedger', singularEffect: 'Rail shots refund capacitor but produce substantially more recoil, turning every lance into a movement commitment.' }),
  ],
  'Umbra Systems Marshal Oren Saal': [
    singular({ baseId: 'saal-cold-start-kestrel', name: 'Umbra Cold-Start Kestrel', slot: 'breacher', equipmentClass: 'Cold-bus cryogenic scattergun', rarity: 'Singular', core: 'A reserve-yard breach frame tuned around the first discharge after a full thermal reset.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.tungsten }, { ...affixes.breachPropulsion }], singularTrait: 'coldStartBreach', singularEffect: 'A Breacher shot from a cold bus gains damage, penetration, and velocity but adds extra heat.' }),
    singular({ baseId: 'saal-purgewake-rig', name: 'Purgewake Thermal Rig', slot: 'rig', equipmentClass: 'Low-pressure vent-thrust systems rig', rarity: 'Singular', core: 'A vent manifold that deliberately turns low-pressure thermal rejection into a short physical thrust plume.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.dodgeVent }, { ...affixes.servoWeave }], singularTrait: 'purgeWake', singularEffect: 'Manual venting below 45% pressure emits a player-owned coolant thrust plume that pushes and staggers enemies.' }),
    singular({ baseId: 'saal-grid-reclaimer-link', name: 'Saal Grid-Reclaimer Link', slot: 'implant', equipmentClass: 'Electrical rerouting cognition implant', rarity: 'Singular', core: 'A systems-marshal link that recognizes hostile floor grids as recoverable bus topology.', modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.markShear }], singularTrait: 'gridReclaimer', singularEffect: 'Arc Tap through machinery can collapse a nearby hostile shock grid, restoring capacitor and cooling the active weapon.' }),
  ],
  'Custody Director Mara Teth': [
    singular({ baseId: 'teth-custody-shear-optics', name: 'Custody Shear Optics', slot: 'implant', equipmentClass: 'Mission-custody targeting implant', rarity: 'Singular', core: 'A custody-control prediction layer designed to separate an operator from hardware being physically removed from the worksite.', modifiers: [{ ...affixes.markShear }, { ...affixes.magRedirect }, { ...affixes.capacitorRecycler }], singularTrait: 'custodyShear', singularEffect: 'Sensor Spike forces a marked objective carrier to drop mission hardware immediately and can strip nearby hostile support relays.' }),
    singular({ baseId: 'teth-shutterline-r6', name: 'Shutterline R-6', slot: 'rail', equipmentClass: 'Partition-coupled precision rail assembly', rarity: 'Singular', core: 'A custody-lane accelerator that uses destructible partition material as an intermediate magnetic reference rather than an obstruction.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.railFracture }, { ...affixes.tungsten }], singularTrait: 'shutterLine', singularEffect: 'Rail rounds punch through destructible non-bulkhead cover without their normal damage loss and gain penetration and velocity.' }),
    singular({ baseId: 'teth-archive-relay-dynamo', name: 'Archive Relay Dynamo', slot: 'rig', equipmentClass: 'Destruction-triggered custody relay rig', rarity: 'Singular', core: 'A recovered archive bus that converts the electrical collapse of battlefield hardware into an offensive disruption pulse.', modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.overdrive }], singularTrait: 'archiveRelay', singularEffect: 'Destroying cover or machinery emits an Arc pulse that disrupts and conducts nearby enemies.' }),
  ],
  'Survey Custodian Veyra Senn': [
    singular({ baseId: 'khepri-null-rails', name: 'Khepri Null-Reference Rails', slot: 'rail', equipmentClass: 'Survey metrology rail assembly', rarity: 'Singular', core: 'A Khepri reference-frame accelerator rebuilt around interruption timing and straight-line metrology.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.markShear }], singularTrait: 'nullpoint', singularEffect: 'Rail hits during an enemy telegraph cancel that attack and refund capacitor.' }),
    singular({ baseId: 'khepri-vector-harness', name: 'Khepri Calibration Harness', slot: 'suit', equipmentClass: 'Survey calibration maneuvering suit', rarity: 'Singular', core: 'A low-mass survey harness designed to recapture movement energy during repeated reference passes.', modifiers: [{ ...affixes.servoWeave }, { ...affixes.countermass }, { ...affixes.capacitorRecycler }], singularTrait: 'atlasDodgeCap', singularEffect: 'Dodging converts pre-dodge movement speed into capacitor charge.' }),
    singular({ baseId: 'khepri-surveyor-node', name: 'Surveyor Relay Cognition Node', slot: 'implant', equipmentClass: 'Khepri distributed metrology implant', rarity: 'Singular', core: 'A survey-network cognition layer that treats exposed machinery as part of a distributed targeting reference.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: 'relayCrown', singularEffect: 'Sensor Spike jumps through nearby exposed machinery to additional enemies around that machine.' }),
  ],
};

const chaseCatalog: SingularTemplate[] = [
  singular({ baseId: 'vacuum-choir-rails', name: 'Vacuum Choir Rails', slot: 'rail', equipmentClass: 'Pressure-shear rail assembly', rarity: 'Singular', core: 'A rail package built around controlled transient pressure collapse along the firing vector.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.vacuumSeal }, { ...affixes.railFracture }], singularTrait: 'vacuumWake', singularEffect: 'Rail shots create a temporary low-pressure wake that pulls, staggers, and abrades nearby enemies.' }),
  singular({ baseId: 'atlas-countermass-harness', name: 'Atlas Countermass Harness', slot: 'suit', equipmentClass: 'Momentum-recovery maneuvering harness', rarity: 'Singular', core: 'A heavy maneuvering lattice that recaptures operator momentum instead of merely cancelling it.', modifiers: [{ ...affixes.countermass }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: 'atlasDodgeCap', singularEffect: 'Dodging converts pre-dodge movement speed into capacitor charge.' }),
  singular({ baseId: 'redline-kestrel', name: 'Redline Kestrel', slot: 'breacher', equipmentClass: 'Velocity-coupled breach scattergun', rarity: 'Singular', core: 'A dangerous Kestrel tune that assumes the operator is already moving when the trigger breaks.', modifiers: [{ ...affixes.overdrive }, { ...affixes.breachPropulsion }, { ...affixes.dodgeVent }], singularTrait: 'redlineVelocity', singularEffect: 'Breacher pellet damage scales with current operator velocity at the instant of firing.' }),
  singular({ baseId: 'long-arc-relay-crown', name: 'Long Arc Relay Crown', slot: 'implant', equipmentClass: 'Distributed salvage-network implant', rarity: 'Singular', core: 'An improvised cognition crown that treats damaged machinery as an extension of the targeting network.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: 'relayCrown', singularEffect: 'Sensor Spike jumps through nearby exposed machinery to additional enemies around that machine.' }),
  singular({ baseId: 'arcspindle-m7', name: 'Arcspindle M-7', slot: 'carbine', equipmentClass: 'Conductive-feedback coil carbine', rarity: 'Singular', core: 'A carbine bus that harvests charge from already-disrupted targets.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.magRedirect }, { ...affixes.capacitorRecycler }], singularTrait: 'arcspindle', singularEffect: 'Carbine hits against disrupted or conductive enemies return capacitor charge.' }),
  singular({ baseId: 'ghostline-m7', name: 'Ghostline M-7', slot: 'carbine', equipmentClass: 'Vacuum-optimized coil carbine', rarity: 'Singular', core: 'A low-pressure frame whose projectile timing assumes almost no atmospheric drag or operator footing.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.vacuumSeal }], singularTrait: 'ghostline', singularEffect: 'Below 35% pressure, carbine rounds gain major velocity and penetration while recoil collapses.' }),
  singular({ baseId: 'borecutter-m7', name: 'Borecutter M-7', slot: 'carbine', equipmentClass: 'Industrial breaching coil carbine', rarity: 'Singular', core: 'A repurposed mining driver designed to turn cover and exposed machine housings into ammunition problems.', modifiers: [{ ...affixes.tungsten }, { ...affixes.extendedFeed }, { ...affixes.markShear }], singularTrait: 'borecutter', singularEffect: 'Player fire deals greatly increased damage to destructible cover and machinery.' }),
  singular({ baseId: 'stormline-ventgun', name: 'Stormline Ventgun', slot: 'breacher', equipmentClass: 'Pressure-gradient scattergun', rarity: 'Singular', core: 'A gas-harvester weapon that deliberately couples muzzle impulse to nearby pressure gradients.', modifiers: [{ ...affixes.breachPropulsion }, { ...affixes.vacuumSeal }, { ...affixes.cryoloop }], singularTrait: 'stormVentgun', singularEffect: 'Breacher fire near an active breach gains damage and knockback while shedding some heat.' }),
  singular({ baseId: 'nullpoint-needle', name: 'Nullpoint Needle', slot: 'rail', equipmentClass: 'Telegraph-interrupt precision rail', rarity: 'Singular', core: 'A timing-critical accelerator tuned to break hostile firing solutions during the commitment window.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.markShear }, { ...affixes.countermass }], singularTrait: 'nullpoint', singularEffect: 'Rail hits during an enemy telegraph cancel that attack and refund capacitor.' }),
  singular({ baseId: 'glasswalker-eva', name: 'Glasswalker EVA Skin', slot: 'suit', equipmentClass: 'Hard-vacuum mobility suit', rarity: 'Singular', core: 'An EVA shell that stops pretending vacuum should feel like a pressurized deck.', modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.countermass }], singularTrait: 'glasswalker', singularEffect: 'In near-vacuum, acceleration and maximum movement speed increase instead of collapsing into cautious footing.' }),
  singular({ baseId: 'cryostack-burn-rig', name: 'Cryostack Burn Rig', slot: 'rig', equipmentClass: 'Overheat-conversion systems rig', rarity: 'Singular', core: 'A thermal stack that converts deliberate redline operation into short control-system windows.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.overdrive }, { ...affixes.capacitorRecycler }], singularTrait: 'cryostack', singularEffect: 'Crossing into weapon overheat advances all ability cooldowns, rewarding deliberate redline bursts.' }),
  singular({ baseId: 'salvage-dynamo-rig', name: 'Salvage Dynamo Rig', slot: 'rig', equipmentClass: 'Destruction-recovery field rig', rarity: 'Singular', core: 'Long Arc salvage hardware that treats collapsing battlefield machinery as an energy source.', modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.arcDrone }, { ...affixes.dodgeVent }], singularTrait: 'salvageDynamo', singularEffect: 'Destroying destructible cover or machinery restores capacitor and cools the current weapon.' }),
  singular({ baseId: 'deadreckon-optics', name: 'Deadreckon Optics', slot: 'implant', equipmentClass: 'Kill-confirmation targeting implant', rarity: 'Singular', core: 'A predictive targeting layer that treats a completed marked kill as the start of the next firing solution.', modifiers: [{ ...affixes.markShear }, { ...affixes.hypervelocity }, { ...affixes.capacitorRecycler }], singularTrait: 'deadreckon', singularEffect: 'Killing a marked enemy nearly resets Sensor Spike.' }),
  singular({ baseId: 'jovian-stormskin', name: 'Jovian Stormskin', slot: 'suit', equipmentClass: 'Electrostatic harvester pressure suit', rarity: 'Singular', core: 'A conductive storm-deck skin that routes electrical hazard load into the operator bus.', modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.capacitorRecycler }, { ...affixes.servoWeave }], singularTrait: 'stormskin', singularEffect: 'Shock-grid damage is heavily reduced and partially converted into capacitor charge.' }),
  singular({ baseId: 'axis-ghost-rig', name: 'Axis Ghost Rig', slot: 'rig', equipmentClass: 'Near-zero-g impulse rig', rarity: 'Singular', core: 'Spin-habitat maneuvering hardware designed for the almost weightless axis rather than the inhabited rim.', modifiers: [{ ...affixes.dodgeVent }, { ...affixes.magRedirect }, { ...affixes.servoWeave }], singularTrait: 'axisGhost', singularEffect: 'Dodging below 0.12g emits a radial impulse that throws nearby enemies away.' }),
  singular({ baseId: 'pendulum-kestrel', name: 'Pendulum Kestrel', slot: 'breacher', equipmentClass: 'Counter-impulse breach scattergun', rarity: 'Singular', core: 'A transfer-lane Kestrel calibrated to spend an incoming movement vector instead of adding another one.', modifiers: [{ ...affixes.countermass }, { ...affixes.breachPropulsion }, { ...affixes.capacitorRecycler }], singularTrait: 'pendulumBreach', singularEffect: 'Firing the Breacher against your current direction of travel brakes momentum, amplifies the shot, and returns capacitor charge.' }),
  singular({ baseId: 'mass-return-crown', name: 'Mass-Return Crown', slot: 'implant', equipmentClass: 'Countermass field cognition implant', rarity: 'Singular', core: 'An exchange-control cognition layer that can identify a local gravity or countermass field as recoverable bus energy.', modifiers: [{ ...affixes.magRedirect }, { ...affixes.capacitorRecycler }, { ...affixes.servoWeave }], singularTrait: 'massTap', singularEffect: 'Magnetic Impulse consumes one nearby gravity/countermass field and converts it into capacitor charge.' }),
  singular({ baseId: 'umbra-heatsink-rig', name: 'Umbra Heat-Sink Rig', slot: 'rig', equipmentClass: 'Cryogenic purge recovery rig', rarity: 'Singular', core: 'A reserve-yard thermal bus that treats cryogenic purge exposure as useful sink capacity instead of pure hazard.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.capacitorRecycler }, { ...affixes.dodgeVent }], singularTrait: 'boiloffSink', singularEffect: 'Coolant and boiloff plumes cool all weapons and convert the normal boiloff capacitor loss into charge.' }),
  singular({ baseId: 'cryoline-reference-rails', name: 'Cryoline Reference Rails', slot: 'rail', equipmentClass: 'Cold-start precision rail assembly', rarity: 'Singular', core: 'A metrology accelerator built around the first cold shot after a thermal reset rather than sustained redline operation.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.hypervelocity }, { ...affixes.markShear }], singularTrait: 'cryolineRail', singularEffect: 'Rail shots fired from a cold weapon bus gain major damage and penetration, rewarding deliberate thermal resets.' }),
  singular({ baseId: 'breathless-choir-mantle', name: 'Breathless Choir Mantle', slot: 'suit', equipmentClass: 'Vacuum-pulse maneuvering pressure suit', rarity: 'Singular', core: 'A damaged-vessel EVA shell that deliberately spends bus charge to leave a controllable pressure discontinuity behind a dodge.', modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: 'pressureReservoir', singularEffect: 'Dodging below 35% pressure spends 8 capacitor to leave a short player-owned low-pressure wake; no charge means no wake.' }),
  singular({ baseId: 'vector-debt-m12', name: 'Vector Debt M-12', slot: 'carbine', equipmentClass: 'Recoil-accounting coil carbine', rarity: 'Singular', core: 'A transfer-exchange receiver that deliberately refuses to cancel all recoil because the operator bus can collect part of the impulse debt.', modifiers: [{ ...affixes.countermass }, { ...affixes.capacitorRecycler }, { ...affixes.hypervelocity }], singularTrait: 'recoilDynamo', singularEffect: 'Carbine recoil is amplified but converted into a capped capacitor return on each shot; it never stacks additively with other recoil refunds.' }),
  singular({ baseId: 'relay-orchard-node', name: 'Relay Orchard Node', slot: 'implant', equipmentClass: 'Machine-network propagation implant', rarity: 'Singular', core: 'A solar-yard routing layer that treats exposed machinery as a temporary orchard of targeting relays rather than a single conduit.', modifiers: [{ ...affixes.arcDrone }, { ...affixes.markShear }, { ...affixes.capacitorRecycler }], singularTrait: 'relayOrchard', singularEffect: 'Arc Tap through machinery marks up to two nearby enemies and trims Sensor Spike recovery.' }),
  singular({ baseId: 'cold-witness-r7', name: 'Cold Witness R-7', slot: 'rail', equipmentClass: 'Mark-consuming survey rail assembly', rarity: 'Singular', core: 'A lattice-annex accelerator built to spend a verified Sensor Spike solution on one decisive follow-up rather than keep the target painted.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.markShear }, { ...affixes.cryoloop }], singularTrait: 'coldWitness', singularEffect: 'A Rail hit consumes an active mark, cools the rail bus, and leaves a short Armor Breach window.' }),
  singular({ baseId: 'radiant-liability-kestrel', name: 'Radiant Liability Kestrel', slot: 'breacher', equipmentClass: 'Defensive redline scatter assembly', rarity: 'Singular', core: 'A solar-yard Kestrel that routes the thermal liability of near-overheat firing into suit plate servos instead of treating redline as a pure failure state.', modifiers: [{ ...affixes.overdrive }, { ...affixes.cryoloop }, { ...affixes.tungsten }], singularTrait: 'redlineBulwark', singularEffect: 'Breacher hits above 75% heat rebuild small amounts of armor, but each redline shot adds extra heat.' }),
  singular({ baseId: 'palisade-breaker-b9', name: 'Palisade Breaker B-9', slot: 'breacher', equipmentClass: 'Close armor-demolition scatter assembly', rarity: 'Singular', core: 'An orbital boarding cage designed to turn point-blank plate failure into space control instead of chasing raw health damage.', modifiers: [{ ...affixes.tungsten }, { ...affixes.countermass }, { ...affixes.extendedFeed }], singularTrait: 'closeBreach', singularEffect: 'Inside 300 units, Breacher pellets gain a capped armor-damage conversion but lose direct-health efficiency.' }),
  singular({ baseId: 'capacitor-rosary-rig', name: 'Capacitor Rosary Rig', slot: 'rig', equipmentClass: 'Ability-sequence power bus', rarity: 'Singular', core: 'An Umbra service rig whose switching relays are arranged around deliberate MAG/MARK/ARC sequencing rather than one favored ability.', modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.cryoloop }, { ...affixes.arcDrone }], singularTrait: 'abilityRosary', singularEffect: 'Using a different ability within the combo window cools the active weapon and trims the previous ability recovery.' }),
  singular({ baseId: 'vacuum-psalm-m12', name: 'Vacuum Psalm M-12', slot: 'carbine', equipmentClass: 'Pressure-dependent coil carbine', rarity: 'Singular', core: 'A gas-harvester receiver whose flight timing is tuned for thin atmosphere and deliberately feels sluggish on a fully pressurized deck.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.vacuumSeal }, { ...affixes.countermass }], singularTrait: 'pressureBallistics', singularEffect: 'Below 45% pressure, carbine rounds gain velocity and penetration; above 75% pressure, projectile velocity is reduced.' }),
  singular({ baseId: 'falling-star-harness', name: 'Falling Star Harness', slot: 'suit', equipmentClass: 'Momentum-to-targeting maneuvering suit', rarity: 'Singular', core: 'A spin-habitat harness that turns a committed approach vector into a targeting handoff as the operator exits the dodge.', modifiers: [{ ...affixes.servoWeave }, { ...affixes.countermass }, { ...affixes.markShear }], singularTrait: 'momentumMark', singularEffect: 'Dodging with high pre-dodge speed spends 6 capacitor to mark the nearest visible enemy.' }),
  singular({ baseId: 'scrap-circuit-rig', name: 'Scrap Circuit Rig', slot: 'rig', equipmentClass: 'Destruction-to-Arc recovery bus', rarity: 'Singular', core: 'An ice-mine field bus that uses the electrical collapse of machinery to precharge Arc Tap instead of harvesting the wreck for raw damage.', modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.dodgeVent }], singularTrait: 'scrapCircuit', singularEffect: 'Destroying machinery spends 4 capacitor to advance Arc Tap recovery by 0.9 seconds.' }),
  singular({ baseId: 'eventide-eva-skin', name: 'Eventide EVA Skin', slot: 'suit', equipmentClass: 'Cryogenic-plume maneuvering suit', rarity: 'Singular', core: 'An Umbra EVA skin built to cross service-purge geometry by consuming it as a one-shot maneuvering resource.', modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.dodgeVent }], singularTrait: 'boiloffDash', singularEffect: 'Dodging through a nearby coolant or boiloff plume spends 8 capacitor, consumes one plume, extends the dash, and cools all weapons.' }),
  singular({ baseId: 'khepri-split-reference-link', name: 'Khepri Split-Reference Link', slot: 'implant', equipmentClass: 'Marked-machine Arc cognition implant', rarity: 'Singular', core: 'A Khepri reconstruction that spends a mark as permission to use nearby machinery as a second electrical origin.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.magRedirect }], singularTrait: 'splitReference', singularEffect: 'Arc Tap on a marked target consumes the mark and can relay through nearby machinery into a second enemy.' }),
  singular({ baseId: 'sixth-vector-m12', name: 'Sixth-Vector M-12', slot: 'carbine', equipmentClass: 'Cadence-fork coil carbine', rarity: 'Singular', core: 'A counter-rotating feed cage stores a firing solution for exactly five ordinary pulses before opening two side vectors on the sixth.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.extendedFeed }, { ...affixes.overdrive }], singularTrait: 'forkedSpool', singularEffect: 'Every sixth Carbine shot forks two 55% side vectors. The forked shot adds extra heat, rewarding deliberate cadence rather than permanent free damage.' }),
  singular({ baseId: 'backstep-kestrel-b9', name: 'Backstep Kestrel B-9', slot: 'breacher', equipmentClass: 'Counterstep breach scattergun', rarity: 'Singular', core: 'A recoil latch reads suit-thruster transients and briefly opens a second scatter gate after a committed evasive burn.', modifiers: [{ ...affixes.countermass }, { ...affixes.breachPropulsion }, { ...affixes.dodgeVent }], singularTrait: 'breachEcho', singularEffect: 'A Breacher shot within 0.65s of a dodge gains a three-pellet 55% echo cone, but the echoed shot adds extra heat.' }),
  singular({ baseId: 'cold-doublet-r7', name: 'Cold Doublet R-7', slot: 'rail', equipmentClass: 'Cold-start paired rail lance', rarity: 'Singular', core: 'Two unequal accelerator rails share a cryogenic bus: the secondary rail is stable only before the primary assembly warms.', modifiers: [{ ...affixes.cryoloop }, { ...affixes.tungsten }, { ...affixes.countermass }], singularTrait: 'railDoublet', singularEffect: 'Below 22% Rail heat and with 8 spare capacitor, each Rail shot launches a second 58% penetrator. The doublet consumes the extra capacitor and adds heat.' }),
  singular({ baseId: 'bloom-vector-rig', name: 'Bloom Vector Rig', slot: 'rig', equipmentClass: 'Radial impulse recovery rig', rarity: 'Singular', core: 'A ring of sacrificial micro-coils turns the MAG field collapse into a brief omnidirectional kinetic bloom.', modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.magRedirect }, { ...affixes.servoWeave }], singularTrait: 'magBloom', singularEffect: 'MAG fires eight radial kinetic micro-slugs after the impulse. Magnetic Impulse costs 25% more capacitor and recovers 8% slower.' }),
  singular({ baseId: 'cascade-sight-link', name: 'Cascade Sight Link', slot: 'implant', equipmentClass: 'Kill-relay sensor cognition link', rarity: 'Singular', core: 'A narrowband target model refuses to hold one solution for long, but transfers the dying target state into the nearest live return.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: 'markCascade', singularEffect: 'Killing a marked target relays a 4.2s mark to a nearby enemy. Initial Sensor Spike marks are shorter and Sensor Spike recovers 12% slower.' }),
];

const locationChaseIds: Record<string, string[]> = {
  'orbital-station': ['arcspindle-m7', 'deadreckon-optics', 'palisade-breaker-b9', 'sixth-vector-m12', 'cascade-sight-link'],
  'damaged-vessel': ['vacuum-choir-rails', 'glasswalker-eva', 'salvage-dynamo-rig', 'breathless-choir-mantle', 'backstep-kestrel-b9'],
  'asteroid-refinery': ['borecutter-m7', 'cryostack-burn-rig', 'nullpoint-needle', 'cold-doublet-r7'],
  'spin-habitat': ['atlas-countermass-harness', 'axis-ghost-rig', 'ghostline-m7', 'falling-star-harness', 'bloom-vector-rig'],
  'jovian-harvester': ['stormline-ventgun', 'jovian-stormskin', 'vacuum-choir-rails', 'vacuum-psalm-m12', 'sixth-vector-m12'],
  'ice-mine': ['redline-kestrel', 'long-arc-relay-crown', 'salvage-dynamo-rig', 'scrap-circuit-rig', 'backstep-kestrel-b9'],
  'solar-yard': ['nullpoint-needle', 'arcspindle-m7', 'cryostack-burn-rig', 'relay-orchard-node', 'radiant-liability-kestrel', 'bloom-vector-rig'],
  'lattice-annex': ['nullpoint-needle', 'deadreckon-optics', 'vacuum-choir-rails', 'cold-witness-r7', 'khepri-split-reference-link', 'cascade-sight-link'],
  'momentum-exchange': ['pendulum-kestrel', 'mass-return-crown', 'vector-debt-m12', 'sixth-vector-m12'],
  'cryo-reserve': ['umbra-heatsink-rig', 'cryoline-reference-rails', 'capacitor-rosary-rig', 'eventide-eva-skin', 'cold-doublet-r7'],
};

function inferFactionFromBaseId(baseId: string): EquipmentFaction | undefined {
  if (baseId.startsWith('voss-')) return 'meridian';
  if (baseId.startsWith('rhea-') || baseId === 'long-arc-relay-crown' || baseId === 'salvage-dynamo-rig') return 'longarc';
  if (baseId.startsWith('helios-')) return 'heliostat';
  return undefined;
}

function makeSingularItem(template: SingularTemplate, prefix: string, index: number, level: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, frameOperatorLevel = level): Item {
  const frameGeneration = frameGenerationForRecovery(recoveryLevel, frameOperatorLevel);
  const frameIdentity = singularFrameIdentity(template.slot, template.baseId);
  const equipmentQuality = Math.max(4, equipmentQualityForRecovery(recoveryQuality, frameGeneration, 'Singular'));
  const augmentSlots = augmentSlotCount('Singular', frameGeneration);
  return {
    ...template,
    id: `${prefix}-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`,
    levelRequirement: levelRequirementForRecovery(recoveryLevel),
    modifiers: template.modifiers.map(modifier => materializeModifier(modifier.id, modifier.grade ?? 3)),
    faction: template.faction ?? inferFactionFromBaseId(template.baseId),
    recoveryLevel,
    frameGeneration,
    frameIdentity,
    frameImplicit: frameImplicitFor(template.slot, frameGeneration, frameIdentity, equipmentQuality),
    equipmentQuality,
    augmentSlots,
    augments: [],
    recoveryQuality,
    recoverySource,
  };
}

function makeBossSingular(deepTarget: string, index: number, level: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, frameOperatorLevel = level): Item | null {
  const pool = bossSingularPools[deepTarget];
  if (!pool?.length) return null;
  return makeSingularItem(pool[Math.floor(random() * pool.length)], 'boss', index, level, random, recoveryLevel, recoveryQuality, recoverySource, frameOperatorLevel);
}

const level15ChaseIds = new Set(['breathless-choir-mantle', 'vector-debt-m12', 'relay-orchard-node', 'cold-witness-r7', 'radiant-liability-kestrel', 'palisade-breaker-b9', 'capacitor-rosary-rig', 'vacuum-psalm-m12', 'falling-star-harness', 'scrap-circuit-rig', 'eventide-eva-skin', 'khepri-split-reference-link']);
function locationPool(location: string, operatorLevel = 16) {
  const ids = new Set(locationChaseIds[location] ?? []);
  return chaseCatalog.filter(item => ids.has(item.baseId) && (operatorLevel >= 15 || !level15ChaseIds.has(item.baseId)));
}

function makeLocationSingular(location: string, index: number, level: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, sourceOperatorLevel = level): Item | null {
  const pool = locationPool(location, sourceOperatorLevel);
  if (!pool.length) return null;
  return makeSingularItem(pool[Math.floor(random() * pool.length)], 'chase', index, level, random, recoveryLevel, recoveryQuality, recoverySource, sourceOperatorLevel);
}

export function bossSingularNames(deepTarget: string) { return (bossSingularPools[deepTarget] ?? []).map(item => item.name); }
export function locationSingularNames(location: string, operatorLevel = 16) { return locationPool(location, operatorLevel).map(item => item.name); }
export const namedSingularCount = Object.values(bossSingularPools).reduce((total, pool) => total + pool.length, 0) + chaseCatalog.length;

export const progressionNodes: ProgressionNode[] = [
  { id: 'ballistics-1', branch: 'Ballistics', name: 'Dense Flight', description: '+8 penetration to all player projectiles.' }, { id: 'ballistics-2', branch: 'Ballistics', name: 'Armor Work', description: '+15% armor damage.', requires: 'ballistics-1' }, { id: 'ballistics-3', branch: 'Ballistics', name: 'Breach Doctrine', description: 'Armor Breach lasts longer, but direct health damage is slightly reduced.', major: true, requires: 'ballistics-2' },
  { id: 'mobility-1', branch: 'Mobility', name: 'Servo Timing', description: '+6% movement speed.' }, { id: 'mobility-2', branch: 'Mobility', name: 'Low-G Footwork', description: 'Improved stopping control below 0.35g.', requires: 'mobility-1' }, { id: 'mobility-3', branch: 'Mobility', name: 'Recoil Vectoring', description: 'While moving, 35% of weapon recoil is redirected into your chosen movement vector.', major: true, requires: 'mobility-2' },
  { id: 'systems-1', branch: 'Systems', name: 'Efficient Bus', description: '+12% capacitor regeneration.' }, { id: 'systems-2', branch: 'Systems', name: 'Signal Compression', description: '-8% ability capacitor cost.', requires: 'systems-1' }, { id: 'systems-3', branch: 'Systems', name: 'Disruption Relay', description: 'Electronically disrupted targets can be serviced by a relay microdrone.', major: true, requires: 'systems-2' },
  { id: 'survival-1', branch: 'Survival', name: 'Layered Plate', description: '+12 maximum armor.' }, { id: 'survival-2', branch: 'Survival', name: 'Pressure Discipline', description: 'Vacuum exposure builds more slowly.', requires: 'survival-1' }, { id: 'survival-3', branch: 'Survival', name: 'Hard Vacuum Familiarity', description: 'Greatly reduces vacuum damage and decompression pull.', major: true, requires: 'survival-2' },
  { id: 'engineering-1', branch: 'Engineering', name: 'Thermal Routing', description: '+12% weapon heat dissipation.' }, { id: 'engineering-2', branch: 'Engineering', name: 'Quick Vent', description: 'Manual vent cycles complete faster.', requires: 'engineering-1' }, { id: 'engineering-3', branch: 'Engineering', name: 'Dodge Heat Shunt', description: 'Dodging vents weapon heat.', major: true, requires: 'engineering-2' },
  { id: 'awareness-1', branch: 'Awareness', name: 'Predictive Lead', description: '+8% projectile velocity.' }, { id: 'awareness-2', branch: 'Awareness', name: 'Weak-Path Telemetry', description: 'Marked targets take more armor damage.', requires: 'awareness-1' }, { id: 'awareness-3', branch: 'Awareness', name: 'Penetration Optics', description: 'Sensor-marked targets expose penetration paths to all weapons.', major: true, requires: 'awareness-2' },
];
export const abilityMods: AbilityMod[] = [
  { id: 'mag-revector', ability: 'mag', name: 'Revector Lens', description: 'Magnetic Impulse redirects hostile projectiles as friendly kinetic vectors.', tradeoff: '+25% capacitor cost and +10% cooldown.' }, { id: 'mag-overdrive', ability: 'mag', name: 'Impulse Overdrive', description: '+45% displacement strength.', tradeoff: 'The operator receives a stronger counter-impulse.' }, { id: 'mag-boundary', ability: 'mag', name: 'Boundary Sink', description: 'Magnetic Impulse collapses one nearby gravity, countermass, boiloff, or hostile grid field and turns its geometry into an outward impulse.', tradeoff: '+20% capacitor cost; only one field can be consumed per cast.' },
  { id: 'mark-shear', ability: 'mark', name: 'Shear Map', description: 'Marked enemies expose weak armor paths and take much greater armor damage.', tradeoff: '+10% capacitor cost.' }, { id: 'mark-wideband', ability: 'mark', name: 'Wideband Echo', description: 'Sensor Spike also marks a nearby secondary target.', tradeoff: '+18% cooldown and shorter marks.' }, { id: 'mark-execution', ability: 'mark', name: 'Execution Trace', description: 'A Rail Lance hit consumes the mark to break a committed firing solution and leave a short Armor Breach window.', tradeoff: '+10% Sensor Spike cooldown and substantially shorter marks.' },
  { id: 'arc-relay', ability: 'arc', name: 'Relay Drone', description: 'A microdrone periodically attacks disrupted targets.', tradeoff: '+20% Arc Tap capacitor cost.' }, { id: 'arc-ground', ability: 'arc', name: 'Ground Loop', description: 'Conduit propagation restores capacitor charge.', tradeoff: '-15% Arc Tap direct damage.' }, { id: 'arc-cascade', ability: 'arc', name: 'Cascade Lattice', description: 'Arc Tap through machinery advances MAG and MARK recovery, turning the environment into a combo router.', tradeoff: '+15% Arc Tap capacitor cost and -22% direct Arc power.' },
];

export const specializationDefinitions: SpecializationDefinition[] = [
  { id: 'pressure-diver', operatorClass: 'vanguard', name: 'Pressure Diver', identity: 'Pressure / vacuum manipulation', description: 'MAG below 45% pressure leaves a short player-owned vacuum wake, while ability use sheds accumulated vacuum exposure.', tradeoff: '-12 maximum armor.', overclock: 'Low-pressure wakes last longer and ability use clears more exposure.', overclockTradeoff: '+12% ability capacitor cost.' },
  { id: 'momentum-broker', operatorClass: 'vector', name: 'Momentum Broker', identity: 'Recoil / capacitor conversion', description: 'Weapon recoil is treated as recoverable bus energy, returning a capped amount of capacitor per shot.', tradeoff: '-15% passive capacitor regeneration.', overclock: 'Raises the per-shot recoil conversion ceiling from 8 to 10 capacitor.', overclockTradeoff: '+12% weapon recoil.' },
  { id: 'grid-weaver', operatorClass: 'systems', name: 'Grid Weaver', identity: 'Machinery-network Arc routing', description: 'Arc Tap through machinery can paint an additional remote target for MARK follow-up.', tradeoff: '-4% direct weapon output.', overclock: 'Machinery Arc also advances Sensor Spike recovery.', overclockTradeoff: '+15% Arc Tap capacitor cost.' },
  { id: 'survey-deadeye', operatorClass: 'vector', name: 'Survey Deadeye', identity: 'Marked-target rail precision', description: 'Rail hits consume marks to break committed attacks and create a short Armor Breach window.', tradeoff: 'Sensor Spike marks are 20% shorter and recover 10% slower.', overclock: 'Consuming a mark pulls Sensor Spike back toward a 2.2 second recovery window.', overclockTradeoff: '+8% Rail Lance heat per shot.' },
  { id: 'redline-pilot', operatorClass: 'vector', name: 'Redline Pilot', identity: 'Heat / mobility decisions', description: 'Above 75% active-weapon heat, movement acceleration and maximum speed increase instead of encouraging immediate disengagement.', tradeoff: '-18% passive weapon cooling.', overclock: 'A high-heat dodge vents heat and emits a short stagger pulse.', overclockTradeoff: '-8 maximum armor; the high-heat pulse adds 0.18s dodge recovery.' },
  { id: 'breach-vanguard', operatorClass: 'vanguard', name: 'Breach Vanguard', identity: 'Close armor-breaking assault', description: 'Breacher hits inside 300 units gain a capped armor-damage conversion and armor breaks stagger the target.', tradeoff: '-5% movement speed and +10% Breacher heat per shot.', overclock: 'Close armor breaks rebuild a small amount of operator armor.', overclockTradeoff: '-8% Breacher direct-health conversion.' },
  { id: 'capacitor-conductor', operatorClass: 'systems', name: 'Capacitor Conductor', identity: 'Ability-cycle combo routing', description: 'Casting a different MAG/MARK/ARC ability within 3.4 seconds returns capped capacitor and rewards deliberate three-button sequencing.', tradeoff: '-12 maximum capacitor.', overclock: 'Completing the third link of a sequence raises the capped refund and cools the active weapon.', overclockTradeoff: '+10% ability capacitor cost.' },
];

export const operatorClassDefinitions: OperatorClassDefinition[] = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    identity: 'Breach / armor control',
    description: 'A pressure-rated frontline operator. Vanguard builds turn close-range impact, armor work, and durable suit geometry into reliable room control.',
    trait: 'Bulkhead Doctrine // +8 maximum armor and +8% Breacher armor damage.',
    branchAffinities: ['Ballistics', 'Survival'],
    specializationIds: ['pressure-diver', 'breach-vanguard'],
    resonanceTier1: '2 resonant frames // +6 maximum armor and +6% armor damage to all weapons.',
    resonanceTier2: '4 resonant frames // +8 maximum armor and -8% weapon recoil.',
  },
  {
    id: 'vector',
    name: 'Vector',
    identity: 'Mobility / precision routing',
    description: 'A movement-first operator built around clean firing solutions. Vector builds reward projectile control, low-g handling, and deliberate repositioning.',
    trait: 'Flight Discipline // +3% move speed, +6% projectile velocity, and -5% Rail recoil.',
    branchAffinities: ['Mobility', 'Awareness'],
    specializationIds: ['momentum-broker', 'survey-deadeye', 'redline-pilot'],
    resonanceTier1: '2 resonant frames // +4% move speed and improved low-g control.',
    resonanceTier2: '4 resonant frames // +8% projectile velocity and -8% weapon recoil.',
  },
  {
    id: 'systems',
    name: 'Systems',
    identity: 'Capacitor / thermal networks',
    description: 'A systems operator who treats weapons, abilities, and ship-grade electronics as one power network. Systems builds trade raw toughness for cycle control.',
    trait: 'Closed Loop // +6 maximum capacitor, +6% capacitor regeneration, and -3% ability cost.',
    branchAffinities: ['Systems', 'Engineering'],
    specializationIds: ['grid-weaver', 'capacitor-conductor'],
    resonanceTier1: '2 resonant frames // +8% capacitor regeneration and +6% weapon cooling.',
    resonanceTier2: '4 resonant frames // +8 maximum capacitor and -6% ability cooldown.',
  },
];

const operatorClassIds = new Set<OperatorClassId>(operatorClassDefinitions.map(definition => definition.id));
const slotClassAffinity: Record<EquipmentSlot, OperatorClassId> = {
  carbine: 'vector',
  breacher: 'vanguard',
  rail: 'vector',
  suit: 'vanguard',
  rig: 'systems',
  implant: 'systems',
};
const factionClassAffinity: Record<EquipmentFaction, OperatorClassId> = {
  meridian: 'vanguard',
  longarc: 'vector',
  heliostat: 'systems',
};
const modifierClassAffinity: Partial<Record<AffixId, OperatorClassId[]>> = {
  overdrive: ['vanguard'],
  tungsten: ['vanguard'],
  vacuumSeal: ['vanguard'],
  breachPropulsion: ['vanguard'],
  hypervelocity: ['vector'],
  countermass: ['vector'],
  servoWeave: ['vector'],
  dodgeVent: ['vector'],
  markShear: ['vector'],
  railFracture: ['vector'],
  cryoloop: ['systems'],
  capacitorRecycler: ['systems'],
  magRedirect: ['systems'],
  arcDrone: ['systems'],
  extendedFeed: ['vanguard', 'systems'],
};

export function operatorClassForProfile(profile: Pick<PlayerProfile, 'operatorClass' | 'specialization' | 'allocatedNodes'>): OperatorClassId {
  if (profile.operatorClass && operatorClassIds.has(profile.operatorClass)) return profile.operatorClass;
  const specializationClass = specializationDefinitions.find(definition => definition.id === profile.specialization)?.operatorClass;
  if (specializationClass) return specializationClass;
  const nodeIds = new Set(profile.allocatedNodes ?? []);
  let best: { id: OperatorClassId; score: number } = { id: 'vanguard', score: -1 };
  for (const definition of operatorClassDefinitions) {
    const score = progressionNodes.filter(node => nodeIds.has(node.id) && definition.branchAffinities.includes(node.branch)).length;
    if (score > best.score) best = { id: definition.id, score };
  }
  return best.id;
}

export function itemBuildAffinities(item: Item): OperatorClassId[] {
  const affinities = new Set<OperatorClassId>([slotClassAffinity[item.slot]]);
  if (item.faction) affinities.add(factionClassAffinity[item.faction]);
  for (const modifier of item.modifiers) for (const affinity of modifierClassAffinity[modifier.id] ?? []) affinities.add(affinity);
  return operatorClassDefinitions.map(definition => definition.id).filter(id => affinities.has(id));
}

function cloneItem(item: Item): Item {
  const recoveryLevel = item.recoveryLevel ?? Math.max(1, Math.min(56, item.levelRequirement * 4));
  const frameGeneration = item.frameGeneration ?? 1;
  const recoveryQuality = item.recoveryQuality ?? 0;
  const frameIdentity = item.frameIdentity ?? inferFrameIdentity(item.slot, `${item.baseId}:${item.name}`);
  const equipmentQuality = Math.max(0, Math.min(20, item.equipmentQuality ?? equipmentQualityForRecovery(recoveryQuality, frameGeneration, item.rarity)));
  const augmentSlots = item.augmentSlots ?? augmentSlotCount(item.rarity, frameGeneration);
  return {
    ...item,
    faction: item.faction ?? inferFactionFromBaseId(item.baseId),
    recoveryLevel,
    frameGeneration,
    frameIdentity,
    frameImplicit: frameImplicitFor(item.slot, frameGeneration, frameIdentity, equipmentQuality),
    equipmentQuality,
    augmentSlots,
    augments: normalizeAugments(item.slot, item.augments ?? [], augmentSlots),
    recoveryQuality,
    recoverySource: item.recoverySource ?? 'Legacy recovery',
    modifiers: item.modifiers.map(modifier => materializeModifier(modifier.id, modifier.grade ?? 3)),
  };
}
const levelThresholds = [0, 120, 300, 540, 840, 1200, 1620, 2100, 2640, 3240, 3900, 4620, 5400, 6240, 7140, 8100, 9120, 10200, 11340, 12540];
export const maxOperatorLevel = levelThresholds.length;
export function levelRequirementForRecovery(recoveryLevel: number) { const normalized = Math.max(12, Math.min(56, recoveryLevel)); return Math.max(1, Math.min(maxOperatorLevel, 1 + Math.round((normalized - 12) / 44 * (maxOperatorLevel - 1)))); }
const maxLevelXp = levelThresholds[levelThresholds.length - 1];

export function createDefaultProfile(): PlayerProfile {
  const inventory = starterItems.map(cloneItem);
  return { version: 3, xp: 0, level: 1, progressionPoints: 0, allocatedNodes: [], abilityMods: { mag: null, mark: null, arc: null }, operatorClass: 'vanguard', specialization: null, specializationOverclock: false, inventory, equipped: { carbine: 'starter-carbine', breacher: 'starter-breacher', rail: 'starter-rail', suit: 'starter-suit', rig: 'starter-rig', implant: 'starter-implant' }, settings: { aimAssist: 'balanced', rightStickFire: true, screenShake: true, effectIntensity: 'full', effectsVolume: 0.65, uiVolume: 0.45, haptics: true, telemetrySharing: false, tutorialComplete: false }, runsCompleted: 0 };
}
export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return createDefaultProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    if (parsed.version !== 3 || !Array.isArray(parsed.inventory)) return createDefaultProfile();
    const defaults = createDefaultProfile();
    const parsedXp = typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) ? parsed.xp : defaults.xp;
    const parsedLevel = typeof parsed.level === 'number' && Number.isFinite(parsed.level) ? Math.round(parsed.level) : defaults.level;
    const storedXp = Math.max(0, Math.min(maxLevelXp, parsedXp));
    const storedLevel = Math.max(1, Math.min(levelThresholds.length, parsedLevel));
    const normalizedXp = Math.max(storedXp, levelThresholds[storedLevel - 1] ?? 0);
    const normalizedLevel = levelForXp(normalizedXp);
    const allocatedNodes = Array.isArray(parsed.allocatedNodes) ? parsed.allocatedNodes : [];
    const validAllocatedCount = new Set(allocatedNodes.filter(id => progressionNodes.some(node => node.id === id))).size;
    const parsedPoints = typeof parsed.progressionPoints === 'number' && Number.isFinite(parsed.progressionPoints) ? Math.max(0, Math.floor(parsed.progressionPoints)) : defaults.progressionPoints;
    const progressionPoints = Math.max(parsedPoints, Math.max(0, normalizedLevel - 1 - validAllocatedCount));
    const specialization = normalizedLevel >= 15 && specializationDefinitions.some(definition => definition.id === parsed.specialization) ? parsed.specialization as SpecializationId : null;
    const specializationOverclock = normalizedLevel >= 16 && !!specialization && parsed.specializationOverclock === true;
    return {
      ...defaults,
      ...parsed,
      xp: normalizedXp,
      level: normalizedLevel,
      progressionPoints,
      specialization,
      specializationOverclock,
      settings: { ...defaults.settings, ...parsed.settings },
      abilityMods: { ...defaults.abilityMods, ...parsed.abilityMods },
      equipped: { ...defaults.equipped, ...parsed.equipped },
      inventory: parsed.inventory.map(item => cloneItem(item)),
      allocatedNodes,
    } as PlayerProfile;
  } catch {
    return createDefaultProfile();
  }
}
export function saveProfile(profile: PlayerProfile) { if (typeof window === 'undefined') return true; try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); return true; } catch { return false; } }
function levelForXp(xp: number) { let level = 1; for (let index = 1; index < levelThresholds.length; index += 1) if (xp >= levelThresholds[index]) level = index + 1; return level; }
export function xpProgress(profile: PlayerProfile) { if (profile.level >= levelThresholds.length) return { current: 1, needed: 1, maxed: true }; const current = levelThresholds[Math.min(profile.level - 1, levelThresholds.length - 1)] ?? 0; const next = levelThresholds[Math.min(profile.level, levelThresholds.length - 1)] ?? current; return { current: profile.xp - current, needed: Math.max(1, next - current), maxed: false }; }
function seeded(seedValue: number) { let value = seedValue >>> 0; return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; }; }
function rollModifierSet(pool: AffixId[], count: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, preferred: AffixId[] = [], forced: AffixId[] = []) {
  const chosen: AffixId[] = [];
  for (const id of forced) if (pool.includes(id) && !chosen.includes(id)) chosen.push(id);
  const target = Math.min(pool.length, Math.max(count, chosen.length));
  while (chosen.length < target) {
    const remaining = pool.filter(id => !chosen.includes(id));
    const wantedFamily: ModifierFamily = chosen.length % 2 === 0 ? 'core' : 'systems';
    const familyCandidates = remaining.filter(id => modifierFamilyFor(id) === wantedFamily);
    let candidates = familyCandidates.length > 0 ? familyCandidates : remaining;
    const preferredCandidates = candidates.filter(id => preferred.includes(id));
    if (preferredCandidates.length > 0 && random() < 0.78) candidates = preferredCandidates;
    const candidate = candidates[Math.floor(random() * candidates.length)];
    if (!candidate) break;
    chosen.push(candidate);
  }
  return chosen.map(id => materializeModifier(id, forced.includes(id) ? 3 : rollModifierGrade(recoveryLevel, recoveryQuality, random)));
}
function makeFactionItem(slot: EquipmentSlot, index: number, level: number, random: () => number, faction: EquipmentFaction, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, frameOperatorLevel = level): Item {
  const base = baseNames[slot];
  const frame = factionFrames[faction][slot];
  const rolledRarity = rollRarityForQuality(random, recoveryQuality);
  const rarity: Rarity = rolledRarity === 'Field' ? 'Refined' : rolledRarity;
  const count = modifierCountForRarity(rarity, recoveryQuality, random);
  const frameGeneration = frameGenerationForRecovery(recoveryLevel, frameOperatorLevel);
  const frameIdentity = factionFrameIdentity(faction, slot);
  const equipmentQuality = equipmentQualityForRecovery(recoveryQuality, frameGeneration, rarity);
  const augmentSlots = augmentSlotCount(rarity, frameGeneration);
  return {
    id: `faction-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`,
    baseId: frame.baseId,
    name: frame.name,
    slot,
    equipmentClass: frame.equipmentClass,
    rarity,
    levelRequirement: levelRequirementForRecovery(recoveryLevel),
    core: frame.core,
    modifiers: rollModifierSet(base.affixes, count, random, recoveryLevel, recoveryQuality, frame.preferredAffixes),
    faction,
    recoveryLevel,
    frameGeneration,
    frameIdentity,
    frameImplicit: frameImplicitFor(slot, frameGeneration, frameIdentity, equipmentQuality),
    equipmentQuality,
    augmentSlots,
    augments: [],
    recoveryQuality,
    recoverySource,
  };
}

function makeItem(slot: EquipmentSlot, index: number, level: number, random: () => number, forcedAffixes: AffixId[] = [], recoveryLevel = 4, recoveryQuality: RecoveryQualityGrade = 0, recoverySource = 'Contract recovery', forcedCount?: number, frameOperatorLevel = level, forcedRarity?: Exclude<Rarity, 'Singular'>): Item {
  const base = baseNames[slot];
  const rarity: Rarity = forcedRarity ?? (forcedAffixes.length > 0 ? 'Prototype' : rollRarityForQuality(random, recoveryQuality));
  const count = forcedCount ?? modifierCountForRarity(rarity, recoveryQuality, random);
  const frameGeneration = frameGenerationForRecovery(recoveryLevel, frameOperatorLevel);
  const generationNames = frameGenerationNames[slot][frameGeneration];
  const frameIdentity = rollFrameIdentity(slot, random);
  const equipmentQuality = equipmentQualityForRecovery(recoveryQuality, frameGeneration, rarity);
  const augmentSlots = augmentSlotCount(rarity, frameGeneration);
  return { id: `loot-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`, baseId: base.baseId, name: generationNames[Math.floor(random() * generationNames.length)], slot, equipmentClass: base.equipmentClass, rarity, levelRequirement: levelRequirementForRecovery(recoveryLevel), core: base.core, modifiers: rollModifierSet(base.affixes, count, random, recoveryLevel, recoveryQuality, [], forcedAffixes), recoveryLevel, frameGeneration, frameIdentity, frameImplicit: frameImplicitFor(slot, frameGeneration, frameIdentity, equipmentQuality), equipmentQuality, augmentSlots, augments: [], recoveryQuality, recoverySource };
}
export function awardVictory(profile: PlayerProfile, telemetry: Telemetry): VictoryReward {
  const requestedXp = 280 + Math.min(80, Math.round(telemetry.damageDealt / 18));
  const cappedProfileXp = Math.max(0, Math.min(maxLevelXp, profile.xp));
  const xpGained = Math.max(0, Math.min(requestedXp, maxLevelXp - cappedProfileXp));
  const nextXp = cappedProfileXp + xpGained;
  const nextLevel = levelForXp(nextXp);
  const levelsGained = Math.max(0, nextLevel - profile.level);
  const random = seeded(0x6d2b79f5 ^ profile.runsCompleted * 7919 ^ profile.level * 104729);
  const quality: RecoveryQualityGrade = 1;
  let loot: Item[];
  if (profile.runsCompleted === 0) {
    loot = [makeItem('breacher', 0, nextLevel, random, ['overdrive', 'breachPropulsion'], 4, quality, 'Quiet Signal training recovery', 2), makeItem('rig', 1, nextLevel, random, ['dodgeVent', 'capacitorRecycler'], 4, quality, 'Quiet Signal training recovery', 2)];
    loot[0] = { ...loot[0], name: 'Backblast Kestrel Frame' };
    loot[1] = { ...loot[1], name: 'Slipstream Thermal Rig' };
  } else {
    const slots: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];
    const first = slots[Math.floor(random() * slots.length)];
    let second = slots[Math.floor(random() * slots.length)];
    if (second === first) second = slots[(slots.indexOf(first) + 2) % slots.length];
    loot = [makeItem(first, 0, nextLevel, random, [], 4, quality, 'Legacy victory recovery'), makeItem(second, 1, nextLevel, random, [], 4, quality, 'Legacy victory recovery')];
  }
  const profileNext: PlayerProfile = { ...profile, xp: nextXp, level: nextLevel, progressionPoints: profile.progressionPoints + levelsGained, runsCompleted: profile.runsCompleted + 1, inventory: [...profile.inventory, ...loot] };
  return { profile: profileNext, xpGained, levelsGained, loot };
}
const recoverySlotOrder: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];

function chooseRecoverySlots(profile: PlayerProfile, count: number, random: () => number) {
  const counts = Object.fromEntries(
    recoverySlotOrder.map(slot => [slot, profile.inventory.filter(item => item.slot === slot).length]),
  ) as Record<EquipmentSlot, number>;
  const chosen: EquipmentSlot[] = [];

  for (let index = 0; index < count; index += 1) {
    const minimum = Math.min(...recoverySlotOrder.map(slot => counts[slot]));
    const candidates = recoverySlotOrder.filter(slot => counts[slot] === minimum);
    const slot = candidates[Math.floor(random() * candidates.length)];
    chosen.push(slot);
    counts[slot] += 1;
  }

  return chosen;
}

export function awardRecovery(profile: PlayerProfile, telemetry: Telemetry, deep: boolean, _fabricationLevel = 0, source: { deepTarget?: string; location?: string; locationName?: string; faction?: EquipmentFaction; factionReputation?: number; operationTier?: number; maxRecoveryLevel?: number; combatEffectiveness?: number; threatBudget?: number; eliteProtocolCount?: number; environmentalComplications?: number; optionalObjectives?: number; actualDepth?: boolean; directiveQualityBonus?: number; directiveSingularChanceBonus?: number; directiveRecoveryLevelBonus?: number } = {}, fieldLoot?: GroundLootReceipt[]): VictoryReward {
  const rawXp = (deep ? 250 : 145) + Math.min(deep ? 90 : 45, Math.round(telemetry.damageDealt / 22));
  const requestedXp = Math.round(rawXp * (1 + Math.max(0, (source.combatEffectiveness ?? 1) - 1) * 0.65));
  const cappedProfileXp = Math.max(0, Math.min(maxLevelXp, profile.xp));
  const xpGained = Math.max(0, Math.min(requestedXp, maxLevelXp - cappedProfileXp));
  const nextXp = cappedProfileXp + xpGained;
  const nextLevel = levelForXp(nextXp);
  const levelsGained = Math.max(0, nextLevel - profile.level);
  const random = seeded(0x9e3779b9 ^ profile.runsCompleted * 7919 ^ profile.level * 104729 ^ (deep ? 0x51ed270b : 0x17c6d));
  const fieldMode = Array.isArray(fieldLoot);
  const count = deep && !fieldMode ? 2 : 1;
  const maxRecoveryLevel = source.maxRecoveryLevel ?? 8 + Math.max(1, source.operationTier ?? 1) * 4;
  const eliteKills = telemetry.eliteKills ?? 0;
  const directiveRecoveryBonus = Math.max(0, Math.min(3, source.directiveRecoveryLevelBonus ?? 0));
  const ordinaryRecoveryLevel = Math.min(maxRecoveryLevel, recoveryLevelForSource(maxRecoveryLevel, { deep, boss: false, eliteKills }) + directiveRecoveryBonus);
  const bossRecoveryLevel = Math.min(maxRecoveryLevel, recoveryLevelForSource(maxRecoveryLevel, { deep: true, boss: true, eliteKills }) + directiveRecoveryBonus);
  const locationRecoveryLevel = Math.min(maxRecoveryLevel, ordinaryRecoveryLevel + 1);
  const actualDepth = source.actualDepth ?? deep;
  const locationName = source.locationName ?? (source.location ?? 'Unknown site').replaceAll('-', ' ');
  const factionName = source.faction === 'meridian' ? 'Meridian Compact' : source.faction === 'heliostat' ? 'Heliostat League' : source.faction === 'longarc' ? 'Long Arc Assembly' : 'Independent';
  const rollQuality = (boss: boolean, minimum: RecoveryQualityGrade = 0) => Math.max(minimum, rollRecoveryQuality(random, { operationTier: source.operationTier ?? 1, threatBudget: source.threatBudget ?? 32, eliteKills, eliteProtocolCount: source.eliteProtocolCount ?? 0, deep: actualDepth, optionalObjectives: source.optionalObjectives ?? 0, environmentalComplications: source.environmentalComplications ?? 0, boss, location: source.location, faction: source.faction, factionReputation: source.factionReputation, directiveBonus: source.directiveQualityBonus ?? 0 })) as RecoveryQualityGrade;
  const sponsoredChance = source.faction ? factionGearChance(source.factionReputation ?? 0, deep) : 0;
  const makeRecoveredItem = (slot: EquipmentSlot, index: number) => { const recoveryQuality = rollQuality(actualDepth); return source.faction && random() < sponsoredChance ? makeFactionItem(slot, index, nextLevel, random, source.faction, ordinaryRecoveryLevel, recoveryQuality, `Sponsored recovery // ${factionName}`, profile.level) : makeItem(slot, index, nextLevel, random, [], ordinaryRecoveryLevel, recoveryQuality, `${locationName} contract recovery`, undefined, profile.level); };
  const fieldDrops = fieldLoot ?? [];
  const fieldSlots = chooseRecoverySlots(profile, fieldDrops.filter(drop => drop.source !== 'boss' && drop.rarity !== 'Singular').length, random);
  let fieldSlotIndex = 0;
  const fieldItems: Item[] = fieldDrops.map((drop, index) => {
    const recoveryQuality = Math.max(drop.recoveryQualityFloor, rollQuality(drop.source === 'boss', drop.recoveryQualityFloor as RecoveryQualityGrade)) as RecoveryQualityGrade;
    const recoveryLevel = Math.max(1, Math.min(maxRecoveryLevel, drop.recoveryLevel));
    const recoverySource = `Ground drop // ${drop.enemyLabel}`;
    if (drop.rarity === 'Singular') {
      if (drop.source === 'boss') return makeBossSingular(source.deepTarget ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeLocationSingular(source.location ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeItem('rail', 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, 'Prototype');
      return makeLocationSingular(source.location ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeItem(recoverySlotOrder[(drop.enemyId + index) % recoverySlotOrder.length], 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, 'Prototype');
    }
    const slot = fieldSlots[fieldSlotIndex++] ?? recoverySlotOrder[(drop.enemyId + index) % recoverySlotOrder.length];
    const visibleRarity = drop.rarity as Exclude<Rarity, 'Singular'>;
    return makeItem(slot, 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, visibleRarity);
  });
  const bossItem = actualDepth && !fieldMode ? makeBossSingular(source.deepTarget ?? '', 0, nextLevel, random, bossRecoveryLevel, rollQuality(true, 4), `Boss pool // ${source.deepTarget ?? 'deep target'}`, profile.level) : null;
  const fieldHasSingular = fieldItems.some(item => item.rarity === 'Singular');
  const locationChance = fieldHasSingular ? 0 : Math.min(0.24, (deep ? (bossItem ? 0.06 : 0.08) : 0.02) + Math.max(0, source.directiveSingularChanceBonus ?? 0));
  const locationItem = profile.runsCompleted > 0 && random() < locationChance ? makeLocationSingular(source.location ?? '', bossItem ? 1 : 0, nextLevel, random, locationRecoveryLevel, rollQuality(actualDepth, 3), `Location chase // ${locationName}`, profile.level) : null;
  let loot: Item[] = [];

  if (profile.runsCompleted === 0) {
    const first = makeItem('breacher', 0, nextLevel, random, ['overdrive', 'breachPropulsion'], ordinaryRecoveryLevel, Math.max(1, rollQuality(false)) as RecoveryQualityGrade, 'Quiet Signal onboarding recovery', 2, profile.level);
    loot.push({ ...first, name: 'Backblast Kestrel Frame' });
    if (deep) {
      if (bossItem) loot.push(bossItem);
      else {
        const second = makeItem('rig', 1, nextLevel, random, ['dodgeVent', 'capacitorRecycler'], ordinaryRecoveryLevel, Math.max(1, rollQuality(false)) as RecoveryQualityGrade, 'Quiet Signal onboarding recovery', 2, profile.level);
        loot.push({ ...second, name: 'Slipstream Thermal Rig' });
      }
    }
  } else if (deep && bossItem) {
    if (locationItem) loot = [bossItem, locationItem];
    else {
      const [slot] = chooseRecoverySlots(profile, 1, random);
      loot = [bossItem, makeRecoveredItem(slot, 1)];
    }
  } else if (locationItem) {
    if (deep) {
      const [slot] = chooseRecoverySlots(profile, 1, random);
      loot = [locationItem, makeRecoveredItem(slot, 1)];
    } else loot = [locationItem];
  } else {
    const slots = chooseRecoverySlots(profile, count, random);
    loot = slots.map((slot, index) => makeRecoveredItem(slot, index));
  }

  loot = [...fieldItems, ...loot];

  const profileNext: PlayerProfile = {
    ...profile,
    xp: nextXp,
    level: nextLevel,
    progressionPoints: profile.progressionPoints + levelsGained,
    runsCompleted: profile.runsCompleted + 1,
    inventory: [...profile.inventory, ...loot],
  };
  return { profile: profileNext, xpGained, levelsGained, loot };
}
export function equipItem(profile: PlayerProfile, itemId: string): { profile: PlayerProfile; message: string } { const item = profile.inventory.find(entry => entry.id === itemId); if (!item) return { profile, message: 'Item is no longer in ship storage.' }; if (item.levelRequirement > profile.level) return { profile, message: `Requires operator level ${item.levelRequirement}.` }; return { profile: { ...profile, equipped: { ...profile.equipped, [item.slot]: item.id } }, message: `${item.name} equipped.` }; }
export function unequipSlot(profile: PlayerProfile, slot: EquipmentSlot): { profile: PlayerProfile; message: string } { if (slot === 'carbine' || slot === 'breacher' || slot === 'rail') return { profile, message: 'A weapon assembly is required in every weapon family.' }; return { profile: { ...profile, equipped: { ...profile.equipped, [slot]: null } }, message: `${slot.toUpperCase()} slot cleared.` }; }
export function discardItem(profile: PlayerProfile, itemId: string): { profile: PlayerProfile; message: string } { const item = profile.inventory.find(entry => entry.id === itemId); if (!item) return { profile, message: 'Item not found.' }; if (Object.values(profile.equipped).includes(itemId)) return { profile, message: 'Unequip this item before discarding it.' }; return { profile: { ...profile, inventory: profile.inventory.filter(entry => entry.id !== itemId) }, message: `${item.name} discarded.` }; }
export function allocateNode(profile: PlayerProfile, nodeId: string): { profile: PlayerProfile; message: string } { const node = progressionNodes.find(entry => entry.id === nodeId); if (!node) return { profile, message: 'Progression node unavailable.' }; if (profile.allocatedNodes.includes(nodeId)) return { profile, message: 'Node already allocated.' }; if (profile.progressionPoints <= 0) return { profile, message: 'Gain another level to earn a progression point.' }; if (node.requires && !profile.allocatedNodes.includes(node.requires)) return { profile, message: 'Allocate the previous node in this branch first.' }; return { profile: { ...profile, progressionPoints: profile.progressionPoints - 1, allocatedNodes: [...profile.allocatedNodes, nodeId] }, message: `${node.name} allocated.` }; }
export function setAbilityMod(profile: PlayerProfile, ability: AbilityId, modId: string | null): PlayerProfile { if (modId && !abilityMods.some(mod => mod.id === modId && mod.ability === ability)) return profile; return { ...profile, abilityMods: { ...profile.abilityMods, [ability]: modId } }; }
export function setOperatorClass(profile: PlayerProfile, operatorClass: OperatorClassId): { profile: PlayerProfile; message: string } {
  if (!operatorClassIds.has(operatorClass)) return { profile, message: 'Operator class unavailable.' };
  const current = operatorClassForProfile(profile);
  if (current === operatorClass && profile.operatorClass === operatorClass) return { profile, message: `${operatorClassDefinitions.find(definition => definition.id === operatorClass)?.name ?? 'Operator'} class already active.` };
  const specialization = specializationDefinitions.find(definition => definition.id === profile.specialization);
  const clearsSpecialization = !!specialization && specialization.operatorClass !== operatorClass;
  const next: PlayerProfile = {
    ...profile,
    operatorClass,
    specialization: clearsSpecialization ? null : profile.specialization,
    specializationOverclock: clearsSpecialization ? false : profile.specializationOverclock,
  };
  const name = operatorClassDefinitions.find(definition => definition.id === operatorClass)?.name ?? 'Operator';
  return { profile: next, message: clearsSpecialization ? `${name} class active // incompatible specialization cleared; progression nodes and equipment are unchanged.` : `${name} class active // progression nodes, lenses, and equipment remain available.` };
}
export function setSpecialization(profile: PlayerProfile, specialization: SpecializationId | null): PlayerProfile {
  if (profile.level < 15) return profile;
  const definition = specialization ? specializationDefinitions.find(entry => entry.id === specialization) : undefined;
  if (specialization && (!definition || definition.operatorClass !== operatorClassForProfile(profile))) return profile;
  const specializationOverclock = specialization && specialization === profile.specialization && profile.level >= 16 ? profile.specializationOverclock : false;
  return { ...profile, specialization, specializationOverclock };
}
export function setSpecializationOverclock(profile: PlayerProfile, enabled: boolean): PlayerProfile { if (profile.level < 16 || !profile.specialization) return profile; return { ...profile, specializationOverclock: enabled }; }
export function setProfileSettings(profile: PlayerProfile, settings: Partial<ProfileSettings>): PlayerProfile { return { ...profile, settings: { ...profile.settings, ...settings } }; }
function equippedItems(profile: PlayerProfile) {
  return (Object.keys(profile.equipped) as EquipmentSlot[])
    .map(slot => itemForSlot(profile, slot))
    .filter((item): item is Item => !!item);
}

export function gearResonanceForProfile(profile: PlayerProfile, classId: OperatorClassId = operatorClassForProfile(profile)): GearResonanceState {
  const matchingItemIds = equippedItems(profile).filter(item => itemBuildAffinities(item).includes(classId)).map(item => item.id);
  const count = matchingItemIds.length;
  const tier: 0 | 1 | 2 = count >= 4 ? 2 : count >= 2 ? 1 : 0;
  return { classId, count, tier, nextAt: tier === 0 ? 2 : tier === 1 ? 4 : null, matchingItemIds };
}

export function factionSetState(profile: PlayerProfile) {
  const equipped = equippedItems(profile);
  return factionSetDefinitions.map(definition => {
    const count = equipped.filter(item => item.faction === definition.id).length;
    return { definition, count, twoPieceActive: count >= 2, fourPieceActive: count >= 4 };
  });
}

export function dominantEquipmentFaction(profile: PlayerProfile): EquipmentFaction | null {
  const sorted = factionSetState(profile).sort((a, b) => b.count - a.count);
  if (!sorted[0] || sorted[0].count < 2) return null;
  if (sorted[1] && sorted[1].count === sorted[0].count) return null;
  return sorted[0].definition.id;
}

function applyFactionSetBonuses(build: CombatBuild, profile: PlayerProfile) {
  for (const state of factionSetState(profile)) {
    if (state.count >= 2 && state.definition.id === 'meridian') {
      build.player.maxArmorAdd += 16;
      build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + 0.16);
    }
    if (state.count >= 4 && state.definition.id === 'meridian') {
      build.player.maxArmorAdd += 8;
      for (const weapon of Object.values(build.weapon)) weapon.recoilMul *= 0.86;
    }
    if (state.count >= 2 && state.definition.id === 'heliostat') {
      build.player.maxCapAdd += 14;
      build.player.capRegenMul *= 1.14;
    }
    if (state.count >= 4 && state.definition.id === 'heliostat') {
      for (const weapon of Object.values(build.weapon)) {
        weapon.damageMul *= 1.08;
        weapon.heatPerShotMul *= 1.1;
        weapon.heatDissipationMul *= 1.25;
      }
      for (const ability of build.abilities) ability.cooldownMul *= 0.92;
    }
    if (state.count >= 2 && state.definition.id === 'longarc') {
      build.player.moveSpeedMul *= 1.06;
      build.player.lowGControl += 0.18;
    }
    if (state.count >= 4 && state.definition.id === 'longarc') {
      build.mechanics.recoilVectoring = true;
      build.mechanics.dodgeVent = true;
      build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, 1);
      build.mechanics.breacherPropulsion = true;
      build.mechanics.breacherPropulsionScale = Math.max(build.mechanics.breacherPropulsionScale, 1);
    }
  }
}

function applyOperatorClassBonuses(build: CombatBuild, profile: PlayerProfile) {
  const classId = operatorClassForProfile(profile);
  const resonance = gearResonanceForProfile(profile, classId);
  if (classId === 'vanguard') {
    build.player.maxArmorAdd += 8;
    build.weapon.breacher.armorDamageMul *= 1.08;
    if (resonance.tier >= 1) {
      build.player.maxArmorAdd += 6;
      for (const weapon of Object.values(build.weapon)) weapon.armorDamageMul *= 1.06;
    }
    if (resonance.tier >= 2) {
      build.player.maxArmorAdd += 8;
      for (const weapon of Object.values(build.weapon)) weapon.recoilMul *= 0.92;
    }
  }
  if (classId === 'vector') {
    build.player.moveSpeedMul *= 1.03;
    for (const weapon of Object.values(build.weapon)) weapon.speedMul *= 1.06;
    build.weapon.rail.recoilMul *= 0.95;
    if (resonance.tier >= 1) {
      build.player.moveSpeedMul *= 1.04;
      build.player.lowGControl += 0.12;
    }
    if (resonance.tier >= 2) {
      for (const weapon of Object.values(build.weapon)) {
        weapon.speedMul *= 1.08;
        weapon.recoilMul *= 0.92;
      }
    }
  }
  if (classId === 'systems') {
    build.player.maxCapAdd += 6;
    build.player.capRegenMul *= 1.06;
    for (const ability of build.abilities) ability.costMul *= 0.97;
    if (resonance.tier >= 1) {
      build.player.capRegenMul *= 1.08;
      for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 1.06;
    }
    if (resonance.tier >= 2) {
      build.player.maxCapAdd += 8;
      for (const ability of build.abilities) ability.cooldownMul *= 0.94;
    }
  }
}

function freshBuild(): CombatBuild { const weapon = () => ({ damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }); return { weapon: { carbine: weapon(), breacher: weapon(), rail: weapon() }, player: { maxHpAdd: 0, maxArmorAdd: 0, maxCapAdd: 0, moveSpeedMul: 1, capRegenMul: 1, vacuumResistance: 0, lowGControl: 0, ventSpeedMul: 1 }, mechanics: { railFragment: false, railFragmentScale: 0, dodgeVent: false, dodgeVentScale: 0, magRedirect: false, magRedirectScale: 0, breacherPropulsion: false, breacherPropulsionScale: 0, markWeakArmor: false, markWeakArmorScale: 0, arcDrone: false, arcDroneScale: 0, recoilVectoring: false, breachDoctrine: false, sensorPenetration: false, widebandMark: false, magOverdriveKick: false, arcGroundLoop: false, magBoundarySink: false, markExecutionTrace: false, arcCascadeLattice: false }, singularTraits: [], specialization: null, specializationOverclock: false, abilities: [{ costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }] }; }
function applyFrameGeneration(build: CombatBuild, item: Item) { const step = Math.min(4, Math.max(0, (item.frameGeneration ?? 1) - 1)); if (step <= 0) return; if (item.slot === 'carbine') { build.weapon.carbine.speedMul *= 1 + step * 0.025; build.weapon.carbine.penetrationAdd += step * 2; } else if (item.slot === 'breacher') { build.weapon.breacher.damageMul *= 1 + step * 0.025; build.weapon.breacher.knockbackMul *= 1 + step * 0.04; } else if (item.slot === 'rail') { build.weapon.rail.penetrationAdd += step * 4; build.weapon.rail.recoilMul *= 1 - step * 0.025; } else if (item.slot === 'suit') { build.player.maxArmorAdd += step * 4; build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + step * 0.025); } else if (item.slot === 'rig') { build.player.maxCapAdd += step * 4; build.player.capRegenMul *= 1 + step * 0.025; } else { for (const ability of build.abilities) ability.cooldownMul *= 1 - step * 0.02; } }
function applyAffix(build: CombatBuild, item: Item, modifier: ItemModifier) { const id = modifier.id; const power = modifierPowerFactor(modifier.grade ?? 3); const tradeoff = modifierTradeoffFactor(modifier.grade ?? 3); const weapon = item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail' ? build.weapon[item.slot] : null; if (id === 'hypervelocity' && weapon) { weapon.speedMul *= 1 + 0.18 * power; weapon.penetrationAdd += Math.round(12 * power); weapon.recoilMul *= 1 + 0.1 * tradeoff; } if (id === 'countermass') { if (weapon) { weapon.recoilMul *= 1 - 0.22 * power; weapon.damageMul *= 1 - 0.07 * tradeoff; } else build.player.lowGControl += 0.12 * power; } if (id === 'overdrive' && weapon) { weapon.damageMul *= 1 + 0.14 * power; weapon.recoilMul *= 1 + 0.2 * tradeoff; weapon.heatPerShotMul *= 1 + 0.12 * tradeoff; } if (id === 'cryoloop') { if (weapon) { weapon.heatDissipationMul *= 1 + 0.3 * power; weapon.penetrationAdd -= Math.round(8 * tradeoff); } else for (const stats of Object.values(build.weapon)) stats.heatDissipationMul *= 1 + 0.15 * power; } if (id === 'extendedFeed' && weapon) { weapon.magazineAdd += Math.max(1, Math.round(6 * power)); weapon.reloadMul *= 1 + 0.12 * tradeoff; } if (id === 'tungsten' && weapon) { weapon.armorDamageMul *= 1 + 0.3 * power; weapon.penetrationAdd += Math.round(14 * power); weapon.heatPerShotMul *= 1 + 0.08 * tradeoff; } if (id === 'vacuumSeal') build.player.vacuumResistance = Math.min(0.8, build.player.vacuumResistance + 0.55 * power); if (id === 'servoWeave') { build.player.moveSpeedMul *= 1 + 0.08 * power; build.player.lowGControl += 0.22 * power; } if (id === 'capacitorRecycler') { build.player.capRegenMul *= 1 + 0.2 * power; for (const ability of build.abilities) ability.costMul *= 1 - 0.1 * power; } if (id === 'railFracture') { build.mechanics.railFragment = true; build.mechanics.railFragmentScale = Math.max(build.mechanics.railFragmentScale, power); } if (id === 'dodgeVent') { build.mechanics.dodgeVent = true; build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, power); } if (id === 'magRedirect') { build.mechanics.magRedirect = true; build.mechanics.magRedirectScale = Math.max(build.mechanics.magRedirectScale, power); } if (id === 'breachPropulsion') { build.mechanics.breacherPropulsion = true; build.mechanics.breacherPropulsionScale = Math.max(build.mechanics.breacherPropulsionScale, power); } if (id === 'markShear') { build.mechanics.markWeakArmor = true; build.mechanics.markWeakArmorScale = Math.max(build.mechanics.markWeakArmorScale, power); } if (id === 'arcDrone') { build.mechanics.arcDrone = true; build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, power); } }
export function deriveCombatBuild(profile: PlayerProfile): CombatBuild {
  const build = freshBuild();
  for (const item of equippedItems(profile)) { applyFrameGeneration(build, item); applyFrameIdentity(build, item); applyAugments(build, item.slot, item.augments ?? []); for (const modifier of item.modifiers) applyAffix(build, item, modifier); if (item.singularTrait && !build.singularTraits.includes(item.singularTrait)) build.singularTraits.push(item.singularTrait); }
  if (build.singularTraits.includes('magBloom')) { build.abilities[0].costMul *= 1.25; build.abilities[0].cooldownMul *= 1.08; }
  if (build.singularTraits.includes('markCascade')) build.abilities[1].cooldownMul *= 1.12;
  applyFactionSetBonuses(build, profile);
  applyOperatorClassBonuses(build, profile);
  const nodes = new Set(profile.allocatedNodes);
  if (nodes.has('ballistics-1')) for (const weapon of Object.values(build.weapon)) weapon.penetrationAdd += 8; if (nodes.has('ballistics-2')) for (const weapon of Object.values(build.weapon)) weapon.armorDamageMul *= 1.15; if (nodes.has('ballistics-3')) build.mechanics.breachDoctrine = true;
  if (nodes.has('mobility-1')) build.player.moveSpeedMul *= 1.06; if (nodes.has('mobility-2')) build.player.lowGControl += 0.28; if (nodes.has('mobility-3')) build.mechanics.recoilVectoring = true;
  if (nodes.has('systems-1')) build.player.capRegenMul *= 1.12; if (nodes.has('systems-2')) for (const ability of build.abilities) ability.costMul *= 0.92; if (nodes.has('systems-3')) { build.mechanics.arcDrone = true; build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, 1); }
  if (nodes.has('survival-1')) build.player.maxArmorAdd += 12; if (nodes.has('survival-2')) build.player.vacuumResistance = Math.min(0.8, build.player.vacuumResistance + 0.2); if (nodes.has('survival-3')) build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + 0.5);
  if (nodes.has('engineering-1')) for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 1.12; if (nodes.has('engineering-2')) build.player.ventSpeedMul *= 1.25; if (nodes.has('engineering-3')) { build.mechanics.dodgeVent = true; build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, 1); }
  if (nodes.has('awareness-1')) for (const weapon of Object.values(build.weapon)) weapon.speedMul *= 1.08; if (nodes.has('awareness-2')) build.mechanics.markWeakArmor = true; if (nodes.has('awareness-3')) build.mechanics.sensorPenetration = true;
  const specialization = profile.level >= 15 ? profile.specialization : null;
  build.specialization = specialization;
  build.specializationOverclock = profile.level >= 16 && !!specialization && profile.specializationOverclock;
  if (specialization === 'pressure-diver') { build.player.maxArmorAdd -= 12; if (build.specializationOverclock) for (const ability of build.abilities) ability.costMul *= 1.12; }
  if (specialization === 'momentum-broker') { build.player.capRegenMul *= 0.85; if (build.specializationOverclock) for (const weapon of Object.values(build.weapon)) weapon.recoilMul *= 1.12; }
  if (specialization === 'grid-weaver') { for (const weapon of Object.values(build.weapon)) weapon.damageMul *= 0.96; if (build.specializationOverclock) build.abilities[2].costMul *= 1.15; }
  if (specialization === 'survey-deadeye') { build.abilities[1].powerMul *= 0.8; build.abilities[1].cooldownMul *= 1.1; if (build.specializationOverclock) build.weapon.rail.heatPerShotMul *= 1.08; }
  if (specialization === 'redline-pilot') { for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 0.82; if (build.specializationOverclock) build.player.maxArmorAdd -= 8; }
  if (specialization === 'breach-vanguard') { build.player.moveSpeedMul *= 0.95; build.weapon.breacher.heatPerShotMul *= 1.1; if (build.specializationOverclock) build.weapon.breacher.healthMultiplierMul *= 0.92; }
  if (specialization === 'capacitor-conductor') { build.player.maxCapAdd -= 12; if (build.specializationOverclock) for (const ability of build.abilities) ability.costMul *= 1.1; }
  if (profile.abilityMods.mag === 'mag-revector') { build.mechanics.magRedirect = true; build.mechanics.magRedirectScale = Math.max(build.mechanics.magRedirectScale, 1); build.abilities[0].costMul *= 1.25; build.abilities[0].cooldownMul *= 1.1; }
  if (profile.abilityMods.mag === 'mag-overdrive') { build.abilities[0].powerMul *= 1.45; build.mechanics.magOverdriveKick = true; }
  if (profile.abilityMods.mag === 'mag-boundary') { build.mechanics.magBoundarySink = true; build.abilities[0].costMul *= 1.2; }
  if (profile.abilityMods.mark === 'mark-shear') { build.mechanics.markWeakArmor = true; build.mechanics.markWeakArmorScale = Math.max(build.mechanics.markWeakArmorScale, 1); build.abilities[1].costMul *= 1.1; }
  if (profile.abilityMods.mark === 'mark-wideband') { build.mechanics.widebandMark = true; build.abilities[1].cooldownMul *= 1.18; build.abilities[1].powerMul *= 0.78; }
  if (profile.abilityMods.mark === 'mark-execution') { build.mechanics.markExecutionTrace = true; build.abilities[1].cooldownMul *= 1.1; build.abilities[1].powerMul *= 0.7; }
  if (profile.abilityMods.arc === 'arc-relay') { build.mechanics.arcDrone = true; build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, 1); build.abilities[2].costMul *= 1.2; }
  if (profile.abilityMods.arc === 'arc-ground') { build.mechanics.arcGroundLoop = true; build.abilities[2].powerMul *= 0.85; }
  if (profile.abilityMods.arc === 'arc-cascade') { build.mechanics.arcCascadeLattice = true; build.abilities[2].costMul *= 1.15; build.abilities[2].powerMul *= 0.78; }
  return build;
}
export function buildIdentity(profile: PlayerProfile) { const factionDoctrine = factionSetState(profile).sort((a, b) => b.count - a.count).find(state => state.count >= 4); const items = equippedItems(profile); const allModifiers = items.flatMap(item => item.modifiers.map(modifier => modifier.id)); const nodes = new Set(profile.allocatedNodes); const breacher = allModifiers.filter(id => ['overdrive', 'tungsten', 'breachPropulsion'].includes(id)).length + (nodes.has('ballistics-3') ? 2 : 0); const mobile = allModifiers.filter(id => ['countermass', 'servoWeave', 'dodgeVent'].includes(id)).length + (nodes.has('mobility-3') ? 2 : 0); const systems = allModifiers.filter(id => ['capacitorRecycler', 'magRedirect', 'markShear', 'arcDrone'].includes(id)).length + (nodes.has('systems-3') ? 2 : 0); const base = factionDoctrine ? factionDoctrine.definition.combatIdentity : systems >= breacher && systems >= mobile && systems > 0 ? 'Systems / Drone Specialist' : mobile >= breacher && mobile > 0 ? 'Mobile Gunfighter' : breacher > 0 ? 'Heavy Breacher' : 'Generalist Operator'; const classDefinition = operatorClassDefinitions.find(definition => definition.id === operatorClassForProfile(profile))!; const specialization = profile.level >= 15 ? specializationDefinitions.find(definition => definition.id === profile.specialization) : undefined; return specialization ? `${classDefinition.name} / ${specialization.name}${profile.level >= 16 && profile.specializationOverclock ? ' // OVERCLOCK' : ''} · ${base}` : `${classDefinition.name} · ${base}`; }
export function comparisonSummary(item: Item, equipped: Item | undefined) { const summarize = (entry: Item | undefined) => entry?.modifiers.map(modifier => `${(modifier.family ?? modifierFamilyFor(modifier.id)).toUpperCase()} G${modifier.grade ?? 3} ${modifier.label}`).join(', ') || 'No special modifiers'; return { current: summarize(equipped), candidate: summarize(item) }; }
export function itemForSlot(profile: PlayerProfile, slot: EquipmentSlot) { const id = profile.equipped[slot]; return id ? profile.inventory.find(item => item.id === id && item.slot === slot) : undefined; }
