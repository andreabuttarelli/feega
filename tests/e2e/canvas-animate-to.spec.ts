import { test, expect, REAL_STACK } from './fixtures/session';
import { SHOTS_DIR, docOf, openTimelineOn, shape } from './fixtures/anim-doc';

test.describe('animate to @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('one target value creates two keyframes on the selected element', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await openTimelineOn(page, { seedNode, admin, session }, docOf([shape('first')]));

    const animate = page.getByRole('button', { name: 'Animation', exact: true });
    await animate.scrollIntoViewIfNeeded();
    if ((await animate.getAttribute('aria-expanded')) === 'false') {
      await animate.click();
    }
    const section = page.getByTestId('animate-to');
    await section.scrollIntoViewIfNeeded();
    await section.getByLabel('Animate property').selectOption('opacity');
    await section.getByLabel('Animate target').fill('0');
    await section.getByLabel('Animate length').fill('1');
    await section.getByTestId('animate-to-run').click();

    await page.getByRole('button', { name: 'Show keyframes' }).first().click();
    await expect(page.getByRole('button', { name: /^Opacity keyframe at / })).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-animate-to.png` });
  });
});
