import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { productCardDoc, BUY_BUTTON, frameHost, openCanvas, seedFrame, solid } from './seed';

const SPAN = 150;
const SIZES = { S: { x: 0.72, y: 0.76, width: 0.16, height: 0.07, text: 0.022 }, L: { x: 0.66, y: 0.73, width: 0.28, height: 0.12, text: 0.04 } };
const STATES = { Default: { color: '#1d1a16', label: 'Add to cart' }, Hover: { color: '#4a3f35', label: 'Add to cart →' } };

const button = (size: keyof typeof SIZES, state: keyof typeof STATES) => {
  const box = { ...BUY_BUTTON, ...SIZES[size] };
  return {
    name: 'Buy button',
    durationInFrames: SPAN,
    component: { name: 'Buy button', set: 'main', variant: { Size: size, State: state } },
    tracks: [
      {
        id: 'v1',
        kind: 'visual',
        name: 'Video 1',
        clips: [
          { id: 'pill', component: 'Shape', from: 0, durationInFrames: SPAN, props: { shape: 'rect', roundness: 0.5, x: box.x, y: box.y, width: box.width, height: box.height, fills: solid(STATES[state].color) } },
          { id: 'label', component: 'Text', from: 0, durationInFrames: SPAN, props: { text: STATES[state].label, size: SIZES[size].text, weight: 600, color: '#ffffff', font: 'sans', align: 'center', x: box.x, y: box.y, width: box.width, height: box.height } }
        ]
      }
    ]
  };
};

const matrixDoc = () => ({
  ...productCardDoc(),
  comps: { main: button('S', 'Default'), 'main-s-hover': button('S', 'Hover'), 'main-l-default': button('L', 'Default'), 'main-l-hover': button('L', 'Hover') }
});

test('variant matrix', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, matrixDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const button = { x: box.x + BUY_BUTTON.x * box.width, y: box.y + BUY_BUTTON.y * box.height };
  const cell = (size: string, state: string, tone = '') => page.locator(`[data-testid="variant-cell"][data-variant='{"Size":"${size}","State":"${state}"${tone ? `,"Tone":"${tone}"` : ''}}']`);

  await recordDemo(page, { slug: 'variant-matrix', title: 'variant matrix' }, async (d) => {
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.wait(2000);
    await d.click(page.getByText(/· buy$/).first());
    await expect(page.getByTestId('variant-matrix')).toBeVisible({ timeout: 15_000 });
    await d.click(cell('L', 'Default'));
    await d.move(button);
    await d.wait(1400);
    await d.click(cell('L', 'Hover'));
    await d.move(button);
    await d.wait(1400);
    await d.type(page.getByTestId('variant-axis-name'), 'Tone', { click: true });
    await d.type(page.getByTestId('variant-axis-values'), 'Light, Dark', { click: true });
    await d.click(page.getByTestId('variant-axis-add'));
    await d.wait(2200);
    await d.click(cell('S', 'Default', 'Light'));
    await d.move(button);
    await d.wait(1600);
  });
});
