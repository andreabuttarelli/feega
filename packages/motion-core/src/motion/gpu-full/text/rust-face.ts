import { Ligatures, Op, type Command, type Face, type Shaped } from './face';
import type { Axes, Source } from './fonts';

export type TextCore = {
  addFont: (family: string, bytes: Uint8Array) => number;
  covers: (font: number, codePoint: number) => boolean;
  axisTags: (font: number) => string;
  axisRanges: (font: number) => Float32Array;
  metrics: (font: number, tags: string, values: Float32Array) => Float32Array;
  shape: (font: number, tags: string, values: Float32Array, text: string, ligatures: number) => Float32Array;
  outline: (font: number, tags: string, values: Float32Array, glyph: number) => Float32Array;
};

const LIGATURE_CODE: Record<Ligatures, number> = { [Ligatures.On]: 0, [Ligatures.Off]: 1 };
const OP_OF_CODE: Op[] = [Op.Move, Op.Line, Op.Quad, Op.Cubic, Op.Close];
const SHAPED_STRIDE = 5;
const AXIS_STRIDE = 3;
const COORD_DIGITS = 100;

function axesOf(core: TextCore, font: number): Axes {
  const tags = core.axisTags(font).split(',').filter(Boolean);
  const ranges = core.axisRanges(font);
  return Object.fromEntries(tags.map((tag, i) => [tag, [ranges[i * AXIS_STRIDE], ranges[i * AXIS_STRIDE + 1], ranges[i * AXIS_STRIDE + 2]]]));
}

function shapedOf(flat: Float32Array): Shaped[] {
  return Array.from({ length: flat.length / SHAPED_STRIDE }, (_, i) => {
    const [glyph, advance, dx, dy, chars] = flat.subarray(i * SHAPED_STRIDE, (i + 1) * SHAPED_STRIDE);
    return { glyph, advance, dx, dy, chars };
  });
}

function commandsOf(flat: Float32Array): Command[] {
  const commands: Command[] = [];
  for (let i = 0; i < flat.length; ) {
    const count = flat[i + 1];
    commands.push({ op: OP_OF_CODE[flat[i]], at: [...flat.subarray(i + 2, i + 2 + count)] });
    i += 2 + count;
  }
  return commands;
}

function faceOf(core: TextCore, font: number, coords: Record<string, number>): Face {
  const tags = Object.keys(coords).join(',');
  const values = new Float32Array(Object.values(coords));
  const [unitsPerEm, ascent, descent] = core.metrics(font, tags, values);
  return {
    unitsPerEm,
    ascent,
    descent,
    shape: (text, ligatures) => shapedOf(core.shape(font, tags, values, text, LIGATURE_CODE[ligatures])),
    outline: (glyph) => commandsOf(core.outline(font, tags, values, glyph))
  };
}

export function rustSource(core: TextCore, bytes: Uint8Array): Source {
  const font = core.addFont('', bytes);
  const faces = new Map<string, Face>();
  return {
    axes: axesOf(core, font),
    covers: (cp) => core.covers(font, cp),
    at: (coords) => {
      const key = Object.entries(coords)
        .map(([tag, v]) => `${tag}${Math.round(v * COORD_DIGITS)}`)
        .join();
      const face = faces.get(key) ?? faceOf(core, font, coords);
      faces.set(key, face);
      return face;
    }
  };
}
