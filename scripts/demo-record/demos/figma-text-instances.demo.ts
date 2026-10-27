import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

import { figmaClipboardHtml } from '../../../tests/fixtures/figma/clipboard';
import { node, solid } from '../../../tests/fixtures/figma/elements';

const PAGE = 1;
const W = 2880;
const H = 1800;
const INTER = (style: string) => ({ family: 'Inter', style, postscript: '' });
const ink = solid(0.11, 0.1, 0.09);
const muted = solid(0.45, 0.42, 0.38);

function text(parent: number, slot: string, characters: string, x: number, y: number, w: number, size: number, style = 'Regular', paint = ink) {
  return node('TEXT', parent, { x, y, w, h: size * 1.3, slot, fontName: INTER(style), fontSize: size, fillPaints: [paint], textData: { characters } });
}

function buyButton(parent: number, type: string, at: { x: number; y: number }, extra: object) {
  const box = node(type, parent, { ...at, w: 420, h: 120, cornerRadius: 28, fillPaints: [ink], frameMaskDisabled: false, name: 'Buy button', ...extra });
  const label = text(box.id, 'z', 'Add to cart', 96, 36, 240, 40, 'Medium', solid(1, 1, 1));
  return [box, label];
}

function pricingPage() {
  const page = { guid: { sessionID: 0, localID: PAGE }, type: 'CANVAS', name: 'Page' };
  const screen = node('FRAME', PAGE, { x: 0, y: 0, w: W, h: H, fillPaints: [solid(0.965, 0.945, 0.918)], frameMaskDisabled: false, slot: 'a', name: 'Lumen shop' });
  const title = text(screen.id, 'b', 'Mornings, made slower.', 160, 140, 1700, 180, 'Bold');
  const sub = text(screen.id, 'c', 'Hand-glazed stoneware from Porto.', 160, 400, 1500, 64, 'Regular', muted);
  const cardA = node('ROUNDED_RECTANGLE', screen.id, { x: 160, y: 680, w: 1100, h: 700, cornerRadius: 48, fillPaints: [solid(1, 1, 1)], slot: 'd' });
  const cardB = node('ROUNDED_RECTANGLE', screen.id, { x: 1420, y: 680, w: 1100, h: 700, cornerRadius: 48, fillPaints: [solid(1, 1, 1)], slot: 'e' });
  const nameA = text(screen.id, 'f', 'Morning Mug', 220, 740, 700, 72, 'Bold');
  const priceA = text(screen.id, 'g', '€24', 220, 840, 300, 64, 'Medium', muted);
  const nameB = text(screen.id, 'h', 'Linen Tote', 1480, 740, 700, 72, 'Bold');
  const priceB = text(screen.id, 'i', '€38', 1480, 840, 300, 64, 'Medium', muted);
  const [main, mainLabel] = buyButton(screen.id, 'SYMBOL', { x: 2200, y: 1500 }, { slot: 'j' });
  const symbolData = { symbolID: main.guid };
  const first = buyButton(screen.id, 'INSTANCE', { x: 220, y: 1180 }, { symbolData, slot: 'k' });
  const legal = text(screen.id, 'm', 'Prices include VAT. Free shipping over €60.', 160, 1640, 400, 12, 'Regular', muted);
  return { meta: {}, blobs: [], nodes: [page, screen, title, sub, cardA, cardB, nameA, priceA, nameB, priceB, main, mainLabel, ...first, legal] };
}

const CLIP = figmaClipboardHtml(pricingPage() as Parameters<typeof figmaClipboardHtml>[0]);

test('figma paste keeps tiny text and links instances', async ({ page, session }) => {
  await installCursor(page);
  await openCanvas(page, session);
  await page.evaluate(async (body) => {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob(['figma'], { type: 'text/plain' }) })]);
  }, CLIP);
  const pane = (await page.locator('.svelte-flow').boundingBox())!;

  await recordDemo(page, { slug: 'figma-text-instances', title: 'figma: tiny text and component instances' }, async (d) => {
    await d.click({ x: pane.x + pane.width * 0.85, y: pane.y + pane.height * 0.85 });
    await d.move({ x: pane.x + pane.width * 0.5, y: pane.y + pane.height * 0.62 });
    await d.key('ControlOrMeta+v', '⌘ V');
    await expect(page.locator('[data-testid="frame-overlays"] [data-frame]')).toHaveCount(1, { timeout: 30_000 });
    await d.wait(1500);
    await d.key('Shift+Digit1', '⇧ 1');
    await d.wait(2500);
    await d.key('Shift+Digit1', '⇧ 1');
    await d.wait(1500);
    const frame = (await page.locator('[data-testid="frame-overlays"] [data-frame]').boundingBox())!;
    const at = (fx: number, fy: number) => ({ x: frame.x + frame.width * fx, y: frame.y + frame.height * fy });
    await d.click(at(0.17, 0.70));
    await d.click(at(0.17, 0.70));
    await d.wait(1500);
    await page.getByTestId('side-tab-properties').click();
    await d.wait(2500);
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    await page.mouse.wheel(0, 260);
    await d.wait(1200);
    const lower = (await page.locator('[data-testid="frame-overlays"] [data-frame]').boundingBox())!;
    const legal = { x: lower.x + lower.width * 0.063, y: lower.y + lower.height * 0.915 };
    await d.click(legal);
    await d.click(legal);
    await d.wait(2500);
  });
});
