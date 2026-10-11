import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import sharp from 'sharp';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, setProps, type OpResult } from '$lib/motion/timeline';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { addShader } from '$lib/motion/shaders/ops';
import { drawFrames, type BrowserPort } from './server-frames';
import { MOTION_LIBS_ROUTE } from '$lib/motion/libs/catalog';
import { libraryPath } from '../../../../scripts/motion-libs';

const LOAD_TIMEOUT_MS = 30_000;
const SIZE = 320;
const AT = [0.5];

type Stage = Window & { __player?: { renderSeek: (t: number) => void }; __playerReady?: boolean; __renderReady?: boolean };

let browser: Browser;

const port: BrowserPort = {
  open: async (viewport) => {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.scale });
    await page.route(`**${MOTION_LIBS_ROUTE}/**`, (route) => route.fulfill({ path: libraryPath(process.cwd(), new URL(route.request().url()).pathname), headers: { 'access-control-allow-origin': '*' } }));
    return {
      load: async (html) => {
        await page.setContent(html, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS });
        await page.waitForFunction(() => Boolean((window as Stage).__playerReady && (window as Stage).__renderReady), undefined, { timeout: LOAD_TIMEOUT_MS });
      },
      seek: async (seconds) => {
        await page.evaluate(async (t) => {
          (window as Stage).__player?.renderSeek(t);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        }, seconds);
      },
      jpeg: async () => Buffer.from(await page.screenshot({ type: 'png' })),
      close: () => page.close()
    };
  }
};

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const INVERT = {
  name: 'invert',
  version: 1,
  frag: 'vec4 effect(vec2 uv) { vec4 c = texture2D(u_src, uv); return vec4(mix(c.rgb, 1.0 - c.rgb, u_amount), c.a); }',
  params: [{ key: 'amount', label: 'Amount', kind: 'number' as const, min: 0, max: 1, step: 0.1, default: 1 }]
};

let assetUrl = '';

function picture(): MotionDoc {
  const doc = ok(addClip({ ...newMotionDoc(MotionFormat.Square), width: SIZE, height: SIZE, durationInFrames: 30 }, { component: 'Image', from: 0, durationInFrames: 30 }, 'pic'));
  return ok(setProps({ ...doc, assets: [{ id: 'a1', kind: 'image', name: 'grad' }] }, 'pic', { assetId: 'a1' }));
}

const frames = (doc: MotionDoc) => drawFrames(port, { compose: { doc, tokens: FEEGA_TOKENS, assets: { a1: assetUrl } }, times: AT, size: SIZE });

beforeAll(async () => {
  browser = await chromium.launch();
  const png = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 230, g: 120, b: 40 } } }).png().toBuffer();
  assetUrl = `data:image/png;base64,${png.toString('base64')}`;
});

afterAll(async () => {
  await browser?.close();
});

describe('a custom effect in server frames', () => {
  it('the server frame of a clip with a custom effect differs from the plain one', async () => {
    const plain = await frames(picture());
    const shaded = await frames(ok(addShader(picture(), 'pic', 'fx1', { ref: 'eff-1', snapshot: INVERT })));

    expect(shaded[0].bytes.equals(plain[0].bytes)).toBe(false);
  }, 60_000);

  it('the same effect at the same time draws identical bytes', async () => {
    const doc = ok(addShader(picture(), 'pic', 'fx1', { ref: 'eff-1', snapshot: INVERT }));

    const [a] = await frames(doc);
    const [b] = await frames(doc);

    expect(a.bytes.equals(b.bytes)).toBe(true);
  }, 60_000);
});
