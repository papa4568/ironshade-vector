from pathlib import Path


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    i = text.find(start)
    if i < 0:
        raise SystemExit(f'{label}: start marker not found')
    j = text.find(end, i)
    if j < 0:
        raise SystemExit(f'{label}: end marker not found')
    return text[:i] + replacement + text[j:]

# main.tsx: load polish overrides last.
path = Path('src/main.tsx')
text = path.read_text()
text = replace_exact(text, "import './mobileCombatReadability.css';", "import './mobileCombatReadability.css';\nimport './uiPolish.css';", 'main polish import')
path.write_text(text)

# Ship hub: remove duplicated chrome/navigation and tighten contract information hierarchy.
path = Path('src/components/ShipHub.tsx')
text = path.read_text()
text = replace_exact(text, "import { getEnvironmentalEventForecast, environmentalEventCount } from '../game/environmentalEvents';", "import { getEnvironmentalEventForecast } from '../game/environmentalEvents';", 'environment import')
text = replace_exact(text, "  const tracePolyline = traceRecord?.trace.map(point => `${point.x},${1040 - point.y}`).join(' ') ?? '';", "  const tracePolyline = traceRecord?.trace.map(point => `${point.x},${1040 - point.y}`).join(' ') ?? '';\n  const showStatusMessage = Boolean(message && message !== campaign.lastOutcome);", 'status visibility')
text = replace_exact(
    text,
    '    <header className="ship-header"><div><span className="card-kicker">MV QUIET SIGNAL // CONTRACT HUB</span><h1>Prepare. Choose. Deploy.</h1><p>{buildIdentity(profile)} · Operator level {profile.level} · {campaign.contractsCompleted} contracts banked</p></div><button className="hub-build-button" onClick={onOpenBuild}>Equipment / Build Bay</button></header>',
    '    <header className="ship-header"><div><span className="card-kicker">MV QUIET SIGNAL</span><h1>{tab === \'overview\' ? \'Command deck\' : tab === \'stats\' ? \'Operator telemetry\' : tab === \'contracts\' ? \'Contract board\' : tab === \'ship\' ? \'Ship systems\' : tab === \'cargo\' ? \'Cargo\' : tab === \'campaign\' ? \'Campaign\' : tab === \'stories\' ? \'Story operations\' : tab === \'operations\' ? \'Operations\' : \'Faction network\'}</h1><p>{buildIdentity(profile)} · LV {profile.level} · {campaign.contractsCompleted} contracts</p></div><button className="hub-build-button" onClick={onOpenBuild}>Equipment</button></header>',
    'ship header',
)
text = replace_exact(
    text,
    '    <section className="resource-ribbon" aria-label="Ship resources">{(Object.keys(campaign.resources) as ResourceId[]).map(key => <div key={key} className={key === \'rareTech\' && campaign.resources[key] === 0 ? \'muted-resource\' : \'\'}><small>{resourceLabels[key]}</small><b>{campaign.resources[key]}</b></div>)}</section>',
    '    {tab !== \'cargo\' && <section className="resource-ribbon hub-resource-ribbon" aria-label="Ship resources">{(Object.keys(campaign.resources) as ResourceId[]).map(key => <div key={key} className={key === \'rareTech\' && campaign.resources[key] === 0 ? \'muted-resource\' : \'\'}><small>{resourceLabels[key]}</small><b>{campaign.resources[key]}</b></div>)}</section>}',
    'resource ribbon',
)
priority_start = '    <section className="qol-priority-strip" aria-label="Current priorities">'
nav_start = '    <nav className="ship-tabs" aria-label="Ship areas">'
priority = '''    {attentionCount > 0 && <section className="qol-priority-strip" aria-label="Items needing attention"><div className="qol-priority-copy"><b>{attentionCount} pending</b></div><div className="qol-priority-actions">{profile.progressionPoints > 0 && <button onClick={onOpenBuild}>Network · {profile.progressionPoints}</button>}{chapterProgress.status === 'active' && <button onClick={() => switchTab('campaign')}>Black Lattice · {Math.min(chapterProgress.step + 1, blackLatticeChapter.totalContracts)}/{blackLatticeChapter.totalContracts}</button>}{(postKhepriProgress.status === 'available' || postKhepriProgress.status === 'active') && <button onClick={() => switchTab('campaign')}>Dead Reckoning · {postKhepriProgress.status === 'available' ? 'Ready' : `${Math.min(postKhepriProgress.step + 1, postKhepriChapter.totalContracts)}/${postKhepriChapter.totalContracts}`}</button>}{(interdictionProgress.status === 'available' || interdictionProgress.status === 'active') && <button onClick={() => switchTab('campaign')}>Interdiction · {interdictionProgress.status === 'available' ? 'Ready' : `${Math.min(interdictionProgress.step + 1, interdictionChapter.totalContracts)}/${interdictionChapter.totalContracts}`}</button>}{activeStoryCount > 0 && <button onClick={() => switchTab('stories')}>Stories · {activeStoryCount}</button>}{escalationStatus === 'active' && <button onClick={() => switchTab('operations')}>Escalation · {campaign.escalation.stage + 1}/3</button>}{preparedDirective && <button onClick={() => switchTab('operations')}>Directive · T{preparedDirective.tier}</button>}</div></section>}\n'''
text = replace_between(text, priority_start, nav_start, priority, 'priority strip')
text = replace_exact(
    text,
    '    <nav className="ship-tabs" aria-label="Ship areas">{([\'overview\', \'contracts\', \'stats\', \'campaign\', \'stories\', \'operations\', \'ship\', \'factions\', \'cargo\'] as Tab[]).map(value => <button key={value} className={tab === value ? \'selected\' : \'\'} onClick={() => switchTab(value)}>{value === \'overview\' ? \'command\' : value === \'stats\' ? \'player stats\' : value === \'ship\' ? \'ship systems\' : value === \'stories\' ? \'story operations\' : value}</button>)}</nav>',
    '    <nav className="ship-tabs" aria-label="Ship areas">{([\'overview\', \'contracts\', \'stats\', \'campaign\', \'stories\', \'operations\', \'ship\', \'factions\', \'cargo\'] as Tab[]).map(value => <button key={value} className={tab === value ? \'selected\' : \'\'} onClick={() => switchTab(value)}>{value === \'overview\' ? \'Command\' : value === \'contracts\' ? \'Contracts\' : value === \'stats\' ? \'Stats\' : value === \'campaign\' ? \'Campaign\' : value === \'stories\' ? \'Stories\' : value === \'operations\' ? \'Operations\' : value === \'ship\' ? \'Ship\' : value === \'factions\' ? \'Factions\' : \'Cargo\'}</button>)}</nav>',
    'nav labels',
)
text = replace_exact(text, '    <div className="ship-status" role="status">{message}</div>', '    {showStatusMessage && <div className="ship-status" role="status">{message}</div>}', 'ship status')
old_nav_grid = '<div className="command-nav-grid"><button onClick={() => switchTab(\'contracts\')}><b>Contracts</b><small>Choose your next operation.</small></button><button onClick={onOpenBuild}><b>Equipment</b><small>Compare gear and tune your build.</small></button><button onClick={() => switchTab(\'stats\')}><b>Player Stats</b><small>See final values with explanations.</small></button><button onClick={() => switchTab(\'ship\')}><b>Ship Systems</b><small>Upgrade Quiet Signal systems.</small></button><button onClick={() => switchTab(\'cargo\')}><b>Cargo</b><small>Buy consumables and inspect supplies.</small></button><button onClick={() => switchTab(\'campaign\')}><b>Campaign</b><small>Review story and long-term objectives.</small></button></div>'
new_nav_grid = '<div className="command-action-row"><button onClick={() => switchTab(\'contracts\')}><b>Change contract</b><small>Review the operation board.</small></button><button onClick={onOpenBuild}><b>Tune loadout</b><small>Compare equipment and build choices.</small></button><button onClick={() => switchTab(\'stats\')}><b>Review stats</b><small>See final combat values.</small></button></div>'
text = replace_exact(text, old_nav_grid, new_nav_grid, 'overview duplicate nav')
text = replace_exact(text, '<small>TACTICAL FORECAST // OPERATION TIER {selected.operationTier ?? 1} // {environmentalEventCount} EVENT LIBRARY</small>', '<small>TACTICAL FORECAST</small>', 'forecast heading')
text = replace_exact(
    text,
    '<span>ENCOUNTER RATING // {selected.encounterRating ?? 15}</span><span>THREAT // {selected.threatBudget ?? 32} · {(selected.encounterPattern ?? \'mixed\').toUpperCase()}</span><span>EQUIPMENT // QUALITY RISES WITH OPERATION TIER</span><span>ELITE PROTOCOL CAPACITY // {selected.eliteProtocolSlots ?? 0}</span><span>CLASS MIX // {protocolTierSummary(selected.operationTier ?? 1, selected.eliteProtocolSlots ?? 0)}</span><span>DIRECTOR EVENTS // {selected.environmentalEventSlots ?? 2}</span>',
    '<span>THREAT {selected.encounterRating ?? 15} · {(selected.encounterPattern ?? \'mixed\').toUpperCase()}</span><span>ELITES {selected.eliteProtocolSlots ?? 0} · {protocolTierSummary(selected.operationTier ?? 1, selected.eliteProtocolSlots ?? 0)}</span><span>EVENTS {selected.environmentalEventSlots ?? 2}</span>',
    'forecast chips',
)
text = replace_exact(text, '<small>OPERATION-SCALED SAFE BASELINE</small>', '<small>SAFE EXTRACTION BASELINE</small>', 'reward heading')
old_recovery = '<div className={`faction-armory-preview faction-${selected.sponsor}`}><small>{factionDisplayName(selected.sponsor).toUpperCase()} // RECOVERY SIGNAL</small><b>{selectedFactionSafeChance}% safe · {selectedFactionDeepChance}% deep sponsor-built recovery chance</b><p>Reputation improves sponsor-aligned recovery odds. Frame names, combinations, and fixed-identity gear remain unidentified until you recover them.</p></div><div className="director-box"><small>UNIDENTIFIED EQUIPMENT RECOVERY</small><p>Deep command victories and some locations can produce unusual fixed-identity equipment. Names and effects are revealed only after recovery.</p></div>'
new_recovery = '<div className={`faction-armory-preview faction-${selected.sponsor}`}><small>EQUIPMENT RECOVERY</small><b>{selectedFactionSafeChance}% safe · {selectedFactionDeepChance}% deep sponsor-aligned chance</b><p>Reputation improves sponsor-aligned odds. High-tier and command operations can produce unusual fixed-identity equipment; names and effects stay hidden until recovery.</p></div>'
text = replace_exact(text, old_recovery, new_recovery, 'equipment recovery duplication')
path.write_text(text)

