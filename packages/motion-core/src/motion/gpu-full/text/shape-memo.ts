import type { Face } from './face';

type Shape = Face['shape'];
type Outline = Face['outline'];

export const SHAPED_RUNS_KEPT = 4096;

const keyOf = (text: string, ligatures: string, features: Record<string, boolean> | undefined) => {
  const on = features ? Object.keys(features).filter((tag) => features[tag]).sort().join(',') : '';
  const off = features ? Object.keys(features).filter((tag) => !features[tag]).sort().join(',') : '';
  return `${ligatures}\u0000${on}\u0000${off}\u0000${text}`;
};

export function memoShape(shape: Shape, limit = SHAPED_RUNS_KEPT): Shape {
  const runs = new Map<string, ReturnType<Shape>>();

  return (text, ligatures, features) => {
    const key = keyOf(text, ligatures, features);
    const hit = runs.get(key);
    if (hit) {
      return hit;
    }

    const shaped = shape(text, ligatures, features);
    if (runs.size >= limit) {
      runs.delete(runs.keys().next().value as string);
    }
    runs.set(key, shaped);
    return shaped;
  };
}

export function memoOutline(outline: Outline): Outline {
  const glyphs = new Map<number, ReturnType<Outline>>();

  return (glyph) => {
    const hit = glyphs.get(glyph);
    if (hit) {
      return hit;
    }

    const read = outline(glyph);
    glyphs.set(glyph, read);
    return read;
  };
}
