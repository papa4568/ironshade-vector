import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE_URL = process.env.BETA_BASE_URL ?? 'http://127.0.0.1:4173/?betaPlay=1';
const PROFILE_KEY = 'ironshade-vector-profile-v3';
const MAX_MISSIONS = 70;
const MISSION_TIMEOUT_MS = 240_000;
const TICK_MS = 90;
const artifactsDir = 'playtest-artifacts';
mkdirSync(artifactsDir, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {
  startedAt: new Date().toISOString(),
  finishedAt: null,
  initialLevel: null,
  finalLevel: null,
  finalXp: null,
  missions: [],
  pageErrors: [],
  consoleErrors: [],
  notes: [],
};

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', error => report.pageErrors.push(String(error?.stack ?? error)));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });

let heldKeys = new Set();
let mouseDown = false;

async function setKeys(nextKeys) {
  for (const key of heldKeys) if (!nextKeys.has(key)) await page.keyboard.up(key);
  for (const key of nextKeys) if (!heldKeys.has(key)) await page.keyboard.down(key);
  heldKeys = new Set(nextKeys);
}
async function releaseControls() {
  await setKeys(new Set());
  if (mouseDown) {
    await page.mouse.up().catch(() => undefined);
    mouseDown = false;
  }
}
async function readProfile() {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, PROFILE_KEY);
}
async function snapshot() {
  return page.evaluate(() => window.__IRON_BETA_PLAY__?.snapshot?.() ?? null);
}
async function screenshot(name) {
  await page.screenshot({ path: `${artifactsDir}/${name}.png`, fullPage: true }).catch(() => undefined);
}

function targetKeys(player, target, mode, phase) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  let mx = dx / dist;
  let my = dy / dist;
  if (mode === 'combat') {
    if (dist < 175) { mx *= -1; my *= -1; }
    else if (dist < 360) {
      const strafe = phase % 2 === 0 ? 1 : -1;
      const sx = -my * strafe;
      const sy = mx * strafe;
      mx = sx * 0.86 + mx * 0.18;
      my = sy * 0.86 + my * 0.18;
    }
  }
  const keys = new Set();
  if (mx > 0.22) keys.add('KeyD');
  if (mx < -0.22) keys.add('KeyA');
  if (my > 0.22) keys.add('KeyS');
  if (my < -0.22) keys.add('KeyW');
  return { keys, dist, dx, dy };
}

async function aimAt(player, target) {
  const canvas = page.locator('.game-canvas');
  const box = await canvas.boundingBox();
  if (!box) return;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const radius = Math.min(220, Math.max(120, Math.min(box.width, box.height) * 0.34));
  const sx = 0.72 * (ux - uy) * radius;
  const sy = 0.39 * (ux + uy) * radius;
  const x = Math.max(box.x + 8, Math.min(box.x + box.width - 8, box.x + box.width / 2 + sx));
  const y = Math.max(box.y + 8, Math.min(box.y + box.height - 8, box.y + box.height / 2 + sy));
  await page.mouse.move(x, y);
}

