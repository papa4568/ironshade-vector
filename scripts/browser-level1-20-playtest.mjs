import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'playtest-artifacts';
const TARGET_LEVEL = 20;
const MAX_MISSIONS = 80;
const MISSION_TIMEOUT_MS = 210_000;
mkdirSync(ARTIFACT_DIR, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  completedAt: null,
  startLevel: null,
  endLevel: null,
  missions: [],
  consoleErrors: [],
  pageErrors: [],
  notes: [],
};

function log(message) {
  console.log(`[PLAYTEST] ${message}`);
}

function safeName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'capture';
}

async function screenshot(page, name) {
  const path = `${ARTIFACT_DIR}/${safeName(name)}.png`;
  await page.screenshot({ path, fullPage: true }).catch(() => {});
  return path;
}

async function visible(locator) {
  try {
    return await locator.isVisible({ timeout: 250 });
  } catch {
    return false;
  }
}

async function text(locator) {
  try {
    return (await locator.innerText({ timeout: 500 })).trim();
  } catch {
    return '';
  }
}

function parseLevel(value) {
  const match = value.match(/(?:LV|Operator level\s*LV?)\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function currentShipLevel(page) {
  const header = await text(page.locator('.ship-header p'));
  return parseLevel(header);
}

async function debriefLevel(page) {
  const rows = page.locator('.debrief-grid > div');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    if ((await text(row.locator('small'))).toLowerCase().includes('operator level')) {
      return parseLevel(await text(row.locator('b')));
    }
  }
  return null;
}

async function releaseMovement(page, held) {
  for (const code of held) await page.keyboard.up(code).catch(() => {});
  held.clear();
}

async function setMovement(page, held, next) {
  const desired = new Set(next);
  for (const code of [...held]) {
    if (!desired.has(code)) {
      await page.keyboard.up(code).catch(() => {});
      held.delete(code);
    }
  }
  for (const code of desired) {
    if (!held.has(code)) {
      await page.keyboard.down(code);
      held.add(code);
    }
  }
}

async function pressCombatUtilities(page, tick) {
  if (tick % 7 === 0) await page.keyboard.press('Space');
  if (tick % 9 === 0) await page.keyboard.press('KeyQ');
  if (tick % 11 === 0) await page.keyboard.press('KeyE');
  if (tick % 13 === 0) await page.keyboard.press('KeyF');
  if (tick % 17 === 0) await page.keyboard.press('KeyR');
  if (tick % 23 === 0) await page.keyboard.press('KeyV');
  if (tick % 5 === 0) await page.keyboard.press('KeyX');

  if (tick % 10 !== 0) return;
  const bars = page.locator('.barline');
  if (await bars.count() >= 3) {
    const hp = Number.parseFloat(await text(bars.nth(0).locator('b')));
    const armor = Number.parseFloat(await text(bars.nth(1).locator('b')));
    const cap = Number.parseFloat(await text(bars.nth(2).locator('b')));
    if (Number.isFinite(hp) && hp < 45) await page.keyboard.press('Digit4');
    if (Number.isFinite(armor) && armor < 24) await page.keyboard.press('Digit5');
    if (Number.isFinite(cap) && cap < 24) await page.keyboard.press('Digit6');
  }
}

async function clickFirstVisibleButton(scope, patterns) {
  for (const pattern of patterns) {
    const button = scope.getByRole('button', { name: pattern }).first();
    if (await visible(button)) {
      const label = await text(button);
      await button.click();
      return label;
    }
  }
  return null;
}

async function playMission(page, missionIndex, startingLevel) {
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 20_000 });
  const missionChip = await text(page.locator('.mission-chip'));
  log(`Mission ${missionIndex}: ${missionChip || 'combat loaded'} at LV ${startingLevel}`);

  const held = new Set();
  const route = [
    ['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'],
    ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA'],
  ];
  let routeIndex = 0;
  let lastRouteChange = 0;
  let tick = 0;
  let deaths = 0;
  let fireHeld = false;
  let choseDepth = null;
  const started = Date.now();

  const stopFiring = async () => {
    if (!fireHeld) return;
    await page.mouse.up().catch(() => {});
    fireHeld = false;
  };
  const startFiring = async () => {
    if (fireHeld) return;
    const canvas = page.locator('.game-canvas');
    const box = await canvas.boundingBox();
    if (!box) return;
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
    await page.mouse.down();
    fireHeld = true;
  };

  await startFiring();

  while (Date.now() - started < MISSION_TIMEOUT_MS) {
    if (await visible(page.locator('.debrief-shell'))) {
      await stopFiring();
      await releaseMovement(page, held);
      return { deaths, durationMs: Date.now() - started, depth: choseDepth ?? 'unknown', missionChip };
    }

    const overlay = page.locator('.overlay').first();
    if (await visible(overlay)) {
      await stopFiring();
      await releaseMovement(page, held);
      const overlayText = await text(overlay);

      if (/Operator down/i.test(overlayText)) {
        deaths += 1;
        await screenshot(page, `mission-${missionIndex}-death-${deaths}`);
        if (deaths > 4) throw new Error(`Mission ${missionIndex} exceeded four legitimate combat deaths.`);
        const restarted = await clickFirstVisibleButton(overlay, [/Restart contract/i, /Restart expedition/i]);
        if (!restarted) throw new Error(`Mission ${missionIndex} death screen had no restart action.`);
        await page.waitForTimeout(600);
        await startFiring();
        continue;
      }

      if (/Deep zone secured/i.test(overlayText)) {
        const extracted = await clickFirstVisibleButton(overlay, [/Deep extract \+ recover/i]);
        if (!extracted) throw new Error(`Mission ${missionIndex} deep victory had no extraction action.`);
        choseDepth = 'deep';
        await page.locator('.debrief-shell').waitFor({ state: 'visible', timeout: 15_000 });
        continue;
      }

      const preferDeep = missionIndex % 3 === 0 || startingLevel >= 15 && missionIndex % 2 === 0;
      if (preferDeep) {
        const deeper = await clickFirstVisibleButton(overlay, [/Continue deeper/i, /Breach command zone/i, /Enter finale zone/i, /Transit deeper/i]);
        if (deeper) {
          choseDepth = 'deep';
          await page.waitForTimeout(650);
          await startFiring();
          continue;
        }
      }

      const safe = await clickFirstVisibleButton(overlay, [/Extract safely/i, /Withdraw safely/i, /Extract expedition/i, /Bank full expedition/i]);
      if (safe) {
        choseDepth = 'safe';
        await page.locator('.debrief-shell').waitFor({ state: 'visible', timeout: 15_000 });
        continue;
      }

      const deeperFallback = await clickFirstVisibleButton(overlay, [/Continue deeper/i, /Breach command zone/i, /Enter finale zone/i, /Transit deeper/i]);
      if (deeperFallback) {
        choseDepth = 'deep';
        await page.waitForTimeout(650);
        await startFiring();
        continue;
      }

      await screenshot(page, `mission-${missionIndex}-unknown-overlay`);
      throw new Error(`Mission ${missionIndex} reached an unrecognized blocking overlay: ${overlayText.slice(0, 500)}`);
    }

    const canvas = page.locator('.game-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error(`Mission ${missionIndex} lost the combat canvas.`);

    if (Date.now() - lastRouteChange > 2200) {
      await setMovement(page, held, route[routeIndex % route.length]);
      routeIndex += 1;
      lastRouteChange = Date.now();
    }

    const phase = tick * 0.37;
    const radiusX = Math.min(420, box.width * 0.40);
    const radiusY = Math.min(250, box.height * 0.36);
    const x = box.x + box.width / 2 + Math.cos(phase) * radiusX;
    const y = box.y + box.height / 2 + Math.sin(phase) * radiusY;
    await page.mouse.move(x, y);

    const contextAction = page.locator('.context-action').first();
    if (await visible(contextAction) && tick % 4 === 0) {
      await stopFiring();
      await contextAction.click().catch(() => {});
      await startFiring();
    }

    await pressCombatUtilities(page, tick);
    tick += 1;
    await page.waitForTimeout(180);
  }

  await stopFiring();
  await releaseMovement(page, held);
  await screenshot(page, `mission-${missionIndex}-timeout`);
  const status = [await text(page.locator('.objective-progress-chip')), await text(page.locator('.post-clear-objective')), await text(page.locator('.mission-card'))].filter(Boolean).join(' | ');
  throw new Error(`Mission ${missionIndex} timed out after ${MISSION_TIMEOUT_MS / 1000}s. Visible status: ${status}`);
}

