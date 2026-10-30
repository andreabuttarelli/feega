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

describe('chromiumExport on a frame taller than one screenshot', () => {
  it('draws a 2542×10628 frame in bands no taller than the browser can paint and stitches them whole', async () => {
    vi.resetModules();
    const { default: sharp } = await import('sharp');
    const viewports: { width: number; height: number }[] = [];
    const page = {
      setDefaultTimeout: () => {},
      setViewport: async (v: { width: number; height: number }) => viewports.push(v),
      evaluate: async () => {},
      screenshot: async (o: { clip?: { width: number; height: number } }) => {
        const size = o.clip ?? viewports.at(-1)!;
        return sharp({ create: { width: size.width, height: size.height, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } }).png().toBuffer();
      },
      close: async () => {}
    };
    const puppeteer = await import('puppeteer-core');
    vi.spyOn(puppeteer.default, 'launch').mockResolvedValue({ connected: true, newPage: async () => page } as never);
    vi.stubEnv('CHROMIUM_PATH', '/Applications/Chrome');
    const { chromiumExport } = await import('./chromium-frames');

    const opened = await chromiumExport.open({ width: 2542, height: 10628, scale: 1 });
    const bytes = await opened.shot('image/png', undefined, null);
    const { width, height } = await sharp(bytes).metadata();
    const bottom = await sharp(bytes).extract({ left: 0, top: 10600, width: 1, height: 1 }).raw().toBuffer();

    expect(Math.max(...viewports.map((v) => v.height))).toBeLessThanOrEqual(2048);
    expect({ width, height }).toEqual({ width: 2542, height: 10628 });
    expect([...bottom]).toEqual([0, 0, 255, 255]);
    vi.unstubAllEnvs();
  });
});