async function clickFirstVisible(names) {
  for (const name of names) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function playCombat(runNumber) {
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => !!window.__IRON_BETA_PLAY__?.snapshot, null, { timeout: 20_000 });
  const started = Date.now();
  let deaths = 0;
  let phase = 0;
  let lastAbilityAt = 0;
  let lastDodgeAt = 0;
  let lastInteractAt = 0;
  let lastWeaponAt = 0;
  let lastMissionName = '';

  while (Date.now() - started < MISSION_TIMEOUT_MS) {
    if (await page.locator('.debrief-shell').isVisible().catch(() => false)) {
      await releaseControls();
      return { deaths, durationMs: Date.now() - started, mission: lastMissionName };
    }

    const overlay = page.locator('.overlay').first();
    if (await overlay.isVisible().catch(() => false)) {
      await releaseControls();
      if (await clickFirstVisible([/Deep extract \+ recover/i])) {
        await page.locator('.debrief-shell').waitFor({ state: 'visible', timeout: 30_000 });
        return { deaths, durationMs: Date.now() - started, mission: lastMissionName };
      }
      if (await clickFirstVisible([/Transit deeper/i, /Continue deeper/i, /Enter finale zone/i, /Breach command zone/i])) {
        await sleep(350);
        continue;
      }
      if (await clickFirstVisible([/Restart expedition/i, /Restart contract/i])) {
        deaths += 1;
        if (deaths > 4) throw new Error(`Run ${runNumber}: more than four combat deaths.`);
        await sleep(400);
        continue;
      }
    }

    const s = await snapshot();
    if (!s) { await sleep(TICK_MS); continue; }
    lastMissionName = s.mission?.title ?? lastMissionName;
    if (s.player?.dead) { await sleep(TICK_MS); continue; }

    const now = Date.now();
    const p = s.player;
    if (p.hp / Math.max(1, p.maxHp) < 0.38) await page.keyboard.press('Digit4');
    if (p.armor / Math.max(1, p.maxArmor) < 0.2) await page.keyboard.press('Digit5');
    if (p.capacitor / Math.max(1, p.maxCapacitor) < 0.12) await page.keyboard.press('Digit6');
    if (p.mag <= 2) await page.keyboard.press('KeyR');
    if (p.heat >= 0.88) await page.keyboard.press('KeyV');

    if (s.hostile) {
      const move = targetKeys(p, s.hostile, 'combat', phase);
      await setKeys(move.keys);
      await aimAt(p, s.hostile);
      if (!mouseDown) { await page.mouse.down(); mouseDown = true; }

      if (now - lastWeaponAt > 1200) {
        if (s.hostile.armor > 0 && move.dist > 390) await page.keyboard.press('Digit3');
        else if (move.dist < 165) await page.keyboard.press('Digit2');
        else await page.keyboard.press('Digit1');
        lastWeaponAt = now;
      }
      if (now - lastAbilityAt > 900 && p.capacitor > 32) {
        const cooldowns = p.abilityCooldowns ?? [];
        const candidates = [[1, 'KeyE'], [0, 'KeyQ'], [2, 'KeyF']];
        const ready = candidates.find(([index]) => (cooldowns[index] ?? 1) <= 0);
        if (ready) { await page.keyboard.press(ready[1]); lastAbilityAt = now; }
      }
      if (now - lastDodgeAt > 1700 && (p.dodgeCooldown ?? 1) <= 0 && move.dist < 520) {
        await page.keyboard.press('Space');
        lastDodgeAt = now;
      }
    } else if (s.objective) {
      const move = targetKeys(p, s.objective, 'objective', phase);
      await setKeys(move.keys);
      await aimAt(p, s.objective);
      if (s.objective.destructible && !s.objective.exposed) {
        if (!mouseDown) { await page.mouse.down(); mouseDown = true; }
      } else if (mouseDown) {
        await page.mouse.up(); mouseDown = false;
      }
      if ((move.dist < 145 || s.contextLabel) && now - lastInteractAt > 650) {
        await page.keyboard.press('KeyX');
        lastInteractAt = now;
      }
      if (move.dist < 90 && now - lastDodgeAt > 1900 && (p.dodgeCooldown ?? 1) <= 0) {
        await page.keyboard.press('Space');
        lastDodgeAt = now;
      }
    } else {
      if (mouseDown) { await page.mouse.up(); mouseDown = false; }
      const wander = new Set([phase % 4 < 2 ? 'KeyD' : 'KeyA', phase % 3 === 0 ? 'KeyS' : 'KeyW']);
      await setKeys(wander);
    }

    phase = Math.floor((Date.now() - started) / 2200);
    await sleep(TICK_MS);
  }

  await releaseControls();
  await screenshot(`run-${runNumber}-timeout`);
  const s = await snapshot();
  throw new Error(`Run ${runNumber} timed out after ${MISSION_TIMEOUT_MS / 1000}s; state=${JSON.stringify(s)}`);
}

