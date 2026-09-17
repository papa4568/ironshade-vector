const factionSetDefinitions = [
  {
    id: "meridian",
    displayName: "Meridian Compact",
    setName: "Palisade Standard",
    philosophy: "Pressure integrity, layered survivability, certified armor work, and recoil that behaves the same way every time.",
    twoPiece: "+16 max armor and improved vacuum resistance.",
    fourPiece: "Additional armor reserve and 14% lower recoil across all weapons.",
    combatIdentity: "Meridian Palisade Operator"
  },
  {
    id: "heliostat",
    displayName: "Heliostat League",
    setName: "Redline Array",
    philosophy: "Capacitor headroom, aggressive thermal routing, sensors, and high-output hardware that deliberately lives near the redline.",
    twoPiece: "+14 max capacitor and +14% capacitor regeneration.",
    fourPiece: "+8% weapon damage, much faster cooling, shorter ability cycles, but +10% heat per shot.",
    combatIdentity: "Heliostat Redline Specialist"
  },
  {
    id: "longarc",
    displayName: "Long Arc Assembly",
    setName: "Wayfarer Retrofit",
    philosophy: "Low-mass mobility, reclaimed hardware, recoil as propulsion, salvage logic, and useful interactions conventional designers would avoid.",
    twoPiece: "+6% movement speed and stronger low-g control.",
    fourPiece: "Recoil Vectoring, Dodge Heat Shunt, and low-g Breacher propulsion become active.",
    combatIdentity: "Long Arc Vector Rigger"
  }
];
const factionFrames = {
  meridian: {
    carbine: { baseId: "meridian-compliance-m7", name: "Compact M-7 Compliance Spine", equipmentClass: "Meridian certified coil-carbine frame", core: "Pressure-rated receiver with conservative impulse timing and repeatable recoil geometry.", preferredAffixes: ["countermass", "tungsten", "extendedFeed", "hypervelocity"] },
    breacher: { baseId: "meridian-palisade-b4", name: "Palisade B-4 Breach Cage", equipmentClass: "Meridian boarding scatter frame", core: "A reinforced close-quarters cage built to stay predictable when firing from sealed lanes and hard cover.", preferredAffixes: ["countermass", "tungsten", "extendedFeed", "cryoloop"] },
    rail: { baseId: "meridian-bondhouse-r2", name: "Bondhouse R-2 Stabilized Rails", equipmentClass: "Meridian stabilized rail assembly", core: "Certified rail alignment and heavy counter-recoil hardware favor repeatability over peak output.", preferredAffixes: ["countermass", "tungsten", "hypervelocity", "markShear"] },
    suit: { baseId: "meridian-rated-mantle", name: "Compact Rated Pressure Mantle", equipmentClass: "Meridian combat pressure suit", core: "Layered seal architecture and redundant plate interfaces prioritize survival in damaged habitats.", preferredAffixes: ["vacuumSeal", "servoWeave", "capacitorRecycler", "dodgeVent"] },
    rig: { baseId: "meridian-redundant-bus", name: "Meridian Redundant Systems Bus", equipmentClass: "Meridian power and thermal rig", core: "Conservative parallel routing keeps capacitor and thermal systems functional after partial damage.", preferredAffixes: ["capacitorRecycler", "cryoloop", "magRedirect", "dodgeVent"] },
    implant: { baseId: "meridian-certified-link", name: "Certified Threat-Control Link", equipmentClass: "Meridian tactical implant", core: "A procedural targeting layer that favors verified armor paths and controlled machinery interaction.", preferredAffixes: ["markShear", "magRedirect", "capacitorRecycler", "servoWeave"] }
  },
  heliostat: {
    carbine: { baseId: "heliostat-flux-m7", name: "Heliostat Flux M-7", equipmentClass: "Heliostat high-output coil frame", core: "An open-coil receiver that trades thermal comfort for projectile energy and sensor-grade timing.", preferredAffixes: ["overdrive", "hypervelocity", "cryoloop", "magRedirect"] },
    breacher: { baseId: "heliostat-sunforge-b4", name: "Sunforge B-4 Injector", equipmentClass: "Heliostat thermal scatter frame", core: "A hot-running experimental injector with aggressive heat rejection and unusually high close-range output.", preferredAffixes: ["overdrive", "cryoloop", "dodgeVent", "tungsten"] },
    rail: { baseId: "heliostat-redline-r2", name: "Heliostat Redline R-2", equipmentClass: "Heliostat precision rail assembly", core: "Fast-switching capacitor rails designed around extreme muzzle energy and active thermal management.", preferredAffixes: ["hypervelocity", "overdrive", "cryoloop", "railFracture"] },
    suit: { baseId: "heliostat-radiant-shell", name: "Radiant Works EVA Shell", equipmentClass: "Heliostat prototype pressure suit", core: "Light composite protection with integrated heat paths and high-bandwidth suit telemetry.", preferredAffixes: ["servoWeave", "capacitorRecycler", "dodgeVent", "vacuumSeal"] },
    rig: { baseId: "heliostat-open-cycle-rig", name: "Open-Cycle Thermal Bus", equipmentClass: "Heliostat power and thermal rig", core: "An experimental bus that assumes the operator will deliberately manage heat instead of avoiding it.", preferredAffixes: ["cryoloop", "capacitorRecycler", "arcDrone", "overdrive"] },
    implant: { baseId: "heliostat-vector-array", name: "Heliostat Vector Array", equipmentClass: "Heliostat sensor implant", core: "A high-rate prediction layer that couples targeting, disruption, and capacitor scheduling.", preferredAffixes: ["markShear", "arcDrone", "capacitorRecycler", "magRedirect"] }
  },
  longarc: {
    carbine: { baseId: "longarc-patchline-m7", name: "Long Arc Patchline M-7", equipmentClass: "Long Arc reclaimed coil frame", core: "A field-serviceable carbine built from interoperable convoy parts and tuned around moving fire.", preferredAffixes: ["countermass", "hypervelocity", "magRedirect", "extendedFeed"] },
    breacher: { baseId: "longarc-backblast-b4", name: "Long Arc Backblast B-4", equipmentClass: "Long Arc recoil-mobility scatter frame", core: "A deliberately lively scatter frame that treats recoil as another maneuvering input.", preferredAffixes: ["breachPropulsion", "dodgeVent", "countermass", "overdrive"] },
    rail: { baseId: "longarc-deadreckon-r2", name: "Deadreckon R-2 Retrofit", equipmentClass: "Long Arc field rail assembly", core: "Reclaimed rails with practical optics and modular penetrator hardware for remote-route repairability.", preferredAffixes: ["hypervelocity", "markShear", "countermass", "railFracture"] },
    suit: { baseId: "longarc-convoy-skin", name: "Convoy Countermass Skin", equipmentClass: "Long Arc maneuvering pressure suit", core: "Patchable pressure layers and oversized maneuvering authority favor survival through motion rather than mass.", preferredAffixes: ["servoWeave", "vacuumSeal", "dodgeVent", "countermass"] },
    rig: { baseId: "longarc-mutual-aid-rig", name: "Mutual-Aid Dynamo Rig", equipmentClass: "Long Arc salvage systems rig", core: "A repair-friendly bus built to reclaim useful charge and heat margin from improvised field interactions.", preferredAffixes: ["capacitorRecycler", "dodgeVent", "arcDrone", "magRedirect"] },
    implant: { baseId: "longarc-routefinder-link", name: "Routefinder Relay Link", equipmentClass: "Long Arc distributed sensor implant", core: "A convoy-derived prediction layer that treats machinery, movement, and local sensor relays as one network.", preferredAffixes: ["markShear", "magRedirect", "servoWeave", "capacitorRecycler"] }
  }
};
function factionGearChance(reputation, deep) {
  const base = reputation >= 12 ? 1 : reputation >= 8 ? 0.72 : reputation >= 6 ? 0.56 : reputation >= 0 ? 0.38 : 0.26;
  return Math.min(1, base + (base < 1 ? 0.1 : 0));
}
const eliteProtocolDefinitions = [
  { id: "reactivePlating", name: "Reactive Plating", shortName: "PLATING", family: "defense", threatCost: 3, rewardWeight: 1, tell: "Armor panels flash and re-knit between pressure cycles.", counter: "Sustain armor pressure or disrupt the unit before the repair pulse.", baseCooldown: 7.2, enhanceable: true },
  { id: "pressureHunter", name: "Pressure Hunter", shortName: "PRESSURE", family: "pressure", threatCost: 3, rewardWeight: 1, tell: "Suit vents flare when local atmosphere drops.", counter: "Repressurize the room, seal the breach, or stagger the pursuer.", baseCooldown: 7.8, locations: ["orbital-station", "damaged-vessel", "jovian-harvester"] },
  { id: "vacuumAdapted", name: "Vacuum Adapted", shortName: "VAC-ADAPT", family: "pressure", threatCost: 3, rewardWeight: 1, tell: "Hard-vac trim remains stable during decompression.", counter: "Restore pressure or use Magnetic Impulse to break its line.", baseCooldown: 8.4, locations: ["damaged-vessel", "jovian-harvester", "ice-mine", "solar-yard", "cryo-reserve"] },
  { id: "breachmaker", name: "Breachmaker", shortName: "BREACH", family: "pressure", threatCost: 4, rewardWeight: 1, tell: "Demolition hardware locks onto nearby cover.", counter: "Disrupt the carrier or reposition before the firing lane opens.", baseCooldown: 7.4, enhanceable: true, locations: ["orbital-station", "damaged-vessel", "asteroid-refinery", "ice-mine", "lattice-annex"] },
  { id: "magneticLock", name: "Magnetic Lock", shortName: "MAG-LOCK", family: "mass", threatCost: 4, rewardWeight: 1, tell: "A blue mass-reference reticle forms on the operator vector.", counter: "Sensor Spike or Arc disruption prevents the lock; move clear of the well.", baseCooldown: 6.6, enhanceable: true, locations: ["orbital-station", "spin-habitat", "jovian-harvester", "lattice-annex", "momentum-exchange"] },
  { id: "gravityAnchor", name: "Gravity Anchor", shortName: "ANCHOR", family: "mass", threatCost: 4, rewardWeight: 1, tell: "Anchor vanes flare and the unit resists pressure and impulse.", counter: "Arc Tap or Sensor Spike disables the anchor before Magnetic Impulse.", baseCooldown: 7.6, enhanceable: true, locations: ["asteroid-refinery", "spin-habitat", "solar-yard", "lattice-annex", "momentum-exchange"] },
  { id: "countermassMobility", name: "Countermass Mobility", shortName: "COUNTERMASS", family: "mass", threatCost: 3, rewardWeight: 1, tell: "Countermass pods precess before a lateral vector burst.", counter: "Magnetic Impulse interrupts committed movement; walls limit the escape.", baseCooldown: 5.8, enhanceable: true, locations: ["spin-habitat", "jovian-harvester", "ice-mine", "momentum-exchange"] },
  { id: "arcConduit", name: "Arc Conduit", shortName: "ARC-LINK", family: "systems", threatCost: 4, rewardWeight: 1, tell: "Visible arcs bridge the unit to floor hardware.", counter: "Arc Tap turns the conductive network into a disruption path.", baseCooldown: 6.4, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "solar-yard", "lattice-annex"] },
  { id: "repairMesh", name: "Repair Mesh", shortName: "REPAIR", family: "systems", threatCost: 3, rewardWeight: 1, tell: "Green repair tracers link damaged armor and machinery.", counter: "Disrupt the mesh or destroy repaired hardware faster than it cycles.", baseCooldown: 6.8, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "solar-yard", "lattice-annex", "momentum-exchange", "cryo-reserve"] },
  { id: "droneEscort", name: "Drone Escort", shortName: "ESCORT", family: "systems", threatCost: 4, rewardWeight: 1, tell: "Docking lights open on a limited support-drone rack.", counter: "Kill the finite drones or disrupt the carrier before launch.", baseCooldown: 8.2, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "jovian-harvester", "solar-yard", "lattice-annex"], excludedVariants: ["droneCarrier"] },
  { id: "emergencyShutters", name: "Emergency Shutters", shortName: "SHUTTERS", family: "control", threatCost: 4, rewardWeight: 1, tell: "Amber lane markers illuminate before portable shutters rise.", counter: "Destroy or penetrate the shutters, or reposition before closure.", baseCooldown: 8.8, enhanceable: true, locations: ["orbital-station", "damaged-vessel", "spin-habitat", "lattice-annex", "momentum-exchange", "cryo-reserve"] },
  { id: "sensorGhost", name: "Sensor Ghost", shortName: "GHOST", family: "control", threatCost: 3, rewardWeight: 1, tell: "The silhouette doubles on assisted targeting returns.", counter: "Sensor Spike resolves the true return; manual aim remains available.", baseCooldown: 8.1, locations: ["spin-habitat", "ice-mine", "lattice-annex"] },
  { id: "signalJammer", name: "Signal Jammer", shortName: "JAMMER", family: "control", threatCost: 4, rewardWeight: 1, tell: "A violet interference ring expands around the unit.", counter: "Break range or Arc-disrupt the jammer before its pulse.", baseCooldown: 7.1, enhanceable: true, locations: ["orbital-station", "jovian-harvester", "solar-yard", "lattice-annex"] },
  { id: "thermalOverrun", name: "Thermal Overrun", shortName: "REDLINE", family: "fire", threatCost: 4, rewardWeight: 1, tell: "Weapon coils glow before a committed burst and forced cooldown.", counter: "Break line of sight or interrupt the telegraph, then punish self-stagger.", baseCooldown: 7.5, enhanceable: true, locations: ["asteroid-refinery", "jovian-harvester", "solar-yard", "cryo-reserve"] },
  { id: "suppressionCoordinator", name: "Suppression Coordinator", shortName: "COORD", family: "fire", threatCost: 4, rewardWeight: 1, tell: "Squad firing markers synchronize around the coordinator.", counter: "Disrupt or kill the coordinator to break the synchronized window.", baseCooldown: 8, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "spin-habitat", "ice-mine"] },
  { id: "penetratorVolley", name: "Penetrator Volley", shortName: "PEN-VOLLEY", family: "fire", threatCost: 4, rewardWeight: 1, tell: "A long straight-line firing solution locks before the volley.", counter: "Dodge the visible solution, use hard cover, or interrupt it.", baseCooldown: 7.2, enhanceable: true, locations: ["orbital-station", "asteroid-refinery", "ice-mine", "lattice-annex", "momentum-exchange", "cryo-reserve"] },
  { id: "salvageInterdictor", name: "Salvage Interdictor", shortName: "INTERDICT", family: "objective", threatCost: 4, rewardWeight: 2, tell: "Recovery-tag telemetry is copied to the hostile unit.", counter: "Intercept the carrier; death restores the package tag.", baseCooldown: 5.4, enhanceable: true, objectiveModes: ["machinery-recovery", "deep-salvage"], excludedVariants: ["salvageThief"] },
  { id: "recoveryDenial", name: "Recovery Denial", shortName: "DENIAL", family: "objective", threatCost: 4, rewardWeight: 2, tell: "A denial grid forms around tagged objective hardware.", counter: "Disrupt the projector, isolate the grid, or approach from another lane.", baseCooldown: 6.3, enhanceable: true, objectiveModes: ["machinery-recovery", "deep-salvage"] }
];
const byId = new Map(eliteProtocolDefinitions.map((definition) => [definition.id, definition]));
const locationBias = {
  "orbital-station": ["reactivePlating", "emergencyShutters", "suppressionCoordinator", "magneticLock", "arcConduit", "penetratorVolley"],
  "damaged-vessel": ["pressureHunter", "vacuumAdapted", "breachmaker", "emergencyShutters", "reactivePlating"],
  "asteroid-refinery": ["breachmaker", "repairMesh", "thermalOverrun", "gravityAnchor", "arcConduit", "suppressionCoordinator"],
  "spin-habitat": ["gravityAnchor", "countermassMobility", "sensorGhost", "magneticLock", "suppressionCoordinator", "emergencyShutters"],
  "jovian-harvester": ["vacuumAdapted", "pressureHunter", "magneticLock", "countermassMobility", "thermalOverrun", "signalJammer"],
  "ice-mine": ["sensorGhost", "countermassMobility", "penetratorVolley", "suppressionCoordinator", "vacuumAdapted", "breachmaker"],
  "solar-yard": ["arcConduit", "droneEscort", "repairMesh", "thermalOverrun", "signalJammer", "gravityAnchor"],
  "lattice-annex": ["sensorGhost", "gravityAnchor", "arcConduit", "emergencyShutters", "signalJammer", "penetratorVolley"],
  "momentum-exchange": ["countermassMobility", "penetratorVolley", "repairMesh", "emergencyShutters", "reactivePlating", "magneticLock"],
  "cryo-reserve": ["vacuumAdapted", "thermalOverrun", "repairMesh", "emergencyShutters", "reactivePlating", "penetratorVolley"]
};
function hash32(value) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
function protocolDefinition(id) {
  return byId.get(id);
}
function protocolThreatCost(instance) {
  return protocolDefinition(instance.id).threatCost + (instance.enhanced ? 1 : 0);
}
function protocolRewardValue(instance) {
  return protocolDefinition(instance.id).rewardWeight + (instance.enhanced ? 1 : 0);
}
function eligible(definition, contract, role, variant) {
  var _a;
  if (definition.locations && !definition.locations.includes(contract.location)) return false;
  if (definition.roles && !definition.roles.includes(role)) return false;
  if ((_a = definition.excludedVariants) == null ? void 0 : _a.includes(variant)) return false;
  if (definition.objectiveModes && !definition.objectiveModes.includes(contract.objectiveMode)) return false;
  return true;
}
function chooseEnemyProtocols(contract, role, variant, count, enemyId) {
  const directiveBias = (contract.directiveProtocolBias ?? []).filter((id) => byId.has(id));
  const bias = [...directiveBias, ...locationBias[contract.location] ?? []].filter((id, index, all) => all.indexOf(id) === index);
  const chosenFamilies = /* @__PURE__ */ new Set();
  const candidates = eliteProtocolDefinitions.filter((definition) => eligible(definition, contract, role, variant)).sort((a, b) => {
    const aBias = bias.indexOf(a.id);
    const bBias = bias.indexOf(b.id);
    const aRank = aBias < 0 ? 99 : aBias;
    const bRank = bBias < 0 ? 99 : bBias;
    if (aRank !== bRank) return aRank - bRank;
    return hash32(contract.seed ^ enemyId * 7919 ^ a.id.length * 104729) - hash32(contract.seed ^ enemyId * 7919 ^ b.id.length * 104729);
  });
  const result = [];
  for (const definition of candidates) {
    if (result.length >= count || chosenFamilies.has(definition.family)) continue;
    chosenFamilies.add(definition.family);
    const tier = contract.operationTier ?? 1;
    const enhancedChance = tier >= 12 ? 42 : tier >= 10 ? 24 : 0;
    const roll = hash32(contract.seed ^ enemyId * 2654435761 ^ definition.id.length * 31337) % 100;
    const enhanced = !!definition.enhanceable && enhancedChance > 0 && roll < enhancedChance;
    const cooldownJitter = hash32(contract.seed ^ enemyId * 131 ^ result.length * 17) % 140 / 100;
    result.push({ id: definition.id, enhanced, cooldown: 1.6 + cooldownJitter, windup: 0 });
  }
  return result;
}
const clamp$4 = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
function frameGenerationForRecovery(recoveryLevel, operatorLevel = 10) {
  if (operatorLevel >= 15 && recoveryLevel >= 55) return 6;
  if (operatorLevel >= 12 && recoveryLevel >= 43) return 5;
  if (recoveryLevel >= 43) return 4;
  if (recoveryLevel >= 31) return 3;
  if (recoveryLevel >= 19) return 2;
  return 1;
}
function monsterLevelForTier(operationTier) {
  const tier = clamp$4(Math.round(operationTier), 1, 12);
  return clamp$4(Math.round(1 + (tier - 1) * 19 / 11), 1, 20);
}
function standardTierCapForOperator(operatorLevel = 10) {
  const targetMonsterLevel = Math.min(20, Math.max(1, Math.round(operatorLevel)) + 2);
  let cap = 1;
  for (let tier = 1; tier <= 12; tier += 1) {
    if (monsterLevelForTier(tier) <= targetMonsterLevel) cap = tier;
  }
  return cap;
}
function isRotatingStandardContract(contract) {
  return !contract.directiveTier && !contract.daily && !contract.storyArc && !contract.campaignChapter && !contract.commandTrace && !contract.escalationStage && !contract.megastructure;
}
function tierForContract(contract, campaign2, operatorLevel) {
  if (contract.directiveTier) return clamp$4(contract.directiveTier, 1, 12);
  const baseline = clamp$4(1 + Math.floor(campaign2.contractsCompleted / 2), 1, 12);
  let tier = baseline;
  if (contract.daily) tier = Math.max(tier, 3 + contract.seed % 4);
  if (contract.storyArc) tier = Math.max(tier, 2 + (contract.storyStep ?? 0));
  if (contract.campaignChapter === "black-lattice") tier = Math.max(tier, 3 + Math.floor((contract.campaignStep ?? 0) / 2));
  if (contract.campaignChapter === "dead-reckoning") tier = Math.max(tier, 7 + Math.floor((contract.campaignStep ?? 0) / 2));
  if (contract.campaignChapter === "dead-reckoning-interdiction") tier = Math.max(tier, 9 + Math.floor((contract.campaignStep ?? 0) / 2));
  if (contract.commandTrace) tier = Math.max(tier, 10);
  if (contract.escalationStage) tier = Math.max(tier, 4 + contract.escalationStage * 2);
  if (contract.megastructure) tier = Math.max(tier, 5 + Math.min(3, Math.floor(campaign2.contractsCompleted / 5)));
  if (contract.priority) tier += 1;
  if (contract.storyFinale || contract.campaignFinale || contract.escalationFinale) tier += 1;
  if (isRotatingStandardContract(contract)) tier = Math.min(tier, standardTierCapForOperator(operatorLevel));
  return clamp$4(tier, 1, 12);
}
function patternFor(contract, tier) {
  if (tier <= 2) return "swarm";
  const roll = ((contract.seed >>> 3) + tier) % 3;
  if (roll === 2 && tier >= 4) return "elite-led";
  return roll === 0 ? "swarm" : "mixed";
}
function operationScalingFor(contract, campaign2, operatorLevel = 10) {
  const operationTier = tierForContract(contract, campaign2, operatorLevel);
  const monsterLevel = monsterLevelForTier(operationTier);
  const basePattern = patternFor(contract, operationTier);
  const encounterPattern = contract.directiveTargetClass === "elite-led" ? "elite-led" : basePattern;
  let environmentalEventSlots = operationTier <= 2 ? 1 : operationTier <= 5 ? 2 : operationTier <= 8 ? 3 : 4;
  if (contract.daily || contract.escalationStage || contract.megastructure) environmentalEventSlots = Math.min(4, environmentalEventSlots + 1);
  environmentalEventSlots = Math.min(4, environmentalEventSlots + (contract.directiveEventBonus ?? 0));
  const maxRecoveryLevel = 8 + operationTier * 4;
  const threatBudget = 28 + operationTier * 4 + (contract.archetype === "boarding" ? 4 : contract.archetype === "stabilization" ? 2 : 0) + (contract.escalationStage ? 4 : 0) + (contract.megastructure ? 4 : 0) + (contract.directiveThreatBonus ?? 0);
  const encounterRating = 10 + operationTier * 5 + (contract.storyFinale || contract.campaignFinale || contract.escalationFinale ? 5 : contract.megastructure ? 3 : 0) + Math.min(12, contract.directiveRiskScore ?? 0);
  const baseProtocolSlots = operationTier <= 2 ? 0 : operationTier <= 4 ? 1 : operationTier <= 7 ? 2 : operationTier <= 9 ? 3 : 4;
  const eliteProtocolSlots = Math.min(4, baseProtocolSlots + (contract.directiveProtocolBonus ?? 0));
  const levelDelta = clamp$4(monsterLevel - Math.max(1, operatorLevel), -4, 4);
  const directivePressure = Math.min(0.16, Math.max(0, contract.directiveRiskScore ?? 0) * 8e-3);
  const combatEffectiveness = clamp$4(1 + (operationTier - 1) * 0.055 + levelDelta * 0.025 + directivePressure, 0.9, 1.85);
  const monsterDamageScale = clamp$4(1 + (operationTier - 1) * 0.035 + Math.max(0, levelDelta) * 0.02 + directivePressure * 0.45, 0.95, 1.55);
  const operationRewardMultiplier = (1 + (operationTier - 1) * 0.04) * (contract.directiveMaterialMultiplier ?? 1);
  const baseReserveCount = encounterPattern === "elite-led" ? 1 : encounterPattern === "swarm" ? 2 : operationTier >= 4 ? 2 : 1;
  const reserveCount = Math.min(2, baseReserveCount + (contract.directiveReserveBonus ?? 0));
  return { operationTier, monsterLevel, encounterRating, threatBudget, maxRecoveryLevel, maxFrameGeneration: frameGenerationForRecovery(maxRecoveryLevel, operatorLevel), eliteProtocolSlots, environmentalEventSlots, combatEffectiveness, monsterDamageScale, operationRewardMultiplier, encounterPattern, reserveCount };
}
function withOperationScaling(contract, campaign2, operatorLevel = 10) {
  return { ...contract, ...operationScalingFor(contract, campaign2, operatorLevel) };
}
const roleThreat = { assault: 6, suppressor: 7, technician: 7, elite: 14, boss: 0 };
const combatClassThreat = { standard: 0, enhanced: 3, elite: 5, command: 0 };
const variantThreat = { shieldBoarder: 4, tetherOperator: 3, droneCarrier: 3, coverBreacher: 3, marksman: 3, vacuumSaboteur: 3, repairDrone: 2, gravitySpecialist: 3, meleeExosuit: 5, salvageThief: 2, vectorSkirmisher: 2, anchorEngineer: 5, barricadeTrooper: 3, pressureLockTech: 3, tetherRigger: 3, maintenanceDrone: 2, gravityDrone: 3, impulseRigger: 3, boiloffTech: 3, partitionRigger: 4, recoilBroker: 3, siphonTech: 4, purgeOrchestrator: 4, custodyPorter: 4, geometryTech: 4 };
function enemyThreatCost(enemy) {
  return roleThreat[enemy.role] + (variantThreat[enemy.variant] ?? 0) + combatClassThreat[enemy.combatClass] + enemy.protocols.reduce((total, protocol) => total + protocolThreatCost(protocol), 0);
}
function authoredEliteRequired(contract) {
  if (contract.megastructureStage === 2 || contract.storyFinale || contract.campaignFinale || contract.escalationFinale) return true;
  return ["Recovery Commander Sable Voss", "Salvage Captain Rhea Kade", "Foundry Marshal Cael", "HELIOS-9 Yardmind", "Transfer Adjudicator Iona Vale", "Umbra Systems Marshal Oren Saal", "Custody Director Mara Teth"].includes(contract.deepTarget);
}
function deterministicRank(contract, enemy) {
  let value = (contract.seed ^ enemy.id * 7919 ^ (contract.operationTier ?? 1) * 104729) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}
function applyThreatBudget(enemies, contract) {
  var _a;
  const budget = contract.threatBudget ?? 34;
  const pattern = contract.encounterPattern ?? "mixed";
  const effectiveness = contract.combatEffectiveness ?? 1;
  const tier = contract.operationTier ?? 1;
  const protocolCapacity = contract.eliteProtocolSlots ?? 0;
  const regular = enemies.filter((enemy) => enemy.role !== "boss" && enemy.id <= 8);
  for (const enemy of enemies) {
    enemy.protocols = [];
    enemy.protocolPulse = 0;
    enemy.combatClass = enemy.role === "boss" ? "command" : enemy.role === "elite" ? "elite" : "standard";
  }
  for (const enemy of regular) {
    enemy.effectiveness = effectiveness;
    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * effectiveness));
    enemy.hp = enemy.maxHp;
    enemy.maxArmor = Math.max(0, Math.round(enemy.maxArmor * effectiveness));
    enemy.armor = enemy.maxArmor;
  }
  const boss = enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    const bossEffectiveness = Math.max(1, 1 + (effectiveness - 1) * 0.82);
    boss.effectiveness = bossEffectiveness;
    boss.maxHp = Math.max(1, Math.round(boss.maxHp * bossEffectiveness));
    boss.hp = boss.maxHp;
    boss.maxArmor = Math.max(0, Math.round(boss.maxArmor * bossEffectiveness));
    boss.armor = boss.maxArmor;
  }
  const reserveCommitment = (contract.reserveCount ?? 1) * 3;
  const environmentCommitment = (contract.environmentalEventSlots ?? 1) * 2;
  const protocolCommitment = protocolCapacity <= 0 ? 0 : Math.min(28, protocolCapacity * 4 + Math.max(0, tier - 5) + (contract.directiveProtocolDensity ?? 0) * 3);
  const bodyBudget = Math.max(22, budget - reserveCommitment - environmentCommitment - protocolCommitment);
  const core = regular.filter((enemy) => enemy.id <= 6);
  for (const enemy of core) enemy.active = false;
  const forcedElite = authoredEliteRequired(contract) ? core.find((enemy) => enemy.role === "elite") : void 0;
  const forcedRepair = ((_a = contract.directiveModifierIds) == null ? void 0 : _a.includes("repair-network")) ? core.find((enemy) => enemy.variant === "repairDrone") : void 0;
  const ordered = [...core].sort((a, b) => {
    if (pattern === "swarm") return enemyThreatCost(a) - enemyThreatCost(b) || a.id - b.id;
    if (pattern === "elite-led") {
      const eliteDelta = Number(b.role === "elite") - Number(a.role === "elite");
      return eliteDelta || enemyThreatCost(b) - enemyThreatCost(a) || a.id - b.id;
    }
    return a.id - b.id;
  });
  const selected = /* @__PURE__ */ new Set();
  let spent = 0;
  const select = (enemy) => {
    if (selected.has(enemy.id)) return;
    selected.add(enemy.id);
    enemy.active = true;
    enemy.dead = false;
    spent += enemyThreatCost(enemy);
  };
  if (forcedElite) select(forcedElite);
  if (forcedRepair) select(forcedRepair);
  for (const enemy of ordered) {
    if (selected.has(enemy.id)) continue;
    if (selected.size < 4 || spent + enemyThreatCost(enemy) <= bodyBudget) select(enemy);
  }
  let protocolBudget = protocolCommitment;
  const active = core.filter((enemy) => selected.has(enemy.id));
  const packageEnemy = (enemy, combatClass, wantedCount) => {
    if (wantedCount <= 0 || protocolBudget <= 0) return false;
    const options = chooseEnemyProtocols(contract, enemy.role, enemy.variant, wantedCount, enemy.id);
    if (options.length === 0) return false;
    const classDelta = Math.max(0, combatClassThreat[combatClass] - combatClassThreat[enemy.combatClass]);
    let localCost = classDelta;
    const accepted = [];
    for (const option of options) {
      const nextCost = protocolThreatCost(option);
      if (localCost + nextCost > protocolBudget) continue;
      accepted.push(option);
      localCost += nextCost;
    }
    if (accepted.length === 0) return false;
    enemy.combatClass = combatClass;
    enemy.protocols = accepted;
    protocolBudget -= localCost;
    return true;
  };
  const activeElite = active.find((enemy) => enemy.role === "elite");
  if (activeElite && protocolCapacity > 0) packageEnemy(activeElite, "elite", protocolCapacity);
  const candidates = active.filter((enemy) => enemy !== activeElite).sort((a, b) => deterministicRank(contract, a) - deterministicRank(contract, b));
  if (!activeElite && tier >= 8 && candidates[0]) packageEnemy(candidates[0], "elite", Math.min(protocolCapacity, tier >= 10 ? 3 : 2));
  const enhancedLimit = Math.min(3, (tier >= 9 ? 2 : protocolCapacity > 0 ? 1 : 0) + ((contract.directiveProtocolDensity ?? 0) > 0 ? 1 : 0));
  let enhanced = 0;
  for (const enemy of candidates) {
    if (enemy.combatClass !== "standard" || enhanced >= enhancedLimit) continue;
    const count = tier >= 7 ? Math.min(2, protocolCapacity) : 1;
    if (packageEnemy(enemy, "enhanced", count)) enhanced += 1;
  }
  if (tier >= 6 && protocolBudget > 0) {
    const reserve = regular.filter((enemy) => enemy.id >= 7).sort((a, b) => deterministicRank(contract, a) - deterministicRank(contract, b))[0];
    if (reserve) packageEnemy(reserve, "enhanced", 1);
  }
}
function recoveryLevelForSource(maxRecoveryLevel, options) {
  const baseline = Math.max(1, maxRecoveryLevel - 5);
  const sourceBonus = (options.deep ? 2 : 0) + Math.min(2, Math.max(0, options.eliteKills)) + (options.boss ? 3 : 0);
  return Math.min(maxRecoveryLevel, baseline + sourceBonus);
}
const coreModifierIds = /* @__PURE__ */ new Set(["hypervelocity", "countermass", "overdrive", "cryoloop", "extendedFeed", "tungsten", "vacuumSeal", "servoWeave"]);
const powerByGrade = { 1: 0.65, 2: 0.82, 3: 1, 4: 1.18, 5: 1.38 };
const tradeoffByGrade = { 1: 0.78, 2: 0.9, 3: 1, 4: 1.08, 5: 1.16 };
const qualityFloor$1 = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4 };
const locationQuality = { "orbital-station": 0.06, "damaged-vessel": 0.12, "asteroid-refinery": 0.18, "spin-habitat": 0.14, "jovian-harvester": 0.2, "ice-mine": 0.14, "solar-yard": 0.2, "lattice-annex": 0.28 };
const clamp$3 = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
function modifierFamilyFor(id) {
  return coreModifierIds.has(id) ? "core" : "systems";
}
function modifierPowerFactor(grade) {
  return powerByGrade[grade];
}
function modifierTradeoffFactor(grade) {
  return tradeoffByGrade[grade];
}
function modifierGradeCeilingForRecovery(recoveryLevel) {
  if (recoveryLevel >= 43) return 5;
  if (recoveryLevel >= 31) return 4;
  if (recoveryLevel >= 19) return 3;
  return 2;
}
function rollModifierGrade(recoveryLevel, quality, random) {
  const ceiling = modifierGradeCeilingForRecovery(recoveryLevel);
  const floor = Math.min(ceiling, qualityFloor$1[quality]);
  const span = ceiling - floor + 1;
  if (span <= 1) return floor;
  const biased = Math.pow(random(), 1 / (1 + quality * 0.22));
  return floor + Math.min(span - 1, Math.floor(biased * span));
}
function rollRarityForQuality(random, quality) {
  const roll = random();
  const prototypeChance = [0.08, 0.14, 0.24, 0.4, 0.6, 0.78][quality] ?? 0.08;
  const refinedChance = [0.52, 0.58, 0.64, 0.56, 0.4, 0.22][quality] ?? 0.52;
  if (roll < prototypeChance) return "Prototype";
  if (roll < prototypeChance + refinedChance) return "Refined";
  return "Field";
}
function modifierCountForRarity(rarity, quality, random) {
  if (rarity === "Field") return quality >= 2 || random() < 0.58 ? 1 : 0;
  if (rarity === "Refined") return 2 + (quality >= 2 && random() < 0.55 ? 1 : 0);
  return 4 + (quality >= 4 && random() < 0.55 ? 1 : 0);
}
function recoveryQualityPressure(source) {
  const tier = clamp$3(source.operationTier, 1, 12) * 0.18;
  const threat = Math.max(0, source.threatBudget - 28) / 40;
  const elites = Math.min(2, Math.max(0, source.eliteKills)) * 0.4;
  const protocols = Math.min(4, Math.max(0, source.eliteProtocolCount)) * 0.2;
  const depth = source.deep ? 0.75 : 0;
  const optional = Math.min(3, Math.max(0, source.optionalObjectives)) * 0.22;
  const events = Math.min(4, Math.max(0, source.environmentalComplications)) * 0.12;
  const boss = source.boss ? 0.95 : 0;
  const location = locationQuality[source.location ?? ""] ?? 0;
  const sponsor = source.faction ? 0.08 + Math.min(0.12, Math.max(0, source.factionReputation ?? 0) * 6e-3) : 0;
  const directive = clamp$3(source.directiveBonus ?? 0, 0, 1.8);
  return clamp$3(tier + threat + elites + protocols + depth + optional + events + boss + location + sponsor + directive, 0, 7);
}
function rollRecoveryQuality(random, source) {
  const value = recoveryQualityPressure(source) + (random() - 0.5) * 2.2;
  if (value >= 5.3) return 5;
  if (value >= 4.2) return 4;
  if (value >= 3.2) return 3;
  if (value >= 2.2) return 2;
  if (value >= 1.2) return 1;
  return 0;
}
const frameIdentityDefinitions = [
  { id: "carbine-countermass", slot: "carbine", name: "Countermass Receiver", philosophy: "Predictable recoil with a small loss of projectile pace." },
  { id: "carbine-hypervelocity", slot: "carbine", name: "Dense-Flight Receiver", philosophy: "Projectile velocity and penetration at the cost of thermal comfort." },
  { id: "carbine-feedline", slot: "carbine", name: "Sustained Feed Spine", philosophy: "Magazine endurance with slower service cycling." },
  { id: "breacher-thrust", slot: "breacher", name: "Backblast Thruster Cage", philosophy: "Turns discharge impulse into extreme shove and movement authority." },
  { id: "breacher-dense", slot: "breacher", name: "Dense-Choke Cage", philosophy: "Higher close-range output with heavier firing impulse." },
  { id: "breacher-cryo", slot: "breacher", name: "Cryo-Cycle Action", philosophy: "Fast heat recovery and cycling with slightly lower peak output." },
  { id: "rail-hypervelocity", slot: "rail", name: "Hypervelocity Rail Bed", philosophy: "Velocity and armor penetration with additional heat load." },
  { id: "rail-countermass", slot: "rail", name: "Countermass Rail Bed", philosophy: "Exceptional recoil absorption with a small energy-output concession." },
  { id: "rail-thermal", slot: "rail", name: "Thermal Reference Rails", philosophy: "Sustained rail operation with slightly less penetration." },
  { id: "suit-pressure", slot: "suit", name: "Pressure-Integrity Shell", philosophy: "Armor and seal integrity over raw mobility." },
  { id: "suit-eva", slot: "suit", name: "Light EVA Weave", philosophy: "Mobility and low-g control with less plate reserve." },
  { id: "suit-countermass", slot: "suit", name: "Countermass Mobility Shell", philosophy: "Low-g vector authority with reduced passive pressure protection." },
  { id: "rig-capacitor", slot: "rig", name: "Capacitor Reserve Bus", philosophy: "Large capacitor headroom with slightly slower recharge response." },
  { id: "rig-thermal", slot: "rig", name: "Closed-Loop Thermal Bus", philosophy: "Weapon heat rejection with less capacitor reserve." },
  { id: "rig-pulse", slot: "rig", name: "Pulse-Control Bus", philosophy: "Shorter ability cycles with slightly higher ability power cost." },
  { id: "implant-sensor", slot: "implant", name: "Survey Sensor Kernel", philosophy: "Stronger Sensor Spike solutions with slower retarget cadence." },
  { id: "implant-ballistic", slot: "implant", name: "Predictive Ballistic Kernel", philosophy: "Projectile prediction and penetration with minor neural load." },
  { id: "implant-relay", slot: "implant", name: "Distributed Relay Kernel", philosophy: "Arc Tap authority and cycling with a modest capacitor tax." }
];
const pools = {
  carbine: ["carbine-countermass", "carbine-hypervelocity", "carbine-feedline"],
  breacher: ["breacher-thrust", "breacher-dense", "breacher-cryo"],
  rail: ["rail-hypervelocity", "rail-countermass", "rail-thermal"],
  suit: ["suit-pressure", "suit-eva", "suit-countermass"],
  rig: ["rig-capacitor", "rig-thermal", "rig-pulse"],
  implant: ["implant-sensor", "implant-ballistic", "implant-relay"]
};
const clampQuality = (quality) => Math.max(0, Math.min(20, Math.round(quality)));
const qualityScale = (quality) => 1 + clampQuality(quality) * 0.02;
const generationValue = (generation, values) => values[Math.min(values.length - 1, generation - 1)] * (generation >= 5 ? 1.12 : 1);
const percent = (value) => Math.round(value * 100);
function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function frameIdentityDefinition(id) {
  return frameIdentityDefinitions.find((definition) => definition.id === id);
}
function inferFrameIdentity(slot, key) {
  const normalized = key.toLowerCase();
  if (slot === "carbine") {
    if (/counter|compliance|palisade|stable/.test(normalized)) return "carbine-countermass";
    if (/hyper|flux|ghost|arcspindle/.test(normalized)) return "carbine-hypervelocity";
  }
  if (slot === "breacher") {
    if (/backblast|redline|longarc/.test(normalized)) return "breacher-thrust";
    if (/sunforge|dense|dockbreaker/.test(normalized)) return "breacher-dense";
  }
  if (slot === "rail") {
    if (/hyper|needle|null|helios|khepri/.test(normalized)) return "rail-hypervelocity";
    if (/counter|bondhouse|stabilized/.test(normalized)) return "rail-countermass";
  }
  if (slot === "suit") {
    if (/pressure|mantle|stormskin|meridian|rated/.test(normalized)) return "suit-pressure";
    if (/eva|glass|convoy|khepri|calibration/.test(normalized)) return "suit-eva";
  }
  if (slot === "rig") {
    if (/thermal|helios|cryo|open-cycle/.test(normalized)) return "rig-thermal";
    if (/capacitor|redundant|meridian/.test(normalized)) return "rig-capacitor";
  }
  if (slot === "implant") {
    if (/sensor|survey|deadreckon|threat-control/.test(normalized)) return "implant-sensor";
    if (/route|predictive/.test(normalized)) return "implant-ballistic";
  }
  const pool = pools[slot];
  return pool[hashText(`${slot}:${key}`) % pool.length];
}
function resolveFrameIdentity(slot, identity, key) {
  return identity && frameIdentityDefinition(identity).slot === slot ? identity : inferFrameIdentity(slot, key);
}
function rollFrameIdentity(slot, random) {
  const pool = pools[slot];
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
function factionFrameIdentity(faction, slot) {
  const map = {
    meridian: { carbine: "carbine-countermass", breacher: "breacher-dense", rail: "rail-countermass", suit: "suit-pressure", rig: "rig-capacitor", implant: "implant-sensor" },
    heliostat: { carbine: "carbine-hypervelocity", breacher: "breacher-dense", rail: "rail-hypervelocity", suit: "suit-eva", rig: "rig-thermal", implant: "implant-relay" },
    longarc: { carbine: "carbine-feedline", breacher: "breacher-thrust", rail: "rail-countermass", suit: "suit-eva", rig: "rig-pulse", implant: "implant-ballistic" }
  };
  return map[faction][slot];
}
function singularFrameIdentity(slot, baseId) {
  return inferFrameIdentity(slot, `singular:${baseId}`);
}
function equipmentQualityForRecovery(recoveryQuality, generation, rarity) {
  const rarityBonus = rarity === "Singular" ? 3 : rarity === "Prototype" ? 1 : 0;
  const matureGenerationBonus = Math.min(4, Math.max(0, generation - 1));
  return clampQuality(Math.min(12, recoveryQuality * 2 + matureGenerationBonus + rarityBonus));
}
function augmentSlotCount(rarity, generation) {
  if (generation >= 6) {
    if (rarity === "Singular" || rarity === "Prototype") return 3;
    if (rarity === "Refined") return 2;
  }
  if (rarity === "Singular") return 2;
  if (rarity === "Prototype") return generation >= 3 ? 2 : 1;
  if (rarity === "Refined") return 1;
  return generation >= 2 ? 1 : 0;
}
function frameImplicitDescription(identity, generation, quality) {
  const q = qualityScale(quality);
  switch (identity) {
    case "carbine-countermass":
      return `${frameIdentityDefinition(identity).name} // ${percent(generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q)}% recoil absorption; projectile velocity -2%.`;
    case "carbine-hypervelocity":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.04, 0.06, 0.08, 0.1]) * q)}% projectile velocity and added penetration; +3% heat/shot.`;
    case "carbine-feedline":
      return `${frameIdentityDefinition(identity).name} // +${Math.max(1, Math.round(generationValue(generation, [2, 3, 4, 5]) * q))} magazine capacity; +4% reload time.`;
    case "breacher-thrust":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% knockback; +4% recoil impulse.`;
    case "breacher-dense":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.03, 0.05, 0.07, 0.09]) * q)}% direct output; +5% recoil.`;
    case "breacher-cryo":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% heat dissipation and faster reload; -2% direct output.`;
    case "rail-hypervelocity":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.05, 0.08, 0.11, 0.14]) * q)}% velocity and precision penetration; +4% heat/shot.`;
    case "rail-countermass":
      return `${frameIdentityDefinition(identity).name} // ${percent(generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q)}% recoil absorption; -3% direct output.`;
    case "rail-thermal":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.1, 0.15, 0.2, 0.25]) * q)}% heat dissipation; small penetration concession.`;
    case "suit-pressure":
      return `${frameIdentityDefinition(identity).name} // additional armor and ${percent(generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q)}% pressure resistance; -2% movement speed.`;
    case "suit-eva":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q)}% movement speed and strong low-g control; -4 armor reserve.`;
    case "suit-countermass":
      return `${frameIdentityDefinition(identity).name} // low-g vector control and modest movement gain; reduced passive pressure resistance.`;
    case "rig-capacitor":
      return `${frameIdentityDefinition(identity).name} // expanded capacitor ceiling and modest regeneration; +3% ability cost.`;
    case "rig-thermal":
      return `${frameIdentityDefinition(identity).name} // +${percent(generationValue(generation, [0.06, 0.09, 0.12, 0.15]) * q)}% weapon heat dissipation; -4 capacitor reserve.`;
    case "rig-pulse":
      return `${frameIdentityDefinition(identity).name} // shorter ability cycles; +3% ability cost.`;
    case "implant-sensor":
      return `${frameIdentityDefinition(identity).name} // stronger Sensor Spike solution; +2% mark cooldown.`;
    case "implant-ballistic":
      return `${frameIdentityDefinition(identity).name} // predictive projectile velocity and penetration; +1% ability cost.`;
    case "implant-relay":
      return `${frameIdentityDefinition(identity).name} // stronger/faster Arc Tap routing; +3% Arc Tap cost.`;
  }
}
function applyFrameIdentity(build, item) {
  const generation = item.frameGeneration ?? 1;
  const identity = resolveFrameIdentity(item.slot, item.frameIdentity, `${item.baseId}:${item.name}`);
  const q = qualityScale(item.equipmentQuality ?? 0);
  const weapon = item.slot === "carbine" || item.slot === "breacher" || item.slot === "rail" ? build.weapon[item.slot] : null;
  if (identity === "carbine-countermass" && weapon) {
    weapon.recoilMul *= 1 - generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q;
    weapon.speedMul *= 0.98;
  }
  if (identity === "carbine-hypervelocity" && weapon) {
    weapon.speedMul *= 1 + generationValue(generation, [0.04, 0.06, 0.08, 0.1]) * q;
    weapon.penetrationAdd += Math.round(generationValue(generation, [2, 4, 6, 8]) * q);
    weapon.heatPerShotMul *= 1.03;
  }
  if (identity === "carbine-feedline" && weapon) {
    weapon.magazineAdd += Math.max(1, Math.round(generationValue(generation, [2, 3, 4, 5]) * q));
    weapon.reloadMul *= 1.04;
  }
  if (identity === "breacher-thrust" && weapon) {
    weapon.knockbackMul *= 1 + generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q;
    weapon.recoilMul *= 1.04;
  }
  if (identity === "breacher-dense" && weapon) {
    weapon.damageMul *= 1 + generationValue(generation, [0.03, 0.05, 0.07, 0.09]) * q;
    weapon.recoilMul *= 1.05;
  }
  if (identity === "breacher-cryo" && weapon) {
    weapon.heatDissipationMul *= 1 + generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q;
    weapon.reloadMul *= 1 - generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q;
    weapon.damageMul *= 0.98;
  }
  if (identity === "rail-hypervelocity" && weapon) {
    weapon.speedMul *= 1 + generationValue(generation, [0.05, 0.08, 0.11, 0.14]) * q;
    weapon.penetrationAdd += Math.round(generationValue(generation, [4, 7, 10, 13]) * q);
    weapon.heatPerShotMul *= 1.04;
  }
  if (identity === "rail-countermass" && weapon) {
    weapon.recoilMul *= 1 - generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q;
    weapon.damageMul *= 0.97;
  }
  if (identity === "rail-thermal" && weapon) {
    weapon.heatDissipationMul *= 1 + generationValue(generation, [0.1, 0.15, 0.2, 0.25]) * q;
    weapon.penetrationAdd -= Math.max(1, generation - 1);
  }
  if (identity === "suit-pressure") {
    build.player.maxArmorAdd += Math.round(generationValue(generation, [5, 8, 11, 14]) * q);
    build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + generationValue(generation, [0.05, 0.07, 0.09, 0.11]) * q);
    build.player.moveSpeedMul *= 0.98;
  }
  if (identity === "suit-eva") {
    build.player.moveSpeedMul *= 1 + generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q;
    build.player.lowGControl += generationValue(generation, [0.08, 0.12, 0.16, 0.2]) * q;
    build.player.maxArmorAdd -= 4;
  }
  if (identity === "suit-countermass") {
    build.player.moveSpeedMul *= 1 + generationValue(generation, [0.01, 0.02, 0.03, 0.04]) * q;
    build.player.lowGControl += generationValue(generation, [0.12, 0.17, 0.22, 0.27]) * q;
    build.player.vacuumResistance = Math.max(0, build.player.vacuumResistance - 0.03);
  }
  if (identity === "rig-capacitor") {
    build.player.maxCapAdd += Math.round(generationValue(generation, [6, 9, 12, 15]) * q);
    build.player.capRegenMul *= 1 + generationValue(generation, [0.02, 0.04, 0.06, 0.08]) * q;
    for (const ability of build.abilities) ability.costMul *= 1.03;
  }
  if (identity === "rig-thermal") {
    for (const stats of Object.values(build.weapon)) stats.heatDissipationMul *= 1 + generationValue(generation, [0.06, 0.09, 0.12, 0.15]) * q;
    build.player.maxCapAdd -= 4;
  }
  if (identity === "rig-pulse") {
    for (const ability of build.abilities) {
      ability.cooldownMul *= 1 - generationValue(generation, [0.02, 0.03, 0.04, 0.05]) * q;
      ability.costMul *= 1.03;
    }
  }
  if (identity === "implant-sensor") {
    build.abilities[1].powerMul *= 1 + generationValue(generation, [0.05, 0.075, 0.1, 0.125]) * q;
    build.abilities[1].cooldownMul *= 1.02;
  }
  if (identity === "implant-ballistic") {
    for (const stats of Object.values(build.weapon)) {
      stats.speedMul *= 1 + generationValue(generation, [0.015, 0.025, 0.035, 0.045]) * q;
      stats.penetrationAdd += Math.max(1, Math.round(generation * q));
    }
    for (const ability of build.abilities) ability.costMul *= 1.01;
  }
  if (identity === "implant-relay") {
    build.abilities[2].powerMul *= 1 + generationValue(generation, [0.04, 0.06, 0.08, 0.1]) * q;
    build.abilities[2].cooldownMul *= 1 - generationValue(generation, [0.015, 0.025, 0.035, 0.045]) * q;
    build.abilities[2].costMul *= 1.03;
  }
}
const augmentDefinitions = [
  { id: "countermass-coupler", name: "Countermass Coupler", hardware: "Weapon coupler", description: "-6% recoil on this weapon.", tradeoff: "-2% direct weapon output.", slots: ["carbine", "breacher", "rail"], cost: { credits: 70, alloys: 1, components: 1 } },
  { id: "ferrite-coupler", name: "Ferrite Bypass Coupler", hardware: "Weapon coupler", description: "+5 penetration on this weapon.", tradeoff: "+4% heat per shot.", slots: ["carbine", "breacher", "rail"], cost: { credits: 75, alloys: 1, electronics: 1 } },
  { id: "coolant-coupler", name: "Coolant Return Coupler", hardware: "Weapon coupler", description: "+8% heat dissipation.", tradeoff: "+3% reload time.", slots: ["carbine", "breacher", "rail"], cost: { credits: 70, electronics: 2 } },
  { id: "pressure-baffle-insert", name: "Pressure Baffle Insert", hardware: "Suit insert", description: "+6 armor reserve.", tradeoff: "-2% movement speed.", slots: ["suit"], cost: { credits: 65, alloys: 2 } },
  { id: "eva-flex-insert", name: "EVA Flex Insert", hardware: "Suit insert", description: "+3% movement speed.", tradeoff: "-4 armor reserve.", slots: ["suit"], cost: { credits: 65, alloys: 1, electronics: 1 } },
  { id: "servo-damper-insert", name: "Servo Damper Insert", hardware: "Suit insert", description: "Improves low-g control.", tradeoff: "-3 armor reserve.", slots: ["suit"], cost: { credits: 75, electronics: 2 } },
  { id: "cap-buffer-board", name: "Capacitor Buffer Board", hardware: "Rig daughterboard", description: "+8 capacitor reserve.", tradeoff: "-3% capacitor regeneration.", slots: ["rig"], cost: { credits: 80, electronics: 2, components: 1 } },
  { id: "thermal-shunt-board", name: "Thermal Shunt Board", hardware: "Rig daughterboard", description: "+7% weapon heat dissipation.", tradeoff: "+2% ability cooldown.", slots: ["rig"], cost: { credits: 80, electronics: 2 } },
  { id: "relay-daughterboard", name: "Relay Daughterboard", hardware: "Rig daughterboard", description: "-5% Arc Tap cooldown.", tradeoff: "-4 capacitor reserve.", slots: ["rig"], cost: { credits: 90, electronics: 2, components: 1 } },
  { id: "predictive-kernel", name: "Predictive Kernel", hardware: "Implant kernel", description: "+3% projectile velocity.", tradeoff: "+2% recoil.", slots: ["implant"], cost: { credits: 75, electronics: 2 } },
  { id: "shear-kernel", name: "Shear Analysis Kernel", hardware: "Implant kernel", description: "+8% Sensor Spike power.", tradeoff: "+5% Sensor Spike cooldown.", slots: ["implant"], cost: { credits: 80, electronics: 2, components: 1 } },
  { id: "signal-filter-kernel", name: "Signal Filter Kernel", hardware: "Implant kernel", description: "-4% ability cost.", tradeoff: "+2% ability cooldown.", slots: ["implant"], cost: { credits: 80, electronics: 2 } }
];
function augmentDefinition(id) {
  return augmentDefinitions.find((definition) => definition.id === id);
}
function normalizeAugments(slot, ids, limit) {
  const unique = /* @__PURE__ */ new Set();
  for (const id of ids) if (augmentDefinition(id).slots.includes(slot)) unique.add(id);
  return [...unique].slice(0, Math.max(0, limit));
}
function applyAugments(build, slot, ids) {
  const weapon = slot === "carbine" || slot === "breacher" || slot === "rail" ? build.weapon[slot] : null;
  for (const id of ids) {
    if (id === "countermass-coupler" && weapon) {
      weapon.recoilMul *= 0.94;
      weapon.damageMul *= 0.98;
    }
    if (id === "ferrite-coupler" && weapon) {
      weapon.penetrationAdd += 5;
      weapon.heatPerShotMul *= 1.04;
    }
    if (id === "coolant-coupler" && weapon) {
      weapon.heatDissipationMul *= 1.08;
      weapon.reloadMul *= 1.03;
    }
    if (id === "pressure-baffle-insert") {
      build.player.maxArmorAdd += 6;
      build.player.moveSpeedMul *= 0.98;
    }
    if (id === "eva-flex-insert") {
      build.player.moveSpeedMul *= 1.03;
      build.player.maxArmorAdd -= 4;
    }
    if (id === "servo-damper-insert") {
      build.player.lowGControl += 0.12;
      build.player.maxArmorAdd -= 3;
    }
    if (id === "cap-buffer-board") {
      build.player.maxCapAdd += 8;
      build.player.capRegenMul *= 0.97;
    }
    if (id === "thermal-shunt-board") {
      for (const stats of Object.values(build.weapon)) stats.heatDissipationMul *= 1.07;
      for (const ability of build.abilities) ability.cooldownMul *= 1.02;
    }
    if (id === "relay-daughterboard") {
      build.abilities[2].cooldownMul *= 0.95;
      build.player.maxCapAdd -= 4;
    }
    if (id === "predictive-kernel") {
      for (const stats of Object.values(build.weapon)) {
        stats.speedMul *= 1.03;
        stats.recoilMul *= 1.02;
      }
    }
    if (id === "shear-kernel") {
      build.abilities[1].powerMul *= 1.08;
      build.abilities[1].cooldownMul *= 1.05;
    }
    if (id === "signal-filter-kernel") {
      for (const ability of build.abilities) {
        ability.costMul *= 0.96;
        ability.cooldownMul *= 1.02;
      }
    }
  }
}
const STORAGE_KEY$1 = "ironshade-vector-profile-v3";
const starterItems = [
  { id: "starter-carbine", baseId: "m7-frame", name: "M-7 Service Frame", slot: "carbine", equipmentClass: "Coil carbine assembly", rarity: "Field", levelRequirement: 1, core: "Stable automatic coil assembly with neutral recoil and thermal behavior.", modifiers: [] },
  { id: "starter-breacher", baseId: "b4-frame", name: "B-4 Service Frame", slot: "breacher", equipmentClass: "Breach scattergun assembly", rarity: "Field", levelRequirement: 1, core: "Close-range scatter assembly tuned for predictable thrust and spread.", modifiers: [] },
  { id: "starter-rail", baseId: "r2-frame", name: "R-2 Service Rails", slot: "rail", equipmentClass: "Rail-lance assembly", rarity: "Field", levelRequirement: 1, core: "High-velocity rails with standard capacitor draw and penetration.", modifiers: [] },
  { id: "starter-suit", baseId: "utility-suit", name: "Dockworker Pressure Suit", slot: "suit", equipmentClass: "Combat pressure suit", rarity: "Field", levelRequirement: 1, core: "Balanced protection with ordinary maneuvering servos.", modifiers: [] },
  { id: "starter-rig", baseId: "utility-rig", name: "QS Utility Rig", slot: "rig", equipmentClass: "Power and thermal rig", rarity: "Field", levelRequirement: 1, core: "Standard capacitor bus and thermal routing.", modifiers: [] },
  { id: "starter-implant", baseId: "operator-link", name: "Operator Sensor Link", slot: "implant", equipmentClass: "Neural systems implant", rarity: "Field", levelRequirement: 1, core: "Basic targeting, telemetry, and electronic-control interface.", modifiers: [] }
];
const affixes = {
  hypervelocity: { id: "hypervelocity", label: "Hypervelocity rails", description: "+18% projectile velocity and +12 penetration, but +10% recoil.", mechanical: false },
  countermass: { id: "countermass", label: "Countermass buffer", description: "-22% recoil, but -7% direct weapon damage.", mechanical: false },
  overdrive: { id: "overdrive", label: "Open-coil overdrive", description: "+14% weapon damage, +20% recoil, and +12% heat per shot.", mechanical: false },
  cryoloop: { id: "cryoloop", label: "Cryogenic return loop", description: "+30% heat dissipation, but -8 penetration.", mechanical: false },
  extendedFeed: { id: "extendedFeed", label: "Extended feed geometry", description: "+6 magazine capacity, but +12% reload time.", mechanical: false },
  tungsten: { id: "tungsten", label: "Tungsten penetrator stack", description: "+30% armor damage and +14 penetration, but +8% heat per shot.", mechanical: false },
  vacuumSeal: { id: "vacuumSeal", label: "Layered vacuum seal", description: "Strongly reduces vacuum exposure damage and decompression pull.", mechanical: false },
  servoWeave: { id: "servoWeave", label: "Vector servo weave", description: "+8% movement speed and improved low-gravity braking.", mechanical: false },
  capacitorRecycler: { id: "capacitorRecycler", label: "Capacitor recycler", description: "+20% capacitor regeneration and -10% ability power cost.", mechanical: false },
  railFracture: { id: "railFracture", label: "Fracture cascade", description: "Rail rounds fragment after penetrating a target, creating two lower-energy follow-up vectors.", mechanical: true },
  dodgeVent: { id: "dodgeVent", label: "Kinetic heat shunt", description: "Every dodge vents a portion of the current weapon heat.", mechanical: true },
  magRedirect: { id: "magRedirect", label: "Revector field", description: "Magnetic Impulse captures nearby hostile projectiles and redirects them into the fight.", mechanical: true },
  breachPropulsion: { id: "breachPropulsion", label: "Backblast coupling", description: "Breacher recoil becomes a stronger mobility impulse below 0.15g.", mechanical: true },
  markShear: { id: "markShear", label: "Shear-map optics", description: "Marked targets expose weak armor paths, greatly increasing armor damage against them.", mechanical: true },
  arcDrone: { id: "arcDrone", label: "Relay microdrone", description: "A microdrone periodically attacks electronically disrupted targets.", mechanical: true }
};
function gradePercent(value) {
  return Math.max(1, Math.round(value));
}
function gradedDescription(id, grade) {
  const power = modifierPowerFactor(grade);
  const tradeoff = modifierTradeoffFactor(grade);
  if (id === "hypervelocity") return `+${gradePercent(18 * power)}% projectile velocity and +${gradePercent(12 * power)} penetration, but +${gradePercent(10 * tradeoff)}% recoil.`;
  if (id === "countermass") return `-${gradePercent(22 * power)}% recoil, but -${gradePercent(7 * tradeoff)}% direct weapon damage.`;
  if (id === "overdrive") return `+${gradePercent(14 * power)}% weapon damage, +${gradePercent(20 * tradeoff)}% recoil, and +${gradePercent(12 * tradeoff)}% heat per shot.`;
  if (id === "cryoloop") return `+${gradePercent(30 * power)}% heat dissipation, but -${gradePercent(8 * tradeoff)} penetration on weapon frames.`;
  if (id === "extendedFeed") return `+${Math.max(1, Math.round(6 * power))} magazine capacity, but +${gradePercent(12 * tradeoff)}% reload time.`;
  if (id === "tungsten") return `+${gradePercent(30 * power)}% armor damage and +${gradePercent(14 * power)} penetration, but +${gradePercent(8 * tradeoff)}% heat per shot.`;
  if (id === "vacuumSeal") return `+${gradePercent(55 * power)}% vacuum/decompression resistance before suit caps.`;
  if (id === "servoWeave") return `+${gradePercent(8 * power)}% movement speed and stronger low-gravity braking.`;
  if (id === "capacitorRecycler") return `+${gradePercent(20 * power)}% capacitor regeneration and -${gradePercent(10 * power)}% ability power cost.`;
  if (id === "railFracture") return `Rail rounds fragment after penetration; fragment energy retains ${gradePercent(35 * power)}% of the triggering round.`;
  if (id === "dodgeVent") return `Every dodge vents ${gradePercent(22 * power)}% of current weapon heat.`;
  if (id === "magRedirect") return `Magnetic Impulse redirects hostile projectiles; redirected kinetic payload scales to ${gradePercent(100 * power)}% of the standard return.`;
  if (id === "breachPropulsion") return `Below 0.15g, Breacher recoil becomes a ${(1 + 0.6 * power).toFixed(2)}x mobility impulse.`;
  if (id === "markShear") return `Marked targets expose weak armor paths; marked-hit amplification reaches ${gradePercent((0.18 + 0.16 * power) * 100)}%.`;
  return `A relay microdrone attacks disrupted targets for ${gradePercent(8 * power)} damage per cycle.`;
}
function materializeModifier(id, grade = 3) {
  const base = affixes[id];
  return { ...base, family: modifierFamilyFor(id), grade, description: gradedDescription(id, grade) };
}
const frameGenerationNames = {
  carbine: { 1: ["Dockline M-7 Spine", "Transit Burst Frame", "Service Coil Cage"], 2: ["M-8 Countermass Cage", "Transit M-8 Driver", "Dockline M-8 Spine"], 3: ["M-9 Hypervelocity Receiver", "Aster M-9 Coil Spine", "M-9 Command Cage"], 4: ["M-10 Vector Carbine Spine", "M-10 Dense-Flight Cage", "M-10 Recoil-Balanced Driver"], 5: ["M-11 Residual-Flight Spine", "M-11 Reference Driver", "M-11 Momentum Cage"], 6: ["M-12 Cross-System Spine", "M-12 Mature Reference Driver", "M-12 Open-Bus Cage"] },
  breacher: { 1: ["Kestrel Backblast Frame", "Breachline B-4 Cage", "Dockline Scatter Assembly"], 2: ["Kestrel B-5 Counterthrust", "B-5 Pressure Cage", "B-5 Dockbreaker Frame"], 3: ["Kestrel B-6 Redline Frame", "B-6 Dense Scatter Cage", "B-6 Vector Breacher"], 4: ["Kestrel B-7 Command Scatter", "B-7 Countermass Breacher", "B-7 Deep-Pressure Frame"], 5: ["Kestrel B-8 Pendulum Cage", "B-8 Reference Breacher", "B-8 Counter-Impulse Frame"], 6: ["Kestrel B-9 Crossfeed Cage", "B-9 Mature Breacher", "B-9 Open-Impulse Frame"] },
  rail: { 1: ["Helix Split-Rail", "Aster Penetrator Rails", "Needleline Accelerator"], 2: ["Helix R-3 Dense Rails", "R-3 Aster Accelerator", "R-3 Needleline Pair"], 3: ["Helix R-4 Hypervelocity Rails", "R-4 Survey Accelerator", "R-4 Longline Pair"], 4: ["Helix R-5 Reference Rails", "R-5 Null-Line Accelerator", "R-5 Vector Lance Rails"], 5: ["Helix R-6 Cryoline Rails", "R-6 Residual Accelerator", "R-6 Cold-Reference Pair"], 6: ["Helix R-7 Split-Reference Rails", "R-7 Mature Accelerator", "R-7 Cross-System Pair"] },
  suit: { 1: ["Kestrel Pressure Skin", "Transit EVA Harness", "Spinward Assault Suit"], 2: ["Mk II Pressure Harness", "Reinforced Transit EVA", "Spinward Mk II Suit"], 3: ["Mk III Vector Pressure Skin", "Deep-Vacuum Mk III Harness", "Mk III Assault Shell"], 4: ["Mk IV Recovery Pressure Skin", "Mk IV Vector EVA", "Mk IV Deep-Zone Shell"], 5: ["Mk V Residual Pressure Skin", "Mk V Umbra EVA", "Mk V Transfer Shell"], 6: ["Mk VI Cross-System Pressure Skin", "Mk VI Mature EVA", "Mk VI Open-Bus Shell"] },
  rig: { 1: ["Closed-Loop Thermal Rig", "Arc Capacitor Pack", "Vector Utility Bus"], 2: ["Series II Thermal Bus", "Series II Capacitor Rack", "Series II Vector Rig"], 3: ["Series III Closed-Loop Rig", "Series III Pulse Bus", "Series III Recovery Rack"], 4: ["Series IV Vector Bus", "Series IV Thermal Governor", "Series IV Deep-Load Rig"], 5: ["Series V Residual Bus", "Series V Boiloff Governor", "Series V Countermass Rig"], 6: ["Series VI Crossfeed Bus", "Series VI Mature Governor", "Series VI Open-Route Rig"] },
  implant: { 1: ["Shearline Sensor Link", "Relay Cognition Node", "Predictive Vector Implant"], 2: ["Gen II Shearline Link", "Gen II Relay Node", "Gen II Predictive Implant"], 3: ["Gen III Vector Cognition Node", "Gen III Shear-Mapping Link", "Gen III Relay Implant"], 4: ["Gen IV Reference Cognition Node", "Gen IV Distributed Link", "Gen IV Predictive Kernel"], 5: ["Gen V Residual Cognition Node", "Gen V Mass-Return Link", "Gen V Cold-Route Kernel"], 6: ["Gen VI Cross-System Node", "Gen VI Mature Relay Link", "Gen VI Open-Reference Kernel"] }
};
function frameImplicitFor(slot, generation, identity, quality = 0) {
  const resolved = identity ?? inferFrameIdentity(slot, `${slot}:${generation}`);
  return frameImplicitDescription(resolved, generation, quality);
}
const baseNames = {
  carbine: { baseId: "m7-frame", equipmentClass: "Coil carbine assembly", names: ["Dockline M-7 Spine", "Transit Burst Frame", "Service Coil Cage"], core: "Automatic coil assembly; alters the existing M-7 physical model.", affixes: ["hypervelocity", "countermass", "overdrive", "cryoloop", "extendedFeed", "tungsten", "magRedirect"] },
  breacher: { baseId: "b4-frame", equipmentClass: "Breach scattergun assembly", names: ["Kestrel Backblast Frame", "Breachline B-4 Cage", "Dockline Scatter Assembly"], core: "Close-range pressure weapon; trades stopping power, recoil, and heat.", affixes: ["overdrive", "countermass", "cryoloop", "extendedFeed", "tungsten", "breachPropulsion", "dodgeVent"] },
  rail: { baseId: "r2-frame", equipmentClass: "Rail-lance assembly", names: ["Helix Split-Rail", "Aster Penetrator Rails", "Needleline Accelerator"], core: "Precision electromagnetic assembly; emphasizes penetration, capacitor demand, and recoil.", affixes: ["hypervelocity", "countermass", "overdrive", "cryoloop", "tungsten", "railFracture", "markShear"] },
  suit: { baseId: "pressure-suit", equipmentClass: "Combat pressure suit", names: ["Kestrel Pressure Skin", "Transit EVA Harness", "Spinward Assault Suit"], core: "Layered protection and maneuvering package.", affixes: ["vacuumSeal", "servoWeave", "dodgeVent", "capacitorRecycler"] },
  rig: { baseId: "power-rig", equipmentClass: "Power and thermal rig", names: ["Closed-Loop Thermal Rig", "Arc Capacitor Pack", "Vector Utility Bus"], core: "Routes heat, capacitor charge, and ability power.", affixes: ["cryoloop", "capacitorRecycler", "dodgeVent", "magRedirect", "arcDrone"] },
  implant: { baseId: "sensor-implant", equipmentClass: "Neural systems implant", names: ["Shearline Sensor Link", "Relay Cognition Node", "Predictive Vector Implant"], core: "Targeting and electronic-warfare augmentation.", affixes: ["markShear", "arcDrone", "magRedirect", "capacitorRecycler", "servoWeave"] }
};
const singular = (template) => template;
const bossSingularPools = {
  "Recovery Commander Sable Voss": [
    singular({ baseId: "voss-palisade-m7", name: "Palisade Doctrine M-7", slot: "carbine", equipmentClass: "Meridian command carbine assembly", rarity: "Singular", core: "A pressure-rated command frame built around sustained armor work and controlled recoil behind portable cover.", modifiers: [{ ...affixes.tungsten }, { ...affixes.countermass }, { ...affixes.extendedFeed }], singularTrait: "palisadeDoctrine", singularEffect: "Stationary carbine fire rebuilds small amounts of armor, rewarding deliberate firing positions." }),
    singular({ baseId: "voss-pressure-mantle", name: "Compact Pressure Mantle", slot: "suit", equipmentClass: "Meridian recovery pressure suit", rarity: "Singular", core: "Layered Compact recovery armor designed to stay mobile while pressure lanes and barricades change around the operator.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: "pressureMantle", singularEffect: "Cycling pressure controls or sealing a rupture restores armor and clears vacuum exposure." }),
    singular({ baseId: "voss-lockstep-rig", name: "Lockstep Command Rig", slot: "rig", equipmentClass: "Meridian pressure-control rig", rarity: "Singular", core: "A command bus that couples thermal control, capacitor recovery, and magnetic interception.", modifiers: [{ ...affixes.magRedirect }, { ...affixes.cryoloop }, { ...affixes.capacitorRecycler }], singularTrait: "lockstepArc", singularEffect: "Arc Tap through machinery restores armor and capacitor while propagating disruption." })
  ],
  "Salvage Captain Rhea Kade": [
    singular({ baseId: "rhea-backblast-b4", name: "Rhea's Backblast Kestrel", slot: "breacher", equipmentClass: "Long Arc recoil-mobility scatter assembly", rarity: "Singular", core: "A field-cut Kestrel frame that treats every discharge as both a weapon event and a movement decision.", modifiers: [{ ...affixes.breachPropulsion }, { ...affixes.countermass }, { ...affixes.dodgeVent }], singularTrait: "rheaBackblast", singularEffect: "Breacher shots produce extreme controlled backblast and accelerate the next dodge cycle." }),
    singular({ baseId: "rhea-tether-link", name: "Tetherhand Sensor Link", slot: "implant", equipmentClass: "Long Arc magnetic-rigging implant", rarity: "Singular", core: "Predictive rigging telemetry built to read movement, magnetic vectors, and exposed armor paths as one problem.", modifiers: [{ ...affixes.magRedirect }, { ...affixes.servoWeave }, { ...affixes.markShear }], singularTrait: "tetherhand", singularEffect: "Sensor Spike leaves a short magnetic tether well on the marked target." }),
    singular({ baseId: "rhea-scrapline-suit", name: "Scrapline Countermass Suit", slot: "suit", equipmentClass: "Long Arc salvage pressure suit", rarity: "Singular", core: "A patched maneuvering shell with exceptional low-g recovery and emergency heat shedding.", modifiers: [{ ...affixes.servoWeave }, { ...affixes.dodgeVent }, { ...affixes.vacuumSeal }], singularTrait: "scraplineDodge", singularEffect: "Dodges below 0.35g travel farther and recover faster, turning low gravity into an offensive resource." })
  ],
  "HELIOS-9 Yardmind": [
    singular({ baseId: "helios-thermal-governor", name: "HELIOS-9 Thermal Governor", slot: "rig", equipmentClass: "Autonomous fabrication thermal rig", rarity: "Singular", core: "Recovered process-control hardware that treats operator heat, capacitor load, and relay drones as one thermal network.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "thermalGovernor", singularEffect: "Manual venting dumps heat from every weapon and advances all ability cooldowns." }),
    singular({ baseId: "helios-machine-sight", name: "Machine-Sight Cognition Node", slot: "implant", equipmentClass: "Industrial control cognition implant", rarity: "Singular", core: "A legal-safe reconstruction of the Yardmind targeting layer, retaining its machine-to-machine disruption logic.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.markShear }, { ...affixes.magRedirect }], singularTrait: "machineSight", singularEffect: "Arc Tap through machinery seeks an additional disrupted target beyond the normal propagation radius." }),
    singular({ baseId: "helios-fracture-rails", name: "Sunward Fracture Rails", slot: "rail", equipmentClass: "Solar-yard precision rail assembly", rarity: "Singular", core: "Fabrication rails tuned for extreme projectile velocity, thermal recovery, and controlled post-penetration fragmentation.", modifiers: [{ ...affixes.railFracture }, { ...affixes.hypervelocity }, { ...affixes.cryoloop }], singularTrait: "sunwardFracture", singularEffect: "High-heat Rail Lance shots split into two narrow secondary vectors at the muzzle." })
  ],
  "Transfer Adjudicator Iona Vale": [
    singular({ baseId: "vale-vector-spool-m11", name: "Vale Vector-Spool M-11", slot: "carbine", equipmentClass: "Transfer-lane strafe carbine assembly", rarity: "Singular", core: "An adjudicator receiver that stabilizes only when the operator carries a lateral movement vector across the firing solution.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.servoWeave }], singularTrait: "inertiaSpool", singularEffect: "While moving fast across the aim line, carbine fire gains damage and velocity while shedding most recoil." }),
    singular({ baseId: "vale-clutchstep-harness", name: "Clutchstep Countermass Harness", slot: "suit", equipmentClass: "Field-consuming countermass maneuvering suit", rarity: "Singular", core: "A clutch-timed harness built to collapse a nearby mass field during a committed dodge and bank the recovered impulse.", modifiers: [{ ...affixes.countermass }, { ...affixes.dodgeVent }, { ...affixes.capacitorRecycler }], singularTrait: "clutchstep", singularEffect: "Dodging near a gravity or countermass field consumes it, restores capacitor, and shortens dodge recovery." }),
    singular({ baseId: "vale-flywheel-ledger-rig", name: "Flywheel Ledger Rig", slot: "rig", equipmentClass: "Rail recoil accounting rig", rarity: "Singular", core: "A transfer-control bus that books rail discharge impulse back into the capacitor ledger instead of cancelling it.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.overdrive }, { ...affixes.magRedirect }], singularTrait: "recoilLedger", singularEffect: "Rail shots refund capacitor but produce substantially more recoil, turning every lance into a movement commitment." })
  ],
  "Umbra Systems Marshal Oren Saal": [
    singular({ baseId: "saal-cold-start-kestrel", name: "Umbra Cold-Start Kestrel", slot: "breacher", equipmentClass: "Cold-bus cryogenic scattergun", rarity: "Singular", core: "A reserve-yard breach frame tuned around the first discharge after a full thermal reset.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.tungsten }, { ...affixes.breachPropulsion }], singularTrait: "coldStartBreach", singularEffect: "A Breacher shot from a cold bus gains damage, penetration, and velocity but adds extra heat." }),
    singular({ baseId: "saal-purgewake-rig", name: "Purgewake Thermal Rig", slot: "rig", equipmentClass: "Low-pressure vent-thrust systems rig", rarity: "Singular", core: "A vent manifold that deliberately turns low-pressure thermal rejection into a short physical thrust plume.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.dodgeVent }, { ...affixes.servoWeave }], singularTrait: "purgeWake", singularEffect: "Manual venting below 45% pressure emits a player-owned coolant thrust plume that pushes and staggers enemies." }),
    singular({ baseId: "saal-grid-reclaimer-link", name: "Saal Grid-Reclaimer Link", slot: "implant", equipmentClass: "Electrical rerouting cognition implant", rarity: "Singular", core: "A systems-marshal link that recognizes hostile floor grids as recoverable bus topology.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.markShear }], singularTrait: "gridReclaimer", singularEffect: "Arc Tap through machinery can collapse a nearby hostile shock grid, restoring capacitor and cooling the active weapon." })
  ],
  "Custody Director Mara Teth": [
    singular({ baseId: "teth-custody-shear-optics", name: "Custody Shear Optics", slot: "implant", equipmentClass: "Mission-custody targeting implant", rarity: "Singular", core: "A custody-control prediction layer designed to separate an operator from hardware being physically removed from the worksite.", modifiers: [{ ...affixes.markShear }, { ...affixes.magRedirect }, { ...affixes.capacitorRecycler }], singularTrait: "custodyShear", singularEffect: "Sensor Spike forces a marked objective carrier to drop mission hardware immediately and can strip nearby hostile support relays." }),
    singular({ baseId: "teth-shutterline-r6", name: "Shutterline R-6", slot: "rail", equipmentClass: "Partition-coupled precision rail assembly", rarity: "Singular", core: "A custody-lane accelerator that uses destructible partition material as an intermediate magnetic reference rather than an obstruction.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.railFracture }, { ...affixes.tungsten }], singularTrait: "shutterLine", singularEffect: "Rail rounds punch through destructible non-bulkhead cover without their normal damage loss and gain penetration and velocity." }),
    singular({ baseId: "teth-archive-relay-dynamo", name: "Archive Relay Dynamo", slot: "rig", equipmentClass: "Destruction-triggered custody relay rig", rarity: "Singular", core: "A recovered archive bus that converts the electrical collapse of battlefield hardware into an offensive disruption pulse.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.overdrive }], singularTrait: "archiveRelay", singularEffect: "Destroying cover or machinery emits an Arc pulse that disrupts and conducts nearby enemies." })
  ],
  "Survey Custodian Veyra Senn": [
    singular({ baseId: "khepri-null-rails", name: "Khepri Null-Reference Rails", slot: "rail", equipmentClass: "Survey metrology rail assembly", rarity: "Singular", core: "A Khepri reference-frame accelerator rebuilt around interruption timing and straight-line metrology.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.markShear }], singularTrait: "nullpoint", singularEffect: "Rail hits during an enemy telegraph cancel that attack and refund capacitor." }),
    singular({ baseId: "khepri-vector-harness", name: "Khepri Calibration Harness", slot: "suit", equipmentClass: "Survey calibration maneuvering suit", rarity: "Singular", core: "A low-mass survey harness designed to recapture movement energy during repeated reference passes.", modifiers: [{ ...affixes.servoWeave }, { ...affixes.countermass }, { ...affixes.capacitorRecycler }], singularTrait: "atlasDodgeCap", singularEffect: "Dodging converts pre-dodge movement speed into capacitor charge." }),
    singular({ baseId: "khepri-surveyor-node", name: "Surveyor Relay Cognition Node", slot: "implant", equipmentClass: "Khepri distributed metrology implant", rarity: "Singular", core: "A survey-network cognition layer that treats exposed machinery as part of a distributed targeting reference.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "relayCrown", singularEffect: "Sensor Spike jumps through nearby exposed machinery to additional enemies around that machine." })
  ]
};
const chaseCatalog = [
  singular({ baseId: "vacuum-choir-rails", name: "Vacuum Choir Rails", slot: "rail", equipmentClass: "Pressure-shear rail assembly", rarity: "Singular", core: "A rail package built around controlled transient pressure collapse along the firing vector.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.vacuumSeal }, { ...affixes.railFracture }], singularTrait: "vacuumWake", singularEffect: "Rail shots create a temporary low-pressure wake that pulls, staggers, and abrades nearby enemies." }),
  singular({ baseId: "atlas-countermass-harness", name: "Atlas Countermass Harness", slot: "suit", equipmentClass: "Momentum-recovery maneuvering harness", rarity: "Singular", core: "A heavy maneuvering lattice that recaptures operator momentum instead of merely cancelling it.", modifiers: [{ ...affixes.countermass }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: "atlasDodgeCap", singularEffect: "Dodging converts pre-dodge movement speed into capacitor charge." }),
  singular({ baseId: "redline-kestrel", name: "Redline Kestrel", slot: "breacher", equipmentClass: "Velocity-coupled breach scattergun", rarity: "Singular", core: "A dangerous Kestrel tune that assumes the operator is already moving when the trigger breaks.", modifiers: [{ ...affixes.overdrive }, { ...affixes.breachPropulsion }, { ...affixes.dodgeVent }], singularTrait: "redlineVelocity", singularEffect: "Breacher pellet damage scales with current operator velocity at the instant of firing." }),
  singular({ baseId: "long-arc-relay-crown", name: "Long Arc Relay Crown", slot: "implant", equipmentClass: "Distributed salvage-network implant", rarity: "Singular", core: "An improvised cognition crown that treats damaged machinery as an extension of the targeting network.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "relayCrown", singularEffect: "Sensor Spike jumps through nearby exposed machinery to additional enemies around that machine." }),
  singular({ baseId: "arcspindle-m7", name: "Arcspindle M-7", slot: "carbine", equipmentClass: "Conductive-feedback coil carbine", rarity: "Singular", core: "A carbine bus that harvests charge from already-disrupted targets.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.magRedirect }, { ...affixes.capacitorRecycler }], singularTrait: "arcspindle", singularEffect: "Carbine hits against disrupted or conductive enemies return capacitor charge." }),
  singular({ baseId: "ghostline-m7", name: "Ghostline M-7", slot: "carbine", equipmentClass: "Vacuum-optimized coil carbine", rarity: "Singular", core: "A low-pressure frame whose projectile timing assumes almost no atmospheric drag or operator footing.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.countermass }, { ...affixes.vacuumSeal }], singularTrait: "ghostline", singularEffect: "Below 35% pressure, carbine rounds gain major velocity and penetration while recoil collapses." }),
  singular({ baseId: "borecutter-m7", name: "Borecutter M-7", slot: "carbine", equipmentClass: "Industrial breaching coil carbine", rarity: "Singular", core: "A repurposed mining driver designed to turn cover and exposed machine housings into ammunition problems.", modifiers: [{ ...affixes.tungsten }, { ...affixes.extendedFeed }, { ...affixes.markShear }], singularTrait: "borecutter", singularEffect: "Player fire deals greatly increased damage to destructible cover and machinery." }),
  singular({ baseId: "stormline-ventgun", name: "Stormline Ventgun", slot: "breacher", equipmentClass: "Pressure-gradient scattergun", rarity: "Singular", core: "A gas-harvester weapon that deliberately couples muzzle impulse to nearby pressure gradients.", modifiers: [{ ...affixes.breachPropulsion }, { ...affixes.vacuumSeal }, { ...affixes.cryoloop }], singularTrait: "stormVentgun", singularEffect: "Breacher fire near an active breach gains damage and knockback while shedding some heat." }),
  singular({ baseId: "nullpoint-needle", name: "Nullpoint Needle", slot: "rail", equipmentClass: "Telegraph-interrupt precision rail", rarity: "Singular", core: "A timing-critical accelerator tuned to break hostile firing solutions during the commitment window.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.markShear }, { ...affixes.countermass }], singularTrait: "nullpoint", singularEffect: "Rail hits during an enemy telegraph cancel that attack and refund capacitor." }),
  singular({ baseId: "glasswalker-eva", name: "Glasswalker EVA Skin", slot: "suit", equipmentClass: "Hard-vacuum mobility suit", rarity: "Singular", core: "An EVA shell that stops pretending vacuum should feel like a pressurized deck.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.countermass }], singularTrait: "glasswalker", singularEffect: "In near-vacuum, acceleration and maximum movement speed increase instead of collapsing into cautious footing." }),
  singular({ baseId: "cryostack-burn-rig", name: "Cryostack Burn Rig", slot: "rig", equipmentClass: "Overheat-conversion systems rig", rarity: "Singular", core: "A thermal stack that converts deliberate redline operation into short control-system windows.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.overdrive }, { ...affixes.capacitorRecycler }], singularTrait: "cryostack", singularEffect: "Crossing into weapon overheat advances all ability cooldowns, rewarding deliberate redline bursts." }),
  singular({ baseId: "salvage-dynamo-rig", name: "Salvage Dynamo Rig", slot: "rig", equipmentClass: "Destruction-recovery field rig", rarity: "Singular", core: "Long Arc salvage hardware that treats collapsing battlefield machinery as an energy source.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.arcDrone }, { ...affixes.dodgeVent }], singularTrait: "salvageDynamo", singularEffect: "Destroying destructible cover or machinery restores capacitor and cools the current weapon." }),
  singular({ baseId: "deadreckon-optics", name: "Deadreckon Optics", slot: "implant", equipmentClass: "Kill-confirmation targeting implant", rarity: "Singular", core: "A predictive targeting layer that treats a completed marked kill as the start of the next firing solution.", modifiers: [{ ...affixes.markShear }, { ...affixes.hypervelocity }, { ...affixes.capacitorRecycler }], singularTrait: "deadreckon", singularEffect: "Killing a marked enemy nearly resets Sensor Spike." }),
  singular({ baseId: "jovian-stormskin", name: "Jovian Stormskin", slot: "suit", equipmentClass: "Electrostatic harvester pressure suit", rarity: "Singular", core: "A conductive storm-deck skin that routes electrical hazard load into the operator bus.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.capacitorRecycler }, { ...affixes.servoWeave }], singularTrait: "stormskin", singularEffect: "Shock-grid damage is heavily reduced and partially converted into capacitor charge." }),
  singular({ baseId: "axis-ghost-rig", name: "Axis Ghost Rig", slot: "rig", equipmentClass: "Near-zero-g impulse rig", rarity: "Singular", core: "Spin-habitat maneuvering hardware designed for the almost weightless axis rather than the inhabited rim.", modifiers: [{ ...affixes.dodgeVent }, { ...affixes.magRedirect }, { ...affixes.servoWeave }], singularTrait: "axisGhost", singularEffect: "Dodging below 0.12g emits a radial impulse that throws nearby enemies away." }),
  singular({ baseId: "pendulum-kestrel", name: "Pendulum Kestrel", slot: "breacher", equipmentClass: "Counter-impulse breach scattergun", rarity: "Singular", core: "A transfer-lane Kestrel calibrated to spend an incoming movement vector instead of adding another one.", modifiers: [{ ...affixes.countermass }, { ...affixes.breachPropulsion }, { ...affixes.capacitorRecycler }], singularTrait: "pendulumBreach", singularEffect: "Firing the Breacher against your current direction of travel brakes momentum, amplifies the shot, and returns capacitor charge." }),
  singular({ baseId: "mass-return-crown", name: "Mass-Return Crown", slot: "implant", equipmentClass: "Countermass field cognition implant", rarity: "Singular", core: "An exchange-control cognition layer that can identify a local gravity or countermass field as recoverable bus energy.", modifiers: [{ ...affixes.magRedirect }, { ...affixes.capacitorRecycler }, { ...affixes.servoWeave }], singularTrait: "massTap", singularEffect: "Magnetic Impulse consumes one nearby gravity/countermass field and converts it into capacitor charge." }),
  singular({ baseId: "umbra-heatsink-rig", name: "Umbra Heat-Sink Rig", slot: "rig", equipmentClass: "Cryogenic purge recovery rig", rarity: "Singular", core: "A reserve-yard thermal bus that treats cryogenic purge exposure as useful sink capacity instead of pure hazard.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.capacitorRecycler }, { ...affixes.dodgeVent }], singularTrait: "boiloffSink", singularEffect: "Coolant and boiloff plumes cool all weapons and convert the normal boiloff capacitor loss into charge." }),
  singular({ baseId: "cryoline-reference-rails", name: "Cryoline Reference Rails", slot: "rail", equipmentClass: "Cold-start precision rail assembly", rarity: "Singular", core: "A metrology accelerator built around the first cold shot after a thermal reset rather than sustained redline operation.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.hypervelocity }, { ...affixes.markShear }], singularTrait: "cryolineRail", singularEffect: "Rail shots fired from a cold weapon bus gain major damage and penetration, rewarding deliberate thermal resets." }),
  singular({ baseId: "breathless-choir-mantle", name: "Breathless Choir Mantle", slot: "suit", equipmentClass: "Vacuum-pulse maneuvering pressure suit", rarity: "Singular", core: "A damaged-vessel EVA shell that deliberately spends bus charge to leave a controllable pressure discontinuity behind a dodge.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.capacitorRecycler }], singularTrait: "pressureReservoir", singularEffect: "Dodging below 35% pressure spends 8 capacitor to leave a short player-owned low-pressure wake; no charge means no wake." }),
  singular({ baseId: "vector-debt-m12", name: "Vector Debt M-12", slot: "carbine", equipmentClass: "Recoil-accounting coil carbine", rarity: "Singular", core: "A transfer-exchange receiver that deliberately refuses to cancel all recoil because the operator bus can collect part of the impulse debt.", modifiers: [{ ...affixes.countermass }, { ...affixes.capacitorRecycler }, { ...affixes.hypervelocity }], singularTrait: "recoilDynamo", singularEffect: "Carbine recoil is amplified but converted into a capped capacitor return on each shot; it never stacks additively with other recoil refunds." }),
  singular({ baseId: "relay-orchard-node", name: "Relay Orchard Node", slot: "implant", equipmentClass: "Machine-network propagation implant", rarity: "Singular", core: "A solar-yard routing layer that treats exposed machinery as a temporary orchard of targeting relays rather than a single conduit.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.markShear }, { ...affixes.capacitorRecycler }], singularTrait: "relayOrchard", singularEffect: "Arc Tap through machinery marks up to two nearby enemies and trims Sensor Spike recovery." }),
  singular({ baseId: "cold-witness-r7", name: "Cold Witness R-7", slot: "rail", equipmentClass: "Mark-consuming survey rail assembly", rarity: "Singular", core: "A lattice-annex accelerator built to spend a verified Sensor Spike solution on one decisive follow-up rather than keep the target painted.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.markShear }, { ...affixes.cryoloop }], singularTrait: "coldWitness", singularEffect: "A Rail hit consumes an active mark, cools the rail bus, and leaves a short Armor Breach window." }),
  singular({ baseId: "radiant-liability-kestrel", name: "Radiant Liability Kestrel", slot: "breacher", equipmentClass: "Defensive redline scatter assembly", rarity: "Singular", core: "A solar-yard Kestrel that routes the thermal liability of near-overheat firing into suit plate servos instead of treating redline as a pure failure state.", modifiers: [{ ...affixes.overdrive }, { ...affixes.cryoloop }, { ...affixes.tungsten }], singularTrait: "redlineBulwark", singularEffect: "Breacher hits above 75% heat rebuild small amounts of armor, but each redline shot adds extra heat." }),
  singular({ baseId: "palisade-breaker-b9", name: "Palisade Breaker B-9", slot: "breacher", equipmentClass: "Close armor-demolition scatter assembly", rarity: "Singular", core: "An orbital boarding cage designed to turn point-blank plate failure into space control instead of chasing raw health damage.", modifiers: [{ ...affixes.tungsten }, { ...affixes.countermass }, { ...affixes.extendedFeed }], singularTrait: "closeBreach", singularEffect: "Inside 300 units, Breacher pellets gain a capped armor-damage conversion but lose direct-health efficiency." }),
  singular({ baseId: "capacitor-rosary-rig", name: "Capacitor Rosary Rig", slot: "rig", equipmentClass: "Ability-sequence power bus", rarity: "Singular", core: "An Umbra service rig whose switching relays are arranged around deliberate MAG/MARK/ARC sequencing rather than one favored ability.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.cryoloop }, { ...affixes.arcDrone }], singularTrait: "abilityRosary", singularEffect: "Using a different ability within the combo window cools the active weapon and trims the previous ability recovery." }),
  singular({ baseId: "vacuum-psalm-m12", name: "Vacuum Psalm M-12", slot: "carbine", equipmentClass: "Pressure-dependent coil carbine", rarity: "Singular", core: "A gas-harvester receiver whose flight timing is tuned for thin atmosphere and deliberately feels sluggish on a fully pressurized deck.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.vacuumSeal }, { ...affixes.countermass }], singularTrait: "pressureBallistics", singularEffect: "Below 45% pressure, carbine rounds gain velocity and penetration; above 75% pressure, projectile velocity is reduced." }),
  singular({ baseId: "falling-star-harness", name: "Falling Star Harness", slot: "suit", equipmentClass: "Momentum-to-targeting maneuvering suit", rarity: "Singular", core: "A spin-habitat harness that turns a committed approach vector into a targeting handoff as the operator exits the dodge.", modifiers: [{ ...affixes.servoWeave }, { ...affixes.countermass }, { ...affixes.markShear }], singularTrait: "momentumMark", singularEffect: "Dodging with high pre-dodge speed spends 6 capacitor to mark the nearest visible enemy." }),
  singular({ baseId: "scrap-circuit-rig", name: "Scrap Circuit Rig", slot: "rig", equipmentClass: "Destruction-to-Arc recovery bus", rarity: "Singular", core: "An ice-mine field bus that uses the electrical collapse of machinery to precharge Arc Tap instead of harvesting the wreck for raw damage.", modifiers: [{ ...affixes.arcDrone }, { ...affixes.capacitorRecycler }, { ...affixes.dodgeVent }], singularTrait: "scrapCircuit", singularEffect: "Destroying machinery spends 4 capacitor to advance Arc Tap recovery by 0.9 seconds." }),
  singular({ baseId: "eventide-eva-skin", name: "Eventide EVA Skin", slot: "suit", equipmentClass: "Cryogenic-plume maneuvering suit", rarity: "Singular", core: "An Umbra EVA skin built to cross service-purge geometry by consuming it as a one-shot maneuvering resource.", modifiers: [{ ...affixes.vacuumSeal }, { ...affixes.servoWeave }, { ...affixes.dodgeVent }], singularTrait: "boiloffDash", singularEffect: "Dodging through a nearby coolant or boiloff plume spends 8 capacitor, consumes one plume, extends the dash, and cools all weapons." }),
  singular({ baseId: "khepri-split-reference-link", name: "Khepri Split-Reference Link", slot: "implant", equipmentClass: "Marked-machine Arc cognition implant", rarity: "Singular", core: "A Khepri reconstruction that spends a mark as permission to use nearby machinery as a second electrical origin.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.magRedirect }], singularTrait: "splitReference", singularEffect: "Arc Tap on a marked target consumes the mark and can relay through nearby machinery into a second enemy." }),
  singular({ baseId: "sixth-vector-m12", name: "Sixth-Vector M-12", slot: "carbine", equipmentClass: "Cadence-fork coil carbine", rarity: "Singular", core: "A counter-rotating feed cage stores a firing solution for exactly five ordinary pulses before opening two side vectors on the sixth.", modifiers: [{ ...affixes.hypervelocity }, { ...affixes.extendedFeed }, { ...affixes.overdrive }], singularTrait: "forkedSpool", singularEffect: "Every sixth Carbine shot forks two 55% side vectors. The forked shot adds extra heat, rewarding deliberate cadence rather than permanent free damage." }),
  singular({ baseId: "backstep-kestrel-b9", name: "Backstep Kestrel B-9", slot: "breacher", equipmentClass: "Counterstep breach scattergun", rarity: "Singular", core: "A recoil latch reads suit-thruster transients and briefly opens a second scatter gate after a committed evasive burn.", modifiers: [{ ...affixes.countermass }, { ...affixes.breachPropulsion }, { ...affixes.dodgeVent }], singularTrait: "breachEcho", singularEffect: "A Breacher shot within 0.65s of a dodge gains a three-pellet 55% echo cone, but the echoed shot adds extra heat." }),
  singular({ baseId: "cold-doublet-r7", name: "Cold Doublet R-7", slot: "rail", equipmentClass: "Cold-start paired rail lance", rarity: "Singular", core: "Two unequal accelerator rails share a cryogenic bus: the secondary rail is stable only before the primary assembly warms.", modifiers: [{ ...affixes.cryoloop }, { ...affixes.tungsten }, { ...affixes.countermass }], singularTrait: "railDoublet", singularEffect: "Below 22% Rail heat and with 8 spare capacitor, each Rail shot launches a second 58% penetrator. The doublet consumes the extra capacitor and adds heat." }),
  singular({ baseId: "bloom-vector-rig", name: "Bloom Vector Rig", slot: "rig", equipmentClass: "Radial impulse recovery rig", rarity: "Singular", core: "A ring of sacrificial micro-coils turns the MAG field collapse into a brief omnidirectional kinetic bloom.", modifiers: [{ ...affixes.capacitorRecycler }, { ...affixes.magRedirect }, { ...affixes.servoWeave }], singularTrait: "magBloom", singularEffect: "MAG fires eight radial kinetic micro-slugs after the impulse. Magnetic Impulse costs 25% more capacitor and recovers 8% slower." }),
  singular({ baseId: "cascade-sight-link", name: "Cascade Sight Link", slot: "implant", equipmentClass: "Kill-relay sensor cognition link", rarity: "Singular", core: "A narrowband target model refuses to hold one solution for long, but transfers the dying target state into the nearest live return.", modifiers: [{ ...affixes.markShear }, { ...affixes.arcDrone }, { ...affixes.capacitorRecycler }], singularTrait: "markCascade", singularEffect: "Killing a marked target relays a 4.2s mark to a nearby enemy. Initial Sensor Spike marks are shorter and Sensor Spike recovers 12% slower." })
];
const locationChaseIds = {
  "orbital-station": ["arcspindle-m7", "deadreckon-optics", "palisade-breaker-b9", "sixth-vector-m12", "cascade-sight-link"],
  "damaged-vessel": ["vacuum-choir-rails", "glasswalker-eva", "salvage-dynamo-rig", "breathless-choir-mantle", "backstep-kestrel-b9"],
  "asteroid-refinery": ["borecutter-m7", "cryostack-burn-rig", "nullpoint-needle", "cold-doublet-r7"],
  "spin-habitat": ["atlas-countermass-harness", "axis-ghost-rig", "ghostline-m7", "falling-star-harness", "bloom-vector-rig"],
  "jovian-harvester": ["stormline-ventgun", "jovian-stormskin", "vacuum-choir-rails", "vacuum-psalm-m12", "sixth-vector-m12"],
  "ice-mine": ["redline-kestrel", "long-arc-relay-crown", "salvage-dynamo-rig", "scrap-circuit-rig", "backstep-kestrel-b9"],
  "solar-yard": ["nullpoint-needle", "arcspindle-m7", "cryostack-burn-rig", "relay-orchard-node", "radiant-liability-kestrel", "bloom-vector-rig"],
  "lattice-annex": ["nullpoint-needle", "deadreckon-optics", "vacuum-choir-rails", "cold-witness-r7", "khepri-split-reference-link", "cascade-sight-link"],
  "momentum-exchange": ["pendulum-kestrel", "mass-return-crown", "vector-debt-m12", "sixth-vector-m12"],
  "cryo-reserve": ["umbra-heatsink-rig", "cryoline-reference-rails", "capacitor-rosary-rig", "eventide-eva-skin", "cold-doublet-r7"]
};
function inferFactionFromBaseId(baseId) {
  if (baseId.startsWith("voss-")) return "meridian";
  if (baseId.startsWith("rhea-") || baseId === "long-arc-relay-crown" || baseId === "salvage-dynamo-rig") return "longarc";
  if (baseId.startsWith("helios-")) return "heliostat";
  return void 0;
}
function makeSingularItem(template, prefix, index, level, random, recoveryLevel, recoveryQuality, recoverySource, frameOperatorLevel = level) {
  const frameGeneration = frameGenerationForRecovery(recoveryLevel, frameOperatorLevel);
  const frameIdentity = singularFrameIdentity(template.slot, template.baseId);
  const equipmentQuality = Math.max(4, equipmentQualityForRecovery(recoveryQuality, frameGeneration, "Singular"));
  const augmentSlots = augmentSlotCount("Singular", frameGeneration);
  return {
    ...template,
    id: `${prefix}-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`,
    levelRequirement: levelRequirementForRecovery(recoveryLevel),
    modifiers: template.modifiers.map((modifier) => materializeModifier(modifier.id, modifier.grade ?? 3)),
    faction: template.faction ?? inferFactionFromBaseId(template.baseId),
    recoveryLevel,
    frameGeneration,
    frameIdentity,
    frameImplicit: frameImplicitFor(template.slot, frameGeneration, frameIdentity, equipmentQuality),
    equipmentQuality,
    augmentSlots,
    augments: [],
    recoveryQuality,
    recoverySource
  };
}
function makeBossSingular(deepTarget, index, level, random, recoveryLevel, recoveryQuality, recoverySource, frameOperatorLevel = level) {
  const pool = bossSingularPools[deepTarget];
  if (!(pool == null ? void 0 : pool.length)) return null;
  return makeSingularItem(pool[Math.floor(random() * pool.length)], "boss", index, level, random, recoveryLevel, recoveryQuality, recoverySource, frameOperatorLevel);
}
const level15ChaseIds = /* @__PURE__ */ new Set(["breathless-choir-mantle", "vector-debt-m12", "relay-orchard-node", "cold-witness-r7", "radiant-liability-kestrel", "palisade-breaker-b9", "capacitor-rosary-rig", "vacuum-psalm-m12", "falling-star-harness", "scrap-circuit-rig", "eventide-eva-skin", "khepri-split-reference-link"]);
function locationPool(location, operatorLevel = 16) {
  const ids = new Set(locationChaseIds[location] ?? []);
  return chaseCatalog.filter((item) => ids.has(item.baseId) && (operatorLevel >= 15 || !level15ChaseIds.has(item.baseId)));
}
function makeLocationSingular(location, index, level, random, recoveryLevel, recoveryQuality, recoverySource, sourceOperatorLevel = level) {
  const pool = locationPool(location, sourceOperatorLevel);
  if (!pool.length) return null;
  return makeSingularItem(pool[Math.floor(random() * pool.length)], "chase", index, level, random, recoveryLevel, recoveryQuality, recoverySource, sourceOperatorLevel);
}
Object.values(bossSingularPools).reduce((total, pool) => total + pool.length, 0) + chaseCatalog.length;
const progressionNodes = [
  { id: "ballistics-1", branch: "Ballistics", name: "Dense Flight", description: "+8 penetration to all player projectiles." },
  { id: "ballistics-2", branch: "Ballistics", name: "Armor Work", description: "+15% armor damage.", requires: "ballistics-1" },
  { id: "ballistics-3", branch: "Ballistics", name: "Breach Doctrine", description: "Armor Breach lasts longer, but direct health damage is slightly reduced.", major: true, requires: "ballistics-2" },
  { id: "mobility-1", branch: "Mobility", name: "Servo Timing", description: "+6% movement speed." },
  { id: "mobility-2", branch: "Mobility", name: "Low-G Footwork", description: "Improved stopping control below 0.35g.", requires: "mobility-1" },
  { id: "mobility-3", branch: "Mobility", name: "Recoil Vectoring", description: "While moving, 35% of weapon recoil is redirected into your chosen movement vector.", major: true, requires: "mobility-2" },
  { id: "systems-1", branch: "Systems", name: "Efficient Bus", description: "+12% capacitor regeneration." },
  { id: "systems-2", branch: "Systems", name: "Signal Compression", description: "-8% ability capacitor cost.", requires: "systems-1" },
  { id: "systems-3", branch: "Systems", name: "Disruption Relay", description: "Electronically disrupted targets can be serviced by a relay microdrone.", major: true, requires: "systems-2" },
  { id: "survival-1", branch: "Survival", name: "Layered Plate", description: "+12 maximum armor." },
  { id: "survival-2", branch: "Survival", name: "Pressure Discipline", description: "Vacuum exposure builds more slowly.", requires: "survival-1" },
  { id: "survival-3", branch: "Survival", name: "Hard Vacuum Familiarity", description: "Greatly reduces vacuum damage and decompression pull.", major: true, requires: "survival-2" },
  { id: "engineering-1", branch: "Engineering", name: "Thermal Routing", description: "+12% weapon heat dissipation." },
  { id: "engineering-2", branch: "Engineering", name: "Quick Vent", description: "Manual vent cycles complete faster.", requires: "engineering-1" },
  { id: "engineering-3", branch: "Engineering", name: "Dodge Heat Shunt", description: "Dodging vents weapon heat.", major: true, requires: "engineering-2" },
  { id: "awareness-1", branch: "Awareness", name: "Predictive Lead", description: "+8% projectile velocity." },
  { id: "awareness-2", branch: "Awareness", name: "Weak-Path Telemetry", description: "Marked targets take more armor damage.", requires: "awareness-1" },
  { id: "awareness-3", branch: "Awareness", name: "Penetration Optics", description: "Sensor-marked targets expose penetration paths to all weapons.", major: true, requires: "awareness-2" }
];
const specializationDefinitions = [
  { id: "pressure-diver", name: "Pressure Diver", identity: "Pressure / vacuum manipulation", description: "MAG below 45% pressure leaves a short player-owned vacuum wake, while ability use sheds accumulated vacuum exposure.", tradeoff: "-12 maximum armor.", overclock: "Low-pressure wakes last longer and ability use clears more exposure.", overclockTradeoff: "+12% ability capacitor cost." },
  { id: "momentum-broker", name: "Momentum Broker", identity: "Recoil / capacitor conversion", description: "Weapon recoil is treated as recoverable bus energy, returning a capped amount of capacitor per shot.", tradeoff: "-15% passive capacitor regeneration.", overclock: "Raises the per-shot recoil conversion ceiling from 8 to 10 capacitor.", overclockTradeoff: "+12% weapon recoil." },
  { id: "grid-weaver", name: "Grid Weaver", identity: "Machinery-network Arc routing", description: "Arc Tap through machinery can paint an additional remote target for MARK follow-up.", tradeoff: "-4% direct weapon output.", overclock: "Machinery Arc also advances Sensor Spike recovery.", overclockTradeoff: "+15% Arc Tap capacitor cost." },
  { id: "survey-deadeye", name: "Survey Deadeye", identity: "Marked-target rail precision", description: "Rail hits consume marks to break committed attacks and create a short Armor Breach window.", tradeoff: "Sensor Spike marks are 20% shorter and recover 10% slower.", overclock: "Consuming a mark pulls Sensor Spike back toward a 2.2 second recovery window.", overclockTradeoff: "+8% Rail Lance heat per shot." },
  { id: "redline-pilot", name: "Redline Pilot", identity: "Heat / mobility decisions", description: "Above 75% active-weapon heat, movement acceleration and maximum speed increase instead of encouraging immediate disengagement.", tradeoff: "-18% passive weapon cooling.", overclock: "A high-heat dodge vents heat and emits a short stagger pulse.", overclockTradeoff: "-8 maximum armor; the high-heat pulse adds 0.18s dodge recovery." },
  { id: "breach-vanguard", name: "Breach Vanguard", identity: "Close armor-breaking assault", description: "Breacher hits inside 300 units gain a capped armor-damage conversion and armor breaks stagger the target.", tradeoff: "-5% movement speed and +10% Breacher heat per shot.", overclock: "Close armor breaks rebuild a small amount of operator armor.", overclockTradeoff: "-8% Breacher direct-health conversion." },
  { id: "capacitor-conductor", name: "Capacitor Conductor", identity: "Ability-cycle combo routing", description: "Casting a different MAG/MARK/ARC ability within 3.4 seconds returns capped capacitor and rewards deliberate three-button sequencing.", tradeoff: "-12 maximum capacitor.", overclock: "Completing the third link of a sequence raises the capped refund and cools the active weapon.", overclockTradeoff: "+10% ability capacitor cost." }
];
function cloneItem(item) {
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
    recoverySource: item.recoverySource ?? "Legacy recovery",
    modifiers: item.modifiers.map((modifier) => materializeModifier(modifier.id, modifier.grade ?? 3))
  };
}
const levelThresholds = [0, 120, 300, 540, 840, 1200, 1620, 2100, 2640, 3240, 3900, 4620, 5400, 6240, 7140, 8100, 9120, 10200, 11340, 12540];
const maxOperatorLevel = levelThresholds.length;
function levelRequirementForRecovery(recoveryLevel) {
  const normalized = Math.max(12, Math.min(56, recoveryLevel));
  return Math.max(1, Math.min(maxOperatorLevel, 1 + Math.round((normalized - 12) / 44 * (maxOperatorLevel - 1))));
}
const maxLevelXp = levelThresholds[levelThresholds.length - 1];
function createDefaultProfile() {
  const inventory = starterItems.map(cloneItem);
  return { version: 3, xp: 0, level: 1, progressionPoints: 0, allocatedNodes: [], abilityMods: { mag: null, mark: null, arc: null }, specialization: null, specializationOverclock: false, inventory, equipped: { carbine: "starter-carbine", breacher: "starter-breacher", rail: "starter-rail", suit: "starter-suit", rig: "starter-rig", implant: "starter-implant" }, settings: { aimAssist: "balanced", rightStickFire: true, screenShake: true, effectIntensity: "full", effectsVolume: 0.65, uiVolume: 0.45, haptics: true, telemetrySharing: false, tutorialComplete: false }, runsCompleted: 0 };
}
function loadProfile() {
  if (typeof window === "undefined") return createDefaultProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY$1);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw);
    if (parsed.version !== 3 || !Array.isArray(parsed.inventory)) return createDefaultProfile();
    const defaults = createDefaultProfile();
    const parsedXp = typeof parsed.xp === "number" && Number.isFinite(parsed.xp) ? parsed.xp : defaults.xp;
    const parsedLevel = typeof parsed.level === "number" && Number.isFinite(parsed.level) ? Math.round(parsed.level) : defaults.level;
    const storedXp = Math.max(0, Math.min(maxLevelXp, parsedXp));
    const storedLevel = Math.max(1, Math.min(levelThresholds.length, parsedLevel));
    const normalizedXp = Math.max(storedXp, levelThresholds[storedLevel - 1] ?? 0);
    const normalizedLevel = levelForXp(normalizedXp);
    const allocatedNodes = Array.isArray(parsed.allocatedNodes) ? parsed.allocatedNodes : [];
    const validAllocatedCount = new Set(allocatedNodes.filter((id) => progressionNodes.some((node) => node.id === id))).size;
    const parsedPoints = typeof parsed.progressionPoints === "number" && Number.isFinite(parsed.progressionPoints) ? Math.max(0, Math.floor(parsed.progressionPoints)) : defaults.progressionPoints;
    const progressionPoints = Math.max(parsedPoints, Math.max(0, normalizedLevel - 1 - validAllocatedCount));
    const specialization = normalizedLevel >= 15 && specializationDefinitions.some((definition) => definition.id === parsed.specialization) ? parsed.specialization : null;
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
      inventory: parsed.inventory.map((item) => cloneItem(item)),
      allocatedNodes
    };
  } catch {
    return createDefaultProfile();
  }
}
function saveProfile(profile2) {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY$1, JSON.stringify(profile2));
    return true;
  } catch {
    return false;
  }
}
function levelForXp(xp) {
  let level = 1;
  for (let index = 1; index < levelThresholds.length; index += 1) if (xp >= levelThresholds[index]) level = index + 1;
  return level;
}
function xpProgress(profile2) {
  if (profile2.level >= levelThresholds.length) return { current: 1, needed: 1, maxed: true };
  const current = levelThresholds[Math.min(profile2.level - 1, levelThresholds.length - 1)] ?? 0;
  const next = levelThresholds[Math.min(profile2.level, levelThresholds.length - 1)] ?? current;
  return { current: profile2.xp - current, needed: Math.max(1, next - current), maxed: false };
}
function seeded(seedValue) {
  let value = seedValue >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}
function rollModifierSet(pool, count, random, recoveryLevel, recoveryQuality, preferred = [], forced = []) {
  const chosen = [];
  for (const id of forced) if (pool.includes(id) && !chosen.includes(id)) chosen.push(id);
  const target = Math.min(pool.length, Math.max(count, chosen.length));
  while (chosen.length < target) {
    const remaining = pool.filter((id) => !chosen.includes(id));
    const wantedFamily = chosen.length % 2 === 0 ? "core" : "systems";
    const familyCandidates = remaining.filter((id) => modifierFamilyFor(id) === wantedFamily);
    let candidates = familyCandidates.length > 0 ? familyCandidates : remaining;
    const preferredCandidates = candidates.filter((id) => preferred.includes(id));
    if (preferredCandidates.length > 0 && random() < 0.78) candidates = preferredCandidates;
    const candidate = candidates[Math.floor(random() * candidates.length)];
    if (!candidate) break;
    chosen.push(candidate);
  }
  return chosen.map((id) => materializeModifier(id, forced.includes(id) ? 3 : rollModifierGrade(recoveryLevel, recoveryQuality, random)));
}
function makeFactionItem(slot, index, level, random, faction, recoveryLevel, recoveryQuality, recoverySource, frameOperatorLevel = level) {
  const base = baseNames[slot];
  const frame = factionFrames[faction][slot];
  const rolledRarity = rollRarityForQuality(random, recoveryQuality);
  const rarity = rolledRarity === "Field" ? "Refined" : rolledRarity;
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
    recoverySource
  };
}
function makeItem(slot, index, level, random, forcedAffixes = [], recoveryLevel = 4, recoveryQuality = 0, recoverySource = "Contract recovery", forcedCount, frameOperatorLevel = level, forcedRarity) {
  const base = baseNames[slot];
  const rarity = forcedRarity ?? (forcedAffixes.length > 0 ? "Prototype" : rollRarityForQuality(random, recoveryQuality));
  const count = forcedCount ?? modifierCountForRarity(rarity, recoveryQuality, random);
  const frameGeneration = frameGenerationForRecovery(recoveryLevel, frameOperatorLevel);
  const generationNames = frameGenerationNames[slot][frameGeneration];
  const frameIdentity = rollFrameIdentity(slot, random);
  const equipmentQuality = equipmentQualityForRecovery(recoveryQuality, frameGeneration, rarity);
  const augmentSlots = augmentSlotCount(rarity, frameGeneration);
  return { id: `loot-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`, baseId: base.baseId, name: generationNames[Math.floor(random() * generationNames.length)], slot, equipmentClass: base.equipmentClass, rarity, levelRequirement: levelRequirementForRecovery(recoveryLevel), core: base.core, modifiers: rollModifierSet(base.affixes, count, random, recoveryLevel, recoveryQuality, [], forcedAffixes), recoveryLevel, frameGeneration, frameIdentity, frameImplicit: frameImplicitFor(slot, frameGeneration, frameIdentity, equipmentQuality), equipmentQuality, augmentSlots, augments: [], recoveryQuality, recoverySource };
}
const recoverySlotOrder = ["carbine", "breacher", "rail", "suit", "rig", "implant"];
function chooseRecoverySlots(profile2, count, random) {
  const counts = Object.fromEntries(
    recoverySlotOrder.map((slot) => [slot, profile2.inventory.filter((item) => item.slot === slot).length])
  );
  const chosen = [];
  for (let index = 0; index < count; index += 1) {
    const minimum = Math.min(...recoverySlotOrder.map((slot2) => counts[slot2]));
    const candidates = recoverySlotOrder.filter((slot2) => counts[slot2] === minimum);
    const slot = candidates[Math.floor(random() * candidates.length)];
    chosen.push(slot);
    counts[slot] += 1;
  }
  return chosen;
}
function awardRecovery(profile2, telemetry2, deep, _fabricationLevel = 0, source = {}, fieldLoot) {
  const rawXp = 250 + Math.min(90, Math.round(telemetry2.damageDealt / 22));
  const requestedXp = Math.round(rawXp * (1 + Math.max(0, (source.combatEffectiveness ?? 1) - 1) * 0.65));
  const cappedProfileXp = Math.max(0, Math.min(maxLevelXp, profile2.xp));
  const xpGained = Math.max(0, Math.min(requestedXp, maxLevelXp - cappedProfileXp));
  const nextXp = cappedProfileXp + xpGained;
  const nextLevel = levelForXp(nextXp);
  const levelsGained = Math.max(0, nextLevel - profile2.level);
  const random = seeded(2654435769 ^ profile2.runsCompleted * 7919 ^ profile2.level * 104729 ^ 1374496523);
  const count = 2;
  const maxRecoveryLevel = source.maxRecoveryLevel ?? 8 + Math.max(1, source.operationTier ?? 1) * 4;
  const eliteKills = telemetry2.eliteKills ?? 0;
  const directiveRecoveryBonus = Math.max(0, Math.min(3, source.directiveRecoveryLevelBonus ?? 0));
  const ordinaryRecoveryLevel = Math.min(maxRecoveryLevel, recoveryLevelForSource(maxRecoveryLevel, { deep, boss: false, eliteKills }) + directiveRecoveryBonus);
  const bossRecoveryLevel = Math.min(maxRecoveryLevel, recoveryLevelForSource(maxRecoveryLevel, { deep: true, boss: true, eliteKills }) + directiveRecoveryBonus);
  const locationRecoveryLevel = Math.min(maxRecoveryLevel, ordinaryRecoveryLevel + 1);
  const actualDepth = source.actualDepth ?? deep;
  const locationName = source.locationName ?? (source.location ?? "Unknown site").replaceAll("-", " ");
  const factionName = source.faction === "meridian" ? "Meridian Compact" : source.faction === "heliostat" ? "Heliostat League" : source.faction === "longarc" ? "Long Arc Assembly" : "Independent";
  const rollQuality = (boss, minimum = 0) => Math.max(minimum, rollRecoveryQuality(random, { operationTier: source.operationTier ?? 1, threatBudget: source.threatBudget ?? 32, eliteKills, eliteProtocolCount: source.eliteProtocolCount ?? 0, deep: actualDepth, optionalObjectives: source.optionalObjectives ?? 0, environmentalComplications: source.environmentalComplications ?? 0, boss, location: source.location, faction: source.faction, factionReputation: source.factionReputation, directiveBonus: source.directiveQualityBonus ?? 0 }));
  const sponsoredChance = source.faction ? factionGearChance(source.factionReputation ?? 0) : 0;
  const makeRecoveredItem = (slot, index) => {
    const recoveryQuality = rollQuality(actualDepth);
    return source.faction && random() < sponsoredChance ? makeFactionItem(slot, index, nextLevel, random, source.faction, ordinaryRecoveryLevel, recoveryQuality, `Sponsored recovery // ${factionName}`, profile2.level) : makeItem(slot, index, nextLevel, random, [], ordinaryRecoveryLevel, recoveryQuality, `${locationName} contract recovery`, void 0, profile2.level);
  };
  const fieldMode = Array.isArray(fieldLoot);
  const fieldDrops = [].slice(0, 12);
  const fieldSlots = chooseRecoverySlots(profile2, fieldDrops.filter((drop) => drop.source !== "boss").length, random);
  let fieldSlotIndex = 0;
  const fieldItems = fieldDrops.map((drop, index) => {
    const recoveryQuality = Math.max(drop.recoveryQualityFloor, rollQuality(drop.source === "boss", drop.recoveryQualityFloor));
    const recoveryLevel = Math.max(1, Math.min(maxRecoveryLevel, drop.recoveryLevel));
    const recoverySource = `Ground drop // ${drop.enemyLabel}`;
    if (drop.source === "boss" && drop.rarity === "Singular") return makeBossSingular(source.deepTarget ?? "", 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile2.level) ?? makeLocationSingular(source.location ?? "", 100 + index, nextLevel, random, recoveryLevel, recoveryQuality, recoverySource, profile2.level) ?? makeItem("rail", 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, void 0, profile2.level, "Prototype");
    const slot = fieldSlots[fieldSlotIndex++] ?? recoverySlotOrder[(drop.enemyId + index) % recoverySlotOrder.length];
    const visibleRarity = drop.rarity === "Singular" ? "Prototype" : drop.rarity;
    return makeItem(slot, 100 + index, nextLevel, random, [], recoveryLevel, recoveryQuality, recoverySource, void 0, profile2.level, visibleRarity);
  });
  const bossItem = actualDepth && !fieldMode ? makeBossSingular(source.deepTarget ?? "", 0, nextLevel, random, bossRecoveryLevel, rollQuality(true, 4), `Boss pool // ${source.deepTarget ?? "deep target"}`, profile2.level) : null;
  const locationChance = Math.min(0.85, (bossItem ? 0.3 : 0.48) + Math.max(0, source.directiveSingularChanceBonus ?? 0));
  const locationItem = profile2.runsCompleted > 0 && random() < locationChance ? makeLocationSingular(source.location ?? "", bossItem ? 1 : 0, nextLevel, random, locationRecoveryLevel, rollQuality(actualDepth, 3), `Location chase // ${locationName}`, profile2.level) : null;
  let loot = [];
  if (profile2.runsCompleted === 0) {
    const first = makeItem("breacher", 0, nextLevel, random, ["overdrive", "breachPropulsion"], ordinaryRecoveryLevel, Math.max(1, rollQuality(false)), "Quiet Signal onboarding recovery", 2, profile2.level);
    loot.push({ ...first, name: "Backblast Kestrel Frame" });
    {
      if (bossItem) loot.push(bossItem);
      else {
        const second = makeItem("rig", 1, nextLevel, random, ["dodgeVent", "capacitorRecycler"], ordinaryRecoveryLevel, Math.max(1, rollQuality(false)), "Quiet Signal onboarding recovery", 2, profile2.level);
        loot.push({ ...second, name: "Slipstream Thermal Rig" });
      }
    }
  } else if (bossItem) {
    if (locationItem) loot = [bossItem, locationItem];
    else {
      const [slot] = chooseRecoverySlots(profile2, 1, random);
      loot = [bossItem, makeRecoveredItem(slot, 1)];
    }
  } else if (locationItem) {
    {
      const [slot] = chooseRecoverySlots(profile2, 1, random);
      loot = [locationItem, makeRecoveredItem(slot, 1)];
    }
  } else {
    const slots = chooseRecoverySlots(profile2, count, random);
    loot = slots.map((slot, index) => makeRecoveredItem(slot, index));
  }
  loot = [...fieldItems, ...loot];
  const profileNext = {
    ...profile2,
    xp: nextXp,
    level: nextLevel,
    progressionPoints: profile2.progressionPoints + levelsGained,
    runsCompleted: profile2.runsCompleted + 1,
    inventory: [...profile2.inventory, ...loot]
  };
  return { profile: profileNext, xpGained, levelsGained, loot };
}
function allocateNode(profile2, nodeId) {
  const node = progressionNodes.find((entry) => entry.id === nodeId);
  if (!node) return { profile: profile2, message: "Progression node unavailable." };
  if (profile2.allocatedNodes.includes(nodeId)) return { profile: profile2, message: "Node already allocated." };
  if (profile2.progressionPoints <= 0) return { profile: profile2, message: "Gain another level to earn a progression point." };
  if (node.requires && !profile2.allocatedNodes.includes(node.requires)) return { profile: profile2, message: "Allocate the previous node in this branch first." };
  return { profile: { ...profile2, progressionPoints: profile2.progressionPoints - 1, allocatedNodes: [...profile2.allocatedNodes, nodeId] }, message: `${node.name} allocated.` };
}
function setSpecialization(profile2, specialization) {
  if (profile2.level < 15) return profile2;
  if (!specializationDefinitions.some((definition) => definition.id === specialization)) return profile2;
  const specializationOverclock = specialization && specialization === profile2.specialization && profile2.level >= 16 ? profile2.specializationOverclock : false;
  return { ...profile2, specialization, specializationOverclock };
}
function setSpecializationOverclock(profile2, enabled) {
  if (profile2.level < 16 || !profile2.specialization) return profile2;
  return { ...profile2, specializationOverclock: enabled };
}
function equippedItems(profile2) {
  return Object.keys(profile2.equipped).map((slot) => itemForSlot(profile2, slot)).filter((item) => !!item);
}
function factionSetState(profile2) {
  const equipped = equippedItems(profile2);
  return factionSetDefinitions.map((definition) => {
    const count = equipped.filter((item) => item.faction === definition.id).length;
    return { definition, count, twoPieceActive: count >= 2, fourPieceActive: count >= 4 };
  });
}
function applyFactionSetBonuses(build, profile2) {
  for (const state of factionSetState(profile2)) {
    if (state.count >= 2 && state.definition.id === "meridian") {
      build.player.maxArmorAdd += 16;
      build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + 0.16);
    }
    if (state.count >= 4 && state.definition.id === "meridian") {
      build.player.maxArmorAdd += 8;
      for (const weapon of Object.values(build.weapon)) weapon.recoilMul *= 0.86;
    }
    if (state.count >= 2 && state.definition.id === "heliostat") {
      build.player.maxCapAdd += 14;
      build.player.capRegenMul *= 1.14;
    }
    if (state.count >= 4 && state.definition.id === "heliostat") {
      for (const weapon of Object.values(build.weapon)) {
        weapon.damageMul *= 1.08;
        weapon.heatPerShotMul *= 1.1;
        weapon.heatDissipationMul *= 1.25;
      }
      for (const ability of build.abilities) ability.cooldownMul *= 0.92;
    }
    if (state.count >= 2 && state.definition.id === "longarc") {
      build.player.moveSpeedMul *= 1.06;
      build.player.lowGControl += 0.18;
    }
    if (state.count >= 4 && state.definition.id === "longarc") {
      build.mechanics.recoilVectoring = true;
      build.mechanics.dodgeVent = true;
      build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, 1);
      build.mechanics.breacherPropulsion = true;
      build.mechanics.breacherPropulsionScale = Math.max(build.mechanics.breacherPropulsionScale, 1);
    }
  }
}
function freshBuild() {
  const weapon = () => ({ damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 });
  return { weapon: { carbine: weapon(), breacher: weapon(), rail: weapon() }, player: { maxHpAdd: 0, maxArmorAdd: 0, maxCapAdd: 0, moveSpeedMul: 1, capRegenMul: 1, vacuumResistance: 0, lowGControl: 0, ventSpeedMul: 1 }, mechanics: { railFragment: false, railFragmentScale: 0, dodgeVent: false, dodgeVentScale: 0, magRedirect: false, magRedirectScale: 0, breacherPropulsion: false, breacherPropulsionScale: 0, markWeakArmor: false, markWeakArmorScale: 0, arcDrone: false, arcDroneScale: 0, recoilVectoring: false, breachDoctrine: false, sensorPenetration: false, widebandMark: false, magOverdriveKick: false, arcGroundLoop: false, magBoundarySink: false, markExecutionTrace: false, arcCascadeLattice: false }, singularTraits: [], specialization: null, specializationOverclock: false, abilities: [{ costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }] };
}
function applyFrameGeneration(build, item) {
  const step = Math.min(4, Math.max(0, (item.frameGeneration ?? 1) - 1));
  if (step <= 0) return;
  if (item.slot === "carbine") {
    build.weapon.carbine.speedMul *= 1 + step * 0.025;
    build.weapon.carbine.penetrationAdd += step * 2;
  } else if (item.slot === "breacher") {
    build.weapon.breacher.damageMul *= 1 + step * 0.025;
    build.weapon.breacher.knockbackMul *= 1 + step * 0.04;
  } else if (item.slot === "rail") {
    build.weapon.rail.penetrationAdd += step * 4;
    build.weapon.rail.recoilMul *= 1 - step * 0.025;
  } else if (item.slot === "suit") {
    build.player.maxArmorAdd += step * 4;
    build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + step * 0.025);
  } else if (item.slot === "rig") {
    build.player.maxCapAdd += step * 4;
    build.player.capRegenMul *= 1 + step * 0.025;
  } else {
    for (const ability of build.abilities) ability.cooldownMul *= 1 - step * 0.02;
  }
}
function applyAffix(build, item, modifier) {
  const id = modifier.id;
  const power = modifierPowerFactor(modifier.grade ?? 3);
  const tradeoff = modifierTradeoffFactor(modifier.grade ?? 3);
  const weapon = item.slot === "carbine" || item.slot === "breacher" || item.slot === "rail" ? build.weapon[item.slot] : null;
  if (id === "hypervelocity" && weapon) {
    weapon.speedMul *= 1 + 0.18 * power;
    weapon.penetrationAdd += Math.round(12 * power);
    weapon.recoilMul *= 1 + 0.1 * tradeoff;
  }
  if (id === "countermass") {
    if (weapon) {
      weapon.recoilMul *= 1 - 0.22 * power;
      weapon.damageMul *= 1 - 0.07 * tradeoff;
    } else build.player.lowGControl += 0.12 * power;
  }
  if (id === "overdrive" && weapon) {
    weapon.damageMul *= 1 + 0.14 * power;
    weapon.recoilMul *= 1 + 0.2 * tradeoff;
    weapon.heatPerShotMul *= 1 + 0.12 * tradeoff;
  }
  if (id === "cryoloop") {
    if (weapon) {
      weapon.heatDissipationMul *= 1 + 0.3 * power;
      weapon.penetrationAdd -= Math.round(8 * tradeoff);
    } else for (const stats of Object.values(build.weapon)) stats.heatDissipationMul *= 1 + 0.15 * power;
  }
  if (id === "extendedFeed" && weapon) {
    weapon.magazineAdd += Math.max(1, Math.round(6 * power));
    weapon.reloadMul *= 1 + 0.12 * tradeoff;
  }
  if (id === "tungsten" && weapon) {
    weapon.armorDamageMul *= 1 + 0.3 * power;
    weapon.penetrationAdd += Math.round(14 * power);
    weapon.heatPerShotMul *= 1 + 0.08 * tradeoff;
  }
  if (id === "vacuumSeal") build.player.vacuumResistance = Math.min(0.8, build.player.vacuumResistance + 0.55 * power);
  if (id === "servoWeave") {
    build.player.moveSpeedMul *= 1 + 0.08 * power;
    build.player.lowGControl += 0.22 * power;
  }
  if (id === "capacitorRecycler") {
    build.player.capRegenMul *= 1 + 0.2 * power;
    for (const ability of build.abilities) ability.costMul *= 1 - 0.1 * power;
  }
  if (id === "railFracture") {
    build.mechanics.railFragment = true;
    build.mechanics.railFragmentScale = Math.max(build.mechanics.railFragmentScale, power);
  }
  if (id === "dodgeVent") {
    build.mechanics.dodgeVent = true;
    build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, power);
  }
  if (id === "magRedirect") {
    build.mechanics.magRedirect = true;
    build.mechanics.magRedirectScale = Math.max(build.mechanics.magRedirectScale, power);
  }
  if (id === "breachPropulsion") {
    build.mechanics.breacherPropulsion = true;
    build.mechanics.breacherPropulsionScale = Math.max(build.mechanics.breacherPropulsionScale, power);
  }
  if (id === "markShear") {
    build.mechanics.markWeakArmor = true;
    build.mechanics.markWeakArmorScale = Math.max(build.mechanics.markWeakArmorScale, power);
  }
  if (id === "arcDrone") {
    build.mechanics.arcDrone = true;
    build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, power);
  }
}
function deriveCombatBuild(profile2) {
  const build = freshBuild();
  for (const item of equippedItems(profile2)) {
    applyFrameGeneration(build, item);
    applyFrameIdentity(build, item);
    applyAugments(build, item.slot, item.augments ?? []);
    for (const modifier of item.modifiers) applyAffix(build, item, modifier);
    if (item.singularTrait && !build.singularTraits.includes(item.singularTrait)) build.singularTraits.push(item.singularTrait);
  }
  if (build.singularTraits.includes("magBloom")) {
    build.abilities[0].costMul *= 1.25;
    build.abilities[0].cooldownMul *= 1.08;
  }
  if (build.singularTraits.includes("markCascade")) build.abilities[1].cooldownMul *= 1.12;
  applyFactionSetBonuses(build, profile2);
  const nodes = new Set(profile2.allocatedNodes);
  if (nodes.has("ballistics-1")) for (const weapon of Object.values(build.weapon)) weapon.penetrationAdd += 8;
  if (nodes.has("ballistics-2")) for (const weapon of Object.values(build.weapon)) weapon.armorDamageMul *= 1.15;
  if (nodes.has("ballistics-3")) build.mechanics.breachDoctrine = true;
  if (nodes.has("mobility-1")) build.player.moveSpeedMul *= 1.06;
  if (nodes.has("mobility-2")) build.player.lowGControl += 0.28;
  if (nodes.has("mobility-3")) build.mechanics.recoilVectoring = true;
  if (nodes.has("systems-1")) build.player.capRegenMul *= 1.12;
  if (nodes.has("systems-2")) for (const ability of build.abilities) ability.costMul *= 0.92;
  if (nodes.has("systems-3")) {
    build.mechanics.arcDrone = true;
    build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, 1);
  }
  if (nodes.has("survival-1")) build.player.maxArmorAdd += 12;
  if (nodes.has("survival-2")) build.player.vacuumResistance = Math.min(0.8, build.player.vacuumResistance + 0.2);
  if (nodes.has("survival-3")) build.player.vacuumResistance = Math.min(0.9, build.player.vacuumResistance + 0.5);
  if (nodes.has("engineering-1")) for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 1.12;
  if (nodes.has("engineering-2")) build.player.ventSpeedMul *= 1.25;
  if (nodes.has("engineering-3")) {
    build.mechanics.dodgeVent = true;
    build.mechanics.dodgeVentScale = Math.max(build.mechanics.dodgeVentScale, 1);
  }
  if (nodes.has("awareness-1")) for (const weapon of Object.values(build.weapon)) weapon.speedMul *= 1.08;
  if (nodes.has("awareness-2")) build.mechanics.markWeakArmor = true;
  if (nodes.has("awareness-3")) build.mechanics.sensorPenetration = true;
  const specialization = profile2.level >= 15 ? profile2.specialization : null;
  build.specialization = specialization;
  build.specializationOverclock = profile2.level >= 16 && !!specialization && profile2.specializationOverclock;
  if (specialization === "pressure-diver") {
    build.player.maxArmorAdd -= 12;
    if (build.specializationOverclock) for (const ability of build.abilities) ability.costMul *= 1.12;
  }
  if (specialization === "momentum-broker") {
    build.player.capRegenMul *= 0.85;
    if (build.specializationOverclock) for (const weapon of Object.values(build.weapon)) weapon.recoilMul *= 1.12;
  }
  if (specialization === "grid-weaver") {
    for (const weapon of Object.values(build.weapon)) weapon.damageMul *= 0.96;
    if (build.specializationOverclock) build.abilities[2].costMul *= 1.15;
  }
  if (specialization === "survey-deadeye") {
    build.abilities[1].powerMul *= 0.8;
    build.abilities[1].cooldownMul *= 1.1;
    if (build.specializationOverclock) build.weapon.rail.heatPerShotMul *= 1.08;
  }
  if (specialization === "redline-pilot") {
    for (const weapon of Object.values(build.weapon)) weapon.heatDissipationMul *= 0.82;
    if (build.specializationOverclock) build.player.maxArmorAdd -= 8;
  }
  if (specialization === "breach-vanguard") {
    build.player.moveSpeedMul *= 0.95;
    build.weapon.breacher.heatPerShotMul *= 1.1;
    if (build.specializationOverclock) build.weapon.breacher.healthMultiplierMul *= 0.92;
  }
  if (specialization === "capacitor-conductor") {
    build.player.maxCapAdd -= 12;
    if (build.specializationOverclock) for (const ability of build.abilities) ability.costMul *= 1.1;
  }
  if (profile2.abilityMods.mag === "mag-revector") {
    build.mechanics.magRedirect = true;
    build.mechanics.magRedirectScale = Math.max(build.mechanics.magRedirectScale, 1);
    build.abilities[0].costMul *= 1.25;
    build.abilities[0].cooldownMul *= 1.1;
  }
  if (profile2.abilityMods.mag === "mag-overdrive") {
    build.abilities[0].powerMul *= 1.45;
    build.mechanics.magOverdriveKick = true;
  }
  if (profile2.abilityMods.mag === "mag-boundary") {
    build.mechanics.magBoundarySink = true;
    build.abilities[0].costMul *= 1.2;
  }
  if (profile2.abilityMods.mark === "mark-shear") {
    build.mechanics.markWeakArmor = true;
    build.mechanics.markWeakArmorScale = Math.max(build.mechanics.markWeakArmorScale, 1);
    build.abilities[1].costMul *= 1.1;
  }
  if (profile2.abilityMods.mark === "mark-wideband") {
    build.mechanics.widebandMark = true;
    build.abilities[1].cooldownMul *= 1.18;
    build.abilities[1].powerMul *= 0.78;
  }
  if (profile2.abilityMods.mark === "mark-execution") {
    build.mechanics.markExecutionTrace = true;
    build.abilities[1].cooldownMul *= 1.1;
    build.abilities[1].powerMul *= 0.7;
  }
  if (profile2.abilityMods.arc === "arc-relay") {
    build.mechanics.arcDrone = true;
    build.mechanics.arcDroneScale = Math.max(build.mechanics.arcDroneScale, 1);
    build.abilities[2].costMul *= 1.2;
  }
  if (profile2.abilityMods.arc === "arc-ground") {
    build.mechanics.arcGroundLoop = true;
    build.abilities[2].powerMul *= 0.85;
  }
  if (profile2.abilityMods.arc === "arc-cascade") {
    build.mechanics.arcCascadeLattice = true;
    build.abilities[2].costMul *= 1.15;
    build.abilities[2].powerMul *= 0.78;
  }
  return build;
}
function itemForSlot(profile2, slot) {
  const id = profile2.equipped[slot];
  return id ? profile2.inventory.find((item) => item.id === id && item.slot === slot) : void 0;
}
function defaultConsumables() {
  return { medGel: 1, armorPatch: 0, capacitorCell: 0 };
}
const STORAGE_KEY = "ironshade-vector-campaign-v1";
const zeroWallet = () => ({ credits: 0, alloys: 0, electronics: 0, medstock: 0, components: 0, rareTech: 0 });
function createDefaultStory() {
  const progress = () => ({ status: "available", step: 0, choiceA: null, choiceB: null, completed: [] });
  return { arcs: { "vanishing-wake": progress(), "terms-of-survival": progress(), "cold-sun-protocol": progress() }, latticeClues: 0, lastBeat: "Three unresolved story operations are available from the Quiet Signal.", blackLattice: { status: "locked", step: 0, choiceA: null, choiceB: null, choiceC: null, completed: [], evidence: [], lastBeat: "Recover a quarantined trace or lattice finding to open the first major campaign chapter." }, postKhepri: { status: "locked", step: 0, choiceA: null, completed: [], evidence: [], lastBeat: "Complete The Black Lattice and reach operator level 11 to open the post-Khepri investigation." }, interdiction: { status: "locked", step: 0, choiceA: null, completed: [], evidence: [], identifiedTargets: [], lastBeat: "Complete Dead Reckoning and reach operator level 13 to expose the custody network defending the hidden cadence." } };
}
function createDefaultEscalation() {
  return { status: "idle", operationDate: null, seed: 0, codename: "", sponsor: "longarc", stage: 0, completed: [], lastBeat: "No escalation sequence is active." };
}
function createDefaultDirectives() {
  return { unlocked: false, inventory: [], preparedId: null, completed: 0, highestTier: 0, lastBeat: "Directive Array locked // reach operator level 10 to begin endgame navigation recovery." };
}
function createDefaultCampaign() {
  return { version: 1, cycle: 0, contractsCompleted: 0, resources: { credits: 120, alloys: 1, electronics: 1, medstock: 1, components: 0, rareTech: 0 }, consumables: defaultConsumables(), reputation: { meridian: 0, heliostat: 0, longarc: 0 }, shipUpgrades: { reactor: 0, drive: 0, armor: 0, cargo: 0, sensors: 0, fabrication: 0, medical: 0, drones: 0 }, anomalyRecovered: false, dailyCompletedDate: null, lastOutcome: "Quiet Signal ready for contract selection.", story: createDefaultStory(), escalation: createDefaultEscalation(), directives: createDefaultDirectives() };
}
function loadCampaign() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  if (typeof window === "undefined") return createDefaultCampaign();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultCampaign();
    const parsed = JSON.parse(raw);
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
          "vanishing-wake": { ...defaults.story.arcs["vanishing-wake"], ...(_a = parsedStory == null ? void 0 : parsedStory.arcs) == null ? void 0 : _a["vanishing-wake"] },
          "terms-of-survival": { ...defaults.story.arcs["terms-of-survival"], ...(_b = parsedStory == null ? void 0 : parsedStory.arcs) == null ? void 0 : _b["terms-of-survival"] },
          "cold-sun-protocol": { ...defaults.story.arcs["cold-sun-protocol"], ...(_c = parsedStory == null ? void 0 : parsedStory.arcs) == null ? void 0 : _c["cold-sun-protocol"] }
        },
        blackLattice: { ...defaults.story.blackLattice, ...parsedStory == null ? void 0 : parsedStory.blackLattice, completed: ((_d = parsedStory == null ? void 0 : parsedStory.blackLattice) == null ? void 0 : _d.completed) ?? defaults.story.blackLattice.completed, evidence: ((_e = parsedStory == null ? void 0 : parsedStory.blackLattice) == null ? void 0 : _e.evidence) ?? defaults.story.blackLattice.evidence },
        postKhepri: { ...defaults.story.postKhepri, ...parsedStory == null ? void 0 : parsedStory.postKhepri, completed: ((_f = parsedStory == null ? void 0 : parsedStory.postKhepri) == null ? void 0 : _f.completed) ?? defaults.story.postKhepri.completed, evidence: ((_g = parsedStory == null ? void 0 : parsedStory.postKhepri) == null ? void 0 : _g.evidence) ?? defaults.story.postKhepri.evidence },
        interdiction: { ...defaults.story.interdiction, ...parsedStory == null ? void 0 : parsedStory.interdiction, completed: ((_h = parsedStory == null ? void 0 : parsedStory.interdiction) == null ? void 0 : _h.completed) ?? defaults.story.interdiction.completed, evidence: ((_i = parsedStory == null ? void 0 : parsedStory.interdiction) == null ? void 0 : _i.evidence) ?? defaults.story.interdiction.evidence, identifiedTargets: ((_j = parsedStory == null ? void 0 : parsedStory.interdiction) == null ? void 0 : _j.identifiedTargets) ?? defaults.story.interdiction.identifiedTargets }
      },
      escalation: { ...defaults.escalation, ...parsedEscalation, completed: (parsedEscalation == null ? void 0 : parsedEscalation.completed) ?? defaults.escalation.completed },
      directives: { ...defaults.directives, ...parsedDirectives, inventory: Array.isArray(parsedDirectives == null ? void 0 : parsedDirectives.inventory) ? parsedDirectives.inventory : defaults.directives.inventory, preparedId: (parsedDirectives == null ? void 0 : parsedDirectives.preparedId) ?? defaults.directives.preparedId }
    };
  } catch {
    return createDefaultCampaign();
  }
}
function saveCampaign(campaign2) {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign2));
    return true;
  } catch {
    return false;
  }
}
const conditionLabel = { "unstable-pressure": "Unstable pressure shell", "failing-gravity": "Failing gravity control", "damaged-grid": "Damaged electrical grid", "automated-defense": "Automated defense remnants", "limited-atmosphere": "Limited atmosphere", "low-visibility": "Low visibility particulates" };
const locations = [
  { id: "orbital-station", name: "Orbital Industrial Station" },
  { id: "damaged-vessel", name: "Damaged Freight Vessel" },
  { id: "asteroid-refinery", name: "Asteroid Refinery" },
  { id: "spin-habitat", name: "Rotating Spin Habitat" },
  { id: "jovian-harvester", name: "Jovian Gas-Harvester Platform" },
  { id: "ice-mine", name: "Subsurface Ice-Mining Installation" },
  { id: "solar-yard", name: "Solar-Orbit Fabrication Yard" }
];
const archetypes = [{ id: "salvage", sponsor: "longarc" }, { id: "boarding", sponsor: "meridian" }, { id: "stabilization", sponsor: "heliostat" }];
const objectiveModes = ["pressure-recovery", "grid-isolation", "gravity-stabilization", "machinery-recovery", "emergency-boarding", "deep-salvage"];
const tacticalLocations = /* @__PURE__ */ new Set(["spin-habitat", "jovian-harvester", "ice-mine", "solar-yard"]);
function defaultObjectiveMode(archetype, location) {
  if (archetype === "salvage") return location === "damaged-vessel" ? "pressure-recovery" : location === "asteroid-refinery" ? "machinery-recovery" : "deep-salvage";
  if (archetype === "boarding") return location === "asteroid-refinery" ? "grid-isolation" : "emergency-boarding";
  return location === "damaged-vessel" ? "pressure-recovery" : location === "asteroid-refinery" ? "gravity-stabilization" : "grid-isolation";
}
function authoredObjective(location, mode) {
  var _a;
  const copy = {
    "spin-habitat": {
      "pressure-recovery": { objective: "Seal a rim pressure leak before emergency spindown drags atmosphere toward the axis.", steps: ["Cross the rotating rim to the pressure manifold.", "Seal the leaking ring segment with ACT.", "Hold through spindown until pressure recovers."] },
      "grid-isolation": { objective: "Isolate the rim and spoke power branches before spin imbalance cascades through the drive bus.", steps: ["Reach both spin-bus isolators.", "Isolate each branch with ACT.", "Clear the ring while the drive bus stabilizes."] },
      "gravity-stabilization": { objective: "Calibrate rim and spoke gravity trims so the habitat survives its emergency spindown cycle.", steps: ["Calibrate the rim gravity trim.", "Calibrate the spoke gravity trim.", "Hold the habitat through the gravity transition."] },
      "machinery-recovery": { objective: "Tag the bearing-control and attitude-flywheel packages without losing them during spindown.", steps: ["Reach both rotating machinery packages.", "Tag each package with ACT.", "Clear the recovery path before extraction."] },
      "emergency-boarding": { objective: "Cycle the spoke and axis pressure locks while the habitat transitions between gravity states.", steps: ["Reach the spoke pressure interlock.", "Cycle the axis pressure lock.", "Break the boarding line and secure the ring."] },
      "deep-salvage": { objective: "Tag recovery caches on the rim, spoke, and axis hub before the next spin transition.", steps: ["Tag the rim recovery cache.", "Tag the spoke recovery cache.", "Tag the axis cache and clear the ring."] }
    },
    "jovian-harvester": {
      "pressure-recovery": { objective: "Seal the storm-deck relief breach before the pressure shear strips the maintenance lane.", steps: ["Reach the storm relief manifold.", "Seal the active deck breach.", "Hold until the maintenance deck repressurizes."] },
      "grid-isolation": { objective: "Isolate both electrostatic harvesting branches before storm charge feeds the damaged grid.", steps: ["Reach the skimmer bus isolator.", "Reach the compressor bus isolator.", "Isolate both branches and clear the deck."] },
      "gravity-stabilization": { objective: "Calibrate both deck mass trims so pressure shear cannot throw the platform out of alignment.", steps: ["Calibrate the maintenance-deck trim.", "Calibrate the compressor-crown trim.", "Hold the platform through the shear window."] },
      "machinery-recovery": { objective: "Tag an intact skimmer compressor and separator package before the storm vent cycle returns.", steps: ["Reach both exposed machinery packages.", "Tag each package with ACT.", "Clear the maintenance route for extraction."] },
      "emergency-boarding": { objective: "Cycle both storm-rated pressure locks and reopen the maintenance route.", steps: ["Cycle the inner storm lock.", "Cycle the outer maintenance lock.", "Clear the boarding line before the next vent pulse."] },
      "deep-salvage": { objective: "Tag three skimmer assemblies distributed across unequal-pressure maintenance decks.", steps: ["Tag the intake package.", "Tag the separator package.", "Tag the compressor package and clear the deck."] }
    },
    "ice-mine": {
      "pressure-recovery": { objective: "Seal a fractured bore pressure line before volatile-rich tunnel gas vents through the mine.", steps: ["Reach the bore pressure manifold.", "Seal the fractured service line.", "Hold until the tunnel pressure margin recovers."] },
      "grid-isolation": { objective: "Isolate both thaw-grid branches before damaged heating lines destabilize the bore walls.", steps: ["Reach both thaw-grid isolators.", "Isolate each heating branch with ACT.", "Clear the tunnel after the grid drops."] },
      "gravity-stabilization": { objective: "Calibrate the haulage and deep-bore gravity trims before the tunnel fracture cycle peaks.", steps: ["Calibrate the haulage trim.", "Calibrate the deep-bore trim.", "Hold the route through the fracture event."] },
      "machinery-recovery": { objective: "Tag the cryobore cutter and volatile separator while brittle tunnel supports remain passable.", steps: ["Reach the cutter package.", "Reach the separator package.", "Tag both and clear the extraction tunnel."] },
      "emergency-boarding": { objective: "Cycle the upper and lower bore locks before brittle supports collapse into the boarding route.", steps: ["Cycle the access-bore lock.", "Cycle the deep-tunnel lock.", "Clear the narrowed boarding route."] },
      "deep-salvage": { objective: "Tag three buried recovery cores along the access bore, extraction tunnel, and subglacial vault.", steps: ["Tag the access-bore cache.", "Tag the extraction-tunnel cache.", "Tag the vault cache and clear the mine."] }
    },
    "solar-yard": {
      "pressure-recovery": { objective: "Seal the radiator-manifold breach before the sunward fabrication spine loses its pressure margin.", steps: ["Reach the radiator pressure manifold.", "Seal the service rupture.", "Hold until the fabrication spine repressurizes."] },
      "grid-isolation": { objective: "Isolate both solar-bus branches before a thermal cycle feeds the exposed fabrication grid.", steps: ["Reach the shade-side bus isolator.", "Reach the sunward bus isolator.", "Isolate both branches and clear the yard."] },
      "gravity-stabilization": { objective: "Calibrate the shade gantry and fabrication-spine gravity trims before thermal expansion shifts the work deck.", steps: ["Calibrate the shade-gantry trim.", "Calibrate the fabrication-spine trim.", "Hold through the solar load window."] },
      "machinery-recovery": { objective: "Tag the mirror actuator and printer spindle before the thermal shutters cycle open again.", steps: ["Reach both fabrication packages.", "Tag each package with ACT.", "Clear the sunward recovery lane."] },
      "emergency-boarding": { objective: "Cycle the shade-side and sunward pressure locks while thermal shutters protect the boarding route.", steps: ["Cycle the shade-side interlock.", "Cycle the sunward interlock.", "Clear the fabrication spine."] },
      "deep-salvage": { objective: "Tag three fabrication packages across shade, spine, and sunward work zones.", steps: ["Tag the shade-gantry package.", "Tag the fabrication-spine package.", "Tag the sunward package and clear the yard."] }
    },
    "momentum-exchange": { "momentum-capture": { objective: "Load both counter-momentum capture drums before the transfer lane dumps its stored impulse.", steps: ["Reach the inbound capture drum and lock its reference.", "Cross the near-zero-g transfer lane to the outbound drum.", "Load both drums with ACT and hold through the next countermass wash."] } },
    "cryo-reserve": { "thermal-routing": { objective: "Route both propellant purge valves so boiloff is rejected away from the occupied service gallery.", steps: ["Reach the first cryogenic purge valve.", "Route the second valve before the next boiloff pulse.", "Hold the tank gallery while the thermal route stabilizes."] } }
  };
  return ((_a = copy[location]) == null ? void 0 : _a[mode]) ?? null;
}
function missionObjectiveFor(mode, location) {
  const authored = authoredObjective(location, mode);
  if (authored) return { mode, ...authored };
  if (mode === "pressure-recovery") return { mode, objective: location === "damaged-vessel" ? "Seal the cargo-spine rupture and restore a breathable pressure margin." : "Seal the active pressure breach and restore a breathable margin.", steps: ["Reach the emergency pressure manifold.", "Seal the active service rupture.", "Hold while atmosphere recovers."] };
  if (mode === "grid-isolation") return { mode, objective: "Isolate both damaged power branches before the control spine cascades.", steps: ["Reach both live grid isolators.", "Isolate each branch with ACT.", "Clear the remaining armed interference."] };
  if (mode === "gravity-stabilization") return { mode, objective: "Calibrate both gravity trims while suppressing interference around the control spine.", steps: ["Reach the deck gravity trim.", "Calibrate the transfer gravity trim.", "Clear hostile interference and bank the contract."] };
  if (mode === "machinery-recovery") return { mode, objective: "Tag two intact industrial assemblies while keeping the recovery lane usable.", steps: ["Reach both tagged machinery packages.", "Use ACT to register each package.", "Clear the recovery lane and choose extraction depth."] };
  if (mode === "emergency-boarding") return { mode, objective: "Cycle both pressure interlocks and break the armed boarding line.", steps: ["Reach the first pressure interlock.", "Cycle the second pressure interlock.", "Clear the boarding line and secure extraction."] };
  if (mode === "momentum-capture") return { mode, objective: "Load both momentum-capture references before the next transfer impulse.", steps: ["Reach both capture controls.", "Lock each reference with ACT.", "Hold through the scheduled momentum wash."] };
  if (mode === "thermal-routing") return { mode, objective: "Route both thermal purge branches away from the occupied work zone.", steps: ["Reach both thermal-routing valves.", "Route each valve with ACT.", "Hold through the next purge cycle."] };
  return { mode, objective: "Tag three recovery packages distributed across the combat deck.", steps: ["Locate three marked recovery packages.", "Tag each package with ACT.", "Clear the hostile line and extract."] };
}
function tacticalIdentityForLocation(location) {
  if (location === "spin-habitat") return { briefing: "The ring is actively rotating: rim gravity is high, spoke gravity is transitional, and the axis hub is nearly weightless.", forecast: "Emergency spindown temporarily collapses gravity across the rim and spoke before the drive bus recovers." };
  if (location === "jovian-harvester") return { briefing: "External skimmer decks sit across unequal pressure zones above the Jovian atmosphere.", forecast: "A fixed storm-shear window can open a high-force maintenance vent before relief shutters recover the deck." };
  if (location === "ice-mine") return { briefing: "Subsurface haul tunnels constrain movement around brittle ice supports and narrow bore junctions.", forecast: "A scheduled tunnel fracture can remove brittle barriers and open new firing lanes mid-encounter." };
  if (location === "solar-yard") return { briefing: "The sunward fabrication yard relies on thermal shutters and aggressive heat rejection.", forecast: "A fixed solar-load window raises active-weapon heat unless the local thermal shutters are closed." };
  if (location === "lattice-annex") return { briefing: "Khepri is a hidden precision-metrology annex with long reference galleries, movable calibration shutters, and low-gravity sample handling.", forecast: "Calibration mass shifts alter gallery gravity and dormant reference shutters can re-index firing lanes." };
  if (location === "momentum-exchange") return { briefing: "The cislunar exchange uses long electromagnetic transfer lanes and counter-rotating flywheels to move cargo with almost no propellant.", forecast: "Scheduled countermass washes throw loose bodies across the near-zero-g transfer lane until both capture references are loaded." };
  if (location === "cryo-reserve") return { briefing: "The Umbra reserve stores cryogenic propellant behind narrow tank galleries with deliberately low pressure and weak local gravity.", forecast: "Boiloff purge plumes shove exposed bodies, strip capacitor charge, and cool weapon buses unless both thermal routes are redirected." };
  return { briefing: "", forecast: "" };
}
function deepTargetForLocation(location, archetype = "salvage") {
  if (location === "damaged-vessel") return archetype === "boarding" ? "Boarding Chief Serrin" : archetype === "stabilization" ? "Reactor Custodian Ansel" : "Salvage Interdictor Kade";
  if (location === "asteroid-refinery") return "Foundry Marshal Cael";
  if (location === "spin-habitat") return "Recovery Commander Sable Voss";
  if (location === "jovian-harvester") return "Stormline Foreman Ilex";
  if (location === "ice-mine") return "Salvage Captain Rhea Kade";
  if (location === "solar-yard") return "HELIOS-9 Yardmind";
  if (location === "lattice-annex") return "Khepri Recovery Marshal";
  if (location === "momentum-exchange") return "Exchange Interdictor Neris Vane";
  if (location === "cryo-reserve") return "Reserve Custodian Tamas Veer";
  return "Dock Warden Orison";
}
const megastructureDefinitions = [
  {
    id: "generation-ship",
    title: "Rare Derelict // Generation Ship Perseid",
    siteName: "Generation Ship Perseid",
    sponsor: "longarc",
    archetype: "salvage",
    briefing: "A generation ship absent from traffic records for decades is still rotating under partial automation. Quiet Signal can enter through the docking spine, but every kilometer inward commits more time, suit integrity, and salvage exposure.",
    deepTarget: "Perseid Steward Core",
    rewardBase: { credits: 340, alloys: 6, electronics: 4, medstock: 2, components: 2 },
    reputationGain: 4,
    stages: [
      { name: "Docking Spine", location: "damaged-vessel", objectiveMode: "pressure-recovery", conditions: ["limited-atmosphere", "unstable-pressure"], optionalLabel: "Crew archive canister" },
      { name: "Agricultural Drum", location: "spin-habitat", objectiveMode: "gravity-stabilization", conditions: ["failing-gravity"], optionalLabel: "Seed-vault control core" },
      { name: "Cryogenic Service Deck", location: "orbital-station", objectiveMode: "grid-isolation", conditions: ["damaged-grid", "low-visibility"], optionalLabel: "Cryobank registry" },
      { name: "Reactor Choir", location: "solar-yard", objectiveMode: "machinery-recovery", conditions: ["damaged-grid", "automated-defense"], optionalLabel: "Reactor harmonics recorder" }
    ]
  },
  {
    id: "counterweight",
    title: "Rare Derelict // Counterweight K-91",
    siteName: "Orbital Elevator Counterweight K-91",
    sponsor: "meridian",
    archetype: "stabilization",
    briefing: "A severed orbital-elevator counterweight is tumbling through a managed debris corridor. Its interior remains pressurized in isolated pockets, but no command intelligence is responding. The value is in surviving the whole traverse, not hunting a boss.",
    rewardBase: { credits: 380, alloys: 7, electronics: 5, medstock: 2, components: 3 },
    reputationGain: 4,
    stages: [
      { name: "Capture Collar", location: "orbital-station", objectiveMode: "emergency-boarding", conditions: ["low-visibility"], optionalLabel: "Tether-load recorder" },
      { name: "Mass Transit Spine", location: "spin-habitat", objectiveMode: "gravity-stabilization", conditions: ["failing-gravity", "damaged-grid"], optionalLabel: "Countermass calibration stack" },
      { name: "Power Transfer Gallery", location: "solar-yard", objectiveMode: "grid-isolation", conditions: ["damaged-grid", "automated-defense"], optionalLabel: "Lift-grid fault archive" },
      { name: "Ballast Vault", location: "asteroid-refinery", objectiveMode: "deep-salvage", conditions: ["limited-atmosphere"], optionalLabel: "Ballast telemetry blackbox" }
    ]
  },
  {
    id: "hidden-habitat",
    title: "Rare Derelict // Unregistered Habitat Orpheline",
    siteName: "Unregistered Asteroid Habitat Orpheline",
    sponsor: "heliostat",
    archetype: "boarding",
    briefing: "A thermal shadow reveals an inhabited-scale cavity inside an asteroid that appears in no registry. The habitat is dark, mechanically active, and filled with improvised partitions that suggest it was abandoned in stages rather than all at once.",
    deepTarget: "Orpheline Habitat Warden",
    rewardBase: { credits: 360, alloys: 5, electronics: 7, medstock: 2, components: 3 },
    reputationGain: 4,
    stages: [
      { name: "Ice Access Bore", location: "ice-mine", objectiveMode: "emergency-boarding", conditions: ["low-visibility"], optionalLabel: "Unregistered transit ledger" },
      { name: "Industrial Commons", location: "asteroid-refinery", objectiveMode: "machinery-recovery", conditions: ["damaged-grid"], optionalLabel: "Habitat fabrication key" },
      { name: "Residential Spin Ring", location: "spin-habitat", objectiveMode: "pressure-recovery", conditions: ["unstable-pressure", "failing-gravity"], optionalLabel: "Population registry shard" },
      { name: "Buried Control Vault", location: "orbital-station", objectiveMode: "grid-isolation", conditions: ["automated-defense", "damaged-grid"], optionalLabel: "Founding charter archive" }
    ]
  },
  {
    id: "shipbreaking-yard",
    title: "Rare Derelict // Shipbreaking Yard Hecate",
    siteName: "Abandoned Shipbreaking Yard Hecate",
    sponsor: "longarc",
    archetype: "salvage",
    briefing: "An enormous dismantling yard has drifted beyond its registered work orbit with hundreds of partially stripped hulls still clamped to the frame. The route crosses thermal decks, crusher machinery, and open pressure wreckage before reaching yard control.",
    deepTarget: "Hecate Yardmaster Null",
    rewardBase: { credits: 350, alloys: 9, electronics: 4, medstock: 1, components: 3 },
    reputationGain: 4,
    stages: [
      { name: "Sunward Clamp Field", location: "solar-yard", objectiveMode: "machinery-recovery", conditions: ["automated-defense"], optionalLabel: "Clamp-control spindle" },
      { name: "Crusher Causeway", location: "asteroid-refinery", objectiveMode: "deep-salvage", conditions: ["damaged-grid"], optionalLabel: "High-grade cutter head" },
      { name: "Wreck Transit", location: "damaged-vessel", objectiveMode: "pressure-recovery", conditions: ["limited-atmosphere", "unstable-pressure"], optionalLabel: "Recovered vessel registry" },
      { name: "Yard Control Crown", location: "jovian-harvester", objectiveMode: "grid-isolation", conditions: ["failing-gravity", "damaged-grid"], optionalLabel: "Master salvage ledger" }
    ]
  }
];
function megastructureForCampaign(campaign2) {
  if (campaign2.contractsCompleted < 3 || campaign2.cycle % 5 !== 3) return null;
  return megastructureDefinitions[Math.floor(campaign2.cycle / 5) % megastructureDefinitions.length];
}
function buildMegastructureContract(campaign2, definition) {
  const first = definition.stages[0];
  const missionObjective = missionObjectiveFor(first.objectiveMode, first.location);
  return {
    id: `mega-${campaign2.cycle}-${definition.id}`,
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
    conditionLabels: first.conditions.map((condition) => conditionLabel[condition]),
    directorPreview: "RARE EXPEDITION // four connected combat spaces. Suit damage and telemetry carry forward. Each secured space opens an extraction decision; optional hardware increases the final recovery.",
    deepTarget: definition.deepTarget ?? "No confirmed command target",
    rewardBase: definition.rewardBase,
    reputationGain: definition.reputationGain,
    priority: false,
    anomalyOpportunity: false,
    seed: 700001 + campaign2.cycle * 131071,
    megastructure: definition.id,
    megastructureStageCount: definition.stages.length,
    megastructureZoneNames: definition.stages.map((stage) => stage.name),
    megastructureBossTarget: definition.deepTarget
  };
}
function objectiveModeForContract(campaign2, index, archetype, location) {
  if (!tacticalLocations.has(location)) return defaultObjectiveMode(archetype, location);
  return objectiveModes[(campaign2.cycle * archetypes.length + index) % objectiveModes.length];
}
function generateStandardContracts(campaign2) {
  return archetypes.map((entry, index) => {
    const location = locations[(campaign2.cycle + index) % locations.length];
    const missionObjective = missionObjectiveFor(objectiveModeForContract(campaign2, index, entry.id, location.id), location.id);
    const priority = campaign2.reputation[entry.sponsor] >= 8;
    const anomalyOpportunity = entry.id === "salvage" && !campaign2.anomalyRecovered && campaign2.contractsCompleted >= 2 && campaign2.cycle % 4 === 2;
    let title = "";
    let objective = "";
    let briefing = "";
    let conditions = [];
    let directorPreview = "";
    let deepTarget = "";
    let rewardBase = {};
    let contestedFaction;
    if (entry.id === "salvage") {
      title = priority ? "Priority Recovery // Silent Hold" : "Silent Hold Recovery";
      objective = "Secure the recovery deck and tag usable machinery for extraction.";
      briefing = anomalyOpportunity ? "A Long Arc survey team found valuable machinery around a non-reflective lattice seam that does not match any registered construction method. Recover ordinary salvage first. Do not cut the lattice." : "A stranded worksite still holds intact drives and pressure hardware. Clear the recovery lanes before the structure fails further.";
      conditions = campaign2.cycle % 2 === 0 ? ["limited-atmosphere", "unstable-pressure"] : ["low-visibility", "failing-gravity"];
      directorPreview = "One reserve fireteam enters after the second hostile falls. Structural pressure failure is telegraphed before activation.";
      deepTarget = deepTargetForLocation(location.id, entry.id);
      rewardBase = { credits: 235, alloys: 5, electronics: 2, components: 1 };
    } else if (entry.id === "boarding") {
      title = priority ? "Priority Boarding // Bonded Hold" : "Bonded Hold Boarding";
      objective = "Break the armed boarding line and regain control of the pressure-gated cargo route.";
      briefing = "Meridian insurers claim the cargo is legally bonded; the current holders claim the seizure order is coercive. Your contract is narrower: restore access and prevent habitat systems from becoming weapons.";
      conditions = campaign2.cycle % 2 === 0 ? ["damaged-grid", "automated-defense"] : ["failing-gravity", "damaged-grid"];
      directorPreview = "Two assault reserves enter after the line begins to collapse. Automated hazards activate on fixed, visible timing rather than performance scaling.";
      deepTarget = deepTargetForLocation(location.id, entry.id);
      rewardBase = { credits: 270, alloys: 4, electronics: 3, medstock: 1 };
      contestedFaction = "longarc";
    } else {
      title = priority ? "Priority Stabilization // Reactor Spine" : "Reactor Spine Stabilization";
      objective = "Reach the control spine, suppress armed interference, and keep damaged power systems from cascading.";
      briefing = "Heliostat technicians can stabilize the plant only after hostile controllers and damaged electrical sections are isolated. The machinery is part of the battlefield, not a separate puzzle.";
      conditions = campaign2.cycle % 2 === 0 ? ["failing-gravity", "damaged-grid"] : ["limited-atmosphere", "automated-defense"];
      directorPreview = "A technical reserve deploys after initial contact. Electrical denial fields activate at announced locations and fixed mission times.";
      deepTarget = deepTargetForLocation(location.id, entry.id);
      rewardBase = { credits: 250, electronics: 5, medstock: 2, components: 1 };
    }
    objective = missionObjective.objective;
    const identity = tacticalIdentityForLocation(location.id);
    briefing = `${briefing} ${identity.briefing}`.trim();
    directorPreview = `${directorPreview} ${identity.forecast}`.trim();
    return { id: `cycle-${campaign2.cycle}-${entry.id}`, sponsor: entry.sponsor, archetype: entry.id, location: location.id, locationName: location.name, title, objective, objectiveMode: missionObjective.mode, objectiveSteps: missionObjective.steps, briefing, conditions, conditionLabels: conditions.map((condition) => conditionLabel[condition]), directorPreview, deepTarget, rewardBase, reputationGain: priority ? 3 : 2, contestedFaction, priority, anomalyOpportunity, seed: 1009 + campaign2.cycle * 7919 + index * 104729 };
  });
}
function generateContracts(campaign2) {
  const standard = generateStandardContracts(campaign2);
  const definition = megastructureForCampaign(campaign2);
  if (!definition) return standard;
  const rareContract = buildMegastructureContract(campaign2, definition);
  const replacementIndex = campaign2.cycle % standard.length;
  return standard.map((contract, index) => index === replacementIndex ? rareContract : contract);
}
function walletAdd(target, source, multiplier) {
  for (const key of Object.keys(target)) {
    if (key === "rareTech") continue;
    target[key] += Math.max(0, Math.round((source[key] ?? 0) * multiplier));
  }
}
function settleContract(campaign2, contract, depth, salvageTags, expeditionProgress) {
  const gained = zeroWallet();
  const zonesCompleted = contract.megastructure ? Math.max(1, Math.min(contract.megastructureStageCount ?? 4, 1)) : 1;
  const optionalRecovered = contract.megastructure ? Math.max(0, 0) : 0;
  const expeditionStageMultiplier = contract.megastructure ? [0, 0.75, 1.15, 1.6, 2.05][zonesCompleted] ?? 2.05 : 1;
  const optionalMultiplier = contract.megastructure ? 1 + Math.min(4, optionalRecovered) * 0.08 : 1;
  const depthMultiplier = contract.megastructure ? 1.35 : 1.65;
  const tagMultiplier = 1 + Math.min(10, Math.max(0, salvageTags)) * 0.025;
  const cargoMultiplier = 1 + campaign2.shipUpgrades.cargo * 0.12;
  const priorityMultiplier = contract.priority ? 1.18 : 1;
  const firstDailyCompletion = !!contract.daily && campaign2.dailyCompletedDate !== contract.operationDate;
  const dailyMultiplier = firstDailyCompletion ? 1.15 : 1;
  walletAdd(gained, contract.rewardBase, depthMultiplier * tagMultiplier * cargoMultiplier * priorityMultiplier * dailyMultiplier * expeditionStageMultiplier * optionalMultiplier * (contract.operationRewardMultiplier ?? 1));
  const anomalyRecovered = contract.anomalyOpportunity && !campaign2.anomalyRecovered;
  if (anomalyRecovered) gained.rareTech = 1;
  const expeditionReputation = contract.megastructure ? Math.max(0, zonesCompleted - 1) : 0;
  const requestedReputationDelta = { [contract.sponsor]: contract.reputationGain + expeditionReputation + 2 };
  if (contract.contestedFaction && depth === "deep") requestedReputationDelta[contract.contestedFaction] = -1;
  const reputation = { ...campaign2.reputation };
  const reputationDelta = {};
  for (const [key, delta] of Object.entries(requestedReputationDelta)) {
    const before = reputation[key];
    const after = Math.max(-10, Math.min(20, before + delta));
    reputation[key] = after;
    reputationDelta[key] = after - before;
  }
  const resources = { ...campaign2.resources };
  for (const key of Object.keys(resources)) resources[key] += gained[key];
  const expeditionSummary = contract.megastructure ? ` // ${zonesCompleted}/${contract.megastructureStageCount ?? 4} spaces // ${optionalRecovered} optional recoveries` : "";
  return { campaign: { ...campaign2, cycle: campaign2.cycle + 1, contractsCompleted: campaign2.contractsCompleted + 1, resources, reputation, anomalyRecovered: campaign2.anomalyRecovered || anomalyRecovered, dailyCompletedDate: firstDailyCompletion ? contract.operationDate ?? campaign2.dailyCompletedDate : campaign2.dailyCompletedDate, lastOutcome: `${contract.title} // ${"deep extraction"} // ${salvageTags} salvage tags banked${expeditionSummary}` }, gained, reputationDelta, anomalyRecovered, depth };
}
const point = (x, y) => ({ x, y });
const sharedRoutes = (variant) => {
  const upper = 300 + variant * 14;
  const middle = 515 - variant * 8;
  const lower = 745 + variant * 10;
  return [
    { id: "primary-spine", kind: "primary", points: [point(250, middle), point(650, middle), point(1030, middle), point(1400, middle), point(1730, middle), point(2110, middle)] },
    { id: "upper-loop", kind: "secondary", points: [point(330, middle), point(430, upper), point(870, upper), point(1060, middle), point(1260, upper), point(1430, upper)] },
    { id: "lower-loop", kind: "secondary", points: [point(350, middle), point(520, lower), point(930, lower), point(1110, middle), point(1280, lower), point(1430, lower)] },
    { id: "deep-upper", kind: "secondary", points: [point(1545, middle), point(1710, upper), point(2100, upper)] },
    { id: "deep-lower", kind: "secondary", points: [point(1550, middle), point(1760, lower), point(2110, lower)] },
    { id: "cross-a", kind: "connector", points: [point(590, upper), point(590, lower)] },
    { id: "cross-b", kind: "connector", points: [point(1160, upper), point(1160, lower)] },
    { id: "cross-c", kind: "connector", points: [point(1910, upper), point(1910, lower)] }
  ];
};
const variants = {
  "orbital-station": 0,
  "damaged-vessel": -2,
  "asteroid-refinery": 2,
  "spin-habitat": -1,
  "jovian-harvester": 1,
  "ice-mine": -3,
  "solar-yard": 3,
  "lattice-annex": -1,
  "momentum-exchange": 2,
  "cryo-reserve": -2
};
function getMapNavigationPlan(location) {
  const variant = variants[location] ?? 0;
  const routes = sharedRoutes(variant);
  const labels = {
    "orbital-station": ["SPIN ACCESS", "TRANSFER BAY", "CRANE WELL"],
    "damaged-vessel": ["FORE HAB", "CARGO SPINE", "ENGINE VAULT"],
    "asteroid-refinery": ["CRUSHER DECK", "ORE TRANSFER", "REACTOR GANTRY"],
    "spin-habitat": ["RIM HAB", "SPOKE TRANSIT", "AXIS HUB"],
    "jovian-harvester": ["PRESSURE LOCK", "SKIMMER DECK", "COMPRESSOR CROWN"],
    "ice-mine": ["ACCESS BORE", "EXTRACTION TUNNEL", "SUBGLACIAL VAULT"],
    "solar-yard": ["SHADE GANTRY", "FABRICATION SPINE", "SUNWARD YARD"],
    "lattice-annex": ["METROLOGY RING", "REFERENCE GALLERY", "SAMPLE VAULT"],
    "momentum-exchange": ["BRAKE DECK", "TRANSFER TUNNEL", "COUNTERMASS CRADLE"],
    "cryo-reserve": ["SERVICE COLLAR", "PROPELLANT GALLERY", "UMBRA TANK FARM"]
  };
  const [a, b, c] = labels[location];
  return {
    routes,
    landmarks: [
      { id: "zone-a", label: a, x: 455, y: 205, scale: 1 },
      { id: "zone-b", label: b, x: 1100, y: 205, scale: 1 },
      { id: "zone-c", label: c, x: 1860, y: 205, scale: 1 }
    ]
  };
}
function solidNavigationObject(object) {
  return object.active && (object.kind === "cover" || object.kind === "conduit" || object.kind === "coolant" || object.kind === "breachPlate" || object.kind === "anchorNode");
}
function distancePointToSegment(pointValue, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-3) return Math.hypot(pointValue.x - a.x, pointValue.y - a.y);
  const t = Math.max(0, Math.min(1, ((pointValue.x - a.x) * vx + (pointValue.y - a.y) * vy) / len2));
  return Math.hypot(pointValue.x - (a.x + vx * t), pointValue.y - (a.y + vy * t));
}
function rectRouteDistance(object, a, b) {
  const samples = [
    point(object.x, object.y),
    point(object.x + object.w, object.y),
    point(object.x, object.y + object.h),
    point(object.x + object.w, object.y + object.h),
    point(object.x + object.w / 2, object.y + object.h / 2)
  ];
  return Math.min(...samples.map((sample) => distancePointToSegment(sample, a, b)));
}
function reserveNavigationLanes(state, location) {
  const plan = getMapNavigationPlan(location);
  const protectedIds = /* @__PURE__ */ new Set(["boss-gate", "boss-seal", "service-plate", "door-control", "gravity-control", "service-seal", "boarding-lock", "grid-isolator-a", "grid-isolator-b", "gravity-control-a", "gravity-control-b", "salvage-node-a", "salvage-node-b", "salvage-node-c", "capture-drum-a", "capture-drum-b", "purge-valve-a", "purge-valve-b", "mega-optional-cache"]);
  const routes = plan.routes.filter((route) => route.kind !== "connector");
  let relocationIndex = 0;
  const pads = [
    point(500, 215),
    point(690, 800),
    point(920, 210),
    point(1080, 800),
    point(1300, 215),
    point(1410, 800),
    point(1710, 215),
    point(1780, 800),
    point(2020, 225),
    point(2110, 785)
  ];
  for (const object of state.objects) {
    if (!solidNavigationObject(object) || protectedIds.has(object.id) || object.id.startsWith("enemy-tether") || object.id.startsWith("foundry-anchor") || object.id.startsWith("field-anchor") || object.id.startsWith("lattice-reference")) continue;
    let tooClose = false;
    for (const route of routes) {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        if (rectRouteDistance(object, route.points[index], route.points[index + 1]) < 78) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) break;
    }
    if (!tooClose) continue;
    const pad = pads[relocationIndex % pads.length];
    relocationIndex += 1;
    object.x = Math.max(120, Math.min(2180 - object.w, pad.x - object.w / 2));
    object.y = Math.max(175, Math.min(900 - object.h, pad.y - object.h / 2));
    if (object.w > 150) object.w = 150;
    if (object.h > 150) object.h = 150;
  }
}
function patchObject(state, id, patch) {
  const object = state.objects.find((item) => item.id === id);
  if (object) Object.assign(object, patch);
}
function addObject(state, object) {
  if (!state.objects.some((item) => item.id === object.id)) state.objects.push(object);
}
function systemObject(id, label, kind, x, y, w = 46, h = 58) {
  return {
    id,
    label,
    kind,
    material: "system",
    x,
    y,
    w,
    h,
    hp: kind === "anchorNode" ? 92 : 40,
    maxHp: kind === "anchorNode" ? 92 : 40,
    destructible: kind === "anchorNode",
    active: true,
    exposed: false
  };
}
function coverObject(id, label, x, y, w, h, material = "bulkhead") {
  return {
    id,
    label,
    kind: "cover",
    material,
    x,
    y,
    w,
    h,
    hp: material === "light" ? 68 : material === "industrial" ? 190 : 9999,
    maxHp: material === "light" ? 68 : material === "industrial" ? 190 : 9999,
    destructible: material !== "bulkhead",
    active: true,
    exposed: false
  };
}
function configureDamagedVessel(state) {
  patchObject(state, "crate-a", { label: "Bunk cargo rack", x: 430, y: 270, w: 150, h: 110, hp: 72, maxHp: 72 });
  patchObject(state, "bulkhead-a", { label: "Hab pressure trunk", x: 670, y: 335, w: 205, h: 72 });
  patchObject(state, "crate-b", { label: "Loose freight frame", x: 930, y: 680, w: 130, h: 120, hp: 66, maxHp: 66 });
  patchObject(state, "bulkhead-b", { label: "Cargo spine machinery", x: 1125, y: 425, w: 82, h: 275, hp: 205, maxHp: 205 });
  patchObject(state, "conduit-a", { label: "Life-support bus", x: 1010, y: 260, w: 72, h: 72 });
  patchObject(state, "coolant-a", { label: "Suit-loop manifold", x: 620, y: 690, w: 52, h: 88 });
  patchObject(state, "service-plate", { label: "Split hull service plate", x: 1360, y: 465, w: 96, h: 72, hp: 78, maxHp: 78 });
  patchObject(state, "door-control", { label: "Hab pressure interlock", x: 742, y: 500 });
  patchObject(state, "gravity-control", { label: "Cargo spin trim", x: 1260, y: 760 });
  patchObject(state, "arena-cover", { label: "Drive service cage", x: 1880, y: 510, w: 92, h: 270, hp: 205, maxHp: 205 });
  patchObject(state, "arena-conduit", { label: "Engine vault bus", x: 2070, y: 760 });
  patchObject(state, "boss-seal", { label: "Engine vault shutter", x: 1715, y: 700 });
  const serviceBreach = state.breaches.find((item) => item.id === "service-breach");
  if (serviceBreach) Object.assign(serviceBreach, { x: 1440, y: 505, radius: 540, strength: 880 });
  addObject(state, coverObject("vessel-rib-a-top", "Pressure rib A", 820, 160, 42, 190));
  addObject(state, coverObject("vessel-rib-a-bottom", "Pressure rib A", 820, 730, 42, 190));
  addObject(state, coverObject("vessel-rib-b-top", "Pressure rib B", 1215, 160, 42, 155));
  addObject(state, coverObject("vessel-rib-b-bottom", "Pressure rib B", 1215, 765, 42, 155));
  addObject(state, coverObject("vessel-side-locker", "Pressure locker", 1010, 470, 110, 62, "industrial"));
}
function configureRefinery(state) {
  patchObject(state, "crate-a", { label: "Ore sample bin", x: 560, y: 285, w: 105, h: 105, hp: 82, maxHp: 82 });
  patchObject(state, "bulkhead-a", { label: "Crusher bearing", x: 760, y: 725, w: 135, h: 82 });
  patchObject(state, "crate-b", { label: "Transfer dolly", x: 980, y: 520, w: 110, h: 105, hp: 74, maxHp: 74 });
  patchObject(state, "bulkhead-b", { label: "Ore separator", x: 1285, y: 280, w: 135, h: 115, hp: 225, maxHp: 225 });
  patchObject(state, "conduit-a", { label: "Crusher drive bus", x: 1180, y: 790, w: 84, h: 72 });
  patchObject(state, "coolant-a", { label: "Quench riser", x: 850, y: 500, w: 58, h: 94 });
  patchObject(state, "service-plate", { active: false });
  patchObject(state, "door-control", { label: "Ore transfer interlock", x: 690, y: 760 });
  patchObject(state, "gravity-control", { label: "Transfer gravitic trim", x: 1120, y: 215 });
  patchObject(state, "arena-cover", { label: "Foundry heat exchanger", x: 1960, y: 680, w: 140, h: 100, hp: 230, maxHp: 230 });
  patchObject(state, "arena-conduit", { label: "Foundry trunk", x: 1835, y: 300, w: 90, h: 76 });
  patchObject(state, "boss-seal", { active: false });
  addObject(state, coverObject("refinery-island-a", "Crusher drive housing", 690, 430, 150, 66, "industrial"));
  addObject(state, coverObject("refinery-island-b", "Ore lift pedestal", 1110, 690, 125, 78, "industrial"));
  addObject(state, coverObject("refinery-island-c", "Reactor feed manifold", 1360, 520, 108, 88, "industrial"));
  addObject(state, coverObject("refinery-arena-island", "Foundry coolant bank", 1780, 475, 125, 78, "industrial"));
  const anchorA = systemObject("foundry-anchor-a", "Foundry anchor node A", "anchorNode", 1760, 270, 58, 58);
  const anchorB = systemObject("foundry-anchor-b", "Foundry anchor node B", "anchorNode", 2110, 690, 58, 58);
  anchorA.active = false;
  anchorB.active = false;
  addObject(state, anchorA);
  addObject(state, anchorB);
  const fieldAnchorA = systemObject("field-anchor-a", "Stabilization node A", "anchorNode", 1220, 420, 50, 50);
  const fieldAnchorB = systemObject("field-anchor-b", "Stabilization node B", "anchorNode", 1380, 690, 50, 50);
  fieldAnchorA.hp = 68;
  fieldAnchorA.maxHp = 68;
  fieldAnchorA.active = false;
  fieldAnchorB.hp = 68;
  fieldAnchorB.maxHp = 68;
  fieldAnchorB.active = false;
  addObject(state, fieldAnchorA);
  addObject(state, fieldAnchorB);
  const elite = state.enemies.find((enemy) => enemy.id === 6);
  if (elite) {
    elite.label = "Anchor Engineer";
    elite.variant = "anchorEngineer";
    elite.hp = 150;
    elite.maxHp = 150;
    elite.armor = 112;
    elite.maxArmor = 112;
  }
  const skirmisher = state.enemies.find((enemy) => enemy.id === 4);
  if (skirmisher) {
    skirmisher.label = "Vector Skirmisher";
    skirmisher.variant = "vectorSkirmisher";
    skirmisher.hp = 88;
    skirmisher.maxHp = 88;
    skirmisher.armor = 42;
    skirmisher.maxArmor = 42;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "foundryMarshal";
    boss.hp = 610;
    boss.maxHp = 610;
    boss.armor = 210;
    boss.maxArmor = 210;
  }
}
function configureSpinHabitat(state) {
  patchObject(state, "crate-a", { label: "Rim provisions rack", x: 470, y: 720, w: 115, h: 105, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-a", { label: "Ring bearing housing", x: 690, y: 260, w: 95, h: 225 });
  patchObject(state, "crate-b", { label: "Spoke cargo trolley", x: 990, y: 300, w: 120, h: 105, hp: 66, maxHp: 66 });
  patchObject(state, "bulkhead-b", { label: "Spin-drive service bank", x: 1180, y: 620, w: 175, h: 78, hp: 205, maxHp: 205 });
  patchObject(state, "conduit-a", { label: "Ring drive bus", x: 1120, y: 245, w: 78, h: 70 });
  patchObject(state, "coolant-a", { label: "Bearing coolant loop", x: 835, y: 680, w: 54, h: 90 });
  patchObject(state, "service-plate", { label: "Rim pressure panel", x: 1370, y: 760, w: 100, h: 60, hp: 78, maxHp: 78 });
  patchObject(state, "door-control", { label: "Spoke pressure interlock", x: 735, y: 520 });
  patchObject(state, "gravity-control", { label: "Spoke spin trim", x: 1280, y: 245 });
  patchObject(state, "arena-cover", { label: "Axis momentum wheel", x: 1880, y: 470, w: 120, h: 120, hp: 205, maxHp: 205 });
  patchObject(state, "arena-conduit", { label: "Axis power trunk", x: 2040, y: 720 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1430, y: 790, radius: 520, strength: 900 });
  addObject(state, coverObject("spin-ring-wall-a", "Ring pressure rib", 760, 160, 46, 210));
  addObject(state, coverObject("spin-ring-wall-b", "Ring pressure rib", 760, 690, 46, 230));
  addObject(state, coverObject("spin-spoke-brace-a", "Spoke brace", 1010, 470, 165, 54, "industrial"));
  addObject(state, coverObject("spin-spoke-brace-b", "Spoke brace", 1285, 420, 145, 54, "industrial"));
  for (const [id, label, x, y, w, h] of [
    ["meridian-barricade-a", "Portable Palisade A", 900, 570, 104, 42],
    ["meridian-barricade-b", "Portable Palisade B", 1210, 330, 104, 42],
    ["meridian-pressure-door", "Emergency pressure lane", 760, 455, 42, 170],
    ["commander-barricade-a", "Command Palisade A", 1750, 310, 118, 46],
    ["commander-barricade-b", "Command Palisade B", 2010, 650, 118, 46],
    ["commander-pressure-door-a", "Command pressure shutter A", 1850, 430, 46, 160],
    ["commander-pressure-door-b", "Command pressure shutter B", 2080, 350, 46, 160]
  ]) {
    const barrier = coverObject(id, label, x, y, w, h, "industrial");
    barrier.active = false;
    barrier.hp = id.includes("pressure-door") ? 145 : 112;
    barrier.maxHp = barrier.hp;
    addObject(state, barrier);
  }
  const palisadeA = state.enemies.find((enemy) => enemy.id === 1);
  if (palisadeA) {
    palisadeA.label = "Meridian Palisade Trooper";
    palisadeA.variant = "barricadeTrooper";
    palisadeA.armor = 82;
    palisadeA.maxArmor = 82;
  }
  const lockTech = state.enemies.find((enemy) => enemy.id === 3);
  if (lockTech) {
    lockTech.role = "technician";
    lockTech.label = "Meridian Lock Technician";
    lockTech.variant = "pressureLockTech";
    lockTech.armor = 66;
    lockTech.maxArmor = 66;
  }
  const palisadeB = state.enemies.find((enemy) => enemy.id === 4);
  if (palisadeB) {
    palisadeB.label = "Meridian Recovery Trooper";
    palisadeB.variant = "barricadeTrooper";
    palisadeB.armor = 78;
    palisadeB.maxArmor = 78;
  }
  const bulwark = state.enemies.find((enemy) => enemy.id === 6);
  if (bulwark) {
    bulwark.label = "Meridian Recovery Bulwark";
    bulwark.variant = "barricadeTrooper";
    bulwark.armor = 142;
    bulwark.maxArmor = 142;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "meridianCommander";
    boss.hp = 680;
    boss.maxHp = 680;
    boss.armor = 320;
    boss.maxArmor = 320;
  }
}
function configureJovianHarvester(state) {
  patchObject(state, "crate-a", { label: "Skimmer valve crate", x: 430, y: 300, w: 110, h: 100, hp: 68, maxHp: 68 });
  patchObject(state, "bulkhead-a", { label: "Storm truss footing", x: 650, y: 650, w: 150, h: 72 });
  patchObject(state, "crate-b", { label: "Separator service rack", x: 965, y: 735, w: 115, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-b", { label: "Compressor pressure shell", x: 1210, y: 300, w: 155, h: 92, hp: 215, maxHp: 215 });
  patchObject(state, "conduit-a", { label: "Electrostatic skimmer bus", x: 1090, y: 520, w: 80, h: 72 });
  patchObject(state, "coolant-a", { label: "Cryopump return riser", x: 790, y: 430, w: 55, h: 92 });
  patchObject(state, "service-plate", { label: "Storm relief plate", x: 1390, y: 190, w: 84, h: 68, hp: 72, maxHp: 72 });
  patchObject(state, "door-control", { label: "Inner storm lock", x: 610, y: 250 });
  patchObject(state, "gravity-control", { label: "Compressor mass trim", x: 1300, y: 760 });
  patchObject(state, "arena-cover", { label: "Compressor crown", x: 1910, y: 360, w: 155, h: 86, hp: 220, maxHp: 220 });
  patchObject(state, "arena-conduit", { label: "Harvester crown bus", x: 2050, y: 735 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1450, y: 220, radius: 760, strength: 1450 });
  addObject(state, coverObject("gas-truss-a", "Maintenance truss A", 720, 470, 155, 52, "industrial"));
  addObject(state, coverObject("gas-truss-b", "Maintenance truss B", 980, 330, 145, 52, "industrial"));
  addObject(state, coverObject("gas-truss-c", "Maintenance truss C", 1260, 650, 155, 52, "industrial"));
}
function configureIceMine(state) {
  patchObject(state, "crate-a", { label: "Cryobore tool pallet", x: 370, y: 500, w: 105, h: 95, hp: 62, maxHp: 62 });
  patchObject(state, "bulkhead-a", { label: "Haulage motor", x: 655, y: 420, w: 120, h: 76 });
  patchObject(state, "crate-b", { label: "Volatile sample cage", x: 945, y: 270, w: 105, h: 95, hp: 60, maxHp: 60 });
  patchObject(state, "bulkhead-b", { label: "Cryobore separator", x: 1260, y: 660, w: 145, h: 90, hp: 180, maxHp: 180 });
  patchObject(state, "conduit-a", { label: "Thaw-grid trunk", x: 1110, y: 260, w: 74, h: 68 });
  patchObject(state, "coolant-a", { label: "Volatile chill line", x: 875, y: 690, w: 54, h: 88 });
  patchObject(state, "service-plate", { label: "Fractured bore pressure plate", x: 1375, y: 505, w: 88, h: 64, hp: 66, maxHp: 66 });
  patchObject(state, "door-control", { label: "Access-bore lock", x: 580, y: 520 });
  patchObject(state, "gravity-control", { label: "Deep-bore haulage trim", x: 1280, y: 280 });
  patchObject(state, "arena-cover", { label: "Subglacial separator drum", x: 1880, y: 580, w: 135, h: 92, hp: 180, maxHp: 180 });
  patchObject(state, "arena-conduit", { label: "Vault thaw bus", x: 2060, y: 300 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1430, y: 535, radius: 500, strength: 780 });
  addObject(state, coverObject("ice-wall-a-top", "Bore wall", 540, 160, 55, 245));
  addObject(state, coverObject("ice-wall-a-bottom", "Bore wall", 540, 635, 55, 285));
  addObject(state, coverObject("ice-wall-b-top", "Extraction wall", 1035, 160, 55, 155));
  addObject(state, coverObject("ice-wall-b-bottom", "Extraction wall", 1035, 535, 55, 385));
  addObject(state, coverObject("ice-brittle-gate-a", "Brittle ice support A", 760, 445, 115, 58, "light"));
  addObject(state, coverObject("ice-brittle-gate-b", "Brittle ice support B", 1190, 455, 110, 58, "light"));
  const riggerA = state.enemies.find((enemy) => enemy.id === 1);
  if (riggerA) {
    riggerA.label = "Long Arc Backblast Rigger";
    riggerA.variant = "vectorSkirmisher";
    riggerA.hp = 86;
    riggerA.maxHp = 86;
  }
  const tether = state.enemies.find((enemy) => enemy.id === 3);
  if (tether) {
    tether.role = "technician";
    tether.label = "Long Arc Tether Hand";
    tether.variant = "tetherRigger";
    tether.hp = 76;
    tether.maxHp = 76;
  }
  const riggerB = state.enemies.find((enemy) => enemy.id === 4);
  if (riggerB) {
    riggerB.label = "Long Arc Recoil Cutter";
    riggerB.variant = "vectorSkirmisher";
    riggerB.hp = 90;
    riggerB.maxHp = 90;
  }
  const foreman = state.enemies.find((enemy) => enemy.id === 6);
  if (foreman) {
    foreman.label = "Long Arc Jury-Rig Foreman";
    foreman.variant = "tetherRigger";
    foreman.armor = 96;
    foreman.maxArmor = 96;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "salvageCaptain";
    boss.hp = 605;
    boss.maxHp = 605;
    boss.armor = 165;
    boss.maxArmor = 165;
  }
}
function configureSolarYard(state) {
  patchObject(state, "crate-a", { label: "Mirror actuator crate", x: 460, y: 265, w: 115, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-a", { label: "Shade gantry bearing", x: 690, y: 690, w: 150, h: 74 });
  patchObject(state, "crate-b", { label: "Printer spindle pallet", x: 980, y: 510, w: 110, h: 100, hp: 68, maxHp: 68 });
  patchObject(state, "bulkhead-b", { label: "Fabrication heat bank", x: 1240, y: 265, w: 150, h: 100, hp: 210, maxHp: 210 });
  patchObject(state, "conduit-a", { label: "Sunward fabrication bus", x: 1120, y: 760, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Radiator coolant riser", x: 845, y: 420, w: 58, h: 92 });
  patchObject(state, "service-plate", { label: "Radiator pressure plate", x: 1390, y: 650, w: 88, h: 66, hp: 74, maxHp: 74 });
  patchObject(state, "door-control", { label: "Shade-side pressure lock", x: 650, y: 280 });
  patchObject(state, "gravity-control", { label: "Fabrication gantry trim", x: 1300, y: 760 });
  patchObject(state, "arena-cover", { label: "Sunward print carriage", x: 1910, y: 500, w: 155, h: 88, hp: 225, maxHp: 225 });
  patchObject(state, "arena-conduit", { label: "Sunward power trunk", x: 2060, y: 285 });
  const breach = state.breaches.find((item) => item.id === "service-breach");
  if (breach) Object.assign(breach, { x: 1440, y: 680, radius: 520, strength: 840 });
  addObject(state, systemObject("solar-shutter", "Local thermal shutters", "doorControl", 930, 220));
  addObject(state, coverObject("solar-radiator-a", "Radiator bank A", 760, 420, 135, 58, "industrial"));
  addObject(state, coverObject("solar-radiator-b", "Radiator bank B", 1160, 610, 145, 58, "industrial"));
  for (const [id, label, x, y] of [
    ["yard-door-a", "Autonomous fabrication shutter A", 1760, 345],
    ["yard-door-b", "Autonomous fabrication shutter B", 2020, 610]
  ]) {
    const door = coverObject(id, label, x, y, 52, 170, "industrial");
    door.active = false;
    door.hp = 150;
    door.maxHp = 150;
    addObject(state, door);
  }
  const interceptor = state.enemies.find((enemy) => enemy.id === 1);
  if (interceptor) {
    interceptor.label = "Maintenance Interceptor";
    interceptor.variant = "maintenanceDrone";
    interceptor.hp = 68;
    interceptor.maxHp = 68;
    interceptor.armor = 34;
    interceptor.maxArmor = 34;
  }
  const gravityDrone = state.enemies.find((enemy) => enemy.id === 2);
  if (gravityDrone) {
    gravityDrone.label = "Mass-Trim Drone";
    gravityDrone.variant = "gravityDrone";
    gravityDrone.hp = 72;
    gravityDrone.maxHp = 72;
  }
  const serviceDrone = state.enemies.find((enemy) => enemy.id === 3);
  if (serviceDrone) {
    serviceDrone.label = "Fabrication Service Drone";
    serviceDrone.variant = "maintenanceDrone";
    serviceDrone.hp = 64;
    serviceDrone.maxHp = 64;
  }
  const cutterDrone = state.enemies.find((enemy) => enemy.id === 4);
  if (cutterDrone) {
    cutterDrone.label = "Arc-Cutter Drone";
    cutterDrone.variant = "maintenanceDrone";
  }
  const relay = state.enemies.find((enemy) => enemy.id === 6);
  if (relay) {
    relay.label = "Autonomous Control Relay";
    relay.variant = "gravityDrone";
    relay.hp = 132;
    relay.maxHp = 132;
    relay.armor = 92;
    relay.maxArmor = 92;
  }
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) {
    boss.variant = "yardmind";
    boss.hp = 560;
    boss.maxHp = 560;
    boss.armor = 235;
    boss.maxArmor = 235;
    boss.x = 2060;
    boss.y = 520;
  }
}
function configureMomentumExchange(state) {
  patchObject(state, "crate-a", { label: "Capture-collar pallet", x: 410, y: 300, w: 120, h: 96, hp: 72, maxHp: 72 });
  patchObject(state, "bulkhead-a", { label: "Inbound flywheel housing", x: 650, y: 660, w: 165, h: 72, hp: 210, maxHp: 210 });
  patchObject(state, "crate-b", { label: "Transfer cradle dolly", x: 980, y: 270, w: 118, h: 100, hp: 70, maxHp: 70 });
  patchObject(state, "bulkhead-b", { label: "Outbound flywheel housing", x: 1240, y: 690, w: 165, h: 72, hp: 210, maxHp: 210 });
  patchObject(state, "conduit-a", { label: "Countermass bus", x: 1110, y: 510, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Flywheel bearing loop", x: 850, y: 420, w: 58, h: 92 });
  patchObject(state, "service-plate", { label: "Transfer-lane service panel", x: 1400, y: 300, w: 90, h: 68, hp: 74, maxHp: 74 });
  patchObject(state, "door-control", { label: "Inbound capture collar", x: 610, y: 275 });
  patchObject(state, "gravity-control", { label: "Outbound mass trim", x: 1320, y: 760 });
  patchObject(state, "arena-cover", { label: "Deep counterweight cradle", x: 1910, y: 520, w: 150, h: 90, hp: 225, maxHp: 225 });
  patchObject(state, "arena-conduit", { label: "Exchange reference bus", x: 2070, y: 285 });
  addObject(state, coverObject("momentum-rail-a", "Electromagnetic transfer rail A", 760, 370, 180, 48, "industrial"));
  addObject(state, coverObject("momentum-rail-b", "Electromagnetic transfer rail B", 1090, 640, 180, 48, "industrial"));
  addObject(state, coverObject("momentum-baffle", "Countermass service baffle", 1410, 470, 110, 58, "light"));
}
function configureCryoReserve(state) {
  patchObject(state, "crate-a", { label: "Valve service cassette", x: 400, y: 700, w: 110, h: 96, hp: 68, maxHp: 68 });
  patchObject(state, "bulkhead-a", { label: "LH2 tank saddle", x: 650, y: 290, w: 145, h: 88, hp: 220, maxHp: 220 });
  patchObject(state, "crate-b", { label: "Insulation repair rack", x: 960, y: 730, w: 110, h: 98, hp: 66, maxHp: 66 });
  patchObject(state, "bulkhead-b", { label: "Methane reserve saddle", x: 1230, y: 290, w: 150, h: 90, hp: 220, maxHp: 220 });
  patchObject(state, "conduit-a", { label: "Cryopump power trunk", x: 1100, y: 520, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Boiloff return header", x: 820, y: 520, w: 58, h: 94 });
  patchObject(state, "service-plate", { label: "Vacuum-jacket service plate", x: 1390, y: 700, w: 90, h: 68, hp: 72, maxHp: 72 });
  patchObject(state, "door-control", { label: "Service collar lock", x: 610, y: 760 });
  patchObject(state, "gravity-control", { label: "Tank-farm mass trim", x: 1310, y: 245 });
  patchObject(state, "arena-cover", { label: "Umbra transfer manifold", x: 1900, y: 560, w: 150, h: 90, hp: 215, maxHp: 215 });
  patchObject(state, "arena-conduit", { label: "Reserve pump bus", x: 2070, y: 300 });
  addObject(state, coverObject("cryo-tank-a", "Vacuum-jacket tank A", 760, 390, 125, 78, "industrial"));
  addObject(state, coverObject("cryo-tank-b", "Vacuum-jacket tank B", 1010, 610, 125, 78, "industrial"));
  addObject(state, coverObject("cryo-tank-c", "Vacuum-jacket tank C", 1320, 410, 125, 78, "industrial"));
  addObject(state, coverObject("cryo-insulation", "Brittle insulation screen", 1450, 650, 105, 52, "light"));
}
function configureInterdictionCommand(state, contract) {
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  if (contract.deepTarget === "Transfer Adjudicator Iona Vale") {
    for (const [id, x, y] of [["transfer-partition-a", 930, 300], ["transfer-partition-b", 1180, 610], ["transfer-partition-c", 1880, 430]]) {
      const partition = coverObject(id, "Movable custody pressure partition", x, y, 58, 180, "industrial");
      partition.active = false;
      partition.hp = 125;
      partition.maxHp = 125;
      addObject(state, partition);
    }
    boss.variant = "transferAdjudicator";
    boss.hp = 700;
    boss.maxHp = 700;
    boss.armor = 225;
    boss.maxArmor = 225;
    boss.anchored = false;
  } else if (contract.deepTarget === "Umbra Systems Marshal Oren Saal") {
    for (const [id, x, y] of [["siphon-node-a", 980, 390], ["siphon-node-b", 1280, 680], ["boss-siphon-a", 1800, 315], ["boss-siphon-b", 2110, 700]]) {
      const node = systemObject(id, "Capacitor siphon relay", "anchorNode", x, y, 48, 48);
      node.active = false;
      node.hp = 68;
      node.maxHp = 68;
      addObject(state, node);
    }
    boss.variant = "umbraMarshal";
    boss.hp = 690;
    boss.maxHp = 690;
    boss.armor = 210;
    boss.maxArmor = 210;
    boss.anchored = false;
  } else if (contract.deepTarget === "Custody Director Mara Teth") {
    for (const [id, x, y] of [["custody-shutter-a", 1030, 330], ["custody-shutter-b", 1320, 610], ["custody-shutter-c", 1900, 450]]) {
      const shutter = coverObject(id, "Custody geometry shutter", x, y, 54, 170, "industrial");
      shutter.active = false;
      shutter.hp = 125;
      shutter.maxHp = 125;
      addObject(state, shutter);
    }
    for (const [id, x, y] of [["custody-reference-a", 1740, 280], ["custody-reference-b", 1980, 510], ["custody-reference-c", 2150, 735]]) {
      const node = systemObject(id, "Custody reference relay", "anchorNode", x, y, 50, 50);
      node.active = true;
      node.exposed = true;
      node.hp = 72;
      node.maxHp = 72;
      addObject(state, node);
    }
    boss.variant = "custodyDirector";
    boss.hp = 710;
    boss.maxHp = 710;
    boss.armor = 215;
    boss.maxArmor = 215;
    boss.anchored = false;
  }
}
function objectivePosition(contract, index) {
  const positionsByLocation = {
    "damaged-vessel": [{ x: 560, y: 255 }, { x: 1010, y: 800 }, { x: 1360, y: 690 }],
    "asteroid-refinery": [{ x: 530, y: 760 }, { x: 930, y: 245 }, { x: 1350, y: 760 }],
    "spin-habitat": [{ x: 465, y: 760 }, { x: 930, y: 260 }, { x: 1360, y: 700 }],
    "jovian-harvester": [{ x: 430, y: 285 }, { x: 930, y: 760 }, { x: 1370, y: 270 }],
    "ice-mine": [{ x: 390, y: 530 }, { x: 900, y: 350 }, { x: 1360, y: 690 }],
    "solar-yard": [{ x: 500, y: 270 }, { x: 980, y: 760 }, { x: 1380, y: 330 }],
    "lattice-annex": [{ x: 480, y: 720 }, { x: 990, y: 270 }, { x: 1420, y: 710 }],
    "momentum-exchange": [{ x: 520, y: 710 }, { x: 980, y: 280 }, { x: 1390, y: 720 }],
    "cryo-reserve": [{ x: 500, y: 280 }, { x: 980, y: 760 }, { x: 1390, y: 300 }]
  };
  const positions = positionsByLocation[contract.location] ?? [{ x: 540, y: 270 }, { x: 1040, y: 785 }, { x: 1375, y: 300 }];
  return positions[index] ?? positions[positions.length - 1];
}
function objectiveNames(contract) {
  const authored = {
    "spin-habitat": { pressure: "Rim pressure manifold", grid: ["Rim spin-bus isolator", "Spoke spin-bus isolator"], gravity: ["Rim gravity trim", "Spoke gravity trim"], machinery: ["Bearing-control package", "Attitude-flywheel package"], boarding: ["Spoke pressure interlock", "Axis pressure lock"], salvage: ["Rim recovery cache", "Spoke recovery cache", "Axis recovery cache"] },
    "jovian-harvester": { pressure: "Storm relief manifold", grid: ["Skimmer bus isolator", "Compressor bus isolator"], gravity: ["Maintenance-deck mass trim", "Compressor-crown mass trim"], machinery: ["Skimmer compressor package", "Separator package"], boarding: ["Inner storm lock", "Outer maintenance lock"], salvage: ["Intake recovery package", "Separator recovery package", "Compressor recovery package"] },
    "ice-mine": { pressure: "Bore pressure manifold", grid: ["Upper thaw-grid isolator", "Deep thaw-grid isolator"], gravity: ["Haulage gravity trim", "Deep-bore gravity trim"], machinery: ["Cryobore cutter package", "Volatile separator package"], boarding: ["Access-bore lock", "Deep-tunnel lock"], salvage: ["Access-bore cache", "Extraction-tunnel cache", "Subglacial vault cache"] },
    "solar-yard": { pressure: "Radiator pressure manifold", grid: ["Shade-side solar isolator", "Sunward solar isolator"], gravity: ["Shade-gantry gravity trim", "Fabrication-spine gravity trim"], machinery: ["Mirror actuator package", "Printer spindle package"], boarding: ["Shade-side pressure lock", "Sunward pressure lock"], salvage: ["Shade-gantry package", "Fabrication-spine package", "Sunward yard package"] },
    "lattice-annex": { pressure: "Khepri sample-vault manifold", grid: ["Cold-ring archive isolator", "Sample-vault archive isolator"], gravity: ["Metrology-ring mass trim", "Reference-gallery mass trim"], machinery: ["Precision carriage package", "Cryogenic reference package"], boarding: ["Reference gallery interlock", "Sample vault pressure lock"], salvage: ["Cold-ring metrology archive", "Reference-gallery archive", "Sample-vault custody record"] },
    "momentum-exchange": { pressure: "Transfer pressure manifold", grid: ["Inbound bus isolator", "Outbound bus isolator"], gravity: ["Inbound mass trim", "Outbound mass trim"], machinery: ["Capture flywheel package", "Transfer cradle package"], boarding: ["Inbound capture collar", "Outbound pressure lock"], salvage: ["Inbound ledger core", "Transfer timing core", "Countermass reference core"] },
    "cryo-reserve": { pressure: "Vacuum-jacket manifold", grid: ["Cryopump isolator A", "Cryopump isolator B"], gravity: ["Service-collar mass trim", "Tank-farm mass trim"], machinery: ["Cryopump package", "Boiloff separator package"], boarding: ["Service collar lock", "Tank-farm pressure lock"], salvage: ["Valve archive", "Propellant ledger core", "Umbra pump controller"] }
  };
  return authored[contract.location] ?? { pressure: "Emergency pressure manifold", grid: ["Grid isolator A", "Grid isolator B"], gravity: ["Deck gravity trim", "Transfer gravity trim"], machinery: ["Machinery package A", "Machinery package B"], boarding: ["Pressure interlock A", "Pressure interlock B"], salvage: ["Recovery package A", "Recovery package B", "Recovery package C"] };
}
function configureObjectiveObjects(state, contract) {
  const names = objectiveNames(contract);
  const addAt = (id, label, kind, index) => {
    const pos = objectivePosition(contract, index);
    addObject(state, systemObject(id, label, kind, pos.x, pos.y));
  };
  if (contract.objectiveMode === "pressure-recovery") {
    const pos = objectivePosition(contract, 2);
    addObject(state, systemObject("service-seal", names.pressure, "sealControl", pos.x, pos.y));
    const breach = state.breaches.find((item) => item.id === "service-breach");
    const sector = state.sectors.find((item) => item.id === "B");
    if (breach && sector) {
      breach.active = true;
      breach.sealed = false;
      breach.strength = Math.min(breach.strength, 650);
      breach.radius = Math.min(breach.radius, 480);
      sector.pressure = Math.min(sector.pressure, 0.34);
      sector.targetPressure = 0;
      sector.pressureState = "leaking";
    }
  } else if (contract.objectiveMode === "grid-isolation") {
    addAt("grid-isolator-a", names.grid[0], "powerControl", 0);
    addAt("grid-isolator-b", names.grid[1], "powerControl", 2);
  } else if (contract.objectiveMode === "gravity-stabilization") {
    addAt("gravity-control-a", names.gravity[0], "gravityControl", 0);
    patchObject(state, "gravity-control", { id: "gravity-control-b", label: names.gravity[1], exposed: false });
  } else if (contract.objectiveMode === "machinery-recovery") {
    addAt("salvage-node-a", names.machinery[0], "salvageNode", 0);
    addAt("salvage-node-b", names.machinery[1], "salvageNode", 2);
  } else if (contract.objectiveMode === "emergency-boarding") {
    patchObject(state, "door-control", { label: names.boarding[0], exposed: false });
    addAt("boarding-lock", names.boarding[1], "doorControl", 2);
  } else if (contract.objectiveMode === "momentum-capture") {
    addAt("capture-drum-a", "Inbound capture drum", "gravityControl", 0);
    addAt("capture-drum-b", "Outbound capture drum", "gravityControl", 2);
  } else if (contract.objectiveMode === "thermal-routing") {
    addAt("purge-valve-a", "LH2 purge valve", "doorControl", 0);
    addAt("purge-valve-b", "Methane purge valve", "doorControl", 2);
  } else {
    addAt("salvage-node-a", names.salvage[0], "salvageNode", 0);
    addAt("salvage-node-b", names.salvage[1], "salvageNode", 1);
    addAt("salvage-node-c", names.salvage[2], "salvageNode", 2);
  }
}
function configureLatticeAnnex(state) {
  patchObject(state, "crate-a", { label: "Reference sample trolley", x: 470, y: 280, w: 120, h: 92, hp: 74, maxHp: 74 });
  patchObject(state, "bulkhead-a", { label: "Cold metrology plinth", x: 720, y: 650, w: 150, h: 82 });
  patchObject(state, "crate-b", { label: "Survey archive rack", x: 980, y: 330, w: 118, h: 110, hp: 72, maxHp: 72 });
  patchObject(state, "bulkhead-b", { label: "Reference carriage housing", x: 1250, y: 610, w: 150, h: 92, hp: 220, maxHp: 220 });
  patchObject(state, "conduit-a", { label: "Metrology timing bus", x: 1130, y: 255, w: 82, h: 72 });
  patchObject(state, "coolant-a", { label: "Cryogenic reference loop", x: 850, y: 720, w: 54, h: 92 });
  patchObject(state, "door-control", { label: "Reference gallery interlock", x: 690, y: 770 });
  patchObject(state, "gravity-control", { label: "Calibration mass trim", x: 1320, y: 260 });
  patchObject(state, "arena-cover", { label: "Sample vault carriage", x: 1920, y: 650, w: 145, h: 86, hp: 215, maxHp: 215 });
  patchObject(state, "arena-conduit", { label: "Vault timing trunk", x: 1830, y: 285, w: 88, h: 74 });
  addObject(state, coverObject("khepri-plinth-a", "Reference plinth A", 610, 470, 116, 64, "industrial"));
  addObject(state, coverObject("khepri-plinth-b", "Reference plinth B", 1030, 690, 116, 64, "industrial"));
  addObject(state, coverObject("khepri-plinth-c", "Reference plinth C", 1450, 390, 116, 64, "industrial"));
  for (const [id, x, y] of [["lattice-shutter-a", 1680, 300], ["lattice-shutter-b", 2030, 690]]) {
    const shutter = coverObject(id, "Khepri calibration shutter", x, y, 58, 180, "industrial");
    shutter.active = false;
    shutter.hp = 150;
    shutter.maxHp = 150;
    addObject(state, shutter);
  }
  for (const [id, x, y] of [["lattice-reference-a", 1740, 250], ["lattice-reference-b", 1970, 500], ["lattice-reference-c", 2160, 745]]) {
    const node = systemObject(id, "Metrology reference pylon", "anchorNode", x, y, 54, 54);
    node.active = false;
    node.hp = 82;
    node.maxHp = 82;
    addObject(state, node);
  }
}
function configureStoryFinale(state, contract) {
  const replayTarget = contract.directiveTargetClass === "command-target" ? contract.deepTarget : "";
  if ((!contract.storyFinale || !contract.storyArc) && !["Pressure Broker Naima Rusk", "Bond Arbiter Edrin Shaw", "PRISM-6 Forge Chorus"].includes(replayTarget)) return;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  if (contract.storyArc === "vanishing-wake" || replayTarget === "Pressure Broker Naima Rusk") {
    boss.variant = "pressureBroker";
    boss.hp = 650;
    boss.maxHp = 650;
    boss.armor = 185;
    boss.maxArmor = 185;
    const enforcer = state.enemies.find((enemy) => enemy.id === 1);
    if (enforcer) enforcer.label = "Rusk Recovery Enforcer";
    const tech = state.enemies.find((enemy) => enemy.id === 3);
    if (tech) {
      tech.role = "technician";
      tech.label = "Illegal Manifold Tech";
    }
    for (const [id, x, y] of [["story-pressure-shutter-a", 1780, 330], ["story-pressure-shutter-b", 2040, 640]]) {
      const shutter = coverObject(id, "Broker pressure shutter", x, y, 54, 170, "industrial");
      shutter.active = false;
      shutter.hp = 135;
      shutter.maxHp = 135;
      addObject(state, shutter);
    }
  } else if (contract.storyArc === "terms-of-survival" || replayTarget === "Bond Arbiter Edrin Shaw") {
    boss.variant = "bondArbiter";
    boss.hp = 720;
    boss.maxHp = 720;
    boss.armor = 350;
    boss.maxArmor = 350;
    const guard = state.enemies.find((enemy) => enemy.id === 1);
    if (guard) guard.label = "Arbitration Palisade";
    const tech = state.enemies.find((enemy) => enemy.id === 3);
    if (tech) {
      tech.role = "technician";
      tech.label = "Archive Seal Officer";
    }
  } else {
    boss.variant = "forgeChorus";
    boss.hp = 620;
    boss.maxHp = 620;
    boss.armor = 240;
    boss.maxArmor = 240;
    boss.x = 2060;
    boss.y = 520;
    const drone = state.enemies.find((enemy) => enemy.id === 1);
    if (drone) {
      drone.variant = "maintenanceDrone";
      drone.label = "PRISM Process Drone";
    }
    const relay = state.enemies.find((enemy) => enemy.id === 6);
    if (relay) {
      relay.variant = "gravityDrone";
      relay.label = "PRISM Phase Relay";
    }
  }
}
function configureCampaignFinale(state, contract) {
  const directiveReplay = contract.directiveTargetClass === "command-target" && contract.deepTarget === "Survey Custodian Veyra Senn";
  if ((!contract.campaignFinale || contract.campaignChapter !== "black-lattice") && !directiveReplay) return;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  boss.variant = "latticeCustodian";
  boss.hp = 790;
  boss.maxHp = 790;
  boss.armor = 285;
  boss.maxArmor = 285;
  boss.anchored = false;
  boss.x = 2020;
  boss.y = 520;
  for (const node of state.objects.filter((object) => object.id.startsWith("lattice-reference"))) {
    node.active = true;
    node.exposed = false;
    node.hp = node.maxHp;
  }
  const tech = state.enemies.find((enemy) => enemy.id === 3);
  if (tech) {
    tech.role = "technician";
    tech.label = "Khepri Reference Technician";
  }
  const elite = state.enemies.find((enemy) => enemy.id === 6);
  if (elite) {
    elite.role = "elite";
    elite.variant = "meleeExosuit";
    elite.label = "Vault Recovery Exosuit";
    elite.hp = 195;
    elite.maxHp = 195;
    elite.armor = 150;
    elite.maxArmor = 150;
  }
}
function configureEscalationFinale(state, contract) {
  if (!contract.escalationFinale) return;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (!boss) return;
  boss.variant = "cascadeCustodian";
  boss.hp = 760;
  boss.maxHp = 760;
  boss.armor = 270;
  boss.maxArmor = 270;
  boss.anchored = false;
  const tech = state.enemies.find((enemy) => enemy.id === 3);
  if (tech) {
    tech.role = "technician";
    tech.label = "Cascade Grid Technician";
  }
  const elite = state.enemies.find((enemy) => enemy.id === 6);
  if (elite) {
    elite.role = "elite";
    elite.label = "Failure-State Marshal";
  }
  addObject(state, coverObject("cascade-baffle-a", "Emergency bus baffle A", 1770, 330, 118, 48, "industrial"));
  addObject(state, coverObject("cascade-baffle-b", "Emergency bus baffle B", 2020, 650, 118, 48, "industrial"));
}
function configureMegastructureStage(state, contract) {
  if (!contract.megastructure || !contract.megastructureStage) return;
  const positions = [{ x: 610, y: 790 }, { x: 960, y: 250 }, { x: 1320, y: 760 }, { x: 1210, y: 270 }];
  const position = positions[(contract.megastructureStage - 1) % positions.length];
  addObject(state, systemObject("mega-optional-cache", contract.megastructureOptionalLabel ?? "Optional derelict archive", "salvageNode", position.x, position.y));
  if (contract.megastructureStage === 2) {
    const elite = state.enemies.find((enemy) => enemy.id === 6);
    if (elite) {
      elite.active = true;
      elite.dead = false;
      elite.role = "elite";
      elite.variant = "meleeExosuit";
      elite.label = "Derelict Security Exosuit";
      elite.hp = 190;
      elite.maxHp = 190;
      elite.armor = 145;
      elite.maxArmor = 145;
    }
  }
}
function applyEncounterLayout(state, contract) {
  if (contract.location === "damaged-vessel") configureDamagedVessel(state);
  else if (contract.location === "asteroid-refinery") configureRefinery(state);
  else if (contract.location === "spin-habitat") configureSpinHabitat(state);
  else if (contract.location === "jovian-harvester") configureJovianHarvester(state);
  else if (contract.location === "ice-mine") configureIceMine(state);
  else if (contract.location === "solar-yard") configureSolarYard(state);
  else if (contract.location === "lattice-annex") configureLatticeAnnex(state);
  else if (contract.location === "momentum-exchange") configureMomentumExchange(state);
  else if (contract.location === "cryo-reserve") configureCryoReserve(state);
  configureInterdictionCommand(state, contract);
  configureObjectiveObjects(state, contract);
  configureMegastructureStage(state, contract);
  configureStoryFinale(state, contract);
  configureCampaignFinale(state, contract);
  configureEscalationFinale(state, contract);
  reserveNavigationLanes(state, contract.location);
}
function exposedCount(state, ids) {
  return ids.reduce((count, id) => {
    var _a;
    return count + (((_a = state.objects.find((object) => object.id === id)) == null ? void 0 : _a.exposed) ? 1 : 0);
  }, 0);
}
function getNextMissionObjectiveTarget(state, contract) {
  if (contract.objectiveMode === "pressure-recovery") {
    const seal = state.objects.find((object) => object.id === "service-seal");
    const breach = state.breaches.find((item) => item.id === "service-breach");
    if (seal && (!seal.exposed || (breach == null ? void 0 : breach.active))) return seal;
    return null;
  }
  const ids = contract.objectiveMode === "grid-isolation" ? ["grid-isolator-a", "grid-isolator-b"] : contract.objectiveMode === "gravity-stabilization" ? ["gravity-control-a", "gravity-control-b"] : contract.objectiveMode === "machinery-recovery" ? ["salvage-node-a", "salvage-node-b"] : contract.objectiveMode === "emergency-boarding" ? ["door-control", "boarding-lock"] : contract.objectiveMode === "momentum-capture" ? ["capture-drum-a", "capture-drum-b"] : contract.objectiveMode === "thermal-routing" ? ["purge-valve-a", "purge-valve-b"] : ["salvage-node-a", "salvage-node-b", "salvage-node-c"];
  let target = null;
  let bestDistance = Infinity;
  for (const id of ids) {
    const object = state.objects.find((item) => item.id === id);
    if (!object || !object.active || object.exposed) continue;
    const distance = Math.hypot(object.x + object.w / 2 - state.player.x, object.y + object.h / 2 - state.player.y);
    if (distance < bestDistance) {
      target = object;
      bestDistance = distance;
    }
  }
  return target;
}
function getMissionObjectiveStatus(state, contract) {
  const mode = contract.objectiveMode;
  if (mode === "pressure-recovery") {
    const seal = state.objects.find((object) => object.id === "service-seal");
    const breach = state.breaches.find((item) => item.id === "service-breach");
    const sector = state.sectors.find((item) => item.id === "B");
    const sealed = !!(seal == null ? void 0 : seal.exposed);
    const ruptureOpen = !!(breach == null ? void 0 : breach.active);
    const recovered = sealed && !ruptureOpen && ((sector == null ? void 0 : sector.pressure) ?? 0) >= 0.46;
    const progress2 = Number(sealed) + Number(recovered);
    return {
      label: "Pressure recovery",
      detail: !sealed ? "Reach the emergency pressure manifold" : ruptureOpen ? "Service rupture reopened — re-seal the manifold" : !recovered ? "Hold while atmosphere recovers above 46%" : "Pressure shell stabilized",
      progress: progress2,
      required: 2,
      complete: progress2 >= 2
    };
  }
  if (mode === "grid-isolation") {
    const progress2 = exposedCount(state, ["grid-isolator-a", "grid-isolator-b"]);
    return {
      label: "Grid isolation",
      detail: progress2 < 2 ? "Isolate both live grid branches" : "Damaged grid isolated",
      progress: progress2,
      required: 2,
      complete: progress2 >= 2
    };
  }
  if (mode === "gravity-stabilization") {
    const progress2 = exposedCount(state, ["gravity-control-a", "gravity-control-b"]);
    return {
      label: "Gravity stabilization",
      detail: progress2 < 2 ? "Calibrate both gravity trims" : "Gravity trims synchronized",
      progress: progress2,
      required: 2,
      complete: progress2 >= 2
    };
  }
  if (mode === "machinery-recovery") {
    const progress2 = exposedCount(state, ["salvage-node-a", "salvage-node-b"]);
    return {
      label: "Machinery recovery",
      detail: progress2 < 2 ? "Tag both intact machinery packages" : "Recovery packages tagged",
      progress: progress2,
      required: 2,
      complete: progress2 >= 2
    };
  }
  if (mode === "emergency-boarding") {
    const progress2 = exposedCount(state, ["door-control", "boarding-lock"]);
    return { label: "Pressure-gate boarding", detail: progress2 < 2 ? "Cycle both pressure interlocks" : "Cargo route pressure-gated", progress: progress2, required: 2, complete: progress2 >= 2 };
  }
  if (mode === "momentum-capture") {
    const progress2 = exposedCount(state, ["capture-drum-a", "capture-drum-b"]);
    return { label: "Momentum capture", detail: progress2 < 2 ? "Load both counter-momentum references" : "Capture drums synchronized", progress: progress2, required: 2, complete: progress2 >= 2 };
  }
  if (mode === "thermal-routing") {
    const progress2 = exposedCount(state, ["purge-valve-a", "purge-valve-b"]);
    return { label: "Thermal routing", detail: progress2 < 2 ? "Route both cryogenic purge branches" : "Boiloff routed clear of service gallery", progress: progress2, required: 2, complete: progress2 >= 2 };
  }
  const progress = exposedCount(state, ["salvage-node-a", "salvage-node-b", "salvage-node-c"]);
  return {
    label: "Deep salvage",
    detail: progress < 3 ? "Tag all three recovery packages" : "Recovery manifest complete",
    progress,
    required: 3,
    complete: progress >= 3
  };
}
function createEnvironmentalEventRuntime() {
  return { plan: null, warned: [], fired: [], effects: [] };
}
const clamp$2 = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
function enemyHasProtocol(enemy, id) {
  return enemy.protocols.some((protocol) => protocol.id === id);
}
function protocolRewardForEnemy(enemy) {
  return enemy.protocols.reduce((total, protocol) => total + protocolRewardValue(protocol), 0);
}
function protocolAnchorsEnemy(enemy) {
  return enemyHasProtocol(enemy, "gravityAnchor") && enemy.statuses.disrupted <= 0;
}
function protocolVacuumImmune(enemy) {
  return enemyHasProtocol(enemy, "vacuumAdapted");
}
function protocolIgnoresPressureRetreat(enemy) {
  return enemyHasProtocol(enemy, "pressureHunter") || enemyHasProtocol(enemy, "vacuumAdapted");
}
function protocolCarriesObjective(enemy) {
  return enemyHasProtocol(enemy, "salvageInterdictor");
}
function protocolMobilityScale(enemy, pressure) {
  return pressure < 0.5 && protocolIgnoresPressureRetreat(enemy) ? 1.18 : 1;
}
function pushEvent$1(state, text, duration = 1.7) {
  state.eventText = text;
  state.eventT = duration;
}
function pulse(state, enemy, text) {
  enemy.protocolPulse = 1.2;
  const effect = state.effects.find((item) => !item.active);
  if (effect) Object.assign(effect, { active: true, x: enemy.x, y: enemy.y, kind: "pulse", life: 0.45, maxLife: 0.45, radius: 58 });
  pushEvent$1(state, text);
}
function plantHazard$1(state, x, y, kind, life) {
  const hazard = state.hazards.find((item) => !item.active);
  if (!hazard) return false;
  Object.assign(hazard, { active: true, x, y, radius: kind === "gravityWell" ? 185 : kind === "coolantJet" ? 150 : 120, life, kind, owner: kind === "coolantJet" ? "environment" : "enemy" });
  return true;
}
function activateBarrier$1(state, enemy, mirrored = false) {
  const barrier = state.objects.find((object) => object.id.startsWith("protocol-shutter") && !object.active && object.hp > 0);
  if (!barrier) return false;
  barrier.active = true;
  barrier.x = clamp$2(enemy.x + enemy.strafeSign * (mirrored ? -125 : 125), 830, 1370);
  barrier.y = clamp$2(enemy.y + (mirrored ? -70 : 35), 225, 820);
  return true;
}
function breachNearestCover$1(state, enemy) {
  const target = state.objects.filter((object) => object.active && object.kind === "cover" && object.destructible && object.hp > 0 && !object.id.startsWith("protocol-shutter")).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 720) return false;
  target.hp = 0;
  target.active = false;
  if (target.id === "meridian-pressure-door") {
    const link = state.links.find((item) => item.id === "door-ab");
    if (link) link.open = true;
  }
  return true;
}
function repairHardware(state, enemy) {
  const target = state.objects.filter((object) => !object.id.startsWith("enemy-tether") && (object.kind === "conduit" || object.kind === "anchorNode") && object.hp > 0 && (object.hp < object.maxHp || !object.active)).sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
  if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 520) return false;
  target.active = true;
  target.hp = Math.min(target.maxHp, target.hp + 34);
  if (target.kind === "conduit" && target.hp > target.maxHp * 0.7) target.exposed = false;
  return true;
}
function deployDrone(state, enemy) {
  const drone = state.enemies.find((item) => (item.id === 9 || item.id === 10) && !item.active && !item.dead);
  if (!drone) return false;
  drone.active = true;
  drone.x = clamp$2(enemy.x + enemy.strafeSign * 65, 120, 2200);
  drone.y = clamp$2(enemy.y + 55, 190, 910);
  drone.fireCooldown = 0.8;
  drone.hazardCooldown = 1.8;
  return true;
}
function addEnemyProjectile(state, enemy, direction, speed, damage) {
  const projectile = state.projectiles.find((item) => !item.active);
  if (!projectile) return;
  Object.assign(projectile, { active: true, x: enemy.x + direction.x * 26, y: enemy.y + direction.y * 26, vx: direction.x * speed, vy: direction.y * speed, radius: 6, damage, life: 2.8, owner: "enemy", weapon: "enemy", penetration: 0, armorDamage: 0.5, healthMultiplier: 1, knockback: 0.05, lastObjectId: null, lastObjectT: 0 });
}
function fireProtocolFan(state, enemy, count, speed, damage, spacing) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index - (count - 1) / 2) * spacing;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    addEnemyProjectile(state, enemy, { x: enemy.telegraphAim.x * c - enemy.telegraphAim.y * s, y: enemy.telegraphAim.x * s + enemy.telegraphAim.y * c }, speed, damage);
  }
}
function processWindup(state, enemy, dt) {
  const active = enemy.protocols.find((protocol) => protocol.windup > 0);
  if (!active) return false;
  active.windup = Math.max(0, active.windup - dt);
  enemy.telegraph = active.windup;
  if (active.windup > 0) return true;
  if (active.id === "thermalOverrun") {
    fireProtocolFan(state, enemy, active.enhanced ? 5 : 3, 500, 14, 0.085);
    enemy.statuses.stagger = Math.max(enemy.statuses.stagger, 0.52);
    if (active.enhanced) plantHazard$1(state, enemy.x - enemy.telegraphAim.x * 80, enemy.y - enemy.telegraphAim.y * 80, "coolantJet", 3.4);
  } else if (active.id === "penetratorVolley") {
    fireProtocolFan(state, enemy, active.enhanced ? 5 : 3, 640, 15, 0.065);
    if (active.enhanced) plantHazard$1(state, state.player.x + 90, state.player.y, "shockGrid", 3.2);
  }
  enemy.telegraph = 0;
  return true;
}
function stepEnemyProtocols(state, enemy, dt, distance, toward, pressure) {
  enemy.protocolPulse = Math.max(0, enemy.protocolPulse - dt);
  for (const protocol of enemy.protocols) protocol.cooldown = Math.max(0, protocol.cooldown - dt);
  if (processWindup(state, enemy, dt) || enemy.statuses.disrupted > 0) return;
  for (const protocol of enemy.protocols) {
    if (protocol.cooldown > 0) continue;
    const definition = protocolDefinition(protocol.id);
    let acted = false;
    if (protocol.id === "reactivePlating" && enemy.armor > 0 && enemy.armor < enemy.maxArmor) {
      enemy.armor = Math.min(enemy.maxArmor, enemy.armor + 16);
      if (protocol.enhanced) {
        const ally = state.enemies.find((item) => item.active && !item.dead && item.id !== enemy.id && item.armor > 0 && item.armor < item.maxArmor && Math.hypot(item.x - enemy.x, item.y - enemy.y) < 300);
        if (ally) ally.armor = Math.min(ally.maxArmor, ally.armor + 10);
      }
      pulse(state, enemy, `REACTIVE PLATING${protocol.enhanced ? " // ALLY PATCH" : ""} // ARMOR MESH RE-KNITTING`);
      acted = true;
    } else if (protocol.id === "pressureHunter" && pressure < 0.5) {
      pulse(state, enemy, "PRESSURE HUNTER // LOW-PRESSURE PURSUIT LOCKED");
      acted = true;
    } else if (protocol.id === "vacuumAdapted" && pressure < 0.2) {
      pulse(state, enemy, "VACUUM-ADAPTED FRAME // DECOMPRESSION MOBILITY MAINTAINED");
      acted = true;
    } else if (protocol.id === "breachmaker") {
      const first = breachNearestCover$1(state, enemy);
      const second = protocol.enhanced ? breachNearestCover$1(state, enemy) : false;
      if (first || second) {
        pulse(state, enemy, `BREACHMAKER // ${second ? "DUAL " : ""}DEMOLITION LANE OPENED`);
        acted = true;
      }
    } else if (protocol.id === "magneticLock") {
      plantHazard$1(state, state.player.x + state.player.vx * 0.45, state.player.y + state.player.vy * 0.45, "gravityWell", 4.2);
      if (protocol.enhanced) plantHazard$1(state, state.player.x - 145, state.player.y + 70, "gravityWell", 3.8);
      pulse(state, enemy, `MAGNETIC LOCK // ${protocol.enhanced ? "PAIRED " : ""}MASS WELL PROJECTED`);
      acted = true;
    } else if (protocol.id === "gravityAnchor") {
      if (protocol.enhanced && distance < 360) plantHazard$1(state, enemy.x, enemy.y, "gravityWell", 3.2);
      pulse(state, enemy, `GRAVITY ANCHOR // VECTOR RESISTANCE ONLINE${protocol.enhanced ? " // LOCAL WELL" : ""}`);
      acted = true;
    } else if (protocol.id === "countermassMobility") {
      const sideways = { x: -toward.y * enemy.strafeSign, y: toward.x * enemy.strafeSign };
      enemy.vx += sideways.x * 320;
      enemy.vy += sideways.y * 320;
      if (protocol.enhanced) plantHazard$1(state, enemy.x - sideways.x * 70, enemy.y - sideways.y * 70, "gravityWell", 2.4);
      pulse(state, enemy, `COUNTERMASS MOBILITY // LATERAL VECTOR BURST${protocol.enhanced ? " // WAKE WELL" : ""}`);
      acted = true;
    } else if (protocol.id === "arcConduit") {
      plantHazard$1(state, state.player.x + state.player.vx * 0.25, state.player.y + state.player.vy * 0.25, "shockGrid", 4.4);
      if (protocol.enhanced) plantHazard$1(state, state.player.x + 140, state.player.y - 80, "shockGrid", 3.6);
      pulse(state, enemy, `ARC CONDUIT // ${protocol.enhanced ? "DUAL " : ""}GRID PATH ENERGIZED`);
      acted = true;
    } else if (protocol.id === "repairMesh") {
      const hardware = repairHardware(state, enemy);
      const repairedArmor = !hardware && enemy.armor > 0 && enemy.armor < enemy.maxArmor;
      if (repairedArmor) enemy.armor = Math.min(enemy.maxArmor, enemy.armor + 13);
      if (protocol.enhanced) {
        const ally = state.enemies.find((item) => item.active && !item.dead && item.id !== enemy.id && item.armor > 0 && item.armor < item.maxArmor && Math.hypot(item.x - enemy.x, item.y - enemy.y) < 340);
        if (ally) ally.armor = Math.min(ally.maxArmor, ally.armor + 11);
      }
      if (hardware || repairedArmor || protocol.enhanced) {
        pulse(state, enemy, `REPAIR MESH // FIELD RECONSTRUCTION${protocol.enhanced ? " // ALLY LINK" : ""}`);
        acted = true;
      }
    } else if (protocol.id === "droneEscort") {
      const first = deployDrone(state, enemy);
      const second = protocol.enhanced ? deployDrone(state, enemy) : false;
      if (first || second) {
        pulse(state, enemy, `DRONE ESCORT // ${second ? "TWO " : ""}SUPPORT UNIT${second ? "S" : ""} RELEASED`);
        acted = true;
      }
    } else if (protocol.id === "emergencyShutters") {
      const first = activateBarrier$1(state, enemy);
      const second = protocol.enhanced ? activateBarrier$1(state, enemy, true) : false;
      if (first || second) {
        pulse(state, enemy, `EMERGENCY SHUTTERS // ${second ? "TWO " : ""}FIRING LANE${second ? "S" : ""} CLOSED`);
        acted = true;
      }
    } else if (protocol.id === "sensorGhost") {
      pulse(state, enemy, enemy.statuses.marked > 0 ? "SENSOR GHOST // TRUE RETURN RESOLVED BY MARK" : "SENSOR GHOST // ASSISTED RETURN SPLIT // MARK TO RESOLVE");
      acted = true;
    } else if (protocol.id === "signalJammer" && distance < 380) {
      state.player.disrupted = Math.max(state.player.disrupted, 0.85);
      if (protocol.enhanced) state.player.capacitor = Math.max(0, state.player.capacitor - 8);
      pulse(state, enemy, `SIGNAL JAMMER // CONTROL BUS NOISE${protocol.enhanced ? " // CAPACITOR DESYNC" : ""}`);
      acted = true;
    } else if ((protocol.id === "thermalOverrun" || protocol.id === "penetratorVolley") && enemy.telegraph <= 0) {
      protocol.windup = protocol.id === "thermalOverrun" ? 1.05 : 1.2;
      enemy.telegraph = protocol.windup;
      enemy.telegraphAim = toward;
      pulse(state, enemy, protocol.id === "thermalOverrun" ? `THERMAL OVERRUN // REDLINE BURST CHARGING${protocol.enhanced ? " // COOLANT DUMP ARMED" : ""}` : `PENETRATOR VOLLEY // STRAIGHT-LINE SOLUTION${protocol.enhanced ? " // CROSS-FAN" : ""}`);
      acted = true;
    } else if (protocol.id === "suppressionCoordinator") {
      let coordinated = 0;
      for (const ally of state.enemies) {
        if (!ally.active || ally.dead || ally.id === enemy.id || Math.hypot(ally.x - enemy.x, ally.y - enemy.y) > 540) continue;
        if (ally.role === "suppressor" || ally.role === "assault") {
          ally.fireCooldown = Math.min(ally.fireCooldown, 0.08);
          ally.burst = Math.max(ally.burst, 1);
          coordinated += 1;
        }
        if (protocol.enhanced && ally.role === "technician") ally.hazardCooldown = Math.min(ally.hazardCooldown, 0.1);
      }
      if (coordinated > 0) {
        pulse(state, enemy, `SUPPRESSION COORDINATOR // ${coordinated} FIRETEAM VECTOR${protocol.enhanced ? " // TECH BUS SYNC" : ""}`);
        acted = true;
      }
    } else if (protocol.id === "salvageInterdictor" && !enemy.carriedObjectId) {
      const tagged = state.objects.find((object) => object.kind === "salvageNode" && object.active && object.exposed);
      if (tagged) {
        tagged.exposed = false;
        enemy.carriedObjectId = tagged.id;
        if (protocol.enhanced) plantHazard$1(state, state.player.x, state.player.y, "gravityWell", 3.2);
        pulse(state, enemy, `SALVAGE INTERDICTOR // ${tagged.label.toUpperCase()} TAKEN // INTERCEPT`);
        acted = true;
      }
    } else if (protocol.id === "recoveryDenial") {
      const tagged = state.objects.find((object) => object.kind === "salvageNode" && object.active && object.exposed);
      if (tagged) {
        plantHazard$1(state, tagged.x + tagged.w / 2, tagged.y + tagged.h / 2, "shockGrid", 4.8);
        if (protocol.enhanced) activateBarrier$1(state, enemy);
        pulse(state, enemy, `RECOVERY DENIAL // TAGGED HARDWARE GRIDDED${protocol.enhanced ? " // SHUTTER DEPLOYED" : ""}`);
        acted = true;
      }
    }
    protocol.cooldown = acted ? definition.baseCooldown : 2.1;
    if (acted) break;
  }
}
function clamp$1(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function sourceFor(input) {
  if (input.role === "boss" || input.combatClass === "command") return "boss";
  if (input.role === "elite" || input.combatClass === "elite") return "elite";
  if (input.combatClass === "enhanced") return "enhanced";
  return "standard";
}
function qualityFloor(source, operationTier) {
  if (source === "boss") return operationTier >= 9 ? 5 : 4;
  if (source === "elite") return operationTier >= 8 ? 4 : 3;
  if (source === "enhanced") return operationTier >= 9 ? 3 : 2;
  return operationTier >= 10 ? 2 : operationTier >= 6 ? 1 : 0;
}
function recoveryPenalty(source) {
  if (source === "boss") return 0;
  if (source === "elite") return 2;
  if (source === "enhanced") return 4;
  return 6;
}
function rollGroundLoot(input, random) {
  const source = sourceFor(input);
  const tier = clamp$1(Math.round(input.operationTier), 1, 12);
  if (source === "standard") {
    const chance = 0.14 + tier * 0.012;
    if (random() >= chance) return null;
  } else if (source === "enhanced") {
    const chance = 0.48 + tier * 0.018;
    if (random() >= chance) return null;
  }
  let rarity = "Field";
  if (source === "boss") rarity = "Singular";
  else if (source === "elite") rarity = "Prototype";
  else if (source === "enhanced") rarity = random() < 0.18 + tier * 0.035 ? "Prototype" : "Refined";
  else {
    const prototypeChance = tier >= 8 ? 0.025 + (tier - 8) * 0.012 : 0;
    if (random() < prototypeChance) rarity = "Prototype";
    else rarity = random() < 0.24 + tier * 0.025 ? "Refined" : "Field";
  }
  const recoveryLevel = Math.max(1, Math.round(input.maxRecoveryLevel - recoveryPenalty(source)));
  return {
    id: `ground-${input.enemyId}-${input.sequence}`,
    enemyId: input.enemyId,
    enemyLabel: input.enemyLabel,
    x: input.x,
    y: input.y,
    rarity,
    source,
    recoveryQualityFloor: qualityFloor(source, tier),
    recoveryLevel,
    monsterLevel: Math.max(1, Math.round(input.monsterLevel)),
    active: true,
    collected: false,
    age: 0
  };
}
function lootLabel(rarity) {
  if (rarity === "Singular") return "SINGULAR RECOVERY";
  if (rarity === "Prototype") return "PROTOTYPE RECOVERY";
  if (rarity === "Refined") return "REFINED RECOVERY";
  return "FIELD RECOVERY";
}
const weaponConfigs = {
  carbine: { id: "carbine", name: "Vektor M-7 Coil Carbine", shortName: "M-7 CARBINE", damage: 18, rate: 7.8, projectileSpeed: 860, penetration: 20, recoil: 38, spread: 0.018, heatPerShot: 0.058, heatDissipation: 0.23, magazine: 30, reloadSeconds: 1.35, armorDamage: 0.72, healthMultiplier: 1, knockback: 0.055, pellets: 1, capacitorCost: 0 },
  breacher: { id: "breacher", name: "Kestrel B-4 Breach Scattergun", shortName: "B-4 BREACHER", damage: 11, rate: 1.25, projectileSpeed: 560, penetration: 8, recoil: 112, spread: 0.16, heatPerShot: 0.17, heatDissipation: 0.2, magazine: 6, reloadSeconds: 1.85, armorDamage: 0.34, healthMultiplier: 1.45, knockback: 0.11, pellets: 7, capacitorCost: 0 },
  rail: { id: "rail", name: "Helix R-2 Rail Lance", shortName: "R-2 RAIL LANCE", damage: 48, rate: 0.82, projectileSpeed: 1380, penetration: 115, recoil: 168, spread: 4e-3, heatPerShot: 0.28, heatDissipation: 0.16, magazine: 5, reloadSeconds: 2.1, armorDamage: 1.75, healthMultiplier: 0.92, knockback: 0.12, pellets: 1, capacitorCost: 10 }
};
const abilityMeta = [
  { name: "Magnetic Impulse", shortName: "MAG", cost: 24, cooldown: 5.6 },
  { name: "Sensor Spike", shortName: "MARK", cost: 18, cooldown: 6.8 },
  { name: "Arc Tap", shortName: "ARC", cost: 30, cooldown: 7.5 }
];
const neutralCombatBuild = { weapon: { carbine: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, breacher: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, rail: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 } }, player: { maxHpAdd: 0, maxArmorAdd: 0, maxCapAdd: 0, moveSpeedMul: 1, capRegenMul: 1, vacuumResistance: 0, lowGControl: 0, ventSpeedMul: 1 }, mechanics: { railFragment: false, railFragmentScale: 0, dodgeVent: false, dodgeVentScale: 0, magRedirect: false, magRedirectScale: 0, breacherPropulsion: false, breacherPropulsionScale: 0, markWeakArmor: false, markWeakArmorScale: 0, arcDrone: false, arcDroneScale: 0, recoilVectoring: false, breachDoctrine: false, sensorPenetration: false, widebandMark: false, magOverdriveKick: false, arcGroundLoop: false, magBoundarySink: false, markExecutionTrace: false, arcCascadeLattice: false }, singularTraits: [], specialization: null, specializationOverclock: false, abilities: [{ costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }] };
function resolveWeaponConfig(build, id) {
  const base = weaponConfigs[id];
  const mod = build.weapon[id];
  return { ...base, damage: base.damage * mod.damageMul, projectileSpeed: base.projectileSpeed * mod.speedMul, penetration: base.penetration + mod.penetrationAdd, recoil: base.recoil * mod.recoilMul, heatPerShot: base.heatPerShot * mod.heatPerShotMul, heatDissipation: base.heatDissipation * mod.heatDissipationMul, magazine: Math.max(1, Math.round(base.magazine + mod.magazineAdd)), reloadSeconds: base.reloadSeconds * mod.reloadMul, armorDamage: base.armorDamage * mod.armorDamageMul, healthMultiplier: base.healthMultiplier * mod.healthMultiplierMul, knockback: base.knockback * mod.knockbackMul };
}
function getWeaponConfig(state, id) {
  return state.weapons[id];
}
function getAbilityConfig(state, index) {
  const base = abilityMeta[index] ?? abilityMeta[0];
  const tuning = state.build.abilities[index] ?? state.build.abilities[0];
  return { ...base, cost: Math.round(base.cost * tuning.costMul), cooldown: base.cooldown * tuning.cooldownMul, power: tuning.powerMul };
}
const world = { w: 2320, h: 1040 };
const playerRadius = 22;
const enemyRadius = 21;
let seed = 1597463007;
function rand() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
function len(v) {
  return Math.hypot(v.x, v.y);
}
function norm(v) {
  const l = len(v);
  return l > 1e-4 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
function resolveCircleRect(body, radius, r) {
  const cx = clamp(body.x, r.x, r.x + r.w);
  const cy = clamp(body.y, r.y, r.y + r.h);
  const dx = body.x - cx;
  const dy = body.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return;
  let nx = 0;
  let ny = 0;
  if (d2 < 1e-4) {
    const left = Math.abs(body.x - r.x);
    const right = Math.abs(r.x + r.w - body.x);
    const top = Math.abs(body.y - r.y);
    const bottom = Math.abs(r.y + r.h - body.y);
    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) {
      body.x = r.x - radius;
      nx = -1;
    } else if (nearest === right) {
      body.x = r.x + r.w + radius;
      nx = 1;
    } else if (nearest === top) {
      body.y = r.y - radius;
      ny = -1;
    } else {
      body.y = r.y + r.h + radius;
      ny = 1;
    }
  } else {
    const distance = Math.sqrt(d2);
    nx = dx / distance;
    ny = dy / distance;
    const push = radius - distance;
    body.x += nx * push;
    body.y += ny * push;
  }
  const inwardSpeed = body.vx * nx + body.vy * ny;
  if (inwardSpeed < 0) {
    body.vx -= nx * inwardSpeed;
    body.vy -= ny * inwardSpeed;
  }
}
function currentSector(state, x, y) {
  return state.sectors.find((s) => pointInRect(x, y, s)) ?? state.sectors[0];
}
function isSolidObject(object) {
  return object.active && (object.kind === "cover" || object.kind === "conduit" || object.kind === "coolant" || object.kind === "breachPlate" || object.kind === "anchorNode");
}
function clearLine(state, ax, ay, bx, by) {
  for (let i = 1; i < 20; i += 1) {
    const t = i / 20;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (state.objects.some((object) => isSolidObject(object) && pointInRect(x, y, object))) return false;
  }
  return true;
}
function blankStatuses() {
  return { armorBreach: 0, disrupted: 0, marked: 0, stagger: 0, conductive: 0, vacuum: 0 };
}
function staggerDuration(enemy, duration) {
  return duration / Math.max(1, enemy.effectiveness);
}
function spawnEffect(state, x, y, kind, radius, life = 0.45) {
  const effect = state.effects.find((item) => !item.active);
  if (!effect) return;
  Object.assign(effect, { active: true, x, y, kind, radius, life, maxLife: life });
}
function pushEvent(state, text, duration = 2.2) {
  state.eventText = text;
  state.eventT = duration;
}
function hasTrait(state, trait) {
  return state.build.singularTraits.includes(trait);
}
function addProjectile(state, x, y, dir, speed, damage, owner, options) {
  const p = state.projectiles.find((item) => !item.active);
  if (!p) return;
  p.active = true;
  p.x = x;
  p.y = y;
  p.vx = dir.x * speed;
  p.vy = dir.y * speed;
  p.radius = (options == null ? void 0 : options.radius) ?? (owner === "player" ? 4 : 6);
  p.damage = damage;
  p.life = owner === "player" ? 2 : 2.8;
  p.owner = owner;
  p.weapon = (options == null ? void 0 : options.weapon) ?? (owner === "player" ? "carbine" : "enemy");
  p.penetration = (options == null ? void 0 : options.penetration) ?? 0;
  p.armorDamage = (options == null ? void 0 : options.armorDamage) ?? 0.6;
  p.healthMultiplier = (options == null ? void 0 : options.healthMultiplier) ?? 1;
  p.knockback = (options == null ? void 0 : options.knockback) ?? 0.05;
  p.lastObjectId = null;
  p.lastObjectT = 0;
}
function applyPlayerDamage(state, amount, armorPierce = 0) {
  const p = state.player;
  if (p.invulnerable > 0 || p.dead || amount <= 0) return;
  const wasCritical = p.hp <= 1;
  const bypass = clamp(armorPierce, 0, 1);
  const directHealthDamage = amount * bypass;
  const blockableDamage = Math.max(0, amount - directHealthDamage);
  const armorTake = Math.min(p.armor, blockableDamage);
  p.armor -= armorTake;
  const healthDamage = directHealthDamage + Math.max(0, blockableDamage - armorTake);
  const appliedHealthDamage = Math.min(p.hp, Math.max(0, healthDamage));
  p.hp = Math.max(0, p.hp - appliedHealthDamage);
  state.telemetry.damageTaken += armorTake + appliedHealthDamage;
  if (p.hp <= 0 || wasCritical) {
    p.hp = 0;
    p.dead = true;
    p.vx *= 0.25;
    p.vy *= 0.25;
    state.telemetry.deaths += 1;
  }
}
function dropCarriedObjective(state, enemy, recovered = true) {
  if (!enemy.carriedObjectId) return;
  const object = state.objects.find((item) => item.id === enemy.carriedObjectId);
  if (object) {
    object.active = true;
    object.x = clamp(enemy.x - object.w / 2, 120, world.w - object.w - 120);
    object.y = clamp(enemy.y - object.h / 2, 190, world.h - object.h - 120);
    object.exposed = recovered;
  }
  enemy.carriedObjectId = null;
}
function spawnGroundLoot(state, enemy) {
  const drop = rollGroundLoot({ enemyId: enemy.id, enemyLabel: enemy.label, role: enemy.role, combatClass: enemy.combatClass, x: enemy.x, y: enemy.y, operationTier: state.operationTier, maxRecoveryLevel: state.maxRecoveryLevel, monsterLevel: state.monsterLevel, sequence: state.groundLoot.length + state.collectedLoot.length }, rand);
  if (!drop) return;
  state.groundLoot.push(drop);
  spawnEffect(state, drop.x, drop.y, drop.rarity === "Singular" ? "arc" : "pulse", drop.rarity === "Singular" ? 86 : 54, 0.6);
}
function finishEnemyDeath(state, enemy) {
  if (enemy.dead) return;
  const markedKill = enemy.statuses.marked > 0;
  enemy.hp = 0;
  enemy.dead = true;
  enemy.deathT = 0.8;
  spawnGroundLoot(state, enemy);
  if (enemy.carriedObjectId) {
    dropCarriedObjective(state, enemy, true);
    pushEvent(state, "STOLEN RECOVERY PACKAGE DROPPED // TAG RESTORED", 1.6);
  }
  for (const tether of state.objects) if (tether.id.startsWith("enemy-tether") && tether.label.endsWith(`#${enemy.id}`)) tether.active = false;
  if (markedKill && hasTrait(state, "deadreckon")) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 1.2);
  if (markedKill && hasTrait(state, "markCascade")) {
    const relay = state.enemies.filter((candidate) => candidate.active && !candidate.dead && candidate.id !== enemy.id && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= 430).sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
    if (relay) {
      relay.statuses.marked = Math.max(relay.statuses.marked, 4.2);
      spawnEffect(state, relay.x, relay.y, "mark", 46, 0.5);
      pushEvent(state, `CASCADE SIGHT // MARK RELAYED TO ${relay.label.toUpperCase()}`, 1.4);
    }
  }
  if (enemy.role === "boss") {
    state.bossDefeated = true;
    pushEvent(state, `${enemy.label.toUpperCase()} OFFLINE // COMMAND RECOVERY EJECTED`, 4);
    return;
  }
  if (enemy.role === "elite" || enemy.combatClass === "elite") state.telemetry.eliteKills += 1;
  state.telemetry.eliteProtocolsDefeated += protocolRewardForEnemy(enemy);
  state.telemetry.kills += 1;
  const sinceLastKill = Math.max(0, state.time - state.telemetry.lastKillAt);
  state.telemetry.killIntervalTotal += sinceLastKill;
  state.telemetry.killIntervalSamples += 1;
  state.telemetry.lastKillAt = state.time;
  if (enemy.protocols.length > 0) {
    const combination = enemy.protocols.map((protocol) => `${protocol.enhanced ? "▲" : ""}${protocol.id}`).sort().join(" + ");
    state.telemetry.protocolCombinations[combination] = (state.telemetry.protocolCombinations[combination] ?? 0) + 1;
  }
  state.kills += 1;
}
function dealEnemyDamage(state, enemy, amount, armorDamageFactor, healthMultiplier, sourceKnockback = 0, sourceVelocity) {
  if (enemy.dead || !enemy.active) return;
  const markedBonus = enemy.statuses.marked > 0 ? state.build.mechanics.markWeakArmor ? 1.18 + 0.16 * (state.build.mechanics.markWeakArmorScale || 1) : 1.18 : 1;
  const directScale = state.build.mechanics.breachDoctrine ? 0.92 : 1;
  const foundryAnchored = enemy.variant === "foundryMarshal" && enemy.statuses.disrupted <= 0 && state.objects.some((object) => object.kind === "anchorNode" && object.id.startsWith("foundry-anchor") && object.active && object.hp > 0);
  const latticeReferenced = enemy.variant === "latticeCustodian" && enemy.statuses.disrupted <= 0 && state.objects.some((object) => object.kind === "anchorNode" && object.id.startsWith("lattice-reference") && object.active && object.hp > 0);
  const anchorScale = foundryAnchored ? 0.58 : latticeReferenced ? 0.64 : 1;
  let shieldScale = 1;
  if (enemy.variant === "shieldBoarder" && enemy.armor > 0 && sourceVelocity) {
    const incomingSource = norm({ x: -sourceVelocity.x, y: -sourceVelocity.y });
    const facing = norm(enemy.telegraphAim);
    const frontal = incomingSource.x * facing.x + incomingSource.y * facing.y > 0.25;
    const penetrated = amount >= 40;
    if (frontal && !penetrated) shieldScale = 0.22;
  }
  let healthDamage = amount * 0.2 * markedBonus * directScale * anchorScale * shieldScale;
  if (enemy.armor > 0) {
    enemy.armor = Math.max(0, enemy.armor - amount * armorDamageFactor * markedBonus * anchorScale * shieldScale);
    if (enemy.armor <= 0) {
      enemy.statuses.armorBreach = state.build.mechanics.breachDoctrine ? 12 : 8;
      spawnEffect(state, enemy.x, enemy.y, "impact", 48, 0.55);
    }
  } else healthDamage = amount * healthMultiplier * markedBonus * directScale * anchorScale;
  if (enemy.statuses.armorBreach > 0) healthDamage *= 1.18;
  enemy.hp -= healthDamage;
  state.telemetry.damageDealt += Math.max(0, healthDamage);
  if (sourceVelocity && sourceKnockback > 0) {
    enemy.vx += sourceVelocity.x * sourceKnockback;
    enemy.vy += sourceVelocity.y * sourceKnockback;
  }
  if (enemy.hp <= 0) finishEnemyDeath(state, enemy);
}
function materialResistance(material) {
  if (material === "light") return 16;
  if (material === "industrial") return 72;
  if (material === "system") return 30;
  return 9999;
}
function activateBreach(state, id) {
  const breach = state.breaches.find((item) => item.id === id);
  if (!breach || breach.active) return;
  breach.active = true;
  breach.sealed = false;
  const sector = state.sectors.find((item) => item.id === breach.sectorId);
  if (sector) {
    sector.rapidTimer = breach.boss ? 6 : 4.2;
    sector.targetPressure = 0;
    sector.pressureState = "decompressing";
  }
  spawnEffect(state, breach.x, breach.y, "breach", 180, 1.1);
  pushEvent(state, breach.boss ? "BOSS PHASE II // HULL SHUTTER FAILED // RAPID DECOMPRESSION" : "SERVICE PLATE BREACHED // TRANSFER BAY DECOMPRESSING", 3.8);
  for (const debris of state.debris) if (debris.sectorId === breach.sectorId) debris.active = true;
}
function damageObject(state, object, projectile) {
  if (!object.destructible || !object.active) return;
  let multiplier = 0.55;
  if (projectile.weapon === "rail") multiplier = 1.45;
  if (projectile.weapon === "breacher") multiplier = 0.9;
  if (projectile.owner === "player" && hasTrait(state, "borecutter")) multiplier *= 1.8;
  object.hp -= projectile.damage * multiplier;
  if (object.kind === "conduit" && object.hp <= object.maxHp * 0.55 && !object.exposed) {
    object.exposed = true;
    pushEvent(state, "POWER CONDUIT EXPOSED // ARC PATH AVAILABLE");
  }
  if (object.hp > 0) return;
  object.hp = 0;
  if (projectile.owner === "player" && hasTrait(state, "salvageDynamo")) {
    state.player.capacitor = Math.min(state.player.maxCapacitor, state.player.capacitor + 16);
    state.player.weaponHeat[state.player.currentWeapon] = Math.max(0, state.player.weaponHeat[state.player.currentWeapon] - 0.08);
  }
  if (projectile.owner === "player" && hasTrait(state, "scrapCircuit") && object.kind !== "cover" && state.player.capacitor >= 4) {
    state.player.capacitor -= 4;
    state.player.abilityCooldowns[2] = Math.max(0, state.player.abilityCooldowns[2] - 0.9);
  }
  if (object.kind === "cover") {
    object.active = false;
    if (object.id === "meridian-pressure-door") {
      const link = state.links.find((item) => item.id === "door-ab");
      if (link) link.open = true;
      pushEvent(state, "MERIDIAN PRESSURE LANE BREACHED // FLOW RESTORED", 1.8);
    } else pushEvent(state, `${object.label.toUpperCase()} COLLAPSED // LINE OF FIRE OPEN`);
  } else if (object.kind === "coolant") {
    object.active = false;
    const hazard = state.hazards.find((item) => !item.active);
    if (hazard) Object.assign(hazard, { active: true, x: object.x + object.w / 2, y: object.y + object.h / 2, radius: 150, life: 7, kind: "coolantJet", owner: "environment" });
    pushEvent(state, "COOLANT LINE RUPTURE // THRUST PLUME ACTIVE");
  } else if (object.kind === "breachPlate") {
    object.active = false;
    activateBreach(state, "service-breach");
  } else if (object.kind === "anchorNode") {
    object.active = false;
    object.exposed = true;
    spawnEffect(state, object.x + object.w / 2, object.y + object.h / 2, "arc", 92, 0.6);
    pushEvent(state, object.id.startsWith("enemy-tether") ? "MAG-TETHER COUPLING BROKEN // FULL MOBILITY RESTORED" : `${object.label.toUpperCase()} DESTROYED // VECTOR ANCHOR LOST`, 1.6);
  }
  if (projectile.owner === "player" && hasTrait(state, "archiveRelay")) {
    const cx = object.x + object.w / 2;
    const cy = object.y + object.h / 2;
    let hits = 0;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead || Math.hypot(enemy.x - cx, enemy.y - cy) > 250) continue;
      enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 2.4);
      enemy.statuses.conductive = Math.max(enemy.statuses.conductive, 4.2);
      dealEnemyDamage(state, enemy, 12, 0.55, 0.9);
      hits += 1;
    }
    if (hits > 0) {
      spawnEffect(state, cx, cy, "arc", 250, 0.55);
      pushEvent(state, `ARCHIVE RELAY DYNAMO // HARDWARE COLLAPSE ARCED TO ${hits} TARGET${hits === 1 ? "" : "S"}`, 1.5);
    }
  } else if (object.kind === "conduit") {
    object.hp = 1;
    object.exposed = true;
  }
}
function sectorState(sector) {
  if (sector.rapidTimer > 0 && sector.pressure > 0.08) return "decompressing";
  if (sector.pressure <= 0.07) return "vacuum";
  if (sector.pressure < 0.82) return "leaking";
  return "normal";
}
function applyPressureForce(state, body, sectorId, dt, scale) {
  var _a;
  for (const breach of state.breaches) {
    if (!breach.active || breach.sectorId !== sectorId) continue;
    const dx = breach.x - body.x;
    const dy = breach.y - body.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1 || distance > breach.radius) continue;
    const pressure = ((_a = state.sectors.find((item) => item.id === sectorId)) == null ? void 0 : _a.pressure) ?? 0;
    const weight = Math.pow(1 - distance / breach.radius, 1.35);
    const force = breach.strength * pressure * weight * scale;
    body.vx += dx / distance * force * dt;
    body.vy += dy / distance * force * dt;
  }
}
function nearestActiveBreach(state, sectorId) {
  return state.breaches.find((item) => item.active && item.sectorId === sectorId) ?? null;
}
function isAnchoredByElite(state, enemy) {
  const node = state.objects.find((object) => object.kind === "anchorNode" && !object.id.startsWith("enemy-tether") && object.active && object.hp > 0 && Math.hypot(object.x + object.w / 2 - enemy.x, object.y + object.h / 2 - enemy.y) < 270);
  if (node) return true;
  const elite = state.enemies.find((item) => item.combatClass === "elite" && !item.dead && item.active && item.statuses.disrupted <= 0);
  return !!elite && Math.hypot(elite.x - enemy.x, elite.y - enemy.y) < 300;
}
function activeSquadCount(state) {
  let count = 0;
  for (const enemy of state.enemies) if (enemy.role !== "boss" && enemy.active && !enemy.dead) count += 1;
  return count;
}
function findBoss(state) {
  return state.enemies.find((enemy) => enemy.role === "boss") ?? null;
}
function spawnEnemy(id, role, label, x, y, hp, armor, sign, active = true, variant = "standard") {
  return { id, role, variant, combatClass: role === "boss" ? "command" : role === "elite" ? "elite" : "standard", protocols: [], protocolPulse: 0, label, x, y, vx: 0, vy: 0, hp, maxHp: hp, armor, maxArmor: armor, effectiveness: 1, fireCooldown: 0.8 + id * 0.17, telegraph: 0, telegraphAim: { x: -1, y: 0 }, strafeSign: sign, dead: false, deathT: 0, active, state: "hold", hazardCooldown: 2.5 + id * 0.4, burst: 0, carriedObjectId: null, statuses: blankStatuses(), bossPhase: 1, bossPattern: "none", patternIndex: 0, anchored: role === "elite" || role === "boss" };
}
function createSimulation(build = neutralCombatBuild) {
  seed = 1597463007;
  const carbineConfig = resolveWeaponConfig(build, "carbine");
  const breacherConfig = resolveWeaponConfig(build, "breacher");
  const railConfig = resolveWeaponConfig(build, "rail");
  const objects = [
    { id: "crate-a", label: "Light cargo stack", kind: "cover", material: "light", x: 540, y: 390, w: 120, h: 180, hp: 70, maxHp: 70, destructible: true, active: true, exposed: false },
    { id: "bulkhead-a", label: "Compressor housing", kind: "cover", material: "bulkhead", x: 860, y: 650, w: 190, h: 82, hp: 9999, maxHp: 9999, destructible: false, active: true, exposed: false },
    { id: "crate-b", label: "Transfer pallet", kind: "cover", material: "light", x: 1060, y: 285, w: 120, h: 150, hp: 62, maxHp: 62, destructible: true, active: true, exposed: false },
    { id: "bulkhead-b", label: "Pressure machinery", kind: "cover", material: "industrial", x: 1310, y: 585, w: 150, h: 120, hp: 170, maxHp: 170, destructible: true, active: true, exposed: false },
    { id: "conduit-a", label: "Main bus conduit", kind: "conduit", material: "system", x: 1185, y: 735, w: 78, h: 70, hp: 75, maxHp: 75, destructible: true, active: true, exposed: false },
    { id: "coolant-a", label: "Coolant riser", kind: "coolant", material: "system", x: 920, y: 300, w: 52, h: 86, hp: 54, maxHp: 54, destructible: true, active: true, exposed: false },
    { id: "service-plate", label: "Service hull plate", kind: "breachPlate", material: "industrial", x: 1285, y: 175, w: 170, h: 42, hp: 82, maxHp: 82, destructible: true, active: true, exposed: false },
    { id: "door-control", label: "Pressure door control", kind: "doorControl", material: "system", x: 745, y: 735, w: 34, h: 58, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: "gravity-control", label: "Transfer spin control", kind: "gravityControl", material: "system", x: 1240, y: 205, w: 42, h: 58, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: "arena-conduit", label: "Crane power trunk", kind: "conduit", material: "system", x: 1850, y: 710, w: 82, h: 72, hp: 88, maxHp: 88, destructible: true, active: true, exposed: false },
    { id: "arena-cover", label: "Crane carriage", kind: "cover", material: "industrial", x: 1900, y: 330, w: 180, h: 88, hp: 185, maxHp: 185, destructible: true, active: true, exposed: false },
    { id: "boss-gate", label: "Crane well pressure gate", kind: "cover", material: "bulkhead", x: 1492, y: 160, w: 28, h: 760, hp: 9999, maxHp: 9999, destructible: false, active: true, exposed: false },
    { id: "boss-seal", label: "Emergency hull shutter", kind: "sealControl", material: "system", x: 1688, y: 228, w: 42, h: 62, hp: 40, maxHp: 40, destructible: false, active: true, exposed: false },
    { id: "enemy-tether-a", label: "Mag tether coupling", kind: "anchorNode", material: "system", x: 0, y: 0, w: 34, h: 34, hp: 48, maxHp: 48, destructible: true, active: false, exposed: true },
    { id: "enemy-tether-b", label: "Mag tether coupling", kind: "anchorNode", material: "system", x: 0, y: 0, w: 34, h: 34, hp: 48, maxHp: 48, destructible: true, active: false, exposed: true },
    { id: "protocol-shutter-a", label: "Protocol emergency shutter", kind: "cover", material: "industrial", x: 1030, y: 330, w: 54, h: 168, hp: 110, maxHp: 110, destructible: true, active: false, exposed: false },
    { id: "protocol-shutter-b", label: "Protocol emergency shutter", kind: "cover", material: "industrial", x: 1230, y: 610, w: 54, h: 168, hp: 110, maxHp: 110, destructible: true, active: false, exposed: false }
  ];
  return {
    time: 0,
    build,
    weapons: { carbine: carbineConfig, breacher: breacherConfig, rail: railConfig },
    droneTick: 0,
    lastAbilityIndex: -1,
    lastAbilityAt: -99,
    abilityChain: 0,
    bossGateHold: false,
    operationTier: 1,
    monsterLevel: 1,
    maxRecoveryLevel: 12,
    monsterDamageScale: 1,
    groundLoot: [],
    collectedLoot: [],
    player: { x: 330, y: 590, vx: 0, vy: 0, aim: { x: 1, y: 0 }, move: { x: 0, y: 0 }, hp: 100 + build.player.maxHpAdd, maxHp: 100 + build.player.maxHpAdd, armor: 68 + build.player.maxArmorAdd, maxArmor: 68 + build.player.maxArmorAdd, capacitor: 100 + build.player.maxCapAdd, maxCapacitor: 100 + build.player.maxCapAdd, fireCooldown: 0, abilityCooldowns: [0, 0, 0], dodgeCooldown: 0, dodgeTime: 0, lastDodgeAt: -99, invulnerable: 0, consumableCooldown: 0, weaponHeat: { carbine: 0, breacher: 0, rail: 0 }, mags: { carbine: carbineConfig.magazine, breacher: breacherConfig.magazine, rail: railConfig.magazine }, reloadT: 0, reloadWeapon: "carbine", ventT: 0, dead: false, currentWeapon: "carbine", vacuumExposure: 0, disrupted: 0 },
    enemies: [spawnEnemy(1, "assault", "Pressure Raider", 760, 500, 76, 38, 1), spawnEnemy(2, "suppressor", "Line Suppressor", 1030, 655, 82, 46, -1), spawnEnemy(3, "technician", "Systems Tech", 1140, 330, 70, 34, 1), spawnEnemy(4, "assault", "Pressure Raider", 1320, 540, 78, 40, -1), spawnEnemy(5, "suppressor", "Line Suppressor", 1370, 760, 84, 48, 1), spawnEnemy(6, "elite", "Anchor Marshal", 1270, 430, 140, 105, -1), spawnEnemy(7, "assault", "Reserve Raider", 1450, 300, 76, 38, 1, false), spawnEnemy(8, "technician", "Reserve Systems Tech", 1320, 790, 72, 36, -1, false), spawnEnemy(9, "technician", "Carrier Repair Drone", 0, 0, 52, 20, 1, false, "repairDrone"), spawnEnemy(10, "technician", "Carrier Repair Drone", 0, 0, 52, 20, -1, false, "repairDrone"), spawnEnemy(99, "boss", "Dock Warden Orison", 2070, 525, 560, 185, 1, false, "orison")],
    projectiles: Array.from({ length: 112 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 0, life: 0, owner: "player", weapon: "carbine", penetration: 0, armorDamage: 0.5, healthMultiplier: 1, knockback: 0.05, lastObjectId: null, lastObjectT: 0 })),
    objects,
    sectors: [
      { id: "A", label: "SPIN DECK", x: 80, y: 160, w: 690, h: 760, pressure: 1, pressureState: "normal", gravity: 1, rapidTimer: 0, targetPressure: 1 },
      { id: "B", label: "TRANSFER BAY", x: 770, y: 160, w: 740, h: 760, pressure: 0.88, pressureState: "normal", gravity: 0.34, rapidTimer: 0, targetPressure: 0.88 },
      { id: "C", label: "CRANE WELL", x: 1510, y: 160, w: 730, h: 760, pressure: 1, pressureState: "normal", gravity: 0.72, rapidTimer: 0, targetPressure: 1 }
    ],
    links: [{ id: "door-ab", a: "A", b: "B", open: true, conductance: 0.045 }, { id: "door-bc", a: "B", b: "C", open: false, conductance: 0.055 }],
    breaches: [{ id: "service-breach", sectorId: "B", x: 1370, y: 160, active: false, sealed: false, strength: 980, radius: 620, boss: false }, { id: "boss-breach", sectorId: "C", x: 2220, y: 515, active: false, sealed: false, strength: 1280, radius: 690, boss: true }],
    hazards: Array.from({ length: 12 }, () => ({ active: false, x: 0, y: 0, radius: 0, life: 0, kind: "shockGrid", owner: "enemy" })),
    debris: Array.from({ length: 16 }, (_, index) => ({ active: false, x: index < 8 ? 930 + index % 4 * 145 : 1770 + index % 4 * 135, y: 265 + index % 5 * 115, vx: 0, vy: 0, radius: 8 + index % 3 * 3, sectorId: index < 8 ? "B" : "C" })),
    effects: Array.from({ length: 30 }, () => ({ active: false, x: 0, y: 0, kind: "impact", life: 0, maxLife: 0, radius: 0 })),
    complete: false,
    bossActive: false,
    bossDefeated: false,
    pulse: 0,
    weaponFlash: 0,
    kills: 0,
    squadSuppressing: false,
    eventText: "VECTOR SYSTEM ONLINE // MULTI-SYSTEM COMBAT AUTHORIZED",
    eventT: 3,
    telemetry: { damageDealt: 0, damageTaken: 0, deaths: 0, kills: 0, eliteKills: 0, eliteProtocolsDefeated: 0, killIntervalTotal: 0, killIntervalSamples: 0, lastKillAt: 0, protocolCombinations: {}, weaponShots: { carbine: 0, breacher: 0, rail: 0 }, abilityUses: [0, 0, 0], encounterStart: 0, bossStart: 0, duration: 0, trace: [], nextTraceAt: 0 }
  };
}
function setMove(state, move) {
  state.player.move = len(move) > 1 ? norm(move) : move;
}
function setAim(state, aim, touchAssist) {
  let desired = norm(aim);
  if (len(desired) > 0.1) state.player.aim = desired;
}
function triggerReload(state) {
  const p = state.player;
  const weapon = getWeaponConfig(state, p.currentWeapon);
  if (!p.dead && p.reloadT <= 0 && p.mags[p.currentWeapon] < weapon.magazine) {
    p.reloadWeapon = p.currentWeapon;
    p.reloadT = weapon.reloadSeconds;
    return true;
  }
  return false;
}
function triggerFire(state) {
  const p = state.player;
  const weapon = getWeaponConfig(state, p.currentWeapon);
  if (p.dead || state.complete || p.reloadT > 0 || p.fireCooldown > 0 || p.ventT > 0 || p.weaponHeat[p.currentWeapon] >= 0.98) {
    if (p.weaponHeat[p.currentWeapon] >= 0.98) pushEvent(state, "WEAPON OVERHEAT // CEASE FIRE OR VENT", 1.1);
    return false;
  }
  if (p.mags[p.currentWeapon] <= 0) {
    triggerReload(state);
    return false;
  }
  if (p.capacitor < weapon.capacitorCost) {
    pushEvent(state, "CAPACITOR LOW // RAIL LANCE INHIBITED", 1.1);
    return false;
  }
  const sector = currentSector(state, p.x, p.y);
  const speed = Math.hypot(p.vx, p.vy);
  const velocityDot = speed > 1 ? (p.vx * p.aim.x + p.vy * p.aim.y) / speed : 0;
  const markedTarget = state.build.mechanics.sensorPenetration || state.build.specialization === "survey-deadeye" ? targetInAimCone(state, 760, 0.12) : null;
  const penetrationBonus = (markedTarget == null ? void 0 : markedTarget.statuses.marked) ? 24 : 0;
  const redlineScale = weapon.id === "breacher" && hasTrait(state, "redlineVelocity") ? 1 + Math.min(0.6, speed / 350 * 0.6) : 1;
  const lateralSpool = weapon.id === "carbine" && hasTrait(state, "inertiaSpool") && speed > 180 && Math.abs(velocityDot) < 0.55;
  const pendulumBrake = weapon.id === "breacher" && hasTrait(state, "pendulumBreach") && speed > 150 && velocityDot < -0.35;
  const cryoline = weapon.id === "rail" && hasTrait(state, "cryolineRail") && p.weaponHeat.rail < 0.18;
  const coldStartBreach = weapon.id === "breacher" && hasTrait(state, "coldStartBreach") && p.weaponHeat.breacher < 0.18;
  const nearBreach = weapon.id === "breacher" && hasTrait(state, "stormVentgun") && state.breaches.some((breach) => breach.active && breach.sectorId === sector.id && Math.hypot(breach.x - p.x, breach.y - p.y) < 420);
  const ghostline = weapon.id === "carbine" && hasTrait(state, "ghostline") && sector.pressure < 0.35;
  const pressurePsalm = weapon.id === "carbine" && hasTrait(state, "pressureBallistics");
  const pressureVelocity = pressurePsalm ? sector.pressure < 0.45 ? 1.22 : sector.pressure > 0.75 ? 0.92 : 1 : 1;
  const shotOrdinal = state.telemetry.weaponShots[p.currentWeapon] + 1;
  const forkedSpool = weapon.id === "carbine" && hasTrait(state, "forkedSpool") && shotOrdinal % 6 === 0;
  const breachEcho = weapon.id === "breacher" && hasTrait(state, "breachEcho") && state.time - p.lastDodgeAt <= 0.65;
  const railDoublet = weapon.id === "rail" && hasTrait(state, "railDoublet") && p.weaponHeat.rail < 0.22 && p.capacitor >= weapon.capacitorCost + 8;
  const projectileSpeed = weapon.projectileSpeed * (ghostline ? 1.35 : 1) * (lateralSpool ? 1.18 : 1) * (coldStartBreach ? 1.12 : 1) * pressureVelocity;
  const shotDamage = weapon.damage * redlineScale * (nearBreach ? 1.22 : 1) * (pendulumBrake ? 1.22 : 1) * (cryoline ? 1.18 : 1) * (lateralSpool ? 1.22 : 1) * (coldStartBreach ? 1.24 : 1);
  const shotPenetration = weapon.penetration + penetrationBonus + (ghostline ? 28 : 0) + (cryoline ? 24 : 0) + (coldStartBreach ? 18 : 0) + (pressurePsalm && sector.pressure < 0.45 ? 16 : 0);
  const shotKnockback = weapon.knockback * (nearBreach ? 1.75 : 1);
  for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
    const spread = (rand() - 0.5) * weapon.spread * 2;
    const c = Math.cos(spread);
    const s = Math.sin(spread);
    const dir = norm({ x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c });
    addProjectile(state, p.x + dir.x * 28, p.y + dir.y * 28, dir, projectileSpeed, shotDamage, "player", { weapon: weapon.id, penetration: shotPenetration, armorDamage: weapon.armorDamage, healthMultiplier: weapon.healthMultiplier, knockback: shotKnockback, radius: weapon.id === "rail" ? 5 : 4 });
  }
  if (forkedSpool) for (const angle of [-0.13, 0.13]) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c };
    addProjectile(state, p.x + dir.x * 28, p.y + dir.y * 28, dir, projectileSpeed * 0.96, shotDamage * 0.55, "player", { weapon: "carbine", penetration: shotPenetration * 0.58, armorDamage: weapon.armorDamage * 0.72, healthMultiplier: weapon.healthMultiplier * 0.8, knockback: shotKnockback * 0.6, radius: 3 });
  }
  if (breachEcho) for (const angle of [-0.19, 0, 0.19]) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c };
    addProjectile(state, p.x + dir.x * 30, p.y + dir.y * 30, dir, projectileSpeed * 0.9, shotDamage * 0.55, "player", { weapon: "breacher", penetration: Math.max(5, shotPenetration * 0.55), armorDamage: weapon.armorDamage * 0.7, healthMultiplier: weapon.healthMultiplier * 0.75, knockback: shotKnockback * 0.8, radius: 3 });
  }
  if (railDoublet) {
    const angle = 0.012;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c };
    addProjectile(state, p.x + dir.x * 30, p.y + dir.y * 30, dir, projectileSpeed * 0.92, shotDamage * 0.58, "player", { weapon: "rail", penetration: shotPenetration * 0.72, armorDamage: weapon.armorDamage * 0.82, healthMultiplier: weapon.healthMultiplier * 0.82, knockback: shotKnockback * 0.65, radius: 4 });
    p.capacitor = Math.max(0, p.capacitor - 8);
  }
  if (weapon.id === "rail" && hasTrait(state, "sunwardFracture") && p.weaponHeat.rail > 0.55) for (const angle of [-0.045, 0.045]) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dir = { x: p.aim.x * c - p.aim.y * s, y: p.aim.x * s + p.aim.y * c };
    addProjectile(state, p.x + dir.x * 28, p.y + dir.y * 28, dir, weapon.projectileSpeed * 0.92, weapon.damage * 0.38, "player", { weapon: "rail", penetration: Math.max(20, weapon.penetration * 0.45), armorDamage: 0.8, healthMultiplier: 0.7, knockback: 0.04, radius: 3 });
  }
  if (weapon.id === "rail" && hasTrait(state, "vacuumWake")) plantHazard(state, p.x + p.aim.x * 300, p.y + p.aim.y * 300, "vacuumWake", 2.4);
  p.mags[p.currentWeapon] -= 1;
  p.capacitor = Math.max(0, p.capacitor - weapon.capacitorCost);
  p.fireCooldown = 1 / weapon.rate;
  p.weaponHeat[p.currentWeapon] = Math.min(1, p.weaponHeat[p.currentWeapon] + weapon.heatPerShot + (coldStartBreach ? 0.06 : 0) + (weapon.id === "breacher" && hasTrait(state, "redlineBulwark") && p.weaponHeat.breacher >= 0.72 ? 0.04 : 0) + (forkedSpool ? 0.05 : 0) + (breachEcho ? 0.07 : 0) + (railDoublet ? 0.08 : 0));
  if (nearBreach) p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.06);
  if (hasTrait(state, "cryostack") && p.weaponHeat[p.currentWeapon] >= 0.92) p.abilityCooldowns = p.abilityCooldowns.map((value) => Math.max(0, value - 0.65));
  if (weapon.id === "carbine" && hasTrait(state, "palisadeDoctrine") && speed < 55) p.armor = Math.min(p.maxArmor, p.armor + 0.7);
  const gravity = sector.gravity;
  const recoilScale = (0.22 + (1 - gravity) * 0.92) * (ghostline ? 0.35 : 1) * (lateralSpool ? 0.55 : 1) * (weapon.id === "rail" && hasTrait(state, "recoilLedger") ? 1.3 : 1) * (weapon.id === "carbine" && hasTrait(state, "recoilDynamo") ? 1.18 : 1) * (weapon.id === "breacher" && hasTrait(state, "rheaBackblast") ? 1.45 : 1);
  const propulsion = weapon.id === "breacher" && gravity < 0.15 && state.build.mechanics.breacherPropulsion ? 1 + 0.6 * (state.build.mechanics.breacherPropulsionScale || 1) : 1;
  const control = Math.max(0.68, 1 - state.build.player.lowGControl * (gravity < 0.35 ? 0.28 : 0.08));
  const recoilForce = weapon.recoil * recoilScale * propulsion * control;
  if (state.build.mechanics.recoilVectoring && len(p.move) > 0.15) {
    p.vx += -p.aim.x * recoilForce * 0.65 + p.move.x * recoilForce * 0.35;
    p.vy += -p.aim.y * recoilForce * 0.65 + p.move.y * recoilForce * 0.35;
  } else {
    p.vx -= p.aim.x * recoilForce;
    p.vy -= p.aim.y * recoilForce;
  }
  const recoilReturn = Math.max(weapon.id === "rail" && hasTrait(state, "recoilLedger") ? 7 : 0, weapon.id === "carbine" && hasTrait(state, "recoilDynamo") ? Math.min(8, recoilForce * 0.16) : 0, state.build.specialization === "momentum-broker" ? Math.min(state.build.specializationOverclock ? 10 : 8, recoilForce * 0.07) : 0, pendulumBrake ? 8 : 0);
  if (recoilReturn > 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + recoilReturn);
  if (weapon.id === "breacher" && hasTrait(state, "rheaBackblast")) p.dodgeCooldown = Math.max(0, p.dodgeCooldown - 0.22);
  if (pendulumBrake) {
    p.vx *= 0.55;
    p.vy *= 0.55;
    pushEvent(state, "PENDULUM KESTREL // COUNTER-IMPULSE BANKED", 1.2);
  }
  state.weaponFlash = 0.07;
  state.telemetry.weaponShots[p.currentWeapon] += 1;
  if (p.mags[p.currentWeapon] === 0) triggerReload(state);
  return true;
}
function triggerDodge(state) {
  const p = state.player;
  if (p.dead || state.complete || p.dodgeCooldown > 0) return false;
  const preSpeed = Math.hypot(p.vx, p.vy);
  const dir = norm(len(p.move) > 0.15 ? p.move : p.aim);
  const sector = currentSector(state, p.x, p.y);
  const gravity = sector.gravity;
  const scrapline = hasTrait(state, "scraplineDodge") && gravity < 0.35;
  let speed = lerp(650, 535, gravity) * (scrapline ? 1.24 : 1);
  const thermalField = hasTrait(state, "boiloffDash") && p.capacitor >= 8 ? state.hazards.filter((hazard) => hazard.active && (hazard.kind === "coolantJet" || hazard.kind === "boiloffJet") && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 240).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : null;
  if (thermalField) {
    thermalField.active = false;
    p.capacitor -= 8;
    speed *= 1.22;
    for (const id of ["carbine", "breacher", "rail"]) p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - 0.08);
    spawnEffect(state, thermalField.x, thermalField.y, "pulse", thermalField.radius, 0.45);
  }
  p.vx = dir.x * speed;
  p.vy = dir.y * speed;
  p.dodgeTime = 0.18;
  p.lastDodgeAt = state.time;
  p.invulnerable = 0.24;
  p.dodgeCooldown = scrapline ? 1 : 1.3;
  if (hasTrait(state, "atlasDodgeCap")) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + Math.min(28, preSpeed * 0.065));
  if (hasTrait(state, "clutchstep")) {
    const field = state.hazards.filter((hazard) => hazard.active && (hazard.kind === "gravityWell" || hazard.kind === "vectorWash") && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 310).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (field) {
      field.active = false;
      p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 16);
      p.dodgeCooldown = Math.max(0.7, p.dodgeCooldown - 0.28);
      spawnEffect(state, field.x, field.y, "pulse", field.radius, 0.45);
    }
  }
  if (hasTrait(state, "pressureReservoir") && sector.pressure < 0.35 && p.capacitor >= 8) {
    p.capacitor -= 8;
    plantHazard(state, p.x, p.y, "vacuumWake", 2.3, "player");
  }
  if (hasTrait(state, "momentumMark") && preSpeed >= 180 && p.capacitor >= 6) {
    const target = state.enemies.filter((enemy) => enemy.active && !enemy.dead && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 620 && clearLine(state, p.x, p.y, enemy.x, enemy.y)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (target) {
      p.capacitor -= 6;
      target.statuses.marked = Math.max(target.statuses.marked, 4.5);
      spawnEffect(state, target.x, target.y, "mark", 48, 0.5);
    }
  }
  if (state.build.mechanics.dodgeVent) p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.22 * (state.build.mechanics.dodgeVentScale || 1));
  if (state.build.specialization === "redline-pilot" && state.build.specializationOverclock && p.weaponHeat[p.currentWeapon] >= 0.75) {
    p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.12);
    p.dodgeCooldown += 0.18;
    for (const enemy of state.enemies) {
      const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (!enemy.active || enemy.dead || distance > 210) continue;
      enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.32));
    }
    spawnEffect(state, p.x, p.y, "pulse", 210, 0.42);
  }
  if (hasTrait(state, "axisGhost") && gravity < 0.12) {
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
      const distance = len(delta);
      if (distance <= 0 || distance > 255) continue;
      const away = norm(delta);
      enemy.vx += away.x * 440 * (1 - distance / 310);
      enemy.vy += away.y * 440 * (1 - distance / 310);
      enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.45));
    }
    spawnEffect(state, p.x, p.y, "pulse", 255, 0.5);
  }
  return true;
}
function targetInAimCone(state, maxDistance, coneScore) {
  const p = state.player;
  let target = null;
  let best = 999;
  for (const enemy of state.enemies) {
    if (enemy.dead || !enemy.active) continue;
    const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
    const distance = len(delta);
    if (distance > maxDistance) continue;
    const n = norm(delta);
    const score = 1 - (n.x * p.aim.x + n.y * p.aim.y) + distance / 15e3;
    if (score < coneScore && score < best && clearLine(state, p.x, p.y, enemy.x, enemy.y)) {
      best = score;
      target = enemy;
    }
  }
  return target;
}
function findAimConduit(state, maxDistance) {
  const p = state.player;
  let target = null;
  let best = 999;
  for (const object of state.objects) {
    if (!object.active) continue;
    if (object.kind === "conduit" && !object.exposed) continue;
    if (object.kind !== "conduit" && object.kind !== "anchorNode") continue;
    const cx = object.x + object.w / 2;
    const cy = object.y + object.h / 2;
    const delta = { x: cx - p.x, y: cy - p.y };
    const distance = len(delta);
    if (distance > maxDistance) continue;
    const n = norm(delta);
    const score = 1 - (n.x * p.aim.x + n.y * p.aim.y) + distance / 12e3;
    if (score < 0.11 && score < best) {
      best = score;
      target = object;
    }
  }
  return target;
}
function triggerAbility(state, index = 0) {
  const p = state.player;
  const meta = getAbilityConfig(state, index);
  if (p.dead || state.complete || p.abilityCooldowns[index] > 0) return false;
  if (p.capacitor < meta.cost) {
    pushEvent(state, "CAPACITOR LOW // ABILITY INHIBITED", 1.1);
    return false;
  }
  const previousAbility = state.lastAbilityIndex;
  const chained = previousAbility >= 0 && previousAbility !== index && state.time - state.lastAbilityAt <= 3.4;
  p.capacitor -= meta.cost;
  const capacitorAfterCost = p.capacitor;
  p.abilityCooldowns[index] = meta.cooldown;
  state.telemetry.abilityUses[index] += 1;
  if (index === 0) {
    state.pulse = 0.36;
    for (const enemy of state.enemies) {
      if (enemy.dead || !enemy.active) continue;
      const delta = { x: enemy.x - p.x, y: enemy.y - p.y };
      const distance = len(delta);
      if (distance > 285 || distance < 1) continue;
      const dir = norm(delta);
      if (dir.x * p.aim.x + dir.y * p.aim.y < 0.1) continue;
      const exosuit = enemy.variant === "meleeExosuit";
      const anchored = !exosuit && (enemy.combatClass === "elite" || enemy.role === "boss" || protocolAnchorsEnemy(enemy) || isAnchoredByElite(state, enemy)) && enemy.statuses.disrupted <= 0;
      const force = 610 * meta.power * (1 - distance / 390) * (anchored ? 0.18 : 1) * (exosuit ? 1.75 : 1);
      enemy.vx += dir.x * force;
      enemy.vy += dir.y * force;
      enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, exosuit ? 1.35 : anchored ? 0.2 : 0.8));
      dealEnemyDamage(state, enemy, (exosuit ? 13 : 8) * meta.power, 0.28, 0.6);
    }
    for (const projectile of state.projectiles) {
      if (!projectile.active || projectile.owner !== "enemy") continue;
      const delta = { x: projectile.x - p.x, y: projectile.y - p.y };
      const distance = len(delta);
      if (distance > 250 || distance < 1) continue;
      const dir = norm(delta);
      if (dir.x * p.aim.x + dir.y * p.aim.y > 0) {
        if (state.build.mechanics.magRedirect) {
          projectile.owner = "player";
          projectile.weapon = "carbine";
          projectile.damage = 16 * (state.build.mechanics.magRedirectScale || 1);
          projectile.penetration = 10 * (state.build.mechanics.magRedirectScale || 1);
          const speed = Math.max(560, Math.hypot(projectile.vx, projectile.vy));
          projectile.vx = dir.x * speed;
          projectile.vy = dir.y * speed;
        } else {
          projectile.vx += dir.x * 620;
          projectile.vy += dir.y * 620;
        }
      }
    }
    if (hasTrait(state, "magBloom")) {
      for (let spoke = 0; spoke < 8; spoke += 1) {
        const angle = Math.PI * 2 * spoke / 8;
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        addProjectile(state, p.x + dir.x * 34, p.y + dir.y * 34, dir, 590, 10 * meta.power, "player", { weapon: "carbine", penetration: 9, armorDamage: 0.52, healthMultiplier: 0.8, knockback: 0.035, radius: 3 });
      }
      spawnEffect(state, p.x, p.y, "pulse", 190, 0.5);
    }
    const counterKick = state.build.mechanics.magOverdriveKick ? 104 : 62;
    p.vx -= p.aim.x * counterKick;
    p.vy -= p.aim.y * counterKick;
    const canConsumeField = hasTrait(state, "massTap") || state.build.mechanics.magBoundarySink;
    const field = canConsumeField ? state.hazards.filter((hazard) => hazard.active && (hazard.kind === "gravityWell" || hazard.kind === "vectorWash" || state.build.mechanics.magBoundarySink && (hazard.kind === "boiloffJet" || hazard.kind === "shockGrid")) && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 330).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : null;
    if (field) {
      field.active = false;
      if (hasTrait(state, "massTap")) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 14);
      if (state.build.mechanics.magBoundarySink) {
        for (const enemy of state.enemies) {
          const delta = { x: enemy.x - field.x, y: enemy.y - field.y };
          const distance = len(delta);
          if (!enemy.active || enemy.dead || distance <= 0 || distance > 260) continue;
          const away = norm(delta);
          enemy.vx += away.x * 280 * (1 - distance / 300);
          enemy.vy += away.y * 280 * (1 - distance / 300);
        }
      }
      spawnEffect(state, field.x, field.y, "pulse", Math.max(120, field.radius), 0.55);
    }
    const sector = currentSector(state, p.x, p.y);
    if (state.build.specialization === "pressure-diver" && sector.pressure < 0.45) plantHazard(state, p.x + p.aim.x * 145, p.y + p.aim.y * 145, "vacuumWake", state.build.specializationOverclock ? 3 : 2.2, "player");
    pushEvent(state, field ? hasTrait(state, "massTap") ? "MASS RETURN // LOCAL FIELD COLLAPSED TO CAPACITOR" : "BOUNDARY SINK // HOSTILE FIELD GEOMETRY COLLAPSED" : state.build.mechanics.magRedirect ? "MAGNETIC IMPULSE // HOSTILE VECTORS REDIRECTED" : "MAGNETIC IMPULSE // VECTOR DISPLACEMENT", 1.2);
  } else if (index === 1) {
    const target = targetInAimCone(state, 690, 0.1);
    if (target) {
      target.statuses.marked = 7.5 * meta.power * (hasTrait(state, "markCascade") ? 0.78 : 1);
      if (target.role === "technician" || target.combatClass === "elite" || target.role === "boss" || target.protocols.length > 0) target.statuses.disrupted = Math.max(target.statuses.disrupted, 2.8);
      target.anchored = false;
      spawnEffect(state, target.x, target.y, "mark", 64, 0.7);
      if (hasTrait(state, "tetherhand")) plantHazard(state, target.x, target.y, "gravityWell", 2.8);
      if (state.build.mechanics.widebandMark) {
        const secondary = state.enemies.find((enemy) => enemy.active && !enemy.dead && enemy.id !== target.id && Math.hypot(enemy.x - target.x, enemy.y - target.y) < 260);
        if (secondary) {
          secondary.statuses.marked = 5.2 * meta.power;
          spawnEffect(state, secondary.x, secondary.y, "mark", 48, 0.55);
        }
      }
      if (hasTrait(state, "custodyShear") && target.carriedObjectId) {
        dropCarriedObjective(state, target, true);
        p.abilityCooldowns[1] = Math.min(p.abilityCooldowns[1], 1.4);
        pushEvent(state, "CUSTODY SHEAR // CARRIED MISSION HARDWARE RELEASED // TAG RESTORED", 1.6);
      }
      if (hasTrait(state, "custodyShear")) {
        const hardware = state.objects.filter((object) => object.active && object.kind === "anchorNode" && (object.id.includes("custody-") || object.id.includes("siphon")) && Math.hypot(object.x + object.w / 2 - target.x, object.y + object.h / 2 - target.y) < 360).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
        if (hardware) {
          hardware.hp = 0;
          hardware.active = false;
          hardware.exposed = true;
          spawnEffect(state, hardware.x + hardware.w / 2, hardware.y + hardware.h / 2, "arc", 80, 0.45);
        }
      }
      if (hasTrait(state, "relayCrown")) {
        const relay = state.objects.find((object) => object.active && (object.kind === "conduit" || object.kind === "anchorNode") && (object.exposed || object.kind === "anchorNode") && Math.hypot(object.x + object.w / 2 - target.x, object.y + object.h / 2 - target.y) < 330);
        if (relay) {
          const cx = relay.x + relay.w / 2;
          const cy = relay.y + relay.h / 2;
          let jumped = 0;
          for (const enemy of state.enemies) {
            if (!enemy.active || enemy.dead || enemy.id === target.id || Math.hypot(enemy.x - cx, enemy.y - cy) > 310) continue;
            enemy.statuses.marked = Math.max(enemy.statuses.marked, 4.8 * meta.power);
            spawnEffect(state, enemy.x, enemy.y, "mark", 42, 0.5);
            jumped += 1;
            if (jumped >= 2) break;
          }
          if (jumped > 0) pushEvent(state, `RELAY CROWN // SENSOR SPIKE JUMPED THROUGH ${relay.label.toUpperCase()}`, 1.7);
          else pushEvent(state, `SENSOR SPIKE // ${target.label.toUpperCase()} MARKED`, 1.4);
        } else pushEvent(state, `SENSOR SPIKE // ${target.label.toUpperCase()} MARKED`, 1.4);
      } else pushEvent(state, `SENSOR SPIKE // ${target.label.toUpperCase()} MARKED`, 1.4);
    } else {
      p.capacitor = Math.min(p.maxCapacitor, p.capacitor + meta.cost * 0.55);
      p.abilityCooldowns[index] = 1.2;
      pushEvent(state, "SENSOR SPIKE // NO VALID RETURN", 1.1);
    }
  } else {
    const conduit = findAimConduit(state, 520);
    const target = targetInAimCone(state, 430, 0.14);
    if (conduit) {
      const cx = conduit.x + conduit.w / 2;
      const cy = conduit.y + conduit.h / 2;
      if (conduit.kind === "anchorNode") {
        conduit.hp = Math.max(0, conduit.hp - 68 * meta.power);
        if (conduit.hp <= 0) {
          conduit.active = false;
          conduit.exposed = true;
          pushEvent(state, `${conduit.label.toUpperCase()} SHORTED // ANCHOR FIELD COLLAPSED`, 1.7);
        }
      }
      spawnEffect(state, cx, cy, "arc", 260, 0.7);
      let hits = 0;
      for (const enemy of state.enemies) {
        if (enemy.dead || !enemy.active || Math.hypot(enemy.x - cx, enemy.y - cy) > 275) continue;
        enemy.statuses.disrupted = Math.max(enemy.statuses.disrupted, 4.2);
        enemy.statuses.conductive = Math.max(enemy.statuses.conductive, 5.5);
        enemy.anchored = false;
        dealEnemyDamage(state, enemy, 22 * meta.power, 0.75, 1.05);
        hits += 1;
      }
      if (hasTrait(state, "machineSight")) {
        const extra = state.enemies.filter((enemy) => enemy.active && !enemy.dead && enemy.statuses.disrupted > 0 && Math.hypot(enemy.x - cx, enemy.y - cy) > 275 && Math.hypot(enemy.x - cx, enemy.y - cy) < 560).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
        if (extra) {
          extra.statuses.conductive = Math.max(extra.statuses.conductive, 4.5);
          dealEnemyDamage(state, extra, 18 * meta.power, 0.65, 1);
          spawnEffect(state, extra.x, extra.y, "arc", 64, 0.5);
          hits += 1;
        }
      }
      let markCooldownAdvance = 0;
      let magCooldownAdvance = 0;
      if (state.build.specialization === "grid-weaver") {
        const remote = state.enemies.filter((enemy) => enemy.active && !enemy.dead && Math.hypot(enemy.x - cx, enemy.y - cy) > 275 && Math.hypot(enemy.x - cx, enemy.y - cy) < 520).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
        if (remote) {
          remote.statuses.marked = Math.max(remote.statuses.marked, 4.2);
          spawnEffect(state, remote.x, remote.y, "mark", 42, 0.45);
        }
        if (state.build.specializationOverclock) markCooldownAdvance = Math.max(markCooldownAdvance, 0.8);
      }
      if (hasTrait(state, "relayOrchard")) {
        let marked = 0;
        for (const enemy of state.enemies.filter((enemy2) => enemy2.active && !enemy2.dead && Math.hypot(enemy2.x - cx, enemy2.y - cy) < 420).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))) {
          enemy.statuses.marked = Math.max(enemy.statuses.marked, 3.8);
          spawnEffect(state, enemy.x, enemy.y, "mark", 38, 0.4);
          marked += 1;
          if (marked >= 2) break;
        }
        markCooldownAdvance = Math.max(markCooldownAdvance, 0.55);
      }
      if (state.build.mechanics.arcCascadeLattice) {
        magCooldownAdvance = Math.max(magCooldownAdvance, 0.65);
        markCooldownAdvance = Math.max(markCooldownAdvance, 0.65);
      }
      if (magCooldownAdvance > 0) p.abilityCooldowns[0] = Math.max(0, p.abilityCooldowns[0] - magCooldownAdvance);
      if (markCooldownAdvance > 0) p.abilityCooldowns[1] = Math.max(0, p.abilityCooldowns[1] - markCooldownAdvance);
      if (hasTrait(state, "lockstepArc")) {
        p.armor = Math.min(p.maxArmor, p.armor + 14);
        p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 10);
      }
      if (hasTrait(state, "gridReclaimer")) {
        const hostileGrid = state.hazards.filter((hazard) => hazard.active && hazard.kind === "shockGrid" && Math.hypot(hazard.x - cx, hazard.y - cy) < 390).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
        if (hostileGrid) {
          hostileGrid.active = false;
          p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 10);
          p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.08);
          pushEvent(state, "GRID RECLAIMER // HOSTILE ARC FIELD REROUTED TO OPERATOR BUS", 1.5);
        }
      }
      if (state.build.mechanics.arcGroundLoop) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 18);
      pushEvent(state, hits > 0 ? `ARC TAP // CONDUIT PROPAGATION // ${hits} TARGET${hits === 1 ? "" : "S"}` : "ARC TAP // CONDUIT ENERGIZED // NO TARGET IN PATH", 1.7);
    } else if (target) {
      const wasMarked = target.statuses.marked > 0;
      const bonus = wasMarked || target.statuses.conductive > 0;
      target.statuses.disrupted = Math.max(target.statuses.disrupted, bonus ? 4.5 : 2.2);
      target.statuses.conductive = Math.max(target.statuses.conductive, 4.5);
      target.anchored = false;
      dealEnemyDamage(state, target, (bonus ? 24 : 14) * meta.power, bonus ? 0.95 : 0.5, 1);
      if (hasTrait(state, "splitReference") && wasMarked && !target.dead) {
        const relay = state.objects.filter((object) => object.active && (object.kind === "conduit" || object.kind === "anchorNode") && Math.hypot(object.x + object.w / 2 - target.x, object.y + object.h / 2 - target.y) < 300).sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
        if (relay) {
          target.statuses.marked = 0;
          const cx = relay.x + relay.w / 2;
          const cy = relay.y + relay.h / 2;
          const second = state.enemies.filter((enemy) => enemy.active && !enemy.dead && enemy.id !== target.id && Math.hypot(enemy.x - cx, enemy.y - cy) < 340).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
          if (second) {
            second.statuses.disrupted = Math.max(second.statuses.disrupted, 3);
            second.statuses.conductive = Math.max(second.statuses.conductive, 4);
            dealEnemyDamage(state, second, 12, 0.55, 0.85);
            spawnEffect(state, second.x, second.y, "arc", 56, 0.45);
          }
        }
      }
      spawnEffect(state, target.x, target.y, "arc", 90, 0.55);
      pushEvent(state, bonus ? "ARC TAP // STATUS COUPLING AMPLIFIED" : "ARC TAP // LOCAL DISRUPTION", 1.4);
    } else {
      p.capacitor = Math.min(p.maxCapacitor, p.capacitor + meta.cost * 0.55);
      p.abilityCooldowns[index] = 1.3;
      pushEvent(state, "ARC TAP // NO CONDUCTIVE PATH", 1.1);
    }
  }
  const pressureSector = currentSector(state, p.x, p.y);
  if (state.build.specialization === "pressure-diver" && pressureSector.pressure < 0.45) p.vacuumExposure = Math.max(0, p.vacuumExposure - (state.build.specializationOverclock ? 0.8 : 0.4));
  if (chained) {
    state.abilityChain = Math.min(2, state.abilityChain + 1);
    if (state.build.specialization === "capacitor-conductor") {
      const desiredRefund = state.build.specializationOverclock && state.abilityChain >= 2 ? 8 : 6;
      const existingRecovery = Math.max(0, p.capacitor - capacitorAfterCost);
      const refund = Math.max(0, Math.min(desiredRefund, 8 - Math.min(8, existingRecovery)));
      if (refund > 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + refund);
      if (state.build.specializationOverclock && state.abilityChain >= 2) p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.08);
    }
    if (hasTrait(state, "abilityRosary")) {
      p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.06);
      if (previousAbility >= 0) p.abilityCooldowns[previousAbility] = Math.max(0, p.abilityCooldowns[previousAbility] - 0.3);
    }
  } else state.abilityChain = 0;
  state.lastAbilityIndex = index;
  state.lastAbilityAt = state.time;
  return true;
}
function stepPressure(state, dt) {
  for (const sector of state.sectors) {
    const breach = state.breaches.find((item) => item.sectorId === sector.id && item.active);
    if (sector.rapidTimer > 0) sector.rapidTimer = Math.max(0, sector.rapidTimer - dt);
    if (breach) {
      const drain = sector.rapidTimer > 0 ? 0.21 : 0.055;
      sector.pressure = Math.max(0, sector.pressure - drain * dt * breach.strength / 980);
      sector.targetPressure = 0;
    } else if (sector.pressure < sector.targetPressure) sector.pressure = Math.min(sector.targetPressure, sector.pressure + 0.045 * dt);
  }
  for (const link of state.links) {
    if (!link.open) continue;
    const a = state.sectors.find((item) => item.id === link.a);
    const b = state.sectors.find((item) => item.id === link.b);
    if (!a || !b) continue;
    const flow = (a.pressure - b.pressure) * link.conductance * dt;
    a.pressure = clamp(a.pressure - flow, 0, 1);
    b.pressure = clamp(b.pressure + flow, 0, 1);
  }
  for (const sector of state.sectors) sector.pressureState = sectorState(sector);
}
function stepStatuses(enemy, dt) {
  enemy.statuses.armorBreach = Math.max(0, enemy.statuses.armorBreach - dt);
  enemy.statuses.disrupted = Math.max(0, enemy.statuses.disrupted - dt);
  enemy.statuses.marked = Math.max(0, enemy.statuses.marked - dt);
  enemy.statuses.stagger = Math.max(0, enemy.statuses.stagger - dt);
  enemy.statuses.conductive = Math.max(0, enemy.statuses.conductive - dt);
  enemy.statuses.vacuum = Math.max(0, enemy.statuses.vacuum - dt);
}
function stepPlayer(state, dt) {
  const p = state.player;
  const sector = currentSector(state, p.x, p.y);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.abilityCooldowns = p.abilityCooldowns.map((value) => Math.max(0, value - dt));
  p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
  p.dodgeTime = Math.max(0, p.dodgeTime - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.consumableCooldown = Math.max(0, p.consumableCooldown - dt);
  p.disrupted = Math.max(0, p.disrupted - dt);
  if (p.ventT > 0) p.ventT = Math.max(0, p.ventT - dt);
  for (const id of ["carbine", "breacher", "rail"]) {
    const config = getWeaponConfig(state, id);
    const ventBonus = p.ventT > 0 && id === p.currentWeapon ? 3.4 : 1;
    p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - config.heatDissipation * ventBonus * dt);
  }
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      p.reloadT = 0;
      p.mags[p.reloadWeapon] = getWeaponConfig(state, p.reloadWeapon).magazine;
    }
  }
  if (p.ventT <= 0 && p.disrupted <= 0) p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 13.5 * state.build.player.capRegenMul * dt);
  const siphon = state.objects.find((object) => object.active && object.kind === "anchorNode" && object.id.includes("siphon") && object.hp > 0 && Math.hypot(object.x + object.w / 2 - p.x, object.y + object.h / 2 - p.y) < 310);
  if (siphon) p.capacitor = Math.max(0, p.capacitor - 8 * dt);
  if (sector.pressure < 0.18) {
    p.vacuumExposure += dt * (1 - state.build.player.vacuumResistance * 0.55);
    if (p.vacuumExposure > 1.8 + state.build.player.vacuumResistance * 2.4) applyPlayerDamage(state, 3.2 * (1 - state.build.player.vacuumResistance * 0.78) * dt, 1);
  } else p.vacuumExposure = Math.max(0, p.vacuumExposure - dt * 1.8);
  applyPressureForce(state, p, sector.id, dt, 0.48 * (1 - state.build.player.vacuumResistance * 0.45));
  if (!p.dead && p.dodgeTime <= 0) {
    const glasswalker = hasTrait(state, "glasswalker") && sector.pressure < 0.18;
    const redlineMove = state.build.specialization === "redline-pilot" && p.weaponHeat[p.currentWeapon] >= 0.75;
    const accel = lerp(880, 1210, sector.gravity) * (glasswalker ? 1.22 : 1) * (redlineMove ? 1.05 : 1);
    const maxSpeed = 278 * state.build.player.moveSpeedMul * (glasswalker ? 1.18 : 1) * (redlineMove ? 1.08 : 1);
    const mobilityScale = p.ventT > 0 ? 0.72 : p.disrupted > 0 ? 0.82 : 1;
    p.vx += p.move.x * accel * mobilityScale * state.build.player.moveSpeedMul * dt;
    p.vy += p.move.y * accel * mobilityScale * state.build.player.moveSpeedMul * dt;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      p.vx *= maxSpeed / speed;
      p.vy *= maxSpeed / speed;
    }
    const damping = Math.pow(Math.max(9e-4, lerp(0.48, 9e-4, sector.gravity) - (sector.gravity < 0.35 ? state.build.player.lowGControl * 0.16 : 0)), dt);
    p.vx *= damping;
    p.vy *= damping;
  } else if (p.dodgeTime <= 0) {
    p.vx *= Math.pow(0.06, dt);
    p.vy *= Math.pow(0.06, dt);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 105, world.w - 105);
  p.y = clamp(p.y, 185, world.h - 125);
  for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(p, playerRadius, object);
}
function pressureRetreatVector(state, enemy) {
  const sector = currentSector(state, enemy.x, enemy.y);
  if (protocolIgnoresPressureRetreat(enemy)) return { x: 0, y: 0 };
  if (sector.pressure > 0.38) return { x: 0, y: 0 };
  const breach = nearestActiveBreach(state, sector.id);
  if (!breach) return { x: -1, y: 0 };
  return norm({ x: enemy.x - breach.x, y: enemy.y - breach.y });
}
function findCoverPoint(state, enemy) {
  const p = state.player;
  let best = null;
  let score = 99999;
  for (const object of state.objects) {
    if (!object.active || object.kind !== "cover") continue;
    const cx = object.x + object.w / 2;
    const cy = object.y + object.h / 2;
    const dEnemy = Math.hypot(cx - enemy.x, cy - enemy.y);
    if (dEnemy > 430) continue;
    const fromPlayer = norm({ x: cx - p.x, y: cy - p.y });
    const point2 = { x: cx + fromPlayer.x * (Math.max(object.w, object.h) * 0.65 + 40), y: cy + fromPlayer.y * (Math.max(object.w, object.h) * 0.65 + 40) };
    const localScore = dEnemy - Math.hypot(point2.x - p.x, point2.y - p.y) * 0.12;
    if (localScore < score) {
      score = localScore;
      best = point2;
    }
  }
  return best;
}
function fireEnemyShot(state, enemy, speed, damage, spread = 0) {
  const count = spread > 0.05 ? 3 : 1;
  for (let i = 0; i < count; i += 1) {
    const angle = count === 1 ? 0 : (i - 1) * spread;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dir = { x: enemy.telegraphAim.x * c - enemy.telegraphAim.y * s, y: enemy.telegraphAim.x * s + enemy.telegraphAim.y * c };
    addProjectile(state, enemy.x + dir.x * 26, enemy.y + dir.y * 26, dir, speed, damage, "enemy", { weapon: "enemy", armorDamage: 0.5, healthMultiplier: 1, radius: enemy.role === "boss" ? 7 : 6 });
  }
}
function plantHazard(state, x, y, kind, life, owner) {
  const hazard = state.hazards.find((item) => !item.active);
  if (!hazard) return;
  Object.assign(hazard, { active: true, x, y, radius: kind === "gravityWell" ? 185 : kind === "vectorWash" ? 210 : kind === "boiloffJet" ? 170 : kind === "vacuumWake" ? 165 : kind === "coolantJet" ? 150 : 120, life, kind, owner: owner ?? (kind === "vacuumWake" ? "player" : kind === "coolantJet" || kind === "vectorWash" || kind === "boiloffJet" ? "environment" : "enemy") });
}
function activateBarrier(state, prefix, x, y) {
  const barrier = state.objects.find((object) => object.id.startsWith(prefix) && !object.active && object.hp > 0);
  if (!barrier) return false;
  barrier.active = true;
  if (typeof x === "number") barrier.x = clamp(x, 830, 1370);
  if (typeof y === "number") barrier.y = clamp(y, 225, 820);
  return true;
}
function tetherForEnemy(state, enemy) {
  return state.objects.find((object) => object.id.startsWith("enemy-tether") && object.active && object.label.endsWith(`#${enemy.id}`)) ?? null;
}
function deploySupportNode(state, prefix, enemy, label) {
  const node = state.objects.find((object) => object.id.startsWith(prefix) && !object.active && object.hp > 0);
  if (!node) return false;
  node.active = true;
  node.exposed = true;
  node.label = label;
  node.x = clamp(state.player.x + enemy.strafeSign * 120 - node.w / 2, 180, world.w - 180);
  node.y = clamp(state.player.y + 70 - node.h / 2, 210, world.h - 160);
  return true;
}
function deployEnemyTether(state, enemy) {
  const node = state.objects.find((object) => object.id.startsWith("enemy-tether") && !object.active && object.hp > 0);
  if (!node) return false;
  const p = state.player;
  node.active = true;
  node.exposed = true;
  node.label = `Mag tether coupling #${enemy.id}`;
  node.hp = node.maxHp;
  node.x = clamp(p.x + (enemy.x - p.x) * 0.35 - node.w / 2, 120, world.w - 160);
  node.y = clamp(p.y + (enemy.y - p.y) * 0.35 - node.h / 2, 190, world.h - 150);
  return true;
}
function deployCarrierDrone(state, enemy) {
  const drone = state.enemies.find((item) => (item.id === 9 || item.id === 10) && !item.active && !item.dead);
  if (!drone) return false;
  drone.active = true;
  drone.x = clamp(enemy.x + enemy.strafeSign * 65, 120, world.w - 120);
  drone.y = clamp(enemy.y + 55, 190, world.h - 130);
  drone.fireCooldown = 0.8;
  drone.hazardCooldown = 1.8;
  return true;
}
function repairTacticalHardware(state, enemy) {
  const target = state.objects.filter((object) => !object.id.startsWith("enemy-tether") && (object.kind === "conduit" || object.kind === "anchorNode") && object.hp > 0 && (object.hp < object.maxHp || !object.active)).sort((a, b) => Math.hypot(a.x - enemy.x, a.y - enemy.y) - Math.hypot(b.x - enemy.x, b.y - enemy.y))[0];
  if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 520) return false;
  target.active = true;
  target.hp = Math.min(target.maxHp, target.hp + 34);
  if (target.kind === "conduit" && target.hp > target.maxHp * 0.7) target.exposed = false;
  return true;
}
function breachNearestCover(state, enemy) {
  const target = state.objects.filter((object) => object.active && object.kind === "cover" && object.destructible && object.hp > 0).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  if (!target || Math.hypot(target.x - enemy.x, target.y - enemy.y) > 720) return false;
  target.hp = 0;
  target.active = false;
  if (target.id === "meridian-pressure-door") {
    const link = state.links.find((item) => item.id === "door-ab");
    if (link) link.open = true;
  }
  return true;
}
function stepEnemy(state, enemy, dt) {
  if (!enemy.active) return;
  stepStatuses(enemy, dt);
  if (enemy.dead) {
    enemy.deathT = Math.max(0, enemy.deathT - dt);
    enemy.vx *= Math.pow(0.06, dt);
    enemy.vy *= Math.pow(0.06, dt);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    return;
  }
  if (enemy.role === "boss") {
    stepBoss(state, enemy, dt);
    return;
  }
  const p = state.player;
  if (p.dead) return;
  enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
  enemy.hazardCooldown = Math.max(0, enemy.hazardCooldown - dt);
  const sector = currentSector(state, enemy.x, enemy.y);
  const anchorProtected = enemy.combatClass === "elite" || protocolAnchorsEnemy(enemy) || isAnchoredByElite(state, enemy) && enemy.statuses.disrupted <= 0;
  applyPressureForce(state, enemy, sector.id, dt, anchorProtected ? 0.12 : 0.92);
  if (sector.pressure < 0.16 && !anchorProtected && enemy.variant !== "vacuumSaboteur" && !protocolVacuumImmune(enemy)) {
    enemy.statuses.vacuum = 1.2;
    enemy.hp -= 4.3 * dt;
    if (enemy.hp <= 0) finishEnemyDeath(state, enemy);
  }
  if (enemy.statuses.stagger > 0) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    return;
  }
  const delta = { x: p.x - enemy.x, y: p.y - enemy.y };
  const distance = len(delta);
  const toward = norm(delta);
  const sideways = { x: -toward.y * enemy.strafeSign, y: toward.x * enemy.strafeSign };
  const retreat = pressureRetreatVector(state, enemy);
  const hasPressureThreat = len(retreat) > 0.1;
  const recoilMover = enemy.variant === "vectorSkirmisher" || enemy.variant === "tetherRigger" || enemy.variant === "impulseRigger" || enemy.variant === "recoilBroker";
  const droneMover = enemy.variant === "maintenanceDrone" || enemy.variant === "gravityDrone" || enemy.variant === "repairDrone";
  let desired = { x: 0, y: 0 };
  let desiredDistance = enemy.role === "assault" ? state.squadSuppressing ? 145 : 205 : enemy.role === "suppressor" ? 470 : enemy.role === "technician" ? 410 : 330;
  if (recoilMover) desiredDistance = 305;
  else if (enemy.variant === "anchorEngineer") desiredDistance = 390;
  else if (droneMover) desiredDistance = enemy.variant === "gravityDrone" ? 430 : 340;
  else if (enemy.variant === "marksman") desiredDistance = 690;
  else if (enemy.variant === "meleeExosuit") desiredDistance = 72;
  else if (enemy.variant === "shieldBoarder") desiredDistance = 175;
  else if (enemy.variant === "salvageThief" || enemy.variant === "custodyPorter") desiredDistance = enemy.carriedObjectId ? 900 : 260;
  if (hasPressureThreat && !anchorProtected) {
    desired = retreat;
    enemy.state = "retreat";
  } else if (enemy.role === "suppressor" || enemy.role === "technician") {
    const coverPoint = findCoverPoint(state, enemy);
    if (coverPoint && clearLine(state, enemy.x, enemy.y, p.x, p.y)) {
      const toCover = norm({ x: coverPoint.x - enemy.x, y: coverPoint.y - enemy.y });
      desired = norm({ x: toCover.x * 0.65 + sideways.x * 0.35, y: toCover.y * 0.65 + sideways.y * 0.35 });
      enemy.state = "cover";
    }
  }
  if (len(desired) < 0.1) {
    if (distance > desiredDistance + 70) {
      desired = norm({ x: toward.x * 0.82 + sideways.x * 0.38, y: toward.y * 0.82 + sideways.y * 0.38 });
      enemy.state = "advance";
    } else if (distance < desiredDistance - 80) {
      desired = norm({ x: -toward.x * 0.82 + sideways.x * 0.48, y: -toward.y * 0.82 + sideways.y * 0.48 });
      enemy.state = "retreat";
    } else {
      desired = sideways;
      enemy.state = "hold";
    }
  }
  if ((enemy.variant === "salvageThief" || enemy.variant === "custodyPorter" || protocolCarriesObjective(enemy)) && enemy.carriedObjectId) {
    desired = norm({ x: 120 - enemy.x, y: 520 - enemy.y });
    enemy.state = "retreat";
  }
  const protocolMobility = protocolMobilityScale(enemy, sector.pressure);
  const accel = (recoilMover ? 740 : droneMover ? 700 : enemy.variant === "meleeExosuit" ? 820 : enemy.variant === "salvageThief" || enemy.variant === "custodyPorter" ? 760 : enemy.role === "assault" ? 660 : 500) * protocolMobility;
  const speedLimit = (recoilMover ? 172 : droneMover ? 164 : enemy.variant === "meleeExosuit" ? 188 : enemy.variant === "salvageThief" ? 184 : enemy.role === "assault" ? 150 : enemy.combatClass === "elite" ? 118 : 108) * protocolMobility;
  enemy.vx += desired.x * accel * dt;
  enemy.vy += desired.y * accel * dt;
  const speed = Math.hypot(enemy.vx, enemy.vy);
  if (speed > speedLimit) {
    enemy.vx *= speedLimit / speed;
    enemy.vy *= speedLimit / speed;
  }
  const dampingBase = lerp(0.4, 0.012, sector.gravity);
  enemy.vx *= Math.pow(dampingBase, dt);
  enemy.vy *= Math.pow(dampingBase, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.x = clamp(enemy.x, 110, world.w - 110);
  enemy.y = clamp(enemy.y, 185, world.h - 125);
  for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(enemy, enemyRadius, object);
  if (enemy.variant === "tetherOperator") {
    const tether = tetherForEnemy(state, enemy);
    if (tether) {
      const pull = norm({ x: enemy.x - p.x, y: enemy.y - p.y });
      p.vx += pull.x * 250 * dt;
      p.vy += pull.y * 250 * dt;
      p.vx *= Math.pow(0.28, dt);
      p.vy *= Math.pow(0.28, dt);
    }
    if (!tether && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
      if (deployEnemyTether(state, enemy)) pushEvent(state, "MAG-TETHER OPERATOR // MOBILITY CABLE LOCKED // BREAK THE COUPLING", 2);
      enemy.hazardCooldown = 8.8;
    }
  }
  if (enemy.variant === "droneCarrier" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    if (deployCarrierDrone(state, enemy)) pushEvent(state, "DRONE CARRIER // REPAIR MICRODRONE DEPLOYED", 1.5);
    enemy.hazardCooldown = 8.6;
  }
  if (enemy.variant === "coverBreacher" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    if (breachNearestCover(state, enemy)) pushEvent(state, "COVER BREACHER // DEMOLITION CHARGE // FIRING LANE OPENED", 1.7);
    enemy.hazardCooldown = 7.4;
  }
  if (enemy.variant === "repairDrone" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    if (repairTacticalHardware(state, enemy)) pushEvent(state, "REPAIR DRONE // MACHINERY OR ANCHOR HARDWARE RESTORED", 1.5);
    enemy.hazardCooldown = 5.8;
  }
  if (enemy.variant === "gravitySpecialist" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, "gravityWell", 4.8);
    pushEvent(state, "GRAVITY SPECIALIST // MASS WELL PROJECTED", 1.5);
    enemy.hazardCooldown = 6.5;
  }
  if (enemy.variant === "vacuumSaboteur" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    const breach = state.breaches.find((item) => item.id === "service-breach");
    const serviceSeal = state.objects.find((object) => object.id === "service-seal");
    if (breach && serviceSeal && !breach.active) {
      activateBreach(state, "service-breach");
      pushEvent(state, "VACUUM SABOTEUR // SERVICE PLATE DELIBERATELY RUPTURED", 2);
    }
    enemy.hazardCooldown = 11.5;
  }
  if (enemy.variant === "impulseRigger" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    plantHazard(state, p.x + p.vx * 0.55, p.y + p.vy * 0.55, "vectorWash", 4.4);
    pushEvent(state, "IMPULSE RIGGER // COUNTERMASS WASH VENTED INTO TRANSFER LANE", 1.8);
    enemy.hazardCooldown = 7.6;
  }
  if (enemy.variant === "boiloffTech" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    plantHazard(state, p.x + p.vx * 0.35, p.y + p.vy * 0.35, "boiloffJet", 4.8);
    pushEvent(state, "BOILOFF TECH // CRYOGENIC PURGE PLUME OPEN", 1.7);
    enemy.hazardCooldown = 7.9;
  }
  if (enemy.variant === "partitionRigger" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    const raised = activateBarrier(state, "transfer-partition", enemy.x + enemy.strafeSign * 110, enemy.y + 40);
    if (raised) pushEvent(state, "PRESSURE PARTITION RIGGER // MOVABLE SHUTTER RAISED // BREAK OR FLANK", 2);
    enemy.hazardCooldown = 8.1;
  }
  if (enemy.variant === "recoilBroker" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    plantHazard(state, p.x + p.vx * 0.55, p.y + p.vy * 0.55, "vectorWash", 4.2);
    enemy.vx -= toward.x * 260;
    enemy.vy -= toward.y * 260;
    pushEvent(state, "COUNTERFORCE BROKER // RECOIL VECTOR + COUNTERMASS WASH COMMITTED", 2);
    enemy.hazardCooldown = 7.2;
  }
  if (enemy.variant === "siphonTech" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    if (deploySupportNode(state, "siphon-node", enemy, "Hostile capacitor siphon relay")) pushEvent(state, "CAPACITOR SIPHON // RELAY NODE ONLINE // ARC OR BREAK THE HARDWARE", 2.1);
    enemy.hazardCooldown = 8.4;
  }
  if (enemy.variant === "purgeOrchestrator" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    const local = currentSector(state, p.x, p.y);
    local.pressure = Math.max(0.2, local.pressure - 0.1);
    local.rapidTimer = Math.max(local.rapidTimer, 1.5);
    plantHazard(state, p.x + p.vx * 0.4, p.y + p.vy * 0.4, "boiloffJet", 4.6);
    pushEvent(state, "CONTROLLED DECOMPRESSION // PURGE ORCHESTRATOR // MOVE OR INTERRUPT", 2.2);
    enemy.hazardCooldown = 8.2;
  }
  if (enemy.variant === "geometryTech" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    const raised = activateBarrier(state, "custody-shutter", enemy.x + enemy.strafeSign * 105, enemy.y + 30);
    if (raised) pushEvent(state, "CUSTODY GEOMETRY // FIRING SHUTTER MOVED // DESTROY OR FLANK", 2);
    enemy.hazardCooldown = 8.3;
  }
  if (enemy.variant === "salvageThief" || enemy.variant === "custodyPorter") {
    if (!enemy.carriedObjectId && enemy.hazardCooldown <= 0) {
      const tagged = state.objects.find((object) => object.kind === "salvageNode" && object.active && object.exposed);
      if (tagged) {
        tagged.exposed = false;
        tagged.active = false;
        enemy.carriedObjectId = tagged.id;
        pushEvent(state, `${enemy.variant === "custodyPorter" ? "CUSTODY PORTER" : "SALVAGE THIEF"} // ${tagged.label.toUpperCase()} HARDWARE STOLEN // INTERCEPT CARRIER`, 2);
      }
      enemy.hazardCooldown = 4.2;
    }
    if (enemy.carriedObjectId && enemy.x < 175) {
      dropCarriedObjective(state, enemy, false);
      pushEvent(state, `${enemy.variant === "custodyPorter" ? "CUSTODY PORTER" : "SALVAGE THIEF"} REACHED AIRLOCK // PACKAGE DROPPED // RE-TAG REQUIRED`, 2);
    }
  }
  if (protocolCarriesObjective(enemy) && enemy.carriedObjectId && enemy.x < 175) {
    dropCarriedObjective(state, enemy, false);
    pushEvent(state, "SALVAGE INTERDICTOR REACHED AIRLOCK // PACKAGE DROPPED // RE-TAG REQUIRED", 2);
  }
  stepEnemyProtocols(state, enemy, dt, distance, toward, sector.pressure);
  if (enemy.variant === "barricadeTrooper" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    if (activateBarrier(state, "meridian-barricade", enemy.x + enemy.strafeSign * 92, enemy.y + 34)) pushEvent(state, "MERIDIAN PALISADE // PORTABLE BARRICADE DEPLOYED", 1.5);
    enemy.hazardCooldown = 8.4;
  }
  if (enemy.variant === "pressureLockTech" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    const door = state.objects.find((object) => object.id === "meridian-pressure-door");
    const link = state.links.find((item) => item.id === "door-ab");
    if (door && door.hp > 0 && !door.active) {
      door.active = true;
      if (link) link.open = false;
      pushEvent(state, "LOCK TECH // PRESSURE LANE CLOSED // BREAK THE SHUTTER OR REPOSITION", 2.1);
    }
    enemy.hazardCooldown = 9.5;
  }
  if (enemy.variant === "tetherRigger" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    if (enemy.role === "elite") {
      plantHazard(state, p.x - p.vx * 0.2, p.y - p.vy * 0.2, "coolantJet", 4.5);
      pushEvent(state, "JURY-RIG FOREMAN // IMPROVISED THRUSTER LINE LIVE", 1.6);
    } else {
      plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, "gravityWell", 4.2);
      pushEvent(state, "TETHER HAND // MAGNETIC TETHER FIELD CAST", 1.6);
    }
    enemy.hazardCooldown = 6.8;
  }
  if (enemy.variant === "maintenanceDrone" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    plantHazard(state, p.x + p.vx * 0.25, p.y + p.vy * 0.25, "shockGrid", 4.2);
    enemy.hazardCooldown = 6.4;
    pushEvent(state, "MAINTENANCE DRONE // ARC-CUTTER GRID LIVE", 1.4);
  }
  if (enemy.variant === "gravityDrone" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    plantHazard(state, p.x + p.vx * 0.4, p.y + p.vy * 0.4, "gravityWell", 4.4);
    enemy.hazardCooldown = 7.1;
    pushEvent(state, "MASS-TRIM DRONE // LOCAL GRAVITY WELL", 1.4);
  }
  const customTechnician = enemy.variant === "pressureLockTech" || enemy.variant === "tetherRigger" || enemy.variant === "maintenanceDrone" || enemy.variant === "gravityDrone" || enemy.variant === "tetherOperator" || enemy.variant === "droneCarrier" || enemy.variant === "repairDrone" || enemy.variant === "gravitySpecialist" || enemy.variant === "boiloffTech" || enemy.variant === "partitionRigger" || enemy.variant === "siphonTech" || enemy.variant === "purgeOrchestrator" || enemy.variant === "geometryTech";
  if (enemy.role === "technician" && !customTechnician && enemy.hazardCooldown <= 0 && distance < 560 && enemy.statuses.disrupted <= 0) {
    plantHazard(state, p.x + p.vx * 0.32, p.y + p.vy * 0.32, "shockGrid", 5.5);
    enemy.hazardCooldown = 7.2;
    pushEvent(state, "TECH UNIT // SHOCK GRID DEPLOYED", 1.2);
  }
  if (enemy.variant === "anchorEngineer" && enemy.hazardCooldown <= 0 && enemy.statuses.disrupted <= 0) {
    const node = state.objects.find((object) => object.kind === "anchorNode" && object.id.startsWith("field-anchor") && !object.active && object.hp > 0);
    if (node) {
      node.active = true;
      node.exposed = true;
      node.x = clamp(enemy.x + enemy.strafeSign * 105, 860, 1450);
      node.y = clamp(enemy.y + 90, 220, 840);
      pushEvent(state, "ANCHOR ENGINEER // STABILIZATION NODE DEPLOYED", 1.8);
    }
    enemy.hazardCooldown = 7.8;
  }
  if (enemy.telegraph > 0) {
    enemy.telegraph -= dt;
    if (enemy.telegraph <= 0) {
      if (enemy.variant === "meleeExosuit") {
        if (distance < 145) {
          const shove = norm({ x: p.x - enemy.x, y: p.y - enemy.y });
          applyPlayerDamage(state, 24, 0.08);
          p.vx += shove.x * 360;
          p.vy += shove.y * 360;
        }
      } else if (enemy.variant === "marksman") fireEnemyShot(state, enemy, 980, 25);
      else if (enemy.role === "assault") fireEnemyShot(state, enemy, 500, 10, 0.115);
      else if (enemy.role === "elite") fireEnemyShot(state, enemy, 560, 22);
      else fireEnemyShot(state, enemy, 465, 17);
      if (recoilMover) {
        enemy.vx -= enemy.telegraphAim.x * 155;
        enemy.vy -= enemy.telegraphAim.y * 155;
      }
      enemy.fireCooldown = enemy.variant === "marksman" ? 2.4 : enemy.variant === "meleeExosuit" ? 1.65 : enemy.role === "assault" ? 1.35 : enemy.role === "suppressor" ? 1.1 : enemy.role === "elite" ? 1.25 : 1.7;
      if (enemy.role === "suppressor" && enemy.variant !== "marksman") enemy.burst = 2;
    }
  } else if (enemy.burst > 0 && enemy.fireCooldown <= 0.72 && clearLine(state, enemy.x, enemy.y, p.x, p.y)) {
    enemy.telegraphAim = norm({ x: p.x - enemy.x, y: p.y - enemy.y });
    fireEnemyShot(state, enemy, 470, 11);
    enemy.burst -= 1;
    enemy.fireCooldown += 0.2;
  } else {
    const attackRange = enemy.variant === "marksman" ? 930 : enemy.variant === "meleeExosuit" ? 155 : enemy.role === "assault" ? 330 : 690;
    if (enemy.fireCooldown <= 0 && distance < attackRange && clearLine(state, enemy.x, enemy.y, p.x, p.y)) {
      enemy.telegraph = enemy.variant === "marksman" ? 1.45 : enemy.variant === "meleeExosuit" ? 0.62 : enemy.role === "assault" ? 0.45 : enemy.role === "elite" ? 0.64 : 0.72;
      enemy.telegraphAim = toward;
      enemy.state = "attack";
    }
  }
}
function beginBossPhaseTwo(state, boss) {
  boss.bossPhase = 2;
  boss.statuses.disrupted = 2.4;
  boss.anchored = false;
  const sector = state.sectors.find((item) => item.id === "C");
  if (sector) sector.gravity = 0.04;
  activateBreach(state, "boss-breach");
  const link = state.links.find((item) => item.id === "door-bc");
  if (link) link.open = false;
}
function foundryAnchorNodes(state) {
  return state.objects.filter((object) => object.kind === "anchorNode" && object.id.startsWith("foundry-anchor"));
}
function beginFoundryPhaseTwo(state, boss) {
  boss.bossPhase = 2;
  boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.8);
  boss.anchored = false;
  const sector = state.sectors.find((item) => item.id === "C");
  if (sector) sector.gravity = 0.08;
  plantHazard(state, 1810, 300, "coolantJet", 6.5);
  plantHazard(state, 2110, 720, "coolantJet", 6.5);
  pushEvent(state, "FOUNDRY MARSHAL // ANCHOR NETWORK LOST // LOW-G PROCESS PURGE", 3.6);
}
function activateFoundryAnchors(state) {
  let activated = 0;
  for (const node of foundryAnchorNodes(state)) {
    if (node.hp > 0) {
      node.active = true;
      node.exposed = true;
      activated += 1;
    }
  }
  return activated;
}
function stepFoundryBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  boss.hazardCooldown = Math.max(0, boss.hazardCooldown - dt);
  const sector = currentSector(state, boss.x, boss.y);
  const nodes = foundryAnchorNodes(state);
  const activeAnchors = nodes.filter((node) => node.active && node.hp > 0).length;
  const brokenAnchors = nodes.filter((node) => node.hp <= 0).length;
  boss.anchored = activeAnchors > 0 && boss.statuses.disrupted <= 0;
  applyPressureForce(state, boss, sector.id, dt, boss.anchored ? 0.06 : 0.68);
  if (boss.bossPhase === 1 && (brokenAnchors >= 2 || boss.hp <= boss.maxHp * 0.35)) beginFoundryPhaseTwo(state, boss);
  if (boss.statuses.stagger <= 0) {
    const delta = { x: p.x - boss.x, y: p.y - boss.y };
    const distance = len(delta);
    const toward = norm(delta);
    const sideways = { x: -toward.y * boss.strafeSign, y: toward.x * boss.strafeSign };
    const desired = distance > 470 ? norm({ x: toward.x * 0.58 + sideways.x * 0.52, y: toward.y * 0.58 + sideways.y * 0.52 }) : distance < 300 ? norm({ x: -toward.x * 0.7 + sideways.x * 0.45, y: -toward.y * 0.7 + sideways.y * 0.45 }) : sideways;
    boss.vx += desired.x * (boss.bossPhase === 2 ? 520 : 430) * dt;
    boss.vy += desired.y * (boss.bossPhase === 2 ? 520 : 430) * dt;
    const speed = Math.hypot(boss.vx, boss.vy);
    const maxSpeed = boss.bossPhase === 2 ? 148 : 112;
    if (speed > maxSpeed) {
      boss.vx *= maxSpeed / speed;
      boss.vy *= maxSpeed / speed;
    }
  }
  boss.vx *= Math.pow(lerp(0.58, 0.02, sector.gravity), dt);
  boss.vy *= Math.pow(lerp(0.58, 0.02, sector.gravity), dt);
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  boss.x = clamp(boss.x, 1580, world.w - 115);
  boss.y = clamp(boss.y, 210, world.h - 145);
  for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(boss, 31, object);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "forgeSweep") {
      const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
      boss.telegraphAim = aim;
      for (const angle of [-0.18, -0.09, 0, 0.09, 0.18]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const dir = { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c };
        addProjectile(state, boss.x, boss.y, dir, 620, boss.bossPhase === 2 ? 21 : 18, "enemy", { weapon: "enemy", armorDamage: 0.72, healthMultiplier: 1, radius: 7 });
      }
    } else if (boss.bossPattern === "gravityFlip") {
      const arena = state.sectors.find((item) => item.id === "C");
      if (arena) arena.gravity = arena.gravity < 0.3 ? 0.78 : 0.08;
      plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, "gravityWell", 4.2);
      pushEvent(state, `FOUNDRY GRAVITY BUS // ${arena && arena.gravity < 0.3 ? "LOW-G" : "HIGH-G"} SHIFT`, 2.5);
    } else if (boss.bossPattern === "anchorCast") {
      const activated = activateFoundryAnchors(state);
      pushEvent(state, activated > 0 ? "FOUNDRY ANCHORS ONLINE // BREAK OR DISRUPT THE NETWORK" : "ANCHOR BUS FAILED // MARSHAL EXPOSED", 2.8);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.2 : 1.65;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const phaseOne = ["anchorCast", "forgeSweep", "gravityFlip"];
  const phaseTwo = ["forgeSweep", "gravityFlip", "forgeSweep"];
  const patterns = boss.bossPhase === 2 ? phaseTwo : phaseOne;
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "anchorCast" ? 1.18 : boss.bossPattern === "gravityFlip" ? 1 : 0.9;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function moveArenaBoss(state, boss, dt, desiredDistance, accel, maxSpeed, pressureScale) {
  const p = state.player;
  const sector = currentSector(state, boss.x, boss.y);
  applyPressureForce(state, boss, sector.id, dt, pressureScale);
  if (boss.statuses.stagger <= 0) {
    const delta = { x: p.x - boss.x, y: p.y - boss.y };
    const distance = len(delta);
    const toward = norm(delta);
    const sideways = { x: -toward.y * boss.strafeSign, y: toward.x * boss.strafeSign };
    const desired = distance > desiredDistance + 70 ? norm({ x: toward.x * 0.62 + sideways.x * 0.45, y: toward.y * 0.62 + sideways.y * 0.45 }) : distance < desiredDistance - 75 ? norm({ x: -toward.x * 0.72 + sideways.x * 0.48, y: -toward.y * 0.72 + sideways.y * 0.48 }) : sideways;
    boss.vx += desired.x * accel * dt;
    boss.vy += desired.y * accel * dt;
    const speed = Math.hypot(boss.vx, boss.vy);
    if (speed > maxSpeed) {
      boss.vx *= maxSpeed / speed;
      boss.vy *= maxSpeed / speed;
    }
  }
  boss.vx *= Math.pow(lerp(0.56, 0.02, sector.gravity), dt);
  boss.vy *= Math.pow(lerp(0.56, 0.02, sector.gravity), dt);
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  boss.x = clamp(boss.x, 1580, world.w - 115);
  boss.y = clamp(boss.y, 210, world.h - 145);
  for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(boss, 31, object);
}
function stepMeridianBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  boss.hazardCooldown = Math.max(0, boss.hazardCooldown - dt);
  if (boss.bossPhase === 1 && (boss.armor <= 0 || boss.hp <= boss.maxHp * 0.4)) {
    boss.bossPhase = 2;
    boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.4);
    pushEvent(state, "COMMANDER VOSS // PALISADE ARMOR BREACHED // MOBILE RECOVERY DOCTRINE", 3.2);
  }
  moveArenaBoss(state, boss, dt, 390, boss.bossPhase === 2 ? 470 : 350, boss.bossPhase === 2 ? 126 : 96, 0.12);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "armorVolley") {
      const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
      boss.telegraphAim = aim;
      for (const angle of [-0.18, -0.09, 0, 0.09, 0.18]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 650, boss.bossPhase === 2 ? 22 : 18, "enemy", { weapon: "enemy", armorDamage: 0.92, radius: 7 });
      }
    } else if (boss.bossPattern === "barricadeCommand") {
      const first = activateBarrier(state, "commander-barricade");
      const second = activateBarrier(state, "commander-barricade");
      pushEvent(state, first || second ? "COMMAND PALISADE // TWO COVER LANES DEPLOYED" : "COMMAND PALISADE // RESERVE BARRICADES EXHAUSTED", 2.4);
    } else if (boss.bossPattern === "pressureLock") {
      const closed = activateBarrier(state, "commander-pressure-door");
      pushEvent(state, closed ? "COMMAND PRESSURE SHUTTER // ARENA LANE CLOSED" : "PRESSURE SHUTTER FRAME DESTROYED // LANE STAYS OPEN", 2.4);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.25 : 1.65;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const phaseOne = ["barricadeCommand", "armorVolley", "pressureLock"];
  const phaseTwo = ["armorVolley", "pressureLock", "armorVolley"];
  const patterns = boss.bossPhase === 2 ? phaseTwo : phaseOne;
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "armorVolley" ? 0.82 : 1.02;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepSalvageBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.bossPhase = 2;
    const arena = state.sectors.find((item) => item.id === "C");
    if (arena) arena.gravity = 0.05;
    pushEvent(state, "CAPTAIN KADE // COUNTERMASS LIMITERS OFFLINE // FREE RECOIL AUTHORIZED", 3.2);
  }
  moveArenaBoss(state, boss, dt, 315, boss.bossPhase === 2 ? 650 : 520, boss.bossPhase === 2 ? 192 : 155, 0.7);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    boss.telegraphAim = aim;
    if (boss.bossPattern === "tetherCast") {
      plantHazard(state, p.x + p.vx * 0.55, p.y + p.vy * 0.55, "gravityWell", boss.bossPhase === 2 ? 5.2 : 4.4);
      pushEvent(state, "MAG-TETHER CAST // BREAK VECTOR OR DODGE THE WELL", 2);
    } else if (boss.bossPattern === "backblastRush") {
      fireEnemyShot(state, boss, 560, boss.bossPhase === 2 ? 19 : 16, 0.13);
      boss.vx -= aim.x * (boss.bossPhase === 2 ? 470 : 350);
      boss.vy -= aim.y * (boss.bossPhase === 2 ? 470 : 350);
    } else if (boss.bossPattern === "scrapFan") {
      for (const angle of [-0.24, -0.12, 0, 0.12, 0.24]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 590, boss.bossPhase === 2 ? 20 : 17, "enemy", { weapon: "enemy", armorDamage: 0.62, radius: 7 });
      }
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.05 : 1.4;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["backblastRush", "tetherCast", "scrapFan"] : ["tetherCast", "backblastRush", "scrapFan"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "tetherCast" ? 1 : boss.bossPattern === "backblastRush" ? 0.72 : 0.86;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepYardmindBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  boss.vx = 0;
  boss.vy = 0;
  boss.anchored = true;
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.55) {
    boss.bossPhase = 2;
    const arena = state.sectors.find((item) => item.id === "C");
    if (arena) arena.gravity = 0.06;
    plantHazard(state, 1810, 315, "shockGrid", 6);
    plantHazard(state, 2110, 720, "shockGrid", 6);
    pushEvent(state, "HELIOS-9 // PROCESS AUTHORITY ESCALATED // HUMAN-SAFE LIMITS REVOKED", 3.4);
  }
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "droneCommand") {
      for (const offset of [-150, 0, 150]) {
        const originY = clamp(boss.y + offset, 230, 820);
        const aim = norm({ x: p.x - (boss.x - 80), y: p.y - originY });
        addProjectile(state, boss.x - 80, originY, aim, 520, boss.bossPhase === 2 ? 18 : 15, "enemy", { weapon: "enemy", armorDamage: 0.58, radius: 6 });
      }
      plantHazard(state, p.x + p.vx * 0.3, p.y + p.vy * 0.3, "shockGrid", 4.2);
      pushEvent(state, "YARDMIND // MAINTENANCE DRONES ROUTED TO ARC-CUTTER ATTACK", 2);
    } else if (boss.bossPattern === "doorCycle") {
      const a = state.objects.find((object) => object.id === "yard-door-a");
      const b = state.objects.find((object) => object.id === "yard-door-b");
      const openA = boss.patternIndex % 2 === 0;
      if ((a == null ? void 0 : a.hp) && a.hp > 0) a.active = openA;
      if ((b == null ? void 0 : b.hp) && b.hp > 0) b.active = !openA;
      pushEvent(state, "YARDMIND // FABRICATION SHUTTERS RECYCLED // FIRING LANES CHANGED", 2.3);
    } else if (boss.bossPattern === "gravityOverride") {
      const arena = state.sectors.find((item) => item.id === "C");
      if (arena) arena.gravity = arena.gravity < 0.3 ? 0.82 : 0.07;
      plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, "gravityWell", 4.5);
      pushEvent(state, `YARDMIND MASS CONTROL // ${arena && arena.gravity < 0.3 ? "LOW-G" : "HIGH-G"} OVERRIDE`, 2.4);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.15 : 1.55;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["droneCommand", "gravityOverride", "doorCycle", "droneCommand"] : ["doorCycle", "droneCommand", "gravityOverride"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "droneCommand" ? 0.9 : 1.05;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepPressureBrokerBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.52) {
    boss.bossPhase = 2;
    activateBreach(state, "boss-breach");
    pushEvent(state, "NAIMA RUSK // FALSE PRESSURE MAP RELEASED // STORMLINE VENTS OPEN", 3.2);
  }
  moveArenaBoss(state, boss, dt, 345, boss.bossPhase === 2 ? 610 : 500, boss.bossPhase === 2 ? 178 : 142, 0.2);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "pressureCascade") {
      activateBreach(state, "boss-breach");
      plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, "gravityWell", 4.2);
      pushEvent(state, "PRESSURE CASCADE // VENT VECTOR + MAGNETIC PULL", 2.2);
    } else if (boss.bossPattern === "shutterDebt") {
      const a = activateBarrier(state, "story-pressure-shutter");
      const b = activateBarrier(state, "story-pressure-shutter");
      pushEvent(state, a || b ? "BROKER SHUTTERS // RECOVERY LANES CLOSED" : "BROKER SHUTTERS EXHAUSTED // NO COVER LEFT", 2.2);
    } else if (boss.bossPattern === "latticePulse") {
      const delta = { x: boss.x - p.x, y: boss.y - p.y };
      const distance = len(delta);
      if (distance < 390) {
        const dir = norm(delta);
        p.vx += dir.x * 430;
        p.vy += dir.y * 430;
        p.disrupted = Math.max(p.disrupted, 0.7);
        applyPlayerDamage(state, boss.bossPhase === 2 ? 19 : 15, 0.18);
      }
      spawnEffect(state, boss.x, boss.y, "pulse", 360, 0.7);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.05 : 1.45;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["pressureCascade", "latticePulse", "shutterDebt", "latticePulse"] : ["shutterDebt", "pressureCascade", "latticePulse"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "latticePulse" ? 0.85 : 1.05;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepBondArbiterBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && (boss.armor <= 0 || boss.hp <= boss.maxHp * 0.44)) {
    boss.bossPhase = 2;
    boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.1);
    pushEvent(state, "ARBITER SHAW // CERTIFIED ARMOR FAILED // EMERGENCY SEIZURE AUTHORITY", 3.1);
  }
  moveArenaBoss(state, boss, dt, 405, boss.bossPhase === 2 ? 490 : 360, boss.bossPhase === 2 ? 128 : 92, 0.08);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "certifiedVolley") {
      const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
      for (const angle of [-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 660, boss.bossPhase === 2 ? 21 : 18, "enemy", { weapon: "enemy", armorDamage: 1.05, radius: 7 });
      }
    } else if (boss.bossPattern === "seizureWall") {
      const a = activateBarrier(state, "commander-barricade");
      const b = activateBarrier(state, "commander-pressure-door");
      pushEvent(state, a || b ? "SEIZURE ORDER // CERTIFIED COVER DEPLOYED" : "SEIZURE ORDER // RESERVE COVER EXHAUSTED", 2.2);
    } else if (boss.bossPattern === "auditPulse") {
      const liveCover = state.objects.filter((object) => object.active && (object.id.startsWith("commander-barricade") || object.id.startsWith("commander-pressure-door"))).length;
      if (liveCover > 0) {
        boss.armor = Math.min(boss.maxArmor, boss.armor + 38);
        plantHazard(state, p.x, p.y, "shockGrid", 4);
        pushEvent(state, "AUDIT PULSE // COVER NETWORK RESTORES ARBITER ARMOR", 2.2);
      } else {
        const delta = { x: p.x - boss.x, y: p.y - boss.y };
        if (len(delta) < 350) {
          const dir = norm(delta);
          p.vx += dir.x * 460;
          p.vy += dir.y * 460;
          applyPlayerDamage(state, 17, 0.08);
        }
      }
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1.15 : 1.55;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["certifiedVolley", "auditPulse", "seizureWall", "certifiedVolley"] : ["seizureWall", "certifiedVolley", "auditPulse"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "certifiedVolley" ? 0.88 : 1.08;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepForgeChorusBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  boss.vx = 0;
  boss.vy = 0;
  boss.anchored = true;
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.55) {
    boss.bossPhase = 2;
    const arena = state.sectors.find((item) => item.id === "C");
    if (arena) arena.gravity = 0.05;
    plantHazard(state, 1810, 315, "shockGrid", 6);
    plantHazard(state, 2120, 715, "shockGrid", 6);
    pushEvent(state, "PRISM-6 // PROCESS CHORUS SPLIT // SAFETY CONSENSUS LOST", 3.3);
  }
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "machineChoir") {
      for (const offset of [-180, -90, 0, 90, 180]) {
        const originY = clamp(boss.y + offset, 220, 830);
        const aim = norm({ x: p.x - (boss.x - 95), y: p.y - originY });
        addProjectile(state, boss.x - 95, originY, aim, 540, boss.bossPhase === 2 ? 18 : 15, "enemy", { weapon: "enemy", armorDamage: 0.62, radius: 6 });
      }
      plantHazard(state, p.x + p.vx * 0.25, p.y + p.vy * 0.25, "shockGrid", 4.2);
      pushEvent(state, "MACHINE CHOIR // FIVE PROCESS TOOLS FIRING AS ONE", 2.1);
    } else if (boss.bossPattern === "phaseFork") {
      const arena = state.sectors.find((item) => item.id === "C");
      if (arena) arena.gravity = arena.gravity < 0.3 ? 0.86 : 0.06;
      plantHazard(state, p.x - 150, p.y, "gravityWell", 4.2);
      plantHazard(state, p.x + 150, p.y, "gravityWell", 4.2);
      pushEvent(state, "PHASE FORK // DUAL MASS WELLS // GRAVITY REFERENCE SHIFT", 2.3);
    } else if (boss.bossPattern === "thermalCascade") {
      p.weaponHeat[p.currentWeapon] = Math.min(1, p.weaponHeat[p.currentWeapon] + (boss.bossPhase === 2 ? 0.34 : 0.24));
      plantHazard(state, p.x + p.vx * 0.35, p.y + p.vy * 0.35, "shockGrid", 3.8);
      pushEvent(state, "THERMAL CASCADE // ACTIVE WEAPON BUS SATURATING", 2.2);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 1 : 1.4;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["machineChoir", "phaseFork", "thermalCascade", "machineChoir"] : ["thermalCascade", "machineChoir", "phaseFork"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "machineChoir" ? 0.9 : 1.05;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepCascadeCustodianBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.52) {
    boss.bossPhase = 2;
    const arena = state.sectors.find((item) => item.id === "C");
    if (arena) arena.gravity = 0.05;
    activateBreach(state, "boss-breach");
    plantHazard(state, 1810, 320, "shockGrid", 7);
    plantHazard(state, 2110, 710, "shockGrid", 7);
    pushEvent(state, "ORO-7 // CUMULATIVE FAILURE STATE // PRESSURE + GRAVITY + GRID AUTHORITY", 3.5);
  }
  moveArenaBoss(state, boss, dt, 360, boss.bossPhase === 2 ? 590 : 455, boss.bossPhase === 2 ? 165 : 128, 0.35);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "pressureCascade") {
      activateBreach(state, "boss-breach");
      const arena = state.sectors.find((item) => item.id === "C");
      if (arena) {
        arena.rapidTimer = Math.max(arena.rapidTimer, 4);
        arena.targetPressure = 0;
      }
      pushEvent(state, "ORO-7 PRESSURE CASCADE // DEEP-ZONE VENT PATH OPEN", 2.3);
    } else if (boss.bossPattern === "gravityOverride") {
      const arena = state.sectors.find((item) => item.id === "C");
      if (arena) arena.gravity = arena.gravity < 0.3 ? 0.82 : 0.05;
      plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, "gravityWell", 4.6);
      pushEvent(state, `ORO-7 MASS BUS // ${arena && arena.gravity < 0.3 ? "LOW-G" : "HIGH-G"} OVERRIDE`, 2.2);
    } else if (boss.bossPattern === "machineChoir") {
      const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
      for (const angle of [-0.22, -0.11, 0, 0.11, 0.22]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 610, boss.bossPhase === 2 ? 22 : 18, "enemy", { weapon: "enemy", armorDamage: 0.78, radius: 7 });
      }
      plantHazard(state, p.x + p.vx * 0.3, p.y + p.vy * 0.3, "shockGrid", boss.bossPhase === 2 ? 5.2 : 4.2);
      pushEvent(state, "ORO-7 GRID CASCADE // ARC FIELD + BUS VOLLEY", 2.2);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.98 : 1.35;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["pressureCascade", "machineChoir", "gravityOverride", "machineChoir"] : ["pressureCascade", "gravityOverride", "machineChoir"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "machineChoir" ? 0.86 : 1.05;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepLatticeCustodianBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  const activeReferences = state.objects.filter((object) => object.id.startsWith("lattice-reference") && object.active && object.hp > 0);
  if (boss.bossPhase === 1 && (activeReferences.length === 0 || boss.hp <= boss.maxHp * 0.48)) {
    boss.bossPhase = 2;
    boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1.1);
    pushEvent(state, "VEYRA SENN // REFERENCE NETWORK LOST // ARCHIVE RECOVERY LIMITS RELEASED", 3.2);
  }
  moveArenaBoss(state, boss, dt, 365, boss.bossPhase === 2 ? 590 : 455, boss.bossPhase === 2 ? 158 : 120, 0.18);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    if (boss.bossPattern === "surveySweep") {
      for (const angle of [-0.16, -0.08, 0, 0.08, 0.16]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 760, boss.bossPhase === 2 ? 23 : 19, "enemy", { weapon: "enemy", armorDamage: 0.9, radius: 6 });
      }
      for (const node of activeReferences.slice(0, 2)) {
        const cx = node.x + node.w / 2;
        const cy = node.y + node.h / 2;
        const nodeAim = norm({ x: p.x - cx, y: p.y - cy });
        addProjectile(state, cx, cy, nodeAim, 690, boss.bossPhase === 2 ? 17 : 14, "enemy", { weapon: "enemy", armorDamage: 0.66, radius: 5 });
      }
      pushEvent(state, "KHEPRI SURVEY SWEEP // PRECISION FIRE FROM REFERENCE FRAME", 2.1);
    } else if (boss.bossPattern === "referenceLock") {
      plantHazard(state, p.x - 130, p.y + p.vy * 0.3, "gravityWell", 4.4);
      plantHazard(state, p.x + 130, p.y + p.vy * 0.3, "gravityWell", 4.4);
      pushEvent(state, activeReferences.length > 0 ? "REFERENCE LOCK // ACTIVE PYLONS CONSTRAINING MOVEMENT" : "REFERENCE LOCK // LOCAL MASS COILS ONLY", 2.3);
    } else if (boss.bossPattern === "archivePurge") {
      const first = activateBarrier(state, "lattice-shutter");
      const second = activateBarrier(state, "lattice-shutter");
      plantHazard(state, p.x + p.vx * 0.35, p.y + p.vy * 0.35, "shockGrid", boss.bossPhase === 2 ? 5 : 4);
      pushEvent(state, first || second ? "ARCHIVE PURGE // CALIBRATION SHUTTERS + ARC DENIAL ONLINE" : "ARCHIVE PURGE // SHUTTERS DESTROYED // ARC DENIAL ONLY", 2.3);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.95 : 1.35;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["surveySweep", "referenceLock", "archivePurge", "surveySweep"] : ["referenceLock", "surveySweep", "archivePurge"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "surveySweep" ? 1.05 : 1.18;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepTransferAdjudicatorBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && (boss.armor <= 0 || boss.hp <= boss.maxHp * 0.5)) {
    boss.bossPhase = 2;
    const arena = state.sectors.find((item) => item.id === "C");
    if (arena) arena.gravity = 0.03;
    for (const partition of state.objects.filter((object) => object.id.startsWith("transfer-partition") && object.hp > 0)) partition.active = false;
    pushEvent(state, "IONA VALE // COUNTERWEIGHT CLUTCH RELEASED // NEAR-ZERO-G VECTOR AUTHORITY", 3.3);
  }
  moveArenaBoss(state, boss, dt, 320, boss.bossPhase === 2 ? 680 : 520, boss.bossPhase === 2 ? 190 : 148, 0.55);
  if (boss.telegraph > 0 && boss.statuses.disrupted > 0 && (boss.bossPattern === "brakeWave" || boss.bossPattern === "partitionSweep")) {
    boss.telegraph = 0;
    boss.bossPattern = "none";
    boss.fireCooldown = 1.1;
    pushEvent(state, "SENSOR DISRUPTION // ADJUDICATOR MASS-CONTROL PATTERN CANCELLED", 1.7);
    return;
  }
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    if (boss.bossPattern === "brakeWave") {
      plantHazard(state, p.x + p.vx * 0.65, p.y + p.vy * 0.65, "vectorWash", boss.bossPhase === 2 ? 6 : 5);
      pushEvent(state, "BRAKE WAVE // COUNTERMASS FRONT COMMITTED // DODGE ACROSS THE VECTOR", 2.2);
    } else if (boss.bossPattern === "partitionSweep") {
      const a = activateBarrier(state, "transfer-partition");
      const b = activateBarrier(state, "transfer-partition");
      pushEvent(state, a || b ? "PARTITION SWEEP // PRESSURE LANES RECONFIGURED" : "PARTITION SWEEP // SHUTTER HARDWARE DESTROYED", 2.1);
    } else if (boss.bossPattern === "recoilVector") {
      for (const angle of [-0.1, 0, 0.1]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 720, boss.bossPhase === 2 ? 22 : 18, "enemy", { weapon: "enemy", armorDamage: 0.82, radius: 7 });
      }
      boss.vx -= aim.x * (boss.bossPhase === 2 ? 520 : 390);
      boss.vy -= aim.y * (boss.bossPhase === 2 ? 520 : 390);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.95 : 1.35;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["recoilVector", "brakeWave", "partitionSweep", "recoilVector"] : ["partitionSweep", "brakeWave", "recoilVector"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "recoilVector" ? 0.82 : 1.05;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepUmbraMarshalBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.52) {
    boss.bossPhase = 2;
    const arena = state.sectors.find((item) => item.id === "C");
    if (arena) {
      arena.gravity = 0.06;
      arena.pressure = Math.min(arena.pressure, 0.38);
      arena.targetPressure = Math.min(arena.targetPressure, 0.38);
    }
    pushEvent(state, "OREN SAAL // RESERVE JACKET VENTED // COLD LOW-PRESSURE CONTROL MODE", 3.3);
  }
  moveArenaBoss(state, boss, dt, 360, boss.bossPhase === 2 ? 560 : 430, boss.bossPhase === 2 ? 160 : 124, 0.3);
  if (boss.telegraph > 0 && boss.statuses.disrupted > 0 && (boss.bossPattern === "busSiphon" || boss.bossPattern === "busReroute")) {
    boss.telegraph = 0;
    boss.bossPattern = "none";
    boss.fireCooldown = 1.1;
    pushEvent(state, "SENSOR DISRUPTION // UMBRA BUS PATTERN CANCELLED", 1.7);
    return;
  }
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    if (boss.bossPattern === "purgeLance") {
      const arena = currentSector(state, p.x, p.y);
      arena.pressure = Math.max(0.18, arena.pressure - 0.09);
      arena.rapidTimer = Math.max(arena.rapidTimer, 1.8);
      plantHazard(state, p.x + p.vx * 0.5, p.y + p.vy * 0.5, "boiloffJet", boss.bossPhase === 2 ? 6 : 5);
      pushEvent(state, "PURGE LANCE // CONTROLLED DECOMPRESSION + BOILOFF PLUME", 2.2);
    } else if (boss.bossPattern === "busSiphon") {
      let raised = 0;
      for (const node of state.objects.filter((object) => object.id.startsWith("boss-siphon") && !object.active && object.hp > 0).slice(0, 2)) {
        node.active = true;
        node.exposed = true;
        raised += 1;
      }
      pushEvent(state, raised > 0 ? "BUS SIPHON // CAPACITOR RELAYS ONLINE // ARC OR BREAK THEM" : "BUS SIPHON // RELAY HARDWARE EXHAUSTED", 2.2);
    } else if (boss.bossPattern === "busReroute") {
      plantHazard(state, p.x - 130, p.y, "shockGrid", 4.6);
      plantHazard(state, p.x + 130, p.y, "shockGrid", 4.6);
      pushEvent(state, "GRID REROUTE // PAIRED ARC FIELDS // BREAK THE LINE", 2.1);
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.95 : 1.35;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["purgeLance", "busReroute", "busSiphon", "purgeLance"] : ["busSiphon", "purgeLance", "busReroute"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "purgeLance" ? 0.9 : 1.08;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepCustodyDirectorBoss(state, boss, dt) {
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  const references = state.objects.filter((object) => object.id.startsWith("custody-reference"));
  const activeReferences = references.filter((object) => object.active && object.hp > 0);
  if (boss.bossPhase === 1 && (activeReferences.length === 0 || boss.hp <= boss.maxHp * 0.45)) {
    boss.bossPhase = 2;
    const arena = state.sectors.find((item) => item.id === "C");
    if (arena) arena.gravity = 0.07;
    boss.statuses.disrupted = Math.max(boss.statuses.disrupted, 1);
    pushEvent(state, "MARA TETH // CUSTODY RELAY SEVERED // DIRECT CONTROL ONLY", 3.2);
  }
  moveArenaBoss(state, boss, dt, 385, boss.bossPhase === 2 ? 610 : 445, boss.bossPhase === 2 ? 170 : 126, 0.22);
  if (boss.telegraph > 0 && boss.statuses.disrupted > 0 && (boss.bossPattern === "relayRecall" || boss.bossPattern === "shutterGeometry")) {
    boss.telegraph = 0;
    boss.bossPattern = "none";
    boss.fireCooldown = 1.1;
    pushEvent(state, "SENSOR DISRUPTION // CUSTODY CONTROL PATTERN CANCELLED", 1.7);
    return;
  }
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph > 0) return;
    const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
    if (boss.bossPattern === "shutterGeometry") {
      const a = activateBarrier(state, "custody-shutter");
      const b = activateBarrier(state, "custody-shutter");
      pushEvent(state, a || b ? "SHUTTER GEOMETRY // FIRING LANES REINDEXED" : "SHUTTER GEOMETRY // HARDWARE DESTROYED", 2.1);
    } else if (boss.bossPattern === "referenceVolley") {
      for (const angle of [-0.1, 0, 0.1]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        addProjectile(state, boss.x, boss.y, { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c }, 760, boss.bossPhase === 2 ? 23 : 19, "enemy", { weapon: "enemy", armorDamage: 0.88, radius: 6 });
      }
      for (const node of activeReferences.slice(0, 2)) {
        const cx = node.x + node.w / 2;
        const cy = node.y + node.h / 2;
        addProjectile(state, cx, cy, norm({ x: p.x - cx, y: p.y - cy }), 690, 15, "enemy", { weapon: "enemy", armorDamage: 0.62, radius: 5 });
      }
      pushEvent(state, "REFERENCE VOLLEY // MULTI-ORIGIN FIRING SOLUTION", 2.1);
    } else if (boss.bossPattern === "relayRecall") {
      if (boss.bossPhase === 1) {
        const broken = references.find((object) => !object.active || object.hp <= 0);
        if (broken) {
          broken.hp = Math.max(42, broken.maxHp * 0.58);
          broken.active = true;
          broken.exposed = true;
          pushEvent(state, "RELAY RECALL // CUSTODY REFERENCE REBUILT // BREAK THE NETWORK", 2.2);
        } else pushEvent(state, "RELAY RECALL // NO BROKEN REFERENCE AVAILABLE", 1.8);
      }
    }
    boss.fireCooldown = boss.bossPhase === 2 ? 0.92 : 1.32;
    boss.bossPattern = "none";
    return;
  }
  if (boss.fireCooldown > 0) return;
  const patterns = boss.bossPhase === 2 ? ["referenceVolley", "shutterGeometry", "referenceVolley"] : ["shutterGeometry", "referenceVolley", "relayRecall"];
  boss.bossPattern = patterns[boss.patternIndex % patterns.length];
  boss.patternIndex += 1;
  boss.telegraph = boss.bossPattern === "referenceVolley" ? 0.95 : 1.1;
  boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
}
function stepBoss(state, boss, dt) {
  if (boss.variant === "transferAdjudicator") {
    stepTransferAdjudicatorBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "umbraMarshal") {
    stepUmbraMarshalBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "custodyDirector") {
    stepCustodyDirectorBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "latticeCustodian") {
    stepLatticeCustodianBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "cascadeCustodian") {
    stepCascadeCustodianBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "pressureBroker") {
    stepPressureBrokerBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "bondArbiter") {
    stepBondArbiterBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "forgeChorus") {
    stepForgeChorusBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "meridianCommander") {
    stepMeridianBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "salvageCaptain") {
    stepSalvageBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "yardmind") {
    stepYardmindBoss(state, boss, dt);
    return;
  }
  if (boss.variant === "foundryMarshal") {
    stepFoundryBoss(state, boss, dt);
    return;
  }
  const p = state.player;
  if (!state.bossActive || p.dead) return;
  boss.fireCooldown = Math.max(0, boss.fireCooldown - dt);
  boss.hazardCooldown = Math.max(0, boss.hazardCooldown - dt);
  const sector = currentSector(state, boss.x, boss.y);
  const anchored = boss.anchored && boss.statuses.disrupted <= 0;
  applyPressureForce(state, boss, sector.id, dt, anchored ? 0.08 : 0.72);
  const breach = nearestActiveBreach(state, sector.id);
  if (breach && Math.hypot(boss.x - breach.x, boss.y - breach.y) < 125 && !anchored) {
    boss.statuses.stagger = Math.max(boss.statuses.stagger, 0.3);
    dealEnemyDamage(state, boss, 20 * dt, 2.2, 1.35);
  }
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * 0.55) beginBossPhaseTwo(state, boss);
  if (boss.statuses.stagger <= 0) {
    const delta = { x: p.x - boss.x, y: p.y - boss.y };
    const distance = len(delta);
    const toward = norm(delta);
    const sideways = { x: -toward.y * boss.strafeSign, y: toward.x * boss.strafeSign };
    const desired = distance > 430 ? norm({ x: toward.x * 0.65 + sideways.x * 0.4, y: toward.y * 0.65 + sideways.y * 0.4 }) : distance < 280 ? norm({ x: -toward.x * 0.65 + sideways.x * 0.5, y: -toward.y * 0.65 + sideways.y * 0.5 }) : sideways;
    boss.vx += desired.x * 420 * dt;
    boss.vy += desired.y * 420 * dt;
    const speed = Math.hypot(boss.vx, boss.vy);
    const max = boss.bossPhase === 2 ? 130 : 105;
    if (speed > max) {
      boss.vx *= max / speed;
      boss.vy *= max / speed;
    }
  }
  boss.vx *= Math.pow(lerp(0.54, 0.018, sector.gravity), dt);
  boss.vy *= Math.pow(lerp(0.54, 0.018, sector.gravity), dt);
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  boss.x = clamp(boss.x, 1580, world.w - 115);
  boss.y = clamp(boss.y, 210, world.h - 145);
  for (const object of state.objects) if (isSolidObject(object)) resolveCircleRect(boss, 30, object);
  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph <= 0) {
      if (boss.bossPattern === "coilFan") {
        const aim = norm({ x: p.x - boss.x, y: p.y - boss.y });
        boss.telegraphAim = aim;
        for (const angle of [-0.12, 0, 0.12]) {
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const dir = { x: aim.x * c - aim.y * s, y: aim.x * s + aim.y * c };
          addProjectile(state, boss.x, boss.y, dir, 700, boss.bossPhase === 2 ? 26 : 22, "enemy", { weapon: "enemy", armorDamage: 0.8, healthMultiplier: 1, radius: 7 });
        }
      } else if (boss.bossPattern === "massPulse") {
        const delta = { x: p.x - boss.x, y: p.y - boss.y };
        const distance = len(delta);
        if (distance < 330) {
          const dir = norm(delta);
          p.vx += dir.x * 520;
          p.vy += dir.y * 520;
          applyPlayerDamage(state, 18, 0.1);
        }
        spawnEffect(state, boss.x, boss.y, "pulse", 330, 0.7);
      } else if (boss.bossPattern === "craneLock") plantHazard(state, p.x + p.vx * 0.45, p.y + p.vy * 0.45, "gravityWell", 4.6);
      boss.fireCooldown = boss.bossPhase === 2 ? 1.35 : 1.8;
      boss.bossPattern = "none";
      boss.anchored = boss.bossPhase === 1 || boss.patternIndex % 2 === 0;
    }
  } else if (boss.fireCooldown <= 0) {
    const patterns = ["coilFan", "massPulse", "craneLock"];
    boss.bossPattern = patterns[boss.patternIndex % patterns.length];
    boss.patternIndex += 1;
    boss.telegraph = boss.bossPattern === "coilFan" ? 0.95 : boss.bossPattern === "massPulse" ? 0.82 : 1.05;
    boss.anchored = boss.bossPattern !== "craneLock";
    boss.telegraphAim = norm({ x: p.x - boss.x, y: p.y - boss.y });
  }
}
function stepHazards(state, dt) {
  const p = state.player;
  for (const hazard of state.hazards) {
    if (!hazard.active) continue;
    hazard.life -= dt;
    if (hazard.life <= 0) {
      hazard.active = false;
      continue;
    }
    if (hazard.kind === "vacuumWake") {
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.dead) continue;
        const d = Math.hypot(enemy.x - hazard.x, enemy.y - hazard.y);
        if (d <= 0 || d >= hazard.radius) continue;
        const dir = norm({ x: hazard.x - enemy.x, y: hazard.y - enemy.y });
        const pull = 300 * (1 - d / hazard.radius);
        enemy.vx += dir.x * pull * dt;
        enemy.vy += dir.y * pull * dt;
        enemy.statuses.vacuum = Math.max(enemy.statuses.vacuum, 0.8);
        dealEnemyDamage(state, enemy, 5 * dt, 0.18, 0.75);
      }
      continue;
    }
    const playerDistance = Math.hypot(p.x - hazard.x, p.y - hazard.y);
    if (!p.dead && hazard.owner !== "player" && playerDistance < hazard.radius) {
      if (hazard.kind === "shockGrid") {
        p.disrupted = Math.max(p.disrupted, 0.45);
        if (Math.floor(state.time * 4) !== Math.floor((state.time - dt) * 4)) {
          if (hasTrait(state, "stormskin")) {
            applyPlayerDamage(state, 2.2, 0.12);
            p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 3);
          } else applyPlayerDamage(state, 4.2 * (hazard.owner === "enemy" ? state.monsterDamageScale : 1), 0.45);
        }
      } else if (hazard.kind === "gravityWell") {
        const dir = norm({ x: hazard.x - p.x, y: hazard.y - p.y });
        const pull = 410 * (1 - playerDistance / hazard.radius);
        p.vx += dir.x * pull * dt;
        p.vy += dir.y * pull * dt;
      } else {
        const dir = norm({ x: p.x - hazard.x, y: p.y - hazard.y });
        const push = hazard.kind === "vectorWash" ? 680 : hazard.kind === "boiloffJet" ? 440 : 480;
        p.vx += dir.x * push * dt;
        p.vy += dir.y * push * dt;
        const thermalTick = Math.floor(state.time * 4) !== Math.floor((state.time - dt) * 4);
        if (hazard.kind === "boiloffJet" && thermalTick) {
          if (hasTrait(state, "boiloffSink")) {
            p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 4);
            for (const id of ["carbine", "breacher", "rail"]) p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - 0.045);
          } else {
            p.capacitor = Math.max(0, p.capacitor - 3);
            p.weaponHeat[p.currentWeapon] = Math.max(0, p.weaponHeat[p.currentWeapon] - 0.05);
          }
        }
        if (hazard.kind === "coolantJet" && thermalTick && hasTrait(state, "boiloffSink")) {
          p.capacitor = Math.min(p.maxCapacitor, p.capacitor + 2);
          for (const id of ["carbine", "breacher", "rail"]) p.weaponHeat[id] = Math.max(0, p.weaponHeat[id] - 0.03);
        }
      }
    }
    if (hazard.kind === "coolantJet" || hazard.kind === "vectorWash" || hazard.kind === "boiloffJet") for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const d = Math.hypot(enemy.x - hazard.x, enemy.y - hazard.y);
      if (d < hazard.radius) {
        const dir = norm({ x: enemy.x - hazard.x, y: enemy.y - hazard.y });
        const push = hazard.kind === "vectorWash" ? 650 : hazard.kind === "boiloffJet" ? 470 : 520;
        enemy.vx += dir.x * push * dt;
        enemy.vy += dir.y * push * dt;
        enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, hazard.kind === "vectorWash" ? 0.22 : 0.15));
      }
    }
  }
}
function stepDebris(state, dt) {
  for (const debris of state.debris) {
    if (!debris.active) continue;
    const sector = state.sectors.find((item) => item.id === debris.sectorId);
    if (!sector) continue;
    applyPressureForce(state, debris, sector.id, dt, 1.35);
    debris.vx *= Math.pow(0.74, dt);
    debris.vy *= Math.pow(0.74, dt);
    debris.x += debris.vx * dt;
    debris.y += debris.vy * dt;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const speed = Math.hypot(debris.vx, debris.vy);
      if (speed < 125 || Math.hypot(debris.x - enemy.x, debris.y - enemy.y) >= enemyRadius + debris.radius) continue;
      dealEnemyDamage(state, enemy, speed * 0.045, 0.75, 1.15, 0.1, { x: debris.vx, y: debris.vy });
      debris.vx *= -0.2;
      debris.vy *= -0.2;
    }
  }
}
function projectileObjectCollision(state, projectile) {
  let collided = null;
  for (const object of state.objects) {
    if (!isSolidObject(object)) continue;
    if (object.id === projectile.lastObjectId && projectile.lastObjectT > 0) continue;
    if (pointInRect(projectile.x, projectile.y, object)) {
      collided = object;
      break;
    }
  }
  if (!collided) {
    if (projectile.lastObjectT <= 0) projectile.lastObjectId = null;
    return false;
  }
  projectile.lastObjectId = collided.id;
  projectile.lastObjectT = 0.16;
  if (projectile.owner === "player") damageObject(state, collided, projectile);
  if (projectile.owner === "player" && projectile.weapon === "rail" && hasTrait(state, "shutterLine") && collided.destructible && collided.material !== "bulkhead") {
    projectile.penetration += 20;
    projectile.vx *= 1.08;
    projectile.vy *= 1.08;
    spawnEffect(state, projectile.x, projectile.y, "impact", 30, 0.24);
    return false;
  }
  const resistance = materialResistance(collided.material);
  if (projectile.penetration > resistance && collided.material !== "bulkhead") {
    projectile.penetration -= resistance;
    projectile.damage *= 0.62;
    projectile.vx *= 0.94;
    projectile.vy *= 0.94;
    spawnEffect(state, projectile.x, projectile.y, "impact", 26, 0.25);
    return false;
  }
  projectile.active = false;
  spawnEffect(state, projectile.x, projectile.y, "impact", 22, 0.2);
  return true;
}
function stepProjectiles(state, dt) {
  for (const projectile of state.projectiles) {
    if (!projectile.active) continue;
    projectile.life -= dt;
    projectile.lastObjectT = Math.max(0, projectile.lastObjectT - dt);
    if (projectile.life <= 0) {
      projectile.active = false;
      continue;
    }
    const sector = currentSector(state, projectile.x, projectile.y);
    applyPressureForce(state, projectile, sector.id, dt, 0.08);
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.x < 70 || projectile.x > world.w - 70 || projectile.y < 140 || projectile.y > world.h - 70) {
      projectile.active = false;
      continue;
    }
    if (projectileObjectCollision(state, projectile)) continue;
    if (projectile.owner === "player") {
      for (const enemy of state.enemies) {
        if (enemy.dead || !enemy.active) continue;
        if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <= (enemy.role === "boss" ? 31 : enemyRadius) + projectile.radius) {
          const wasTelegraphing = enemy.telegraph > 0;
          const wasMarked = enemy.statuses.marked > 0;
          const beforeArmor = enemy.armor;
          const closeBreacher = projectile.weapon === "breacher" && Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= 300;
          let armorDamage = projectile.armorDamage;
          let healthMultiplier = projectile.healthMultiplier;
          if (closeBreacher) {
            const closeScale = Math.max(state.build.specialization === "breach-vanguard" ? 1.25 : 1, hasTrait(state, "closeBreach") ? 1.3 : 1);
            armorDamage *= closeScale;
            if (hasTrait(state, "closeBreach")) healthMultiplier *= 0.88;
          }
          dealEnemyDamage(state, enemy, projectile.damage, armorDamage, healthMultiplier, projectile.knockback, { x: projectile.vx, y: projectile.vy });
          const armorBroken = beforeArmor > 0 && enemy.armor <= 0;
          if (!enemy.dead && closeBreacher && armorBroken) {
            enemy.statuses.stagger = Math.max(enemy.statuses.stagger, staggerDuration(enemy, 0.5));
            if (state.build.specialization === "breach-vanguard" && state.build.specializationOverclock) state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 5);
          }
          if (!enemy.dead && projectile.weapon === "breacher" && hasTrait(state, "redlineBulwark") && state.player.weaponHeat.breacher >= 0.75) state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 0.6);
          const precisionRail = !enemy.dead && projectile.weapon === "rail" && wasMarked && (state.build.specialization === "survey-deadeye" || state.build.mechanics.markExecutionTrace || hasTrait(state, "coldWitness"));
          if (precisionRail) {
            enemy.statuses.marked = 0;
            enemy.statuses.armorBreach = Math.max(enemy.statuses.armorBreach, hasTrait(state, "coldWitness") ? 5 : 4);
            if ((state.build.specialization === "survey-deadeye" || state.build.mechanics.markExecutionTrace) && wasTelegraphing) {
              enemy.telegraph = 0;
              enemy.bossPattern = "none";
            }
            if (state.build.specialization === "survey-deadeye" && state.build.specializationOverclock) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 2.2);
            if (state.build.mechanics.markExecutionTrace) state.player.abilityCooldowns[1] = Math.min(state.player.abilityCooldowns[1], 2.4);
            if (hasTrait(state, "coldWitness")) state.player.weaponHeat.rail = Math.max(0, state.player.weaponHeat.rail - 0.1);
            pushEvent(state, `PRECISION TRACE // ${enemy.label.toUpperCase()} MARK CONSUMED`, 1.2);
          }
          if (projectile.weapon === "carbine" && hasTrait(state, "arcspindle") && (enemy.statuses.disrupted > 0 || enemy.statuses.conductive > 0)) state.player.capacitor = Math.min(state.player.maxCapacitor, state.player.capacitor + 3);
          if (projectile.weapon === "rail" && hasTrait(state, "nullpoint") && wasTelegraphing && !enemy.dead) {
            enemy.telegraph = 0;
            enemy.bossPattern = "none";
            state.player.capacitor = Math.min(state.player.maxCapacitor, state.player.capacitor + 8);
            pushEvent(state, `NULLPOINT INTERRUPT // ${enemy.label.toUpperCase()} FIRING SOLUTION BROKEN`, 1.3);
          }
          spawnEffect(state, enemy.x, enemy.y, "impact", 30, 0.24);
          if (state.build.mechanics.railFragment && projectile.weapon === "rail" && projectile.penetration > 38) {
            const forward = norm({ x: projectile.vx, y: projectile.vy });
            for (const angle of [-0.3, 0.3]) {
              const c = Math.cos(angle);
              const s = Math.sin(angle);
              const dir = { x: forward.x * c - forward.y * s, y: forward.x * s + forward.y * c };
              addProjectile(state, enemy.x + dir.x * 28, enemy.y + dir.y * 28, dir, 720, projectile.damage * 0.35 * (state.build.mechanics.railFragmentScale || 1), "player", { weapon: "carbine", penetration: 8 * (state.build.mechanics.railFragmentScale || 1), armorDamage: 0.45, healthMultiplier: 0.9, knockback: 0.025, radius: 3 });
            }
          }
          if (projectile.penetration > 38 && enemy.role !== "boss") {
            projectile.penetration -= 38;
            projectile.damage *= 0.58;
            const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
            projectile.x += projectile.vx / speed * 54;
            projectile.y += projectile.vy / speed * 54;
          } else projectile.active = false;
          break;
        }
      }
    } else if (!state.player.dead && Math.hypot(projectile.x - state.player.x, projectile.y - state.player.y) <= playerRadius + projectile.radius) {
      applyPlayerDamage(state, projectile.damage * state.monsterDamageScale, 0);
      projectile.active = false;
    }
  }
}
function stepGroundLoot(state, dt) {
  const p = state.player;
  for (const drop of state.groundLoot) {
    if (!drop.active || drop.collected) continue;
    drop.age += dt;
    if (drop.age < 0.28) continue;
    const dx = p.x - drop.x;
    const dy = p.y - drop.y;
    const distance = Math.hypot(dx, dy);
    const magnetRadius = drop.source === "boss" ? 620 : drop.rarity === "Prototype" ? 210 : 165;
    if (distance > 1 && distance < magnetRadius) {
      const pull = Math.min(distance, (drop.source === "boss" ? 620 : 360) * dt);
      drop.x += dx / distance * pull;
      drop.y += dy / distance * pull;
    }
    if (distance <= 58) {
      drop.collected = true;
      drop.active = false;
      state.collectedLoot.push({ id: drop.id, enemyId: drop.enemyId, enemyLabel: drop.enemyLabel, rarity: drop.rarity, source: drop.source, recoveryQualityFloor: drop.recoveryQualityFloor, recoveryLevel: drop.recoveryLevel, monsterLevel: drop.monsterLevel });
      pushEvent(state, `${lootLabel(drop.rarity)} // ${drop.enemyLabel.toUpperCase()} // EXTRACT TO KEEP`, drop.rarity === "Singular" ? 2.4 : 1.6);
    }
  }
  if (state.bossDefeated && !state.complete && !state.groundLoot.some((drop) => drop.source === "boss" && drop.active && !drop.collected)) {
    state.complete = true;
    pushEvent(state, "COMMAND RECOVERY SECURED // DEEP EXTRACTION READY", 3.2);
  }
}
function stepEffects(state, dt) {
  for (const effect of state.effects) if (effect.active) {
    effect.life -= dt;
    if (effect.life <= 0) effect.active = false;
  }
}
function updateSquad(state) {
  state.squadSuppressing = state.enemies.some((enemy) => enemy.role === "suppressor" && enemy.active && !enemy.dead && enemy.telegraph > 0 && clearLine(state, enemy.x, enemy.y, state.player.x, state.player.y));
}
function stepBuildMechanics(state) {
  if (!state.build.mechanics.arcDrone || state.time < state.droneTick) return;
  const target = state.enemies.filter((enemy) => enemy.active && !enemy.dead && (enemy.statuses.disrupted > 0 || enemy.statuses.conductive > 0)).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
  state.droneTick = state.time + 1.55;
  if (!target || Math.hypot(target.x - state.player.x, target.y - state.player.y) > 760) return;
  dealEnemyDamage(state, target, 8 * (state.build.mechanics.arcDroneScale || 1), 0.55, 1);
  spawnEffect(state, target.x, target.y, "arc", 48, 0.35);
}
function unlockBoss(state) {
  if (state.bossGateHold || state.bossActive || activeSquadCount(state) > 0) return;
  const boss = findBoss(state);
  if (!boss) return;
  boss.active = true;
  state.bossActive = true;
  state.telemetry.bossStart = state.time;
  const link = state.links.find((item) => item.id === "door-bc");
  if (link) link.open = true;
  const gate = state.objects.find((item) => item.id === "boss-gate");
  if (gate) gate.active = false;
  pushEvent(state, `${boss.label.toUpperCase()} ONLINE // DEEP ZONE OPEN`, 4);
}
function stepSimulation(state, dt) {
  state.time += dt;
  state.pulse = Math.max(0, state.pulse - dt);
  state.weaponFlash = Math.max(0, state.weaponFlash - dt);
  state.eventT = Math.max(0, state.eventT - dt);
  stepPressure(state, dt);
  updateSquad(state);
  stepPlayer(state, dt);
  for (const enemy of state.enemies) stepEnemy(state, enemy, dt);
  stepHazards(state, dt);
  stepDebris(state, dt);
  stepProjectiles(state, dt);
  stepGroundLoot(state, dt);
  stepBuildMechanics(state);
  stepEffects(state, dt);
  unlockBoss(state);
  if (!state.complete) state.telemetry.duration = state.time;
  if (state.time >= state.telemetry.nextTraceAt && state.telemetry.trace.length < 720) {
    const p = state.player;
    state.telemetry.trace.push({ t: Math.round(state.time * 10) / 10, x: Math.round(p.x), y: Math.round(p.y), hp: Math.round(p.hp), armor: Math.round(p.armor), weapon: p.currentWeapon });
    state.telemetry.nextTraceAt = state.time + 1;
  }
}
function createDirector() {
  return { elapsed: 0, deepElapsed: 0, deep: false, reinforcementsReleased: false, gridTriggered: false, defenseTriggered: false, pressureWarned: false, pressureTriggered: false, gravityTriggered: false, locationEventA: false, locationEventB: false, thermalPulseUntil: 0, clearSweepElapsed: 0, clearSweepWarned: false, environmental: createEnvironmentalEventRuntime() };
}
function setRole(state, id, role, label) {
  const enemy = state.enemies.find((item) => item.id === id);
  if (!enemy) return;
  enemy.role = role;
  enemy.label = label;
  enemy.anchored = role === "elite" || role === "boss";
}
function setTacticalEnemy(state, id, role, variant, label, hp, armor) {
  const enemy = state.enemies.find((item) => item.id === id);
  if (!enemy) return;
  enemy.role = role;
  enemy.variant = variant;
  enemy.label = label;
  enemy.anchored = role === "elite";
  if (typeof hp === "number") {
    enemy.hp = hp;
    enemy.maxHp = hp;
  }
  if (typeof armor === "number") {
    enemy.armor = armor;
    enemy.maxArmor = armor;
  }
}
function configureTacticalRoster(state, contract) {
  if (contract.deepTarget === "Transfer Adjudicator Iona Vale") {
    setTacticalEnemy(state, 1, "technician", "partitionRigger", "Brake-Line Partition Rigger", 82, 40);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Custody Longline Marksman", 76, 34);
    setTacticalEnemy(state, 3, "assault", "recoilBroker", "Counterforce Broker", 90, 44);
    setTacticalEnemy(state, 4, "assault", "recoilBroker", "Transfer Recoil Broker", 94, 48);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Flywheel Custody Repair Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "impulseRigger", "Brake-Line Senior Rigger", 168, 112);
    setTacticalEnemy(state, 7, "technician", "partitionRigger", "Reserve Partition Rigger", 82, 38);
    setTacticalEnemy(state, 8, "suppressor", "marksman", "Outbound Custody Marksman", 74, 32);
    return;
  }
  if (contract.deepTarget === "Umbra Systems Marshal Oren Saal") {
    setTacticalEnemy(state, 1, "technician", "purgeOrchestrator", "Umbra Purge Orchestrator", 84, 42);
    setTacticalEnemy(state, 2, "assault", "shieldBoarder", "Cold-Line Shield Boarder", 94, 102);
    setTacticalEnemy(state, 3, "technician", "siphonTech", "Capacitor Siphon Tech", 82, 40);
    setTacticalEnemy(state, 4, "suppressor", "marksman", "Umbra Gallery Marksman", 74, 32);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Purge Network Repair Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "boiloffTech", "Senior Boiloff Controller", 166, 108);
    setTacticalEnemy(state, 7, "technician", "siphonTech", "Reserve Siphon Tech", 80, 38);
    setTacticalEnemy(state, 8, "technician", "purgeOrchestrator", "Reserve Purge Orchestrator", 82, 40);
    return;
  }
  if (contract.deepTarget === "Custody Director Mara Teth") {
    setTacticalEnemy(state, 1, "assault", "custodyPorter", "Custody Hardware Porter", 86, 42);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Archive Geometry Marksman", 76, 34);
    setTacticalEnemy(state, 3, "technician", "geometryTech", "Custody Geometry Tech", 82, 40);
    setTacticalEnemy(state, 4, "assault", "custodyPorter", "Relay Hardware Porter", 88, 44);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Custody Relay Repair Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Custody Recovery Exosuit", 174, 122);
    setTacticalEnemy(state, 7, "technician", "geometryTech", "Reserve Geometry Tech", 80, 38);
    setTacticalEnemy(state, 8, "assault", "custodyPorter", "Reserve Custody Porter", 84, 40);
    return;
  }
  if (contract.location === "orbital-station") {
    setTacticalEnemy(state, 1, "assault", "shieldBoarder", "Meridian Shield Boarder", 92, 105);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Longline Marksman", 72, 32);
    setTacticalEnemy(state, 3, "technician", "droneCarrier", "Utility Drone Carrier", 82, 42);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Bulkhead Breacher", 96, 54);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Maintenance Repair Drone", 62, 26);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Boarding Exosuit", 165, 118);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Recovery Thief", 74, 28);
    setTacticalEnemy(state, 8, "technician", "gravitySpecialist", "Mass-Control Specialist", 78, 38);
  } else if (contract.location === "damaged-vessel") {
    setTacticalEnemy(state, 1, "assault", "vacuumSaboteur", "Vacuum Raider", 88, 44);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Hull-Lane Marksman", 72, 30);
    setTacticalEnemy(state, 3, "technician", "tetherOperator", "Mag-Tether Operator", 78, 38);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Compartment Breacher", 94, 50);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Hull Repair Drone", 62, 24);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Vacuum Boarding Exosuit", 160, 105);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Manifest Thief", 72, 26);
    setTacticalEnemy(state, 8, "assault", "vacuumSaboteur", "Reserve Vacuum Raider", 82, 38);
  } else if (contract.location === "asteroid-refinery") {
    setTacticalEnemy(state, 1, "assault", "coverBreacher", "Crusher Breacher", 96, 56);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Gantry Marksman", 74, 34);
    setTacticalEnemy(state, 3, "technician", "repairDrone", "Foundry Repair Drone", 64, 28);
    setTacticalEnemy(state, 5, "technician", "droneCarrier", "Oreline Drone Carrier", 84, 44);
    setTacticalEnemy(state, 7, "technician", "gravitySpecialist", "Transfer Mass Specialist", 80, 40);
    setTacticalEnemy(state, 8, "elite", "meleeExosuit", "Crusher Exosuit", 166, 112);
  } else if (contract.location === "spin-habitat") {
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Spoke Marksman", 74, 36);
    setTacticalEnemy(state, 5, "technician", "gravitySpecialist", "Spin-Trim Specialist", 80, 42);
    setTacticalEnemy(state, 7, "technician", "droneCarrier", "Ring Drone Carrier", 82, 44);
    setTacticalEnemy(state, 8, "assault", "shieldBoarder", "Axis Shield Boarder", 92, 100);
  } else if (contract.location === "jovian-harvester") {
    setTacticalEnemy(state, 1, "assault", "vacuumSaboteur", "Storm Vacuum Raider", 90, 46);
    setTacticalEnemy(state, 2, "technician", "tetherOperator", "Skimmer Tether Operator", 80, 40);
    setTacticalEnemy(state, 3, "suppressor", "marksman", "Crown Marksman", 74, 32);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Pressure-Shell Breacher", 98, 54);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Skimmer Repair Drone", 64, 26);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Storm Boarding Exosuit", 168, 110);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Skimmer Salvage Thief", 74, 28);
    setTacticalEnemy(state, 8, "technician", "droneCarrier", "Compressor Drone Carrier", 82, 40);
  } else if (contract.location === "ice-mine") {
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Bore Marksman", 72, 30);
    setTacticalEnemy(state, 5, "assault", "coverBreacher", "Tunnel Breacher", 94, 48);
    setTacticalEnemy(state, 7, "assault", "salvageThief", "Cryobore Salvage Thief", 72, 26);
    setTacticalEnemy(state, 8, "elite", "meleeExosuit", "Mining Exosuit", 162, 104);
  } else if (contract.location === "solar-yard") {
    setTacticalEnemy(state, 5, "technician", "droneCarrier", "Fabrication Drone Carrier", 82, 42);
    setTacticalEnemy(state, 7, "suppressor", "marksman", "Sunline Marksman", 72, 30);
    setTacticalEnemy(state, 8, "technician", "gravitySpecialist", "Mirror Mass Specialist", 78, 38);
  } else if (contract.location === "lattice-annex") {
    setTacticalEnemy(state, 1, "assault", "shieldBoarder", "Survey Shield Custodian", 96, 112);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Metrology Marksman", 78, 36);
    setTacticalEnemy(state, 3, "technician", "gravitySpecialist", "Reference Mass Technician", 82, 42);
    setTacticalEnemy(state, 4, "assault", "coverBreacher", "Archive Breacher", 98, 56);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Khepri Maintenance Drone", 66, 30);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Survey Recovery Exosuit", 178, 128);
    setTacticalEnemy(state, 7, "technician", "droneCarrier", "Reference Drone Carrier", 88, 46);
    setTacticalEnemy(state, 8, "suppressor", "marksman", "Vault Marksman", 80, 38);
  } else if (contract.location === "momentum-exchange") {
    setTacticalEnemy(state, 1, "assault", "impulseRigger", "Exchange Impulse Rigger", 94, 48);
    setTacticalEnemy(state, 2, "suppressor", "marksman", "Transfer-Lane Marksman", 76, 34);
    setTacticalEnemy(state, 3, "technician", "gravitySpecialist", "Countermass Technician", 84, 44);
    setTacticalEnemy(state, 4, "assault", "impulseRigger", "Capture-Lane Rigger", 98, 52);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Flywheel Service Drone", 66, 28);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Transfer Security Exosuit", 174, 122);
  } else if (contract.location === "cryo-reserve") {
    setTacticalEnemy(state, 1, "technician", "boiloffTech", "Boiloff Routing Tech", 84, 42);
    setTacticalEnemy(state, 2, "assault", "shieldBoarder", "Tank-Farm Shield Boarder", 94, 104);
    setTacticalEnemy(state, 3, "technician", "boiloffTech", "Cryopump Purge Tech", 86, 44);
    setTacticalEnemy(state, 4, "suppressor", "marksman", "Cold-Gallery Marksman", 74, 32);
    setTacticalEnemy(state, 5, "technician", "repairDrone", "Reserve Service Drone", 64, 26);
    setTacticalEnemy(state, 6, "elite", "meleeExosuit", "Cryogenic Security Exosuit", 170, 118);
  }
}
function applyMissionSetup(state, contract) {
  var _a;
  state.bossGateHold = true;
  state.eventText = `${contract.locationName.toUpperCase()} // ${contract.objective.toUpperCase()}`;
  state.eventT = 4;
  const boss = state.enemies.find((enemy) => enemy.role === "boss");
  if (boss) boss.label = contract.deepTarget;
  if (contract.location === "damaged-vessel") {
    state.sectors[0].label = "FORE HAB";
    state.sectors[1].label = "CARGO SPINE";
    state.sectors[2].label = "ENGINE VAULT";
    state.sectors[0].gravity = 0.28;
    state.sectors[1].gravity = 0.08;
    state.sectors[2].gravity = 0.14;
    state.sectors[0].pressure = 0.76;
    state.sectors[1].pressure = 0.5;
    state.sectors[2].pressure = 0.66;
    for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  } else if (contract.location === "asteroid-refinery") {
    state.sectors[0].label = "CRUSHER DECK";
    state.sectors[1].label = "ORE TRANSFER";
    state.sectors[2].label = "REACTOR GANTRY";
    state.sectors[0].gravity = 0.62;
    state.sectors[1].gravity = 0.46;
    state.sectors[2].gravity = 0.32;
    const machinery = state.objects.find((object) => object.id === "bulkhead-b");
    if (machinery) machinery.hp = 220;
  } else if (contract.location === "spin-habitat") {
    state.sectors[0].label = "RIM HAB";
    state.sectors[1].label = "SPOKE TRANSIT";
    state.sectors[2].label = "AXIS HUB";
    state.sectors[0].gravity = 1.02;
    state.sectors[1].gravity = 0.42;
    state.sectors[2].gravity = 0.06;
    state.sectors[0].pressure = 0.95;
    state.sectors[1].pressure = 0.9;
    state.sectors[2].pressure = 0.92;
  } else if (contract.location === "jovian-harvester") {
    state.sectors[0].label = "PRESSURE LOCK";
    state.sectors[1].label = "SKIMMER DECK";
    state.sectors[2].label = "COMPRESSOR CROWN";
    state.sectors[0].gravity = 0.55;
    state.sectors[1].gravity = 0.24;
    state.sectors[2].gravity = 0.18;
    state.sectors[0].pressure = 0.94;
    state.sectors[1].pressure = 0.62;
    state.sectors[2].pressure = 0.76;
  } else if (contract.location === "ice-mine") {
    state.sectors[0].label = "ACCESS BORE";
    state.sectors[1].label = "EXTRACTION TUNNEL";
    state.sectors[2].label = "SUBGLACIAL VAULT";
    state.sectors[0].gravity = 0.34;
    state.sectors[1].gravity = 0.22;
    state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.96;
    state.sectors[1].pressure = 0.9;
    state.sectors[2].pressure = 0.82;
  } else if (contract.location === "solar-yard") {
    state.sectors[0].label = "SHADE GANTRY";
    state.sectors[1].label = "FABRICATION SPINE";
    state.sectors[2].label = "SUNWARD YARD";
    state.sectors[0].gravity = 0.45;
    state.sectors[1].gravity = 0.28;
    state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.92;
    state.sectors[1].pressure = 0.84;
    state.sectors[2].pressure = 0.72;
  } else if (contract.location === "lattice-annex") {
    state.sectors[0].label = "COLD METROLOGY RING";
    state.sectors[1].label = "REFERENCE GALLERY";
    state.sectors[2].label = "SAMPLE VAULT";
    state.sectors[0].gravity = 0.28;
    state.sectors[1].gravity = 0.11;
    state.sectors[2].gravity = 0.05;
    state.sectors[0].pressure = 0.9;
    state.sectors[1].pressure = 0.78;
    state.sectors[2].pressure = 0.7;
  } else if (contract.location === "momentum-exchange") {
    state.sectors[0].label = "BRAKE DECK";
    state.sectors[1].label = "TRANSFER TUNNEL";
    state.sectors[2].label = "COUNTERMASS CRADLE";
    state.sectors[0].gravity = 0.32;
    state.sectors[1].gravity = 0.05;
    state.sectors[2].gravity = 0.12;
    state.sectors[0].pressure = 0.88;
    state.sectors[1].pressure = 0.76;
    state.sectors[2].pressure = 0.82;
  } else if (contract.location === "cryo-reserve") {
    state.sectors[0].label = "SERVICE COLLAR";
    state.sectors[1].label = "PROPELLANT GALLERY";
    state.sectors[2].label = "UMBRA TANK FARM";
    state.sectors[0].gravity = 0.38;
    state.sectors[1].gravity = 0.16;
    state.sectors[2].gravity = 0.07;
    state.sectors[0].pressure = 0.92;
    state.sectors[1].pressure = 0.68;
    state.sectors[2].pressure = 0.56;
  } else {
    state.sectors[0].label = "SPIN DECK";
    state.sectors[1].label = "TRANSFER BAY";
    state.sectors[2].label = "CRANE WELL";
  }
  for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  if (contract.conditions.includes("limited-atmosphere")) {
    state.sectors[0].pressure = Math.min(state.sectors[0].pressure, 0.74);
    state.sectors[1].pressure = Math.min(state.sectors[1].pressure, 0.52);
    state.sectors[2].pressure = Math.min(state.sectors[2].pressure, 0.68);
    for (const sector of state.sectors) sector.targetPressure = sector.pressure;
  }
  if (contract.conditions.includes("failing-gravity")) state.sectors[1].gravity = Math.min(state.sectors[1].gravity, 0.22);
  if (contract.archetype === "boarding") {
    setRole(state, 1, "assault", "Boarding Vanguard");
    setRole(state, 2, "suppressor", "Hold Suppressor");
    setRole(state, 3, "technician", "Door Systems Tech");
    setRole(state, 4, "assault", "Boarding Vanguard");
  } else if (contract.archetype === "stabilization") {
    setRole(state, 1, "suppressor", "Grid Rifleman");
    setRole(state, 2, "technician", "Load Controller");
    setRole(state, 3, "technician", "Systems Tech");
    setRole(state, 4, "assault", "Reactor Guard");
  }
  configureTacticalRoster(state, contract);
  if ((_a = contract.directiveModifierIds) == null ? void 0 : _a.includes("repair-network")) setTacticalEnemy(state, 5, "technician", "repairDrone", "Directive Repair Mesh Drone", 72, 34);
  applyEncounterLayout(state, contract);
  applyThreatBudget(state.enemies, contract);
  state.operationTier = contract.operationTier ?? 1;
  state.monsterLevel = contract.monsterLevel ?? Math.max(1, Math.round(1 + ((contract.operationTier ?? 1) - 1) * 19 / 11));
  state.maxRecoveryLevel = contract.maxRecoveryLevel ?? 12;
  state.monsterDamageScale = contract.monsterDamageScale ?? 1;
  if (boss && (contract.operationTier ?? 1) >= 9) boss.patternIndex = (contract.seed + (contract.operationTier ?? 1)) % 3;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function telemetry(damageDealt = 4e3) {
  return {
    damageDealt,
    damageTaken: 0,
    deaths: 0,
    kills: 8,
    eliteKills: 2,
    eliteProtocolsDefeated: 2,
    killIntervalTotal: 8,
    killIntervalSamples: 4,
    lastKillAt: 30,
    protocolCombinations: {},
    weaponShots: { carbine: 20, breacher: 5, rail: 2 },
    abilityUses: [2, 2, 2],
    encounterStart: 0,
    bossStart: 0,
    duration: 45,
    trace: [],
    nextTraceAt: 0
  };
}
function installStorage() {
  const values = /* @__PURE__ */ new Map();
  const localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    get length() {
      return values.size;
    }
  };
  Object.defineProperty(globalThis, "window", { value: { localStorage }, configurable: true });
}
function combatSmoke() {
  const profile2 = createDefaultProfile();
  const state = createSimulation(deriveCombatBuild(profile2));
  const initialMag = state.player.mags.carbine;
  setAim(state, { x: 1, y: 0 });
  assert(triggerFire(state), "Carbine should fire from a fresh simulation.");
  assert(state.player.mags.carbine === initialMag - 1, "Firing should consume exactly one carbine round.");
  assert(state.telemetry.weaponShots.carbine === 1, "Firing should be represented in telemetry.");
  assert(triggerAbility(state, 0), "MAG should activate with a full capacitor.");
  assert(state.telemetry.abilityUses[0] === 1, "Ability activation should be represented in telemetry.");
  setMove(state, { x: 1, y: 0 });
  assert(triggerDodge(state), "Dodge should activate when ready.");
  stepSimulation(state, 1 / 60);
  assert(state.time > 0, "Fixed-step simulation should advance time.");
}
function objectiveSmoke(profileLevel) {
  const campaign2 = createDefaultCampaign();
  const profile2 = { ...createDefaultProfile(), level: profileLevel };
  for (const raw of generateContracts(campaign2)) {
    const contract = withOperationScaling(raw, campaign2, profile2.level);
    const state = createSimulation(deriveCombatBuild(profile2));
    const director = createDirector();
    applyMissionSetup(state, contract);
    const status = getMissionObjectiveStatus(state, contract);
    assert(status.required > 0, `${contract.id} should expose a non-zero objective requirement.`);
    assert(status.progress >= 0 && status.progress <= status.required, `${contract.id} objective progress should start within bounds.`);
    const next = getNextMissionObjectiveTarget(state, contract);
    if (!status.complete) assert(next || contract.objectiveMode === "pressure-recovery", `${contract.id} should expose a next ACT target when incomplete.`);
    assert(director.deep === false, "Mission director should initialize in the safe zone.");
  }
}
installStorage();
combatSmoke();
objectiveSmoke(1);
objectiveSmoke(15);
let profile = createDefaultProfile();
let campaign = createDefaultCampaign();
const starterEquipped = JSON.stringify(profile.equipped);
const starterIds = new Set(Object.values(profile.equipped).filter(Boolean));
let allocated = false;
let transitionLoot = [];
let reached15 = false;
let runs = 0;
while (profile.level < 15 && runs < 40) {
  const rawContracts = generateContracts(campaign);
  assert(rawContracts.length >= 3, "Campaign should always present a contract set.");
  const contract = withOperationScaling(rawContracts[runs % rawContracts.length], campaign, profile.level);
  const priorLevel = profile.level;
  const priorXp = profile.xp;
  const priorRuns = profile.runsCompleted;
  const priorInventory = profile.inventory.length;
  const priorAllocated = [...profile.allocatedNodes];
  const priorPoints = profile.progressionPoints;
  const reward = settleContract(campaign, contract, "deep", 12);
  const lootReward = awardRecovery(profile, telemetry(), true, campaign.shipUpgrades.fabrication, {
    operationTier: contract.operationTier,
    threatBudget: contract.threatBudget,
    maxRecoveryLevel: contract.maxRecoveryLevel,
    combatEffectiveness: contract.combatEffectiveness,
    location: contract.location,
    locationName: contract.locationName,
    deepTarget: contract.deepTarget,
    faction: contract.sponsor,
    factionReputation: campaign.reputation[contract.sponsor],
    optionalObjectives: 1,
    environmentalComplications: contract.environmentalEventSlots,
    eliteProtocolCount: contract.eliteProtocolSlots,
    actualDepth: true,
    directiveQualityBonus: contract.directiveQualityBonus,
    directiveSingularChanceBonus: contract.directiveSingularChanceBonus,
    directiveRecoveryLevelBonus: contract.directiveRecoveryLevelBonus
  });
  campaign = reward.campaign;
  profile = lootReward.profile;
  runs += 1;
  assert(profile.xp >= priorXp, `XP regressed after run ${runs}.`);
  assert(profile.level >= priorLevel, `Level regressed after run ${runs}.`);
  assert(profile.runsCompleted === priorRuns + 1, `Run counter did not advance exactly once on run ${runs}.`);
  assert(profile.inventory.length >= priorInventory + 1, `Recovery did not append equipment on run ${runs}.`);
  assert(JSON.stringify(profile.equipped) === starterEquipped, `Equipped starter loadout changed without an explicit equip action on run ${runs}.`);
  assert([...starterIds].every((id) => profile.inventory.some((item) => item.id === id)), `A starter item disappeared from storage on run ${runs}.`);
  assert(priorAllocated.every((id) => profile.allocatedNodes.includes(id)), `Allocated nodes were lost on run ${runs}.`);
  assert(profile.progressionPoints >= 0, `Progression points became negative on run ${runs}.`);
  assert(campaign.contractsCompleted === runs, `Campaign completion count diverged on run ${runs}.`);
  if (!allocated && profile.progressionPoints > 0) {
    const beforeEquip = JSON.stringify(profile.equipped);
    const result = allocateNode(profile, "ballistics-1");
    assert(result.profile.allocatedNodes.includes("ballistics-1"), "Earned progression point should allocate Dense Flight.");
    assert(result.profile.progressionPoints === profile.progressionPoints - 1, "Allocating one node should consume one point.");
    assert(JSON.stringify(result.profile.equipped) === beforeEquip, "Progression allocation must not alter equipment.");
    profile = result.profile;
    allocated = true;
  } else if (allocated) {
    assert(profile.allocatedNodes.includes("ballistics-1"), `Allocated node was lost after run ${runs}.`);
    assert(profile.progressionPoints >= Math.max(0, priorPoints - (priorAllocated.includes("ballistics-1") ? 0 : 1)), `Progression point accounting regressed after run ${runs}.`);
  }
  saveProfile(profile);
  saveCampaign(campaign);
  const reloadedProfile = loadProfile();
  const reloadedCampaign = loadCampaign();
  assert(reloadedProfile.level === profile.level && reloadedProfile.xp === profile.xp, `Profile save round-trip failed after run ${runs}.`);
  assert(reloadedProfile.allocatedNodes.join("|") === profile.allocatedNodes.join("|"), `Allocated nodes failed save round-trip after run ${runs}.`);
  assert(JSON.stringify(reloadedProfile.equipped) === JSON.stringify(profile.equipped), `Equipped loadout failed save round-trip after run ${runs}.`);
  assert(reloadedCampaign.contractsCompleted === campaign.contractsCompleted, `Campaign save round-trip failed after run ${runs}.`);
  if (priorLevel === 14 && profile.level >= 15) {
    reached15 = true;
    transitionLoot = lootReward.loot;
    assert(profile.specialization === null, "Reaching level 15 should not silently choose a specialization.");
    assert(transitionLoot.every((item) => (item.frameGeneration ?? 1) < 6), "The 14→15 recovery must remain source-correct and cannot retroactively roll Gen VI.");
  }
}
assert(reached15, `Expected to reach level 15 within 40 deep extractions; stopped at level ${profile.level} after ${runs}.`);
assert(profile.level === 15, `Beta progression should stop at level 15, got ${profile.level}.`);
assert(profile.xp >= 7140 && profile.xp < 8100, `Level 15 XP should sit inside the 7140–8099 band, got ${profile.xp}.`);
assert(xpProgress(profile).maxed === false, "Level 15 should still report progress toward level 16.");
assert(profile.allocatedNodes.includes("ballistics-1"), "Pre-level-15 progression allocation should survive the climb.");
assert(JSON.stringify(profile.equipped) === starterEquipped, "Level 15 transition must preserve equipped gear.");
const beforeSpecializationPoints = profile.progressionPoints;
const beforeSpecializationNodes = profile.allocatedNodes.join("|");
profile = setSpecialization(profile, "pressure-diver");
assert(profile.specialization === "pressure-diver", "Level 15 should unlock Vector Specialization selection.");
assert(profile.progressionPoints === beforeSpecializationPoints, "Choosing a specialization must not consume a progression point.");
assert(profile.allocatedNodes.join("|") === beforeSpecializationNodes, "Choosing a specialization must not rewrite the progression network.");
profile = setSpecializationOverclock(profile, true);
assert(profile.specializationOverclock === false, "Level 15 must not enable the level 16 overclock early.");
const pressureBaselineBuild = deriveCombatBuild({ ...profile, specialization: null, specializationOverclock: false });
const pressureBuild = deriveCombatBuild(profile);
assert(pressureBuild.specialization === "pressure-diver", "Selected specialization should reach the combat build.");
assert(pressureBuild.player.maxArmorAdd === pressureBaselineBuild.player.maxArmorAdd - 12, "Pressure Diver should reduce maximum armor by exactly 12 versus the same equipped loadout.");
assert(frameGenerationForRecovery(55, 14) === 5, "Operator level 14 must not access Gen VI even at recovery level 55.");
assert(frameGenerationForRecovery(55, 15) === 6, "Operator level 15 should access Gen VI at recovery level 55.");
const post15Reward = awardRecovery(profile, telemetry(), true, campaign.shipUpgrades.fabrication, {
  operationTier: 12,
  threatBudget: 76,
  maxRecoveryLevel: 56,
  combatEffectiveness: 1.2,
  location: "momentum-exchange",
  locationName: "Momentum Exchange",
  deepTarget: "Transfer Adjudicator Iona Vale",
  optionalObjectives: 1,
  environmentalComplications: 4,
  eliteProtocolCount: 4,
  actualDepth: true
});
const eligiblePost15 = post15Reward.loot.filter((item) => (item.recoveryLevel ?? 0) >= 55);
assert(eligiblePost15.length > 0, "A tier-12 level-15 deep recovery should produce at least one Gen VI-eligible frame.");
assert(eligiblePost15.every((item) => item.frameGeneration === 6), "Gen VI-eligible level-15 recoveries should materialize as Gen VI.");
console.log(`LEVEL15_BETA_PASS runs=${runs} level=${profile.level} xp=${profile.xp} contracts=${campaign.contractsCompleted} inventory=${profile.inventory.length} points=${profile.progressionPoints} allocated=${profile.allocatedNodes.length}`);
