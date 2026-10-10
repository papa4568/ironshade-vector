import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateArchitectureInvariants } from '../tools/check-architecture-invariants.mjs';

const root = await mkdtemp(join(tmpdir(), 'ao6-type-dependency-closure-'));
const config = {
  schemaVersion: 1,
  rules: [
    {
      id: 'asset-boundary',
      type: 'moduleDependencyDenylist',
      description: 'manifest stays simulation independent across runtime and type dependencies',
      file: 'manifest.ts',
      modules: ['./sim'],
    },
  ],
};

try {
  await writeFile(join(root, 'sim.ts'), 'export type SimState = { hp: number };\nexport const advanceSimulation = () => {};\n');
  await writeFile(join(root, 'presentation-types.ts'), 'export type AssetDescriptor = { id: string };\n');
  await writeFile(
    join(root, 'manifest.ts'),
    "import type { AssetDescriptor } from './presentation-types';\nexport type ManifestDescriptor = AssetDescriptor;\nexport const manifest = [];\n",
  );
  await evaluateArchitectureInvariants(config, { root });

  await writeFile(
    join(root, 'helper.ts'),
    "import type { SimState } from './sim';\nexport type HelperType = SimState;\n",
  );
  await writeFile(
    join(root, 'manifest.ts'),
    "import type { HelperType } from './helper';\nexport type HiddenSimulationType = HelperType;\nexport const manifest = [];\n",
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(config, { root }),
    /helper\.ts: import from forbidden module \.\/sim is not allowed/,
  );

  await writeFile(
    join(root, 'manifest.ts'),
    "export type HiddenSimulationType = import('./helper').HelperType;\nexport const manifest = [];\n",
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(config, { root }),
    /helper\.ts: import from forbidden module \.\/sim is not allowed/,
  );

  await writeFile(
    join(root, 'manifest.ts'),
    "export type DirectSimulationType = import('./sim').SimState;\nexport const manifest = [];\n",
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(config, { root }),
    /manifest\.ts: import type from forbidden module \.\/sim is not allowed/,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('ARCHITECTURE_TYPE_DEPENDENCY_CLOSURE_PASS');
