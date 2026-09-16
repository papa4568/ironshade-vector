import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/browser-level1-20-playtest.mjs';
let source = readFileSync(path, 'utf8');

const before = `async function equipFreshLoot(page) {\n  const cards = page.locator('.inventory-card');\n  let fresh = null;\n  for (let index = 0; index < await cards.count(); index += 1) {\n    const card = cards.nth(index);\n    if (/\\bNEW\\b/i.test(await text(card))) { fresh = card; break; }\n  }\n  if (!fresh) return 0;\n  await fresh.click();\n  const inspector = page.locator('.item-inspector.open');\n  await inspector.waitFor({ state: 'visible', timeout: 5000 });\n  const equip = inspector.locator('.inspector-actions button.primary').first();\n  let equipped = 0;\n  if (await visible(equip)) {\n    await equip.click();\n    equipped = 1;\n    await page.waitForTimeout(250);\n  }\n  const close = inspector.getByRole('button', { name: /^Close$/i }).first();\n  await close.waitFor({ state: 'visible', timeout: 3000 });\n  await close.click({ force: true });\n  await inspector.waitFor({ state: 'hidden', timeout: 3000 });\n  return equipped;\n}\n`;

const after = `async function equipFreshLoot(page) {\n  let inspector = page.locator('.item-inspector.open').first();\n  if (!await visible(inspector)) {\n    const cards = page.locator('.inventory-card');\n    let fresh = null;\n    for (let index = 0; index < await cards.count(); index += 1) {\n      const card = cards.nth(index);\n      if (/\\bNEW\\b/i.test(await text(card))) { fresh = card; break; }\n    }\n    if (!fresh) return 0;\n    await fresh.click();\n    inspector = page.locator('.item-inspector.open').first();\n  }\n  await inspector.waitFor({ state: 'visible', timeout: 5000 });\n  const equip = inspector.locator('.inspector-actions button.primary').first();\n  let equipped = 0;\n  if (await visible(equip)) {\n    await equip.click();\n    equipped = 1;\n    await page.waitForTimeout(250);\n  }\n  const close = inspector.getByRole('button', { name: /^Close$/i }).first();\n  await close.waitFor({ state: 'visible', timeout: 3000 });\n  await close.click({ force: true });\n  await page.locator('.item-inspector.open').waitFor({ state: 'hidden', timeout: 3000 });\n  return equipped;\n}\n`;

if (!source.includes(before)) throw new Error('current equipFreshLoot anchor missing');
source = source.replace(before, after);
writeFileSync(path, source);
