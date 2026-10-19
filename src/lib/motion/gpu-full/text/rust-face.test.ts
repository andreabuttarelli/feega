import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initSync, TextCore } from '../../../../../static/gpu-text/gpu_text.js';
import { Ligatures, Op } from './face';
import { fontkitSource } from './fontkit-face';
import { rustSource } from './rust-face';

initSync({ module: readFileSync('static/gpu-text/gpu_text_bg.wasm') });

const HALF_UNIT = 0.5;
const bytes = new Uint8Array(readFileSync('static/fonts/dm-sans-latin.woff2'));
const rust = rustSource(new TextCore() as unknown as Parameters<typeof rustSource>[0], bytes);
const kit = fontkitSource(bytes);

describe('rustSource', () => {
  it('reads the axes and coverage fontkit reads', () => {
    expect(Object.keys(rust.axes)).toEqual(Object.keys(kit.axes));
    expect(rust.covers(0x61)).toBe(true);
    expect(rust.covers(0x2605)).toBe(false);
  });

  it('shapes and measures like the fontkit face', () => {
    const [r, k] = [rust.at({ wght: 700 }), kit.at({ wght: 700 })];

    expect([r.unitsPerEm, r.ascent, r.descent]).toEqual([k.unitsPerEm, k.ascent, k.descent]);
    const alone = (face: typeof r) => [...'Wave fi'].map((c) => face.shape(c, Ligatures.Off)[0].advance);
    const kitAlone = alone(k);

    alone(r).forEach((advance, i) => expect(Math.abs(advance - kitAlone[i])).toBeLessThan(HALF_UNIT));
    expect(rust.at({}).shape('Wave fi', Ligatures.Off)).toEqual(kit.at({}).shape('Wave fi', Ligatures.Off).map((g) => ({ ...g, advance: Math.round(g.advance) })));
  });

  it('outlines a glyph as closed contours in font units', () => {
    const face = rust.at({});
    const commands = face.outline(face.shape('o', Ligatures.On)[0].glyph);

    expect(commands[0].op).toBe(Op.Move);
    expect(commands.filter((c) => c.op === Op.Close)).toHaveLength(2);
  });
});
