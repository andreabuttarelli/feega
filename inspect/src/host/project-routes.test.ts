import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRoutes, routesOf } from './project-routes';

describe('routesOf', () => {
  it('lists the page of every file, home first then alphabetical', () => {
    expect(routesOf(['src/routes/pricing/+page.svelte', 'src/routes/+page.svelte', 'src/routes/about/+page.svelte'])).toEqual([
      { route: '/', dynamic: false },
      { route: '/about', dynamic: false },
      { route: '/pricing', dynamic: false }
    ]);
  });

  it('keeps dynamic routes, marked', () => {
    expect(routesOf(['src/routes/blog/[slug]/+page.svelte', 'app/[...all]/page.tsx'])).toEqual([
      { route: '/[...all]', dynamic: true },
      { route: '/blog/[slug]', dynamic: true }
    ]);
  });

  it('skips components, private files and API routes', () => {
    expect(routesOf(['src/lib/Hero.svelte', 'pages/_app.tsx', 'pages/api/hello.ts', 'src/routes/api/+server.ts'])).toEqual([]);
  });

  it('lists one route once', () => {
    expect(routesOf(['pages/about.tsx', 'pages/about/index.tsx'])).toEqual([{ route: '/about', dynamic: false }]);
  });

  it('strips route groups', () => {
    expect(routesOf(['app/(shop)/cart/page.tsx'])).toEqual([{ route: '/cart', dynamic: false }]);
  });
});

function project(files: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'feega-routes-'));
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), '');
  }
  return root;
}

describe('listRoutes', () => {
  it('reads the routes of a SvelteKit project from disk', async () => {
    const root = project(['src/routes/+page.svelte', 'src/routes/docs/+page.svelte', 'src/routes/docs/[id]/+page.svelte', 'src/lib/Card.svelte']);

    expect(await listRoutes(root)).toEqual([
      { route: '/', dynamic: false },
      { route: '/docs', dynamic: false },
      { route: '/docs/[id]', dynamic: true }
    ]);
  });

  it('reads Astro and Next layouts', async () => {
    const root = project(['src/pages/index.astro', 'src/pages/blog/index.astro', 'app/team/page.tsx']);

    expect(await listRoutes(root)).toEqual([
      { route: '/', dynamic: false },
      { route: '/blog', dynamic: false },
      { route: '/team', dynamic: false }
    ]);
  });

  it('ignores node_modules', async () => {
    const root = project(['pages/index.tsx', 'node_modules/pkg/pages/index.tsx']);

    expect(await listRoutes(root)).toEqual([{ route: '/', dynamic: false }]);
  });

  it('is empty when the project has no file-based routes', async () => {
    expect(await listRoutes(project(['src/main.tsx']))).toEqual([]);
  });
});
