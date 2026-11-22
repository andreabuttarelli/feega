import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT ?? join(import.meta.dirname, 'fixtures/plugins-app');
const SHOTS = process.env.SHOTS ?? join(process.env.HOME!, 'Documents/feega-videos/plugins');
const PLUGIN = '[data-plugin="feega.object-3d"]';
mkdirSync(SHOTS, { recursive: true });

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) {
    failures.push(name);
  }
};
const tracked = ['src/App.svelte', 'package.json'].map((f) => join(APP, f));
const reset = () => {
  execFileSync('git', ['checkout', '--', ...tracked]);
  rmSync(join(APP, 'src/feega'), { recursive: true, force: true });
};
const read = (path: string) => readFileSync(join(APP, path), 'utf8');

reset();
const panel = await openPanel(APP);
const { page, frame } = panel;
const settle = (ms = 2500) => page.waitForTimeout(ms);

try {
  await settle(2500);
  await panel.pickAt('.stage');
  await page.locator('[data-testid=add-button]').click();
  await page.locator('[data-testid=add-menu] [data-op="plugin-category:3D object"]').hover();
  await page.locator('[data-testid=add-submenu]').waitFor();
  check('the Add menu has a 3D object category', (await page.locator('[data-testid=add-submenu] [role=menuitem]').allInnerTexts()).join('|') === 'Cube|Sphere|Torus knot|3D text|Model (.glb)…');
  await page.screenshot({ path: join(SHOTS, '3d-01-add-menu.png') });
  await page.locator('[data-testid=add-submenu] [role=menuitem]', { hasText: 'Torus knot' }).click();
  await settle(7000);

  check('the component file is written', existsSync(join(APP, 'src/feega/Scene3D.svelte')));
  check('the runtime file is written', existsSync(join(APP, 'src/feega/scene3d.ts')));
  check('three is added to package.json', JSON.parse(read('package.json')).dependencies?.three !== undefined);
  check('the page imports and uses the component', read('src/App.svelte').includes("import Scene3D from './feega/Scene3D.svelte'") && read('src/App.svelte').includes('<Scene3D shape="torus"'));
  check('a WebGL canvas renders in the preview', (await frame.locator('[data-feega-scene] canvas').count()) === 1);

  await panel.pickAt('[data-feega-scene]');
  await page.locator(PLUGIN).waitFor({ timeout: 10_000 });
  check('the 3D object section is in the Properties bar', (await page.locator(`${PLUGIN} [data-control]`).count()) === 5);
  await page.locator(PLUGIN).scrollIntoViewIfNeeded();
  await settle(1500);
  await page.screenshot({ path: join(SHOTS, '3d-02-inserted.png') });

  await page.locator(`${PLUGIN} [data-control=material] select`).selectOption('metal');
  await settle(3000);
  check('material change lands on the component usage', read('src/App.svelte').includes('material="metal"'));
  await page.locator(`${PLUGIN} [data-control=autorotate] input`).uncheck();
  await settle(3000);
  check('auto-rotate toggle lands on the component usage', read('src/App.svelte').includes('autorotate="false"'));
  await page.screenshot({ path: join(SHOTS, '3d-03-metal.png') });
} finally {
  await panel.close();
  reset();
}

if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall passed');