async function manageBuild() {
  const primary = page.locator('.debrief-actions button.primary');
  await primary.waitFor({ state: 'visible', timeout: 20_000 });
  await primary.click();
  await page.locator('.build-bay').waitFor({ state: 'visible', timeout: 20_000 });

  const newCards = page.locator('.inventory-card').filter({ hasText: 'NEW' });
  const newCount = Math.min(await newCards.count(), 6);
  for (let i = 0; i < newCount; i += 1) {
    const card = newCards.nth(i);
    if (!await card.isVisible().catch(() => false)) continue;
    await card.click();
    await sleep(120);
    const equip = page.locator('.item-inspector .inspector-actions button.primary').first();
    if (await equip.isVisible().catch(() => false)) await equip.click();
    const close = page.locator('.item-inspector .sheet-close').first();
    if (await close.isVisible().catch(() => false)) await close.click();
  }

  const networkTab = page.getByRole('button', { name: /^NETWORK/i }).first();
  if (await networkTab.isVisible().catch(() => false)) {
    await networkTab.click();
    await page.locator('.network-panel').waitFor({ state: 'visible', timeout: 10_000 });
    for (let i = 0; i < 12; i += 1) {
      const profile = await readProfile();
      if (!profile || profile.progressionPoints <= 0) break;
      const enabled = page.locator('.network-branch button:not([disabled])').first();
      if (!await enabled.isVisible().catch(() => false)) break;
      await enabled.click();
      await sleep(100);
    }
    let profile = await readProfile();
    if (profile?.level >= 15 && !profile.specialization) {
      const spec = page.locator('.specialization-select').first();
      if (await spec.isVisible().catch(() => false)) { await spec.click(); await sleep(120); }
    }
    profile = await readProfile();
    if (profile?.level >= 16 && profile.specialization && !profile.specializationOverclock) {
      const overclock = page.getByRole('button', { name: /Enable overclock/i }).first();
      if (await overclock.isVisible().catch(() => false) && await overclock.isEnabled().catch(() => false)) await overclock.click();
    }
  }

  const back = page.getByRole('button', { name: /Return to ship/i }).first();
  await back.click();
  await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 20_000 });
}

async function selectAndDeploy(runNumber) {
  const contractsTab = page.getByRole('button', { name: /^Contracts$/i }).first();
  await contractsTab.click();
  await page.locator('.contracts-layout').waitFor({ state: 'visible', timeout: 15_000 });

  const cards = page.locator('.contract-card:not(.megastructure)');
  const count = await cards.count();
  if (!count) throw new Error('No non-megastructure contracts are available.');
  const index = runNumber % count;
  await cards.nth(index).click();
  const title = await page.locator('.contract-inspector h2').first().innerText();
  await page.locator('.deploy-contract').click();
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30_000 });
  return title;
}

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 30_000 });
  const initial = await readProfile();
  if (!initial) throw new Error('Fresh browser session did not create a profile save.');
  report.initialLevel = initial.level;
  if (initial.level !== 1) throw new Error(`Playthrough must start at level 1; got level ${initial.level}.`);

  let runNumber = 0;
  while (runNumber < MAX_MISSIONS) {
    const before = await readProfile();
    if (!before) throw new Error('Profile disappeared before deployment.');
    if (before.level >= 20) break;
    runNumber += 1;
    const selectedTitle = await selectAndDeploy(runNumber);
    const combat = await playCombat(runNumber);
    const after = await readProfile();
    if (!after) throw new Error(`Profile disappeared after run ${runNumber}.`);
    if (after.runsCompleted !== before.runsCompleted + 1) throw new Error(`Run ${runNumber}: completion count did not advance exactly once.`);
    if (after.xp < before.xp || after.level < before.level) throw new Error(`Run ${runNumber}: progression regressed.`);
    report.missions.push({ run: runNumber, selectedTitle, playedMission: combat.mission, levelBefore: before.level, levelAfter: after.level, xpBefore: before.xp, xpAfter: after.xp, deaths: combat.deaths, durationMs: combat.durationMs, inventory: after.inventory?.length ?? 0 });
    console.log(`PLAYTHROUGH run=${runNumber} mission=${JSON.stringify(combat.mission || selectedTitle)} level=${before.level}->${after.level} xp=${before.xp}->${after.xp} deaths=${combat.deaths} seconds=${Math.round(combat.durationMs / 1000)}`);
    if (after.level >= 20) break;
    await manageBuild();
  }

  const finalProfile = await readProfile();
  if (!finalProfile) throw new Error('Final profile missing.');
  report.finalLevel = finalProfile.level;
  report.finalXp = finalProfile.xp;
  if (finalProfile.level < 20) throw new Error(`Stopped after ${report.missions.length} played missions at level ${finalProfile.level}; expected level 20.`);
  if (report.pageErrors.length) throw new Error(`Browser page errors occurred: ${report.pageErrors.join(' | ')}`);
  console.log(`LEVEL1_20_BROWSER_PLAY_PASS missions=${report.missions.length} level=${finalProfile.level} xp=${finalProfile.xp} runs=${finalProfile.runsCompleted}`);
} catch (error) {
  report.notes.push(String(error?.stack ?? error));
  await releaseControls().catch(() => undefined);
  await screenshot('failure');
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(`${artifactsDir}/playthrough-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
