import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT ?? join(import.meta.dirname, 'fixtures/plugins-app');
const SHOTS = process.env.SHOTS ?? join(process.env.HOME!, 'Documents/feega-videos/plugins');
const FILE = join(APP, 'src/App.svelte');
const PLUGIN = '[data-plugin="feega.gradient-presets"]';
mkdirSync(SHOTS, { recursive: true });

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) {
    failures.push(name);
  }
};
const reset = () => execFileSync('git', ['checkout', '--', APP]);
const source = () => readFileSync(FILE, 'utf8');

reset();
const panel = await openPanel(APP);
const { page, frame } = panel;
const settle = (ms = 1800) => page.waitForTimeout(ms);
const shot = async (name: string) => {
  await page.locator(PLUGIN).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};

try {
  await settle(2500);
  await panel.pickAt('.hero');
  await page.locator(PLUGIN).waitFor({ timeout: 10_000 });
  check('the gallery shows every preset', (await page.locator(`${PLUGIN} [data-control=preset] button`).count()) === 36);
  await shot('gradients-01-gallery');

  await page.locator(`${PLUGIN} [data-item=aurora]`).click();
  await settle();
  check('a click writes the gradient into the source', source().includes('linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'), source());
  const computed = await frame.locator('.hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  check('the running page shows it', computed.includes('linear-gradient'), computed);
  await shot('gradients-02-applied');

  await page.locator(`${PLUGIN} [data-control=kind] select`).selectOption('conic');
  await settle(600);
  check('the kind filter narrows the gallery', (await page.locator(`${PLUGIN} [data-control=preset] button`).count()) === 9);
  await page.locator(`${PLUGIN} [data-item=prism]`).click();
  await settle();
  check('a conic preset replaces it', source().includes('conic-gradient(from 0deg at 50% 50%, #fbd3e9') && !source().includes('#3b82f6'), source());
  await shot('gradients-03-conic');

  await page.locator(`${PLUGIN} [data-control=clear] button`).click();
  await settle();
  check('remove gradient resets it', source().includes('background-image: none'), source());
} finally {
  await panel.close();
  reset();
}

if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall passed');
