import { describe, expect, it, vi } from 'vitest';
import { keepAwake, type Page } from './stay-awake';

function fakePage(hidden = false) {
  const listeners = new Set<() => void>();
  const page: Page & { flip: (h: boolean) => void } = {
    get hidden() {
      return hidden;
    },
    addEventListener: (_: 'visibilitychange', fn: () => void) => listeners.add(fn),
    removeEventListener: (_: 'visibilitychange', fn: () => void) => listeners.delete(fn),
    flip: (h: boolean) => {
      hidden = h;
      listeners.forEach((fn) => fn());
    }
  };
  return page;
}

describe('keepAwake', () => {
  it('prende il wake lock, lo riprende al ritorno in primo piano e lo rilascia', async () => {
    const page = fakePage(false);
    const release = vi.fn(async () => {});
    const request = vi.fn(async () => ({ release }));
    const stop = await keepAwake({ wakeLock: { request } }, page);
    page.flip(true);
    page.flip(false);
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    stop();
    expect(release).toHaveBeenCalled();
  });

  it('senza Wake Lock API non fallisce', async () => {
    const stop = await keepAwake({}, fakePage(false));
    expect(() => stop()).not.toThrow();
  });
});
