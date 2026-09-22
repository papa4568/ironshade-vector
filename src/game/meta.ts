import type { CombatBuild, SingularTraitId, SpecializationId, Telemetry, WeaponId } from './sim';
import { operatorWeaponFamilyForClass, type OperatorClassId } from './classSkills';
import { allocateOperatorNetworkNode, createOperatorNetworkState, normalizeOperatorNetworkState, operatorNetworkNode, operatorNetworkNodes, rebuildOperatorNetworkState, refundOperatorNetworkNode, type OperatorNetworkIntegrationHook, type OperatorNetworkNodeKind, type OperatorNetworkSector, type OperatorNetworkState, type OperatorNetworkStatEffect, type OperatorNetworkUnlockContext } from './operatorNetwork';
export type { OperatorClassId } from './classSkills';
import { factionFrames, factionGearChance, factionSetDefinitions, type EquipmentFaction } from './factionGear';
import { frameGenerationForRecovery, recoveryLevelForSource, type FrameGeneration } from './scaling';
import { modifierFamilyFor, modifierPowerFactor, modifierTradeoffFactor, rollRecoveryQuality, type ModifierFamily, type ModifierGrade, type RecoveryQualityGrade } from './lootQuality';
import { applyAugments, applyFrameIdentity, augmentSlotCount, factionFrameIdentity, frameImplicitDescription, inferFrameIdentity, normalizeAugments, resolveFrameIdentity, rollEquipmentQuality, singularFrameIdentity, type AugmentId, type FrameIdentityId } from './gearDepth';
import type { GroundLootReceipt } from './fieldLoot';
import type { ItemRarity } from './rarity';
import { gearBasesForSlot, resolveGearBase } from './gearBases';
import { affixStatProfile, gearStatDefinition, mergeBuildTags, type GearAffixSemanticId, type GearBuildTag, type GearStatId } from './gearStats';
import { affixesConflict, gearAffixDefinition, gearAffixDefinitions, maximumExplicitModifiersForRarity } from './gearAffixes';
import { singularChaseDefinition, type GearSingularCategory } from './gearSingulars';
import { generateGearPlan, type GearGenerationOpportunity } from './gearGeneration';

export type EquipmentSlot = WeaponId | 'suit' | 'rig' | 'implant';
export type Rarity = ItemRarity;
export type AbilityId = 'mag' | 'mark' | 'arc';
export type MobileAimAssist = 'light' | 'balanced';
export type AffixId = GearAffixSemanticId;
export type ItemModifier = { id: AffixId; label: string; description: string; mechanical: boolean; family?: ModifierFamily; grade?: ModifierGrade; statIds?: GearStatId[]; tradeoffStatIds?: GearStatId[]; buildTags?: GearBuildTag[] };
export type Item = { id: string; baseId: string; name: string; slot: EquipmentSlot; equipmentClass: string; rarity: Rarity; levelRequirement: number; core: string; modifiers: ItemModifier[]; faction?: EquipmentFaction; singularTrait?: SingularTraitId; singularEffect?: string; singularCategory?: GearSingularCategory; singularRule?: string; singularOpportunityCost?: string; recoveryLevel?: number; frameGeneration?: FrameGeneration; frameIdentity?: FrameIdentityId; frameImplicit?: string; equipmentQuality?: number; augmentSlots?: number; augments?: AugmentId[]; recoveryQuality?: RecoveryQualityGrade; recoverySource?: string; craftStability?: number };
export type EffectIntensity = 'full' | 'reduced';
export type ProfileSettings = { aimAssist: MobileAimAssist; rightStickFire: boolean; screenShake: boolean; effectIntensity: EffectIntensity; effectsVolume: number; uiVolume: number; haptics: boolean; telemetrySharing: boolean; tutorialComplete: boolean };
export type CraftHistoryEntry = { id: string; createdAt: number; itemId: string; itemName: string; action: string; cost: string; outcome: string; before: string; after: string; volatile: boolean };
export type PlayerProfile = { version: 3; xp: number; level: number; progressionPoints: number; allocatedNodes: string[]; operatorNetwork?: OperatorNetworkState; abilityMods: Record<AbilityId, string | null>; operatorClass?: OperatorClassId; classSelectionComplete?: boolean; specialization: SpecializationId | null; specializationOverclock: boolean; inventory: Item[]; equipped: Record<EquipmentSlot, string | null>; settings: ProfileSettings; runsCompleted: number; craftHistory?: CraftHistoryEntry[] };
export type VictoryReward = { profile: PlayerProfile; xpGained: number; levelsGained: number; loot: Item[] };
export type ProgressionNode = { id: string; branch: 'Ballistics' | 'Mobility' | 'Systems' | 'Survival' | 'Engineering' | 'Awareness'; name: string; description: string; major?: boolean; requires?: string; kind: OperatorNetworkNodeKind; sector: OperatorNetworkSector; allocationCost: number; weaponFamily?: WeaponId; exclusiveGroup?: string; specialization?: SpecializationId; minLevel?: number; milestone?: boolean; unlockKey?: string; unlockLabel?: string; integrationHooks?: OperatorNetworkIntegrationHook[] };
export type AbilityMod = { id: string; ability: AbilityId; name: string; description: string; tradeoff: string; operatorClass?: OperatorClassId; minLevel?: number; evolution?: boolean };
export type SpecializationDefinition = { id: SpecializationId; operatorClass: OperatorClassId; name: string; identity: string; description: string; tradeoff: string; overclock: string; overclockTradeoff: string };
export type OperatorClassDefinition = { id: OperatorClassId; name: string; identity: string; description: string; trait: string; signatureName: string; signatureDescription: string; combatLoop: string; starterPair: string; branchAffinities: ProgressionNode['branch'][]; specializationIds: SpecializationId[]; resonanceTier1: string; resonanceTier2: string };
export type GearResonanceState = { classId: OperatorClassId; count: number; tier: 0 | 1 | 2; nextAt: 2 | 4 | null; matchingItemIds: string[] };
export type CapstoneInteractionDefinition = { specialization: SpecializationId; abilityMod: string; name: string; description: string };
export type SpecializationGearSynergyDefinition = {
  specialization: SpecializationId;
  name: string;
  preferredTags: GearBuildTag[];
  minimumTagMatches: number;
  exoticAffix?: AffixId;
  requirement: string;
  description: string;
};
export type SpecializationGearSynergyState = {
  definition: SpecializationGearSynergyDefinition;
  active: boolean;
  resonanceTier: 0 | 1 | 2;
  matchingItemIds: string[];
};

const STORAGE_KEY = 'ironshade-vector-profile-v3';
const starterItems: Item[] = [
  { id: 'starter-carbine', baseId: 'm7-frame', name: 'M-7 Service Frame', slot: 'carbine', equipmentClass: 'Coil carbine assembly', rarity: 'Field', levelRequirement: 1, core: 'Stable automatic coil assembly with neutral recoil and thermal behavior.', modifiers: [] },
  { id: 'starter-breacher', baseId: 'b4-frame', name: 'B-4 Service Frame', slot: 'breacher', equipmentClass: 'Breach scattergun assembly', rarity: 'Field', levelRequirement: 1, core: 'Close-range scatter assembly tuned for predictable thrust and spread.', modifiers: [] },
  { id: 'starter-rail', baseId: 'r2-frame', name: 'R-2 Service Rails', slot: 'rail', equipmentClass: 'Rail-lance assembly', rarity: 'Field', levelRequirement: 1, core: 'High-velocity rails with standard capacitor draw and penetration.', modifiers: [] },
  { id: 'starter-suit', baseId: 'utility-suit', name: 'Dockworker Pressure Suit', slot: 'suit', equipmentClass: 'Combat pressure suit', rarity: 'Field', levelRequirement: 1, core: 'Balanced protection with ordinary maneuvering servos.', modifiers: [] },
  { id: 'starter-rig', baseId: 'utility-rig', name: 'QS Utility Rig', slot: 'rig', equipmentClass: 'Power and thermal rig', rarity: 'Field', levelRequirement: 1, core: 'Standard capacitor bus and thermal routing.', modifiers: [] },
  { id: 'starter-implant', baseId: 'operator-link', name: 'Operator Sensor Link', slot: 'implant', equipmentClass: 'Neural systems implant', rarity: 'Field', levelRequirement: 1, core: 'Basic targeting, telemetry, and electronic-control interface.', modifiers: [] },
];
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
export function materializeModifier(id: AffixId, grade: ModifierGrade = 3): ItemModifier {
  const definition = gearAffixDefinition(id);
  const semantics = affixStatProfile(id);
  return {
    id,
    label: definition.name,
    description: gradedDescription(id, grade),
    mechanical: !!definition.mechanicalHook,
    family: definition.family,
    grade,
    statIds: [...semantics.stats],
    tradeoffStatIds: [...semantics.tradeoffs],
    buildTags: [...semantics.buildTags],
  };
}
const affixes: Record<AffixId, ItemModifier> = Object.fromEntries(gearAffixDefinitions.map(definition => [definition.id, materializeModifier(definition.id, 3)])) as Record<AffixId, ItemModifier>;

function frameImplicitFor(slot: EquipmentSlot, generation: FrameGeneration, identity?: FrameIdentityId, quality = 0) { const resolved = identity ?? inferFrameIdentity(slot, `${slot}:${generation}`); return frameImplicitDescription(resolved, generation, quality); }

export function affixPoolForSlot(slot: EquipmentSlot) {
  return [...new Set(gearBasesForSlot(slot).flatMap(base => base.allowedAffixGroups))];
}

type SingularTemplate = Omit<Item, 'id' | 'levelRequirement'>;
const singular = (template: SingularTemplate): SingularTemplate => {
  if (!template.singularTrait || !template.singularEffect) throw new Error(`Singular ${template.baseId} is missing a runtime trait or rule text.`);
  const definition = singularChaseDefinition(template.baseId);
  if (!definition) throw new Error(`Singular ${template.baseId} is missing from the P8.5-I chase registry.`);
  if (definition.singularTrait !== template.singularTrait) throw new Error(`Singular ${template.baseId} trait does not match the chase registry.`);
  if (definition.rule !== template.singularEffect) throw new Error(`Singular ${template.baseId} rule text does not match the chase registry.`);
  return {
    ...template,
    singularCategory: definition.category,
    singularRule: definition.rule,
    singularOpportunityCost: definition.opportunityCost,
  };
};

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
  'Baseline Keeper Sera Nox': [
    singular({ baseId: 'nox-parallax-r7', name: 'Nox Parallax R-7', slot: 'rail', equipmentClass: 'Long-baseline reference rail assembly', rarity: 'Singular', core: 'A calibration accelerator keyed to physical baseline disagreement instead of a fixed local frame.', modifiers: [{ ...affixes.hypervelocity }, { ...affixes.markShear }, { ...affixes.countermass }], faction: 'heliostat', singularTrait: 'nullpoint', singularEffect: 'Rail hits during committed hostile telegraphs cancel the firing solution and refund capacitor.' }),
    singular({ baseId: 'nox-baseline-debt-rig', name: 'Baseline Debt Rig', slot: 'rig', equipmentClass: 'Reference-shear recoil accounting rig', rarity: 'Singular', core: 'A survey power bus that books recoil and capacitor debt against the same private inertial reference.', modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.magRedirect }, { ...affixes.overdrive }], faction: 'heliostat', singularTrait: 'recoilLedger', singularEffect: 'Rail shots refund capacitor but produce substantially more recoil, making every shot a movement decision.' }),
    singular({ baseId: 'nox-blind-meridian-link', name: 'Blind Meridian Link', slot: 'implant', equipmentClass: 'Split-reference navigation cognition implant', rarity: 'Singular', core: 'A cognition layer built to compare marked targets against a nearby physical machine reference before committing the firing solution.', modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.magRedirect }], faction: 'heliostat', singularTrait: 'splitReference', singularEffect: 'Arc Tap on a marked target consumes the mark and can relay through nearby machinery into a second enemy.' }),
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

const directiveChaseIds = new Set(['sixth-vector-m12', 'backstep-kestrel-b9', 'cold-doublet-r7', 'falling-star-harness', 'bloom-vector-rig', 'cascade-sight-link']);
const directiveChaseCatalog = chaseCatalog.filter(item => directiveChaseIds.has(item.baseId));

export function directiveSingularNames(tier: number, profile?: Pick<PlayerProfile, 'operatorClass' | 'specialization' | 'allocatedNodes'>) {
  if (tier < 9) return [];
  const pool = profile ? directiveChaseCatalog.filter(item => isEquipmentSlotClassCompatible(profile, item.slot)) : directiveChaseCatalog;
  return pool.map(item => item.name);
}

export function directiveChaseSingularChance(tier: number, deep: boolean) {
  if (tier < 9) return 0;
  const normalizedTier = Math.max(9, Math.min(12, Math.round(tier)));
  const safeChance = 0.03 + (normalizedTier - 9) * 0.02;
  return Math.min(0.18, deep ? safeChance * 2 : safeChance);
}

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
  'parallax-array': ['nullpoint-needle', 'vector-debt-m12', 'khepri-split-reference-link', 'cold-doublet-r7', 'bloom-vector-rig', 'cascade-sight-link'],
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
  const equipmentQuality = Math.max(4, rollEquipmentQuality(random));
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

function makeBossSingular(profile: PlayerProfile, deepTarget: string, index: number, level: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, frameOperatorLevel = level): Item | null {
  const pool = (bossSingularPools[deepTarget] ?? []).filter(item => isEquipmentSlotClassCompatible(profile, item.slot));
  if (!pool.length) return null;
  return makeSingularItem(pool[Math.floor(random() * pool.length)], 'boss', index, level, random, recoveryLevel, recoveryQuality, recoverySource, frameOperatorLevel);
}

