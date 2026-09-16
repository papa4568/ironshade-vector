import { chromium } from 'playwright';

const target = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (await page.locator('.command-overview').isVisible().catch(() => false)) { ready = true; break; }
    await page.waitForTimeout(4_000);
  }
  if (!ready) throw new Error('Production did not publish the command hub within the deploy window.');
  if (!(await page.locator('.command-diorama').isVisible())) throw new Error('Ship/operator visual is not visible on opening hub.');
  const overviewText = (await page.locator('.command-overview').innerText()).replace(/\s+/g, ' ');
  if (!/MV Quiet Signal/i.test(overviewText) || !/Player Stats/i.test(overviewText)) throw new Error(`Opening hub missing navigation/identity: ${overviewText}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error(`Opening hub has horizontal overflow: ${overflow}px`);
  await page.screenshot({ path: 'command-hub-mobile.png', fullPage: true });

  await page.locator('.command-nav-grid').getByRole('button', { name: /Player Stats/i }).click();
  await page.locator('.stats-panel').waitFor({ state: 'visible', timeout: 5_000 });
  const statsText = (await page.locator('.stats-panel').innerText()).replace(/\s+/g, ' ');
  for (const required of ['Health', 'Armor', 'Capacitor', 'Vacuum resistance', 'BURST DPS', 'MAG / MARK / ARC']) if (!statsText.toLowerCase().includes(required.toLowerCase())) throw new Error(`Stats page missing ${required}`);
  const statCards = await page.locator('.player-stat-card').count();
  if (statCards < 8) throw new Error(`Expected at least 8 explained player stats, got ${statCards}`);
  await page.screenshot({ path: 'player-stats-mobile.png', fullPage: true });
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log(`LIVE_COMMAND_HUB_QA_PASS statCards=${statCards} overview=${JSON.stringify(overviewText.slice(0, 180))}`);
} finally {
  await browser.close();
}
