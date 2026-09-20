import type { CombatBuild } from './sim';
import { consumableDefinition, defaultConsumables, type ConsumableId, type ConsumableInventory } from './consumables';

export type FactionId = 'meridian' | 'heliostat' | 'longarc';
export type ContractArchetype = 'salvage' | 'boarding' | 'stabilization';
export type ObjectiveMode = 'pressure-recovery' | 'grid-isolation' | 'gravity-stabilization' | 'machinery-recovery' | 'emergency-boarding' | 'deep-salvage' | 'momentum-capture' | 'thermal-routing' | 'reference-alignment';
export type LocationId = 'orbital-station' | 'damaged-vessel' | 'asteroid-refinery' | 'spin-habitat' | 'jovian-harvester' | 'ice-mine' | 'solar-yard' | 'lattice-annex' | 'momentum-exchange' | 'cryo-reserve' | 'parallax-array';
export type ConditionId = 'unstable-pressure' | 'failing-gravity' | 'damaged-grid' | 'automated-defense' | 'limited-atmosphere' | 'low-visibility';
export type ShipUpgradeId = 'reactor' | 'drive' | 'armor' | 'cargo' | 'sensors' | 'fabrication' | 'medical' | 'drones';
export type ResourceId = 'credits' | 'alloys' | 'electronics' | 'medstock' | 'components' | 'rareTech';
export type SalvageWallet = Record<ResourceId, number>;
export type StoryArcId = 'vanishing-wake' | 'terms-of-survival' | 'cold-sun-protocol';
export type StoryArcProgress = { status: 'available' | 'active' | 'complete'; step: number; choiceA: string | null; choiceB: string | null; completed: string[] };
export type BlackLatticeProgress = { status: 'locked' | 'active' | 'complete'; step: number; choiceA: string | null; choiceB: string | null; choiceC: string | null; completed: string[]; evidence: string[]; lastBeat: string };
export type PostKhepriProgress = { status: 'locked' | 'available' | 'active' | 'complete'; step: number; choiceA: string | null; completed: string[]; evidence: string[]; lastBeat: string };
export type InterdictionProgress = { status: 'locked' | 'available' | 'active' | 'complete'; step: number; choiceA: string | null; completed: string[]; evidence: string[]; identifiedTargets: string[]; lastBeat: string };
export type ParallaxDebtProgress = { status: 'locked' | 'active' | 'complete'; step: number; choiceA: string | null; completed: string[]; evidence: string[]; lastBeat: string };
export type StoryState = { arcs: Record<StoryArcId, StoryArcProgress>; latticeClues: number; lastBeat: string; blackLattice: BlackLatticeProgress; postKhepri: PostKhepriProgress; interdiction: InterdictionProgress; parallaxDebt: ParallaxDebtProgress };
export type EscalationState = { status: 'idle' | 'active' | 'complete'; operationDate: string | null; seed: number; codename: string; sponsor: FactionId; stage: number; completed: string[]; lastBeat: string };
export type MegastructureId = 'generation-ship' | 'counterweight' | 'hidden-habitat' | 'shipbreaking-yard';
export type MegastructureStage = {
  name: string;
  location: LocationId;
  objectiveMode: ObjectiveMode;
  conditions: ConditionId[];
  optionalLabel: string;
  transitionRoute?: string;
  transitionDetail?: string;
  arrivalCue?: string;
  continuityConditions?: ConditionId[];
  continuityDetail?: string;
};
export type MegastructureDefinition = { id: MegastructureId; title: string; siteName: string; sponsor: FactionId; archetype: ContractArchetype; briefing: string; deepTarget?: string; stages: MegastructureStage[]; rewardBase: Partial<SalvageWallet>; reputationGain: number };
export type ExpeditionProgress = { zonesCompleted: number; optionalRecovered: number };
export type MegastructureDebriefStage = { name: string; optionalLabel: string; secured: boolean; continuityLabels: string[]; continuityDetail: string | null };
export type MegastructureDebrief = {
  siteName: string;
  zonesCompleted: number;
  totalZones: number;
  optionalRecovered: number;
  completion: 'partial' | 'full' | 'deep';
  outcomeLabel: string;
  outcomeDetail: string;
  finaleLabel: string;
  finaleDetail: string;
  stages: MegastructureDebriefStage[];
  continuityNotes: Array<{ stageName: string; labels: string[]; detail: string }>;
};
export type DirectiveModifierId = 'compromised-shell' | 'unstable-mass' | 'overloaded-bus' | 'third-party-boarders' | 'scarce-safe-rooms' | 'elite-reinforcements' | 'repair-network' | 'event-cascade' | 'protocol-density';
export type DirectiveTargetClass = 'elite-led' | 'command-target';
export type OperationDirective = { id: string; seed: number; tier: number; location: LocationId; locationName: string; sponsor: FactionId; archetype: ContractArchetype; objectiveMode: ObjectiveMode; modifierIds: DirectiveModifierId[]; targetClass: DirectiveTargetClass; deepTarget: string; codename: string; sourceLabel: string };
export type DirectiveState = { unlocked: boolean; inventory: OperationDirective[]; preparedId: string | null; completed: number; highestTier: number; lastBeat: string };
export type CampaignState = { version: 1; cycle: number; contractsCompleted: number; resources: SalvageWallet; consumables: ConsumableInventory; reputation: Record<FactionId, number>; shipUpgrades: Record<ShipUpgradeId, number>; anomalyRecovered: boolean; dailyCompletedDate: string | null; lastOutcome: string; story: StoryState; escalation: EscalationState; directives: DirectiveState };
export type FactionProfile = { id: FactionId; name: string; history: string; economy: string; culture: string; technology: string; goals: string; strengths: string; failures: string; divisions: string; unlocks: string[] };
export type Contract = { id: string; sponsor: FactionId; archetype: ContractArchetype; location: LocationId; locationName: string; title: string; objective: string; objectiveMode: ObjectiveMode; objectiveSteps: string[]; briefing: string; conditions: ConditionId[]; conditionLabels: string[]; directorPreview: string; deepTarget: string; rewardBase: Partial<SalvageWallet>; reputationGain: number; contestedFaction?: FactionId; priority: boolean; anomalyOpportunity: boolean; daily?: boolean; operationDate?: string; seed: number; storyArc?: StoryArcId; storyStep?: number; storyFinale?: boolean; storyChapter?: string; storyClue?: boolean; storyAftermath?: string; campaignChapter?: 'black-lattice' | 'dead-reckoning' | 'dead-reckoning-interdiction' | 'parallax-debt'; campaignStep?: number; campaignFinale?: boolean; campaignEvidence?: string; campaignAftermath?: string; escalationStage?: number; escalationFinale?: boolean; escalationDate?: string; megastructure?: MegastructureId; megastructureStage?: number; megastructureStageCount?: number; megastructureZoneNames?: string[]; megastructureOptionalLabel?: string; megastructureBossTarget?: string; megastructureTransitionRoute?: string; megastructureTransitionDetail?: string; megastructureArrivalCue?: string; megastructureContinuityConditions?: ConditionId[]; megastructureContinuityDetail?: string; operationTier?: number; encounterRating?: number; threatBudget?: number; maxRecoveryLevel?: number; maxFrameGeneration?: 1 | 2 | 3 | 4 | 5 | 6; eliteProtocolSlots?: number; environmentalEventSlots?: number; combatEffectiveness?: number; monsterLevel?: number; monsterDamageScale?: number; operationRewardMultiplier?: number; chapterRewardMultiplier?: number; xpFloor?: number; encounterPressureBonus?: number; encounterPattern?: 'swarm' | 'mixed' | 'elite-led'; reserveCount?: number; directiveId?: string; directiveTier?: number; directiveModifierIds?: DirectiveModifierId[]; directiveTargetClass?: DirectiveTargetClass; directiveMaterialMultiplier?: number; directiveQualityBonus?: number; directiveSingularChanceBonus?: number; directiveRecoveryLevelBonus?: number; directiveEventBias?: string[]; directiveProtocolBias?: string[]; directiveThreatBonus?: number; directiveProtocolBonus?: number; directiveProtocolDensity?: number; directiveEventBonus?: number; directiveReserveBonus?: number; directiveRiskScore?: number; directiveSource?: string; commandTrace?: boolean };
export type DailyOperationSpec = { date: string; seed: number; codename: string; sponsor: FactionId; archetype: ContractArchetype; objectiveMode: ObjectiveMode; location: LocationId; conditions: ConditionId[]; challenge: string; generatedAt: string };
export type CampaignReward = { campaign: CampaignState; gained: SalvageWallet; reputationDelta: Partial<Record<FactionId, number>>; anomalyRecovered: boolean; depth: 'safe' | 'deep' };
export type UpgradeDefinition = { id: ShipUpgradeId; name: string; area: 'Engineering' | 'Cargo' | 'Medical' | 'Fabrication'; description: string; benefits: [string, string]; costs: [Partial<SalvageWallet>, Partial<SalvageWallet>] };

const STORAGE_KEY = 'ironshade-vector-campaign-v1';
const zeroWallet = (): SalvageWallet => ({ credits: 0, alloys: 0, electronics: 0, medstock: 0, components: 0, rareTech: 0 });

export const resourceLabels: Record<ResourceId, string> = { credits: 'Credits', alloys: 'Industrial alloys', electronics: 'Electronics', medstock: 'Medical stock', components: 'Specialized components', rareTech: 'Quarantined trace' };

