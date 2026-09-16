import { chromium } from 'playwright';

const target = 'https://ironshade-vector.netlify.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

async function productionReady() {
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const build = page.getByRole('button', { name: /Equipment \/ Build Bay/i });
  if (!(await build.isVisible().catch(() => false))) return false;
  await build.click();
  const card = page.locator('.equipped-card').first();
  if (!(await card.isVisible().catch(() => false))) return false;
  await card.click();
  return page.locator('.gear-deep-details').count().then(count => count > 0).catch(() => false);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 42; attempt += 1) {
    if (await productionReady()) { ready = true; break; }
    await page.waitForTimeout(5_000);
  }
  if (!ready) throw new Error('Production did not publish the mobile clarity UI within the deploy wait window.');

  const inspector = page.locator('.item-inspector.open');
  if (!(await inspector.isVisible())) throw new Error('Mobile item inspector did not open.');
  const box = await inspector.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('Unable to measure mobile item inspector.');
  if (box.x < 0 || box.y < 0 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) {
    throw new Error(`Item inspector escapes viewport: ${JSON.stringify(box)} vs ${JSON.stringify(viewport)}`);
  }
  if (box.width < viewport.width * 0.6) throw new Error(`Item inspector is still too narrow for landscape review: ${box.width}px.`);
  const inspectorBg = await inspector.evaluate(node => getComputedStyle(node).backgroundColor);
  if (/rgba\([^)]*,\s*0(?:\.\d+)?\)$/.test(inspectorBg)) throw new Error(`Item inspector background is still transparent: ${inspectorBg}`);
  const deepDetails = page.locator('.gear-deep-details');
  if (await deepDetails.evaluate(node => node.hasAttribute('open'))) throw new Error('Advanced gear details should be collapsed by default.');
  if (!(await page.locator('.gear-quick-read').isVisible())) throw new Error('Essential gear explanation is not visible before advanced telemetry.');
  await page.screenshot({ path: 'mobile-gear-clarity.png', fullPage: true });

  await page.locator('.sheet-close').click();
  await page.getByRole('button', { name: /Return to ship/i }).click();
  const contracts = page.getByRole('button', { name: /^contracts$/i });
  if (await contracts.isVisible().catch(() => false)) await contracts.click();
  await page.getByRole('button', { name: /Deploy selected contract/i }).click();
  await page.locator('.game-canvas').waitFor({ state: 'visible', timeout: 15_000 });

  let focusVisible = false;
  for (let attempt = 0; attempt < 44; attempt += 1) {
    if (await page.locator('.target-readout').isVisible().catch(() => false)) { focusVisible = true; break; }
    const fire = page.getByRole('button', { name: /fire/i });
    if (await fire.isVisible().catch(() => false)) {
      await fire.dispatchEvent('pointerdown', { pointerId: 41, pointerType: 'touch', isPrimary: true });
      await page.waitForTimeout(300);
      await fire.dispatchEvent('pointerup', { pointerId: 41, pointerType: 'touch', isPrimary: true });
    }
    await page.waitForTimeout(250);
  }
  if (!focusVisible) throw new Error('Focused hostile HP readout never became visible in live combat.');
  const healthBox = await page.locator('.target-health-track').boundingBox();
  if (!healthBox || healthBox.height < 12) throw new Error(`Focused hostile HP track is still too thin: ${healthBox?.height ?? 0}px.`);
  const armorTrack = page.locator('.target-armor-track');
  if (await armorTrack.isVisible().catch(() => false)) {
    const armorBox = await armorTrack.boundingBox();
    if (!armorBox || armorBox.height < 6) throw new Error(`Focused hostile armor track is too thin: ${armorBox?.height ?? 0}px.`);
  }
  const focusText = await page.locator('.target-readout').innerText();
  if (!/HP\s+\d+\s*\/\s*\d+/i.test(focusText)) throw new Error(`Focused hostile readout lacks numeric HP: ${focusText}`);
  await page.screenshot({ path: 'mobile-combat-clarity.png', fullPage: true });

  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log(`LIVE_MOBILE_CLARITY_QA_PASS inspector=${Math.round(box.width)}x${Math.round(box.height)} hpTrack=${healthBox.height.toFixed(1)} focus=${JSON.stringify(focusText.replace(/\s+/g, ' ').trim())}`);
} finally {
  await browser.close();
}
