import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateRendererAliasHardening } from '../tools/check-renderer-alias-hardening.mjs';

const root = await mkdtemp(join(tmpdir(), 'ao6-alias-hardening-'));
const rule = { id: 'renderer-sim-import-boundary', file: 'renderer.ts', module: './sim', readOnlyStateTypes: ['SimState'], mutableStateOwnerFiles: {} };

async function expectRejected(source, pattern) {
  await writeFile(join(root, 'mutator.ts'), source);
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './mutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererAliasHardening(rule, { root }), pattern);
}

try {
  await writeFile(join(root, 'sim.ts'), "export type SimState = { player: { hp: number }; enemies: { hp: number }[] };\n");

  await expectRejected(
    "import type { SimState } from './sim';\nfunction identity<T>(value: T): T { return value; }\nexport function mutate(state: SimState) { identity(state.player).hp = 0; }\n",
    /direct mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nconst { set } = Reflect;\nexport function mutate(state: SimState) { set(state.player, 'hp', 0); }\n",
    /Reflect\.set mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nconst R = Reflect;\nconst { set: mutateProperty } = R;\nexport function mutate(state: SimState) { mutateProperty.apply(null, [state.player, 'hp', 0]); }\n",
    /Reflect\.set mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nconst { defineProperty } = Object;\nexport function mutate(state: SimState) { defineProperty(state.player, 'hp', { value: 0 }); }\n",
    /Object\.defineProperty mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { Reflect.set.apply(null, [state.player, 'hp', 0]); }\n",
    /Reflect\.set mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const args = [state.player, 'hp', 0] as const; Reflect.set.apply(null, args); }\n",
    /Reflect\.set mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nconst f = (enemy: { hp: number }) => { enemy.hp = 0; };\nexport function mutate(state: SimState) { state.enemies.forEach(f); }\n",
    /direct mutation/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const push = state.enemies.push; push.call(state.enemies, { hp: 1 }); }\n",
    /aliased mutating method push/,
  );

  await expectRejected(
    "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const push = state.enemies.push.bind(state.enemies); push({ hp: 1 }); }\n",
    /aliased mutating method push/,
  );

  await writeFile(join(root, 'view.ts'), "import type { SimState } from './sim';\nexport function view(state: SimState) { return { hp: state.player.hp }; }\nexport function decorate(state: SimState) { const result = view(state); result.hp = 1; return result; }\n");
  await writeFile(join(root, 'renderer.ts'), "import { decorate } from './view';\nexport const render = decorate;\n");
  await evaluateRendererAliasHardening(rule, { root });

  await writeFile(join(root, 'reader.ts'), "import type { SimState } from './sim';\nconst f = (enemy: { hp: number }) => enemy.hp;\nexport function read(state: SimState) { return state.enemies.map(f).join(',') + state.player.hp; }\n");
  await writeFile(join(root, 'renderer.ts'), "import { read } from './reader';\nexport const render = read;\n");
  await evaluateRendererAliasHardening(rule, { root });
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('RENDERER_ALIAS_HARDENING_TEST_PASS');
