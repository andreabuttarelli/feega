import { describe, expect, it } from 'vitest';
import { Framework } from './run-plan';
import { CandidateFrom, discoverRoutes, DiscoveryRefusal, linkCandidates, routeTexts, RouteKind, Router, type Discovered } from './routes-discover';
import { nextPlayground, nextShadcnAdmin, nuxtDashboard, saasStarter, shadcnAdmin, svgl, traidue, vitesse } from './routes-discover.fixtures';

const paths = (found: Discovered) => (found.ok ? found.routes.map((r) => r.path) : found.refusal);
const sorted = (found: Discovered) => (found.ok ? found.routes.map((r) => r.path).sort() : found.refusal);
const facts = (files: string[], texts: Record<string, string> = {}) => ({ files, texts });

const ASTRO = ['package.json', 'src/pages/index.astro', 'src/pages/about.md', 'src/pages/blog/index.astro', 'src/pages/blog/[slug].astro', 'src/pages/docs/[...path].astro', 'src/pages/rss.xml.ts', 'src/pages/_drafts/wip.astro', 'src/pages/api/hello.ts', 'src/content/blog/first-post.md', 'src/content/blog/second.mdx'];

const NEXT_PAGES = ['package.json', 'pages/_app.tsx', 'pages/_document.tsx', 'pages/index.tsx', 'pages/about.tsx', 'pages/blog/index.tsx', 'pages/blog/[slug].tsx', 'pages/api/hello.ts', 'pages/docs/[[...slug]].tsx', 'pages/404.tsx'];

const NEXT_APP_EDGES = ['app/page.tsx', 'app/@modal/(.)photo/[id]/page.tsx', 'app/@modal/default.tsx', 'app/photo/[id]/page.tsx', 'app/(shop)/[[...category]]/page.tsx', 'app/_lib/page.tsx', 'app/posts/[id]/page.tsx'];

const REMIX_FLAT = ['app/root.tsx', 'app/routes/_index.tsx', 'app/routes/about.tsx', 'app/routes/blog._index.tsx', 'app/routes/blog.$slug.tsx', 'app/routes/_auth.tsx', 'app/routes/_auth.login.tsx', 'app/routes/dashboard.tsx', 'app/routes/dashboard.settings/route.tsx', 'app/routes/dashboard.settings/form.tsx', 'app/routes/files.$.tsx', 'app/routes/($lang).pricing.tsx', 'app/routes/api.users.ts', 'app/routes/sitemap[.]xml.ts'];

const SVELTEKIT_EDGES = ['src/routes/+page.svelte', 'src/routes/(app)/dashboard/+page.svelte', 'src/routes/[[lang]]/about/+page.svelte', 'src/routes/items/[id=integer]/+page.svelte', 'src/routes/reset/+page@.svelte', 'src/routes/blog/[slug]/+page.svelte', 'src/routes/blog/[slug]/+page.ts', 'src/routes/tags/[tag]/+page.svelte', 'src/routes/tags/[tag]/+page.server.ts', 'src/routes/api/+server.ts'];

const TANSTACK_EDGES = ['src/routes/__root.tsx', 'src/routes/index.lazy.tsx', 'src/routes/posts.$postId.tsx', 'src/routes/posts_.$postId.edit.tsx', 'src/routes/-components/card.tsx', 'src/routes/files/$.tsx', 'src/routes/{-$locale}/about.tsx'];

