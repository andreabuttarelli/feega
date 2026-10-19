import { IDENTITY, mul2d, type Affine } from '../../affine';
import type { OnPath } from '../../hyperframes/text-path';
import { AnimatorUnit, type TextAnimator } from '../../text-animators/model';
import { placeGlyphs } from '../../text-path/layout';
import { FillRule, PaintKind } from '../paint';
import { rgbaOf } from '../rgba';
import { animation } from './animators';
import { Ligatures, type FaceBook, type Shaped, type Face } from './face';
import { about, axesOf, casedOf, glyphContours, moved, scaleOf, SMOOTHING, STILL, TextGap, tintedPaint, transformed, type Colour, type Ink, type Painted, type Smoothing, type TextComponent } from './painter';

type Size = { width: number; height: number };

export type PathEnv = { component: TextComponent; smoothing: Smoothing; props: Record<string, unknown>; stage: Size; box: Size; colour: (v: string) => string; fonts: FaceBook; animators: readonly TextAnimator[]; onPath: OnPath };

type Char = { face: Face; skew: number; glyphs: Shaped[]; advance: number; space: boolean };

const PERCENT = 100;
const LAYOUT_UNIT = 64;
const BASELINE_EM = 0.8;
const SPACE = ' ';
const SPACE_CODE = 0x20;
const WHITESPACE = /\s/;

const turned = (x: number, y: number, degrees: number): Affine => {
  const r = (degrees * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), x, y];
};

export function paintOnPath(env: PathEnv): Painted | TextGap {
  const p = env.props;
  const size = Math.round(Number(p.size) * Math.min(env.stage.width, env.stage.height) * PERCENT) / PERCENT;
  const request = { family: String(p.font), weight: Number(p.weight), italic: p.italic === true, axes: axesOf(p), size };
  const tracking = Number(p.tracking) * size;
  const ligatures = tracking === 0 ? Ligatures.On : Ligatures.Off;
  const chars: (Char | null)[] = [...casedOf(env.component, p)].map((c) => {
    const char = WHITESPACE.test(c) ? SPACE : c;
    const resolved = env.fonts(request, char.codePointAt(0)!);
    if (!resolved) {
      return null;
    }
    const glyphs = resolved.face.shape(char, ligatures);
    const scale = size / resolved.face.unitsPerEm;
    return { ...resolved, glyphs, advance: glyphs.reduce((n, g) => n + g.advance, 0) * scale + tracking, space: char === SPACE };
  });
  if (chars.some((c) => c === null)) {
    return TextGap.Glyph;
  }
  const drawn = chars as Char[];
  const primary = env.fonts(request, SPACE_CODE)?.face ?? drawn[0]?.face;
  if (!primary) {
    return TextGap.Font;
  }
  const scale = size / primary.unitsPerEm;
  const ascent = Math.round(primary.ascent * scale);
  const descent = Math.round(primary.descent * scale);
  const lineHeight = Math.floor(Math.round(size * LAYOUT_UNIT)) / LAYOUT_UNIT;
  const baseline = Math.floor((lineHeight - ascent - descent) / 2) + ascent - SMOOTHING[env.smoothing].rise;
  const run = animation(String(p.text), env.animators);
  const colour: Colour = (v) => rgbaOf(env.colour(v)) ?? [0, 0, 0, 1];
  const color = colour(String(p.color));
  let letter = 0;
  const looks = drawn.map((char) => (run && !char.space ? run.at({ [AnimatorUnit.Char]: letter++, [AnimatorUnit.Word]: 0, [AnimatorUnit.Line]: 0 }) : STILL));
  const advances = drawn.map((char, i) => char.advance + (run?.tracks && !char.space ? looks[i].spacing - Number(p.tracking) : 0) * size);
  const places = placeGlyphs(env.onPath.curve, advances, env.onPath.placement);
  const inks: Ink[] = [];
  drawn.forEach((char, i) => {
    if (char.space) {
      return;
    }
    const look = looks[i];
    const [x, y, angle] = places[i];
    const box = mul2d(mul2d(turned(x, y, angle), [1, 0, 0, 1, -advances[i] / 2, -BASELINE_EM * size]), about([0, 0, advances[i], lineHeight], look.turn, size));
    const own = size / char.face.unitsPerEm;
    let pen = 0;
    const contours = char.glyphs.flatMap((g) => {
      const outline = moved(glyphContours(char.face, g.glyph, size, char.skew, SMOOTHING[env.smoothing].darken(size)), pen + g.dx * own, baseline - g.dy * own);
      pen += g.advance * own;
      return outline;
    });
    const paint = tintedPaint({ kind: PaintKind.Solid, color }, look, colour);
    inks.push({ contours: transformed(contours, box), paint, rule: FillRule.NonZero, opacity: look.opacity, matrix: IDENTITY, blur: look.blur * scaleOf(look.turn) });
  });
  return { inks: inks.filter((ink) => ink.opacity > 0 && ink.contours.length), frame: { left: 0, top: 0, ...env.box } };
}
