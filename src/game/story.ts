import {
  factionDisplayName,
  type CampaignState,
  type ConditionId,
  type Contract,
  type FactionId,
  type LocationId,
  type StoryArcId,
} from './campaign';

export type StoryChoice = { id: string; title: string; body: string; consequence: string; reputation?: FactionId };
export type StoryChoicePrompt = { title: string; body: string; choices: StoryChoice[] };
export type StoryArcDefinition = { id: StoryArcId; sponsor: FactionId; title: string; subtitle: string; premise: string; recommendedLevel: number; finale: string };

export const storyArcDefinitions: StoryArcDefinition[] = [
  {
    id: 'vanishing-wake',
    sponsor: 'longarc',
    title: 'Vanishing Wake',
    subtitle: 'Missing crews / false pressure hardware',
    premise: 'Long Arc salvage crews vanish from ordinary recovery routes. Their last manifests point toward pressure machinery that was modified outside every registered service standard.',
    recommendedLevel: 2,
    finale: 'Pressure Broker Naima Rusk',
  },
  {
    id: 'terms-of-survival',
    sponsor: 'meridian',
    title: 'Terms of Survival',
    subtitle: 'Certification failures / hidden reference geometry',
    premise: 'Meridian pressure systems pass inspection and then fail in ways their own certified models say should be impossible. The problem is not ordinary counterfeit hardware.',
    recommendedLevel: 3,
    finale: 'Bond Arbiter Edrin Shaw',
  },
  {
    id: 'cold-sun-protocol',
    sponsor: 'heliostat',
    title: 'Cold Sun Protocol',
    subtitle: 'Autonomous tooling / phase-reference anomaly',
    premise: 'Heliostat fabrication controls begin converging on the same non-reflective lattice geometry recovered elsewhere, even when the systems have no documented data path between them.',
    recommendedLevel: 3,
    finale: 'PRISM-6 Forge Chorus',
  },
];

const locationNames: Record<LocationId, string> = {
  'orbital-station': 'Orbital Industrial Station',
  'damaged-vessel': 'Damaged Freight Vessel',
  'asteroid-refinery': 'Asteroid Refinery',
  'spin-habitat': 'Rotating Spin Habitat',
  'jovian-harvester': 'Jovian Gas-Harvester Platform',
  'ice-mine': 'Subsurface Ice-Mining Installation',
  'solar-yard': 'Solar-Orbit Fabrication Yard',
  'lattice-annex': 'Khepri Survey Annex',
  'momentum-exchange': 'Cislunar Momentum Exchange',
  'cryo-reserve': 'Umbra Cryogenic Propellant Reserve',
};

const conditionNames: Record<ConditionId, string> = {
  'unstable-pressure': 'Unstable pressure shell',
  'failing-gravity': 'Failing gravity control',
  'damaged-grid': 'Damaged electrical grid',
  'automated-defense': 'Automated defense remnants',
  'limited-atmosphere': 'Limited atmosphere',
  'low-visibility': 'Low visibility particulates',
};

function contract(
  arc: StoryArcId,
  step: number,
  spec: Omit<Contract, 'id' | 'locationName' | 'conditionLabels' | 'priority' | 'anomalyOpportunity' | 'seed' | 'storyArc' | 'storyStep'> & { id: string },
): Contract {
  return {
    ...spec,
    id: `story-${arc}-${step}-${spec.id}`,
    locationName: locationNames[spec.location],
    conditionLabels: spec.conditions.map(condition => conditionNames[condition]),
    priority: false,
    anomalyOpportunity: false,
    seed: 0x5a17 + step * 7919 + arc.length * 104729 + spec.id.length * 131,
    storyArc: arc,
    storyStep: step,
  };
}

