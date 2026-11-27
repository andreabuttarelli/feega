import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBridge, LINKS } from './bridge.js';
import { LINKS_CAP, LINKS_REFRESH_MS, linksOf } from './links.js';

const ORIGIN = 'http://localhost:5173';

const domOf = (body: string) => new JSDOM(`<body>${body}</body>`, { url: `${ORIGIN}/start` }).window;

describe('linksOf', () => {
  it('lists the same-origin paths, without query or hash', () => {
    const { document } = domOf('<a href="/blog/a?x=1#t">a</a><a href="blog/b">b</a><a href="http://localhost:5173/c">c</a>');

    expect(linksOf(document, ORIGIN, LINKS_CAP)).toEqual(['/blog/a', '/blog/b', '/c']);
  });

  it('leaves out other origins, mail, scripts, anchors and downloads', () => {
    const { document } = domOf(
      '<a href="https://example.com/x">x</a><a href="mailto:a@b.c">m</a><a href="javascript:void(0)">j</a><a href="#top">t</a><a href="/file.pdf" download>d</a><a>none</a>'
    );

    expect(linksOf(document, ORIGIN, LINKS_CAP)).toEqual([]);
  });

  it('lists each path once', () => {
    const { document } = domOf('<a href="/a">1</a><a href="/a?x">2</a><a href="/a/">3</a>');

    expect(linksOf(document, ORIGIN, LINKS_CAP)).toEqual(['/a', '/a/']);
  });

  it('stops at the cap', () => {
    const { document } = domOf(Array.from({ length: 10 }, (_, i) => `<a href="/p${i}">p</a>`).join(''));

    expect(linksOf(document, ORIGIN, 3)).toEqual(['/p0', '/p1', '/p2']);
  });
});

describe('the bridge reports the links of the page', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function bridged(body: string) {
    const win = domOf(body);
    win.setTimeout = globalThis.setTimeout as unknown as typeof win.setTimeout;
    const sent: Record<string, unknown>[] = [];
    installBridge(win as unknown as Window, { emit: (message: Record<string, unknown>) => sent.push(message) });
    const links = () => sent.filter((m) => m.type === LINKS);

    return { win, links };
  }

  it('after the page loads', () => {
    const { links } = bridged('<a href="/blog/a">a</a>');
    vi.advanceTimersByTime(LINKS_REFRESH_MS);

    expect(links()).toEqual([{ type: LINKS, paths: ['/blog/a'] }]);
  });

  it('again when links are added, once for a burst of changes', async () => {
    const { win, links } = bridged('<a href="/blog/a">a</a>');
    vi.advanceTimersByTime(LINKS_REFRESH_MS);
    for (const name of ['b', 'c']) {
      const a = win.document.createElement('a');
      a.href = `/blog/${name}`;
      win.document.body.append(a);
    }
    await Promise.resolve();
    vi.advanceTimersByTime(LINKS_REFRESH_MS);

    expect(links().map((m) => m.paths)).toEqual([['/blog/a'], ['/blog/a', '/blog/b', '/blog/c']]);
  });

  it('says nothing when nothing changed', async () => {
    const { win, links } = bridged('<a href="/blog/a">a</a>');
    vi.advanceTimersByTime(LINKS_REFRESH_MS);
    win.document.body.append(win.document.createElement('p'));
    await Promise.resolve();
    vi.advanceTimersByTime(LINKS_REFRESH_MS);

    expect(links()).toHaveLength(1);
  });

  it('says nothing for a page without links', () => {
    const { links } = bridged('<p>hi</p>');
    vi.advanceTimersByTime(LINKS_REFRESH_MS);

    expect(links()).toEqual([]);
  });
});
