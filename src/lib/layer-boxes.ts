export const MAX_LAYERS = 5;

const GRID = 1000;
const BBOX_CORNERS = 4;
const LIST_PATTERN = /\[[\s\S]*\]/;

export type Fraction = { left: number; top: number; width: number; height: number };

export type LayerBox = { label: string; box: Fraction };

const clampToGrid = (value: number): number => Math.min(GRID, Math.max(0, value));

function boxOf(raw: unknown): Fraction | null {
  if (!Array.isArray(raw) || raw.length !== BBOX_CORNERS || !raw.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return null;
  }
  const [left, top, right, bottom] = raw.map(clampToGrid);
  if (right <= left || bottom <= top) {
    return null;
  }
  return { left: left / GRID, top: top / GRID, width: (right - left) / GRID, height: (bottom - top) / GRID };
}

function layerOf(raw: unknown): LayerBox | null {
  const entry = raw as { label?: unknown; bbox?: unknown } | null;
  const box = boxOf(entry?.bbox);
  const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
  return box && label ? { label, box } : null;
}

export function parseLayerBoxes(reply: string): LayerBox[] {
  const list = LIST_PATTERN.exec(reply)?.[0];
  if (!list) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(list);
    return Array.isArray(parsed) ? parsed.map(layerOf).filter((layer): layer is LayerBox => layer !== null).slice(0, MAX_LAYERS) : [];
  } catch {
    return [];
  }
}

function cornersOf({ box }: LayerBox): string {
  const corners = [box.left, box.top, box.left + box.width, box.top + box.height];
  return corners.map((fraction) => Math.round(fraction * GRID)).join(' ');
}

export function layerPrompt(layers: LayerBox[]): string {
  const named = layers.map((layer) => `the ${layer.label} <bbox>${cornersOf(layer)}</bbox>`);
  const list = named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named.at(-1)}` : named[0];
  return `Separate ${list} into independent layers`;
}
