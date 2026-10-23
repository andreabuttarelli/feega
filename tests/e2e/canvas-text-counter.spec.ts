import { test, expect, REAL_STACK } from './fixtures/session';
import { SHOTS_DIR, docOf, openTimelineOn } from './fixtures/anim-doc';

const TEXT = {
  id: 'stat',
  from: 0,
  durationInFrames: 150,
  component: 'Text',
  props: { text: 'old', x: 0.3, y: 0.5, width: 0.25, height: 0.4, size: 0.2, fills: [{ type: 'solid', color: '#ffffff' }] }
};

test.describe('text counter @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a Text clip counts from the Properties section, and the playhead shows it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await openTimelineOn(page, { seedNode, admin, session }, docOf([TEXT]));

    const animate = page.getByRole('button', { name: 'Animation', exact: true });
    await animate.scrollIntoViewIfNeeded();
    if ((await animate.getAttribute('aria-expanded')) === 'false') {
      await animate.click();
    }
    const section = page.getByTestId('text-counter-section');
    await section.scrollIntoViewIfNeeded();
    await section.getByLabel('Count up').check();
    await section.getByLabel('Counter to').fill('1200');
    await section.getByLabel('Counter to').blur();
    await section.getByLabel('Counter format').selectOption('currency');
    await expect(section.getByLabel('Counter from')).toHaveValue('0');

    await page.screenshot({ path: `${SHOTS_DIR}/anim-counter-start.png` });
    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(1200);
    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS_DIR}/anim-counter-mid.png` });
  });
});
