import { isProp, NodeKind, type Bound, type CodeNode, type ComponentSpec, type ElementNode, type PageSpec, type Rule, type SvgNode, type UseNode } from '../ir';
import { kebab } from '../naming';
import type { CodeFile } from '../model';
import { BASE_CSS, fontFaceCss, fontLinks, lookupOf, mediaBlocks, ruleBlock, stateBlocks, tokensCss, type TokenLookup } from './css';
import { escapeHtml, nodeLines, type Dialect } from './markup';
import { readme } from './project';
import { scenesOf, sceneConsts, THREE_VERSION } from './scene-files';
import { SCENE_RUNTIME } from './scene-three';
import { animatedNodes, animationCss, inView, INVIEW_CLASS, INVIEW_SCRIPT, PROPERTY_RULES, translates } from './keyframes';

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
  for (const f of node.forwards) {
    if (ctx.values.has(f.prop)) {
      values.set(f.name, ctx.values.get(f.prop)!);
    }
  }
  return nodeLines(spec.root, depth, dialect, { ...ctx, block: kebab(spec.name), values, extraClass: node.rules.length ? scopedClass(ctx.block, node.className) : null, root: spec.root });
}

function svgOf(node: SvgNode, ctx: Ctx): string {
  const cls = node.rules.length ? ` class="${scopedClass(ctx.block, node.className)}"` : '';
  return `<svg${cls}${inView(node) ? ` ${INVIEW_ATTR}` : ''} width="${node.width}" height="${node.height}" viewBox="0 0 ${node.width} ${node.height}" fill="none" aria-hidden="true">${node.markup}</svg>`;
}

const dialect: Dialect<Ctx> = {
  openTag: (node, ctx) => `<${node.tag}${classList(node, ctx)}${attrs(node, ctx)}${styleOf(node, ctx)}${inView(node) ? ` ${INVIEW_ATTR}` : ''}${node.scene ? ` data-scene="${node.scene.name}"` : ''}>`,
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
  const own = node.className && node.rules.length ? [...ruleBlock(`.${selector(node)}`, node.rules as Rule[], tokens), '', ...mediaBlocks(`.${selector(node)}`, node.media, tokens)] : [];
  const states = node.kind !== NodeKind.Use && node.className ? stateBlocks(`.${selector(node)}`, node.states, tokens) : [];
  const kids = node.kind === NodeKind.Element ? node.children.flatMap((c) => cssBlocks(c, selector, tokens)) : [];
  return [...own, ...states, ...kids];
}

export function stylesheet(root: ElementNode, block: string | null, tokens: TokenLookup): string {
  return cssBlocks(root, (n) => scopedClass(block, n.className), tokens).join('\n');
}

const INVIEW_ATTR = 'data-inview';

function animationFiles(page: PageSpec): CodeFile[] {
  const roots = [{ root: page.root, block: null as string | null }, ...page.components.map((c) => ({ root: c.root, block: kebab(c.name) }))];
  const nodes = roots.flatMap(({ root, block }) => animatedNodes(root).map((node) => ({ node, local: scopedClass(block, node.className) })));
  if (!nodes.length) {
    return [];
  }
  const properties = nodes.some(({ node }) => translates(node.animation)) ? [...PROPERTY_RULES, ''] : [];
  const css = nodes.flatMap(({ node, local }) => animationCss(node.animation, { base: `.${local}`, inView: `.${local}.${INVIEW_CLASS}` }, local));
  const script = nodes.some(({ node }) => inView(node)) ? [{ path: INVIEW_JS, content: [...INVIEW_SCRIPT, `document.querySelectorAll('[${INVIEW_ATTR}]').forEach((el) => seen.observe(el));`, ''].join('\n') }] : [];
  return [{ path: ANIMATIONS_CSS, content: [...properties, ...css].join('\n') }, ...script];
}

const ANIMATIONS_CSS = 'styles/animations.css';
const INVIEW_JS = 'scripts/inview.js';
const SCENES_JS = 'scripts/scenes.js';
const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/`;
const IMPORT_MAP = { imports: { three: `${THREE_CDN}build/three.module.js`, 'three/addons/': `${THREE_CDN}examples/jsm/` } };

const scenesScript = (scenes: ReturnType<typeof scenesOf>) => ["import * as THREE from 'three';", "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';", '', ...sceneConsts(scenes), '', SCENE_RUNTIME, `const SCENES = { ${scenes.map((s) => s.name).join(', ')} };`, "document.querySelectorAll('[data-scene]').forEach((el) => mountScene(el, SCENES[el.dataset.scene]));", ''].join('\n');

export function htmlProject(page: PageSpec): CodeFile[] {
  const tokens = lookupOf(page.tokens);
  const components = new Map(page.components.map((c) => [c.name, c]));
  const body = nodeLines(page.root, 2, dialect, { tokens, block: null, values: new Map(), components, extraClass: null, root: null });
  const componentCss = page.components.map((c) => ({ path: `styles/components/${kebab(c.name)}.css`, content: stylesheet(c.root, kebab(c.name), tokens) }));
  const animations = animationFiles(page);
  const has = (path: string) => animations.some((f) => f.path === path);
  const scenes = scenesOf(page);
  const three = scenes.length ? [`    <script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>`, `    <script type="module" src="${SCENES_JS}"></script>`] : [];
  const scripts = [...(has(INVIEW_JS) ? [`    <script src="${INVIEW_JS}" defer></script>`] : []), ...three];
  const fontCss = page.fonts.files.length ? ['styles/fonts.css'] : [];
  const links = [...fontCss, 'styles/tokens.css', 'styles/base.css', ...componentCss.map((c) => c.path), 'styles/page.css', ...(has(ANIMATIONS_CSS) ? [ANIMATIONS_CSS] : [])].map((href) => `    <link rel="stylesheet" href="${href}" />`);
  const html = ['<!doctype html>', '<html lang="en">', '  <head>', '    <meta charset="UTF-8" />', '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />', `    <title>${escapeHtml(page.name)}</title>`, ...fontLinks(page).map((l) => `    ${l}`), ...links, ...scripts, '  </head>', '  <body>', ...body, '  </body>', '</html>', ''];
  return [
    { path: 'README.md', content: readme(page, 'HTML + CSS', ['npx serve .'], 'styles/components/') },
    { path: 'index.html', content: html.join('\n') },
    ...(page.fonts.files.length ? [{ path: 'styles/fonts.css', content: fontFaceCss(page.fonts.files, (ref) => `../${ref}`) }] : []),
    { path: 'styles/tokens.css', content: tokensCss(page.tokens) },
    { path: 'styles/base.css', content: BASE_CSS },
    ...componentCss,
    { path: 'styles/page.css', content: stylesheet(page.root, null, tokens) },
    ...animations,
    ...(scenes.length ? [{ path: SCENES_JS, content: scenesScript(scenes) }] : [])
  ];
}
