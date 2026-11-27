import { describe, expect, it } from 'vitest';
import { pageRows, seenRoutes } from './pages';

const found = (route: string, dynamic = false) => ({ route, dynamic });

describe('seenRoutes', () => {
  it('remembers each route once, without query or hash', () => {
    expect(seenRoutes(seenRoutes(seenRoutes([], '/a?x=1'), '/a#top'), '/b')).toEqual(['/a', '/b']);
  });
});

describe('pageRows', () => {
  it('marks the page being previewed', () => {
    const rows = pageRows([found('/'), found('/about')], [], '/about?tab=2');

    expect(rows.map((r) => [r.route, r.current])).toEqual([
      ['/', false],
      ['/about', true]
    ]);
  });

  it('marks dynamic routes', () => {
    expect(pageRows([found('/blog/[slug]', true)], [], '/')[0]).toMatchObject({ dynamic: true, current: false });
  });

  it('adds visited routes the project does not declare, after the declared ones', () => {
    const rows = pageRows([found('/'), found('/blog/[slug]', true)], ['/', '/blog/hello'], '/blog/hello');

    expect(rows.map((r) => r.route)).toEqual(['/', '/blog/[slug]', '/blog/hello']);
    expect(rows[2]).toMatchObject({ dynamic: false, current: true });
  });

  it('falls back to the visited routes when none are declared', () => {
    expect(pageRows([], ['/', '/pricing'], '/pricing').map((r) => [r.route, r.current])).toEqual([
      ['/', false],
      ['/pricing', true]
    ]);
  });

  it('is empty before anything is known', () => {
    expect(pageRows([], [], '/')).toEqual([]);
  });
});