export const factions: FactionProfile[] = [
  { id: 'meridian', name: 'Meridian Compact', history: 'Meridian grew from emergency freight accords between crowded inner-system habitats after a chain of life-support and shipping failures. Those temporary standards hardened into a powerful commercial compact.', economy: 'Bonded freight, habitat infrastructure, insurance pools, pressure-rated construction, and long-term logistics finance.', culture: 'Procedure, certification, negotiated obligation, and a belief that survivable infrastructure is a civic achievement rather than a private luxury.', technology: 'Reliable armor systems, pressure engineering, redundant medical hardware, and conservative machinery designed for predictable maintenance.', goals: 'Keep trade corridors interoperable and prevent independent operators from destabilizing shared infrastructure or defaulting on system-wide obligations.', strengths: 'Excellent logistics, durable equipment, strong emergency response, and institutions that can coordinate across many habitats.', failures: 'Debt enforcement and standardization can become coercive; smaller stations can be trapped inside contracts they had little power to negotiate.', divisions: 'Infrastructure cooperatives want softer terms while bond houses and security boards argue that exceptions destroy the trust the Compact is built on.', unlocks: ['REP 6: discounts on Armor and Medical ship upgrades', 'REP 8: Meridian contracts become Priority contracts', 'REP 12: deeper upgrade discount'] },
  { id: 'heliostat', name: 'Heliostat League', history: 'Heliostat began as a network of solar-manufacturing cities that pooled fabrication standards while refusing outside control of their foundries and research culture.', economy: 'High-temperature manufacturing, energy storage, electronics, precision fabrication, and aggressive licensing of industrial designs.', culture: 'Technical prestige, rapid iteration, public engineering competitions, and a strong expectation that useful ideas should survive contact with real machinery.', technology: 'Power systems, thermal management, sensors, autonomous tools, and unusually ambitious prototype hardware.', goals: 'Maintain technical independence, expand manufacturing access, and prevent large logistics blocs from turning supply contracts into political control.', strengths: 'Fast engineering cycles, excellent power technology, flexible manufacturing, and a culture comfortable with difficult technical improvisation.', failures: 'Workers can become expendable to project schedules, failed prototypes are sometimes externalized onto poorer partners, and technical status can become social hierarchy.', divisions: 'Open-engineering guilds oppose proprietary foundry councils that want tighter control over strategic designs and research exports.', unlocks: ['REP 6: discounts on Reactor, Fabrication, and Drone upgrades', 'REP 8: Heliostat contracts become Priority contracts', 'REP 12: deeper upgrade discount'] },
  { id: 'longarc', name: 'Long Arc Assembly', history: 'Long Arc formed when remote convoys, itinerant repair crews, and small resource settlements created mutual-aid compacts to bargain against distant creditors and monopoly haulers.', economy: 'Salvage, distributed mining, repair services, convoy trade, reclaimed hardware, and difficult low-volume routes larger firms ignore.', culture: 'Practical autonomy, reciprocal favors, local decision making, and deep respect for people who can keep a failing system alive with limited parts.', technology: 'Low-mass drive work, field repair, improvised sensors, cargo systems, and rugged modifications built around parts availability rather than elegance.', goals: 'Keep remote communities economically viable and prevent essential transport, repair, and resource routes from being absorbed by monopoly control.', strengths: 'Adaptability, local knowledge, strong salvage culture, and excellent operation in low-support environments.', failures: 'Consensus is slow, local captains sometimes become unaccountable, and mutual-aid obligations can be selectively interpreted when resources are scarce.', divisions: 'Settlement delegates favor formal institutions while roaming captains fear that centralization would recreate the systems the Assembly was formed to escape.', unlocks: ['REP 6: discounts on Drive, Cargo, and Sensor upgrades', 'REP 8: Long Arc contracts become Priority contracts', 'REP 12: deeper upgrade discount'] },
];

export const upgradeDefinitions: UpgradeDefinition[] = [
  { id: 'reactor', name: 'Reactor Bus', area: 'Engineering', description: 'Improves deployment capacitor reserve and recharge headroom.', benefits: ['+12 max capacitor and +10% regeneration', '+24 max capacitor and +20% regeneration'], costs: [{ credits: 180, electronics: 3 }, { credits: 340, electronics: 6, components: 2 }] },
  { id: 'drive', name: 'Vector Drive', area: 'Engineering', description: 'Improves suit-thruster calibration and low-g control data.', benefits: ['+4% movement speed and low-g braking', '+8% movement speed and stronger low-g braking'], costs: [{ credits: 170, alloys: 3 }, { credits: 320, alloys: 6, components: 1 }] },
  { id: 'armor', name: 'Deployment Armor Locker', area: 'Engineering', description: 'Adds better modular plates to every pressure-suit deployment.', benefits: ['+10 starting armor', '+20 starting armor'], costs: [{ credits: 190, alloys: 4 }, { credits: 360, alloys: 7, components: 1 }] },
  { id: 'cargo', name: 'Cargo Recovery Grid', area: 'Cargo', description: 'Improves how much tagged salvage survives extraction and sorting.', benefits: ['+12% salvage yield', '+24% salvage yield'], costs: [{ credits: 150, alloys: 2, electronics: 1 }, { credits: 300, alloys: 4, electronics: 2 }] },
  { id: 'sensors', name: 'Long-Baseline Sensors', area: 'Engineering', description: 'Improves pre-deployment firing solutions and mark telemetry.', benefits: ['+4% projectile velocity and stronger Sensor Spike', '+8% projectile velocity and stronger Sensor Spike'], costs: [{ credits: 180, electronics: 3 }, { credits: 350, electronics: 5, components: 2 }] },
  { id: 'fabrication', name: 'Microforge', area: 'Fabrication', description: 'Expands deterministic shipboard reconstruction rather than improving random drops.', benefits: ['Unlocks modifier-family rerouting/addition, quality 16, G4 calibration, second-socket access, and -10% reconstruction credit costs', 'Unlocks family-lock recalibration, quality 20, G5 calibration, full socket access, and -20% reconstruction credit costs'], costs: [{ credits: 210, alloys: 2, electronics: 2 }, { credits: 390, alloys: 4, electronics: 4, components: 2 }] },
  { id: 'medical', name: 'Trauma Bay', area: 'Medical', description: 'Improves deployment stabilization and operator reserve.', benefits: ['+8 maximum health', '+16 maximum health'], costs: [{ credits: 160, medstock: 3 }, { credits: 300, medstock: 6, electronics: 1 }] },
  { id: 'drones', name: 'Support Drone Rack', area: 'Engineering', description: 'Adds a ship-linked relay drone to electronic combat packages.', benefits: ['Disrupted targets can be serviced by a relay drone', 'Faster Arc Tap cycling and relay support'], costs: [{ credits: 220, electronics: 4, components: 1 }, { credits: 420, electronics: 7, components: 3 }] },
];

function createDefaultStory(): StoryState {
  const progress = (): StoryArcProgress => ({ status: 'available', step: 0, choiceA: null, choiceB: null, completed: [] });
  return { arcs: { 'vanishing-wake': progress(), 'terms-of-survival': progress(), 'cold-sun-protocol': progress() }, latticeClues: 0, lastBeat: 'Three unresolved story operations are available from the Quiet Signal.', blackLattice: { status: 'locked', step: 0, choiceA: null, choiceB: null, choiceC: null, completed: [], evidence: [], lastBeat: 'Recover a quarantined trace or lattice finding to open the first major campaign chapter.' }, postKhepri: { status: 'locked', step: 0, choiceA: null, completed: [], evidence: [], lastBeat: 'Complete The Black Lattice and reach operator level 11 to open the post-Khepri investigation.' }, interdiction: { status: 'locked', step: 0, choiceA: null, completed: [], evidence: [], identifiedTargets: [], lastBeat: 'Complete Dead Reckoning and reach operator level 13 to expose the custody network defending the hidden cadence.' }, parallaxDebt: { status: 'locked', step: 0, choiceA: null, completed: [], evidence: [], lastBeat: 'Complete Interdiction and reach operator level 15 to compare the hidden route against an independent long-baseline reference.' } }; 
}
function createDefaultEscalation(): EscalationState {
  return { status: 'idle', operationDate: null, seed: 0, codename: '', sponsor: 'longarc', stage: 0, completed: [], lastBeat: 'No escalation sequence is active.' };
}
function createDefaultDirectives(): DirectiveState {
  return { unlocked: false, inventory: [], preparedId: null, completed: 0, highestTier: 0, lastBeat: 'Directive Array locked // reach operator level 10 to begin endgame navigation recovery.' };
}
export function createDefaultCampaign(): CampaignState { return { version: 1, cycle: 0, contractsCompleted: 0, resources: { credits: 120, alloys: 1, electronics: 1, medstock: 1, components: 0, rareTech: 0 }, consumables: defaultConsumables(), reputation: { meridian: 0, heliostat: 0, longarc: 0 }, shipUpgrades: { reactor: 0, drive: 0, armor: 0, cargo: 0, sensors: 0, fabrication: 0, medical: 0, drones: 0 }, anomalyRecovered: false, dailyCompletedDate: null, lastOutcome: 'Quiet Signal ready for contract selection.', story: createDefaultStory(), escalation: createDefaultEscalation(), directives: createDefaultDirectives() }; }
export function loadCampaign(): CampaignState {
  if (typeof window === 'undefined') return createDefaultCampaign();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultCampaign();
    const parsed = JSON.parse(raw) as Partial<CampaignState>;
    const defaults = createDefaultCampaign();
    if (parsed.version !== 1) return defaults;
    const parsedStory = parsed.story;
    const parsedEscalation = parsed.escalation;
    const parsedDirectives = parsed.directives;
    return {
      ...defaults,
      ...parsed,
      resources: { ...defaults.resources, ...parsed.resources },
      consumables: { ...defaults.consumables, ...parsed.consumables },
      reputation: { ...defaults.reputation, ...parsed.reputation },
      shipUpgrades: { ...defaults.shipUpgrades, ...parsed.shipUpgrades },
      story: {
        ...defaults.story,
        ...parsedStory,
        arcs: {
          'vanishing-wake': { ...defaults.story.arcs['vanishing-wake'], ...parsedStory?.arcs?.['vanishing-wake'] },
          'terms-of-survival': { ...defaults.story.arcs['terms-of-survival'], ...parsedStory?.arcs?.['terms-of-survival'] },
          'cold-sun-protocol': { ...defaults.story.arcs['cold-sun-protocol'], ...parsedStory?.arcs?.['cold-sun-protocol'] },
        },
        blackLattice: { ...defaults.story.blackLattice, ...parsedStory?.blackLattice, completed: parsedStory?.blackLattice?.completed ?? defaults.story.blackLattice.completed, evidence: parsedStory?.blackLattice?.evidence ?? defaults.story.blackLattice.evidence },
        postKhepri: { ...defaults.story.postKhepri, ...parsedStory?.postKhepri, completed: parsedStory?.postKhepri?.completed ?? defaults.story.postKhepri.completed, evidence: parsedStory?.postKhepri?.evidence ?? defaults.story.postKhepri.evidence },
        interdiction: { ...defaults.story.interdiction, ...parsedStory?.interdiction, completed: parsedStory?.interdiction?.completed ?? defaults.story.interdiction.completed, evidence: parsedStory?.interdiction?.evidence ?? defaults.story.interdiction.evidence, identifiedTargets: parsedStory?.interdiction?.identifiedTargets ?? defaults.story.interdiction.identifiedTargets },
        parallaxDebt: { ...defaults.story.parallaxDebt, ...parsedStory?.parallaxDebt, completed: parsedStory?.parallaxDebt?.completed ?? defaults.story.parallaxDebt.completed, evidence: parsedStory?.parallaxDebt?.evidence ?? defaults.story.parallaxDebt.evidence },
      },
      escalation: { ...defaults.escalation, ...parsedEscalation, completed: parsedEscalation?.completed ?? defaults.escalation.completed },
      directives: { ...defaults.directives, ...parsedDirectives, inventory: Array.isArray(parsedDirectives?.inventory) ? parsedDirectives.inventory : defaults.directives.inventory, preparedId: parsedDirectives?.preparedId ?? defaults.directives.preparedId },
    };
  } catch { return createDefaultCampaign(); }
}
export function saveCampaign(campaign: CampaignState) { if (typeof window === 'undefined') return true; try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign)); return true; } catch { return false; } }

