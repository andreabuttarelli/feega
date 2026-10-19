import { Ligatures, type Face, type FaceBook, type Request } from './face';

export enum Spaces {
  Collapse = 'collapse',
  Keep = 'keep'
}

export enum Shaping {
  Runs = 'runs',
  Chars = 'chars'
}

export type Flow = { spaces: Spaces; wraps: boolean };

export type Type = { request: Omit<Request, 'size'>; size: number; tracking: number; leading: number; inset: number; shaping: Shaping };

export type Glyph = { face: Face; glyph: number; skew: number; x: number; dy: number; char: number; pen: number; advance: number; word: number; letter: number };

export type Line = { glyphs: Glyph[]; width: number; baseline: number };

export type Block = { lines: Line[]; top: number; height: number };

export type Laid = { blocks: Block[]; width: number; height: number; ascent: number; descent: number; lineHeight: number; missing: boolean };

type Token = { glyphs: Glyph[]; width: number; space: boolean };

const SPACE = ' ';
const SPACE_CODE = 0x20;
const COLLAPSIBLE = /[ \t\n]+/g;
const TOKEN = / +|[^ ]+/g;
const SLACK = 1e-6;
const LAYOUT_UNIT = 64;

const collapsed = (text: string, spaces: Spaces) => (spaces === Spaces.Collapse ? text.replace(COLLAPSIBLE, SPACE).trim() : text);

function runsOf(text: string, type: Type, book: FaceBook): { runs: { text: string; face: Face; skew: number; at: number }[]; missing: boolean } {
  const request = { ...type.request, size: type.size };
  const runs: { text: string; face: Face; skew: number; at: number }[] = [];
  let missing = false;
  let at = 0;
  for (const char of text) {
    const resolved = book(request, char.codePointAt(0)!);
    if (!resolved) {
      missing ||= char !== SPACE;
      at += 1;
      continue;
    }
    const last = runs.at(-1);
    if (last && last.face === resolved.face && last.skew === resolved.skew && last.at + [...last.text].length === at) {
      last.text += char;
    } else {
      runs.push({ text: char, face: resolved.face, skew: resolved.skew, at });
    }
    at += 1;
  }
  return { runs, missing };
}

function shapedOf(text: string, first: number, type: Type, book: FaceBook): Token & { missing: boolean } {
  const ligatures = type.tracking === 0 ? Ligatures.On : Ligatures.Off;
  const tracking = type.tracking * type.size;
  const { runs, missing } = runsOf(text, type, book);
  const glyphs: Glyph[] = [];
  let x = 0;
  for (const run of runs) {
    const scale = type.size / run.face.unitsPerEm;
    let char = first + run.at;
    for (const g of run.face.shape(run.text, ligatures)) {
      const advance = g.advance * scale + tracking * g.chars;
      glyphs.push({ face: run.face, glyph: g.glyph, skew: run.skew, x: x + g.dx * scale, dy: g.dy * scale, char, pen: x, advance, word: -1, letter: char - first });
      x += advance;
      char += g.chars;
    }
  }
  return { glyphs, width: x, space: text.startsWith(SPACE), missing };
}

function tokenOf(text: string, first: number, word: number, type: Type, book: FaceBook): Token & { missing: boolean } {
  const pieces = type.shaping === Shaping.Chars ? [...text] : [text];
  const token: Token & { missing: boolean } = { glyphs: [], width: 0, space: text.startsWith(SPACE), missing: false };
  for (const [i, piece] of pieces.entries()) {
    const shaped = shapedOf(piece, first + i, type, book);
    token.glyphs.push(...shift(shaped.glyphs, token.width).map((g) => ({ ...g, word: token.space ? -1 : word, letter: g.char - first })));
    token.width += shaped.width;
    token.missing ||= shaped.missing;
  }
  return token;
}

function shift(glyphs: Glyph[], by: number): Glyph[] {
  return glyphs.map((g) => ({ ...g, x: g.x + by, pen: g.pen + by }));
}

function wrapped(tokens: Token[], flow: Flow, room: number, inset: number): { glyphs: Glyph[]; width: number }[] {
  const lines: { glyphs: Glyph[]; width: number }[] = [];
  let glyphs: Glyph[] = [];
  let pen = inset;
  let inked = inset;
  let words = 0;
  let kept = 0;
  const close = () => {
    lines.push({ glyphs: glyphs.slice(0, kept), width: inked });
    glyphs = [];
    pen = 0;
    inked = 0;
    words = 0;
    kept = 0;
  };
  for (const token of tokens) {
    if (token.space) {
      if (words === 0 && lines.length > 0 && flow.spaces === Spaces.Collapse) {
        continue;
      }
      glyphs.push(...shift(token.glyphs, pen));
      pen += token.width;
      inked = flow.spaces === Spaces.Keep && words === 0 ? pen : inked;
      kept = flow.spaces === Spaces.Keep && words === 0 ? glyphs.length : kept;
      continue;
    }
    if (flow.wraps && words > 0 && pen + token.width > room + SLACK) {
      close();
    }
    glyphs.push(...shift(token.glyphs, pen));
    pen += token.width;
    inked = pen;
    kept = glyphs.length;
    words += 1;
  }
  close();
  lines[lines.length - 1].width += inset;
  return lines;
}

function primary(type: Type, book: FaceBook, text: string): Face | null {
  const request = { ...type.request, size: type.size };
  const first = text.codePointAt(0);
  return (book(request, SPACE_CODE) ?? (first === undefined ? null : book(request, first)))?.face ?? null;
}

export function layOut(paragraphs: string[], type: Type, flow: Flow, room: number, book: FaceBook): Laid {
  const face = primary(type, book, paragraphs.join(''));
  const scale = face ? type.size / face.unitsPerEm : 0;
  const ascent = Math.round((face?.ascent ?? 0) * scale);
  const descent = Math.round((face?.descent ?? 0) * scale);
  const lineHeight = Math.floor((Math.round(type.size * LAYOUT_UNIT) / LAYOUT_UNIT) * type.leading * LAYOUT_UNIT) / LAYOUT_UNIT;
  const baseline = Math.floor((lineHeight - ascent - descent) / 2) + ascent;
  let missing = false;
  let top = 0;
  const blocks = paragraphs.map((paragraph): Block => {
    const text = collapsed(paragraph, flow.spaces);
    let first = 0;
    let words = 0;
    const tokens = [...text.matchAll(TOKEN)].map((m) => {
      const token = tokenOf(m[0], first, words, type, book);
      words += token.space ? 0 : 1;
      first += [...m[0]].length;
      missing ||= token.missing;
      return token;
    });
    const lines = wrapped(tokens, flow, room, type.inset).map((l, i) => ({ ...l, baseline: i * lineHeight + baseline }));
    const block = { lines, top, height: lines.length * lineHeight };
    top += block.height;
    return block;
  });
  const width = Math.max(0, ...blocks.flatMap((b) => b.lines.map((l) => l.width)));
  return { blocks, width, height: top, ascent, descent, lineHeight, missing };
}
