import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { drawFrame, ItemKind, prepare, Unsupported, type ImageItem } from './display-list';
import { imageRect } from './image-rect';
import { createMedia, Readiness } from './media';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const blank = newMotionDoc(MotionFormat.Landscape);
const assets = { pic: 'https://cdn.test/pic.png', clip: 'https://cdn.test/clip.mp4' };
const prepared = (doc: MotionDoc, tokens = FEEGA_TOKENS) => prepare(doc, tokens, assets);
const imageOf = (doc: MotionDoc, frame = 0, tokens = FEEGA_TOKENS) => drawFrame(prepared(doc, tokens), frame).items.find((i): i is ImageItem => i.kind === ItemKind.Image);

describe('image items', () => {
  it('draws a picture in its box with its framing', () => {
    const doc = must(addClip(blank, { component: 'Image', from: 0, durationInFrames: 30, props: { assetId: 'pic', x: 0.5, y: 0.5, width: 0.5, height: 0.5, focusX: 0.2, zoom: 2 } }, 'img'));

    expect(imageOf(doc)).toMatchObject({ src: assets.pic, size: { width: 960, height: 540 }, fit: 'cover', focus: [0.2, 0.5], zoom: 2, clipped: true, matrix: [1, 0, 0, 1, 480, 270] });
  });

  it('plays a video at the source time its clip maps the frame to', () => {
    const added = must(addClip(blank, { component: 'Video', from: 30, durationInFrames: 60, props: { assetId: 'clip', speed: 2 } }, 'vid'));
    const doc = { ...added, tracks: added.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, trimStart: 15 })) })) };

    expect(imageOf(doc, 60)).toMatchObject({ src: assets.clip, video: true, mediaTime: expect.closeTo(0.5 + 2, 5) });
  });

  it('draws the brand logo whole when a Logo clip names no picture', () => {
    const doc = must(addClip(blank, { component: 'Logo', from: 0, durationInFrames: 30 }, 'logo'));

    expect(imageOf(doc, 0, { ...FEEGA_TOKENS, logoUrl: 'https://cdn.test/logo.svg' })).toMatchObject({ src: 'https://cdn.test/logo.svg', fit: 'width', clipped: false });
  });

  it('names a logo with no picture at all, which the HTML engine sets as text', () => {
    const doc = must(addClip(blank, { component: 'Logo', from: 0, durationInFrames: 30 }, 'logo'));

    expect(drawFrame(prepared(doc), 0).unsupported).toContainEqual({ clip: 'logo', component: 'Logo', reason: Unsupported.Text });
  });
});

describe('createMedia', () => {
  const picture = (src: string): ImageItem => ({ kind: ItemKind.Image, clip: src, src, video: false }) as ImageItem;
  const list = (...srcs: string[]) => ({ width: 10, height: 10, background: null, items: srcs.map(picture), unsupported: [] });

  afterEach(() => vi.unstubAllGlobals());

  it('says a list is partial when one of its pictures never loads, so its caller can keep what it shows', async () => {
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        naturalWidth = 4;
        naturalHeight = 4;
        decode = () => (this.src.includes('gone') ? Promise.reject(new Error('404')) : Promise.resolve());
      }
    );
    const media = createMedia();

    expect(await media.ready(list('/ok.png'))).toBe(Readiness.Whole);
    expect(await media.ready(list('/ok.png', '/gone.png'))).toBe(Readiness.Partial);
  });
});

describe('imageRect', () => {
  const box = { width: 200, height: 100 };

  it('covers the box, pushed toward the focus', () => {
    expect(imageRect(box, { width: 100, height: 100 }, 'cover', [0, 0], 1)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(imageRect(box, { width: 100, height: 100 }, 'cover', [0.5, 1], 1)).toEqual({ x: 0, y: -100, width: 200, height: 200 });
  });

  it('fits inside the box when contained', () => {
    expect(imageRect(box, { width: 100, height: 100 }, 'contain', [0.5, 0.5], 1)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
  });

  it('spans the box width at the picture aspect, centred, as the HTML logo does', () => {
    expect(imageRect({ width: 100, height: 200 }, { width: 100, height: 100 }, 'width', [0.5, 0.5], 1)).toEqual({ x: 0, y: 50, width: 100, height: 100 });
  });

  it('zooms around the focus point', () => {
    expect(imageRect(box, { width: 200, height: 100 }, 'cover', [0, 0], 2)).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    expect(imageRect(box, { width: 200, height: 100 }, 'cover', [1, 1], 2)).toEqual({ x: -200, y: -100, width: 400, height: 200 });
  });
});
