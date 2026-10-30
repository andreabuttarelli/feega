import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ligatures, Op } from '@feega/motion-core/motion/gpu-full/text/face';
import { fontkitSource } from '@feega/motion-core/motion/gpu-full/text/fontkit-face';

const cff = new Uint8Array(readFileSync('src/lib/motion/fixtures/cff-box.woff2'));

describe('fontkitSource', () => {
  it('reads a font whose outlines are CFF, as many uploaded and page fonts are', () => {
    const face = fontkitSource(cff).at({});
    const [shaped] = face.shape('A', Ligatures.On);
    const commands = face.outline(shaped.glyph);

    expect(shaped.advance).toBe(600);
    expect(commands.map((c) => c.op)).toContain(Op.Cubic);
  });
});
