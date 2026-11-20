import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { installBridge } from './bridge.js';

const SOURCE = 'components/Card.tsx:3:5';

function bridged() {
  const win = new JSDOM(`<body><section data-feega-src="components/Card.tsx:2:3"><h1 data-feega-src="${SOURCE}">Title</h1></section></body>`).window;
  installBridge(win as unknown as Window);
  const replies: Record<string, unknown>[] = [];
  const parent = { postMessage: (data: Record<string, unknown>) => replies.push(data) };
  const send = (data: Record<string, unknown>) => win.dispatchEvent(new win.MessageEvent('message', { data, source: parent as unknown as Window }));
  return { win, replies, send, h1: win.document.querySelector('h1')! };
}

const key = (win: Window, el: Element, k: string) => el.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));

describe('text edited in place', () => {
  it('double click in design mode makes the element editable', () => {
    const { send, h1 } = bridged();
    send({ type: 'feega:mode', mode: 'design' });
    send({ type: 'feega:text:edit', selector: 'h1' });

    expect(h1.getAttribute('contenteditable')).toBe('plaintext-only');
  });

  it('enter commits the new text with its source and the old one', () => {
    const { win, send, replies, h1 } = bridged();
    send({ type: 'feega:mode', mode: 'design' });
    send({ type: 'feega:text:edit', selector: 'h1' });
    h1.textContent = 'New title';
    key(win as unknown as Window, h1, 'Enter');

    expect(replies).toContainEqual({ type: 'feega:text:done', source: SOURCE, text: 'New title', was: 'Title' });
    expect(h1.hasAttribute('contenteditable')).toBe(false);
  });

  it('escape puts the old text back and commits nothing', () => {
    const { win, send, replies, h1 } = bridged();
    send({ type: 'feega:mode', mode: 'design' });
    send({ type: 'feega:text:edit', selector: 'h1' });
    h1.textContent = 'Typo';
    key(win as unknown as Window, h1, 'Escape');

    expect(h1.textContent).toBe('Title');
    expect(replies.some((r) => r.type === 'feega:text:done')).toBe(false);
  });

  it('escape keeps the inline elements inside the text', () => {
    const win = new JSDOM(`<body><h1 data-feega-src="${SOURCE}">Build <span>fast</span> today</h1></body>`).window;
    installBridge(win as unknown as Window);
    const h1 = win.document.querySelector('h1')!;
    win.dispatchEvent(new win.MessageEvent('message', { data: { type: 'feega:mode', mode: 'design' }, source: win as unknown as Window }));
    win.dispatchEvent(new win.MessageEvent('message', { data: { type: 'feega:text:edit', selector: 'h1' }, source: win as unknown as Window }));
    h1.textContent = 'Typo';
    key(win as unknown as Window, h1, 'Escape');

    expect(h1.innerHTML).toBe('Build <span>fast</span> today');
  });

  it('a refused text is put back in the preview', () => {
    const { win, send, h1 } = bridged();
    send({ type: 'feega:mode', mode: 'design' });
    send({ type: 'feega:text:edit', selector: 'h1' });
    h1.textContent = 'Not saved';
    key(win as unknown as Window, h1, 'Enter');
    send({ type: 'feega:text:restore', source: SOURCE });

    expect(h1.textContent).toBe('Title');
  });

  it('in navigate mode nothing becomes editable', () => {
    const { send, h1 } = bridged();
    send({ type: 'feega:mode', mode: 'navigate' });
    send({ type: 'feega:text:edit', selector: 'h1' });

    expect(h1.hasAttribute('contenteditable')).toBe(false);
  });
});

describe('preview settled after hot reload', () => {
  it('reports the styles the written class does not produce', () => {
    const { send, replies } = bridged();
    send({ type: 'feega:preview', source: SOURCE, style: { fontSize: '40px' } });
    send({ type: 'feega:preview:settle', source: SOURCE });

    expect(replies).toContainEqual({ type: 'feega:preview:settled', source: SOURCE, unapplied: ['font-size'] });
  });
});

describe('routes inside the page', () => {
  it('a client-side navigation reports the new path', () => {
    const win = new JSDOM('<body></body>', { url: 'http://127.0.0.1:5173/' }).window;
    const posted: Record<string, unknown>[] = [];
    win.parent.postMessage = ((data: Record<string, unknown>) => posted.push(data)) as never;
    installBridge(win as unknown as Window);
    win.history.pushState({}, '', '/pricing');

    expect(posted).toContainEqual({ type: 'feega:location', path: '/pricing' });
  });
});

describe('scrolling from the inspector', () => {
  it('a wheel forwarded by the inspector scrolls the page and reports it', () => {
    const { win, send, replies } = bridged();
    const scrolled: number[] = [];
    win.scrollBy = ((_x: number, y: number) => scrolled.push(y)) as never;
    send({ type: 'feega:scroll', dx: 0, dy: 120 });

    expect(scrolled).toEqual([120]);
    expect(replies).toContainEqual({ type: 'feega:scrolled' });
  });
});
