import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const TARGET = process.env.PLAYTEST_URL || 'https://ironshade-vector.netlify.app';
const ARTIFACT_DIR = process.env.PLAYTEST_ARTIFACT_DIR || 'playtest-artifacts';
const MAX_MINUTES = Number(process.env.PLAYTEST_MAX_MINUTES || 88);
const MAX_CONTRACTS = Number(process.env.PLAYTEST_MAX_CONTRACTS || 70);
const startedAt = Date.now();
const deadline = startedAt + MAX_MINUTES * 60_000;
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const summary = { target: TARGET, startedAt: new Date(startedAt).toISOString(), finishedAt: null, finalLevel: 1, contractsBanked: 0, deaths: 0, restarts: 0, screenshots: [], consoleErrors: [], pageErrors: [], notes: [] };
const log = (...parts) => {
  const line = `[PLAYTEST ${new Date().toISOString()}] ${parts.join(' ')}`;
  console.log(line);
  fs.appendFileSync(path.join(ARTIFACT_DIR, 'playthrough.log'), `${line}\n`);
};
const save = () => fs.writeFileSync(path.join(ARTIFACT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
const visible = async locator => { try { return await locator.isVisible(); } catch { return false; } };
const assertTime = () => { if (Date.now() > deadline) throw new Error(`Playthrough exceeded ${MAX_MINUTES} minutes before level 20.`); };

async function snap(page, label) {
  const safe = label.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const file = path.join(ARTIFACT_DIR, `${String(summary.screenshots.length + 1).padStart(3, '0')}-${safe}.png`);
  await page.screenshot({ path: file });
  summary.screenshots.push(file); save(); log('SCREENSHOT', file);
}
async function bodyText(page) { return page.locator('body').innerText().catch(() => ''); }
async function hubLevel(page) { return Number((await bodyText(page)).match(/Operator level\s+(\d+)/i)?.[1] || 0) || null; }
async function debriefLevel(page) {
  const grid = page.locator('.debrief-grid');
  if (!(await visible(grid))) return null;
  const value = await grid.innerText();
  return Number(value.match(/Operator level\s*LV\s*(\d+)/i)?.[1] || 0) || null;
}
async function pointerTap(locator, pointerId = 41) {
  if (!(await visible(locator)) || await locator.isDisabled().catch(() => false)) return false;
  await locator.dispatchEvent('pointerdown', { pointerId, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
  await locator.dispatchEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 });
  return true;
}
async function holdFire(page) {
  const fire = page.locator('.fire-button');
  if (!(await visible(fire))) return false;
  await fire.dispatchEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 });
  return true;
}
async function releaseFire(page) {
  const fire = page.locator('.fire-button');
  if (await visible(fire)) await fire.dispatchEvent('pointerup', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 }).catch(() => {});
}
async function moveStick(page, dx, dy, ms = 900) {
  const stick = page.locator('.move-stick');
  if (!(await visible(stick))) return;
  const box = await stick.boundingBox();
  if (!box) return;
  const length = Math.hypot(dx, dy) || 1;
  dx /= length; dy /= length;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, radius = Math.min(box.width, box.height) * 0.37;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + dx * radius, cy + dy * radius, { steps: 3 });
  await page.waitForTimeout(ms); await page.mouse.up();
}
async function tapCombatActions(page) {
  const act = page.locator('.combat-dock .interact-button');
  if (await pointerTap(act, 121)) { log('ACT interaction used'); await page.waitForTimeout(220); }
  const abilities = page.locator('.touch-ability-fan .ability-button:not([disabled])');
  for (let i = 0, count = await abilities.count(); i < count; i += 1) await pointerTap(abilities.nth(i), 100 + i).catch(() => {});
  await pointerTap(page.locator('.combat-dock .dodge-button:not([disabled])'), 120).catch(() => {});
  await pointerTap(page.locator('.touch-utility-rail .vent-button'), 122).catch(() => {});
}

