from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count} for {old[:140]!r}')
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected one regex match for {pattern[:140]!r}')
    write(path, next_text)


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        raise SystemExit(f'{path}: marker already present: {marker}')
    write(path, text.rstrip() + '\n\n' + block.strip() + '\n')


# Mission debrief: recovered gear is reviewed and can be discarded before leaving.
replace_once(
    'src/App.tsx',
    "import { awardRecovery, buildIdentity, deriveCombatBuild, dominantEquipmentFaction, loadProfile, saveProfile, setProfileSettings, type PlayerProfile, type ProfileSettings, type VictoryReward } from './game/meta';",
    "import { awardRecovery, buildIdentity, deriveCombatBuild, discardItem, dominantEquipmentFaction, loadProfile, saveProfile, setProfileSettings, type PlayerProfile, type ProfileSettings, type VictoryReward } from './game/meta';",
)
replace_once(
    'src/App.tsx',
    "function DebriefScreen({ result, onShip, onBuild, onRepeat }: { result: Debrief; onShip: () => void; onBuild: () => void; onRepeat?: () => void }) {\n  const gained =",
    "function DebriefScreen({ result, onShip, onBuild, onRepeat, onDiscard }: { result: Debrief; onShip: () => void; onBuild: () => void; onRepeat?: () => void; onDiscard: (itemId: string) => void }) {\n  const [discardedIds, setDiscardedIds] = useState<string[]>([]);\n  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);\n  const gained =",
)
replace_once(
    'src/App.tsx',
    "  const newRecoveryCount = result.lootReward.loot.length;\n  const unspentPoints = result.lootReward.profile.progressionPoints;",
    "  const newRecoveryCount = result.lootReward.loot.length;\n  const keptRecoveryCount = result.lootReward.loot.filter(item => !discardedIds.includes(item.id)).length;\n  const unspentPoints = result.lootReward.profile.progressionPoints;",
)
replace_once(
    'src/App.tsx',
    "  if (newRecoveryCount > 0) nextActions.push(`${newRecoveryCount} recovered equipment package${newRecoveryCount === 1 ? '' : 's'} ready to compare.`);",
    "  if (keptRecoveryCount > 0) nextActions.push(`${keptRecoveryCount} recovered equipment package${keptRecoveryCount === 1 ? '' : 's'} kept in ship storage.`);",
)
replace_once(
    'src/App.tsx',
    "        <div className=\"recovery-list\" aria-label=\"Recovered equipment\">\n          {result.lootReward.loot.map(item => <span key={item.id} className={`quality-${item.recoveryQuality ?? 0}`}><b>{item.name}</b><em>{item.rarity.toUpperCase()} · {debriefRarityCue(item.rarity)} · {item.slot.toUpperCase()} · EQUIP LV {item.levelRequirement}</em><small>{debriefItemEffect(item)}</small></span>)}\n        </div>",
    """        {newRecoveryCount > 0 && <section className=\"recovery-review\" aria-label=\"Recovered equipment review\">\n          <header className=\"recovery-review-heading\"><div><small>RECOVERED EQUIPMENT // REVIEW</small><b>Keep what matters. Discard what does not.</b></div><span>{keptRecoveryCount} kept · {discardedIds.length} discarded</span></header>\n          <div className=\"recovery-review-grid\">{result.lootReward.loot.map(item => { const discarded = discardedIds.includes(item.id); const confirming = confirmDiscardId === item.id; return <article key={item.id} className={`recovery-review-card quality-${item.recoveryQuality ?? 0} rarity-${item.rarity.toLowerCase()} ${discarded ? 'discarded' : ''}`}><div className=\"recovery-review-copy\"><div className=\"recovery-review-meta\"><small>{item.rarity.toUpperCase()} · {debriefRarityCue(item.rarity)} · {item.slot.toUpperCase()} · EQUIP LV {item.levelRequirement}</small><strong>{discarded ? 'DISCARDED' : 'KEPT IN STORAGE'}</strong></div><h3>{item.name}</h3><p>{debriefItemEffect(item)}</p></div><div className=\"recovery-review-actions\">{confirming && !discarded && <button onClick={() => setConfirmDiscardId(null)}>Keep</button>}<button className={`danger ${confirming ? 'confirm' : ''}`} disabled={discarded} onClick={() => { if (!confirming) { setConfirmDiscardId(item.id); return; } onDiscard(item.id); setDiscardedIds(current => current.includes(item.id) ? current : [...current, item.id]); setConfirmDiscardId(null); }}>{discarded ? 'Discarded' : confirming ? 'Confirm discard' : 'Discard'}</button></div></article>; })}</div>\n        </section>}""",
)
replace_once(
    'src/App.tsx',
    "          <button className=\"primary\" onClick={onBuild}>{newRecoveryCount > 0 ? `Inspect ${newRecoveryCount} recovered item${newRecoveryCount === 1 ? '' : 's'}` : unspentPoints > 0 ? 'Spend progression points' : 'Open Build Bay'}</button>",
    "          <button className=\"primary\" onClick={onBuild}>{keptRecoveryCount > 0 ? `Inspect ${keptRecoveryCount} kept item${keptRecoveryCount === 1 ? '' : 's'}` : unspentPoints > 0 ? 'Spend progression points' : 'Open Build Bay'}</button>",
)
replace_once(
    'src/App.tsx',
    "  const changeProfileSettings = (settings: Partial<ProfileSettings>) => setProfile(current => setProfileSettings(current, settings));",
    "  const discardRecoveredItem = (itemId: string) => { setProfile(current => discardItem(current, itemId).profile); setNewLootIds(current => current.filter(id => id !== itemId)); };\n  const changeProfileSettings = (settings: Partial<ProfileSettings>) => setProfile(current => setProfileSettings(current, settings));",
)
replace_once(
    'src/App.tsx',
    "    {screen === 'debrief' && debrief && <DebriefScreen result={debrief} onShip={() => { setNewLootIds([]); setScreen('ship'); }} onBuild={() => setScreen('build')} onRepeat={contracts.some(contract => contract.id === debrief.contract.id) ? () => setScreen('combat') : undefined} />}",
    "    {screen === 'debrief' && debrief && <DebriefScreen result={debrief} onShip={() => { setNewLootIds([]); setScreen('ship'); }} onBuild={() => setScreen('build')} onDiscard={discardRecoveredItem} onRepeat={contracts.some(contract => contract.id === debrief.contract.id) ? () => setScreen('combat') : undefined} />}",
)

