import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { createComponent } from '$lib/motion/main-component';
import { Tone, fitInTile, inkBounds, padded, toneOf, previewCache, previewDoc, previewKey, previewSide, shownBox } from './component-preview';
import { Device } from './gpu/memory-budget';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `p${++n}`;

function frameWithCard() {
  const card = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', width: 0.2, height: 0.1, fill: '#ff0000' } }, 'card'));
  const both = must(addClip(card, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', width: 0.9, height: 0.9, fill: '#00ff00' } }, 'backdrop'));
  const doc = must(createComponent(both, ['card'], newId, 'Card'));
  const instance = doc.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.component === 'Precomp')!;
  return { doc, compId: String(instance.props.comp) };
}

const tokens = FEEGA_TOKENS;

describe('the preview of a component', () => {
  it('draws the component alone, not the frame that holds it', () => {
    const { doc, compId } = frameWithCard();

    const clips = drawFrame(prepare(previewDoc(doc, compId), tokens), 0).items.map((i) => i.clip);

    expect(clips.length).toBeGreaterThan(0);
    expect(clips.some((c) => c.includes('backdrop'))).toBe(false);
  });

  it('paints no frame background behind the component', () => {
    const { doc, compId } = frameWithCard();

    expect(drawFrame(prepare(previewDoc(doc, compId), tokens), 0).background).toBeNull();
  });

  it('is cropped to what the component paints, smaller than the frame', () => {
    const { doc, compId } = frameWithCard();
    const alone = previewDoc(doc, compId);

    const box = shownBox(drawFrame(prepare(alone, tokens), 0), {})!;

    expect(box.width).toBeLessThan(alone.width / 2);
    expect(box.height).toBeLessThan(alone.height / 2);
  });

  it('fits the crop inside a square tile, keeping its proportions', () => {
    const fit = fitInTile({ left: 100, top: 50, width: 400, height: 200 }, 100);

    expect(fit.scale).toBeCloseTo(0.25);
    expect(fit.width).toBe(100);
    expect(fit.height).toBe(50);
  });

  it('is cached until the frame holding the main changes', () => {
    expect(previewKey('cmp', 3)).not.toBe(previewKey('cmp', 4));
    expect(previewKey('cmp', 3)).toBe(previewKey('cmp', 3));
  });

  it('is drawn no sharper than the device budget allows', () => {
    expect(previewSide(Device.Desktop, 1)).toBeLessThan(previewSide(Device.Desktop, 2));
    expect(previewSide(Device.Desktop, 3)).toBe(previewSide(Device.Desktop, 2));
  });
});

describe('the preview cache', () => {
  const bitmap = (side: number) => ({
    width: side,
    height: side,
    closed: false,
    close() {
      this.closed = true;
    }
  });

  it('drops the least recently seen preview once the budget is spent, and frees it', () => {
    const cache = previewCache(2 * 10 * 10 * 4);
    const [a, b, c] = [bitmap(10), bitmap(10), bitmap(10)];

    cache.put('a', a);
    cache.put('b', b);
    cache.get('a');
    cache.put('c', c);

    expect(cache.get('b')).toBeUndefined();
    expect(b.closed).toBe(true);
    expect(cache.get('a')).toBe(a);
    expect(cache.get('c')).toBe(c);
  });
});

const pixels = (width: number, height: number, ink: { x: number; y: number; rgba: number[] }[]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const { x, y, rgba } of ink) {
    data.set(rgba, (y * width + x) * 4);
  }
  return data;
};

const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];

describe('the ink of a preview', () => {
  it('is cropped to the painted pixels, not the text box around them', () => {
    const data = pixels(10, 10, [
      { x: 3, y: 4, rgba: WHITE },
      { x: 6, y: 5, rgba: WHITE }
    ]);

    expect(inkBounds(data, 10, 10)).toEqual({ left: 3, top: 4, width: 4, height: 2 });
  });

  it('finds nothing in an empty preview', () => {
    expect(inkBounds(pixels(4, 4, []), 4, 4)).toBeNull();
  });

  it('gets breathing room around the ink', () => {
    expect(padded({ left: 10, top: 10, width: 100, height: 20 }, 0.1)).toEqual({ left: 0, top: 0, width: 120, height: 40 });
  });

  it('sits on a dark tile when it is light, and on a light tile when it is dark', () => {
    expect(toneOf(pixels(2, 1, [{ x: 0, y: 0, rgba: WHITE }]))).toBe(Tone.Dark);
    expect(toneOf(pixels(2, 1, [{ x: 0, y: 0, rgba: BLACK }]))).toBe(Tone.Light);
  });
});
