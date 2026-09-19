import { conditionLabel, factionDisplayName, missionObjectiveFor, type CampaignState, type Contract, type FactionId, type LocationId, type ObjectiveMode } from './campaign';

export const parallaxDebtChapter = {
  id: 'parallax-debt',
  title: 'Parallax Debt',
  totalContracts: 12,
  authoredContracts: 9,
  openingContracts: 3,
} as const;

type MissionSpec = {
  title: string;
  location: LocationId;
  sponsor: FactionId;
  mode: ObjectiveMode;
  briefing: string;
  conditions: Contract['conditions'];
  deepTarget: string;
  evidence: string;
  aftermath: string;
  minimumLevel: number;
  phaseFinale?: boolean;
};

const missions: MissionSpec[] = [
  {
    title: 'Parallax Debt // Baseline Zero',
    location: 'parallax-array',
    sponsor: 'heliostat',
    mode: 'reference-alignment',
    briefing: 'Interdiction records use a navigation reference offset from every published cislunar ephemeris. A decommissioned long-baseline array still carries the same offset in cold storage. Align its three physical references and recover the comparison without assuming who authored the false baseline.',
    conditions: ['failing-gravity', 'low-visibility'],
    deepTarget: 'Array Security Curator Ilyan Roe',
    evidence: 'baseline-offset',
    aftermath: 'All three physical references converge on the same offset. The discrepancy is deliberate and repeatable, but it still does not identify a client, cargo, or origin.',
    minimumLevel: 15,
  },
  {
    title: 'Parallax Debt // Return Vector',
    location: 'momentum-exchange',
    sponsor: 'meridian',
    mode: 'momentum-capture',
    briefing: 'Quiet Signal can now compare the array offset against live countermass bookkeeping. Capture both transfer references during a scheduled hidden-cadence window and test whether the missing momentum follows the same false baseline.',
    conditions: ['failing-gravity', 'automated-defense'],
    deepTarget: 'Countermass Survey Auditor Tessa Orr',
    evidence: 'return-vector',
    aftermath: 'The missing countermass closes only when the array offset is applied. The hidden route is navigating against a private reference rather than merely hiding paperwork.',
    minimumLevel: 15,
  },
  {
    title: 'Parallax Debt // Blind Meridian',
    location: 'parallax-array',
    sponsor: 'longarc',
    mode: 'reference-alignment',
    briefing: 'A second alignment reveals that one reference pylon is being corrected in real time by an operator still using the supposedly retired array. Align the baseline under load, break the control network, and recover the physical reference ledger.',
    conditions: ['failing-gravity', 'damaged-grid'],
    deepTarget: 'Baseline Keeper Sera Nox',
    evidence: 'blind-meridian',
    aftermath: 'The recovered ledger proves the private baseline is actively maintained through ordinary human navigation hardware. The next usable route reconstruction needs a stronger operator model and opens at LV16.',
    minimumLevel: 15,
    phaseFinale: true,
  },
  {
    title: 'Parallax Debt // Kepler Wake',
    location: 'damaged-vessel',
    sponsor: 'heliostat',
    mode: 'deep-salvage',
    briefing: 'A courier hull recovered near the false baseline carried no declared navigation package, yet its emergency recorder retained a star-fix solution that only closes inside the private frame. Recover the recorder before the vessel loses pressure and compare the fix against the Parallax ledger.',
    conditions: ['limited-atmosphere', 'low-visibility'],
    deepTarget: 'Navigation Archivist Dema Vale',
    evidence: 'kepler-wake',
    aftermath: 'The courier recorder confirms that ordinary civilian guidance hardware can be made to navigate the private frame without exposing the correction to the crew.',
    minimumLevel: 16,
  },
  {
    title: 'Parallax Debt // Ledger of Least Action',
    location: 'asteroid-refinery',
    sponsor: 'meridian',
    mode: 'machinery-recovery',
    briefing: 'The courier correction was serviced through a refinery maintenance account that should only cover mass-balance equipment. Restore the interrupted machinery log, trace the calibration invoices, and determine whether navigation corrections are being hidden inside routine industrial service.',
    conditions: ['damaged-grid', 'automated-defense'],
    deepTarget: 'Calibration Comptroller Ossa Pell',
    evidence: 'service-ledger',
    aftermath: 'Calibration invoices show repeated reference corrections billed as ordinary mass-balance work. The route is being maintained through boring industrial contracts instead of a dedicated clandestine network.',
    minimumLevel: 16,
  },
  {
    title: 'Parallax Debt // Residual Frame',
    location: 'parallax-array',
    sponsor: 'longarc',
    mode: 'reference-alignment',
    briefing: 'Three maintenance corrections now disagree by fractions small enough to look like sensor drift. Align the array against all three records under active shear and identify which correction schedule survives physical measurement.',
    conditions: ['failing-gravity', 'damaged-grid'],
    deepTarget: 'Reference Broker Veyla Rook',
    evidence: 'residual-frame',
    aftermath: 'One correction schedule survives every physical cross-check and repeats on a predictable service cadence. Following it safely requires LV17 combat calibration because the next sites are actively defended.',
    minimumLevel: 16,
  },
  {
    title: 'Parallax Debt // Null Transit',
    location: 'lattice-annex',
    sponsor: 'heliostat',
    mode: 'grid-isolation',
    briefing: 'The service cadence terminates inside a geometry lab that officially has no navigation role. Isolate the grid segments feeding the hidden correction stack and recover the timing buffer without contaminating the annex evidence chain.',
    conditions: ['damaged-grid', 'low-visibility'],
    deepTarget: 'Geometry Service Warden Hale Sorn',
    evidence: 'null-transit',
    aftermath: 'The timing buffer shows the correction stack is not forecasting a hypothetical path. It is servicing moving traffic on a live schedule.',
    minimumLevel: 17,
  },
  {
    title: 'Parallax Debt // Counterfactual Burn',
    location: 'momentum-exchange',
    sponsor: 'meridian',
    mode: 'momentum-capture',
    briefing: 'A transfer window exists in the private frame but not in public traffic control. Capture the countermass state before and after the window and test whether an unlisted vehicle can be inferred from the physical momentum debt alone.',
    conditions: ['failing-gravity', 'automated-defense'],
    deepTarget: 'Transfer Reconciler Niko Tern',
    evidence: 'counterfactual-burn',
    aftermath: 'Momentum debt proves an unlisted vehicle crossed the exchange on the private schedule. Quiet Signal can now bound the route in space and time, but not identify the cargo or client.',
    minimumLevel: 17,
  },
  {
    title: 'Parallax Debt // False Horizon',
    location: 'parallax-array',
    sponsor: 'longarc',
    mode: 'reference-alignment',
    briefing: 'The bounded route crosses the Parallax Array during a narrow reference-shear window. At LV18, hold the three baselines through the live transit and recover the correction delta before the passing vehicle clears the measurement envelope.',
    conditions: ['failing-gravity', 'automated-defense'],
    deepTarget: 'Reference Executor Kael Venn',
    evidence: 'false-horizon',
    aftermath: 'The live transit is physically confirmed. Parallax Debt now has nine banked operations and a bounded active route; the campaign still needs a player decision about how to expose or exploit that route before the final branch is authored.',
    minimumLevel: 18,
  },
];

