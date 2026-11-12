import type { CanvasCommand, CanvasCommandId } from './shortcuts';
import { isTypingTarget } from '$lib/shortcuts';
import { Input } from '$lib/components/ui/shell/last-input';

export enum Region {
  Canvas = 'canvas',
  Layers = 'layers',
  Commands = 'commands',
  Panel = 'panel'
}

export const KEY_REGION_ATTR = 'data-key-region';

const DECLARED = new Set<string>(Object.values(Region));

const focusedOn = (target: EventTarget | null): target is Element => target instanceof Element && target !== target.ownerDocument.body && target !== target.ownerDocument.documentElement;

export function regionOf(target: EventTarget | null): Region {
  if (!focusedOn(target)) {
    return Region.Canvas;
  }
  const value = target.closest(`[${KEY_REGION_ATTR}]`)?.getAttribute(KEY_REGION_ATTR) ?? '';
  return DECLARED.has(value) ? (value as Region) : Region.Panel;
}

const EVERYWHERE: readonly CanvasCommandId[] = ['undo', 'redo'];
const ON_SELECTION: readonly CanvasCommandId[] = [...EVERYWHERE, 'delete', 'delete-keep', 'deselect', 'select-all', 'duplicate', 'copy', 'paste', 'group', 'ungroup'];

enum PointerFocus {
  Keeps = 'keeps',
  ReturnsToCanvas = 'returns-to-canvas'
}

type Rule = { canvas: ReadonlySet<CanvasCommandId> | 'every-key'; timeline: boolean; pointer: PointerFocus };

const REACH: Record<Region, Rule> = {
  [Region.Canvas]: { canvas: 'every-key', timeline: true, pointer: PointerFocus.Keeps },
  [Region.Layers]: { canvas: new Set(ON_SELECTION), timeline: true, pointer: PointerFocus.Keeps },
  [Region.Commands]: { canvas: new Set(EVERYWHERE), timeline: false, pointer: PointerFocus.ReturnsToCanvas },
  [Region.Panel]: { canvas: new Set(EVERYWHERE), timeline: false, pointer: PointerFocus.Keeps }
};

export function reachesCanvas(region: Region, command: CanvasCommand | null): boolean {
  const reach = REACH[region].canvas;
  return reach === 'every-key' || (command !== null && reach.has(command.id));
}

export const reachesTimeline = (region: Region): boolean => REACH[region].timeline;

const POINTER_CLICK_MIN_DETAIL = 1;

export function releaseFocus(e: MouseEvent) {
  const held = document.activeElement;
  if (e.detail >= POINTER_CLICK_MIN_DETAIL && held instanceof HTMLElement && !isTypingTarget(held) && REACH[regionOf(held)].pointer === PointerFocus.ReturnsToCanvas) {
    held.blur();
  }
}

export function leaveMenu(trigger: Element | null, closedBy: Input, close: Event) {
  if (closedBy !== Input.Pointer || !trigger || REACH[regionOf(trigger)].pointer !== PointerFocus.ReturnsToCanvas) {
    return;
  }
  close.preventDefault();
  const held = document.activeElement;
  if (held instanceof HTMLElement) {
    held.blur();
  }
}

export function claimFocus(e: Event) {
  const held = document.activeElement;
  if (regionOf(e.target) === Region.Canvas && held instanceof HTMLElement && regionOf(held) !== Region.Canvas) {
    held.blur();
  }
}

export const keyOnCanvas = (e: Event): boolean => reachesCanvas(regionOf(e.target), null);
