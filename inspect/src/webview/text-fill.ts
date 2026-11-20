import { paintOf } from './colour';
import { FillKind, fillCss, layerCss, parseFills, placementCss, type Fill, type Placement } from './fills';

type Styles = Record<string, string>;

const TEXT = 'text';
const NONE = 'none';
const REMOVED = '';
const TRANSPARENT = 'transparent';
const DEFAULT_CLIP = 'border-box';

export const TEXT_GRADIENT_REFUSAL = 'this element has a background; wrap the text in a span to give it a gradient';

export const isClipped = (s: Styles) => s['background-clip'] === TEXT || s['-webkit-background-clip'] === TEXT;

const placementOf = (s: Styles): Placement => ({ size: s['background-size'] ?? '', repeat: s['background-repeat'] ?? '', position: s['background-position'] ?? '' });

const hasImage = (s: Styles) => (s['background-image'] ?? NONE).trim() !== NONE;

const paintIn = (css: string) => (css.trim() === REMOVED ? null : paintOf(css));

const hasColour = (s: Styles) => paintIn(s['background-color'] ?? REMOVED) !== null;

export const textFillsOf = (s: Styles): Fill[] => (isClipped(s) ? parseFills(s['background-image'] ?? NONE, s['background-color'] ?? REMOVED, placementOf(s)) : parseFills(NONE, s.color ?? REMOVED));

export function textFillCss(fills: Fill[]): Styles {
  const base = fillCss(fills);
  const solid = fills.find((f) => f.visible && f.kind === FillKind.Solid);
  const placement = placementCss(fills);
  if (base['background-image'] === NONE) {
    return { color: solid ? layerCss(solid) : REMOVED, 'background-clip': REMOVED, 'background-image': REMOVED, 'background-color': REMOVED, ...placement };
  }
  return { color: TRANSPARENT, 'background-clip': TEXT, 'background-image': base['background-image'], 'background-color': solid ? base['background-color'] : REMOVED, ...placement };
}

export function textFillRefusal(s: Styles, next: Fill[]): string | null {
  const gradient = next.some((f) => f.visible && f.kind !== FillKind.Solid);
  return gradient && !isClipped(s) && (hasImage(s) || hasColour(s)) ? TEXT_GRADIENT_REFUSAL : null;
}

const sameColour = (was: string, next: string) => {
  const a = paintIn(was);
  const b = paintIn(next);
  return a === null || b === null ? a === b : was.trim() === next.trim();
};

const sameImage = (was: string, next: string) => (was.trim() || NONE) === (next.trim() || NONE);

const sameText = (was: string, next: string) => was.trim() === next.trim();

type Slot = { row: string; key: string; was: (s: Styles) => string; same: (was: string, next: string) => boolean };

const SLOTS: Slot[] = [
  { row: 'fill-image', key: 'background-image', was: (s) => s['background-image'] ?? NONE, same: sameImage },
  { row: 'fill-size', key: 'background-size', was: (s) => s['background-size'] ?? 'auto', same: sameText },
  { row: 'fill-repeat', key: 'background-repeat', was: (s) => s['background-repeat'] ?? 'repeat', same: sameText },
  { row: 'fill-position', key: 'background-position', was: (s) => s['background-position'] ?? '0% 0%', same: sameText },
  { row: 'fill', key: 'background-color', was: (s) => s['background-color'] ?? REMOVED, same: sameColour },
  { row: 'text-clip', key: 'background-clip', was: (s) => (isClipped(s) ? TEXT : REMOVED), same: sameText },
  { row: 'color', key: 'color', was: (s) => s.color ?? REMOVED, same: sameColour }
];

export const textFillWrites = (css: Styles, s: Styles): [string, string][] =>
  SLOTS.filter((slot) => slot.key in css && !slot.same(slot.was(s), css[slot.key])).map((slot) => [slot.row, css[slot.key]]);

const PREVIEW_DEFAULTS: Styles = { 'background-image': NONE, 'background-color': TRANSPARENT, 'background-clip': DEFAULT_CLIP };

export const previewCss = (css: Styles): Styles => Object.fromEntries(Object.entries(css).map(([key, value]) => [key, value === REMOVED ? (PREVIEW_DEFAULTS[key] ?? REMOVED) : value]));

export const textFillPreviews = (css: Styles): [string, string][] => {
  const shown = previewCss(css);
  return SLOTS.filter((slot) => slot.key in shown).map((slot) => [slot.row, shown[slot.key]]);
};