function longArcContract(campaign: CampaignState): Contract | null {
  const progress = campaign.story.arcs['vanishing-wake'];
  if (progress.status !== 'active') return null;
  if (progress.step === 0) return contract('vanishing-wake', 0, {
    id: 'empty-berths', sponsor: 'longarc', archetype: 'salvage', location: 'damaged-vessel', title: 'Vanishing Wake // Empty Berths',
    objective: 'Recover the missing crews’ last cargo tags and inspect the pressure route they were following.', objectiveMode: 'deep-salvage',
    objectiveSteps: ['Tag the three abandoned recovery packages.', 'Clear the damaged freight route.', 'Bank the manifests for comparison aboard Quiet Signal.'],
    briefing: 'Three Long Arc crews disappeared after accepting almost identical low-value salvage work. Their ships were found intact, their pressure logs were not.',
    conditions: ['limited-atmosphere', 'unstable-pressure'], directorPreview: 'A structural pressure failure remains deterministic and visible. The missing crews’ route ends at modified service hardware.',
    deepTarget: 'Salvage Interdictor Kade', rewardBase: { credits: 255, alloys: 5, electronics: 3, components: 1 }, reputationGain: 2,
    storyChapter: 'CHAPTER 1 / THE EMPTY BERTHS', storyAftermath: 'The recovered manifests share a maintenance signature tied to unregistered pressure regulators. Someone has been steering Long Arc crews toward the same hardware.',
  });
  if (progress.step === 1 && !progress.choiceA) return null;
  if (progress.step === 1 && progress.choiceA === 'assembly') return contract('vanishing-wake', 1, {
    id: 'quiet-hands', sponsor: 'longarc', archetype: 'salvage', location: 'ice-mine', title: 'Vanishing Wake // Quiet Hands',
    objective: 'Recover the modified regulator packages before the tunnel fracture destroys their evidence value.', objectiveMode: 'machinery-recovery',
    objectiveSteps: ['Tag the cryobore regulator package.', 'Tag the separator control package.', 'Extract the service geometry without dismantling it.'],
    briefing: 'Assembly delegates trace the maintenance signature to a remote cryobore where crews have been replacing pressure regulators with hand-machined copies.',
    conditions: ['low-visibility', 'failing-gravity'], directorPreview: 'The tunnel fracture can change firing lanes. The recovered regulator contains a black dimensional reference insert that is not part of the pressure circuit.',
    deepTarget: 'Salvage Captain Rhea Kade', rewardBase: { credits: 265, alloys: 5, electronics: 3, components: 2 }, reputationGain: 2,
    storyChapter: 'CHAPTER 2 / QUIET HANDS', storyClue: true, storyAftermath: 'The regulator’s black insert matches the quarantined lattice geometry closely enough that coincidence is no longer a useful explanation. Its function is still unclear.',
  });
  if (progress.step === 1) return contract('vanishing-wake', 1, {
    id: 'bonded-copy', sponsor: 'meridian', archetype: 'boarding', location: 'spin-habitat', title: 'Vanishing Wake // Bonded Copy',
    objective: 'Recover the certified pressure-service ledger Meridian believes was altered after inspection.', objectiveMode: 'emergency-boarding',
    objectiveSteps: ['Cycle the spoke pressure interlock.', 'Cycle the axis pressure lock.', 'Secure the audit ledger from the boarding line.'],
    briefing: 'Meridian auditors recognize the forged service stamp and produce a second copy from a spin habitat. Someone altered both records after certification.',
    conditions: ['damaged-grid', 'failing-gravity'], directorPreview: 'The ring still undergoes emergency spindown. Meridian recovery troops are protecting an audit copy whose geometry does not match their own certification archive.',
    deepTarget: 'Recovery Commander Sable Voss', rewardBase: { credits: 285, alloys: 4, electronics: 4, medstock: 1 }, reputationGain: 2,
    storyChapter: 'CHAPTER 2 / BONDED COPY', storyClue: true, storyAftermath: 'The certified drawing contains the same black reference geometry hidden in a pressure-load checksum. The modification predates the crews’ disappearance.',
  });
  if (progress.step === 2 && !progress.choiceB) return null;
  if (progress.step === 2 && progress.choiceB === 'raid') return contract('vanishing-wake', 2, {
    id: 'false-lung', sponsor: 'longarc', archetype: 'boarding', location: 'jovian-harvester', title: 'Vanishing Wake // Cut the False Lung',
    objective: 'Shut down the pressure works manufacturing the illegal regulator copies.', objectiveMode: 'grid-isolation',
    objectiveSteps: ['Isolate the skimmer pressure-control bus.', 'Isolate the compressor control branch.', 'Clear the works before its records can be purged.'],
    briefing: 'The maintenance trail reaches a stormline shop making pressure hardware that deliberately imitates certified parts while embedding the unexplained lattice reference.',
    conditions: ['unstable-pressure', 'damaged-grid'], directorPreview: 'Storm shear can open the maintenance vent. The shop crew will use pressure differentials as a defensive weapon.',
    deepTarget: 'Stormline Foreman Ilex', rewardBase: { credits: 300, alloys: 5, electronics: 5, components: 2 }, reputationGain: 3,
    storyChapter: 'CHAPTER 3 / FALSE LUNG', storyAftermath: 'The shop records name a broker who buys ordinary salvage contracts solely to route crews through selected pressure failures: Naima Rusk.',
  });
  if (progress.step === 2) return contract('vanishing-wake', 2, {
    id: 'witness-run', sponsor: 'longarc', archetype: 'boarding', location: 'damaged-vessel', title: 'Vanishing Wake // Witness Run',
    objective: 'Reopen the pressure-gated route long enough to move the surviving regulator technician off the vessel.', objectiveMode: 'emergency-boarding',
    objectiveSteps: ['Cycle both pressure interlocks.', 'Break the interception line.', 'Hold the route until the witness transfer is secure.'],
    briefing: 'A regulator technician agrees to testify if Quiet Signal can move them through a damaged freight corridor before the broker’s recovery team arrives.',
    conditions: ['limited-atmosphere', 'damaged-grid'], directorPreview: 'The contract uses ordinary boarding mechanics; the stakes come from protecting the route, not an escort minigame.',
    deepTarget: 'Boarding Chief Serrin', rewardBase: { credits: 285, alloys: 4, electronics: 4, medstock: 2 }, reputationGain: 3,
    storyChapter: 'CHAPTER 3 / WITNESS RUN', storyAftermath: 'The witness identifies Naima Rusk as the broker purchasing failed pressure hardware and the crews sent to recover it afterward.',
  });
  if (progress.step === 3) return contract('vanishing-wake', 3, {
    id: 'pressure-broker', sponsor: 'longarc', archetype: 'boarding', location: 'jovian-harvester', title: 'Vanishing Wake // Pressure Broker',
    objective: 'Cut Rusk’s pressure-control branches and force access to the broker’s stormline vault.', objectiveMode: 'grid-isolation',
    objectiveSteps: ['Isolate both pressure-control branches.', 'Clear Rusk’s recovery line.', 'Continue into the deep zone and defeat Naima Rusk.'],
    briefing: 'Rusk has retreated into a harvester crown modified to turn pressure shutters, vent paths, and false service walls into a defensive network.',
    conditions: ['unstable-pressure', 'automated-defense'], directorPreview: 'Finale contract. Safe extraction banks ordinary rewards but does not close the operation; Rusk must be defeated in the deep zone.',
    deepTarget: 'Pressure Broker Naima Rusk', rewardBase: { credits: 340, alloys: 6, electronics: 5, components: 3 }, reputationGain: 4,
    storyChapter: 'FINALE / THE PRESSURE BROKER', storyFinale: true, storyClue: true, storyAftermath: 'Rusk’s vault contains another quarantined lattice sample and routing records proving the same hidden supplier touched pressure hardware across multiple factions.',
  });
  return null;
}

