import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { reviveProps, rendersNothing, startMount } from './mount-runtime.js';

type Posted = Record<string, unknown>;

function setup(options: { exports?: Record<string, unknown>; draw?: (el: Element, tree: unknown) => void; url?: string } = {}) {
  const win = new JSDOM('<!doctype html><body><div id="root"></div></body>', { pretendToBeVisual: true, url: options.url ?? 'http://localhost/' }).window;
  const posted: Posted[] = [];
  Object.defineProperty(win, 'parent', { value: { postMessage: (data: Posted) => posted.push(data) } });
  const rendered: unknown[] = [];
  const react = { createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }), Component: class {}, Fragment: Symbol('fragment') };
  const createRoot = (el: Element) => ({ render: (tree: unknown) => (rendered.push(tree), options.draw?.(el, tree)) });
  const fetched = { json: async () => ({ controls: [{ name: 'size' }] }) };
  const win2 = Object.assign(win, { fetch: async () => fetched });
  const start = (more: Record<string, unknown> = {}) => startMount({ react, createRoot, mod: options.exports ?? { Card: () => null }, name: 'Card', file: 'src/Card.tsx', props: { size: 'sm' }, providers: null, controlsUrl: '/props', win: win2 as unknown as Window, ...more });
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  return { win: win2, posted, rendered, start, wait };
}

describe('reviveProps', () => {
  it('turns the function marks back into no-ops', () => {
    const props = reviveProps({ onClick: { $fn: true }, size: 'sm' });

    expect(props.size).toBe('sm');
    expect((props.onClick as () => unknown)()).toBeUndefined();
  });

  it('leaves out a prop that was JSX on the page, which cannot be sent', () => {
    expect(reviveProps({ icon: { $jsx: true }, size: 'sm' })).toEqual({ icon: undefined, size: 'sm' });
  });

  it('turns the text mark back into its text, which stands in for children', () => {
    expect(reviveProps({ children: { $text: 'Text' } }).children).toBe('Text');
  });

  it('turns the date marks back into dates', () => {
    const props = reviveProps({ when: { $date: '2026-01-02T00:00:00.000Z' } });

    expect(props.when).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });
});

describe('rendersNothing', () => {
  it('is true for an empty container and false once anything is in it', () => {
    const doc = new JSDOM('<div id="a"></div><div id="b"><i></i></div><div id="c">text</div>').window.document;

    expect(rendersNothing(doc.getElementById('a')!)).toBe(true);
    expect(rendersNothing(doc.getElementById('b')!)).toBe(false);
    expect(rendersNothing(doc.getElementById('c')!)).toBe(false);
  });
});

