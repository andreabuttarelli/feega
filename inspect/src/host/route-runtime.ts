import { basename, dirname } from 'node:path/posix';
import { fillRoute } from '../route-match';
import { pageOfFile, type PageRoute } from './page-route';

const ENTRIES_PATH = '/__feega/route-entries';
const ENOUGH_EXAMPLES = 10;
const EXAMPLES_PER_ROUTE = 50;
const REQUEST_TIMEOUT_MS = 30_000;
const GENERATOR_PAGE = /(^|\/)\+page\.svelte$|\.astro$/;
const ROUTE_MODULE = /^\+(page|layout)(\.server)?\.[jt]s$/;

type Params = Record<string, string>;
type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

type Deps = {
  base: () => string | null;
  enabled: () => boolean;
  files: () => Promise<Map<string, string>>;
  shown: (routes: PageRoute[]) => Promise<void>;
  fetcher?: Fetcher;
};

const lacking = (page: PageRoute) => page.dynamic && (page.sourced?.length ?? 0) < ENOUGH_EXAMPLES;

const underOrIn = (dir: string, parent: string) => dir === parent || dir.startsWith(`${parent}/`);

const touches = (changed: string, file: string) => changed === file || (ROUTE_MODULE.test(basename(changed)) && underOrIn(dirname(file), dirname(changed)));

export function generatorPages(files: string[]): Map<string, string> {
  const pages = files.filter((file) => GENERATOR_PAGE.test(file)).map((file) => [pageOfFile(file), file] as const);

  return new Map(pages.flatMap(([page, file]) => (page?.dynamic ? [[page.route, file] as const] : [])));
}

export function routeRuntime({ base, enabled, files, shown, fetcher = fetch }: Deps) {
  const found = new Map<string, string[]>();
  const asked = new Set<string>();
  let known: PageRoute[] = [];
  let queue: Promise<void> = Promise.resolve();

  const withEntries = (page: PageRoute): PageRoute => {
    const own = found.get(page.route);
    return own ? { ...page, sourced: [...new Set([...own, ...(page.sourced ?? [])])].slice(0, EXAMPLES_PER_ROUTE) } : page;
  };

  const overlay = (routes: PageRoute[]) => (enabled() ? routes.map(withEntries) : routes);

  async function entriesOf(origin: string, file: string): Promise<Params[]> {
    const url = `${origin}${ENTRIES_PATH}?${new URLSearchParams({ file })}`;
    const reply = await fetcher(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const body = reply.ok ? ((await reply.json()) as { entries?: Params[] }) : null;

    return body?.entries ?? [];
  }

  async function ask(origin: string, page: PageRoute, file: string) {
    asked.add(page.route);
    const entries = await entriesOf(origin, file).catch(() => []);
    const paths = entries.flatMap((params) => fillRoute(page.route, params) ?? []);
    const had = found.has(page.route);
    if (paths.length > 0) {
      found.set(page.route, [...new Set(paths)]);
    } else {
      found.delete(page.route);
    }
    if (paths.length > 0 || had) {
      await shown(overlay(known));
    }
  }

  async function pass() {
    const origin = base();
    if (!enabled() || origin === null) {
      return;
    }
    const routeFiles = await files();

    for (const page of known.filter((candidate) => lacking(withEntries(candidate)) && !asked.has(candidate.route))) {
      const file = routeFiles.get(page.route);
      if (file) {
        await ask(origin, page, file);
      }
    }
  }

  const run = (routes: PageRoute[]): Promise<void> => {
    known = routes;
    queue = queue.then(pass, pass);

    return queue;
  };

  async function touched(changed: string[]) {
    const routeFiles = await files();
    const stale = [...routeFiles].filter(([, file]) => changed.some((path) => touches(path, file)));
    stale.forEach(([route]) => asked.delete(route));

    return stale.length > 0 ? run(known) : undefined;
  }

  return { overlay, run, touched };
}
