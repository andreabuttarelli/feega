import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { clearFocus, focusComponent, refreshFocus } from './focus.js';

const PAGE = `<body>
  <main data-feega-src="src/App.tsx:1:1">
    <section data-feega-src="src/Card.tsx:2:3"><p data-feega-src="src/Card.tsx:3:5">one</p></section>
    <section data-feega-src="src/Card.tsx:2:3"><p data-feega-src="src/Card.tsx:3:5">two</p></section>
    <footer data-feega-src="src/App.tsx:5:5">footer</footer>
  </main>
</body>`;

const CARD = 'src/Card.tsx:3:5';

function page() {
  const win = new JSDOM(PAGE).window;
  const rects = new Map<Element, { x: number; y: number; width: number; height: number }>();
  const sections = [...win.document.querySelectorAll('section')];
  sections.forEach((s, i) => rects.set(s, { x: 10, y: 100 * i, width: 200, height: 80 }));
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    const r = rects.get(this) ?? { x: 0, y: 0, width: 0, height: 0 };
    return { ...r, top: r.y, left: r.x, right: r.x + r.width, bottom: r.y + r.height, toJSON() {} } as DOMRect;
  };
  Object.assign(win, { innerWidth: 800, innerHeight: 600 });
  return { win, rects, sections };
}

const holes = (win: Window) => (win.document.querySelector('#feega-focus path')?.getAttribute('d') ?? '').split('M').length - 2;

describe('focus on a component', () => {
  it('cuts one hole per instance of the component the element belongs to', () => {
    const { win } = page();

    const found = focusComponent(win as never, { source: CARD });

    expect(found).toBe(2);
    expect(holes(win as never)).toBe(2);
  });

  it('an instance index narrows the focus to that instance', () => {
    const { win } = page();

    const found = focusComponent(win as never, { source: CARD, index: 1 });

    expect(found).toBe(1);
    expect(holes(win as never)).toBe(1);
  });

  it('a source that is not on the page focuses nothing and dims nothing', () => {
    const { win } = page();

    const found = focusComponent(win as never, { source: 'src/Gone.tsx:1:1' });

    expect(found).toBe(0);
    expect(win.document.getElementById('feega-focus')).toBeNull();
  });

  it('clearing the focus removes the dimming', () => {
    const { win } = page();
    focusComponent(win as never, { source: CARD });

    clearFocus(win as never);

    expect(win.document.getElementById('feega-focus')).toBeNull();
  });

  it('the hole follows an instance that moves', () => {
    const { win, rects, sections } = page();
    focusComponent(win as never, { source: CARD, index: 0 });
    const before = win.document.querySelector('#feega-focus path')!.getAttribute('d');

    rects.set(sections[0], { x: 10, y: 300, width: 200, height: 80 });
    refreshFocus(win as never);

    expect(win.document.querySelector('#feega-focus path')!.getAttribute('d')).not.toBe(before);
  });

  it('the overlay lets clicks through to the page', () => {
    const { win } = page();

    focusComponent(win as never, { source: CARD });

    expect((win.document.getElementById('feega-focus') as unknown as HTMLElement).style.pointerEvents).toBe('none');
  });
});

describe('focus over the bridge', () => {
  it('a focus message dims the page and replies with how many instances it found, a clear message undoes it', async () => {
    const { win } = page();
    const replies: { type: string; count?: number }[] = [];
    const { installBridge } = await import('./bridge.js');
    installBridge(win as never);
    const ask = (message: object) => win.dispatchEvent(Object.defineProperty(new win.MessageEvent('message', { data: message }), 'source', { value: { postMessage: (m: never) => replies.push(m) } }));

    ask({ type: 'feega:focus', source: CARD });
    expect(replies).toEqual([{ type: 'feega:focused', count: 2 }]);
    expect(win.document.getElementById('feega-focus')).not.toBeNull();

    ask({ type: 'feega:focus', source: null });
    expect(win.document.getElementById('feega-focus')).toBeNull();
  });
});
