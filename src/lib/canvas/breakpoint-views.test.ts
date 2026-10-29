import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { FrameKind } from '$lib/canvas/motion-node';
import { baseNodeId, breakpointViews, heldViews, VIEW_GAP, viewAt, viewId, viewOf, withoutViews } from './breakpoint-views';

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

  it('a view is as tall as the page it shows at that width', () => {
    const page = landingDoc();
    const [tablet, phone] = breakpointViews([{ ...frame, box: { x: 0, y: 0, w: 720, h: 2240 } }], () => page);

    expect(phone.frame.box.h).toBeCloseTo(phone.doc.height / 2);
    expect(phone.doc.height).toBeGreaterThan(page.height);
    expect(tablet.doc.width).toBe(810);
  });

  it('resolves the views again only when the doc or the frame box changes', () => {
    const page = landingDoc();
    const views = heldViews();
    const [first] = views([frame], () => page);

    expect(views([{ ...frame }], () => page)[0]).toBe(first);
    expect(views([frame], () => ({ ...page }))[0]).not.toBe(first);
    expect(views([{ ...frame, box: { ...frame.box, x: 300 } }], () => page)[0]).not.toBe(first);
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

describe('a view tile id never reaches the network', () => {
  it('maps a view tile to the frame it derives from, and a frame to itself', () => {
    expect(baseNodeId(viewId('n1', 'ph'))).toBe('n1');
    expect(baseNodeId('n1')).toBe('n1');
  });

  it('keeps only saved frames among those loaded by url', () => {
    const views = breakpointViews([frame], () => doc).map((v) => v.frame);

    expect(withoutViews([frame, ...views]).map((f) => f.id)).toEqual(['n1']);
  });
});
