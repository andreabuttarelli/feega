import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../../components';
import { boxOf } from '../../layout';
import { paintText, Smoothing, type Ink, type TextEnv } from './painter';
import { boxFace } from './test-face';
import type { FaceBook, Request } from './face';
import { PaintKind } from '../paint';

const stage = { width: 1920, height: 1080 };

function env(props: Record<string, unknown>, fonts: FaceBook): TextEnv {
  const parsed = COMPONENTS.Text.schema.parse(props) as Record<string, unknown>;
  return { component: 'Text', smoothing: Smoothing.Plain, props: parsed, box: boxOf(parsed as never, stage), stage, colour: (v) => (v.startsWith('#') ? v : '#ffffff'), time: 10, trim: 0, fps: 30, still: null, fonts, animators: [], asset: () => null };
}

const inks = (p: ReturnType<typeof paintText>): Ink[] => {
  if (typeof p === 'string') {
    throw new Error(p);
  }
  return p.inks;
};

const colours = (all: Ink[]) =>
  all.map((i) =>
    i.paint.kind === PaintKind.Solid
      ? i.paint.color
          .slice(0, 3)
          .map((v) => Math.round(v * 255))
          .join(',')
      : 'gradient'
  );

describe('rich text on the GPU path', () => {
  it('paints a coloured run in its own colour and the rest in the clip colour', () => {
    const painted = inks(paintText(env({ text: 'abcd', color: '#ffffff', runs: [{ start: 2, end: 4, color: '#ff0000' }] }, () => ({ face: boxFace, skew: 0 }))));
    expect(new Set(colours(painted))).toEqual(new Set(['255,255,255', '255,0,0']));
  });

  it('a bigger run draws bigger glyphs and a taller line', () => {
    const book = () => ({ face: boxFace, skew: 0 });
    const plain = inks(paintText(env({ text: 'ab', size: 0.05, sizing: 'auto' }, book)));
    const big = inks(paintText(env({ text: 'ab', size: 0.05, sizing: 'auto', runs: [{ start: 1, end: 2, size: 0.1 }] }, book)));
    const height = (all: Ink[]) => {
      const ys = all.flatMap((i) => i.contours.flatMap((c) => c.filter((_, k) => k % 2 === 1)));
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(height(big)).toBeGreaterThan(height(plain) * 1.8);
  });

  it('underline and strike add a bar under or through the run', () => {
    const book = () => ({ face: boxFace, skew: 0 });
    const count = (all: Ink[]) => all.reduce((n, i) => n + i.contours.length, 0);
    const plain = count(inks(paintText(env({ text: 'ab' }, book))));
    expect(count(inks(paintText(env({ text: 'ab', runs: [{ start: 0, end: 2, underline: true, strike: true }] }, book))))).toBe(plain + 4);
  });

  it('a linked run is underlined on the canvas like in the export', () => {
    const book = () => ({ face: boxFace, skew: 0 });
    const count = (all: Ink[]) => all.reduce((n, i) => n + i.contours.length, 0);
    const plain = count(inks(paintText(env({ text: 'ab' }, book))));
    expect(count(inks(paintText(env({ text: 'ab', runs: [{ start: 0, end: 2, link: 'https://a.co' }] }, book))))).toBe(plain + 2);
  });

  it('a run fades by its own opacity and changes its own case', () => {
    const asked: number[] = [];
    const book: FaceBook = (_r, code) => {
      asked.push(code);
      return { face: boxFace, skew: 0 };
    };
    const painted = inks(paintText(env({ text: 'ab', runs: [{ start: 1, end: 2, opacity: 0.5, textCase: 'upper' }] }, book)));
    expect(painted.some((i) => i.opacity === 0.5)).toBe(true);
    expect(asked).toContain('B'.codePointAt(0));
  });

  it('asks the font book for the run family too', () => {
    const asked: Request[] = [];
    const book: FaceBook = (request) => {
      asked.push(request);
      return { face: boxFace, skew: 0 };
    };
    paintText(env({ text: 'ab', runs: [{ start: 1, end: 2, font: 'Inter' }] }, book));
    expect(asked.some((r) => r.family === 'Inter')).toBe(true);
  });

  it('asks the font book for the run weight and slant, char by char', () => {
    const asked: Request[] = [];
    const book: FaceBook = (request) => {
      asked.push(request);
      return { face: boxFace, skew: 0 };
    };
    paintText(env({ text: 'ab', weight: 400, runs: [{ start: 1, end: 2, weight: 700, italic: true }] }, book));
    expect(asked.some((r) => r.weight === 700 && r.italic)).toBe(true);
    expect(asked.some((r) => r.weight === 400 && !r.italic)).toBe(true);
  });

  const fillOf = (type: string, extra: Record<string, unknown> = {}) => ({ type, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 1 }], opacity: 1, visible: true, blend: 'normal', ...extra });
  const xs = (all: Ink[]) => all.flatMap((i) => i.contours.flatMap((c) => c.filter((_, k) => k % 2 === 0)));
  const book = () => ({ face: boxFace, skew: 0 });

  it('a gradient run spans the glyphs of the range, not the whole text', () => {
    const painted = inks(paintText(env({ text: 'abcd', sizing: 'auto', runs: [{ start: 2, end: 4, fill: fillOf('linear-gradient', { angle: 0 }) }] }, book)));
    const gradient = painted.find((i) => i.paint.kind === PaintKind.Linear);
    const plain = painted.find((i) => i.paint.kind === PaintKind.Solid);
    expect(gradient).toBeDefined();
    expect(plain).toBeDefined();
    if (gradient?.paint.kind !== PaintKind.Linear) {
      throw new Error('not linear');
    }
    const own = xs([gradient]);
    const reach = gradient.paint.to[0] - gradient.paint.from[0];
    expect(gradient.paint.from[0] - Math.min(...xs([plain!]))).toBeGreaterThan(reach * 0.9);
    expect(gradient.paint.to[0]).toBeCloseTo(Math.max(...own), -1);
  });

  it('a radial gradient run paints a radial paint', () => {
    const painted = inks(paintText(env({ text: 'abcd', runs: [{ start: 0, end: 2, fill: fillOf('radial-gradient') }] }, book)));
    expect(painted.some((i) => i.paint.kind === PaintKind.Radial)).toBe(true);
  });

  it('an angular gradient run paints one sweep over the range', () => {
    const painted = inks(paintText(env({ text: 'abcd', runs: [{ start: 0, end: 2, fill: fillOf('angular-gradient', { angle: 0, center: { x: 0.5, y: 0.5 } }) }] }, book)));
    expect(painted.filter((i) => i.paint.kind === PaintKind.Sweep)).toHaveLength(1);
  });

  it('two ranges with the same gradient each get their own span', () => {
    const f = fillOf('linear-gradient');
    const painted = inks(paintText(env({ text: 'abcdef', sizing: 'auto', runs: [{ start: 0, end: 2, fill: f }, { start: 4, end: 6, fill: f }] }, book)));
    const linear = painted.filter((i) => i.paint.kind === PaintKind.Linear);
    expect(linear).toHaveLength(2);
  });
});
