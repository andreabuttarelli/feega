import { readFileSync } from 'node:fs';
import { create } from 'fontkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocKit, box } from '@feega/motion-core/motion/codegen/fixtures/kit';
import { Align, Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { estimatedText } from '@feega/motion-core/motion/layout/text-extent';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '@feega/motion-core/motion/doc';
import { setStill } from '@feega/motion-core/motion/still';
import { ImageFormat, ImageScale, stillExport } from '@feega/motion-core/motion/still-model';
import { fakeDb } from '$lib/server/db/fake-db';
import { drawStill, exportStill } from './still-export';
import type { StillPort, Viewport } from './server-frames';

const TOKENS = { name: 'feega', colors: {}, fonts: {} } as never;

function fakePort() {
  const loaded: string[] = [];
  const opened: Viewport[] = [];
  const seeks: number[] = [];
  const pictures: { mime: string; quality?: number }[] = [];
  const port: StillPort = {
    open: async (viewport) => {
      opened.push(viewport);
      return {
        load: async (html: string) => {
          loaded.push(html);
        },
        seek: async (s) => {
          seeks.push(s);
        },
        jpeg: async () => Buffer.from('jpeg'),
        picture: async (mime, quality) => {
          pictures.push({ mime, quality });
          return Buffer.from('picture');
        },
        close: vi.fn(async () => {})
      };
    }
  };
  return { port, opened, seeks, pictures, loaded };
}

describe('exportStill', () => {
  it('a renderer that dies answers an error the caller can show, not a 500', async () => {
    vi.stubEnv('CHROMIUM_PATH', '/chrome');
    const port: StillPort = { open: async () => Promise.reject(new Error('Session closed')) };

    const made = await exportStill(fakeDb({ orgs: [] }, { filter: true }).db, { orgId: 'o', projectId: 'p', nodeId: 'n' }, newMotionDoc(MotionFormat.Square), stillExport(ImageFormat.Png, ImageScale.One, 1), { tokens: TOKENS, assets: [] }, port);

    expect(made).toEqual({ ok: false, error: expect.stringContaining('Session closed') });
    vi.unstubAllEnvs();
  });
});

describe('drawStill', () => {
  it('draws the still frame at the full size of the doc times the scale, in the format asked', async () => {
    const pinned = setStill(newMotionDoc(MotionFormat.Portrait), 2);
    const doc = pinned.ok ? pinned.doc : newMotionDoc(MotionFormat.Portrait);
    const { port, opened, seeks, pictures } = fakePort();

    const bytes = await drawStill(port, { doc, tokens: TOKENS, assets: {} }, stillExport(ImageFormat.Png, ImageScale.Two, 1));

    expect(bytes.toString()).toBe('picture');
    expect(opened).toEqual([{ width: 1080, height: 1350, scale: 2 }]);
    expect(seeks).toEqual([2]);
    expect(pictures).toEqual([{ mime: 'image/png', quality: undefined }]);
  });

  it('a video draws its first frame, a lossy format carries its quality', async () => {
    const { port, seeks, pictures } = fakePort();

    await drawStill(port, { doc: newMotionDoc(MotionFormat.Square), tokens: TOKENS, assets: {} }, stillExport(ImageFormat.Jpg, ImageScale.One, 1));

    expect(seeks).toEqual([0]);
    expect(pictures[0]).toMatchObject({ mime: 'image/jpeg', quality: expect.any(Number) });
  });
});

const INTER_500 = readFileSync('landing/static/site/fonts/inter-500-latin.woff2');
const INTER_URL = 'https://fonts.test/inter-500.woff2';
const HEADLINE = 'Ship the release notes';
const HEADLINE_PX = 64;

function servedFonts() {
  const css = `@font-face{font-family:'Inter';font-style:normal;font-weight:500;src:url(${INTER_URL}) format('woff2');}`;
  vi.stubGlobal('fetch', async (url: string) => (url === INTER_URL ? new Response(INTER_500) : new Response(String(url).includes('family=Inter') ? css : '')));
}

function hugged() {
  const kit = new DocKit(1280, 720);
  kit.frame('page', { name: 'Page', box: box(0, 0, 1280, 720), layout: { direction: Direction.Vertical, align: Align.Center } });
  kit.text('headline', HEADLINE, { parent: 'page', name: 'Headline', size: HEADLINE_PX, weight: 500, font: 'Inter', leading: 1.1 });
  const parsed = parseMotionDoc(kit.doc());
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.doc;
}

const placedWidth = (html: string, id: string) => Number(new RegExp(`data-placed-width="([\\d.]+)"[^>]*><div class="mv" id="mv-${id}"`).exec(html)?.[1]);

describe('drawStill text layout', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lays a hugged line out at the width its font shapes it, as the canvas does, not at the estimate', async () => {
    servedFonts();
    const doc = hugged();
    const { port, loaded } = fakePort();
    const font = create(INTER_500) as unknown as { unitsPerEm: number; layout: (t: string) => { advanceWidth: number } };
    const shaped = (font.layout(HEADLINE).advanceWidth / font.unitsPerEm) * HEADLINE_PX;
    const headline = doc.tracks[0].clips.find((c) => c.id === 'headline')!;
    const estimate = estimatedText('Text', headline.props, 720).width;

    await drawStill(port, { doc, tokens: TOKENS, assets: {} }, stillExport(ImageFormat.Png, ImageScale.One, 1));

    expect(Math.abs(shaped - estimate)).toBeGreaterThan(5);
    expect(placedWidth(loaded[0], 'headline')).toBeCloseTo(shaped, 0);
  });
});