# Gear inspector: essential comparison first, advanced telemetry on demand.
replace_once(
    'src/components/Armory.tsx',
    "      <div className={`recovery-quality ${qualityClass(item)}`}><b>RECOVERY QUALITY {item.recoveryQuality ?? 0} // {recoveryQualityLabel(item.recoveryQuality ?? 0).toUpperCase()}</b><span>SOURCE // {item.recoverySource ?? 'Legacy recovery'}</span></div>",
    "      <details className=\"gear-deep-details\"><summary>Advanced frame details</summary>\n      <div className={`recovery-quality ${qualityClass(item)}`}><b>RECOVERY QUALITY {item.recoveryQuality ?? 0} // {recoveryQualityLabel(item.recoveryQuality ?? 0).toUpperCase()}</b><span>SOURCE // {item.recoverySource ?? 'Legacy recovery'}</span></div>",
)
replace_once(
    'src/components/Armory.tsx',
    "      <div className=\"modifier-columns\"><ModifierGroup item={item} family=\"core\" /><ModifierGroup item={item} family=\"systems\" /></div>",
    "      <div className=\"modifier-columns\"><ModifierGroup item={item} family=\"core\" /><ModifierGroup item={item} family=\"systems\" /></div>\n      </details>",
)

# World-space hostile bars: thick, separated HP + armor tracks that remain readable together.
regex_once(
    'src/game/threeCombatRenderer.ts',
    r"    const barRoot = new THREE\.Group\(\);\n    const barWidth = enemy\.role === 'boss' \? 2\.3 : enemy\.role === 'elite' \? 1\.6 : 1\.35;.*?    barRoot\.add\(armor\);\n",
    """    const barRoot = new THREE.Group();
    const barWidth = enemy.role === 'boss' ? 3.0 : enemy.role === 'elite' ? 2.2 : 1.9;
    const hpBack = new THREE.Mesh(new THREE.PlaneGeometry(barWidth + 0.1, 0.24), new THREE.MeshBasicMaterial({ color: 0x050707, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false, toneMapped: false }));
    hpBack.position.y = -0.04;
    hpBack.renderOrder = 30;
    barRoot.add(hpBack);
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.16), new THREE.MeshBasicMaterial({ color: 0xff4a3d, depthTest: false, depthWrite: false, toneMapped: false }));
    hp.position.y = -0.04;
    hp.position.z = 0.003;
    hp.renderOrder = 32;
    barRoot.add(hp);
    if (enemy.maxArmor > 0) {
      const armorBack = new THREE.Mesh(new THREE.PlaneGeometry(barWidth + 0.1, 0.15), new THREE.MeshBasicMaterial({ color: 0x050707, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false, toneMapped: false }));
      armorBack.position.y = 0.18;
      armorBack.renderOrder = 30;
      barRoot.add(armorBack);
    }
    const armor = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.09), new THREE.MeshBasicMaterial({ color: 0x6fd2ff, depthTest: false, depthWrite: false, toneMapped: false }));
    armor.position.y = 0.18;
    armor.position.z = 0.004;
    armor.renderOrder = 33;
    armor.visible = enemy.maxArmor > 0;
    barRoot.add(armor);
""",
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "      const barWidth = enemy.role === 'boss' ? 2.3 : enemy.role === 'elite' ? 1.6 : 1.35;",
    "      const barWidth = enemy.role === 'boss' ? 3.0 : enemy.role === 'elite' ? 2.2 : 1.9;",
)
replace_once(
    'src/game/threeCombatRenderer.ts',
    "      visual.barRoot.scale.setScalar(enemy.maxArmor > 0 && enemy.armor <= 0 ? 1.12 : 1);",
    "      visual.barRoot.scale.setScalar(enemy.id === mobileTargetId ? 1.18 : enemy.maxArmor > 0 && enemy.armor <= 0 ? 1.12 : 1);\n      visual.hp.material.color.setHex(enemy.maxArmor > 0 && enemy.armor <= 0 ? 0xff6557 : 0xff4a3d);",
)