export function buyConsumable(campaign: CampaignState, id: ConsumableId) {
  const definition = consumableDefinition(id);
  const current = campaign.consumables[id] ?? 0;
  if (current >= definition.maxStock) return { campaign, message: `${definition.name} stock is full (${definition.maxStock}).` };
  if (campaign.resources.credits < definition.cost) return { campaign, message: `Need ${definition.cost} Credits for ${definition.name}.` };
  return {
    campaign: {
      ...campaign,
      resources: { ...campaign.resources, credits: campaign.resources.credits - definition.cost },
      consumables: { ...campaign.consumables, [id]: current + 1 },
    },
    message: `${definition.name} purchased // ${current + 1}/${definition.maxStock} stocked // ${definition.cost} Credits spent.`,
  };
}

export const conditionLabel: Record<ConditionId, string> = { 'unstable-pressure': 'Unstable pressure shell', 'failing-gravity': 'Failing gravity control', 'damaged-grid': 'Damaged electrical grid', 'automated-defense': 'Automated defense remnants', 'limited-atmosphere': 'Limited atmosphere', 'low-visibility': 'Low visibility particulates' };
const locations: Array<{ id: LocationId; name: string }> = [
  { id: 'orbital-station', name: 'Orbital Industrial Station' },
  { id: 'damaged-vessel', name: 'Damaged Freight Vessel' },
  { id: 'asteroid-refinery', name: 'Asteroid Refinery' },
  { id: 'spin-habitat', name: 'Rotating Spin Habitat' },
  { id: 'jovian-harvester', name: 'Jovian Gas-Harvester Platform' },
  { id: 'ice-mine', name: 'Subsurface Ice-Mining Installation' },
  { id: 'solar-yard', name: 'Solar-Orbit Fabrication Yard' },
];
export function locationNameFor(id: LocationId) { return locations.find(location => location.id === id)?.name ?? (id === 'lattice-annex' ? 'Khepri Survey Annex' : id === 'momentum-exchange' ? 'Cislunar Momentum Exchange' : id === 'cryo-reserve' ? 'Umbra Cryogenic Propellant Reserve' : id === 'parallax-array' ? 'Cislunar Parallax Array' : id); }
const archetypes: Array<{ id: ContractArchetype; sponsor: FactionId }> = [{ id: 'salvage', sponsor: 'longarc' }, { id: 'boarding', sponsor: 'meridian' }, { id: 'stabilization', sponsor: 'heliostat' }];

export function factionDisplayName(id: FactionId) { return factions.find(faction => faction.id === id)?.name ?? id; }

const objectiveModes: ObjectiveMode[] = ['pressure-recovery', 'grid-isolation', 'gravity-stabilization', 'machinery-recovery', 'emergency-boarding', 'deep-salvage'];
const tacticalLocations = new Set<LocationId>(['spin-habitat', 'jovian-harvester', 'ice-mine', 'solar-yard']);

function defaultObjectiveMode(archetype: ContractArchetype, location: LocationId): ObjectiveMode {
  if (archetype === 'salvage') return location === 'damaged-vessel' ? 'pressure-recovery' : location === 'asteroid-refinery' ? 'machinery-recovery' : 'deep-salvage';
  if (archetype === 'boarding') return location === 'asteroid-refinery' ? 'grid-isolation' : 'emergency-boarding';
  return location === 'damaged-vessel' ? 'pressure-recovery' : location === 'asteroid-refinery' ? 'gravity-stabilization' : 'grid-isolation';
}

