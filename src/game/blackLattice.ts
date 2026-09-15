import {
  factionDisplayName,
  type CampaignState,
  type ConditionId,
  type Contract,
  type ContractArchetype,
  type FactionId,
  type LocationId,
  type ObjectiveMode,
  type SalvageWallet,
} from './campaign';

export const blackLatticeChapter = {
  id: 'black-lattice' as const,
  title: 'The Black Lattice',
  subtitle: 'Campaign Chapter I // The earlier arrivals',
  totalContracts: 14,
  finale: 'Survey Custodian Veyra Senn',
  finaleLocation: 'Khepri Survey Annex',
};

type MissionSpec = {
  slug: string;
  sponsor: FactionId;
  archetype: ContractArchetype;
  location: LocationId;
  locationName: string;
  title: string;
  objectiveMode: ObjectiveMode;
  objective: string;
  objectiveSteps: string[];
  briefing: string;
  conditions: ConditionId[];
  directorPreview: string;
  deepTarget: string;
  rewardBase: Partial<SalvageWallet>;
  reputationGain: number;
  evidence?: string;
  aftermath: string;
  finale?: boolean;
};

export type BlackLatticeChoice = {
  id: string;
  title: string;
  body: string;
  consequence: string;
  reputation: FactionId;
};

export type BlackLatticeChoicePrompt = {
  title: string;
  body: string;
  choices: BlackLatticeChoice[];
};

const conditionLabels: Record<ConditionId, string> = {
  'unstable-pressure': 'Unstable pressure shell',
  'failing-gravity': 'Failing gravity control',
  'damaged-grid': 'Damaged electrical grid',
  'automated-defense': 'Automated defense remnants',
  'limited-atmosphere': 'Limited atmosphere',
  'low-visibility': 'Low visibility particulates',
};

function buildContract(step: number, spec: MissionSpec): Contract {
  return {
    id: `campaign-black-lattice-${step + 1}-${spec.slug}`,
    sponsor: spec.sponsor,
    archetype: spec.archetype,
    location: spec.location,
    locationName: spec.locationName,
    title: spec.title,
    objective: spec.objective,
    objectiveMode: spec.objectiveMode,
    objectiveSteps: spec.objectiveSteps,
    briefing: spec.briefing,
    conditions: spec.conditions,
    conditionLabels: spec.conditions.map(condition => conditionLabels[condition]),
    directorPreview: spec.directorPreview,
    deepTarget: spec.deepTarget,
    rewardBase: spec.rewardBase,
    reputationGain: spec.reputationGain,
    priority: false,
    anomalyOpportunity: false,
    seed: 0x4b48_4550 + step * 65537 + spec.slug.length * 7919,
    campaignChapter: 'black-lattice',
    campaignStep: step,
    campaignFinale: spec.finale,
    campaignEvidence: spec.evidence,
    campaignAftermath: spec.aftermath,
  };
}

