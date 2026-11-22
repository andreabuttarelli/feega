import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

type Case = { app: string; file: string; target: string; component: string; usage: string; import: string };

const CASES: Record<string, Case> = {
  svelte: { app: 'plugins-app', file: 'src/App.svelte', target: '.stage', component: 'src/feega/Scene3D.svelte', usage: '<Scene3D shape="torus"', import: "import Scene3D from './feega/Scene3D.svelte'" },
  react: { app: 'react-css', file: 'src/App.jsx', target: '#title', component: 'src/feega/Scene3D.jsx', usage: '<Scene3D shape="torus"', import: "import Scene3D from './feega/Scene3D'" },
  vue: { app: 'vue-css', file: 'src/App.vue', target: '#title', component: 'src/feega/Scene3D.vue', usage: '<Scene3D shape="torus"', import: "import Scene3D from './feega/Scene3D.vue'" },
  astro: { app: 'astro-css', file: 'src/pages/index.astro', target: 'h1', component: 'src/feega/Scene3D.astro', usage: '<Scene3D shape="torus"', import: "import Scene3D from '../feega/Scene3D.astro'" }
};

const name = process.argv[2] ?? 'svelte';
const run = CASES[name];
const APP = process.env.INSPECT_APP_ROOT ?? join(import.meta.dirname, 'fixtures', run.app);
const SHOTS = process.env.SHOTS ?? join(process.env.HOME!, 'Documents/feega-videos/plugins');
const PLUGIN = '[data-plugin="feega.object-3d"]';
mkdirSync(SHOTS, { recursive: true });

const failures: string[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${name}] ${label}${ok ? '' : ` ${detail}`}`);
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
const { page, frame } = panel;
const settle = (ms = 2500) => page.waitForTimeout(ms);
const hasScene = () => frame.locator('[data-feega-scene] canvas').count();

try {
  await settle(3500);
  await panel.pickAt(run.target);
  await page.locator('[data-testid=add-button]').click();
  await page.locator('[data-testid=add-menu] [data-op="plugin-category:3D object"]').hover();
  await page.locator('[data-testid=add-submenu]').waitFor();
  check('the Add menu has a 3D object category', (await page.locator('[data-testid=add-submenu] [role=menuitem]').allInnerTexts()).join('|') === 'Cube|Sphere|Torus knot|3D text|Model (.glb)…');
  check('plugin items can be dragged from the Add menu', (await page.locator('[data-testid=add-submenu] [role=menuitem]').first().getAttribute('draggable')) === 'true');
  await page.screenshot({ path: join(SHOTS, `3d-${name}-01-add-menu.png`) });
  await page.evaluate(() => {
    new MutationObserver(() => {
      if (document.querySelector('[data-testid=restarting]')) {
        (window as unknown as { sawRestart: boolean }).sawRestart = true;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.locator('[data-testid=add-submenu] [role=menuitem]', { hasText: 'Torus knot' }).click();
  await settle(9000);
  const reloaded = await page.locator('[data-testid=restarting]').waitFor({ state: 'detached', timeout: 90_000 }).then(() => true, () => false);
  check('the preview reloads by itself after the restart', reloaded);
  const announced = await page.evaluate(() => Boolean((window as unknown as { sawRestart?: boolean }).sawRestart));
  check('the restart is announced over the preview', announced || name !== 'astro');
  await settle(6000);
  check('the selection survives the automatic reload', (await page.locator('.outline.picked').count()) === 1);

  check('the component file is written', existsSync(join(APP, run.component)));
  check('the runtime file is written', existsSync(join(APP, 'src/feega/mount-scene.ts')));
  check('three is added to package.json', JSON.parse(read('package.json')).dependencies?.three !== undefined);
  check('the page imports the component', read(run.file).includes(run.import), read(run.file).slice(0, 200));
  check('the page uses the component', read(run.file).includes(run.usage));
  for (let i = 0; i < 10 && (await hasScene()) === 0; i++) {
    await settle(1500);
  }
  check('a WebGL canvas renders in the preview', (await hasScene()) === 1);

  await page.screenshot({ path: join(SHOTS, `3d-${name}-debug.png`) });
  const scenePick = await Promise.race([panel.pickAt('[data-feega-scene]'), new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000))]);
  check('the scene can be picked', scenePick !== null);
  await page.locator(PLUGIN).waitFor({ timeout: 10_000 });
  check('the 3D object section is in the Properties bar', (await page.locator(`${PLUGIN} [data-control]`).count()) === 6);
  check('the mesh gradient section is hidden for a scene', (await page.locator('[data-plugin="feega.mesh-gradient"]').count()) === 0);
  await page.locator(PLUGIN).scrollIntoViewIfNeeded();
  await settle(1500);
  await page.screenshot({ path: join(SHOTS, `3d-${name}-02-inserted.png`) });

  await page.locator(`${PLUGIN} [data-control=material] select`).selectOption('metal');
  await settle(3500);
  check('material change lands on the component usage', read(run.file).includes('material="metal"'));
  await page.locator(`${PLUGIN} [data-control=autorotate] input`).uncheck();
  await settle(3500);
  check('auto-rotate toggle lands on the component usage', read(run.file).includes('autorotate="false"'));
  await page.screenshot({ path: join(SHOTS, `3d-${name}-03-metal.png`) });
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
