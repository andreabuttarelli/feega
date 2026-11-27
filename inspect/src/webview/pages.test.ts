import { describe, expect, it } from 'vitest';
import { EXAMPLE_LIMIT, LINKED_CAP, addExample, linkedRoutes, pageRows, seenRoutes, type Found } from './pages';

const found = (route: string, dynamic = false) => ({ route, dynamic });
const none: Found = { seen: [], linked: [], manual: {} };
const knew = (partial: Partial<Found>): Found => ({ ...none, ...partial });

describe('seenRoutes', () => {
  it('remembers each route once, without query or hash', () => {
    expect(seenRoutes(seenRoutes(seenRoutes([], '/a?x=1'), '/a#top'), '/b')).toEqual(['/a', '/b']);
  });
});

describe('pageRows', () => {
  it('marks the page being previewed', () => {
    const rows = pageRows([found('/'), found('/about')], none, '/about?tab=2');

    expect(rows.map((r) => [r.route, r.current])).toEqual([
      ['/', false],
      ['/about', true]
    ]);
  });

  it('marks dynamic routes', () => {
    expect(pageRows([found('/blog/[slug]', true)], none, '/')[0]).toMatchObject({ dynamic: true, current: false, examples: [] });
  });

  it('adds visited routes the project does not declare, after the declared ones', () => {
    const rows = pageRows([found('/'), found('/blog/[slug]', true)], knew({ seen: ['/', '/pricing'] }), '/pricing');

    expect(rows.map((r) => r.route)).toEqual(['/', '/blog/[slug]', '/pricing']);
    expect(rows[2]).toMatchObject({ dynamic: false, current: true });
  });

  it('falls back to the visited routes when none are declared', () => {
    expect(pageRows([], knew({ seen: ['/', '/pricing'] }), '/pricing').map((r) => [r.route, r.current])).toEqual([
      ['/', false],
      ['/pricing', true]
    ]);
  });

  it('is empty before anything is known', () => {
    expect(pageRows([], none, '/')).toEqual([]);
  });
});

describe('linkedRoutes', () => {
  it('remembers the links of every page visited, once each', () => {
    expect(linkedRoutes(linkedRoutes([], ['/a', '/b']), ['/b', '/c'])).toEqual(['/a', '/b', '/c']);
  });

  it('stops growing at the cap', () => {
    const many = Array.from({ length: LINKED_CAP + 20 }, (_, i) => `/p${i}`);

    expect(linkedRoutes([], many)).toHaveLength(LINKED_CAP);
  });
});

describe('addExample', () => {
  it('keeps what was typed per pattern, without repeats', () => {
    const once = addExample({}, '/blog/[slug]', '/blog/a');
    const twice = addExample(addExample(once, '/blog/[slug]', '/blog/a'), '/u/[id]', '/u/1');

    expect(twice).toEqual({ '/blog/[slug]': ['/blog/a'], '/u/[id]': ['/u/1'] });
    expect(once).toEqual({ '/blog/[slug]': ['/blog/a'] });
  });
});

describe('examples of a dynamic route', () => {
  const blog = [found('/'), found('/blog/[slug]', true)];

  it('are the visited routes that match, not separate rows', () => {
    const rows = pageRows(blog, knew({ seen: ['/', '/blog/primo-post'] }), '/blog/primo-post');

    expect(rows.map((r) => r.route)).toEqual(['/', '/blog/[slug]']);
    expect(rows[1].examples).toEqual([{ path: '/blog/primo-post', label: 'primo-post', current: true }]);
  });

  it('include links found in the page', () => {
    const rows = pageRows(blog, knew({ linked: ['/blog/ciao-mondo', '/about'] }), '/');

    expect(rows[1].examples.map((e) => e.path)).toEqual(['/blog/ciao-mondo']);
  });

  it('include the ones typed by hand', () => {
    const rows = pageRows(blog, knew({ manual: { '/blog/[slug]': ['/blog/mio'] } }), '/');

    expect(rows[1].examples.map((e) => e.path)).toEqual(['/blog/mio']);
  });

  it('merge the three sources without repeats, visited first', () => {
    const rows = pageRows(blog, knew({ seen: ['/blog/b'], linked: ['/blog/a', '/blog/b'], manual: { '/blog/[slug]': ['/blog/c', '/blog/a'] } }), '/');

    expect(rows[1].examples.map((e) => e.path)).toEqual(['/blog/b', '/blog/a', '/blog/c']);
  });

  it('ignore a path that is a declared static route', () => {
    const rows = pageRows([found('/blog/new'), found('/blog/[slug]', true)], knew({ linked: ['/blog/new', '/blog/x'] }), '/');

    expect(rows[1].examples.map((e) => e.path)).toEqual(['/blog/x']);
  });

  it('belong only to the pattern they were typed for', () => {
    const rows = pageRows([found('/a/[x]', true), found('/b/[y]', true)], knew({ manual: { '/a/[x]': ['/a/1'] } }), '/');

    expect(rows.map((r) => r.examples.length)).toEqual([1, 0]);
  });

  it('are all kept in the data, the list shows EXAMPLE_LIMIT', () => {
    const linked = Array.from({ length: EXAMPLE_LIMIT + 5 }, (_, i) => `/blog/p${i}`);

    expect(pageRows(blog, knew({ linked }), '/')[1].examples).toHaveLength(EXAMPLE_LIMIT + 5);
  });
});
