import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateRendererFlowGapHardening } from '../tools/check-renderer-flow-gap-hardening.mjs';

const root = await mkdtemp(join(tmpdir(), 'ao6-flow-gap-hardening-'));
const rule = { id: 'renderer-sim-import-boundary', file: 'renderer.ts', module: './sim', readOnlyStateTypes: ['SimState'], mutableStateOwnerFiles: {} };

async function expectRejected(source, pattern) {
  await writeFile(join(root, 'mutator.ts'), source);
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './mutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererFlowGapHardening(rule, { root }), pattern);
}

try {
  await writeFile(join(root, 'sim.ts'), "export type SimState = { player: { hp: number }; enemies: { hp: number }[] };\n");

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const each = state.enemies.forEach; each.call(state.enemies, (_enemy, _index, collection) => { collection.push({ hp: 1 }); }); }\n",
    /mutating method push/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const each = state.enemies.forEach.bind(state.enemies); each((_enemy, _index, collection) => { collection.pop(); }); }\n",
    /mutating method pop/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { let each: typeof state.enemies.forEach; each = state.enemies.forEach; const packed = [(_enemy: { hp: number }, _index: number, collection: { hp: number }[]) => { collection.push({ hp: 1 }); }]; each.apply(state.enemies, packed); }\n",
    /mutating method push/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nfunction relay<T>(value: T): T { let forwarded: T; forwarded = value; return forwarded; }\nexport function mutate(state: SimState) { relay(state.player).hp = 0; }\n",
    /direct mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const view = { hp: 7 }; const args: [object, PropertyKey, unknown] = [view, 'hp', 0]; args[0] = state.player; Reflect.set.apply(null, [...args]); }\n",
    /argument pack cannot be proven stable/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { let args: [object, PropertyKey, unknown] = [{ hp: 7 }, 'hp', 0]; args = [state.player, 'hp', 0]; Reflect.set.apply(null, args); }\n",
    /argument pack cannot be proven stable/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const args: [object, PropertyKey, unknown] = [{ hp: 7 }, 'hp', 0]; const alias = args; alias[0] = state.player; Reflect.set.apply(null, args); }\n",
    /argument pack cannot be proven stable/,
  );

  await writeFile(join(root, 'safe.ts'), "import type { SimState } from './sim';\nfunction relayCopy<T extends { hp: number }>(value: T) { let forwarded: { hp: number }; forwarded = { hp: value.hp }; return forwarded; }\nexport function mutate(state: SimState) { const each = state.enemies.forEach; const copy = state.enemies.map(enemy => ({ hp: enemy.hp })); each.call(copy, (_enemy, _index, collection) => { collection.push({ hp: 1 }); }); const view = relayCopy(state.player); view.hp = 0; const args: [object, PropertyKey, unknown] = [view, 'hp', 1]; Reflect.set.apply(null, [...args]); return view; }\n");
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './safe';\nexport const render = mutate;\n");
  await evaluateRendererFlowGapHardening(rule, { root });
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('RENDERER_FLOW_GAP_HARDENING_TEST_PASS');