async function equipFreshLoot(page) {
  let equipped = 0;
  for (let guard = 0; guard < 4; guard += 1) {
    const cards = page.locator('.inventory-card');
    const count = await cards.count();
    let fresh = null;
    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      if (/\bNEW\b/i.test(await text(card))) {
        fresh = card;
        break;
      }
    }
    if (!fresh) break;
    await fresh.click();
    const inspector = page.locator('.item-inspector.open');
    await inspector.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    const equip = inspector.locator('.inspector-actions button.primary').first();
    if (await visible(equip)) {
      await equip.click();
      equipped += 1;
      await page.waitForTimeout(250);
    } else {
      const close = inspector.getByRole('button', { name: /^Close$/i }).first();
      if (await visible(close)) await close.click();
      break;
    }
  }
  return equipped;
}

async function spendProgression(page, level) {
  const network = page.locator('.build-tabs').getByRole('button', { name: /network/i }).first();
  await network.click();
  await page.locator('.network-panel').waitFor({ state: 'visible', timeout: 5000 });

  if (level >= 15 && await page.locator('.specialization-panel article.selected').count() === 0) {
    const specialization = page.locator('.specialization-select').first();
    if (await visible(specialization)) {
      await specialization.click();
      await page.waitForTimeout(200);
    }
  }
  if (level >= 16) {
    const overclock = page.getByRole('button', { name: /Enable overclock/i }).first();
    if (await visible(overclock)) {
      await overclock.click();
      await page.waitForTimeout(200);
    }
  }

  let spent = 0;
  for (let guard = 0; guard < 30; guard += 1) {
    const available = page.locator('.network-branch button:not([disabled])').first();
    if (!await visible(available)) break;
    await available.click();
    spent += 1;
    await page.waitForTimeout(140);
  }
  return spent;
}

