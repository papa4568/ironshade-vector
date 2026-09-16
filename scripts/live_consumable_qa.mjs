import { chromium } from 'playwright';

const target = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));

try {
  let ready = false;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const cargo = page.getByRole('button', { name: /^cargo$/i });
    if (await cargo.isVisible().catch(() => false)) {
      await cargo.click();
      if (await page.getByText('FIELD CONSUMABLES // SHIP STORE').isVisible().catch(() => false)) {
        ready = true;
        break;
      }
    }
    await page.waitForTimeout(5_000);
  }
  if (!ready) throw new Error('Netlify did not expose the new consumable store within the deployment wait window.');

  const traumaCard = page.locator('.consumable-shop-card').filter({ hasText: 'Trauma Gel' });
  if (!(await traumaCard.isVisible())) throw new Error('Trauma Gel store card missing.');
  if (!(await traumaCard.getByText('1/6').isVisible())) throw new Error('Fresh save did not start with one Trauma Gel.');
  await traumaCard.getByRole('button', { name: /Buy \/\/ 45 Credits/i }).click();
  if (!(await traumaCard.getByText('2/6').isVisible())) throw new Error('Trauma Gel purchase did not increment stock.');

  await page.getByRole('button', { name: /^contracts$/i }).click();
  await page.getByRole('button', { name: /Deploy selected contract/i }).click();
  await page.locator('.game-root').waitFor({ state: 'visible', timeout: 15_000 });
  const med = page.getByRole('button', { name: 'Trauma Gel' });
  if (!(await med.isVisible())) throw new Error('Trauma Gel combat control missing.');
  const medText = await med.innerText();
  if (!medText.includes('x2')) throw new Error(`Expected purchased Trauma Gel stock in combat HUD; saw ${medText}`);
  if (errors.length) throw new Error(`Page errors: ${errors.join(' | ')}`);
  console.log('LIVE_CONSUMABLE_QA_PASS stock=x2');
} finally {
  await browser.close();
}
