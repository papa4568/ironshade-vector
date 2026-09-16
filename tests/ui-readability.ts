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
const missionCss = read('src/part4.css');
const objectiveCss = read('src/part7.css');
const gearDetailCss = read('src/gearDetail.css');

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
assert(armory.includes('gear-detail-mode') && armory.includes('gear-detail-screen') && armory.includes('gear-detail-back') && armory.includes('gear-detail-actions'), 'Gear selection is not using the standalone equipment detail screen.');
assert(!armory.includes('item-inspector-backdrop') && !armory.includes("className={'item-inspector "), 'Gear tab still mounts the legacy item inspector overlay.');
assert(armory.includes("newLootIds.length > 0 ? 'new' : 'all'"), 'Recovered loot should still open as a filtered equipment list.');
assert(gearDetailCss.includes('Build Bay remains the only scroll surface') && gearDetailCss.includes('overflow: visible') && !gearDetailCss.includes('position: fixed') && !gearDetailCss.includes('position: sticky'), 'Standalone gear detail must remain in normal document flow without nested or fixed scroll surfaces.');
assert(css.includes('DEBRIEF RARITY COLORS') && css.includes('.recovery-review-card.rarity-singular') && css.includes('.recovery-review-card.rarity-prototype'), 'Debrief recovery cards are missing rarity color treatment.');
assert(objectiveCss.includes('MOBILE OBJECTIVE COMPACTNESS OVERRIDE') && objectiveCss.includes('width: min(300px, 34vw)') && objectiveCss.includes('.post-clear-objective small { display: none; }'), 'Post-clear objective guidance can still cover too much of the mobile combat view.');
assert(missionCss.includes('RESPONSIVE MISSION SURFACE RELIABILITY') && missionCss.includes('overflow-y: auto'), 'Combat completion overlays can still extend outside the visible viewport.');
assert(missionCss.includes('place-items: start center') && missionCss.includes('height: 100dvh'), 'Mission debrief can still center oversized content outside the scrollable viewport.');
assert(missionCss.includes('max-height: 900px'), 'Short landscape viewport scaling regression coverage is missing.');
assert(app.includes('RECOVERED EQUIPMENT // REVIEW') && app.includes('Confirm discard'), 'Mission debrief is missing acquired-gear review/discard controls.');
assert(app.includes('discardRecoveredItem') && app.includes('discardItem(current, itemId)'), 'Debrief discard is not wired to persistent profile inventory.');
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


console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=strong missionLoot=reviewable hierarchy=polished');