function missionForStep(campaign: CampaignState, step: number): MissionSpec | null {
  const progress = campaign.story.blackLattice;
  if (step === 0) return {
    slug: 'trace-audit', sponsor: 'longarc', archetype: 'salvage', location: 'damaged-vessel', locationName: 'Damaged Freight Vessel',
    title: 'Black Lattice // Trace Audit', objectiveMode: 'deep-salvage', objective: 'Recover three sealed sample records from the vessel that carried Quiet Signal’s first quarantined trace.',
    objectiveSteps: ['Tag the sample custody case.', 'Tag the failed metrology package.', 'Tag the cargo-route survey archive and clear the deck.'],
    briefing: 'The first useful question is deliberately mundane: who measured the sample, with what equipment, and why do the archived dimensions exceed the calibration capability of the field tools listed on the manifest?',
    conditions: ['limited-atmosphere', 'unstable-pressure'], directorPreview: 'The damaged vessel remains a pressure-driven encounter. The recovered evidence is dimensional metrology, not a supernatural effect.',
    deepTarget: 'Salvage Interdictor Kade', rewardBase: { credits: 285, alloys: 4, electronics: 4, components: 2 }, reputationGain: 2,
    evidence: 'The first quarantined sample was measured to repeatable tolerances below the calibration floor of the field instruments listed on its recovery manifest.',
    aftermath: 'The trace was not merely cut cleanly. Someone characterized it with equipment that was never declared aboard the recovery vessel.',
  };
  if (step === 1) return {
    slug: 'tolerance-stack', sponsor: 'meridian', archetype: 'salvage', location: 'asteroid-refinery', locationName: 'Asteroid Refinery',
    title: 'Black Lattice // Tolerance Stack', objectiveMode: 'machinery-recovery', objective: 'Recover the fixture blocks used to compare lattice dimensions against ordinary industrial reference surfaces.',
    objectiveSteps: ['Tag the crusher metrology block.', 'Tag the reactor reference fixture.', 'Clear the refinery route without destroying the comparison hardware.'],
    briefing: 'Meridian engineers offer known-good pressure hardware as a reference. The lattice is compared against ordinary certified surfaces using independent fixtures rather than trusting the original measurements.',
    conditions: ['damaged-grid', 'failing-gravity'], directorPreview: 'Industrial machinery and gravity faults remain physical threats. The evidence comes from cross-checking measurement chains.',
    deepTarget: 'Foundry Marshal Cael', rewardBase: { credits: 300, alloys: 5, electronics: 4, components: 2 }, reputationGain: 2,
    evidence: 'Independent fixtures reproduce the sample geometry. Several reference faces are straighter than the certified comparison blocks across the measured span, despite visible handling damage.',
    aftermath: 'The impossible-looking tolerance survives a second measurement chain. It is now a materials problem, not a bad instrument report.',
  };
  if (step === 2) return {
    slug: 'cold-curve', sponsor: 'heliostat', archetype: 'stabilization', location: 'solar-yard', locationName: 'Solar-Orbit Fabrication Yard',
    title: 'Black Lattice // Cold Curve', objectiveMode: 'grid-isolation', objective: 'Isolate the solar test bus while Heliostat records a controlled thermal cycle on a quarantined fragment.',
    objectiveSteps: ['Isolate the shade-side test branch.', 'Isolate the sunward test branch.', 'Clear the yard and preserve the thermal log.'],
    briefing: 'Heliostat refuses to infer exotic physics from a cold sample. They heat one under a controlled load, measure the fixture instead of the lattice directly, and compare the result against ordinary ceramics and alloys.',
    conditions: ['damaged-grid', 'automated-defense'], directorPreview: 'Solar thermal load and grid hazards stay readable. The anomaly is a repeatable heat-flow mismatch, not unexplained damage or magic.',
    deepTarget: 'HELIOS-9 Yardmind', rewardBase: { credits: 310, electronics: 6, components: 3, medstock: 1 }, reputationGain: 2,
    evidence: 'During controlled heating, the lattice redistributes heat through the fixture faster than its measured bulk conductivity predicts, then returns to the same geometry after cooling.',
    aftermath: 'The sample is thermally unusual but stable. Nothing violates conservation in the measured system; the unanswered question is what internal structure is carrying the heat.',
  };
  if (step === 3) {
    if (!progress.choiceA) return null;
    if (progress.choiceA === 'joint-lab') return {
      slug: 'common-bench', sponsor: 'heliostat', archetype: 'salvage', location: 'orbital-station', locationName: 'Orbital Industrial Station',
      title: 'Black Lattice // Common Bench', objectiveMode: 'deep-salvage', objective: 'Recover three independent lab packages before the shared comparison station is stripped.',
      objectiveSteps: ['Tag the Meridian dimensional archive.', 'Tag the Heliostat thermal archive.', 'Tag the Long Arc custody log and clear the station.'],
      briefing: 'Quiet Signal places the same evidence in front of engineers from all three blocs. The important result is not consensus; it is that their independent records contain the same missing source references.',
      conditions: ['low-visibility', 'damaged-grid'], directorPreview: 'A broad boarding roster and ordinary station systems keep the fight conventional while the evidence chain widens.',
      deepTarget: 'Dock Warden Orison', rewardBase: { credits: 320, electronics: 5, alloys: 4, components: 2 }, reputationGain: 3,
      evidence: 'Three independent archives use different terminology but omit the same upstream source field when describing lattice-derived reference geometry.',
      aftermath: 'The omission is too consistent to be clerical drift. Different institutions inherited records that were already incomplete.',
    };
    return {
      slug: 'quiet-custody', sponsor: 'longarc', archetype: 'salvage', location: 'ice-mine', locationName: 'Subsurface Ice-Mining Installation',
      title: 'Black Lattice // Quiet Custody', objectiveMode: 'machinery-recovery', objective: 'Recover two isolated comparison packages without entering the samples into a faction laboratory registry.',
      objectiveSteps: ['Tag the cryobore metrology package.', 'Tag the isolated thermal package.', 'Clear the tunnel and return the records to Quiet Signal.'],
      briefing: 'Long Arc argues that every formal lab will create a trail for whoever has been steering recovery crews. The comparison is repeated in an isolated mine with off-network instruments.',
      conditions: ['low-visibility', 'failing-gravity'], directorPreview: 'The bore can fracture and open lanes. The branch changes evidence custody, not simulation rules.',
      deepTarget: 'Salvage Captain Rhea Kade', rewardBase: { credits: 315, alloys: 5, electronics: 4, components: 2 }, reputationGain: 3,
      evidence: 'Off-network instruments reproduce the same dimensional and thermal behavior, ruling out a shared faction database or remote calibration update as the simple explanation.',
      aftermath: 'Keeping the test quiet does not make the anomaly disappear. It does make the next lead easier to follow without announcing Quiet Signal’s interest.',
    };
  }
  if (step === 4) return {
    slug: 'survey-ghost', sponsor: 'meridian', archetype: 'boarding', location: 'spin-habitat', locationName: 'Rotating Spin Habitat',
    title: 'Black Lattice // Survey Ghost', objectiveMode: 'emergency-boarding', objective: 'Open the archival pressure route and recover a habitat survey copy that predates the current registry.',
    objectiveSteps: ['Cycle the spoke archive interlock.', 'Cycle the axis archive lock.', 'Clear the ring and bank the historical survey copy.'],
    briefing: 'A habitat cooperative finds a survey reference to a non-reflective structural seam decades before any faction admits seeing lattice material. The original file has been repeatedly re-dated.',
    conditions: ['failing-gravity', 'damaged-grid'], directorPreview: 'Emergency spindown remains the habitat’s defining problem. The mystery is the survey history, not the gravity behavior.',
    deepTarget: 'Recovery Commander Sable Voss', rewardBase: { credits: 325, alloys: 4, electronics: 5, medstock: 2 }, reputationGain: 3,
    evidence: 'A habitat survey describes a lattice-like seam before the station’s present registry begins; later copies shift the discovery date forward without changing the underlying geometry.',
    aftermath: 'Someone did not merely lose an old file. The chronology was edited while the technical content was preserved.',
  };
  if (step === 5) return {
    slug: 'before-registry', sponsor: 'longarc', archetype: 'boarding', location: 'jovian-harvester', locationName: 'Jovian Gas-Harvester Platform',
    title: 'Black Lattice // Before the Registry', objectiveMode: 'emergency-boarding', objective: 'Reopen the stormline archive route and recover pre-registry tug movement records.',
    objectiveSteps: ['Cycle the inner storm lock.', 'Cycle the outer maintenance lock.', 'Clear the crown and recover the tug ledger.'],
    briefing: 'A Jovian platform inherited navigation records from an older service tug. Several entries reference “black reference stock” being moved before the platform’s own construction contract existed.',
    conditions: ['unstable-pressure', 'limited-atmosphere'], directorPreview: 'Storm shear can still open a violent pressure vector. The recovered ledger links the anomaly to logistics, not just science.',
    deepTarget: 'Stormline Foreman Ilex', rewardBase: { credits: 335, alloys: 5, electronics: 4, components: 2 }, reputationGain: 3,
    evidence: 'Pre-registry tug logs use a euphemism—black reference stock—for cargo moved between survey sites before those sites appear in modern discovery records.',
    aftermath: 'The lattice was being transported, or at least discussed as transportable material, before today’s official history begins.',
  };
  if (step === 6) return {
    slug: 'orpheline-crosscheck', sponsor: 'heliostat', archetype: 'salvage', location: 'ice-mine', locationName: 'Subsurface Ice-Mining Installation',
    title: 'Black Lattice // Orpheline Crosscheck', objectiveMode: 'deep-salvage', objective: 'Recover three unregistered transit records tied to the abandoned Orpheline habitat route.',
    objectiveSteps: ['Tag the access-bore transit log.', 'Tag the extraction-tunnel custody log.', 'Tag the deep-vault manifest and clear the mine.'],
    briefing: 'The Orpheline records include arrivals by a recovery team that uses no faction identity, only a repeating service code and a habit of reaching anomalous sites before public survey crews.',
    conditions: ['low-visibility', 'damaged-grid'], directorPreview: 'Tunnel collapse and tactical specialists remain normal combat problems. The important discovery is a repeatable pre-arrival service code.',
    deepTarget: 'Salvage Captain Rhea Kade', rewardBase: { credits: 345, electronics: 5, alloys: 5, components: 3 }, reputationGain: 3,
    evidence: 'Unregistered transit ledgers contain the same blank-sponsor recovery code at multiple anomalous sites, consistently dated before public discovery teams arrive.',
    aftermath: 'For the first time, the evidence points to people or machines moving between sites rather than merely inherited bad records.',
  };
  if (step === 7) {
    if (!progress.choiceB) return null;
    if (progress.choiceB === 'ledger') return {
      slug: 'bonded-manifest', sponsor: 'meridian', archetype: 'boarding', location: 'damaged-vessel', locationName: 'Damaged Freight Vessel',
      title: 'Black Lattice // Bonded Manifest', objectiveMode: 'grid-isolation', objective: 'Isolate the freight control grid and recover the bonded tug manifest behind the blank recovery code.',
      objectiveSteps: ['Isolate both cargo-control branches.', 'Clear the bonded recovery line.', 'Bank the tug ownership mirror.'],
      briefing: 'Meridian follows insurance history instead of physics. The blank service code resolves to a chain of shell operators that repeatedly buy distressed survey hardware immediately before anomaly reports disappear.',
      conditions: ['damaged-grid', 'limited-atmosphere'], directorPreview: 'The vessel remains pressure-limited. The branch follows financial custody rather than thermal traces.',
      deepTarget: 'Reactor Custodian Ansel', rewardBase: { credits: 355, alloys: 4, electronics: 6, medstock: 2 }, reputationGain: 3,
      evidence: 'Bonded manifests tie the blank recovery code to rotating shell operators that acquire survey equipment shortly before lattice-site records are amended or withdrawn.',
      aftermath: 'The pre-arrival team has a logistics budget and a legal footprint designed to evaporate after each recovery.',
    };
    return {
      slug: 'thermal-wake', sponsor: 'heliostat', archetype: 'stabilization', location: 'solar-yard', locationName: 'Solar-Orbit Fabrication Yard',
      title: 'Black Lattice // Thermal Wake', objectiveMode: 'grid-isolation', objective: 'Isolate the sensor bus and recover thermal tracks from the unidentified recovery tug.',
      objectiveSteps: ['Isolate the shade sensor branch.', 'Isolate the sunward sensor branch.', 'Clear the yard and preserve the thermal track solution.'],
      briefing: 'Heliostat ignores the paperwork and follows waste heat. A tug with the blank service code uses an unusually disciplined radiator schedule that can be correlated across archived survey images.',
      conditions: ['damaged-grid', 'automated-defense'], directorPreview: 'Solar heat remains a combat variable. The branch turns archived thermal behavior into a route map.',
      deepTarget: 'HELIOS-9 Yardmind', rewardBase: { credits: 350, electronics: 7, components: 3 }, reputationGain: 3,
      evidence: 'Archived thermal imagery links the blank recovery code to a recurring tug profile whose radiator schedule appears near several lattice sites before official surveys.',
      aftermath: 'The recovery network can change paperwork more easily than it can change thermodynamics. Quiet Signal now has a route to follow.',
    };
  }
  if (step === 8) return {
    slug: 'dead-relay', sponsor: 'longarc', archetype: 'stabilization', location: 'orbital-station', locationName: 'Orbital Industrial Station',
    title: 'Black Lattice // Dead Relay', objectiveMode: 'grid-isolation', objective: 'Restore enough of an abandoned relay to recover its arrival-beacon queue without reactivating the entire defense grid.',
    objectiveSteps: ['Isolate the damaged relay branch.', 'Isolate the defense branch.', 'Clear the station and bank the arrival queue.'],
    briefing: 'A dead relay on the recovery route still holds unsent service acknowledgements. Several are addressed to the blank recovery code days before local crews report finding anything unusual.',
    conditions: ['damaged-grid', 'automated-defense'], directorPreview: 'Grid isolation can prevent the scheduled arc cascade. The relay data provides timing, not prophecy.',
    deepTarget: 'Dock Warden Orison', rewardBase: { credits: 360, electronics: 6, alloys: 4, components: 3 }, reputationGain: 3,
    evidence: 'A dead relay queued service acknowledgements for the recovery network days before local anomaly reports, proving the network expected something to be found at those coordinates.',
    aftermath: 'The pattern is no longer “someone cleans up quickly.” Someone knows where to be before the public discovery occurs.',
  };
  if (step === 9) return {
    slug: 'same-hands', sponsor: 'heliostat', archetype: 'salvage', location: 'asteroid-refinery', locationName: 'Asteroid Refinery',
    title: 'Black Lattice // Same Hands', objectiveMode: 'machinery-recovery', objective: 'Recover two fixture jaws carrying tool marks from separate lattice recoveries.',
    objectiveSteps: ['Tag the archive fixture jaw.', 'Tag the recovered survey clamp.', 'Clear the refinery without destroying the comparison surfaces.'],
    briefing: 'Two pieces of ordinary handling hardware from unrelated sites show the same fixture geometry and repair habits. The lattice samples differ; the people handling them do not.',
    conditions: ['damaged-grid', 'failing-gravity'], directorPreview: 'The refinery remains machinery-heavy. This mission establishes a common recovery practice across sites.',
    deepTarget: 'Foundry Marshal Cael', rewardBase: { credits: 370, alloys: 6, electronics: 5, components: 3 }, reputationGain: 3,
    evidence: 'Handling fixtures from separate sites share the same custom jaw geometry, field repairs, and inspection marks, consistent with one recurring recovery organization.',
    aftermath: 'The recovery network is organized enough to standardize its tools across multiple sites and careful enough to erase its name.',
  };
  if (step === 10) {
    if (!progress.choiceC) return null;
    if (progress.choiceC === 'publish') return {
      slug: 'open-dossier', sponsor: 'meridian', archetype: 'boarding', location: 'spin-habitat', locationName: 'Rotating Spin Habitat',
      title: 'Black Lattice // Open Dossier', objectiveMode: 'emergency-boarding', objective: 'Keep the public evidence route open long enough to mirror the pre-arrival pattern across faction archives.',
      objectiveSteps: ['Cycle the spoke archive interlock.', 'Cycle the axis archive lock.', 'Clear the ring while the dossier mirror completes.'],
      briefing: 'Quiet Signal publishes the arrival pattern to multiple engineering and safety groups. The response is immediate: three old records surface that were previously considered unrelated survey errors.',
      conditions: ['failing-gravity', 'automated-defense'], directorPreview: 'The choice changes political custody. The ring still behaves like a physical spin habitat.',
      deepTarget: 'Recovery Commander Sable Voss', rewardBase: { credits: 380, alloys: 5, electronics: 6, medstock: 2 }, reputationGain: 4,
      evidence: 'Independent public archives reveal three additional pre-arrival references once investigators know which service-code pattern to search for.',
      aftermath: 'Publishing the pattern makes suppression harder, but whoever operates the recovery network now knows Quiet Signal has connected the sites.',
    };
    return {
      slug: 'sealed-dossier', sponsor: 'longarc', archetype: 'salvage', location: 'jovian-harvester', locationName: 'Jovian Gas-Harvester Platform',
      title: 'Black Lattice // Sealed Dossier', objectiveMode: 'deep-salvage', objective: 'Recover three isolated route fragments without broadcasting the combined pre-arrival map.',
      objectiveSteps: ['Tag the intake route fragment.', 'Tag the separator route fragment.', 'Tag the crown route fragment and clear the platform.'],
      briefing: 'Quiet Signal keeps the full pattern compartmentalized and asks remote operators for fragments rather than explaining what the fragments form. The resulting route points toward a survey annex missing from current charts.',
      conditions: ['unstable-pressure', 'low-visibility'], directorPreview: 'Storm pressure remains the major physical risk. Compartmentalization reduces political exposure but narrows outside help.',
      deepTarget: 'Stormline Foreman Ilex', rewardBase: { credits: 380, alloys: 6, electronics: 5, components: 3 }, reputationGain: 4,
      evidence: 'Compartmentalized route fragments independently converge on a survey annex whose identifier survives only in maintenance ephemera: KHEPRI.',
      aftermath: 'The recovery network may not know Quiet Signal has the complete route. The route ends at Khepri Survey Annex.',
    };
  }
  if (step === 11) return {
    slug: 'khepri-coordinates', sponsor: 'heliostat', archetype: 'salvage', location: 'damaged-vessel', locationName: 'Damaged Freight Vessel',
    title: 'Black Lattice // Khepri Coordinates', objectiveMode: 'deep-salvage', objective: 'Recover three obsolete navigation packages containing the last independent references to Khepri Survey Annex.',
    objectiveSteps: ['Tag the pre-registry navigation core.', 'Tag the tug ephemeris package.', 'Tag the survey beacon archive and clear the vessel.'],
    briefing: 'The final cross-check uses dead-reckoning data rather than modern charts. Three unrelated navigation packages agree on an asteroid-shadow facility that current traffic systems insist does not exist.',
    conditions: ['limited-atmosphere', 'damaged-grid'], directorPreview: 'The route confirmation is ordinary orbital navigation. Once banked, Khepri becomes a deployable campaign location.',
    deepTarget: 'Salvage Interdictor Kade', rewardBase: { credits: 400, electronics: 7, alloys: 5, components: 3 }, reputationGain: 4,
    evidence: 'Independent dead-reckoning archives converge on Khepri Survey Annex, a facility removed from modern traffic charts but still used as a waypoint by the pre-arrival recovery network.',
    aftermath: 'Quiet Signal has a physical destination. The next contract leaves the known seven-location rotation.',
  };
  if (step === 12) return {
    slug: 'reference-gallery', sponsor: 'meridian', archetype: 'salvage', location: 'lattice-annex', locationName: 'Khepri Survey Annex',
    title: 'Black Lattice // Reference Gallery', objectiveMode: 'deep-salvage', objective: 'Tag three metrology archives inside Khepri and establish whether the annex was abandoned or merely hidden.',
    objectiveSteps: ['Tag the cold-ring archive.', 'Tag the reference-gallery archive.', 'Tag the sample-vault custody record and clear the annex.'],
    briefing: 'Khepri is mechanically alive, thermally quiet, and absent from current traffic control. Its precision galleries contain ordinary human metrology equipment built around black-lattice reference samples.',
    conditions: ['low-visibility', 'damaged-grid'], directorPreview: 'NEW LOCATION // calibration mass shifts change low-g handling and reference shutters reindex firing lanes. No paranormal mechanics are introduced.',
    deepTarget: 'Khepri Recovery Marshal', rewardBase: { credits: 440, alloys: 6, electronics: 8, components: 4, medstock: 2 }, reputationGain: 4,
    evidence: 'Khepri stores modern sample trays with recent removal dates beside archive labels older than the current factions, proving the site is old but still being serviced.',
    aftermath: 'The annex was never simply abandoned. Someone has been returning to remove selected samples and maintain the measurement infrastructure.',
  };
  if (step === 13) return {
    slug: 'earlier-arrival', sponsor: 'longarc', archetype: 'boarding', location: 'lattice-annex', locationName: 'Khepri Survey Annex',
    title: 'Black Lattice // The Earlier Arrival', objectiveMode: 'grid-isolation', objective: 'Isolate Khepri’s archive branches, clear the recovery line, and confront the custodian protecting the sample-vault index.',
    objectiveSteps: ['Isolate both archive power branches.', 'Break the Khepri recovery line.', 'Continue into the deep vault and defeat Survey Custodian Veyra Senn.'],
    briefing: 'The active recovery crew is already pulling sample indexes when Quiet Signal returns. Their chief, Veyra Senn, is defending a metrology vault whose records identify repeated recoveries but omit the network’s client and the lattice’s origin.',
    conditions: ['damaged-grid', 'failing-gravity', 'automated-defense'], directorPreview: 'CAMPAIGN FINALE // reference pylons reduce Senn’s exposure until destroyed or disrupted. Precision survey sweeps, magnetic locks, and archive-purge shutters use visible Vector systems.',
    deepTarget: 'Survey Custodian Veyra Senn', rewardBase: { credits: 560, alloys: 8, electronics: 10, medstock: 3, components: 6 }, reputationGain: 5,
    evidence: 'Senn’s archive proves an organized recovery network has visited lattice sites ahead of public discovery for years. Its records deliberately omit both the network’s client and any origin record for the lattice itself.',
    aftermath: 'The earlier arrivals are real, organized, and still active. Khepri does not reveal who pays them, who built the original lattice, or why the oldest survey records already knew where to look.',
    finale: true,
  };
  return null;
}