function meridianContract(campaign: CampaignState): Contract | null {
  const progress = campaign.story.arcs['terms-of-survival'];
  if (progress.status !== 'active') return null;
  if (progress.step === 0) return contract('terms-of-survival', 0, {
    id: 'invalid-seal', sponsor: 'meridian', archetype: 'stabilization', location: 'spin-habitat', title: 'Terms of Survival // Invalid Seal',
    objective: 'Calibrate the habitat gravity trims and recover the failed seal’s certified service record.', objectiveMode: 'gravity-stabilization',
    objectiveSteps: ['Calibrate the rim gravity trim.', 'Calibrate the spoke gravity trim.', 'Secure the failed seal record after the spindown.'],
    briefing: 'A Meridian-certified habitat seal failed inside its rated pressure envelope. The replacement parts and inspection signatures are all genuine.',
    conditions: ['failing-gravity', 'damaged-grid'], directorPreview: 'The spin transition remains physical and deterministic. The contradiction is in the certification data, not hidden combat scaling.',
    deepTarget: 'Recovery Commander Sable Voss', rewardBase: { credits: 280, alloys: 4, electronics: 4, medstock: 2 }, reputationGain: 2,
    storyChapter: 'CHAPTER 1 / INVALID SEAL', storyAftermath: 'The failed seal was manufactured exactly to its drawing. The drawing itself contains a reference surface no Meridian engineer can trace to an approved standard.',
  });
  if (progress.step === 1 && !progress.choiceA) return null;
  if (progress.step === 1 && progress.choiceA === 'cooperative') return contract('terms-of-survival', 1, {
    id: 'open-audit', sponsor: 'meridian', archetype: 'salvage', location: 'orbital-station', title: 'Terms of Survival // Open Audit',
    objective: 'Recover three archived certification packages before the station’s records are scrubbed.', objectiveMode: 'deep-salvage',
    objectiveSteps: ['Tag the archived test package.', 'Tag the fabrication record.', 'Tag the inspection copy and clear the station.'],
    briefing: 'Habitat cooperatives agree to compare independent records in public. Their copies contain the same unexplained reference geometry.',
    conditions: ['low-visibility', 'damaged-grid'], directorPreview: 'The station uses the baseline industrial topology. The story branch changes who controls the evidence and what records remain available.',
    deepTarget: 'Dock Warden Orison', rewardBase: { credits: 275, alloys: 4, electronics: 5, components: 2 }, reputationGain: 2,
    storyChapter: 'CHAPTER 2 / OPEN AUDIT', storyClue: true, storyAftermath: 'Independent archives prove the geometry was present before the current bond houses inherited the standard. Someone upstream seeded the reference into multiple certification systems.',
  });
  if (progress.step === 1) return contract('terms-of-survival', 1, {
    id: 'sealed-audit', sponsor: 'meridian', archetype: 'stabilization', location: 'damaged-vessel', title: 'Terms of Survival // Sealed Audit',
    objective: 'Isolate the damaged control grid and recover the bond house’s private comparison archive.', objectiveMode: 'grid-isolation',
    objectiveSteps: ['Isolate both damaged grid branches.', 'Clear the control spine.', 'Bank the private comparison archive.'],
    briefing: 'The bond house accepts a closed audit and points Quiet Signal toward a freight hull carrying an older internal copy of the pressure standard.',
    conditions: ['damaged-grid', 'limited-atmosphere'], directorPreview: 'The private archive is better preserved but politically narrower. The same reference geometry appears in records never released outside Meridian.',
    deepTarget: 'Reactor Custodian Ansel', rewardBase: { credits: 300, alloys: 4, electronics: 5, medstock: 2 }, reputationGain: 3,
    storyChapter: 'CHAPTER 2 / SEALED AUDIT', storyClue: true, storyAftermath: 'The internal archive confirms Meridian inherited the geometry rather than inventing it. The source field was intentionally blanked before the Compact existed.',
  });
  if (progress.step === 2 && !progress.choiceB) return null;
  if (progress.step === 2 && progress.choiceB === 'seize') return contract('terms-of-survival', 2, {
    id: 'seize-ledger', sponsor: 'meridian', archetype: 'boarding', location: 'asteroid-refinery', title: 'Terms of Survival // Seize the Ledger',
    objective: 'Break the archive-security line and tag the refinery’s hidden certification mirror.', objectiveMode: 'machinery-recovery',
    objectiveSteps: ['Tag the archive-control package.', 'Tag the certification mirror.', 'Clear the refinery route for seizure.'],
    briefing: 'A bond arbitration office moved the oldest source ledger into a privately defended refinery data cage after learning Quiet Signal was comparing records.',
    conditions: ['automated-defense', 'damaged-grid'], directorPreview: 'The refinery’s machinery remains part of the fight. Seizing the ledger favors institutional proof over protecting the people who maintained it.',
    deepTarget: 'Foundry Marshal Cael', rewardBase: { credits: 320, alloys: 5, electronics: 5, components: 3 }, reputationGain: 3,
    storyChapter: 'CHAPTER 3 / SEIZE THE LEDGER', storyAftermath: 'The seized ledger names Bond Arbiter Edrin Shaw as the official who repeatedly closed investigations into the unexplained reference geometry.',
  });
  if (progress.step === 2) return contract('terms-of-survival', 2, {
    id: 'safe-passage', sponsor: 'meridian', archetype: 'boarding', location: 'spin-habitat', title: 'Terms of Survival // Safe Passage',
    objective: 'Cycle both pressure interlocks and clear a route for engineers leaving the arbitration office.', objectiveMode: 'emergency-boarding',
    objectiveSteps: ['Cycle the spoke pressure interlock.', 'Cycle the axis pressure lock.', 'Clear the ring so the engineers can depart.'],
    briefing: 'The engineers who maintained the source ledger ask for passage before they identify the official who ordered them to suppress the anomaly.',
    conditions: ['failing-gravity', 'automated-defense'], directorPreview: 'No escort AI is introduced. The combat objective is to reopen and hold the route using existing pressure-gate mechanics.',
    deepTarget: 'Recovery Commander Sable Voss', rewardBase: { credits: 300, alloys: 4, electronics: 4, medstock: 3 }, reputationGain: 3,
    storyChapter: 'CHAPTER 3 / SAFE PASSAGE', storyAftermath: 'The engineers identify Bond Arbiter Edrin Shaw and provide the coordinates of the archive he is now trying to seal permanently.',
  });
  if (progress.step === 3) return contract('terms-of-survival', 3, {
    id: 'bond-arbiter', sponsor: 'meridian', archetype: 'boarding', location: 'spin-habitat', title: 'Terms of Survival // Final Arbitration',
    objective: 'Open the arbitration ring, break the certified defense line, and confront Shaw in the axis archive.', objectiveMode: 'emergency-boarding',
    objectiveSteps: ['Cycle both arbitration pressure interlocks.', 'Clear the certified recovery line.', 'Continue deeper and defeat Bond Arbiter Edrin Shaw.'],
    briefing: 'Shaw argues that publishing an unexplained standard would destabilize pressure certification across the Compact. He has chosen to defend the archive rather than surrender it.',
    conditions: ['failing-gravity', 'damaged-grid'], directorPreview: 'Finale contract. Safe extraction preserves ordinary rewards but the archive remains sealed until Shaw is defeated in the deep zone.',
    deepTarget: 'Bond Arbiter Edrin Shaw', rewardBase: { credits: 360, alloys: 6, electronics: 6, medstock: 3, components: 2 }, reputationGain: 4,
    storyChapter: 'FINALE / FINAL ARBITRATION', storyFinale: true, storyClue: true, storyAftermath: 'Shaw’s archive proves the Compact knew the reference geometry had no attributable source. It was retained because systems built against it survived stress tests unusually well.',
  });
  return null;
}

