import { NodeKind, type Attr, type Bound, type CodeNode, type ElementNode, type StyleBind, type SvgNode, type UseNode } from '../ir';

export type Dialect<C> = {
  openTag: (node: ElementNode, ctx: C) => string;
  text: (value: Bound, ctx: C) => string;
  lineBreak: string;
  use: (node: UseNode, depth: number, ctx: C) => string[];
  svg: (node: SvgNode, ctx: C) => string;
  shown: (prop: string, lines: string[], depth: number, ctx: C) => string[];
  selfClosing: boolean;
  tagOf?: (node: ElementNode) => string;
};

const tagName = <C>(node: ElementNode, dialect: Dialect<C>) => dialect.tagOf?.(node) ?? node.tag;

const INDENT = '  ';
const VOID_TAGS: ReadonlySet<string> = new Set(['img', 'br', 'input', 'hr']);
const INLINE_TAGS: ReadonlySet<string> = new Set(['span', 'a', 'strong', 'em']);
const MAX_INLINE = 100;

export const pad = (depth: number) => INDENT.repeat(depth);

const isInline = (node: CodeNode): boolean => node.kind === NodeKind.Text || node.kind === NodeKind.Break || (node.kind === NodeKind.Element && INLINE_TAGS.has(node.tag) && node.children.every(isInline));

function inline<C>(node: CodeNode, dialect: Dialect<C>, ctx: C): string {
  if (node.kind === NodeKind.Text) {
    return dialect.text(node.value, ctx);
  }
  if (node.kind === NodeKind.Break) {
    return dialect.lineBreak;
  }
  const element = node as ElementNode;
  return `${dialect.openTag(element, ctx)}${element.children.map((c) => inline(c, dialect, ctx)).join('')}</${tagName(element, dialect)}>`;
}

function elementLines<C>(node: ElementNode, depth: number, dialect: Dialect<C>, ctx: C): string[] {
  const open = dialect.openTag(node, ctx);
  if (VOID_TAGS.has(node.tag)) {
    return [`${pad(depth)}${dialect.selfClosing ? open.replace(/>$/, ' />') : open}`];
  }
  if (!node.children.length) {
    return [`${pad(depth)}${dialect.selfClosing ? open.replace(/>$/, ' />') : `${open}</${tagName(node, dialect)}>`}`];
  }
  if (node.children.every(isInline)) {
    const body = node.children.map((c) => inline(c, dialect, ctx)).join('');
    const line = `${pad(depth)}${open}${body}</${tagName(node, dialect)}>`;
    if (line.length <= MAX_INLINE || !body.includes(dialect.lineBreak)) {
      return [line];
    }
  }
  return [`${pad(depth)}${open}`, ...node.children.flatMap((c) => nodeLines(c, depth + 1, dialect, ctx)), `${pad(depth)}</${tagName(node, dialect)}>`];
}

export function nodeLines<C>(node: CodeNode, depth: number, dialect: Dialect<C>, ctx: C): string[] {
  const lines = ((): string[] => {
    switch (node.kind) {
      case NodeKind.Element:
        return elementLines(node, depth, dialect, ctx);
      case NodeKind.Use:
        return dialect.use(node, depth, ctx);
      case NodeKind.Svg:
        return dialect.svg(node, ctx).split('\n').map((l) => `${pad(depth)}${l}`);
      default:
        return [`${pad(depth)}${inline(node, dialect, ctx)}`];
    }
  })();
  const shownBy = 'shownBy' in node ? node.shownBy : undefined;
  return shownBy ? dialect.shown(shownBy, lines, depth, ctx) : lines;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);

export const literalAttrs = (attrs: readonly Attr[], value: (attr: Attr) => string) => attrs.map((a) => ` ${value(a)}`).join('');

export const camelProperty = (property: string) => property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export const bindsOf = (node: { styleBinds?: StyleBind[] }) => node.styleBinds ?? [];

const SVG_ATTR = /\s([a-z]+(?:-[a-z]+)+)=/g;

const STYLE_ATTR = /\sstyle="([^"]*)"/g;

const asAttributes = (style: string) =>
  style
    .split(';')
    .map((d) => d.split(':').map((part) => part.trim()))
    .filter(([name, value]) => name && value)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join('');

export const jsxSvg = (markup: string) =>
  markup
    .replace(STYLE_ATTR, (_, style: string) => asAttributes(style))
    .replace(SVG_ATTR, (_, name: string) => ` ${camelProperty(name)}=`)
    .replace(/\sclass=/g, ' className=')
    .replace(/xlink:href=/g, 'xlinkHref=');
