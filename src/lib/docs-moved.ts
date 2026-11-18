import { DOCS_ORIGIN } from '$lib/docs-guides';

const TARGET_BY_PATH: Readonly<Record<string, string>> = {
  '/docs/getting-started': `${DOCS_ORIGIN}/getting-started/`
};

export function movedDocsTarget(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return TARGET_BY_PATH[path] ?? DOCS_ORIGIN;
}
