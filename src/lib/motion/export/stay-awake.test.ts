import { describe, expect, it, vi } from 'vitest';
import { keepAwake, visibleGate, type Page } from './stay-awake';

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

describe('visibleGate', () => {
  it('passa subito con la tab in primo piano', async () => {
    const pauses: boolean[] = [];
    await visibleGate(fakePage(false), (p) => pauses.push(p))();
    expect(pauses).toEqual([]);
  });

  it('con la tab in background aspetta che torni visibile, e lo dice', async () => {
    const page = fakePage(true);
    const pauses: boolean[] = [];
    let passed = false;
    const waiting = visibleGate(page, (p) => pauses.push(p))().then(() => (passed = true));
    await Promise.resolve();
    expect(passed).toBe(false);
    page.flip(false);
    await waiting;
    expect(pauses).toEqual([true, false]);
  });
});

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
