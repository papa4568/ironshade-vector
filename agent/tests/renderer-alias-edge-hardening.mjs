import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateRendererAliasEdgeHardening } from '../tools/check-renderer-alias-edge-hardening.mjs';

const root = await mkdtemp(join(tmpdir(), 'ao6-alias-edge-hardening-'));
const rule = { id: 'renderer-sim-import-boundary', file: 'renderer.ts', module: './sim', readOnlyStateTypes: ['SimState'], mutableStateOwnerFiles: {} };

async function expectRejected(source, pattern) {
  await writeFile(join(root, 'mutator.ts'), source);
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './mutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererAliasEdgeHardening(rule, { root }), pattern);
}

try {
  await writeFile(join(root, 'sim.ts'), "export type SimState = { player: { hp: number }; enemies: { hp: number }[] };\n");

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { state.enemies.forEach((_enemy, _index, collection) => { collection.push({ hp: 1 }); }); }\n",
    /mutating method push/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { state.enemies.reduce((count, _enemy, _index, collection) => { collection.pop(); return count; }, 0); }\n",
    /mutating method pop/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nfunction relay<T>(value: T): T { const forwarded = value; return forwarded; }\nexport function mutate(state: SimState) { relay(state.player).hp = 0; }\n",
    /direct mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nfunction relay<T>(value: T): T { const forwarded = value; return forwarded; }\nfunction relayAgain<T>(value: T): T { const next = relay(value); return next; }\nexport function mutate(state: SimState) { relayAgain(state.player).hp = 0; }\n",
    /direct mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const args = [state.player, 'hp', 0] as const; Reflect.set.apply(null, [...args]); }\n",
    /Reflect\.set mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nconst R = Reflect; const { set: mutateProperty } = R;\nexport function mutate(state: SimState) { const args = [state.player, 'hp', 0] as const; mutateProperty.apply(null, [...args]); }\n",
    /Reflect\.set mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState, args: unknown[]) { Reflect.set.apply(null, args as [object, PropertyKey, unknown]); }\n",
    /cannot be proven safe/,
  );

  await writeFile(join(root, 'safe.ts'), "import type { SimState } from './sim';\nfunction copy<T extends { hp: number }>(value: T) { const view = { hp: value.hp }; return view; }\nexport function mutate(state: SimState) { state.enemies.forEach((_enemy, _index, collection) => { void collection.length; }); const view = copy(state.player); view.hp = 0; const args = [view, 'hp', 1] as const; Reflect.set.apply(null, [...args]); return view; }\n");
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './safe';\nexport const render = mutate;\n");
  await evaluateRendererAliasEdgeHardening(rule, { root });
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('RENDERER_ALIAS_EDGE_HARDENING_TEST_PASS');
