import { create } from 'fontkit';
import { Ligatures, Op, type Command, type Face, type Shaped } from './face';
import type { Axes, Source } from './fonts';
import { quadraticPath, type TruePoint } from './quadratic';

type KitPoint = TruePoint & { copy: () => KitPoint };
type Component = { glyphID: number; dx: number; dy: number; scaleX: number; scaleY: number; scale01: number; scale10: number };
type RawGlyph = { numberOfContours: number; points?: KitPoint[]; components?: Component[] };
type KitGlyph = { id: number; codePoints: number[]; _decode: () => RawGlyph | null; path: { commands: { command: string; args: number[] }[] } };
type Processor = { transformPoints: (id: number, points: KitPoint[]) => void };
type KitFont = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  'OS/2'?: { typoAscender: number; typoDescender: number; fsSelection: { useTypoMetrics: boolean } };
  fvar?: { axis: { axisTag: string; minValue: number; maxValue: number; defaultValue: number }[] };
  directory: { tables: Record<string, unknown> };
  variationCoords: number[] | null;
  _glyphs: Record<number, unknown>;
  _variationProcessor: Processor | null;
  hasGlyphForCodePoint: (cp: number) => boolean;
  getGlyph: (id: number) => KitGlyph;
  layout: (text: string, features: Record<string, boolean>) => { glyphs: KitGlyph[]; positions: { xAdvance: number; xOffset: number; yOffset: number }[] };
};

const OPTIONAL_LIGATURES = { liga: false, clig: false, dlig: false, hlig: false, calt: false };
const FEATURES: Record<Ligatures, Record<string, boolean>> = { [Ligatures.On]: {}, [Ligatures.Off]: OPTIONAL_LIGATURES };
const PROCESSOR = '_variationProcessor';

const KIT_OP: Record<string, Op> = { moveTo: Op.Move, lineTo: Op.Line, quadraticCurveTo: Op.Quad, bezierCurveTo: Op.Cubic, closePath: Op.Close };

function processorGetter(font: KitFont): (this: KitFont) => Processor | null {
  for (let proto = Object.getPrototypeOf(font); proto; proto = Object.getPrototypeOf(proto)) {
    const get = Object.getOwnPropertyDescriptor(proto, PROCESSOR)?.get;
    if (get) {
      return get;
    }
  }
  throw new Error('font without a variation processor');
}

const point = (x: number, y: number, onCurve: boolean, endContour: boolean): KitPoint => ({ x, y, onCurve, endContour, copy: () => point(x, y, onCurve, endContour) });

const PHANTOMS = 4;

function varied(points: KitPoint[], id: number, processor: Processor | null): KitPoint[] {
  const own = points.map((p) => p.copy());
  if (processor) {
    processor.transformPoints(id, [...own, ...Array.from({ length: PHANTOMS }, () => point(0, 0, false, true))]);
  }
  return own;
}

function outlinePoints(base: KitFont, id: number, processor: Processor | null): KitPoint[] {
  const raw = base.getGlyph(id)._decode();
  if (!raw || raw.numberOfContours === 0) {
    return [];
  }
  if (raw.numberOfContours > 0) {
    return varied(raw.points ?? [], id, processor);
  }
  const components = raw.components ?? [];
  const offsets = varied(components.map((c) => point(c.dx, c.dy, true, true)), id, processor);
  return components.flatMap((c, i) =>
    outlinePoints(base, c.glyphID, processor).map((p) => point(p.x * c.scaleX + p.y * c.scale01 + offsets[i].x, p.y * c.scaleY + p.x * c.scale10 + offsets[i].y, p.onCurve, p.endContour))
  );
}

function metricsOf(font: KitFont): { ascent: number; descent: number } {
  const os2 = font['OS/2'];
  return os2?.fsSelection.useTypoMetrics ? { ascent: os2.typoAscender, descent: -os2.typoDescender } : { ascent: font.ascent, descent: -font.descent };
}

function axesOf(font: KitFont): Axes {
  return Object.fromEntries((font.fvar?.axis ?? []).map((a) => [a.axisTag.trim(), [a.minValue, a.maxValue, a.defaultValue]]));
}

function instance(base: KitFont, axes: Axes, coords: Record<string, number>): KitFont {
  const inst = Object.create(base) as KitFont;
  inst._glyphs = {};
  inst.variationCoords = base.fvar ? base.fvar.axis.map((a) => Math.min(a.maxValue, Math.max(a.minValue, coords[a.axisTag.trim()] ?? a.defaultValue))) : null;
  if (Object.keys(axes).length) {
    processorGetter(base).call(inst);
  }
  return inst;
}

function faceOf(base: KitFont, inst: KitFont): Face {
  const glyf = Boolean(base.directory.tables.glyf);
  const processor = Object.keys(axesOf(base)).length ? inst._variationProcessor : null;
  return {
    unitsPerEm: base.unitsPerEm,
    ...metricsOf(base),
    shape: (text, ligatures): Shaped[] => {
      const run = inst.layout(text, FEATURES[ligatures]);
      return run.glyphs.map((g, i) => ({ glyph: g.id, advance: run.positions[i].xAdvance, dx: run.positions[i].xOffset, dy: run.positions[i].yOffset, chars: Math.max(1, g.codePoints.length) }));
    },
    outline: (glyph): Command[] => (glyf ? quadraticPath(outlinePoints(base, glyph, processor)) : inst.getGlyph(glyph).path.commands.map((c) => ({ op: KIT_OP[c.command], at: c.args })))
  };
}

const COORD_DIGITS = 100;

export function fontkitSource(bytes: Uint8Array): Source {
  const base = create(bytes) as KitFont;
  base.getGlyph(0)._decode();
  const axes = axesOf(base);
  const faces = new Map<string, Face>();
  return {
    axes,
    covers: (cp) => base.hasGlyphForCodePoint(cp),
    at: (coords) => {
      const key = Object.entries(coords)
        .map(([tag, v]) => `${tag}${Math.round(v * COORD_DIGITS)}`)
        .join();
      const hit = faces.get(key);
      if (hit) {
        return hit;
      }
      const face = faceOf(base, instance(base, axes, coords));
      faces.set(key, face);
      return face;
    }
  };
}
