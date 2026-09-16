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
assert(renderer.includes('0xff4a3d') && renderer.includes('toneMapped: false'), 'Three.js health bar contrast update is missing.');
assert(css.includes('.target-readout') && css.includes('.gear-quick-read') && css.includes('.loot-radar'), 'Readability stylesheet is incomplete.');
assert(armory.includes('gear-deep-details') && css.includes('.gear-deep-details'), 'Gear inspector does not separate essential comparison from advanced telemetry.');
assert(equipmentCss.includes('gear-layout.has-selection::before') && equipmentCss.includes('width: min(72vw, 760px)'), 'Landscape mobile gear inspector is missing focused modal treatment.');
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
const polishCss = read('src/uiPolish.css');
assert(polishCss.includes('.command-action-row') && polishCss.includes('.stats-help') && polishCss.includes('.compact-discovery'), 'UI polish stylesheet is incomplete.');

console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=strong missionLoot=reviewable hierarchy=polished');
