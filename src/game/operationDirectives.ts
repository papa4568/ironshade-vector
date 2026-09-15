import {
  conditionLabel,
  deepTargetForLocation,
  locationNameFor,
  missionObjectiveFor,
  type CampaignState,
  type ConditionId,
  type Contract,
  type ContractArchetype,
  type DirectiveModifierId,
  type DirectiveTargetClass,
  type FactionId,
  type LocationId,
  type ObjectiveMode,
  type OperationDirective,
} from './campaign';
import type { Telemetry } from './sim';
import { frameGenerationForRecovery } from './scaling';

export type DirectiveModifierDefinition = {
  id: DirectiveModifierId;
  name: string;
  family: string;
  description: string;
  conditions: ConditionId[];
  eventBias: string[];
  protocolBias: string[];
  materialBonus: number;
  qualityBonus: number;
  singularBonus: number;
  recoveryLevelBonus: number;
  threatBonus: number;
  protocolBonus: number;
  protocolDensity: number;
  eventBonus: number;
  reserveBonus: number;
  risk: number;
};

export const directiveModifierDefinitions: DirectiveModifierDefinition[] = [
  { id: 'compromised-shell', name: 'Compromised Pressure Shell', family: 'pressure', description: 'Atmosphere starts damaged and structural failures are more likely to involve decompression.', conditions: ['limited-atmosphere', 'unstable-pressure'], eventBias: ['debris-impact', 'life-support-purge', 'compressor-backflow'], protocolBias: ['pressureHunter', 'vacuumAdapted', 'breachmaker'], materialBonus: 0.1, qualityBonus: 0.2, singularBonus: 0.02, recoveryLevelBonus: 1, threatBonus: 2, protocolBonus: 0, protocolDensity: 0, eventBonus: 0, reserveBonus: 0, risk: 2 },
  { id: 'unstable-mass', name: 'Unstable Mass Control', family: 'mass', description: 'Gravity trims are unreliable and mass-control events receive priority in the Director plan.', conditions: ['failing-gravity'], eventBias: ['reactor-load-shed', 'magnetic-load-swing', 'spin-overspeed'], protocolBias: ['magneticLock', 'gravityAnchor', 'countermassMobility'], materialBonus: 0.09, qualityBonus: 0.2, singularBonus: 0.01, recoveryLevelBonus: 1, threatBonus: 2, protocolBonus: 0, protocolDensity: 1, eventBonus: 0, reserveBonus: 0, risk: 2 },
  { id: 'overloaded-bus', name: 'Overloaded Power Bus', family: 'power', description: 'Damaged electrical distribution can reactivate grids, flash live conduits, and support Arc-linked elites.', conditions: ['damaged-grid'], eventBias: ['conduit-flashover', 'dormant-defenses', 'radiator-saturation'], protocolBias: ['arcConduit', 'signalJammer', 'thermalOverrun'], materialBonus: 0.08, qualityBonus: 0.24, singularBonus: 0.025, recoveryLevelBonus: 0, threatBonus: 3, protocolBonus: 0, protocolDensity: 1, eventBonus: 0, reserveBonus: 0, risk: 2 },
  { id: 'third-party-boarders', name: 'Hostile Third-Party Boarding', family: 'reinforcement', description: 'A second armed team can enter through pressure locks or reserve routes while the primary contract is active.', conditions: [], eventBias: ['rival-boarders', 'pressure-lock-entry'], protocolBias: ['suppressionCoordinator', 'penetratorVolley'], materialBonus: 0.11, qualityBonus: 0.18, singularBonus: 0.01, recoveryLevelBonus: 0, threatBonus: 4, protocolBonus: 0, protocolDensity: 0, eventBonus: 0, reserveBonus: 1, risk: 2 },
  { id: 'scarce-safe-rooms', name: 'Scarce Safe Rooms', family: 'sustain', description: 'Low visibility and limited atmosphere reduce comfortable reset space while shutters can divide the deck.', conditions: ['limited-atmosphere', 'low-visibility'], eventBias: ['emergency-shutters', 'life-support-purge'], protocolBias: ['sensorGhost', 'emergencyShutters'], materialBonus: 0.12, qualityBonus: 0.22, singularBonus: 0.015, recoveryLevelBonus: 0, threatBonus: 2, protocolBonus: 0, protocolDensity: 0, eventBonus: 1, reserveBonus: 0, risk: 2 },
  { id: 'elite-reinforcements', name: 'Elite Reinforcement Authority', family: 'elite', description: 'The hostile reserve includes a higher-class specialist package instead of simply adding more bodies.', conditions: [], eventBias: ['pressure-lock-entry', 'rival-boarders'], protocolBias: ['reactivePlating', 'suppressionCoordinator', 'penetratorVolley'], materialBonus: 0.12, qualityBonus: 0.28, singularBonus: 0.025, recoveryLevelBonus: 1, threatBonus: 5, protocolBonus: 1, protocolDensity: 1, eventBonus: 0, reserveBonus: 1, risk: 3 },
  { id: 'repair-network', name: 'Aggressive Repair Network', family: 'repair', description: 'Field repair logic restores machinery, armor, or support hardware unless disrupted quickly.', conditions: ['automated-defense'], eventBias: ['dormant-defenses', 'conduit-flashover'], protocolBias: ['repairMesh', 'droneEscort', 'arcConduit'], materialBonus: 0.08, qualityBonus: 0.24, singularBonus: 0.015, recoveryLevelBonus: 0, threatBonus: 4, protocolBonus: 0, protocolDensity: 1, eventBonus: 0, reserveBonus: 0, risk: 2 },
  { id: 'event-cascade', name: 'Director Event Cascade', family: 'events', description: 'The mission schedules another compatible physical Director event instead of applying an invisible stat penalty.', conditions: [], eventBias: ['cargo-restraint-failure', 'coolant-rupture', 'crane-runaway', 'magnetic-load-swing'], protocolBias: [], materialBonus: 0.11, qualityBonus: 0.2, singularBonus: 0.01, recoveryLevelBonus: 0, threatBonus: 2, protocolBonus: 0, protocolDensity: 0, eventBonus: 1, reserveBonus: 0, risk: 2 },
  { id: 'protocol-density', name: 'Dense Elite Protocol Ecology', family: 'protocols', description: 'Threat budget shifts from basic bodies into Enhanced and Elite protocol packages.', conditions: [], eventBias: [], protocolBias: ['gravityAnchor', 'arcConduit', 'reactivePlating', 'sensorGhost', 'thermalOverrun'], materialBonus: 0.1, qualityBonus: 0.3, singularBonus: 0.04, recoveryLevelBonus: 1, threatBonus: 5, protocolBonus: 1, protocolDensity: 2, eventBonus: 0, reserveBonus: 0, risk: 3 },
];

