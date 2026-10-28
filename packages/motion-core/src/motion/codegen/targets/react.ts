import { isProp, PropType, type Bound, type ComponentSpec, type PropSpec, type ElementNode, type PageSpec, type SvgNode, type UseNode, type Animation } from '../ir';
import { camel, pascal } from '../naming';
import { MOTION_IMPORT, MOTION_VERSION, motionFiles } from './react-motion';
import type { CodeFile } from '../model';
import { fontLinks, lookupOf, type TokenLookup } from './css';
import { tailwindOf } from './tailwind';
import { bindsOf, camelProperty, jsxSvg, nodeLines, pad, type Dialect } from './markup';
import { readme, themeCss } from './project';

type Ctx = { tokens: TokenLookup; root: ElementNode | null; file: string; anims: Map<string, Animation> };

function spread(node: { animation?: Animation; className: string }, ctx: Ctx): string {
  if (!node.animation) {
    return '';
  }
  const name = camel(`${ctx.file} ${node.className}`);
  ctx.anims.set(name, node.animation);
  return ` {...${name}}`;
}

const motionTag = (node: { tag: string; animation?: Animation }) => (node.animation ? `motion.${node.tag}` : node.tag);

const JSX_SPECIAL = /[{}<>]/;

const jsString = (text: string) => JSON.stringify(text);

const attrValue = (value: Bound) => (isProp(value) ? `{${value.prop}}` : JSX_SPECIAL.test(value.literal) || value.literal.includes('"') ? `{${jsString(value.literal)}}` : `"${value.literal}"`);

const BOOLEAN_ATTRS: Record<string, string> = { autoplay: 'autoPlay', muted: 'muted', loop: 'loop', playsinline: 'playsInline' };

function attrsOf(node: ElementNode): string {
  return node.attrs
    .map((a) => {
      const flag = BOOLEAN_ATTRS[a.name];
      if (flag && !isProp(a.value) && a.value.literal === '') {
        return ` ${flag}`;
      }
      return ` ${a.name}=${attrValue(a.value)}`;
    })
    .join('');
}

function classAttr(classes: string, isRoot: boolean): string {
  if (isRoot) {
    return classes ? ` className={cx(${jsString(classes)}, className)}` : ' className={className}';
  }
  return classes ? ` className="${classes}"` : '';
}

function styleAttr(node: ElementNode): string {
  const binds = bindsOf(node);
  return binds.length ? ` style={{ ${binds.map((b) => `${camelProperty(b.property)}: ${b.prop}`).join(', ')} }}` : '';
}

function useLines(node: UseNode, depth: number, ctx: Ctx): string[] {
  const classes = tailwindOf(node.rules, ctx.tokens, node.media);
  const props = node.props.map((p) => (typeof p.value === 'boolean' ? ` ${p.name}={${p.value}}` : ` ${p.name}=${attrValue({ literal: p.value })}`)).join('');
  const forwards = node.forwards.map((f) => ` ${f.name}={${f.prop}}`).join('');
  return [`${pad(depth)}<${node.component}${classes ? ` className="${classes}"` : ''}${props}${forwards} />`];
}

function svgOf(node: SvgNode, ctx: Ctx): string {
  const classes = tailwindOf(node.rules, ctx.tokens, node.media);
  const tag = motionTag({ tag: 'svg', animation: node.animation });
  return `<${tag}${spread(node, ctx)}${classes ? ` className="${classes}"` : ''} width={${node.width}} height={${node.height}} viewBox="0 0 ${node.width} ${node.height}" fill="none" aria-hidden="true">${jsxSvg(node.markup)}</${tag}>`;
}

const dialect: Dialect<Ctx> = {
  tagOf: motionTag,
  openTag: (node, ctx) => `<${motionTag(node)}${spread(node, ctx)}${classAttr(tailwindOf(node.rules, ctx.tokens, node.media), node === ctx.root)}${attrsOf(node)}${styleAttr(node)}>`,
  text: (value) => (isProp(value) ? `{${value.prop}}` : JSX_SPECIAL.test(value.literal) ? `{${jsString(value.literal)}}` : value.literal),
  lineBreak: '<br />',
  use: useLines,
  svg: svgOf,
  shown: (prop, lines, depth) => [`${pad(depth)}{${prop} && (`, ...lines.map((l) => `  ${l}`), `${pad(depth)})}`],
  selfClosing: true
};

const importsOf = (uses: readonly string[], from: string) => uses.map((u) => `import { ${u} } from '${from}${u}';`);

const motionImports = (own: Map<string, Animation>, from: string) => (own.size ? [MOTION_IMPORT, `import { ${[...own.keys()].sort().join(', ')} } from '${from}animations';`] : []);

