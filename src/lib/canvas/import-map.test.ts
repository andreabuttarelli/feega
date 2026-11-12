import { describe, expect, it } from 'vitest';
import { codeOriginSchema } from './motion-node';
import { boardsUsed, condKey, importMapSchema, mapRows, mergedMap, PageAction, PageState, Shown } from './import-map';

const ROUTES = Array.from({ length: 20 }, (_, i) => `/page-${i}`);

const MAP = {
  rev: 'abc1234',
  pages: [
    { path: '/', state: 'imported', boards: [{ cond: 'light@1280', clip: 'b1' }, { cond: 'dark@390', clip: 'b2' }] },
    { path: '/pricing', state: 'not_selected' },
    { path: '/blog/[slug]', state: 'needs_value', values: ['/blog/hello'] },
    { path: '/broken', state: 'failed', reason: 'could not be opened' },
    { path: '/account', state: 'locked', reason: 'went to the sign-in page' }
  ],
  library: { captured: ['Button'], uncaptured: ['Callout'] },
  design: { tokens: 12, styles: 3, bound: 40, unbound: 5 }
};

describe('the code origin keeps the import map', () => {
  it('round-trips the map and every route of a 20-page import through the schema', () => {
    const origin = { kind: 'folder', repo: '/tmp/app', branch: null, sha: 'abc1234', routes: ROUTES, map: MAP };

    const read = codeOriginSchema.parse(JSON.parse(JSON.stringify(origin)));

    expect(read.routes).toEqual(ROUTES);
    expect(read.map).toEqual(MAP);
  });
});

describe('the rows of the import map', () => {
  const map = importMapSchema.parse(MAP);

  it('a page whose boards are all gone from the frame reads as not on canvas, with Import', () => {
    const rows = mapRows(map, (clip) => clip !== 'b1' && clip !== 'b2');

    expect(rows[0]).toMatchObject({ path: '/', shown: Shown.Removed, rule: { action: PageAction.Import } });
  });

  it('each state has its action, and an imported page lists the conditions it still lacks', () => {
    const rows = mapRows(map, () => true);

    expect(rows.map((r) => r.rule.action)).toEqual([PageAction.Zoom, PageAction.Import, PageAction.SetValue, PageAction.Retry, PageAction.SignIn]);
    expect(rows[0].missing.map(condKey)).not.toContain('dark@390');
    expect(rows[0].missing).toHaveLength(4);
  });

  it('counts only boards still in the frame against the limit', () => {
    expect(boardsUsed(map, (clip) => clip === 'b1')).toBe(1);
  });
});

describe('merging the map of an incremental import', () => {
  const before = importMapSchema.parse(MAP);

  it('adds a condition to an imported page and keeps pages the new run left out as they were', () => {
    const after = { rev: 'def5678', pages: [{ path: '/', state: PageState.Imported, boards: [{ cond: 'dark@1280', clip: 'b9' }] }, { path: '/pricing', state: PageState.Imported, boards: [{ cond: 'light@1280', clip: 'b8' }] }] };

    const merged = mergedMap(before, after);

    expect(merged.pages.find((p) => p.path === '/')?.boards?.map((b) => b.cond)).toEqual(['light@1280', 'dark@390', 'dark@1280']);
    expect(merged.pages.find((p) => p.path === '/pricing')?.state).toBe(PageState.Imported);
    expect(merged.pages.find((p) => p.path === '/broken')?.state).toBe(PageState.Failed);
    expect(merged.rev).toBe('def5678');
  });

  it('a page imported before stays imported when the new run reports it as not selected', () => {
    const merged = mergedMap(before, { pages: [{ path: '/', state: PageState.NotSelected }] });

    expect(merged.pages[0]).toMatchObject({ path: '/', state: PageState.Imported });
  });

  it('adds bound and unbound layers of the new boards to the totals', () => {
    const merged = mergedMap(before, { pages: [], design: { tokens: 12, styles: 3, bound: 10, unbound: 1 } });

    expect(merged.design).toEqual({ tokens: 12, styles: 3, bound: 50, unbound: 6 });
  });
});
