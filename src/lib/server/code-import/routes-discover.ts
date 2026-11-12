import { ParamKind, paramsOf, pathKey, routeMatches } from '$lib/canvas/route-pattern';
import { Framework, type RepoFacts } from './run-plan';

export enum Router {
  NextApp = 'next-app',
  NextPages = 'next-pages',
  SvelteKit = 'sveltekit',
  Nuxt = 'nuxt',
  VuePages = 'vue-pages',
  Astro = 'astro',
  RemixFlat = 'remix-flat',
  ReactRouterConfig = 'react-router-config',
  TanStack = 'tanstack'
}

export enum RouteKind {
  Static = 'static',
  Dynamic = 'dynamic'
}

export enum CandidateFrom {
  Code = 'code',
  Links = 'links'
}

export enum DiscoveryRefusal {
  NoRouter = 'no_router',
  InCode = 'routes_in_code'
}

export type Candidate = { path: string; from: CandidateFrom };

export type DiscoveredRoute = { path: string; file: string; router: Router; kind: RouteKind; params: string[]; selected: boolean; candidates: Candidate[] };

export type Discovered = { ok: true; routes: DiscoveredRoute[] } | { ok: false; refusal: DiscoveryRefusal; reason: string };

export const MAX_LISTED_ROUTES = 500;
export const MAX_CANDIDATES = 8;
const MAX_SOURCES = 40;

const REFUSAL_REASONS: Record<DiscoveryRefusal, string> = {
  [DiscoveryRefusal.NoRouter]: 'no file router this import can read: type the pages',
  [DiscoveryRefusal.InCode]: 'routes defined in code, not discoverable statically'
};

type AppFiles = { files: string[]; text: (rel: string) => string | undefined };

type Page = { segments: string[]; file: string };

type RouterRow = {
  frameworks: Framework[];
  applies: (app: AppFiles) => boolean;
  pages: (app: AppFiles) => Page[] | DiscoveryRefusal;
  sources: (file: string, app: AppFiles) => string[];
  configs: string[];
};

const GROUP = /^\(.*\)$/;
const NOT_A_ROUTE = /\.(test|spec|stories|d)\.[^.]+$/;
const extless = (rel: string) => rel.replace(/\.[^./]+$/, '');
const dirsOf = (rel: string) => rel.split('/').slice(0, -1);
const baseOf = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);
const withoutIndex = (parts: string[]) => (parts.at(-1) === 'index' ? parts.slice(0, -1) : parts);

function fileRouter(roots: string[], page: (rel: string) => string[] | null): (app: AppFiles) => Page[] {
  return (app) =>
    roots.flatMap((root) =>
      app.files.flatMap((file) => {
        if (!file.startsWith(`${root}/`) || NOT_A_ROUTE.test(file)) {
          return [];
        }
        const segments = page(file.slice(root.length + 1));
        return segments ? [{ segments, file }] : [];
      })
    );
}

const hasPages = (roots: string[], page: (rel: string) => string[] | null) => (app: AppFiles) => fileRouter(roots, page)(app).length > 0;

const NEXT_PAGE = /^page\.(tsx|ts|jsx|js|mdx|md)$/;
const INTERCEPTING = /^\(\.+\)/;

function nextAppPage(rel: string): string[] | null {
  if (!NEXT_PAGE.test(baseOf(rel))) {
    return null;
  }
  const dirs = dirsOf(rel);
  if (dirs.some((d) => d.startsWith('_') || INTERCEPTING.test(d))) {
    return null;
  }
  return dirs.filter((d) => !GROUP.test(d) && !d.startsWith('@'));
}

const SCRIPT_PAGE = /\.(tsx|ts|jsx|js|mdx|md)$/;

function nextPagesPage(rel: string): string[] | null {
  const parts = extless(rel).split('/');
  if (!SCRIPT_PAGE.test(rel) || parts[0] === 'api' || parts.some((p) => p.startsWith('_'))) {
    return null;
  }
  return withoutIndex(parts);
}

