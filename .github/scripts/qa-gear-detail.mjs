import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('qa-artifacts/gear-detail-page', { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const viewport of [{ width: 844, height: 390 }, { width: 740, height: 360 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Equipment' }).click();
    await page.waitForSelector('.gear-storage');
    await page.locator('.equipped-card').first().click();
    await page.waitForSelector('.gear-detail-page');

    if (await page.locator('.gear-storage').count()) throw new Error('Gear browser remained mounted behind dedicated detail page');
    if (await page.locator('.item-inspector.open').count()) throw new Error('Legacy item inspector opened instead of dedicated page');

    const mode = page.locator('.gear-detail-mode');
    const style = await mode.evaluate(el => ({
      overflowY: getComputedStyle(el).overflowY,
      touchAction: getComputedStyle(el).touchAction,
      position: getComputedStyle(el).position,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    if (!['auto', 'scroll'].includes(style.overflowY) || style.touchAction !== 'pan-y' || style.position === 'fixed') throw new Error(`Dedicated page scroll style is wrong: ${JSON.stringify(style)}`);

    const details = page.locator('.gear-deep-details');
    if (await details.count()) await details.locator('summary').click();
    const before = await mode.evaluate(el => el.scrollTop);
    const box = await mode.boundingBox();
    if (!box) throw new Error('Dedicated gear page box unavailable');
    const client = await context.newCDPSession(page);
    const x = Math.round(box.x + box.width * 0.55);
    const startY = Math.round(box.y + box.height * 0.76);
    const endY = Math.round(box.y + box.height * 0.25);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, radiusX: 4, radiusY: 4, force: 1 }] });
    for (let step = 1; step <= 9; step++) {
      const y = Math.round(startY + (endY - startY) * step / 9);
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, radiusX: 4, radiusY: 4, force: 1 }] });
      await page.waitForTimeout(25);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const after = await mode.evaluate(el => el.scrollTop);
    if (after <= before + 20) throw new Error(`Finger swipe did not move dedicated gear page: before=${before} after=${after}`);

    const bottomBack = page.getByRole('button', { name: 'Back to equipment list' });
    await bottomBack.scrollIntoViewIfNeeded();
    await bottomBack.click();
    await page.waitForSelector('.gear-storage');
    if (await page.locator('.gear-detail-page').count()) throw new Error('Back did not return to equipment browser');

    const storageItem = page.locator('.inventory-card').first();
    if (await storageItem.count()) {
      await storageItem.click();
      await page.waitForSelector('.gear-detail-page');
      if (await page.locator('.item-inspector.open').count()) throw new Error('Storage item still opened legacy inspector');
    }
    if (errors.length) throw new Error(errors.join(' | '));
    await page.screenshot({ path: `qa-artifacts/gear-detail-page/detail-${viewport.width}x${viewport.height}.png`, fullPage: false });
    report.push({ viewport, style, before, after });
    await context.close();
  }
  writeFileSync('qa-artifacts/gear-detail-page/report.json', JSON.stringify(report, null, 2));
  console.log('GEAR_DETAIL_PAGE_QA_PASS', JSON.stringify(report));
} finally {
  await browser.close();
}
