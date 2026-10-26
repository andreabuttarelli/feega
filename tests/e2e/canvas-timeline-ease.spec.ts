import { test, expect, REAL_STACK } from './fixtures/session';
import { SHOTS_DIR, docOf, openTimelineOn, shape } from './fixtures/anim-doc';

const KEYED = shape('first', {
  keyframes: {
    x: [
      { frame: 0, value: 0.3, ease: 'standard' },
      { frame: 60, value: 0.7, ease: 'standard' }
    ]
  }
});

test.describe('elastic ease in the timeline @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('the picker offers elastic with an intensity slider and copies CSS', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await openTimelineOn(page, { seedNode, admin, session }, docOf([KEYED]));
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByRole('button', { name: 'Show keyframes' }).first().click();
    await page.getByRole('button', { name: /Ease after .* keyframe/ }).first().click();
    const picker = page.getByTestId('ease-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByLabel('Intensity')).toHaveCount(0);

    await picker.getByTitle('Elastic').click();
    await expect(picker.getByLabel('Intensity')).toBeVisible();
    await picker.getByLabel('Intensity').fill('0.9');
    await page.screenshot({ path: `${SHOTS_DIR}/anim-ease-elastic.png` });

    await picker.getByRole('button', { name: 'Copy as CSS' }).click();
    const css = await page.evaluate(() => navigator.clipboard.readText());
    expect(css.startsWith('linear(0, ')).toBe(true);
  });
});
