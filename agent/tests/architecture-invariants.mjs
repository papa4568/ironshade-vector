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
      allowedTransitiveValueImports: ['getPlayerSector', 'getWorldSize'],
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
  await writeFile(join(root, 'sim.ts'), "export const getWorldSize = state => state;\nexport const getPlayerSector = state => state;\nexport const advanceSimulation = state => state;\nexport type SimState = unknown;\nexport type Player = unknown;\n");
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

  await writeFile(join(root, 'manifest.ts'), ²È="24(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½µ…¹¥™•ÍÑp¹ÑÌè‘å¹…µ¥Œ¥µÁ½ÉÐ™É½´™½É‰¥‘‘•¸µ½‘Õ±”¼¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€µ…¹¥™•ÍÐ¹ÑÌœ¤°€‰½¹ÍÐµ½‘Õ±•9…µ”€ô€œ¸½Í¥´œíq¹½¹ÍÐ±½…€ô€ ¤€ôø¥µÁ½ÉÐ¡µ½‘Õ±•9…µ”¤íq¹•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ô±½…íq¸ˆ¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½¹½¸µ±¥Ñ•É…°‘å¹…µ¥Œ¥µÁ½ÉÐ¼¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€µ…¹¥™•ÍÐ¹ÑÌœ¤°€•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ômtíq¸œ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€É•…‘=¹±å!•±Á•È¹ÑÌœ¤°€‰¥µÁ½ÉÐì•ÑA±…å•ÉM•Ñ½È°•Ñ]½É±‘M¥é”°ÑåÁ”A±…å•Èô™É½´€œ¸½Í¥´œíq¹•áÁ½ÉÐÑåÁ”!•±Á•ÉMÑ…Ñ”€ôA±…å•Èíq¹•áÁ½ÉÐ½¹ÍÐÉ•…‘]½É±€ô•Ñ]½É±‘M¥é”íq¹•áÁ½ÉÐ½¹ÍÐÉ•…‘M•Ñ½È€ô•ÑA±…å•ÉM•Ñ½Èíq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘íÙ…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐÑåÁ”ì!•±Á•ÉMÑ…Ñ”ô™É½´€œ¸½É•…‘=¹±å!•±Á•Èœíq¹•áÁ½ÉÐÑåÁ”I•…‘=¹±åMÑ…Ñ”€ô!•±Á•ÉMÑ…Ñ”íq¹€°(€€¤ì(€½¹ÍÐ…±±½Ý•‘QÉ…¹Í¥Ñ¥Ù•QåÁ•%µÁ½ÉÐ€ô…Ý…¥Ð•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤ì(€…ÍÍ•ÉÐ¹‘••ÁÅÕ…°¡…±±½Ý•‘QÉ…¹Í¥Ñ¥Ù•QåÁ•%µÁ½ÉÐ¹µ…À¡É•ÍÕ±Ð€ôøÉ•ÍÕ±Ð¹¥¤°lÍ¥´µ‰½Õ¹‘…Éäœ°€Í½ÕÉ”µ‰½Õ¹‘…Éäœ°€µ½‘Õ±”µ‘•¹å±¥ÍÐt¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€Í¥µ	É¥‘”¹ÑÌœ¤°(€€€€‰¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥´œíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ•Q¡É½Õ¡	É¥‘”€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¸ˆ°(€€¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘íÙ…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐìµÕÑ…Ñ•Q¡É½Õ¡	É¥‘”ô™É½´€œ¸½Í¥µ	É¥‘”œíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ”€ôµÕÑ…Ñ•Q¡É½Õ¡	É¥‘”íq¹€°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ (€€€€ ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°(€€€€½Í¥µ	É¥‘•p¹ÑÌèÕ¹•áÁ•Ñ•Ù…±Õ”¥µÁ½ÉÑp¡Íp¤™É½´p¹p½Í¥´è…‘Ù…¹•M¥µÕ±…Ñ¥½¸¼°(€€¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€Í¥µ	É¥‘”¹ÑÌœ¤°€‰•áÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥´œíq¸ˆ¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½Í¥µ	É¥‘•p¹ÑÌèÉ”µ•áÁ½ÉÐ™É½´p¹p½Í¥´¼¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€Í¥´¹‰É¥‘”¹ÑÌœ¤°€‰•áÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥´œíq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘íÙ…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥´¹‰É¥‘”œíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ”€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¹€°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½Í¥µp¹‰É¥‘•p¹ÑÌèÉ”µ•áÁ½ÉÐ™É½´p¹p½Í¥´¼¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€‰É¥‘•QÝ¼¹ÑÌœ¤°€‰•áÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥´œíq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€‰É¥‘•=¹”¹ÑÌœ¤°€‰•áÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½‰É¥‘•QÝ¼œíq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘íÙ…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½‰É¥‘•=¹”œíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ”€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¹€°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½‰É¥‘•QÝ½p¹ÑÌèÉ”µ•áÁ½ÉÐ™É½´p¹p½Í¥´¼¤ì((€…Ý…¥ÐÍåµ±¥¹¬ Í¥´¹ÑÌœ°©½¥¸¡É½½Ð°€Í¥µ±¥…Ì¹ÑÌœ¤¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘íÙ…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥µ±¥…Ìœíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ”€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¹€°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½É•Í½±Ù•ÌÑ¼ÁÉ½Ñ•Ñ•µ½‘Õ±”p¹p½Í¥´Ñ¡É½Õ …¸…±Ñ•É¹…Ñ”Á…Ñ ¼¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€µ…¹¥™•ÍÐ¹ÑÌœ¤°€‰¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥µ±¥…Ìœíq¹•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°Ù…±¥‘I•¹‘•É•È¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½É•Í½±Ù•ÌÑ¼™½É‰¥‘‘•¸µ½‘Õ±”p¹p½Í¥´Ñ¡É½Õ …¸…±Ñ•É¹…Ñ”Á…Ñ ¼¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€µ…¹¥™•ÍÐ¹ÑÌœ¤°€•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ômtíq¸œ¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€Í¥µ	É¥‘”¹ÑÌœ¤°(€€€€‰½¹ÍÐÑ…É•Ð€ô€œ¸½Í¥´œíq¹•áÁ½ÉÐ½¹ÍÐ±½…‘M¥µÕ±…Ñ¥½¸€ô€ ¤€ôø¥µÁ½ÉÐ¡Ñ…É•Ð¤íq¸ˆ°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½Í¥µ	É¥‘•p¹ÑÌè¹½¸µ±¥Ñ•É…°‘å¹…µ¥Œ¥µÁ½ÉÐ¼¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°Ù…±¥‘I•¹‘•É•È¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€Í¥µ	É¥‘”¹ÑÌœ¤°€‰•áÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥´œíq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€µ…¹¥™•ÍÐ¹ÑÌœ¤°(€€€€‰¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥µ	É¥‘”œíq¹•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¸ˆ°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ (€€€€ ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°(€€€€½Í¥µ	É¥‘•p¹ÑÌèÉ”µ•áÁ½ÉÐ™É½´™½É‰¥‘‘•¸µ½‘Õ±”p¹p½Í¥´¼°(€€¤ì((€…Ý…¥Ðµ­‘¥È¡©½¥¸¡É½½Ð°€…µ”œ¤°ìÉ•ÕÉÍ¥Ù”èÑÉÕ”ô¤ì(€½¹ÍÐ¹•ÍÑ•‘Y…±¥‘I•¹‘•É•È€ô€‰¥µÁ½ÉÐì•Ñ]½É±‘M¥é”°ÑåÁ”M¥µMÑ…Ñ”ô™É½´€œ¸½Í¥´œíq¹•áÁ½ÉÐ½¹ÍÐÉ•¹‘•È€ôÍÑ…Ñ”€ôø•Ñ]½É±‘M¥é”¡ÍÑ…Ñ”¤íq¸ˆì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€…µ”œ°€Í¥´¹ÑÌœ¤°€‰•áÁ½ÉÐ½¹ÍÐ•Ñ]½É±‘M¥é”€ôÍÑ…Ñ”€ôøÍÑ…Ñ”íq¹•áÁ½ÉÐ½¹ÍÐ…‘Ù…¹•M¥µÕ±…Ñ¥½¸€ôÍÑ…Ñ”€ôøÍÑ…Ñ”íq¹•áÁ½ÉÐÑåÁ”M¥µMÑ…Ñ”€ôÕ¹­¹½Ý¸íq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€…µ”œ°€É•¹‘•É•È¹ÑÌœ¤°¹•ÍÑ•‘Y…±¥‘I•¹‘•É•È¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€…µ”œ°€µ…¹¥™•ÍÐ¹ÑÌœ¤°€•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ômtíq¸œ¤ì(€½¹ÍÐ¹•ÍÑ•‘A…ÍÍ¥¹œ€ô…Ý…¥Ð•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡¥µÁ½ÉÑ•ÉI•±…Ñ¥Ù•½¹™¥œ°ìÉ½½Ðô¤ì(€…ÍÍ•ÉÐ¹‘••ÁÅÕ…°¡¹•ÍÑ•‘A…ÍÍ¥¹œ¹µ…À¡É•ÍÕ±Ð€ôøÉ•ÍÕ±Ð¹¥¤°l¹•ÍÑ•µÍ¥´µ‰½Õ¹‘…Éäœ°€¹•ÍÑ•µµ½‘Õ±”µ‘•¹å±¥ÍÐt¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€…µ”œ°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘í¹•ÍÑ•‘Y…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸¸½…µ”½Í¥´œíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ”€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¹€°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ (€€€€ ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡¥µÁ½ÉÑ•ÉI•±…Ñ¥Ù•½¹™¥œ°ìÉ½½Ðô¤°(€€€€½Õ¹•áÁ•Ñ•Ù…±Õ”¥µÁ½ÉÐ¸©…‘Ù…¹•M¥µÕ±…Ñ¥½¸¼°(€€¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€…µ”œ°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘í¹•ÍÑ•‘Y…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸¸½…µ”½Í¥´¹ÑÌœíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ”€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¹€°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ (€€€€ ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡¥µÁ½ÉÑ•ÉI•±…Ñ¥Ù•½¹™¥œ°ìÉ½½Ðô¤°(€€€€½Õ¹•áÁ•Ñ•Ù…±Õ”¥µÁ½ÉÐ¸©…‘Ù…¹•M¥µÕ±…Ñ¥½¸¼°(€€¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€…µ”œ°€É•¹‘•É•È¹ÑÌœ¤°¹•ÍÑ•‘Y…±¥‘I•¹‘•É•È¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€…µ”œ°€µ…¹¥™•ÍÐ¹ÑÌœ¤°(€€€€‰¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸¸½…µ”½Í¥´¹ÑÌœíq¹•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¸ˆ°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ (€€€€ ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡¥µÁ½ÉÑ•ÉI•±…Ñ¥Ù•½¹™¥œ°ìÉ½½Ðô¤°(€€€€½…µ•p½µ…¹¥™•ÍÑp¹ÑÌè¥µÁ½ÉÐ™É½´™½É‰¥‘‘•¸µ½‘Õ±”p¹p½Í¥´¼°(€€¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€…µ”œ°€µ…¹¥™•ÍÐ¹ÑÌœ¤°€•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ômtíq¸œ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€…µ”œ°€Í¥µ	É¥‘”¹ÑÌœ¤°€‰•áÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥´œíq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€…µ”œ°€É•¹‘•É•È¹ÑÌœ¤°(€€€€‘í¹•ÍÑ•‘Y…±¥‘I•¹‘•É•Éõ¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥µ	É¥‘”œíq¹•áÁ½ÉÐ½¹ÍÐµÕÑ…Ñ”€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¹€°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ (€€€€ ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡¥µÁ½ÉÑ•ÉI•±…Ñ¥Ù•½¹™¥œ°ìÉ½½Ðô¤°(€€€€½…µ•p½Í¥µ	É¥‘•p¹ÑÌèÉ”µ•áÁ½ÉÐ™É½´p¹p½Í¥´¼°(€€¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€…µ”œ°€É•¹‘•É•È¹ÑÌœ¤°¹•ÍÑ•‘Y…±¥‘I•¹‘•É•È¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±” (€€€©½¥¸¡É½½Ð°€…µ”œ°€µ…¹¥™•ÍÐ¹ÑÌœ¤°(€€€€‰¥µÁ½ÉÐì…‘Ù…¹•M¥µÕ±…Ñ¥½¸ô™É½´€œ¸½Í¥µ	É¥‘”œíq¹•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ô…‘Ù…¹•M¥µÕ±…Ñ¥½¸íq¸ˆ°(€€¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ (€€€€ ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡¥µÁ½ÉÑ•ÉI•±…Ñ¥Ù•½¹™¥œ°ìÉ½½Ðô¤°(€€€€½…µ•p½Í¥µ	É¥‘•p¹ÑÌèÉ”µ•áÁ½ÉÐ™É½´™½É‰¥‘‘•¸µ½‘Õ±”p¹p½Í¥´¼°(€€¤ì((€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€µ…¹¥™•ÍÐ¹ÑÌœ¤°€•áÁ½ÉÐ½¹ÍÐµ…¹¥™•ÍÐ€ômtíq¸œ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€•¹ÑÉä¹ÑÌœ¤°€‰½¹É•Ñ•I•¹‘•É•È ¤íq¹É•…Ñ•	…­•¹ ¤íq¸ˆ¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥±”¡©½¥¸¡É½½Ð°€É•¹‘•É•È¹ÑÌœ¤°Ù…±¥‘I•¹‘•É•È¤ì(€…Ý…¥Ð…ÍÍ•ÉÐ¹É•©•ÑÌ  ¤€ôø•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ðô¤°€½™½É‰¥‘‘•¸±¥Ñ•É…°¼¤ì)ô™¥¹…±±äì(€…Ý…¥ÐÉ´¡É½½Ð°ìÉ•ÕÉÍ¥Ù”èÑÉÕ”°™½É”èÑÉÕ”ô¤ì)ô()½¹Í½±”¹±½œ I!%QQUI}%9YI%9QM}QMQ}AMLœ¤ì(