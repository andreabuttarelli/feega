import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameDoc, frameHost, openCanvas, seedFrame, solid } from './seed';

const button = (state: string, text: string, color: string) => ({
  name: 'Button',
  durationInFrames: 150,
  component: { name: 'Button', set: 'main', variant: { State: state } },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        { id: 'pill', component: 'Shape', from: 0, durationInFrames: 150, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.3, fills: solid(color) } },
        { id: 'label', component: 'Text', from: 0, durationInFrames: 150, props: { text, size: 0.1, x: 0.5, y: 0.5, width: 0.5, height: 0.2 } }
      ]
    }
  ]
});

const doc = frameDoc([{ id: 'button', component: 'Precomp', from: 0, durationInFrames: 150, props: { comp: 'main' } }], {
  comps: { main: button('Default', 'Buy now', '#3b82f6'), hover: button('Hover', 'Buy now →', '#1d4ed8'), done: button('Done', 'Added ✓', '#16a34a') }
});

test('component variants', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, doc);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;

  await recordDemo(page, { slug: 'component-variants', title: 'variants for components' }, async (d) => {
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.wait(2000);
    await d.click({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const variant = page.getByTestId('instance-variant');
    await expect(variant).toBeVisible({ timeout: 15_000 });
    for (const state of ['Hover', 'Done', 'Default']) {
      await d.select(variant, state);
      await d.move({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await d.wait(1400);
    }
  });
});