function authoredObjective(location: LocationId, mode: ObjectiveMode): { objective: string; steps: string[] } | null {
  const copy: Partial<Record<LocationId, Partial<Record<ObjectiveMode, { objective: string; steps: string[] }>>>> = {
    'spin-habitat': {
      'pressure-recovery': { objective: 'Seal a rim pressure leak before emergency spindown drags atmosphere toward the axis.', steps: ['Cross the rotating rim to the pressure manifold.', 'Seal the leaking ring segment with ACT.', 'Hold through spindown until pressure recovers.'] },
      'grid-isolation': { objective: 'Isolate the rim and spoke power branches before spin imbalance cascades through the drive bus.', steps: ['Reach both spin-bus isolators.', 'Isolate each branch with ACT.', 'Clear the ring while the drive bus stabilizes.'] },
      'gravity-stabilization': { objective: 'Calibrate rim and spoke gravity trims so the habitat survives its emergency spindown cycle.', steps: ['Calibrate the rim gravity trim.', 'Calibrate the spoke gravity trim.', 'Hold the habitat through the gravity transition.'] },
      'machinery-recovery': { objective: 'Tag the bearing-control and attitude-flywheel packages without losing them during spindown.', steps: ['Reach both rotating machinery packages.', 'Tag each package with ACT.', 'Clear the recovery path before extraction.'] },
      'emergency-boarding': { objective: 'Cycle the spoke and axis pressure locks while the habitat transitions between gravity states.', steps: ['Reach the spoke pressure interlock.', 'Cycle the axis pressure lock.', 'Break the boarding line and secure the ring.'] },
      'deep-salvage': { objective: 'Tag recovery caches on the rim, spoke, and axis hub before the next spin transition.', steps: ['Tag the rim recovery cache.', 'Tag the spoke recovery cache.', 'Tag the axis cache and clear the ring.'] },
    },
    'jovian-harvester': {
      'pressure-recovery': { objective: 'Seal the storm-deck relief breach before the pressure shear strips the maintenance lane.', steps: ['Reach the storm relief manifold.', 'Seal the active deck breach.', 'Hold until the maintenance deck repressurizes.'] },
      'grid-isolation': { objective: 'Isolate both electrostatic harvesting branches before storm charge feeds the damaged grid.', steps: ['Reach the skimmer bus isolator.', 'Reach the compressor bus isolator.', 'Isolate both branches and clear the deck.'] },
      'gravity-stabilization': { objective: 'Calibrate both deck mass trims so pressure shear cannot throw the platform out of alignment.', steps: ['Calibrate the maintenance-deck trim.', 'Calibrate the compressor-crown trim.', 'Hold the platform through the shear window.'] },
      'machinery-recovery': { objective: 'Tag an intact skimmer compressor and separator package before the storm vent cycle returns.', steps: ['Reach both exposed machinery packages.', 'Tag each package with ACT.', 'Clear the maintenance route for extraction.'] },
      'emergency-boarding': { objective: 'Cycle both storm-rated pressure locks and reopen the maintenance route.', steps: ['Cycle the inner storm lock.', 'Cycle the outer maintenance lock.', 'Clear the boarding line before the next vent pulse.'] },
      'deep-salvage': { objective: 'Tag three skimmer assemblies distributed across unequal-pressure maintenance decks.', steps: ['Tag the intake package.', 'Tag the separator package.', 'Tag the compressor package and clear the deck.'] },
    },
    'ice-mine': {
      'pressure-recovery': { objective: 'Seal a fractured bore pressure line before volatile-rich tunnel gas vents through the mine.', steps: ['Reach the bore pressure manifold.', 'Seal the fractured service line.', 'Hold until the tunnel pressure margin recovers.'] },
      'grid-isolation': { objective: 'Isolate both thaw-grid branches before damaged heating lines destabilize the bore walls.', steps: ['Reach both thaw-grid isolators.', 'Isolate each heating branch with ACT.', 'Clear the tunnel after the grid drops.'] },
      'gravity-stabilization': { objective: 'Calibrate the haulage and deep-bore gravity trims before the tunnel fracture cycle peaks.', steps: ['Calibrate the haulage trim.', 'Calibrate the deep-bore trim.', 'Hold the route through the fracture event.'] },
      'machinery-recovery': { objective: 'Tag the cryobore cutter and volatile separator while brittle tunnel supports remain passable.', steps: ['Reach the cutter package.', 'Reach the separator package.', 'Tag both and clear the extraction tunnel.'] },
      'emergency-boarding': { objective: 'Cycle the upper and lower bore locks before brittle supports collapse into the boarding route.', steps: ['Cycle the access-bore lock.', 'Cycle the deep-tunnel lock.', 'Clear the narrowed boarding route.'] },
      'deep-salvage': { objective: 'Tag three buried recovery cores along the access bore, extraction tunnel, and subglacial vault.', steps: ['Tag the access-bore cache.', 'Tag the extraction-tunnel cache.', 'Tag the vault cache and clear the mine.'] },
    },
    'solar-yard': {
      'pressure-recovery': { objective: 'Seal the radiator-manifold breach before the sunward fabrication spine loses its pressure margin.', steps: ['Reach the radiator pressure manifold.', 'Seal the service rupture.', 'Hold until the fabrication spine repressurizes.'] },
      'grid-isolation': { objective: 'Isolate both solar-bus branches before a thermal cycle feeds the exposed fabrication grid.', steps: ['Reach the shade-side bus isolator.', 'Reach the sunward bus isolator.', 'Isolate both branches and clear the yard.'] },
      'gravity-stabilization': { objective: 'Calibrate the shade gantry and fabrication-spine gravity trims before thermal expansion shifts the work deck.', steps: ['Calibrate the shade-gantry trim.', 'Calibrate the fabrication-spine trim.', 'Hold through the solar load window.'] },
      'machinery-recovery': { objective: 'Tag the mirror actuator and printer spindle before the thermal shutters cycle open again.', steps: ['Reach both fabrication packages.', 'Tag each package with ACT.', 'Clear the sunward recovery lane.'] },
      'emergency-boarding': { objective: 'Cycle the shade-side and sunward pressure locks while thermal shutters protect the boarding route.', steps: ['Cycle the shade-side interlock.', 'Cycle the sunward interlock.', 'Clear the fabrication spine.'] },
      'deep-salvage': { objective: 'Tag three fabrication packages across shade, spine, and sunward work zones.', steps: ['Tag the shade-gantry package.', 'Tag the fabrication-spine package.', 'Tag the sunward package and clear the yard.'] },
    },
    'parallax-array': { 'reference-alignment': { objective: 'Align all three long-baseline reference pylons before the array commits another false navigation solution.', steps: ['Reach the near-baseline reference pylon.', 'Align the cross-track and deep-baseline pylons with ACT.', 'Hold while the three references converge on one physical solution.'] } },
    'momentum-exchange': { 'momentum-capture': { objective: 'Load both counter-momentum capture drums before the transfer lane dumps its stored impulse.', steps: ['Reach the inbound capture drum and lock its reference.', 'Cross the near-zero-g transfer lane to the outbound drum.', 'Load both drums with ACT and hold through the next countermass wash.'] } },
    'cryo-reserve': { 'thermal-routing': { objective: 'Route both propellant purge valves so boiloff is rejected away from the occupied service gallery.', steps: ['Reach the first cryogenic purge valve.', 'Route the second valve before the next boiloff pulse.', 'Hold the tank gallery while the thermal route stabilizes.'] } },
  };
  return copy[location]?.[mode] ?? null;
}

export function missionObjectiveFor(mode: ObjectiveMode, location: LocationId): { mode: ObjectiveMode; objective: string; steps: string[] } {
  const authored = authoredObjective(location, mode);
  if (authored) return { mode, ...authored };
  if (mode === 'pressure-recovery') return { mode, objective: location === 'damaged-vessel' ? 'Seal the cargo-spine rupture and restore a breathable pressure margin.' : 'Seal the active pressure breach and restore a breathable margin.', steps: ['Reach the emergency pressure manifold.', 'Seal the active service rupture.', 'Hold while atmosphere recovers.'] };
  if (mode === 'grid-isolation') return { mode, objective: 'Isolate both damaged power branches before the control spine cascades.', steps: ['Reach both live grid isolators.', 'Isolate each branch with ACT.', 'Clear the remaining armed interference.'] };
  if (mode === 'gravity-stabilization') return { mode, objective: 'Calibrate both gravity trims while suppressing interference around the control spine.', steps: ['Reach the deck gravity trim.', 'Calibrate the transfer gravity trim.', 'Clear hostile interference and bank the contract.'] };
  if (mode === 'machinery-recovery') return { mode, objective: 'Tag two intact industrial assemblies while keeping the recovery lane usable.', steps: ['Reach both tagged machinery packages.', 'Use ACT to register each package.', 'Clear the recovery lane and choose extraction depth.'] };
  if (mode === 'emergency-boarding') return { mode, objective: 'Cycle both pressure interlocks and break the armed boarding line.', steps: ['Reach the first pressure interlock.', 'Cycle the second pressure interlock.', 'Clear the boarding line and secure extraction.'] };
  if (mode === 'momentum-capture') return { mode, objective: 'Load both momentum-capture references before the next transfer impulse.', steps: ['Reach both capture controls.', 'Lock each reference with ACT.', 'Hold through the scheduled momentum wash.'] };
  if (mode === 'thermal-routing') return { mode, objective: 'Route both thermal purge branches away from the occupied work zone.', steps: ['Reach both thermal-routing valves.', 'Route each valve with ACT.', 'Hold through the next purge cycle.'] };
  if (mode === 'reference-alignment') return { mode, objective: 'Align three independent navigation references and reject the false baseline.', steps: ['Align the near reference.', 'Align the cross-track reference.', 'Align the deep reference and hold for convergence.'] };
  return { mode, objective: 'Tag three recovery packages distributed across the combat deck.', steps: ['Locate three marked recovery packages.', 'Tag each package with ACT.', 'Clear the hostile line and extract.'] };
}

function tacticalIdentityForLocation(location: LocationId) {
  if (location === 'spin-habitat') return { briefing: 'The ring is actively rotating: rim gravity is high, spoke gravity is transitional, and the axis hub is nearly weightless.', forecast: 'Emergency spindown temporarily collapses gravity across the rim and spoke before the drive bus recovers.' };
  if (location === 'jovian-harvester') return { briefing: 'External skimmer decks sit across unequal pressure zones above the Jovian atmosphere.', forecast: 'A fixed storm-shear window can open a high-force maintenance vent before relief shutters recover the deck.' };
  if (location === 'ice-mine') return { briefing: 'Subsurface haul tunnels constrain movement around brittle ice supports and narrow bore junctions.', forecast: 'A scheduled tunnel fracture can remove brittle barriers and open new firing lanes mid-encounter.' };
  if (location === 'solar-yard') return { briefing: 'The sunward fabrication yard relies on thermal shutters and aggressive heat rejection.', forecast: 'A fixed solar-load window raises active-weapon heat unless the local thermal shutters are closed.' };
  if (location === 'lattice-annex') return { briefing: 'Khepri is a hidden precision-metrology annex with long reference galleries, movable calibration shutters, and low-gravity sample handling.', forecast: 'Calibration mass shifts alter gallery gravity and dormant reference shutters can re-index firing lanes.' };
  if (location === 'momentum-exchange') return { briefing: 'The cislunar exchange uses long electromagnetic transfer lanes and counter-rotating flywheels to move cargo with almost no propellant.', forecast: 'Scheduled countermass washes throw loose bodies across the near-zero-g transfer lane until both capture references are loaded.' };
  if (location === 'cryo-reserve') return { briefing: 'The Umbra reserve stores cryogenic propellant behind narrow tank galleries with deliberately low pressure and weak local gravity.', forecast: 'Boiloff purge plumes shove exposed bodies, strip capacitor charge, and cool weapon buses unless both thermal routes are redirected.' };
  if (location === 'parallax-array') return { briefing: 'The decommissioned array is a long-baseline navigation observatory built around three physically separated inertial references and movable calibration masses.', forecast: 'Reference shear periodically pushes adjacent deck sections onto conflicting gravity vectors until the pylons are aligned.' };
  return { briefing: '', forecast: '' }; 
}

export function deepTargetForLocation(location: LocationId, archetype: ContractArchetype = 'salvage') {
  if (location === 'damaged-vessel') return archetype === 'boarding' ? 'Boarding Chief Serrin' : archetype === 'stabilization' ? 'Reactor Custodian Ansel' : 'Salvage Interdictor Kade';
  if (location === 'asteroid-refinery') return 'Foundry Marshal Cael';
  if (location === 'spin-habitat') return 'Recovery Commander Sable Voss';
  if (location === 'jovian-harvester') return 'Stormline Foreman Ilex';
  if (location === 'ice-mine') return 'Salvage Captain Rhea Kade';
  if (location === 'solar-yard') return 'HELIOS-9 Yardmind';
  if (location === 'lattice-annex') return 'Khepri Recovery Marshal';
  if (location === 'momentum-exchange') return 'Exchange Interdictor Neris Vane';
  if (location === 'cryo-reserve') return 'Reserve Custodian Tamas Veer';
  if (location === 'parallax-array') return 'Baseline Keeper Sera Nox';
  return 'Dock Warden Orison';
}

