import { isProp, NodeKind, type Bound, type CodeNode, type ComponentSpec, type ElementNode, type PageSpec, type Rule, type SvgNode, type UseNode } from '../ir';
import { kebab } from '../naming';
import type { CodeFile } from '../model';
import { BASE_CSS, fontLinks, lookupOf, ruleBlock, tokensCss, type TokenLookup } from './css';
import { escapeHtml, nodeLines, type Dialect } from './markup';
import { readme } from './project';

type Ctx = { tokens: TokenLookup; block: string | null; values: Map<string, string | boolean>; components: Map<string, ComponentSpec>; extraClass: string | null; root: ElementNode | null };

export const scopedClass = (block: string | null, local: string) => (block && local !== block ? `${block}__${local}` : local);

const valueOf = (value: Bound, ctx: Ctx): string => (isProp(value) ? String(ctx.values.get(value.prop) ?? '') : value.literal);

function classList(node: ElementNode, ctx: Ctx): string {
  const own = node.className ? scopedClass(ctx.block, node.className) : '';
  const extra = node === ctx.root ? ctx.extraClass : null;
  const classes = [own, extra].filter(Boolean).join(' ');
  return classes ? ` class="${classes}"` : '';
}

function styleOf(node: ElementNode, ctx: Ctx): string {
  const binds = node.styleBinds.filter((b) => ctx.values.has(b.prop)).map((b) => `${b.property}: ${String(ctx.values.get(b.prop))}`);
  return binds.length ? ` style="${escapeHtml(binds.join('; '))}"` : '';
}

function attrs(node: ElementNode, ctx: Ctx): string {
  return node.attrs.map((a) => (!isProp(a.value) && a.value.literal === '' ? ` ${a.name}` : ` ${a.name}="${escapeHtml(valueOf(a.value, ctx))}"`)).join('');
}

function expand(node: UseNode, depth: number, ctx: Ctx): string[] {
  const spec = ctx.components.get(node.component);
  if (!spec) {
    return [];
  }
  const values = new Map<string, string | boolean>(spec.props.flatMap((p) => (p.fallback === null ? [] : [[p.name, p.fallback] as [string, string | boolean]])));
  for (const p of node.props) {
    values.set(p.name, p.value);
  }
  return nodeLines(spec.root, depth, dialect, { ...ctx, block: kebab(spec.name), values, extraClass: node.rules.length ? scopedClass(ctx.block, node.className) : null, root: spec.root });
}

function svgOf(node: SvgNode, ctx: Ctx): string {
  const cls = node.rules.length ? ` class="${scopedClass(ctx.block, node.className)}"` : '';
  return `<svg${cls} width="${node.width}" height="${node.height}" viewBox="0 0 ${node.width} ${node.height}" fill="none" aria-hidden="true">${node.markup}</svg>`;
}

const dialect: Dialect<Ctx> = {
  openTag: (node, ctx) => `<${node.tag}${classList(node, ctx)}${attrs(node, ctx)}${styleOf(node, ctx)}>`,
  text: (value, ctx) => escapeHtml(valueOf(value, ctx)).replace(/\n/g, '<br>'),
  lineBreak: '<br>',
  use: expand,
  svg: svgOf,
  shown: (prop, lines, _depth, ctx) => (ctx.values.get(prop) === false ? [] : lines),
  selfClosing: false
};

type Selector = (node: ElementNode | SvgNode | UseNode) => string;

function cssBlocks(node: CodeNode, selector: Selector, tokens: TokenLookup): string[] {
  if (node.kind === NodeKind.Text || node.kind === NodeKind.Break) {
    return [];
  }
  const own = node.className && node.rules.length ? [...ruleBlock(`.${selector(node)}`, node.rules as Rule[], tokens), ''] : [];
  const kids = node.kind === NodeKind.Element ? node.children.flatMap((c) => cssBlocks(c, selector, tokens)) : [];
  return [...own, ...kids];
}

export function stylesheet(root: ElementNode, block: string | null, tokens: TokenLookup): string {
  return cssBlocks(root, (n) => scopedClass(block, n.className), tokens).join('\n');
}

export function htmlProject(page: PageSpec): CodeFile[] {
  const tokens = lookupOf(page.tokens);
  const components = new Map(page.components.map((c) => [c.name, c]));
  const body = nodeLines(page.root, 2, dialect, { tokens, block: null, values: new Map(), components, extraClass: null, root: null });
  const componentCss = page.components.map((c) => ({ path: `styles/components/${kebab(c.name)}.css`, content: stylesheet(c.root, kebab(c.name), tokens) }));
  const links = ['styles/tokens.css', 'styles/base.css', ...componentCss.map((c) => c.path), 'styles/page.css'].map((href) => `    <link rel="stylesheet" href="${href}" />`);
  const html = ['<!doctype html>', '<html lang="en">', '  <head>', '    <meta charset="UTF-8" />', '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />', `    <title>${escapeHtml(page.name)}</title>`, ...fontLinks(page.tokens).map((l) => `    ${l}`), ...links, '  </head>', '  <body>', ...body, '  </body>', '</html>', ''];
  return [
    { path: 'README.md', content: readme(page, 'HTML + CSS', ['npx serve .'], 'styles/components/') },
    { path: 'index.html', content: html.join('\n') },
    { path: 'styles/tokens.css', content: tokensCss(page.tokens) },
    { path: 'styles/base.css', content: BASE_CSS },
    ...componentCss,
    { path: 'styles/page.css', content: stylesheet(page.root, null, tokens) }
  ];
}
