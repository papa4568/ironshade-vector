import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluateArchitectureInvariants,
  validateArchitectureInvariantConfig,
} from '../tools/check-architecture-invariants.mjs';

const config = {
  schemaVersion: 1,
  rules: [
    {
      id: 'sim-boundary',
      type: 'namedImportAllowlist',
      description: 'renderer only reads approved simulation APIs',
      file: 'renderer.ts',
      module: './sim',
      allowedValueImports: ['getWorldSize'],
      allowedTypeImports: ['SimState'],
      requireExact: true,
    },
    {
      id: 'source-boundary',
      type: 'sourceContract',
      description: 'entry uses a neutral factory',
      file: 'entry.ts',
      required: ['createBackend('],
      forbidden: ['ConcreteRenderer'],
    },
  ],
};

validateArchitectureInvariantConfig(config);
assert.throws(
  () => validateArchitectureInvariantConfig({ ...config, rules: [config.rules[0], config.rules[0]] }),
  /duplicate architecture invariant id/,
);

const root = await mkdtemp(join(tmpdir(), 'ao6-architecture-'));
try {
  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nexport const render = state => getWorldSize(state);\n");
  await writeFile(join(root, 'entry.ts'), "const createBackend = () => ({ render() {} });\ncreateBackend();\n");
  const passing = await evaluateArchitectureInvariants(config, { root });
  assert.deepEqual(passing.map(result => result.id), ['sim-boundary', 'source-boundary']);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, advanceSimulation, type SimState } from './sim';\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /unexpected value import.*advanceSimulation/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = () => import('./sim');\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /dynamic import/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\n");
  await writeFile(join(root, 'entry.ts'), "ConcreteRenderer();\ncreateBackend();\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /forbidden literal/);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('ARCHITECTURE_INVARIANTS_TEST_PASS');