append_once(
    'src/readability.css',
    '/* Mobile clarity + recovery review follow-up */',
    r'''/* Mobile clarity + recovery review follow-up */
.target-health-track { height: 14px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18), 0 0 12px rgba(222,77,62,.12); }
.target-armor-track { height: 7px; }
.target-health-track i { background: linear-gradient(90deg,#d54036,#ff7566); }
.target-armor-track i { background: linear-gradient(90deg,#4e9ccc,#7dd9ff); }

.gear-deep-details {
  margin: 10px 0 0;
  border: 1px solid #293936;
  border-radius: 9px;
  background: rgba(5,10,10,.72);
}
.gear-deep-details > summary {
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 9px 11px;
  color: #a9bbb5;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: .08em;
  cursor: pointer;
  list-style: none;
}
.gear-deep-details > summary::-webkit-details-marker { display: none; }
.gear-deep-details > summary::after { content: 'SHOW'; margin-left: auto; color: #6f8d84; font-size: 7px; }
.gear-deep-details[open] > summary::after { content: 'HIDE'; }
.gear-deep-details[open] > summary { border-bottom: 1px solid #24332f; }
.gear-deep-details > :not(summary) { margin-left: 9px; margin-right: 9px; }
.gear-deep-details > :last-child { margin-bottom: 9px; }

.recovery-review {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #334a43;
  border-radius: 12px;
  background: linear-gradient(145deg,rgba(12,22,20,.96),rgba(6,10,10,.97));
}
.recovery-review-heading,
.recovery-review-meta,
.recovery-review-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.recovery-review-heading small,
.recovery-review-heading b { display: block; }
.recovery-review-heading small { color:#7f9c92; font-size:7px; font-weight:900; letter-spacing:.12em; }
.recovery-review-heading b { margin-top:4px; color:#d2ddd9; font-size:12px; }
.recovery-review-heading > span { color:#91a69f; font-size:8px; font-weight:800; }
.recovery-review-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin-top:10px; }
.recovery-review-card {
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  gap:12px;
  padding:11px 12px;
  border:1px solid var(--gear-rarity-border,rgba(108,139,129,.5));
  border-radius:10px;
  background:linear-gradient(135deg,var(--gear-rarity-wash,rgba(65,90,82,.15)),rgba(8,13,13,.94));
}
.recovery-review-card.discarded { opacity:.48; filter:saturate(.45); }
.recovery-review-meta small { color:var(--gear-rarity,#aab8b4); font-size:7px; font-weight:900; letter-spacing:.05em; }
.recovery-review-meta strong { color:#9db2aa; font-size:7px; white-space:nowrap; }
.recovery-review-copy h3 { margin:7px 0 4px; color:var(--gear-rarity,#d0d9d6); font-size:14px; }
.recovery-review-copy p { margin:0; color:#aabbb5; font-size:9px; line-height:1.35; }
.recovery-review-actions { align-self:end; justify-content:flex-end; }
.recovery-review-actions button { min-height:38px; padding:8px 10px; border-radius:8px; }
.recovery-review-actions .danger { border:1px solid #6d3731; background:#291514; color:#efaea3; }
.recovery-review-actions .danger.confirm { border-color:#b25345; background:#54231e; color:#ffd3ca; }

@media (pointer: coarse), (max-width: 900px) {
  .target-health-track { height: 13px; }
  .target-armor-track { height: 7px; }
  .recovery-review-grid { grid-template-columns:1fr; }
}
@media (orientation: landscape) and (max-height: 650px) {
  .target-readout { background:rgba(5,8,9,.96); }
  .target-health-track { height: 13px; }
  .recovery-review { padding:9px; }
  .recovery-review-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
  .recovery-review-card { padding:9px 10px; }
}''',
)

