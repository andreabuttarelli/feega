import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seeks: unknown[][] = [];

const fakePage = {
  setDefaultTimeout: () => {},
  setViewport: async () => {},
  evaluate: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)
};

const launches: { executablePath: string; args?: string[] }[] = [];
const LAMBDA_ARGS = ['--single-process'];

vi.mock('virtual:motion-shader-fx', () => ({ default: '' }));
vi.mock('@sparticuz/chromium-min', () => ({ default: { executablePath: async () => '/chrome', args: LAMBDA_ARGS } }));
vi.mock('puppeteer-core', () => ({
  default: {
    launch: async (options: { executablePath: string; args?: string[] }) => {
      launches.push(options);
      return { connected: true, newPage: async () => fakePage };
    }
  }
}));

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

describe('chromium launch', () => {
  beforeEach(() => {
    vi.resetModules();
    launches.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('a local CHROMIUM_PATH browser starts without the serverless flags that crash it on a laptop', async () => {
    vi.stubEnv('CHROMIUM_PATH', '/Applications/Chrome');
    const { chromiumPage } = await import('./chromium-frames');

    await chromiumPage();

    expect(launches[0]).toMatchObject({ executablePath: '/Applications/Chrome' });
    expect(launches[0].args ?? []).not.toEqual(expect.arrayContaining(LAMBDA_ARGS));
  });

  it('the downloaded serverless browser keeps its flags', async () => {
    vi.stubEnv('CHROMIUM_PATH', '');
    vi.stubEnv('VERCEL', '1');
    const { chromiumPage } = await import('./chromium-frames');

    await chromiumPage();

    expect(launches[0]).toMatchObject({ executablePath: '/chrome', args: LAMBDA_ARGS });
  });
});
