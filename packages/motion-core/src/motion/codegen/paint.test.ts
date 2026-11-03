import { describe, expect, it } from 'vitest';
import type { MotionClip } from '../doc';
import { fillsSchema } from '../fill/model';
import { fillLayersHtml } from '../fill/render';
import { backgroundRules, type Painter } from './paint';
import { ColourRole, TokenBook } from './tokens';

const painter: Painter = { tokens: new TokenBook(null), unit: 1, asset: (id) => id, colourVar: () => undefined };
const stops = [
  { color: '#ff0000', pos: 0 },
  { color: '#0000ff', pos: 1 }
];

const cssAngle = (css: string) => Number(/linear-gradient\((-?[\d.]+)deg/.exec(css)?.[1]);

describe('linear gradient in exported css', () => {
  it.each([0, 45, 90, -30])('points the same way the renderer paints it at %i°', (angle) => {
    const fills = fillsSchema.parse([{ type: 'linear-gradient', angle, stops }]);
    const clip = { props: { fills } } as unknown as MotionClip;
    const image = backgroundRules(clip, painter, ColourRole.Fill).find(([property]) => property === 'background-image')?.[1] as string;
    expect(cssAngle(image)).toBe(cssAngle(fillLayersHtml(fills)));
  });
});
