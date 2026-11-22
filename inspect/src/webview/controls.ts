import { ClassFamily, LiveProp, Side, arbitraryFamily } from '@feega/live-edit/live-fields';
import type { Range } from '@feega/properties-panel/number-field';
import { UNITS_OF, type Unit } from './units';
import { tailwindShadow } from './shadows';
import { tailwindToken } from '@feega/live-edit/tailwind-property';
import { arbitraryCss, tailwindImage } from './fills';

export enum Section {
  Layout = 'Auto layout',
  Size = 'Size',
  Spacing = 'Spacing',
  Typography = 'Typography',
  Fill = 'Fill',
  Radius = 'Radius',
  Border = 'Border',
  Effects = 'Effects',
  Position = 'Position',
  Display = 'Display',
  Constraints = 'Constraints',
  Object = 'Object',
  Grid = 'Grid',
  Child = 'Flex child',
  Stroke = 'Stroke',
  Filters = 'Filters',
  Transform = 'Transform',
  Transition = 'Transition',
  TextOptions = 'Text options',
  List = 'List',
  Cursor = 'Cursor',
  Icon = 'Icon'
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
const arbitraryBackground = (property: string) => (v: string) => ({ prop: LiveProp.Class, family: arbitraryFamily(property), value: `[${property}:${arbitraryCss(v)}]` });
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

const STROKE_WIDTH: Range = { min: 0, max: 8, step: 0.25 };

const svgPaint = (property: string) => (value: string) => ({ prop: LiveProp.Class, family: arbitraryFamily(property), value: `[${property}:${value.replace(/\s+/g, '_')}]` });

const ICON_ROWS: Row[] = [
  { section: Section.Icon, name: 'icon-colour', label: 'Colour', control: Control.Colour, read: (s) => s.color ?? '', preview: style('color'), change: colour(LiveProp.Color) },
  { section: Section.Icon, name: 'icon-fill', label: 'Fill', control: Control.Colour, read: (s) => s.fill ?? '', preview: style('fill'), change: svgPaint('fill') },
  { section: Section.Icon, name: 'icon-stroke', label: 'Stroke', control: Control.Colour, read: (s) => s.stroke ?? '', preview: style('stroke'), change: svgPaint('stroke') },
  { section: Section.Icon, name: 'icon-stroke-width', label: 'Weight', control: Control.Number, range: STROKE_WIDTH, unit: '', read: (s) => parseFloat(s['stroke-width'] ?? '0') || 0, preview: style('strokeWidth'), change: (value) => ({ prop: LiveProp.Class, family: arbitraryFamily('stroke-width'), value: `[stroke-width:${value}]` }) }
];

const DESIGN_ROWS: Row[] = [
  { section: Section.Layout, name: 'direction', label: 'Direction', control: Control.Choice, choices: Object.keys(DIRECTIONS), read: (s) => keyOf(DIRECTIONS, s['flex-direction']), preview: (v) => ({ flexDirection: DIRECTIONS[v], display: 'flex' }), change: family(ClassFamily.Direction) },
  { section: Section.Layout, name: 'align', label: 'Align', control: Control.Choice, choices: Object.keys(ITEMS), read: (s) => keyOf(ITEMS, s['align-items']), preview: (v) => ({ alignItems: ITEMS[v] }), change: family(ClassFamily.Items) },
  { section: Section.Layout, name: 'justify', label: 'Justify', control: Control.Choice, choices: Object.keys(JUSTIFY), read: (s) => keyOf(JUSTIFY, s['justify-content']), preview: (v) => ({ justifyContent: JUSTIFY[v] }), change: family(ClassFamily.Justify) },
  { section: Section.Layout, units: UNITS_OF['gap'], name: 'gap', label: 'G', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'gap'), preview: pxStyle('gap'), change: prop(LiveProp.Gap) },
  { section: Section.Size, units: UNITS_OF['width'], name: 'width', label: 'W', control: Control.Number, range: SIZE, unit: 'px', read: (s) => px(s, 'width'), preview: pxStyle('width'), change: family(ClassFamily.Width, (v) => tailwindToken('width', v)) },
  { section: Section.Size, units: UNITS_OF['height'], name: 'height', label: 'H', control: Control.Number, range: SIZE, unit: 'px', read: (s) => px(s, 'height'), preview: pxStyle('height'), change: family(ClassFamily.Height, (v) => tailwindToken('height', v)) },
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
  { section: Section.Fill, name: 'fill-image', label: 'Fill', control: Control.Fills, read: (s) => s['background-image'] ?? 'none', preview: style('backgroundImage'), change: (v) => ({ prop: LiveProp.Class, family: arbitraryFamily('background-image'), value: tailwindImage(v) }) },
  { section: Section.Fill, hidden: true, name: 'fill-size', label: 'Size', control: Control.Text, read: (s) => s['background-size'] ?? 'auto', preview: style('backgroundSize'), change: arbitraryBackground('background-size') },
  { section: Section.Fill, hidden: true, name: 'fill-repeat', label: 'Repeat', control: Control.Text, read: (s) => s['background-repeat'] ?? 'repeat', preview: style('backgroundRepeat'), change: arbitraryBackground('background-repeat') },
  { section: Section.Fill, hidden: true, name: 'fill-position', label: 'Position', control: Control.Text, read: (s) => s['background-position'] ?? '0% 0%', preview: style('backgroundPosition'), change: arbitraryBackground('background-position') },
  { section: Section.Typography, hidden: true, name: 'text-clip', label: 'Clip', control: Control.Text, read: (s) => (s['background-clip'] === 'text' || s['-webkit-background-clip'] === 'text' ? 'text' : ''), preview: (v) => ({ backgroundClip: v, WebkitBackgroundClip: v }), change: (v) => ({ prop: LiveProp.Class, family: arbitraryFamily('background-clip'), value: v ? `bg-clip-${v}` : '' }) },
  ...radiusRows,
  { section: Section.Border, units: UNITS_OF['border'], name: 'border', label: 'B', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'border-top-width'), preview: (v) => ({ borderWidth: v, borderStyle: 'solid' }), change: family(ClassFamily.Border, (v) => (parseFloat(v) === 0 ? 'border-0' : `border-[${v}]`)) },
  { section: Section.Effects, name: 'opacity', label: 'Opacity', control: Control.Number, range: PERCENT, unit: '%', read: (s) => Math.round(parseFloat(s.opacity ?? '1') * 100), preview: (v) => ({ opacity: String(Number(v) / 100) }), change: family(ClassFamily.Opacity, (v) => `opacity-${v}`) },
  { section: Section.Effects, name: 'shadow', label: 'Drop', control: Control.Shadows, read: (s) => s['box-shadow'] ?? 'none', preview: style('boxShadow'), change: family(ClassFamily.Shadow, tailwindShadow) },
  { section: Section.Typography, name: 'text-shadow', label: 'Text shadow', control: Control.Shadows, read: (s) => s['text-shadow'] ?? 'none', preview: style('textShadow'), change: (v) => ({ prop: LiveProp.Class, family: arbitraryFamily('text-shadow'), value: `[text-shadow:${v.replace(/\s+/g, '_')}]` }) }
];

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double'];
const OVERFLOW = ['visible', 'hidden', 'clip', 'scroll', 'auto'];
const COUNT: Range = { min: 0, max: 100, step: 1 };
const Z: Range = { min: -100, max: 9999, step: 1 };
const MS: Range = { min: 0, max: 10000, step: 50 };
const DEGREES: Range = { min: -360, max: 360, step: 1 };
const FACTOR: Range = { min: 0, max: 10, step: 0.05 };

