import { test, expect, REAL_STACK } from './fixtures/session';
import { SHOTS_DIR, docOf, openTimelineOn } from './fixtures/anim-doc';

const TITLE = {
  id: 'head',
  from: 0,
  durationInFrames: 150,
  component: 'Title',
  props: { text: 'Make it move', x: 0.1, y: 0.4, width: 0.8, height: 0.3, size: 0.12, fills: [{ type: 'solid', color: '#ffffff' }] }
};

test.describe('text preset gallery @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a tile previews on hover and adds an animator to the selected text', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await openTimelineOn(page, { seedNode, admin, session }, docOf([TITLE]));

    const animate = page.getByRole('button', { name: 'Animation', exact: true });
    await animate.scrollIntoViewIfNeeded();
    if ((await animate.getAttribute('aria-expanded')) === 'false') {
      await animate.click();
    }
    const gallery = page.getByTestId('text-preset-gallery');
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery.locator('[data-preset]')).toHaveCount(13);

    await gallery.locator('[data-preset="scale-chars"]').hover();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-text-presets-hover.png` });

    await gallery.locator('[data-preset="typewriter"]').click();
    await expect(page.locator('[data-animator]')).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-text-presets-applied.png` });
  });
});
