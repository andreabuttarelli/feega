import { routeMatches } from './route-pattern';

export type ListedRoute = { path: string; file: string; kind: 'static' | 'dynamic'; params: string[]; selected: boolean; candidates: { path: string; from: 'code' | 'links' }[] };

export type Pick = ListedRoute & { checked: boolean; value: string };

export enum PickProblem {
  NoneChecked = 'none_checked',
  OverCap = 'over_cap',
  NeedsValue = 'needs_value'
}

export type Problem = { problem: PickProblem; path: string | null };

const DYNAMIC = 'dynamic';

export const picksOf = (routes: ListedRoute[]): Pick[] => routes.map((r) => ({ ...r, checked: r.selected, value: '' }));

const filled = (p: Pick) => p.kind !== DYNAMIC || (p.value.trim() !== '' && routeMatches(p.path, p.value.trim()));

export const picked = (rows: Pick[]) => rows.filter((r) => r.checked).map((r) => (r.kind === DYNAMIC ? r.value.trim() : r.path));

export const checkedCount = (rows: Pick[]) => rows.filter((r) => r.checked).length;

export function problemOf(rows: Pick[], max: number): Problem | null {
  const checked = rows.filter((r) => r.checked);
  if (!checked.length) {
    return { problem: PickProblem.NoneChecked, path: null };
  }
  if (checked.length > max) {
    return { problem: PickProblem.OverCap, path: null };
  }
  const unfilled = checked.find((r) => !filled(r));
  return unfilled ? { problem: PickProblem.NeedsValue, path: unfilled.path } : null;
}

export function matching(rows: Pick[], query: string): Pick[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.path.toLowerCase().includes(q) || r.file.toLowerCase().includes(q)) : rows;
}
