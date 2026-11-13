import { describe, expect, it } from 'vitest';
import { placedShots, shotsOf } from './view-shots';

const base = { id: 'n', kind: 'frame', revision: 3, box: { x: 100, y: 50, w: 1280, h: 9000 } };

describe('breakpoint views kept as snapshots', () => {
  it('a view keeps its place beside its frame when the frame moves or is resized', () => {
    const views = [{ frame: { id: 'n@bp:tab', box: { x: 1460, y: 50, w: 768, h: 9500 } } }];
    const shots = shotsOf(base.box, views);
    const moved = { ...base, box: { x: 0, y: 0, w: 640, h: 4500 } };

    expect(placedShots(base, shots)).toEqual([{ id: 'n@bp:tab', kind: 'frame', revision: 3, box: { x: 1460, y: 50, w: 768, h: 9500 } }]);
    expect(placedShots(moved, shots)[0].box).toEqual({ x: 680, y: 0, w: 384, h: 4750 });
  });
});
