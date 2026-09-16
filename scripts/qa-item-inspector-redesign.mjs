import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = 'qa-artifacts/item-inspector';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Equipment' }).click();
  await page.waitForSelector('.build-bay');
  const equipped = page.locator('.equipped-card').filter({ has: page.locator('b') }).first();
  await equipped.click();
  await page.waitForSelector('.item-inspector.open');

  const inspector = page.locator('.item-inspector.open');
  const header = page.locator('.inspector-header');
  const scroll = page.locator('.inspector-scroll');
  const actions = page.locator('.inspector-actions');
  const [inspectorBox, headerBox, scrollBox, actionsBox, metrics, shellMetrics] = await Promise.all([
    inspector.boundingBox(),
    header.boundingBox(),
    scroll.boundingBox(),
    actions.boundingBox(),
    scroll.evaluate(el => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY,
      minHeight: getComputedStyle(el).minHeight,
    })),
    inspector.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        overflow: style.overflow,
        display: style.display,
        rows: style.gridTemplateRows,
        height: style.height,
        maxHeight: style.maxHeight,
        minHeight: style.minHeight,
        top: style.top,
        bottom: style.bottom,
        boxSizing: style.boxSizing,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
      };
    }),
  ]);
  const report = { viewport: { width: 844, height: 390 }, inspectorBox, headerBox, scrollBox, actionsBox, metrics, shellMetrics, errors };
  writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${outDir}/item-inspector-redesign.png`, fullPage: false });
  console.log('QA_GEOMETRY ' + JSON.stringify(report));

  if (!inspectorBox || !headerBox || !scrollBox || !actionsBox) throw new Error('Inspector layout boxes unavailable');
  if (inspectorBox.x < -1 || inspectorBox.y < -1 || inspectorBox.x + inspectorBox.width > 845 || inspectorBox.y + inspectorBox.height > 391) throw new Error(`Inspector escaped viewport: ${JSON.stringify(inspectorBox)}`);
  if (headerBox.y < inspectorBox.y - 1 || headerBox.y + headerBox.height > actionsBox.y) throw new Error('Inspector header overlaps body/actions');
  if (actionsBox.y + actionsBox.height > inspectorBox.y + inspectorBox.height + 1) throw new Error(`Action dock is outside inspector viewport: shell=${JSON.stringify(inspectorBox)} actions=${JSON.stringify(actionsBox)}`);
  if (!['auto', 'scroll'].includes(metrics.overflowY)) throw new Error(`Inspector body is not scrollable: ${metrics.overflowY}`);
  if (shellMetrics.overflow !== 'hidden' || shellMetrics.display !== 'grid') throw new Error(`Inspector shell contract failed: ${JSON.stringify(shellMetrics)}`);

  const details = page.locator('.gear-deep-details');
  await details.locator('summary').click();
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const expanded = await scroll.evaluate(el => ({ clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop }));
  writeFileSync(`${outDir}/expanded.json`, JSON.stringify(expanded, null, 2));
  if (expanded.scrollHeight > expanded.clientHeight && expanded.scrollTop <= 0) throw new Error('Expanded technical details cannot scroll');
  await page.screenshot({ path: `${outDir}/item-inspector-expanded.png`, fullPage: false });

  if (errors.length) throw new Error(`Browser runtime errors: ${errors.join(' | ')}`);
  console.log(`ITEM_INSPECTOR_VISUAL_QA_PASS body=${metrics.clientHeight}/${metrics.scrollHeight} expanded=${expanded.clientHeight}/${expanded.scrollHeight} scrollTop=${expanded.scrollTop}`);
} finally {
  await browser.close();
}
