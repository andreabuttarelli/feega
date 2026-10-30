import type { CodePage } from './import-code';

export const MAX_STORIES = 12;

const WEB_SCHEMES = ['http:', 'https:'];
const INDEXES = ['index.json', 'stories.json'];
const PAGE_FILE = /(iframe|index)\.html$/;
const STORY = 'story';
const TITLE_SEPARATOR = '/';

type Entry = { id: string; title: string; name: string; type?: string };
type Index = { entries?: Record<string, Entry>; stories?: Record<string, Entry> };

export function storybookBase(raw: string): string | null {
  const url = URL.canParse(raw.trim()) ? new URL(raw.trim()) : null;
  if (!url || !WEB_SCHEMES.includes(url.protocol)) {
    return null;
  }
  const path = url.pathname.replace(PAGE_FILE, '');
  return `${url.origin}${path.endsWith('/') ? path : `${path}/`}`;
}

async function indexOf(base: string, fetchFn: typeof fetch): Promise<Entry[] | null> {
  for (const file of INDEXES) {
    const res = await fetchFn(`${base}${file}`).catch(() => null);
    const body = res?.ok ? ((await res.json().catch(() => null)) as Index | null) : null;
    const entries = body?.entries ?? body?.stories;
    if (entries) {
      return Object.values(entries).filter((e) => (e.type ?? STORY) === STORY);
    }
  }
  return null;
}

function interleaved(entries: Entry[]): Entry[] {
  const byTitle = [...Map.groupBy(entries, (e) => e.title).values()];
  const rounds = Math.max(0, ...byTitle.map((list) => list.length));
  return Array.from({ length: rounds }, (_, i) => byTitle.flatMap((list) => list[i] ?? [])).flat();
}

const componentOf = (title: string) => title.split(TITLE_SEPARATOR).pop()!.trim();

export type Stories = { pages: CodePage[]; names: string[] };

export async function storybookPages(raw: string, fetchFn: typeof fetch, cap: number, ids?: string[]): Promise<Stories | null> {
  const base = storybookBase(raw);
  const entries = base ? await indexOf(base, fetchFn) : null;
  if (!base || !entries) {
    return null;
  }
  const picked = ids?.length ? entries.filter((e) => ids.includes(e.id)) : interleaved(entries);
  const pages = picked.slice(0, Math.min(cap, MAX_STORIES)).map((e) => ({ label: `${componentOf(e.title)} / ${e.name}`, url: `${base}iframe.html?id=${encodeURIComponent(e.id)}&viewMode=story` }));
  return { pages, names: [...new Set(entries.map((e) => componentOf(e.title)))].sort() };
}
