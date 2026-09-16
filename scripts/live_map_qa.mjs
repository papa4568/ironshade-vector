import { chromium } from 'playwright';

const target = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });

async function openCombat(context, label) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  let deployed = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const contracts = page.getByRole('button', { name: /^contracts$/i });
    if (await contracts.isVisible().catch(() => false)) {
      await contracts.click();
      const deploy = page.getByRole('button', { name: /Deploy selected contract/i });
      if (await deploy.isVisible().catch(() => false)) {
        await deploy.click();
        if (await page.locator('.game-root').isVisible().catch(() => false)) {
          deployed = true;
          break;
        }
      }
    }
    await page.waitForTimeout(4_000);
  }
  if (!deployed) throw new Error(`${label}: production combat did not become available in the deploy wait window`);
  const canvas = page.locator('.game-canvas');
  await canvas.waitFor({ state: 'visible', timeout: 15_000 });
  const box = await canvas.boundingBox();
  if (!box || box.width < 500 || box.height < 260) throw new Error(`${label}: combat canvas has invalid bounds ${JSON.stringify(box)}`);
  const before = await canvas.screenshot();
  if (before.length < 35_000) throw new Error(`${label}: combat canvas screenshot is unexpectedly small (${before.length} bytes)`);
  await page.keyboard.down('d');
  await page.waitForTimeout(1_300);
  await page.keyboard.up('d');
  await page.waitForTimeout(250);
  const after = await canvas.screenshot();
  if (Buffer.compare(before, after) === 0) throw new Error(`${label}: rendered combat frame did not change after movement input`);
  if (errors.length) throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
  return { page, bytes: after.length, box };
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopResult = await openCombat(desktop, 'desktop');
  await desktopResult.page.screenshot({ path: 'map-overhaul-desktop.png', fullPage: true });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const mobileResult = await openCombat(mobile, 'mobile');
  if (!(await mobileResult.page.locator('.touch-ui').isVisible().catch(() => false))) throw new Error('mobile: touch controls not visible');
  await mobileResult.page.screenshot({ path: 'map-overhaul-mobile.png', fullPage: true });
  await mobile.close();

  console.log(`LIVE_MAP_QA_PASS desktop=${Math.round(desktopResult.box.width)}x${Math.round(desktopResult.box.height)} mobile=${Math.round(mobileResult.box.width)}x${Math.round(mobileResult.box.height)} frames=${desktopResult.bytes}/${mobileResult.bytes}`);
} finally {
  await browser.close();
}