const level15ChaseIds = new Set(['breathless-choir-mantle', 'vector-debt-m12', 'relay-orchard-node', 'cold-witness-r7', 'radiant-liability-kestrel', 'palisade-breaker-b9', 'capacitor-rosary-rig', 'vacuum-psalm-m12', 'falling-star-harness', 'scrap-circuit-rig', 'eventide-eva-skin', 'khepri-split-reference-link']);
function locationPool(location: string, operatorLevel = 16) {
  const ids = new Set(locationChaseIds[location] ?? []);
  return chaseCatalog.filter(item => ids.has(item.baseId) && !directiveChaseIds.has(item.baseId) && (operatorLevel >= 15 || !level15ChaseIds.has(item.baseId)));
}

function makeLocationSingular(profile: PlayerProfile, location: string, index: number, level: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, sourceOperatorLevel = level): Item | null {
  const pool = locationPool(location, sourceOperatorLevel).filter(item => isEquipmentSlotClassCompatible(profile, item.slot));
  if (!pool.length) return null;
  return makeSingularItem(pool[Math.floor(random() * pool.length)], 'chase', index, level, random, recoveryLevel, recoveryQuality, recoverySource, sourceOperatorLevel);
}

function makeDirectiveSingular(profile: PlayerProfile, tier: number, index: number, level: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, sourceOperatorLevel = level): Item | null {
  const pool = directiveChaseCatalog.filter(item => isEquipmentSlotClassCompatible(profile, item.slot));
  if (tier < 9 || !pool.length) return null;
  return makeSingularItem(pool[Math.floor(random() * pool.length)], 'directive-chase', index, level, random, recoveryLevel, recoveryQuality, recoverySource, sourceOperatorLevel);
}

export function bossSingularNames(deepTarget: string) { return (bossSingularPools[deepTarget] ?? []).map(item => item.name); }
export function locationSingularNames(location: string, operatorLevel = 16) { return locationPool(location, operatorLevel).map(item => item.name); }
export const namedSingularCount = Object.values(bossSingularPools).reduce((total, pool) => total + pool.length, 0) + chaseCatalog.length;

export const progressionNodes: ProgressionNode[] = operatorNetworkNodes
  .filter(node => node.kind !== 'class-start')
  .map(node => ({
    id: node.id,
    branch: node.branch as ProgressionNode['branch'],
    name: node.name,
    description: node.description,
    major: node.kind === 'notable' || node.kind === 'mastery' || node.kind === 'keystone' || node.kind === 'capstone' || undefined,
    requires: node.prerequisiteIds[0],
    kind: node.kind,
    sector: node.sector,
    allocationCost: node.allocationCost,
    weaponFamily: node.weaponFamily,
    exclusiveGroup: node.exclusiveGroup,
    specialization: node.specialization,
    minLevel: node.minLevel,
    milestone: node.milestone,
    unlockKey: node.unlockKey,
    unlockLabel: node.unlockLabel,
    integrationHooks: node.integrationHooks,
  }));
export const abilityMods: AbilityMod[] = [
  { id: 'vanguard-siege-ram', ability: 'mag', operatorClass: 'vanguard', minLevel: 16, evolution: true, name: 'Siege Ram', description: 'Breach Rush becomes an armor-cracking ram line. Targets caught in front lose extra armor, gain Armor Breach, and feed additional Breach Guard time.', tradeoff: '+20% Breach Rush cooldown.' },
  { id: 'vanguard-faultline-tag', ability: 'mark', operatorClass: 'vanguard', minLevel: 16, evolution: true, name: 'Faultline Tag', description: 'Fracture Tag propagates a weaker fracture to the nearest second hostile, opening a two-target Breacher lane.', tradeoff: '+18% Fracture Tag capacitor cost.' },
  { id: 'vanguard-reprisal-pulse', ability: 'arc', operatorClass: 'vanguard', minLevel: 16, evolution: true, name: 'Reprisal Pulse', description: 'Bulwark Pulse re-strikes armor-breached contacts and advances Breach Rush recovery for every reprisal contact.', tradeoff: '+18% Bulwark Pulse cooldown.' },
  { id: 'vector-slingshot-shift', ability: 'mag', operatorClass: 'vector', minLevel: 16, evolution: true, name: 'Slingshot Shift', description: 'Vector Shift becomes a longer counterthrust route, extending Slipstream and pulling dodge recovery forward so movement can chain into a second angle.', tradeoff: '+18% Vector Shift capacitor cost.' },
  { id: 'vector-triangulation-lock', ability: 'mark', operatorClass: 'vector', minLevel: 16, evolution: true, name: 'Triangulation Lock', description: 'Deadeye Lock opens a short Armor Breach window and advances Splitshot recovery, turning one clean firing solution into a routed follow-up.', tradeoff: '+18% Deadeye Lock cooldown.' },
  { id: 'vector-needle-fan', ability: 'arc', operatorClass: 'vector', minLevel: 16, evolution: true, name: 'Needle Fan', description: 'Splitshot compresses into a tighter hypervelocity fan with deeper penetration and a reinforced center lane for precision pressure.', tradeoff: '+20% Splitshot cooldown.' },
  { id: 'systems-anchor-lattice', ability: 'mag', operatorClass: 'systems', minLevel: 16, evolution: true, name: 'Anchor Lattice', description: 'Polarity Well latches collapsed hostiles into a conductive cluster and recycles Relay Hack recovery for every node caught in the well.', tradeoff: '+18% Polarity Well cooldown.' },
  { id: 'systems-recursive-intrusion', ability: 'mark', operatorClass: 'systems', minLevel: 16, evolution: true, name: 'Recursive Intrusion', description: 'Relay Hack propagates through an extra hostile, leaves relays conductive, and pulls Cascade Arc recovery forward as the intrusion spreads.', tradeoff: '+18% Relay Hack capacitor cost.' },
  { id: 'systems-return-current', ability: 'arc', operatorClass: 'systems', minLevel: 16, evolution: true, name: 'Return Current', description: 'Cascade Arc converts every live network contact into capped capacitor return and Polarity Well recovery, closing the loop through the whole target chain.', tradeoff: '+20% Cascade Arc cooldown.' },
  { id: 'mag-revector', ability: 'mag', name: 'Revector Lens', description: 'Your first class skill redirects hostile projectiles as friendly kinetic vectors when its field crosses them.', tradeoff: '+25% capacitor cost and +10% cooldown.' }, { id: 'mag-overdrive', ability: 'mag', name: 'Impulse Overdrive', description: '+45% displacement / movement impulse on your first class skill.', tradeoff: 'The operator receives a stronger counter-impulse where applicable.' }, { id: 'mag-boundary', ability: 'mag', name: 'Boundary Sink', description: 'Your first class skill can collapse one nearby gravity, countermass, boiloff, or hostile grid field and vent its geometry outward.', tradeoff: '+20% capacitor cost; only one field can be consumed per cast.' },
  { id: 'mark-shear', ability: 'mark', name: 'Shear Map', description: 'Targets acquired by your second class skill expose weak armor paths and take much greater armor damage.', tradeoff: '+10% capacitor cost.' }, { id: 'mark-wideband', ability: 'mark', name: 'Wideband Echo', description: 'Your second class skill also acquires a nearby secondary target.', tradeoff: '+18% cooldown and shorter target marks.' }, { id: 'mark-execution', ability: 'mark', name: 'Execution Trace', description: 'A hit from your class-owned armament consumes a target mark to break a committed firing solution and leave a short Armor Breach window.', tradeoff: '+10% second-skill cooldown and substantially shorter marks.' },
  { id: 'arc-relay', ability: 'arc', name: 'Relay Drone', description: 'A microdrone periodically attacks targets disrupted by your third class skill.', tradeoff: '+20% third-skill capacitor cost.' }, { id: 'arc-ground', ability: 'arc', name: 'Ground Loop', description: 'Third-skill propagation through machinery restores capacitor charge.', tradeoff: '-15% third-skill direct damage.' }, { id: 'arc-cascade', ability: 'arc', name: 'Cascade Lattice', description: 'Routing your third class skill through machinery advances the first two skill slots, turning the environment into a combo router.', tradeoff: '+15% third-skill capacitor cost and -22% direct power.' },
];

export const vanguardCapstoneInteractions: CapstoneInteractionDefinition[] = [
  { specialization: 'pressure-diver', abilityMod: 'vanguard-siege-ram', name: 'Void Ram', description: 'Siege Ram armor contacts seed a short player-owned vacuum wake, pulling the breach lane back into Pressure Diver control.' },
  { specialization: 'breach-vanguard', abilityMod: 'vanguard-faultline-tag', name: 'Breach Cascade', description: 'Faultline Tag strips deeper armor from both fracture targets; armor breaks count as Breach Guard breaks and can trigger the specialization overclock repair.' },
  { specialization: 'bulkhead-warden', abilityMod: 'vanguard-reprisal-pulse', name: 'Counterfort', description: 'Reprisal contacts reinforce Breach Guard and convert the counter-pulse into additional armor repair; the Warden overclock also recycles capacitor.' },
];

export function vanguardCapstoneInteractionFor(profile: PlayerProfile, abilityMod: string | null) {
  if (profile.level < 16 || operatorClassForProfile(profile) !== 'vanguard' || !profile.specialization || !abilityMod) return undefined;
  return vanguardCapstoneInteractions.find(interaction => interaction.specialization === profile.specialization && interaction.abilityMod === abilityMod);
}

export const vectorCapstoneInteractions: CapstoneInteractionDefinition[] = [
  { specialization: 'momentum-broker', abilityMod: 'vector-slingshot-shift', name: 'Inertial Dividend', description: 'Slingshot Shift stores a longer recoil route; spending that Slipstream returns extra capacitor and pulls Vector Shift plus dodge recovery further forward.' },
  { specialization: 'survey-deadeye', abilityMod: 'vector-triangulation-lock', name: 'Reference Solution', description: 'Triangulation Lock becomes a deeper survey solution: the firing window lasts longer, strips more armor, and the next marked Slipstream shot gains precision pressure while recycling Splitshot.' },
  { specialization: 'redline-pilot', abilityMod: 'vector-needle-fan', name: 'Redline Needle', description: 'Needle Fan can discharge through a hot weapon bus for a faster, harder three-lane fan that vents heat and advances dodge recovery.' },
];

export function vectorCapstoneInteractionFor(profile: PlayerProfile, abilityMod: string | null) {
  if (profile.level < 16 || operatorClassForProfile(profile) !== 'vector' || !profile.specialization || !abilityMod) return undefined;
  return vectorCapstoneInteractions.find(interaction => interaction.specialization === profile.specialization && interaction.abilityMod === abilityMod);
}

export const systemsCapstoneInteractions: CapstoneInteractionDefinition[] = [
  { specialization: 'thermal-shunter', abilityMod: 'systems-anchor-lattice', name: 'Induction Sink', description: 'Anchor Lattice converts a hot Polarity Well into a deeper thermal sink, overcharging the next Thermal Crossfire shot with extra velocity, damage, penetration, and recovery.' },
  { specialization: 'capacitor-conductor', abilityMod: 'systems-recursive-intrusion', name: 'Recursive Bus', description: 'Recursive Intrusion converts propagated relays into direct capacitor recovery; the Conductor overclock also cools the weapon bus while the intrusion spreads.' },
  { specialization: 'grid-weaver', abilityMod: 'systems-return-current', name: 'Mesh Reflux', description: 'Machinery-routed Return Current wires Grid Weaver remote marks back into the conductive mesh, adding a return node and recycling Relay Hack recovery.' },
];

export function systemsCapstoneInteractionFor(profile: PlayerProfile, abilityMod: string | null) {
  if (profile.level < 16 || operatorClassForProfile(profile) !== 'systems' || !profile.specialization || !abilityMod) return undefined;
  return systemsCapstoneInteractions.find(interaction => interaction.specialization === profile.specialization && interaction.abilityMod === abilityMod);
}

export function capstoneInteractionFor(profile: PlayerProfile, abilityMod: string | null) {
  return vanguardCapstoneInteractionFor(profile, abilityMod) ?? vectorCapstoneInteractionFor(profile, abilityMod) ?? systemsCapstoneInteractionFor(profile, abilityMod);
}

