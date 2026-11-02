import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip } from '../timeline';
import { ItemKind, drawFrame, prepare } from './display-list';

const PHOTO = 'photo-1';
const URLS = { [PHOTO]: 'https://example.com/photo.png' };
const PICTURE = { assetId: PHOTO, x: 0.5, y: 0.5, width: 0.4, height: 0.3 };

function framed(props: object): MotionDoc {
  const added = addClip({ ...newMotionDoc(MotionFormat.Square), durationInFrames: 30 }, { component: 'Image', from: 0, durationInFrames: 30, props: { ...PICTURE, ...props } }, 'img');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const itemsOf = (doc: MotionDoc) => drawFrame(prepare(doc, FEEGA_TOKENS, URLS), 0).items.filter((i) => i.clip === 'img');

describe('an image layer dressed like a rectangle', () => {
  it('a plain picture still draws as one image', () => {
    const items = itemsOf(framed({}));
    expect(items.map((i) => i.kind)).toEqual([ItemKind.Image]);
  });

  it('a corner radius cuts the picture to a rounded rectangle', () => {
    const [picture] = itemsOf(framed({ roundness: 0.1 }));
    expect(picture.kind).toBe(ItemKind.Image);
    expect(picture.matte?.items.length).toBeGreaterThan(0);
  });

  it('a stroke draws around the picture', () => {
    const items = itemsOf(framed({ strokes: [{ paint: { type: 'solid', color: '#000000' }, width: 0.01 }] }));
    expect(items.map((i) => i.kind)).toEqual([ItemKind.Image, ItemKind.Path]);
  });

  it('a fill sits over the picture', () => {
    const items = itemsOf(framed({ fills: [{ type: 'solid', color: '#ff0000', opacity: 0.5 }] }));
    expect(items.map((i) => i.kind)).toEqual([ItemKind.Image, ItemKind.Path]);
  });
});