# Player stats: one shared glossary instead of the same explanation under every weapon.
path = Path('src/components/PlayerStatsPanel.tsx')
text = path.read_text()
text = replace_exact(text, '<header className="stats-hero"><div><span className="card-kicker">OPERATOR TELEMETRY // EXPLAINED</span><h2>Player Stats</h2><p>{buildIdentity(profile)} · Level {profile.level} · {profile.runsCompleted} completed runs</p></div>', '<header className="stats-hero"><div><span className="card-kicker">FINAL COMBAT VALUES</span><h2>Current build</h2><p>{buildIdentity(profile)} · Level {profile.level} · {profile.runsCompleted} completed runs</p></div>', 'stats hero')
text = text.replace('Final values after equipped gear, progression and ship bonuses.', 'Includes equipped gear, progression and ship bonuses.')
text = text.replace('<h3>Final weapon telemetry</h3>', '<h3>Weapon telemetry</h3>')
glossary = '<details><summary>What these numbers mean</summary><p><b>Penetration</b> helps shots punch through armor and hard targets. <b>Armor factor</b> multiplies damage dealt specifically to armor. <b>Recoil</b> changes weapon push and handling. Heat accumulation can force venting or downtime.</p></details>'
text = replace_exact(text, glossary, '', 'weapon repeated glossary')
boundary = '</article>; })}</div></section>\n    <section className="stats-section"><div className="stats-section-heading"><div><small>ABILITIES</small>'
replacement = '</article>; })}</div><details className="stats-help"><summary>Weapon stat glossary</summary><p><b>Penetration</b> helps shots punch through armor and hard targets. <b>Armor factor</b> multiplies damage dealt specifically to armor. <b>Recoil</b> changes weapon push and handling. Heat accumulation can force venting or downtime.</p></details></section>\n    <section className="stats-section"><div className="stats-section-heading"><div><small>ABILITIES</small>'
text = replace_exact(text, boundary, replacement, 'shared weapon glossary')
path.write_text(text)

