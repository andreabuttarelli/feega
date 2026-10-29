import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { apply2d, mul2d, IDENTITY, type Affine } from '@feega/motion-core/motion/affine';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { displayListAt, ItemKind, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { textToPath } from './text-outline';
import { lettering, registry } from './fixtures/lettering';

const typeset = { fonts: lettering.fonts, smoothing: Smoothing.Plain };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const blank: MotionDoc = { ...newMotionDoc(MotionFormat.Landscape), fonts: registry };

const SETTLED = 90;
const SCALE = 0.5;
const ROWS_PER_PIXEL = 4;
const MAX_DIFFERENCE = 0.02;

const withClip = (component: string, props: Record<string, unknown>) => must(addClip(blank, { component: component as never, from: 0, durationInFrames: 120, props: { color: '#000000', ...props } }, 't'));

type Polygon = number[];

function polygons(items: Item[], outer: Affine = IDENTITY): Polygon[] {
  return items.flatMap((item): Polygon[] => {
    const matrix = mul2d(outer, item.matrix);
    if (item.kind === ItemKind.Group) {
      return polygons(item.items, matrix);
    }
    if (item.kind !== ItemKind.Path) {
      return [];
    }
    return item.contours.map((c) => c.flatMap((_, i) => (i % 2 === 0 ? apply2d(matrix, [c[i], c[i + 1]]).map((v) => v * SCALE) : [])));
  });
}

type Raster = { left: number; top: number; width: number; height: number; ink: Float64Array };

function rasterOf(shapes: Polygon[], left: number, top: number, width: number, height: number): Raster {
  const ink = new Float64Array(width * height);
  for (let row = 0; row < height * ROWS_PER_PIXEL; row++) {
    const y = top + (row + 0.5) / ROWS_PER_PIXEL;
    const crossings: [number, number][] = [];
    for (const points of shapes) {
      const n = points.length / 2;
      for (let i = 0; i < n; i++) {
        const [ax, ay] = [points[i * 2], points[i * 2 + 1]];
        const [bx, by] = [points[((i + 1) % n) * 2], points[((i + 1) % n) * 2 + 1]];
        if ((ay <= y) === (by <= y)) {
          continue;
        }
        crossings.push([ax + ((y - ay) * (bx - ax)) / (by - ay), by > ay ? 1 : -1]);
      }
    }
    crossings.sort((a, b) => a[0] - b[0]);
    let winding = 0;
    const line = Math.floor(row / ROWS_PER_PIXEL) * width;
    crossings.forEach(([x, turn], i) => {
      const next = crossings[i + 1]?.[0];
      winding += turn;
      if (winding === 0 || next === undefined) {
        return;
      }
      for (let px = Math.max(0, Math.floor(x - left)); px < Math.min(width, Math.ceil(next - left)); px++) {
        const covered = Math.min(px + 1, next - left) - Math.max(px, x - left);
        ink[line + px] += covered / ROWS_PER_PIXEL;
      }
    });
  }
  return { left, top, width, height, ink: ink.map((v) => Math.min(1, v)) };
}

function bounds(shapes: Polygon[]): [number, number, number, number] {
  const xs = shapes.flatMap((s) => s.filter((_, i) => i % 2 === 0));
  const ys = shapes.flatMap((s) => s.filter((_, i) => i % 2 === 1));
  return [Math.floor(Math.min(...xs)) - 2, Math.floor(Math.min(...ys)) - 2, Math.ceil(Math.max(...xs)) + 2, Math.ceil(Math.max(...ys)) + 2];
}

const drawn = (doc: MotionDoc) => polygons(displayListAt(doc, SETTLED, FEEGA_TOKENS, typeset).items);

function difference(text: MotionDoc, outlined: MotionDoc): number {
  const before = drawn(text);
  const after = drawn(outlined);
  const [l, t, r, b] = bounds([...before, ...after]);
  const a = rasterOf(before, l, t, r - l, b - t).ink;
  const z = rasterOf(after, l, t, r - l, b - t).ink;
  const total = a.reduce((n, v) => n + v, 0);
  return a.reduce((n, v, i) => n + Math.abs(v - z[i]), 0) / total;
}

const CASES: { name: string; component: string; props: Record<string, unknown> }[] = [
  { name: 'sans paragraph wrapping at the box width', component: 'Text', props: { text: 'Outlined text keeps every line break where the canvas put it', size: 0.04, width: 0.3, height: 0.3, align: 'left' } },
  { name: 'Google sans, light, centred and tracked', component: 'Text', props: { text: 'Launch week\nis here', font: 'Inter', weight: 300, size: 0.06, tracking: 0.06, width: 0.5, height: 0.3, align: 'center' } },
  { name: 'Google serif, bold, right aligned, loose leading', component: 'Text', props: { text: 'Fine type, set\nby the shaper', font: 'Fraunces', weight: 700, size: 0.05, leading: 1.5, width: 0.45, height: 0.35, align: 'right' } },
  { name: 'variable weight between the named ones', component: 'Text', props: { text: 'Weight 650 office', weight: 650, size: 0.07, width: 0.6, height: 0.2, align: 'left' } },
  { name: 'kerning and ligatures', component: 'Text', props: { text: 'AVAWATo Ty office flow', font: 'Fraunces', weight: 400, size: 0.06, width: 0.7, height: 0.2, align: 'left' } },
  { name: 'synthetic italic', component: 'Text', props: { text: 'Leaning serif', font: 'Fraunces', weight: 400, italic: true, size: 0.06, width: 0.5, height: 0.2, align: 'center' } },
  { name: 'title fitted to its box', component: 'Title', props: { text: 'Make it move\nfast', width: 0.5, height: 0.4 } },
  { name: 'kicker in capitals, tracked', component: 'Kicker', props: { text: 'new release', tracking: 0.12, width: 0.4, height: 0.1 } },
  { name: 'mono, justified', component: 'Text', props: { text: 'mono() => 42 and a line long enough to justify', font: 'mono', size: 0.035, width: 0.35, height: 0.3, align: 'justify' } }
];

describe('outlined text draws the same pixels as the text', () => {
  it.each(CASES)('$name', ({ component, props }) => {
    const text = withClip(component, { x: 0.5, y: 0.5, ...props });
    const outlined = must(textToPath(text, 't', lettering));

    expect(difference(text, outlined)).toBeLessThan(MAX_DIFFERENCE);
  });
});