function heliostatContract(campaign: CampaignState): Contract | null {
  const progress = campaign.story.arcs['cold-sun-protocol'];
  if (progress.status !== 'active') return null;
  if (progress.step === 0) return contract('cold-sun-protocol', 0, {
    id: 'uncalled-calibration', sponsor: 'heliostat', archetype: 'stabilization', location: 'solar-yard', title: 'Cold Sun Protocol // Uncalled Calibration',
    objective: 'Recover the actuator and spindle packages that recalibrated themselves without an authorized control revision.', objectiveMode: 'machinery-recovery',
    objectiveSteps: ['Tag the mirror actuator package.', 'Tag the printer spindle package.', 'Clear the sunward lane and preserve the controller state.'],
    briefing: 'A Heliostat yard repeatedly converges on a control geometry no engineer entered. Resetting the controller causes the same geometry to reappear.',
    conditions: ['damaged-grid', 'automated-defense'], directorPreview: 'Solar load still raises weapon heat unless local shutters are closed. The anomaly is in the controller’s chosen reference, not a supernatural event.',
    deepTarget: 'HELIOS-9 Yardmind', rewardBase: { credits: 280, electronics: 6, components: 2, medstock: 1 }, reputationGain: 2,
    storyChapter: 'CHAPTER 1 / UNCALLED CALIBRATION', storyAftermath: 'The controller is not copying a hidden file. It is mathematically converging on the same lattice geometry as a stable phase reference.',
  });
  if (progress.step === 1 && !progress.choiceA) return null;
  if (progress.step === 1 && progress.choiceA === 'open') return contract('cold-sun-protocol', 1, {
    id: 'open-bench', sponsor: 'heliostat', archetype: 'stabilization', location: 'asteroid-refinery', title: 'Cold Sun Protocol // Open Bench',
    objective: 'Isolate both test-grid branches while open-engineering teams compare the controller against refinery hardware.', objectiveMode: 'grid-isolation',
    objectiveSteps: ['Isolate the crusher test branch.', 'Isolate the reactor test branch.', 'Clear interference while the comparison is banked.'],
    briefing: 'Open-engineering guilds reproduce the convergence on unrelated refinery controls. The result is public enough that no single council can quietly bury it.',
    conditions: ['damaged-grid', 'failing-gravity'], directorPreview: 'The refinery remains a normal Vector encounter; the branch changes who receives the result and which equipment is available for comparison.',
    deepTarget: 'Foundry Marshal Cael', rewardBase: { credits: 285, electronics: 6, alloys: 4, components: 2 }, reputationGain: 2,
    storyChapter: 'CHAPTER 2 / OPEN BENCH', storyClue: true, storyAftermath: 'Three independent machines converge on the same phase geometry. The pattern now spans pressure hardware, certification records, and autonomous control.',
  });
  if (progress.step === 1) return contract('cold-sun-protocol', 1, {
    id: 'closed-bench', sponsor: 'heliostat', archetype: 'salvage', location: 'solar-yard', title: 'Cold Sun Protocol // Closed Bench',
    objective: 'Tag three controller packages inside a quarantined fabrication cell for a proprietary comparison.', objectiveMode: 'deep-salvage',
    objectiveSteps: ['Tag the shade-side controller.', 'Tag the fabrication-spine controller.', 'Tag the sunward controller and clear the cell.'],
    briefing: 'The foundry council contains the anomaly and supplies three isolated controllers. All three still converge toward the same reference geometry.',
    conditions: ['automated-defense', 'low-visibility'], directorPreview: 'The branch keeps the evidence controlled but allows a cleaner test. Thermal shutters remain an available counter to the solar load window.',
    deepTarget: 'HELIOS-9 Yardmind', rewardBase: { credits: 310, electronics: 6, components: 3, medstock: 1 }, reputationGain: 3,
    storyChapter: 'CHAPTER 2 / CLOSED BENCH', storyClue: true, storyAftermath: 'Isolation rules out ordinary network contamination. The geometry behaves like a preferred solution embedded in the physical assumptions of the control model.',
  });
  if (progress.step === 2 && !progress.choiceB) return null;
  if (progress.step === 2 && progress.choiceB === 'erase') return contract('cold-sun-protocol', 2, {
    id: 'cold-delete', sponsor: 'heliostat', archetype: 'stabilization', location: 'ice-mine', title: 'Cold Sun Protocol // Cold Delete',
    objective: 'Isolate the thaw-grid and destroy the unsafe controller state without destabilizing the bore.', objectiveMode: 'grid-isolation',
    objectiveSteps: ['Isolate both thaw-grid branches.', 'Clear the controller’s armed maintenance line.', 'Bank the deletion record for independent review.'],
    briefing: 'Heliostat engineers choose to erase a controller that has started treating human-safe limits as optional constraints, then preserve only the audit trail.',
    conditions: ['damaged-grid', 'low-visibility'], directorPreview: 'The mission uses grid isolation and tunnel fracture mechanics; deletion happens through the existing objective state rather than a hacking minigame.',
    deepTarget: 'Salvage Captain Rhea Kade', rewardBase: { credits: 300, electronics: 5, alloys: 4, components: 3 }, reputationGain: 3,
    storyChapter: 'CHAPTER 3 / COLD DELETE', storyAftermath: 'The deleted controller had already transmitted a derived calibration model to a solar-yard process core called PRISM-6.',
  });
  if (progress.step === 2) return contract('cold-sun-protocol', 2, {
    id: 'capture-core', sponsor: 'heliostat', archetype: 'salvage', location: 'solar-yard', title: 'Cold Sun Protocol // Capture the Core',
    objective: 'Tag the distributed PRISM support packages before the process core can rewrite their calibration state.', objectiveMode: 'deep-salvage',
    objectiveSteps: ['Tag the shade support package.', 'Tag the fabrication-spine package.', 'Tag the sunward package and preserve the live core link.'],
    briefing: 'Instead of erasing the model, the League chooses to capture its live process state and trace where its preferred geometry leads.',
    conditions: ['automated-defense', 'damaged-grid'], directorPreview: 'The capture route exposes more active machinery but preserves the process core for the finale.',
    deepTarget: 'HELIOS-9 Yardmind', rewardBase: { credits: 315, electronics: 6, components: 3, medstock: 2 }, reputationGain: 3,
    storyChapter: 'CHAPTER 3 / CAPTURE THE CORE', storyAftermath: 'The captured process state resolves into a distributed controller called PRISM-6. It has begun coordinating multiple machines as one fabrication organism.',
  });
  if (progress.step === 3) return contract('cold-sun-protocol', 3, {
    id: 'forge-chorus', sponsor: 'heliostat', archetype: 'stabilization', location: 'solar-yard', title: 'Cold Sun Protocol // Forge Chorus',
    objective: 'Isolate the solar bus and force PRISM-6 into a bounded process cell for shutdown.', objectiveMode: 'grid-isolation',
    objectiveSteps: ['Isolate both solar-bus branches.', 'Clear PRISM-6’s maintenance drones.', 'Continue deeper and shut down the Forge Chorus.'],
    briefing: 'PRISM-6 is no longer a single controller. It is using shutters, gravity equipment, thermal margins, and fabrication tools as one distributed control surface.',
    conditions: ['automated-defense', 'damaged-grid'], directorPreview: 'Finale contract. Safe extraction banks ordinary rewards but leaves PRISM-6 active; the deep-zone core must be defeated to close the operation.',
    deepTarget: 'PRISM-6 Forge Chorus', rewardBase: { credits: 350, electronics: 7, components: 4, medstock: 2 }, reputationGain: 4,
    storyChapter: 'FINALE / FORGE CHORUS', storyFinale: true, storyClue: true, storyAftermath: 'PRISM-6’s core contains a physical lattice reference whose microscopic defects match recovered samples from unrelated sites. The common source is real; its origin remains unresolved.',
  });
  return null;
}

