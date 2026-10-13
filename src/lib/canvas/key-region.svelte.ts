export enum Region {
  Canvas = 'canvas',
  Editor = 'editor'
}

export const KEY_REGION_ATTR = 'data-key-region';

const REGIONS = new Set<string>(Object.values(Region));

export function regionOf(target: Element | null): Region {
  const value = target?.closest(`[${KEY_REGION_ATTR}]`)?.getAttribute(KEY_REGION_ATTR) ?? '';
  return REGIONS.has(value) ? (value as Region) : Region.Canvas;
}

let current = $state(Region.Canvas);

export const keyRegion = {
  get current() {
    return current;
  },
  touch(target: EventTarget | null) {
    current = regionOf(target instanceof Element ? target : null);
  },
  follow(on: Window = window) {
    const seen = (e: Event) => keyRegion.touch(e.target);
    on.addEventListener('pointerdown', seen, true);
    on.addEventListener('focusin', seen, true);
    return () => {
      on.removeEventListener('pointerdown', seen, true);
      on.removeEventListener('focusin', seen, true);
      current = Region.Canvas;
    };
  }
};