export const megastructureDefinitions: MegastructureDefinition[] = [
  {
    id: 'generation-ship',
    title: 'Rare Derelict // Generation Ship Perseid',
    siteName: 'Generation Ship Perseid',
    sponsor: 'longarc',
    archetype: 'salvage',
    briefing: 'A generation ship absent from traffic records for decades is still rotating under partial automation. Quiet Signal can enter through the docking spine, but every kilometer inward commits more time, suit integrity, and salvage exposure.',
    deepTarget: 'Perseid Steward Core',
    rewardBase: { credits: 340, alloys: 6, electronics: 4, medstock: 2, components: 2 },
    reputationGain: 4,
    stages: [
      { name: 'Docking Spine', location: 'damaged-vessel', objectiveMode: 'pressure-recovery', conditions: ['limited-atmosphere', 'unstable-pressure'], optionalLabel: 'Crew archive canister' },
      { name: 'Agricultural Drum', location: 'spin-habitat', objectiveMode: 'gravity-stabilization', conditions: ['failing-gravity'], optionalLabel: 'Seed-vault control core', transitionRoute: 'INNER AIRLOCK → KEEL TRAM → AGRICULTURAL DRUM', transitionDetail: 'Pressure locks cycle while a keel tram follows the green transit datum into the rotating farm ring.', arrivalCue: 'PERSEID TRANSIT // AGRICULTURAL DRUM ROTATION SYNCED', continuityConditions: ['limited-atmosphere'], continuityDetail: 'Docking-spine pressure debt follows the keel tram inward, so the drum starts under the same reduced atmosphere ceiling.' },
      { name: 'Cryogenic Service Deck', location: 'orbital-station', objectiveMode: 'grid-isolation', conditions: ['damaged-grid', 'low-visibility'], optionalLabel: 'Cryobank registry', transitionRoute: 'SEED SERVICE LATTICE → KEEL LIFT → CRYOGENIC SERVICE DECK', transitionDetail: 'The route leaves the drum through a fixed keel lift, with cold-bus markers replacing the farm ring rotation datum.', arrivalCue: 'PERSEID TRANSIT // CRYOBANK SERVICE BUS ACQUIRED', continuityConditions: ['failing-gravity'], continuityDetail: 'The agricultural drum spindown leaves the fixed keel lift out of trim, carrying a low-gravity transfer pocket onto the cryogenic deck.' },
      { name: 'Reactor Choir', location: 'solar-yard', objectiveMode: 'machinery-recovery', conditions: ['damaged-grid', 'automated-defense'], optionalLabel: 'Reactor harmonics recorder', transitionRoute: 'CRYOBANK SERVICE BUS → REACTOR TRUNK → REACTOR CHOIR', transitionDetail: 'The cold service run opens into the ship power trunk; the same keel datum terminates beneath the harmonic reactor arches.', arrivalCue: 'PERSEID TRANSIT // REACTOR CHOIR HARMONIC DATUM LIVE', continuityConditions: ['low-visibility'], continuityDetail: 'Cryogenic condensate and cold-service vapor remain in the reactor trunk, carrying the deck visibility loss into the choir approach.' },
    ],
  },
  {
    id: 'counterweight',
    title: 'Rare Derelict // Counterweight K-91',
    siteName: 'Orbital Elevator Counterweight K-91',
    sponsor: 'meridian',
    archetype: 'stabilization',
    briefing: 'A severed orbital-elevator counterweight is tumbling through a managed debris corridor. Its interior remains pressurized in isolated pockets, but no command intelligence is responding. The value is in surviving the whole traverse, not hunting a boss.',
    rewardBase: { credits: 380, alloys: 7, electronics: 5, medstock: 2, components: 3 },
    reputationGain: 4,
    stages: [
      { name: 'Capture Collar', location: 'orbital-station', objectiveMode: 'emergency-boarding', conditions: ['low-visibility'], optionalLabel: 'Tether-load recorder' },
      { name: 'Mass Transit Spine', location: 'spin-habitat', objectiveMode: 'gravity-stabilization', conditions: ['failing-gravity', 'damaged-grid'], optionalLabel: 'Countermass calibration stack', transitionRoute: 'CAPTURE LOCK → COUNTERMASS RAIL → MASS TRANSIT SPINE', transitionDetail: 'Mag-clamps hand the operator from the capture collar onto the amber-datum countermass rail while K-91 continues to tumble.', arrivalCue: 'K-91 TRANSIT // COUNTERMASS RAIL PHASE LOCKED', continuityConditions: ['low-visibility'], continuityDetail: 'Capture-collar dust and tether ablation follow the open countermass rail, keeping the transit spine visually degraded.' },
      { name: 'Power Transfer Gallery', location: 'solar-yard', objectiveMode: 'grid-isolation', conditions: ['damaged-grid', 'automated-defense'], optionalLabel: 'Lift-grid fault archive', transitionRoute: 'TRANSIT SPINE → LIFT-BUS CRAWL → POWER TRANSFER GALLERY', transitionDetail: 'The mass rail narrows into a shielded lift-bus crawl, preserving inertial reference while the power trunk comes into view.', arrivalCue: 'K-91 TRANSIT // LIFT-BUS REFERENCE STABLE', continuityConditions: ['failing-gravity'], continuityDetail: 'The countermass rail never fully settles after the spine, leaving the lift-bus gallery with a carried inertial/gravity fault.' },
      { name: 'Ballast Vault', location: 'asteroid-refinery', objectiveMode: 'deep-salvage', conditions: ['limited-atmosphere'], optionalLabel: 'Ballast telemetry blackbox', transitionRoute: 'ISOLATION GALLERY → BALLAST SERVICE TRUNK → BALLAST VAULT', transitionDetail: 'The isolated lift bus feeds a dense ballast service trunk where restraint frames replace open rails before the final mass lock.', arrivalCue: 'K-91 TRANSIT // BALLAST RESTRAINT DATUM ACQUIRED', continuityConditions: ['damaged-grid'], continuityDetail: 'Lift-bus isolation leaves the ballast service trunk on a scorched partial grid, so arc risk survives into the final vault.' },
    ],
  },
  {
    id: 'hidden-habitat',
    title: 'Rare Derelict // Unregistered Habitat Orpheline',
    siteName: 'Unregistered Asteroid Habitat Orpheline',
    sponsor: 'heliostat',
    archetype: 'boarding',
    briefing: 'A thermal shadow reveals an inhabited-scale cavity inside an asteroid that appears in no registry. The habitat is dark, mechanically active, and filled with improvised partitions that suggest it was abandoned in stages rather than all at once.',
    deepTarget: 'Orpheline Habitat Warden',
    rewardBase: { credits: 360, alloys: 5, electronics: 7, medstock: 2, components: 3 },
    reputationGain: 4,
    stages: [
      { name: 'Ice Access Bore', location: 'ice-mine', objectiveMode: 'emergency-boarding', conditions: ['low-visibility'], optionalLabel: 'Unregistered transit ledger' },
      { name: 'Industrial Commons', location: 'asteroid-refinery', objectiveMode: 'machinery-recovery', conditions: ['damaged-grid'], optionalLabel: 'Habitat fabrication key', transitionRoute: 'HABITAT HATCH → CONCEALED SERVICE THROAT → INDUSTRIAL COMMONS', transitionDetail: 'The bore closes behind a disguised pressure hatch; violet utility trunks continue through a cramped service throat into the commons.', arrivalCue: 'ORPHELINE TRANSIT // COMMONS UTILITY TRUNK LIVE', continuityConditions: ['low-visibility'], continuityDetail: 'Ice-bore frost and rock dust remain suspended past the concealed hatch, carrying the access-bore visibility loss into the commons.' },
      { name: 'Residential Spin Ring', location: 'spin-habitat', objectiveMode: 'pressure-recovery', conditions: ['unstable-pressure', 'failing-gravity'], optionalLabel: 'Population registry shard', transitionRoute: 'COMMONS SERVICE MARKET → SHELTER SPOKE → RESIDENTIAL SPIN RING', transitionDetail: 'Improvised market partitions give way to a shelter spoke where occupancy marks repeat toward the rotating residential ring.', arrivalCue: 'ORPHELINE TRANSIT // RESIDENTIAL SPIN REFERENCE ACQUIRED', continuityConditions: ['damaged-grid'], continuityDetail: 'The improvised commons utility trunk feeds the shelter spoke directly, carrying its damaged-grid arc faults into the residential ring.' },
      { name: 'Buried Control Vault', location: 'orbital-station', objectiveMode: 'grid-isolation', conditions: ['automated-defense', 'damaged-grid'], optionalLabel: 'Founding charter archive', transitionRoute: 'RESIDENTIAL RING → FOUNDER ACCESS SHAFT → BURIED CONTROL VAULT', transitionDetail: 'A sealed founder shaft drops out of the occupied ring into older rock-cut control works carrying the same violet utility datum.', arrivalCue: 'ORPHELINE TRANSIT // FOUNDING VAULT AUTHORITY BUS DETECTED', continuityConditions: ['failing-gravity'], continuityDetail: 'The residential ring sheds momentum into the founder shaft, leaving the buried vault transfer zone in a persistent low-gravity state.' },
    ],
  },
  {
    id: 'shipbreaking-yard',
    title: 'Rare Derelict // Shipbreaking Yard Hecate',
    siteName: 'Abandoned Shipbreaking Yard Hecate',
    sponsor: 'longarc',
    archetype: 'salvage',
    briefing: 'An enormous dismantling yard has drifted beyond its registered work orbit with hundreds of partially stripped hulls still clamped to the frame. The route crosses thermal decks, crusher machinery, and open pressure wreckage before reaching yard control.',
    deepTarget: 'Hecate Yardmaster Null',
    rewardBase: { credits: 350, alloys: 9, electronics: 4, medstock: 1, components: 3 },
    reputationGain: 4,
    stages: [
      { name: 'Sunward Clamp Field', location: 'solar-yard', objectiveMode: 'machinery-recovery', conditions: ['automated-defense'], optionalLabel: 'Clamp-control spindle' },
      { name: 'Crusher Causeway', location: 'asteroid-refinery', objectiveMode: 'deep-salvage', conditions: ['damaged-grid'], optionalLabel: 'High-grade cutter head', transitionRoute: 'HULL CRADLE → SALVAGE TRUSS → CRUSHER CAUSEWAY', transitionDetail: 'The sunward cradle releases onto Hecate’s black salvage truss, with red clamp marks guiding the route toward the crusher line.', arrivalCue: 'HECATE TRANSIT // CRUSHER TRUSS ROUTE LOCKED', continuityConditions: ['failing-gravity'], continuityDetail: 'Releasing the sunward hull cradle kicks the salvage truss out of trim, carrying a low-gravity fault onto the crusher causeway.' },
      { name: 'Wreck Transit', location: 'damaged-vessel', objectiveMode: 'pressure-recovery', conditions: ['limited-atmosphere', 'unstable-pressure'], optionalLabel: 'Recovered vessel registry', transitionRoute: 'CUTTER LINE → OPEN PRESSURE BRIDGE → WRECK TRANSIT', transitionDetail: 'Crusher shielding ends at an exposed pressure bridge; yellow cutter datum lights continue across stripped hulls into the wreck chain.', arrivalCue: 'HECATE TRANSIT // WRECK PRESSURE BRIDGE OPEN', continuityConditions: ['damaged-grid'], continuityDetail: 'Crusher-line bus damage follows the yellow cutter datum across the pressure bridge, bringing live arc faults into the wreck chain.' },
      { name: 'Yard Control Crown', location: 'jovian-harvester', objectiveMode: 'grid-isolation', conditions: ['failing-gravity', 'damaged-grid'], optionalLabel: 'Master salvage ledger', transitionRoute: 'WRECK REGISTRY CHAIN → MASTER TRUSS → YARD CONTROL CROWN', transitionDetail: 'The wreck chain reconnects to Hecate’s master salvage truss, carrying clamp scars and cutter datum directly beneath yard control.', arrivalCue: 'HECATE TRANSIT // YARD CONTROL CROWN DATUM LIVE', continuityConditions: ['limited-atmosphere'], continuityDetail: 'The open wreck bridge never fully re-pressurizes before the master truss, so the control crown inherits the wreck chain atmosphere ceiling.' },
    ],
  },
];

