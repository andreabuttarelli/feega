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
