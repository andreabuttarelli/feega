import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { keepScroll } from './reload-restore.js';

function pageAt(url: string, storage: Map<string, string>) {
  const win = new JSDOM('<body></body>', { url }).window;
  const scrolled: number[] = [];
  Object.defineProperty(win, 'scrollY', { value: 300, configurable: true });
  Object.assign(win, { scrollTo: (_x: number, y: number) => scrolled.push(y) });
  const store = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) };
  return { win, scrolled, store };
}

describe('a reload the user did not ask for', () => {
  it('comes back at the same scroll and says it was restored', () => {
    const storage = new Map<string, string>();
    const first = pageAt('http://localhost/pricing', storage);
    keepScroll(first.win, first.store);
    first.win.dispatchEvent(new first.win.Event('pagehide'));

    const second = pageAt('http://localhost/pricing', storage);
    const restored = keepScroll(second.win, second.store).restored;

    expect(restored).toBe(true);
    expect(second.scrolled).toEqual([300]);
  });

  it('a navigation the panel asked for is not restored', () => {
    const storage = new Map<string, string>();
    const first = pageAt('http://localhost/pricing', storage);
    keepScroll(first.win, first.store).leave();
    first.win.dispatchEvent(new first.win.Event('pagehide'));

    const second = pageAt('http://localhost/pricing', storage);

    expect(keepScroll(second.win, second.store).restored).toBe(false);
    expect(second.scrolled).toEqual([]);
  });

  it('another route is not restored', () => {
    const storage = new Map<string, string>();
    const first = pageAt('http://localhost/pricing', storage);
    keepScroll(first.win, first.store);
    first.win.dispatchEvent(new first.win.Event('pagehide'));

    const second = pageAt('http://localhost/about', storage);

    expect(keepScroll(second.win, second.store).restored).toBe(false);
  });
});
