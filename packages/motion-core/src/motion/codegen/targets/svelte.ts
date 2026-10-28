import { isProp, NodeKind, PropType, type Bound, type CodeNode, type ComponentSpec, type PropSpec, type ElementNode, type PageSpec, type SvgNode, type UseNode } from '../ir';
import { kebab } from '../naming';
import type { CodeFile } from '../model';
import { BASE_CSS, fontLinks, lookupOf, ruleBlock, tokensCss, type TokenLookup } from './css';
import { escapeHtml, nodeLines, pad, type Dialect } from './markup';
import { readme } from './project';
import { animatedNodes, animationCss, inView, INVIEW_CLASS, INVIEW_SCRIPT, PROPERTY_RULES, translates } from './keyframes';

type Ctx = { tokens: TokenLookup; root: ElementNode | null; file: string };

const SVELTE_SPECIAL = /[{}<>&]/g;
const SVELTE_ESCAPES: Record<string, string> = { '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;', '&': '&amp;' };

const escapeText = (text: string) => text.replace(SVELTE_SPECIAL, (c) => SVELTE_ESCAPES[c]);

const attrValue = (value: Bound) => (isProp(value) ? `{${value.prop}}` : `"${escapeHtml(value.literal)}"`);

const instanceClass = (file: string, local: string) => `${file}-${local}`;

function classAttr(node: ElementNode, ctx: Ctx): string {
  if (node === ctx.root) {
    return ` class="${node.className} {className}"`;
  }
  return node.className ? ` class="${node.className}"` : '';
}

function attrs(node: ElementNode): string {
  return node.attrs.map((a) => (!isProp(a.value) && a.value.literal === '' ? ` ${a.name}` : ` ${a.name}=${attrValue(a.value)}`)).join('');
}

const styles = (node: ElementNode) => node.styleBinds.map((b) => ` style:${b.property}={${b.prop}}`).join('');

function useLines(node: UseNode, depth: number, ctx: Ctx): string[] {
  const cls = node.rules.length ? ` class="${instanceClass(ctx.file, node.className)}"` : '';
  const props = node.props.map((p) => (typeof p.value === 'boolean' ? ` ${p.name}={${p.value}}` : ` ${p.name}=${attrValue({ literal: p.value })}`)).join('');
  const forwards = node.forwards.map((f) => ` ${f.name}={${f.prop}}`).join('');
  return [`${pad(depth)}<${node.component}${cls}${props}${forwards} />`];
}

const svgOf = (node: SvgNode) => `<svg class="${node.className}"${inView(node) ? ' use:inview' : ''} width="${node.width}" height="${node.height}" viewBox="0 0 ${node.width} ${node.height}" fill="none" aria-hidden="true">${node.markup}</svg>`;

const dialect: Dialect<Ctx> = {
  openTag: (node, ctx) => `<${node.tag}${classAttr(node, ctx)}${attrs(node)}${styles(node)}${inView(node) ? ' use:inview' : ''}>`,
  text: (value) => (isProp(value) ? `{${value.prop}}` : escapeText(value.literal)),
  lineBreak: '<br />',
  use: useLines,
  svg: (node) => svgOf(node),
  shown: (prop, lines, depth) => [`${pad(depth)}{#if ${prop}}`, ...lines.map((l) => `  ${l}`), `${pad(depth)}{/if}`],
  selfClosing: false
};

function cssBlocks(node: CodeNode, ctx: Ctx): string[] {
  if (node.kind === NodeKind.Text || node.kind === NodeKind.Break || !node.className) {
    return node.kind === NodeKind.Element ? node.children.flatMap((c) => cssBlocks(c, ctx)) : [];
  }
  const selector = node.kind === NodeKind.Use ? `:global(.${instanceClass(ctx.file, node.className)})` : `.${node.className}`;
  const own = node.rules.length ? [...ruleBlock(selector, node.rules, ctx.tokens, '  '), ''] : [];
  const motion = node.kind !== NodeKind.Use && node.animation ? animationCss(node.animation, { base: `.${node.className}`, inView: `.${node.className}:global(.${INVIEW_CLASS})` }, node.className, '  ') : [];
  const kids = node.kind === NodeKind.Element ? node.children.flatMap((c) => cssBlocks(c, ctx)) : [];
  return [...own, ...motion, ...kids];
}

const styleTag = (root: ElementNode, ctx: Ctx) => {
  const blocks = cssBlocks(root, ctx);
  return blocks.length ? ['<style>', ...blocks.slice(0, -1), '</style>', ''] : [];
};

const imports = (uses: readonly string[], from: string, root: ElementNode) => [...uses.map((u) => `  import ${u} from '${from}${u}.svelte';`), ...(animatedNodes(root).some(inView) ? [`  import { inview } from '$lib/inview';`] : [])];