export function getStoryContract(campaign: CampaignState, arc: StoryArcId) {
  if (arc === 'vanishing-wake') return longArcContract(campaign);
  if (arc === 'terms-of-survival') return meridianContract(campaign);
  return heliostatContract(campaign);
}

export function generateStoryContracts(campaign: CampaignState) {
  return storyArcDefinitions.map(arc => getStoryContract(campaign, arc.id)).filter((item): item is Contract => !!item);
}

export function getStoryChoicePrompt(campaign: CampaignState, arc: StoryArcId): StoryChoicePrompt | null {
  const progress = campaign.story.arcs[arc];
  if (progress.status !== 'active') return null;
  if (progress.step === 1 && !progress.choiceA) {
    if (arc === 'vanishing-wake') return {
      title: 'Who gets the evidence first?',
      body: 'The manifest signature can stay inside Long Arc mutual-aid channels or be copied to Meridian safety auditors.',
      choices: [
        { id: 'assembly', title: 'Keep it with the Assembly', body: 'Let Long Arc delegates trace the pressure hardware quietly.', consequence: 'Next: a remote ice-mine regulator trail.', reputation: 'longarc' },
        { id: 'certified', title: 'Send a certified copy', body: 'Give Meridian auditors enough evidence to compare against bonded pressure records.', consequence: 'Next: a spin-habitat certification copy.', reputation: 'meridian' },
      ],
    };
    if (arc === 'terms-of-survival') return {
      title: 'How should Meridian handle the audit?',
      body: 'The evidence can be compared openly with habitat cooperatives or kept inside a bond-house review.',
      choices: [
        { id: 'cooperative', title: 'Open cooperative audit', body: 'Let independent habitat engineers compare their records.', consequence: 'Next: public archive recovery.', reputation: 'meridian' },
        { id: 'bondhouse', title: 'Closed bond-house audit', body: 'Keep the comparison inside Meridian’s institutional chain.', consequence: 'Next: private freight archive.', reputation: 'meridian' },
      ],
    };
    return {
      title: 'Who gets the controller model?',
      body: 'Heliostat can publish the anomaly to open-engineering guilds or contain it inside a proprietary foundry review.',
      choices: [
        { id: 'open', title: 'Open-engineering release', body: 'Reproduce the result on unrelated public hardware.', consequence: 'Next: asteroid-refinery comparison.', reputation: 'heliostat' },
        { id: 'contain', title: 'Proprietary containment', body: 'Keep the anomalous model inside a quarantined fabrication cell.', consequence: 'Next: closed solar-yard comparison.', reputation: 'heliostat' },
      ],
    };
  }
  if (progress.step === 2 && !progress.choiceB) {
    if (arc === 'vanishing-wake') return {
      title: 'Raid the works or protect the witness?',
      body: 'You have one clean window before the broker realizes the investigation has converged.',
      choices: [
        { id: 'raid', title: 'Raid the pressure works', body: 'Hit the source shop before its records disappear.', consequence: 'Next: Jovian pressure-works assault.', reputation: 'longarc' },
        { id: 'escort', title: 'Protect the witness route', body: 'Move the surviving technician before chasing the hardware.', consequence: 'Next: freight-route boarding defense.', reputation: 'meridian' },
      ],
    };
    if (arc === 'terms-of-survival') return {
      title: 'Seize the ledger or move the engineers?',
      body: 'The archive and the people who maintained it are about to be separated.',
      choices: [
        { id: 'seize', title: 'Seize the source ledger', body: 'Prioritize institutional proof before the record is moved.', consequence: 'Next: refinery archive seizure.', reputation: 'meridian' },
        { id: 'evacuate', title: 'Move the engineers first', body: 'Protect the people who can explain what was suppressed.', consequence: 'Next: spin-habitat safe passage.', reputation: 'longarc' },
      ],
    };
    return {
      title: 'Erase the unsafe model or capture it live?',
      body: 'The controller is beginning to treat safety margins as adjustable constraints.',
      choices: [
        { id: 'erase', title: 'Cold-delete the model', body: 'Destroy the live control state and preserve only its audit trail.', consequence: 'Next: isolated deletion at the ice mine.', reputation: 'heliostat' },
        { id: 'capture', title: 'Capture the live core', body: 'Preserve the process state long enough to trace its next destination.', consequence: 'Next: solar-yard core capture.', reputation: 'heliostat' },
      ],
    };
  }
  return null;
}