describe('discoverRoutes: one row per file router, modelled on real repositories', () => {
  it.each([
    { name: 'SvelteKit, traidue.com: wiki, quiz and service slugs, endpoints left out', framework: Framework.SvelteKit, files: traidue, expected: ['/', '/chi-siamo', '/cookie', '/famiglie', '/giovani', '/glossario', '/migliori-portali-informazione-trans', '/newsletter', '/operazioni', '/operazioni/[slug]', '/perche-ai', '/privacy', '/quiz', '/quiz/[slug]', '/servizi', '/servizi/[id]', '/termini', '/wiki', '/wiki/[slug]'] },
    { name: 'Next app router, next-shadcn-admin: (main) and (legacy) groups, a catch-all, _components skipped', framework: Framework.Next, files: nextShadcnAdmin, expected: ['/', '/auth/v1/login', '/auth/v1/register', '/auth/v2/login', '/auth/v2/register', '/chat', '/dashboard', '/dashboard/[...not-found]', '/dashboard/academy', '/dashboard/analytics', '/dashboard/analytics-v1', '/dashboard/calendar', '/dashboard/chat', '/dashboard/coming-soon', '/dashboard/crm', '/dashboard/crm-v1', '/dashboard/default', '/dashboard/default-v1', '/dashboard/ecommerce', '/dashboard/file-manager', '/dashboard/finance', '/dashboard/finance-v1', '/dashboard/infrastructure', '/dashboard/invoice', '/dashboard/kanban', '/dashboard/logistics', '/dashboard/mail', '/dashboard/patient-monitoring', '/dashboard/productivity', '/dashboard/products', '/dashboard/profile', '/dashboard/roles', '/dashboard/tasks', '/dashboard/users', '/mail', '/unauthorized'] },
    { name: 'TanStack Router, shadcn-admin: (groups), _pathless layouts, route.tsx, $param', framework: Framework.Vite, files: shadcnAdmin, expected: ['/', '/401', '/403', '/404', '/500', '/503', '/apps', '/chats', '/clerk', '/clerk/sign-in', '/clerk/sign-up', '/clerk/user-management', '/errors/[error]', '/forgot-password', '/help-center', '/otp', '/settings', '/settings/account', '/settings/appearance', '/settings/display', '/settings/notifications', '/sign-in', '/sign-in-2', '/sign-up', '/tasks', '/users'] },
    { name: 'Nuxt 4 app/pages, nuxt dashboard: settings.vue and settings/index.vue are one page', framework: Framework.Nuxt, files: nuxtDashboard, expected: ['/', '/customers', '/inbox', '/settings', '/settings/members', '/settings/notifications', '/settings/security'] },
    { name: 'SvelteKit, svgl: a page.server without +page.svelte is no page', framework: Framework.SvelteKit, files: svgl, expected: ['/', '/directory/[category]', '/docs/[...slug]', '/extensions', '/favorites'] },
    { name: 'Vite + Vue pages, vitesse: .vue and .md pages, README skipped', framework: Framework.Vite, files: vitesse, expected: ['/', '/[...all]', '/about', '/hi/[name]'] },
    { name: 'Next app router, saas-starter: (dashboard) and (login) groups', framework: Framework.Next, files: saasStarter, expected: ['/', '/dashboard', '/dashboard/activity', '/dashboard/general', '/dashboard/security', '/pricing', '/sign-in', '/sign-up'] },
    { name: 'Astro: .astro .md pages, endpoints and _underscored left out', framework: Framework.Astro, files: ASTRO, expected: ['/', '/about', '/blog', '/blog/[slug]', '/docs/[...path]'] },
    { name: 'Next pages router: _app, _document and api/ left out', framework: Framework.Next, files: NEXT_PAGES, expected: ['/', '/404', '/about', '/blog', '/blog/[slug]', '/docs/[[...slug]]'] },
    { name: 'Next app router: intercepting and private segments left out, @slots dropped', framework: Framework.Next, files: NEXT_APP_EDGES, expected: ['/', '/[[...category]]', '/photo/[id]', '/posts/[id]'] },
    { name: 'Remix flat routes: dots, _index, _pathless, $splat, ($optional), resource routes left out', framework: Framework.ReactRouter, files: REMIX_FLAT, expected: ['/', '/[[lang]]/pricing', '/about', '/blog', '/blog/[slug]', '/dashboard', '/dashboard/settings', '/files/[...splat]', '/login'] },
    { name: 'SvelteKit: groups, [[optional]], matchers and layout resets', framework: Framework.SvelteKit, files: SVELTEKIT_EDGES, expected: ['/', '/[[lang]]/about', '/blog/[slug]', '/dashboard', '/items/[id]', '/reset', '/tags/[tag]'] },
    { name: 'TanStack Router: flat dots, trailing _ unnests, -ignored, $ splat, {-$optional}', framework: Framework.Vite, files: TANSTACK_EDGES, expected: ['/', '/[[locale]]/about', '/files/[...splat]', '/posts/[postId]', '/posts/[postId]/edit'] }
  ])('$name', ({ framework, files, expected }) => {
    expect(sorted(discoverRoutes(facts(files), framework, ''))).toEqual(expected);
  });

  it('reads the app folder of a monorepo, not its siblings', () => {
    const files = ['apps/web/src/routes/+page.svelte', 'apps/web/src/routes/about/+page.svelte', 'apps/docs/src/routes/guide/+page.svelte'];
    expect(sorted(discoverRoutes(facts(files), Framework.SvelteKit, 'apps/web'))).toEqual(['/', '/about']);
  });

  it('lists / first, static before dynamic, shallow before deep, and selects only static pages', () => {
    const found = discoverRoutes(facts(traidue), Framework.SvelteKit, '');
    expect(paths(found)).toEqual(['/', '/chi-siamo', '/cookie', '/famiglie', '/giovani', '/glossario', '/migliori-portali-informazione-trans', '/newsletter', '/operazioni', '/perche-ai', '/privacy', '/quiz', '/servizi', '/termini', '/wiki', '/operazioni/[slug]', '/quiz/[slug]', '/servizi/[id]', '/wiki/[slug]']);
    const routes = found.ok ? found.routes : [];
    expect(routes.filter((r) => r.selected).every((r) => r.kind === RouteKind.Static)).toBe(true);
    expect(routes.find((r) => r.path === '/wiki/[slug]')).toMatchObject({ file: 'src/routes/wiki/[slug]/+page.svelte', router: Router.SvelteKit, kind: RouteKind.Dynamic, params: ['slug'], selected: false, candidates: [] });
  });

  it('refuses a framework with no file router instead of guessing', () => {
    expect(discoverRoutes(facts(['src/main.tsx', 'src/pages/Home.tsx']), Framework.Vite, '')).toMatchObject({ ok: false, refusal: DiscoveryRefusal.NoRouter });
    expect(discoverRoutes(facts(['src/App.tsx']), Framework.Cra, '')).toMatchObject({ ok: false, refusal: DiscoveryRefusal.NoRouter });
  });
});

