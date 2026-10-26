import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { drawFrame, ItemKind, prepare, Unsupported, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { apply2d } from '@feega/motion-core/motion/affine';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const tilted = (transform: Record<string, number>) => {
  const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', fill: '#ff0000', x: 0.5, y: 0.5, width: 0.4, height: 0.4 } }, 'card'));
  doc.tracks.flatMap((t) => t.clips)[0].transform = transform as never;
  return doc;
};

const cornersOf = (item: Item) => {
  if (item.kind !== ItemKind.Path) {
    throw new Error(item.kind);
  }
  const points = item.contours.flatMap((c) => c.flatMap((_, i) => (i % 2 ? [] : [apply2d(item.matrix, [c[i], c[i + 1]])])));
  const top = Math.min(...points.map((p) => p[1]));
  const bottom = Math.max(...points.map((p) => p[1]));
  const widthAt = (y: number) => {
    const row = points.filter((p) => Math.abs(p[1] - y) < 1).map((p) => p[0]);
    return Math.max(...row) - Math.min(...row);
  };
  return { top: widthAt(top), bottom: widthAt(bottom), height: bottom - top };
};

describe('a clip turned in depth', () => {
  it('draws a card tilted back in perspective as a trapezoid, its far edge narrower', () => {
    const list = drawFrame(prepare(tilted({ rotateX: 30, perspective: 800 }), FEEGA_TOKENS), 0);
    const { top, bottom, height } = cornersOf(list.items[0]);

    expect(list.unsupported).toEqual([]);
    expect(top).toBeLessThan(bottom - 20);
    expect(height).toBeLessThan(1080 * 0.4);
  });

  it('refuses a clip turned behind the eye rather than drawing it inside out', () => {
    expect(drawFrame(prepare(tilted({ z: 2000, perspective: 800 }), FEEGA_TOKENS), 0).unsupported).toMatchObject([{ clip: 'card', reason: Unsupported.Space3d }]);
  });
});
