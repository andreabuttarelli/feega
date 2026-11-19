import { ClassFamily, LiveProp, Side } from '@feega/live-edit/live-fields';
import type { Range } from '@feega/properties-panel/number-field';

export enum Section {
  Layout = 'Auto layout',
  Size = 'Size',
  Spacing = 'Spacing',
  Typography = 'Typography',
  Colour = 'Colour',
  Radius = 'Radius',
  Effects = 'Effects'
}

export enum Control {
  Number = 'number',
  Colour = 'colour',
  Choice = 'choice'
}

export type Styles = Record<string, string>;

export type Change = { prop: LiveProp; side?: Side; family?: string; value: string };

type Base = { section: Section; name: string; label: string; preview: (value: string) => Styles; change: (value: string) => Change };

export type NumberRow = Base & { control: Control.Number; range: Range; unit: string; read: (s: Styles) => number };
export type ColourRow = Base & { control: Control.Colour; read: (s: Styles) => string };
export type ChoiceRow = Base & { control: Control.Choice; choices: string[]; read: (s: Styles) => string };
export type Row = NumberRow | ColourRow | ChoiceRow;

const PX: Range = { min: 0, max: 400, step: 1 };
const SIZE: Range = { min: 0, max: 4000, step: 1 };
const PERCENT: Range = { min: 0, max: 100, step: 5 };

const px = (s: Styles, name: string) => Math.round(parseFloat(s[name] ?? '0') || 0);
const style = (name: string) => (value: string) => ({ [name]: value });
const pxStyle = (...names: string[]) => (value: string) => Object.fromEntries(names.map((n) => [n, `${value}px`]));
const prop = (p: LiveProp, side?: Side) => (value: string) => ({ prop: p, side, value: `${value}px` });
const colour = (p: LiveProp) => (value: string) => ({ prop: p, value });
const family = (f: ClassFamily, make: (value: string) => string = (v) => v) => (value: string) => ({ prop: LiveProp.Class, family: f, value: make(value) });

const SHADOWS: Record<string, string> = { 'shadow-none': 'none', 'shadow-sm': '0 1px 3px rgb(0 0 0 / .1)', 'shadow-md': '0 4px 6px rgb(0 0 0 / .1)', 'shadow-lg': '0 10px 15px rgb(0 0 0 / .1)', 'shadow-xl': '0 20px 25px rgb(0 0 0 / .1)' };
const DIRECTIONS: Record<string, string> = { 'flex-row': 'row', 'flex-col': 'column' };
const ITEMS: Record<string, string> = { 'items-start': 'flex-start', 'items-center': 'center', 'items-end': 'flex-end', 'items-stretch': 'stretch' };
const JUSTIFY: Record<string, string> = { 'justify-start': 'flex-start', 'justify-center': 'center', 'justify-end': 'flex-end', 'justify-between': 'space-between' };
const ALIGN: Record<string, string> = { 'text-left': 'left', 'text-center': 'center', 'text-right': 'right' };
const WEIGHTS = ['300', '400', '500', '600', '700', '800'];

const keyOf = (table: Record<string, string>, css: string) => Object.entries(table).find(([, v]) => v === css)?.[0] ?? '';

export const ROWS: Row[] = [
  { section: Section.Layout, name: 'direction', label: 'Direction', control: Control.Choice, choices: Object.keys(DIRECTIONS), read: (s) => keyOf(DIRECTIONS, s['flex-direction']), preview: (v) => ({ display: 'flex', flexDirection: DIRECTIONS[v] }), change: family(ClassFamily.Direction) },
  { section: Section.Layout, name: 'align', label: 'Align', control: Control.Choice, choices: Object.keys(ITEMS), read: (s) => keyOf(ITEMS, s['align-items']), preview: (v) => ({ alignItems: ITEMS[v] }), change: family(ClassFamily.Items) },
  { section: Section.Layout, name: 'justify', label: 'Justify', control: Control.Choice, choices: Object.keys(JUSTIFY), read: (s) => keyOf(JUSTIFY, s['justify-content']), preview: (v) => ({ justifyContent: JUSTIFY[v] }), change: family(ClassFamily.Justify) },
  { section: Section.Layout, name: 'gap', label: 'G', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'gap'), preview: pxStyle('gap'), change: prop(LiveProp.Gap) },
  { section: Section.Size, name: 'width', label: 'W', control: Control.Number, range: SIZE, unit: 'px', read: (s) => px(s, 'width'), preview: pxStyle('width'), change: family(ClassFamily.Width, (v) => `w-[${v}px]`) },
  { section: Section.Size, name: 'height', label: 'H', control: Control.Number, range: SIZE, unit: 'px', read: (s) => px(s, 'height'), preview: pxStyle('height'), change: family(ClassFamily.Height, (v) => `h-[${v}px]`) },
  { section: Section.Spacing, name: 'padding-x', label: '↔', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'padding-left'), preview: pxStyle('paddingLeft', 'paddingRight'), change: prop(LiveProp.Padding, Side.X) },
  { section: Section.Spacing, name: 'padding-y', label: '↕', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'padding-top'), preview: pxStyle('paddingTop', 'paddingBottom'), change: prop(LiveProp.Padding, Side.Y) },
  { section: Section.Typography, name: 'font-size', label: 'Size', control: Control.Number, range: { min: 1, max: 400, step: 1 }, unit: 'px', read: (s) => px(s, 'font-size'), preview: pxStyle('fontSize'), change: prop(LiveProp.FontSize) },
  { section: Section.Typography, name: 'font-weight', label: 'Weight', control: Control.Choice, choices: WEIGHTS, read: (s) => s['font-weight'] ?? '', preview: style('fontWeight'), change: (value) => ({ prop: LiveProp.FontWeight, value }) },
  { section: Section.Typography, name: 'text-align', label: 'Align', control: Control.Choice, choices: Object.keys(ALIGN), read: (s) => keyOf(ALIGN, s['text-align']), preview: (v) => ({ textAlign: ALIGN[v] }), change: family(ClassFamily.TextAlign) },
  { section: Section.Colour, name: 'color', label: 'Text', control: Control.Colour, read: (s) => s.color ?? '', preview: style('color'), change: colour(LiveProp.Color) },
  { section: Section.Colour, name: 'fill', label: 'Fill', control: Control.Colour, read: (s) => s['background-color'] ?? '', preview: style('backgroundColor'), change: colour(LiveProp.Fill) },
  { section: Section.Radius, name: 'radius', label: 'R', control: Control.Number, range: PX, unit: 'px', read: (s) => px(s, 'border-radius'), preview: pxStyle('borderRadius'), change: prop(LiveProp.Radius) },
  { section: Section.Effects, name: 'opacity', label: 'Opacity', control: Control.Number, range: PERCENT, unit: '%', read: (s) => Math.round(parseFloat(s.opacity ?? '1') * 100), preview: (v) => ({ opacity: String(Number(v) / 100) }), change: family(ClassFamily.Opacity, (v) => `opacity-${v}`) },
  { section: Section.Effects, name: 'shadow', label: 'Shadow', control: Control.Choice, choices: Object.keys(SHADOWS), read: (s) => keyOf(SHADOWS, s['box-shadow']), preview: (v) => ({ boxShadow: SHADOWS[v] }), change: family(ClassFamily.Shadow) }
];

export const SECTIONS = Object.values(Section);
