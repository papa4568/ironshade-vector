import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkCombatBackendCoreEntrypoint } from '../tools/check-combat-backend-core-entrypoint.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'combat-backend-core-entrypoint-'));
  await mkdir(join(root, 'src/game'), { recursive: true });
  await mkdir(join(root, 'src/components'), { recursive: true });
  await writeFile(join(root, 'src/game/combatGraphicsBackendCore.ts'), 'export const raw = 1;\n', 'utf8');
  await writeFile(join(root, 'src/game/combatGraphicsBackend.ts'), "export * from './combatGraphicsBackendCore';\n", 'utf8');
  await writeFile(join(root, 'src/components/Safe.tsx'), "import { raw } from '../game/combatGraphicsBackend';\nvoid raw;\n", 'utf8');
  return root;
}

const root = await fixture();
try {
  await checkCombatBackendCoreEntrypoint({ root });

  await writeFile(join(root, 'src/components/Direct.tsx'), "import { raw } from '../game/combatGraphicsBackendCore';\nvoid raw;\n", 'utf8');
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /direct reference to combatGraphicsBackendCore is forbidden/);
  await rm(join(root, 'src/components/Direct.tsx'));

  await writeFile(join(root, 'src/components/Dynamic.tsx'), "const core = '../game/combatGraphicsBackendCore';\nvoid import(core);\n", 'utf8');
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /direct reference to combatGraphicsBackendCore is forbidden/);
  await rm(join(root, 'src/components/Dynamic.tsx'));

  await symlink(join(root, 'src/game/combatGraphicsBackendCore.ts'), join(root, 'src/game/graphicsRaw.ts'));
  await writeFile(join(root, 'src/components/Alias.tsx'), "import { raw } from '../game/graphicsRaw';\nvoid raw;\n", 'utf8');
  await assert.rejects(() => checkCombatBackendCoreEntrypoint({ root }), /resolves to src\/game\/combatGraphicsBackendCore\.ts/);
  await rm(join(root, 'src/components/Alias.tsx'));
  await rm(join(root, 'src/game/graphicsRaw.ts'));
} finally {
  await rm(root, { recursive: true, force: true });
}

await checkCombatBackendCoreEntrypoint();
console.log('COMBAT_BACKEND_CORE_ENTRYPOINT_TEST_PASS');