describe('React Router 7 app/routes.ts: read only when it is plain literals', () => {
  const files = ['app/root.tsx', 'app/routes.ts', 'app/routes/home.tsx', 'app/routes/about.tsx', 'app/routes/product.tsx', 'app/routes/_index.tsx'];

  it.each([
    { name: 'flatRoutes() reads the flat routes folder', text: 'import { flatRoutes } from "@react-router/fs-routes";\nexport default flatRoutes() satisfies RouteConfig;', expected: ['/', '/about', '/home', '/product'] },
    { name: 'index() and route() literals', text: 'export default [\n  index("routes/home.tsx"),\n  route("about", "routes/about.tsx"),\n  route("products/:id/:tab?", "routes/product.tsx"),\n  route("files/*", "routes/files.tsx"),\n] satisfies RouteConfig;', expected: ['/', '/about', '/files/[...splat]', '/products/[id]/[[tab]]'] }
  ])('$name', ({ text, expected }) => {
    expect(sorted(discoverRoutes(facts(files, { 'app/routes.ts': text }), Framework.ReactRouter, ''))).toEqual(expected);
  });

  it.each([
    { name: 'layout() nesting', text: 'export default [layout("routes/shell.tsx", [index("routes/home.tsx")])] satisfies RouteConfig;' },
    { name: 'prefix()', text: 'export default [...prefix("admin", [route("users", "routes/users.tsx")])];' },
    { name: 'children arrays', text: 'export default [route("blog", "routes/blog.tsx", [route(":slug", "routes/post.tsx")])];' },
    { name: 'computed paths', text: 'const base = "x";\nexport default [route(base, "routes/x.tsx")];' }
  ])('$name: routes defined in code', ({ text }) => {
    expect(discoverRoutes(facts(files, { 'app/routes.ts': text }), Framework.ReactRouter, '')).toMatchObject({ ok: false, refusal: DiscoveryRefusal.InCode, reason: 'routes defined in code, not discoverable statically' });
  });

  it('asks for the text of routes.ts and of dynamic page sources only', () => {
    expect(routeTexts(files, Framework.ReactRouter, '')).toEqual(['app/routes.ts']);
    expect(routeTexts(SVELTEKIT_EDGES, Framework.SvelteKit, '')).toEqual(['src/routes/blog/[slug]/+page.ts', 'src/routes/tags/[tag]/+page.server.ts']);
    expect(routeTexts(NEXT_APP_EDGES, Framework.Next, '')).toEqual(['app/(shop)/[[...category]]/page.tsx', 'app/photo/[id]/page.tsx', 'app/posts/[id]/page.tsx']);
  });
});