function buildContract(campaign: CampaignState, step: number, spec: MissionSpec): Contract {
  const objective = missionObjectiveFor(spec.mode, spec.location);
  const locationName = spec.location === 'parallax-array'
    ? 'Cislunar Parallax Array'
    : spec.location === 'momentum-exchange'
      ? 'Cislunar Momentum Exchange'
      : spec.location === 'lattice-annex'
        ? 'Lattice Annex'
        : spec.location === 'damaged-vessel'
          ? 'Damaged Courier Hull'
          : spec.location === 'asteroid-refinery'
            ? 'Asteroid Refinery'
            : spec.location;

  return {
    id: `parallax-debt-${step}`,
    sponsor: spec.sponsor,
    archetype: spec.mode === 'momentum-capture' || spec.mode === 'grid-isolation' ? 'stabilization' : spec.mode === 'deep-salvage' ? 'boarding' : 'salvage',
    location: spec.location,
    locationName,
    title: spec.title,
    objective: objective.objective,
    objectiveMode: objective.mode,
    objectiveSteps: objective.steps,
    briefing: spec.briefing,
    conditions: spec.conditions,
    conditionLabels: spec.conditions.map(condition => conditionLabel[condition]),
    directorPreview: spec.location === 'parallax-array'
      ? 'PARALLAX ECOLOGY // reference shear reverses local gravity vectors; specialist units exploit the moving baseline. Aligning pylons collapses active shear fields.'
      : 'PARALLAX CROSSCHECK // each operation converts the private reference into a different physical record: navigation, machinery, geometry, or momentum.',
    deepTarget: spec.deepTarget,
    rewardBase: spec.location === 'parallax-array'
      ? { credits: 390 + step * 25, alloys: 4 + Math.floor(step / 4), electronics: 7, components: 3 + Math.floor(step / 3) }
      : { credits: 370 + step * 24, alloys: 4, electronics: 6 + Math.floor(step / 3), components: 3 + Math.floor(step / 4) },
    reputationGain: 4 + Math.floor(step / 4),
    priority: true,
    anomalyOpportunity: false,
    seed: 0x9a1100 + step * 196613 + campaign.contractsCompleted * 17,
    campaignChapter: 'parallax-debt',
    campaignStep: step,
    campaignFinale: !!spec.phaseFinale,
    campaignEvidence: spec.evidence,
    campaignAftermath: spec.aftermath,
    encounterPattern: spec.phaseFinale || step >= 6 ? 'elite-led' : step % 3 === 1 ? 'mixed' : 'swarm',
    reserveCount: step >= 3 ? 2 : 1,
  };
}

