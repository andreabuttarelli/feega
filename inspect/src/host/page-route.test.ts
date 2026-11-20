import { describe, expect, it } from 'vitest';
import { routeOfFile } from './page-route';

describe('the route a page file renders', () => {
  it.each([
    ['src/routes/+page.svelte', '/'],
    ['src/routes/pricing/+page.svelte', '/pricing'],
    ['src/routes/(marketing)/about/+page.svelte', '/about'],
    ['app/page.tsx', '/'],
    ['src/app/blog/page.jsx', '/blog'],
    ['app/(site)/docs/page.tsx', '/docs'],
    ['pages/index.tsx', '/'],
    ['pages/contact.jsx', '/contact'],
    ['src/pages/about/index.astro', '/about'],
    ['pages/team.vue', '/team'],
    ['public/landing.html', '/landing.html']
  ])('%s → %s', (file, route) => {
    expect(routeOfFile(file)).toBe(route);
  });

  it('dynamic segments and components have no route', () => {
    expect(routeOfFile('src/routes/blog/[slug]/+page.svelte')).toBe(null);
    expect(routeOfFile('src/lib/Hero.svelte')).toBe(null);
    expect(routeOfFile('pages/_app.tsx')).toBe(null);
  });
});
