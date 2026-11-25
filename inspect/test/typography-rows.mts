import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/typography-rows');
const WIDTHS = [260, 320, 420];
const TEXT = process.env.INSPECT_TEXT ?? '.lead';
const ROWS = ['font-family', 'font-weight', 'font-size', 'line-height', 'letter-spacing'];
const LEFT_PX = 240;
const SETTLE_MS = 400;
const MIN_VALUE_PX = 40;

mkdirSync(SHOTS, { recursive: true });
const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;
await panel.pickAt(TEXT);
await page.waitForTimeout(SETTLE_MS);

for (const width of WIDTHS) {
  await page.evaluate(([w, left]) => {
    const main = document.querySelector('main') as HTMLElement;
    main.style.gridTemplateColumns = `${left}px minmax(0, 1fr) ${w}px`;
  }, [width, LEFT_PX]);
  await page.waitForTimeout(SETTLE_MS);

  const section = page.locator('[data-section=Typography]');
  const labels = new Set<number>();
  for (const name of ROWS) {
    const row = section.locator(`[data-row=${name}]`);
    assert.equal(await row.count(), 1, `${width}: row ${name} exists`);
    const control = (await row.locator('.control').boundingBox())!;
    const inner = row.locator('input, button.select, [role=combobox]').first();
    const box = (await inner.boundingBox())!;
    assert.ok(box.width >= MIN_VALUE_PX, `${width}: ${name} control is ${box.width}px`);
    assert.ok(box.x + box.width <= control.x + control.width + 1, `${width}: ${name} does not overflow its row`);
    labels.add(Math.round((await row.locator('.label').boundingBox())!.x));
  }
  assert.equal(labels.size, 1, `${width}: one label column`);
  const fieldWidth = async (name: string, selector: string) => Math.round((await section.locator(`[data-row=${name}] ${selector}`).first().boundingBox())!.width);
  const family = await fieldWidth('font-family', '.font-field');
  assert.equal(family, await fieldWidth('font-size', '.field'), `${width}: the font family spans the same width as the other fields`);
  assert.equal(family, await fieldWidth('font-weight', 'button.select'), `${width}: the font family and weight share a width`);
  const clipped = await section.evaluate((el) => [...el.querySelectorAll('.row')].filter((r) => r.scrollWidth > r.clientWidth + 1).map((r) => r.getAttribute('data-row')));
  assert.deepEqual(clipped, [], `${width}: no row clips its content`);
  const cutLabels = await section.evaluate((el) => [...el.querySelectorAll('.label')].filter((l) => l.scrollWidth > l.clientWidth).map((l) => l.textContent));
  assert.deepEqual(cutLabels, [], `${width}: no label is cut`);
  await section.screenshot({ path: join(SHOTS, `typography-${width}.png`) });
  if (width === 320) {
    await section.locator('[data-row=font-family]').screenshot({ path: join(SHOTS, 'font-width-320.png') });
  }
  console.log('ok', width);
}

await panel.pickAt('#hero');
await page.waitForTimeout(SETTLE_MS);
for (const width of WIDTHS) {
  await page.evaluate(([w, left]) => {
    (document.querySelector('main') as HTMLElement).style.gridTemplateColumns = `${left}px minmax(0, 1fr) ${w}px`;
  }, [width, LEFT_PX]);
  await page.waitForTimeout(SETTLE_MS);
  const narrow = await page.evaluate((min) => [...document.querySelectorAll('aside.right .field input')].map((i) => [i.closest('[data-row]')?.getAttribute('data-row'), i.getBoundingClientRect().width] as const).filter(([, w]) => w > 0 && w < min).map(([n]) => n), MIN_VALUE_PX);
  assert.deepEqual(narrow, [], `${width}: every number field shows ${MIN_VALUE_PX}px or more`);
  await page.locator('aside.right').screenshot({ path: join(SHOTS, `panel-${width}.png`) });
  console.log('ok fields', width);
}
await panel.close();
