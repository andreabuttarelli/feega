import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

import { figmaClipboardHtml } from '../../../tests/fixtures/figma/clipboard';
import { node, solid } from '../../../tests/fixtures/figma/elements';

const PAGE = 1;
const INTER = (style: string) => ({ family: 'Inter', style, postscript: '' });
const ink = solid(0.11, 0.1, 0.09);
const muted = solid(0.45, 0.42, 0.38);

function text(parent: number, slot: string, characters: string, x: number, y: number, w: number, size: number, style = 'Regular', paint = ink) {
  return node('TEXT', parent, { x, y, w, h: size * 1.3, slot, fontName: INTER(style), fontSize: size, fillPaints: [paint], textData: { characters } });
}

function profileCard() {
  const page = { guid: { sessionID: 0, localID: PAGE }, type: 'CANVAS', name: 'Page' };
  const card = node('FRAME', PAGE, { x: 0, y: 0, w: 420, h: 320, cornerRadius: 20, fillPaints: [solid(1, 1, 1)], frameMaskDisabled: false, slot: 'a', name: 'Profile card' });
  const avatar = node('ELLIPSE', card.id, { x: 32, y: 32, w: 72, h: 72, fillPaints: [solid(0.85, 0.62, 0.47)], slot: 'a' });
  const name = text(card.id, 'b', 'Marta Ribeiro', 124, 40, 260, 24, 'Bold');
  const role = text(card.id, 'c', 'Head of Product · Lumen Ceramics', 124, 76, 270, 15, 'Regular', muted);
  const stats = text(card.id, 'd', '1,284 followers   ·   86 posts', 32, 140, 340, 15, 'Medium', muted);
  const bio = text(card.id, 'e', 'Designing slower mornings, one mug at a time.', 32, 176, 356, 17);
  const follow = node('ROUNDED_RECTANGLE', card.id, { x: 32, y: 236, w: 170, h: 52, cornerRadius: 12, fillPaints: [ink], slot: 'f' });
  const followLabel = text(card.id, 'g', 'Follow', 88, 250, 80, 17, 'Medium', solid(1, 1, 1));
  const message = node('ROUNDED_RECTANGLE', card.id, { x: 218, y: 236, w: 170, h: 52, cornerRadius: 12, fillPaints: [solid(0.95, 0.93, 0.9)], slot: 'h' });
  const messageLabel = text(card.id, 'i', 'Message', 266, 250, 90, 17, 'Medium');
  return { meta: {}, blobs: [], nodes: [page, card, avatar, name, role, stats, bio, follow, followLabel, message, messageLabel] };
}

const FIGMA_CLIP = figmaClipboardHtml(profileCard() as Parameters<typeof figmaClipboardHtml>[0]);

test('figma paste', async ({ page, session }) => {
  await installCursor(page);
  await openCanvas(page, session);
  await page.evaluate(async (body) => {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob(['figma'], { type: 'text/plain' }) })]);
  }, FIGMA_CLIP);
  const pane = (await page.locator('.svelte-flow').boundingBox())!;

  await recordDemo(page, { slug: 'figma-paste', title: 'paste straight from figma' }, async (d) => {
    await d.click({ x: pane.x + pane.width * 0.85, y: pane.y + pane.height * 0.85 });
    await d.move({ x: pane.x + pane.width * 0.5, y: pane.y + pane.height * 0.62 });
    await d.key('ControlOrMeta+v', '⌘ V');
    await expect(page.locator('[data-testid="frame-overlays"] [data-frame]')).toHaveCount(1, { timeout: 30_000 });
    await d.wait(1500);
    await d.key('Shift+Digit1', '⇧ 1');
    await d.wait(2000);
    const frame = (await page.locator('[data-testid="frame-overlays"] [data-frame]').boundingBox())!;
    await d.click({ x: frame.x + frame.width * 0.3, y: frame.y + frame.height * 0.3 });
    await d.click({ x: frame.x + frame.width * 0.3, y: frame.y + frame.height * 0.3 });
    await d.wait(1800);
  });
});
