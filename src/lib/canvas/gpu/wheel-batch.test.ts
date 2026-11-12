import { describe, expect, it } from 'vitest';
import { WheelBatch } from './wheel-batch';
import { panBy, zoomAt } from './camera';

const start = { x: 10, y: -20, zoom: 0.5 };

describe('WheelBatch', () => {
  it('lands every wheel of a frame in one camera change, the same as applying them one by one', () => {
    const batch = new WheelBatch();
    batch.zoom({ x: 300, y: 200 }, 1.1);
    batch.pan({ x: -12, y: 4 });
    batch.zoom({ x: 310, y: 205 }, 0.95);

    expect(batch.take(start)).toEqual(zoomAt(panBy(zoomAt(start, { x: 300, y: 200 }, 1.1), { x: -12, y: 4 }), { x: 310, y: 205 }, 0.95));
  });

  it('has nothing to land once taken', () => {
    const batch = new WheelBatch();
    batch.pan({ x: 1, y: 1 });
    batch.take(start);

    expect(batch.pending()).toBe(false);
    expect(batch.take(start)).toEqual(start);
  });
});
