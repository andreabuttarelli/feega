import { describe, expect, it } from 'vitest';
import { FrameBadge, SourceSync, frameHeaderIcons, headerBadges, headerHits, type FrameFacts } from './frame-header';
import { ChromePart, badgesKept, headerIconBoxes, tileChrome, type ChromeTile, type Glyphs } from './chrome';
import { CameraMotion } from './camera-motion';

const glyphs: Glyphs = (text, size) => ({ contours: [[0, 0, text.length * size, 0, text.length * size, size, 0, size]], width: text.length * size, height: size });

const ICON = [[0, 0, 12, 0, 12, 12, 0, 12]];

const facts = (over: Partial<FrameFacts> = {}): FrameFacts => ({ breakpoints: false, component: false, source: [], ...over });

const tile = (over: Partial<ChromeTile> = {}): ChromeTile => ({ id: 'f1', x: 100, y: 200, width: 300, height: 150, inputs: [], outputs: [], label: null, icon: null, ...over });

const right = (items: { contours: number[][] }[]) => Math.max(...items.flatMap((i) => i.contours.flatMap((c) => c.filter((_, j) => j % 2 === 0))));

const left = (items: { contours: number[][] }[]) => Math.min(...items.flatMap((i) => i.contours.flatMap((c) => c.filter((_, j) => j % 2 === 0))));

const partsOf = (t: ChromeTile, part: ChromePart) => tileChrome(t, glyphs).filter((i) => i.clip.startsWith(`${t.id}:${part}`));

const LONG = 'Checkout page on a very narrow phone frame';

describe('frame name truncation', () => {
  it.each([
    [40, 1],
    [120, 1],
    [300, 1],
    [120, 0.25],
    [300, 0.5],
    [300, 4]
  ])('keeps the name inside a %dpx frame at zoom %d', (width, zoom) => {
    const label = partsOf(tile({ label: LONG, width, zoom, perPx: 1 / zoom }), ChromePart.Label);

    expect(label).toHaveLength(1);
    expect(right(label)).toBeLessThanOrEqual(100 + width + 1e-6);
  });

  it('ends a cut name with an ellipsis, shaped with the real glyph source', () => {
    const asked: string[] = [];
    tileChrome(tile({ label: LONG, width: 120 }), (text, size, set) => (asked.push(text), glyphs(text, size, set)));

    expect(asked.at(-1)).toMatch(/…$/);
  });
});

describe('frameHeaderIcons', () => {
  it('shows a row only when its fact holds', () => {
    expect(headerBadges(facts({ component: true }))).toEqual([FrameBadge.Play, FrameBadge.Component]);
    expect(headerBadges(facts())).toEqual([FrameBadge.Play]);
  });

  it('puts Play on every frame, before every state icon', () => {
    expect(headerBadges(facts({ breakpoints: true, component: true, source: [SourceSync.Modified] }))[0]).toBe(FrameBadge.Play);
  });

  it('shows the GitHub states by default, hides them when the flag is off', () => {
    expect(headerBadges(facts({ source: [SourceSync.Conflict] }))).toEqual([FrameBadge.Play, FrameBadge.SourceConflict]);
    expect(headerBadges(facts({ source: [SourceSync.Conflict] }), { sourceSync: false })).toEqual([FrameBadge.Play]);
  });

  it('shows only the highest-priority GitHub state', () => {
    const on = { sourceSync: true };

    expect(headerBadges(facts({ source: [SourceSync.InSync, SourceSync.Modified, SourceSync.Orphan] }), on)).toEqual([FrameBadge.Play, FrameBadge.SourceOrphan]);
    expect(headerBadges(facts({ source: [SourceSync.InPr, SourceSync.Upstream] }), on)).toEqual([FrameBadge.Play, FrameBadge.SourceUpstream]);
    expect(headerBadges(facts({ source: [SourceSync.InSync] }), on)).toEqual([FrameBadge.Play, FrameBadge.SourceInSync]);
  });

  it('orders the GitHub states conflict, orphan, read-only, upstream, modified, in PR, in sync', () => {
    const source = frameHeaderIcons.filter((r) => r.source !== undefined).map((r) => r.source);

    expect(source).toEqual([SourceSync.Conflict, SourceSync.Orphan, SourceSync.ReadOnly, SourceSync.Upstream, SourceSync.Modified, SourceSync.InPr, SourceSync.InSync]);
  });

  it('gives every row a tooltip', () => {
    expect(frameHeaderIcons.every((r) => r.tooltip.length > 0)).toBe(true);
  });

  it('draws the icons right-aligned in the header row', () => {
    const t = tile({ label: 'Home', badges: [{ key: FrameBadge.Play, contours: ICON }, { key: FrameBadge.Component, contours: ICON }] });
    const icons = partsOf(t, ChromePart.Badge);

    expect(icons).toHaveLength(2);
    expect(right(icons)).toBeCloseTo(400, 6);
    expect(headerIconBoxes(t, glyphs).map((b) => b.key)).toEqual([FrameBadge.Play, FrameBadge.Component]);
  });
});

describe('narrow frames', () => {
  const badges = headerBadges(facts({ breakpoints: true, component: true })).map((key) => ({ key, contours: ICON }));

  it('drops icons from the lowest priority before the name falls under three letters and an ellipsis', () => {
    expect(badgesKept(100, 3, 16, 48)).toBe(3);
    expect(badgesKept(70, 3, 16, 48)).toBe(1);
    expect(badgesKept(40, 3, 16, 48)).toBe(0);
  });

  it('keeps the name readable on a narrow frame and the first icon', () => {
    const t = tile({ label: LONG, width: 80, badges });
    const label = partsOf(t, ChromePart.Label);
    const icons = partsOf(t, ChromePart.Badge);

    expect(icons.length).toBeLessThan(3);
    expect(right(label)).toBeLessThanOrEqual(left(icons));
    expect(headerIconBoxes(t, glyphs).map((b) => b.key)).toEqual(badges.slice(0, icons.length).map((b) => b.key));
  });

  it('keeps Play when only one icon fits', () => {
    const t = tile({ label: LONG, width: 70, badges });

    expect(headerIconBoxes(t, glyphs).map((b) => b.key)).toEqual([FrameBadge.Play]);
  });
});

describe('hit areas during camera motion', () => {
  const boxes = [{ id: 'f1', key: FrameBadge.Component, x: 0, y: 0, w: 12, h: 12 }];

  it('keeps them at rest', () => {
    expect(headerHits(boxes, CameraMotion.Still)).toBe(boxes);
  });

  it('removes them while the camera moves, so a gesture touches no DOM', () => {
    expect(headerHits(boxes, CameraMotion.Moving)).toEqual([]);
  });
});
