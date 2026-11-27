import type { PageRoute } from '../host/page-route';
import { assignExamples, labelOf, matchRoute } from './route-match';

export type PageExample = { path: string; label: string; current: boolean };

export type PageRow = PageRoute & { current: boolean; examples: PageExample[] };

export type Found = { seen: string[]; linked: string[]; manual: Record<string, string[]> };

export const EXAMPLE_LIMIT = 10;
export const LINKED_CAP = 500;

const QUERY_OR_HASH = /[?#].*$/;

const pathOf = (route: string) => route.replace(QUERY_OR_HASH, '');

export function seenRoutes(seen: string[], route: string): string[] {
  const path = pathOf(route);
  return seen.includes(path) ? seen : [...seen, path];
}

export const linkedRoutes = (known: string[], paths: string[]): string[] => [...new Set([...known, ...paths])].slice(0, LINKED_CAP);

export const addExample = (manual: Record<string, string[]>, pattern: string, path: string): Record<string, string[]> => ({
  ...manual,
  [pattern]: [...new Set([...(manual[pattern] ?? []), path])]
});

function examplesOf(page: PageRoute, assigned: string[], manual: string[], here: string): PageExample[] {
  const paths = [...new Set([...assigned, ...manual.map(pathOf)])];

  return paths.map((path) => ({ path, label: labelOf(page.route, path), current: path === here }));
}

export function pageRows(routes: PageRoute[], found: Found, current: string): PageRow[] {
  const here = pathOf(current);
  const declared = new Set(routes.map((r) => r.route));
  const patterns = routes.filter((r) => r.dynamic).map((r) => r.route);
  const concrete = [...found.seen, ...found.linked].filter((path) => !declared.has(path));
  const assigned = assignExamples(patterns, concrete);
  const visitedOnly = found.seen
    .filter((route) => !declared.has(route) && !patterns.some((pattern) => matchRoute(pattern, route)))
    .map((route) => ({ route, dynamic: false }));

  return [...routes, ...visitedOnly].map((page) => ({
    ...page,
    current: !page.dynamic && page.route === here,
    examples: page.dynamic ? examplesOf(page, assigned[page.route], found.manual[page.route] ?? [], here) : []
  }));
}
