import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:4173';
const ARTIFACT_DIR = 'playtest-artifacts';
const TARGET_LEVEL = 20;
const MAX_MISSIONS = 80;
const MISSION_TIMEOUT_MS = 240_000;
mkdirSync(ARTIFACT_DIR, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  completedAt: null,
  startLevel: null,
  endLevel: null,
  inputMode: 'mobile-assisted-touch-controls',
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
  try { return await locator.isVisible({ timeout: 250 }); } catch { return false; }
}
async function text(locator) {
  try { return (await locator.innerText({ timeout: 500 })).trim(); } catch { return ''; }
}
function parseLevel(value) {
  const match = value.match(/(?:LV|Operator level\s*LV?)\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}
async function currentShipLevel(page) {
  return parseLevel(await text(page.locator('.ship-header p')));
}
async function debriefLevel(page) {
  const rows = page.locator('.debrief-grid > div');
  for (let index = 0; index < await rows.count(); index += 1) {
    const row = rows.nth(index);
    if ((await text(row.locator('small'))).toLowerCase().includes('operator level')) return parseLevel(await text(row.locator('b')));
  }
  return null;
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
async function readVitals(page) {
  const bars = page.locator('.hud-top .vitals .barline');
  if (await bars.count() < 3) return { hp: NaN, armor: NaN, cap: NaN };
  return {
    hp: Number.parseFloat(await text(bars.nth(0).locator('b'))),
    armor: Number.parseFloat(await text(bars.nth(1).locator('b'))),
    cap: Number.parseFloat(await text(bars.nth(2).locator('b'))),
  };
}
async function useSuppliesIfNeeded(page) {
  const vitals = await readVitals(page);
  const supplies = page.locator('.combat-consumables button');
  if (Number.isFinite(vitals.hp) && vitals.hp < 48 && await supplies.count() > 0 && await supplies.nth(0).isEnabled()) await supplies.nth(0).click();
  if (Number.isFinite(vitals.armor) && vitals.armor < 22 && await supplies.count() > 1 && await supplies.nth(1).isEnabled()) await supplies.nth(1).click();
  if (Number.isFinite(vitals.cap) && vitals.cap < 20 && await supplies.count() > 2 && await supplies.nth(2).isEnabled()) await supplies.nth(2).click();
}
async function useCombatActions(page, cycle) {
  const abilities = page.locator('.touch-ability-fan .ability-button');
  for (let index = 0; index < await abilities.count(); index += 1) {
    const ability = abilities.nth(index);
    if (await ability.isEnabled().catch(() => false) && cycle % (index + 2) === 0) await ability.click().catch(() => {});
  }
  const dodge = page.locator('.dodge-button').first();
  if (cycle % 3 === 0 && await visible(dodge) && await dodge.isEnabled().catch(() => false)) await dodge.click().catch(() => {});
  await useSuppliesIfNeeded(page);
}
async function holdAssistedFire(page, durationMs) {
  const fire = page.locator('.fire-button').first();
  if (!await visible(fire)) throw new Error('Mobile assisted FIRE control is not visible.');
  const box = await fire.boundingBox();
  if (!box) throw new Error('Mobile assisted FIRE control has no layout box.');
  const init = { pointerId: 42, pointerType: 'touch', isPrimary: false, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, buttons: 1, bubbles: true };
  await fire.dispatchEvent('pointerdown', init);
  try {
    await page.waitForTimeout(durationMs);
  } finally {
    await fire.dispatchEvent('pointerup', { ...init, buttons: 0 }).catch(() => {});
  }
}
async function moveWithStick(page, angle, durationMs = 1150) {
  const stick = page.locator('.move-stick').first();
  if (!await visible(stick)) throw new Error('Mobile movement stick is not visible.');
  const box = await stick.boundingBox();
  if (!box) throw new Error('Mobile movement stick has no layout box.');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(38, box.width * 0.30);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, { steps: 4 });
  await page.waitForTimeout(durationMs);
  await page.mouse.up();
}
async function interactIfAvailable(page) {
  const interact = page.locator('.interact-button').first();
  if (await visible(interact) && await interact.isEnabled().catch(() => true)) {
    await interact.click().catch(() => {});
    await page.waitForTimeout(160);
    return true;
  }
  return false;
}

async function followPostClearLocator(page) {
  const prompt = page.locator('.post-clear-objective').first();
  if (!await visible(prompt)) return false;
  const guidance = await text(prompt);
  const match = guidance.match(/NEXT ACT[\s\S]*?\b(UP-LEFT|UP-RIGHT|DOWN-LEFT|DOWN-RIGHT|UP|DOWN|LEFT|RIGHT)\b[\s\S]*?RANGE\s+(\d+)/i);
  if (!match) return false;
  const angles = { RIGHT: 0, 'DOWN-RIGHT': Math.PI / 4, DOWN: Math.PI / 2, 'DOWN-LEFT': Math.PI * 3 / 4, LEFT: Math.PI, 'UP-LEFT': Math.PI * 5 / 4, UP: Math.PI * 3 / 2, 'UP-RIGHT': Math.PI * 7 / 4 };
  const direction = match[1].toUpperCase();
  const range = Number(match[2]);
  const duration = range > 500 ? 1800 : range > 240 ? 1200 : 650;
  log('Following visible objective locator: ' + direction + ' range ' + range);
  await moveWithStick(page, angles[direction], duration);
  await interactIfAvailable(page);
  return true;
}

async function handleOverlay(page, overlay, missionIndex, startingLevel) {
  const overlayText = await text(overlay);
  if (/Operator down/i.test(overlayText)) {
    const restarted = await clickFirstVisibleButton(overlay, [/Restart contract/i, /Restart expedition/i]);
    return restarted ? { kind: 'death' } : { kind: 'unknown', text: overlayText };
  }
  if (/Deep zone secured/i.test(overlayText)) {
    const extracted = await clickFirstVisibleButton(overlay, [/Deep extract \+ recover/i]);
    return extracted ? { kind: 'finish', depth: 'deep' } : { kind: 'unknown', text: overlayText };
  }
  const preferDeep = missionIndex % 3 === 0 || (startingLevel >= 15 && missionIndex % 2 === 0);
  if (preferDeep) {
    const deeper = await clickFirstVisibleButton(overlay, [/Continue deeper/i, /Breach command zone/i, /Enter finale zone/i, /Transit deeper/i]);
    if (deeper) return { kind: 'continue', depth: 'deep' };
  }
  const safe = await clickFirstVisibleButton(overlay, [/Extract safely/i, /Withdraw safely/i, /Extract expedition/i, /Bank full expedition/i]);
  if (safe) return { kind: 'finish', depth: 'safe' };
  const deeper = await clickFirstVisibleButton(overlay, [/Continue deeper/i, /Breach command zone/i, /Enter finale zone/i, /Transit deeper/i]);
  if (deeper) return { kind: 'continue', depth: 'deep' };
  return { kind: 'unknown', text: overlayText };
}

async function playMission(page, missionIndex, startingLevel) {
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 20_000 });
  const missionChip = await text(page.locator('.mission-chip'));
  log(`Mission ${missionIndex}: ${missionChip || 'combat loaded'} at LV ${startingLevel}`);
  const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900);
  if (!coarse) throw new Error('Playtest viewport did not activate the shipped mobile/coarse control path.');

  const missionStarted = Date.now();
  let attemptStarted = Date.now();
  let cycle = 0;
  let deaths = 0;
  let choseDepth = null;
  let lastStatusLog = 0;
  while (Date.now() - attemptStarted < MISSION_TIMEOUT_MS) {
    if (await visible(page.locator('.debrief-shell'))) return { deaths, durationMs: Date.now() - missionStarted, depth: choseDepth ?? 'unknown', missionChip };

    const overlay = page.locator('.overlay').first();
    if (await visible(overlay)) {
      const result = await handleOverlay(page, overlay, missionIndex, startingLevel);
      if (result.kind === 'death') {
        deaths += 1;
        await screenshot(page, `mission-${missionIndex}-death-${deaths}`);
        if (deaths > 4) throw new Error(`Mission ${missionIndex} exceeded four legitimate combat deaths.`);
        attemptStarted = Date.now();
        cycle = 0;
        await page.waitForTimeout(700);
        continue;
      }
      if (result.kind === 'continue') {
        choseDepth = result.depth;
        await page.waitForTimeout(700);
        continue;
      }
      if (result.kind === 'finish') {
        choseDepth = result.depth;
        await page.locator('.debrief-shell').waitFor({ state: 'visible', timeout: 15_000 });
        continue;
      }
      await screenshot(page, `mission-${missionIndex}-unknown-overlay`);
      throw new Error(`Mission ${missionIndex} reached an unrecognized blocking overlay: ${result.text.slice(0, 500)}`);
    }

    if (await followPostClearLocator(page)) { cycle += 1; continue; }
    await interactIfAvailable(page);
    await useCombatActions(page, cycle);
    const worldAxisAngles = { px: 0.497, py: 2.645, nx: 3.639, ny: 5.786 };
    const patrol = [
      [worldAxisAngles.px, 4600], [worldAxisAngles.py, 2100],
      [worldAxisAngles.px, 4600], [worldAxisAngles.ny, 2100],
      [worldAxisAngles.px, 4600], [worldAxisAngles.py, 2100],
      [worldAxisAngles.nx, 4600], [worldAxisAngles.py, 2100],
      [worldAxisAngles.nx, 4600], [worldAxisAngles.ny, 2100],
      [worldAxisAngles.nx, 4600], [worldAxisAngles.py, 2100],
    ];
    const [routeAngle, moveDuration] = patrol[cycle % patrol.length];
    await Promise.all([
      moveWithStick(page, routeAngle, moveDuration),
      holdAssistedFire(page, moveDuration),
    ]);
    if (await visible(page.locator('.overlay').first())) continue;
    await interactIfAvailable(page);

    if (Date.now() - lastStatusLog > 12_000) {
      const status = [await text(page.locator('.objective-progress-chip')), await text(page.locator('.post-clear-objective')), await text(page.locator('.mission-card')), await text(page.locator('.target-readout'))].filter(Boolean).join(' | ');
      const vitals = await readVitals(page);
      log(`Mission ${missionIndex} status: ${status.slice(0, 420)} | player HP ${vitals.hp} ARM ${vitals.armor} CAP ${vitals.cap}`);
      lastStatusLog = Date.now();
    }
    cycle += 1;
  }

  await screenshot(page, `mission-${missionIndex}-timeout`);
  const status = [await text(page.locator('.objective-progress-chip')), await text(page.locator('.post-clear-objective')), await text(page.locator('.mission-card'))].filter(Boolean).join(' | ');
  throw new Error(`Mission ${missionIndex} timed out after ${MISSION_TIMEOUT_MS / 1000}s. Visible status: ${status}`);
}

