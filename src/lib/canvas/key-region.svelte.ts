import type { CanvasCommand, CanvasCommandId } from './shortcuts';

export enum Region {
  Canvas = 'canvas',
  Layers = 'layers',
  Panel = 'panel'
}

export const KEY_REGION_ATTR = 'data-key-region';

const DECLARED = new Set<string>(Object.values(Region));

const nowhere = (target: EventTarget | null): target is null => !(target instanceof Element) || target === target.ownerDocument.body || target === target.ownerDocument.documentElement;

export function regionOf(target: EventTarget | null): Region {
  if (nowhere(target)) {
    return Region.Canvas;
  }
  const value = target.closest(`[${KEY_REGION_ATTR}]`)?.getAttribute(KEY_REGION_ATTR) ?? '';
  return DECLARED.has(value) ? (value as Region) : Region.Panel;
}

const EVERYWHERE: readonly CanvasCommandId[] = ['undo', 'redo'];
const ON_SELECTION: readonly CanvasCommandId[] = [...EVERYWHERE, 'delete', 'delete-keep', 'deselect', 'select-all', 'duplicate', 'copy', 'paste', 'group', 'ungroup'];

const REACH: Record<Region, ReadonlySet<CanvasCommandId> | 'every-key'> = {
  [Region.Canvas]: 'every-key',
  [Region.Layers]: new Set(ON_SELECTION),
  [Region.Panel]: new Set(EVERYWHERE)
};

export function reachesCanvas(region: Region, command: CanvasCommand | null): boolean {
  const reach = REACH[region];
  return reach === 'every-key' || (command !== null && reach.has(command.id));
}
