import { describe, expect, it } from 'vitest';
import { FrameKind } from '$lib/canvas/motion-node';
import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';
import { drawsWhole, framesOnCanvas, stillFrame } from './frame-source';

const tile = (id: string, kind = 'motion') => ({ id, kind, x: 10, y: 20, w: 300, h: 200 });

describe('frames on canvas', () => {
  it('a frame shows its doc in the stage above the bar, at its head revision', () => {
    const [f] = framesOnCanvas([tile('a')], () => ({ kind: FrameKind.Frame, docHeadRevision: 4 }));
    expect(f).toEqual({ id: 'a', revision: 4, box: { x: 10, y: 20, w: 300, h: 200 - MOTION_NODE_BAR_H } });
  });

  it('elements and groups have no bar', () => {
    const [f] = framesOnCanvas([tile('a')], () => ({ kind: FrameKind.Element, docHeadRevision: 1 }));
    expect(f.box.h).toBe(200);
  });

  it('skips non-motion tiles and frames with no saved doc yet', () => {
    expect(framesOnCanvas([tile('t', 'text'), tile('n')], () => ({ kind: FrameKind.Frame, docHeadRevision: 0 }))).toEqual([]);
  });
});

describe('handing a frame to the core', () => {
  const list = (gaps: number) => ({ width: 1, height: 1, background: null, items: [], unsupported: Array.from({ length: gaps }, () => ({ clip: 'c', component: 'Custom', reason: 'custom' })) }) as never;

  it('only a frame the core draws completely leaves its poster', () => {
    expect(drawsWhole(list(0))).toBe(true);
    expect(drawsWhole(list(2))).toBe(false);
  });
});

describe('still frame', () => {
  it('draws a resting frame at the same instant its poster was taken', () => {
    expect(stillFrame({ fps: 30, durationInFrames: 90 })).toBe(36);
  });
});