async function equipFreshLoot(page) {
  let inspector = page.locator('.item-inspector.open').first();
  if (!await visible(inspector)) {
    const cards = page.locator('.inventory-card');
    let fresh = null;
    for (let index = 0; index < await cards.count(); index += 1) {
      const card = cards.nth(index);
      if (/\bNEW\b/i.test(await text(card))) { fresh = card; break; }
    }
    if (!fresh) return 0;
    await fresh.click();
    inspector = page.locator('.item-inspector.open').first();
  }
  await inspector.waitFor({ state: 'visible', timeout: 5000 });
  const equip = inspector.locator('.inspector-actions button.primary').first();
  let equipped = 0;
  if (await visible(equip)) {
    await equip.click();
    equipped = 1;
    await page.waitForTimeout(250);
  }
  const close = inspector.getByRole('button', { name: /^Close$/i }).first();
  await close.waitFor({ state: 'visible', timeout: 3000 });
  await close.click({ force: true });
  await page.locator('.item-inspector.open').waitFor({ state: 'hidden', timeout: 3000 });
  return equipped;
}
async function spendProgression(page, level) {
  const network = page.locator('.build-tabs').getByRole('button', { name: /network/i }).first();
  await network.click();
  await page.locator('.network-panel').waitFor({ state: 'visible', timeout: 5000 });
  if (level >= 15 && await page.locator('.specialization-panel article.selected').count() === 0) {
    const specialization = page.locator('.specialization-select').first();
    if (await visible(specialization)) { await specialization.click(); await page.waitForTimeout(200); }
  }
  if (level >= 16) {
    const overclock = page.getByRole('button', { name: /Enable overclock/i }).first();
    if (await visible(overclock)) { await overclock.click(); await page.waitForTimeout(200); }
  }
  let spent = 0;
  for (let guard = 0; guard < 30; guard += 1) {
    const available = page.locator('.network-branch button:not([disabled])').first();
    if (!await visible(available)) break;
    await available.click();
    spent += 1;
    await page.waitForTimeout(150);
  }
  return spent;
}
async function manageBuild(page, level) {
  await page.locator('.debrief-actions button.primary').first().click();
  await page.locator('.build-bay').waitFor({ state: 'visible', timeout: 10_000 });
  const equipped = await equipFreshLoot(page);
  const spent = await spendProgression(page, level);
  await page.locator('.close-build').first().click();
  await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 10_000 });
  return { equipped, spent };
}
async function chooseStandardContractAndDeploy(page, missionIndex) {
  await page.locator('.ship-tabs').getByRole('button', { name: /^Contracts$/i }).first().click();
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

  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const cardText = await text(card);
    const title = await text(card.locator('h2'));
    const opTier = Number(cardText.match(/OP T(\d+)/i)?.[1] ?? 99);
    const encounter = Number(cardText.match(/ER\s+(\d+)/i)?.[1] ?? 999);
    const priority = /\bPRIORITY\b|COMMAND TRACE|RARE DERELICT|DIRECTIVE|ESCALATION|DAILY|STORY|CAMPAIGN/i.test(cardText);
    candidates.push({ index, title, opTier, encounter, priority });
  }

  const ordinary = candidates.filter(candidate => !candidate.priority);
  const pool = ordinary.length > 0 ? ordinary : candidates;
  const minimumTier = Math.min(...pool.map(candidate => candidate.opTier));
  const tierPool = pool.filter(candidate => candidate.opTier === minimumTier).sort((a, b) => a.encounter - b.encounter || a.index - b.index);
  const minimumEncounter = tierPool[0]?.encounter ?? 999;
  const safest = tierPool.filter(candidate => candidate.encounter <= minimumEncounter + 2);
  const choices = safest.length > 0 ? safest : tierPool;
  const chosen = choices[(missionIndex - 1) % choices.length];
  log('Contract choice: ' + chosen.title + ' // OP T' + chosen.opTier + ' // ER ' + chosen.encounter + ' // ordinary=' + (!chosen.priority));
  const chosenCard = cards.nth(chosen.index);
  await chosenCard.click();
  await page.locator('.deploy-contract').first().click();
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 15_000 });
  return chosen.title;
}


const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
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
    const missionRecord = { mission: missionIndex, contract: contractTitle, startingLevel: level, endingLevel: nextLevel, xp: xpText, depth: result.depth, deaths: result.deaths, durationMs: result.durationMs, build: null };
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
