import { test, expect } from '../../../tests/e2e/fixtures/session';
import { barTool } from '../../../tests/e2e/fixtures/canvas-bar';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

type Point = { x: number; y: number };

const OUTSIDE_PX = 12;
const TURN_DEG = 35;

const turnAround = (c: Point, p: Point, deg: number): Point => {
  const r = (deg * Math.PI) / 180;
  return { x: c.x + (p.x - c.x) * Math.cos(r) - (p.y - c.y) * Math.sin(r), y: c.y + (p.x - c.x) * Math.sin(r) + (p.y - c.y) * Math.cos(r) };
};

test('rotate from corners', async ({ page, session }) => {
  await installCursor(page);
  await openCanvas(page, session);
  const tool = await barTool(page, 'rectangle');
  const pane = (await page.getByTestId('core-canvas').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.36, y: pane.y + pane.height * 0.36 };

  await recordDemo(page, { slug: 'rotate-corners', title: 'rotate from any corner' }, async (d) => {
    await d.click(tool);
    await d.drag(from, { x: from.x + 280, y: from.y + 180 });
    const selection = page.getByTestId('frame-selection');
    await expect(selection).toHaveCount(1, { timeout: 15_000 });
    await d.wait(600);

    const handles = selection.getByTestId('frame-selection-handle');
    const corners = await Promise.all([0, 1, 2, 3].map(async (i) => (await handles.nth(i).boundingBox())!));
    const at = corners.map((b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }));
    const centre = { x: (at[0].x + at[2].x) / 2, y: (at[0].y + at[2].y) / 2 };
    const r = Math.hypot(at[2].x - centre.x, at[2].y - centre.y) + 40;
    const fit = { x: centre.x - r, y: centre.y - r, width: 2 * r, height: 2 * r };
    const grip = { x: at[2].x + OUTSIDE_PX, y: at[2].y + OUTSIDE_PX };
    await d.move(grip);
    await d.wait(500);
    await d.drag(grip, turnAround(centre, grip, TURN_DEG), (p) => turnAround(centre, grip, TURN_DEG * p), fit);

    const top = { x: at[0].x - OUTSIDE_PX, y: at[0].y - OUTSIDE_PX };
    const turnedTop = turnAround(centre, top, TURN_DEG);
    await d.move(turnedTop);
    await d.wait(400);
    await d.drag(turnedTop, turnAround(centre, top, TURN_DEG - 50), (p) => turnAround(centre, top, TURN_DEG - 50 * p), fit);
    await d.wait(1200);
  });
});
