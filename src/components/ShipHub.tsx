import { useEffect, useMemo, useRef, useState } from 'react';
import '../part4.css';
import '../part8.css';
import '../part9.css';
import '../part10.css';
import '../part11.css';
import '../part12.css';
import '../commandHub.css';
import DirectivePanel from './DirectivePanel';
import CommandHubVisual from './CommandHubVisual';
import PlayerStatsPanel from './PlayerStatsPanel';
import BalanceAudit from './BalanceAudit';
import { blackLatticeChapter, blackLatticeEvidence, blackLatticeUnlocked, chooseBlackLatticeBranch, getBlackLatticeChoicePrompt, startBlackLatticeChapter } from '../game/blackLattice';
import {
  buyShipUpgrade,
  buyConsumable,
  escalationStages,
  factions,
  factionDisplayName,
  getUpgradeCost,
  resourceLabels,
  startEscalation,
  upgradeDefinitions,
  type CampaignState,
  type Contract,
  type ResourceId,
  type ShipUpgradeId,
} from '../game/campaign';
import { buildIdentity, type PlayerProfile } from '../game/meta';
import { consumableDefinitions, type ConsumableId } from '../game/consumables';
import { factionGearChance } from '../game/factionGear';
import { getEnvironmentalEventForecast } from '../game/environmentalEvents';
import { isNetworkRequestError, loadRunTrace, networkFailureMessage, type OperationsSnapshot, type RunTraceRecord } from '../game/network';
import { chooseStoryBranch, getStoryChoicePrompt, latticeFindings, startStoryArc, storyArcDefinitions } from '../game/story';
import { protocolForecastForContract, protocolTierSummary } from '../game/eliteProtocols';
import { directiveModifierName, directiveRewardPreview } from '../game/operationDirectives';
import { choosePostKhepriBranch, getPostKhepriChoicePrompt, postKhepriChapter, postKhepriEvidence, startPostKhepriChapter } from '../game/postKhepri';
import { chooseInterdictionBranch, getInterdictionChoicePrompt, interdictionChapter, interdictionEvidence, startInterdictionChapter } from '../game/postKhepriInterdiction';

type Props = {
  profile: PlayerProfile;
  campaign: CampaignState;
  contracts: Contract[];
  operations: OperationsSnapshot | null;
  operationsStatus: 'loading' | 'online' | 'offline';
  operationsError: string;
  telemetrySharing: boolean;
  selectedContractId: string;
  statusMessage: string;
  onSelectContract: (id: string) => void;
  onDeploy: () => void;
  onOpenBuild: () => void;
  onCampaignChange: (campaign: CampaignState) => void;
};
type Tab = 'overview' | 'contracts' | 'stats' | 'campaign' | 'stories' | 'operations' | 'ship' | 'factions' | 'cargo';
type ContractFilter = 'all' | 'narrative' | 'operations' | 'rare' | 'standard';

function costText(cost: ReturnType<typeof getUpgradeCost>) {
  if (!cost) return 'MAX TIER';
  return (Object.entries(cost) as Array<[ResourceId, number]>).filter(([, value]) => value > 0).map(([key, value]) => `${value} ${resourceLabels[key]}`).join(' · ');
}
function contractMatchesFilter(contract: Contract, filter: ContractFilter) {
  if (filter === 'all') return true;
  const narrative = !!(contract.campaignChapter || contract.storyArc);
  const operations = !!(contract.daily || contract.escalationStage || contract.directiveId);
  if (filter === 'narrative') return narrative;
  if (filter === 'operations') return operations;
  if (filter === 'rare') return !!(contract.megastructure || contract.priority || contract.anomalyOpportunity || contract.commandTrace);
  return !narrative && !operations && !contract.megastructure;
}
function contractFilterName(filter: ContractFilter) {
  if (filter === 'narrative') return 'Narrative';
  if (filter === 'operations') return 'Operations';
  if (filter === 'rare') return 'Rare / Priority';
  if (filter === 'standard') return 'Standard';
  return 'All';
}
function runOutcomeLabel(run: { outcome?: string; depth?: string }) {
  const value = run.outcome ?? run.depth ?? 'safe';
  return value === 'failed' ? 'FAILED' : value === 'deep' ? 'DEEP' : 'SAFE';
}

type ContractReadinessTone = 'matched' | 'elevated' | 'high-gap' | 'lower';
function contractReadiness(contract: Contract, operatorLevel: number): { tone: ContractReadinessTone; label: string } {
  const monsterLevel = contract.monsterLevel ?? 1;
  const delta = monsterLevel - operatorLevel;
  if (delta >= 4) return { tone: 'high-gap', label: 'HIGH LEVEL GAP // +' + delta };
  if (delta >= 2) return { tone: 'elevated', label: 'ELEVATED // +' + delta + ' LEVELS' };
  if (delta <= -3) return { tone: 'lower', label: 'LOWER THREAT // ' + Math.abs(delta) + ' BELOW' };
  return { tone: 'matched', label: 'LEVEL-APPROPRIATE' };
}