describe('startMount', () => {
  it('fails at once when the file does not export the component', () => {
    const { start, posted } = setup({ exports: { Other: () => null } });
    start();

    expect(posted).toEqual([{ type: 'feega:mount:status', status: 'failed', reason: 'The component is not exported' }]);
  });

  it('takes the default export when the name is not exported', () => {
    const { start, rendered } = setup({ exports: { default: () => null } });
    start();

    expect(rendered).toHaveLength(1);
  });

  it('fails when it rendered nothing', async () => {
    const { start, posted, wait } = setup();
    start({ giveUpMs: 0 });
    await wait(450);

    expect(posted).toContainEqual({ type: 'feega:mount:status', status: 'failed', reason: 'It rendered nothing' });
  });

  it('waits for a component that renders late, as an Astro one does on a cold server', async () => {
    let element: Element | null = null;
    const { start, posted, wait } = setup({ draw: (el) => (element = el) });
    start();
    setTimeout(() => ((element as Element).innerHTML = '<b>late</b>'), 500);
    await wait(1200);

    expect(posted.map((message) => message.status)).toEqual(['ready']);
  });

  it('reports ready with the controls and props once something is on screen', async () => {
    const { start, posted, wait } = setup({ draw: (el) => (el.innerHTML = '<b>hi</b>') });
    start();
    await wait(450);

    expect(posted).toContainEqual({ type: 'feega:mount:status', status: 'ready', name: 'Card', file: 'src/Card.tsx', controls: [{ name: 'size' }], props: { size: 'sm' }, size: { width: 0, height: 0 } });
  });

  it('reports how big the component came out, so a frame can be cut to it', async () => {
    const { start, win, posted, wait } = setup({ draw: (el) => (el.innerHTML = '<b>hi</b>') });
    win.document.getElementById('root')!.getBoundingClientRect = () => ({ width: 200.4, height: 89.2 }) as DOMRect;
    start();
    await wait(450);

    expect(posted).toContainEqual(expect.objectContaining({ status: 'ready', size: { width: 201, height: 90 } }));
  });

  it('adds the fit padding to the size it reports when the canvas asks to fit', async () => {
    const { start, win, posted, wait } = setup({ draw: (el) => (el.innerHTML = '<b>hi</b>'), url: 'http://localhost/m?fit=1' });
    win.document.getElementById('root')!.getBoundingClientRect = () => ({ width: 200, height: 90 }) as DOMRect;
    start();
    await wait(450);

    expect(posted).toContainEqual(expect.objectContaining({ size: { width: 232, height: 122 } }));
  });

  it('tightens the padding around the component when the canvas asks to fit it', () => {
    const { start, win } = setup({ url: 'http://localhost/m?fit=1' });
    start();

    expect(win.document.getElementById('feega-focus-canvas')!.textContent).toContain('padding:16px');
  });

  it('keeps the focus padding otherwise', () => {
    const { start, win } = setup();
    start();

    expect(win.document.getElementById('feega-focus-canvas')!.textContent).not.toContain('padding:16px');
  });

  it('ignores a page error once the component is on screen', async () => {
    const { start, win, posted, wait } = setup({ draw: (el) => (el.innerHTML = '<b>hi</b>') });
    start();
    win.dispatchEvent(new (win as unknown as { ErrorEvent: typeof ErrorEvent }).ErrorEvent('error', { message: 'Script error.' }));
    await wait(450);

    expect(posted.map((message) => message.status)).toEqual(['ready']);
  });

  it('ignores the ResizeObserver loop notice even before anything is drawn', async () => {
    const { start, win, posted, wait } = setup({ draw: (el) => setTimeout(() => (el.innerHTML = '<b>late</b>'), 100) });
    start();
    win.dispatchEvent(new (win as unknown as { ErrorEvent: typeof ErrorEvent }).ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
    await wait(600);

    expect(posted.map((message) => message.status)).toEqual(['ready']);
  });

  it('still fails on a real error before anything is drawn', () => {
    const { start, win, posted } = setup();
    start();
    win.dispatchEvent(new (win as unknown as { ErrorEvent: typeof ErrorEvent }).ErrorEvent('error', { message: 'Cannot read properties of undefined' }));

    expect(posted).toContainEqual({ type: 'feega:mount:status', status: 'failed', reason: 'Cannot read properties of undefined' });
  });

  it('tells the page which props the component declares once it fails, so they can be filled in', async () => {
    const { start, win, posted, wait } = setup();
    start();
    win.dispatchEvent(new (win as unknown as { ErrorEvent: typeof ErrorEvent }).ErrorEvent('error', { message: 'Cannot read properties of undefined' }));
    await wait(30);

    expect(posted).toContainEqual({ type: 'feega:mount:controls', controls: [{ name: 'size' }] });
  });

  it('does not ask for the props of a component that rendered', async () => {
    const { start, posted, wait } = setup({ draw: (el) => (el.innerHTML = '<b>hi</b>') });
    start();
    await wait(450);

    expect(posted.map((message) => message.type)).toEqual(['feega:mount:status']);
  });

  it('draws again with the props and the variants it is sent', () => {
    const { start, win, rendered } = setup();
    start();
    win.dispatchEvent(new (win as unknown as { MessageEvent: typeof MessageEvent }).MessageEvent('message', { data: { type: 'feega:mount:props', props: { size: 'lg' }, variants: [{ label: 'a', props: { size: 'sm' } }, { label: 'b', props: {} }] } }));

    expect(rendered).toHaveLength(2);
    expect(JSON.stringify(rendered[1])).toContain('"data-feega-variant":"b"');
    expect(JSON.stringify(rendered[1])).toContain('"size":"sm"');
  });
});
