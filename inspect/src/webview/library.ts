import type { LibraryEntry } from '../messages';

export const LIBRARY_DRAG_TYPE = 'application/x-feega-library';

export const PAGE_WIDTH_PX = 1280;
export const PAGE_HEIGHT_PX = 800;

export enum LibraryTab {
  Sections = 'section',
  Components = 'component',
  App = 'app'
}

export enum LibraryTheme {
  Light = 'light',
  Dark = 'dark'
}

export const TABS: { id: LibraryTab; label: string }[] = [
  { id: LibraryTab.Sections, label: 'Sections' },
  { id: LibraryTab.Components, label: 'Components' },
  { id: LibraryTab.App, label: 'App' }
];

const haystack = (item: LibraryEntry) => `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase();

export function visible(items: LibraryEntry[], tab: LibraryTab, query: string): LibraryEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle) {
    return items.filter((item) => haystack(item).includes(needle));
  }
  return items.filter((item) => item.category === tab);
}

export const framedPage = (item: LibraryEntry, theme: LibraryTheme) => item.page.replace('<html>', `<html data-theme="${theme}">`);

export const scaleFor = (cardWidth: number) => cardWidth / PAGE_WIDTH_PX;
