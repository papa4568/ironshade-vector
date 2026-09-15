import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const TARGET = process.env.PLAYTEST_URL || 'https://ironshade-vector.netlify.app';
const ARTIFACT_DIR = process.env.PLAYTEST_ARTIFACT_DIR || 'playtest-artifacts';
const MAX_MINUTES = Number(process.env.PLAYTEST_MAX_MINUTES || 85);
const MAX_CONTRACTS = Number(process.env.PLAYTEST_MAX_CONTRACTS || 70);
const startedAt = Date.now();
const deadline = startedAt + MAX_MINUTES * 60_000;
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const summary = {
  target: TARGET,
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: null,
  finalLevel: 1,
  contractsBanked: 0,
  deaths: 0,
  restarts: 0,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  notes: [],
};
const log = (...parts) => {
  const line = `[PLAYTEST ${new Date().toISOString()}] ${parts.join(' ')}`;
  console.log(line);
  fs.appendFileSync(path.join(ARTIFACT_DIR, 'playthrough.log'), `${line}\n`);
};
const writeSummary = () => fs.writeFileSync(path.join(ARTIFACT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

function assertTime() {
  if (Date.now() > deadline) throw new Error(`Playthrough exceeded ${MAX_MINUTES} minutes before reaching level 20.`);
}
async function visible(locator) {
  try { return await locator.isVisible(); } catch { return false; }
}
async function snap(page, name) {
  const safe = name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const file = path.join(ARTIFACT_DIR, `${String(summary.screenshots.length + 1).padStart(3, '0')}-${safe}.png`);
  await page.screenshot({ path: file, fullPage: false });
  summary.screenshots.push(file);
  writeSummary();
  log('SCREENSHOT', file);
}
async function text(page) {
  return await page.locator('body').innerText().catch(() => '');
}
async function currentHubLevel(page) {
  const body = await text(page);
  const match = body.match(/Operator level\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}
async function debriefLevel(page) {
  const grid = page.locator('.debrief-grid');
  if (!(await visible(grid))) return null;
  const value = await grid.innerText();
  const match = value.match(/Operator level\s*LV\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}
async function pointerTap(locator, pointerId = 41) {
  if (!(await visible(locator))) return false;
  if (await locator.isDisabled().catch(() => false)) return false;
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
  if (!(await visible(fire))) return;
  await fire.dispatchEvent('pointerup', { pointerId: 77, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0 }).catch(() => {});
}
async function tapReadyActions(page) {
  const abilities = page.locator('.touch-ability-fan .ability-button:not([disabled])');
  const count = await abilities.count();
  for (let i = 0; i < count; i += 1) await pointerTap(abilities.nth(i), 100 + i).catch(() => {});
  await pointerTap(page.locator('.combat-dock .dodge-button:not([disabled])'), 120).catch(() => {});
  const act = page.locator('.combat-dock .interact-button');
  if (await visible(act)) {
    await pointerTap(act, 121).catch(() => {});
    log('ACT interaction used');
  }
}
async function moveStick(page, dx, dy, ms = 900) {
  const stick = page.locator('.move-stick');
  if (!(await visible(stick))) return;
  const box = await stick.boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(box.width, box.height) * 0.36;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx * radius, cy + dy * radius, { steps: 4 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
async function selectLowestStandardContract(page) {
  const standard = page.locator('.contract-filter-row button').filter({ hasText: /^Standard$/i });
  if (await visible(standard)) {
    await standard.click();
    await page.waitForTimeout(250);
  }
  let cards = page.locator('.contract-card');
  let count = await cards.count();
  if (!count) {
    const all = page.locator('.contract-filter-row button').filter({ hasText: /^All$/i });
    if (await visible(all)) await all.click();
    await page.waitForTimeout(250);
    cards = page.locator('.contract-card');
    count = await cards.count();
  }
  if (!count) throw new Error('No contract cards were visible on the contract hub.');
  let best = 0;
  let bestRating = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i += 1) {
    const cardText = await cards.nth(i).innerText();
    const er = Number(cardText.match(/ER\s+(\d+)/i)?.[1] || 9999);
    if (er < bestRating) { bestRating = er; best = i; }
  }
  const chosen = cards.nth(best);
  const chosenText = (await chosen.innerText()).replace(/\s+/g, ' ').trim();
  await chosen.click();
  await page.waitForTimeout(200);
  log('SELECT CONTRACT', `ER=${bestRating}`, chosenText.slice(0, 180));
}
async function deploy(page) {
  await selectLowestStandardContract(page);
  const button = page.getByRole('button', { name: /Deploy selected contract/i });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 15_000 });
  log('DEPLOYED');
}
async function clickSafeExtraction(page) {
  const safeNames = [/Extract safely/i, /Extract expedition/i, /Bank full expedition/i, /Withdraw safely/i, /Deep extract \+ recover/i];
  for (const name of safeNames) {
    const button = page.getByRole('button', { name }).first();
    if (await visible(button)) {
      await releaseFire(page);
      await button.click();
      log('EXTRACTION', String(name));
      return true;
    }
  }
  return false;
}
async function handleDeath(page) {
  const down = page.getByRole('dialog', { name: /Operator down/i });
  if (!(await visible(down))) return false;
  await releaseFire(page);
  summary.deaths += 1;
  await snap(page, `death-${summary.deaths}`);
  const restart = page.getByRole('button', { name: /Restart contract|Restart expedition/i });
  if (!(await visible(restart))) throw new Error('Operator-down dialog appeared without a restart button.');
  await restart.click();
  summary.restarts += 1;
  writeSummary();
  log('RESTART AFTER DEATH', `deaths=${summary.deaths}`);
  await page.waitForTimeout(500);
  return true;
}
async function finishDebrief(page) {
  const level = await debriefLevel(page);
  if (level == null) return false;
  summary.contractsBanked += 1;
  const previous = summary.finalLevel;
  summary.finalLevel = level;
  writeSummary();
  log('DEBRIEF', `banked=${summary.contractsBanked}`, `level=${level}`);
  if (level !== previous || level >= 20) await snap(page, `level-${level}-debrief`);
  if (level >= 20) return true;
  const hub = page.getByRole('button', { name: /Return to contract hub/i });
  if (!(await visible(hub))) throw new Error('Debrief did not expose Return to contract hub.');
  await hub.click();
  await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(250);
  return true;
}

async function playCombat(page, contractNumber) {
  const directions = [
    [1, 0], [0.75, 0.75], [0, 1], [-0.75, 0.75], [-1, 0], [-0.75, -0.75], [0, -1], [0.75, -0.75],
    [1, 0], [1, 0], [0, 1], [0, 1], [-1, 0], [-1, 0], [0, -1], [0, -1],
  ];
  let tick = 0;
  let fireHeld = false;
  const combatStarted = Date.now();
  while (Date.now() - combatStarted < 150_000) {
    assertTime();
    if (await visible(page.locator('.debrief-shell'))) return 'debrief';
    if (await handleDeath(page)) { tick = 0; fireHeld = false; continue; }
    if (await clickSafeExtraction(page)) {
      await page.locator('.debrief-shell').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
      return 'debrief';
    }
    if (!fireHeld) fireHeld = await holdFire(page);
    await tapReadyActions(page);
    const [dx, dy] = directions[tick % directions.length];
    await moveStick(page, dx, dy, tick % 4 === 0 ? 1200 : 850);
    tick += 1;
    if (tick % 14 === 0) log('COMBAT ACTIVE', `contract=${contractNumber}`, `seconds=${Math.round((Date.now() - combatStarted) / 1000)}`);
  }
  await releaseFire(page);
  await snap(page, `stuck-contract-${contractNumber}`);
  const body = (await text(page)).replace(/\s+/g, ' ').slice(0, 900);
  throw new Error(`Combat did not reach extraction/debrief within 150 seconds. Visible UI: ${body}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  screen: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
  locale: 'en-US',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
page.on('pageerror', error => { summary.pageErrors.push(String(error)); log('PAGE ERROR', String(error)); writeSummary(); });
page.on('console', message => {
  if (message.type() === 'error') {
    const value = message.text();
    summary.consoleErrors.push(value);
    log('CONSOLE ERROR', value);
    writeSummary();
  }
});

try {
  log('BEGIN TRUE BROWSER PLAYTHROUGH', TARGET);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 30_000 });
  const initialLevel = await currentHubLevel(page);
  if (initialLevel !== 1) throw new Error(`Fresh browser context did not start at operator level 1; observed ${initialLevel}.`);
  summary.finalLevel = 1;
  await snap(page, 'fresh-level-1-hub');

  for (let contract = 1; contract <= MAX_CONTRACTS && summary.finalLevel < 20; contract += 1) {
    assertTime();
    await deploy(page);
    await playCombat(page, contract);
    const processed = await finishDebrief(page);
    if (!processed) throw new Error('Combat returned without a visible debrief.');
  }

  if (summary.finalLevel < 20) throw new Error(`Reached only level ${summary.finalLevel} after ${summary.contractsBanked} banked contracts.`);
  await snap(page, 'level-20-complete');
  summary.finishedAt = new Date().toISOString();
  summary.notes.push('Progression was earned only through live browser play: contract selection, deploy, touch movement, assisted fire, abilities, dodge, ACT interactions, extraction, and debrief/hub navigation. No localStorage/profile mutation or simulation-module calls were used.');
  writeSummary();
  log('LEVEL20_PLAYTHROUGH_PASS', `level=${summary.finalLevel}`, `banked=${summary.contractsBanked}`, `deaths=${summary.deaths}`, `pageErrors=${summary.pageErrors.length}`, `consoleErrors=${summary.consoleErrors.length}`);
} catch (error) {
  summary.finishedAt = new Date().toISOString();
  summary.notes.push(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
  writeSummary();
  await snap(page, 'failure-final').catch(() => {});
  log('LEVEL20_PLAYTHROUGH_FAIL', error instanceof Error ? error.stack || error.message : String(error));
  throw error;
} finally {
  await releaseFire(page).catch(() => {});
  await browser.close();
}