const byModifier = new Map(directiveModifierDefinitions.map(definition => [definition.id, definition]));
const normalLocations: LocationId[] = ['orbital-station', 'damaged-vessel', 'asteroid-refinery', 'spin-habitat', 'jovian-harvester', 'ice-mine', 'solar-yard'];
const objectiveModes: ObjectiveMode[] = ['pressure-recovery', 'grid-isolation', 'gravity-stabilization', 'machinery-recovery', 'emergency-boarding', 'deep-salvage'];
const archetypes: ContractArchetype[] = ['salvage', 'boarding', 'stabilization'];
const adjective = ['Silent', 'Broken', 'Cold', 'Vector', 'Black', 'Long', 'Falling', 'Redline', 'Hollow', 'Sunward'];
const noun = ['Transit', 'Anchor', 'Spindle', 'Wake', 'Relay', 'Shear', 'Crown', 'Ledger', 'Baffle', 'Index'];
const DIRECTIVE_CAP = 8;

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
function hash(seed: number, salt: number) { let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0; value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return value >>> 0; }
function sponsorForArchetype(archetype: ContractArchetype): FactionId { return archetype === 'salvage' ? 'longarc' : archetype === 'boarding' ? 'meridian' : 'heliostat'; }
function complicationCount(tier: number) { return tier <= 2 ? 0 : tier <= 4 ? 1 : tier <= 6 ? 2 : tier <= 8 ? 3 : tier <= 10 ? 4 : tier === 11 ? 5 : 6; }

