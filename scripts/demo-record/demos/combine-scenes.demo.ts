import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameDoc, frameHost, openCanvas, seedFrame, solid } from './seed';

const SCENE_FRAMES = 45;
const SCENES = [
  { x: 80, text: 'design', color: '#3b82f6' },
  { x: 2240, text: 'animate', color: '#c6f432' },
  { x: 4400, text: 'ship', color: '#ff5a1f' }
];

const scene = (text: string, color: string) =>
  frameDoc(
    [
      { id: 'bg', component: 'Shape', from: 0, durationInFrames: SCENE_FRAMES, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid(color) } },
      { id: 'title', component: 'Text', from: 0, durationInFrames: SCENE_FRAMES, props: { text, size: 0.16, x: 0.5, y: 0.5, width: 0.8, height: 0.3 } }
    ],
    {},
    SCENE_FRAMES
  );

test('combine scenes into one video', async ({ page, session, admin, seedNode }) => {
  const ids: string[] = [];
  for (const s of SCENES) {
    ids.push(await seedFrame(seedNode, admin, session, { x: s.x, y: 80 }, scene(s.text, s.color)));
  }
  await installCursor(page);
  await openCanvas(page, session);
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(2500);
  const boxes = await Promise.all(ids.map(async (id) => (await frameHost(page, id).boundingBox())!));
  const left = Math.min(...boxes.map((b) => b.x)) - 24;
  const top = Math.min(...boxes.map((b) => b.y)) - 36;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + 24;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 24;

  await recordDemo(page, { slug: 'combine-scenes', title: 'combine scenes into one video' }, async (d) => {
    await d.drag({ x: left, y: top }, { x: right, y: bottom });
    await d.click({ x: (left + right) / 2, y: bottom + 30 }, { button: 'right' });
    await d.click(page.getByRole('menuitem', { name: 'Combine into video' }));
    await expect.poll(async () => (await page.locator('[data-testid="frame-overlays"] [data-frame]').count()), { timeout: 30_000 }).toBe(4);
    await d.wait(1200);
    await d.key('Shift+Digit1', '⇧ 1');
    await d.wait(1500);
    const parentId = await page.locator('[data-testid="frame-overlays"] [data-frame]').evaluateAll((els, seeded) => els.map((e) => e.getAttribute('data-frame')).find((id) => !seeded.includes(id!)), ids);
    const parent = frameHost(page, parentId!);
    const box = (await parent.boundingBox())!;
    await d.click({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(4500);
  });
});
