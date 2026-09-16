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
assert(renderer.includes("enemy.role === 'elite' ? 1.6 : 1.35"), 'Three.js hostile bars were not enlarged for readability.');
assert(renderer.includes('0xff735f'), 'Three.js health bar contrast update is missing.');
assert(css.includes('.target-readout') && css.includes('.gear-quick-read') && css.includes('.loot-radar'), 'Readability stylesheet is incomplete.');

console.log('UI_READABILITY_PASS discovery=hidden targetHp=visible loot=explained');