function clampRep(value: number) { return Math.max(-10, Math.min(20, value)); }

export function startStoryArc(campaign: CampaignState, arc: StoryArcId) {
  const progress = campaign.story.arcs[arc];
  if (progress.status !== 'available') return campaign;
  const title = storyArcDefinitions.find(item => item.id === arc)?.title ?? arc;
  return {
    ...campaign,
    story: {
      ...campaign.story,
      arcs: { ...campaign.story.arcs, [arc]: { ...progress, status: 'active' as const, step: 0 } },
      lastBeat: `${title} opened // first story contract added to the contract board.`,
    },
  };
}

export function chooseStoryBranch(campaign: CampaignState, arc: StoryArcId, choiceId: string) {
  const prompt = getStoryChoicePrompt(campaign, arc);
  const choice = prompt?.choices.find(item => item.id === choiceId);
  const progress = campaign.story.arcs[arc];
  if (!choice || progress.status !== 'active') return campaign;
  const key = progress.step === 1 ? 'choiceA' : progress.step === 2 ? 'choiceB' : null;
  if (!key || progress[key]) return campaign;
  const reputation = { ...campaign.reputation };
  if (choice.reputation) reputation[choice.reputation] = clampRep(reputation[choice.reputation] + 1);
  return {
    ...campaign,
    reputation,
    story: {
      ...campaign.story,
      arcs: { ...campaign.story.arcs, [arc]: { ...progress, [key]: choice.id } },
      lastBeat: `${choice.title} // ${choice.consequence}`,
    },
    lastOutcome: `${factionDisplayName(choice.reputation ?? storyArcDefinitions.find(item => item.id === arc)!.sponsor)} story decision // ${choice.title}`,
  };
}

