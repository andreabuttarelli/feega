export enum LiveProp {
  Text = 'text',
  Color = 'color',
  Fill = 'fill',
  FontSize = 'fontSize',
  FontWeight = 'fontWeight',
  Padding = 'padding',
  Margin = 'margin',
  Gap = 'gap',
  Radius = 'radius'
}

export enum Side {
  All = '',
  X = 'x',
  Y = 'y',
  Top = 't',
  Right = 'r',
  Bottom = 'b',
  Left = 'l'
}

export enum LiveAsk {
  Hover = 'hover',
  Pick = 'pick',
  Refresh = 'refresh'
}

const TEXT_SIZE = /^text-(xs|sm|base|lg|[2-9]?xl|\[[\d.]+(px|rem|em)\])$/;
const TEXT_NOT_COLOUR = /^text-(left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/;
const BG_NOT_COLOUR = /^bg-(\[url|gradient|linear|radial|conic|none|clip|fixed|local|scroll|cover|contain|auto|center|top|bottom|left|right|no-repeat|repeat|origin|blend)/;
const WEIGHT = /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/;
const RADIUS_SIDE = /^rounded-(t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee)(-|$)/;

export type ClassRule = { make: (value: string, side: Side) => string; owns: (token: string, side: Side) => boolean };

const spacing = (letter: string): ClassRule => ({
  make: (value, side) => `${letter}${side}-${value}`,
  owns: (token, side) => token.replace(/^-/, '').startsWith(`${letter}${side}-`)
});

export const CLASS_RULE: Record<Exclude<LiveProp, LiveProp.Text>, ClassRule> = {
  [LiveProp.Color]: { make: (v) => `text-${v}`, owns: (t) => t.startsWith('text-') && !TEXT_SIZE.test(t) && !TEXT_NOT_COLOUR.test(t) },
  [LiveProp.Fill]: { make: (v) => `bg-${v}`, owns: (t) => t.startsWith('bg-') && !BG_NOT_COLOUR.test(t) },
  [LiveProp.FontSize]: { make: (v) => `text-${v}`, owns: (t) => TEXT_SIZE.test(t) },
  [LiveProp.FontWeight]: { make: (v) => `font-${v}`, owns: (t) => WEIGHT.test(t) },
  [LiveProp.Padding]: spacing('p'),
  [LiveProp.Margin]: spacing('m'),
  [LiveProp.Gap]: { make: (v, side) => `gap${side ? `-${side}` : ''}-${v}`, owns: (t, side) => t.startsWith(`gap${side ? `-${side}` : ''}-`) && (side !== Side.All || !/^gap-[xy]-/.test(t)) },
  [LiveProp.Radius]: { make: (v) => (v ? `rounded-${v}` : 'rounded'), owns: (t) => (t === 'rounded' || t.startsWith('rounded-')) && !RADIUS_SIDE.test(t) }
};

export enum FieldKind {
  Text = 'text',
  Colour = 'colour',
  Px = 'px',
  Weight = 'weight'
}

export type LiveField = { key: string; label: string; prop: LiveProp; side?: Side; css: string[]; kind: FieldKind };

export const LIVE_FIELDS: LiveField[] = [
  { key: 'text', label: 'Text', prop: LiveProp.Text, css: [], kind: FieldKind.Text },
  { key: 'color', label: 'Text colour', prop: LiveProp.Color, css: ['color'], kind: FieldKind.Colour },
  { key: 'fill', label: 'Fill', prop: LiveProp.Fill, css: ['background-color'], kind: FieldKind.Colour },
  { key: 'size', label: 'Font size', prop: LiveProp.FontSize, css: ['font-size'], kind: FieldKind.Px },
  { key: 'weight', label: 'Weight', prop: LiveProp.FontWeight, css: ['font-weight'], kind: FieldKind.Weight },
  { key: 'px', label: 'Padding X', prop: LiveProp.Padding, side: Side.X, css: ['padding-left', 'padding-right'], kind: FieldKind.Px },
  { key: 'py', label: 'Padding Y', prop: LiveProp.Padding, side: Side.Y, css: ['padding-top', 'padding-bottom'], kind: FieldKind.Px },
  { key: 'mt', label: 'Margin top', prop: LiveProp.Margin, side: Side.Top, css: ['margin-top'], kind: FieldKind.Px },
  { key: 'mb', label: 'Margin bottom', prop: LiveProp.Margin, side: Side.Bottom, css: ['margin-bottom'], kind: FieldKind.Px },
  { key: 'gap', label: 'Gap', prop: LiveProp.Gap, css: ['gap'], kind: FieldKind.Px },
  { key: 'radius', label: 'Radius', prop: LiveProp.Radius, css: ['border-radius'], kind: FieldKind.Px }
];

export type LiveRect = { x: number; y: number; width: number; height: number };

export type LivePick = { source: string; rect: LiveRect; styles: Record<string, string>; classes: string; text: string | null; rem: number | null };

type InspectResult = { source: { file: string; line: number; col: number }; rect?: LiveRect; styles?: Record<string, string>; classes?: string; text?: string | null; rem?: number };

const NO_RECT: LiveRect = { x: 0, y: 0, width: 0, height: 0 };

export function pickOf(result: InspectResult | null | undefined): LivePick | null {
  if (!result?.source) {
    return null;
  }
  const { file, line, col } = result.source;
  return { source: `${file}:${line}:${col}`, rect: result.rect ?? NO_RECT, styles: result.styles ?? {}, classes: result.classes ?? '', text: result.text ?? null, rem: result.rem ?? null };
}

export const fieldValue = (field: LiveField, pick: LivePick) => (field.kind === FieldKind.Text ? (pick.text ?? '') : (pick.styles[field.css[0]] ?? ''));

export function classOf(field: LiveField, classes: string): string | null {
  if (field.prop === LiveProp.Text) {
    return null;
  }
  const rule = CLASS_RULE[field.prop];
  return classes.split(/\s+/).find((t) => t && !t.includes(':') && rule.owns(t, field.side ?? Side.All)) ?? null;
}

const BARE_NUMBER = /^-?\d+(\.\d+)?$/;

const cssValue = (field: LiveField, value: string) => (field.kind === FieldKind.Px && BARE_NUMBER.test(value.trim()) ? `${value.trim()}px` : value);

export type LivePreview = { text?: string; style?: Record<string, string> };

export function previewOf(field: LiveField, value: string): LivePreview {
  if (field.kind === FieldKind.Text) {
    return { text: value };
  }
  return { style: Object.fromEntries(field.css.map((name) => [name, cssValue(field, value)])) };
}

export type LiveEditBody = { at: string; prop: LiveProp; side?: Side; value: string; was: string; rem?: number };

export function editBody(pick: LivePick, field: LiveField, value: string): LiveEditBody {
  return { at: pick.source, prop: field.prop, ...(field.side ? { side: field.side } : {}), value: cssValue(field, value), was: fieldValue(field, pick), ...(pick.rem ? { rem: pick.rem } : {}) };
}

