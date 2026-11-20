import { describe, expect, it } from 'vitest';
import { routesOf, vueRouterPaths } from './routes';

describe('routesOf', () => {
  it('reads SvelteKit pages, dropping groups and dynamic segments', () => {
    const files = ['src/routes/+page.svelte', 'src/routes/pricing/+page.svelte', 'src/routes/(app)/dashboard/+page.svelte', 'src/routes/blog/[slug]/+page.svelte', 'src/routes/+layout.svelte', 'src/routes/api/+server.ts'];

    expect(routesOf(files)).toEqual(['/', '/dashboard', '/pricing']);
  });

  it('reads Next app router pages, dropping parallel and private folders', () => {
    const files = ['app/page.jsx', 'src/app/about/page.tsx', 'app/@modal/login/page.tsx', 'app/_lib/page.tsx', 'app/shop/[id]/page.tsx', 'app/layout.tsx'];

    expect(routesOf(files)).toEqual(['/', '/about']);
  });

  it('reads Next pages router files', () => {
    const files = ['pages/index.tsx', 'pages/contact.tsx', 'pages/docs/index.jsx', 'pages/_app.tsx', 'pages/api/hello.ts', 'pages/404.tsx', 'pages/u/[id].tsx'];

    expect(routesOf(files)).toEqual(['/', '/contact', '/docs']);
  });

  it('reads Nuxt pages', () => {
    expect(routesOf(['pages/index.vue', 'pages/about.vue', 'pages/team/[id].vue'])).toEqual(['/', '/about']);
  });

  it('keeps the app folder of a monorepo', () => {
    expect(routesOf(['apps/web/src/routes/pricing/+page.svelte'])).toEqual(['/pricing']);
  });

  it('is empty for a project with no route files', () => {
    expect(routesOf(['src/App.tsx', 'src/main.tsx'])).toEqual([]);
  });
});

describe('vueRouterPaths', () => {
  it('reads absolute static paths', () => {
    const text = `const routes = [\n  { path: '/', component: Home },\n  { path: "/about", component: About },\n  { path: '/u/:id', component: U },\n  { path: 'child', component: C }\n];`;

    expect(vueRouterPaths(text)).toEqual(['/', '/about']);
  });
});
