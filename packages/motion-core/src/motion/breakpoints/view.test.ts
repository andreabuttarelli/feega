import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '../doc';
import { landingDoc } from '../codegen/fixtures/landing';
import { compBounds, withAutoLayout } from '../layout/resolve';
import { liftViewEdit, resolveView } from './view';
import { OverrideKey } from './model';

type Px = { left: number; top: number; width: number; height: number };

const boxesOf = (doc: MotionDoc): Map<string, Px> => {
  const laid = withAutoLayout(doc);
  const clips = laid.tracks.flatMap((t) => t.clips);
  const byId = new Map(clips.map((c) => [c.id, c]));
  const shown = (id: string | undefined): boolean => !id || (!byId.get(id)?.hidden && shown(byId.get(id)?.parent));
  return new Map(
    clips
      .filter((c) => shown(c.id) && typeof c.props.width === 'number')
      .map((c) => {
        const p = c.props as { x: number; y: number; width: number; height: number };
        const width = p.width * laid.width;
        const height = p.height * laid.height;
        return [c.id, { left: p.x * laid.width - width / 2, top: p.y * laid.height - height / 2, width, height }];
      })
  );
};

const PHONE = 'phone';
const TABLET = 'tablet';
const PHONE_CONTENT = 390 - 2 * 20;

describe('the landing page on a breakpoint view', () => {
  const phone = resolveView(landingDoc(), PHONE);
  const boxes = boxesOf(phone);
  const box = (id: string) => boxes.get(id)!;

  it('no element is wider than the phone', () => {
    const outside = [...boxes].filter(([, b]) => b.left < -0.5 || b.left + b.width > 390.5).map(([id]) => id);
    expect(outside.map((id) => [id, boxes.get(id)])).toEqual([]);
  });

  it('the hero headline and lede wrap inside the gutter', () => {
    expect(box('headline').width).toBeLessThanOrEqual(PHONE_CONTENT + 0.5);
    expect(box('lede').width).toBeLessThanOrEqual(PHONE_CONTENT + 0.5);
    expect(box('headline').left).toBeGreaterThanOrEqual(19.5);
  });

  it('the hero stacks: headline, lede, actions, app', () => {
    const tops = ['headline', 'lede', 'hero-actions', 'app'].map((id) => box(id).top);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  });

  it('feature and pricing cards stack one per row across the content width', () => {
    const y = (id: string) => Number(phone.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!.transform?.y ?? 0);
    const laidY = (id: string) => Number(withAutoLayout(phone).tracks.flatMap((t) => t.clips).find((c) => c.id === id)!.transform?.y ?? y(id));

    expect(box('feature-grid').width).toBeCloseTo(PHONE_CONTENT, 0);
    expect(box('tiers').width).toBeCloseTo(PHONE_CONTENT, 0);
    expect(laidY('feature-2')).toBeGreaterThan(laidY('feature-1'));
    expect(laidY('tier-2')).toBeGreaterThan(laidY('tier-1'));
  });

  it('a card that fills its column draws at the column width, not at the width its component was drawn', () => {
    const laid = withAutoLayout(phone);
    const drawnWidth = (id: string) => {
      const instance = laid.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!;
      const comp = laid.comps[String(instance.props.comp)];
      return compBounds(comp, comp.frame ?? { width: laid.width, height: laid.height })!.width;
    };

    for (const id of ['feature-1', 'tier-2', 'task-1']) {
      expect(drawnWidth(id)).toBeLessThanOrEqual(PHONE_CONTENT + 0.5);
    }
  });

  it('what sits inside a hidden section is hidden with it', () => {
    const tablet = resolveView(landingDoc(), TABLET);
    const clips = tablet.tracks.flatMap((t) => t.clips);
    const inside = clips.filter((c) => c.parent === 'sidebar');

    expect(inside.length).toBeGreaterThan(0);
    expect(inside.every((c) => c.hidden)).toBe(true);
  });

  it('a section hidden on tablet leaves its slot to the rest', () => {
    expect(box('main').width).toBeCloseTo(box('app').width - 2, 0);
  });

  it('the view grows to fit the page it shows', () => {
    expect(phone.height).toBeGreaterThan(landingDoc().height);
    expect(phone.height - (box('page').top + box('page').height)).toBeGreaterThanOrEqual(0);
    expect(phone.height - (box('page').top + box('page').height)).toBeLessThan(1);
  });

  it('text keeps its pixel size when the view grows', () => {
    const tablet = resolveView(landingDoc(), TABLET);
    const size = (doc: MotionDoc) => Number(doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 'lede')!.props.size) * Math.min(doc.width, doc.height);
    expect(size(tablet)).toBeCloseTo(size(landingDoc()));
  });
});

describe('an edit made on the drawn view', () => {
  const page = landingDoc();
  const clipIn = (doc: MotionDoc, id: string) => doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!;
  const sizePx = (doc: MotionDoc, id: string) => Number(clipIn(doc, id).props.size) * Math.min(doc.width, doc.height);
  const withSize = (doc: MotionDoc, id: string, px: number): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, size: px / Math.min(doc.width, doc.height) } } : c)) })) }) as MotionDoc;

  it('a font size set on the phone view is that pixel size on the phone only', () => {
    const before = resolveView(page, PHONE);
    const lifted = liftViewEdit(page, PHONE, before, withSize(before, 'headline', 30));

    expect(sizePx(resolveView(lifted, PHONE), 'headline')).toBeCloseTo(30);
    expect(clipIn(lifted, 'headline').props.size).toBe(clipIn(page, 'headline').props.size);
    expect(Object.keys(clipIn(lifted, 'headline').overrides?.[PHONE] ?? {})).toContain(OverrideKey.FontSize);
    expect(sizePx(resolveView(lifted, TABLET), 'headline')).toBeCloseTo(sizePx(resolveView(page, TABLET), 'headline'));
  });

  it('an untouched view writes nothing', () => {
    const before = resolveView(page, PHONE);

    expect(liftViewEdit(page, PHONE, before, before).tracks).toEqual(page.tracks);
  });
});