function chooseModifiers(tier: number, seed: number) {
  const count = complicationCount(tier);
  return [...directiveModifierDefinitions]
    .sort((a, b) => hash(seed, a.id.length * 31) - hash(seed, b.id.length * 31))
    .slice(0, count)
    .map(definition => definition.id);
}

function specialTargets(campaign: CampaignState) {
  const result: Array<{ location: LocationId; sponsor: FactionId; archetype: ContractArchetype; target: string }> = [];
  if (campaign.story.arcs['vanishing-wake'].status === 'complete') result.push({ location: 'jovian-harvester', sponsor: 'longarc', archetype: 'boarding', target: 'Pressure Broker Naima Rusk' });
  if (campaign.story.arcs['terms-of-survival'].status === 'complete') result.push({ location: 'spin-habitat', sponsor: 'meridian', archetype: 'boarding', target: 'Bond Arbiter Edrin Shaw' });
  if (campaign.story.arcs['cold-sun-protocol'].status === 'complete') result.push({ location: 'solar-yard', sponsor: 'heliostat', archetype: 'stabilization', target: 'PRISM-6 Forge Chorus' });
  if (campaign.story.blackLattice.status === 'complete') result.push({ location: 'lattice-annex', sponsor: 'longarc', archetype: 'boarding', target: 'Survey Custodian Veyra Senn' });
  return result;
}

export function directiveModifierDefinition(id: DirectiveModifierId) { return byModifier.get(id)!; }
export function directiveModifierName(id: DirectiveModifierId) { return directiveModifierDefinition(id).name; }

export function directiveStats(directive: Pick<OperationDirective, 'tier' | 'modifierIds' | 'targetClass'>) {
  const definitions = directive.modifierIds.map(directiveModifierDefinition);
  const materialMultiplier = 1 + definitions.reduce((sum, definition) => sum + definition.materialBonus, 0);
  const qualityBonus = definitions.reduce((sum, definition) => sum + definition.qualityBonus, 0) + (directive.targetClass === 'command-target' ? 0.18 : 0);
  const singularChanceBonus = Math.min(0.22, definitions.reduce((sum, definition) => sum + definition.singularBonus, 0) + (directive.targetClass === 'command-target' ? 0.03 : 0));
  const recoveryLevelBonus = Math.min(3, definitions.reduce((sum, definition) => sum + definition.recoveryLevelBonus, 0) + (directive.targetClass === 'command-target' ? 1 : 0));
  return {
    materialMultiplier,
    qualityBonus,
    singularChanceBonus,
    recoveryLevelBonus,
    threatBonus: definitions.reduce((sum, definition) => sum + definition.threatBonus, 0),
    protocolBonus: Math.min(2, definitions.reduce((sum, definition) => sum + definition.protocolBonus, 0)),
    protocolDensity: Math.min(4, definitions.reduce((sum, definition) => sum + definition.protocolDensity, 0)),
    eventBonus: Math.min(2, definitions.reduce((sum, definition) => sum + definition.eventBonus, 0)),
    reserveBonus: Math.min(1, definitions.reduce((sum, definition) => sum + definition.reserveBonus, 0)),
    riskScore: definitions.reduce((sum, definition) => sum + definition.risk, 0) + (directive.targetClass === 'command-target' ? 2 : 0),
    eventBias: [...new Set(definitions.flatMap(definition => definition.eventBias))],
    protocolBias: [...new Set(definitions.flatMap(definition => definition.protocolBias))],
    conditions: [...new Set(definitions.flatMap(definition => definition.conditions))],
  };
}

