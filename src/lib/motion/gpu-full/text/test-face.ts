import { Ligatures, Op, type Face, type FaceBook, type Resolved } from './face';

export const UPM = 1000;
export const WIDE = 500;
export const SPACE = 250;
const SPACE_CODE = 32;

export const seenLigatures: Ligatures[] = [];

export const boxFace: Face = {
  unitsPerEm: UPM,
  ascent: 800,
  descent: 200,
  shape: (text, ligatures) => {
    seenLigatures.push(ligatures);
    return [...text].map((c) => ({ glyph: c.codePointAt(0)!, advance: c.codePointAt(0) === SPACE_CODE ? SPACE : WIDE, dx: 0, dy: 0, chars: 1 }));
  },
  outline: (glyph) =>
    glyph === SPACE_CODE
      ? []
      : [
          { op: Op.Move, at: [0, 0] },
          { op: Op.Line, at: [WIDE, 0] },
          { op: Op.Line, at: [WIDE, 700] },
          { op: Op.Line, at: [0, 700] },
          { op: Op.Close, at: [] }
        ]
};

export const boxBook =
  (missing: ReadonlySet<string> = new Set()): FaceBook =>
  (_request, codePoint): Resolved | null =>
    missing.has(String.fromCodePoint(codePoint)) ? null : { face: boxFace, skew: 0 };
