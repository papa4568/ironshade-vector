function defaultConsumables() {
  return { medGel: 1, armorPatch: 0, capacitorCell: 0 };
}
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
function clamp$2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function sourceFor(input) {
  if (input.role === "boss" || input.combatClass === "command") return "boss";
  if (input.role === "elite" || input.combatClass === "elite") return "elite";
  if (input.combatClass === "enhanced") return "enhanced";
  return "standard";
}
function qualityFloor$1(source, operationTier) {
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
  const tier = clamp$2(Math.round(input.operationTier), 1, 12);
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
    recoveryQualityFloor: qualityFloor$1(source, tier),
    recoveryLevel,
    monsterLevel: Math.max(1, Math.round(input.monsterLevel)),
    active: true,
    collected: false,
    age: 0
  };
}
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
  const base2 = reputation >= 12 ? 1 : reputation >= 8 ? 0.72 : reputation >= 6 ? 0.56 : reputation >= 0 ? 0.38 : 0.26;
  return Math.min(1, base2 + (deep && base2 < 1 ? 0.1 : 0));
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
const clamp$1 = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
function frameGenerationForRecovery(recoveryLevel, operatorLevel = 10) {
  if (operatorLevel >= 15 && recoveryLevel >= 55) return 6;
  if (operatorLevel >= 12 && recoveryLevel >= 43) return 5;
  if (recoveryLevel >= 43) return 4;
  if (recoveryLevel >= 31) return 3;
  if (recoveryLevel >= 19) return 2;
  return 1;
}
function monsterLevelForTier(operationTier) {
  const tier = clamp$1(Math.round(operationTier), 1, 12);
  return clamp$1(Math.round(1 + (tier - 1) * 19 / 11), 1, 20);
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
  if (contract.directiveTier) return clamp$1(contract.directiveTier, 1, 12);
  const baseline = clamp$1(1 + Math.floor(campaign2.contractsCompleted / 2), 1, 12);
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
  return clamp$1(tier, 1, 12);
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
  const levelDelta = clamp$1(monsterLevel - Math.max(1, operatorLevel), -4, 4);
  const directivePressure = Math.min(0.16, Math.max(0, contract.directiveRiskScore ?? 0) * 8e-3);
  const combatEffectiveness = clamp$1(1 + (operationTier - 1) * 0.055 + levelDelta * 0.025 + directivePressure, 0.9, 1.85);
  const monsterDamageScale = clamp$1(1 + (operationTier - 1) * 0.035 + Math.max(0, levelDelta) * 0.02 + directivePressure * 0.45, 0.95, 1.55);
  const operationRewardMultiplier = (1 + (operationTier - 1) * 0.04) * (contract.directiveMaterialMultiplier ?? 1);
  const baseReserveCount = encounterPattern === "elite-led" ? 1 : encounterPattern === "swarm" ? 2 : operationTier >= 4 ? 2 : 1;
  const reserveCount = Math.min(2, baseReserveCount + (contract.directiveReserveBonus ?? 0));
  return { operationTier, monsterLevel, encounterRating, threatBudget, maxRecoveryLevel, maxFrameGeneration: frameGenerationForRecovery(maxRecoveryLevel, operatorLevel), eliteProtocolSlots, environmentalEventSlots, combatEffectiveness, monsterDamageScale, operationRewardMultiplier, encounterPattern, reserveCount };
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
const qualityFloor = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4 };
const locationQuality = { "orbital-station": 0.06, "damaged-vessel": 0.12, "asteroid-refinery": 0.18, "spin-habitat": 0.14, "jovian-harvester": 0.2, "ice-mine": 0.14, "solar-yard": 0.2, "lattice-annex": 0.28 };
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
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
  const floor = Math.min(ceiling, qualityFloor[quality]);
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
  const tier = clamp(source.operationTier, 1, 12) * 0.18;
  const threat = Math.max(0, source.threatBudget - 28) / 40;
  const elites = Math.min(2, Math.max(0, source.eliteKills)) * 0.4;
  const protocols = Math.min(4, Math.max(0, source.eliteProtocolCount)) * 0.2;
  const depth = source.deep ? 0.75 : 0;
  const optional = Math.min(3, Math.max(0, source.optionalObjectives)) * 0.22;
  const events = Math.min(4, Math.max(0, source.environmentalComplications)) * 0.12;
  const boss = source.boss ? 0.95 : 0;
  const location = locationQuality[source.location ?? ""] ?? 0;
  const sponsor = source.faction ? 0.08 + Math.min(0.12, Math.max(0, source.factionReputation ?? 0) * 6e-3) : 0;
  const directive = clamp(source.directiveBonus ?? 0, 0, 1.8);
  return clamp(tier + threat + elites + protocols + depth + optional + events + boss + location + sponsor + directive, 0, 7);
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
  const base2 = affixes[id];
  return { ...base2, family: modifierFamilyFor(id), grade, description: gradedDescription(id, grade) };
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
function locationSingularNames(location, operatorLevel = 16) {
  return locationPool(location, operatorLevel).map((item) => item.name);
}
Object.values(bossSingularPools).reduce((total, pool) => total + pool.length, 0) + chaseCatalog.length;
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
function levelForXp(xp) {
  let level = 1;
  for (let index = 1; index < levelThresholds.length; index += 1) if (xp >= levelThresholds[index]) level = index + 1;
  return level;
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
  const base2 = baseNames[slot];
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
    modifiers: rollModifierSet(base2.affixes, count, random, recoveryLevel, recoveryQuality, frame.preferredAffixes),
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
  const base2 = baseNames[slot];
  const rarity = forcedRarity ?? (forcedAffixes.length > 0 ? "Prototype" : rollRarityForQuality(random, recoveryQuality));
  const count = forcedCount ?? modifierCountForRarity(rarity, recoveryQuality, random);
  const frameGeneration = frameGenerationForRecovery(recoveryLevel, frameOperatorLevel);
  const generationNames = frameGenerationNames[slot][frameGeneration];
  const frameIdentity = rollFrameIdentity(slot, random);
  const equipmentQuality = equipmentQualityForRecovery(recoveryQuality, frameGeneration, rarity);
  const augmentSlots = augmentSlotCount(rarity, frameGeneration);
  return { id: `loot-${Date.now().toString(36)}-${index}-${Math.floor(random() * 99999).toString(36)}`, baseId: base2.baseId, name: generationNames[Math.floor(random() * generationNames.length)], slot, equipmentClass: base2.equipmentClass, rarity, levelRequirement: levelRequirementForRecovery(recoveryLevel), core: base2.core, modifiers: rollModifierSet(base2.affixes, count, random, recoveryLevel, recoveryQuality, [], forcedAffixes), recoveryLevel, frameGeneration, frameIdentity, frameImplicit: frameImplicitFor(slot, frameGeneration, frameIdentity, equipmentQuality), equipmentQuality, augmentSlots, augments: [], recoveryQuality, recoverySource };
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
  const rawXp = (deep ? 250 : 145) + Math.min(deep ? 90 : 45, Math.round(telemetry2.damageDealt / 22));
  const requestedXp = Math.round(rawXp * (1 + Math.max(0, (source.combatEffectiveness ?? 1) - 1) * 0.65));
  const cappedProfileXp = Math.max(0, Math.min(maxLevelXp, profile2.xp));
  const xpGained = Math.max(0, Math.min(requestedXp, maxLevelXp - cappedProfileXp));
  const nextXp = cappedProfileXp + xpGained;
  const nextLevel = levelForXp(nextXp);
  const levelsGained = Math.max(0, nextLevel - profile2.level);
  const random = seeded(2654435769 ^ profile2.runsCompleted * 7919 ^ profile2.level * 104729 ^ (deep ? 1374496523 : 97389));
  const count = deep ? 2 : 1;
  const maxRecoveryLevel = source.maxRecoveryLevel ?? 8 + Math.max(1, source.operationTier ?? 1) * 4;
  const eliteKills = telemetry2.eliteKills;
  const directiveRecoveryBonus = Math.max(0, Math.min(3, source.directiveRecoveryLevelBonus ?? 0));
  const ordinaryRecoveryLevel = Math.min(maxRecoveryLevel, recoveryLevelForSource(maxRecoveryLevel, { deep, boss: false, eliteKills }) + directiveRecoveryBonus);
  const bossRecoveryLevel = Math.min(maxRecoveryLevel, recoveryLevelForSource(maxRecoveryLevel, { deep: true, boss: true, eliteKills }) + directiveRecoveryBonus);
  const locationRecoveryLevel = Math.min(maxRecoveryLevel, ordinaryRecoveryLevel + 1);
  const actualDepth = source.actualDepth ?? deep;
  const locationName = source.locationName ?? (source.location ?? "Unknown site").replaceAll("-", " ");
  const factionName = source.faction === "meridian" ? "Meridian Compact" : source.faction === "heliostat" ? "Heliostat League" : source.faction === "longarc" ? "Long Arc Assembly" : "Independent";
  const rollQuality = (boss, minimum = 0) => Math.max(minimum, rollRecoveryQuality(random, { operationTier: source.operationTier ?? 1, threatBudget: source.threatBudget ?? 32, eliteKills, eliteProtocolCount: source.eliteProtocolCount ?? 0, deep: actualDepth, optionalObjectives: source.optionalObjectives ?? 0, environmentalComplications: source.environmentalComplications ?? 0, boss, location: source.location, faction: source.faction, factionReputation: source.factionReputation, directiveBonus: source.directiveQualityBonus ?? 0 }));
  const sponsoredChance = source.faction ? factionGearChance(source.factionReputation ?? 0, deep) : 0;
  const makeRecoveredItem = (slot, index) => {
    const recoveryQuality = rollQuality(actualDepth);
    return source.faction && random() < sponsoredChance ? makeFactionItem(slot, index, nextLevel, random, source.faction, ordinaryRecoveryLevel, recoveryQuality, `Sponsored recovery // ${factionName}`, profile2.level) : makeItem(slot, index, nextLevel, random, [], ordinaryRecoveryLevel, recoveryQuality, `${locationName} contract recovery`, void 0, profile2.level);
  };
  const fieldMode = Array.isArray(fieldLoot);
  const fieldDrops = (fieldLoot ?? []).slice(0, 12);
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
  const locationChance = Math.min(0.85, (deep ? bossItem ? 0.3 : 0.48 : 0.06) + Math.max(0, source.directiveSingularChanceBonus ?? 0));
  const locationItem = profile2.runsCompleted > 0 && random() < locationChance ? makeLocationSingular(source.location ?? "", bossItem ? 1 : 0, nextLevel, random, locationRecoveryLevel, rollQuality(actualDepth, 3), `Location chase // ${locationName}`, profile2.level) : null;
  let loot = [];
  if (profile2.runsCompleted === 0) {
    const first = makeItem("breacher", 0, nextLevel, random, ["overdrive", "breachPropulsion"], ordinaryRecoveryLevel, Math.max(1, rollQuality(false)), "Quiet Signal onboarding recovery", 2, profile2.level);
    loot.push({ ...first, name: "Backblast Kestrel Frame" });
    if (deep) {
      if (bossItem) loot.push(bossItem);
      else {
        const second = makeItem("rig", 1, nextLevel, random, ["dodgeVent", "capacitorRecycler"], ordinaryRecoveryLevel, Math.max(1, rollQuality(false)), "Quiet Signal onboarding recovery", 2, profile2.level);
        loot.push({ ...second, name: "Slipstream Thermal Rig" });
      }
    }
  } else if (deep && bossItem) {
    if (locationItem) loot = [bossItem, locationItem];
    else {
      const [slot] = chooseRecoverySlots(profile2, 1, random);
      loot = [bossItem, makeRecoveredItem(slot, 1)];
    }
  } else if (locationItem) {
    if (deep) {
      const [slot] = chooseRecoverySlots(profile2, 1, random);
      loot = [locationItem, makeRecoveredItem(slot, 1)];
    } else loot = [locationItem];
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
const weaponConfigs = {
  carbine: { id: "carbine", name: "Vektor M-7 Coil Carbine", shortName: "M-7 CARBINE", damage: 18, rate: 7.8, projectileSpeed: 860, penetration: 20, recoil: 38, spread: 0.018, heatPerShot: 0.058, heatDissipation: 0.23, magazine: 30, reloadSeconds: 1.35, armorDamage: 0.72, healthMultiplier: 1, knockback: 0.055, pellets: 1, capacitorCost: 0 },
  breacher: { id: "breacher", name: "Kestrel B-4 Breach Scattergun", shortName: "B-4 BREACHER", damage: 11, rate: 1.25, projectileSpeed: 560, penetration: 8, recoil: 112, spread: 0.16, heatPerShot: 0.17, heatDissipation: 0.2, magazine: 6, reloadSeconds: 1.85, armorDamage: 0.34, healthMultiplier: 1.45, knockback: 0.11, pellets: 7, capacitorCost: 0 },
  rail: { id: "rail", name: "Helix R-2 Rail Lance", shortName: "R-2 RAIL LANCE", damage: 48, rate: 0.82, projectileSpeed: 1380, penetration: 115, recoil: 168, spread: 4e-3, heatPerShot: 0.28, heatDissipation: 0.16, magazine: 5, reloadSeconds: 2.1, armorDamage: 1.75, healthMultiplier: 0.92, knockback: 0.12, pellets: 1, capacitorCost: 10 }
};
const neutralCombatBuild = { weapon: { carbine: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, breacher: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 }, rail: { damageMul: 1, speedMul: 1, penetrationAdd: 0, recoilMul: 1, heatPerShotMul: 1, heatDissipationMul: 1, magazineAdd: 0, reloadMul: 1, armorDamageMul: 1, healthMultiplierMul: 1, knockbackMul: 1 } }, player: { maxHpAdd: 0, maxArmorAdd: 0, maxCapAdd: 0, moveSpeedMul: 1, capRegenMul: 1, vacuumResistance: 0, lowGControl: 0, ventSpeedMul: 1 }, mechanics: { railFragment: false, railFragmentScale: 0, dodgeVent: false, dodgeVentScale: 0, magRedirect: false, magRedirectScale: 0, breacherPropulsion: false, breacherPropulsionScale: 0, markWeakArmor: false, markWeakArmorScale: 0, arcDrone: false, arcDroneScale: 0, recoilVectoring: false, breachDoctrine: false, sensorPenetration: false, widebandMark: false, magOverdriveKick: false, arcGroundLoop: false, magBoundarySink: false, markExecutionTrace: false, arcCascadeLattice: false }, singularTraits: [], specialization: null, specializationOverclock: false, abilities: [{ costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }, { costMul: 1, cooldownMul: 1, powerMul: 1 }] };
function resolveWeaponConfig(build, id) {
  const base2 = weaponConfigs[id];
  const mod = build.weapon[id];
  return { ...base2, damage: base2.damage * mod.damageMul, projectileSpeed: base2.projectileSpeed * mod.speedMul, penetration: base2.penetration + mod.penetrationAdd, recoil: base2.recoil * mod.recoilMul, heatPerShot: base2.heatPerShot * mod.heatPerShotMul, heatDissipation: base2.heatDissipation * mod.heatDissipationMul, magazine: Math.max(1, Math.round(base2.magazine + mod.magazineAdd)), reloadSeconds: base2.reloadSeconds * mod.reloadMul, armorDamage: base2.armorDamage * mod.armorDamageMul, healthMultiplier: base2.healthMultiplier * mod.healthMultiplierMul, knockback: base2.knockback * mod.knockbackMul };
}
function blankStatuses() {
  return { armorBreach: 0, disrupted: 0, marked: 0, stagger: 0, conductive: 0, vacuum: 0 };
}
function spawnEnemy(id, role, label, x, y, hp, armor, sign, active = true, variant = "standard") {
  return { id, role, variant, combatClass: role === "boss" ? "command" : role === "elite" ? "elite" : "standard", protocols: [], protocolPulse: 0, label, x, y, vx: 0, vy: 0, hp, maxHp: hp, armor, maxArmor: armor, effectiveness: 1, fireCooldown: 0.8 + id * 0.17, telegraph: 0, telegraphAim: { x: -1, y: 0 }, strafeSign: sign, dead: false, deathT: 0, active, state: "hold", hazardCooldown: 2.5 + id * 0.4, burst: 0, carriedObjectId: null, statuses: blankStatuses(), bossPhase: 1, bossPattern: "none", patternIndex: 0, anchored: role === "elite" || role === "boss" };
}
function createSimulation(build = neutralCombatBuild) {
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
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const campaign = createDefaultCampaign();
const base = generateContracts(campaign)[0];
assert(base, "expected a generated contract");
const low = operationScalingFor({ ...base, directiveTier: 1 }, campaign, 1);
const high = operationScalingFor({ ...base, directiveTier: 12 }, campaign, 20);
assert(low.monsterLevel === 1, `tier 1 monster level should be 1, saw ${low.monsterLevel}`);
assert(high.monsterLevel === 20, `tier 12 monster level should be 20, saw ${high.monsterLevel}`);
assert(high.combatEffectiveness >= 1.55, `tier 12 effectiveness too low: ${high.combatEffectiveness}`);
assert(high.monsterDamageScale >= 1.35, `tier 12 damage scale too low: ${high.monsterDamageScale}`);
assert(high.operationRewardMultiplier > low.operationRewardMultiplier, "higher tier should reward more materials");
const cautiousCampaign = { ...campaign, contractsCompleted: 30, reputation: { meridian: 12, heliostat: 12, longarc: 12 } };
const cautiousContract = generateContracts(cautiousCampaign)[0];
const cautious = operationScalingFor(cautiousContract, cautiousCampaign, 11);
assert(cautious.operationTier <= standardTierCapForOperator(11), "standard board exceeded LV11 tier cap");
assert(cautious.monsterLevel <= 13, "standard board should stay within +2 monster levels at LV11");
const explicitHardMode = operationScalingFor({ ...base, directiveTier: 12 }, cautiousCampaign, 11);
assert(explicitHardMode.operationTier === 12 && explicitHardMode.monsterLevel === 20, "explicit Directive tiers must remain uncapped by standard-board safety.");
const lowState = createSimulation();
const highState = createSimulation();
applyThreatBudget(lowState.enemies, { ...base, ...low });
applyThreatBudget(highState.enemies, { ...base, ...high });
const lowEnemy = lowState.enemies.find((enemy) => enemy.id === 1);
const highEnemy = highState.enemies.find((enemy) => enemy.id === 1);
const lowBoss = lowState.enemies.find((enemy) => enemy.role === "boss");
const highBoss = highState.enemies.find((enemy) => enemy.role === "boss");
assert(highEnemy.maxHp > lowEnemy.maxHp * 1.45, `regular monster life did not scale enough: ${lowEnemy.maxHp} -> ${highEnemy.maxHp}`);
assert(highBoss.maxHp > lowBoss.maxHp * 1.35, `boss life did not scale enough: ${lowBoss.maxHp} -> ${highBoss.maxHp}`);
assert(maxOperatorLevel === 20, `operator cap should be 20, saw ${maxOperatorLevel}`);
assert(levelRequirementForRecovery(12) === 1, "RL12 should remain starter-tier compatible");
assert(levelRequirementForRecovery(56) === 20, "RL56 should require level 20");
assert(levelRequirementForRecovery(40) > levelRequirementForRecovery(24), "gear requirements should climb with recovery level");
const bossDrop = rollGroundLoot({ enemyId: 99, enemyLabel: "Command Target", role: "boss", combatClass: "command", x: 100, y: 100, operationTier: 12, maxRecoveryLevel: 56, monsterLevel: 20, sequence: 0 }, () => 0.99);
assert((bossDrop == null ? void 0 : bossDrop.rarity) === "Singular" && bossDrop.recoveryQualityFloor >= 4, "boss should guarantee a high-quality Singular ground drop");
const eliteDrop = rollGroundLoot({ enemyId: 6, enemyLabel: "Elite", role: "elite", combatClass: "elite", x: 100, y: 100, operationTier: 8, maxRecoveryLevel: 40, monsterLevel: 14, sequence: 0 }, () => 0.99);
assert((eliteDrop == null ? void 0 : eliteDrop.rarity) === "Prototype" && eliteDrop.recoveryQualityFloor >= 4, "elite should guarantee a high-quality Prototype ground drop");
const normalDrop = rollGroundLoot({ enemyId: 1, enemyLabel: "Raider", role: "assault", combatClass: "standard", x: 100, y: 100, operationTier: 6, maxRecoveryLevel: 32, monsterLevel: 11, sequence: 0 }, () => 0);
assert(normalDrop, "standard monsters should sometimes produce field loot");
const profile = createDefaultProfile();
const starterRig = profile.inventory.find((item) => item.slot === "rig");
const bloom = { ...starterRig, id: "test-bloom", name: "Bloom Vector Rig", rarity: "Singular", singularTrait: "magBloom", singularEffect: "test", modifiers: [] };
const bloomProfile = { ...profile, inventory: [...profile.inventory, bloom], equipped: { ...profile.equipped, rig: bloom.id } };
const bloomBuild = deriveCombatBuild(bloomProfile);
assert(bloomBuild.abilities[0].costMul >= 1.25 && bloomBuild.abilities[0].cooldownMul >= 1.08, "MAG Bloom tradeoff should be active when equipped");
const stationUniques = locationSingularNames("orbital-station", 20);
assert(stationUniques.includes("Sixth-Vector M-12") && stationUniques.includes("Cascade Sight Link"), "new skill-transform Singulars should be in chase pools");
const telemetry = { damageDealt: 8e3, eliteKills: 1 };
const receipt = { id: "boss-ground", enemyId: 99, enemyLabel: "Command Target", rarity: "Singular", source: "boss", recoveryQualityFloor: 5, recoveryLevel: 56, monsterLevel: 20 };
const recovered = awardRecovery(profile, telemetry, true, 0, { deepTarget: base.deepTarget, location: base.location, locationName: base.locationName, operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget, actualDepth: true }, [receipt]);
assert(recovered.loot.some((item) => {
  var _a;
  return ((_a = item.recoverySource) == null ? void 0 : _a.startsWith("Ground drop //")) && item.rarity === "Singular";
}), "collected boss ground drop should materialize as Singular gear at extraction");
let leveling = createDefaultProfile();
for (let run = 0; run < 70 && leveling.level < 20; run += 1) leveling = awardRecovery(leveling, telemetry, false, 0, { operationTier: 12, maxRecoveryLevel: 56, combatEffectiveness: high.combatEffectiveness, threatBudget: high.threatBudget }).profile;
assert(leveling.level === 20, `progression should reach level 20, stopped at ${leveling.level}`);
console.log(`LOOT_DIFFICULTY_PASS lowEff=${low.combatEffectiveness.toFixed(2)} highEff=${high.combatEffectiveness.toFixed(2)} highDamage=${high.monsterDamageScale.toFixed(2)} level=${leveling.level} bossDrop=${bossDrop.rarity}`);
