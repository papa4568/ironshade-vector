from pathlib import Path

hub_path = Path('src/components/ShipHub.tsx')
hub = hub_path.read_text()

old = "import '../part12.css';\nimport DirectivePanel from './DirectivePanel';"
new = "import '../part12.css';\nimport '../commandHub.css';\nimport DirectivePanel from './DirectivePanel';\nimport CommandHubVisual from './CommandHubVisual';\nimport PlayerStatsPanel from './PlayerStatsPanel';"
assert old in hub
hub = hub.replace(old, new, 1)

old = "type Tab = 'contracts' | 'campaign' | 'stories' | 'operations' | 'ship' | 'factions' | 'cargo';"
new = "type Tab = 'overview' | 'contracts' | 'stats' | 'campaign' | 'stories' | 'operations' | 'ship' | 'factions' | 'cargo';"
assert old in hub
hub = hub.replace(old, new, 1)

old = "const [tab, setTab] = useState<Tab>('contracts');"
new = "const [tab, setTab] = useState<Tab>('overview');"
assert old in hub
hub = hub.replace(old, new, 1)

old = "{(['contracts', 'campaign', 'stories', 'operations', 'ship', 'factions', 'cargo'] as Tab[]).map(value => <button key={value} className={tab === value ? 'selected' : ''} onClick={() => switchTab(value)}>{value === 'ship' ? 'ship systems' : value === 'stories' ? 'story operations' : value}</button>)}"
new = "{(['overview', 'contracts', 'stats', 'campaign', 'stories', 'operations', 'ship', 'factions', 'cargo'] as Tab[]).map(value => <button key={value} className={tab === value ? 'selected' : ''} onClick={() => switchTab(value)}>{value === 'overview' ? 'command' : value === 'stats' ? 'player stats' : value === 'ship' ? 'ship systems' : value === 'stories' ? 'story operations' : value}</button>)}"
assert old in hub
hub = hub.replace(old, new, 1)

marker = "    <div className=\"ship-status\" role=\"status\">{message}</div>\n\n    {tab === 'contracts'"
insert = """    <div className=\"ship-status\" role=\"status\">{message}</div>\n\n    {tab === 'overview' && <section className=\"command-overview\"><CommandHubVisual profile={profile} campaign={campaign} /><aside className=\"command-side\"><article className=\"command-card primary-card\"><small>NEXT DEPLOYMENT</small><b>{selected?.title ?? 'No contract selected'}</b><span>{selected ? `OP T${selected.operationTier ?? 1} · ML ${selected.monsterLevel ?? 1} · ${selected.locationName}` : 'Open the Contract Board to choose an operation.'}</span><button onClick={onDeploy} disabled={!selected}>Deploy selected contract</button></article><div className=\"command-nav-grid\"><button onClick={() => switchTab('contracts')}><b>Contracts</b><small>Choose your next operation.</small></button><button onClick={onOpenBuild}><b>Equipment</b><small>Compare gear and tune your build.</small></button><button onClick={() => switchTab('stats')}><b>Player Stats</b><small>See final values with explanations.</small></button><button onClick={() => switchTab('ship')}><b>Ship Systems</b><small>Upgrade Quiet Signal systems.</small></button><button onClick={() => switchTab('cargo')}><b>Cargo</b><small>Buy consumables and inspect supplies.</small></button><button onClick={() => switchTab('campaign')}><b>Campaign</b><small>Review story and long-term objectives.</small></button></div></aside></section>}\n    {tab === 'stats' && <PlayerStatsPanel profile={profile} campaign={campaign} />}\n\n    {tab === 'contracts'"""
assert marker in hub
hub = hub.replace(marker, insert, 1)
hub_path.write_text(hub)

test_path = Path('tests/ui-readability.ts')
test = test_path.read_text()
needle = "const shipHub = read('src/components/ShipHub.tsx');\n"
assert needle in test
test = test.replace(needle, needle + "const statsPanel = read('src/components/PlayerStatsPanel.tsx');\nconst hubVisual = read('src/components/CommandHubVisual.tsx');\nconst hubCss = read('src/commandHub.css');\n", 1)
needle = "assert(shipHub.includes('Frame identities and interactions reveal only after recovery.'), 'Faction panel is missing acquisition-first discovery guidance.');\n"
addition = """assert(shipHub.includes("useState<Tab>('overview')"), 'App does not open on the new command overview.');\nassert(shipHub.includes("switchTab('stats')"), 'Command hub is missing Player Stats navigation.');\nassert(shipHub.includes('CommandHubVisual'), 'Command hub visual is not integrated.');\nassert(shipHub.includes('PlayerStatsPanel'), 'Player stats page is not integrated.');\nassert(statsPanel.includes('Player Stats') && statsPanel.includes('Vacuum resistance') && statsPanel.includes('BURST DPS'), 'Player stats page is missing explained final stats.');\nassert(statsPanel.includes('createSimulation(build)'), 'Stats page is not using the real combat build for final values.');\nassert(hubVisual.includes('MV Quiet Signal') && hubVisual.includes('current operator'), 'Opening hub does not visually represent ship and operator.');\nassert(hubCss.includes('.command-overview') && hubCss.includes('.player-stat-grid'), 'Command hub responsive styling is incomplete.');\n"""
assert needle in test
test = test.replace(needle, needle + addition, 1)
test_path.write_text(test)
print('command hub + stats patch applied')