const SVELTE_PAGE = /^\+page(@[^.]*)?\.svelte$/;
const MATCHER = /\[(\[?(?:\.\.\.)?[^\]=]+)=[^\]]+\]/g;
const SVELTE_SOURCES = ['+page.ts', '+page.js', '+page.server.ts', '+page.server.js'];

function sveltePage(rel: string): string[] | null {
  return SVELTE_PAGE.test(baseOf(rel)) ? dirsOf(rel).filter((d) => !GROUP.test(d)).map((d) => d.replace(MATCHER, '[$1]')) : null;
}

const VUE_PAGE = /\.vue$/;
const MARKDOWN_PAGE = /\.md$/;
const README = /^readme\.md$/i;

function vuePage(rel: string): string[] | null {
  return VUE_PAGE.test(rel) ? withoutIndex(extless(rel).split('/').filter((p) => !GROUP.test(p))) : null;
}

const vueOrMarkdownPage = (rel: string) => (MARKDOWN_PAGE.test(rel) && !README.test(baseOf(rel)) ? withoutIndex(extless(rel).split('/')) : vuePage(rel));

const ASTRO_PAGE = /\.(astro|md|mdx|html)$/;

function astroPage(rel: string): string[] | null {
  const parts = extless(rel).split('/');
  return ASTRO_PAGE.test(rel) && !parts.some((p) => p.startsWith('_')) ? withoutIndex(parts) : null;
}

const FLAT_TOKEN = /(?:\[[^\]]*\]|[^.])+/g;

function flatSegment(token: string): string | null {
  if (token.startsWith('_')) {
    return null;
  }
  const literal = token.replace(/_$/, '');
  const optional = literal.match(/^\(\$(.+)\)$/);
  if (optional) {
    return `[[${optional[1]}]]`;
  }
  if (GROUP.test(literal)) {
    return null;
  }
  if (literal === '$') {
    return '[...splat]';
  }
  return literal.startsWith('$') ? `[${literal.slice(1)}]` : literal.replace(/[[\]]/g, '');
}

const flatSegments = (name: string) => (name.match(FLAT_TOKEN) ?? []).map(flatSegment).filter((s): s is string => s !== null);

const REMIX_FILE = /\.(tsx|jsx|mdx|md)$/;
const REMIX_FOLDER_FILE = /^route\.(tsx|jsx)$/;

function remixPage(rel: string): string[] | null {
  const parts = rel.split('/');
  if (parts.length === 1 && REMIX_FILE.test(rel)) {
    return flatSegments(extless(rel));
  }
  return parts.length === 2 && REMIX_FOLDER_FILE.test(parts[1]) ? flatSegments(parts[0]) : null;
}

