import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { installBridge } from './bridge.js';
import { captureTab } from './capture.js';

const PNG = 'iVBORw0KGgo=';
const URL_PNG = `data:image/png;base64,${PNG}`;
const CARD = 'src/Card.tsx:4:5';

const page = () => new JSDOM(`<!doctype html><body style="background: rgb(10, 10, 10)"><main><article data-feega-src="${CARD}"><h2>One</h2></article><article data-feega-src="${CARD}"><h2>Two</h2></article></main></body>`, { pretendToBeVisual: true, url: 'http://localhost/' }).window as unknown as Window;

type Drawn = { node: Element; options: Record<string, unknown> };

const renderer = () => {
  const drawn: Drawn[] = [];
  return { drawn, render: async (node: Element, options: Record<string, unknown>) => (drawn.push({ node, options }), URL_PNG) };
};

describe('capturing the tab', () => {
  it('draws the whole page at the size of the window, from where it is scrolled', async () => {
    const win = page();
    Object.defineProperty(win, 'innerWidth', { value: 390 });
    Object.defineProperty(win, 'innerHeight', { value: 844 });
    Object.defineProperty(win, 'scrollY', { value: 120 });
    const { drawn, render } = renderer();

    const png = await captureTab(win, {}, render);

    expect(png).toBe(PNG);
    expect(drawn[0].node).toBe(win.document.documentElement);
    expect(drawn[0].options).toMatchObject({ width: 390, height: 844, style: { transform: 'translate(0px, -120px)' } });
  });

  it('paints behind a transparent page with white and keeps the colour of a painted one', async () => {
    const painted = renderer();
    await captureTab(page(), {}, painted.render);
    const bare = renderer();
    const win = page();
    win.document.body.removeAttribute('style');
    await captureTab(win, {}, bare.render);

    expect(painted.drawn[0].options.backgroundColor).toBe('rgb(10, 10, 10)');
    expect(bare.drawn[0].options.backgroundColor).toBe('#ffffff');
  });

  it('draws only the selected element when asked for the selection', async () => {
    const win = page();
    const { drawn, render } = renderer();

    await captureTab(win, { selector: `[data-feega-src="${CARD}"]`, index: 1 }, render);

    expect(drawn[0].node.textContent).toBe('Two');
    expect(drawn[0].options).toEqual({});
  });

  it('draws the whole page when the selection is not on it', async () => {
    const win = page();
    const { drawn, render } = renderer();

    await captureTab(win, { selector: '[data-feega-src="gone"]' }, render);

    expect(drawn[0].node).toBe(win.document.documentElement);
  });
});

describe('the bridge answering a capture', () => {
  const bridged = (render: (node: Element, options: Record<string, unknown>) => Promise<string>) => {
    const win = page();
    const up: Record<string, unknown>[] = [];
    Object.defineProperty(win, 'parent', { value: { postMessage: (data: Record<string, unknown>) => up.push(data) } });
    installBridge(win, { render } as never);
    const send = (data: Record<string, unknown>) => win.dispatchEvent(new (win as unknown as typeof globalThis).MessageEvent('message', { data, source: win.parent as unknown as Window }));
    return { up, send };
  };

  it('replies with the picture and the id it was asked for', async () => {
    const { render } = renderer();
    const { up, send } = bridged(render);

    send({ type: 'feega:capture', id: 4 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(up).toContainEqual({ type: 'feega:captured', id: 4, png: PNG });
  });

  it('replies with the reason when the page cannot be drawn', async () => {
    const { up, send } = bridged(async () => {
      throw new Error('tainted canvas');
    });

    send({ type: 'feega:capture', id: 5 });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(up).toContainEqual({ type: 'feega:captured', id: 5, error: 'tainted canvas' });
  });
});