export const specializationGearSynergyDefinitions: SpecializationGearSynergyDefinition[] = [
  { specialization: 'pressure-diver', name: 'Pressure Recirculator', preferredTags: ['pressure', 'vacuum', 'defense'], minimumTagMatches: 2, requirement: 'Tier I Vanguard resonance + any 2 of Pressure / Vacuum / Defense on one equipped frame', description: 'Pressure-rated gear closes the Diver loop: +8% vacuum resistance and 4% faster class-skill recovery.' },
  { specialization: 'breach-vanguard', name: 'Breach Stack', preferredTags: ['armor-break', 'penetration', 'ballistics'], minimumTagMatches: 2, requirement: 'Tier I Vanguard resonance + any 2 of Armor Break / Penetration / Ballistics on one equipped frame', description: 'Dense breach geometry feeds the assault doctrine: Breacher gains +12% armor damage and +8 penetration.' },
  { specialization: 'bulkhead-warden', name: 'Counterfort Bracing', preferredTags: ['defense', 'recoil', 'pressure'], minimumTagMatches: 2, requirement: 'Tier I Vanguard resonance + any 2 of Defense / Recoil / Pressure on one equipped frame', description: 'Braced pressure hardware reinforces the defensive loop: +10 maximum armor and 6% faster Bulwark Pulse recovery.' },
  { specialization: 'momentum-broker', name: 'Reaction Ledger', preferredTags: ['mobility', 'recoil', 'capacitor'], minimumTagMatches: 2, requirement: 'Tier I Vector resonance + any 2 of Mobility / Recoil / Capacitor on one equipped frame', description: 'Maneuvering and reaction-control hardware improves the energy ledger: +6 maximum capacitor, +10% capacitor regeneration, and 5% faster Vector Shift recovery.' },
  { specialization: 'survey-deadeye', name: 'Survey Ballistics', preferredTags: ['precision', 'mark', 'penetration'], minimumTagMatches: 2, requirement: 'Tier I Vector resonance + any 2 of Precision / Mark / Penetration on one equipped frame', description: 'Survey and ballistic telemetry completes the precision package: Rail Lance gains +18 penetration and Deadeye Lock recovers 5% faster.' },
  { specialization: 'redline-pilot', name: 'Thermal Slip', preferredTags: ['mobility', 'heat', 'venting'], minimumTagMatches: 2, requirement: 'Tier I Vector resonance + any 2 of Mobility / Heat / Venting on one equipped frame', description: 'Movement and heat-shunt hardware rewards the redline route: +3% movement speed and stronger dodge heat venting.' },
  { specialization: 'grid-weaver', name: 'Mesh Orchestra', preferredTags: ['relay', 'disruption', 'systems'], minimumTagMatches: 2, requirement: 'Tier I Systems resonance + any 2 of Relay / Disruption / Systems on one equipped frame', description: 'Relay and disruption hardware joins the machinery mesh: stronger microdrone routing and 5% faster Cascade Arc recovery.' },
  { specialization: 'capacitor-conductor', name: 'Bus Harmonics', preferredTags: ['capacitor', 'cooldown', 'systems'], minimumTagMatches: 2, requirement: 'Tier I Systems resonance + any 2 of Capacitor / Cooldown / Systems on one equipped frame', description: 'Power-bus hardware stabilizes the combo loop: +8 maximum capacitor and 3% lower class-skill capacitor cost.' },
  { specialization: 'thermal-shunter', name: 'Heat Exchange', preferredTags: ['thermal', 'heat', 'systems'], minimumTagMatches: 2, requirement: 'Tier I Systems resonance + any 2 of Thermal / Heat / Systems on one equipped frame', description: 'Thermal-routing hardware deepens crossfeed: +6 maximum capacitor and +10% weapon heat dissipation.' },
];

export function specializationGearMatchedTags(definition: SpecializationGearSynergyDefinition, item: Item): GearBuildTag[] {
  const tags = new Set(itemBuildTags(item));
  return definition.preferredTags.filter(tag => tags.has(tag));
}

export function itemMatchesSpecializationGearDefinition(definition: SpecializationGearSynergyDefinition, item: Item) {
  const tagThresholdMet = specializationGearMatchedTags(definition, item).length >= definition.minimumTagMatches;
  const exoticRequirementMet = !definition.exoticAffix || item.modifiers.some(modifier => modifier.id === definition.exoticAffix);
  return tagThresholdMet && exoticRequirementMet;
}

export function specializationGearSynergyForProfile(profile: PlayerProfile): SpecializationGearSynergyState | undefined {
  if (profile.level < 15 || !profile.specialization) return undefined;
  const definition = specializationGearSynergyDefinitions.find(entry => entry.specialization === profile.specialization);
  if (!definition) return undefined;
  const resonance = gearResonanceForProfile(profile);
  const matchingItemIds = equippedItems(profile)
    .filter(item => itemMatchesSpecializationGearDefinition(definition, item))
    .map(item => item.id);
  return { definition, active: resonance.tier >= 1 && matchingItemIds.length > 0, resonanceTier: resonance.tier, matchingItemIds };
}

export function itemMatchesSpecializationGearSynergy(profile: PlayerProfile, item: Item) {
  if (!profile.specialization) return false;
  const definition = specializationGearSynergyDefinitions.find(entry => entry.specialization === profile.specialization);
  return !!definition && itemMatchesSpecializationGearDefinition(definition, item);
}

export const specializationDefinitions: SpecializationDefinition[] = [
  { id: 'pressure-diver', operatorClass: 'vanguard', name: 'Pressure Diver', identity: 'Pressure / vacuum manipulation', description: 'MAG below 45% pressure leaves a short player-owned vacuum wake, while ability use sheds accumulated vacuum exposure.', tradeoff: '-12 maximum armor.', overclock: 'Low-pressure wakes last longer and ability use clears more exposure.', overclockTradeoff: '+12% ability capacitor cost.' },
  { id: 'momentum-broker', operatorClass: 'vector', name: 'Momentum Broker', identity: 'Recoil / capacitor conversion', description: 'Weapon recoil is treated as recoverable bus energy, returning capped capacitor per shot. Spending Slipstream on a shot also pulls Vector Shift and dodge recovery forward from the banked recoil.', tradeoff: '-15% passive capacitor regeneration.', overclock: 'Raises the per-shot recoil conversion ceiling from 8 to 10 capacitor and increases the Slipstream recovery dividend.', overclockTradeoff: '+12% weapon recoil.' },
  { id: 'grid-weaver', operatorClass: 'systems', name: 'Grid Weaver', identity: 'Machinery-network Arc routing', description: 'Arc Tap through machinery can paint an additional remote target for MARK follow-up.', tradeoff: '-4% direct weapon output.', overclock: 'Machinery Arc also advances Sensor Spike recovery.', overclockTradeoff: '+15% Arc Tap capacitor cost.' },
  { id: 'survey-deadeye', operatorClass: 'vector', name: 'Survey Deadeye', identity: 'Marked-target rail precision', description: 'Rail hits consume marks to break committed attacks, create a short Armor Breach window, and re-prime Slipstream for a precision follow-through.', tradeoff: 'Sensor Spike marks are 20% shorter and recover 10% slower.', overclock: 'Precision traces pull Deadeye Lock toward a 1.6 second recovery window and extend the follow-through Slipstream window.', overclockTradeoff: '+8% Rail Lance heat per shot.' },
  { id: 'redline-pilot', operatorClass: 'vector', name: 'Redline Pilot', identity: 'Heat / mobility decisions', description: 'Above 75% active-weapon heat, movement acceleration and maximum speed increase while Slipstream shots gain extra velocity, damage, and penetration.', tradeoff: '-18% passive weapon cooling.', overclock: 'A high-heat dodge vents heat and emits a short stagger pulse; hot Slipstream shots also vent a little heat and recycle dodge recovery.', overclockTradeoff: '-8 maximum armor; the high-heat pulse adds 0.18s dodge recovery.' },
  { id: 'breach-vanguard', operatorClass: 'vanguard', name: 'Breach Vanguard', identity: 'Close armor-breaking assault', description: 'Breacher hits inside 300 units gain a capped armor-damage conversion and armor breaks stagger the target.', tradeoff: '-5% movement speed and +10% Breacher heat per shot.', overclock: 'Close armor breaks rebuild a small amount of operator armor.', overclockTradeoff: '-8% Breacher direct-health conversion.' },
  { id: 'bulkhead-warden', operatorClass: 'vanguard', name: 'Bulkhead Warden', identity: 'Guard / impact recycling', description: 'Damage absorbed while Breach Guard is active is reduced further and recycles Bulwark Pulse recovery. Bulwark Pulse repairs armor for every enemy caught in the shockwave.', tradeoff: '-8% direct weapon output.', overclock: 'Guarded impacts also return capacitor and Bulwark Pulse repairs more armor per contact.', overclockTradeoff: '+10% Bulwark Pulse capacitor cost.' },
  { id: 'capacitor-conductor', operatorClass: 'systems', name: 'Capacitor Conductor', identity: 'Ability-cycle combo routing', description: 'Casting a different MAG/MARK/ARC ability within 3.4 seconds returns capped capacitor and rewards deliberate three-button sequencing.', tradeoff: '-12 maximum capacitor.', overclock: 'Completing the third link of a sequence raises the capped refund and cools the active weapon.', overclockTradeoff: '+10% ability capacitor cost.' },
  { id: 'thermal-shunter', operatorClass: 'systems', name: 'Thermal Shunter', identity: 'Weapon / ability thermal crossfeed', description: 'Casting a Systems ability with a warm active weapon routes heat into a short crossfire bank. The next weapon shot leaves the bus faster and harder, gains penetration, and returns capacitor.', tradeoff: '-10 maximum armor.', overclock: 'Crossfed shots also advance the ability that armed the bank and shed additional weapon heat.', overclockTradeoff: '+10% weapon heat per shot.' },
];

export const operatorClassDefinitions: OperatorClassDefinition[] = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    identity: 'Breach / armor control',
    description: 'A pressure-rated frontline operator. Vanguard builds turn close-range impact, armor work, and durable suit geometry into reliable room control.',
    trait: 'Bulkhead Doctrine // +8 maximum armor and +8% Breacher armor damage.',
    signatureName: 'Breach Guard',
    signatureDescription: 'Close Breacher hits brace the suit for incoming armor impact. Breaking hostile armor extends the guard window so you can keep pressure on the room.',
    combatLoop: 'Breach Rush into the lane → Fracture Tag the hard target → Bulwark Pulse when the room collapses on you.',
    starterPair: 'Breacher + Combat Suit',
    branchAffinities: ['Ballistics', 'Survival'],
    specializationIds: ['pressure-diver', 'breach-vanguard', 'bulkhead-warden'],
    resonanceTier1: '2 resonant frames // +6 maximum armor, +6% armor damage, and a stronger Breach Guard loop.',
    resonanceTier2: '4 resonant frames // +8 maximum armor, -8% weapon recoil, a longer Guard window, and stronger Guard mitigation.',
  },
  {
    id: 'vector',
    name: 'Vector',
    identity: 'Mobility / precision routing',
    description: 'A movement-first operator built around clean firing solutions. Vector builds reward projectile control, low-g handling, and deliberate repositioning.',
    trait: 'Flight Discipline // +3% move speed, +6% projectile velocity, and -5% Rail recoil.',
    signatureName: 'Slipstream',
    signatureDescription: 'Dodging primes the next shot with greatly reduced recoil, increased projectile speed, and bonus penetration. Tier II adds a short damage spike.',
    combatLoop: 'Vector Shift or dodge to a new angle → Deadeye Lock a priority target → fire or Splitshot through the opening.',
    starterPair: 'Rail Lance + mobility geometry',
    branchAffinities: ['Mobility', 'Awareness'],
    specializationIds: ['momentum-broker', 'survey-deadeye', 'redline-pilot'],
    resonanceTier1: '2 resonant frames // +4% move speed, improved low-g control, and a wider Slipstream firing window.',
    resonanceTier2: '4 resonant frames // +8% projectile velocity, -8% weapon recoil, and Slipstream gains damage.',
  },
  {
    id: 'systems',
    name: 'Systems',
    identity: 'Capacitor / thermal networks',
    description: 'A systems operator who treats weapons, abilities, and ship-grade electronics as one power network. Systems builds trade raw toughness for cycle control.',
    trait: 'Closed Loop // +6 maximum capacitor, +6% capacitor regeneration, and -3% ability cost.',
    signatureName: 'Closed Loop',
    signatureDescription: 'Chaining different MAG, MARK, and ARC abilities advances the previous ability. Completing the three-link loop recycles capacitor and sheds weapon heat.',
    combatLoop: 'Polarity Well groups the room → Relay Hack spreads control → Cascade Arc completes the network and Closed Loop cycle.',
    starterPair: 'Carbine + Systems Rig',
    branchAffinities: ['Systems', 'Engineering'],
    specializationIds: ['grid-weaver', 'capacitor-conductor', 'thermal-shunter'],
    resonanceTier1: '2 resonant frames // +8% capacitor regeneration, +6% weapon cooling, and stronger Closed Loop timing.',
    resonanceTier2: '4 resonant frames // +8 maximum capacitor, -6% ability cooldown, stronger link acceleration, and larger loop recycling.',
  },
];