export function directiveRewardPreview(directive: Pick<OperationDirective, 'tier' | 'modifierIds' | 'targetClass'>, operatorLevel = 10) {
  const stats = directiveStats(directive);
  const maxRecoveryLevel = 8 + directive.tier * 4;
  const maxFrame = frameGenerationForRecovery(maxRecoveryLevel, operatorLevel);
  const maxGrade = maxRecoveryLevel >= 43 ? 5 : maxRecoveryLevel >= 31 ? 4 : maxRecoveryLevel >= 19 ? 3 : 2;
  return `+${Math.round((stats.materialMultiplier - 1) * 100)}% directive materials · +${stats.qualityBonus.toFixed(2)} RQ pressure · +${Math.round(stats.singularChanceBonus * 100)}% location Singular chance · +${stats.recoveryLevelBonus} source RL · ceiling RL ${maxRecoveryLevel} / Gen ${maxFrame} / G${maxGrade}`;
}

export function generateDirective(campaign: CampaignState, tierInput: number, seed: number, sourceLabel: string): OperationDirective {
  const tier = clamp(Math.round(tierInput), 1, 12);
  const chapterTwoLocations: LocationId[] = campaign.story.postKhepri.status === 'locked' ? [] : ['momentum-exchange', 'cryo-reserve'];
  const locations = campaign.story.blackLattice.status === 'complete' ? [...normalLocations, 'lattice-annex' as LocationId, ...chapterTwoLocations] : normalLocations;
  let location = locations[hash(seed, 3) % locations.length];
  let archetype = archetypes[hash(seed, 5) % archetypes.length];
  let sponsor = sponsorForArchetype(archetype);
  const commandChance = tier < 6 ? 0 : Math.min(78, 18 + tier * 5);
  const targetClass: DirectiveTargetClass = hash(seed, 7) % 100 < commandChance ? 'command-target' : 'elite-led';
  let deepTarget = deepTargetForLocation(location, archetype);
  const unlockedSpecial = specialTargets(campaign);
  if (targetClass === 'command-target' && unlockedSpecial.length > 0 && hash(seed, 11) % 100 < 48) {
    const special = unlockedSpecial[hash(seed, 13) % unlockedSpecial.length];
    location = special.location;
    archetype = special.archetype;
    sponsor = special.sponsor;
    deepTarget = special.target;
  }
  const objectiveMode: ObjectiveMode = location === 'momentum-exchange' ? (hash(seed, 17) % 3 === 0 ? 'grid-isolation' : 'momentum-capture') : location === 'cryo-reserve' ? (hash(seed, 17) % 3 === 0 ? 'pressure-recovery' : 'thermal-routing') : objectiveModes[hash(seed, 17) % objectiveModes.length];
  const modifierIds = chooseModifiers(tier, seed);
  const codename = `${adjective[hash(seed, 19) % adjective.length]} ${noun[hash(seed, 23) % noun.length]}`;
  return {
    id: `directive-${tier}-${(seed >>> 0).toString(36)}`,
    seed: seed >>> 0,
    tier,
    location,
    locationName: locationNameFor(location),
    sponsor,
    archetype,
    objectiveMode,
    modifierIds,
    targetClass,
    deepTarget,
    codename,
    sourceLabel,
  };
}

