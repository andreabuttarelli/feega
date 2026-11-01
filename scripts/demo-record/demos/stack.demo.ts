import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { Demo } from '../demo';
import { frameDoc, frameHost, openCanvas, seedFrame, solid, words, SETTLE_MS } from './seed';

const TEST_MS = 900_000;
const READ_MS = 900;
const W = 1920;
const SPAN = 150;
const INK = '#111111';
const SOFT = '#5f5f5f';
const PAGE = '#f4f4f2';
const NODE = { width: 900, height: 506 };

type Box = { x: number; y: number; w: number; h: number };

const BODY: Box = { x: 700, y: 330, w: 640, h: 90 };
const TITLE: Box = { x: 600, y: 470, w: 520, h: 110 };
const CTA: Box = { x: 660, y: 640, w: 320, h: 50 };

const TITLE_IN_STACK: Box = { x: 640, y: 460, w: 200, h: 30 };
const TOP_OF_STACK: Box = { x: 640, y: 330, w: 200, h: 6 };

const title = words('title', 'Ship faster.', TITLE, 72, INK);

const cardDoc = () =>
  frameDoc([
    { id: 'page', from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid(PAGE) } },
    { ...words('body', 'Preview every push on a real URL before it merges.', BODY, 32, SOFT), name: 'Body' },
    { ...title, name: 'Title', props: { ...title.props, weight: 600, tracking: -0.04 } },
    { ...words('cta', 'Start deploying →', CTA, 32, INK), name: 'Button' }
  ]);

async function onFrame(page: Page, id: string, b: Box) {
  const r = (await frameHost(page, id).boundingBox())!;
  const k = r.width / W;
  return { x: r.x + (b.x + b.w / 2) * k, y: r.y + (b.y + b.h / 2) * k };
}

async function retype(d: Demo, page: Page, field: Locator, value: string) {
  await field.click({ clickCount: 3 });
  await d.type(field, value, { click: false });
  await page.keyboard.press('Enter');
}

test('wrap with stack', async ({ page, session, admin, seedNode }) => {
  test.setTimeout(TEST_MS);
  const id = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, cardDoc());
  await admin.from('nodes').update(NODE).eq('id', id);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(SETTLE_MS);

  await recordDemo(page, { slug: 'stack', title: 'wrap with stack' }, async (d) => {
    const layers = page.getByTestId('layers');
    const row = (clip: string) => layers.locator(`[data-layer="${clip}"]`);
    const inspector = page.getByTestId('motion-inspector');
    const section = inspector.getByTestId('stack-section');
    const set = async (field: Locator, value: string) => {
      await field.fill(value);
      await field.press('Enter');
    };

    await row('body').click();
    await row('title').click({ modifiers: ['Shift'] });
    await row('cta').click({ modifiers: ['Shift'] });
    await d.key('Shift+A', '⇧A');
    await expect(section).toBeVisible({ timeout: 15_000 });
    await d.wait(READ_MS);

    await row('title').click();
    await d.drag(await onFrame(page, id, TITLE_IN_STACK), await onFrame(page, id, TOP_OF_STACK));
    await d.wait(READ_MS / 2);

    await layers.locator('[data-layer]', { hasText: 'Stack' }).first().click();
    await d.click(section.getByRole('radio', { name: 'Horizontal' }));
    await d.skip(async () => {
      await set(section.getByTestId('stack-size-width'), '1760');
      await set(section.getByTestId('auto-layout-gap'), '48');
      await section.getByRole('button', { name: 'Align center center' }).click();
      await row('title').click();
      await set(inspector.getByTestId('stack-size-width'), '1fr');
      await row('body').click();
    });
    await retype(d, page, inspector.getByTestId('stack-size-width'), '2fr');
    await page.mouse.click(800, 800);
    await page.waitForTimeout(600);
    await d.look((await frameHost(page, id).boundingBox())!, READ_MS);
  });
});