append_once(
    'src/equipmentBay.css',
    '/* Mobile inspector focus follow-up */',
    r'''/* Mobile inspector focus follow-up */
@media (max-width: 1100px) {
  .gear-layout.has-selection::before {
    content: '';
    position: fixed;
    z-index: 59;
    inset: 0;
    background: rgba(0,0,0,.68);
    backdrop-filter: blur(2px);
  }
  .item-inspector.open {
    z-index: 70;
    background: #07100e;
    border-color: #678b80;
    box-shadow: 0 -24px 90px rgba(0,0,0,.88);
  }
  .item-inspector > p,
  .compare-head > div > span,
  .compare-line > span { color:#a9bbb5; }
  .compare-head > div { background:#0b1513; }
  .inspector-actions { background:linear-gradient(180deg,rgba(7,16,14,.96),#07100e 35%); }
}

@media (orientation: landscape) and (max-height: 650px) {
  .item-inspector,
  .gear-layout:not(.has-selection) .item-inspector {
    top: max(8px, env(safe-area-inset-top));
    right: max(8px, env(safe-area-inset-right));
    bottom: max(8px, env(safe-area-inset-bottom));
    width: min(72vw, 760px);
    max-width: calc(100vw - 16px - env(safe-area-inset-left) - env(safe-area-inset-right));
    padding: 12px 13px;
    background: #07100e;
    border-radius: 12px;
  }
  .item-inspector h2 { font-size: 21px; line-height:1.05; }
  .item-inspector > p { color:#a9bbb5; font-size:9px; line-height:1.3; }
  .sheet-close { min-height:32px; padding:5px 8px; background:#13201d; }
  .compare-head > div { padding:8px 9px; }
  .compare-head > div > span { font-size:8px; line-height:1.3; }
  .compare-stats { margin-top:6px; }
  .compare-line { min-height:28px; }
  .gear-quick-read { margin:7px 0; padding:9px 10px; }
  .gear-deep-details { margin-top:7px; }
  .gear-deep-details > summary { min-height:36px; padding:7px 9px; }
  .inspector-actions { margin:8px -13px -12px; }
}''',
)

# Regression coverage for the screenshots and debrief flow.
replace_once(
    'tests/ui-readability.ts',
    "const shipHub = read('src/components/ShipHub.tsx');",
    "const shipHub = read('src/components/ShipHub.tsx');\nconst app = read('src/App.tsx');\nconst equipmentCss = read('src/equipmentBay.css');",
)
replace_once(
    'tests/ui-readability.ts',
    "assert(renderer.includes(\"enemy.role === 'elite' ? 1.6 : 1.35\"), 'Three.js hostile bars were not enlarged for readability.');\nassert(renderer.includes('0xff735f'), 'Three.js health bar contrast update is missing.');",
    "assert(renderer.includes(\"enemy.role === 'elite' ? 2.2 : 1.9\"), 'Three.js hostile bars are still too small for mobile readability.');\nassert(renderer.includes('0xff4a3d') && renderer.includes('toneMapped: false'), 'Three.js health bar contrast update is missing.');",
)
replace_once(
    'tests/ui-readability.ts',
    "assert(css.includes('.target-readout') && css.includes('.gear-quick-read') && css.includes('.loot-radar'), 'Readability stylesheet is incomplete.');",
    "assert(css.includes('.target-readout') && css.includes('.gear-quick-read') && css.includes('.loot-radar'), 'Readability stylesheet is incomplete.');\nassert(armory.includes('gear-deep-details') && css.includes('.gear-deep-details'), 'Gear inspector does not separate essential comparison from advanced telemetry.');\nassert(equipmentCss.includes('gear-layout.has-selection::before') && equipmentCss.includes('width: min(72vw, 760px)'), 'Landscape mobile gear inspector is missing focused modal treatment.');\nassert(app.includes('RECOVERED EQUIPMENT // REVIEW') && app.includes('Confirm discard'), 'Mission debrief is missing acquired-gear review/discard controls.');\nassert(app.includes('discardRecoveredItem') && app.includes('discardItem(current, itemId)'), 'Debrief discard is not wired to persistent profile inventory.');",
)
replace_once(
    'tests/ui-readability.ts',
    "console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=visible loot=explained');",
    "console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=strong missionLoot=reviewable gearSheet=compact');",
)

print('mobile clarity + recovery review patch applied')