function reopenLegacyOpeningCompletion(campaign: CampaignState) {
  const progress = campaign.story.parallaxDebt;
  const isLegacyOpeningCompletion = progress.status === 'complete'
    && progress.step === parallaxDebtChapter.openingContracts
    && progress.completed.length === parallaxDebtChapter.openingContracts;
  if (!isLegacyOpeningCompletion) return campaign;

  const lastBeat = 'PARALLAX DEBT CONTINUES // the old three-contract opening is now the first phase of the LV15–18 campaign. Reach LV16 to reconstruct the route beyond Blind Meridian.';
  return {
    ...campaign,
    story: {
      ...campaign.story,
      parallaxDebt: { ...progress, status: 'active' as const, lastBeat },
      lastBeat,
    },
    lastOutcome: lastBeat,
  };
}

export function syncParallaxDebtAccess(campaign: CampaignState, operatorLevel: number) {
  const migrated = reopenLegacyOpeningCompletion(campaign);
  const progress = migrated.story.parallaxDebt;
  if (progress.status !== 'locked' || operatorLevel < 15 || migrated.story.interdiction.status !== 'complete') return migrated;
  const lastBeat = 'PARALLAX DEBT OPENED // LV15 long-baseline analysis found a repeatable navigation offset in the Interdiction custody route.';
  return {
    ...migrated,
    story: {
      ...migrated.story,
      parallaxDebt: { ...progress, status: 'active' as const, step: 0, lastBeat },
      lastBeat,
    },
    lastOutcome: lastBeat,
  };
}

export function parallaxDebtNextRequiredLevel(campaign: CampaignState) {
  const progress = campaign.story.parallaxDebt;
  if (progress.status !== 'active') return null;
  return missions[progress.step]?.minimumLevel ?? null;
}

export function getParallaxDebtContract(campaign: CampaignState, operatorLevel = 20) {
  const progress = campaign.story.parallaxDebt;
  if (progress.status !== 'active') return null;
  const spec = missions[progress.step];
  if (!spec || operatorLevel < spec.minimumLevel) return null;
  return buildContract(campaign, progress.step, spec);
}

export function advanceParallaxDebtAfterContract(campaign: CampaignState, completed: Contract) {
  if (completed.campaignChapter !== 'parallax-debt' || completed.campaignStep === undefined) return { campaign, note: null as string | null };
  const progress = campaign.story.parallaxDebt;
  if (progress.status !== 'active' || progress.step !== completed.campaignStep) return { campaign, note: null as string | null };

  const evidence = completed.campaignEvidence && !progress.evidence.includes(completed.campaignEvidence)
    ? [...progress.evidence, completed.campaignEvidence]
    : progress.evidence;
  const nextStep = progress.step + 1;
  const complete = nextStep >= parallaxDebtChapter.totalContracts;
  const currentSpec = missions[completed.campaignStep];
  const nextSpec = missions[nextStep];

  let note: string;
  if (complete) {
    note = 'PARALLAX DEBT COMPLETE // the private baseline route has been physically resolved through its final branch.';
  } else if (!nextSpec) {
    note = 'PARALLAX DEBT // MID-CHAPTER VECTOR COMPLETE // nine authored operations now bound a live private route from LV15 through LV18. The campaign remains active for its decision branch and final three contracts.';
  } else if (nextSpec.minimumLevel > (currentSpec?.minimumLevel ?? 15)) {
    note = `${completed.campaignAftermath ?? `Parallax evidence advanced // ${factionDisplayName(completed.sponsor)} record banked.`} NEXT PHASE // reach LV${nextSpec.minimumLevel} to continue Parallax Debt.`;
  } else {
    note = completed.campaignAftermath ?? `Parallax evidence advanced // ${factionDisplayName(completed.sponsor)} record banked.`;
  }

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
      story: { ...campaign.story, parallaxDebt: updated, lastBeat: note },
      lastOutcome: note,
    },
    note,
  };
}

const evidenceText: Record<string, string> = {
  'baseline-offset': 'Three physical long-baseline references reproduce the same navigation offset found in Interdiction records.',
  'return-vector': 'Cislunar countermass bookkeeping closes only when the private baseline offset is applied.',
  'blind-meridian': 'The supposedly retired baseline is actively maintained through ordinary human navigation hardware.',
  'kepler-wake': 'A courier emergency recorder can navigate the private frame using ordinary guidance hardware without exposing the correction to its crew.',
  'service-ledger': 'Reference corrections are hidden inside routine industrial calibration invoices rather than a dedicated covert support network.',
  'residual-frame': 'One correction schedule survives three independent physical references and repeats on a predictable maintenance cadence.',
  'null-transit': 'A geometry service timing buffer proves the correction stack is supporting moving traffic instead of a hypothetical route model.',
  'counterfactual-burn': 'Physical countermass debt proves an unlisted vehicle crossed the exchange inside the private reference frame.',
  'false-horizon': 'A live LV18 alignment directly observes the route crossing the Parallax Array during an active reference-shear window.',
};

export function parallaxDebtEvidence(campaign: CampaignState) {
  return campaign.story.parallaxDebt.evidence.map(id => evidenceText[id] ?? id);
}
