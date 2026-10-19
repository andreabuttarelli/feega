import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { displayListAt, ItemKind, type LensItem } from './display-list';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const FPS_FRAME = 15;
const withBg = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 90 }, 'bg'));
const withBlob = must(addClip(withBg, { component: 'LiquidBlob', from: 0, durationInFrames: 90, props: { centerX: 0.25, centerY: 0.5, diameter: 0.4, tint: '#ff0000' } }, 'blob'));

describe('liquid blob', () => {
  it('draws as a lens over what is beneath it, posed at the frame', () => {
    const list = displayListAt(withBlob, FPS_FRAME, FEEGA_TOKENS);
    const lens = list.items.find((i): i is LensItem => i.kind === ItemKind.Lens)!;

    expect(list.unsupported).toEqual([]);
    expect(list.items.map((i) => i.kind)).toEqual([ItemKind.Path, ItemKind.Lens]);
    expect(lens.lens.center).toEqual([480, 540]);
    expect(lens.lens.drops.slice(0, 3)).toEqual([480, 540, 216]);
    expect(lens.lens.tint).toEqual([1, 0, 0]);
    expect(lens.lens.time).toBeCloseTo(FPS_FRAME / withBlob.fps);
  });
});