export function buildDirectiveContract(campaign: CampaignState, directive: OperationDirective): Contract {
  const objective = missionObjectiveFor(directive.objectiveMode, directive.location);
  const stats = directiveStats(directive);
  const rewardBase = directive.archetype === 'salvage'
    ? { credits: 250, alloys: 5, electronics: 3, components: 1 }
    : directive.archetype === 'boarding'
      ? { credits: 285, alloys: 4, electronics: 4, medstock: 1 }
      : { credits: 265, electronics: 5, medstock: 2, components: 1 };
  const complicationNames = directive.modifierIds.map(directiveModifierName).join(' + ') || 'No additional directive complications';
  return {
    id: `prepared-${directive.id}`,
    sponsor: directive.sponsor,
    archetype: directive.archetype,
    location: directive.location,
    locationName: directive.locationName,
    title: `Directive T${directive.tier} // ${directive.codename}`,
    objective: objective.objective,
    objectiveMode: objective.mode,
    objectiveSteps: objective.steps,
    briefing: `Quiet Signal prepared a recovered Operation Directive for this site. ${directive.targetClass === 'command-target' ? `A Command signal matching ${directive.deepTarget} is part of the navigation solution.` : 'Threat modeling predicts an Elite-led contact package before the deep-zone command signal.'}`,
    conditions: stats.conditions,
    conditionLabels: stats.conditions.map(condition => conditionLabel[condition]),
    directorPreview: `DIRECTIVE ARRAY // ${complicationNames}. Risk is expressed through pressure, mass, power, reinforcement, support, and Director systems rather than a generic outgoing-damage multiplier.`,
    deepTarget: directive.deepTarget,
    rewardBase,
    reputationGain: 2 + Math.floor(directive.tier / 4),
    priority: false,
    anomalyOpportunity: false,
    seed: directive.seed,
    operationTier: directive.tier,
    directiveId: directive.id,
    directiveTier: directive.tier,
    directiveModifierIds: [...directive.modifierIds],
    directiveTargetClass: directive.targetClass,
    directiveMaterialMultiplier: stats.materialMultiplier,
    directiveQualityBonus: stats.qualityBonus,
    directiveSingularChanceBonus: stats.singularChanceBonus,
    directiveRecoveryLevelBonus: stats.recoveryLevelBonus,
    directiveEventBias: stats.eventBias,
    directiveProtocolBias: stats.protocolBias,
    directiveThreatBonus: stats.threatBonus,
    directiveProtocolBonus: stats.protocolBonus,
    directiveProtocolDensity: stats.protocolDensity,
    directiveEventBonus: stats.eventBonus,
    directiveReserveBonus: stats.reserveBonus,
    directiveRiskScore: stats.riskScore,
    directiveSource: directive.sourceLabel,
  };
}

export function preparedDirectiveContract(campaign: CampaignState) {
  const prepared = campaign.directives.inventory.find(directive => directive.id === campaign.directives.preparedId);
  return prepared ? buildDirectiveContract(campaign, prepared) : null;
}

export function syncDirectiveAccess(campaign: CampaignState, operatorLevel: number) {
  if (operatorLevel < 10 || campaign.directives.unlocked) return campaign;
  const baseSeed = (0x71d3a5c9 ^ campaign.contractsCompleted * 104729 ^ campaign.cycle * 7919) >>> 0;
  const inventory = [
    generateDirective(campaign, 5, hash(baseSeed, 1), 'Quiet Signal level-10 calibration'),
    generateDirective(campaign, 6, hash(baseSeed, 2), 'Quiet Signal level-10 calibration'),
    generateDirective(campaign, 6, hash(baseSeed, 3), 'Quiet Signal level-10 calibration'),
  ];
  const lastBeat = 'DIRECTIVE ARRAY ONLINE // three calibration directives recovered // prepare one from Operations.';
  return { ...campaign, directives: { ...campaign.directives, unlocked: true, inventory, highestTier: 6, lastBeat }, lastOutcome: lastBeat };
}

export function prepareDirective(campaign: CampaignState, id: string) {
  if (!campaign.directives.unlocked) return campaign;
  const directive = campaign.directives.inventory.find(item => item.id === id);
  if (!directive) return campaign;
  const lastBeat = `Directive T${directive.tier} // ${directive.codename} prepared for ${directive.locationName}.`;
  return { ...campaign, directives: { ...campaign.directives, preparedId: id, lastBeat }, lastOutcome: lastBeat };
}

