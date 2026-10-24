import { describe, expect, it } from 'vitest';
import { FillType, fillsSchema, type FillOf } from '$lib/motion/fill/model';
import { addClip } from '$lib/motion/timeline';
import { findClip, MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { withFill } from './gradient-handles';
import { Corner, MIN_WINDOW, appliedCrop, cornerZoom, imagePlacement, imageTarget, panned, windowOfFit, zoomedAt } from './crop-handles';

const box = { width: 200, height: 100 };
const wide = { width: 400, height: 100 };

const image = (raw: object = {}) => fillsSchema.parse([{ type: 'image', assetId: 'a', ...raw }])[0] as FillOf<FillType.Image>;

describe('where the crop window starts', () => {
  it('a cover fill starts as the window cover shows', () => {
    const win = windowOfFit(image({ fit: 'cover' }), box, wide);
    expect(win).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
  });

  it('a cover fill follows its focus', () => {
    expect(windowOfFit(image({ fit: 'cover', focus: { x: 0, y: 0.5 } }), box, wide).x).toBe(0);
  });

  it('a zoomed fill starts on the zoomed window', () => {
    const win = windowOfFit(image({ fit: 'cover', scale: 2 }), box, wide);
    expect(win.w).toBeCloseTo(0.25);
    expect(win.h).toBeCloseTo(0.5);
  });

  it('a stretched fill starts on the whole picture', () => {
    expect(windowOfFit(image({ fit: 'fill' }), box, wide)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('a fit or tile fill starts as cover would, the window never leaves the picture', () => {
    expect(windowOfFit(image({ fit: 'contain' }), box, wide)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
    expect(windowOfFit(image({ fit: 'tile' }), box, wide)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
  });

  it('an already cropped fill starts on its own window', () => {
    expect(windowOfFit(image({ fit: 'crop', crop: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }), box, wide)).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });
});

describe('the picture behind the box', () => {
  it('is the box stretched by the window', () => {
    expect(imagePlacement({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, box)).toEqual({ x: -100, y: -200, width: 400, height: 400 });
  });
});

describe('panning the picture', () => {
  it('dragging right moves the window left, by the picture pixels travelled', () => {
    const win = panned({ x: 0.25, y: 0, w: 0.5, h: 1 }, box, 50, 0);
    expect(win.x).toBeCloseTo(0.25 - 0.125);
  });

  it('stops at the picture edge', () => {
    expect(panned({ x: 0.25, y: 0, w: 0.5, h: 1 }, box, 10000, 0).x).toBe(0);
    expect(panned({ x: 0.25, y: 0, w: 0.5, h: 1 }, box, -10000, 0).x).toBe(0.5);
  });
});

describe('zooming the picture', () => {
  it('keeps the point under the anchor where it is', () => {
    const start = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    const anchor: [number, number] = [50, 25];
    const picturePoint = (w: { x: number; y: number; w: number; h: number }) => [w.x + (anchor[0] / box.width) * w.w, w.y + (anchor[1] / box.height) * w.h];
    const next = zoomedAt(start, box, anchor, 2);
    expect(next.w).toBeCloseTo(0.25);
    expect(next.h).toBeCloseTo(0.25);
    expect(picturePoint(next)[0]).toBeCloseTo(picturePoint(start)[0]);
    expect(picturePoint(next)[1]).toBeCloseTo(picturePoint(start)[1]);
  });

  it('cannot show more than the whole picture or less than a sliver', () => {
    expect(zoomedAt({ x: 0, y: 0, w: 1, h: 1 }, box, [0, 0], 0.5)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(zoomedAt({ x: 0, y: 0, w: 0.5, h: 0.5 }, box, [0, 0], 1e9).w).toBe(MIN_WINDOW);
  });

  it('dragging a corner away from the opposite one enlarges the picture, so the window shrinks', () => {
    const start = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const rect = imagePlacement(start, box);
    const corner: [number, number] = [rect.x + rect.width, rect.y + rect.height];
    const out = cornerZoom(start, box, Corner.BottomRight, [corner[0] + 100, corner[1] + 100]);
    const inward = cornerZoom(start, box, Corner.BottomRight, [corner[0] - 100, corner[1] - 100]);
    expect(out.w).toBeLessThan(start.w);
    expect(inward.w).toBeGreaterThan(start.w);
  });
});

describe('applying a window', () => {
  it('sets the fit to crop and keeps the rest of the fill', () => {
    const fill = image({ fit: 'cover', opacity: 0.5, adjust: { exposure: 0.2 } });
    expect(appliedCrop(fill, { x: 0.1, y: 0.1, w: 0.5, h: 0.5 })).toMatchObject({ fit: 'crop', opacity: 0.5, adjust: { exposure: 0.2 }, crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } });
  });
});

describe('the image an element shows crop handles for', () => {
  const docWith = (component: 'Shape' | 'Text', props: Record<string, unknown>) => {
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component, from: 0, durationInFrames: 30, props }, 'c');
    if (!added.ok) {
      throw new Error(added.error);
    }
    return added.doc;
  };
  const solid = { type: 'solid', color: '#000000' };

  it('is its top visible image fill, and a crop writes it back in place', () => {
    const doc = docWith('Shape', { shape: 'rect', fills: [{ type: 'image', assetId: 'a' }, solid] });
    const target = imageTarget(doc, 'c')!;
    expect(target.index).toBe(0);
    const written = withFill(doc, 'c', target.index, appliedCrop(target.fill, { x: 0, y: 0, w: 0.5, h: 0.5 }));
    const stored = written.ok ? (findClip(written.doc, 'c')!.clip.props.fills as { fit: string }[]) : [];
    expect(stored[0].fit).toBe('crop');
    expect(stored[1]).toMatchObject({ type: FillType.Solid });
  });

  it('skips a hidden image and an element with none', () => {
    expect(imageTarget(docWith('Shape', { shape: 'rect', fills: [{ type: 'image', assetId: 'a', visible: false }] }), 'c')).toBeNull();
    expect(imageTarget(docWith('Shape', { shape: 'rect', fills: [solid] }), 'c')).toBeNull();
  });

  it('is nothing for text, whose double click types', () => {
    expect(imageTarget(docWith('Text', { text: 'hi', fills: [{ type: 'image', assetId: 'a' }] }), 'c')).toBeNull();
  });
});
