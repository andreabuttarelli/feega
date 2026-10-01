import { describe, expect, it } from 'vitest';
import { PLACEMENT_GAP, placeBeside, type Rect } from './placement';

const text: Rect = { x: 0, y: 0, w: 360, h: 220 };
const size = { w: 360, h: 460 };

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('a node born from another sits to its right, never on top', () => {
  it('right of the source, a gap away, tops aligned', () => {
    expect(placeBeside([text], size, [text])).toEqual({ x: 360 + PLACEMENT_GAP, y: 0 });
  });

  it('right of the rightmost of several sources', () => {
    const far = { x: 900, y: 300, w: 360, h: 460 };
    expect(placeBeside([text, far], size, [text, far]).x).toBe(900 + 360 + PLACEMENT_GAP);
  });

  it('steps down past whatever already occupies that spot', () => {
    const blocker = { x: 360 + PLACEMENT_GAP, y: 100, w: 360, h: 460 };
    const at = placeBeside([text], size, [text, blocker]);

    expect(at).toEqual({ x: blocker.x, y: blocker.y + blocker.h + PLACEMENT_GAP });
    expect(overlaps({ ...at, ...size }, blocker)).toBe(false);
  });
});
