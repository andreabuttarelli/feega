import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromiumPage } from '$lib/server/motion/chromium-frames';
import { localBrowser } from '$lib/server/web/browser';
import { Scheme } from '$lib/server/web/colour-scheme';

const APP = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
:root{--bg:#ffffff}
.dark{--bg:#101010}
html,body{margin:0}
body{background:var(--bg)}
.row{display:flex}
.box{width:100px;height:100px;background:#0000ff}
.media{width:50px;height:50px;background:#00ff00}
@media (prefers-color-scheme: dark){.media{background:#ff00ff}}
@media (max-width:500px){.row{flex-direction:column}}
</style><script>
const stored = localStorage.getItem('theme');
const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.classList.toggle('dark', dark);
</script></head><body><div class="row"><div class="box"></div><div class="box"></div></div><div class="media"></div></body></html>`;

const SAMPLES = { page: [300, 300], secondBox: [150, 50], media: [20, 120] } as const;
const TOLERANCE = 8;
const channels = (v: string) => [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));

function expectPixels(actual: Record<string, number[]>, expected: Record<string, string>): void {
  for (const [name, want] of Object.entries(expected)) {
    channels(want).forEach((c, i) => expect(Math.abs(actual[name][i] - c), `${name} channel ${i}`).toBeLessThanOrEqual(TOLERANCE));
  }
}

let url = '';
let close = () => undefined as unknown;

beforeAll(async () => {
  if (!process.env.CHROMIUM_PATH) {
    return;
  }
  const server = createServer((_, res) => res.setHeader('content-type', 'text/html').end(APP));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  close = () => server.close();
});

afterAll(() => close());

async function pixels(scheme: Scheme, width: number): Promise<Record<keyof typeof SAMPLES, number[]>> {
  const tab = await localBrowser(chromiumPage, new URL(url).origin)();
  try {
    await tab.scheme(scheme);
    await tab.viewport(width);
    await tab.goto(url);
    const raw = await sharp(await tab.shot()).raw().toBuffer({ resolveWithObject: true });
    const at = ([x, y]: readonly [number, number]) => [...raw.data.subarray((y * raw.info.width + x) * raw.info.channels, (y * raw.info.width + x) * raw.info.channels + 3)];
    return { page: at(SAMPLES.page), secondBox: at(SAMPLES.secondBox), media: at(SAMPLES.media) };
  } finally {
    await tab.close();
  }
}

describe.skipIf(!process.env.CHROMIUM_PATH)('render conditions in a real browser', () => {
  it('chiaro a desktop: sfondo bianco, le due scatole in riga, media query chiara', async () => {
    expectPixels(await pixels(Scheme.Light, 1280), { page: 'ffffff', secondBox: '0000ff', media: '00ff00' });
  });

  it('dark a desktop: la classe, la variabile e la media query seguono', async () => {
    expectPixels(await pixels(Scheme.Dark, 1280), { page: '101010', secondBox: '0000ff', media: 'ff00ff' });
  });

  it('chiaro a telefono: la seconda scatola va sotto la prima', async () => {
    expectPixels(await pixels(Scheme.Light, 390), { page: 'ffffff', secondBox: 'ffffff' });
  });
});
