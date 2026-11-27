import type { PageRoute } from '../host/page-route';

export type PageRow = PageRoute & { current: boolean };

const QUERY_OR_HASH = /[?#].*$/;

const pathOf = (route: string) => route.replace(QUERY_OR_HASH, '');

export function seenRoutes(seen: string[], route: string): string[] {
  const path = pathOf(route);
  return seen.includes(path) ? seen : [...seen, path];
}

export function pageRows(routes: PageRoute[], seen: string[], current: string): PageRow[] {
  const here = pathOf(current);
  const declared = new Set(routes.map((r) => r.route));
  const visitedOnly = seen.filter((route) => !declared.has(route)).map((route) => ({ route, dynamic: false }));

  return [...routes, ...visitedOnly].map((page) => ({ ...page, current: page.route === here }));
}