export function blackLatticeUnlocked(campaign: CampaignState) {
  return campaign.anomalyRecovered || campaign.resources.rareTech > 0 || campaign.story.latticeClues > 0;
}

export function startBlackLatticeChapter(campaign: CampaignState) {
  const progress = campaign.story.blackLattice;
  if (progress.status === 'active' || progress.status === 'complete' || !blackLatticeUnlocked(campaign)) return campaign;
  const lastBeat = 'The Black Lattice opened // Trace Audit added to the contract board.';
  return {
    ...campaign,
    story: {
      ...campaign.story,
      blackLattice: { ...progress, status: 'active' as const, step: 0, lastBeat },
      lastBeat,
    },
    lastOutcome: lastBeat,
  };
}

export function getBlackLatticeChoicePrompt(campaign: CampaignState): BlackLatticeChoicePrompt | null {
  const progress = campaign.story.blackLattice;
  if (progress.status !== 'active') return null;
  if (progress.step === 3 && !progress.choiceA) return {
    title: 'Who should hold the first complete comparison?',
    body: 'The dimensional and thermal results can be compared openly across faction laboratories or kept on isolated Long Arc hardware while Quiet Signal follows the chain quietly.',
    choices: [
      { id: 'joint-lab', title: 'Run a joint comparison', body: 'Put independent Meridian, Heliostat and Long Arc records on one bench.', consequence: 'Next: Common Bench at the orbital station.', reputation: 'heliostat' },
      { id: 'quiet-custody', title: 'Keep custody quiet', body: 'Repeat the comparison off-network and avoid creating a formal sample trail.', consequence: 'Next: Quiet Custody at the ice mine.', reputation: 'longarc' },
    ],
  };
  if (progress.step === 7 && !progress.choiceB) return {
    title: 'Follow the paperwork or the waste heat?',
    body: 'The blank recovery code can be attacked through bonded logistics records or by tracing the tug’s thermal behavior across archived imagery.',
    choices: [
      { id: 'ledger', title: 'Follow the bonded manifest', body: 'Use Meridian insurance history to identify shell operators.', consequence: 'Next: Bonded Manifest.', reputation: 'meridian' },
      { id: 'thermal', title: 'Follow the thermal wake', body: 'Use Heliostat sensor archives to track the tug without trusting its paperwork.', consequence: 'Next: Thermal Wake.', reputation: 'heliostat' },
    ],
  };
  if (progress.step === 10 && !progress.choiceC) return {
    title: 'Publish the pre-arrival pattern?',
    body: 'Quiet Signal can mirror the evidence across multiple institutions, making it harder to suppress, or keep the complete route compartmentalized to preserve surprise.',
    choices: [
      { id: 'publish', title: 'Publish the pattern', body: 'Distribute the service-code pattern and invite independent archives to search for it.', consequence: 'Next: Open Dossier.', reputation: 'meridian' },
      { id: 'contain', title: 'Keep the route compartmentalized', body: 'Ask remote operators only for fragments and keep the combined map aboard Quiet Signal.', consequence: 'Next: Sealed Dossier.', reputation: 'longarc' },
    ],
  };
  return null;
}

