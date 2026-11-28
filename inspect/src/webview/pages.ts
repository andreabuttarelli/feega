import type { PageRoute } from '../host/page-route';
import { assignExamples, fillRoute, labelOf, matchRoute, paramsOf } from '../route-match';

export enum ExampleKind {
  Found = 'found',
  NotFound = 'not-found'
}

export enum FieldMode {
  Closed = 'closed',
  Open = 'open'
}

export type PageExample = { path: string; label: string; current: boolean; kind: ExampleKind };

export type PageRow = PageRoute & { current: boolean; kind: ExampleKind; examples: PageExample[]; notFound: PageExample | null };

export type Found = { seen: string[]; linked: string[]; manual: Record<string, string[]> };

export const NOT_FOUND_VALUE = 'feega-not-found';
export const NOT_FOUND_PATH = `/${NOT_FOUND_VALUE}`;
export const EXAMPLE_LIMIT = 10;
export const LINKED_CAP = 500;

const QUERY_OR_HASH = /[?#].*$/;

const pathOf = (route: string) => route.replace(QUERY_OR_HASH, '');

const isNotFound = (path: string) => path.split('/').includes(NOT_FOUND_VALUE);

export function seenRoutes(seen: string[], route: string): string[] {
  const path = pathOf(route);
  return seen.includes(path) || isNotFound(path) ? seen : [...seen, path];
}

export const linkedRoutes = (known: string[], paths: string[]): string[] => [...new Set([...known, ...paths])].slice(0, LINKED_CAP);

export const addExample = (manual: Record<string, string[]>, pattern: string, path: string): Record<string, string[]> => ({
  ...manual,
  [pattern]: [...new Set([...(manual[pattern] ?? []), path])]
});

function examplesOf(page: PageRoute, assigned: string[], manual: string[], here: string): PageExample[] {
  const paths = [...new Set([...assigned, ...(page.sourced ?? []), ...manual.map(pathOf)])];

  return paths.map((path) => ({ path, label: labelOf(page.route, path), current: path === here, kind: ExampleKind.Found }));
}

function notFoundOf(page: PageRoute, here: string): PageExample | null {
  const values = Object.fromEntries(paramsOf(page.route).map(({ name }) => [name, NOT_FOUND_VALUE]));
  const path = fillRoute(page.route, values);

  return path === null ? null : { path, label: NOT_FOUND_VALUE, current: path === here, kind: ExampleKind.NotFound };
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
    kind: ExampleKind.Found,
    notFound: page.dynamic ? notFoundOf(page, here) : null,
    examples: page.dynamic ? examplesOf(page, assigned[page.route], found.manual[page.route] ?? [], here) : []
  }));
}

export function withErrorPage(rows: PageRow[], current: string): PageRow[] {
  if (rows.length === 0) {
    return rows;
  }
  const errorPage: PageRow = { route: NOT_FOUND_PATH, dynamic: false, current: pathOf(current) === NOT_FOUND_PATH, kind: ExampleKind.NotFound, examples: [], notFound: null };

  return [errorPage, ...rows];
}

export const fieldState = (exampleCount: number, asked: FieldMode): FieldMode => (exampleCount === 0 ? FieldMode.Open : asked);

export function customLabel(pattern: string): string {
  const params = paramsOf(pattern);

  return params.length === 1 ? `Custom ${params[0].name}` : 'Custom value';
}