export function buildMegastructureDebrief(contract: Contract, progress: ExpeditionProgress, depth: 'safe' | 'deep'): MegastructureDebrief | null {
  if (!contract.megastructure) return null;
  const definition = megastructureDefinitions.find(item => item.id === contract.megastructure);
  if (!definition) return null;
  const totalZones = definition.stages.length;
  const zonesCompleted = Math.max(1, Math.min(totalZones, progress.zonesCompleted));
  const optionalRecovered = Math.max(0, Math.min(zonesCompleted, progress.optionalRecovered));
  const fullTraverse = zonesCompleted === totalZones;
  const bossDefeated = fullTraverse && depth === 'deep' && !!definition.deepTarget;
  const completion: MegastructureDebrief['completion'] = bossDefeated ? 'deep' : fullTraverse ? 'full' : 'partial';

  let outcomeLabel = `EXPEDITION BANKED AFTER SPACE ${zonesCompleted}`;
  let outcomeDetail = `${zonesCompleted}/${totalZones} connected spaces secured before extraction. The remaining internal route was left unresolved.`;
  let finaleLabel = 'FINAL SPACE NOT REACHED';
  let finaleDetail = definition.deepTarget
    ? `${definition.deepTarget} remains beyond the banked route.`
    : 'The final recovery space remains beyond the banked route.';

  if (fullTraverse && definition.deepTarget && bossDefeated) {
    outcomeLabel = 'COMMAND TARGET DEFEATED';
    outcomeDetail = `All ${totalZones} connected spaces were secured and the sealed command zone was breached.`;
    finaleLabel = definition.deepTarget.toUpperCase();
    finaleDetail = 'Command target neutralized; the full expedition and deep-zone recovery were banked.';
  } else if (fullTraverse && definition.deepTarget) {
    outcomeLabel = 'FULL TRAVERSE BANKED';
    outcomeDetail = `All ${totalZones} connected spaces were secured without taking the optional command-zone fight.`;
    finaleLabel = 'COMMAND ZONE LEFT SEALED';
    finaleDetail = `${definition.deepTarget} was not engaged; the four-space traverse remains fully banked.`;
  } else if (fullTraverse) {
    outcomeLabel = 'BOSSLESS TRAVERSE COMPLETE';
    outcomeDetail = `All ${totalZones} connected spaces were secured. This site resolves through survival and recovery rather than a command target.`;
    finaleLabel = 'FINAL RECOVERY SPACE SECURED';
    finaleDetail = 'No command target was present; the capstone ended on the authored recovery-vault finale.';
  }

  const stages = definition.stages.map((stage, index): MegastructureDebriefStage => ({
    name: stage.name,
    optionalLabel: stage.optionalLabel,
    secured: index < zonesCompleted,
    continuityLabels: (stage.continuityConditions ?? []).map(condition => conditionLabel[condition]),
    continuityDetail: stage.continuityDetail ?? null,
  }));
  const continuityNotes = stages
    .slice(0, zonesCompleted)
    .filter(stage => !!stage.continuityDetail)
    .map(stage => ({ stageName: stage.name, labels: stage.continuityLabels, detail: stage.continuityDetail! }));

  return {
    siteName: definition.siteName,
    zonesCompleted,
    totalZones,
    optionalRecovered,
    completion,
    outcomeLabel,
    outcomeDetail,
    finaleLabel,
    finaleDetail,
    stages,
    continuityNotes,
  };
}

function megastructureForCampaign(campaign: CampaignState) {
  if (campaign.contractsCompleted < 3 || campaign.cycle % 5 !== 3) return null;
  return megastructureDefinitions[Math.floor(campaign.cycle / 5) % megastructureDefinitions.length];
}

function buildMegastructureContract(campaign: CampaignState, definition: MegastructureDefinition): Contract {
  const first = definition.stages[0];
  const missionObjective = missionObjectiveFor(first.objectiveMode, first.location);
  return {
    id: `mega-${campaign.cycle}-${definition.id}`,
    sponsor: definition.sponsor,
    archetype: definition.archetype,
    location: first.location,
    locationName: definition.siteName,
    title: definition.title,
    objective: missionObjective.objective,
    objectiveMode: missionObjective.mode,
    objectiveSteps: missionObjective.steps,
    briefing: definition.briefing,
    conditions: first.conditions,
    conditionLabels: first.conditions.map(condition => conditionLabel[condition]),
    directorPreview: 'RARE EXPEDITION // four connected combat spaces. Suit damage and telemetry carry forward. Each secured space opens an extraction decision; optional hardware increases the final recovery.',
    deepTarget: definition.deepTarget ?? 'No confirmed command target',
    rewardBase: definition.rewardBase,
    reputationGain: definition.reputationGain,
    priority: false,
    anomalyOpportunity: false,
    seed: 700001 + campaign.cycle * 131071,
    megastructure: definition.id,
    megastructureStageCount: definition.stages.length,
    megastructureZoneNames: definition.stages.map(stage => stage.name),
    megastructureBossTarget: definition.deepTarget,
  };
}

export function getMegastructureStageContract(contract: Contract, requestedStage: number): Contract {
  if (!contract.megastructure) return contract;
  const definition = megastructureDefinitions.find(item => item.id === contract.megastructure);
  if (!definition) return contract;
  const stageIndex = Math.max(0, Math.min(definition.stages.length - 1, requestedStage));
  const stage = definition.stages[stageIndex];
  const missionObjective = missionObjectiveFor(stage.objectiveMode, stage.location);
  const continuityConditions = stage.continuityConditions ?? [];
  const conditions = [...new Set<ConditionId>([...stage.conditions, ...continuityConditions])];
  return {
    ...contract,
    id: `${contract.id}-space-${stageIndex + 1}`,
    location: stage.location,
    locationName: `${definition.siteName} // ${stage.name}`,
    objective: missionObjective.objective,
    objectiveMode: missionObjective.mode,
    objectiveSteps: missionObjective.steps,
    conditions,
    conditionLabels: conditions.map(condition => conditionLabel[condition]),
    directorPreview: `MEGASTRUCTURE SPACE ${stageIndex + 1}/${definition.stages.length} // ${tacticalIdentityForLocation(stage.location).forecast || 'Director timing remains fixed and disclosed.'}${stage.continuityDetail ? ` ENVIRONMENTAL CONTINUITY // ${stage.continuityDetail}` : ''} Internal extraction becomes available after this space is secured.`,
    seed: contract.seed + stageIndex * 65537,
    megastructureStage: stageIndex + 1,
    megastructureOptionalLabel: stage.optionalLabel,
    megastructureBossTarget: definition.deepTarget,
    megastructureTransitionRoute: stage.transitionRoute,
    megastructureTransitionDetail: stage.transitionDetail,
    megastructureArrivalCue: stage.arrivalCue,
    megastructureContinuityConditions: [...continuityConditions],
    megastructureContinuityDetail: stage.continuityDetail,
  };
}

