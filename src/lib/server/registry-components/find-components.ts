import { z } from 'zod';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HITS = 20;

export enum ComponentSource {
  Shadcn = 'shadcn/ui',
  MagicUi = 'Magic UI'
}

type Source = { index: string; item: (name: string) => string; license: string };

export const COMPONENT_SOURCES: Record<ComponentSource, Source> = {
  [ComponentSource.Shadcn]: { index: 'https://ui.shadcn.com/r/index.json', item: (name) => `https://ui.shadcn.com/r/styles/new-york-v4/${name}.json`, license: 'MIT' },
  [ComponentSource.MagicUi]: { index: 'https://magicui.design/r/registry.json', item: (name) => `https://magicui.design/r/${name}.json`, license: 'MIT' }
};

const entryShape = z.object({ name: z.string(), type: z.string().optional(), title: z.string().optional(), description: z.string().optional() });
const indexShape = z.union([z.array(entryShape), z.object({ items: z.array(entryShape) }).transform((index) => index.items)]);

export type FoundComponent = { name: string; title: string; source: ComponentSource; license: string; registryUrl: string };

async function entriesOf(source: ComponentSource): Promise<FoundComponent[]> {
  const from = COMPONENT_SOURCES[source];
  const res = await fetch(from.index, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const parsed = indexShape.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    return [];
  }
  return parsed.data.map((entry) => ({ name: entry.name, title: entry.title ?? entry.name, source, license: from.license, registryUrl: from.item(entry.name) }));
}

export async function findComponents(query: string): Promise<FoundComponent[]> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const all = (await Promise.all(Object.values(ComponentSource).map((source) => entriesOf(source).catch(() => [])))).flat();
  return all.filter((found) => words.every((word) => `${found.name} ${found.title}`.toLowerCase().includes(word))).slice(0, MAX_HITS);
}
