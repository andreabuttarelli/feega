import { describe, expect, it } from 'vitest';
import type { FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import { shapedText } from '@feega/motion-core/motion/gpu-full/text/measure';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxFace } from './test-face';

const UNIT = 1000;

function counted() {
  const seen = { asks: 0 };
  const fonts: FaceBook = () => ((seen.asks += 1), { face: boxFace, skew: 0 });
  return { seen, measure: shapedText({ fonts, smoothing: Smoothing.Plain }) };
}

const headline = { text: 'Design, prototype and ship', size: 0.05 };

describe('measuring shaped text for layout', () => {
  it('lays out the same text, style and width once while a frame is rebuilt', () => {
    const { seen, measure } = counted();

    const first = measure('Title', headline, UNIT, 400);
    const asked = seen.asks;
    const again = measure('Title', { ...headline }, UNIT, 400);

    expect(asked).toBeGreaterThan(0);
    expect(again).toEqual(first);
    expect(seen.asks).toBe(asked);
  });

  it('lays out again when the text, its style or the width it wraps in changes', () => {
    const { seen, measure } = counted();
    const base = measure('Title', headline, UNIT, 400);
    const asks = () => seen.asks;
    const before = [asks()];

    const longer = measure('Title', { ...headline, text: `${headline.text} from one canvas` }, UNIT, 400);
    before.push(asks());
    const bigger = measure('Title', { ...headline, size: 0.1 }, UNIT, 400);
    before.push(asks());
    const narrower = measure('Title', headline, UNIT, 100);
    before.push(asks());

    expect(longer.height).toBeGreaterThan(base.height);
    expect(bigger.height).toBeGreaterThan(base.height);
    expect(narrower.height).toBeGreaterThan(base.height);
    expect(new Set(before).size).toBe(before.length);
  });
});
