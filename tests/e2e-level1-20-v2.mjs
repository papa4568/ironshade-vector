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
const report = { startedAt: new Date().toISOString(), finishedAt: null, initialLevel: null, finalLevel: null, finalXp: null, missions: [], pageErrors: [], consoleErrors: [], notes: [] };

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', error => report.pageErrors.push(String(error?.stack ?? error)));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });

let heldKeys = new Set();
let mouseDown = false;
async function setKeys(nextKeys) { for (const key of heldKeys) if (!nextKeys.has(key)) await page.keyboard.up(key); for (const key of nextKeys) if (!heldKeys.has(key)) await page.keyboard.down(key); heldKeys = new Set(nextKeys); }
async function releaseControls() { await setKeys(new Set()); if (mouseDown) { await page.mouse.up().catch(() => undefined); mouseDown = false; } }
async function readProfile() { return page.evaluate(key => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }, PROFILE_KEY); }
async function snapshot() { return page.evaluate(() => window.__IRON_BETA_PLAY__?.snapshot?.() ?? null); }
async function screenshot(name) { await page.screenshot({ path: `${artifactsDir}/${name}.png`, fullPage: true }).catch(() => undefined); }

function lineIntersectsRect(a, b, rect, margin = 0) {
  const minX = rect.x - margin, maxX = rect.x + rect.w + margin, minY = rect.y - margin, maxY = rect.y + rect.h + margin;
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - minX], [dx, maxX - a.x], [-dy, a.y - minY], [dy, maxY - a.y]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
function clearSegment(a, b, solids, margin = 0) { return !solids.some(rect => lineIntersectsRect(a, b, rect, margin)); }
function blocked(point, solids, margin = 34) { return solids.some(r => point.x >= r.x - margin && point.x <= r.x + r.w + margin && point.y >= r.y - margin && point.y <= r.y + r.h + margin); }
function navWaypoint(state, target) {
  const start = state.player;
  const solids = state.solids ?? [];
  if (clearSegment(start, target, solids, 30)) return target;
  const world = state.world ?? { w: 2400, h: 1080 };
  const step = 70;
  const minX = 110, maxX = world.w - 110, minY = 185, maxY = world.h - 125;
  const cols = Math.max(2, Math.floor((maxX - minX) / step) + 1);
  const rows = Math.max(2, Math.floor((maxY - minY) / step) + 1);
  const key = (x, y) => `${x},${y}`;
  const point = (x, y) => ({ x: minX + x * step, y: minY + y * step });
  const nearestCell = p => ({ x: Math.max(0, Math.min(cols - 1, Math.round((p.x - minX) / step))), y: Math.max(0, Math.min(rows - 1, Math.round((p.y - minY) / step))) });
  const sCell = nearestCell(start), gCell = nearestCell(target);
  const open = [sCell];
  const came = new Map();
  const g = new Map([[key(sCell.x, sCell.y), 0]]);
  const score = cell => (g.get(key(cell.x, cell.y)) ?? Infinity) + Math.hypot(cell.x - gCell.x, cell.y - gCell.y);
  const closed = new Set();
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found = null;
  for (let guard = 0; guard < cols * rows * 3 && open.length; guard += 1) {
    open.sort((a, b) => score(a) - score(b));
    const cur = open.shift();
    const curKey = key(cur.x, cur.y);
    if (closed.has(curKey)) continue;
    closed.add(curKey);
    if (Math.hypot(cur.x - gCell.x, cur.y - gCell.y) <= 1.25) { found = cur; break; }
    for (const [ox, oy] of dirs) {
      const nx = cur.x + ox, ny = cur.y + oy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const np = point(nx, ny);
      if (blocked(np, solids, 34)) continue;
      const nKey = key(nx, ny);
      const tentative = (g.get(curKey) ?? Infinity) + Math.hypot(ox, oy);
      if (tentative >= (g.get(nKey) ?? Infinity)) continue;
      came.set(nKey, cur);
      g.set(nKey, tentative);
      open.push({ x: nx, y: ny });
    }
  }
  if (!found) return target;
  const cells = [];
  let cur = found;
  while (cur) { cells.push(cur); cur = came.get(key(cur.x, cur.y)); }
  cells.reverse();
  const points = cells.map(cell => point(cell.x, cell.y));
  points.push(target);
  let waypoint = points[1] ?? target;
  for (let i = 2; i < points.length; i += 1) { if (clearSegment(start, points[i], solids, 30)) waypoint = points[i]; else break; }
  return waypoint;
}
function targetKeys(player, target, mode, phase, actualTarget = target) {
  const dx = target.x - player.x, dy = target.y - player.y, dist = Math.hypot(dx, dy) || 1;
  const actualDist = Math.hypot(actualTarget.x - player.x, actualTarget.y - player.y) || 1;
  let mx = dx / dist, my = dy / dist;
  if (mode === 'combat') {
    if (actualDist < 165) { mx = -(actualTarget.x - player.x) / actualDist; my = -(actualTarget.y - player.y) / actualDist; }
    else if (actualDist < 330 && Math.hypot(target.x - actualTarget.x, target.y - actualTarget.y) < 40) { const sign = phase % 2 === 0 ? 1 : -1; const tx = -(actualTarget.y - player.y) / actualDist * sign; const ty = (actualTarget.x - player.x) / actualDist * sign; mx = tx * .82 + mx * .24; my = ty * .82 + my * .24; }
  }
  const keys = new Set();
  if (mx > .2) keys.add('KeyD'); if (mx < -.2) keys.add('KeyA'); if (my > .2) keys.add('KeyS'); if (my < -.2) keys.add('KeyW');
  return { keys, dist: actualDist };
}
async function aimAt(player, target) {
  const box = await page.locator('.game-canvas').boundingBox(); if (!box) return;
  const dx = target.x - player.x, dy = target.y - player.y, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
  const radius = Math.min(220, Math.max(120, Math.min(box.width, box.height) * .34));
  const sx = .72 * (ux - uy) * radius, sy = .39 * (ux + uy) * radius;
  await page.mouse.move(Math.max(box.x + 8, Math.min(box.x + box.width - 8, box.x + box.width / 2 + sx)), Math.max(box.y + 8, Math.min(box.y + box.height - 8, box.y + box.height / 2 + sy)));
}
async function clickFirstVisible(names) { for (const name of names) { const button = page.getByRole('button', { name }).first(); if (await button.isVisible().catch(() => false)) { await button.click(); return true; } } return false; }