const RR_CONFIGS = ['app/routes.ts', 'app/routes.js'];
const FLAT_ROUTES = /\bflatRoutes\s*\(/;
const NESTING = /\b(?:layout|prefix)\s*\(|\.\.\./;
const CONFIG_CALL = /\b(index|route)\s*\(([^)]*)\)/g;
const INDEX_ARGS = /^\s*(['"])([^'"]+)\1\s*,?\s*$/;
const ROUTE_ARGS = /^\s*(['"])([^'"]*)\1\s*,\s*(['"])([^'"]+)\3\s*,?\s*$/;

const configOf = (app: AppFiles) => RR_CONFIGS.find((c) => app.files.includes(c)) ?? null;

function configSegment(part: string): string {
  if (part === '*') {
    return '[...splat]';
  }
  const param = part.match(/^:(.+?)(\?)?$/);
  if (!param) {
    return part;
  }
  return param[2] ? `[[${param[1]}]]` : `[${param[1]}]`;
}

function configPages(app: AppFiles): Page[] | DiscoveryRefusal {
  const config = configOf(app);
  const text = config ? app.text(config) : undefined;
  if (text === undefined || NESTING.test(text)) {
    return DiscoveryRefusal.InCode;
  }
  const pages: Page[] = [];
  for (const [, kind, args] of text.matchAll(CONFIG_CALL)) {
    const index = kind === 'index' ? args.match(INDEX_ARGS) : null;
    const route = kind === 'route' ? args.match(ROUTE_ARGS) : null;
    if (!index && !route) {
      return DiscoveryRefusal.InCode;
    }
    pages.push(index ? { segments: [], file: `app/${index[2]}` } : { segments: route![2].split('/').filter(Boolean).map(configSegment), file: `app/${route![4]}` });
  }
  return pages.length ? pages : DiscoveryRefusal.InCode;
}

const flatConfigured = (app: AppFiles) => {
  const config = configOf(app);
  return config === null || FLAT_ROUTES.test(app.text(config) ?? '');
};

const TANSTACK_ROOTS = ['src/routes', 'app/routes'];
const TANSTACK_MARKER = /^__root\.(tsx|ts|jsx|js)$/;
const TANSTACK_FILE = /\.(tsx|ts|jsx|js)$/;

function tanstackSegment(token: string, last: boolean): string | null {
  if (token === 'index' || (last && token === 'route') || GROUP.test(token) || token.startsWith('_')) {
    return null;
  }
  const literal = token.replace(/_$/, '');
  const optional = literal.match(/^\{-\$(.+)\}$/);
  if (optional) {
    return `[[${optional[1]}]]`;
  }
  if (literal === '$') {
    return '[...splat]';
  }
  return literal.startsWith('$') ? `[${literal.slice(1)}]` : literal;
}

function tanstackPage(rel: string): string[] | null {
  const name = extless(rel).replace(/\.lazy$/, '');
  if (!TANSTACK_FILE.test(rel) || name.split('/').some((p) => p.startsWith('-') || p === '__root')) {
    return null;
  }
  const tokens = name.split(/[/.]/);
  return tokens.map((t, i) => tanstackSegment(t, i === tokens.length - 1)).filter((s): s is string => s !== null);
}

const hasTanstackRoot = (app: AppFiles) => TANSTACK_ROOTS.some((root) => app.files.some((f) => f.startsWith(`${root}/`) && TANSTACK_MARKER.test(f.slice(root.length + 1))));

const itself = (file: string) => [file];
const none = () => [];
const svelteSources = (file: string, app: AppFiles) => SVELTE_SOURCES.map((s) => `${file.slice(0, file.lastIndexOf('/') + 1)}${s}`).filter((s) => app.files.includes(s));

const always = () => true;

const NEXT_APP_ROOTS = ['app', 'src/app'];
const NEXT_PAGES_ROOTS = ['pages', 'src/pages'];
const NUXT_ROOTS = ['app/pages', 'pages'];
const SRC_PAGES = ['src/pages'];

const ROUTERS: Record<Router, RouterRow> = {
  [Router.NextApp]: { frameworks: [Framework.Next], applies: always, pages: fileRouter(NEXT_APP_ROOTS, nextAppPage), sources: itself, configs: [] },
  [Router.NextPages]: { frameworks: [Framework.Next], applies: always, pages: fileRouter(NEXT_PAGES_ROOTS, nextPagesPage), sources: none, configs: [] },
  [Router.SvelteKit]: { frameworks: [Framework.SvelteKit], applies: always, pages: fileRouter(['src/routes'], sveltePage), sources: svelteSources, configs: [] },
  [Router.Nuxt]: { frameworks: [Framework.Nuxt], applies: always, pages: fileRouter(NUXT_ROOTS, vuePage), sources: none, configs: [] },
  [Router.VuePages]: { frameworks: [Framework.Vite], applies: hasPages(SRC_PAGES, vuePage), pages: fileRouter(SRC_PAGES, vueOrMarkdownPage), sources: none, configs: [] },
  [Router.Astro]: { frameworks: [Framework.Astro], applies: always, pages: fileRouter(SRC_PAGES, astroPage), sources: none, configs: [] },
  [Router.RemixFlat]: { frameworks: [Framework.ReactRouter], applies: flatConfigured, pages: fileRouter(['app/routes'], remixPage), sources: none, configs: RR_CONFIGS },
  [Router.ReactRouterConfig]: { frameworks: [Framework.ReactRouter], applies: (app) => !flatConfigured(app), pages: configPages, sources: none, configs: RR_CONFIGS },
  [Router.TanStack]: { frameworks: [Framework.Vite, Framework.Generic], applies: hasTanstackRoot, pages: fileRouter(TANSTACK_ROOTS, tanstackPage), sources: none, configs: [] }
};

const prefixOf = (appDir: string) => (appDir ? `${appDir}/` : '');

function appFiles(facts: RepoFacts, appDir: string): AppFiles {
  const prefix = prefixOf(appDir);
  return { files: facts.files.filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length)), text: (rel) => facts.texts[`${prefix}${rel}`] };
}

const rowsFor = (framework: Framework) => (Object.entries(ROUTERS) as [Router, RouterRow][]).filter(([, row]) => row.frameworks.includes(framework));

const pathOf = (segments: string[]) => `/${segments.join('/')}`;

export function routeTexts(files: readonly string[], framework: Framework, appDir: string): string[] {
  const app = appFiles({ files, texts: {} }, appDir);
  const wanted = rowsFor(framework).flatMap(([, row]) => {
    const configs = row.configs.filter((c) => app.files.includes(c));
    const pages = row.applies(app) ? row.pages(app) : [];
    const dynamic = Array.isArray(pages) ? pages.filter((p) => paramsOf(pathOf(p.segments)).length) : [];
    return [...configs, ...dynamic.flatMap((p) => row.sources(p.file, app))];
  });
  return [...new Set(wanted)].sort().slice(0, MAX_SOURCES).map((f) => `${prefixOf(appDir)}${f}`);
}

const HINT_KEYWORD = /\b(?:generateStaticParams|entries)\b/;
const OBJECT_LIST = /^\s*(?:\{[^{}]*\}\s*,?\s*)+$/;
const LITERAL_PROP = /^(\w+)\s*:\s*(['"])([^'"]*)\2$/;

function literalParams(text: string): Record<string, string>[] | null {
  const at = text.search(HINT_KEYWORD);
  const open = at < 0 ? -1 : text.indexOf('[', at);
  const close = open < 0 ? -1 : text.indexOf(']', open);
  const body = close < 0 ? '' : text.slice(open + 1, close);
  if (!OBJECT_LIST.test(body)) {
    return null;
  }
  const objects = [...body.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.match(LITERAL_PROP)));
  if (objects.some((props) => props.some((p) => p === null))) {
    return null;
  }
  return objects.map((props) => Object.fromEntries(props.map((p) => [p![1], p![3]])));
}

const FILLED: Record<ParamKind, (value: string) => string> = {
  [ParamKind.One]: encodeURIComponent,
  [ParamKind.Optional]: encodeURIComponent,
  [ParamKind.Rest]: (v) => v.split('/').map(encodeURIComponent).join('/'),
  [ParamKind.OptionalRest]: (v) => v.split('/').map(encodeURIComponent).join('/')
};

function filled(pattern: string, values: Record<string, string>): string | null {
  const params = paramsOf(pattern);
  const names = params.map((p) => p.name);
  if (Object.keys(values).some((k) => !names.includes(k)) || params.some((p) => !values[p.name])) {
    return null;
  }
  return params.reduce((path, p) => path.replace(p.token, FILLED[p.kind](values[p.name])), pattern);
}

function codeValues(page: Page, row: RouterRow, app: AppFiles): string[] {
  const pattern = pathOf(page.segments);
  const texts = row.sources(page.file, app).map((s) => app.text(s) ?? '');
  const listed = texts.map(literalParams).find((v) => v !== null);
  return listed ? listed.map((v) => filled(pattern, v)).filter((p): p is string => p !== null) : contentValues(page.segments, app);
}

const CONTENT_ROOTS = ['src/content', 'content'];
const CONTENT_FILE = /\.(md|mdx)$/;

function contentValues(segments: string[], app: AppFiles): string[] {
  const last = paramsOf(segments.at(-1) ?? '');
  const parents = segments.slice(0, -1);
  if (last.length !== 1 || last[0].token !== segments.at(-1) || !parents.length || parents.some((s) => paramsOf(s).length)) {
    return [];
  }
  const folders = CONTENT_ROOTS.map((root) => `${root}/${parents.at(-1)}/`).map((dir) => app.files.filter((f) => f.startsWith(dir)).map((f) => f.slice(dir.length))).filter((found) => found.length);
  if (folders.length !== 1 || folders[0].some((f) => f.includes('/'))) {
    return [];
  }
  return folders[0].filter((f) => CONTENT_FILE.test(f)).map(extless).filter((n) => n !== 'index').map((n) => `${pathOf(parents)}/${encodeURIComponent(n)}`);
}

const depthOf = (path: string) => path.split('/').filter(Boolean).length;
const ordered = (a: DiscoveredRoute, b: DiscoveredRoute) => Number(a.path !== '/') - Number(b.path !== '/') || Number(a.kind === RouteKind.Dynamic) - Number(b.kind === RouteKind.Dynamic) || depthOf(a.path) - depthOf(b.path) || a.path.localeCompare(b.path);

export function discoverRoutes(facts: RepoFacts, framework: Framework, appDir: string): Discovered {
  const app = appFiles(facts, appDir);
  const rows = rowsFor(framework).filter(([, row]) => row.applies(app));
  const found = rows.map(([router, row]) => ({ router, row, pages: row.pages(app) }));
  const refused = found.find((f) => !Array.isArray(f.pages))?.pages as DiscoveryRefusal | undefined;
  if (refused) {
    return { ok: false, refusal: refused, reason: REFUSAL_REASONS[refused] };
  }

  const routes = new Map<string, DiscoveredRoute>();
  for (const { router, row, pages } of found) {
    for (const page of [...(pages as Page[])].sort((a, b) => a.file.localeCompare(b.file))) {
      const path = pathOf(page.segments);
      if (routes.has(path)) {
        continue;
      }
      const params = paramsOf(path).map((p) => p.name);
      const kind = params.length ? RouteKind.Dynamic : RouteKind.Static;
      const candidates = kind === RouteKind.Dynamic ? codeValues(page, row, app).slice(0, MAX_CANDIDATES).map((p) => ({ path: p, from: CandidateFrom.Code })) : [];
      routes.set(path, { path, file: `${prefixOf(appDir)}${page.file}`, router, kind, params, selected: kind === RouteKind.Static, candidates });
    }
  }

  if (!routes.size) {
    return { ok: false, refusal: DiscoveryRefusal.NoRouter, reason: REFUSAL_REASONS[DiscoveryRefusal.NoRouter] };
  }
  return { ok: true, routes: [...routes.values()].sort(ordered).slice(0, MAX_LISTED_ROUTES) };
}

function sameOrigin(link: string, origin: string): string | null {
  if (!URL.canParse(link, origin)) {
    return null;
  }
  const url = new URL(link, origin);
  return url.origin === origin ? pathKey(url.pathname) || '/' : null;
}

export function linkCandidates(routes: DiscoveredRoute[], links: readonly string[], origin: string): DiscoveredRoute[] {
  const statics = new Set(routes.filter((r) => r.kind === RouteKind.Static).map((r) => r.path));
  const paths = [...new Set(links.map((l) => sameOrigin(l, origin)).filter((p): p is string => p !== null && !statics.has(p)))];
  return routes.map((route) => {
    if (route.kind === RouteKind.Static) {
      return route;
    }
    const known = new Set(route.candidates.map((c) => c.path));
    const found = paths.filter((p) => !known.has(p) && routeMatches(route.path, p)).map((p) => ({ path: p, from: CandidateFrom.Links }));
    return { ...route, candidates: [...route.candidates, ...found].slice(0, MAX_CANDIDATES) };
  });
}
