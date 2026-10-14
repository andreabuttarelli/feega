import { describe, expect, it } from 'vitest';
import { frameNodeOf } from './motion-node';
import { isPendingFrame, pendingFrame } from './pending-frame';

describe('a frame shows on the canvas before its row is saved', () => {
  const poster = { width: 1080, height: 1350 };

  it('has the size the saved frame will have, where it was asked', () => {
    const shown = pendingFrame({ x: 10, y: 20 }, poster);
    const shaped = frameNodeOf(poster);

    expect(shown.position).toMatchObject({ x: 10, y: 20 });
    expect(shown.size).toEqual({ width: shaped.w, height: shaped.h });
    expect(isPendingFrame(shown.id)).toBe(true);
  });

  it('two at once never share an id, and a real node is never taken for one', () => {
    expect(pendingFrame({ x: 0, y: 0 }, poster).id).not.toBe(pendingFrame({ x: 0, y: 0 }, poster).id);
    expect(isPendingFrame('9858b4b6-f442-45eb-b76f-955c3aa6b336')).toBe(false);
  });
});
