import { z } from 'zod';

const SHADCN_REGISTRY = 'https://ui.shadcn.com/r/styles/new-york-v4';
const MAX_ITEMS = 24;
const FETCH_TIMEOUT_MS = 15_000;

const itemShape = z.object({
  name: z.string(),
  type: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  files: z.array(z.object({ path: z.string(), content: z.string().optional() })).default([]),
  cssVars: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  css: z.record(z.string(), z.unknown()).optional()
});

export type RegistryFile = { path: string; content: string };

export type RegistryBundle = { name: string; type: string; entry: string; files: RegistryFile[]; theme: Record<string, string>; css: Record<string, unknown> };

const LIBRARIES = [
  { name: 'shadcn', namespace: '@shadcn', origin: 'https://ui.shadcn.com', item: (name: string) => `${SHADCN_REGISTRY}/${name}.json` },
  { name: 'Magic UI', namespace: '@magicui', origin: 'https://magicui.design', item: (name: string) => `https://magicui.design/r/${name}.json` },
  { name: 'Origin UI', namespace: '@originui', origin: 'https://coss.com', item: (name: string) => `https://coss.com/origin/r/${name}.json` }
];

const [SHADCN] = LIBRARIES;

const UNKNOWN_LIBRARY = 'Components';

export function libraryOf(registryUrl: string): string {
  const origin = URL.canParse(registryUrl) ? new URL(registryUrl).origin : '';
  return LIBRARIES.find((library) => library.origin === origin)?.name ?? UNKNOWN_LIBRARY;
}

export function dependencyUrl(ref: string): string {
  if (URL.canParse(ref)) {
    return ref;
  }

  const [namespace, name] = ref.startsWith('@') ? ref.split('/') : [SHADCN.namespace, ref];
  return (LIBRARIES.find((library) => library.namespace === namespace) ?? SHADCN).item(name);
}

async function itemAt(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`registry answered ${res.status} for ${url}`);
  }
  return itemShape.parse(await res.json());
}

export async function registryBundle(url: string): Promise<RegistryBundle> {
  const root = await itemAt(url);
  const seen = new Set([url]);
  const queue = [...(root.registryDependencies ?? [])].map(dependencyUrl);
  const items = [root];

  while (queue.length && items.length < MAX_ITEMS) {
    const next = queue.shift()!;
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);

    const item = await itemAt(next);
    items.push(item);
    queue.push(...(item.registryDependencies ?? []).map(dependencyUrl));
  }

  const files = items.flatMap((item) => item.files.filter((file) => file.content).map((file) => ({ path: file.path, content: file.content! })));
  const theme = Object.assign({}, ...items.map((item) => item.cssVars?.theme ?? {}));
  const css = Object.assign({}, ...items.map((item) => item.css ?? {}));
  return { name: root.name, type: root.type ?? 'registry:ui', entry: root.files[0]?.path ?? '', files, theme, css };
}