# Equipment Bay: stop repeating discovery policy and rarity cue inside the selected item sheet.
path = Path('src/components/Armory.tsx')
text = path.read_text()
text = replace_exact(text, "  const [message, setMessage] = useState(newLootIds.length > 0 ? `${newLootIds.length} recovered equipment packages added to ship storage.` : 'Build changes save automatically on this device.');", "  const [message, setMessage] = useState(newLootIds.length > 0 ? `${newLootIds.length} recovered equipment packages added to ship storage.` : '');", 'armory initial message')
text = replace_exact(text, '    <div className="build-message" role="status">{message}</div>', '    {message && <div className="build-message" role="status">{message}</div>}', 'armory status')
text = replace_exact(text, '<div className="gear-quick-read"><small>WHAT THIS ITEM DOES</small><b>{item.rarity.toUpperCase()} // {rarityCue(item)}</b><span>{primaryItemEffect(item)}</span></div>', '<div className="gear-quick-read"><small>PRIMARY EFFECT</small><span>{primaryItemEffect(item)}</span></div>', 'gear quick read')
start = "    {tab === 'gear' && <><section className=\"gear-discovery-note\">"
end = '<div className={`gear-layout ${selected ? \'has-selection\' : \'\'}`}>'
new_discovery = '''    {tab === 'gear' && <><section className="gear-discovery-note compact-discovery"><details><summary>How equipment discovery works</summary><p>Undiscovered frame interactions remain hidden until you recover and equip the relevant gear. The bay only reveals effects your current collection has actually discovered.</p></details>{activeDoctrineStates.length > 0 && <div className="discovered-effects">{activeDoctrineStates.map(state => <article key={state.definition.id} className={`discovered-doctrine faction-${state.definition.id}`}><small>{state.definition.displayName.toUpperCase()} // DISCOVERED</small><b>Active loadout interaction</b><span>{state.definition.twoPiece}</span>{state.fourPieceActive && <span>{state.definition.fourPiece}</span>}</article>)}</div>}</section>'''
text = replace_between(text, start, end, new_discovery, 'compact discovery note')
text = replace_exact(text, '<div className="loadout-heading"><div><small>EQUIPPED LOADOUT</small><b>Six-slot operator kit</b></div><span><strong>{equippedSlotCount}/6 equipped</strong> · Tap a frame to inspect or compare.</span></div>', '<div className="loadout-heading"><div><small>LOADOUT</small><b>{equippedSlotCount}/6 equipped</b></div><span>Tap a slot to inspect or compare.</span></div>', 'loadout heading')
path.write_text(text)

