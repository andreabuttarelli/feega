import TABLE from './template/part-usage.json';

export enum ShapePaint {
  Fill = 'fill',
  Background = 'background'
}

export const GEOMETRY_TAGS = ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'];
const MEDIA_TAGS = ['image', 'img', 'video', 'lineargradient', 'radialgradient', 'pattern', 'clippath', 'filter'];
const UNPAINTED = ['transparent', 'none'];

const tagsOf = (el: Element) => [el, ...el.querySelectorAll('*')].map((e) => e.tagName.toLowerCase());

export function markupPaint(el: Element): ShapePaint | null {
  const tags = tagsOf(el);
  if ((el.textContent ?? '').trim() || tags.some((t) => MEDIA_TAGS.includes(t)) || UNPAINTED.includes(el.getAttribute('fill') ?? '')) {
    return null;
  }
  if (tags.some((t) => GEOMETRY_TAGS.includes(t))) {
    return ShapePaint.Fill;
  }
  return el.children.length === 0 ? ShapePaint.Background : null;
}

const PAINTS: readonly string[] = Object.values(ShapePaint);
const SHAPES = TABLE as Record<string, { shapes?: Record<string, string> }>;

export function shapePaint(component: string, field: string): ShapePaint | null {
  const paint = SHAPES[component]?.shapes?.[field];
  return paint && PAINTS.includes(paint) ? (paint as ShapePaint) : null;
}
