import { afterEach, describe, expect, it, vi } from 'vitest';

const seeks: unknown[][] = [];

const fakePage = {
  setDefaultTimeout: () => {},
  setViewport: async () => {},
  evaluate: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)
};

vi.mock('virtual:motion-shader-fx', () => ({ default: '' }));
vi.mock('@sparticuz/chromium-min', () => ({ default: { executablePath: async () => '/chrome', args: [] } }));
vi.mock('puppeteer-core', () => ({ default: { launch: async () => ({ connected: true, newPage: async () => fakePage }) } }));

describe('chromiumFrames.seek', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('seeks the exact time, not the runtime default 30 fps grid', async () => {
    vi.stubGlobal('window', { __player: { renderSeek: (...args: unknown[]) => seeks.push(args) } });
    vi.stubGlobal('document', { querySelectorAll: () => [] });
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));
    const { chromiumFrames } = await import('./chromium-frames');

    const page = await chromiumFrames.open({ width: 10, height: 10, scale: 1 });
    await page.seek(1 / 60);

    expect(seeks).toEqual([[1 / 60, { exact: true }]]);
  });
});
