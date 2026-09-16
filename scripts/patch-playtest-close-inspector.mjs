import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/browser-level1-20-playtest.mjs';
let source = readFileSync(path, 'utf8');

const vitalsBefore = `async function readVitals(page) {\n  const bars = page.locator('.barline');\n  if (await bars.count() < 3) return { hp: NaN, armor: NaN, cap: NaN };\n  return {\n    hp: Number.parseFloat(await text(bars.nth(0).locator('b'))),\n    armor: Number.parseFloat(await text(bars.nth(1).locator('b'))),\n    cap: Number.parseFloat(await text(bars.nth(2).locator('b'))),\n  };\n}\n`;
const vitalsAfter = `async function readVitals(page) {\n  const bars = page.locator('.hud-top .vitals .barline');\n  if (await bars.count() < 3) return { hp: NaN, armor: NaN, cap: NaN };\n  return {\n    hp: Number.parseFloat(await text(bars.nth(0).locator('b'))),\n    armor: Number.parseFloat(await text(bars.nth(1).locator('b'))),\n    cap: Number.parseFloat(await text(bars.nth(2).locator('b'))),\n  };\n}\n`;
if (!source.includes(vitalsBefore)) throw new Error('vitals anchor missing');
source = source.replace(vitalsBefore, vitalsAfter);

const fireBefore = `async function fireBurst(page, shots = 18) {\n  const fire = page.locator('.fire-button').first();\n  if (!await visible(fire)) throw new Error('Mobile assisted FIRE control is not visible.');\n  const box = await fire.boundingBox();\n  if (!box) throw new Error('Mobile assisted FIRE control has no layout box.');\n  const x = box.x + box.width / 2;\n  const y = box.y + box.height / 2;\n  for (let index = 0; index < shots; index += 1) {\n    await page.touchscreen.tap(x, y).catch(() => {});\n    await page.waitForTimeout(96);\n    if (await visible(page.locator('.overlay').first()) || await visible(page.locator('.debrief-shell'))) break;\n  }\n}\n`;
const fireAfter = `async function holdAssistedFire(page, durationMs) {\n  const fire = page.locator('.fire-button').first();\n  if (!await visible(fire)) throw new Error('Mobile assisted FIRE control is not visible.');\n  const box = await fire.boundingBox();\n  if (!box) throw new Error('Mobile assisted FIRE control has no layout box.');\n  const init = { pointerId: 42, pointerType: 'touch', isPrimary: false, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, buttons: 1, bubbles: true };\n  await fire.dispatchEvent('pointerdown', init);\n  try {\n    await page.waitForTimeout(durationMs);\n  } finally {\n    await fire.dispatchEvent('pointerup', { ...init, buttons: 0 }).catch(() => {});\n  }\n}\n`;
if (!source.includes(fireBefore)) throw new Error('fire control anchor missing');
source = source.replace(fireBefore, fireAfter);

const combatBefore = `    await interactIfAvailable(page);\n    await useCombatActions(page, cycle);\n    const routeAngle = (cycle % 16) / 16 * Math.PI * 2 + (cycle % 3 === 0 ? Math.PI / 4 : 0);\n    const moveDuration = cycle % 4 === 0 ? 1850 : 1350;\n    await Promise.all([\n      moveWithStick(page, routeAngle, moveDuration),\n      fireBurst(page, cycle % 4 === 0 ? 18 : 13),\n    ]);\n    if (await visible(page.locator('.overlay').first())) continue;\n    await interactIfAvailable(page);\n`;
const combatAfter = `    await interactIfAvailable(page);\n    await useCombatActions(page, cycle);\n    const worldAxisAngles = { px: 0.497, py: 2.645, nx: 3.639, ny: 5.786 };\n    const patrol = [\n      [worldAxisAngles.px, 4600], [worldAxisAngles.py, 2100],\n      [worldAxisAngles.px, 4600], [worldAxisAngles.ny, 2100],\n      [worldAxisAngles.px, 4600], [worldAxisAngles.py, 2100],\n      [worldAxisAngles.nx, 4600], [worldAxisAngles.py, 2100],\n      [worldAxisAngles.nx, 4600], [worldAxisAngles.ny, 2100],\n      [worldAxisAngles.nx, 4600], [worldAxisAngles.py, 2100],\n    ];\n    const [routeAngle, moveDuration] = patrol[cycle % patrol.length];\n    await Promise.all([\n      moveWithStick(page, routeAngle, moveDuration),\n      holdAssistedFire(page, moveDuration),\n    ]);\n    if (await visible(page.locator('.overlay').first())) continue;\n    await interactIfAvailable(page);\n`;
if (!source.includes(combatBefore)) throw new Error('combat patrol anchor missing');
source = source.replace(combatBefore, combatAfter);

const statusBefore = `      log(\`Mission \${missionIndex} status: \${status.slice(0, 420)}\`);\n`;
const statusAfter = `      const vitals = await readVitals(page);\n      log(\`Mission \${missionIndex} status: \${status.slice(0, 420)} | player HP \${vitals.hp} ARM \${vitals.armor} CAP \${vitals.cap}\`);\n`;
if (!source.includes(statusBefore)) throw new Error('status log anchor missing');
source = source.replace(statusBefore, statusAfter);

writeFileSync(path, source);
