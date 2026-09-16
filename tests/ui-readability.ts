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
const app = read('src/App.tsx');
const equipmentCss = read('src/equipmentBay.css');

assert(!armory.includes('Review faction doctrines'), 'Equipment Bay still advertises undiscovered faction doctrine targets.');
assert(!armory.includes('2 PIECE'), 'Equipment Bay still exposes 2-piece set targets.');
assert(!armory.includes('4 PIECE'), 'Equipment Bay still exposes 4-piece set targets.');
assert(!armory.includes('setName'), 'Equipment Bay still renders undiscovered set names.');
assert(armory.includes('WHAT THIS ITEM DOES'), 'Item inspector is missing plain-language quick read.');
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
assert(shipHub.includes('UNIDENTIFIED EQUIPMENT RECOVERY'), 'Contract Board is missing the discovery-safe equipment explanation.');
assert(shipHub.includes('Frame identities and interactions reveal only after recovery.'), 'Faction panel is missing acquisition-first discovery guidance.');

console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=strong missionLoot=reviewable gearSheet=compact');