export function dailyOperationContract(operation: DailyOperationSpec): Contract {
  const location = locations.find(item => item.id === operation.location) ?? locations[0];
  const missionObjective = missionObjectiveFor(operation.objectiveMode ?? defaultObjectiveMode(operation.archetype, operation.location), operation.location);
  const rewardBase: Partial<SalvageWallet> = operation.archetype === 'salvage'
    ? { credits: 235, alloys: 5, electronics: 2, components: 1 }
    : operation.archetype === 'boarding'
      ? { credits: 270, alloys: 4, electronics: 3, medstock: 1 }
      : { credits: 250, electronics: 5, medstock: 2, components: 1 };
  const deepTarget = deepTargetForLocation(operation.location, operation.archetype);
  const identity = tacticalIdentityForLocation(operation.location);
  return {
    id: `daily-${operation.date}`,
    sponsor: operation.sponsor,
    archetype: operation.archetype,
    location: operation.location,
    locationName: location.name,
    title: `Daily Operation // ${operation.codename}`,
    objective: missionObjective.objective,
    objectiveMode: missionObjective.mode,
    objectiveSteps: missionObjective.steps,
    briefing: `${operation.challenge} The Operations Board publishes one shared configuration per UTC day without changing hidden enemy scaling. ${identity.briefing}`.trim(),
    conditions: operation.conditions,
    conditionLabels: operation.conditions.map(condition => conditionLabel[condition]),
    directorPreview: `Shared daily location, objective family and environmental conditions. Director timing remains fixed and disclosed. ${identity.forecast}`.trim(),
    deepTarget,
    rewardBase,
    reputationGain: 2,
    contestedFaction: operation.archetype === 'boarding' ? 'longarc' : undefined,
    priority: false,
    anomalyOpportunity: false,
    daily: true,
    operationDate: operation.date,
    seed: operation.seed,
  };
}

export const escalationStages: Array<{ title: string; complication: string; conditions: ConditionId[]; description: string }> = [
  { title: 'Thin Air', complication: 'DAMAGED ATMOSPHERE', conditions: ['limited-atmosphere'], description: 'Pressure reserves begin below nominal and remain damaged for every later stage.' },
  { title: 'Falling Vector', complication: 'UNSTABLE GRAVITY', conditions: ['limited-atmosphere', 'failing-gravity'], description: 'The atmosphere deficit persists while transfer gravity becomes unstable and can collapse on Director timing.' },
  { title: 'Blackout Cascade', complication: 'UNRELIABLE POWER', conditions: ['limited-atmosphere', 'failing-gravity', 'damaged-grid'], description: 'Atmosphere and gravity damage persist while the electrical grid begins throwing visible arc fields into the combat space.' },
];

export function startEscalation(campaign: CampaignState, operation: DailyOperationSpec): CampaignState {
  if (campaign.escalation.status === 'active') return campaign;
  if (campaign.escalation.status === 'complete' && campaign.escalation.operationDate === operation.date) return campaign;
  const lastBeat = `Escalation ${operation.codename} armed // Stage 1 begins with damaged atmosphere.`;
  return { ...campaign, escalation: { status: 'active', operationDate: operation.date, seed: operation.seed, codename: operation.codename, sponsor: operation.sponsor, stage: 0, completed: [], lastBeat }, lastOutcome: lastBeat };
}

export function generateEscalationContract(campaign: CampaignState): Contract | null {
  const progress = campaign.escalation;
  if (progress.status !== 'active' || !progress.operationDate || progress.stage < 0 || progress.stage >= escalationStages.length) return null;
  const stage = escalationStages[progress.stage];
  const roman = ['I', 'II', 'III'][progress.stage];
  const location = locations[((progress.seed >>> 0) + progress.stage * 2 + 1) % locations.length];
  const archetype = ['salvage', 'boarding', 'stabilization'][progress.stage] as ContractArchetype;
  const objectiveMode = ['machinery-recovery', 'emergency-boarding', 'deep-salvage'][progress.stage] as ObjectiveMode;
  const missionObjective = missionObjectiveFor(objectiveMode, location.id);
  const identity = tacticalIdentityForLocation(location.id);
  const finale = progress.stage === 2;
  const rewardBase: Partial<SalvageWallet> = progress.stage === 0
    ? { credits: 280, alloys: 4, electronics: 3, components: 1 }
    : progress.stage === 1
      ? { credits: 360, alloys: 5, electronics: 4, medstock: 2, components: 2 }
      : { credits: 500, alloys: 7, electronics: 7, medstock: 3, components: 4 };
  const deepTarget = finale ? 'Cascade Custodian ORO-7' : deepTargetForLocation(location.id, archetype);
  const inherited = stage.conditions.map(condition => conditionLabel[condition]).join(' + ');
  return {
    id: `escalation-${progress.operationDate}-${progress.stage + 1}`,
    sponsor: progress.sponsor,
    archetype,
    location: location.id,
    locationName: location.name,
    title: `Escalation ${roman} // ${stage.title}`,
    objective: missionObjective.objective,
    objectiveMode: missionObjective.mode,
    objectiveSteps: missionObjective.steps,
    briefing: `Optional Operations sequence ${progress.codename}. ${stage.description} ${identity.briefing}`.trim(),
    conditions: [...stage.conditions],
    conditionLabels: stage.conditions.map(condition => conditionLabel[condition]),
    directorPreview: `Escalation ${progress.stage + 1}/3 // cumulative physical faults: ${inherited}. ${finale ? 'ORO-7 coordinates pressure venting, gravity overrides, and grid attacks in the deep zone.' : identity.forecast}`.trim(),
    deepTarget,
    rewardBase,
    reputationGain: progress.stage === 0 ? 2 : progress.stage === 1 ? 3 : 5,
    priority: false,
    anomalyOpportunity: false,
    seed: progress.seed + (progress.stage + 1) * 65537,
    escalationStage: progress.stage + 1,
    escalationFinale: finale,
    escalationDate: progress.operationDate,
  };
}

export function advanceEscalationAfterContract(campaign: CampaignState, completed: Contract, depth: 'safe' | 'deep'): { campaign: CampaignState; note: string | null } {
  if (!completed.escalationStage) return { campaign, note: null };
  const progress = campaign.escalation;
  if (progress.status !== 'active' || progress.operationDate !== completed.escalationDate || completed.escalationStage !== progress.stage + 1) return { campaign, note: null };
  if (completed.escalationFinale && depth !== 'deep') {
    const note = `${completed.deepTarget} remains active. Safe withdrawal banked ordinary rewards, but Escalation III must be cleared in the deep zone.`;
    return { campaign: { ...campaign, escalation: { ...progress, lastBeat: note }, lastOutcome: note }, note };
  }
  const completedIds = [...progress.completed, completed.id];
  const nextStage = progress.stage + 1;
  const complete = nextStage >= escalationStages.length;
  const note = complete
    ? `Escalation ${progress.codename} cleared // Cascade Custodian ORO-7 offline // enhanced recovery banked.`
    : nextStage === 1
      ? 'Escalation I banked // damaged atmosphere carries forward; unstable gravity added to Escalation II.'
      : 'Escalation II banked // atmosphere and gravity damage carry forward; unreliable power added to Escalation III.';
  return {
    campaign: { ...campaign, escalation: { ...progress, status: complete ? 'complete' : 'active', stage: Math.min(escalationStages.length, nextStage), completed: completedIds, lastBeat: note }, lastOutcome: note },
    note,
  };
}

function objectiveModeForContract(campaign: CampaignState, index: number, archetype: ContractArchetype, location: LocationId) {
  if (!tacticalLocations.has(location)) return defaultObjectiveMode(archetype, location);
  return objectiveModes[(campaign.cycle * archetypes.length + index) % objectiveModes.length];
}

function generateStandardContracts(campaign: CampaignState): Contract[] { return archetypes.map((entry, index) => { const location = locations[(campaign.cycle + index) % locations.length]; const missionObjective = missionObjectiveFor(objectiveModeForContract(campaign, index, entry.id, location.id), location.id); const priority = campaign.reputation[entry.sponsor] >= 8; const anomalyOpportunity = entry.id === 'salvage' && !campaign.anomalyRecovered && campaign.contractsCompleted >= 2 && campaign.cycle % 4 === 2; let title = ''; let objective = ''; let briefing = ''; let conditions: ConditionId[] = []; let directorPreview = ''; let deepTarget = ''; let rewardBase: Partial<SalvageWallet> = {}; let contestedFaction: FactionId | undefined; if (entry.id === 'salvage') { title = priority ? 'Priority Recovery // Silent Hold' : 'Silent Hold Recovery'; objective = 'Secure the recovery deck and tag usable machinery for extraction.'; briefing = anomalyOpportunity ? 'A Long Arc survey team found valuable machinery around a non-reflective lattice seam that does not match any registered construction method. Recover ordinary salvage first. Do not cut the lattice.' : 'A stranded worksite still holds intact drives and pressure hardware. Clear the recovery lanes before the structure fails further.'; conditions = campaign.cycle % 2 === 0 ? ['limited-atmosphere', 'unstable-pressure'] : ['low-visibility', 'failing-gravity']; directorPreview = 'One reserve fireteam enters after the second hostile falls. Structural pressure failure is telegraphed before activation.'; deepTarget = deepTargetForLocation(location.id, entry.id); rewardBase = { credits: 235, alloys: 5, electronics: 2, components: 1 }; } else if (entry.id === 'boarding') { title = priority ? 'Priority Boarding // Bonded Hold' : 'Bonded Hold Boarding'; objective = 'Break the armed boarding line and regain control of the pressure-gated cargo route.'; briefing = 'Meridian insurers claim the cargo is legally bonded; the current holders claim the seizure order is coercive. Your contract is narrower: restore access and prevent habitat systems from becoming weapons.'; conditions = campaign.cycle % 2 === 0 ? ['damaged-grid', 'automated-defense'] : ['failing-gravity', 'damaged-grid']; directorPreview = 'Two assault reserves enter after the line begins to collapse. Automated hazards activate on fixed, visible timing rather than performance scaling.'; deepTarget = deepTargetForLocation(location.id, entry.id); rewardBase = { credits: 270, alloys: 4, electronics: 3, medstock: 1 }; contestedFaction = 'longarc'; } else { title = priority ? 'Priority Stabilization // Reactor Spine' : 'Reactor Spine Stabilization'; objective = 'Reach the control spine, suppress armed interference, and keep damaged power systems from cascading.'; briefing = 'Heliostat technicians can stabilize the plant only after hostile controllers and damaged electrical sections are isolated. The machinery is part of the battlefield, not a separate puzzle.'; conditions = campaign.cycle % 2 === 0 ? ['failing-gravity', 'damaged-grid'] : ['limited-atmosphere', 'automated-defense']; directorPreview = 'A technical reserve deploys after initial contact. Electrical denial fields activate at announced locations and fixed mission times.'; deepTarget = deepTargetForLocation(location.id, entry.id); rewardBase = { credits: 250, electronics: 5, medstock: 2, components: 1 }; } objective = missionObjective.objective; const identity = tacticalIdentityForLocation(location.id); briefing = `${briefing} ${identity.briefing}`.trim(); directorPreview = `${directorPreview} ${identity.forecast}`.trim(); return { id: `cycle-${campaign.cycle}-${entry.id}`, sponsor: entry.sponsor, archetype: entry.id, location: location.id, locationName: location.name, title, objective, objectiveMode: missionObjective.mode, objectiveSteps: missionObjective.steps, briefing, conditions, conditionLabels: conditions.map(condition => conditionLabel[condition]), directorPreview, deepTarget, rewardBase, reputationGain: priority ? 3 : 2, contestedFaction, priority, anomalyOpportunity, seed: 1009 + campaign.cycle * 7919 + index * 104729 }; }); }

