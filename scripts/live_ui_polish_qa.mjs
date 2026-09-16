import { chromium } from 'playwright';

const target = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });
const errors = [];

async function runViewport(name, viewport, mobile) {
  const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
  page.on('pageerror', error => errors.push(`${name} pageerror: ${String(error)}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${name} console: ${message.text()}`); });

  let ready = false;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (await page.getByRole('heading', { name: 'Command deck' }).isVisible().catch(() => false)) { ready = true; break; }
    await page.waitForTimeout(5_000);
  }
  if (!ready) throw new Error(`${name}: production did not publish polished command deck in time`);

  if (await page.getByText('No urgent ship tasks', { exact: false }).isVisible().catch(() => false)) throw new Error(`${name}: empty priority strip still visible`);
  const quickActions = page.locator('.command-action-row button');
  if (await quickActions.count() !== 3) throw new Error(`${name}: expected 3 contextual command actions, got ${await quickActions.count()}`);

  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await page.locator('.stats-panel').waitFor({ state: 'visible' });
  if (await page.getByText('Weapon stat glossary', { exact: true }).count() !== 1) throw new Error(`${name}: weapon glossary is duplicated`);
  if (await page.getByText('What these numbers mean', { exact: true }).count() !== 0) throw new Error(`${name}: old per-weapon glossary remains`);

  await page.getByRole('button', { name: 'Equipment', exact: true }).first().click();
  await page.locator('.build-bay').waitFor({ state: 'visible' });
  const discovery = page.locator('.compact-discovery details');
  if (!(await discovery.isVisible().catch(() => false))) throw new Error(`${name}: compact equipment discovery help missing`);
  if (await page.getByText('Build changes save automatically on this device.', { exact: true }).count() !== 0) throw new Error(`${name}: repetitive build status still visible`);
  await page.getByRole('button', { name: /Return to ship/i }).click();

  await page.getByRole('button', { name: 'Cargo', exact: true }).click();
  await page.locator('.cargo-panel').waitFor({ state: 'visible' });
  if (await page.locator('.hub-resource-ribbon').count() !== 0) throw new Error(`${name}: global resources duplicate Cargo ledger`);

  await page.getByRole('button', { name: 'Contracts', exact: true }).click();
  await page.locator('.contract-inspector').waitFor({ state: 'visible' });
  if (await page.getByText('EQUIPMENT RECOVERY', { exact: true }).count() !== 1) throw new Error(`${name}: equipment recovery explanation is not consolidated`);
  if (await page.getByText('UNIDENTIFIED EQUIPMENT RECOVERY', { exact: true }).count() !== 0) throw new Error(`${name}: duplicate equipment recovery card remains`);

  await page.screenshot({ path: `ui-polish-${name}.png`, fullPage: true });
  await page.close();
}

try {
  await runViewport('mobile', { width: 915, height: 412 }, true);
  await runViewport('desktop', { width: 1440, height: 900 }, false);
  if (errors.length) throw new Error(errors.join(' | '));
  console.log('LIVE_UI_POLISH_QA_PASS viewports=mobile,desktop nav=deduped stats=shared-glossary cargo=no-duplicate-resources gear=compact-help');
} finally {
  await browser.close();
}
