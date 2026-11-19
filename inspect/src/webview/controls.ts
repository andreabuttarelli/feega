import { ClassFamily, LiveProp, Side, arbitraryFamily } from '@feega/live-edit/live-fields';
import type { Range } from '@feega/properties-panel/number-field';
import { UNITS_OF, type Unit } from './units';
import { tailwindShadow } from './shadows';
import { arbitraryCss } from './fills';

export enum Section {
  Layout = 'Auto layout',
  Size = 'Size',
  Spacing = 'Spacing',
  Typography = 'Typography',
  Fill = 'Fill',
  Radius = 'Radius',
  Border = 'Border',
  Effects = 'Effects'
}

export enum Control {
  Number = 'number',
  Colour = 'colour',
  Choice = 'choice',
  Shadows = 'shadows',
  Text = 'text',
  Fills = 'fills'
}

export type Styles = Record<string, string>;

export type Change = { prop: LiveProp; side?: Side; family?: string; value: string };

export enum Group {
  Padding = 'padding',
  Margin = 'margin',
  Radius = 'radius'
}

export enum SideMode {
  All = 'all',
  Axis = 'axis',
  Each = 'each'
}

export const GROUP_MODES: Record<Group, SideMode[]> = {
  [Group.Padding]: [SideMode.All, SideMode.Axis, SideMode.Each],
  [Group.Margin]: [SideMode.All, SideMode.Axis, SideMode.Each],
  [Group.Radius]: [SideMode.All, SideMode.Each]
};

export type Hint = { group: Group; sides: string[] };

type Base = { section: Section; name: string; label: string; preview: (value: string) => Styles; change: (value: string) => Change; group?: Group; mode?: SideMode; sides?: string[]; hidden?: boolean };

export type NumberRow = Base & { control: Control.Number; range: Range; unit: string; units?: Unit[]; read: (s: Styles) => number };
export type ColourRow = Base & { control: Control.Colour; read: (s: Styles) => string };
export type ChoiceRow = Base & { control: Control.Choice; choices: string[]; read: (s: Styles) => string };
export type ShadowsRow = Base & { control: Control.Shadows; read: (s: Styles) => string };
export type FillsRow = Base & { control: Control.Fills; read: (s: Styles) => string };
export type TextRow = Base & { control: Control.Text; read: (s: Styles) => string };
export type Row = NumberRow | ColourRow | ChoiceRow | ShadowsRow | FillsRow | TextRow;

const PX: Range = { min: 0, max: 400, step: 1 };
const SIZE: Range = { min: 0, max: 4000, step: 1 };
const PERCENT: Range = { min: 0, max: 100, step: 5 };
const SIGNED: Range = { min: -400, max: 400, step: 1 };

const px = (s: Styles, name: string) => Math.round(parseFloat(s[name] ?? '0') || 0);
const style = (name: string) => (value: string) => ({ [name]: value });
const pxStyle = (...names: string[]) => (value: string) => Object.fromEntries(names.map((n) => [n, value]));
const prop = (p: LiveProp, side?: Side) => (value: string) => ({ prop: p, side, value });
const colour = (p: LiveProp) => (value: string) => ({ prop: p, value });
const family = (f: ClassFamily, make: (value: string) => string = (v) => v) => (value: string) => ({ prop: LiveProp.Class, family: f, value: make(value) });

const DIRECTIONS: Record<string, string> = { 'flex-row': 'row', 'flex-col': 'column' };
const ITEMS: Record<string, string> = { 'items-start': 'flex-start', 'items-center': 'center', 'items-end': 'flex-end', 'items-stretch': 'stretch' };
const JUSTIFY: Record<string, string> = { 'justify-start': 'flex-start', 'justify-center': 'center', 'justify-end': 'flex-end', 'justify-between': 'space-between' };
const ALIGN: Record<string, string> = { 'text-left': 'left', 'text-center': 'center', 'text-right': 'right', 'text-justify': 'justify' };
const WEIGHTS = ['300', '400', '500', '600', '700', '800'];

const keyOf = (table: Record<string, string>, css: string) => Object.entries(table).find(([, v]) => v === css)?.[0] ?? '';

