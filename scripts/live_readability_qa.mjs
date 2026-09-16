import { chromium } from 'playwright';

const target = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

async function productionReady() {
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const build = page.getByRole('button', { name: /Equipment \/ Build Bay/i });
  if (!(await build.isVisible().catch(() => false))) return false;
  await build.click();
  return page.locator('.gear-discovery-note').isVisible().catch(() => false);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    if (await productionReady()) { ready = true; break; }
    await page.waitForTimeout(5_000);
  }
  if (!ready) throw new Error('Production did not publish the readability UI within the deploy wait window.');

  const bodyText = await page.locator('body').innerText();
  if (/Review faction doctrines|2 PIECE|4 PIECE/i.test(bodyText)) throw new Error('Equipment Bay still reveals undiscovered faction set targets.');
  const gearCard = page.locator('.equipped-card').first();
  await gearCard.click();
  if (!(await page.locator('.gear-quick-read').isVisible().catch(() => false))) throw new Error('Plain-language item quick read missing.');

  await page.getByRole('button', { name: /Return to ship/i }).click();
  const contracts = page.getByRole('button', { name: /^contracts$/i });
  if (await contracts.isVisible().catch(() => false)) await contracts.click();
  const deploy = page.getByRole('button', { name: /Deploy selected contract/i });
  await deploy.click();
  await page.locator('.game-canvas').waitFor({ state: 'visible', timeout: 15_000 });

  let focusVisible = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await page.locator('.target-readout').isVisible().catch(() => false)) { focusVisible = true; break; }
    const fire = page.getByRole('button', { name: /fire/i });
    if (await fire.isVisible().catch(() => false)) {
      await fire.dispatchEvent('pointerdown', { pointerId: 31, pointerType: 'touch', isPrimary: true });
      await page.waitForTimeout(350);
      await fire.dispatchEvent('pointerup', { pointerId: 31, pointerType: 'touch', isPrimary: true });
    }
    await page.waitForTimeout(250);
  }
  if (!focusVisible) throw new Error('Focused hostile HP readout never became visible in live combat.');
  const focusText = await page.locator('.target-readout').innerText();
  if (!/HP\s+\d+\s*\/\s*\d+/i.test(focusText)) throw new Error(`Focused hostile readout lacks numeric HP: ${focusText}`);
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);

  await page.screenshot({ path: 'readability-live.png', fullPage: true });
  console.log(`LIVE_READABILITY_QA_PASS focus=${JSON.stringify(focusText.replace(/\s+/g, ' ').trim())}`);
} finally {
  await browser.close();
}
