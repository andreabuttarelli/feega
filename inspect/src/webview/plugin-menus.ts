import { Where } from '@feega/plugin-api/manifest';
import type { Contributed } from '@feega/plugin-api/host';
import type { MenuItem } from './structure-menu';

const ITEM_PREFIX = 'plugin:';
const CATEGORY_PREFIX = 'plugin-category:';
const SEPARATOR = '/';

export const itemId = (plugin: string, item: string) => `${ITEM_PREFIX}${plugin}${SEPARATOR}${item}`;

export function parseItemId(id: string): { plugin: string; item: string } | null {
  const at = id.indexOf(SEPARATOR);
  return id.startsWith(ITEM_PREFIX) && at > ITEM_PREFIX.length ? { plugin: id.slice(ITEM_PREFIX.length, at), item: id.slice(at + 1) } : null;
}

const itemOf = ({ plugin, entry }: Contributed): MenuItem => ({ id: itemId(plugin, entry.id), label: entry.title ?? entry.id });

export function addMenuItems(base: MenuItem[], contributed: Contributed[]): MenuItem[] {
  const categories = new Map<string, MenuItem[]>();
  const loose: MenuItem[] = [];
  for (const one of contributed) {
    const category = one.entry.category;
    if (!category) {
      loose.push(itemOf(one));
      continue;
    }
    categories.set(category, [...(categories.get(category) ?? []), itemOf(one)]);
  }
  const submenus = [...categories].map(([label, items]) => ({ id: `${CATEGORY_PREFIX}${label}`, label, items }));
  return [...base, ...submenus, ...loose];
}

export const contextMenuItems = (base: MenuItem[], contributed: Contributed[], where: Where.Layers | Where.Preview): MenuItem[] => [
  ...base,
  ...contributed.filter(({ entry }) => entry.where === where || entry.where === Where.Both).map(itemOf)
];
