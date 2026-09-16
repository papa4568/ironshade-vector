import { chromium } from 'playwright';

const target = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  let ready = false;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const contracts = page.getByRole('button', { name: /^contracts$/i });
    if (await contracts.isVisible().catch(() => false)) {
      await contracts.click();
      const deploy = page.getByRole('button', { name: /Deploy selected contract/i });
      if (await deploy.isVisible().catch(() => false)) {
        await deploy.click();
        const chip = page.locator('.mission-chip');
        if (await chip.isVisible().catch(() => false)) {
          const text = await chip.innerText();
          if (/OP T\d+\s*\/\/\s*ML \d+/i.test(text)) { ready = true; break; }
        }
      }
    }
    await page.waitForTimeout(5_000);
  }
  if (!ready) throw new Error('Production did not expose monster-level mission telemetry within deploy wait window.');
  const canvas = page.locator('.game-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 15_000 });
  const fire = page.getByRole('button', { name: /fire/i });
  if (!(await fire.isVisible().catch(() => false))) throw new Error('mobile FIRE control missing');
  await fire.dispatchEvent('pointerdown', { pointerId: 21, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(4500);
  await fire.dispatchEvent('pointerup', { pointerId: 21, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(400);
  const health = page.locator('.vitals');
  if (!(await health.isVisible())) throw new Error('combat vitals missing after firing');
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  await page.screenshot({ path: 'loot-difficulty-live.png', fullPage: true });
  console.log(`LIVE_LOOT_DIFFICULTY_QA_PASS chip=${JSON.stringify(await page.locator('.mission-chip').innerText())}`);
} finally {
  await browser.close();
}
