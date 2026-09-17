import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const armory = read('src/components/Armory.tsx');
const combat = read('src/components/GameCanvas.tsx');
const renderer = read('src/game/threeCombatRenderer.ts');
const css = read('src/readability.css');
const shipHub = read('src/components/ShipHub.tsx');
const statsPanel = read('src/components/PlayerStatsPanel.tsx');
const hubVisual = read('src/components/CommandHubVisual.tsx');
const hubCss = read('src/commandHub.css');
const app = read('src/App.tsx');
const equipmentCss = read('src/equipmentBay.css');
const missionCss = read('src/part4.css');
const objectiveCss = read('src/part7.css');

assert(!armory.includes('Review faction doctrines'), 'Equipment Bay still advertises undiscovered faction doctrine targets.');
assert(!armory.includes('2 PIECE'), 'Equipment Bay still exposes 2-piece set targets.');
assert(!armory.includes('4 PIECE'), 'Equipment Bay still exposes 4-piece set targets.');
assert(!armory.includes('setName'), 'Equipment Bay still renders undiscovered set names.');
assert(armory.includes('PRIMARY EFFECT'), 'Item inspector is missing plain-language quick read.');
assert(armory.includes('RULE-CHANGER'), 'Rarity meaning cues are missing from gear UI.');
assert(armory.includes('activeDoctrineStates'), 'Discovered-only loadout interactions are missing.');

