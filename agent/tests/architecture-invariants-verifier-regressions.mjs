import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateArchitectureInvariants } from '../tools/check-architecture-invariants.mjs';

const root = await mkdtemp(join(tmpdir(), 'ao6-verifier-regressions-'));
const config = {
  schemaVersion: 1,
  rules: [
    {
      id: 'sim-boundary',
      type: 'namedImportAllowlist',
      description: 'renderer reads approved simulation APIs without mutating SimState',
      file: 'renderer.ts',
      module: './sim',
      allowedValueImports: ['getWorldSize'],
      allowedTransitiveValueImports: ['getWorldSize'],
      allowedTypeImports: ['SimState'],
      protectedMutableTypes: ['SimState'],
      requireExact: true,
    },
    {
      id: 'asset-boundary',
      type: 'moduleDependencyDenylist',
      description: 'manifest stays simulation independent',
      file: 'manifest.ts',
      modules: ['./sim'],
    },
  ],
};

const validRenderer = "import { getWorldSize, type SimState } from './sim';\nexport const render = (state: SimState) => getWorldSize(state);\n";

try {
  await writeFile(
    join(root, 'sim.ts'),
    "export type SimState = { player: { hp: number }, enemies: Array<{ hp: number }> };\nexport const getWorldSize = (state: SimState) => state.player.hp;\nexport const advanceSimulation = (state: SimState) => { state.player.hp -= 1; };\n",
  );
  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await writeFile(join(root, 'manifest.ts'), 'export const manifest = [];\n');
  await evaluateArchitectureInvariants(config, { root });

  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}const hidden = import.meta.glob('./sim.ts', { eager: true, import: 'advanceSimulation' });\nexport const hiddenSimulation = hidden;\n`,
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /import\.meta\.glob/);

  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await writeFile(
    join(root, 'manifest.ts'),
    "const hidden = import.meta['glob']('./sim.ts', { eager: true, import: 'advanceSimulation' });\nexport const manifest = hidden;\n",
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /import\.meta\.glob/);

  await writeFile(join(root, 'manifest.ts'), 'export const manifest = [];\n');
  await writeFile(join(root, 'bridge.d.ts'), "export declare const advanceSimulation: unknown;\n");
  await writeFile(join(root, 'bridge.ts'), "export { advanceSimulation } from './sim';\n");
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import { advanceSimulation } from './bridge';\nexport const mutate = advanceSimulation;\n`,
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /bridge\.ts: re-export from \.\/sim/);

  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await writeFile(
    join(root, 'manifest.ts'),
    "import { advanceSimulation } from './bridge';\nexport const manifest = advanceSimulation;\n",
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /bridge\.ts: re-export from forbidden module \.\/sim/);

  await writeFile(join(root, 'manifest.ts'), 'export const manifest = [];\n');
  await writeFile(
    join(root, 'reader.ts'),
    "import type { SimState } from './sim';\nexport const readState = (state: SimState) => state.player.hp;\n",
  );
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import { readState } from './reader';\nexport const readThroughHelper = readState;\n`,
  );
  await evaluateArchitectureInvariants(config, { root });

  await writeFile(
    join(root, 'mutator.ts'),
    "import type { SimState } from './sim';\ntype MutableView = SimState;\nexport const mutateState = (state: MutableView) => { const player = state.player; player.hp = 0; };\n",
  );
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import { mutateState } from './mutator';\nexport const mutateThroughHelper = mutateState;\n`,
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(config, { root }),
    /mutator\.ts: direct mutation of protected mutable simulation type\(s\) SimState is not allowed/,
  );

  await writeFile(
    join(root, 'mutator.ts'),
    "import type { SimState } from './sim';\nexport const mutateState = (state: SimState) => { state.enemies.push({ hp: 0 }); };\n",
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(config, { root }),
    /mutator\.ts: mutating method push\(\) of protected mutable simulation type\(s\) SimState is not allowed/,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('ARCHITECTURE_INVARIANTS_VERIFIER_REGRESSIONS_PASS');