async function playCombat(runNumber) {
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => !!window.__IRON_BETA_PLAY__?.snapshot, null, { timeout: 20_000 });
  const started = Date.now(); let deaths = 0, phase = 0, lastAbilityAt = 0, lastDodgeAt = 0, lastInteractAt = 0, lastMissionName = '', lastProgressAt = Date.now(), lastKills = -1;
  await page.keyboard.press('Digit1');
  while (Date.now() - started < MISSION_TIMEOUT_MS) {
    if (await page.locator('.debrief-shell').isVisible().catch(() => false)) { await releaseControls(); return { deaths, durationMs: Date.now() - started, mission: lastMissionName }; }
    const overlay = page.locator('.overlay').first();
    if (await overlay.isVisible().catch(() => false)) {
      await releaseControls();
      if (await clickFirstVisible([/Deep extract \+ recover/i])) { await page.locator('.debrief-shell').waitFor({ state: 'visible', timeout: 30_000 }); return { deaths, durationMs: Date.now() - started, mission: lastMissionName }; }
      if (await clickFirstVisible([/Transit deeper/i, /Continue deeper/i, /Enter finale zone/i, /Breach command zone/i])) { await sleep(350); continue; }
      if (await clickFirstVisible([/Restart expedition/i, /Restart contract/i])) { deaths += 1; if (deaths > 4) throw new Error(`Run ${runNumber}: more than four combat deaths.`); await sleep(400); continue; }
    }
    const s = await snapshot(); if (!s) { await sleep(TICK_MS); continue; }
    lastMissionName = s.mission?.title ?? lastMissionName; if (s.player?.dead) { await sleep(TICK_MS); continue; }
    if ((s.telemetry?.kills ?? 0) !== lastKills) { lastKills = s.telemetry?.kills ?? 0; lastProgressAt = Date.now(); }
    const now = Date.now(), p = s.player;
    if (p.hp / Math.max(1, p.maxHp) < .38) await page.keyboard.press('Digit4');
    if (p.armor / Math.max(1, p.maxArmor) < .2) await page.keyboard.press('Digit5');
    if (p.capacitor / Math.max(1, p.maxCapacitor) < .12) await page.keyboard.press('Digit6');
    if (p.weapon !== 'carbine') await page.keyboard.press('Digit1');
    if (p.mag <= 3) await page.keyboard.press('KeyR');
    if (p.heat >= .88) await page.keyboard.press('KeyV');

    if (s.hostile) {
      const waypoint = navWaypoint(s, s.hostile);
      const direct = clearSegment(p, s.hostile, s.solids ?? [], 4);
      const move = targetKeys(p, waypoint, direct ? 'combat' : 'objective', phase, s.hostile);
      await setKeys(move.keys); await aimAt(p, s.hostile);
      if (direct) { if (!mouseDown) { await page.mouse.down(); mouseDown = true; } } else if (mouseDown) { await page.mouse.up(); mouseDown = false; }
      if (now - lastAbilityAt > 900 && p.capacitor > 32) { const cooldowns = p.abilityCooldowns ?? []; const candidates = [[1,'KeyE'],[0,'KeyQ'],[2,'KeyF']]; const ready = candidates.find(([i]) => (cooldowns[i] ?? 1) <= 0); if (ready) { await page.keyboard.press(ready[1]); lastAbilityAt = now; } }
      if (now - lastDodgeAt > 1500 && (p.dodgeCooldown ?? 1) <= 0 && move.dist < 520) { await page.keyboard.press('Space'); lastDodgeAt = now; }
      if (now - lastProgressAt > 16_000 && (p.dodgeCooldown ?? 1) <= 0) { await page.keyboard.press('Space'); lastDodgeAt = now; lastProgressAt = now - 8000; }
    } else if (s.objective) {
      const waypoint = navWaypoint(s, s.objective); const move = targetKeys(p, waypoint, 'objective', phase, s.objective); await setKeys(move.keys); await aimAt(p, s.objective);
      const direct = clearSegment(p, s.objective, s.solids ?? [], 4);
      if (s.objective.destructible && !s.objective.exposed && direct) { if (!mouseDown) { await page.mouse.down(); mouseDown = true; } } else if (mouseDown) { await page.mouse.up(); mouseDown = false; }
      if ((move.dist < 145 || s.contextLabel) && now - lastInteractAt > 600) { await page.keyboard.press('KeyX'); lastInteractAt = now; }
      if (move.dist < 95 && now - lastDodgeAt > 1800 && (p.dodgeCooldown ?? 1) <= 0) { await page.keyboard.press('Space'); lastDodgeAt = now; }
    } else {
      if (mouseDown) { await page.mouse.up(); mouseDown = false; }
      await setKeys(new Set([phase % 4 < 2 ? 'KeyD' : 'KeyA', phase % 3 === 0 ? 'KeyS' : 'KeyW']));
    }
    phase = Math.floor((Date.now() - started) / 2200); await sleep(TICK_MS);
  }
  await releaseControls(); await screenshot(`run-${runNumber}-timeout`); const s = await snapshot(); throw new Error(`Run ${runNumber} timed out after ${MISSION_TIMEOUT_MS / 1000}s; state=${JSON.stringify(s)}`);
}

