import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePremiumPbrMaterials } from './prepare-premium-pbr-materials.mjs';
import { writePremiumPbrReference } from './premium-pbr-reference-generator.mjs';

export * from './premium-pbr-reference-generator.mjs';

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  await preparePremiumPbrMaterials();
  await writePremiumPbrReference();
}
