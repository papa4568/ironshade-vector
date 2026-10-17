import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkCombatBackendCoreEntrypoint } from '../tools/check-combat-backend-core-entrypoint.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'combat-backend-core-entrypoint-'));
  await mkdir(join(root, 'src/game'), { recursive: true });
  await mkdir(join(root, 'src/components'), { recursive: true });
  await writeFile(join(root, 'src/game/combatGraphicsBackendCore.ts'), 'export const raw = 1;\nexport type CoreType = { raw: number };\n', 'utf8');
  await writeFile(
    join(root, 'src/game/combatGraphicsBackend.ts'),
    "export * from './combatGraphicsBackendCore';\nimport { raw } from './combatGraphicsBackendCore';\nexport const safe = raw;\n",
    'utf8',
  );
  await writeFile(join(root, 'src/components/Safe.tsx'), "import { safe } from '../game/combatGraphicsBackend';\nvoid safe;\n", 'utf8');
  return root;
}

async function writeBypass(root, source) {
  await writeFile(join(root, 'src/components/Bypass.tsx'), source, 'utf8');
}

const root = await fixture();
try {
  await checkCombatBackendCoreEntrypoint({ root });

  await writeBypass(root, "import { raw } from '../game/combatGraphicsBackendCore';\nvoid raw;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /import resolves to src\/game\/combatGraphicsBackendCore\.ts/);

  await writeBypass(root, "import type { CoreType } from '../game/combatGraphicsBackendCore';\nexport type Copy = CoreType;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /type import resolves to src\/game\/combatGraphicsBackendCore\.ts/);

  await writeBypass(root, "export { raw } from '../game/combatGraphicsBackendCore';\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /re-export resolves to src\/game\/combatGraphicsBackendCore\.ts/);

  await writeBypass(root, "export type Copy = import('../game/combatGraphicsBackendCore').CoreType;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /import type resolves to src\/game\/combatGraphicsBackendCore\.ts/);

  await writeBypass(root, "void import('../game/combatGraphicsBackendCore');\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /dynamic import resolves to src\/game\/combatGraphicsBackendCore\.ts/);

  await writeBypass(root, "const raw = require('../game/combatGraphicsBackendCore');\nvoid raw;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /require\(\) resolves to src\/game\/combatGraphicsBackendCore\.ts/);

  await writeBypass(root, "import { raw } from '../game/nested/../combatGraphicsBackendCore';\nvoid raw;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /import resolves to src\/game\/combatGraphicsBackendCore\.ts/);

  await symlink(join(root, 'src/game/combatGraphicsBackendCore.ts'), join(root, 'src/game/graphicsRaw.ts'));
  await writeBypass(root, "import { raw } from '../game/graphicsRaw';\nvoid raw;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /import resolves to src\/game\/combatGraphicsBackendCore\.ts/);
  await rm(join(root, 'src/game/graphicsRaw.ts'));

  await writeBypass(root, "const base = '../game/';\nconst name = ['combatGraphicsBackend', 'Core'].join('');\nvoid import(base + name);\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /non-literal dynamic import cannot prove/);

  await writeBypass(root, "const modules = import.meta.glob('../game/*.ts');\nvoid modules;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /import\.meta\.glob cannot prove/);

  await writeBypass(root, "eval(\"import('../game/' + 'combatGraphicsBackendCore')\");\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /eval\(\) cannot prove/);

  await writeBypass(root, "const load = new Function('p', 'return import(p)');\nvoid load;\n");
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /new Function\(\) cannot prove/);

  await rm(join(root, 'src/components/Bypass.tsx'));
  await checkCombatBackendCoreEntrypoint({ root });
} finally {
  await rm(root, { recursive: true, force: true });
}

await checkCombatBackendCoreEntrypoint();
console.log('COMBAT_BACKEND_CORE_ENTRYPOINT_TEST_PASS');
