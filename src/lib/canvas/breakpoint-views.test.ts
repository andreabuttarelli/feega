import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { FrameKind } from '$lib/canvas/motion-node';
import { breakpointViews, VIEW_GAP, viewAt, viewOf } from './breakpoint-views';

const doc = { width: 1440, height: 900, tracks: [], breakpoints: [{ id: 'ph', name: 'Phone', width: 390 }, { id: 'tab', name: 'Tablet', width: 810 }] } as unknown as MotionDoc;
const frame = { id: 'n1', kind: FrameKind.Frame, revision: 4, box: { x: 100, y: 50, w: 720, h: 450 } };

describe('breakpoint views on the canvas', () => {
  it('lays each breakpoint right of the frame, widest first, at the frame scale', () => {
    const views = breakpointViews([frame], () => doc);

    expect(views.map((v) => [v.breakpointId, v.frame.box])).toEqual([
      ['tab', { x: 100 + 720 + VIEW_GAP, y: 50, w: 405, h: 450 }],
      ['ph', { x: 100 + 720 + VIEW_GAP + 405 + VIEW_GAP, y: 50, w: 195, h: 450 }]
    ]);
    expect(views[0].frame.revision).toBe(4);
  });

  it('a frame without breakpoints has no views', () => {
    expect(breakpointViews([frame], () => ({ ...doc, breakpoints: undefined }) as MotionDoc)).toEqual([]);
    expect(breakpointViews([frame], () => null)).toEqual([]);
  });

  it('a view id names its frame and breakpoint', () => {
    const [tab] = breakpointViews([frame], () => doc);

    expect(viewOf(tab.frame.id)).toEqual({ nodeId: 'n1', breakpointId: 'tab' });
    expect(viewOf('n1')).toBeNull();
  });

  it('finds the view under a point', () => {
    const views = breakpointViews([frame], () => doc);

    expect(viewAt(views, { x: 900, y: 100 })?.breakpointId).toBe('tab');
    expect(viewAt(views, { x: 300, y: 100 })).toBeNull();
  });
});
