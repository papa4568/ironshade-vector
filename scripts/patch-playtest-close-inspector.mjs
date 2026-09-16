import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/browser-level1-20-playtest.mjs';
let source = readFileSync(path, 'utf8');
const before = `    if (await visible(equip)) {\n      await equip.click();\n      equipped += 1;\n      await page.waitForTimeout(250);\n    } else {\n      const close = inspector.getByRole('button', { name: /^Close$/i }).first();\n      if (await visible(close)) await close.click();\n      break;\n    }\n`;
const after = `    if (await visible(equip)) {\n      await equip.click();\n      equipped += 1;\n      await page.waitForTimeout(250);\n      const close = page.locator('.item-inspector.open .sheet-close').first();\n      if (await visible(close)) {\n        await close.click();\n        await page.locator('.item-inspector.open').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});\n      }\n    } else {\n      const close = inspector.getByRole('button', { name: /^Close$/i }).first();\n      if (await visible(close)) {\n        await close.click();\n        await page.locator('.item-inspector.open').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});\n      }\n      break;\n    }\n`;
if (!source.includes(before)) throw new Error('playtest gear-flow anchor not found');
source = source.replace(before, after);
writeFileSync(path, source);