const operatorClassIds = new Set<OperatorClassId>(operatorClassDefinitions.map(definition => definition.id));
const slotClassAffinities: Record<EquipmentSlot, OperatorClassId[]> = {
  carbine: ['systems'],
  breacher: ['vanguard'],
  rail: ['vector'],
  suit: ['vanguard', 'vector'],
  rig: ['systems'],
  implant: ['systems'],
};
const factionClassAffinity: Record<EquipmentFaction, OperatorClassId> = {
  meridian: 'vanguard',
  longarc: 'vector',
  heliostat: 'systems',
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

const weaponSlots: WeaponId[] = ['carbine', 'breacher', 'rail'];
function isWeaponSlot(slot: EquipmentSlot): slot is WeaponId { return weaponSlots.includes(slot as WeaponId); }
export function activeWeaponFamilyForProfile(profile: Pick<PlayerProfile, 'operatorClass' | 'specialization' | 'allocatedNodes'>): WeaponId {
  return operatorWeaponFamilyForClass(operatorClassForProfile(profile));
}
export function isEquipmentSlotClassCompatible(profile: Pick<PlayerProfile, 'operatorClass' | 'specialization' | 'allocatedNodes'>, slot: EquipmentSlot): boolean {
  return !isWeaponSlot(slot) || slot === activeWeaponFamilyForProfile(profile);
}
export function isItemClassCompatible(profile: Pick<PlayerProfile, 'operatorClass' | 'specialization' | 'allocatedNodes'>, item: Pick<Item, 'slot'>): boolean {
  return isEquipmentSlotClassCompatible(profile, item.slot);
}

export function normalizeClassArmament(profile: PlayerProfile): PlayerProfile {
  const activeWeapon = activeWeaponFamilyForProfile(profile);
  const activeEquippedId = profile.equipped[activeWeapon];
  const activeEquipped = activeEquippedId ? profile.inventory.find(item => item.id === activeEquippedId && item.slot === activeWeapon && item.levelRequirement <= profile.level) : undefined;
  let inventory = profile.inventory;
  let equippedId = activeEquipped?.id ?? null;
  if (!equippedId) {
    const starter = starterItems.find(item => item.slot === activeWeapon)!;
    const storedStarter = inventory.find(item => item.id === starter.id && item.slot === activeWeapon && item.levelRequirement <= profile.level);
    const usableStored = inventory.find(item => item.slot === activeWeapon && item.levelRequirement <= profile.level);
    if (storedStarter) equippedId = storedStarter.id;
    else if (usableStored) equippedId = usableStored.id;
    else {
      const restoredStarter = cloneItem(starter);
      inventory = [...inventory, restoredStarter];
      equippedId = restoredStarter.id;
    }
  }
  return {
    ...profile,
    inventory,
    equipped: { ...profile.equipped, carbine: null, breacher: null, rail: null, [activeWeapon]: equippedId },
  };
}

export function itemBuildTags(item: Item): GearBuildTag[] {
  const base = resolveGearBase(item.slot, item.baseId, item.frameIdentity);
  const modifierTags = item.modifiers.flatMap(modifier => modifier.buildTags ?? affixStatProfile(modifier.id).buildTags);
  return mergeBuildTags(base?.buildTags ?? [], modifierTags);
}

export function itemStatDefinitions(item: Item) {
  const base = resolveGearBase(item.slot, item.baseId, item.frameIdentity);
  const ids = new Set<GearStatId>([...(base?.inherentStats ?? []), ...(base?.implicitStats ?? [])]);
  for (const modifier of item.modifiers) {
    const semantics = affixStatProfile(modifier.id);
    for (const statId of modifier.statIds ?? semantics.stats) ids.add(statId);
    for (const statId of modifier.tradeoffStatIds ?? semantics.tradeoffs) ids.add(statId);
  }
  return [...ids].map(gearStatDefinition);
}

export function itemBuildAffinities(item: Item): OperatorClassId[] {
  const affinities = new Set<OperatorClassId>(slotClassAffinities[item.slot]);
  if (item.faction) affinities.add(factionClassAffinity[item.faction]);
  for (const modifier of item.modifiers) for (const affinity of affixStatProfile(modifier.id).classAffinities) affinities.add(affinity);
  return operatorClassDefinitions.map(definition => definition.id).filter(id => affinities.has(id));
}

function normalizedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(minimum, Math.min(maximum, numeric));
}

function normalizeLegacyModifiers(item: Item, allowedAffixes?: readonly AffixId[]) {
  const source = Array.isArray(item.modifiers) ? item.modifiers : [];
  const normalized: ItemModifier[] = [];
  const seen = new Set<AffixId>();
  const limit = item.rarity === 'Singular' ? source.length : maximumExplicitModifiersForRarity(item.rarity);
  for (const modifier of source) {
    const definition = gearAffixDefinitions.find(candidate => candidate.id === modifier.id);
    if (!definition || seen.has(definition.id)) continue;
    if (item.rarity !== 'Singular') {
      if (!definition.allowedSlots.includes(item.slot)) continue;
      if (allowedAffixes && !allowedAffixes.includes(definition.id)) continue;
      if (normalized.some(existing => affixesConflict(existing.id, definition.id))) continue;
      if (normalized.length >= limit) break;
    }
    seen.add(definition.id);
    const grade = normalizedInteger(modifier.grade, 3, 1, 5) as ModifierGrade;
    normalized.push(materializeModifier(definition.id, grade));
  }
  return normalized;
}

function cloneItem(item: Item): Item {
  const fallbackRecoveryLevel = normalizedInteger(item.levelRequirement * 4, 4, 1, 56);
  const recoveryLevel = normalizedInteger(item.recoveryLevel, fallbackRecoveryLevel, 1, 56);
  const frameGeneration = normalizedInteger(item.frameGeneration, 1, 1, 6) as FrameGeneration;
  const recoveryQuality = normalizedInteger(item.recoveryQuality, 0, 0, 5) as RecoveryQualityGrade;
  const knownBase = resolveGearBase(item.slot, item.baseId);
  const frameIdentity = knownBase?.frameIdentity ?? resolveFrameIdentity(item.slot, item.frameIdentity, `${item.baseId}:${item.name}`);
  const equipmentQuality = normalizedInteger(item.equipmentQuality, 0, 0, 20);
  const craftStability = normalizedInteger(item.craftStability, 100, 0, 100);
  const augmentSlots = augmentSlotCount(item.rarity, frameGeneration);
  const base = resolveGearBase(item.slot, item.baseId, frameIdentity);
  return {
    ...item,
    faction: item.faction ?? inferFactionFromBaseId(item.baseId),
    recoveryLevel,
    frameGeneration,
    frameIdentity,
    frameImplicit: frameImplicitFor(item.slot, frameGeneration, frameIdentity, equipmentQuality),
    equipmentQuality,
    craftStability,
    augmentSlots,
    augments: normalizeAugments(item.slot, Array.isArray(item.augments) ? item.augments : [], augmentSlots),
    recoveryQuality,
    recoverySource: item.recoverySource ?? 'Legacy recovery',
    modifiers: normalizeLegacyModifiers(item, base?.allowedAffixGroups),
  };
}
const levelThresholds = [0, 120, 300, 540, 840, 1200, 1620, 2100, 2640, 3240, 3900, 4620, 5400, 6240, 7140, 8100, 9120, 10200, 11340, 12540];
export const maxOperatorLevel = levelThresholds.length;
export function levelRequirementForRecovery(recoveryLevel: number) { const normalized = Math.max(12, Math.min(56, recoveryLevel)); return Math.max(1, Math.min(maxOperatorLevel, 1 + Math.round((normalized - 12) / 44 * (maxOperatorLevel - 1)))); }
const maxLevelXp = levelThresholds[levelThresholds.length - 1];

export function createDefaultProfile(): PlayerProfile {
  const inventory = starterItems.map(cloneItem);
  return { version: 3, xp: 0, level: 1, progressionPoints: 0, allocatedNodes: [], operatorNetwork: createOperatorNetworkState('vanguard'), abilityMods: { mag: null, mark: null, arc: null }, operatorClass: 'vanguard', classSelectionComplete: false, specialization: null, specializationOverclock: false, inventory, equipped: { carbine: null, breacher: 'starter-breacher', rail: null, suit: 'starter-suit', rig: 'starter-rig', implant: 'starter-implant' }, settings: { aimAssist: 'balanced', rightStickFire: true, screenShake: true, effectIntensity: 'full', effectsVolume: 0.65, uiVolume: 0.45, haptics: true, telemetrySharing: false, tutorialComplete: false }, runsCompleted: 0, craftHistory: [] };
}
export function normalizeStoredProfile(parsed: Partial<PlayerProfile>): PlayerProfile {
  if (parsed.version !== 3 || !Array.isArray(parsed.inventory)) throw new Error('Unsupported profile save');
  const defaults = createDefaultProfile();
  const parsedXp = typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) ? parsed.xp : defaults.xp;
  const parsedLevel = typeof parsed.level === 'number' && Number.isFinite(parsed.level) ? Math.round(parsed.level) : defaults.level;
  const storedXp = Math.max(0, Math.min(maxLevelXp, parsedXp));
  const storedLevel = Math.max(1, Math.min(levelThresholds.length, parsedLevel));
  const normalizedXp = Math.max(storedXp, levelThresholds[storedLevel - 1] ?? 0);
  const normalizedLevel = levelForXp(normalizedXp);
  const legacyAllocatedNodes = Array.isArray(parsed.allocatedNodes) ? parsed.allocatedNodes : [];
  const parsedPoints = typeof parsed.progressionPoints === 'number' && Number.isFinite(parsed.progressionPoints) ? Math.max(0, Math.floor(parsed.progressionPoints)) : defaults.progressionPoints;
  const specialization = normalizedLevel >= 15 && specializationDefinitions.some(definition => definition.id === parsed.specialization) ? parsed.specialization as SpecializationId : null;
  const specializationOverclock = normalizedLevel >= 16 && !!specialization && parsed.specializationOverclock === true;
  const operatorClass = operatorClassForProfile({ operatorClass: parsed.operatorClass, specialization, allocatedNodes: legacyAllocatedNodes });
  const operatorNetwork = normalizeOperatorNetworkState({
    operatorClass,
    level: normalizedLevel,
    specialization,
    state: parsed.operatorNetwork,
    legacyAllocatedNodes,
    legacyUnspentPoints: parsedPoints,
  });
  const allocatedNodes = operatorNetwork.allocatedNodeIds;
  const progressionPoints = operatorNetwork.unspentPoints;
  const classSelectionComplete = typeof parsed.classSelectionComplete === 'boolean' ? parsed.classSelectionComplete : true;
  const inventory = parsed.inventory.map(item => cloneItem(item));
  const craftHistory = Array.isArray(parsed.craftHistory) ? parsed.craftHistory.filter((entry): entry is CraftHistoryEntry => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Partial<CraftHistoryEntry>;
    return typeof candidate.id === 'string'
      && typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
      && typeof candidate.itemId === 'string'
      && typeof candidate.itemName === 'string'
      && typeof candidate.action === 'string'
      && typeof candidate.cost === 'string'
      && typeof candidate.outcome === 'string'
      && typeof candidate.before === 'string'
      && typeof candidate.after === 'string'
      && typeof candidate.volatile === 'boolean';
  }).slice(0, 12) : [];
  const requestedEquipped = { ...defaults.equipped, ...parsed.equipped };
  const equipped = Object.fromEntries((Object.keys(defaults.equipped) as EquipmentSlot[]).map(slot => {
    const itemId = requestedEquipped[slot];
    const item = itemId ? inventory.find(candidate => candidate.id === itemId && candidate.slot === slot && candidate.levelRequirement <= normalizedLevel) : undefined;
    return [slot, item?.id ?? null];
  })) as Record<EquipmentSlot, string | null>;
  return normalizeClassArmament({
    ...defaults,
    ...parsed,
    xp: normalizedXp,
    level: normalizedLevel,
    progressionPoints,
    operatorNetwork,
    operatorClass,
    classSelectionComplete,
    specialization,
    specializationOverclock,
    settings: { ...defaults.settings, ...parsed.settings },
    abilityMods: { ...defaults.abilityMods, ...parsed.abilityMods },
    equipped,
    inventory,
    allocatedNodes,
    craftHistory,
  } as PlayerProfile);
}

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return createDefaultProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    return normalizeStoredProfile(JSON.parse(raw) as Partial<PlayerProfile>);
  } catch {
    return createDefaultProfile();
  }
}
export function saveProfile(profile: PlayerProfile) { if (typeof window === 'undefined') return true; try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStoredProfile(profile))); return true; } catch { return false; } }
function levelForXp(xp: number) { let level = 1; for (let index = 1; index < levelThresholds.length; index += 1) if (xp >= levelThresholds[index]) level = index + 1; return level; }
export function xpProgress(profile: PlayerProfile) { if (profile.level >= levelThresholds.length) return { current: 1, needed: 1, maxed: true }; const current = levelThresholds[Math.min(profile.level - 1, levelThresholds.length - 1)] ?? 0; const next = levelThresholds[Math.min(profile.level, levelThresholds.length - 1)] ?? current; return { current: profile.xp - current, needed: Math.max(1, next - current), maxed: false }; }
function seeded(seedValue: number) { let value = seedValue >>> 0; return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; }; }
function makeFactionItem(slot: EquipmentSlot, index: number, level: number, random: () => number, faction: EquipmentFaction, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string, frameOperatorLevel = level, opportunity: GearGenerationOpportunity = 'standard'): Item {
  const frame = factionFrames[faction][slot];
  const plan = generateGearPlan({
    slot,
    recoveryLevel,
    recoveryQuality,
    frameOperatorLevel,
    random,
    faction,
    preferredAffixes: frame.preferredAffixes,
    source: opportunity,
  });
  const rarity: Rarity = plan.rarity === 'Field' ? 'Refined' : plan.rarity;
  const affixes = rarity === plan.rarity
    ? plan.affixes
    : generateGearPlan({
      slot,
      recoveryLevel,
      recoveryQuality,
      frameOperatorLevel,
      random,
      faction,
      preferredAffixes: frame.preferredAffixes,
      source: opportunity,
      forcedRarity: 'Refined',
    }).affixes;
  const frameIdentity = factionFrameIdentity(faction, slot);
  return {
    id: `faction-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`,
    baseId: frame.baseId,
    name: frame.name,
    slot,
    equipmentClass: frame.equipmentClass,
    rarity,
    levelRequirement: levelRequirementForRecovery(recoveryLevel),
    core: frame.core,
    modifiers: affixes.map(affix => materializeModifier(affix.id, affix.grade)),
    faction,
    recoveryLevel,
    frameGeneration: plan.frameGeneration,
    frameIdentity,
    frameImplicit: frameImplicitFor(slot, plan.frameGeneration, frameIdentity, plan.equipmentQuality),
    equipmentQuality: plan.equipmentQuality,
    augmentSlots: augmentSlotCount(rarity, plan.frameGeneration),
    augments: [],
    recoveryQuality,
    recoverySource,
  };
}

