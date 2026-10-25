import { describe, expect, it } from 'vitest';
import { DrawTool } from '$lib/motion/draw-tool';
import { TextSizing } from '@feega/motion-core/motion/text-sizing';
import { svgDrawings } from './svg-drawings';

const CARD = `<svg viewBox="0 0 100 50"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="100" height="50" fill="url(#g)"/><text x="10" y="30" font-size="20" font-weight="700" fill="#336699">Hi</text></svg>`;

describe('svgDrawings', () => {
  it('turns shapes into pen wires that keep their gradient, centred on the drop point', () => {
    const [pen] = svgDrawings(CARD, { x: 500, y: 300 });

    expect(pen.wire).toMatchObject({ tool: DrawTool.Pen, gradient: { type: 'linear-gradient', angle: 90 } });
    expect(pen.box).toEqual({ left: 450, top: 275, width: 100, height: 50 });
  });

  it('turns text into text wires with colour and weight, after the shapes', () => {
    const text = svgDrawings(CARD, { x: 500, y: 300 })[1];

    expect(text.wire).toMatchObject({ tool: DrawTool.Text, text: 'Hi', color: '#336699', weight: 700, sizing: TextSizing.AutoWidth });
    expect(text.box.left).toBe(460);
  });

  it('returns nothing for markup without shapes or text', () => {
    expect(svgDrawings('<svg></svg>', { x: 0, y: 0 })).toEqual([]);
  });
});
