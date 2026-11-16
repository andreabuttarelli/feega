import type { MotionDoc } from '../../doc';
import { addBreakpoint, BreakpointPreset, OverrideKey, setOverride } from '../../breakpoints/model';
import { Direction, Sizing } from '../../layout/auto-layout';
import { DEFAULT_LAYOUT_ITEM } from '../../layout/model';
import { box, DocKit } from './kit';
import { featureGridDoc, heroDoc } from './small';
import { landingDoc } from './landing';

export type Fixture = { name: string; doc: MotionDoc };

export const must = (r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

export const withViews = (doc: MotionDoc, ...presets: [BreakpointPreset, string][]): MotionDoc => presets.reduce((d, [preset, id]) => must(addBreakpoint(d, preset, id)), doc);

export const TABLET: [BreakpointPreset, string] = [BreakpointPreset.Tablet, 'tablet'];
export const PHONE: [BreakpointPreset, string] = [BreakpointPreset.Phone, 'phone'];

export const hiddenAtBase = (doc: MotionDoc, clipId: string): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, hidden: true } : c)) }))
}) as MotionDoc;

const hugHeight = (doc: MotionDoc, clipId: string): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, layoutItem: { ...DEFAULT_LAYOUT_ITEM, ...c.layoutItem, height: Sizing.Hug } } : c)) }))
}) as MotionDoc;

function heroOnPhone(): MotionDoc {
  const doc = withViews(hugHeight(heroDoc(), 'page'), PHONE);
  const stacked = must(setOverride(doc, 'phone', 'actions', OverrideKey.Direction, Direction.Vertical));
  const padded = must(setOverride(stacked, 'phone', 'page', OverrideKey.Padding, { top: 24, right: 20, bottom: 48, left: 20 }));
  return must(setOverride(padded, 'phone', 'headline', OverrideKey.FontSize, 36 / 720));
}

function featuresOnViews(): MotionDoc {
  const doc = withViews(hugHeight(featureGridDoc(), 'features'), TABLET, PHONE);
  const tablet = must(setOverride(doc, 'tablet', 'features', OverrideKey.Columns, 2));
  return must(setOverride(tablet, 'phone', 'features', OverrideKey.Columns, 1));
}

export function compMainDoc(): MotionDoc {
  return must(setOverride(withViews(heroDoc(), PHONE), 'phone', 'btn', OverrideKey.Padding, { top: 4, right: 6, bottom: 4, left: 6 }, 'cmp-button'));
}

export function viewOnlyDoc(): MotionDoc {
  const kit = new DocKit(1440, 900);
  kit.frame('page', { name: 'Page', box: box(0, 0, 1440, 900), fill: '#ffffff', layout: { direction: Direction.Vertical }, item: { width: Sizing.Fixed, height: Sizing.Hug } });
  kit.text('lead', 'Lead', { parent: 'page', name: 'Lead', size: 48, font: 'Inter' });
  kit.frame('promo', { name: 'Promo', parent: 'page', box: box(0, 0, 1440, 80), fill: '#111111', layout: { direction: Direction.Horizontal }, item: { width: Sizing.Fill, height: Sizing.Hug } });
  kit.text('promo-note', 'Phone only', { parent: 'promo', name: 'Promo note', size: 16, font: 'Inter' });
  kit.text('tip', 'Phone tip', { parent: 'page', name: 'Tip', size: 16, font: 'Inter' });
  const hidden = hiddenAtBase(hiddenAtBase(kit.doc(), 'promo'), 'tip');
  const phone = withViews(hidden, PHONE);
  return must(setOverride(must(setOverride(phone, 'phone', 'promo', OverrideKey.Hidden, false)), 'phone', 'tip', OverrideKey.Hidden, false));
}

export function tallViewsDoc(): MotionDoc {
  const kit = new DocKit(1280, 1600);
  kit.frame('band-a', { name: 'Band A', box: box(0, 0, 1280, 300), fill: '#e8eefc' });
  kit.frame('band-b', { name: 'Band B', box: box(0, 300, 1280, 300), fill: '#fce8ee' });
  const doc = must(addBreakpoint(kit.doc(), { name: 'Phone', width: 390, height: 900 }, 'phone'));
  return doc;
}

export const baseFixtures = (): Fixture[] => [
  { name: 'landing', doc: landingDoc() },
  { name: 'hero-phone', doc: heroOnPhone() },
  { name: 'features-grid', doc: featuresOnViews() },
  { name: 'view-only-layers', doc: viewOnlyDoc() },
  { name: 'component-main-override', doc: compMainDoc() },
  { name: 'view-heights', doc: tallViewsDoc() }
];

export const allFixtures = (): Fixture[] => baseFixtures();