function objectiveScore(value) {
  const text = value.toLowerCase();
  if (/pressure|manifold|seal/.test(text)) return 0;
  if (/both|two|2\//.test(text)) return 1;
  if (/three|all three|3\//.test(text)) return 3;
  return 2;
}
async function selectPreferredStandardContract(page) {
  const standard = page.locator('.contract-filter-row button').filter({ hasText: /^Standard$/i });
  if (await visible(standard)) { await standard.click(); await page.waitForTimeout(200); }
  let cards = page.locator('.contract-card');
  let count = await cards.count();
  if (!count) {
    const all = page.locator('.contract-filter-row button').filter({ hasText: /^All$/i });
    if (await visible(all)) await all.click();
    await page.waitForTimeout(200); cards = page.locator('.contract-card'); count = await cards.count();
  }
  if (!count) throw new Error('No visible contracts.');
  let best = null;
  for (let i = 0; i < count; i += 1) {
    await cards.nth(i).click(); await page.waitForTimeout(90);
    const cardText = (await cards.nth(i).innerText()).replace(/\s+/g, ' ').trim();
    const er = Number(cardText.match(/ER\s+(\d+)/i)?.[1] || 9999);
    const objective = await page.locator('.contract-inspector .objective-box').innerText().catch(() => '');
    const score = objectiveScore(objective);
    if (!best || score < best.score || (score === best.score && er < best.er)) best = { i, score, er, cardText, objective: objective.replace(/\s+/g, ' ').trim() };
  }
  await cards.nth(best.i).click(); await page.waitForTimeout(140);
  log('SELECT CONTRACT', `objectiveScore=${best.score}`, `ER=${best.er}`, best.cardText.slice(0, 150), `OBJECTIVE=${best.objective.slice(0, 130)}`);
}
async function deploy(page) {
  await selectPreferredStandardContract(page);
  const button = page.getByRole('button', { name: /Deploy selected contract/i });
  await button.scrollIntoViewIfNeeded(); await button.click();
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 15_000 });
  log('DEPLOYED');
}

async function findRenderedObjectiveBeacon(page) {
  const buffer = await page.screenshot({ type: 'png' });
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  const buckets = new Map();
  const minX = Math.floor(width * 0.17), maxX = Math.floor(width * 0.80);
  const minY = Math.max(82, Math.floor(height * 0.20)), maxY = Math.floor(height * 0.84);
  for (let y = minY; y < maxY; y += 2) {
    for (let x = minX; x < maxX; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 180 || r < 145 || g < 175 || b > 185 || g < r * 0.92 || g < b * 1.18) continue;
      const bx = Math.floor(x / 28), by = Math.floor(y / 28), key = `${bx}:${by}`;
      const v = buckets.get(key) || { count: 0, x: 0, y: 0 };
      v.count += 1; v.x += x; v.y += y; buckets.set(key, v);
    }
  }
  let best = null;
  for (const value of buckets.values()) if (value.count >= 2 && (!best || value.count > best.count)) best = value;
  if (!best) return null;
  return { x: best.x / best.count, y: best.y / best.count, width, height, count: best.count };
}
function screenDirectionToMove(point) {
  const dx = point.x - point.width * 0.5;
  const dy = point.y - point.height * 0.52;
  const wx = dx / (2 * 0.72) + dy / (2 * 0.39);
  const wy = dy / (2 * 0.39) - dx / (2 * 0.72);
  const length = Math.hypot(wx, wy) || 1;
  return { x: wx / length, y: wy / length, distancePx: Math.hypot(dx, dy) };
}

async function clickSafeExtraction(page) {
  for (const name of [/Extract safely/i, /Extract expedition/i, /Bank full expedition/i, /Withdraw safely/i, /Deep extract \+ recover/i]) {
    const button = page.getByRole('button', { name }).first();
    if (await visible(button)) { await releaseFire(page); await button.click(); log('EXTRACTION', String(name)); return true; }
  }
  return false;
}
async function handleDeath(page) {
  const dialog = page.getByRole('dialog', { name: /Operator down/i });
  if (!(await visible(dialog))) return false;
  await releaseFire(page); summary.deaths += 1; await snap(page, `death-${summary.deaths}`);
  const restart = page.getByRole('button', { name: /Restart contract|Restart expedition/i });
  if (!(await visible(restart))) throw new Error('Death dialog had no restart action.');
  await restart.click(); summary.restarts += 1; save(); log('RESTART AFTER DEATH', `deaths=${summary.deaths}`); await page.waitForTimeout(650); return true;
}
async function finishDebrief(page) {
  const level = await debriefLevel(page); if (level == null) return false;
  const previous = summary.finalLevel; summary.finalLevel = level; summary.contractsBanked += 1; save();
  log('DEBRIEF', `banked=${summary.contractsBanked}`, `level=${level}`);
  if (level !== previous || level >= 20) await snap(page, `level-${level}-debrief`);
  if (level >= 20) return true;
  const hub = page.getByRole('button', { name: /Return to contract hub/i });
  if (!(await visible(hub))) throw new Error('Debrief missing Return to contract hub.');
  await hub.click(); await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 15_000 }); await page.waitForTimeout(220); return true;
}

