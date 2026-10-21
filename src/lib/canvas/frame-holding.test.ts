import { describe, expect, it } from 'vitest';
import { frameHolding } from './frame-holding';
import { FrameKind, newMotionData } from './motion-node';

const tile = (id: string, kind: FrameKind, x: number, y: number, w: number, h: number) => ({ id, type: 'motion', data: { ...newMotionData(), kind }, x, y, w, h });

const BOX = { left: 100, top: 100, width: 40, height: 20 };

describe('frameHolding', () => {
  it('a box drawn on bare canvas has no frame', () => {
    expect(frameHolding([tile('f', FrameKind.Frame, 500, 500, 400, 300)], BOX)).toBeNull();
  });

  it('a box whose centre is inside a frame lands in it, as a fraction of the frame', () => {
    expect(frameHolding([tile('f', FrameKind.Frame, 0, 0, 400, 200)], BOX)).toEqual({ nodeId: 'f', at: { x: 0.3, y: 0.55 } });
  });

  it('the frame drawn last wins when frames overlap', () => {
    const found = frameHolding([tile('under', FrameKind.Frame, 0, 0, 400, 200), tile('over', FrameKind.Frame, 50, 50, 400, 200)], BOX);
    expect(found?.nodeId).toBe('over');
  });

  it('a free element never takes drops', () => {
    expect(frameHolding([tile('e', FrameKind.Element, 0, 0, 400, 200)], BOX)).toBeNull();
  });

  it('a node that is not a frame is ignored', () => {
    expect(frameHolding([{ id: 't', type: 'text', data: {}, x: 0, y: 0, w: 400, h: 200 }], BOX)).toBeNull();
  });
});