assert(combat.includes('HEALTH EXPOSED'), 'Combat UI does not explicitly call out broken armor and exposed health.');
assert(combat.includes('Focused hostile status'), 'Focused hostile health readout is missing.');
assert(combat.includes('DROP ON DECK'), 'Ground-loot explanation is missing from combat HUD.');
assert(combat.includes('lootLabel(drop.rarity)'), 'High-value ground loot does not receive a readable world label.');
assert(renderer.includes("enemy.role === 'elite' ? 2.2 : 1.9"), 'Three.js hostile bars are still too small for mobile readability.');
assert(renderer.includes('0xff725f') && renderer.includes('0x8ee8ff') && renderer.includes('THREE.AdditiveBlending') && renderer.includes('toneMapped: false'), 'Three.js hostile bars are not using the bright mobile treatment.');
assert(css.includes('.target-readout') && css.includes('.gear-quick-read') && css.includes('.loot-radar'), 'Readability stylesheet is incomplete.');
assert(armory.includes('gear-deep-details') && css.includes('.gear-deep-details'), 'Gear inspector does not separate essential comparison from advanced telemetry.');
assert(equipmentCss.includes('gear-layout.has-selection::before') && equipmentCss.includes('width: min(72vw, 760px)'), 'Landscape mobile gear inspector is missing focused modal treatment.');
assert(equipmentCss.includes('.item-inspector .sheet-close') && equipmentCss.includes('@media (pointer: coarse)'), 'Gear inspector cannot be reliably closed on coarse-pointer landscape devices.');
assert(equipmentCss.includes('MOBILE INSPECTOR SCROLL RELIABILITY') && equipmentCss.includes('touch-action: pan-y') && equipmentCss.includes('-webkit-overflow-scrolling: touch') && equipmentCss.includes('height: calc(100dvh'), 'Mobile gear inspector is not a bounded touch-scroll surface.');
assert(armory.includes('inspector-header') && armory.includes('inspector-scroll') && armory.includes('gear-summary-grid') && armory.includes('impact-stat'), 'Item inspector redesign hierarchy is missing.');
assert(equipmentCss.includes('ITEM INSPECTOR REDESIGN') && equipmentCss.includes('grid-template-rows: auto minmax(0, 1fr) auto') && equipmentCss.includes('.inspector-scroll') && equipmentCss.includes('overflow: hidden'), 'Item inspector is not using the fixed-header/scroll-body/action-dock layout.');
assert(equipmentCss.includes('ITEM INSPECTOR LAZY-CSS CASCADE GUARD') && equipmentCss.includes('.gear-layout .item-inspector.open'), 'Lazy Armory CSS can override the redesigned inspector grid.');
assert(armory.includes("useState<string | null>(null)") && armory.includes("newLootIds.length > 0 ? 'new' : 'all'") && armory.includes('item-inspector-backdrop'), 'Recovered loot should open as a dismissible filtered list rather than trapping the player in an inspector.');
assert(equipmentCss.includes('MOBILE INSPECTOR ESCAPE RELIABILITY') && equipmentCss.includes('.item-inspector-backdrop') && equipmentCss.includes('pointer-events: none'), 'Mobile item inspector backdrop/escape behavior is missing.');
assert(css.includes('DEBRIEF RARITY COLORS') && css.includes('.recovery-review-card.rarity-singular') && css.includes('.recovery-review-card.rarity-prototype'), 'Debrief recovery cards are missing rarity color treatment.');
assert(objectiveCss.includes('MOBILE OBJECTIVE COMPACTNESS OVERRIDE') && objectiveCss.includes('width: min(300px, 34vw)') && objectiveCss.includes('.post-clear-objective small { display: none; }'), 'Post-clear objective guidance can still cover too much of the mobile combat view.');
assert(missionCss.includes('RESPONSIVE MISSION SURFACE RELIABILITY') && missionCss.includes('overflow-y: auto'), 'Combat completion overlays can still extend outside the visible viewport.');
assert(missionCss.includes('place-items: start center') && missionCss.includes('height: 100dvh'), 'Mission debrief can still center oversized content outside the scrollable viewport.');
assert(missionCss.includes('max-height: 900px'), 'Short landscape viewport scaling regression coverage is missing.');
assert(app.includes('RECOVERED EQUIPMENT // REVIEW') && app.includes('Confirm discard'), 'Mission debrief is missing acquired-gear review/discard controls.');
assert(app.includes('discardRecoveredItem') && app.includes('discardItem(current, itemId)'), 'Debrief discard is not wired to persistent profile inventory.');
assert(app.includes('debriefRunSequenceRef') && app.includes('current?.runId === debriefRunId'), 'Telemetry completion can still mutate a later mission debrief.');
assert(app.includes('LOCAL SAVE FAILED') && app.includes('!saveGameState(profile, campaign)') && app.includes("current === persistenceWarning ? '' : current") && shipHub.includes("const displayedStatusMessage = statusMessage ||") && shipHub.includes("role={statusMessage ? 'alert' : 'status'}"), 'Local persistence failures are not surfaced reliably to an already-mounted ShipHub.');
assert(shipHub.includes('traceRequestIdRef') && shipHub.includes('const requestId = ++traceRequestIdRef.current') && shipHub.includes('traceRequestIdRef.current !== requestId'), 'Operations trace loading can still let an older request overwrite a newer selection.');
assert(!shipHub.includes('bossSingularNames'), 'Contract Board still imports unrecovered boss gear names.');
assert(!shipHub.includes('locationSingularNames'), 'Contract Board still imports unrecovered location gear names.');
assert(!shipHub.includes('factionEquipmentNames'), 'Ship UI still exposes unrecovered faction gear names.');
assert(!shipHub.includes('DEDICATED SINGULAR POOL'), 'Contract Board still advertises a named Singular pool.');
assert(!shipHub.includes('LOCATION CHASE POOL'), 'Contract Board still advertises location chase gear before discovery.');
assert(!shipHub.includes('RECOVERY CEILING // RL'), 'Contract Board still leads with opaque recovery-level jargon.');
assert(shipHub.includes('EQUIPMENT RECOVERY'), 'Contract Board is missing the discovery-safe equipment explanation.');
assert(shipHub.includes('Frame identities and interactions reveal only after recovery.'), 'Faction panel is missing acquisition-first discovery guidance.');
assert(shipHub.includes("useState<Tab>('overview')"), 'App does not open on the new command overview.');
assert(shipHub.includes("switchTab('stats')"), 'Command hub is missing Player Stats navigation.');
assert(shipHub.includes('CommandHubVisual'), 'Command hub visual is not integrated.');
assert(shipHub.includes('PlayerStatsPanel'), 'Player stats page is not integrated.');
assert(statsPanel.includes('Current build') && statsPanel.includes('Vacuum resistance') && statsPanel.includes('BURST DPS'), 'Player stats page is missing explained final stats.');
assert(statsPanel.includes('createSimulation(build)'), 'Stats page is not using the real combat build for final values.');
assert(hubVisual.includes('MV Quiet Signal') && hubVisual.includes('current operator'), 'Opening hub does not visually represent ship and operator.');
assert(hubCss.includes('.command-overview') && hubCss.includes('.player-stat-grid'), 'Command hub responsive styling is incomplete.');
assert(!shipHub.includes('No urgent ship tasks'), 'Empty priority chrome is still rendered when nothing needs attention.');
assert(!shipHub.includes('command-nav-grid'), 'Overview still duplicates the full tab navigation.');
assert((statsPanel.match(/Weapon stat glossary/g) ?? []).length === 1, 'Weapon stat help should be shared once, not repeated per weapon.');
assert(!statsPanel.includes('What these numbers mean'), 'Per-weapon duplicate glossary remains.');
assert(armory.includes('compact-discovery') && !armory.includes('Build changes save automatically on this device.'), 'Equipment Bay still shows repetitive instructional/status chrome.');
assert(combat.includes('mission-build-label') && !combat.includes('objectiveStatus.detail : hud.squadRemaining'), 'Combat mission card still duplicates objective guidance.');
assert(combat.includes('hostileRouteMode') && combat.includes('objectiveRouteMode'), 'Combat cleanup guidance is missing obstacle-aware route state.');
assert(shipHub.includes('OPERATOR READINESS') && shipHub.includes('readiness-chip'), 'Contract board is missing visible operator/monster readiness guidance.');
assert(hubCss.includes('PLAYTEST READINESS VISIBILITY') && hubCss.includes('.contract-readiness.high-gap'), 'Contract readiness styling is missing.');
const polishCss = read('src/uiPolish.css');
assert(polishCss.includes('.command-action-row') && polishCss.includes('.stats-help') && polishCss.includes('.compact-discovery'), 'UI polish stylesheet is incomplete.');

const mobileInspectorCss = read('src/part12.css');
assert(mobileInspectorCss.includes('ANDROID ITEM INSPECTOR SINGLE SCROLLER') && mobileInspectorCss.includes('overflow-y: auto') && mobileInspectorCss.includes('.gear-layout .item-inspector.open .inspector-scroll') && mobileInspectorCss.includes('overflow: visible') && mobileInspectorCss.includes('touch-action: auto'), 'Android item inspector still depends on a nested touch-scroll pane.');

console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=strong missionLoot=reviewable hierarchy=polished');
