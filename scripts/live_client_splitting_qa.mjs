import { chromium } from 'playwright';

const url = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });

async function waitForProduction(page) {
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    try {
      await page.locator('[data-client-architecture="split-v1"]').waitFor({ state: 'attached', timeout: 4_000 });
      return;
    } catch {
      await page.waitForTimeout(4_000);
    }
  }
  throw new Error('Timed out waiting for split-v1 production deploy.');
}

function hasResource(resources, token) {
  return resources.some(resource => resource.includes(token));
}

const mobile = await browser.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
const page = await mobile.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
await waitForProduction(page);
await page.getByRole('heading', { name: 'Command deck' }).waitFor({ timeout: 15_000 });
let resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
if (hasResource(resources, 'three-runtime-') || hasResource(resources, 'GameCanvas-') || hasResource(resources, 'Armory-')) throw new Error('Cold command-deck load eagerly fetched deferred client surfaces.');

await page.getByRole('button', { name: 'Equipment', exact: true }).first().click();
await page.locator('.build-bay').waitFor({ timeout: 15_000 });
resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
if (!hasResource(resources, 'Armory-')) throw new Error('Equipment navigation did not fetch the Armory async chunk.');
if (hasResource(resources, 'three-runtime-') || hasResource(resources, 'GameCanvas-')) throw new Error('Equipment navigation fetched the combat/Three runtime.');
await page.screenshot({ path: 'client-split-mobile-build.png', fullPage: true });

await page.getByRole('button', { name: 'Return to ship' }).click();
await page.getByRole('heading', { name: 'Command deck' }).waitFor({ timeout: 15_000 });
await page.getByRole('button', { name: 'Deploy selected contract' }).click();
await page.locator('canvas.game-canvas').waitFor({ state: 'visible', timeout: 30_000 });
resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
if (!hasResource(resources, 'GameCanvas-')) throw new Error('Combat navigation did not fetch the GameCanvas async chunk.');
if (!hasResource(resources, 'three-runtime-')) throw new Error('Combat navigation did not fetch the isolated Three.js runtime chunk.');
await page.screenshot({ path: 'client-split-mobile-combat.png', fullPage: true });
if (pageErrors.length) throw new Error(`Mobile runtime errors: ${pageErrors.join(' | ')}`);
await mobile.close();

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const desktopPage = await desktop.newPage();
const desktopErrors = [];
desktopPage.on('pageerror', error => desktopErrors.push(String(error)));
await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
await desktopPage.locator('[data-client-architecture="split-v1"]').waitFor({ timeout: 15_000 });
await desktopPage.getByRole('heading', { name: 'Command deck' }).waitFor({ timeout: 15_000 });
const desktopResources = await desktopPage.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
if (hasResource(desktopResources, 'three-runtime-') || hasResource(desktopResources, 'GameCanvas-') || hasResource(desktopResources, 'Armory-')) throw new Error('Desktop cold load eagerly fetched deferred surfaces.');
await desktopPage.screenshot({ path: 'client-split-desktop-hub.png', fullPage: true });
if (desktopErrors.length) throw new Error(`Desktop runtime errors: ${desktopErrors.join(' | ')}`);
await desktop.close();
await browser.close();

console.log('LIVE_CLIENT_SPLIT_QA_PASS cold=hub-only equipment=lazy combat=lazy three=deferred viewports=mobile,desktop');
