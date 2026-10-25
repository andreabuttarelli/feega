import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

const TEXTS = [
  { x: 0, y: 0, prompt: 'Hero headline: Mornings, made slower.' },
  { x: 700, y: 0, prompt: 'Subhead: Stoneware mugs glazed by hand in Porto' },
  { x: 1400, y: 0, prompt: 'Footer: Free shipping over €60, returns in 30 days' },
  { x: 3600, y: 2200, prompt: 'Newsletter: Spring restock is live, 15% off the Morning set' }
];

test('search and colour tags', async ({ page, session, seedNode }) => {
  const ids: string[] = [];
  for (const t of TEXTS) {
    ids.push((await seedNode({ type: 'text', x: t.x, y: t.y, data: { prompt: t.prompt } })).id);
  }
  await installCursor(page);
  await openCanvas(page, session);
  await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
  const node = (id: string) => page.locator(`[data-testid="gpu-node"][data-id="${id}"]`);
  const spot = async (id: string) => {
    const b = (await node(id).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height * 0.5 };
  };

  await recordDemo(page, { slug: 'search-colour-tags', title: 'find anything, tag it by colour' }, async (d) => {
    await d.click(await spot(ids[0]));
    await page.keyboard.down('Shift');
    await d.click(await spot(ids[1]));
    await page.keyboard.up('Shift');
    await d.click(page.getByTestId('colour-tag-menu'));
    await d.click(page.getByTestId('colour-tag-red'));
    await d.wait(800);

    await d.key('ControlOrMeta+f', '⌘ F');
    await expect(page.getByTestId('node-search')).toBeVisible();
    await d.type(page.getByTestId('node-search-input'), 'restock', { click: false });
    await d.key('Enter');
    await expect(node(ids[3])).toBeVisible();
    await d.wait(1500);

    await d.key('ControlOrMeta+f', '⌘ F');
    await d.click(page.getByTestId('search-colour-red'));
    await expect(page.getByTestId('node-search').getByRole('option')).toHaveCount(2);
    await d.wait(1600);
  });
});
