import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { Ease } from '../design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { composeHtml } from '../hyperframes/compose';
import { EffectKind } from './registry';
import { addEffect } from './ops';
import { effectKey, effectsProblem } from './model';
import { LUT_PRESETS, LutPreset, applyLut, compileLut, evalLut, lutFromCube, parseCube, type Rgb } from './lut';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 30 }, 'i'));
const html = (d: MotionDoc) => composeHtml({ doc: d, tokens: FEEGA_TOKENS, assets: {} });

const cube = (size: number, f: (c: Rgb) => Rgb) => {
  const lines = ['TITLE "test"', `LUT_3D_SIZE ${size}`];
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        lines.push(f([r / (size - 1), g / (size - 1), b / (size - 1)]).join(' '));
      }
    }
  }
  return lines.join('\n');
};

const GRID: Rgb[] = [0, 0.25, 0.5, 0.75, 1].flatMap((r) => [0, 0.5, 1].flatMap((g) => [0, 0.5, 1].map((b) => [r, g, b] as Rgb)));
const worst = (a: (c: Rgb) => Rgb, b: (c: Rgb) => Rgb) => Math.max(...GRID.flatMap((c) => a(c).map((v, i) => Math.abs(v - b(c)[i]))));

describe('.cube files', () => {
  it('reads a 3D LUT, red fastest', () => {
    const parsed = parseCube(cube(2, ([r, g, b]) => [r, g, b]));
    expect(parsed).toMatchObject({ size: 2 });
    expect(typeof parsed === 'string' ? null : parsed.table.slice(3, 6)).toEqual([1, 0, 0]);
  });

  it('refuses a file that is not a LUT', () => {
    expect(parseCube('hello')).toEqual(expect.stringContaining('LUT_3D_SIZE'));
    expect(parseCube('LUT_3D_SIZE 2\n0 0 0')).toEqual(expect.stringContaining('8'));
  });
});

describe('a LUT compiles to a colour matrix and three curves that every renderer runs', () => {
  it('an identity LUT compiles to identity', () => {
    const lut = lutFromCube(cube(9, (c) => c), 'id');
    expect(typeof lut).not.toBe('string');
    expect(worst((c) => evalLut(lut as never, c), (c) => c)).toBeLessThan(0.01);
  });

  it('a channel mix and a contrast curve are reproduced closely', () => {
    const look = ([r, g, b]: Rgb): Rgb => {
      const s = (x: number) => Math.min(1, Math.max(0, 0.5 + (x - 0.5) * 1.3));
      return [s(0.8 * r + 0.2 * g), s(g), s(0.7 * b + 0.3 * r)];
    };
    const lut = lutFromCube(cube(17, look), 'mix');
    expect(worst((c) => evalLut(lut as never, c), look)).toBeLessThan(0.06);
  });

  it.each(Object.values(LutPreset))('preset %s compiles to a valid effect', (preset) => {
    const lut = compileLut(LUT_PRESETS[preset].look, preset);
    expect(lut.matrix).toHaveLength(12);
    expect(lut.curves.every((c) => c.every((v) => v >= 0 && v <= 1))).toBe(true);
  });
});

describe('grading effects', () => {
  it('levels map input black and white to output black and white', () => {
    const graded = must(addEffect(doc, 'i', EffectKind.Levels, 'lv', { inBlack: 0.1, inWhite: 0.9, gamma: 1, outBlack: 0, outWhite: 1 }));
    expect(html(graded)).toMatch(/<feFuncR[^>]*type="table" tableValues="0 0 0.03/);
  });

  it('lift, gamma and gain write a curve per channel', () => {
    const graded = must(addEffect(doc, 'i', EffectKind.LiftGammaGain, 'lgg', { liftR: 0.2 }));
    const page = html(graded);
    expect(page).toMatch(/<feFuncR[^>]*tableValues="0.2 /);
    expect(page).toMatch(/<feFuncG[^>]*tableValues="0 /);
  });

  it('a LUT effect renders its matrix and curves, mixed by amount', () => {
    const withLut = must(applyLut(must(addEffect(doc, 'i', EffectKind.Lut, 'g', { amount: 0.5 })), 'i', 'g', compileLut(LUT_PRESETS[LutPreset.TealOrange].look, 'teal')));
    const page = html(withLut);
    expect(page).toContain('<feColorMatrix');
    expect(page).toMatch(/operator="arithmetic" k1="0" k2="0.5" k3="0.5"/);
  });

  it('a LUT effect with no LUT loaded passes the picture through', () => {
    expect(html(must(addEffect(doc, 'i', EffectKind.Lut, 'g')))).not.toContain("id=\"ef-i-g\"");
  });

  it('grading amounts and levels take keyframes, so the grade is the same at every seek', () => {
    const graded = must(addEffect(doc, 'i', EffectKind.Levels, 'lv'));
    const keyed = must(setKeyframes(graded, 'i', effectKey('lv', 'gamma'), [{ frame: 0, value: 1, ease: Ease.Linear }, { frame: 20, value: 2, ease: Ease.Linear }]));
    expect(html(keyed)).toContain('tl.set("#ef-i-lv-1"');
    expect(html(keyed)).toBe(html(structuredClone(keyed)));
  });

  it('a malformed LUT is refused by the doc', () => {
    const graded = must(addEffect(doc, 'i', EffectKind.Lut, 'g'));
    const effects = findClip(graded, 'i')!.clip.effects.map((e) => ({ ...e, lut: { name: 'bad', matrix: [1], curves: [[0, 1], [0, 1], [0, 1]] } }));
    expect(effectsProblem(effects as never)).not.toBeNull();
  });
});
