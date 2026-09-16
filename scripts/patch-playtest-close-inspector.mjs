import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/browser-level1-20-playtest.mjs';
let source = readFileSync(path, 'utf8');

const fireBefore = `async function fireBurst(page, shots = 18) {\n  const fire = page.locator('.fire-button').first();\n  if (!await visible(fire)) throw new Error('Mobile assisted FIRE control is not visible.');\n  for (let index = 0; index < shots; index += 1) {\n    await fire.click({ delay: 18 }).catch(() => {});\n    await page.waitForTimeout(92);\n    if (await visible(page.locator('.overlay').first()) || await visible(page.locator('.debrief-shell'))) break;\n  }\n}\n`;
const fireAfter = `async function fireBurst(page, shots = 18) {\n  const fire = page.locator('.fire-button').first();\n  if (!await visible(fire)) throw new Error('Mobile assisted FIRE control is not visible.');\n  const box = await fire.boundingBox();\n  if (!box) throw new Error('Mobile assisted FIRE control has no layout box.');\n  const x = box.x + box.width / 2;\n  const y = box.y + box.height / 2;\n  for (let index = 0; index < shots; index += 1) {\n    await page.touchscreen.tap(x, y).catch(() => {});\n    await page.waitForTimeout(96);\n    if (await visible(page.locator('.overlay').first()) || await visible(page.locator('.debrief-shell'))) break;\n  }\n}\n`;
if (!source.includes(fireBefore)) throw new Error('fireBurst anchor missing');
source = source.replace(fireBefore, fireAfter);

const timerBefore = `  const started = Date.now();\n  let cycle = 0;\n  let deaths = 0;\n  let choseDepth = null;\n  let lastStatusLog = 0;\n  while (Date.now() - started < MISSION_TIMEOUT_MS) {\n    if (await visible(page.locator('.debrief-shell'))) return { deaths, durationMs: Date.now() - started, depth: choseDepth ?? 'unknown', missionChip };\n`;
const timerAfter = `  const missionStarted = Date.now();\n  let attemptStarted = Date.now();\n  let cycle = 0;\n  let deaths = 0;\n  let choseDepth = null;\n  let lastStatusLog = 0;\n  while (Date.now() - attemptStarted < MISSION_TIMEOUT_MS) {\n    if (await visible(page.locator('.debrief-shell'))) return { deaths, durationMs: Date.now() - missionStarted, depth: choseDepth ?? 'unknown', missionChip };\n`;
if (!source.includes(timerBefore)) throw new Error('mission timer anchor missing');
source = source.replace(timerBefore, timerAfter);

const deathBefore = `        if (deaths > 4) throw new Error(\`Mission \${missionIndex} exceeded four legitimate combat deaths.\`);\n        await page.waitForTimeout(700);\n        continue;\n`;
const deathAfter = `        if (deaths > 4) throw new Error(\`Mission \${missionIndex} exceeded four legitimate combat deaths.\`);\n        attemptStarted = Date.now();\n        cycle = 0;\n        await page.waitForTimeout(700);\n        continue;\n`;
if (!source.includes(deathBefore)) throw new Error('death reset anchor missing');
source = source.replace(deathBefore, deathAfter);

const combatBefore = `    await interactIfAvailable(page);\n    await fireBurst(page, cycle % 4 === 0 ? 26 : 16);\n    if (await visible(page.locator('.overlay').first())) continue;\n    await useCombatActions(page, cycle);\n    await interactIfAvailable(page);\n\n    const routeAngle = (cycle % 12) / 12 * Math.PI * 2 + (cycle % 3 === 0 ? Math.PI / 4 : 0);\n    await moveWithStick(page, routeAngle, cycle % 4 === 0 ? 1550 : 1050);\n    await interactIfAvailable(page);\n`;
const combatAfter = `    await interactIfAvailable(page);\n    await useCombatActions(page, cycle);\n    const routeAngle = (cycle % 16) / 16 * Math.PI * 2 + (cycle % 3 === 0 ? Math.PI / 4 : 0);\n    const moveDuration = cycle % 4 === 0 ? 1850 : 1350;\n    await Promise.all([\n      moveWithStick(page, routeAngle, moveDuration),\n      fireBurst(page, cycle % 4 === 0 ? 18 : 13),\n    ]);\n    if (await visible(page.locator('.overlay').first())) continue;\n    await interactIfAvailable(page);\n`;
if (!source.includes(combatBefore)) throw new Error('combat loop anchor missing');
source = source.replace(combatBefore, combatAfter);

writeFileSync(path, source);
