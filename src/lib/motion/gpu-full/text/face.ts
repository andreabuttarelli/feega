export enum Op {
  Move = 'M',
  Line = 'L',
  Quad = 'Q',
  Cubic = 'C',
  Close = 'Z'
}

export type Command = { op: Op; at: number[] };

export type Shaped = { glyph: number; advance: number; dx: number; dy: number; chars: number };

export type Face = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  shape: (text: string, ligatures: Ligatures) => Shaped[];
  outline: (glyph: number) => Command[];
};

export enum Ligatures {
  On = 'on',
  Off = 'off'
}

export type Request = { family: string; weight: number; italic: boolean; size: number; axes: Record<string, number> };

export type Resolved = { face: Face; skew: number };

export type FaceBook = (request: Request, codePoint: number) => Resolved | null;