function clampRep(value: number) {
  return Math.max(-10, Math.min(20, value));
}

export function chooseBlackLatticeBranch(campaign: CampaignState, choiceId: string) {
  const prompt = getBlackLatticeChoicePrompt(campaign);
  const choice = prompt?.choices.find(item => item.id === choiceId);
  const progress = campaign.story.blackLattice;
  if (!choice || progress.status !== 'active') return campaign;
  const key = progress.step === 3 ? 'choiceA' : progress.step === 7 ? 'choiceB' : progress.step === 10 ? 'choiceC' : null;
  if (!key || progress[key]) return campaign;
  const reputation = { ...campaign.reputation, [choice.reputation]: clampRep(campaign.reputation[choice.reputation] + 1) };
  const lastBeat = `${choice.title} // ${choice.consequence}`;
  return {
    ...campaign,
    reputation,
    story: {
      ...campaign.story,
      blackLattice: { ...progress, [key]: choice.id, lastBeat },
      lastBeat,
    },
    lastOutcome: `${factionDisplayName(choice.reputation)} campaign decision // ${choice.title}`,
  };
}

export function getBlackLatticeContract(campaign: CampaignState) {
  const progress = campaign.story.blackLattice;
  if (progress.status !== 'active' || getBlackLatticeChoicePrompt(campaign)) return null;
  const spec = missionForStep(campaign, progress.step);
  return spec ? buildContract(progress.step, spec) : null;
}

