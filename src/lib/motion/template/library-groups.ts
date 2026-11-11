import { BUILTIN_PREFIX } from './design-kit';
import type { CatalogueItem } from './catalogue';

export const YOUR_LIBRARY = 'Your library';
export const OTHER_GROUP = 'Other';

const GROUP_SEPARATOR = ' · ';

export enum Tab {
  Browse = 'browse',
  Save = 'save'
}

export type LibraryGroup = { title: string; items: CatalogueItem[] };

export const isOwn = (id: string) => !id.startsWith(BUILTIN_PREFIX);

export function groupTitle(item: CatalogueItem): string {
  if (isOwn(item.id)) {
    return YOUR_LIBRARY;
  }
  const at = item.name.indexOf(GROUP_SEPARATOR);
  return at > 0 ? item.name.slice(0, at) : OTHER_GROUP;
}

export function shortName(item: CatalogueItem): string {
  const at = item.name.indexOf(GROUP_SEPARATOR);
  return !isOwn(item.id) && at > 0 ? item.name.slice(at + GROUP_SEPARATOR.length) : item.name;
}

export function groupItems(items: readonly CatalogueItem[]): LibraryGroup[] {
  const groups = new Map<string, CatalogueItem[]>();
  for (const item of items) {
    const title = groupTitle(item);
    groups.set(title, [...(groups.get(title) ?? []), item]);
  }
  const own = groups.get(YOUR_LIBRARY);
  groups.delete(YOUR_LIBRARY);
  const list = [...groups].map(([title, rows]) => ({ title, items: rows }));
  return own ? [{ title: YOUR_LIBRARY, items: own }, ...list] : list;
}

export function filterGroup(items: readonly CatalogueItem[], group: string | null): CatalogueItem[] {
  return group ? items.filter((i) => groupTitle(i) === group) : [...items];
}
