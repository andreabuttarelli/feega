import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { installBridge } from './bridge.js';
import { inspectElement, treeOf } from './runtime.js';
import { trackRects } from './track.js';

const MARK = 'src/Mark.svelte:1:1';
const VIEWPORT_HEIGHT = 900;

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, toJSON() {} }) as DOMRect;

function revealed(markup: string, boxes: DOMRect[], index: number) {
  const win = new JSDOM(`<body>${markup}</body>`).window;
  installBridge(win as unknown as Window);
  Object.defineProperty(win, 'innerHeight', { value: VIEWPORT_HEIGHT });
  const scrolled: number[] = [];
  [...win.document.querySelectorAll('i')].forEach((el, i) => {
    el.scrollIntoView = () => void scrolled.push(i);
    el.getBoundingClientRect = () => boxes[i];
  });
  const parent = { postMessage: () => undefined };
  win.dispatchEvent(new win.MessageEvent('message', { data: { type: 'feega:reveal', source: MARK, index }, source: parent as unknown as Window }));
  return scrolled;
}

describe('layer instances', () => {
  it('a source rendered in two places gives each node its own instance index', () => {
    const win = new JSDOM(`<body><header data-feega-src="a.svelte:1:1"><i data-feega-src="${MARK}"></i></header><footer data-feega-src="a.svelte:2:1"><i data-feega-src="${MARK}"></i></footer></body>`).window;

    const [html] = treeOf(win.document);
    const marks = html.children[0].children.map((n: { children: { instance: number }[] }) => n.children[0].instance);

    expect(marks).toEqual([0, 1]);
  });

  it('a folded run of siblings points at its first instance', () => {
    const win = new JSDOM(`<body><ul data-feega-src="a.svelte:1:1"><li data-feega-src="a.svelte:2:1"></li><li data-feega-src="a.svelte:2:1"></li></ul><ul data-feega-src="a.svelte:9:1"><li data-feega-src="a.svelte:2:1"></li></ul></body>`).window;

    const [html] = treeOf(win.document);
    const lists = html.children[0].children;

    expect(lists.map((l: { children: { instance: number; count: number }[] }) => [l.children[0].instance, l.children[0].count])).toEqual([
      [0, 2],
      [2, 1]
    ]);
  });
});

describe('an element with no box of its own', () => {
  it('display contents reports the union of its children', () => {
    const win = new JSDOM(`<body><div data-feega-src="a.svelte:1:1" style="display: contents"><p data-feega-src="a.svelte:2:1">a</p><p data-feega-src="a.svelte:3:1">b</p></div></body>`).window;
    const [first, second] = win.document.querySelectorAll('p');
    first.getBoundingClientRect = () => rect(10, 20, 100, 30);
    second.getBoundingClientRect = () => rect(10, 60, 80, 40);
    win.document.querySelector('div')!.getBoundingClientRect = () => rect(0, 0, 0, 0);

    expect(inspectElement(win.document.querySelector('div')!)!.rect).toEqual({ x: 10, y: 20, width: 100, height: 80 });
  });

  it('the tracker follows the union too', () => {
    const win = new JSDOM(`<body><div data-feega-src="a.svelte:1:1" style="display: contents"><p data-feega-src="a.svelte:2:1">a</p></div></body>`).window;
    Object.assign(win, { requestAnimationFrame: (run: () => void) => run(), ResizeObserver: class { observe() {} disconnect() {} } });
    win.document.querySelector('p')!.getBoundingClientRect = () => rect(5, 6, 70, 8);
    win.document.querySelector('div')!.getBoundingClientRect = () => rect(0, 0, 0, 0);
    const sent: unknown[] = [];

    trackRects(win, (_, r) => sent.push(r)).follow('selected', 'a.svelte:1:1');

    expect(sent).toEqual([{ x: 5, y: 6, width: 70, height: 8 }]);
  });
});

describe('revealing a layer', () => {
  const two = `<i data-feega-src="${MARK}"></i><i data-feega-src="${MARK}"></i>`;

  it('scrolls the instance the index names into view', () => {
    expect(revealed(two, [rect(0, 5000, 10, 10), rect(0, 5000, 10, 10)], 1)).toEqual([1]);
  });

  it('leaves an element already on screen where it is', () => {
    expect(revealed(two, [rect(0, 100, 10, 10), rect(0, 100, 10, 10)], 0)).toEqual([]);
  });
});