function makeItem(slot: EquipmentSlot, index: number, level: number, random: () => number, forcedAffixes: AffixId[] = [], recoveryLevel = 4, recoveryQuality: RecoveryQualityGrade = 0, recoverySource = 'Contract recovery', forcedCount?: number, frameOperatorLevel = level, forcedRarity?: Exclude<Rarity, 'Singular'>, opportunity: GearGenerationOpportunity = 'standard'): Item {
  const plan = generateGearPlan({
    slot,
    recoveryLevel,
    recoveryQuality,
    frameOperatorLevel,
    random,
    forcedAffixes,
    forcedModifierCount: forcedCount,
    forcedRarity: forcedRarity ?? (forcedAffixes.length > 0 ? 'Prototype' : undefined),
    source: opportunity,
  });
  const base = plan.base;
  return {
    id: `loot-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`,
    baseId: base.id,
    name: base.name,
    slot,
    equipmentClass: base.equipmentClass,
    rarity: plan.rarity,
    levelRequirement: levelRequirementForRecovery(recoveryLevel),
    core: `${base.core} Tradeoff: ${base.tradeoff}`,
    modifiers: plan.affixes.map(affix => materializeModifier(affix.id, affix.grade)),
    recoveryLevel,
    frameGeneration: plan.frameGeneration,
    frameIdentity: base.frameIdentity,
    frameImplicit: frameImplicitFor(slot, plan.frameGeneration, base.frameIdentity, plan.equipmentQuality),
    equipmentQuality: plan.equipmentQuality,
    augmentSlots: plan.augmentSlots,
    augments: [],
    recoveryQuality,
    recoverySource,
  };
}

export type ParallaxDebtGearIdentity = {
  baseId: string;
  name: string;
  equipmentClass: string;
  core: string;
  frameIdentity: FrameIdentityId;
  prototypeAffix: AffixId;
};

export const parallaxDebtGearIdentities: Record<EquipmentSlot, ParallaxDebtGearIdentity> = {
  carbine: {
    baseId: 'parallax-baseline-carbine',
    name: 'Baseline-Corrected M-12',
    equipmentClass: 'Parallax reference carbine assembly',
    core: 'A dual-reference receiver that reconciles recoil against the Array baseline before committing the next coil cycle.',
    frameIdentity: 'carbine-countermass',
    prototypeAffix: 'magRedirect',
  },
  breacher: {
    baseId: 'parallax-shearwake-breacher',
    name: 'Shearwake B-9 Cage',
    equipmentClass: 'Reference-shear breach scattergun',
    core: 'A counter-impulse cage that turns local reference disagreement into a deliberate movement vector at close range.',
    frameIdentity: 'breacher-thrust',
    prototypeAffix: 'breachPropulsion',
  },
  rail: {
    baseId: 'parallax-long-baseline-rail',
    name: 'Long-Baseline R-7',
    equipmentClass: 'Parallax survey rail assembly',
    core: 'Survey rails keyed to long-baseline timing, preserving a firing solution while nearby inertial references drift.',
    frameIdentity: 'rail-hypervelocity',
    prototypeAffix: 'markShear',
  },
  suit: {
    baseId: 'parallax-reference-eva',
    name: 'Reference-Shear EVA Shell',
    equipmentClass: 'Parallax maneuvering pressure suit',
    core: 'A low-mass EVA shell with distributed countermass trim for crossing live reference-shear lanes without losing vector authority.',
    frameIdentity: 'suit-countermass',
    prototypeAffix: 'servoWeave',
  },
  rig: {
    baseId: 'parallax-three-reference-rig',
    name: 'Three-Reference Control Bus',
    equipmentClass: 'Parallax reference-control rig',
    core: 'A control bus that compares three physical references before routing capacitor, thermal, and magnetic-control load.',
    frameIdentity: 'rig-pulse',
    prototypeAffix: 'magRedirect',
  },
  implant: {
    baseId: 'parallax-blind-meridian-link',
    name: 'Blind Meridian Reference Link',
    equipmentClass: 'Parallax metrology cognition implant',
    core: 'A metrology link that keeps target solutions separate from the operator frame until a physical reference confirms the comparison.',
    frameIdentity: 'implant-sensor',
    prototypeAffix: 'markShear',
  },
};

function applyParallaxDebtGearIdentity(item: Item): Item {
  const identity = parallaxDebtGearIdentities[item.slot];
  let modifiers = item.modifiers;
  if (item.rarity === 'Prototype' && modifiers.length > 0 && !modifiers.some(modifier => modifier.id === identity.prototypeAffix)) {
    const grade = modifiers[modifiers.length - 1]?.grade ?? 3;
    modifiers = [...modifiers.slice(0, -1), materializeModifier(identity.prototypeAffix, grade)];
  }
  return {
    ...item,
    baseId: identity.baseId,
    name: identity.name,
    equipmentClass: identity.equipmentClass,
    core: identity.core,
    modifiers,
    frameIdentity: identity.frameIdentity,
    frameImplicit: frameImplicitFor(item.slot, item.frameGeneration ?? 1, identity.frameIdentity, item.equipmentQuality ?? 0),
  };
}

type CampaignGearChapter = 'black-lattice' | 'dead-reckoning' | 'dead-reckoning-interdiction' | 'parallax-debt';
function applyCampaignGearIdentity(item: Item, campaignChapter?: CampaignGearChapter): Item {
  return campaignChapter === 'parallax-debt' ? applyParallaxDebtGearIdentity(item) : item;
}

type ClassOnboardingRecoveryTemplate = { slot: EquipmentSlot; name: string; affixes: [AffixId, AffixId] };
export const operatorClassOnboardingRecovery: Record<OperatorClassId, [ClassOnboardingRecoveryTemplate, ClassOnboardingRecoveryTemplate]> = {
  vanguard: [
    { slot: 'breacher', name: 'Backblast Kestrel Frame', affixes: ['overdrive', 'breachPropulsion'] },
    { slot: 'suit', name: 'Bulkhead Pressure Skin', affixes: ['vacuumSeal', 'capacitorRecycler'] },
  ],
  vector: [
    { slot: 'rail', name: 'Needleline Survey Rails', affixes: ['hypervelocity', 'markShear'] },
    { slot: 'suit', name: 'Countermass EVA Harness', affixes: ['servoWeave', 'dodgeVent'] },
  ],
  systems: [
    { slot: 'carbine', name: 'Relay M-7 Driver', affixes: ['extendedFeed', 'magRedirect'] },
    { slot: 'rig', name: 'Closed-Loop Thermal Rig', affixes: ['cryoloop', 'capacitorRecycler'] },
  ],
};

function makeClassOnboardingRecoveryItem(profile: PlayerProfile, index: 0 | 1, level: number, random: () => number, recoveryLevel: number, recoveryQuality: RecoveryQualityGrade, recoverySource: string) {
  const template = operatorClassOnboardingRecovery[operatorClassForProfile(profile)][index];
  const item = makeItem(template.slot, index, level, random, [...template.affixes], recoveryLevel, recoveryQuality, recoverySource, 2, profile.level, 'Refined');
  return { ...item, name: template.name };
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
    loot = [
      makeClassOnboardingRecoveryItem(profile, 0, nextLevel, random, 4, quality, 'Quiet Signal training recovery'),
      makeClassOnboardingRecoveryItem(profile, 1, nextLevel, random, 4, quality, 'Quiet Signal training recovery'),
    ];
  } else {
    const slots = chooseRecoverySlots(profile, 2, random);
    loot = slots.map((slot, index) => makeItem(slot, index, nextLevel, random, [], 4, quality, 'Legacy victory recovery'));
  }
  const currentNetwork = normalizeOperatorNetworkState({
    operatorClass: operatorClassForProfile(profile),
    level: profile.level,
    specialization: profile.specialization,
    state: profile.operatorNetwork,
    legacyAllocatedNodes: profile.allocatedNodes,
    legacyUnspentPoints: profile.progressionPoints,
  });
  const nextNetwork = { ...currentNetwork, unspentPoints: currentNetwork.unspentPoints + levelsGained };
  const profileNext: PlayerProfile = { ...profile, xp: nextXp, level: nextLevel, progressionPoints: nextNetwork.unspentPoints, allocatedNodes: nextNetwork.allocatedNodeIds, operatorNetwork: nextNetwork, runsCompleted: profile.runsCompleted + 1, inventory: [...profile.inventory, ...loot] };
  return { profile: profileNext, xpGained, levelsGained, loot };
}
const universalRecoverySlotOrder: EquipmentSlot[] = ['suit', 'rig', 'implant'];
function recoverySlotOrderForProfile(profile: PlayerProfile): EquipmentSlot[] {
  return [activeWeaponFamilyForProfile(profile), ...universalRecoverySlotOrder];
}

