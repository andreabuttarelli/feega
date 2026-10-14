const pw = require('playwright');
const engine = process.argv[2];
(async () => {
  const browser = await pw[engine].launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5191/changelog', { waitUntil: 'networkidle' });
  await page.evaluate((l) => { window.__benchLabel = l; }, `playwright-${engine}-headed`);
  await page.addScriptTag({ url: 'http://localhost:5199/bench.js' });
  await page.waitForFunction(() => document.title === 'BENCH_DONE', null, { timeout: 90000 });
  await page.waitForTimeout(500);
  await browser.close();
})();