async function manageBuild() {
  const primary = page.locator('.debrief-actions button.primary'); await primary.waitFor({ state: 'visible', timeout: 20_000 }); await primary.click(); await page.locator('.build-bay').waitFor({ state: 'visible', timeout: 20_000 });
  const newCards = page.locator('.inventory-card').filter({ hasText: 'NEW' }); const newCount = Math.min(await newCards.count(), 6);
  for (let i = 0; i < newCount; i += 1) { const card = newCards.nth(i); if (!await card.isVisible().catch(() => false)) continue; await card.click(); await sleep(120); const equip = page.locator('.item-inspector .inspector-actions button.primary').first(); if (await equip.isVisible().catch(() => false)) await equip.click(); const close = page.locator('.item-inspector .sheet-close').first(); if (await close.isVisible().catch(() => false)) await close.click(); }
  const networkTab = page.getByRole('button', { name: /^NETWORK/i }).first();
  if (await networkTab.isVisible().catch(() => false)) { await networkTab.click(); await page.locator('.network-panel').waitFor({ state: 'visible', timeout: 10_000 }); for (let i = 0; i < 12; i += 1) { const profile = await readProfile(); if (!profile || profile.progressionPoints <= 0) break; const enabled = page.locator('.network-branch button:not([disabled])').first(); if (!await enabled.isVisible().catch(() => false)) break; await enabled.click(); await sleep(100); } let profile = await readProfile(); if (profile?.level >= 15 && !profile.specialization) { const spec = page.locator('.specialization-select').first(); if (await spec.isVisible().catch(() => false)) { await spec.click(); await sleep(120); } } profile = await readProfile(); if (profile?.level >= 16 && profile.specialization && !profile.specializationOverclock) { const overclock = page.getByRole('button', { name: /Enable overclock/i }).first(); if (await overclock.isVisible().catch(() => false) && await overclock.isEnabled().catch(() => false)) await overclock.click(); } }
  await page.getByRole('button', { name: /Return to ship/i }).first().click(); await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 20_000 });
}
async function selectAndDeploy(runNumber) {
  await page.getByRole('button', { name: /^Contracts$/i }).first().click(); await page.locator('.contracts-layout').waitFor({ state: 'visible', timeout: 15_000 });
  const cards = page.locator('.contract-card:not(.megastructure)'); const count = await cards.count(); if (!count) throw new Error('No non-megastructure contracts are available.'); const index = runNumber % count; await cards.nth(index).click(); const title = await page.locator('.contract-inspector h2').first().innerText(); await page.locator('.deploy-contract').click(); await page.locator('.game-root').waitFor({ state: 'visible', timeout: 30_000 }); return title;
}

