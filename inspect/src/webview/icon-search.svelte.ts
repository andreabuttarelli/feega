import { ToHost, type IconHit } from '../messages';
import { toHost } from './host';
import { previewBatcher } from './icon-batch';

type Found = { id: number; library: string | null; hits: IconHit[]; error: string };

export const iconSearch = $state<Found & { requested: number; previews: Record<string, string | null> }>({
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
  Object.assign(iconSearch, found);
}

export function iconDrawn(name: string, svg: string | null) {
  iconSearch.previews[name] = svg;
}

const batcher = previewBatcher(
  (names) => toHost({ kind: ToHost.IconPreviews, names }),
  (name) => name in iconSearch.previews
);

export const wantPreview = batcher.want;