async function manageBuild(page, level) {
  const primary = page.locator('.debrief-actions button.primary').first();
  await primary.click();
  await page.locator('.build-bay').waitFor({ state: 'visible', timeout: 10_000 });
  const equipped = await equipFreshLoot(page);
  const spent = await spendProgression(page, level);
  const close = page.locator('.close-build').first();
  await close.click();
  await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 10_000 });
  return { equipped, spent };
}

async function chooseStandardContractAndDeploy(page, missionIndex) {
  const contractsTab = page.locator('.ship-tabs').getByRole('button', { name: /^Contracts$/i }).first();
  await contractsTab.click();
  await page.locator('.contracts-layout').waitFor({ state: 'visible', timeout: 5000 });
  const standardFilter = page.locator('.contract-filter-row').getByRole('button', { name: /^Standard$/i }).first();
  if (await visible(standardFilter)) await standardFilter.click();
  await page.waitForTimeout(150);
  let cards = page.locator('.contract-card');
  let count = await cards.count();
  if (count === 0) {
    const allFilter = page.locator('.contract-filter-row').getByRole('button', { name: /^All$/i }).first();
    if (await visible(allFilter)) await allFilter.click();
    await page.waitForTimeout(150);
    cards = page.locator('.contract-card');
    count = await cards.count();
  }
  if (count === 0) throw new Error('Contract Board has no deployable contracts.');
  const index = missionIndex % count;
  await cards.nth(index).click();
  const title = await text(cards.nth(index).locator('h2'));
  const deploy = page.locator('.deploy-contract').first();
  await deploy.click();
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 15_000 });
  return title;
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', message => {
  if (message.type() === 'error') {
    const item = `${new Date().toISOString()} ${message.text()}`;
    report.consoleErrors.push(item);
    console.error(`[BROWSER CONSOLE] ${item}`);
  }
});
page.on('pageerror', error => {
  const item = `${new Date().toISOString()} ${error.stack || error.message}`;
  report.pageErrors.push(item);
  console.error(`[PAGE ERROR] ${item}`);
});

let exitCode = 0;
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 15_000 });
  let level = await currentShipLevel(page);
  if (level == null) throw new Error('Could not read the fresh profile level from the Command Deck.');
  report.startLevel = level;
  if (level !== 1) throw new Error(`Fresh browser context did not start at level 1; observed level ${level}.`);
  await screenshot(page, 'level-01-start');
  log('Fresh browser profile confirmed at level 1.');

  let missionIndex = 1;
  while (level < TARGET_LEVEL && missionIndex <= MAX_MISSIONS) {
    const contractTitle = await chooseStandardContractAndDeploy(page, missionIndex);
    const result = await playMission(page, missionIndex, level);
    const nextLevel = await debriefLevel(page);
    if (nextLevel == null) throw new Error(`Mission ${missionIndex} completed without a readable operator level in debrief.`);

    const xpRow = page.locator('.debrief-grid > div').filter({ hasText: 'XP' }).first();
    const xpText = await text(xpRow.locator('b'));
    const missionRecord = {
      mission: missionIndex,
      contract: contractTitle,
      startingLevel: level,
      endingLevel: nextLevel,
      xp: xpText,
      depth: result.depth,
      deaths: result.deaths,
      durationMs: result.durationMs,
      build: null,
    };
    report.missions.push(missionRecord);
    log(`Mission ${missionIndex} complete: ${contractTitle} | LV ${level} -> ${nextLevel} | ${xpText} | ${result.depth} | deaths=${result.deaths}`);

    level = nextLevel;
    report.endLevel = level;
    if ([5, 10, 15, 20].includes(level)) await screenshot(page, `level-${String(level).padStart(2, '0')}-debrief`);
    if (level >= TARGET_LEVEL) break;

    missionRecord.build = await manageBuild(page, level);
    missionIndex += 1;
  }

  if (level < TARGET_LEVEL) throw new Error(`Playthrough stopped at level ${level} after ${MAX_MISSIONS} missions.`);
  if (report.pageErrors.length) throw new Error(`Playthrough reached level 20 but emitted ${report.pageErrors.length} uncaught page error(s).`);
  report.completedAt = new Date().toISOString();
  await screenshot(page, 'level-20-complete');
  log(`LEVEL_1_TO_20_PLAYTHROUGH_PASS missions=${report.missions.length} consoleErrors=${report.consoleErrors.length} pageErrors=${report.pageErrors.length}`);
} catch (error) {
  exitCode = 1;
  report.completedAt = new Date().toISOString();
  report.notes.push(error instanceof Error ? error.stack || error.message : String(error));
  console.error(error);
  await screenshot(page, 'playthrough-failure');
} finally {
  writeFileSync(`${ARTIFACT_DIR}/playthrough-report.json`, JSON.stringify(report, null, 2));
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

process.exit(exitCode);
