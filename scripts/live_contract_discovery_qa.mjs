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
    if (await contracts.isVisible().catch(() => false)) await contracts.click();
    const marker = page.getByText('UNIDENTIFIED EQUIPMENT RECOVERY', { exact: true });
    if (await marker.isVisible().catch(() => false)) { ready = true; break; }
    await page.waitForTimeout(5_000);
  }
  if (!ready) throw new Error('Production did not publish discovery-safe contract rewards within wait window.');

  const contractText = await page.locator('.contract-inspector').innerText();
  if (/DEDICATED SINGULAR POOL|LOCATION CHASE POOL|RECOVERY CEILING\s*\/\/\s*RL|FRAME GEN\s*\/\//i.test(contractText)) {
    throw new Error(`Contract Board still exposes unrecovered gear targeting: ${contractText}`);
  }
  if (!/Names and effects are revealed only after recovery/i.test(contractText)) {
    throw new Error('Contract Board is missing the acquisition-first discovery explanation.');
  }

  const build = page.getByRole('button', { name: /Equipment \/ Build Bay/i });
  await build.click();
  const bayText = await page.locator('body').innerText();
  if (/Review faction doctrines|2 PIECE|4 PIECE/i.test(bayText)) throw new Error('Equipment Bay reintroduced future set targets.');
  if (!(await page.locator('.gear-discovery-note').isVisible().catch(() => false))) throw new Error('Equipment discovery guidance missing.');
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);

  await page.screenshot({ path: 'contract-discovery-live.png', fullPage: true });
  console.log('LIVE_CONTRACT_DISCOVERY_QA_PASS pools=hidden baySets=hidden acquisitionFirst=true');
} finally {
  await browser.close();
}
