import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { COMPONENTS } from '$lib/motion/components';
import { drawnElement, drawnOf } from '$lib/motion/draw-create';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '$lib/motion/doc';
import { apply2d } from '$lib/motion/affine';
import { displayListAt, ItemKind, type PathItem } from '$lib/motion/gpu-full/display-list';
import { flatten, parsePath } from '$lib/motion/shape/geometry';
import { shapeMarkup, type ShapeLook } from '$lib/motion/shape/render';
import { svgShapes } from '$lib/motion/shape/svg-import';
import { pastedInFrame } from './frame-paste';
import { svgDrawings } from './svg-drawings';
import { isFilled, polygonsOf, SampleRule, type Polygon } from './fill-sample.testkit';

const fixture = (name: string) => readFileSync(`tests/fixtures/svg/${name}.svg`, 'utf8');

type Probe = { at: [number, number]; filled: boolean; why: string };
type Case = { name: string; probes: Probe[] };

const CASES: Case[] = [
  {
    name: 'designflow-logo',
    probes: [
      { at: [20, 20], filled: false, why: 'centre of the triangle cut-out' },
      { at: [20, 11], filled: false, why: 'near the triangle apex, inside the cut-out' },
      { at: [3, 3], filled: true, why: 'inside the rounded square, top-left corner' },
      { at: [37, 37], filled: true, why: 'inside the rounded square, bottom-right corner' },
      { at: [20, 4], filled: true, why: 'top edge midpoint' },
      { at: [20, 37], filled: true, why: 'bottom edge midpoint' },
      { at: [4, 20], filled: true, why: 'left edge midpoint' },
      { at: [36, 20], filled: true, why: 'right edge midpoint' },
      { at: [0.5, 0.5], filled: false, why: 'outside the rounded corner' }
    ]
  },
  {
    name: 'nested-evenodd',
    probes: [
      { at: [20, 20], filled: false, why: 'evenodd hole' },
      { at: [5, 5], filled: true, why: 'frame' }
    ]
  },
  {
    name: 'nested-nonzero',
    probes: [
      { at: [20, 20], filled: true, why: 'same winding under nonzero stays solid' },
      { at: [5, 5], filled: true, why: 'frame' }
    ]
  },
  {
    name: 'relative-nonzero-hole',
    probes: [
      { at: [20, 20], filled: false, why: 'opposite winding under nonzero cuts a hole' },
      { at: [7, 7], filled: true, why: 'frame' }
    ]
  },
  {
    name: 'arcs-evenodd-ring',
    probes: [
      { at: [20, 20], filled: false, why: 'centre of the ring' },
      { at: [20, 8], filled: true, why: 'on the ring' },
      { at: [1, 1], filled: false, why: 'outside the circle' }
    ]
  }
];

const must = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) {
    throw new Error('missing');
  }
  return value;
};

const frame = newMotionDoc(MotionFormat.Landscape);
const SCALE = 2;
const CENTRE = { x: 0.5, y: 0.5 };

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

function displayListSample(doc: MotionDoc, at: [number, number]): boolean {
  const items = displayListAt(doc, 0, FEEGA_TOKENS).items.filter((i): i is PathItem => i.kind === ItemKind.Path);
  return items.some((item) => isFilled(polygonsOf(item.contours, (p) => apply2d(item.matrix, p)), item.rule as unknown as SampleRule, at));
}

function exportSample(doc: MotionDoc, at: [number, number]): boolean {
  const clip = must(clipsOf(doc).find((c) => c.component === 'Shape'));
  const props = clip.props as Record<string, number>;
  const size = { w: props.width * doc.width, h: props.height * doc.height };
  const origin = [(props.x - props.width / 2) * doc.width, (props.y - props.height / 2) * doc.height];
  const look = COMPONENTS.Shape.schema.parse(clip.props) as unknown as ShapeLook;
  const markup = shapeMarkup(look, { id: 'a', size, unit: 1000, time: 0, color: (v) => v });
  const rule = markup.includes('fill-rule:evenodd') ? SampleRule.EvenOdd : SampleRule.NonZero;
  const d = must(markup.match(/<path d="([^"]+)"/))[1];
  const outline = parsePath(d);
  if (typeof outline === 'string') {
    throw new Error(outline);
  }
  const polygons: Polygon[] = outline.map((c) => flatten(c).map(([x, y]): [number, number] => [x + origin[0], y + origin[1]]));
  return isFilled(polygons, rule, at);
}

describe.each(CASES.map((c) => [c.name, c.probes] as const))('pasting %s.svg', (name, probes) => {
  const svg = fixture(name);
  const { size } = svgShapes(svg);

  describe('into a frame', () => {
    const pasted = must(pastedInFrame(frame, { svg }, CENTRE, SCALE, 0, (() => { let n = 0; return () => `p${++n}`; })())).doc;
    const place = ([x, y]: [number, number]): [number, number] => [frame.width * CENTRE.x + (x - size.width / 2) * SCALE, frame.height * CENTRE.y + (y - size.height / 2) * SCALE];

    it.each(probes)('GPU display list: $why', ({ at, filled }) => {
      expect(displayListSample(pasted, place(at))).toBe(filled);
    });

    it.each(probes)('export markup: $why', ({ at, filled }) => {
      expect(exportSample(pasted, place(at))).toBe(filled);
    });
  });

  describe('onto the canvas', () => {
    const [pen] = svgDrawings(svg, { x: 0, y: 0 });
    const drawn = must(drawnOf(pen.wire) as Exclude<ReturnType<typeof drawnOf>, string>);
    const made = drawnElement(drawn, 'el');
    const element = made.ok ? made : null;
    const place = ([x, y]: [number, number]): [number, number] => {
      const box = must(element).box;
      const doc = must(element).doc;
      return [((x - size.width / 2 - box.left) / box.width) * doc.width, ((y - size.height / 2 - box.top) / box.height) * doc.height];
    };

    it.each(probes)('GPU display list: $why', ({ at, filled }) => {
      expect(displayListSample(must(element).doc, place(at))).toBe(filled);
    });

    it.each(probes)('export markup: $why', ({ at, filled }) => {
      expect(exportSample(must(element).doc, place(at))).toBe(filled);
    });
  });
});
