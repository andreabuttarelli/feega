export enum FolderShim {
  NextImage = 'next/image',
  NextLink = 'next/link',
  ArcFonts = 'arc-fonts'
}

export type SourceText = { path: string; text: string };

export type ShimFile = { path: string; content: string };

type Package = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const runsOnVite = (pkg: Package) => {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps.vite) && !deps.next;
};

const SHIM_DIR = 'node_modules/.feega';
export const SHIM_CONFIG = `${SHIM_DIR}/vite.config.mjs`;

const ARC_FONTS_SHEET = 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Inter:wght@100..900&display=swap';
const ARC_FONT_VARS = ':root{--font-geist:"Geist";--font-inter:"Inter";}';

const importsOf = (module: string) => new RegExp(`from\\s*['"]${module}['"]`);
const ARC_FONT_USE = /var\(\s*--font-(geist|inter)\b/;
const ARC_FONT_DECLARED = /--font-(geist|inter)\s*:/;

const NEXT_IMAGE = `import { createElement } from 'react';
const FILL = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
export default function Image({ fill, priority, sizes, quality, placeholder, blurDataURL, loader, unoptimized, style, ...rest }) {
  return createElement('img', { ...rest, style: fill ? { ...FILL, ...style } : style });
}
`;

const NEXT_LINK = `import { createElement, forwardRef } from 'react';
const hrefOf = (href) => (typeof href === 'string' ? href : (href?.pathname ?? '#'));
const Link = forwardRef(function Link({ href, prefetch, replace, scroll, shallow, passHref, legacyBehavior, locale, ...rest }, ref) {
  return createElement('a', { ...rest, ref, href: hrefOf(href) });
});
export default Link;
`;

type Shape = { test: (sources: SourceText[]) => boolean; files: ShimFile[]; alias: Record<string, string>; head: string[] };

const SHAPES: Record<FolderShim, Shape> = {
  [FolderShim.NextImage]: { test: (s) => s.some((f) => importsOf(FolderShim.NextImage).test(f.text)), files: [{ path: `${SHIM_DIR}/next-image.js`, content: NEXT_IMAGE }], alias: { [FolderShim.NextImage]: './next-image.js' }, head: [] },
  [FolderShim.NextLink]: { test: (s) => s.some((f) => importsOf(FolderShim.NextLink).test(f.text)), files: [{ path: `${SHIM_DIR}/next-link.js`, content: NEXT_LINK }], alias: { [FolderShim.NextLink]: './next-link.js' }, head: [] },
  [FolderShim.ArcFonts]: {
    test: (s) => s.some((f) => ARC_FONT_USE.test(f.text)) && !s.some((f) => ARC_FONT_DECLARED.test(f.text)),
    files: [],
    alias: {},
    head: [`{ tag: 'link', attrs: { rel: 'stylesheet', href: '${ARC_FONTS_SHEET}' }, injectTo: 'head-prepend' }`, `{ tag: 'style', children: '${ARC_FONT_VARS}', injectTo: 'head' }`]
  }
};

export function shimsFor(sources: SourceText[], pkg: Package): FolderShim[] {
  if (!runsOnVite(pkg)) {
    return [];
  }
  return (Object.values(FolderShim) as FolderShim[]).filter((shim) => SHAPES[shim].test(sources));
}

function configOf(shims: FolderShim[]): string {
  const alias = shims.flatMap((s) => Object.entries(SHAPES[s].alias)).map(([module, file]) => `'${module}': fileURLToPath(new URL('${file}', import.meta.url))`);
  const head = shims.flatMap((s) => SHAPES[s].head);
  return `import { fileURLToPath } from 'node:url';
import { loadConfigFromFile, mergeConfig } from 'vite';
const head = { name: 'feega-folder-shims', transformIndexHtml: () => [${head.join(', ')}] };
export default async (env) => {
  const own = await loadConfigFromFile(env, undefined, process.cwd());
  return mergeConfig(own?.config ?? {}, { resolve: { alias: { ${alias.join(', ')} } }, plugins: [head] });
};
`;
}

export function shimFiles(shims: FolderShim[]): ShimFile[] {
  return [...shims.flatMap((s) => SHAPES[s].files), { path: SHIM_CONFIG, content: configOf(shims) }];
}
