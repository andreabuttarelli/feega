export type RepoRef = { owner: string; repo: string; ref: string | null };

const GITHUB = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?(?:tree\/([A-Za-z0-9._/-]{1,200}))?$/;

const ROUTE = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,300}$/;

export function repoOf(raw: string): RepoRef | null {
  const m = raw.trim().match(GITHUB);
  return m ? { owner: m[1], repo: m[2], ref: m[3] ?? null } : null;
}

export const cloneUrl = (repo: RepoRef) => `https://github.com/${repo.owner}/${repo.repo}.git`;

export const routeOf = (raw: string | undefined): string | null => {
  const path = raw?.trim() || '/';
  return ROUTE.test(path) && !path.includes('..') ? path : null;
};

export enum PackageManager {
  Npm = 'npm',
  Pnpm = 'pnpm',
  Yarn = 'yarn',
  Bun = 'bun'
}

export const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', PackageManager.Pnpm],
  ['yarn.lock', PackageManager.Yarn],
  ['bun.lock', PackageManager.Bun],
  ['bun.lockb', PackageManager.Bun],
  ['package-lock.json', PackageManager.Npm]
];

export const managerOf = (files: readonly string[]): PackageManager => LOCKFILES.find(([file]) => files.includes(file))?.[1] ?? PackageManager.Npm;

export enum DevServer {
  Vite = 'vite',
  Next = 'next',
  Other = 'other'
}

export const DEV_ARGS: Record<DevServer, (port: number) => string[]> = {
  [DevServer.Vite]: (port) => ['--host', '0.0.0.0', '--port', String(port), '--strictPort'],
  [DevServer.Next]: (port) => ['-H', '0.0.0.0', '-p', String(port)],
  [DevServer.Other]: () => []
};

export function devServerOf(pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): DevServer {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next) {
    return DevServer.Next;
  }
  return deps.vite ? DevServer.Vite : DevServer.Other;
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
