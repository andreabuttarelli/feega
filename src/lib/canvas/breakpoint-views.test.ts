import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { FrameKind } from '$lib/canvas/motion-node';
import { baseNodeId, heldViews, resolvedViewDoc, VIEW_GAP, viewAt, viewId, viewOf, withoutViews } from './breakpoint-views';

const doc = { width: 1440, height: 900, tracks: [], breakpoints: [{ id: 'ph', name: 'Phone', width: 390 }, { id: 'tab', name: 'Tablet', width: 810 }] } as unknown as MotionDoc;
const frame = { id: 'n1', kind: FrameKind.Frame, revision: 4, box: { x: 100, y: 50, w: 720, h: 450 } };

describe('breakpoint views on the canvas', () => {
  it('lays each breakpoint right of the frame, widest first, at the frame scale', () => {
    const views = heldViews()([frame], () => doc);

    expect(views.map((v) => [v.breakpointId, v.frame.box])).toEqual([
      ['tab', { x: 100 + 720 + VIEW_GAP, y: 50, w: 405, h: 450 }],
      ['ph', { x: 100 + 720 + VIEW_GAP + 405 + VIEW_GAP, y: 50, w: 195, h: 450 }]
    ]);
    expect(views[0].frame.revision).toBe(4);
  });

  it('lets go of a frame it was told to forget, so its views hold no doc', () => {
    const resolve = heldViews();
    const first = resolve([frame], () => doc);
    resolve.forget(frame.id);

    expect(resolve([frame], () => doc)).not.toBe(first);
    expect(resolve([frame], () => null)).toEqual([]);
  });

  it('a view is as tall as the page it shows at that width', () => {
    const page = landingDoc();
    const [tablet, phone] = heldViews()([{ ...frame, box: { x: 0, y: 0, w: 720, h: 2240 } }], () => page);

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

  it('moving a frame shifts its views without laying their pages out again', () => {
    const page = landingDoc();
    const views = heldViews();
    const [first] = views([frame], () => page);

    const [moved] = views([{ ...frame, box: { ...frame.box, x: 300 } }], () => page);

    expect(moved.doc).toBe(first.doc);
    expect(moved.frame.box.x).toBe(first.frame.box.x + 200);
  });

  it('a frame without breakpoints has no views', () => {
    expect(heldViews()([frame], () => ({ ...doc, breakpoints: undefined }) as MotionDoc)).toEqual([]);
    expect(heldViews()([frame], () => null)).toEqual([]);
  });

  it('a view id names its frame and breakpoint', () => {
    const [tab] = heldViews()([frame], () => doc);

    expect(viewOf(tab.frame.id)).toEqual({ nodeId: 'n1', breakpointId: 'tab' });
    expect(viewOf('n1')).toBeNull();
  });

  it('finds the view under a point', () => {
    const views = heldViews()([frame], () => doc);

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
    const views = heldViews()([frame], () => doc).map((v) => v.frame);

    expect(withoutViews([frame, ...views]).map((f) => f.id)).toEqual(['n1']);
  });
});

describe('breakpoint views resolved off the main thread', () => {
  const page = landingDoc();
  const big = { ...frame, box: { x: 0, y: 0, w: 720, h: 2240 } };
  const edited = (height: number): MotionDoc => ({ ...page, tracks: [...page.tracks] , height });

  type Ask = { doc: MotionDoc; ids: string[]; answer: (docs: MotionDoc[]) => void };

  const deferred = () => {
    const asks: Ask[] = [];
    let landed = 0;
    const resolve = heldViews({
      resolve: (doc, ids) => new Promise<MotionDoc[]>((answer) => asks.push({ doc, ids, answer })),
      landed: () => landed++
    });
    return { resolve, asks, landedCount: () => landed };
  };

  const answer = (ask: Ask) => ask.answer(ask.ids.map((id) => resolvedViewDoc(ask.doc, id)));
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('keeps showing the previous views while an edit is resolving', () => {
    const { resolve, asks } = deferred();
    const first = resolve([big], () => page);
    const second = resolve([big], () => edited(page.height + 10));

    expect(asks).toHaveLength(1);
    expect(second.map((v) => v.doc)).toEqual(first.map((v) => v.doc));
  });

  it('applies results in edit order and drops a stale one that lands late', async () => {
    const { resolve, asks, landedCount } = deferred();
    resolve([big], () => page);
    const one = edited(page.height + 10);
    const two = edited(page.height + 20);
    resolve([big], () => one);
    resolve([big], () => two);

    answer(asks[1]);
    await settle();
    answer(asks[0]);
    await settle();

    expect(landedCount()).toBe(1);
    expect(resolve([big], () => two).map((v) => v.doc)).toEqual(asks[1].ids.map((id) => resolvedViewDoc(two, id)));
  });

  it('shows the same views as resolving on the main thread', async () => {
    const { resolve, asks } = deferred();
    resolve([big], () => page);
    const one = edited(page.height + 10);
    resolve([big], () => one);
    answer(asks[0]);
    await settle();

    expect(resolve([big], () => one)).toEqual(heldViews()([big], () => one));
  });
});
