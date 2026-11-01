import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { Demo } from '../demo';
import { frameDoc, frameHost, openCanvas, seedFrame, solid, words, SETTLE_MS } from './seed';

const TEST_MS = 900_000;
const HOLD_MS = 2200;
const W = 1920;
const H = 1080;
const SPAN = 150;
const INK = '#111111';
const SOFT = '#5f5f5f';
const PAGE = '#f4f4f2';
const PAN_PX = 120;
const NODE = { width: 1280, height: 720 };

type Box = { x: number; y: number; w: number; h: number };

const LEFT = 580;
const STACK_W = 1760;
const TITLE: Box = { x: LEFT, y: 200, w: 560, h: 120 };
const BODY: Box = { x: LEFT, y: 470, w: 760, h: 56 };
const CTA: Box = { x: LEFT, y: 720, w: 300, h: 88 };
const PILL_EDGE: Box = { x: CTA.x + 4, y: CTA.y + 30, w: 16, h: 32 };

const frac = (b: Box) => ({ x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H, width: b.w / W, height: b.h / H });
const HUG = { width: 'hug', height: 'hug', rowSpan: 1, absolute: false, columnSpan: 1 };
const PILL = { gap: 0, wrap: false, align: 'center', order: ['cta-label'], columns: 2, justify: 'center', padding: { top: 22, left: 40, right: 40, bottom: 22 }, autoFlow: 'row', crossGap: 0, direction: 'horizontal', rowTracks: [], firstOnTop: false, alignContent: 'auto', columnTracks: [], strokesIncluded: true };

const clip = (c: Record<string, unknown>) => ({ from: 0, durationInFrames: SPAN, ...c });
const title = words('title', 'Ship faster.', TITLE, 96, INK);

const LAYERS = [
  clip({ id: 'cta-label', name: 'Label', parent: 'cta', component: 'Text', layoutItem: HUG, props: { text: 'Start deploying', size: 30 / H, weight: 600, color: '#ffffff', font: 'sans', align: 'center', ...frac(CTA) } }),
  clip({ id: 'cta', name: 'Button', component: 'Shape', autoLayout: PILL, layoutItem: HUG, props: { shape: 'rect', roundness: 0.5, ...frac(CTA), fills: solid(INK) } }),
  { ...words('body', 'Preview every push on a real URL.', BODY, 36, SOFT), name: 'Body' },
  { ...title, name: 'Title', props: { ...title.props, weight: 600, tracking: -0.04 } },
  clip({ id: 'page', name: 'Background', component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid(PAGE) } })
];

const cardDoc = () => ({ ...frameDoc([]), tracks: LAYERS.map((c, i) => ({ id: `v${i + 1}`, kind: 'visual', name: `Video ${i + 1}`, clips: [c] })) });

async function onFrame(page: Page, id: string, b: Box) {
  const r = (await frameHost(page, id).boundingBox())!;
  const k = r.width / W;
  return { x: r.x + (b.x + b.w / 2) * k, y: r.y + (b.y + b.h / 2) * k };
}

type Rect = { x: number; y: number; width: number; height: number };

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

async function selected(page: Page): Promise<Rect> {
  await page.waitForTimeout(500);
  return (await page.getByTestId('frame-selection').boundingBox())!;
}

async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
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
  await page.keyboard.press('-');
  await page.waitForTimeout(SETTLE_MS);
  await page.mouse.move(800, 600);
  await page.mouse.wheel(PAN_PX, 0);
  await page.waitForTimeout(SETTLE_MS);

  const flow = async (d: Demo) => {
    const inspector = page.getByTestId('motion-inspector');
    const section = inspector.getByTestId('stack-section');
    const frame = async () => (await frameHost(page, id).boundingBox())!;
    const hold = async () => d.look(await frame(), HOLD_MS);

    await d.look(await frame(), 1200);
    await d.click(await onFrame(page, id, TITLE));
    await page.keyboard.down('Shift');
    await d.click(await onFrame(page, id, BODY));
    await d.click(await onFrame(page, id, PILL_EDGE));
    await page.keyboard.up('Shift');

    await d.key('Shift+A', '⇧A');
    await expect(section).toBeVisible({ timeout: 15_000 });
    await hold();

    await d.click(section.getByRole('radio', { name: 'Horizontal' }));
    await hold();

    await retype(d, page, section.getByTestId('auto-layout-gap'), '48');
    await hold();

    await retype(d, page, section.getByTestId('stack-size-width'), String(STACK_W));
    await hold();

    await d.click(section.getByRole('button', { name: 'Align center center' }));
    await hold();

    const stack = await d.cut(() => selected(page));
    await d.click(centre(stack), { double: true });
    await retype(d, page, inspector.getByTestId('stack-size-width'), '2fr');
    await hold();

    await d.click({ x: stack.x + stack.width - 8, y: stack.y + stack.height / 2 });
    await retype(d, page, inspector.getByTestId('stack-size-width'), '1fr');
    await hold();

    const pill = await d.cut(async () => {
      await blur(page);
      return selected(page);
    });
    await d.drag({ x: pill.x + pill.width * 0.3, y: pill.y + pill.height / 2 }, { x: stack.x + 16, y: stack.y + stack.height / 2 });
    await d.cut(async () => {
      await page.mouse.click(5, 450);
      await page.waitForTimeout(400);
    });
    await hold();
  };
  await recordDemo(page, { slug: 'stack-v2', title: 'wrap with stack' }, flow);
});
