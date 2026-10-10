import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateRendererReadOnlyBoundary } from '../tools/check-renderer-read-only-boundary.mjs';

const root = await mkdtemp(join(tmpdir(), 'ao6-read-only-boundary-'));
const rule = {
  id: 'renderer-sim-import-boundary',
  type: 'namedImportAllowlist',
  file: 'renderer.ts',
  module: './sim',
  readOnlyStateTypes: ['SimState'],
  mutableStateOwnerFiles: { 'owner.ts': ['readState'] },
};
try {
  await writeFile(join(root, 'sim.ts'), "export type SimState = { player: { hp: number } };\n");
  await writeFile(join(root, 'reader.ts'), "import type { SimState } from './sim';\nexport const read = (state: SimState) => state.player.hp;\n");
  await writeFile(join(root, 'renderer.ts'), "import { read } from './reader';\nexport const render = read;\n");
  await evaluateRendererReadOnlyBoundary(rule, { root });

  await writeFile(join(root, 'mutator.ts'), "import type { SimState } from './sim';\nexport const mutate = (state: SimState) => { const player = state.player; player.hp = 0; };\n");
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './mutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererReadOnlyBoundary(rule, { root }), /mutator\.ts: direct mutation/);

  await writeFile(join(root, 'stateTypes.ts'), "import type { SimState } from './sim';\nexport type RendererState = SimState;\n");
  await writeFile(join(root, 'mutator.ts'), "import type { RendererState } from './stateTypes';\nexport function mutate(state: RendererState) { state.player.hp = 0; }\n");
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './mutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererReadOnlyBoundary(rule, { root }), /mutator\.ts: direct mutation/);

  await writeFile(join(root, 'callbackMutator.ts'), "import type { SimState } from './sim';\nexport function mutate(state: SimState) { const callback: (value: SimState) => void = value => { value.player.hp = 0; }; callback(state); }\n");
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './callbackMutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererReadOnlyBoundary(rule, { root }), /callbackMutator\.ts: direct mutation/);

  await writeFile(join(root, 'reflectiveMutator.ts'), "import type { SimState } from './sim';\nexport function mutate(state: SimState) { Object.defineProperty(state.player, 'hp', { value: 0 }); }\n");
  await writeFile(join(root, 'renderer.ts'), "import { mutate } from './reflectiveMutator';\nexport const render = mutate;\n");
  await assert.rejects(() => evaluateRendererReadOnlyBoundary(rule, { root }), /reflectiveMutator\.ts: Object\.defineProperty mutation/);

  await writeFile(join(root, 'reflectiveMutator.ts'), "import type { SimState } from './sim';\nexport function mutate(state: SimState) { Object.defineProperties(state.player, { hp: { value: 0 } }); }\n");
  await assert.rejects(() => evaluateRendererReadOnlyBoundary(rule, { root }), /reflectiveMutator\.ts: Object\.defineProperties mutation/);

  await writeFile(join(root, 'reflectiveMutator.ts'), "import type { SimState } from './sim';\nexport function mutate(state: SimState) { Reflect.defineProperty(state.player, 'hp', { value: 0 }); }\n");
  await assert.rejects(() => evaluateRendererReadOnlyBoundary(rule, { root }), /reflectiveMutator\.ts: Reflect\.defineProperty mutation/);

  await writeFile(join(root, 'owner.ts'), "import type { SimState } from './sim';\nexport const readState = (state: SimState) => state.player.hp;\nexport const mutateState = (state: SimState) => { state.player.hp = 0; };\n");
  await writeFile(join(root, 'renderer.ts'), "import { readState } from './owner';\nexport const render = readState;\n");
  await evaluateRendererReadOnlyBoundary(rule, { root });

  await writeFile(join(root, 'renderer.ts'), "import { mutateState } from './owner';\nexport const render = mutateState;\n");
  await assert.rejects(() => evaluateRendererReadOnlyBoundary(rule, { root }), /mutable simulation owner owner\.ts must use approved read-only export/);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log('RENDERER_READ_ONLY_BOUNDARY_TEST_PASS');
