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
        raise SystemExit(f"{path}: expected one match, found {count} for {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# Global readability styles.
replace_once(
    'src/App.tsx',
    "import './equipmentBay.css';",
    "import './equipmentBay.css';\nimport './readability.css';",
)

# Debrief: lead with what an item is and what it changes, not internal recovery jargon.
replace_once(
    'src/App.tsx',
    "type Debrief = { contract: Contract; campaignReward: CampaignReward; lootReward: VictoryReward; uplinkStatus: UplinkStatus; storyNote: string | null; chapterNote: string | null; postKhepriNote: string | null; interdictionNote: string | null; escalationNote: string | null; directiveNote: string | null; protocolValue: number; expeditionProgress?: ExpeditionProgress };  \n",
    """type Debrief = { contract: Contract; campaignReward: CampaignReward; lootReward: VictoryReward; uplinkStatus: UplinkStatus; storyNote: string | null; chapterNote: string | null; postKhepriNote: string | null; interdictionNote: string | null; escalationNote: string | null; directiveNote: string | null; protocolValue: number; expeditionProgress?: ExpeditionProgress };  

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
""",
)
replace_once(
    'src/App.tsx',
    "{result.lootReward.loot.map(item => <span key={item.id} className={`quality-${item.recoveryQuality ?? 0}`}><b>{item.name}</b><em>RQ {item.recoveryQuality ?? 0} // {recoveryQualityLabel(item.recoveryQuality ?? 0)}</em><small>{item.rarity} · RL {item.recoveryLevel ?? 1} · GEN {item.frameGeneration ?? 1} · {item.recoverySource ?? 'Legacy recovery'}</small></span>)}",
    "{result.lootReward.loot.map(item => <span key={item.id} className={`quality-${item.recoveryQuality ?? 0}`}><b>{item.name}</b><em>{item.rarity.toUpperCase()} · {debriefRarityCue(item.rarity)} · {item.slot.toUpperCase()} · EQUIP LV {item.levelRequirement}</em><small>{debriefItemEffect(item)}</small></span>)}",
)

# Equipment Bay: remove future set checklists and reveal only interactions the player has actually activated.
replace_once(
    'src/components/Armory.tsx',
    """function FactionSetOverview({ profile }: { profile: PlayerProfile }) {
  return (
    <section className=\"faction-set-grid\" aria-label=\"Faction equipment doctrines\">
      {factionSetState(profile).map(state => (
        <article key={state.definition.id} className={`faction-set-card faction-${state.definition.id} ${state.twoPieceActive ? 'two-active' : ''} ${state.fourPieceActive ? 'four-active' : ''}`}>
          <header><div><small>{state.definition.displayName.toUpperCase()}</small><b>{state.definition.setName}</b></div><strong>{state.count}/6 EQUIPPED</strong></header>
          <p>{state.definition.philosophy}</p>
          <div className={state.twoPieceActive ? 'active' : ''}><b>2 PIECE</b><span>{state.definition.twoPiece}</span></div>
          <div className={state.fourPieceActive ? 'active' : ''}><b>4 PIECE</b><span>{state.definition.fourPiece}</span></div>
        </article>
      ))}
    </section>
  );
}

""",
    "",
)
replace_once(
    'src/components/Armory.tsx',
    "function qualityClass(item: Item | undefined | null) { return item ? `quality-${item.recoveryQuality ?? 0}` : ''; }\n",
    """function qualityClass(item: Item | undefined | null) { return item ? `quality-${item.recoveryQuality ?? 0}` : ''; }
function rarityCue(item: Item) { if (item.rarity === 'Singular') return 'RULE-CHANGER'; if (item.rarity === 'Prototype') return 'HIGH-END'; if (item.rarity === 'Refined') return 'UPGRADED'; return 'BASELINE'; }
function primaryItemEffect(item: Item) { if (item.singularEffect) return item.singularEffect; const mechanical = item.modifiers.find(modifier => modifier.mechanical); if (mechanical) return `${mechanical.label}: ${mechanical.description}`; const first = item.modifiers[0]; return first ? `${first.label}: ${first.description}` : item.core; }
function shortItemEffect(item: Item) { const text = primaryItemEffect(item); return text.length > 118 ? `${text.slice(0, 115)}…` : text; }
""",
)
replace_once(
    'src/components/Armory.tsx',
    "  const [showDoctrines, setShowDoctrines] = useState(false);\n",
    "",
)
replace_once(
    'src/components/Armory.tsx',
    "  const activeDoctrineCount = doctrineStates.filter(state => state.twoPieceActive).length;\n",
    "  const activeDoctrineStates = doctrineStates.filter(state => state.twoPieceActive);\n",
)
replace_once(
    'src/components/Armory.tsx',
    "  return (\n    <>\n      <div className=\"compare-head\">",
    """  return (
    <>
      <div className=\"gear-quick-read\"><small>WHAT THIS ITEM DOES</small><b>{item.rarity.toUpperCase()} // {rarityCue(item)}</b><span>{primaryItemEffect(item)}</span></div>
      <div className=\"compare-head\">""",
)
replace_once(
    'src/components/Armory.tsx',
    "Counts toward the {factionSetDefinition(item.faction).setName} 2-piece and 4-piece doctrine bonuses.",
    "Recovered {factionLabel(item.faction)} construction. Multi-frame interactions are only revealed here after they become active in your equipped loadout.",
)
replace_once(
    'src/components/Armory.tsx',
    """{tab === 'gear' && <><section className=\"gear-overview-bar\"><div><span className=\"card-kicker\">LOADOUT OVERVIEW</span><b>{activeDoctrineCount > 0 ? `${activeDoctrineCount} faction doctrine${activeDoctrineCount === 1 ? '' : 's'} active` : 'No faction doctrine active yet'}</b><span>Set bonuses update automatically as matching faction frames are equipped.</span></div><button onClick={() => setShowDoctrines(value => !value)}>{showDoctrines ? 'Hide faction doctrines' : 'Review faction doctrines'}</button></section>{showDoctrines && <FactionSetOverview profile={profile} />}<div className={`gear-layout ${selected ? 'has-selection' : ''}`}>
""",
    """{tab === 'gear' && <><section className=\"gear-discovery-note\"><div><span className=\"card-kicker\">EQUIPMENT BAY // DISCOVERY</span><b>Judge recovered gear by what it changes now.</b><span>Undiscovered faction combinations and future set targets are intentionally hidden. Recover gear, equip it, and active interactions will reveal themselves through loadout telemetry.</span></div>{activeDoctrineStates.length > 0 ? <div className=\"discovered-effects\">{activeDoctrineStates.map(state => <article key={state.definition.id} className={`discovered-doctrine faction-${state.definition.id}`}><small>{state.definition.displayName.toUpperCase()} // DISCOVERED</small><b>Active loadout interaction</b><span>{state.definition.twoPiece}</span>{state.fourPieceActive && <span>{state.definition.fourPiece}</span>}</article>)}</div> : <div className=\"discovery-empty\">No multi-frame interaction is active. Nothing is spoiled here before you discover it through recovered equipment.</div>}</section><div className={`gear-layout ${selected ? 'has-selection' : ''}`}>
""",
)
replace_once(
    'src/components/Armory.tsx',
    """<button key={item.id} className={`inventory-card ${selectedId === item.id ? 'selected' : ''} ${rarityClass(item)} ${factionClass(item)} ${qualityClass(item)}`} onClick={() => setSelectedId(item.id)}><div><small>{slotLabels[item.slot]} · {item.rarity} · RQ {item.recoveryQuality ?? 0} · RL {item.recoveryLevel ?? 1} · GEN {item.frameGeneration ?? 1}</small>{item.faction && <em className=\"faction-mark\">{item.faction.toUpperCase()}</em>}{fresh && <em>NEW</em>}</div><b>{item.name}</b><span>{identityDef.name} · Frame Q {item.equipmentQuality ?? 0}/20 · {(item.augments ?? []).length}/{item.augmentSlots ?? 0} Augments</span></button>""",
    """<button key={item.id} className={`inventory-card ${selectedId === item.id ? 'selected' : ''} ${rarityClass(item)} ${factionClass(item)} ${qualityClass(item)}`} onClick={() => setSelectedId(item.id)}><div><small>{slotLabels[item.slot]} · EQUIP LV {item.levelRequirement}</small><em className=\"rarity-pill\">{item.rarity.toUpperCase()} · {rarityCue(item)}</em>{item.faction && <em className=\"faction-mark\">{item.faction.toUpperCase()}</em>}{fresh && <em>NEW</em>}</div><b>{item.name}</b><span className=\"item-effect-preview\">{shortItemEffect(item)}</span><small className=\"item-depth-line\">{identityDef.name} · FRAME Q {item.equipmentQuality ?? 0}/20 · {(item.augments ?? []).length} AUGMENT{(item.augments ?? []).length === 1 ? '' : 'S'} INSTALLED</small></button>""",
)
replace_once(
    'src/components/Armory.tsx',
    "<span className=\"card-kicker\">{selected.faction ? `${factionLabel(selected.faction).toUpperCase()} // ` : ''}{selected.rarity} // RQ {selected.recoveryQuality ?? 0} // EQUIP LV {selected.levelRequirement} // RECOVERY LV {selected.recoveryLevel ?? 1}</span>",
    "<span className=\"card-kicker\">{selected.faction ? `${factionLabel(selected.faction).toUpperCase()} // ` : ''}{selected.rarity.toUpperCase()} // {rarityCue(selected)} // EQUIP LV {selected.levelRequirement}</span>",
)

# Combat labels: clear ground loot meaning and make health the dominant post-armor cue.
replace_once(
    'src/components/GameCanvas.tsx',
    "import { lootColor, type GroundLootReceipt } from '../game/fieldLoot';",
    "import { lootColor, lootLabel, type GroundLootReceipt } from '../game/fieldLoot';",
)
replace_once(
    'src/components/GameCanvas.tsx',
    """for (const drop of state.groundLoot) { if (!drop.active || drop.collected) continue; const pos = project(drop.x, drop.y, camX, camY, width, height); const color = `#${lootColor(drop.rarity).toString(16).padStart(6, '0')}`; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = 0.8 + Math.sin(state.time * 7 + drop.enemyId) * 0.15; ctx.beginPath(); ctx.arc(pos.x, pos.y - 8, drop.rarity === 'Singular' ? 16 : drop.rarity === 'Prototype' ? 12 : 9, 0, Math.PI * 2); ctx.stroke(); ctx.save(); ctx.translate(pos.x, pos.y - 20); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); ctx.globalAlpha = 1; }""",
    """for (const drop of state.groundLoot) { if (!drop.active || drop.collected) continue; const pos = project(drop.x, drop.y, camX, camY, width, height); const color = `#${lootColor(drop.rarity).toString(16).padStart(6, '0')}`; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = 0.82 + Math.sin(state.time * 7 + drop.enemyId) * 0.12; ctx.lineWidth = drop.rarity === 'Singular' ? 3 : 2; ctx.beginPath(); ctx.arc(pos.x, pos.y - 8, drop.rarity === 'Singular' ? 18 : drop.rarity === 'Prototype' ? 14 : 10, 0, Math.PI * 2); ctx.stroke(); ctx.save(); ctx.translate(pos.x, pos.y - 22); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12); ctx.restore(); ctx.globalAlpha = 1; ctx.lineWidth = 1; if (drop.rarity === 'Singular' || drop.rarity === 'Prototype') { ctx.fillStyle = 'rgba(5,8,9,.86)'; ctx.fillRect(pos.x - 52, pos.y - 47, 104, 14); ctx.fillStyle = color; ctx.font = '900 7px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(lootLabel(drop.rarity), pos.x, pos.y - 37); ctx.textAlign = 'left'; } }""",
)
replace_once(
    'src/components/GameCanvas.tsx',
    """drawEnemySilhouette(ctx, enemy, pos); const hpWidth = enemy.role === 'boss' ? 76 : 38; const hpPct = enemy.hp / enemy.maxHp; const armorPct = enemy.maxArmor > 0 ? enemy.armor / enemy.maxArmor : 0; ctx.fillStyle = '#1b2221'; ctx.fillRect(pos.x - hpWidth / 2, pos.y - 52, hpWidth, 4); ctx.fillStyle = '#d48368'; ctx.fillRect(pos.x - hpWidth / 2, pos.y - 52, hpWidth * hpPct, 4); if (enemy.armor > 0) { ctx.fillStyle = '#1b2221'; ctx.fillRect(pos.x - hpWidth / 2, pos.y - 58, hpWidth, 3); ctx.fillStyle = '#6fa2bd'; ctx.fillRect(pos.x - hpWidth / 2, pos.y - 58, hpWidth * armorPct, 3); }""",
    """drawEnemySilhouette(ctx, enemy, pos); const hpWidth = enemy.role === 'boss' ? 96 : enemy.role === 'elite' ? 66 : 54; const hpPct = enemy.hp / enemy.maxHp; const armorPct = enemy.maxArmor > 0 ? enemy.armor / enemy.maxArmor : 0; const healthY = pos.y - 54; ctx.fillStyle = 'rgba(8,11,12,.94)'; ctx.fillRect(pos.x - hpWidth / 2 - 1, healthY - 1, hpWidth + 2, 9); ctx.fillStyle = enemy.armor <= 0 && enemy.maxArmor > 0 ? '#ff8069' : '#dc6758'; ctx.fillRect(pos.x - hpWidth / 2, healthY, hpWidth * hpPct, 7); ctx.strokeStyle = 'rgba(239,244,242,.34)'; ctx.strokeRect(pos.x - hpWidth / 2 - .5, healthY - .5, hpWidth + 1, 8); if (enemy.armor > 0) { ctx.fillStyle = 'rgba(8,11,12,.94)'; ctx.fillRect(pos.x - hpWidth / 2 - 1, pos.y - 63, hpWidth + 2, 6); ctx.fillStyle = '#72bde2'; ctx.fillRect(pos.x - hpWidth / 2, pos.y - 62, hpWidth * armorPct, 4); }""",
)
replace_once(
    'src/components/GameCanvas.tsx',
    """const nearestHostileRange = nearestHostile ? Math.round(Math.hypot(nearestHostile.x - stateRef.current.player.x, nearestHostile.y - stateRef.current.player.y)) : 0; const extractionSweepActive""",
    """const nearestHostileRange = nearestHostile ? Math.round(Math.hypot(nearestHostile.x - stateRef.current.player.x, nearestHostile.y - stateRef.current.player.y)) : 0; const lockedHostile = mobileTargetRef.current == null ? null : stateRef.current.enemies.find(enemy => enemy.id === mobileTargetRef.current && enemy.active && !enemy.dead) ?? null; const focusEnemy = hud.bossActive ? null : (lockedHostile ?? nearestHostile); const nearbyLoot = stateRef.current.groundLoot.filter(drop => drop.active && !drop.collected).sort((a, b) => Math.hypot(a.x - stateRef.current.player.x, a.y - stateRef.current.player.y) - Math.hypot(b.x - stateRef.current.player.x, b.y - stateRef.current.player.y))[0] ?? null; const extractionSweepActive""",
)
replace_once(
    'src/components/GameCanvas.tsx',
    """    <div className=\"hud-top\"><div className=\"vitals\"><div className=\"barline\"><span>HEALTH</span><div className=\"bar\"><i style={{ width: pct(hud.hp, hud.maxHp) }} /></div><b>{Math.ceil(hud.hp)}</b></div><div className=\"barline\"><span>ARMOR</span><div className=\"bar armor\"><i style={{ width: pct(hud.armor, hud.maxArmor) }} /></div><b>{Math.ceil(hud.armor)}</b></div><div className=\"barline\"><span>CAP</span><div className=\"bar capacitor\"><i style={{ width: pct(hud.capacitor, hud.maxCapacitor) }} /></div><b>{Math.ceil(hud.capacitor)}</b></div></div><div className=\"mission-card\"><b>{hud.bossActive ? `${hud.bossLabel.toUpperCase()} // P${hud.bossPhase}` : `${isMegastructure ? `SPACE ${expeditionStageRef.current + 1}/${megastructureStageCount}` : activeMission.archetype.toUpperCase()} // ${hud.kills} KILLS`}</b><span>{hud.pressureState.toUpperCase()} {(hud.pressure * 100).toFixed(0)}% · {hud.gravity.toFixed(2)}G · {hud.bossActive ? 'DEEP ZONE' : !objectiveStatus.complete ? objectiveStatus.detail : hud.squadRemaining > 0 ? `OBJECTIVE SECURED · ${hud.squadRemaining} HOSTILE${hud.squadRemaining === 1 ? '' : 'S'} REMAIN` : 'EXTRACTION READY'}</span></div></div>
""",
    """    <div className=\"hud-top\"><div className=\"vitals\"><div className=\"barline\"><span>HEALTH</span><div className=\"bar\"><i style={{ width: pct(hud.hp, hud.maxHp) }} /></div><b>{Math.ceil(hud.hp)}</b></div><div className=\"barline\"><span>ARMOR</span><div className=\"bar armor\"><i style={{ width: pct(hud.armor, hud.maxArmor) }} /></div><b>{Math.ceil(hud.armor)}</b></div><div className=\"barline\"><span>CAP</span><div className=\"bar capacitor\"><i style={{ width: pct(hud.capacitor, hud.maxCapacitor) }} /></div><b>{Math.ceil(hud.capacitor)}</b></div></div><div className=\"mission-card\"><b>{hud.bossActive ? `${hud.bossLabel.toUpperCase()} // P${hud.bossPhase}` : `${isMegastructure ? `SPACE ${expeditionStageRef.current + 1}/${megastructureStageCount}` : activeMission.archetype.toUpperCase()} // ${hud.kills} KILLS`}</b><span>{hud.pressureState.toUpperCase()} {(hud.pressure * 100).toFixed(0)}% · {hud.gravity.toFixed(2)}G · {hud.bossActive ? 'DEEP ZONE' : !objectiveStatus.complete ? objectiveStatus.detail : hud.squadRemaining > 0 ? `OBJECTIVE SECURED · ${hud.squadRemaining} HOSTILE${hud.squadRemaining === 1 ? '' : 'S'} REMAIN` : 'EXTRACTION READY'}</span></div></div>
    {focusEnemy && !hud.dead && <div className=\"target-readout\" aria-label=\"Focused hostile status\"><header><small>{lockedHostile ? 'TARGET LOCK' : 'NEAREST HOSTILE'}</small><b>{focusEnemy.label.toUpperCase()}</b></header><div className=\"target-health-track\" aria-label=\"Hostile health\"><i style={{ width: pct(focusEnemy.hp, focusEnemy.maxHp) }} /></div>{focusEnemy.armor > 0 && <div className=\"target-armor-track\" aria-label=\"Hostile armor\"><i style={{ width: pct(focusEnemy.armor, focusEnemy.maxArmor) }} /></div>}<div className=\"target-values\"><span>HP {Math.ceil(focusEnemy.hp)} / {Math.ceil(focusEnemy.maxHp)}</span><span className={focusEnemy.maxArmor > 0 && focusEnemy.armor <= 0 ? 'armor-broken' : ''}>{focusEnemy.maxArmor <= 0 ? 'UNARMORED' : focusEnemy.armor > 0 ? `ARMOR ${Math.ceil(focusEnemy.armor)} / ${Math.ceil(focusEnemy.maxArmor)}` : 'ARMOR BROKEN · HEALTH EXPOSED'}</span></div></div>}
    {nearbyLoot && !hud.dead && <div className=\"loot-radar\" style={{ '--loot-color': `#${lootColor(nearbyLoot.rarity).toString(16).padStart(6, '0')}` } as React.CSSProperties} aria-label=\"Nearby equipment drop\"><small>DROP ON DECK</small><b>{lootLabel(nearbyLoot.rarity)}</b><span>Walk over the marker to recover it · ML {nearbyLoot.monsterLevel}</span></div>}
""",
)
replace_once(
    'src/components/GameCanvas.tsx',
    """{hud.bossActive && <div className=\"boss-hud\" aria-label=\"Boss status\"><div className=\"boss-title\"><span>COMMAND // {hud.bossLabel.toUpperCase()}</span><b>PHASE {hud.bossPhase}</b></div><div className=\"boss-bars\"><i className=\"boss-health\" style={{ width: pct(hud.bossHp, hud.bossMaxHp) }} /><i className=\"boss-armor\" style={{ width: pct(hud.bossArmor, hud.bossMaxArmor) }} /></div>{hud.bossPattern !== 'none' && <small>{hud.bossPattern.toUpperCase()} TELEGRAPH</small>}</div>}""",
    """{hud.bossActive && <div className=\"boss-hud\" aria-label=\"Boss status\"><div className=\"boss-title\"><span>COMMAND // {hud.bossLabel.toUpperCase()}</span><b>PHASE {hud.bossPhase}</b></div><div className=\"boss-bars\"><i className=\"boss-health\" style={{ width: pct(hud.bossHp, hud.bossMaxHp) }} /><i className=\"boss-armor\" style={{ width: pct(hud.bossArmor, hud.bossMaxArmor) }} /></div><div className=\"boss-values\"><span>HP {Math.ceil(hud.bossHp)} / {Math.ceil(hud.bossMaxHp)}</span><span className={hud.bossMaxArmor > 0 && hud.bossArmor <= 0 ? 'armor-broken' : ''}>{hud.bossMaxArmor <= 0 ? 'UNARMORED' : hud.bossArmor > 0 ? `ARMOR ${Math.ceil(hud.bossArmor)} / ${Math.ceil(hud.bossMaxArmor)}` : 'ARMOR BROKEN · HEALTH EXPOSED'}</span></div>{hud.bossPattern !== 'none' && <small>{hud.bossPattern.toUpperCase()} TELEGRAPH</small>}</div>}""",
)

# Three.js world-space hostile bars get a larger, high-contrast health channel.
replace_once('src/game/threeCombatRenderer.ts', "const barWidth = enemy.role === 'boss' ? 1.8 : 1.05;", "const barWidth = enemy.role === 'boss' ? 2.3 : enemy.role === 'elite' ? 1.6 : 1.35;")
replace_once('src/game/threeCombatRenderer.ts', "new THREE.PlaneGeometry(barWidth, 0.09)", "new THREE.PlaneGeometry(barWidth, 0.15)")
replace_once('src/game/threeCombatRenderer.ts', "new THREE.PlaneGeometry(barWidth, 0.065), new THREE.MeshBasicMaterial({ color: 0xd48368, depthTest: false })", "new THREE.PlaneGeometry(barWidth, 0.11), new THREE.MeshBasicMaterial({ color: 0xff735f, depthTest: false })")
replace_once('src/game/threeCombatRenderer.ts', "new THREE.PlaneGeometry(barWidth, 0.045), new THREE.MeshBasicMaterial({ color: 0x6fa2bd, depthTest: false })", "new THREE.PlaneGeometry(barWidth, 0.065), new THREE.MeshBasicMaterial({ color: 0x72c7ef, depthTest: false })")
replace_once('src/game/threeCombatRenderer.ts', "armor.position.y = 0.12;", "armor.position.y = 0.16;")
replace_once('src/game/threeCombatRenderer.ts', "const barWidth = enemy.role === 'boss' ? 1.8 : 1.05;\n      visual.hp.scale.x", "const barWidth = enemy.role === 'boss' ? 2.3 : enemy.role === 'elite' ? 1.6 : 1.35;\n      visual.barRoot.scale.setScalar(enemy.maxArmor > 0 && enemy.armor <= 0 ? 1.12 : 1);\n      visual.hp.scale.x")

# Add a focused regression gate for the information hierarchy.
replace_once(
    'package.json',
    '"build": "npm run test:beta && npm run test:gameplay && npm run test:maps && npm run test:loot && vite build",',
    '"build": "npm run test:beta && npm run test:gameplay && npm run test:maps && npm run test:loot && npm run test:ui && vite build",',
)
replace_once(
    'package.json',
    '"test:loot": "vite build --ssr tests/loot-difficulty.ts --outDir .loot-dist && node .loot-dist/loot-difficulty.js"',
    '"test:loot": "vite build --ssr tests/loot-difficulty.ts --outDir .loot-dist && node .loot-dist/loot-difficulty.js",\n    "test:ui": "vite build --ssr tests/ui-readability.ts --outDir .ui-dist && node .ui-dist/ui-readability.js"',
)

print('readability patch applied')
