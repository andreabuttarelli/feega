import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT ?? join(import.meta.dirname, 'fixtures', 'react-shadergradient');
const SHOTS = process.env.SHOTS ?? join(process.env.HOME!, 'Documents/feega-videos/shadergradient');
const PLUGIN = '[data-plugin="feega.shadergradient"]';
mkdirSync(SHOTS, { recursive: true });

const failures: string[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` ${detail}`}`);
  if (!ok) {
    failures.push(label);
  }
};
const reset = () => {
  execFileSync('git', ['checkout', '--', APP]);
  rmSync(join(APP, 'src/feega'), { recursive: true, force: true });
};
const read = (path: string) => readFileSync(join(APP, path), 'utf8');

reset();
const panel = await openPanel(APP);
const { page } = panel;
const settle = (ms = 2500) => page.waitForTimeout(ms);

try {
  await settle(4000);
  await panel.pickAt('#hero');
  await page.locator(PLUGIN).waitFor({ timeout: 15_000 });
  check('the section is in the Properties bar', (await page.locator(`${PLUGIN} [data-control]`).count()) > 10);
  check('the colours are colour fields', (await page.locator(`${PLUGIN} [data-control=color1] .hex`).inputValue()) === '#ff5005');
  await settle(2000);
  await page.screenshot({ path: join(SHOTS, '01-properties.png') });

  await page.locator(`${PLUGIN} [data-control=color1] .hex`).fill('#1a73e8');
  await page.locator(`${PLUGIN} [data-control=color1] .hex`).dispatchEvent('change');
  await settle(3500);
  check('the colour lands in the source', read('src/App.jsx').includes('color1="#1a73e8"'));

  await page.locator(`${PLUGIN} [data-control=uSpeed] input[type=range]`).evaluate((input: HTMLInputElement) => {
    input.value = '0.8';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(3500);
  check('the number lands as a number', read('src/App.jsx').includes('uSpeed={0.8}'));

  await page.locator(`${PLUGIN} [data-control=type] select`).selectOption('sphere');
  await settle(3500);
  check('the type lands as a string', read('src/App.jsx').includes('type="sphere"'));
  await page.locator(`${PLUGIN} [data-control=grain] input`).check();
  await settle(3500);
  check('grain turns on', read('src/App.jsx').includes('grain="on"'));
  await page.screenshot({ path: join(SHOTS, '02-edited.png') });

  await panel.pickAt('#hero h1');
  await page.locator('[data-testid=add-button]').click();
  await page.locator('[data-testid=add-menu] [role=menuitem]', { hasText: 'ShaderGradient (community)' }).click();
  await settle(5000);
  check('the wrapper component is written', existsSync(join(APP, 'src/feega/ShaderGradientBackground.jsx')));
  check('the page uses the wrapper', read('src/App.jsx').includes('<ShaderGradientBackground type="plane"'));
} finally {
  await panel.close();
  reset();
}

if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall passed');
process.exit(0);
