export enum TokenKind {
  Colour = 'color',
  Font = 'font',
  Space = 'space',
  Radius = 'radius'
}

export type Ref = { token: TokenKind; raw: string; before?: string; after?: string };

export type CssValue = string | Ref;

export type Rule = [property: string, value: CssValue];

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
  className: string;
  rules: Rule[];
  attrs: Attr[];
  children: CodeNode[];
  styleBinds: StyleBind[];
  shownBy?: string;
};

export type StyleBind = { property: string; prop: string };

export type TextNode = { kind: NodeKind.Text; value: Bound };

export type BreakNode = { kind: NodeKind.Break };

export type UseNode = { kind: NodeKind.Use; component: string; className: string; rules: Rule[]; props: { name: string; value: string | boolean }[]; shownBy?: string };

export type SvgNode = { kind: NodeKind.Svg; className: string; rules: Rule[]; width: number; height: number; markup: string; shownBy?: string };

export type CodeNode = ElementNode | TextNode | BreakNode | UseNode | SvgNode;

export enum PropType {
  Text = 'string',
  Flag = 'boolean'
}

export type PropSpec = { name: string; type: PropType; fallback: string | boolean | null };

export type ComponentSpec = { name: string; props: PropSpec[]; root: ElementNode; uses: string[] };

export type Token = { kind: TokenKind; name: string; raw: string; value: string };

export type PageSpec = { name: string; root: ElementNode; uses: string[]; components: ComponentSpec[]; tokens: Token[]; assets: { id: string; url: string | null }[]; notes: string[] };

export const isRef = (value: CssValue): value is Ref => typeof value !== 'string';

export const literal = (value: string): Bound => ({ literal: value });

export const isProp = (value: Bound): value is { prop: string } => 'prop' in value;
