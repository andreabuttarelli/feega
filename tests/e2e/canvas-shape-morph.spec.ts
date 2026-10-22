import { test, expect, REAL_STACK } from './fixtures/session';
import { SHOTS_DIR, docOf, openTimelineOn, shape } from './fixtures/anim-doc';

const TRIANGLE = shape('tri', { props: { shape: 'path', path: 'M0 0L1 0L0.5 1Z', x: 0.7, y: 0.5, width: 0.25, height: 0.4, fills: [{ type: 'solid', color: '#1f5aff' }] } });

test.describe('shape to shape morph @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a shape morphs into another shape on the canvas from the Properties list', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await openTimelineOn(page, { seedNode, admin, session }, docOf([shape('first'), TRIANGLE]));

    const section = page.getByRole('button', { name: 'Path', exact: true });
    await section.scrollIntoViewIfNeeded();
    if ((await section.getAttribute('aria-expanded')) === 'false') {
      await section.click();
    }
    const into = page.getByTestId('morph-into');
    await into.scrollIntoViewIfNeeded();
    await into.selectOption({ label: 'Shape · tri' });
    await page.screenshot({ path: `${SHOTS_DIR}/anim-morph-start.png` });

    await page.getByRole('button', { name: 'Show keyframes' }).first().click();
    await expect(page.getByRole('button', { name: /^Morph keyframe at / })).toHaveCount(2);

    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(900);
    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-morph-mid.png` });
  });
});
