import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { previewEdit } from './runtime.js';
import { trackRects } from './track.js';

const SOURCE = 'src/Hero.svelte:2:3';

function pageWithLayout() {
  const win = new JSDOM(`<body><h1 data-feega-src="${SOURCE}">Title</h1></body>`).window;
  const frames: (() => void)[] = [];
  Object.assign(win, { requestAnimationFrame: (run: () => void) => frames.push(run), ResizeObserver: class { observe() {} disconnect() {} } });
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    const font = win.getComputedStyle(this).fontSize;
    const size = font.endsWith('px') ? parseFloat(font) : 16;
    return { x: 0, y: 0, width: 100, height: size * 1.5, top: 0, left: 0, right: 100, bottom: size * 1.5, toJSON() {} } as DOMRect;
  };
  const flushFrame = () => frames.splice(0).forEach((f) => f());
  return { win, flushFrame };
}

describe('the outline follows the element', () => {
  it('a font size preview re-sends the taller rect within one frame', async () => {
    const { win, flushFrame } = pageWithLayout();
    const sent: { slot: string; rect: { height: number } | null }[] = [];
    const tracker = trackRects(win, (slot, rect) => sent.push({ slot, rect }));
    tracker.follow('selected', SOURCE);
    flushFrame();

    previewEdit(win.document, { source: SOURCE, style: { fontSize: '40px' } });
    await Promise.resolve();
    flushFrame();

    expect(sent.map((s) => s.rect?.height)).toEqual([24, 60]);
  });

  it('an element replaced by hot reload is found again by its source', async () => {
    const { win, flushFrame } = pageWithLayout();
    const sent: (number | undefined)[] = [];
    const tracker = trackRects(win, (_, rect) => sent.push(rect?.height));
    tracker.follow('selected', SOURCE);
    flushFrame();

    win.document.body.innerHTML = `<h1 data-feega-src="${SOURCE}" style="font-size: 20px">Title</h1>`;
    await Promise.resolve();
    flushFrame();

    expect(sent).toEqual([24, 30]);
  });
});
