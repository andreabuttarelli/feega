import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const FRAME_W = 1920;
const SETTLE_MS = 800;
const PLAY_MS = 4000;
const RENDER_BUDGET_MS = 1_500_000;

const TITLE = { x: 506, y: 400 };
const SUBTITLE = { x: 456, y: 560 };
const BUTTON = { x: 246, y: 688 };

test('in out presets', async ({ page, session, admin, seedNode }) => {
  test.setTimeout(RENDER_BUDGET_MS);
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, heroDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const k = box.width / FRAME_W;
  const onFrame = (p: { x: number; y: number }) => ({
    x: box.x + p.x * k,
    y: box.y + p.y * k
  });

  const choose = async (d: Parameters<Parameters<typeof recordDemo>[2]>[0], at: { x: number; y: number }, preset: string) => {
    await d.click(onFrame(at));
    await d.wait(SETTLE_MS);
    await d.click(onFrame(at));
    await d.wait(SETTLE_MS);
    await d.click(page.getByTestId(`preset-${preset}`));
    await d.wait(SETTLE_MS);
  };

  await recordDemo(page, { slug: 'in-out-presets', title: 'one-click in and out' }, async (d) => {
    await d.click(onFrame(TITLE));
    await d.wait(SETTLE_MS);
    await d.click(onFrame(TITLE));
    await d.key('e', 'Animate');
    await d.wait(SETTLE_MS);
    const animation = page.getByRole('button', {
      name: 'Animation',
      exact: true
    });
    await animation.scrollIntoViewIfNeeded();
    if ((await animation.getAttribute('aria-expanded')) === 'false') {
      await d.click(animation);
    }
    await page.getByTestId('in-out-presets').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('in-out-presets')).toBeVisible({
      timeout: 15_000
    });
    await d.click(page.getByTestId('preset-slide-up'));
    await d.wait(SETTLE_MS);
    await choose(d, SUBTITLE, 'typewriter');
    await choose(d, BUTTON, 'pop');
    await d.click(page.getByTestId('preset-side-out'));
    await d.click(page.getByTestId('preset-fade'));
    await d.wait(SETTLE_MS);
    await d.key('Space');
    await d.wait(PLAY_MS);
  });
});
