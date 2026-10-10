import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateRendererMutationHardening } from '../tools/check-renderer-mutation-hardening.mjs';

const root = await mkdtemp(join(tmpdir(), 'ao6-mutation-hardening-'));
const rule = { id: 'renderer-sim-import-boundary', file: 'renderer.ts', module: './sim', readOnlyStateTypes: ['SimState'], mutableStateOwnerFiles: {} };
async function expectRejected(source, pattern) {
  await writeFile(join(root, 'mutator.ts'), source);
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './mutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererMutationHardening(rule, { root }), pattern);
}
try {
  await writeFile(join(root, 'sim.ts'), "export type SimState = { player: { hp: number }; enemies: { hp: number }[] };\n");
  await expectRejected("import type { SimState } from './sim';\nexport function mutate(state: SimState) { state.enemies['push']({ hp: 1 }); }\n", /mutating method push/);
  await expectRejected("import type { SimState } from './sim';\nexport function mutate(state: SimState) { Object['defineProperty'](state.player, 'hp', { value: 0 }); }\n", /Object\.defineProperty mutation/);
  await expectRejected("import type { SimState } from './sim';\nexport function mutate(state: SimState) { Reflect['set'](state.player, 'hp', 0); }\n", /Reflect\.set mutation/);
  await expectRejected("import type { SimState } from './sim';\nconst define = Object.defineProperty;\nexport function mutate(state: SimState) { define(state.player, 'hp', { value: 0 }); }\n", /Object\.defineProperty mutation/);
  await expectRejected("import type { SimState } from './sim';\nexport function mutate(state: SimState) { Array.prototype.push.call(state.enemies, { hp: 1 }); }\n", /prototype mutating method push/);
  await expectRejected("import type { SimState } from './sim';\nfunction identity<T>(value: T): T { return value; }\nexport function mutate(state: SimState) { identity(state).player.hp = 0; }\n", /direct mutation/);
  await expectRejected("import type { SimState } from './sim';\nexport function mutate(state: SimState) { const get = () => state; get().player.hp = 0; }\n", /direct mutation/);
  await expectRejected("import type { SimState } from './sim';\nexport function mutate(state: SimState) { state.enemies.forEach(enemy => { enemy.hp = 0; }); }\n", /direct mutation/);

  await writeFile(join(root, 'reader.ts'), "import type { SimState } from './sim';\nfunction identity<T>(value: T): T { return value; }\nexport function read(state: SimState) { return identity(state).player.hp + state.enemies.map(enemy => enemy.hp).length + Object.keys(state.player).length; }\n");
  await writeFile(join(root, 'view.ts'), "import type { SimState } from './sim';\nexport function view(state: SimState) { return { hp: state.player.hp }; }\nexport function decorate(state: SimState) { const result = view(state); result.hp = 1; return result; }\n");
  await writeFile(join(root, 'renderer.ts'), "import { decorate } from './view';\nexport const render = decorate;\n");
  await evaluateRendererMutationHardening(rule, { root });
  await writeFile(join(root, 'renderer.ts'), "import { read } from './reader';\nexport const render = read;\n");
  await evaluateRendererMutationHardening(rule, { root });
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log('RENDERER_MUTATION_HARDENING_TEST_PASS');