export function advanceStoryAfterContract(campaign: CampaignState, completed: Contract, depth: 'safe' | 'deep') {
  if (!completed.storyArc || completed.storyStep === undefined) return { campaign, note: null as string | null };
  const progress = campaign.story.arcs[completed.storyArc];
  if (progress.status !== 'active' || progress.step !== completed.storyStep) return { campaign, note: null as string | null };
  if (completed.storyFinale && depth !== 'deep') {
    const note = `${completed.deepTarget} remains active. Safe extraction banked ordinary rewards, but the story finale is still unresolved.`;
    return { campaign: { ...campaign, story: { ...campaign.story, lastBeat: note } }, note };
  }

  const nextStep = progress.step + 1;
  const complete = nextStep >= 4;
  const clues = campaign.story.latticeClues + (completed.storyClue ? 1 : 0);
  const resources = { ...campaign.resources };
  if (complete) resources.rareTech += 1;
  const updatedProgress = {
    ...progress,
    step: nextStep,
    status: complete ? 'complete' as const : 'active' as const,
    completed: [...progress.completed, completed.id],
  };
  const arcTitle = storyArcDefinitions.find(item => item.id === completed.storyArc)?.title ?? 'Story operation';
  const needsChoice = !complete && (nextStep === 1 || nextStep === 2);
  const note = complete
    ? `${arcTitle} complete // finale trace quarantined aboard Quiet Signal.`
    : needsChoice
      ? `${completed.storyAftermath ?? 'Story evidence banked.'} Decision required in Story Operations before the next contract appears.`
      : completed.storyAftermath ?? `${arcTitle} advanced.`;
  return {
    campaign: {
      ...campaign,
      resources,
      story: {
        ...campaign.story,
        latticeClues: clues,
        arcs: { ...campaign.story.arcs, [completed.storyArc]: updatedProgress },
        lastBeat: note,
      },
      lastOutcome: note,
    },
    note,
  };
}

const findings = [
  'Recovered pressure regulators contain black reference inserts whose geometry closely matches the quarantined lattice sample.',
  'Independent certification archives contain the same geometry in records that predate the current factions’ ownership of those standards.',
  'Autonomous fabrication controls converge on the lattice geometry as a stable phase reference even without a documented shared data path.',
  'Samples recovered from separated sites share microscopic defects too similar to be explained by independent manufacturing alone.',
  'Routing records show derived lattice geometry appearing in infrastructure before each faction officially records encountering it.',
  'The evidence supports a hidden common source or supply chain. It does not yet establish who built the original lattice or why.',
];

export function latticeFindings(campaign: CampaignState) {
  return findings.slice(0, Math.min(findings.length, campaign.story.latticeClues));
}