try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60_000 }); await page.locator('.ship-hub').waitFor({ state: 'visible', timeout: 30_000 });
  const initial = await readProfile(); if (!initial) throw new Error('Fresh browser session did not create a profile save.'); report.initialLevel = initial.level; if (initial.level !== 1) throw new Error(`Playthrough must start at level 1; got level ${initial.level}.`);
  let runNumber = 0;
  while (runNumber < MAX_MISSIONS) {
    const before = await readProfile(); if (!before) throw new Error('Profile disappeared before deployment.'); if (before.level >= 20) break; runNumber += 1;
    const selectedTitle = await selectAndDeploy(runNumber); const combat = await playCombat(runNumber); const after = await readProfile(); if (!after) throw new Error(`Profile disappeared after run ${runNumber}.`);
    if (after.runsCompleted !== before.runsCompleted + 1) throw new Error(`Run ${runNumber}: completion count did not advance exactly once.`); if (after.xp < before.xp || after.level < before.level) throw new Error(`Run ${runNumber}: progression regressed.`);
    report.missions.push({ run: runNumber, selectedTitle, playedMission: combat.mission, levelBefore: before.level, levelAfter: after.level, xpBefore: before.xp, xpAfter: after.xp, deaths: combat.deaths, durationMs: combat.durationMs, inventory: after.inventory?.length ?? 0 });
    console.log(`PLAYTHROUGH run=${runNumber} mission=${JSON.stringify(combat.mission || selectedTitle)} level=${before.level}->${after.level} xp=${before.xp}->${after.xp} deaths=${combat.deaths} seconds=${Math.round(combat.durationMs / 1000)}`);
    if (after.level >= 20) break; await manageBuild();
  }
  const finalProfile = await readProfile(); if (!finalProfile) throw new Error('Final profile missing.'); report.finalLevel = finalProfile.level; report.finalXp = finalProfile.xp;
  if (finalProfile.level < 20) throw new Error(`Stopped after ${report.missions.length} played missions at level ${finalProfile.level}; expected level 20.`); if (report.pageErrors.length) throw new Error(`Browser page errors occurred: ${report.pageErrors.join(' | ')}`);
  console.log(`LEVEL1_20_BROWSER_PLAY_PASS missions=${report.missions.length} level=${finalProfile.level} xp=${finalProfile.xp} runs=${finalProfile.runsCompleted}`);
} catch (error) { report.notes.push(String(error?.stack ?? error)); await releaseControls().catch(() => undefined); await screenshot('failure'); throw error; }
finally { report.finishedAt = new Date().toISOString(); writeFileSync(`${artifactsDir}/playthrough-report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