const SIDES = [
  { key: 'top', label: 'T', side: Side.Top, css: ['top'] },
  { key: 'right', label: 'R', side: Side.Right, css: ['right'] },
  { key: 'bottom', label: 'B', side: Side.Bottom, css: ['bottom'] },
  { key: 'left', label: 'L', side: Side.Left, css: ['left'] }
];

const AXES = [
  { key: 'x', label: '↔', side: Side.X, css: ['left', 'right'] },
  { key: 'y', label: '↕', side: Side.Y, css: ['top', 'bottom'] }
];

const ALL = [{ key: 'all', label: '▢', side: Side.All, css: ['top', 'right', 'bottom', 'left'] }];

const CORNERS = [
  { key: 'tl', label: '◜', css: 'top-left' },
  { key: 'tr', label: '◝', css: 'top-right' },
  { key: 'br', label: '◞', css: 'bottom-right' },
  { key: 'bl', label: '◟', css: 'bottom-left' }
];

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function boxRows(group: Group.Padding | Group.Margin, live: LiveProp, range: Range): NumberRow[] {
  const modes: [SideMode, typeof SIDES][] = [
    [SideMode.All, ALL],
    [SideMode.Axis, AXES],
    [SideMode.Each, SIDES]
  ];
  return modes.flatMap(([mode, sides]) =>
    sides.map((s) => ({
      section: Section.Spacing,
      group,
      mode,
      sides: s.css,
      name: `${group}-${s.key}`,
      label: s.label,
      control: Control.Number as const,
      range,
      unit: 'px',
      units: UNITS_OF[group],
      read: (st: Styles) => px(st, `${group}-${s.css[0]}`),
      preview: pxStyle(...s.css.map((c) => camel(`${group}-${c}`))),
      change: prop(live, s.side)
    }))
  );
}

const radiusRows: NumberRow[] = [
  { section: Section.Radius, group: Group.Radius, mode: SideMode.All, sides: CORNERS.map((c) => c.css), name: 'radius', label: 'R', control: Control.Number, range: PX, unit: 'px', units: UNITS_OF.radius, read: (s) => px(s, 'border-radius'), preview: pxStyle('borderRadius'), change: prop(LiveProp.Radius) },
  ...CORNERS.map((c) => ({
    section: Section.Radius,
    group: Group.Radius,
    mode: SideMode.Each,
    sides: [c.css],
    name: `radius-${c.key}`,
    label: c.label,
    control: Control.Number as const,
    range: PX,
    unit: 'px',
    units: UNITS_OF.radius,
    read: (s: Styles) => px(s, `border-${c.css}-radius`),
    preview: pxStyle(camel(`border-${c.css}-radius`)),
    change: (v: string) => ({ prop: LiveProp.Class, family: arbitraryFamily(`border-${c.css}-radius`), value: `[border-${c.css}-radius:${v}]` })
  }))
];

