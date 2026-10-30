import { describe, expect, it } from 'vitest';
import { Direction, Sizing } from '../layout/auto-layout';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM } from '../layout/model';
import type { MotionDoc } from '../doc';
import { addBreakpoint, BASE_BREAKPOINT, BreakpointPreset, clearOverride, inView, liftEdit, mediaQueries, overriddenIn, overridesAt, OverrideKey, removeBreakpoint, resolveAt, setOverride, stackOn, viewsOf } from './model';

const clip = (id: string, extra: Record<string, unknown> = {}) => ({ id, from: 0, durationInFrames: 30, component: 'Text', props: { text: id, size: 0.04, align: 'left' }, ...extra });

const landing = (): MotionDoc =>
  ({
    version: 1,
    fps: 30,
    width: 1440,
    height: 900,
    durationInFrames: 30,
    tracks: [{ id: 't', kind: 'visual', name: '', clips: [clip('row', { component: 'Shape', autoLayout: { ...DEFAULT_AUTO_LAYOUT, direction: Direction.Horizontal, gap: 32 } }), clip('title', { parent: 'row', layoutItem: { ...DEFAULT_LAYOUT_ITEM } })] }]
  }) as unknown as MotionDoc;

const ok = <T>(r: { ok: true; doc: T } | { ok: false; error: string }): T => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const withViews = () => {
  const tablet = ok(addBreakpoint(landing(), BreakpointPreset.Tablet, 'tab'));
  return ok(addBreakpoint(tablet, BreakpointPreset.Phone, 'ph'));
};

const clipOf = (doc: MotionDoc, id: string) => doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!;
const textPx = (doc: MotionDoc, id: string) => Number(clipOf(doc, id).props.size) * Math.min(doc.width, doc.height);

describe('breakpoints', () => {
  it('a new breakpoint inherits everything and only changes the width', () => {
    const doc = withViews();
    const phone = resolveAt(doc, 'ph');

    expect(phone.width).toBe(390);
    expect(clipOf(phone, 'row').autoLayout?.direction).toBe(Direction.Horizontal);
    expect(textPx(phone, 'title')).toBeCloseTo(36);
  });

  it('views are listed largest first, the base frame on top', () => {
    expect(viewsOf(withViews()).map((v) => [v.id, v.width])).toEqual([
      [BASE_BREAKPOINT, 1440],
      ['tab', 810],
      ['ph', 390]
    ]);
  });

  it('an override applies at its breakpoint and cascades down, not up', () => {
    const doc = ok(setOverride(withViews(), 'tab', 'row', OverrideKey.Direction, Direction.Vertical));

    expect(clipOf(resolveAt(doc, BASE_BREAKPOINT), 'row').autoLayout?.direction).toBe(Direction.Horizontal);
    expect(clipOf(resolveAt(doc, 'tab'), 'row').autoLayout?.direction).toBe(Direction.Vertical);
    expect(clipOf(resolveAt(doc, 'ph'), 'row').autoLayout?.direction).toBe(Direction.Vertical);
  });

  it('a smaller breakpoint overrides the larger one', () => {
    const tab = ok(setOverride(withViews(), 'tab', 'title', OverrideKey.FontSize, 0.06));
    const doc = ok(setOverride(tab, 'ph', 'title', OverrideKey.FontSize, 0.1));

    expect(textPx(resolveAt(doc, 'tab'), 'title')).toBeCloseTo(54);
    expect(textPx(resolveAt(doc, 'ph'), 'title')).toBeCloseTo(90);
  });

  it('removing an override inherits again from the next larger view', () => {
    const tab = ok(setOverride(withViews(), 'tab', 'title', OverrideKey.FontSize, 0.06));
    const set = ok(setOverride(tab, 'ph', 'title', OverrideKey.FontSize, 0.1));
    const doc = clearOverride(set, 'ph', 'title', OverrideKey.FontSize);

    expect(textPx(resolveAt(doc, 'ph'), 'title')).toBeCloseTo(54);
    expect(overriddenIn(doc, 'title', OverrideKey.FontSize)).toEqual(['tab']);
  });

  it('refuses a prop outside the whitelist and a value of the wrong shape', () => {
    expect(setOverride(withViews(), 'ph', 'title', 'props.text' as OverrideKey, 'x').ok).toBe(false);
    expect(setOverride(withViews(), 'ph', 'row', OverrideKey.Gap, 'wide').ok).toBe(false);
  });

  it('the base frame takes no overrides: its values are the clip itself', () => {
    expect(setOverride(withViews(), BASE_BREAKPOINT, 'row', OverrideKey.Gap, 8).ok).toBe(false);
  });

  it('a breakpoint is narrower than the frame and unique by width', () => {
    expect(addBreakpoint(landing(), { name: 'Wide', width: 1600 }, 'w').ok).toBe(false);
    expect(addBreakpoint(withViews(), { name: 'Twin', width: 810 }, 'tw').ok).toBe(false);
  });

  it('removing a breakpoint drops its overrides', () => {
    const doc = ok(setOverride(withViews(), 'ph', 'title', OverrideKey.Hidden, true));
    const removed = removeBreakpoint(doc, 'ph');

    expect(viewsOf(removed).map((v) => v.id)).toEqual([BASE_BREAKPOINT, 'tab']);
    expect(clipOf(removed, 'title').overrides).toBeUndefined();
  });

  it('stack on this breakpoint writes an explicit override, nothing hidden', () => {
    const doc = ok(stackOn(withViews(), 'ph', 'row'));

    expect(clipOf(doc, 'row').overrides).toEqual({ ph: { [OverrideKey.Direction]: Direction.Vertical } });
    expect(clipOf(doc, 'title').overrides).toEqual({ ph: { [OverrideKey.Width]: Sizing.Fill } });
  });

  it('exposes overrides largest-first as max-width media queries', () => {
    const tab = ok(setOverride(withViews(), 'tab', 'row', OverrideKey.Gap, 16));
    const doc = ok(setOverride(tab, 'ph', 'title', OverrideKey.Hidden, true));

    expect(mediaQueries(doc)).toEqual([
      { breakpointId: 'tab', maxWidth: 810, clips: { row: { [OverrideKey.Gap]: 16 } } },
      { breakpointId: 'ph', maxWidth: 390, clips: { title: { [OverrideKey.Hidden]: true } } }
    ]);
  });

  it('a resolved doc carries no breakpoints and no overrides', () => {
    const resolved = resolveAt(ok(setOverride(withViews(), 'ph', 'row', OverrideKey.Gap, 4)), 'ph');

    expect(resolved.breakpoints).toBeUndefined();
    expect(clipOf(resolved, 'row').overrides).toBeUndefined();
  });
});

