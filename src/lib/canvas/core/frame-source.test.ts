import { describe, expect, it } from 'vitest';
import { FrameKind } from '$lib/canvas/motion-node';
import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';
import { drawsWhole, framesOnCanvas, onStage, stillFrame } from './frame-source';

const tile = (id: string, kind = 'motion') => ({ id, kind, x: 10, y: 20, w: 300, h: 200 });

describe('frames on canvas', () => {
  it('a frame shows its doc in the stage above the bar, at its head revision', () => {
    const [f] = framesOnCanvas([tile('a')], () => ({ kind: FrameKind.Frame, docHeadRevision: 4 }));
    expect(f).toEqual({ id: 'a', kind: FrameKind.Frame, revision: 4, box: { x: 10, y: 20, w: 300, h: 200 - MOTION_NODE_BAR_H } });
  });

  it('a rotated tile turns its frame about the tile centre', () => {
    const [f] = framesOnCanvas([{ ...tile('a'), rotation: 20 }], () => ({ kind: FrameKind.Element, docHeadRevision: 1 }));
    expect(f.turn).toEqual({ degrees: 20, about: { x: 160, y: 120 } });
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
  const list = (gaps: number, items: unknown[] = [{ kind: 'path', clip: 'p' }]) => ({ width: 1, height: 1, background: null, items, unsupported: Array.from({ length: gaps }, () => ({ clip: 'c', component: 'Custom', reason: 'custom' })) }) as never;

  it('only a frame the core draws completely leaves its poster', () => {
    expect(drawsWhole(list(0))).toBe(true);
    expect(drawsWhole(list(2))).toBe(false);
  });

  it('leaves the poster to a frame whose still draws nothing, rather than paint its bare background over it', () => {
    expect(drawsWhole(list(0, []))).toBe(false);
  });
});

describe('still frame', () => {
  it('draws a resting frame at the same instant its poster was taken', () => {
    expect(stillFrame({ fps: 30, durationInFrames: 90 })).toBe(36);
  });

  it('a still doc rests on its own still frame', () => {
    expect(stillFrame({ fps: 30, durationInFrames: 60, still: { frame: 0 } })).toBe(0);
  });
});

describe('a transparent doc on the canvas', () => {
  const list = (background: [number, number, number, number] | null) => ({ width: 1, height: 1, background, items: [], unsupported: [] });

  it('a frame shows it on the black stage, as its card always has', () => {
    expect(onStage(list(null), FrameKind.Frame).background).toEqual([0, 0, 0, 1]);
  });

  it('elements and groups stay see-through, and an opaque doc keeps its own colour', () => {
    expect(onStage(list(null), FrameKind.Element).background).toBeNull();
    expect(onStage(list([1, 0, 0, 1]), FrameKind.Frame).background).toEqual([1, 0, 0, 1]);
  });
});
