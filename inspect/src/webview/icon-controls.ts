import type { Styles } from './controls';

const NONE = 'none';

enum Paint {
  Fill = 'fill',
  Stroke = 'stroke'
}

const ROW_OF: Record<Paint, string> = { [Paint.Fill]: 'icon-fill', [Paint.Stroke]: 'icon-stroke' };
const FOLLOWS_COLOUR = 'icon-colour';
const STROKE_WIDTH = 'icon-stroke-width';

export function iconRowNames(styles: Styles): string[] {
  const painted = [Paint.Fill, Paint.Stroke].filter((paint) => styles[paint] && styles[paint] !== NONE);
  const rows = painted.map((paint) => (styles[paint] === styles.color ? FOLLOWS_COLOUR : ROW_OF[paint]));
  const stroked = painted.includes(Paint.Stroke);
  return [...new Set(rows), ...(stroked ? [STROKE_WIDTH] : [])];
}