describe('an edit made on a breakpoint view', () => {
  const edit = (doc: MotionDoc, bp: string, fn: (resolved: MotionDoc) => MotionDoc) => liftEdit(doc, bp, fn(resolveAt(doc, bp)));
  const patchClip = (doc: MotionDoc, id: string, patch: (c: MotionDoc['tracks'][number]['clips'][number]) => object): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch(c) } : c)) })) }) as MotionDoc;

  it('a whitelisted prop becomes an override for that view only', () => {
    const doc = edit(withViews(), 'tab', (r) => patchClip(r, 'title', (c) => ({ props: { ...c.props, size: 54 / 810 } })));

    expect(clipOf(doc, 'title').props.size).toBe(0.04);
    expect(Object.keys(clipOf(doc, 'title').overrides!.tab!)).toEqual([OverrideKey.FontSize]);
    expect(textPx(resolveAt(doc, 'tab'), 'title')).toBeCloseTo(54);
    expect(doc.width).toBe(1440);
    expect(viewsOf(doc)).toHaveLength(3);
  });

  it('a change that cannot vary per breakpoint leaves the base untouched', () => {
    const doc = edit(withViews(), 'ph', (r) => patchClip(r, 'title', (c) => ({ props: { ...c.props, text: 'New' } })));

    expect(clipOf(doc, 'title').props.text).toBe('title');
    expect(clipOf(doc, 'title').overrides).toBeUndefined();
  });

  it('an edit that leaves a value as inherited writes no override', () => {
    const tab = ok(setOverride(withViews(), 'tab', 'row', OverrideKey.Gap, 16));
    const doc = edit(tab, 'ph', (r) => patchClip(r, 'title', (c) => ({ props: { ...c.props, text: 'x' } })));

    expect(clipOf(doc, 'row').overrides).toEqual({ tab: { [OverrideKey.Gap]: 16 } });
  });

  it('on the base view an edit is the plain edit', () => {
    const after = patchClip(withViews(), 'row', (c) => ({ autoLayout: { ...c.autoLayout, gap: 4 } }));

    expect(liftEdit(withViews(), BASE_BREAKPOINT, after)).toBe(after);
  });
});

describe('what a view shows', () => {
  it('a view keeps text at its pixel size', () => {
    expect(textPx(resolveAt(withViews(), 'ph'), 'title')).toBeCloseTo(textPx(withViews(), 'title'));
  });

  it('an untouched round trip through a view writes nothing', () => {
    const doc = withViews();

    expect(liftEdit(doc, 'ph', resolveAt(doc, 'ph')).tracks).toEqual(doc.tracks);
  });

  it('the base view is the doc itself, breakpoints kept', () => {
    const doc = withViews();

    expect(inView(doc, BASE_BREAKPOINT)).toBe(doc);
    expect(inView(doc, 'ph').width).toBe(390);
  });

  it('lists the overrides a clip carries at one view', () => {
    const doc = ok(setOverride(withViews(), 'ph', 'title', OverrideKey.FontSize, 0.1));

    expect(overridesAt(doc, 'title', 'ph')).toEqual([OverrideKey.FontSize]);
    expect(overridesAt(doc, 'title', 'tab')).toEqual([]);
  });
});