export function advanceDirectivesAfterContract(campaign: CampaignState, completed: Contract, depth: 'safe' | 'deep', telemetry: Telemetry, fullMegastructure = false) {
  if (!campaign.directives.unlocked) return { campaign, note: null as string | null, recovered: [] as OperationDirective[] };
  const inventory = [...campaign.directives.inventory];
  const recovered: OperationDirective[] = [];
  const sourceTier = clamp(completed.operationTier ?? 5, 1, 12);
  const protocolValue = telemetry.eliteProtocolsDefeated ?? 0;
  const addRecovered = (tier: number, salt: number, label: string) => {
    if (inventory.length + recovered.length >= DIRECTIVE_CAP) return;
    const seed = hash(completed.seed ^ campaign.contractsCompleted * 131071, salt + campaign.directives.completed * 17);
    recovered.push(generateDirective(campaign, clamp(tier, 1, 12), seed, label));
  };

  if (completed.directiveId) {
    const consumed = inventory.find(item => item.id === completed.directiveId);
    if (!consumed) return { campaign, note: null as string | null, recovered };
    const remaining = inventory.filter(item => item.id !== consumed.id);
    const highValueClear = depth === 'deep' && (completed.directiveTargetClass === 'command-target' || protocolValue >= 4);
    const nextTier = clamp(consumed.tier + (highValueClear ? 1 : 0), 1, 12);
    const seedBase = completed.seed ^ consumed.tier * 65537;
    const first = generateDirective(campaign, nextTier, hash(seedBase, 41), `Directive T${consumed.tier} completion`);
    recovered.push(first);
    if (depth === 'deep' && (protocolValue >= 3 || completed.directiveTargetClass === 'command-target') && remaining.length + recovered.length < DIRECTIVE_CAP) recovered.push(generateDirective(campaign, consumed.tier, hash(seedBase, 43), 'Deep command/protocol recovery'));
    const nextInventory = [...remaining, ...recovered].slice(0, DIRECTIVE_CAP);
    const highestTier = Math.max(campaign.directives.highestTier, ...recovered.map(item => item.tier));
    const note = `DIRECTIVE BANKED // T${consumed.tier} ${consumed.codename} consumed on extraction // ${recovered.length} replacement directive${recovered.length === 1 ? '' : 's'} recovered${nextTier > consumed.tier ? ` // T${nextTier} route unlocked` : ''}.`;
    return { campaign: { ...campaign, directives: { ...campaign.directives, inventory: nextInventory, preparedId: null, completed: campaign.directives.completed + 1, highestTier, lastBeat: note }, lastOutcome: note }, note, recovered };
  }

  const meaningfulSource = fullMegastructure || depth === 'deep' || (!!completed.daily && protocolValue >= 2) || (!!completed.escalationStage && protocolValue >= 2);
  if (!meaningfulSource || inventory.length >= DIRECTIVE_CAP) return { campaign, note: null as string | null, recovered };
  const sourceBoost = depth === 'deep' && protocolValue >= 4 ? 1 : 0;
  addRecovered(sourceTier + sourceBoost, 61, fullMegastructure ? 'Full derelict expedition recovery' : completed.campaignFinale ? 'Black Lattice command recovery' : completed.storyFinale ? 'Story command recovery' : completed.escalationStage ? 'Escalation recovery' : completed.daily ? 'Daily Operations recovery' : protocolValue >= 3 ? 'High-protocol deep recovery' : 'Deep command recovery');
  if (!recovered.length) return { campaign, note: null as string | null, recovered };
  const nextInventory = [...inventory, ...recovered].slice(0, DIRECTIVE_CAP);
  const highestTier = Math.max(campaign.directives.highestTier, ...recovered.map(item => item.tier));
  const note = `OPERATION DIRECTIVE RECOVERED // T${recovered[0].tier} ${recovered[0].codename} // ${recovered[0].locationName}.`;
  return { campaign: { ...campaign, directives: { ...campaign.directives, inventory: nextInventory, highestTier, lastBeat: note }, lastOutcome: note }, note, recovered };
}
