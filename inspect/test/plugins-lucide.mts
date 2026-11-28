import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT ?? join(import.meta.dirname, 'fixtures/plugins-app');
const SHOTS = process.env.SHOTS ?? join(process.env.HOME!, 'Documents/feega-videos/plugins');
const FILE = join(APP, 'src/App.svelte');
const ICON_FILE = join(APP, 'src/feega/icons/CameraIcon.svelte');
const PLUGIN = '[data-testid=plugin-popover][data-plugin="feega.lucide-icons"]';
const MENU_ITEM = '[data-op="plugin:feega.lucide-icons/icon"]';
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
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};

try {
  await settle(2500);
  await panel.pickAt('.hero');
  await page.locator('[data-testid=add-button]').click();
  await settle(400);
  await shot('lucide-00-add-menu');
  await page.locator(MENU_ITEM).click();
  await page.locator(PLUGIN).waitFor({ timeout: 10_000 });
  const common = await page.locator(`${PLUGIN} [data-control=icon] button`).count();
  check('common icons are shown before anything is typed', common > 20, String(common));
  await shot('lucide-01-section');

  await page.locator(`${PLUGIN} [data-control=query] input`).fill('camera');
  await settle(600);
  check('typing narrows the grid to the match', (await page.locator(`${PLUGIN} [data-control=icon] button`).first().getAttribute('data-item')) === 'camera');
  check('and nothing is written yet', !existsSync(ICON_FILE) && !source().includes('CameraIcon'));
  await shot('lucide-02-searched');
  await page.locator(`${PLUGIN} [data-item=camera]`).click();
  await settle(2500);
  check('choosing an icon closes the popover', (await page.locator(PLUGIN).count()) === 0);
  check('the icon component is written with its svg', existsSync(ICON_FILE) && readFileSync(ICON_FILE, 'utf8').includes('<svg'));
  check('the page imports it and uses it', source().includes("import CameraIcon from './feega/icons/CameraIcon.svelte'") && source().includes('<CameraIcon />'), source());
  const drawn = await frame.locator('svg path').count();
  check('the running page draws the icon', drawn > 0, String(drawn));
  await shot('lucide-03-inserted');
  await panel.pickAt('svg');
  await settle(1200);
  check('no icon library section sits in Properties', (await page.locator('[data-plugin="feega.lucide-icons"]').count()) === 0);
  await shot('lucide-04-icon-selected');

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