type CssKind = { control: Control.Choice; choices: string[] } | { control: Control.Number; range: Range; suffix?: string; units?: Unit[] } | { control: Control.Text } | { control: Control.Colour };

export type CssSpec = CssKind & { section: Section; name: string; label: string; reads: string[]; preview?: (value: string) => Styles; read?: (s: Styles) => number; utility?: { family: ClassFamily; make: (value: string) => string } };

const choice = (section: Section, name: string, label: string, choices: string[]): CssSpec => ({ section, name, label, reads: [name], control: Control.Choice, choices });
const length = (section: Section, name: string, label: string, range: Range, units: Unit[] = UNITS_OF.width): CssSpec => ({ section, name, label, reads: [name], control: Control.Number, range, units });
const count = (section: Section, name: string, label: string, range: Range, suffix = ''): CssSpec => ({ section, name, label, reads: [name], control: Control.Number, range, suffix });
const text = (section: Section, name: string, label: string): CssSpec => ({ section, name, label, reads: [name], control: Control.Text });
const paint = (section: Section, name: string, label: string, reads = [name]): CssSpec => ({ section, name, label, reads, control: Control.Colour });

const blurOf = (raw: string | undefined) => Math.round(parseFloat(raw?.match(/blur\(([\d.]+)px\)/)?.[1] ?? '0'));
const blur = (name: string, property: string, label: string): CssSpec => ({ section: Section.Filters, name, label, reads: [property], control: Control.Number, range: PX, suffix: 'px', read: (s) => blurOf(s[property]), preview: (v) => ({ [camel(property)]: v ? `blur(${v}px)` : '' }) });

