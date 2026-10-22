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
});
