import type { RegistryBundle } from './registry-item';

const REACT = 'https://esm.sh/react@19.1.0';
const REACT_DOM = 'https://esm.sh/react-dom@19.1.0';
const BABEL = 'https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.2/babel.min.js';
const TAILWIND = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.4';

const NEUTRAL_THEME = `
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0); --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0); --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0); --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0); --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0); --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0); --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0); --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0); --input: oklch(0.922 0 0); --ring: oklch(0.708 0 0);
}
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary); --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px); --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius); --radius-xl: calc(var(--radius) + 4px);
}
@layer base { * { @apply border-border; } body { @apply bg-background text-foreground; } }
`;

const UTILS = `import { clsx } from "https://esm.sh/clsx@2.1.1"; import { twMerge } from "https://esm.sh/tailwind-merge@3.0.2"; export function cn(...a) { return twMerge(clsx(a)); }`;

const LOADER = `
const { files, entry, props } = window.__component;
const baseOf = (p) => p.split('/').pop().replace(/\\.(t|j)sx?$/, '');
const urls = new Map();
const local = (spec) => spec === 'cn' || spec.startsWith('@/') || spec.startsWith('./') || spec.startsWith('../');
const external = (spec) => 'https://esm.sh/' + spec + '?external=react,react-dom';
const resolve = (spec) => {
  if (spec === 'cn' || spec.endsWith('/lib/utils')) return urls.get('__utils');
  if (local(spec)) return urls.get(baseOf(spec)) ?? urls.get('__utils');
  if (spec === 'react' || spec.startsWith('react/') || spec === 'react-dom' || spec.startsWith('react-dom/')) return spec;
  return external(spec);
};
const rewrite = (code) => code.replace(/(from\\s*|import\\s*\\(?\\s*)(["'])([^"']+)\\2/g, (m, head, q, spec) => head + q + resolve(spec) + q);
urls.set('__utils', URL.createObjectURL(new Blob([window.__utils], { type: 'text/javascript' })));
const compiled = files.map((f) => ({ f, code: Babel.transform(f.content, { filename: f.path, presets: [['typescript', { isTSX: true, allExtensions: true }], ['react', { runtime: 'automatic' }]] }).code }));
for (let pass = 0; pass < 2; pass++) {
  for (const { f, code } of [...compiled].reverse()) {
    urls.set(baseOf(f.path), URL.createObjectURL(new Blob([rewrite(code)], { type: 'text/javascript' })));
  }
}
const mod = await import(urls.get(baseOf(entry)));
const named = Object.entries(mod).find(([k, v]) => /^[A-Z]/.test(k) && (typeof v === 'function' || typeof v === 'object'));
const Component = mod.default ?? named?.[1];
const React = await import('react');
const { createRoot } = await import('react-dom/client');
createRoot(document.getElementById('root')).render(React.createElement(Component, props, props.children));
setTimeout(() => { document.documentElement.dataset.ready = '1'; }, 600);
`;

const cssBlock = (css: Record<string, unknown>): string =>
  Object.entries(css)
    .map(([selector, body]) => (typeof body === 'object' && body ? `${selector} { ${cssBlock(body as Record<string, unknown>)} }` : `${selector}: ${String(body)};`))
    .join('\n');

const themeBlock = (theme: Record<string, string>) =>
  Object.keys(theme).length
    ? `@theme inline { ${Object.entries(theme)
        .map(([k, v]) => `--${k}: ${v};`)
        .join(' ')} }`
    : '';

const FULL_PAGE_TYPES = ['registry:block', 'registry:page'];

const stage = (type: string) => (FULL_PAGE_TYPES.includes(type) ? '' : 'display:grid;place-items:center;min-height:100vh;padding:48px;box-sizing:border-box');

const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function previewPage(bundle: RegistryBundle, props: Record<string, unknown>): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${bundle.name}</title>
<script type="importmap">${json({ imports: { react: REACT, 'react/': `${REACT}/`, 'react-dom': REACT_DOM, 'react-dom/': `${REACT_DOM}/` } })}</script>
<script src="${TAILWIND}"></script>
<style type="text/tailwindcss">${NEUTRAL_THEME}${themeBlock(bundle.theme)}${cssBlock(bundle.css)}</style>
<script src="${BABEL}"></script>
<style>body{margin:0;font-family:Inter,ui-sans-serif,system-ui,sans-serif}#root{min-height:1px}</style>
</head><body><div id="root" style="${stage(bundle.type)}"></div>
<script>window.__component=${json({ files: bundle.files, entry: bundle.entry, props })};window.__utils=${json(UTILS)};</script>
<script type="module">${LOADER}</script>
</body></html>`;
}
