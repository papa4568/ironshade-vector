import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
    {
      id: 'module-denylist',
      type: 'moduleDependencyDenylist',
      description: 'asset metadata must not depend on simulation',
      file: 'manifest.ts',
      modules: ['./sim'],
    },
  ],
};

const importerRelativeConfig = {
  schemaVersion: 1,
  rules: [
    {
      id: 'nested-sim-boundary',
      type: 'namedImportAllowlist',
      description: 'nested renderer only reads approved simulation APIs',
      file: 'game/renderer.ts',
      module: './sim',
      allowedValueImports: ['getWorldSize'],
      allowedTypeImports: ['SimState'],
      requireExact: true,
    },
    {
      id: 'nested-module-denylist',
      type: 'moduleDependencyDenylist',
      description: 'nested asset metadata must not depend on simulation',
      file: 'game/manifest.ts',
      modules: ['./sim'],
    },
  ],
};

validateArchitectureInvariantConfig(config);
validateArchitectureInvariantConfig(importerRelativeConfig);
assert.throws(
  () => validateArchitectureInvariantConfig({ ...config, rules: [config.rules[0], config.rules[0]] }),
  /duplicate architecture invariant id/,
);

const root = await mkdtemp(join(tmpdir(), 'ao6-architecture-'));
try {
  const validRenderer = "import { getWorldSize, type SimState } from './sim';\nexport const render = state => getWorldSize(state);\n";
  await writeFile(join(root, 'sim.ts'), "export const getWorldSize = state => state;\nexport const advanceSimulation = state => state;\nexport type SimState = unknown;\nexport type Player = unknown;\n");
  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await writeFile(join(root, 'entry.ts'), "const createBackend = () => ({ render() {} });\ncreateBackend();\n");
  await writeFile(join(root, 'manifest.ts'), 'export const manifest = [];\n');
  const passing = await evaluateArchitectureInvariants(config, { root });
  assert.deepEqual(passing.map(result => result.id), ['sim-boundary', 'source-boundary', 'module-denylist']);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = () => import('./other-module');\n");
  const unrelatedDynamicImport = await evaluateArchitectureInvariants(config, { root });
  assert.deepEqual(unrelatedDynamicImport.map(result => result.id), ['sim-boundary', 'source-boundary', 'module-denylist']);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, advanceSimulation, type SimState } from './sim';\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /unexpected value import.*advanceSimulation/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nimport { advanceSimulation } from './sim'\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /unexpected value import.*advanceSimulation/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nimport{advanceSimulation}from'./sim';\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /unexpected value import.*advanceSimulation/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nimport { advanceSimulation } from './sim.ts';\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /unexpected value import.*advanceSimulation/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nimport { advanceSimulation } from './nested/../sim';\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /unexpected value import.*advanceSimulation/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = () => import('./sim');\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /dynamic import/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = () => import('./sim.ts');\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /dynamic import/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = () => import(/* @vite-ignore */ './sim');\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /dynamic import/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = () => import('./sim' /* comment */);\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /dynamic import/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = () => import(`./sim`);\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /dynamic import/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst lazy = name => import(`./${name}`);\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /non-literal dynamic import/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nconst sim = require('./sim');\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /require\(\)/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nimport Sim = require('./sim');\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /import-equals/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\nexport { advanceSimulation } from './sim';\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /re-export/);

  await writeFile(join(root, 'renderer.ts'), "import { getWorldSize, type SimState } from './sim';\ntype HiddenSimState = import('./sim.ts').SimState;\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /import type/);

  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await writeFile(join(root, 'manifest.ts'), "import{advanceSimulation}from'./sim';\nexport const manifest = advanceSimulation;\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /manifest\.ts: import from forbidden module/);

  await writeFile(join(root, 'manifest.ts'), "import { advanceSimulation } from './sim.ts';\nexport const manifest = advanceSimulation;\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /manifest\.ts: import from forbidden module/);

  await writeFile(join(root, 'manifest.ts'), "const load = () => import(\/\* @vite-ignore \*\/ './sim.ts');\nexport const manifest = load;\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /manifest\.ts: dynamic import from forbidden module/);

  await writeFile(join(root, 'manifest.ts'), "const moduleName = './sim';\nconst load = () => import(moduleName);\nexport const manifest = load;\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /non-literal dynamic import/);

  await writeFile(join(root, 'manifest.ts'), 'export const manifest = [];\n');
  await writeFile(join(root, 'readOnlyHelper.ts'), "import { getWorldSize, type Player } from './sim';\nexport type HelperState = Player;\nexport const readWorld = getWorldSize;\n");
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import type { HelperState } from './readOnlyHelper';\nexport type ReadOnlyState = HelperState;\n`,
  );
  const allowedTransitiveTypeImport = await evaluateArchitectureInvariants(config, { root });
  assert.deepEqual(allowedTransitiveTypeImport.map(result => result.id), ['sim-boundary', 'source-boundary', 'module-denylist']);

  await writeFile(
    join(root, 'simBridge.ts'),
    "import { advanceSimulation } from './sim';\nexport const mutateThroughBridge = advanceSimulation;\n",
  );
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import { mutateThroughBridge } from './simBridge';\nexport const mutate = mutateThroughBridge;\n`,
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(config, { root }),
    /simBridge\.ts: unexpected value import\(s\) from \.\/sim: advanceSimulation/,
  );

  await writeFile(join(root, 'simBridge.ts'), "export { advanceSimulation } from './sim';\n");
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /simBridge\.ts: re-export from \.\/sim/);

  await writeFile(join(root, 'sim.bridge.ts'), "export { advanceSimulation } from './sim';\n");
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import { advanceSimulation } from './sim.bridge';\nexport const mutate = advanceSimulation;\n`,
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /sim\.bridge\.ts: re-export from \.\/sim/);

  await writeFile(join(root, 'bridgeTwo.ts'), "export { advanceSimulation } from './sim';\n");
  await writeFile(join(root, 'bridgeOne.ts'), "export { advanceSimulation } from './bridgeTwo';\n");
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import { advanceSimulation } from './bridgeOne';\nexport const mutate = advanceSimulation;\n`,
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /bridgeTwo\.ts: re-export from \.\/sim/);

  await symlink('sim.ts', join(root, 'simAlias.ts'));
  await writeFile(
    join(root, 'renderer.ts'),
    `${validRenderer}import { advanceSimulation } from './simAlias';\nexport const mutate = advanceSimulation;\n`,
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /resolves to protected module \.\/sim through an alternate path/);

  await writeFile(join(root, 'manifest.ts'), "import { advanceSimulation } from './simAlias';\nexport const manifest = advanceSimulation;\n");
  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /resolves to forbidden module \.\/sim through an alternate path/);
  await writeFile(join(root, 'manifest.ts'), 'export const manifest = [];\n');

  await writeFile(
    join(root, 'simBridge.ts'),
    "const target = './sim';\nexport const loadSimulation = () => import(target);\n",
  );
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /simBridge\.ts: non-literal dynamic import/);

  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await writeFile(join(root, 'simBridge.ts'), "export { advanceSimulation } from './sim';\n");
  await writeFile(
    join(root, 'manifest.ts'),
    "import { advanceSimulation } from './simBridge';\nexport const manifest = advanceSimulation;\n",
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(config, { root }),
    /simBridge\.ts: re-export from forbidden module \.\/sim/,
  );

  await mkdir(join(root, 'game'), { recursive: true });
  const nestedValidRenderer = "import { getWorldSize, type SimState } from './sim';\nexport const render = state => getWorldSize(state);\n";
  await writeFile(join(root, 'game', 'sim.ts'), "export const getWorldSize = state => state;\nexport const advanceSimulation = state => state;\nexport type SimState = unknown;\n");
  await writeFile(join(root, 'game', 'renderer.ts'), nestedValidRenderer);
  await writeFile(join(root, 'game', 'manifest.ts'), 'export const manifest = [];\n');
  const nestedPassing = await evaluateArchitectureInvariants(importerRelativeConfig, { root });
  assert.deepEqual(nestedPassing.map(result => result.id), ['nested-sim-boundary', 'nested-module-denylist']);

  await writeFile(
    join(root, 'game', 'renderer.ts'),
    `${nestedValidRenderer}import { advanceSimulation } from '../game/sim';\nexport const mutate = advanceSimulation;\n`,
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(importerRelativeConfig, { root }),
    /unexpected value import.*advanceSimulation/,
  );

  await writeFile(
    join(root, 'game', 'renderer.ts'),
    `${nestedValidRenderer}import { advanceSimulation } from '../game/sim.ts';\nexport const mutate = advanceSimulation;\n`,
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(importerRelativeConfig, { root }),
    /unexpected value import.*advanceSimulation/,
  );

  await writeFile(join(root, 'game', 'renderer.ts'), nestedValidRenderer);
  await writeFile(
    join(root, 'game', 'manifest.ts'),
    "import { advanceSimulation } from '../game/sim.ts';\nexport const manifest = advanceSimulation;\n",
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(importerRelativeConfig, { root }),
    /game\/manifest\.ts: import from forbidden module \.\/sim/,
  );

  await writeFile(join(root, 'game', 'manifest.ts'), 'export const manifest = [];\n');
  await writeFile(join(root, 'game', 'simBridge.ts'), "export { advanceSimulation } from './sim';\n");
  await writeFile(
    join(root, 'game', 'renderer.ts'),
    `${nestedValidRenderer}import { advanceSimulation } from './simBridge';\nexport const mutate = advanceSimulation;\n`,
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(importerRelativeConfig, { root }),
    /game\/simBridge\.ts: re-export from \.\/sim/,
  );

  await writeFile(join(root, 'game', 'renderer.ts'), nestedValidRenderer);
  await writeFile(
    join(root, 'game', 'manifest.ts'),
    "import { advanceSimulation } from './simBridge';\nexport const manifest = advanceSimulation;\n",
  );
  await assert.rejects(
    () => evaluateArchitectureInvariants(importerRelativeConfig, { root }),
    /game\/simBridge\.ts: re-export from forbidden module \.\/sim/,
  );

  await writeFile(join(root, 'manifest.ts'), 'export const manifest = [];\n');
  await writeFile(join(root, 'entry.ts'), "ConcreteRenderer();\ncreateBackend();\n");
  await writeFile(join(root, 'renderer.ts'), validRenderer);
  await assert.rejects(() => evaluateArchitectureInvariants(config, { root }), /forbidden literal/);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('ARCHITECTURE_INVARIANTS_TEST_PASS');
