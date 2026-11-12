import { describe, expect, it } from 'vitest';
import { checkedCount, matching, picksOf, picked, PickProblem, problemOf, type ListedRoute } from './route-picks';

const ROUTES: ListedRoute[] = [
  { path: '/', file: 'src/routes/+page.svelte', kind: 'static', params: [], selected: true, candidates: [] },
  { path: '/pricing', file: 'src/routes/pricing/+page.svelte', kind: 'static', params: [], selected: true, candidates: [] },
  { path: '/blog/[slug]', file: 'src/routes/blog/[slug]/+page.svelte', kind: 'dynamic', params: ['slug'], selected: false, candidates: [{ path: '/blog/hello', from: 'code' }] }
];

describe('route picks: the dialog checklist', () => {
  it('starts with the selected routes ticked and no values typed', () => {
    expect(picksOf(ROUTES).map((p) => [p.path, p.checked, p.value])).toEqual([
      ['/', true, ''],
      ['/pricing', true, ''],
      ['/blog/[slug]', false, '']
    ]);
  });

  it('a ticked dynamic route imports the path typed for it', () => {
    const rows = picksOf(ROUTES).map((p) => (p.kind === 'dynamic' ? { ...p, checked: true, value: '/blog/hello' } : p));
    expect(picked(rows)).toEqual(['/', '/pricing', '/blog/hello']);
    expect(problemOf(rows, 20)).toBeNull();
  });

  it.each([
    { name: 'a ticked dynamic route without a value', value: '', problem: PickProblem.NeedsValue },
    { name: 'a value that does not fit the pattern', value: '/blog/a/b', problem: PickProblem.NeedsValue }
  ])('$name blocks the import', ({ value, problem }) => {
    const rows = picksOf(ROUTES).map((p) => (p.kind === 'dynamic' ? { ...p, checked: true, value } : p));
    expect(problemOf(rows, 20)).toEqual({ problem, path: '/blog/[slug]' });
  });

  it('nothing ticked, or more than the cap, blocks the import', () => {
    expect(problemOf(picksOf(ROUTES).map((p) => ({ ...p, checked: false })), 20)).toEqual({ problem: PickProblem.NoneChecked, path: null });
    expect(problemOf(picksOf(ROUTES), 1)).toEqual({ problem: PickProblem.OverCap, path: null });
    expect(checkedCount(picksOf(ROUTES))).toBe(2);
  });

  it('search matches the path or the file, case-insensitive', () => {
    expect(matching(picksOf(ROUTES), 'BLOG').map((p) => p.path)).toEqual(['/blog/[slug]']);
    expect(matching(picksOf(ROUTES), 'pricing/+page').map((p) => p.path)).toEqual(['/pricing']);
    expect(matching(picksOf(ROUTES), '  ')).toHaveLength(3);
  });
});
