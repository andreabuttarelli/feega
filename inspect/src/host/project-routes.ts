import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pageOfFile, type PageRoute } from './page-route';
import { SKIPPED_DIRS } from './project-scan';
import { withSourced } from './route-examples';

const ROUTE_DIRS = ['src/routes', 'routes', 'src/app', 'app', 'src/pages', 'pages'];
const API_ROUTE = /^\/api(\/|$)/;
const HOME = '/';

const byRoute = (a: PageRoute, b: PageRoute) => {
  if (a.route === HOME || b.route === HOME) {
    return a.route === HOME ? -1 : 1;
  }
  return a.route < b.route ? -1 : 1;
};

export function routesOf(files: string[]): PageRoute[] {
  const found = new Map<string, PageRoute>();
  for (const file of files) {
    const page = pageOfFile(file);
    if (!page || API_ROUTE.test(page.route)) {
      continue;
    }
    found.set(page.route, page);
  }
  return [...found.values()].sort(byRoute);
}

const skipped = (path: string) => path.split('/').some((part) => SKIPPED_DIRS.has(part));

export async function listedFiles(appRoot: string): Promise<string[]> {
  const listed = await Promise.all(
    ROUTE_DIRS.map(async (dir) => {
      const inside = await readdir(join(appRoot, dir), { recursive: true }).catch(() => []);
      return inside.filter((path) => !skipped(path)).map((path) => `${dir}/${path.split('\\').join('/')}`);
    })
  );

  return listed.flat();
}

export async function listRoutes(appRoot: string): Promise<PageRoute[]> {
  const files = await listedFiles(appRoot);

  return withSourced(appRoot, files, routesOf(files));
}