# Combat HUD: objective belongs in the objective chip, not repeated in the mission card.
path = Path('src/components/GameCanvas.tsx')
text = path.read_text()
text = replace_exact(text, '<div className="mission-chip">OP T{activeMission.operationTier ?? 1} // ML {activeMission.monsterLevel ?? 1} // {activeMission.locationName.toUpperCase()} // {isMegastructure ? `DERELICT ${expeditionStageRef.current + 1}/${megastructureStageCount}` : activeMission.archetype.toUpperCase()} // {buildLabel.toUpperCase()}</div>', '<div className="mission-chip">OP T{activeMission.operationTier ?? 1} // ML {activeMission.monsterLevel ?? 1} // {activeMission.locationName.toUpperCase()} <span className="mission-build-label">// {buildLabel.toUpperCase()}</span></div>', 'mission chip')
old_card = '<div className="mission-card"><b>{hud.bossActive ? `${hud.bossLabel.toUpperCase()} // P${hud.bossPhase}` : `${isMegastructure ? `SPACE ${expeditionStageRef.current + 1}/${megastructureStageCount}` : activeMission.archetype.toUpperCase()} // ${hud.kills} KILLS`}</b><span>{hud.pressureState.toUpperCase()} {(hud.pressure * 100).toFixed(0)}% · {hud.gravity.toFixed(2)}G · {hud.bossActive ? \'DEEP ZONE\' : !objectiveStatus.complete ? objectiveStatus.detail : hud.squadRemaining > 0 ? `OBJECTIVE SECURED · ${hud.squadRemaining} HOSTILE${hud.squadRemaining === 1 ? \'\' : \'S\'} REMAIN` : \'EXTRACTION READY\'}</span></div>'
new_card = '<div className="mission-card"><b>{hud.bossActive ? `${hud.bossLabel.toUpperCase()} // P${hud.bossPhase}` : isMegastructure ? `SPACE ${expeditionStageRef.current + 1}/${megastructureStageCount} // ${hud.squadRemaining} HOSTILES` : `${hud.kills} KILLS // ${hud.squadRemaining} HOSTILES`}</b><span>{hud.pressureState.toUpperCase()} {(hud.pressure * 100).toFixed(0)}% · {hud.gravity.toFixed(2)}G{hud.bossActive ? \' · DEEP ZONE\' : \'\'}</span></div>'
text = replace_exact(text, old_card, new_card, 'mission card')
path.write_text(text)