const INVIEW_ACTION = ['export function inview(node: Element) {', ...INVIEW_SCRIPT.map((l) => (l ? `  ${l}` : l)).slice(0, -1), '  seen.observe(node);', '  return { destroy: () => seen.disconnect() };', '}', ''];

const paramOf = (p: PropSpec) => (p.fallback === null ? p.name : `${p.name} = ${p.type === PropType.Flag ? String(p.fallback) : JSON.stringify(String(p.fallback))}`);

function componentFile(spec: ComponentSpec, tokens: TokenLookup): CodeFile {
  const ctx: Ctx = { tokens, root: spec.root, file: kebab(spec.name) };
  const fields = spec.props.map((p) => `${p.name}?: ${p.type};`);
  const params = [...spec.props.map(paramOf), "class: className = ''"].join(', ');
  const content = [
    '<script lang="ts">',
    ...imports(spec.uses, './', spec.root),
    `  type Props = { ${[...fields, 'class?: string;'].join(' ')} };`,
    '',
    `  let { ${params} }: Props = $props();`,
    '</script>',
    '',
    ...nodeLines(spec.root, 0, dialect, ctx),
    '',
    ...styleTag(spec.root, ctx)
  ].join('\n');
  return { path: `src/lib/components/${spec.name}.svelte`, content };
}

function pageFile(page: PageSpec, tokens: TokenLookup): CodeFile {
  const ctx: Ctx = { tokens, root: null, file: kebab(page.name) };
  const lines = imports(page.uses, '$lib/components/', page.root);
  const script = lines.length ? ['<script lang="ts">', ...lines, '</script>', ''] : [];
  const content = [...script, `<svelte:head>`, `  <title>${escapeHtml(page.name)}</title>`, `</svelte:head>`, '', ...nodeLines(page.root, 0, dialect, ctx), '', ...styleTag(page.root, ctx)].join('\n');
  return { path: 'src/routes/+page.svelte', content };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const PACKAGE = (name: string) => ({
  name,
  private: true,
  version: '0.0.0',
  type: 'module',
  scripts: { dev: 'vite dev', build: 'vite build', preview: 'vite preview' },
  devDependencies: { '@sveltejs/adapter-auto': '^6.0.0', '@sveltejs/kit': '^2.20.0', '@sveltejs/vite-plugin-svelte': '^5.0.0', svelte: '^5.0.0', typescript: '^5.6.0', vite: '^6.0.0' }
});

export function svelteProject(page: PageSpec, slug: string): CodeFile[] {
  const tokens = lookupOf(page.tokens);
  const animated = [page.root, ...page.components.map((c) => c.root)].flatMap(animatedNodes);
  const appHtml = ['<!doctype html>', '<html lang="en">', '  <head>', '    <meta charset="utf-8" />', '    <meta name="viewport" content="width=device-width, initial-scale=1" />', ...fontLinks(page.tokens).map((l) => `    ${l}`), '    %sveltekit.head%', '  </head>', '  <body>', '    <div style="display: contents">%sveltekit.body%</div>', '  </body>', '</html>', ''];
  return [
    { path: 'README.md', content: readme(page, 'SvelteKit (Svelte 5)', ['npm install', 'npm run dev'], 'src/lib/components/') },
    { path: 'package.json', content: json(PACKAGE(slug)) },
    { path: 'svelte.config.js', content: ["import adapter from '@sveltejs/adapter-auto';", '', 'export default { kit: { adapter: adapter() } };', ''].join('\n') },
    { path: 'vite.config.ts', content: ["import { sveltekit } from '@sveltejs/kit/vite';", "import { defineConfig } from 'vite';", '', 'export default defineConfig({ plugins: [sveltekit()] });', ''].join('\n') },
    { path: 'src/app.html', content: appHtml.join('\n') },
    { path: 'src/app.css', content: ["@import './lib/styles/tokens.css';", '', BASE_CSS, ...(animated.some((n) => translates(n.animation)) ? PROPERTY_RULES : [])].join('\n') },
    ...(animated.some(inView) ? [{ path: 'src/lib/inview.ts', content: INVIEW_ACTION.join('\n') }] : []),
    { path: 'src/lib/styles/tokens.css', content: tokensCss(page.tokens) },
    { path: 'src/routes/+layout.svelte', content: ['<script lang="ts">', "  import '../app.css';", '', '  let { children } = $props();', '</script>', '', '{@render children()}', ''].join('\n') },
    pageFile(page, tokens),
    ...page.components.map((c) => componentFile(c, tokens))
  ];
}
