import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './qol.css';
import './equipmentBay.css';
import './readability.css';
import './consumables.css';
import { advanceBlackLatticeAfterContract, getBlackLatticeContract } from './game/blackLattice';
import { advanceEscalationAfterContract, applyShipBonuses, dailyOperationContract, factionDisplayName, generateContracts, generateEscalationContract, resourceLabels, settleContract, type CampaignReward, type CampaignState, type Contract, type ExpeditionProgress, type ResourceId } from './game/campaign';
import { feedback } from './game/feedback';
import { awardRecovery, buildIdentity, deriveCombatBuild, discardItem, dominantEquipmentFaction, setProfileSettings, type PlayerProfile, type ProfileSettings, type VictoryReward } from './game/meta';
import { loadOperationsSnapshot, uploadRunTelemetry, type OperationsSnapshot } from './game/network';
import { advanceStoryAfterContract, generateStoryContracts } from './game/story';
import { advancePostKhepriAfterContract, getPostKhepriContract, syncPostKhepriAccess } from './game/postKhepri';
import { advanceInterdictionAfterContract, getCommandTraceContracts, getInterdictionContract, syncInterdictionAccess } from './game/postKhepriInterdiction';
import { withOperationScaling } from './game/scaling';
import { advanceDirectivesAfterContract, preparedDirectiveContract, syncDirectiveAccess } from './game/operationDirectives';
import type { Telemetry } from './game/sim';
import type { GroundLootReceipt } from './game/fieldLoot';
import { loadGameState, saveGameState } from './game/gamePersistence';

const loadArmory = () => import('./components/Armory');
const loadGameCanvas = () => import('./components/GameCanvas');
const loadShipHub = () => import('./components/ShipHub');
const Armory = lazy(loadArmory);
const GameCanvas = lazy(loadGameCanvas);
const ShipHub = lazy(loadShipHub);

type Screen = 'ship' | 'combat' | 'build' | 'debrief';
type UplinkStatus = 'local' | 'sharing' | 'shared' | 'error';

function SurfaceLoader({ screen }: { screen: Screen }) {
  const label = screen === 'combat' ? 'Preparing combat renderer' : screen === 'build' ? 'Opening equipment systems' : screen === 'ship' ? 'Opening command deck' : 'Loading mission debrief';
  return <main className="surface-loader" role="status" aria-live="polite"><div><span>QUIET SIGNAL // CLIENT STREAM</span><b>{label}</b><i /></div></main>;
}
type Debrief = { runId: number; contract: Contract; campaignReward: CampaignReward; lootReward: VictoryReward; uplinkStatus: UplinkStatus; storyNote: string | null; chapterNote: string | null; postKhepriNote: string | null; interdictionNote: string | null; escalationNote: string | null; directiveNote: string | null; protocolValue: number; expeditionProgress?: ExpeditionProgress };

function debriefRarityCue(rarity: VictoryReward['loot'][number]['rarity']) {
  if (rarity === 'Singular') return 'RULE-CHANGING';
  if (rarity === 'Prototype') return 'HIGH-END';
  if (rarity === 'Refined') return 'UPGRADED';
  return 'BASELINE';
}
function debriefItemEffect(item: VictoryReward['loot'][number]) {
  if (item.singularEffect) return item.singularEffect;
  const mechanical = item.modifiers.find(modifier => modifier.mechanical);
  if (mechanical) return `${mechanical.label}: ${mechanical.description}`;
  const first = item.modifiers[0];
  return first ? `${first.label}: ${first.description}` : item.core;
}

