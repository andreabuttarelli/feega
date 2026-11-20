import type { Pick, Source } from '../messages';

export type LayerFlag = 'hidden' | 'locked';

export type SavedLayers = Record<string, Record<LayerFlag, string[]>>;

type RouteLayers = Record<LayerFlag, Set<string>>;

const HIDDEN_DISPLAY = 'none';

export const hiddenHere = (node: { display: string }): boolean => node.display === HIDDEN_DISPLAY;

const keyOf = (s: Source) => `${s.file}:${s.line}:${s.col}`;

export function passThrough(pick: Pick, locked: Set<string>): Source | null {
  const chain = [pick.source, ...[...pick.ancestors].reverse().map((a) => a.source)];
  return chain.find((s) => !locked.has(keyOf(s))) ?? null;
}

export function layerState(saved: SavedLayers) {
  const routes = new Map<string, RouteLayers>(Object.entries(saved).map(([route, flags]) => [route, { hidden: new Set(flags.hidden), locked: new Set(flags.locked) }]));

  const of = (route: string): RouteLayers => {
    if (!routes.has(route)) {
      routes.set(route, { hidden: new Set(), locked: new Set() });
    }
    return routes.get(route)!;
  };

  return {
    of,
    toggle(flag: LayerFlag, route: string, source: string): boolean {
      const set = of(route)[flag];
      const on = !set.has(source);
      if (on) {
        set.add(source);
      } else {
        set.delete(source);
      }
      return on;
    },
    saved: (): SavedLayers => Object.fromEntries([...routes].map(([route, flags]) => [route, { hidden: [...flags.hidden], locked: [...flags.locked] }]))
  };
}
