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
  it('opens a frame with only the component and says how many instances it found', () => {
    const { up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Card.tsx:5:7' });

    expect(up).toContainEqual({ type: 'feega:focused', count: 2 });
    expect(frame()!.srcdoc).toContain('One');
    expect(frame()!.srcdoc).not.toContain('Footer');
  });

  it('reports zero and opens nothing for a component that is not on the page', () => {
    const { up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Gone.tsx:1:1' });

    expect(up).toContainEqual({ type: 'feega:focused', count: 0 });
    expect(frame()).toBeNull();
  });

  it('opens the tab once a component that was not rendered yet shows up', async () => {
    const { win, up, send, frame } = bridged();
    send({ type: 'feega:focus', source: 'src/Late.tsx:2:3' });
    win.document.body.insertAdjacentHTML('beforeend', '<aside data-feega-src="src/Late.tsx:1:1"><b data-feega-src="src/Late.tsx:2:3">late</b></aside>');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(up).toContainEqual({ type: 'feega:focused', count: 1 });
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

  it('marks what comes back from the focus tab so the view can tell the tabs apart', async () => {
    const { send, up, frame } = bridged();
    send({ type: 'feega:focus', source: CARD });
    await new Promise((resolve) => setTimeout(resolve, 100));
    frame()!.dispatchEvent(new (frame()!.ownerDocument.defaultView as unknown as typeof globalThis).Event('load'));
    send({ type: 'feega:palette', focus: true });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(up).toContainEqual(expect.objectContaining({ type: 'feega:palette:result', focus: true }));
  });
});