export function advanceBlackLatticeAfterContract(campaign: CampaignState, completed: Contract, depth: 'safe' | 'deep') {
  if (completed.campaignChapter !== 'black-lattice' || completed.campaignStep === undefined) return { campaign, note: null as string | null };
  const progress = campaign.story.blackLattice;
  if (progress.status !== 'active' || progress.step !== completed.campaignStep) return { campaign, note: null as string | null };
  if (completed.campaignFinale && depth !== 'deep') {
    const note = `${completed.deepTarget} still controls the Khepri sample index. Safe extraction banked ordinary rewards, but the campaign finale remains unresolved.`;
    return { campaign: { ...campaign, story: { ...campaign.story, blackLattice: { ...progress, lastBeat: note }, lastBeat: note }, lastOutcome: note }, note };
  }

  const evidence = completed.campaignEvidence && !progress.evidence.includes(completed.campaignEvidence)
    ? [...progress.evidence, completed.campaignEvidence]
    : progress.evidence;
  const nextStep = progress.step + 1;
  const complete = nextStep >= blackLatticeChapter.totalContracts;
  const resources = { ...campaign.resources };
  if (complete) resources.rareTech += 2;
  const needsDecision = !complete && [3, 7, 10].includes(nextStep);
  const note = complete
    ? 'THE BLACK LATTICE // CHAPTER I COMPLETE // Khepri confirms the earlier-arrival recovery network. +2 quarantined traces banked. Client, origin and purpose remain unresolved.'
    : needsDecision
      ? `${completed.campaignAftermath ?? 'Campaign evidence banked.'} Investigation decision required before the next chapter contract appears.`
      : completed.campaignAftermath ?? 'Black Lattice investigation advanced.';
  const updated = {
    ...progress,
    status: complete ? 'complete' as const : 'active' as const,
    step: nextStep,
    completed: [...progress.completed, completed.id],
    evidence,
    lastBeat: note,
  };
  return {
    campaign: {
      ...campaign,
      resources,
      story: { ...campaign.story, blackLattice: updated, lastBeat: note },
      lastOutcome: note,
    },
    note,
  };
}

export function blackLatticeEvidence(campaign: CampaignState) {
  return campaign.story.blackLattice.evidence;
}
