import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT ?? join(import.meta.dirname, 'fixtures/plugins-app');
const SHOTS = process.env.SHOTS ?? join(process.env.HOME!, 'Documents/feega-videos/plugins');
const FILE = join(APP, 'src/App.svelte');
const ICON_FILE = join(APP, 'src/feega/icons/CameraIcon.svelte');
const PLUGIN = '[data-plugin="feega.lucide-icons"]';
mkdirSync(SHOTS, { recursive: true });

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) {
    failures.push(name);
  }
};
const reset = () => {
  execFileSync('git', ['checkout', '--', APP]);
  rmSync(join(APP, 'src/feega'), { recursive: true, force: true });
};
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
  const common = await page.locator(`${PLUGIN} [data-control=icon] button`).count();
  check('common icons are shown before anything is typed', common > 20, String(common));
  await shot('lucide-01-section');

  await page.locator(`${PLUGIN} [data-control=query] input`).fill('camera');
  await settle(600);
  check('typing narrows the grid to the match', (await page.locator(`${PLUGIN} [data-control=icon] button`).first().getAttribute('data-item')) === 'camera');
  check('and nothing is written yet', !existsSync(ICON_FILE) && !source().includes('CameraIcon'));
  await page.locator(`${PLUGIN} [data-item=camera]`).click();
  await settle(600);
  check('choosing an icon offers to insert it', (await page.locator(`${PLUGIN} [data-control=insert] button`).innerText()) === 'Insert camera');
  await page.locator(`${PLUGIN} [data-control=size] input[type=range]`).fill('40');
  await settle(600);
  await shot('lucide-02-chosen');

  await page.locator(`${PLUGIN} [data-control=insert] button`).click();
  await settle(2500);
  check('the icon component is written with its svg', existsSync(ICON_FILE) && readFileSync(ICON_FILE, 'utf8').includes('<svg'));
  check('the page imports it and uses it with the chosen size', source().includes("import CameraIcon from './feega/icons/CameraIcon.svelte'") && source().includes('<CameraIcon size={40} />'), source());
  const drawn = await frame.locator('svg path').count();
  check('the running page draws the icon', drawn > 0, String(drawn));
  await shot('lucide-03-inserted');

  await page.locator('button[title^="Undo"]').click();
  await settle(1500);
  check('undo removes the usage and the file', !source().includes('CameraIcon') && !existsSync(ICON_FILE));
} finally {
  await panel.close();
  reset();
}

if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall passed');