function propType(spec: ComponentSpec): string[] {
  const fields = spec.props.map((p) => `  ${p.name}?: ${p.type};`);
  return [`export type ${spec.name}Props = {`, ...fields, '  className?: string;', '};'];
}

const paramOf = (p: PropSpec) => (p.fallback === null ? p.name : `${p.name} = ${p.type === PropType.Flag ? String(p.fallback) : jsString(String(p.fallback))}`);

function componentFile(spec: ComponentSpec, tokens: TokenLookup, anims: Map<string, Animation>): CodeFile {
  const params = [...spec.props.map(paramOf), 'className'].join(', ');
  const own = new Map<string, Animation>();
  const body = nodeLines(spec.root, 2, dialect, { tokens, root: spec.root, file: spec.name, anims: own });
  own.forEach((a, n) => anims.set(n, a));
  const content = [
    ...motionImports(own, '../'),
    "import { cx } from '../lib/cx';",
    ...importsOf(spec.uses, './'),
    '',
    ...propType(spec),
    '',
    `export function ${spec.name}({ ${params} }: ${spec.name}Props) {`,
    '  return (',
    ...body,
    '  );',
    '}',
    ''
  ].join('\n');
  return { path: `src/components/${spec.name}.tsx`, content };
}

function pageFile(page: PageSpec, name: string, tokens: TokenLookup, anims: Map<string, Animation>): CodeFile {
  const own = new Map<string, Animation>();
  const body = nodeLines(page.root, 2, dialect, { tokens, root: null, file: name, anims: own });
  own.forEach((a, n) => anims.set(n, a));
  const imports = [...motionImports(own, '../'), ...importsOf(page.uses, '../components/')];
  const content = [...imports, ...(imports.length ? [''] : []), `export function ${name}() {`, '  return (', ...body, '  );', '}', ''].join('\n');
  return { path: `src/pages/${name}.tsx`, content };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const PACKAGE = (name: string, animated: boolean) => ({
  name,
  private: true,
  version: '0.0.0',
  type: 'module',
  scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' },
  dependencies: { ...(animated ? { motion: MOTION_VERSION } : {}), react: '^19.0.0', 'react-dom': '^19.0.0' },
  devDependencies: { '@tailwindcss/vite': '^4.0.0', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', '@vitejs/plugin-react': '^4.3.0', tailwindcss: '^4.0.0', typescript: '^5.6.0', vite: '^6.0.0' }
});

const TSCONFIG = { compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true }, include: ['src'] };

export function reactProject(page: PageSpec, slug: string): CodeFile[] {
  const tokens = lookupOf(page.tokens);
  const name = pascal(page.name);
  const anims = new Map<string, Animation>();
  const sources = [pageFile(page, name, tokens, anims), ...page.components.map((c) => componentFile(c, tokens, anims))];
  const head = ['<!doctype html>', '<html lang="en">', '  <head>', '    <meta charset="UTF-8" />', '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />', `    <title>${page.name}</title>`, ...fontLinks(page.tokens).map((l) => `    ${l}`), '  </head>', '  <body>', '    <div id="root"></div>', '    <script type="module" src="/src/main.tsx"></script>', '  </body>', '</html>', ''];
  return [
    { path: 'README.md', content: readme(page, 'React + Tailwind CSS', ['npm install', 'npm run dev'], 'src/components/') },
    { path: 'package.json', content: json(PACKAGE(slug, anims.size > 0)) },
    { path: 'tsconfig.json', content: json(TSCONFIG) },
    { path: 'vite.config.ts', content: ["import { defineConfig } from 'vite';", "import react from '@vitejs/plugin-react';", "import tailwindcss from '@tailwindcss/vite';", '', 'export default defineConfig({ plugins: [react(), tailwindcss()] });', ''].join('\n') },
    { path: 'index.html', content: head.join('\n') },
    { path: 'src/main.tsx', content: ["import { StrictMode } from 'react';", "import { createRoot } from 'react-dom/client';", "import './index.css';", `import { ${name} } from './pages/${name}';`, '', "createRoot(document.getElementById('root')!).render(", '  <StrictMode>', `    <${name} />`, '  </StrictMode>', ');', ''].join('\n') },
    { path: 'src/index.css', content: ['@import "tailwindcss";', '@import "./tokens.css";', ''].join('\n') },
    { path: 'src/tokens.css', content: themeCss(page.tokens) },
    { path: 'src/lib/cx.ts', content: "export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');\n" },
    ...sources,
    ...motionFiles(anims)
  ];
}
