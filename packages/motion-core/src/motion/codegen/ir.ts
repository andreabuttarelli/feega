import { DEFAULT_VARIANT } from '../doc';
import type { CodeEase } from './ease';

export enum TokenKind {
  Colour = 'color',
  Font = 'font',
  Space = 'space',
  Radius = 'radius'
}

export type Ref = { token: TokenKind; raw: string; before?: string; after?: string };

export type CssValue = string | Ref;

export type Rule = [property: string, value: CssValue];

export type MediaRules = { maxWidth: number; rules: Rule[] };

export type Bound = { literal: string } | { prop: string };

export type Attr = { name: string; value: Bound };

export enum NodeKind {
  Element = 'element',
  Text = 'text',
  Break = 'break',
  Use = 'use',
  Svg = 'svg'
}

export type ElementNode = {
  kind: NodeKind.Element;
  tag: string;
  clipId?: string;
  className: string;
  rules: Rule[];
  attrs: Attr[];
  children: CodeNode[];
  styleBinds: StyleBind[];
  shownBy?: string;
  animation?: Animation;
  media?: MediaRules[];
};

export type StyleBind = { property: string; prop: string };

export type TextNode = { kind: NodeKind.Text; value: Bound };

export type BreakNode = { kind: NodeKind.Break };

export type VariantPick = { name: string; value: string };

export type UseNode = { kind: NodeKind.Use; clipId?: string; component: string; set?: { name: string; variant: VariantPick[] }; className: string; rules: Rule[]; props: { name: string; value: string | boolean }[]; forwards: { name: string; prop: string }[]; shownBy?: string; media?: MediaRules[] };

export type SvgNode = { kind: NodeKind.Svg; clipId?: string; className: string; rules: Rule[]; width: number; height: number; markup: string; shownBy?: string; animation?: Animation; media?: MediaRules[] };

export enum Trigger {
  Load = 'load',
  InView = 'in-view',
  Hover = 'hover'
}

export enum Channel {
  X = 'x',
  Y = 'y',
  Scale = 'scale',
  Rotate = 'rotate',
  Opacity = 'opacity',
  Colour = 'color'
}

export type AnimTrack = { channel: Channel; values: (number | string)[]; times: number[]; eases: CodeEase[]; duration: number; delay: number; loop: boolean };

export type Animation = { trigger: Trigger; tracks: AnimTrack[] };

export type CodeNode = ElementNode | TextNode | BreakNode | UseNode | SvgNode;

export enum PropType {
  Text = 'string',
  Flag = 'boolean'
}

export type PropSpec = { name: string; type: PropType; fallback: string | boolean | null };

export type ComponentSpec = { name: string; props: PropSpec[]; root: ElementNode; uses: string[] };

export type SetSpec = { name: string; axes: { name: string; values: string[] }[]; members: { component: string; variant: Record<string, string> }[]; props: PropSpec[] };

export type Token = { kind: TokenKind; name: string; raw: string; value: string };

export type PageSpec = { name: string; root: ElementNode; uses: string[]; components: ComponentSpec[]; sets: SetSpec[]; tokens: Token[]; assets: { id: string; url: string | null }[]; notes: string[] };

const FLAGS = new Set(['true', 'false']);

export const isFlagAxis = (values: readonly string[]) => values.every((v) => v === DEFAULT_VARIANT || FLAGS.has(v));

const axisLiteral = (value: string, flag: boolean) => (flag ? value : `'${value}'`);

export function axisCondition(set: SetSpec, variant: Record<string, string>): string {
  return set.axes.map((axis) => {
    const value = variant[axis.name] ?? DEFAULT_VARIANT;
    return value === DEFAULT_VARIANT ? `${axis.name} === undefined` : `${axis.name} === ${axisLiteral(value, isFlagAxis(axis.values))}`;
  }).join(' && ');
}

export function fallbackMember(set: SetSpec): SetSpec['members'][number] {
  return set.members.find((m) => Object.values(m.variant).every((v) => v === DEFAULT_VARIANT)) ?? set.members[0];
}

export const axisType = (values: readonly string[]) => (isFlagAxis(values) ? 'boolean' : values.filter((v) => v !== DEFAULT_VARIANT).map((v) => `'${v}'`).join(' | '));

export const isRef = (value: CssValue): value is Ref => typeof value !== 'string';

export const literal = (value: string): Bound => ({ literal: value });

export const isProp = (value: Bound): value is { prop: string } => 'prop' in value;