function DebriefScreen({ result, onShip, onBuild, onRepeat, onDiscard }: { result: Debrief; onShip: () => void; onBuild: () => void; onRepeat?: () => void; onDiscard: (itemId: string) => void }) {
  const [discardedIds, setDiscardedIds] = useState<string[]>([]);
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const gained = (Object.entries(result.campaignReward.gained) as Array<[ResourceId, number]>).filter(([, value]) => value > 0);
  const sponsor = result.contract.sponsor;
  const reputationGain = result.campaignReward.reputationDelta[sponsor] ?? 0;
  const reputationAfter = result.campaignReward.campaign.reputation[sponsor];
  const reputationBefore = reputationAfter - reputationGain;
  const newRecoveryCount = result.lootReward.loot.length;
  const keptRecoveryCount = result.lootReward.loot.filter(item => !discardedIds.includes(item.id)).length;
  const unspentPoints = result.lootReward.profile.progressionPoints;
  const nextActions: string[] = [];
  if (keptRecoveryCount > 0) nextActions.push(`${keptRecoveryCount} recovered equipment package${keptRecoveryCount === 1 ? '' : 's'} kept in ship storage.`);
  if (unspentPoints > 0) nextActions.push(`${unspentPoints} unspent progression point${unspentPoints === 1 ? '' : 's'} available in the Vector Development Network.`);
  if (result.lootReward.profile.level >= 15 && !result.lootReward.profile.specialization) nextActions.push('LV15 Vector Specialization ready in Build Bay → Network. Choosing one does not consume a progression point.');
  const milestones = [
    reputationBefore < 6 && reputationAfter >= 6 ? 'REP 6 // SPECIALIZED SHIP-UPGRADE DISCOUNT UNLOCKED' : '',
    reputationBefore < 8 && reputationAfter >= 8 ? 'REP 8 // PRIORITY CONTRACTS UNLOCKED' : '',
    reputationBefore < 12 && reputationAfter >= 12 ? 'REP 12 // DEEPER SPECIALTY UPGRADE DISCOUNT UNLOCKED' : '',
  ].filter(Boolean);
  const uplinkCopy = result.uplinkStatus === 'shared'
    ? ['RUN TRACE BANKED', 'Anonymous combat telemetry and replay checkpoints were added to the Operations network.']
    : result.uplinkStatus === 'sharing'
      ? ['TELEMETRY UPLINK', 'Banked progression is already safe. Anonymous run telemetry is uploading separately.']
      : result.uplinkStatus === 'error'
        ? ['UPLINK DELAYED', 'Rewards and local progression are safe. The optional telemetry upload failed and will not block play.']
        : ['LOCAL RUN ONLY', 'Anonymous telemetry sharing is disabled in Build Bay → Settings. No run data was uploaded.'];

  return (
    <main className="debrief-shell">
      <section className="debrief-card">
        <span className="card-kicker">QUIET SIGNAL // MISSION DEBRIEF</span>
        <h1>{result.campaignReward.depth === 'deep' ? 'Deep extraction complete' : 'Safe extraction complete'}</h1>
        <p>{result.contract.title} · {result.contract.locationName}</p>
        <div className="debrief-grid">
          {gained.map(([key, value]) => <div key={key}><small>{resourceLabels[key]}</small><b>+{value}</b></div>)}
          <div><small>XP</small><b>+{result.lootReward.xpGained}</b></div>
          <div><small>Equipment recovered</small><b>{result.lootReward.loot.length}</b></div>
          {result.protocolValue > 0 && <div><small>Elite protocol value defeated</small><b>+{result.protocolValue}</b></div>}
          <div><small>{factionDisplayName(sponsor)} reputation</small><b>+{reputationGain}</b></div>
          <div><small>Operator level</small><b>LV {result.lootReward.profile.level}</b></div>
          {result.lootReward.levelsGained > 0 && <div><small>{result.lootReward.levelsGained === 1 ? 'Progression point earned' : 'Progression points earned'}</small><b>+{result.lootReward.levelsGained}</b></div>}
        </div>
        {milestones.length > 0 && <div className="anomaly-note"><b>FACTION ACCESS EXPANDED</b>{milestones.map(milestone => <span key={milestone}>{milestone}</span>)}</div>}
        <div className={`uplink-note ${result.uplinkStatus}`}><b>{uplinkCopy[0]}</b><span>{uplinkCopy[1]}</span></div>
        {newRecoveryCount > 0 && <section className="recovery-review" aria-label="Recovered equipment review">
          <header className="recovery-review-heading"><div><small>RECOVERED EQUIPMENT // REVIEW</small><b>Keep what matters. Discard what does not.</b></div><span>{keptRecoveryCount} kept · {discardedIds.length} discarded</span></header>
          <div className="recovery-review-grid">{result.lootReward.loot.map(item => { const discarded = discardedIds.includes(item.id); const confirming = confirmDiscardId === item.id; return <article key={item.id} className={`recovery-review-card quality-${item.recoveryQuality ?? 0} rarity-${item.rarity.toLowerCase()} ${discarded ? 'discarded' : ''}`}><div className="recovery-review-copy"><div className="recovery-review-meta"><small>{item.rarity.toUpperCase()} · {debriefRarityCue(item.rarity)} · {item.slot.toUpperCase()} · EQUIP LV {item.levelRequirement}</small><strong>{discarded ? 'DISCARDED' : 'KEPT IN STORAGE'}</strong></div><h3>{item.name}</h3><p>{debriefItemEffect(item)}</p></div><div className="recovery-review-actions">{confirming && !discarded && <button onClick={() => setConfirmDiscardId(null)}>Keep</button>}<button className={`danger ${confirming ? 'confirm' : ''}`} disabled={discarded} onClick={() => { if (!confirming) { setConfirmDiscardId(item.id); return; } onDiscard(item.id); setDiscardedIds(current => current.includes(item.id) ? current : [...current, item.id]); setConfirmDiscardId(null); }}>{discarded ? 'Discarded' : confirming ? 'Confirm discard' : 'Discard'}</button></div></article>; })}</div>
        </section>}
        {nextActions.length > 0 && <div className="debrief-next"><small>NEXT ON QUIET SIGNAL</small>{nextActions.map(action => <span key={action}>{action}</span>)}</div>}
        {result.campaignReward.anomalyRecovered && <div className="anomaly-note"><b>QUARANTINED TRACE RECOVERED</b><span>The sample is physically stable but its non-reflective lattice does not match registered human industrial geometry. It has been isolated rather than integrated into normal equipment.</span></div>}
        {result.storyNote && <div className="anomaly-note"><b>STORY OPERATION UPDATED</b><span>{result.storyNote}</span></div>}
        {result.chapterNote && <div className="anomaly-note"><b>THE BLACK LATTICE UPDATED</b><span>{result.chapterNote}</span></div>}
        {result.postKhepriNote && <div className="anomaly-note"><b>DEAD RECKONING UPDATED</b><span>{result.postKhepriNote}</span></div>}
        {result.interdictionNote && <div className="anomaly-note"><b>INTERDICTION UPDATED</b><span>{result.interdictionNote}</span></div>}
        {result.lootReward.levelsGained > 0 && result.lootReward.profile.level >= 12 && <div className="anomaly-note"><b>LV12 // GENERATION V CALIBRATION</b><span>High-Recovery-Level equipment can now resolve as Generation V frames. Operation Tier and source Recovery Level still determine whether a Gen V frame can actually drop.</span></div>}
        {result.lootReward.levelsGained > 0 && result.lootReward.profile.level >= 13 && <div className="anomaly-note"><b>LV13 // DEAD RECKONING INTERDICTION</b><span>Completed Dead Reckoning evidence can now resolve the custody operators defending the hidden logistics cadence without assigning an unsupported client or origin.</span></div>}
        {result.lootReward.levelsGained > 0 && result.lootReward.profile.level >= 14 && <div className="anomaly-note"><b>LV14 // COMMAND TRACE ARRAY</b><span>Identified Interdiction command targets can now be reconstructed as repeatable source-specific deep hunts. Operation Tier remains independent.</span></div>}
        {result.lootReward.levelsGained > 0 && result.lootReward.profile.level >= 15 && <div className="anomaly-note"><b>LV15 // VECTOR SPECIALIZATION + GENERATION VI</b><span>Choose one deep build identity in Build Bay → Network. RL55+ sources can now resolve Generation VI frames; Gen VI stays on the mature Gen V stat band and expands Augment socket depth instead.</span></div>}
        {result.lootReward.levelsGained > 0 && result.lootReward.profile.level >= 16 && <div className="anomaly-note"><b>LV16 // SPECIALIZATION OVERCLOCK</b><span>Your active Vector Specialization can take an optional second-stage rule with an additional explicit tradeoff. The three-button MAG/MARK/ARC combat language is unchanged.</span></div>}
        {result.escalationNote && <div className="anomaly-note"><b>ESCALATION UPDATED</b><span>{result.escalationNote}</span></div>}
        {result.directiveNote && <div className="anomaly-note"><b>DIRECTIVE ARRAY UPDATED</b><span>{result.directiveNote}</span></div>}
        {result.contract.megastructure && result.expeditionProgress && <div className="anomaly-note"><b>DERELICT EXPEDITION BANKED</b><span>{result.expeditionProgress.zonesCompleted}/{result.contract.megastructureStageCount ?? 4} connected spaces secured · {result.expeditionProgress.optionalRecovered} optional recoveries banked.</span></div>}
        <div className="debrief-actions">
          <button className="primary" onClick={onBuild}>{keptRecoveryCount > 0 ? `Inspect ${keptRecoveryCount} kept item${keptRecoveryCount === 1 ? '' : 's'}` : unspentPoints > 0 ? 'Spend progression points' : 'Open Build Bay'}</button>
          {onRepeat && <button onClick={onRepeat}>Repeat contract</button>}
          <button onClick={onShip}>Return to contract hub</button>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [initialGameState] = useState(() => loadGameState());
  const [profile, setProfile] = useState<PlayerProfile>(initialGameState.profile);
  const [campaign, setCampaign] = useState<CampaignState>(initialGameState.campaign);
  const [operations, setOperations] = useState<OperationsSnapshot | null>(null);
  const [operationsStatus, setOperationsStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [screen, setScreen] = useState<Screen>('ship');
  const contracts = useMemo(() => {
    const story = generateStoryContracts(campaign);
    const chapter = getBlackLatticeContract(campaign);
    const postKhepri = getPostKhepriContract(campaign);
    const interdiction = getInterdictionContract(campaign);
    const commandTraces = getCommandTraceContracts(campaign, profile.level);
    const escalation = generateEscalationContract(campaign);
    const directive = preparedDirectiveContract(campaign);
    const standard = generateContracts(campaign);
    const localContracts = [...(directive ? [directive] : []), ...(escalation ? [escalation] : []), ...commandTraces, ...(interdiction ? [interdiction] : []), ...(postKhepri ? [postKhepri] : []), ...(chapter ? [chapter] : []), ...story, ...standard];
    const available = operations?.operation ? [dailyOperationContract(operations.operation), ...localContracts] : localContracts;
    return available.map(contract => withOperationScaling(contract, campaign, profile.level));
  }, [campaign, operations?.operation, profile.level]);
  const [selectedContractId, setSelectedContractId] = useState(() => contracts[0]?.id ?? '');
  const [newLootIds, setNewLootIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const debriefRunSequenceRef = useRef(0);
  const selectedContract = contracts.find(contract => contract.id === selectedContractId) ?? contracts[0];
  const combatBuild = useMemo(() => applyShipBonuses(deriveCombatBuild(profile), campaign), [profile, campaign]);

  const persistenceWarning = 'LOCAL SAVE FAILED // browser storage is unavailable; current-session progress may not survive a restart.';
  useEffect(() => { if (!saveGameState(profile, campaign)) setStatusMessage(persistenceWarning); }, [profile, campaign]);
  useEffect(() => { setCampaign(current => syncDirectiveAccess(current, profile.level)); }, [profile.level]);
  useEffect(() => { setCampaign(current => syncPostKhepriAccess(current, profile.level)); }, [profile.level, campaign.story.blackLattice.status]);
  useEffect(() => { setCampaign(current => syncInterdictionAccess(current, profile.level)); }, [profile.level, campaign.story.postKhepri.status]);
  useEffect(() => feedback.configure(profile.settings), [profile.settings]);
  useEffect(() => {
    let active = true;
    loadOperationsSnapshot()
      .then(snapshot => { if (active) { setOperations(snapshot); setOperationsStatus('online'); } })
      .catch(() => { if (active) setOperationsStatus('offline'); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!contracts.some(contract => contract.id === selectedContractId) && contracts[0]) setSelectedContractId(contracts[0].id); }, [contracts, selectedContractId]);

  const finishMission = (telemetry: Telemetry, depth: 'safe' | 'deep', salvageTags: number, expeditionProgress?: ExpeditionProgress, fieldLoot: GroundLootReceipt[] = []) => {
    if (!selectedContract) return;
    const debriefRunId = ++debriefRunSequenceRef.current;
    const buildLabel = buildIdentity(profile);
    const baseCampaignReward = settleContract(campaign, selectedContract, depth, salvageTags, expeditionProgress);
    const storyAdvance = advanceStoryAfterContract(baseCampaignReward.campaign, selectedContract, depth);
    const chapterAdvance = advanceBlackLatticeAfterContract(storyAdvance.campaign, selectedContract, depth);
    const postKhepriAdvance = advancePostKhepriAfterContract(chapterAdvance.campaign, selectedContract);
    const interdictionAdvance = advanceInterdictionAfterContract(postKhepriAdvance.campaign, selectedContract);
    const escalationAdvance = advanceEscalationAfterContract(interdictionAdvance.campaign, selectedContract, depth);
    const fullMegastructure = !!selectedContract.megastructure && expeditionProgress?.zonesCompleted === (selectedContract.megastructureStageCount ?? 4);
    const directiveAdvance = advanceDirectivesAfterContract(escalationAdvance.campaign, selectedContract, depth, telemetry, fullMegastructure);
    const narrativeRareTechGain = Math.max(0, directiveAdvance.campaign.resources.rareTech - baseCampaignReward.campaign.resources.rareTech);
    const campaignReward: CampaignReward = { ...baseCampaignReward, gained: narrativeRareTechGain > 0 ? { ...baseCampaignReward.gained, rareTech: baseCampaignReward.gained.rareTech + narrativeRareTechGain } : baseCampaignReward.gained, campaign: directiveAdvance.campaign };
    const lootReward = awardRecovery(profile, telemetry, depth === 'deep' || fullMegastructure, campaign.shipUpgrades.fabrication, {
      deepTarget: selectedContract.deepTarget,
      location: selectedContract.location,
      locationName: selectedContract.locationName,
      faction: selectedContract.sponsor,
      factionReputation: baseCampaignReward.campaign.reputation[selectedContract.sponsor],
      operationTier: selectedContract.operationTier,
      maxRecoveryLevel: selectedContract.maxRecoveryLevel,
      combatEffectiveness: selectedContract.combatEffectiveness,
      threatBudget: selectedContract.threatBudget,
      eliteProtocolCount: telemetry.eliteProtocolsDefeated,
      environmentalComplications: selectedContract.environmentalEventSlots,
      optionalObjectives: expeditionProgress?.optionalRecovered ?? 0,
      actualDepth: depth === 'deep',
      directiveQualityBonus: selectedContract.directiveQualityBonus,
      directiveSingularChanceBonus: selectedContract.directiveSingularChanceBonus,
      directiveRecoveryLevelBonus: selectedContract.directiveRecoveryLevelBonus,
    }, fieldLoot);
    const uplinkStatus: UplinkStatus = profile.settings.telemetrySharing ? 'sharing' : 'local';
    setCampaign(campaignReward.campaign);
    setProfile(lootReward.profile);
    setNewLootIds(lootReward.loot.map(item => item.id));
    setStatusMessage(directiveAdvance.note ?? escalationAdvance.note ?? interdictionAdvance.note ?? postKhepriAdvance.note ?? chapterAdvance.note ?? storyAdvance.note ?? `${selectedContract.title} complete // ${depth === 'deep' ? 'deep' : 'safe'} extraction banked`);
    setDebrief({ runId: debriefRunId, contract: selectedContract, campaignReward, lootReward, uplinkStatus, storyNote: storyAdvance.note, chapterNote: chapterAdvance.note, postKhepriNote: postKhepriAdvance.note, interdictionNote: interdictionAdvance.note, escalationNote: escalationAdvance.note, directiveNote: directiveAdvance.note, protocolValue: telemetry.eliteProtocolsDefeated, expeditionProgress });
    feedback.cue(lootReward.loot.some(item => (item.recoveryQuality ?? 0) >= 4) ? 'rareLoot' : 'loot');
    setScreen('debrief');

    if (profile.settings.telemetrySharing) {
      void uploadRunTelemetry({ contract: selectedContract, telemetry, outcome: depth, salvageTags, level: profile.level, buildLabel, recoveryQualities: lootReward.loot.map(item => item.recoveryQuality ?? 0), modifierGrades: lootReward.loot.flatMap(item => item.modifiers.map(modifier => modifier.grade ?? 3)), singularCount: lootReward.loot.filter(item => item.rarity === 'Singular').length })
        .then(result => {
          setOperations(current => current ? { ...current, metrics: result.metrics } : current);
          setDebrief(current => current?.runId === debriefRunId ? { ...current, uplinkStatus: 'shared' } : current);
        })
        .catch(() => setDebrief(current => current?.runId === debriefRunId ? { ...current, uplinkStatus: 'error' } : current));
    }
  };
  const reportFailedAttempt = (telemetry: Telemetry) => { if (!selectedContract || !profile.settings.telemetrySharing) return; void uploadRunTelemetry({ contract: selectedContract, telemetry, outcome: 'failed', salvageTags: 0, level: profile.level, buildLabel: buildIdentity(profile) }).then(result => setOperations(current => current ? { ...current, metrics: result.metrics } : current)).catch(() => undefined); };
  const abandonMission = () => { setStatusMessage('Mission failed or abandoned // unbanked salvage lost; permanent progression retained. Prepared Directives are not consumed.'); setScreen('ship'); };
  const discardRecoveredItem = (itemId: string) => { setProfile(current => discardItem(current, itemId).profile); setNewLootIds(current => current.filter(id => id !== itemId)); };
  const changeProfileSettings = (settings: Partial<ProfileSettings>) => setProfile(current => setProfileSettings(current, settings));

  const openBuild = () => { void loadArmory(); setScreen('build'); };
  const openCombat = () => { if (!selectedContract) return; void loadGameCanvas(); setScreen('combat'); };

  return <div className="app-shell" data-client-architecture="split-v1" onPointerDownCapture={() => feedback.unlock()} onClickCapture={event => { const target = event.target as HTMLElement; if (target.closest('button') && !target.closest('.game-root')) feedback.cue('ui'); }}>
    <Suspense fallback={<SurfaceLoader screen={screen} />}>
      {screen === 'ship' && <ShipHub profile={profile} campaign={campaign} contracts={contracts} operations={operations} operationsStatus={operationsStatus} telemetrySharing={profile.settings.telemetrySharing} selectedContractId={selectedContract?.id ?? ''} statusMessage={statusMessage} onSelectContract={setSelectedContractId} onDeploy={openCombat} onOpenBuild={openBuild} onCampaignChange={setCampaign} />}
      {screen === 'build' && <Armory profile={profile} campaign={campaign} newLootIds={newLootIds} onProfileChange={setProfile} onCampaignChange={setCampaign} onClose={() => { setNewLootIds([]); setScreen('ship'); }} />}
      {screen === 'combat' && selectedContract && <GameCanvas key={selectedContract.id} build={combatBuild} mission={selectedContract} profileSettings={profile.settings} consumables={campaign.consumables} buildLabel={buildIdentity(profile)} operatorFaction={dominantEquipmentFaction(profile)} onProfileSettingsChange={changeProfileSettings} onConsumablesChange={consumables => setCampaign(current => ({ ...current, consumables }))} onMissionResolve={finishMission} onAttemptFailed={reportFailedAttempt} onReturnToHub={abandonMission} />}
      {screen === 'debrief' && debrief && <DebriefScreen result={debrief} onShip={() => { setNewLootIds([]); setScreen('ship'); }} onBuild={openBuild} onDiscard={discardRecoveredItem} onRepeat={contracts.some(contract => contract.id === debrief.contract.id) ? () => { void loadGameCanvas(); setScreen('combat'); } : undefined} />}
    </Suspense>
  </div>;
}

export default App;
