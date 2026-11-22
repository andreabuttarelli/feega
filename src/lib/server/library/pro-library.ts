export const PRO_FRAMEWORKS = ['html', 'svelte', 'react', 'vue', 'astro'] as const;

export type ProFramework = (typeof PRO_FRAMEWORKS)[number];

export type ProLatest = { id: string; version: string; frameworks: Partial<Record<ProFramework, string[]>> };

export type ProFile = { path: string; content: string };

export interface ProStore {
  latest(id: string): Promise<ProLatest | null>;
  file(id: string, version: string, framework: ProFramework, path: string): Promise<string | null>;
}

export enum ProFetch {
  Served = 'served',
  BadRequest = 'bad_request',
  PlanRequired = 'plan_required',
  ItemNotFound = 'item_not_found',
  FrameworkNotFound = 'framework_not_found'
}

export type ProResult =
  | { kind: ProFetch.Served; id: string; version: string; framework: ProFramework; files: ProFile[] }
  | { kind: Exclude<ProFetch, ProFetch.Served> };

const ITEM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isFramework = (value: string): value is ProFramework => (PRO_FRAMEWORKS as readonly string[]).includes(value);

async function readAll(store: ProStore, latest: ProLatest, framework: ProFramework, paths: string[]): Promise<ProFile[] | null> {
  const contents = await Promise.all(paths.map((path) => store.file(latest.id, latest.version, framework, path)));
  if (contents.some((content) => content === null)) {
    return null;
  }

  return paths.map((path, at) => ({ path, content: contents[at] as string }));
}

export async function proFiles(store: ProStore, entitled: () => Promise<boolean>, id: string, framework: string): Promise<ProResult> {
  if (!ITEM_ID.test(id) || !isFramework(framework)) {
    return { kind: ProFetch.BadRequest };
  }
  if (!(await entitled())) {
    return { kind: ProFetch.PlanRequired };
  }

  const latest = await store.latest(id);
  if (!latest) {
    return { kind: ProFetch.ItemNotFound };
  }

  const paths = latest.frameworks[framework];
  const files = paths?.length ? await readAll(store, latest, framework, paths) : null;
  if (!files) {
    return { kind: ProFetch.FrameworkNotFound };
  }

  return { kind: ProFetch.Served, id, version: latest.version, framework, files };
}