async function playCombat(page, contractNumber) {
  const sweep = [[1,0],[.7,.7],[0,1],[-.7,.7],[-1,0],[-.7,-.7],[0,-1],[.7,-.7],[1,0],[0,1],[-1,0],[0,-1]];
  let tick = 0, fireHeld = false, attempt = 1, deaths = 0, attemptStarted = Date.now();
  while (true) {
    assertTime();
    if (Date.now() - attemptStarted > 225_000) {
      await releaseFire(page); await snap(page, `stuck-contract-${contractNumber}-attempt-${attempt}`);
      throw new Error(`Contract ${contractNumber} attempt ${attempt} timed out. UI: ${(await bodyText(page)).replace(/\s+/g,' ').slice(0,900)}`);
    }
    if (await visible(page.locator('.debrief-shell'))) return;
    if (await handleDeath(page)) {
      deaths += 1; if (deaths >= 5) throw new Error(`Contract ${contractNumber} caused five deaths without a clear.`);
      tick = 0; fireHeld = false; attempt += 1; attemptStarted = Date.now(); log('NEW ATTEMPT', `contract=${contractNumber}`, `attempt=${attempt}`); continue;
    }
    if (await clickSafeExtraction(page)) { await page.locator('.debrief-shell').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}); return; }
    if (!fireHeld) fireHeld = await holdFire(page);
    await tapCombatActions(page);

    const beacon = tick % 2 === 0 ? await findRenderedObjectiveBeacon(page).catch(() => null) : null;
    if (beacon) {
      const move = screenDirectionToMove(beacon);
      if (tick % 8 === 0) log('VISUAL OBJECTIVE', `x=${Math.round(beacon.x)}`, `y=${Math.round(beacon.y)}`, `pixels=${beacon.count}`, `distance=${Math.round(move.distancePx)}`);
      await moveStick(page, move.x, move.y, move.distancePx < 72 ? 420 : move.distancePx < 145 ? 760 : 1180);
    } else {
      const [dx, dy] = sweep[tick % sweep.length]; await moveStick(page, dx, dy, tick % 3 === 0 ? 1500 : 1050);
    }
    tick += 1;
    if (tick % 16 === 0) log('COMBAT ACTIVE', `contract=${contractNumber}`, `attempt=${attempt}`, `seconds=${Math.round((Date.now()-attemptStarted)/1000)}`);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'en-US', reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => { summary.pageErrors.push(String(error)); log('PAGE ERROR', String(error)); save(); });
page.on('console', message => { if (message.type() === 'error') { summary.consoleErrors.push(message.text()); log('CONSOLE ERROR', message.text()); save(); } });

try {
  log('BEGIN TRUE BROWSER PLAYTHROUGH', TARGET);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45_000 }); await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 30_000 });
  const initial = await hubLevel(page); if (initial !== 1) throw new Error(`Fresh browser did not start at level 1; observed ${initial}.`);
  await snap(page, 'fresh-level-1-hub');
  for (let contract = 1; contract <= MAX_CONTRACTS && summary.finalLevel < 20; contract += 1) {
    assertTime(); await deploy(page); await playCombat(page, contract); if (!(await finishDebrief(page))) throw new Error('Combat ended without visible debrief.');
  }
  if (summary.finalLevel < 20) throw new Error(`Only reached level ${summary.finalLevel} after ${summary.contractsBanked} banked contracts.`);
  summary.finishedAt = new Date().toISOString(); summary.notes.push('Level progression was earned exclusively through the live browser UI. The browser used screenshots of rendered objective beacons for navigation; it did not read game coordinates, mutate storage, seed XP, or invoke simulation APIs.'); save();
  await snap(page, 'level-20-complete'); log('LEVEL20_PLAYTHROUGH_PASS', `level=${summary.finalLevel}`, `banked=${summary.contractsBanked}`, `deaths=${summary.deaths}`, `pageErrors=${summary.pageErrors.length}`, `consoleErrors=${summary.consoleErrors.length}`);
} catch (error) {
  summary.finishedAt = new Date().toISOString(); summary.notes.push(`FAILED: ${error instanceof Error ? error.message : String(error)}`); save(); await snap(page, 'failure-final').catch(() => {}); log('LEVEL20_PLAYTHROUGH_FAIL', error instanceof Error ? error.stack || error.message : String(error)); throw error;
} finally { await releaseFire(page).catch(() => {}); await browser.close(); }
