import { conditionLabel, factionDisplayName, missionObjectiveFor, type CampaignState, type Contract, type FactionId, type LocationId, type ObjectiveMode } from './campaign';

export const parallaxDebtChapter = { id: 'parallax-debt', title: 'Parallax Debt', totalContracts: 3 } as const;

type MissionSpec = { title: string; location: LocationId; sponsor: FactionId; mode: ObjectiveMode; briefing: string; conditions: Contract['conditions']; deepTarget: string; evidence: string; aftermath: string; finale?: boolean };

const missions: MissionSpec[] = [
  { title: 'Parallax Debt // Baseline Zero', location: 'parallax-array', sponsor: 'heliostat', mode: 'reference-alignment', briefing: 'Interdiction records use a navigation reference offset from every published cislunar ephemeris. A decommissioned long-baseline array still carries the same offset in cold storage. Align its three physical references and recover the comparison without assuming who authored the false baseline.', conditions: ['failing-gravity', 'low-visibility'], deepTarget: 'Array Security Curator Ilyan Roe', evidence: 'baseline-offset', aftermath: 'All three physical references converge on the same offset. The discrepancy is deliberate and repeatable, but it still does not identify a client, cargo, or origin.' },
  { title: 'Parallax Debt // Return Vector', location: 'momentum-exchange', sponsor: 'meridian', mode: 'momentum-capture', briefing: 'Quiet Signal can now compare the array offset against live countermass bookkeeping. Capture both transfer references during a scheduled hidden-cadence window and test whether the missing momentum follows the same false baseline.', conditions: ['failing-gravity', 'automated-defense'], deepTarget: 'Countermass Survey Auditor Tessa Orr', evidence: 'return-vector', aftermath: 'The missing countermass closes only when the array offset is applied. The hidden route is navigating against a private reference rather than merely hiding paperwork.' },
  { title: 'Parallax Debt // Blind Meridian', location: 'parallax-array', sponsor: 'longarc', mode: 'reference-alignment', briefing: 'A second alignment reveals that one reference pylon is being corrected in real time by an operator still using the supposedly retired array. Align the baseline under load, break the control network, and recover the physical reference ledger.', conditions: ['failing-gravity', 'damaged-grid'], deepTarget: 'Baseline Keeper Sera Nox', evidence: 'blind-meridian', aftermath: 'The recovered ledger proves the private baseline is actively maintained through ordinary human navigation hardware. What route it serves, who pays for it, and why it was created remain unresolved.', finale: true },
];

function buildContract(campaign: CampaignState, step: number, spec: MissionSpec): Contract {
  const objective = missionObjectiveFor(spec.mode, spec.location);
  const locationName = spec.location === 'parallax-array' ? 'Cislunar Parallax Array' : spec.location === 'momentum-exchange' ? 'Cislunar Momentum Exchange' : spec.location;
  return { id: `parallax-debt-${step}`, sponsor: spec.sponsor, archetype: spec.mode === 'momentum-capture' ? 'stabilization' : 'salvage', location: spec.location, locationName, title: spec.title, objective: objective.objective, objectiveMode: objective.mode, objectiveSteps: objective.steps, briefing: spec.briefing, conditions: spec.conditions, conditionLabels: spec.conditions.map(condition => conditionLabel[condition]), directorPreview: spec.location === 'parallax-array' ? 'PARALLAX ECOLOGY // reference shear reverses local gravity vectors; specialist units exploit the moving baseline. Aligning pylons collapses active shear fields.' : 'PARALLAX CROSSCHECK // live countermass bookkeeping is being compared against the recovered private reference.', deepTarget: spec.deepTarget, rewardBase: spec.location === 'parallax-array' ? { credits: 390 + step * 25, alloys: 4, electronics: 7, components: 3 } : { credits: 370, alloys: 4, electronics: 6, components: 3 }, reputationGain: 4, priority: true, anomalyOpportunity: false, seed: 0x9a1100 + step * 196613 + campaign.contractsCompleted * 17, campaignChapter: 'parallax-debt', campaignStep: step, campaignFinale: !!spec.finale, campaignEvidence: spec.evidence, campaignAftermath: spec.aftermath, encounterPattern: step === 2 ? 'elite-led' : 'mixed', reserveCount: 2 };
}

export function syncParallaxDebtAccess(campaign: CampaignState, operatorLevel: number) {
  const progress = campaign.story.parallaxDebt;
  if (progress.status !== 'locked' || operatorLevel < 15 || campaign.story.interdiction.status !== 'complete') return campaign;
  const lastBeat = 'PARALLAX DEBT OPENED // LV15 long-baseline analysis found a repeatable navigation offset in the Interdiction custody route.';
  return { ...campaign, story: { ...campaign.story, parallaxDebt: { ...progress, status: 'active' as const, step: 0, lastBeat }, lastBeat }, lastOutcome: lastBeat };
}

export function getParallaxDebtContract(campaign: CampaignState) {
  const progress = campaign.story.parallaxDebt;
  if (progress.status !== 'active') return null;
  const spec = missions[progress.step];
  return spec ? buildContract(campaign, progress.step, spec) : null;
}

export function advanceParallaxDebtAfterContract(campaign: CampaignState, completed: Contract) {
  if (completed.campaignChapter !== 'parallax-debt' || completed.campaignStep === undefined) return { campaign, note: null as string | null };
  const progress = campaign.story.parallaxDebt;
  if (progress.status !== 'active' || progress.step !== completed.campaignStep) return { campaign, note: null as string | null };
  const evidence = completed.campaignEvidence && !progress.evidence.includes(completed.campaignEvidence) ? [...progress.evidence, completed.campaignEvidence] : progress.evidence;
  const nextStep = progress.step + 1;
  const complete = nextStep >= parallaxDebtChapter.totalContracts;
  const note = complete ? 'PARALLAX DEBT // OPENING SEQUENCE COMPLETE // the hidden route uses a privately maintained navigation baseline. Client, cargo, original author, and purpose remain unresolved.' : completed.campaignAftermath ?? `Parallax evidence advanced // ${factionDisplayName(completed.sponsor)} record banked.`;
  const updated = { ...progress, status: complete ? 'complete' as const : 'active' as const, step: nextStep, completed: [...progress.completed, completed.id], evidence, lastBeat: note };
  return { campaign: { ...campaign, story: { ...campaign.story, parallaxDebt: updated, lastBeat: note }, lastOutcome: note }, note };
}

const evidenceText: Record<string, string> = { 'baseline-offset': 'Three physical long-baseline references reproduce the same navigation offset found in Interdiction records.', 'return-vector': 'Cislunar countermass bookkeeping closes only when the private baseline offset is applied.', 'blind-meridian': 'The supposedly retired baseline is actively maintained through ordinary human navigation hardware.' };
export function parallaxDebtEvidence(campaign: CampaignState) { return campaign.story.parallaxDebt.evidence.map(id => evidenceText[id] ?? id); }
