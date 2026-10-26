import type { CardFace } from './gpu/card-face';
import { Surface } from './gpu/card-face';
import type { TechniqueView } from './node-view';

const DELETED = 'The technique was deleted';
const OUT_OF_DATE = 'Out of date';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function techniqueFace(name: string, view: TechniqueView | null): Partial<CardFace> {
  if (!view) {
    return { surface: Surface.Doc, text: `${name}\n${DELETED}`, pills: [] };
  }

  const pills = [`v${view.version ?? 1}`];
  if (view.ranVersion !== null && view.ranVersion !== view.version) {
    pills.push(OUT_OF_DATE);
  }

  return { surface: Surface.Doc, text: `${name}\n${plural(view.inputs, 'input')}, ${plural(view.outputs, 'output')}`, pills, count: '' };
}
