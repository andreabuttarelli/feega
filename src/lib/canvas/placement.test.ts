import { describe, expect, it } from 'vitest';
import { PLACEMENT_GAP, placeBeside, placeNear, offCentre, type Rect } from './placement';

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

describe('a node added at the centre of the view lands on free canvas', () => {
  const centre = { x: 1000, y: 500 };

  it('centred on the view when nothing is there', () => {
    expect(placeNear(centre, size, [])).toEqual({ x: centre.x - size.w / 2, y: centre.y - size.h / 2 });
  });

  it('never on top of a node already at the centre, and two adds in a row never stack', () => {
    const there: Rect = { x: 800, y: 300, w: 400, h: 400 };
    const first = { ...placeNear(centre, size, [there]), ...size };
    const second = { ...placeNear(centre, size, [there, first]), ...size };

    expect(overlaps(first, there)).toBe(false);
    expect(overlaps(second, there)).toBe(false);
    expect(overlaps(second, first)).toBe(false);
  });
});

describe('a node pushed off the centre of the view is brought into sight', () => {
  const centre = { x: 1000, y: 500 };

  it('centred on the view, the view stays where it is', () => {
    expect(offCentre(centre, placeNear(centre, size, []), size)).toBe(false);
  });

  it('moved aside by what was there, the view follows it', () => {
    const there: Rect = { x: 800, y: 300, w: 400, h: 400 };
    expect(offCentre(centre, placeNear(centre, size, [there]), size)).toBe(true);
  });
});