const sideRows = (prefix: string, suffix: string, label: string): CssSpec[] => SIDES.map((s) => length(Section.Stroke, `${prefix}-${s.key}${suffix}`, `${label}${s.label}`, PX, UNITS_OF.border));

export const CSS_ROWS: CssSpec[] = [
  choice(Section.Position, 'position', 'Position', ['static', 'relative', 'absolute', 'fixed', 'sticky']),
  ...SIDES.map((s) => length(Section.Position, s.key, s.label, SIGNED, UNITS_OF.offset)),
  count(Section.Position, 'z-index', 'Z', Z),
  { ...choice(Section.Display, 'display', 'Display', ['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'none']), utility: { family: ClassFamily.Display, make: (v) => (v === 'none' ? 'hidden' : v) } },
  choice(Section.Display, 'overflow-x', 'Overflow X', OVERFLOW),
  choice(Section.Display, 'overflow-y', 'Overflow Y', OVERFLOW),
  length(Section.Size, 'min-width', 'Min W', SIZE, UNITS_OF['min-width']),
  length(Section.Size, 'max-width', 'Max W', SIZE, UNITS_OF['max-width']),
  length(Section.Size, 'min-height', 'Min H', SIZE, UNITS_OF['min-height']),
  length(Section.Size, 'max-height', 'Max H', SIZE, UNITS_OF['max-height']),
  text(Section.Constraints, 'aspect-ratio', 'Ratio'),
  choice(Section.Object, 'object-fit', 'Fit', ['fill', 'contain', 'cover', 'none', 'scale-down']),
  text(Section.Object, 'object-position', 'Position'),
  text(Section.Grid, 'grid-template-columns', 'Columns'),
  text(Section.Grid, 'grid-template-rows', 'Rows'),
  length(Section.Grid, 'row-gap', 'Row gap', PX, UNITS_OF.gap),
  length(Section.Grid, 'column-gap', 'Col gap', PX, UNITS_OF.gap),
  text(Section.Grid, 'grid-column', 'Span cols'),
  text(Section.Grid, 'grid-row', 'Span rows'),
  count(Section.Child, 'flex-grow', 'Grow', COUNT),
  count(Section.Child, 'flex-shrink', 'Shrink', COUNT),
  length(Section.Child, 'flex-basis', 'Basis', SIZE),
  choice(Section.Child, 'align-self', 'Align self', ['auto', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline']),
  count(Section.Child, 'order', 'Order', Z),
  ...sideRows('border', '-width', 'B'),
  { ...choice(Section.Stroke, 'border-style', 'Style', BORDER_STYLES), reads: ['border-top-style'] },
  paint(Section.Stroke, 'border-color', 'Colour', ['border-top-color']),
  length(Section.Stroke, 'outline-width', 'Outline', PX, UNITS_OF.border),
  choice(Section.Stroke, 'outline-style', 'Outline style', BORDER_STYLES),
  paint(Section.Stroke, 'outline-color', 'Outline colour'),
  length(Section.Stroke, 'outline-offset', 'Offset', SIGNED, UNITS_OF.border),
  choice(Section.Filters, 'mix-blend-mode', 'Blend', ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']),
  blur('blur', 'filter', 'Blur'),
  blur('backdrop-blur', 'backdrop-filter', 'Backdrop'),
  text(Section.Transform, 'translate', 'Move'),
  count(Section.Transform, 'rotate', 'Rotate', DEGREES, 'deg'),
  count(Section.Transform, 'scale', 'Scale', FACTOR),
  text(Section.Transition, 'transition-property', 'Property'),
  count(Section.Transition, 'transition-duration', 'Duration', MS, 'ms'),
  choice(Section.Transition, 'transition-timing-function', 'Easing', ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out']),
  choice(Section.Cursor, 'cursor', 'Cursor', ['auto', 'default', 'pointer', 'text', 'move', 'grab', 'not-allowed', 'wait', 'help', 'crosshair']),
  choice(Section.TextOptions, 'text-transform', 'Case', ['none', 'uppercase', 'lowercase', 'capitalize']),
  choice(Section.TextOptions, 'text-decoration-line', 'Decoration', ['none', 'underline', 'line-through', 'overline']),
  choice(Section.TextOptions, 'text-overflow', 'Overflow', ['clip', 'ellipsis']),
  choice(Section.TextOptions, 'white-space', 'Wrap', ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces']),
  choice(Section.TextOptions, 'word-break', 'Break', ['normal', 'break-all', 'keep-all', 'break-word']),
  { ...count(Section.TextOptions, 'line-clamp', 'Lines', COUNT), reads: ['-webkit-line-clamp'], read: (s) => parseInt(s['-webkit-line-clamp'] ?? '0') || 0, preview: (v) => (v ? { WebkitLineClamp: v, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' } : { WebkitLineClamp: '', display: '', WebkitBoxOrient: '', overflow: '' }), utility: { family: ClassFamily.Clamp, make: (v) => (v ? `line-clamp-${v}` : '') } },
  choice(Section.List, 'list-style-type', 'Marker', ['none', 'disc', 'circle', 'square', 'decimal']),
  choice(Section.List, 'list-style-position', 'Marker at', ['outside', 'inside'])
];

const STATIC_POSITION = 'static';
const POSITIONED_ONLY = new Set(['top', 'right', 'bottom', 'left', 'z-index']);

export const SIZE_LIMITS = ['min-width', 'max-width', 'min-height', 'max-height'];

const UNSET_LIMIT = ['', 'auto', 'none'];

export const limitsSet = (styles: Styles): boolean => SIZE_LIMITS.some((name) => !UNSET_LIMIT.includes((styles[name] ?? '').trim()));

export const shownRows = <T extends { name: string }>(rows: T[], styles: Styles): T[] => rows.filter((r) => !POSITIONED_ONLY.has(r.name) || (styles.position ?? STATIC_POSITION) !== STATIC_POSITION);

const kebabOf = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const withSuffix = (spec: CssSpec) => (value: string) => (value && spec.control === Control.Number && spec.suffix ? `${value}${spec.suffix}` : value);

function cssRow(spec: CssSpec): Row {
  const property = spec.reads[0];
  const css = withSuffix(spec);
  const preview = spec.preview ?? ((v: string) => ({ [camel(spec.name)]: css(v) }));
  const [key] = Object.keys(preview('1'));
  const target = kebabOf(key);
  const change = spec.utility
    ? (v: string) => ({ prop: LiveProp.Class, family: spec.utility!.family, value: spec.utility!.make(v) })
    : (v: string) => ({ prop: LiveProp.Class, family: arbitraryFamily(target), value: tailwindToken(target, v ? preview(v)[key] : '') });
  const base = { section: spec.section, name: spec.name, label: spec.label, preview, change };
  if (spec.control === Control.Number) {
    return { ...base, control: Control.Number, range: spec.range, unit: spec.suffix ?? 'px', units: spec.units, read: spec.read ?? ((s: Styles) => parseFloat(s[property] ?? '0') || 0) };
  }
  if (spec.control === Control.Choice) {
    return { ...base, control: Control.Choice, choices: spec.choices, read: (s: Styles) => s[property] ?? '' };
  }
  return { ...base, control: spec.control, read: (s: Styles) => s[property] ?? '' };
}

export const ROWS: Row[] = [...DESIGN_ROWS, ...ICON_ROWS, ...CSS_ROWS.map(cssRow)];