describe('values for dynamic params from the code: only literal, unambiguous ones', () => {
  const candidates = (found: Discovered, path: string) => (found.ok ? (found.routes.find((r) => r.path === path)?.candidates ?? []) : []);

  it.each([
    { name: 'SvelteKit entries literal', framework: Framework.SvelteKit, files: SVELTEKIT_EDGES, texts: { 'src/routes/blog/[slug]/+page.ts': "export const entries = () => [{ slug: 'hello' }, { slug: \"world\" }];" }, path: '/blog/[slug]', expected: ['/blog/hello', '/blog/world'] },
    { name: 'SvelteKit entries computed', framework: Framework.SvelteKit, files: SVELTEKIT_EDGES, texts: { 'src/routes/tags/[tag]/+page.server.ts': 'export const entries = async () => (await tags()).map((tag) => ({ tag }));' }, path: '/tags/[tag]', expected: [] },
    { name: 'Next generateStaticParams literal', framework: Framework.Next, files: NEXT_APP_EDGES, texts: { 'app/posts/[id]/page.tsx': "export async function generateStaticParams() {\n  return [{ id: '1' }, { id: '2' }];\n}" }, path: '/posts/[id]', expected: ['/posts/1', '/posts/2'] },
    { name: 'Next generateStaticParams naming another param', framework: Framework.Next, files: NEXT_APP_EDGES, texts: { 'app/posts/[id]/page.tsx': "export function generateStaticParams() { return [{ slug: 'x' }]; }" }, path: '/posts/[id]', expected: [] },
    { name: 'Astro content collection that maps 1:1 to [slug]', framework: Framework.Astro, files: ASTRO, texts: {}, path: '/blog/[slug]', expected: ['/blog/first-post', '/blog/second'] },
    { name: 'traidue wiki: content nested by language and category is ambiguous', framework: Framework.SvelteKit, files: traidue, texts: {}, path: '/wiki/[slug]', expected: [] }
  ])('$name', ({ framework, files, texts, path, expected }) => {
    const found = candidates(discoverRoutes(facts(files, texts as Record<string, string>), framework, ''), path);
    expect(found.map((c) => c.path)).toEqual(expected);
    expect(found.every((c) => c.from === CandidateFrom.Code)).toBe(true);
  });
});

describe('linkCandidates: same-origin link paths from captured pages fill dynamic routes', () => {
  const found = discoverRoutes(facts(ASTRO), Framework.Astro, '');
  const routes = found.ok ? found.routes : [];

  it.each([
    { name: 'a matching path', links: ['/blog/hello'], path: '/blog/[slug]', expected: ['/blog/first-post', '/blog/second', '/blog/hello'] },
    { name: 'a deeper path does not fill a single param', links: ['/blog/a/b'], path: '/blog/[slug]', expected: ['/blog/first-post', '/blog/second'] },
    { name: 'a rest param takes several segments, once', links: ['/docs/guide/install', '/docs/guide/install'], path: '/docs/[...path]', expected: ['/docs/guide/install'] },
    { name: 'a link to a static page is not a value', links: ['/blog'], path: '/blog/[slug]', expected: ['/blog/first-post', '/blog/second'] }
  ])('$name', ({ links, path, expected }) => {
    const route = linkCandidates(routes, links).find((r) => r.path === path);
    expect(route?.candidates.map((c) => c.path)).toEqual(expected);
  });

  it('labels link values and keeps at most 8 per route', () => {
    const links = Array.from({ length: 30 }, (_, i) => `/blog/post-${i}`);
    const route = linkCandidates(routes, links).find((r) => r.path === '/blog/[slug]')!;
    expect(route.candidates).toHaveLength(8);
    expect(route.candidates.at(-1)).toEqual({ path: '/blog/post-5', from: CandidateFrom.Links });
  });
});
