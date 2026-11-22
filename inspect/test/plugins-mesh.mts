import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP = process.env.INSPECT_APP_ROOT ?? join(import.meta.dirname, 'fixtures/plugins-app');
const SHOTS = process.env.SHOTS ?? join(process.env.HOME!, 'Documents/feega-videos/plugins');
const FILE = join(APP, 'src/App.svelte');
const PLUGIN = '[data-plugin="feega.mesh-gradient"]';
mkdirSync(SHOTS, { recursive: true });

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) {
    failures.push(name);
  }
};
const reset = () => execFileSync('git', ['checkout', '--', FILE]);
const source = () => readFileSync(FILE, 'utf8');
const gradient = () => source().match(/background-image:\s*([^;]+);/)?.[1] ?? '';

reset();
const panel = await openPanel(APP);
const { page, frame } = panel;
const shot = async (name: string) => {
  await page.locator(PLUGIN).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
};
const settle = (ms = 1800) => page.waitForTimeout(ms);

try {
  await settle(2500);
  const pick = await panel.pickAt('.hero');
  check('the hero section is picked', pick?.source.file.endsWith('App.svelte') === true);
  await page.locator(PLUGIN).waitFor({ timeout: 10_000 });
  check('the mesh gradient section is in the Properties bar', (await page.locator(`[data-testid=selection] ~ ${PLUGIN}, ${PLUGIN}`).count()) === 1);
  check('no handles before a mesh exists', (await page.locator('[data-testid=plugin-handle]').count()) === 0);
  await shot('mesh-01-section');

  await page.locator(`${PLUGIN} [data-control=start] button`).click();
  await settle();
  check('start writes stacked radial-gradients into the element stylesheet', (gradient().match(/radial-gradient/g) ?? []).length === 4, gradient());
  check('the file stays framework-agnostic CSS', !/var\(|@apply|url\(/.test(gradient()));
  const handles = page.locator('[data-testid=plugin-handle]');
  check('four draggable points are drawn over the preview', (await handles.count()) === 4);
  const computed = await frame.locator('.hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  check('the running page shows the gradient', computed.includes('radial-gradient'), computed);
  await shot('mesh-02-started');

  const before = gradient();
  const box = (await handles.nth(1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 120, box.y + 90, { steps: 8 });
  const live = await frame.locator('.hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  check('dragging previews live before anything is written', gradient() === before && live !== computed);
  await shot('mesh-03-dragging');
  await page.mouse.up();
  await settle();
  check('releasing writes the new position', gradient() !== before && gradient().includes('radial-gradient'), gradient());

  const colourHex = page.locator(`${PLUGIN} [data-control=color] input.hex`);
  await colourHex.fill('#00ff88');
  await colourHex.press('Enter');
  await settle();
  check('colour edit lands in the source', gradient().includes('#00ff88'), gradient());

  const softness = page.locator(`${PLUGIN} [data-control=softness] input[type=range]`);
  const wide = gradient();
  await softness.fill('100');
  await settle();
  check('softness edit lands in the source', gradient() !== wide && gradient().includes('100%'), gradient());

  await page.locator(`${PLUGIN} [data-control=randomize] button`).click();
  await settle();
  check('randomize rewrites the points', gradient() !== wide);
  await shot('mesh-04-randomized');

  const mine = source();
  check('the changes show in the history as plugin edits', (await page.locator('[data-testid=changes-tab]').innerText()).includes('Changes'));

  for (let i = 0; i < 10 && gradient(); i++) {
    await page.locator('button[title^="Undo"]').click();
    await settle(900);
  }
  check('undo walks the plugin edits back to the original file', !source().includes('radial-gradient') && mine !== source());
  const original = execFileSync('git', ['show', 'HEAD:' + 'inspect/test/fixtures/plugins-app/src/App.svelte'], { encoding: 'utf8' });
  check('and the file is byte-identical to the fixture', source() === original);
  await shot('mesh-05-undone');
} finally {
  await panel.close();
  reset();
}

if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall passed');
