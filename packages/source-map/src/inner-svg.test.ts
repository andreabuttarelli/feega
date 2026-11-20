import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { deepestAt, inspectElement, previewEdit } from './runtime.js';

const SOURCE = 'src/Modes.svelte:20:7';
const page = `<a class="mac" data-feega-src="${SOURCE}"><svg viewBox="0 0 10 10"><path d="M0 0"/></svg>Mac app</a>`;

function dom() {
  const win = new JSDOM(`<body>${page}</body>`).window;
  const boxes = new Map<string, DOMRect>([
    ['A', { x: 0, y: 0, width: 100, height: 30 } as DOMRect],
    ['svg', { x: 10, y: 8, width: 14, height: 14 } as DOMRect],
    ['path', { x: 10, y: 8, width: 14, height: 14 } as DOMRect]
  ]);
  const rectOf = (el: Element) => ({ ...(boxes.get(el.tagName) ?? { x: 0, y: 0, width: 0, height: 0 }), toJSON() {} }) as DOMRect;
  win.Element.prototype.getBoundingClientRect = function () {
    return rectOf(this);
  };
  win.document.elementFromPoint = () => win.document.querySelector('a');
  return win;
}

describe('an icon injected as raw markup', () => {
  it('a point over the icon reaches the svg, not its link', () => {
    const win = dom();

    expect(deepestAt(win.document, 15, 12)?.tagName).toBe('svg');
    expect(deepestAt(win.document, 60, 12)?.tagName).toBe('A');
  });

  it('the svg is inspected on its own, addressed through its tagged parent', () => {
    const win = dom();
    const info = inspectElement(win.document.querySelector('path')!)!;

    expect(info.source).toEqual({ file: 'src/Modes.svelte', line: 20, col: 7 });
    expect(info.inner).toBe('svg');
    expect(info.html.startsWith('<svg')).toBe(true);
    expect(info.rect).toEqual({ x: 10, y: 8, width: 14, height: 14 });
  });

  it('a preview for the inner svg styles the svg only', () => {
    const win = dom();
    previewEdit(win.document, { source: SOURCE, inner: 'svg', style: { width: '20px' } });

    expect(win.getComputedStyle(win.document.querySelector('svg')!).width).toBe('20px');
    expect(win.getComputedStyle(win.document.querySelector('a')!).width).not.toBe('20px');
  });
});