export default function ShipHub({ profile, campaign, contracts, operations, operationsStatus, operationsError, telemetrySharing, selectedContractId, statusMessage, onSelectContract, onDeploy, onOpenBuild, onCampaignChange }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState(campaign.lastOutcome);
  const [traceRecord, setTraceRecord] = useState<RunTraceRecord | null>(null);
  const [traceMessage, setTraceMessage] = useState('');
  const [contractFilter, setContractFilter] = useState<ContractFilter>('all');
  const hubRef = useRef<HTMLElement>(null);
  const traceRequestIdRef = useRef(0);
  const traceAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => traceAbortRef.current?.abort(), []);
  const switchTab = (next: Tab) => {
    setTab(next);
    requestAnimationFrame(() => hubRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  };
  const selected = contracts.find(contract => contract.id === selectedContractId) ?? contracts[0];
  const environmentalForecast = selected ? getEnvironmentalEventForecast(selected) : [];
  const protocolForecast = selected ? protocolForecastForContract(selected) : [];
  const selectedFactionReputation = selected ? campaign.reputation[selected.sponsor] : 0;
  const selectedFactionSafeChance = Math.round(factionGearChance(selectedFactionReputation, false) * 100);
  const selectedFactionDeepChance = Math.round(factionGearChance(selectedFactionReputation, true) * 100);
  const dailyContract = contracts.find(contract => contract.daily);
  const escalationContract = contracts.find(contract => !!contract.escalationStage);
  const storyContracts = contracts.filter(contract => !!contract.storyArc);
  const chapterContract = contracts.find(contract => contract.campaignChapter === 'black-lattice');
  const postKhepriContract = contracts.find(contract => contract.campaignChapter === 'dead-reckoning');
  const postKhepriProgress = campaign.story.postKhepri;
  const postKhepriChoice = getPostKhepriChoicePrompt(campaign);
  const postKhepriFindings = postKhepriEvidence(campaign);
  const interdictionContract = contracts.find(contract => contract.campaignChapter === 'dead-reckoning-interdiction');
  const commandTraceContracts = contracts.filter(contract => contract.commandTrace);
  const interdictionProgress = campaign.story.interdiction;
  const interdictionChoice = getInterdictionChoicePrompt(campaign);
  const interdictionFindings = interdictionEvidence(campaign);
  const chapterProgress = campaign.story.blackLattice;
  const chapterChoice = getBlackLatticeChoicePrompt(campaign);
  const chapterEvidence = blackLatticeEvidence(campaign);
  const chapterCanStart = blackLatticeUnlocked(campaign);
  const operation = operations?.operation;
  const escalationMatchesBoard = !!operation && campaign.escalation.operationDate === operation.date;
  const displaySavedEscalation = campaign.escalation.status === 'active' || escalationMatchesBoard;
  const escalationStatus = displaySavedEscalation ? campaign.escalation.status : 'idle';
  const escalationStage = displaySavedEscalation ? campaign.escalation.stage : 0;
  const escalationCodename = displaySavedEscalation ? campaign.escalation.codename : operation?.codename ?? 'LINKING';
  const storyFindings = latticeFindings(campaign);
  const activeStoryCount = Object.values(campaign.story.arcs).filter(arc => arc.status === 'active').length;
  const preparedDirective = campaign.directives.inventory.find(item => item.id === campaign.directives.preparedId) ?? null;
  const filteredContracts = useMemo(() => contracts.filter(contract => contractMatchesFilter(contract, contractFilter)), [contracts, contractFilter]);
  const attentionCount = Number(profile.progressionPoints > 0) + Number(chapterProgress.status === 'active') + Number(postKhepriProgress.status === 'available' || postKhepriProgress.status === 'active') + Number(interdictionProgress.status === 'available' || interdictionProgress.status === 'active') + Number(activeStoryCount > 0) + Number(escalationStatus === 'active') + Number(!!preparedDirective);
  const metrics = operations?.metrics;
  const operationScaledRewardEntries = selected ? (Object.entries(selected.rewardBase) as Array<[ResourceId, number]>).map(([key, value]) => [key, Math.round(value * (selected.operationRewardMultiplier ?? 1))] as [ResourceId, number]) : [];
  const upgradeGroups = useMemo(() => {
    const map = new Map<string, typeof upgradeDefinitions>();
    for (const upgrade of upgradeDefinitions) map.set(upgrade.area, [...(map.get(upgrade.area) ?? []), upgrade]);
    return [...map.entries()];
  }, []);
  const buy = (id: ShipUpgradeId) => {
    const result = buyShipUpgrade(campaign, id);
    onCampaignChange(result.campaign);
    setMessage(result.message);
  };
  const buySupply = (id: ConsumableId) => {
    const result = buyConsumable(campaign, id);
    onCampaignChange(result.campaign);
    setMessage(result.message);
  };
  const inspectTrace = async (id: string) => {
    const requestId = ++traceRequestIdRef.current;
    traceAbortRef.current?.abort();
    const controller = new AbortController();
    traceAbortRef.current = controller;
    setTraceRecord(null);
    setTraceMessage('Loading anonymous run trace…');
    try {
      const trace = await loadRunTrace(id, { signal: controller.signal });
      if (traceRequestIdRef.current !== requestId) return;
      setTraceRecord(trace);
      setTraceMessage('');
    } catch (error) {
      if (traceRequestIdRef.current !== requestId || (isNetworkRequestError(error) && error.kind === 'aborted')) return;
      setTraceRecord(null);
      setTraceMessage(`${networkFailureMessage(error, 'Run trace')} The rest of the Operations Board remains usable.`);
    } finally {
      if (traceAbortRef.current === controller) traceAbortRef.current = null;
    }
  };
  const openDaily = () => {
    if (!dailyContract) return;
    onSelectContract(dailyContract.id);
    setMessage(`${dailyContract.title} selected // shared daily configuration loaded`);
    switchTab('contracts');
  };
  const startCurrentEscalation = () => {
    if (!operation) return;
    const next = startEscalation(campaign, operation);
    onCampaignChange(next);
    setMessage(next.escalation.lastBeat);
  };
  const openEscalation = () => {
    if (!escalationContract) return;
    onSelectContract(escalationContract.id);
    setMessage(`${escalationContract.title} selected // cumulative failures loaded`);
    switchTab('contracts');
  };
  const openStoryContract = (arcId: string) => {
    const storyContract = storyContracts.find(contract => contract.storyArc === arcId);
    if (!storyContract) return;
    onSelectContract(storyContract.id);
    setMessage(`${storyContract.title} selected // story operation loaded`);
    switchTab('contracts');
  };
  const openChapterContract = () => { if (!chapterContract) return; onSelectContract(chapterContract.id); setMessage(`${chapterContract.title} selected // Black Lattice campaign contract loaded`); switchTab('contracts'); };
  const openPostKhepriContract = () => { if (!postKhepriContract) return; onSelectContract(postKhepriContract.id); setMessage(`${postKhepriContract.title} selected // Dead Reckoning campaign contract loaded`); switchTab('contracts'); };
  const openInterdictionContract = () => { if (!interdictionContract) return; onSelectContract(interdictionContract.id); setMessage(`${interdictionContract.title} selected // Interdiction campaign contract loaded`); switchTab('contracts'); };
  const topWeapon = metrics
    ? (Object.entries(metrics.weaponShots) as Array<['carbine' | 'breacher' | 'rail', number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'carbine'
    : null;
  const metricAttempts = metrics?.attempts ?? metrics?.runs ?? 0;
  const averageDamageTaken = metricAttempts ? Math.round((metrics?.totalDamageTaken ?? 0) / metricAttempts) : 0;
  const averageDuration = metricAttempts ? Math.round((metrics?.totalDuration ?? 0) / metricAttempts) : 0;
  const tracePolyline = traceRecord?.trace.map(point => `${point.x},${1040 - point.y}`).join(' ') ?? '';
  const displayedStatusMessage = statusMessage || (message && message !== campaign.lastOutcome ? message : '');

  return <main ref={hubRef} className="ship-hub">
    <header className="ship-header"><div><span className="card-kicker">MV QUIET SIGNAL</span><h1>{tab === 'overview' ? 'Command deck' : tab === 'stats' ? 'Operator telemetry' : tab === 'contracts' ? 'Contract board' : tab === 'ship' ? 'Ship systems' : tab === 'cargo' ? 'Cargo' : tab === 'campaign' ? 'Campaign' : tab === 'stories' ? 'Story operations' : tab === 'operations' ? 'Operations' : 'Faction network'}</h1><p>{buildIdentity(profile)} · LV {profile.level} · {campaign.contractsCompleted} contracts</p></div><button className="hub-build-button" onClick={onOpenBuild}>Equipment</button></header>
    {tab !== 'cargo' && <section className="resource-ribbon hub-resource-ribbon" aria-label="Ship resources">{(Object.keys(campaign.resources) as ResourceId[]).map(key => <div key={key} className={key === 'rareTech' && campaign.resources[key] === 0 ? 'muted-resource' : ''}><small>{resourceLabels[key]}</small><b>{campaign.resources[key]}</b></div>)}</section>}
    {attentionCount > 0 && <section className="qol-priority-strip" aria-label="Items needing attention"><div className="qol-priority-copy"><b>{attentionCount} pending</b></div><div className="qol-priority-actions">{profile.progressionPoints > 0 && <button onClick={onOpenBuild}>Network · {profile.progressionPoints}</button>}{chapterProgress.status === 'active' && <button onClick={() => switchTab('campaign')}>Black Lattice · {Math.min(chapterProgress.step + 1, blackLatticeChapter.totalContracts)}/{blackLatticeChapter.totalContracts}</button>}{(postKhepriProgress.status === 'available' || postKhepriProgress.status === 'active') && <button onClick={() => switchTab('campaign')}>Dead Reckoning · {postKhepriProgress.status === 'available' ? 'Ready' : `${Math.min(postKhepriProgress.step + 1, postKhepriChapter.totalContracts)}/${postKhepriChapter.totalContracts}`}</button>}{(interdictionProgress.status === 'available' || interdictionProgress.status === 'active') && <button onClick={() => switchTab('campaign')}>Interdiction · {interdictionProgress.status === 'available' ? 'Ready' : `${Math.min(interdictionProgress.step + 1, interdictionChapter.totalContracts)}/${interdictionChapter.totalContracts}`}</button>}{activeStoryCount > 0 && <button onClick={() => switchTab('stories')}>Stories · {activeStoryCount}</button>}{escalationStatus === 'active' && <button onClick={() => switchTab('operations')}>Escalation · {campaign.escalation.stage + 1}/3</button>}{preparedDirective && <button onClick={() => switchTab('operations')}>Directive · T{preparedDirective.tier}</button>}</div></section>}
    <nav className="ship-tabs" aria-label="Ship areas">{(['overview', 'contracts', 'stats', 'campaign', 'stories', 'operations', 'ship', 'factions', 'cargo'] as Tab[]).map(value => <button key={value} className={tab === value ? 'selected' : ''} onClick={() => switchTab(value)}>{value === 'overview' ? 'Command' : value === 'contracts' ? 'Contracts' : value === 'stats' ? 'Stats' : value === 'campaign' ? 'Campaign' : value === 'stories' ? 'Stories' : value === 'operations' ? 'Operations' : value === 'ship' ? 'Ship' : value === 'factions' ? 'Factions' : 'Cargo'}</button>)}</nav>
    {displayedStatusMessage && <div className="ship-status" role={statusMessage ? 'alert' : 'status'} aria-live={statusMessage ? 'assertive' : 'polite'}>{displayedStatusMessage}</div>}

    {tab === 'overview' && <section className="command-overview"><CommandHubVisual profile={profile} campaign={campaign} /><aside className="command-side"><article className="command-card primary-card"><small>NEXT DEPLOYMENT</small><b>{selected?.title ?? 'No contract selected'}</b><span>{selected ? `OP T${selected.operationTier ?? 1} · ML ${selected.monsterLevel ?? 1} · ${selected.locationName}` : 'Open the Contract Board to choose an operation.'}</span><button onClick={onDeploy} disabled={!selected}>Deploy selected contract</button></article><div className="command-action-row"><button onClick={() => switchTab('contracts')}><b>Change contract</b><small>Review the operation board.</small></button><button onClick={onOpenBuild}><b>Tune loadout</b><small>Compare equipment and build choices.</small></button><button onClick={() => switchTab('stats')}><b>Review stats</b><small>See final combat values.</small></button></div></aside></section>}
    {tab === 'stats' && <PlayerStatsPanel profile={profile} campaign={campaign} />}

    {tab === 'contracts' && <><section className="contract-toolbar"><div><span className="card-kicker">CONTRACT BOARD // VIEW</span><b>{filteredContracts.length} of {contracts.length} contracts visible</b></div><div className="contract-filter-row">{(['all', 'narrative', 'operations', 'rare', 'standard'] as ContractFilter[]).map(filter => <button key={filter} className={contractFilter === filter ? 'selected' : ''} aria-pressed={contractFilter === filter} onClick={() => setContractFilter(filter)}>{contractFilterName(filter)}</button>)}</div></section><section className="contracts-layout"><div className="contract-list">{filteredContracts.map(contract => <button key={contract.id} className={`contract-card ${contract.daily ? 'daily' : ''} ${contract.storyArc ? 'story' : ''} ${contract.escalationStage ? 'escalation' : ''} ${contract.megastructure ? 'megastructure' : ''} ${contract.directiveId ? 'directive' : ''} ${selected?.id === contract.id ? 'selected' : ''}`} onClick={() => onSelectContract(contract.id)}><div className="contract-card-top"><span>{factionDisplayName(contract.sponsor)}</span><b>{contract.directiveId ? `DIRECTIVE // T${contract.directiveTier ?? contract.operationTier ?? 1}` : contract.megastructure ? `RARE DERELICT // ${contract.megastructureStageCount ?? 4} SPACES` : contract.escalationStage ? `ESCALATION // ${contract.escalationStage}/3` : contract.commandTrace ? 'COMMAND TRACE // LV14' : contract.campaignChapter ? `CAMPAIGN // ${(contract.campaignStep ?? 0) + 1}/${contract.campaignChapter === 'dead-reckoning' ? postKhepriChapter.totalContracts : contract.campaignChapter === 'dead-reckoning-interdiction' ? interdictionChapter.totalContracts : blackLatticeChapter.totalContracts}` : contract.storyArc ? `STORY // ${(contract.storyStep ?? 0) + 1}/4` : contract.daily ? 'DAILY' : contract.priority ? 'PRIORITY' : contract.archetype.toUpperCase()}</b></div><h2>{contract.title}</h2><p>{contract.locationName}</p><div className="condition-chips"><span>OP T{contract.operationTier ?? 1}</span><span>ML {contract.monsterLevel ?? 1}</span><span>ER {contract.encounterRating ?? 15}</span><span className={`readiness-chip ${contractReadiness(contract, profile.level).tone}`}>{contractReadiness(contract, profile.level).label}</span>{contract.conditionLabels.map(condition => <span key={condition}>{condition}</span>)}</div></button>)}</div>{selected && <article className="contract-inspector"><span className="card-kicker">NAVIGATION / CONTRACT BRIEF</span><h2>{selected.title}</h2><h3>{selected.locationName}</h3><p>{selected.briefing}</p><div className={`contract-readiness ${contractReadiness(selected, profile.level).tone}`}><small>OPERATOR READINESS</small><b>LV {profile.level} // ML {selected.monsterLevel ?? 1}</b><span>{contractReadiness(selected, profile.level).label}</span></div>{selected.campaignChapter === 'black-lattice' && <div className="campaign-contract-note"><b>THE BLACK LATTICE // CONTRACT {(selected.campaignStep ?? 0) + 1}/{blackLatticeChapter.totalContracts}</b><span>{selected.campaignFinale ? 'Campaign finale: safe extraction banks ordinary rewards, but Khepri remains unresolved until Survey Custodian Veyra Senn is defeated in the deep vault.' : 'This mission advances the major campaign dossier. Some steps pause for an investigation decision before the next contract appears.'}</span></div>}{selected.campaignChapter === 'dead-reckoning' && <div className="campaign-contract-note"><b>DEAD RECKONING // CONTRACT {(selected.campaignStep ?? 0) + 1}/{postKhepriChapter.totalContracts}</b><span>Post-Khepri evidence operation. Physical mass, propellant, and timing records can narrow the logistics model without identifying a client or assigning an origin to the lattice.</span></div>}{selected.campaignChapter === 'dead-reckoning-interdiction' && <div className="campaign-contract-note"><b>DEAD RECKONING // INTERDICTION // CONTRACT {(selected.campaignStep ?? 0) + 1}/{interdictionChapter.totalContracts}</b><span>LV13 custody investigation. Teaching enemies use the same pressure, momentum, electrical, geometry, and logistics mechanics as their command target. Physical counters are disclosed in Tactical Forecast.</span></div>}{selected.commandTrace && <div className="campaign-contract-note"><b>LV14 // COMMAND TRACE ARRAY</b><span>Repeatable target reconstruction from banked evidence. Deep victory guarantees one high-value equipment recovery before the normal second recovery resolves; its identity remains unknown until recovered.</span></div>}{selected.storyArc && <div className="story-contract-note"><b>{selected.storyChapter ?? 'STORY OPERATION'}</b><span>{selected.storyFinale ? 'Finale contract: safe extraction banks ordinary rewards, but the arc only closes after the deep-zone target is defeated.' : 'This mission advances an authored story operation. Completing it may open a decision before the next chapter appears.'}</span></div>}{selected.escalationStage && <div className="story-contract-note escalation-note"><b>ESCALATION {selected.escalationStage}/3 // CUMULATIVE FAILURES</b><span>{selected.escalationFinale ? 'Finale contract: safe withdrawal banks ordinary rewards, but ORO-7 must be defeated in the deep zone to clear the sequence.' : 'Banking this contract carries its physical failure state into the next escalation stage and adds another environmental complication.'}</span></div>}{selected.megastructure && <div className="story-contract-note megastructure-note"><b>RARE DERELICT // FOUR-SPACE EXPEDITION</b><span>Designed as a longer 20–30 minute run. Every secured space opens an extraction checkpoint; suit damage carries forward, each space has an optional recovery, space 2 guarantees an elite, and the final space {selected.megastructureBossTarget ? `can be pushed into ${selected.megastructureBossTarget}.` : 'ends in a high-value recovery vault without a boss.'}</span><div className="mega-route">{selected.megastructureZoneNames?.map((zone, index) => <span key={zone}>{String(index + 1).padStart(2, '0')} // {zone}</span>)}</div></div>}{selected.directiveId && <div className="story-contract-note directive-note"><b>OPERATION DIRECTIVE // T{selected.directiveTier ?? selected.operationTier ?? 1} // {selected.directiveTargetClass === 'command-target' ? 'COMMAND TARGET' : 'ELITE-LED'}</b><span>{directiveRewardPreview({ tier: selected.directiveTier ?? selected.operationTier ?? 1, modifierIds: selected.directiveModifierIds ?? [], targetClass: selected.directiveTargetClass ?? 'elite-led' }, profile.level)}</span><div className="condition-chips">{(selected.directiveModifierIds ?? []).map(id => <span key={id}>RISK // {directiveModifierName(id)}</span>)}</div></div>}<div className="objective-box"><small>PRIMARY OBJECTIVE</small><b>{selected.objective}</b><div className="objective-steps">{selected.objectiveSteps.map(step => <span key={step}>{step}</span>)}</div></div><div className="director-box"><small>TACTICAL FORECAST</small><p>{selected.directorPreview}</p><div className="condition-chips"><span>THREAT {selected.encounterRating ?? 15} · {(selected.encounterPattern ?? 'mixed').toUpperCase()}</span><span>ELITES {selected.eliteProtocolSlots ?? 0} · {protocolTierSummary(selected.operationTier ?? 1, selected.eliteProtocolSlots ?? 0)}</span><span>EVENTS {selected.environmentalEventSlots ?? 2}</span>{protocolForecast.map(name => <span key={`protocol-${name}`}>ECOLOGY // {name}</span>)}{environmentalForecast.map(name => <span key={name}>EVENT // {name}</span>)}</div></div><div className="contract-reward"><small>SAFE EXTRACTION BASELINE</small><b>{operationScaledRewardEntries.map(([key, value]) => `${value} ${resourceLabels[key]}`).join(' · ')}</b><span>{selected.directiveId ? `Operation Tier and Directive risk are included here. Cargo, recovery tags, Daily/Priority bonuses and extraction depth resolve when you bank the run. ${directiveRewardPreview({ tier: selected.directiveTier ?? selected.operationTier ?? 1, modifierIds: selected.directiveModifierIds ?? [], targetClass: selected.directiveTargetClass ?? 'elite-led' }, profile.level)}.` : selected.megastructure ? 'Operation Tier is included here; expedition depth then scales with spaces secured, optional recoveries, cargo upgrades, tags and the optional command-zone result.' : selected.escalationFinale ? 'Operation Tier is included here. Escalation III is the largest package in the sequence; only a deep ORO-7 victory clears the final stage.' : selected.escalationStage ? 'Operation Tier is included here. Escalation rewards rise at every stage while accumulated physical complications carry forward.' : selected.storyFinale ? 'Operation Tier is included here. Safe extraction banks ordinary rewards but leaves the story target unresolved; deep victory closes the arc.' : selected.daily ? campaign.dailyCompletedDate === selected.operationDate ? 'Operation Tier is included here. The first-extraction Daily bonus is already banked today; repeat runs remain available for practice and telemetry.' : 'Operation Tier is included here. First Daily extraction adds 15% materials; cargo, tags and depth apply at settlement.' : 'Operation Tier is included here. Cargo, recovery tags and extraction depth apply at settlement; deep extraction also adds reputation and a second equipment recovery.'}</span></div><div className={`faction-armory-preview faction-${selected.sponsor}`}><small>EQUIPMENT RECOVERY</small><b>{selectedFactionSafeChance}% safe · {selectedFactionDeepChance}% deep sponsor-aligned chance</b><p>Reputation improves sponsor-aligned odds. High-tier and command operations can produce unusual fixed-identity equipment; names and effects stay hidden until recovery.</p></div>{selected.anomalyOpportunity && <div className="anomaly-note"><b>UNCLASSIFIED TRACE</b><span>Long Arc requests that a non-reflective lattice feature be observed, not dismantled. Deep extraction may recover one quarantined trace sample.</span></div>}<button className="deploy-contract" onClick={onDeploy}>Deploy selected contract</button></article>}</section></>}

    {tab === 'campaign' && <section className="campaign-panel">
      <article className="campaign-hero">
        <header><div><span className="card-kicker">QUIET SIGNAL // CAMPAIGN CHAPTER I</span><h2>{blackLatticeChapter.title}</h2><p>Turn the quarantined trace into a system-wide investigation. Fourteen contracts compare manufacturing tolerances, thermal behavior, survey chronology, logistics and pre-arrival recovery activity before culminating at Khepri Survey Annex.</p></div><span className="campaign-state">{chapterProgress.status === 'locked' && chapterCanStart ? 'READY' : chapterProgress.status.toUpperCase()}</span></header>
        <div className="campaign-meter"><div><i style={{ width: `${Math.min(100, chapterProgress.step / blackLatticeChapter.totalContracts * 100)}%` }} /></div><b>{Math.min(chapterProgress.step, blackLatticeChapter.totalContracts)} / {blackLatticeChapter.totalContracts} CONTRACTS</b></div>
        <p>{chapterProgress.lastBeat}</p>
        {chapterChoice && <div className="campaign-choice"><b>{chapterChoice.title}</b><span>{chapterChoice.body}</span><div className="campaign-choice-options">{chapterChoice.choices.map(choice => <button key={choice.id} onClick={() => { const next = chooseBlackLatticeBranch(campaign, choice.id); onCampaignChange(next); setMessage(next.story.blackLattice.lastBeat); }}><b>{choice.title}</b><span>{choice.body}</span><small>{choice.consequence}</small></button>)}</div></div>}
        <div className="campaign-actions">{chapterProgress.status === 'locked' && chapterCanStart && <button className="primary" onClick={() => { const next = startBlackLatticeChapter(campaign); onCampaignChange(next); setMessage(next.story.blackLattice.lastBeat); }}>Start The Black Lattice</button>}{chapterProgress.status === 'locked' && !chapterCanStart && <span>Recover a quarantined trace or bank a lattice finding in Story Operations to unlock this chapter.</span>}{chapterProgress.status === 'active' && chapterContract && !chapterChoice && <button className="primary" onClick={openChapterContract}>Open contract {chapterProgress.step + 1}</button>}{chapterProgress.status === 'complete' && <span>Chapter complete // earlier-arrival network confirmed; client, origin and purpose remain unresolved.</span>}</div>
      </article>
      <article className="campaign-hero"><header><div><span className="card-kicker">QUIET SIGNAL // CAMPAIGN CHAPTER II // LV11+</span><h2>{postKhepriChapter.title}</h2><p>Follow the physical bookkeeping Khepri could not explain: counter-momentum, propellant drawdown, and service timing that point to a hidden logistics cadence without inventing an answer for who owns it.</p></div><span className="campaign-state">{postKhepriProgress.status.toUpperCase()}</span></header><div className="campaign-meter"><div><i style={{ width: `${Math.min(100, postKhepriProgress.step / postKhepriChapter.totalContracts * 100)}%` }} /></div><b>{Math.min(postKhepriProgress.step, postKhepriChapter.totalContracts)} / {postKhepriChapter.totalContracts} CONTRACTS</b></div><p>{postKhepriProgress.lastBeat}</p>{postKhepriChoice && <div className="campaign-choice"><b>{postKhepriChoice.title}</b><span>{postKhepriChoice.body}</span><div className="campaign-choice-options">{postKhepriChoice.choices.map(choice => <button key={choice.id} onClick={() => { const next = choosePostKhepriBranch(campaign, choice.id); onCampaignChange(next); setMessage(next.story.postKhepri.lastBeat); }}><b>{choice.title}</b><span>{choice.body}</span><small>{choice.consequence}</small></button>)}</div></div>}<div className="campaign-actions">{postKhepriProgress.status === 'locked' && <span>{campaign.story.blackLattice.status !== 'complete' ? 'Complete The Black Lattice before following the Khepri residuals.' : 'Reach operator level 11 to calibrate Dead Reckoning navigation.'}</span>}{postKhepriProgress.status === 'available' && <button className="primary" onClick={() => { const next = startPostKhepriChapter(campaign); onCampaignChange(next); setMessage(next.story.postKhepri.lastBeat); }}>Start Dead Reckoning</button>}{postKhepriProgress.status === 'active' && postKhepriContract && !postKhepriChoice && <button className="primary" onClick={openPostKhepriContract}>Open contract {postKhepriProgress.step + 1}</button>}{postKhepriProgress.status === 'complete' && <span>Opening sequence complete // one hidden logistics cadence is supported; client, cargo, lattice origin, and purpose remain unresolved.</span>}</div>{postKhepriFindings.length > 0 && <div className="campaign-evidence-list">{postKhepriFindings.map((entry, index) => <span key={entry}>{String(index + 1).padStart(2, '0')} // {entry}</span>)}</div>}</article>
      <article className="campaign-hero"><header><div><span className="card-kicker">QUIET SIGNAL // CAMPAIGN CHAPTER III // LV13+</span><h2>{interdictionChapter.title}</h2><p>Follow the human custody layer defending the Dead Reckoning cadence. Enemy packages now teach pressure partitions, counterforce, purge control, capacitor denial, custody theft, firing geometry, and repair logistics before their command targets use the same language.</p></div><span className="campaign-state">{interdictionProgress.status.toUpperCase()}</span></header><div className="campaign-meter"><div><i style={{ width: `${Math.min(100, interdictionProgress.step / interdictionChapter.totalContracts * 100)}%` }} /></div><b>{Math.min(interdictionProgress.step, interdictionChapter.totalContracts)} / {interdictionChapter.totalContracts} CONTRACTS</b></div><p>{interdictionProgress.lastBeat}</p>{interdictionChoice && <div className="campaign-choice"><b>{interdictionChoice.title}</b><span>{interdictionChoice.body}</span><div className="campaign-choice-options">{interdictionChoice.choices.map(choice => <button key={choice.id} onClick={() => { const next = chooseInterdictionBranch(campaign, choice.id); onCampaignChange(next); setMessage(next.story.interdiction.lastBeat); }}><b>{choice.title}</b><span>{choice.body}</span><small>{choice.consequence}</small></button>)}</div></div>}<div className="campaign-actions">{interdictionProgress.status === 'locked' && <span>{campaign.story.postKhepri.status !== 'complete' ? 'Complete the Dead Reckoning opening sequence before tracing its custody layer.' : 'Reach operator level 13 to open Interdiction.'}</span>}{interdictionProgress.status === 'available' && <button className="primary" onClick={() => { const next = startInterdictionChapter(campaign); onCampaignChange(next); setMessage(next.story.interdiction.lastBeat); }}>Start Interdiction</button>}{interdictionProgress.status === 'active' && interdictionContract && !interdictionChoice && <button className="primary" onClick={openInterdictionContract}>Open contract {interdictionProgress.step + 1}</button>}{interdictionProgress.status === 'complete' && <span>Interdiction complete // a rotating human custody shell is supported; client, cargo, lattice origin, and purpose remain unresolved.</span>}</div>{profile.level >= 14 && <div className="campaign-contract-note"><b>LV14 // COMMAND TRACE ARRAY // {commandTraceContracts.length} IDENTIFIED TARGET{commandTraceContracts.length === 1 ? '' : 'S'}</b><span>Repeatable traces appear in Contract Board → Rare/Priority as command targets are identified. Deep clears preserve dedicated-boss guarantees and location chase ordering.</span></div>}{interdictionFindings.length > 0 && <div className="campaign-evidence-list">{interdictionFindings.map((entry, index) => <span key={entry}>{String(index + 1).padStart(2, '0')} // {entry}</span>)}</div>}</article>
      <div className="campaign-dossier"><article className="campaign-evidence"><span className="card-kicker">BLACK LATTICE // EVIDENCE INDEX</span><h3>What Quiet Signal can actually support</h3><div className="campaign-evidence-list">{chapterEvidence.length ? chapterEvidence.map((entry, index) => <span key={entry}>{String(index + 1).padStart(2, '0')} // {entry}</span>) : <em>No campaign evidence banked yet. The chapter begins with the provenance of the first quarantined trace.</em>}</div></article><article className="campaign-unknowns"><span className="card-kicker">UNRESOLVED // DO NOT OVERCLAIM</span><h3>Still unknown</h3><ul><li>Who manufactured the original lattice.</li><li>Who employs the pre-arrival recovery network.</li><li>Why old survey systems already knew where to look.</li><li>Whether the lattice was built for infrastructure, measurement, or something else entirely.</li></ul></article></div>
    </section>}

    {tab === 'stories' && <section className="story-operations">
      <div className="story-intro">
        <article className="story-brief"><span className="card-kicker">QUIET SIGNAL // STORY OPERATIONS</span><h2>Contracts that remember what you chose.</h2><p>Each operation is four missions long with two decision gates. The combat remains ordinary Vector contracts; the next contract, faction context, and finale path change with your decisions.</p><div className="lattice-meter"><div><i style={{ width: `${Math.min(100, campaign.story.latticeClues / 6 * 100)}%` }} /></div><b>{campaign.story.latticeClues} / 6 LATTICE FINDINGS</b></div><p>{campaign.story.lastBeat}</p></article>
        <article className="lattice-dossier"><span className="card-kicker">QUARANTINED LATTICE // WORKING DOSSIER</span><h2>Evidence, not conclusions.</h2>{storyFindings.length ? <div className="lattice-findings">{storyFindings.map((finding, index) => <span key={finding}>{String(index + 1).padStart(2, '0')} // {finding}</span>)}</div> : <p>No story evidence has been banked yet. Existing quarantined samples remain isolated from normal equipment.</p>}</article>
      </div>
      <div className="story-arc-grid">{storyArcDefinitions.map(arc => {
        const progress = campaign.story.arcs[arc.id];
        const prompt = getStoryChoicePrompt(campaign, arc.id);
        const activeContract = storyContracts.find(contract => contract.storyArc === arc.id);
        return <article key={arc.id} className="story-arc-card"><header><div><span className="card-kicker">{factionDisplayName(arc.sponsor)}</span><h2>{arc.title}</h2></div><span className={`story-state ${progress.status}`}>{progress.status.toUpperCase()}</span></header><small>{arc.subtitle.toUpperCase()} · RECOMMENDED LV {arc.recommendedLevel}</small><p>{arc.premise}</p><div className="story-progress">{[0, 1, 2, 3].map(step => <i key={step} className={progress.step > step || progress.status === 'complete' ? 'done' : ''} />)}</div>{prompt && <div className="story-choice"><b>{prompt.title}</b><span>{prompt.body}</span><div className="story-choice-options">{prompt.choices.map(choice => <button key={choice.id} onClick={() => { const next = chooseStoryBranch(campaign, arc.id, choice.id); onCampaignChange(next); setMessage(next.story.lastBeat); }}><b>{choice.title}</b><span>{choice.body}</span><small>{choice.consequence}</small></button>)}</div></div>}{progress.status === 'available' && <button className="primary" onClick={() => { const next = startStoryArc(campaign, arc.id); onCampaignChange(next); setMessage(next.story.lastBeat); }}>Start {arc.title}</button>}{progress.status === 'active' && activeContract && !prompt && <button className="primary" onClick={() => openStoryContract(arc.id)}>Open chapter {(activeContract.storyStep ?? 0) + 1} contract</button>}{progress.status === 'active' && !activeContract && !prompt && <p>Story state is waiting for the next contract to resolve.</p>}{progress.status === 'complete' && <p><b>ARC COMPLETE //</b> {arc.finale} defeated. One quarantined trace was added to cargo.</p>}</article>;
      })}</div>
    </section>}

    {tab === 'operations' && <section className="operations-panel">
      <article className="operations-daily">
        <span className="card-kicker">SHARED OPERATIONS BOARD // {operation?.date ?? 'LINKING'}</span>
        <h2>{operation ? `OPERATION ${operation.codename.toUpperCase()}` : operationsStatus === 'offline' ? 'Operations link offline' : 'Acquiring daily operation…'}</h2>
        {operation && dailyContract ? <>
          <p>{operation.challenge}</p>
          <div className="operations-facts"><span><small>LOCATION</small><b>{dailyContract.locationName}</b></span><span><small>SPONSOR</small><b>{factionDisplayName(dailyContract.sponsor)}</b></span><span><small>RESET</small><b>00:00 UTC</b></span><span><small>FIRST EXTRACTION</small><b>{campaign.dailyCompletedDate === operation.date ? 'BONUS BANKED' : '+15% MATERIALS'}</b></span></div>
          <div className="condition-chips">{dailyContract.conditionLabels.map(condition => <span key={condition}>{condition}</span>)}</div>
          <button onClick={openDaily}>Open daily contract</button>
        </> : <p>{operationsStatus === 'offline' ? `${operationsError || 'Operations link unavailable.'} Standard contracts remain fully playable. The board will reconnect automatically on a later app load.` : 'The Quiet Signal is waiting for the shared operation record.'}</p>}
      </article>

      <article className="operations-escalation">
        <span className="card-kicker">OPTIONAL ESCALATION // {escalationCodename.toUpperCase()}</span>
        <h2>Three contracts. Failures accumulate.</h2>
        <p>The sequence is seeded from the Daily Operations Board but runs independently of the normal Daily contract. Each banked stage preserves the previous physical failure and adds another; there are no hidden enemy-damage multipliers.</p>
        <div className="escalation-chain">{escalationStages.map((stage, index) => { const done = escalationStatus === 'complete' || escalationStage > index; const current = escalationStatus === 'active' && escalationStage === index; return <div key={stage.title} className={`escalation-stage ${done ? 'complete' : ''} ${current ? 'current' : ''}`}><small>CONTRACT {index + 1}</small><b>{stage.complication}</b><span>{stage.description}</span></div>; })}</div>
        <div className="escalation-state-note"><b>{escalationStatus === 'active' ? `STAGE ${campaign.escalation.stage + 1}/3 ACTIVE` : escalationStatus === 'complete' ? 'SEQUENCE CLEARED' : 'OPTIONAL SEQUENCE READY'}</b><span>{displaySavedEscalation ? campaign.escalation.lastBeat : operation ? `Start a new three-contract sequence from Operation ${operation.codename}.` : 'A live Daily Operations record is required to seed a new escalation. Any previously active sequence remains locally playable.'}</span></div>
        {escalationStatus === 'active' && escalationContract ? <button onClick={openEscalation}>Open Escalation {campaign.escalation.stage + 1} contract</button> : escalationStatus === 'complete' ? <button disabled>Escalation cleared for this Daily seed</button> : operation ? <button onClick={startCurrentEscalation}>Start three-contract escalation</button> : <button disabled>Operations link unavailable</button>}
      </article>

      <DirectivePanel profile={profile} campaign={campaign} contracts={contracts} onCampaignChange={onCampaignChange} onOpenContract={id => { onSelectContract(id); setMessage('Prepared Operation Directive selected // risk/reward forecast loaded'); switchTab('contracts'); }} />

      <article className="operations-telemetry">
        <div className="operations-heading"><div><span className="card-kicker">VECTOR TELEMETRY NETWORK</span><h2>Balance data from opt-in attempts</h2></div><span className={`network-pill ${telemetrySharing ? 'online' : 'local'}`}>{telemetrySharing ? 'SHARING ON' : 'LOCAL ONLY'}</span></div>
        <p>Run telemetry contains gameplay numbers and low-frequency position checkpoints only. No account or device identifier is stored with a run.</p>
        <div className="operations-metrics"><span><small>ATTEMPTS</small><b>{metrics?.attempts ?? metrics?.runs ?? 0}</b></span><span><small>BANKED RUNS</small><b>{metrics?.runs ?? 0}</b></span><span><small>DEEP EXTRACTS</small><b>{metrics?.deepRuns ?? 0}</b></span><span><small>FAILED ATTEMPTS</small><b>{metrics?.failedRuns ?? 0}</b></span><span><small>AVG DAMAGE TAKEN</small><b>{averageDamageTaken}</b></span><span><small>AVG RUN TIME</small><b>{averageDuration}s</b></span><span><small>MOST-FIRED FAMILY</small><b>{topWeapon?.toUpperCase() ?? 'NO DATA'}</b></span></div><BalanceAudit metrics={metrics} />
        {!telemetrySharing && <div className="operations-consent"><b>Anonymous sharing is disabled.</b><span>Enable “Share anonymous run telemetry” in Build Bay → Settings if you want extracted and failed attempts to contribute to balance data and replay traces.</span><button onClick={onOpenBuild}>Open Build Bay</button></div>}
        <div className="recent-traces"><h3>Recent anonymous traces</h3>{metrics?.recent?.length ? metrics.recent.map(run => <button key={run.id} onClick={() => void inspectTrace(run.id)}><span><b>{run.contractTitle}</b><small>{run.location} · OP T{run.operationTier} · LV {run.level} · {runOutcomeLabel(run)} · {run.tracePoints} checkpoints</small></span><strong>VIEW TRACE</strong></button>) : <p>No shared run traces have been banked yet.</p>}</div>
        {traceMessage && <div className="trace-message" role="status">{traceMessage}</div>}
      </article>

      {traceRecord && <article className="trace-inspector"><div><span className="card-kicker">RUN TRACE // {traceRecord.id.slice(0, 8).toUpperCase()}</span><h2>{traceRecord.contractTitle}</h2><p>{traceRecord.buildLabel} · OP T{traceRecord.operationTier} · LV {traceRecord.level} · {runOutcomeLabel(traceRecord)} · {traceRecord.duration.toFixed(1)}s · {traceRecord.trace.length} checkpoints</p></div><svg viewBox="0 0 2320 1040" role="img" aria-label="Anonymous operator path through the contract"><rect x="20" y="20" width="2280" height="1000" rx="50" /><polyline points={tracePolyline} />{traceRecord.trace[0] && <circle className="trace-start" cx={traceRecord.trace[0].x} cy={1040 - traceRecord.trace[0].y} r="22" />}{traceRecord.trace.at(-1) && <circle className="trace-end" cx={traceRecord.trace.at(-1)!.x} cy={1040 - traceRecord.trace.at(-1)!.y} r="22" />}</svg><div className="trace-stats"><span>DAMAGE DEALT <b>{traceRecord.damageDealt}</b></span><span>DAMAGE TAKEN <b>{traceRecord.damageTaken}</b></span><span>SALVAGE TAGS <b>{traceRecord.salvageTags}</b></span><span>BOSS <b>{traceRecord.bossDefeated ? 'DEFEATED' : 'NOT ENGAGED'}</b></span></div></article>}
    </section>}

    {tab === 'ship' && <section className="ship-systems-panel"><div className="ship-systems-intro"><div><span className="card-kicker">QUIET SIGNAL // SYSTEMS</span><h2>Upgrade what changes the next deployment.</h2><p>Every listed system feeds combat, recovery, or equipment generation. Operator gear and Protocol Lenses remain in the Build Bay.</p></div><button onClick={onOpenBuild}>Open Build Bay</button></div>{upgradeGroups.map(([area, upgrades]) => <section key={area} className="upgrade-group"><h2>{area}</h2><div className="upgrade-grid">{upgrades.map(upgrade => { const level = campaign.shipUpgrades[upgrade.id]; const cost = getUpgradeCost(campaign, upgrade.id); return <article key={upgrade.id} className="upgrade-card"><div><small>{upgrade.name.toUpperCase()}</small><b>TIER {level} / 2</b></div><p>{upgrade.description}</p><strong>{level > 0 ? upgrade.benefits[level - 1] : upgrade.benefits[0]}</strong><button disabled={!cost} onClick={() => buy(upgrade.id)}>{cost ? `Upgrade // ${costText(cost)}` : 'Prototype limit reached'}</button></article>; })}</div></section>)}</section>}

    {tab === 'factions' && <section className="faction-panel">{factions.map(faction => <article key={faction.id} className="faction-card"><header><div><span className="card-kicker">{faction.name}</span><h2>Reputation {campaign.reputation[faction.id]}</h2></div><div className="rep-meter"><i style={{ width: `${Math.max(0, Math.min(100, (campaign.reputation[faction.id] + 10) / 30 * 100))}%` }} /></div></header><div className="faction-copy"><p><b>History.</b> {faction.history}</p><p><b>Economic foundation.</b> {faction.economy}</p><p><b>Culture.</b> {faction.culture}</p><p><b>Technology.</b> {faction.technology}</p><p><b>Political goals.</b> {faction.goals}</p><p><b>Strengths.</b> {faction.strengths}</p><p><b>Failures.</b> {faction.failures}</p><p><b>Internal divisions.</b> {faction.divisions}</p></div><div className="faction-unlocks">{faction.unlocks.map(unlock => <span key={unlock}>{unlock}</span>)}</div><div className={`faction-armory-summary faction-${faction.id}`}><b>SPONSORED EQUIPMENT ACCESS</b><span>Current normal-slot odds: {Math.round(factionGearChance(campaign.reputation[faction.id], false) * 100)}% safe · {Math.round(factionGearChance(campaign.reputation[faction.id], true) * 100)}% deep</span><small>Frame identities and interactions reveal only after recovery.</small></div></article>)}</section>}

    {tab === 'cargo' && <section className="cargo-panel"><article className="consumable-store"><span className="card-kicker">FIELD CONSUMABLES // SHIP STORE</span><h2>Spend Credits on deployment supplies</h2><p>Credits are the field currency. Supplies persist in Quiet Signal storage and are only consumed when an effect successfully activates in combat.</p><div className="consumable-credit-balance"><small>AVAILABLE CREDITS</small><b>{campaign.resources.credits}</b></div><div className="consumable-shop-grid">{consumableDefinitions.map(item => { const stock = campaign.consumables[item.id]; const full = stock >= item.maxStock; const affordable = campaign.resources.credits >= item.cost; return <div key={item.id} className="consumable-shop-card"><header><div><small>{item.hotkey} // {item.shortName}</small><b>{item.name}</b></div><strong>{stock}/{item.maxStock}</strong></header><p>{item.description}</p><span>{item.effect}</span><button disabled={full || !affordable} onClick={() => buySupply(item.id)}>{full ? 'Stock full' : `Buy // ${item.cost} Credits`}</button></div>; })}</div></article><article className="cargo-ledger"><span className="card-kicker">CARGO / SALVAGE LEDGER</span><h2>Banked resources</h2>{(Object.keys(campaign.resources) as ResourceId[]).map(key => <div key={key}><span>{resourceLabels[key]}</span><b>{campaign.resources[key]}</b></div>)}</article><article className="cargo-ledger"><span className="card-kicker">EQUIPMENT STORAGE</span><h2>{profile.inventory.length} equipment packages</h2><p>Equipment recovery remains sparse and meaningful. Cargo upgrades increase material yield, not item spam.</p><button onClick={onOpenBuild}>Inspect equipment</button></article><article className="cargo-ledger"><span className="card-kicker">LAST OPERATION</span><h2>Mission log</h2><p>{campaign.lastOutcome}</p>{campaign.resources.rareTech > 0 && <div className="anomaly-note"><b>QUARANTINED TRACE // {campaign.resources.rareTech}</b><span>Recovered lattice material occupies shielded sample storage. Its geometry has not been matched to normal human industrial methods; the Campaign dossier tracks what Quiet Signal can actually support from the evidence.</span></div>}</article></section>}
  </main>;
}