# UI regression expectations for the polish pass.
path = Path('tests/ui-readability.ts')
text = path.read_text()
text = replace_exact(text, "assert(armory.includes('WHAT THIS ITEM DOES'), 'Item inspector is missing plain-language quick read.');", "assert(armory.includes('PRIMARY EFFECT'), 'Item inspector is missing plain-language quick read.');", 'ui test quick read')
text = replace_exact(text, "assert(shipHub.includes('UNIDENTIFIED EQUIPMENT RECOVERY'), 'Contract Board is missing the discovery-safe equipment explanation.');", "assert(shipHub.includes('EQUIPMENT RECOVERY'), 'Contract Board is missing the discovery-safe equipment explanation.');", 'ui test equipment recovery')
insert = "assert(hubCss.includes('.command-overview') && hubCss.includes('.player-stat-grid'), 'Command hub responsive styling is incomplete.');"
extra = """assert(hubCss.includes('.command-overview') && hubCss.includes('.player-stat-grid'), 'Command hub responsive styling is incomplete.');
assert(!shipHub.includes('No urgent ship tasks'), 'Empty priority chrome is still rendered when nothing needs attention.');
assert(!shipHub.includes('command-nav-grid'), 'Overview still duplicates the full tab navigation.');
assert((statsPanel.match(/Weapon stat glossary/g) ?? []).length === 1, 'Weapon stat help should be shared once, not repeated per weapon.');
assert(!statsPanel.includes('What these numbers mean'), 'Per-weapon duplicate glossary remains.');
assert(armory.includes('compact-discovery') && !armory.includes('Build changes save automatically on this device.'), 'Equipment Bay still shows repetitive instructional/status chrome.');
assert(combat.includes('mission-build-label') && !combat.includes('objectiveStatus.detail : hud.squadRemaining'), 'Combat mission card still duplicates objective guidance.');
const polishCss = read('src/uiPolish.css');
assert(polishCss.includes('.command-action-row') && polishCss.includes('.stats-help') && polishCss.includes('.compact-discovery'), 'UI polish stylesheet is incomplete.');"""
text = replace_exact(text, insert, extra, 'ui polish assertions')
text = text.replace("console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=strong missionLoot=reviewable gearSheet=compact');", "console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=strong missionLoot=reviewable hierarchy=polished');")
path.write_text(text)

print('UI polish patch applied')
