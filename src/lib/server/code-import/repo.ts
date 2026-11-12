export type RepoRef = { owner: string; repo: string; ref: string | null };

const GITHUB = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?(?:tree\/([A-Za-z0-9._/-]{1,200}))?$/;

const ROUTE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,300}$/;

export function repoOf(raw: string): RepoRef | null {
  const m = raw.trim().match(GITHUB);
  return m ? { owner: m[1], repo: m[2], ref: m[3] ?? null } : null;
}

export type Located = { ref: string | null; path: string | null };

export function located(tree: string | null, branches: readonly string[]): Located {
  if (!tree) {
    return { ref: null, path: null };
  }
  const segments = tree.split('/');
  const cut = segments.map((_, i) => segments.length - i).find((n) => branches.includes(segments.slice(0, n).join('/'))) ?? 1;
  return { ref: segments.slice(0, cut).join('/'), path: segments.slice(cut).join('/') || null };
}

export const cloneUrl = (repo: RepoRef) => `https://github.com/${repo.owner}/${repo.repo}.git`;

export const routeOf = (raw: string | undefined): string | null => {
  const path = raw?.trim() || '/';
  return ROUTE.test(path) && !path.includes('..') ? path : null;
};

export const MAX_ROUTES = 20;

export const askedRoutes = (route: string | undefined, routes: string[] | undefined): string[] => routes ?? (route ? [route] : []);

export function routesOf(raw: readonly string[]): string[] | null {
  const routes = raw.length ? raw.map((r) => routeOf(r)) : ['/'];
  if (routes.some((r) => r === null)) {
    return null;
  }
  const unique = [...new Set(routes as string[])];
  return unique.length <= MAX_ROUTES ? unique : null;
}

const DECLARED = /\b(?:function|const|let|class)\s+([A-Z][A-Za-z0-9_]{0,59})\b/g;

const IMPORTED = /import\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
const LOCAL_SPECIFIER = /^(\.|\/|@\/|~\/|#|\$)/;

function packageNames(source: string): Set<string> {
  const names = [...source.matchAll(IMPORTED)].filter((m) => !LOCAL_SPECIFIER.test(m[3])).flatMap((m) => [m[1] ?? '', ...(m[2] ?? '').split(/[\s,]+|\bas\b/)]);
  return new Set(names.map((n) => n.trim()).filter(Boolean));
}

export function namesIn(source: string): string[] {
  const ambiguous = packageNames(source);
  return [...new Set([...source.matchAll(DECLARED)].map((m) => m[1]))].filter((n) => !ambiguous.has(n)).sort();
}
