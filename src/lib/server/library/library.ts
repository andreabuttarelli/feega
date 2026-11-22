export const FRAMEWORKS = ['html', 'svelte', 'react', 'vue', 'astro'] as const;

export type Framework = (typeof FRAMEWORKS)[number];
export type Tier = 'free' | 'pro';

export type IndexEntry = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  frameworks: Framework[];
  tier: Tier;
  previewUrl: string;
};

export type ItemFile = { path: string; content: string };

export interface LibraryStore {
  index(): Promise<IndexEntry[]>;
  files(id: string, framework: Framework): Promise<ItemFile[] | null>;
}

export type CatalogueItem = IndexEntry & { locked: boolean };

export enum Fetch {
  Served = 'served',
  BadRequest = 'bad_request',
  ItemNotFound = 'item_not_found',
  FrameworkNotFound = 'framework_not_found',
  PlanRequired = 'plan_required'
}

export type FilesResult =
  | { kind: Fetch.Served; id: string; framework: Framework; files: ItemFile[] }
  | { kind: Exclude<Fetch, Fetch.Served> };

const ITEM_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isFramework(value: string): value is Framework {
  return (FRAMEWORKS as readonly string[]).includes(value);
}

export async function catalogue(store: LibraryStore, entitled: boolean): Promise<CatalogueItem[]> {
  const entries = await store.index();

  return entries.map((entry) => ({ ...entry, locked: entry.tier === 'pro' && !entitled }));
}

export async function itemFiles(store: LibraryStore, entitled: () => Promise<boolean>, id: string, framework: string): Promise<FilesResult> {
  if (!ITEM_ID.test(id) || !isFramework(framework)) {
    return { kind: Fetch.BadRequest };
  }

  const entry = (await store.index()).find((candidate) => candidate.id === id);
  if (!entry) {
    return { kind: Fetch.ItemNotFound };
  }
  if (!entry.frameworks.includes(framework)) {
    return { kind: Fetch.FrameworkNotFound };
  }
  if (entry.tier === 'pro' && !(await entitled())) {
    return { kind: Fetch.PlanRequired };
  }

  const files = await store.files(id, framework);
  if (!files) {
    return { kind: Fetch.FrameworkNotFound };
  }

  return { kind: Fetch.Served, id, framework, files };
}
