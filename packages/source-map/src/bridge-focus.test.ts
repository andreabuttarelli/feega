import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { installBridge } from './bridge.js';

const CARD = 'src/Card.tsx:4:5';

function bridged() {
  const win = new JSDOM(`<!doctype html><body><main data-feega-src="src/App.tsx:1:1"><article data-feega-src="${CARD}"><h2 data-feega-src="src/Card.tsx:5:7">One</h2></article><article data-feega-src="${CARD}"><h2 data-feega-src="src/Card.tsx:5:7">Two</h2></article></main><footer data-feega-src="src/App.tsx:9:1">Footer</footer></body>`, { pretendToBeVisual: true }).window;
  const up: Record<string, unknown>[] = [];
  Object.defineProperty(win, 'parent', { value: { postMessage: (data: Record<string, unknown>) => up.push(data) } });
  installBridge(win as unknown as Window);
  const send = (data: Record<string, unknown>) => win.dispatchEvent(new win.MessageEvent('message', { data, source: win.parent as unknown as Window }));
  const frame = () => win.document.getElementById('feega-focus') as HTMLIFrameElement | null;
  return { win, up, send, frame };
}

describe('focus tab', () => {
  it('opens a frame with only the instance that was asked for', () => {
    const { up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 1 });

    expect(up).toContainEqual({ type: 'feega:focused', count: 1, mode: 'snapshot', reason: 'unsupported_framework' });
    expect(frame()!.srcdoc).toContain('Two');
    expect(frame()!.srcdoc).not.toContain('One');
    expect(frame()!.srcdoc).not.toContain('Footer');
  });

  it('paints the canvas dark when the view asks for the dark scheme, and light again after', () => {
    const { send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 0 });
    const canvas = () => frame()!.srcdoc.match(/<style id="feega-focus-canvas">([^<]*)<\/style>/)![1];
    const light = canvas();

    send({ type: 'feega:focus-canvas', scheme: 'dark' });
    const dark = frame()!.srcdoc.match(/<style id="feega-focus-canvas">([^<]*)<\/style>/)![1];

    expect(dark).not.toBe(light);
    expect(dark).toContain('#1c1c20');
    send({ type: 'feega:focus-canvas', scheme: 'light' });
    expect(canvas()).toBe(light);
  });

  it('keeps the scheme when another instance opens', () => {
    const { send, frame } = bridged();
    send({ type: 'feega:focus-canvas', scheme: 'dark' });
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 1 });

    expect(frame()!.srcdoc).toContain('#1c1c20');
  });

  it('draws a subtle checker darker than the old light one', () => {
    const { send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 0 });

    expect(frame()!.srcdoc).not.toContain('#f4f4f6');
  });

  it('swaps the instance when another one is asked for', () => {
    const { send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 0 });
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 1 });
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 1, shown: false });

    expect(frame()!.srcdoc).toContain('Two');
    expect(frame()!.srcdoc).not.toContain('One');
  });

  it('answers inspect in the focus tab with what the page knows: how many instances and which usage', async () => {
    const { win, up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 1 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    frame()!.contentDocument!.write(frame()!.srcdoc);
    frame()!.dispatchEvent(new (win as unknown as typeof globalThis).Event('load'));
    send({ type: 'feega:inspect', id: 7, selector: '[data-feega-src="src/Card.tsx:5:7"]', focus: true });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const reply = up.find((m) => m.type === 'feega:inspect:result') as { result: { instances: number; usage: { index: number; count: number } } };
    expect(reply.result.instances).toBe(2);
    expect(reply.result.usage).toEqual({ index: 1, count: 2 });
  });

  it.each(['body', 'html'])('selects nothing when the canvas background (%s) is clicked in the focus tab', async (selector) => {
    const { win, up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 1 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    frame()!.contentDocument!.write(frame()!.srcdoc);
    frame()!.dispatchEvent(new (win as unknown as typeof globalThis).Event('load'));
    send({ type: 'feega:inspect', id: 9, selector, focus: true });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const reply = up.find((m) => m.type === 'feega:inspect:result' && m.id === 9) as { result: unknown };
    expect(reply.result).toBeNull();
  });

  it('reports zero and opens nothing for a component that is not on the page', () => {
    const { up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Gone.tsx:1:1' });

    expect(up).toContainEqual({ type: 'feega:focused', count: 0, mode: 'snapshot' });
    expect(frame()).toBeNull();
  });

  it('opens the tab once a component that was not rendered yet shows up', async () => {
    const { win, up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Late.tsx:2:3' });
    win.document.body.insertAdjacentHTML('beforeend', '<aside data-feega-src="src/Late.tsx:1:1"><b data-feega-src="src/Late.tsx:2:3">late</b></aside>');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(up).toContainEqual({ type: 'feega:focused', count: 1, mode: 'snapshot', reason: 'unsupported_framework' });
    expect(frame()!.srcdoc).toContain('late');
  });

  it('shows what changed on the page in the open tab', async () => {
    const { win, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
    win.document.querySelector('h2')!.textContent = 'Edited';
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(frame()!.contentDocument!.body.textContent).toContain('Edited');
  });

  it('removes the frame when told to close', () => {
    const { send, frame } = bridged();
    send({ type: 'feega:focus', source: CARD });
    send({ type: 'feega:focus', source: null });

    expect(frame()).toBeNull();
  });

  it('hides the frame without closing it', () => {
    const { send, frame } = bridged();
    send({ type: 'feega:focus', source: CARD });
    send({ type: 'feega:focus', source: CARD, shown: false });

    expect(frame()!.style.display).toBe('none');

    send({ type: 'feega:focus', source: CARD, shown: true });

    expect(frame()!.style.display).toBe('block');
  });

  it('hands the messages meant for the focus tab to its document', async () => {
    const { send, frame } = bridged();
    send({ type: 'feega:focus', source: CARD });
    const got: unknown[] = [];
    frame()!.contentWindow!.addEventListener('message', (e) => got.push((e as MessageEvent).data));
    send({ type: 'feega:mode', mode: 'design', focus: true });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(got).toEqual([{ type: 'feega:mode', mode: 'design' }]);
  });

  it('does not act on a message meant for the focus tab itself', () => {
    const { send, up } = bridged();
    send({ type: 'feega:palette', focus: true });

    expect(up.some((m) => m.type === 'feega:palette:result')).toBe(false);
  });

  it('sends the tree of the focus tab without html and body', async () => {
    const { win, up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 1 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    frame()!.contentDocument!.write(frame()!.srcdoc);
    frame()!.dispatchEvent(new (win as unknown as typeof globalThis).Event('load'));
    send({ type: 'feega:tree', focus: true });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const reply = up.find((m) => m.type === 'feega:tree:result' && m.focus) as { tree: { name: string }[] };
    expect(reply.tree.map((node) => node.name)).toEqual(['Card']);
  });

  it('marks what comes back from the focus tab so the view can tell the tabs apart', async () => {
    const { send, up, frame } = bridged();
    send({ type: 'feega:focus', source: CARD });
    await new Promise((resolve) => setTimeout(resolve, 100));
    frame()!.dispatchEvent(new (frame()!.ownerDocument.defaultView as unknown as typeof globalThis).Event('load'));
    send({ type: 'feega:palette', focus: true });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(up).toContainEqual(expect.objectContaining({ type: 'feega:palette:result', focus: true }));
  });

  describe('a React component', () => {
    const MOUNT_STATUS = 'feega:mount:status';
    const reactive = () => {
      const made = bridged();
      const article = made.win.document.querySelector('article') as unknown as Record<string, unknown>;
      const component = { tag: 0, type: function Card() {}, memoizedProps: { size: 'sm', onClick: () => undefined }, return: null };
      article['__reactFiber$k'] = { tag: 5, type: 'article', memoizedProps: {}, return: component };
      const status = (data: Record<string, unknown>) => made.win.dispatchEvent(new made.win.MessageEvent('message', { data: { type: MOUNT_STATUS, ...data }, source: made.frame()!.contentWindow as unknown as Window }));
      return { ...made, status };
    };

    it('opens the real component from the dev server, with the props it has on the page', () => {
      const { up, send, frame } = reactive();
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });

      const url = new URL(frame()!.getAttribute('src')!, 'http://localhost');
      expect(url.pathname).toBe('/__feega/mount');
      expect(url.searchParams.get('file')).toBe('src/Card.tsx');
      expect(url.searchParams.get('name')).toBe('Card');
      expect(JSON.parse(url.searchParams.get('props')!)).toEqual({ size: 'sm', onClick: { $fn: true } });
      expect(up).toContainEqual({ type: 'feega:focused', count: 1, mode: 'mount' });
    });

    it('reopens the page itself when the app is Next.js, which has no mount route', () => {
      const { win, send, frame } = reactive();
      (win as unknown as Record<string, unknown>).next = { version: '15.0.0' };
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7', index: 0 });

      const src = frame()!.getAttribute('src')!;
      expect(src.startsWith(`${win.location.pathname}${win.location.search}#feega-mount=`)).toBe(true);
      expect(JSON.parse(decodeURIComponent(src.split('#feega-mount=')[1]))).toMatchObject({ file: 'src/Card.tsx', name: 'Card', source: 'src/Card.tsx:5:7', index: 0 });
    });

    it('tells the view when the component is up, with what it learned about it', () => {
      const { up, send, status } = reactive();
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
      status({ status: 'ready', controls: [], props: { size: 'sm' } });

      expect(up).toContainEqual({ type: MOUNT_STATUS, status: 'ready', controls: [], props: { size: 'sm' } });
    });

    it('falls back to the snapshot when the component cannot render alone, and says why', () => {
      const { up, send, status, frame } = reactive();
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
      status({ status: 'failed', reason: 'useTheme must be used within a ThemeProvider' });

      expect(frame()!.srcdoc).toContain('One');
      expect(frame()!.getAttribute('src')).toBeNull();
      expect(up).toContainEqual({ type: 'feega:focused', count: 1, mode: 'snapshot', reason: 'mount_error', detail: 'provider' });
    });

    it('falls back to the snapshot when the server has no mount page, as in Next.js', () => {
      const { win, up, send, frame } = reactive();
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
      frame()!.dispatchEvent(new (win as unknown as typeof globalThis).Event('load'));

      expect(frame()!.srcdoc).toContain('One');
      expect(up).toContainEqual(expect.objectContaining({ type: 'feega:focused', count: 1, mode: 'snapshot' }));
    });

    it('does not try the real component again for a source that failed', () => {
      const { send, status, frame } = reactive();
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
      status({ status: 'failed', reason: 'x' });
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });

      expect(frame()!.getAttribute('src')).toBeNull();
    });

    it('leaves the real component alone when the page changes', async () => {
      const { win, send, frame } = reactive();
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
      (frame()!.contentWindow as unknown as Record<symbol, boolean>)[Symbol.for('feega.nested-host')] = true;
      const before = frame()!.getAttribute('src');
      win.document.querySelector('h2')!.textContent = 'Edited';
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(frame()!.getAttribute('src')).toBe(before);
      expect(frame()!.srcdoc).toBe('');
    });

    it('carries the page fonts and styles into the real component, which the mount page does not have', () => {
      const { win, send, frame } = reactive();
      const head = win.document.head;
      head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"><style>@font-face{font-family:Brand;src:url(fonts/brand.woff2)}</style>');
      win.document.documentElement.className = '__variable_geist';
      win.document.body.className = 'font-sans';
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
      (frame()!.contentWindow as unknown as Record<symbol, boolean>)[Symbol.for('feega.nested-host')] = true;
      frame()!.dispatchEvent(new (win as unknown as typeof globalThis).Event('load'));

      const inner = frame()!.contentDocument!;
      expect(inner.head.querySelector('link[href^="https://fonts.googleapis.com"]')).not.toBeNull();
      expect(inner.head.innerHTML).toContain('font-family:Brand');
      expect(inner.head.querySelector('base')?.getAttribute('href')).toBe(win.document.baseURI);
      expect(inner.documentElement.classList.contains('__variable_geist')).toBe(true);
      expect(inner.body.classList.contains('font-sans')).toBe(true);
    });

    it('ignores a status from anything but the focus tab', () => {
      const { up, send, win } = reactive();
      send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });
      win.dispatchEvent(new win.MessageEvent('message', { data: { type: MOUNT_STATUS, status: 'failed', reason: 'x' }, source: win as unknown as Window }));

      expect(up.some((m) => m.mode === 'snapshot')).toBe(false);
    });
  });
});
