import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const boundary = await readFile(new URL('../../src/game/combatGraphicsBackend.ts', import.meta.url), 'utf8');
const aggregator = await readFile(new URL('./architecture-invariants.mjs', import.meta.url), 'utf8');

assert.match(boundary, /createCombatGraphicsRenderSnapshot\(state: SimState\)/);
assert.match(boundary, /return structuredClone\(state\);/);
assert.match(boundary, /snapshotArgs\[0\] = createCombatGraphicsRenderSnapshot\(args\[0\]\);/);
assert.match(boundary, /createCombatGraphicsPlayerSnapshot\(player: Player\)/);
assert.match(boundary, /return structuredClone\(player\);/);
assert.match(boundary, /snapshotArgs\[3\] = createCombatGraphicsPlayerSnapshot\(args\[3\]\);/);
assert.doesNotMatch(boundary, /this\.delegate\.render\(\.\.\.args\)/);
assert.doesNotMatch(boundary, /this\.delegate\.screenDirection\(\.\.\.args\)/);

for (const legacyProof of [
  'renderer-read-only-boundary',
  'renderer-mutation-hardening',
  'renderer-alias-hardening',
  'renderer-alias-edge-hardening',
  'renderer-flow-gap-hardening',
]) {
  assert(!aggregator.includes(legacyProof), `${legacyProof} must not remain a mandatory whole-language proof`);
}

const liveState = {
  player: { hp: 100, position: { x: 4, y: 8 } },
  enemies: [{ hp: 20 }, { hp: 30 }],
  effects: [{ id: 1, strength: 0.5 }],
};
const snapshot = structuredClone(liveState);
assert.notStrictEqual(snapshot, liveState);
assert.notStrictEqual(snapshot.player, liveState.player);
assert.notStrictEqual(snapshot.player.position, liveState.player.position);
assert.notStrictEqual(snapshot.enemies, liveState.enemies);
assert.notStrictEqual(snapshot.enemies[0], liveState.enemies[0]);

const relay = value => value ?? value;
const each = relay(relay(snapshot.enemies.forEach));
each.call(snapshot.enemies, (enemy, index, collection) => {
  enemy.hp = 0;
  if (index === 0) collection.push({ hp: 1 });
});
const reflectedSet = relay(relay(Reflect.set));
const pack = [snapshot.player, 'hp', 0];
reflectedSet.apply(null, pack);
const packAlias = pack;
packAlias[0] = snapshot.player.position;
reflectedSet.apply(null, [packAlias[0], 'x', 99]);

assert.deepEqual(liveState, {
  player: { hp: 100, position: { x: 4, y: 8 } },
  enemies: [{ hp: 20 }, { hp: 30 }],
  effects: [{ id: 1, strength: 0.5 }],
});

console.log('RENDERER_SNAPSHOT_ISOLATION_PASS');