export const ROWS: Row[] = [
  { section: Section.Layout, name: 'direction', label: 'Direction', control: Control.Choice, choices: Object.keys(DIRECTIONS), read: (s) => keyOf(DIRECTIONS, s['flex-direction']), preview: (v) => ({ flexDirection: DIRECTIONS[v], display: 'flex' }), change: family(ClassFamily.Direction) },
  { section: Section.Layout, name: 'align', label: 'Align', control: Control.Choice, choices: Object.keys(ITEMS), read: (s) => keyOf(ITEMS, s['align-items']), preview: (v) => ({ alignItems: ITEMS[v] }), change: family(ClassFamily.Items) },
  { section: Section.Layout, name: 'justify', label: 'Justify', control: Control.Choice, choices: Object.keys(JUSTIFY), read: (s) => keyOf(JUSTIFY, s['justify-content']), preview: (v) => ({ justifyContent: JUSTIFY[v] }), change: family(ClassFamily.Justify) },
  { section: Section.Layout, units: UNITS_OF['gap'], name: 'gap', label: 'G', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'gap'), preview: pxStyle('gap'), change: prop(LiveProp.Gap) },
  { section: Section.Size, units: UNITS_OF['width'], name: 'width', label: 'W', control: Control.Number, range: SIZE, unit: 'px', read: (s) => px(s, 'width'), preview: pxStyle('width'), change: family(ClassFamily.Width, (v) => `w-[${v}]`) },
  { section: Section.Size, units: UNITS_OF['height'], name: 'height', label: 'H', control: Control.Number, range: SIZE, unit: 'px', read: (s) => px(s, 'height'), preview: pxStyle('height'), change: family(ClassFamily.Height, (v) => `h-[${v}]`) },
  ...boxRows(Group.Padding, LiveProp.Padding, PX),
  ...boxRows(Group.Margin, LiveProp.Margin, SIGNED),
  { section: Section.Typography, name: 'font-family', label: 'Font', control: Control.Text, read: (s) => (s['font-family'] ?? '').split(',')[0].replace(/["']/g, '').trim(), preview: style('fontFamily'), change: family(ClassFamily.FontFamily, (v) => `font-['${v.trim().replace(/\s+/g, '_')}']`) },
  { section: Section.Typography, units: UNITS_OF['line-height'], name: 'line-height', label: 'Line', control: Control.Number, range: { min: 0, max: 400, step: 1 }, unit: 'px', read: (s) => px(s, 'line-height'), preview: style('lineHeight'), change: family(ClassFamily.Leading, (v) => `leading-[${v}]`) },
  { section: Section.Typography, units: UNITS_OF['letter-spacing'], name: 'letter-spacing', label: 'Letter', control: Control.Number, range: { min: -100, max: 100, step: 1 }, unit: 'px', read: (s) => parseFloat(s['letter-spacing'] ?? '0') || 0, preview: style('letterSpacing'), change: family(ClassFamily.Tracking, (v) => `tracking-[${v}]`) },
  { section: Section.Typography, units: UNITS_OF['font-size'], name: 'font-size', label: 'Size', control: Control.Number, range: { min: 1, max: 400, step: 1 }, unit: 'px', read: (s) => px(s, 'font-size'), preview: pxStyle('fontSize'), change: prop(LiveProp.FontSize) },
  { section: Section.Typography, name: 'font-weight', label: 'Weight', control: Control.Choice, choices: WEIGHTS, read: (s) => s['font-weight'] ?? '', preview: style('fontWeight'), change: (value) => ({ prop: LiveProp.FontWeight, value }) },
  { section: Section.Typography, name: 'text-align', label: 'Align', control: Control.Choice, choices: Object.keys(ALIGN), read: (s) => keyOf(ALIGN, s['text-align']), preview: (v) => ({ textAlign: ALIGN[v] }), change: family(ClassFamily.TextAlign) },
  { section: Section.Typography, name: 'color', label: 'Colour', control: Control.Colour, read: (s) => s.color ?? '', preview: style('color'), change: colour(LiveProp.Color) },
  { section: Section.Fill, hidden: true, name: 'fill', label: 'Background', control: Control.Colour, read: (s) => s['background-color'] ?? '', preview: style('backgroundColor'), change: colour(LiveProp.Fill) },
  { section: Section.Fill, name: 'fill-image', label: 'Fill', control: Control.Fills, read: (s) => s['background-image'] ?? 'none', preview: style('backgroundImage'), change: (v) => ({ prop: LiveProp.Class, family: arbitraryFamily('background-image'), value: `[background-image:${arbitraryCss(v)}]` }) },
  ...radiusRows,
  { section: Section.Border, units: UNITS_OF['border'], name: 'border', label: 'B', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'border-top-width'), preview: (v) => ({ borderWidth: v, borderStyle: 'solid' }), change: family(ClassFamily.Border, (v) => (parseFloat(v) === 0 ? 'border-0' : `border-[${v}]`)) },
  { section: Section.Effects, name: 'opacity', label: 'Opacity', control: Control.Number, range: PERCENT, unit: '%', read: (s) => Math.round(parseFloat(s.opacity ?? '1') * 100), preview: (v) => ({ opacity: String(Number(v) / 100) }), change: family(ClassFamily.Opacity, (v) => `opacity-${v}`) },
  { section: Section.Effects, name: 'shadow', label: 'Drop', control: Control.Shadows, read: (s) => s['box-shadow'] ?? 'none', preview: style('boxShadow'), change: family(ClassFamily.Shadow, tailwindShadow) },
  { section: Section.Typography, name: 'text-shadow', label: 'Text shadow', control: Control.Shadows, read: (s) => s['text-shadow'] ?? 'none', preview: style('textShadow'), change: (v) => ({ prop: LiveProp.Class, family: arbitraryFamily('text-shadow'), value: `[text-shadow:${v.replace(/\s+/g, '_')}]` }) }
];
