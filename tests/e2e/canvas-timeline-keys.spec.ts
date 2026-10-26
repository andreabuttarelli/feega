import { test, expect, REAL_STACK } from './fixtures/session';
import { SHOTS_DIR, docOf, openTimelineOn, shape } from './fixtures/anim-doc';

const KEYED = shape('first', {
  keyframes: {
    opacity: [
      { frame: 0, value: 0, ease: 'linear' },
      { frame: 30, value: 1, ease: 'linear' },
      { frame: 60, value: 0.5, ease: 'linear' }
    ],
    x: [
      { frame: 0, value: 0.3, ease: 'linear' },
      { frame: 60, value: 0.6, ease: 'linear' }
    ]
  }
});

test.describe('timeline keyframe conveniences @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('marquee, duplicate, select related and mute', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await openTimelineOn(page, { seedNode, admin, session }, docOf([KEYED]));
    await page.getByRole('button', { name: 'Show keyframes' }).first().click();

    const keys = page.locator('[data-key-clip]');
    await expect(keys).toHaveCount(5);
    const boxes = await keys.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    const left = Math.min(...boxes.map((b) => b.left));
    const right = Math.max(...boxes.map((b) => b.right));
    const top = Math.min(...boxes.map((b) => b.top));
    const bottom = Math.max(...boxes.map((b) => b.bottom));

    await page.mouse.move(right + 40, bottom - 4);
    await page.mouse.down();
    await page.mouse.move(right - 10, bottom - 8, { steps: 3 });
    await page.mouse.move(left - 4, top - 2, { steps: 8 });
    await page.screenshot({ path: `${SHOTS_DIR}/anim-timeline-marquee.png` });
    await page.mouse.up();
    await expect(page.locator('.key.picked')).toHaveCount(5);

    await page.keyboard.press('Control+d');
    await expect(keys).toHaveCount(10);

    await page.keyboard.press('Control+Enter');
    await expect(page.locator('.key.picked')).toHaveCount(0);
    await expect(page.locator('[data-layer].selected')).toHaveCount(1);

    await page.keyboard.press('Control+Enter');
    await expect(page.locator('.key.picked')).toHaveCount(10);

    await page.locator('[data-mute="opacity"]').click();
    await expect(page.locator('.row.prop.muted')).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-timeline-muted.png` });
  });
});