export function generateContracts(campaign: CampaignState): Contract[] {
  const standard = generateStandardContracts(campaign);
  const definition = megastructureForCampaign(campaign);
  if (!definition) return standard;
  const rareContract = buildMegastructureContract(campaign, definition);
  const replacementIndex = campaign.cycle % standard.length;
  return standard.map((contract, index) => index === replacementIndex ? rareContract : contract);
}

function walletAdd(target: SalvageWallet, source: Partial<SalvageWallet>, multiplier: number) { for (const key of Object.keys(target) as ResourceId[]) { if (key === 'rareTech') continue; target[key] += Math.max(0, Math.round((source[key] ?? 0) * multiplier)); } }
export function settleContract(campaign: CampaignState, contract: Contract, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress): CampaignReward {
  const gained = zeroWallet();
  const zonesCompleted = contract.megastructure ? Math.max(1, Math.min(contract.megastructureStageCount ?? 4, expeditionProgress?.zonesCompleted ?? 1)) : 1;
  const optionalRecovered = contract.megastructure ? Math.max(0, expeditionProgress?.optionalRecovered ?? 0) : 0;
  const expeditionStageMultiplier = contract.megastructure ? ([0, 0.75, 1.15, 1.6, 2.05][zonesCompleted] ?? 2.05) : 1;
  const optionalMultiplier = contract.megastructure ? 1 + Math.min(4, optionalRecovered) * 0.08 : 1;
  const depthMultiplier = contract.megastructure ? (depth === 'deep' ? 1.35 : 1) : depth === 'deep' ? 1.65 : 1;
  const tagMultiplier = 1 + Math.min(10, Math.max(0, salvageTags)) * 0.025;
  const cargoMultiplier = 1 + campaign.shipUpgrades.cargo * 0.12;
  const priorityMultiplier = contract.priority ? 1.18 : 1;
  const firstDailyCompletion = !!contract.daily && campaign.dailyCompletedDate !== contract.operationDate;
  const dailyMultiplier = firstDailyCompletion ? 1.15 : 1;
  walletAdd(gained, contract.rewardBase, depthMultiplier * tagMultiplier * cargoMultiplier * priorityMultiplier * dailyMultiplier * expeditionStageMultiplier * optionalMultiplier * (contract.operationRewardMultiplier ?? 1));
  const anomalyRecovered = depth === 'deep' && contract.anomalyOpportunity && !campaign.anomalyRecovered; if (anomalyRecovered) gained.rareTech = 1; const expeditionReputation = contract.megastructure ? Math.max(0, zonesCompleted - 1) : 0;
  const requestedReputationDelta: Partial<Record<FactionId, number>> = { [contract.sponsor]: contract.reputationGain + expeditionReputation + (depth === 'deep' ? 2 : 0) }; if (contract.contestedFaction && depth === 'deep') requestedReputationDelta[contract.contestedFaction] = -1; const reputation = { ...campaign.reputation }; const reputationDelta: Partial<Record<FactionId, number>> = {}; for (const [key, delta] of Object.entries(requestedReputationDelta) as Array<[FactionId, number]>) { const before = reputation[key]; const after = Math.max(-10, Math.min(20, before + delta)); reputation[key] = after; reputationDelta[key] = after - before; } const resources = { ...campaign.resources }; for (const key of Object.keys(resources) as ResourceId[]) resources[key] += gained[key]; const expeditionSummary = contract.megastructure ? ` // ${zonesCompleted}/${contract.megastructureStageCount ?? 4} spaces // ${optionalRecovered} optional recoveries` : '';
  return { campaign: { ...campaign, cycle: campaign.cycle + 1, contractsCompleted: campaign.contractsCompleted + 1, resources, reputation, anomalyRecovered: campaign.anomalyRecovered || anomalyRecovered, dailyCompletedDate: firstDailyCompletion ? contract.operationDate ?? campaign.dailyCompletedDate : campaign.dailyCompletedDate, lastOutcome: `${contract.title} // ${depth === 'deep' ? 'deep extraction' : 'safe extraction'} // ${salvageTags} salvage tags banked${expeditionSummary}` }, gained, reputationDelta, anomalyRecovered, depth };
}

function discountForUpgrade(campaign: CampaignState, id: ShipUpgradeId) { let faction: FactionId | null = null; if (id === 'armor' || id === 'medical') faction = 'meridian'; else if (id === 'reactor' || id === 'fabrication' || id === 'drones') faction = 'heliostat'; else if (id === 'drive' || id === 'cargo' || id === 'sensors') faction = 'longarc'; if (!faction) return 1; const rep = campaign.reputation[faction]; return rep >= 12 ? 0.85 : rep >= 6 ? 0.92 : 1; }
export function getUpgradeCost(campaign: CampaignState, id: ShipUpgradeId): Partial<SalvageWallet> | null { const definition = upgradeDefinitions.find(item => item.id === id); if (!definition) return null; const level = campaign.shipUpgrades[id]; if (level >= 2) return null; const base = definition.costs[level]; return { ...base, credits: Math.round((base.credits ?? 0) * discountForUpgrade(campaign, id)) }; }
export function buyShipUpgrade(campaign: CampaignState, id: ShipUpgradeId): { campaign: CampaignState; message: string } { const definition = upgradeDefinitions.find(item => item.id === id); const cost = getUpgradeCost(campaign, id); if (!definition || !cost) return { campaign, message: 'This ship system is already at the current prototype limit.' }; for (const [key, value] of Object.entries(cost) as Array<[ResourceId, number]>) if (campaign.resources[key] < value) return { campaign, message: `Insufficient ${resourceLabels[key].toLowerCase()} for ${definition.name}.` }; const resources = { ...campaign.resources }; for (const [key, value] of Object.entries(cost) as Array<[ResourceId, number]>) resources[key] -= value; const nextLevel = campaign.shipUpgrades[id] + 1; return { campaign: { ...campaign, resources, shipUpgrades: { ...campaign.shipUpgrades, [id]: nextLevel }, lastOutcome: `${definition.name} upgraded to tier ${nextLevel}.` }, message: `${definition.name} upgraded to tier ${nextLevel}: ${definition.benefits[nextLevel - 1]}` }; }
export function applyShipBonuses(build: CombatBuild, campaign: CampaignState): CombatBuild { const next: CombatBuild = { operatorClass: build.operatorClass, classResonanceTier: build.classResonanceTier, weapon: { carbine: { ...build.weapon.carbine }, breacher: { ...build.weapon.breacher }, rail: { ...build.weapon.rail } }, player: { ...build.player }, mechanics: { ...build.mechanics }, singularTraits: [...build.singularTraits], specialization: build.specialization, specializationOverclock: build.specializationOverclock, abilities: build.abilities.map(ability => ({ ...ability })) as CombatBuild['abilities'] }; const upgrades = campaign.shipUpgrades; next.player.maxCapAdd += upgrades.reactor * 12; next.player.capRegenMul *= 1 + upgrades.reactor * 0.1; next.player.moveSpeedMul *= 1 + upgrades.drive * 0.04; next.player.lowGControl += upgrades.drive * 0.12; next.player.maxArmorAdd += upgrades.armor * 10; for (const weapon of Object.values(next.weapon)) weapon.speedMul *= 1 + upgrades.sensors * 0.04; next.abilities[1].powerMul *= 1 + upgrades.sensors * 0.08; next.player.maxHpAdd += upgrades.medical * 8; if (upgrades.drones >= 1) { next.mechanics.arcDrone = true; next.mechanics.arcDroneScale = Math.max(next.mechanics.arcDroneScale, 1); } if (upgrades.drones >= 2) next.abilities[2].cooldownMul *= 0.9; return next; }
