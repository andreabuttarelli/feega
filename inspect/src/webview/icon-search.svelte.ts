import type { IconHit } from '../messages';

type Found = { id: number; library: string | null; hits: IconHit[]; error: string };

export const iconSearch = $state<Found & { requested: number; previews: Record<string, string> }>({
  id: 0,
  requested: 0,
  library: null,
  hits: [],
  error: '',
  previews: {}
});

export const nextIconRequest = () => ++iconSearch.requested;

export function iconsFound(found: Found) {
  if (found.id !== iconSearch.requested) {
    return;
  }
  Object.assign(iconSearch, found, { previews: {} });
}

export function iconDrawn(id: number, name: string, svg: string) {
  if (id === iconSearch.id) {
    iconSearch.previews[name] = svg;
  }
}