function chooseRecoverySlots(profile: PlayerProfile, count: number, random: () => number) {
  const recoverySlotOrder = recoverySlotOrderForProfile(profile);
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

export function awardRecovery(profile: PlayerProfile, telemetry: Telemetry, deep: boolean, _fabricationLevel = 0, source: { deepTarget?: string; location?: string; locationName?: string; faction?: EquipmentFaction; factionReputation?: number; operationTier?: number; maxRecoveryLevel?: number; combatEffectiveness?: number; threatBudget?: number; eliteProtocolCount?: number; environmentalComplications?: number; optionalObjectives?: number; actualDepth?: boolean; xpFloor?: number; directiveQualityBonus?: number; directiveSingularChanceBonus?: number; directiveRecoveryLevelBonus?: number; directiveTier?: number; campaignChapter?: CampaignGearChapter } = {}, fieldLoot?: GroundLootReceipt[]): VictoryReward {
  const rawXp = (deep ? 250 : 145) + Math.min(deep ? 90 : 45, Math.round(telemetry.damageDealt / 22));
  const requestedXp = Math.max(Math.max(0, Math.round(source.xpFloor ?? 0)), Math.round(rawXp * (1 + Math.max(0, (source.combatEffectiveness ?? 1) - 1) * 0.65)));
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
  const makeCampaignItem = (...args: Parameters<typeof makeItem>) => applyCampaignGearIdentity(makeItem(...args), source.campaignChapter);
  const makeRecoveredItem = (slot: EquipmentSlot, index: number) => {
    const recoveryQuality = rollQuality(actualDepth);
    return source.faction && random() < sponsoredChance
      ? makeFactionItem(slot, index, nextLevel, random, source.faction, ordinaryRecoveryLevel, recoveryQuality, `Sponsored recovery // ${factionName}`, profile.level, actualDepth ? 'deep' : 'standard')
      : makeCampaignItem(slot, index, nextLevel, random, [], ordinaryRecoveryLevel, recoveryQuality, `${locationName} contract recovery`, undefined, profile.level, undefined, actualDepth ? 'deep' : 'standard');
  };
  const fieldDrops = fieldLoot ?? [];
  const fieldSlots = chooseRecoverySlots(profile, fieldDrops.filter(drop => drop.source !== 'boss' && drop.rarity !== 'Singular').length, random);
  let fieldSlotIndex = 0;
  const fieldItems: Item[] = fieldDrops.map((drop, index) => {
    const recoveryQuality = Math.max(drop.recoveryQualityFloor, rollQuality(drop.source === 'boss', drop.recoveryQualityFloor as RecoveryQualityGrade)) as RecoveryQualityGrade;
    const recoveryLevel = Math.max(1, Math.min(maxRecoveryLevel, drop.recoveryLevel));
    const recoverySource = `Ground drop // ${drop.enemyLabel}`;
    if (drop.rarity === 'Singular') {
      if (drop.source === 'boss') return makeBossSingular(profile, source.deepTarget ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeLocationSingular(profile, source.location ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeCampaignItem(activeWeaponFamilyForProfile(profile), 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, 'Prototype', 'boss');
      return makeLocationSingular(profile, source.location ?? '', 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile.level) ?? makeCampaignItem(recoverySlotOrderForProfile(profile)[(drop.enemyId + index) % recoverySlotOrderForProfile(profile).length], 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, 'Prototype', drop.source === 'elite' ? 'elite' : 'enhanced');
    }
    const slot = fieldSlots[fieldSlotIndex++] ?? recoverySlotOrderForProfile(profile)[(drop.enemyId + index) % recoverySlotOrderForProfile(profile).length];
    const visibleRarity = drop.rarity as Exclude<Rarity, 'Singular'>;
    return makeCampaignItem(slot, 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, undefined, profile.level, visibleRarity, drop.source === 'elite' ? 'elite' : drop.source === 'enhanced' ? 'enhanced' : 'standard');
  });
  const bossItem = actualDepth && !fieldMode ? makeBossSingular(profile, source.deepTarget ?? '', 0, nextLevel, random, bossRecoveryLevel, rollQuality(true, 4), `Boss pool // ${source.deepTarget ?? 'deep target'}`, profile.level) : null;
  const fieldHasSingular = fieldItems.some(item => item.rarity === 'Singular');
  const directiveTier = source.directiveTier ?? 0;
  const directiveChance = directiveChaseSingularChance(directiveTier, actualDepth);
  const directiveItem = profile.runsCompleted > 0 && !fieldHasSingular && directiveChance > 0 && random() < directiveChance
    ? makeDirectiveSingular(profile, directiveTier, bossItem ? 1 : 0, nextLevel, random, actualDepth ? bossRecoveryLevel : locationRecoveryLevel, rollQuality(actualDepth, 4), `Directive chase // T${directiveTier}`, profile.level)
    : null;
  const locationChance = fieldHasSingular || directiveItem ? 0 : Math.min(0.24, (deep ? (bossItem ? 0.06 : 0.08) : 0.02) + Math.max(0, source.directiveSingularChanceBonus ?? 0));
  const locationItem = profile.runsCompleted > 0 && random() < locationChance ? makeLocationSingular(profile, source.location ?? '', bossItem ? 1 : 0, nextLevel, random, locationRecoveryLevel, rollQuality(actualDepth, 3), `Location chase // ${locationName}`, profile.level) : null;
  let loot: Item[] = [];

  if (profile.runsCompleted === 0) {
    loot.push(makeClassOnboardingRecoveryItem(profile, 0, nextLevel, random, ordinaryRecoveryLevel, Math.max(1, rollQuality(false)) as RecoveryQualityGrade, 'Quiet Signal onboarding recovery'));
    if (deep) {
      if (bossItem) loot.push(bossItem);
      else loot.push(makeClassOnboardingRecoveryItem(profile, 1, nextLevel, random, ordinaryRecoveryLevel, Math.max(1, rollQuality(false)) as RecoveryQualityGrade, 'Quiet Signal onboarding recovery'));
    }
  } else if (deep && bossItem) {
    if (directiveItem) loot = [bossItem, directiveItem];
    else if (locationItem) loot = [bossItem, locationItem];
    else {
      const [slot] = chooseRecoverySlots(profile, 1, random);
      loot = [bossItem, makeRecoveredItem(slot, 1)];
    }
  } else if (directiveItem) {
    if (deep) {
      const [slot] = chooseRecoverySlots(profile, 1, random);
      loot = [directiveItem, makeRecoveredItem(slot, 1)];
    } else loot = [directiveItem];
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

  const currentNetwork = normalizeOperatorNetworkState({
    operatorClass: operatorClassForProfile(profile),
    level: profile.level,
    specialization: profile.specialization,
    state: profile.operatorNetwork,
    legacyAllocatedNodes: profile.allocatedNodes,
    legacyUnspentPoints: profile.progressionPoints,
  });
  const nextNetwork = { ...currentNetwork, unspentPoints: currentNetwork.unspentPoints + levelsGained };
  const profileNext: PlayerProfile = {
    ...profile,
    xp: nextXp,
    level: nextLevel,
    progressionPoints: nextNetwork.unspentPoints,
    allocatedNodes: nextNetwork.allocatedNodeIds,
    operatorNetwork: nextNetwork,
    runsCompleted: profile.runsCompleted + 1,
    inventory: [...profile.inventory, ...loot],
  };
  return { profile: profileNext, xpGained, levelsGained, loot };
}
export function equipItem(profile: PlayerProfile, itemId: string): { profile: PlayerProfile; message: string } {
  const item = profile.inventory.find(entry => entry.id === itemId);
  if (!item) return { profile, message: 'Item is no longer in ship storage.' };
  if (item.levelRequirement > profile.level) return { profile, message: `Requires operator level ${item.levelRequirement}.` };
  if (isWeaponSlot(item.slot)) {
    const activeWeapon = activeWeaponFamilyForProfile(profile);
    if (item.slot !== activeWeapon) {
      const className = operatorClassDefinitions.find(definition => definition.id === operatorClassForProfile(profile))?.name ?? 'Operator';
      return { profile, message: `${className} arsenal is locked to ${activeWeapon.toUpperCase()}; ${item.name} remains in ship storage.` };
    }
  }
  return { profile: normalizeClassArmament({ ...profile, equipped: { ...profile.equipped, [item.slot]: item.id } }), message: `${item.name} equipped.` };
}
export function unequipSlot(profile: PlayerProfile, slot: EquipmentSlot): { profile: PlayerProfile; message: string } {
  if (isWeaponSlot(slot)) {
    const activeWeapon = activeWeaponFamilyForProfile(profile);
    if (slot === activeWeapon) return { profile, message: `Your class arsenal requires an equipped ${activeWeapon.toUpperCase()} armament.` };
  }
  return { profile: { ...profile, equipped: { ...profile.equipped, [slot]: null } }, message: `${slot.toUpperCase()} slot cleared.` };
}
export function discardItem(profile: PlayerProfile, itemId: string): { profile: PlayerProfile; message: string } { const item = profile.inventory.find(entry => entry.id === itemId); if (!item) return { profile, message: 'Item not found.' }; if (Object.values(profile.equipped).includes(itemId)) return { profile, message: 'Unequip this item before discarding it.' }; return { profile: { ...profile, inventory: profile.inventory.filter(entry => entry.id !== itemId) }, message: `${item.name} discarded.` }; }
export function allocateNode(profile: PlayerProfile, nodeId: string, context?: OperatorNetworkUnlockContext): { profile: PlayerProfile; message: string } {
  const network = normalizeOperatorNetworkState({
    operatorClass: operatorClassForProfile(profile),
    level: profile.level,
    specialization: profile.specialization,
    state: profile.operatorNetwork,
    legacyAllocatedNodes: profile.allocatedNodes,
    legacyUnspentPoints: profile.progressionPoints,
  });
  const result = allocateOperatorNetworkNode(network, nodeId, context);
  if (!result.allocated) {
    if (result.reason === 'already-allocated') return { profile, message: 'Node already allocated.' };
    if (result.reason === 'insufficient-points') return { profile, message: 'Gain another level to earn a progression point.' };
    if (result.reason === 'missing-prerequisite') return { profile, message: 'Allocate the required node in this route first.' };
    if (result.reason === 'not-connected') return { profile, message: 'Route through an adjacent node from your class start first.' };
    if (result.reason === 'wrong-arsenal') return { profile, message: 'That weapon sector belongs to a different operator class arsenal.' };
    if (result.reason === 'exclusive-choice') return { profile, message: 'That Keystone conflicts with the Keystone already committed in this branch.' };
    if (result.reason === 'milestone-managed') return { profile, message: 'Specialization milestones activate automatically when their requirements are met.' };
    if (result.reason === 'level-gate') return { profile, message: 'Reach the required operator level before routing this specialization node.' };
    if (result.reason === 'specialization-gate') return { profile, message: 'This node belongs to a different specialization route.' };
    if (result.reason === 'external-gate') return { profile, message: 'Complete the listed campaign, boss, or faction milestone before routing this node.' };
    return { profile, message: 'Progression node unavailable.' };
  }
  const node = progressionNodes.find(entry => entry.id === nodeId);
  return {
    profile: {
      ...profile,
      progressionPoints: result.state.unspentPoints,
      allocatedNodes: result.state.allocatedNodeIds,
      operatorNetwork: result.state,
    },
    message: `${node?.name ?? 'Network node'} allocated.`,
  };
}
export function refundNode(profile: PlayerProfile, nodeId: string, context?: OperatorNetworkUnlockContext): { profile: PlayerProfile; message: string; refundedPoints: number } {
  const network = normalizeOperatorNetworkState({
    operatorClass: operatorClassForProfile(profile),
    level: profile.level,
    specialization: profile.specialization,
    state: profile.operatorNetwork,
    legacyAllocatedNodes: profile.allocatedNodes,
    legacyUnspentPoints: profile.progressionPoints,
  });
  const result = refundOperatorNetworkNode(network, nodeId, context);
  if (!result.refunded) {
    if (result.reason === 'not-allocated') return { profile, message: 'That Network node is not allocated.', refundedPoints: 0 };
    if (result.reason === 'dependent-node') return { profile, message: 'Refund downstream nodes first so the remaining Network route stays valid.', refundedPoints: 0 };
    if (result.reason === 'milestone-managed') return { profile, message: 'Specialization milestones do not spend progression points.', refundedPoints: 0 };
    return { profile, message: 'That Network node cannot be refunded.', refundedPoints: 0 };
  }
  const node = progressionNodes.find(entry => entry.id === nodeId);
  return {
    profile: {
      ...profile,
      progressionPoints: result.state.unspentPoints,
      allocatedNodes: result.state.allocatedNodeIds,
      operatorNetwork: result.state,
    },
    message: `${node?.name ?? 'Network node'} refunded // ${result.refundedPoints} progression point${result.refundedPoints === 1 ? '' : 's'} returned.`,
    refundedPoints: result.refundedPoints,
  };
}

export function rebuildOperatorNetwork(profile: PlayerProfile): { profile: PlayerProfile; message: string; refundedPoints: number; refundedNodeIds: string[] } {
  const network = normalizeOperatorNetworkState({
    operatorClass: operatorClassForProfile(profile),
    level: profile.level,
    specialization: profile.specialization,
    state: profile.operatorNetwork,
    legacyAllocatedNodes: profile.allocatedNodes,
    legacyUnspentPoints: profile.progressionPoints,
  });
  const result = rebuildOperatorNetworkState(network);
  return {
    profile: {
      ...profile,
      progressionPoints: result.state.unspentPoints,
      allocatedNodes: result.state.allocatedNodeIds,
      operatorNetwork: result.state,
    },
    message: result.refundedNodeIds.length > 0
      ? `Operator Network rebuilt // ${result.refundedPoints} progression point${result.refundedPoints === 1 ? '' : 's'} returned.`
      : 'Operator Network already clear.',
    refundedPoints: result.refundedPoints,
    refundedNodeIds: result.refundedNodeIds,
  };
}
export function setAbilityMod(profile: PlayerProfile, ability: AbilityId, modId: string | null): PlayerProfile {
  if (modId) {
    const mod = abilityMods.find(entry => entry.id === modId && entry.ability === ability);
    if (!mod || (mod.operatorClass && mod.operatorClass !== operatorClassForProfile(profile)) || profile.level < (mod.minLevel ?? 1)) return profile;
  }
  return { ...profile, abilityMods: { ...profile.abilityMods, [ability]: modId } };
}
export function setOperatorClass(profile: PlayerProfile, operatorClass: OperatorClassId): { profile: PlayerProfile; message: string } {
  if (!operatorClassIds.has(operatorClass)) return { profile, message: 'Operator class unavailable.' };
  const current = operatorClassForProfile(profile);
  if (current === operatorClass && profile.operatorClass === operatorClass) { const name = operatorClassDefinitions.find(definition => definition.id === operatorClass)?.name ?? 'Operator'; return profile.classSelectionComplete ? { profile, message: `${name} class already active.` } : { profile: { ...profile, classSelectionComplete: true }, message: `${name} field doctrine confirmed.` }; }
  const specialization = specializationDefinitions.find(definition => definition.id === profile.specialization);
  const clearsSpecialization = !!specialization && specialization.operatorClass !== operatorClass;
  const nextAbilityMods = { ...profile.abilityMods };
  let clearsClassEvolution = false;
  for (const ability of ['mag', 'mark', 'arc'] as AbilityId[]) {
    const selectedMod = abilityMods.find(definition => definition.id === nextAbilityMods[ability]);
    if (selectedMod?.operatorClass && selectedMod.operatorClass !== operatorClass) {
      nextAbilityMods[ability] = null;
      clearsClassEvolution = true;
    }
  }
  const operatorNetwork = normalizeOperatorNetworkState({
    operatorClass,
    level: profile.level,
    specialization: clearsSpecialization ? null : profile.specialization,
    state: profile.operatorNetwork,
    legacyAllocatedNodes: profile.allocatedNodes,
    legacyUnspentPoints: profile.progressionPoints,
  });
  const next = normalizeClassArmament({
    ...profile,
    operatorClass,
    progressionPoints: operatorNetwork.unspentPoints,
    allocatedNodes: operatorNetwork.allocatedNodeIds,
    operatorNetwork,
    classSelectionComplete: true,
    specialization: clearsSpecialization ? null : profile.specialization,
    specializationOverclock: clearsSpecialization ? false : profile.specializationOverclock,
    abilityMods: nextAbilityMods,
  });
  const name = operatorClassDefinitions.find(definition => definition.id === operatorClass)?.name ?? 'Operator';
  const cleared = [clearsSpecialization ? 'specialization' : '', clearsClassEvolution ? 'class skill evolution' : ''].filter(Boolean).join(' and ');
  return { profile: next, message: cleared ? `${name} class active // incompatible ${cleared} cleared; ${activeWeaponFamilyForProfile(next).toUpperCase()} arsenal equipped and other weapons moved to storage.` : `${name} class active // ${activeWeaponFamilyForProfile(next).toUpperCase()} arsenal equipped; other weapon families remain in storage.` };
}
export function setSpecialization(profile: PlayerProfile, specialization: SpecializationId | null): PlayerProfile {
  if (profile.level < 15) return profile;
  const definition = specialization ? specializationDefinitions.find(entry => entry.id === specialization) : undefined;
  const operatorClass = operatorClassForProfile(profile);
  if (specialization && (!definition || definition.operatorClass !== operatorClass)) return profile;
  const specializationOverclock = specialization && specialization === profile.specialization && profile.level >= 16 ? profile.specializationOverclock : false;
  const operatorNetwork = normalizeOperatorNetworkState({
    operatorClass,
    level: profile.level,
    specialization,
    state: profile.operatorNetwork,
    legacyAllocatedNodes: profile.allocatedNodes,
    legacyUnspentPoints: profile.progressionPoints,
  });
  return {
    ...profile,
    specialization,
    specializationOverclock,
    progressionPoints: operatorNetwork.unspentPoints,
    allocatedNodes: operatorNetwork.allocatedNodeIds,
    operatorNetwork,
  };
}
export function setSpecializationOverclock(profile: PlayerProfile, enabled: boolean): PlayerProfile { if (profile.level < 16 || !profile.specialization) return profile; return { ...profile, specializationOverclock: enabled }; }
export function setProfileSettings(profile: PlayerProfile, settings: Partial<ProfileSettings>): PlayerProfile { return { ...profile, settings: { ...profile.settings, ...settings } }; }
function equippedItems(profile: PlayerProfile) {
  const activeWeapon = activeWeaponFamilyForProfile(profile);
  return (Object.keys(profile.equipped) as EquipmentSlot[])
    .map(slot => itemForSlot(profile, slot))
    .filter((item): item is Item => !!item && (!isWeaponSlot(item.slot) || item.slot === activeWeapon));
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
  build.operatorClass = classId;
  build.classResonanceTier = resonance.tier;
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

function applySpecializationGearSynergy(build: CombatBuild, profile: PlayerProfile) {
  const synergy = specializationGearSynergyForProfile(profile);
  if (!synergy?.active) return;
  if (synergy.definition.specialization === 'pressure-diver') {
    build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + 0.08);
    for (const ability of build.abilities) ability.cooldownMul *= 0.96;
  }
  if (synergy.definition.specialization === 'breach-vanguard') {
    build.weapon.breacher.armorDamageMul *= 1.12;
    build.weapon.breacher.penetrationAdd += 8;
  }
  if (synergy.definition.specialization === 'bulkhead-warden') {
    build.player.maxArmorAdd += 10;
    build.abilities[2].cooldownMul *= 0.94;
  }
  if (synergy.definition.specialization === 'momentum-broker') {
    build.player.maxCapAdd += 6;
    build.player.capRegenMul *= 1.1;
    build.abilities[0].cooldownMul *= 0.95;
  }
  if (synergy.definition.specialization === 'survey-deadeye') {
    build.weapon.rail.penetrationAdd += 18;
    build.abilities[1].cooldownMul *= 0.95;
  }
  if (synergy.definition.specialization === 'redline-pilot') {
    build.player.moveSpeedMul *= 1.03;
    build.mechanics.dodgeVent = true;
    build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, 1.35);
  }
  if (synergy.definition.specialization === 'grid-weaver') {
    build.mechanics.arcDrone = true;
    build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, 1.35);
    build.abilities[2].cooldownMul *= 0.95;
  }
  if (synergy.definition.specialization === 'capacitor-conductor') {
    build.player.maxCapAdd += 8;
    for (const ability of build.abilities) ability.costMul *= 0.97;
  }
  if (synergy.definition.specialization === 'thermal-shunter') {
    build.player.maxCapAdd += 6;
    for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 1.1;
  }
}

function freshBuild(): CombatBuild { const weapon = () => ({ damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }); return { operatorClass: null, classResonanceTier: 0, classSkillFamily: { family: null, frameGeneration: 1, frameIdentity: null, singularLinked: false, powerMul: 1, rangeMul: 1, controlMul: 1, armorMul: 1, recoveryMul: 1, costMul: 1, chainBonus: 0, sources: [] }, weapon: { carbine: weapon(), breacher: weapon(), rail: weapon() }, player: { maxHpAdd: 0, maxArmorAdd: 0, maxCapAdd: 0, moveSpeedMul: 1, capRegenMul: 1, vacuumResistance: 0, lowGControl: 0, ventSpeedMul: 1 }, mechanics: { railFragment: false, railFragmentScale: 0, dodgeVent: false, dodgeVentScale: 0, magRedirect: false, magRedirectScale: 0, breacherPropulsion: false, breacherPropulsionScale: 0, markWeakArmor: false, markWeakArmorScale: 0, arcDrone: false, arcDroneScale: 0, recoilVectoring: false, breachDoctrine: false, sensorPenetration: false, widebandMark: false, magOverdriveKick: false, arcGroundLoop: false, magBoundarySink: false, markExecutionTrace: false, arcCascadeLattice: false, vanguardSiegeRam: false, vanguardFaultlineTag: false, vanguardReprisalPulse: false, vectorSlingshotShift: false, vectorTriangulationLock: false, vectorNeedleFan: false, systemsAnchorLattice: false, systemsRecursiveIntrusion: false, systemsReturnCurrent: false }, singularTraits: [], specialization: null, specializationOverclock: false, abilities: [{ costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }] }; }
function applyAffix(build: CombatBuild, item: Item, modifier: ItemModifier) { const id = modifier.id; const semantics = affixStatProfile(id); const power = modifierPowerFactor(modifier.grade ?? 3); const tradeoff = modifierTradeoffFactor(modifier.grade ?? 3); const localAffix = [...semantics.stats, ...semantics.tradeoffs].some(statId => gearStatDefinition(statId).scope === 'local-affix'); const weaponSlot = item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail' ? item.slot : null; const weapon = localAffix && weaponSlot ? build.weapon[weaponSlot] : null; if (id === 'hypervelocity' && weapon) { weapon.speedMul *= 1 + 0.18 * power; weapon.penetrationAdd += Math.round(12 * power); weapon.recoilMul *= 1 + 0.1 * tradeoff; } if (id === 'countermass') { if (weapon) { weapon.recoilMul *= 1 - 0.22 * power; weapon.damageMul *= 1 - 0.07 * tradeoff; } else build.player.lowGControl += 0.12 * power; } if (id === 'overdrive' && weapon) { weapon.damageMul *= 1 + 0.14 * power; weapon.recoilMul *= 1 + 0.2 * tradeoff; weapon.heatPerShotMul *= 1 + 0.12 * tradeoff; } if (id === 'cryoloop') { if (weapon) { weapon.heatDissipationMul *= 1 + 0.3 * power; weapon.penetrationAdd -= Math.round(8 * tradeoff); } else for (const stats of Object.values(build.weapon)) stats.heatDissipationMul *= 1 + 0.15 * power; } if (id === 'extendedFeed' && weapon) { weapon.magazineAdd += Math.max(1, Math.round(6 * power)); weapon.reloadMul *= 1 + 0.12 * tradeoff; } if (id === 'tungsten' && weapon) { weapon.armorDamageMul *= 1 + 0.3 * power; weapon.penetrationAdd += Math.round(14 * power); weapon.heatPerShotMul *= 1 + 0.08 * tradeoff; } if (id === 'vacuumSeal') build.player.vacuumResistance = Math.min(0.8, build.player.vacuumResistance + 0.55 * power); if (id === 'servoWeave') { build.player.moveSpeedMul *= 1 + 0.08 * power; build.player.lowGControl += 0.22 * power; } if (id === 'capacitorRecycler') { build.player.capRegenMul *= 1 + 0.2 * power; for (const ability of build.abilities) ability.costMul *= 1 - 0.1 * power; } if (id === 'railFracture') { build.mechanics.railFragment = true; build.mechanics.railFragmentScale = Math.max(build.mechanics.railFragmentScale, power); } if (id === 'dodgeVent') { build.mechanics.dodgeVent = true; build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, power); } if (id === 'magRedirect') { build.mechanics.magRedirect = true; build.mechanics.magRedirectScale = Math.max(build.mechanics.magRedirectScale, power); } if (id === 'breachPropulsion') { build.mechanics.breacherPropulsion = true; build.mechanics.breacherPropulsionScale = Math.max(build.mechanics.breacherPropulsionScale, power); } if (id === 'markShear') { build.mechanics.markWeakArmor = true; build.mechanics.markWeakArmorScale = Math.max(build.mechanics.markWeakArmorScale, power); } if (id === 'arcDrone') { build.mechanics.arcDrone = true; build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, power); } }

function applyClassSkillFamilyInfluence(build: CombatBuild, item: Item) {
  const family = build.classSkillFamily.family;
  if (!family || item.slot !== family) return;
  const skill = build.classSkillFamily;
  const generation = Math.max(1, Math.min(6, item.frameGeneration ?? 1));
  const identity = item.frameIdentity ?? inferFrameIdentity(item.slot, `${item.baseId}:${item.name}`);
  skill.frameGeneration = generation;
  skill.frameIdentity = identity;
  skill.sources.push(`frame:${identity}`);

  // Frame Generation selects/progresses the base frame; class skills read the chosen identity,
  // not an additional hidden generation/quality multiplier layered on top.
  const identityScale = 1;
  if (identity === 'carbine-countermass') skill.controlMul *= 1 + 0.055 * identityScale;
  if (identity === 'carbine-hypervelocity') skill.rangeMul *= 1 + 0.07 * identityScale;
  if (identity === 'carbine-feedline') { skill.recoveryMul *= 1 + 0.055 * identityScale; skill.chainBonus += 1; }
  if (identity === 'breacher-thrust') skill.controlMul *= 1 + 0.085 * identityScale;
  if (identity === 'breacher-dense') { skill.powerMul *= 1 + 0.07 * identityScale; skill.armorMul *= 1 + 0.055 * identityScale; }
  if (identity === 'breacher-cryo') { skill.recoveryMul *= 1 + 0.07 * identityScale; skill.costMul *= Math.max(0.9, 1 - 0.025 * identityScale); }
  if (identity === 'rail-hypervelocity') { skill.rangeMul *= 1 + 0.08 * identityScale; skill.armorMul *= 1 + 0.045 * identityScale; }
  if (identity === 'rail-countermass') { skill.controlMul *= 1 + 0.07 * identityScale; skill.recoveryMul *= 1 + 0.03 * identityScale; }
  if (identity === 'rail-thermal') { skill.recoveryMul *= 1 + 0.055 * identityScale; skill.costMul *= Math.max(0.9, 1 - 0.035 * identityScale); }

  for (const modifier of item.modifiers) {
    const power = modifierPowerFactor(modifier.grade ?? 3);
    const tradeoff = modifierTradeoffFactor(modifier.grade ?? 3);
    if (modifier.id === 'hypervelocity') skill.rangeMul *= 1 + 0.07 * power;
    if (modifier.id === 'countermass') skill.controlMul *= 1 + 0.07 * power;
    if (modifier.id === 'overdrive') { skill.powerMul *= 1 + 0.075 * power; skill.costMul *= 1 + 0.035 * tradeoff; }
    if (modifier.id === 'cryoloop') skill.recoveryMul *= 1 + 0.065 * power;
    if (modifier.id === 'extendedFeed') { skill.recoveryMul *= 1 + 0.035 * power; if (family === 'carbine') skill.chainBonus += 1; }
    if (modifier.id === 'tungsten') skill.armorMul *= 1 + 0.09 * power;
    if (modifier.id === 'breachPropulsion' && family === 'breacher') skill.controlMul *= 1 + 0.1 * power;
    if (modifier.id === 'dodgeVent') skill.recoveryMul *= 1 + 0.035 * power;
    if (modifier.id === 'railFracture' && family === 'rail') skill.armorMul *= 1 + 0.06 * power;
    if (modifier.id === 'markShear' && family === 'rail') skill.armorMul *= 1 + 0.08 * power;
    if (modifier.id === 'magRedirect' && family === 'carbine') skill.controlMul *= 1 + 0.05 * power;
  }

  if (item.singularTrait) {
    skill.singularLinked = true;
    skill.sources.push(`singular:${item.singularTrait}`);
    if (family === 'carbine') { skill.recoveryMul *= 1.05; skill.chainBonus += 1; }
    if (family === 'breacher') { skill.controlMul *= 1.07; skill.armorMul *= 1.06; }
    if (family === 'rail') { skill.rangeMul *= 1.06; skill.armorMul *= 1.07; }
  }
}
function applyOperatorNetworkStatEffect(build: CombatBuild, effect: OperatorNetworkStatEffect) {
  const weaponTargets = effect.weapon ? [build.weapon[effect.weapon]] : Object.values(build.weapon);
  if (effect.stat === 'weapon-damage-mul') for (const weapon of weaponTargets) weapon.damageMul *= effect.value;
  if (effect.stat === 'weapon-projectile-speed-mul') for (const weapon of weaponTargets) weapon.speedMul *= effect.value;
  if (effect.stat === 'weapon-penetration-add') for (const weapon of weaponTargets) weapon.penetrationAdd += effect.value;
  if (effect.stat === 'weapon-recoil-mul') for (const weapon of weaponTargets) weapon.recoilMul *= effect.value;
  if (effect.stat === 'weapon-heat-dissipation-mul') for (const weapon of weaponTargets) weapon.heatDissipationMul *= effect.value;
  if (effect.stat === 'weapon-heat-per-shot-mul') for (const weapon of weaponTargets) weapon.heatPerShotMul *= effect.value;
  if (effect.stat === 'weapon-health-damage-mul') for (const weapon of weaponTargets) weapon.healthMultiplierMul *= effect.value;
  if (effect.stat === 'weapon-magazine-add') for (const weapon of weaponTargets) weapon.magazineAdd += effect.value;
  if (effect.stat === 'weapon-reload-mul') for (const weapon of weaponTargets) weapon.reloadMul *= effect.value;
  if (effect.stat === 'weapon-armor-damage-mul') for (const weapon of weaponTargets) weapon.armorDamageMul *= effect.value;
  if (effect.stat === 'weapon-knockback-mul') for (const weapon of weaponTargets) weapon.knockbackMul *= effect.value;
  if (effect.stat === 'player-max-hp-add') build.player.maxHpAdd += effect.value;
  if (effect.stat === 'player-max-armor-add') build.player.maxArmorAdd += effect.value;
  if (effect.stat === 'player-max-cap-add') build.player.maxCapAdd += effect.value;
  if (effect.stat === 'player-move-speed-mul') build.player.moveSpeedMul *= effect.value;
  if (effect.stat === 'player-cap-regen-mul') build.player.capRegenMul *= effect.value;
  if (effect.stat === 'player-vacuum-resistance-add') build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + effect.value);
  if (effect.stat === 'player-low-g-control-add') build.player.lowGControl += effect.value;
  if (effect.stat === 'player-vent-speed-mul') build.player.ventSpeedMul *= effect.value;
  if (effect.stat === 'ability-cost-mul') for (const ability of build.abilities) ability.costMul *= effect.value;
  if (effect.stat === 'ability-cooldown-mul') for (const ability of build.abilities) ability.cooldownMul *= effect.value;
  if (effect.stat === 'ability-power-mul') for (const ability of build.abilities) ability.powerMul *= effect.value;
  if (effect.stat === 'class-skill-power-mul') build.classSkillFamily.powerMul *= effect.value;
  if (effect.stat === 'class-skill-range-mul') build.classSkillFamily.rangeMul *= effect.value;
  if (effect.stat === 'class-skill-control-mul') build.classSkillFamily.controlMul *= effect.value;
  if (effect.stat === 'class-skill-armor-mul') build.classSkillFamily.armorMul *= effect.value;
  if (effect.stat === 'class-skill-recovery-mul') build.classSkillFamily.recoveryMul *= effect.value;
  if (effect.stat === 'class-skill-cost-mul') build.classSkillFamily.costMul *= effect.value;
}

export function specializationNetworkHooksForProfile(profile: PlayerProfile): OperatorNetworkIntegrationHook[] {
  if (profile.level < 16 || !profile.specialization) return [];
  const hooks = new Set<OperatorNetworkIntegrationHook>();
  for (const nodeId of profile.allocatedNodes) {
    const node = operatorNetworkNode(nodeId);
    if (!node?.integrationHooks?.length || (node.specialization && node.specialization !== profile.specialization)) continue;
    for (const hook of node.integrationHooks) hooks.add(hook);
  }
  return [...hooks];
}

export function hasSpecializationNetworkHook(profile: PlayerProfile, hook: OperatorNetworkIntegrationHook) {
  return specializationNetworkHooksForProfile(profile).includes(hook);
}

function applyOperatorNetworkStatBonuses(build: CombatBuild, profile: PlayerProfile) {
  for (const nodeId of profile.allocatedNodes) {
    const node = operatorNetworkNode(nodeId);
    if (!node?.effects?.length || (node.specialization && node.specialization !== profile.specialization)) continue;
    for (const effect of node.effects) applyOperatorNetworkStatEffect(build, effect);
    if (node.effects.some(effect => effect.stat.startsWith('class-skill-'))) build.classSkillFamily.sources.push(`network:${node.id}`);
  }
}

export function deriveCombatBuild(profile: PlayerProfile): CombatBuild {
  const build = freshBuild();
  build.classSkillFamily.family = activeWeaponFamilyForProfile(profile);
  const equipped = equippedItems(profile);
  for (const item of equipped) { applyFrameIdentity(build, item); applyAugments(build, item.slot, item.augments ?? []); for (const modifier of item.modifiers) applyAffix(build, item, modifier); if (item.singularTrait && !build.singularTraits.includes(item.singularTrait)) build.singularTraits.push(item.singularTrait); }
  const familyItem = equipped.find(item => item.slot === build.classSkillFamily.family);
  if (familyItem) applyClassSkillFamilyInfluence(build, familyItem);
  if (build.singularTraits.includes('magBloom')) { build.abilities[0].costMul *= 1.25; build.abilities[0].cooldownMul *= 1.08; }
  if (build.singularTraits.includes('markCascade')) build.abilities[1].cooldownMul *= 1.12;
  applyFactionSetBonuses(build, profile);
  applyOperatorClassBonuses(build, profile);
  const nodes = new Set(profile.allocatedNodes);
  if (nodes.has('ballistics-1')) for (const weapon of Object.values(build.weapon)) weapon.penetrationAdd += 8; if (nodes.has('ballistics-2')) { for (const weapon of Object.values(build.weapon)) weapon.armorDamageMul *= 1.15; build.classSkillFamily.armorMul *= 1.08; build.classSkillFamily.sources.push('network:armor-work'); } if (nodes.has('ballistics-3')) build.mechanics.breachDoctrine = true;
  if (nodes.has('mobility-1')) build.player.moveSpeedMul *= 1.06; if (nodes.has('mobility-2')) build.player.lowGControl += 0.28; if (nodes.has('mobility-3')) { build.mechanics.recoilVectoring = true; build.classSkillFamily.controlMul *= 1.06; build.classSkillFamily.sources.push('network:recoil-vectoring'); }
  if (nodes.has('systems-1')) build.player.capRegenMul *= 1.12; if (nodes.has('systems-2')) { for (const ability of build.abilities) ability.costMul *= 0.92; build.classSkillFamily.costMul *= 0.96; build.classSkillFamily.sources.push('network:signal-compression'); } if (nodes.has('systems-3')) { build.mechanics.arcDrone = true; build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, 1); if (build.classSkillFamily.family === 'carbine') build.classSkillFamily.chainBonus += 1; }
  if (nodes.has('survival-1')) build.player.maxArmorAdd += 12; if (nodes.has('survival-2')) build.player.vacuumResistance = Math.min(0.8, build.player.vacuumResistance + 0.2); if (nodes.has('survival-3')) build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + 0.5);
  if (nodes.has('engineering-1')) for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 1.12; if (nodes.has('engineering-2')) { build.player.ventSpeedMul *= 1.25; build.classSkillFamily.recoveryMul *= 1.05; build.classSkillFamily.sources.push('network:quick-vent'); } if (nodes.has('engineering-3')) { build.mechanics.dodgeVent = true; build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, 1); }
  if (nodes.has('awareness-1')) { for (const weapon of Object.values(build.weapon)) weapon.speedMul *= 1.08; build.classSkillFamily.rangeMul *= 1.06; build.classSkillFamily.sources.push('network:predictive-lead'); } if (nodes.has('awareness-2')) build.mechanics.markWeakArmor = true; if (nodes.has('awareness-3')) build.mechanics.sensorPenetration = true;
  applyOperatorNetworkStatBonuses(build, profile);
  const specialization = profile.level >= 15 ? profile.specialization : null;
  build.specialization = specialization;
  build.specializationOverclock = profile.level >= 16 && !!specialization && profile.specializationOverclock;
  if (specialization === 'pressure-diver') { build.player.maxArmorAdd -= 12; if (build.specializationOverclock) for (const ability of build.abilities) ability.costMul *= 1.12; }
  if (specialization === 'momentum-broker') { build.player.capRegenMul *= 0.85; if (build.specializationOverclock) for (const weapon of Object.values(build.weapon)) weapon.recoilMul *= 1.12; }
  if (specialization === 'grid-weaver') { for (const weapon of Object.values(build.weapon)) weapon.damageMul *= 0.96; if (build.specializationOverclock) build.abilities[2].costMul *= 1.15; }
  if (specialization === 'survey-deadeye') { build.abilities[1].powerMul *= 0.8; build.abilities[1].cooldownMul *= 1.1; if (build.specializationOverclock) build.weapon.rail.heatPerShotMul *= 1.08; }
  if (specialization === 'redline-pilot') { for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 0.82; if (build.specializationOverclock) build.player.maxArmorAdd -= 8; }
  if (specialization === 'breach-vanguard') { build.player.moveSpeedMul *= 0.95; build.weapon.breacher.heatPerShotMul *= 1.1; if (build.specializationOverclock) build.weapon.breacher.healthMultiplierMul *= 0.92; }
  if (specialization === 'bulkhead-warden') { for (const weapon of Object.values(build.weapon)) weapon.damageMul *= 0.92; if (build.specializationOverclock) build.abilities[2].costMul *= 1.1; }
  if (specialization === 'capacitor-conductor') { build.player.maxCapAdd -= 12; if (build.specializationOverclock) for (const ability of build.abilities) ability.costMul *= 1.1; }
  if (specialization === 'thermal-shunter') { build.player.maxArmorAdd -= 10; if (build.specializationOverclock) for (const weapon of Object.values(build.weapon)) weapon.heatPerShotMul *= 1.1; }
  applySpecializationGearSynergy(build, profile);
  const specializationHooks = new Set(specializationNetworkHooksForProfile(profile));
  const specializationGearLink = specializationGearSynergyForProfile(profile);
  if (specializationHooks.has('gear') && specializationGearLink?.active) {
    build.classSkillFamily.powerMul *= 1.04;
    build.classSkillFamily.recoveryMul *= 1.04;
    build.classSkillFamily.sources.push(`network:spec-gear:${profile.specialization}`);
  }
  if (specializationHooks.has('faction')) {
    const faction = dominantEquipmentFaction(profile);
    if (faction) {
      build.classSkillFamily.controlMul *= 1.04;
      build.player.capRegenMul *= 1.04;
      build.classSkillFamily.sources.push(`network:spec-faction:${faction}`);
    }
  }
  if (specializationHooks.has('singular') && build.classSkillFamily.singularLinked) {
    build.classSkillFamily.powerMul *= 1.05;
    build.classSkillFamily.rangeMul *= 1.04;
    build.classSkillFamily.sources.push(`network:spec-singular:${profile.specialization}`);
  }
  if (profile.abilityMods.mag === 'vanguard-siege-ram' && operatorClassForProfile(profile) === 'vanguard' && profile.level >= 16) { build.mechanics.vanguardSiegeRam = true; build.abilities[0].cooldownMul *= 1.2; }
  if (profile.abilityMods.mark === 'vanguard-faultline-tag' && operatorClassForProfile(profile) === 'vanguard' && profile.level >= 16) { build.mechanics.vanguardFaultlineTag = true; build.abilities[1].costMul *= 1.18; }
  if (profile.abilityMods.arc === 'vanguard-reprisal-pulse' && operatorClassForProfile(profile) === 'vanguard' && profile.level >= 16) { build.mechanics.vanguardReprisalPulse = true; build.abilities[2].cooldownMul *= 1.18; }
  if (profile.abilityMods.mag === 'vector-slingshot-shift' && operatorClassForProfile(profile) === 'vector' && profile.level >= 16) { build.mechanics.vectorSlingshotShift = true; build.abilities[0].costMul *= 1.18; }
  if (profile.abilityMods.mark === 'vector-triangulation-lock' && operatorClassForProfile(profile) === 'vector' && profile.level >= 16) { build.mechanics.vectorTriangulationLock = true; build.abilities[1].cooldownMul *= 1.18; }
  if (profile.abilityMods.arc === 'vector-needle-fan' && operatorClassForProfile(profile) === 'vector' && profile.level >= 16) { build.mechanics.vectorNeedleFan = true; build.abilities[2].cooldownMul *= 1.2; }
  if (profile.abilityMods.mag === 'systems-anchor-lattice' && operatorClassForProfile(profile) === 'systems' && profile.level >= 16) { build.mechanics.systemsAnchorLattice = true; build.abilities[0].cooldownMul *= 1.18; }
  if (profile.abilityMods.mark === 'systems-recursive-intrusion' && operatorClassForProfile(profile) === 'systems' && profile.level >= 16) { build.mechanics.systemsRecursiveIntrusion = true; build.abilities[1].costMul *= 1.18; }
  if (profile.abilityMods.arc === 'systems-return-current' && operatorClassForProfile(profile) === 'systems' && profile.level >= 16) { build.mechanics.systemsReturnCurrent = true; build.abilities[2].cooldownMul *= 1.2; }
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
export function buildIdentity(profile: PlayerProfile) {
  const factionDoctrine = factionSetState(profile).sort((a, b) => b.count - a.count).find(state => state.count >= 4);
  const items = equippedItems(profile);
  const allModifiers = items.flatMap(item => item.modifiers.map(modifier => modifier.id));
  const nodes = new Set(profile.allocatedNodes);
  const breacher = allModifiers.filter(id => ['overdrive', 'tungsten', 'breachPropulsion'].includes(id)).length + (nodes.has('ballistics-3') ? 2 : 0);
  const mobile = allModifiers.filter(id => ['countermass', 'servoWeave', 'dodgeVent'].includes(id)).length + (nodes.has('mobility-3') ? 2 : 0);
  const systems = allModifiers.filter(id => ['capacitorRecycler', 'magRedirect', 'markShear', 'arcDrone'].includes(id)).length + (nodes.has('systems-3') ? 2 : 0);
  const base = factionDoctrine ? factionDoctrine.definition.combatIdentity : systems >= breacher && systems >= mobile && systems > 0 ? 'Systems / Drone Specialist' : mobile >= breacher && mobile > 0 ? 'Mobile Gunfighter' : breacher > 0 ? 'Heavy Breacher' : 'Generalist Operator';
  const classDefinition = operatorClassDefinitions.find(definition => definition.id === operatorClassForProfile(profile))!;
  const specialization = profile.level >= 15 ? specializationDefinitions.find(definition => definition.id === profile.specialization) : undefined;
  const capstone = profile.level >= 16 ? Object.values(profile.abilityMods).map(abilityMod => capstoneInteractionFor(profile, abilityMod)).find(Boolean) : undefined;
  const gearSynergy = specializationGearSynergyForProfile(profile);
  return specialization
    ? `${classDefinition.name} / ${specialization.name}${profile.level >= 16 && profile.specializationOverclock ? ' // OVERCLOCK' : ''}${capstone ? ` // ${capstone.name}` : ''}${gearSynergy?.active ? ` // ${gearSynergy.definition.name}` : ''} · ${base}`
    : `${classDefinition.name} · ${base}`;
}
export function comparisonSummary(item: Item, equipped: Item | undefined) { const summarize = (entry: Item | undefined) => entry?.modifiers.map(modifier => `${(modifier.family ?? modifierFamilyFor(modifier.id)).toUpperCase()} G${modifier.grade ?? 3} ${modifier.label}`).join(', ') || 'No special modifiers'; return { current: summarize(equipped), candidate: summarize(item) }; }
export function itemForSlot(profile: PlayerProfile, slot: EquipmentSlot) { const id = profile.equipped[slot]; return id ? profile.inventory.find(item => item.id === id && item.slot === slot) : undefined; }
