import { Ligatures, type Face, type FaceBook, type Features, type Request } from './face';
import { AUTO, type Leading } from '../../type-units';

export enum Spaces {
  Collapse = 'collapse',
  Keep = 'keep'
}

export enum Shaping {
  Runs = 'runs',
  Chars = 'chars'
}

export type Flow = { spaces: Spaces; wraps: boolean };

export type Look = { request: Omit<Request, 'size'>; size: number; tracking: number; leading: Leading };

export type RequestAt = (paragraph: number, char: number) => Look;

export enum Justify {
  Off = 'off',
  On = 'on'
}

export enum Wrap {
  Greedy = 'greedy',
  Balance = 'balance',
  Pretty = 'pretty'
}

export enum Trim {
  None = 'none',
  Cap = 'cap'
}

export const NO_LIMIT = 0;

export type ListMark = { inset: number; gap: number; marker: string } | null;

export const NO_LISTS: readonly ListMark[] = [];

export type Paragraph = { indent: number; spacing: number; justify: Justify; wrap: Wrap; limit: number; trim: Trim; lists: readonly ListMark[] };

export const PLAIN_PARAGRAPH: Paragraph = { indent: 0, spacing: 0, justify: Justify.Off, wrap: Wrap.Greedy, limit: NO_LIMIT, trim: Trim.None, lists: NO_LISTS };

export type Type = { request: Omit<Request, 'size'>; size: number; tracking: number; leading: Leading; inset: number; shaping: Shaping; requestAt?: RequestAt; paragraph?: Paragraph; features?: Features };

export type Glyph = { face: Face; glyph: number; skew: number; x: number; dy: number; char: number; pen: number; advance: number; word: number; letter: number; size: number; leading: Leading };

export type Line = { glyphs: Glyph[]; width: number; baseline: number; top: number; height: number };

export type Block = { lines: Line[]; top: number; height: number; inset: number; marker: Glyph[] };

export type Extra = (paragraph: number, word: number, letter: number) => number;

export const NO_EXTRA: Extra = () => 0;

export type Laid = { blocks: Block[]; width: number; height: number; ascent: number; descent: number; lineHeight: number; missing: boolean };

type Token = { glyphs: Glyph[]; width: number; space: boolean };

const SPACE = ' ';
const SPACE_CODE = 0x20;
const COLLAPSIBLE = /[ \t\n]+/g;
const TOKEN = / +|[^ ]+/g;
const SLACK = 1e-6;
const LAYOUT_UNIT = 64;

const collapsed = (text: string, spaces: Spaces) => (spaces === Spaces.Collapse ? text.replace(COLLAPSIBLE, SPACE).trim() : text);

type Asked = (char: number) => Look;

const askedOf = (type: Type, paragraph: number): Asked => {
  const plain: Look = { request: type.request, size: type.size, tracking: type.tracking, leading: type.leading };
  const at = type.requestAt;
  return at ? (char) => at(paragraph, char) : () => plain;
};

type Run = { text: string; face: Face; skew: number; at: number; look: Look };

const sameLook = (a: Look, b: Look) => a === b || (a.size === b.size && a.tracking === b.tracking && a.leading === b.leading);

function runsOf(text: string, first: number, asked: Asked, book: FaceBook): { runs: Run[]; missing: boolean } {
  const runs: Run[] = [];
  let missing = false;
  let at = 0;
  for (const char of text) {
    const look = asked(first + at);
    const resolved = book({ ...look.request, size: look.size }, char.codePointAt(0)!);
    if (!resolved) {
      missing ||= char !== SPACE;
      at += 1;
      continue;
    }
    const last = runs.at(-1);
    if (last && last.face === resolved.face && last.skew === resolved.skew && sameLook(last.look, look) && last.at + [...last.text].length === at) {
      last.text += char;
    } else {
      runs.push({ text: char, face: resolved.face, skew: resolved.skew, at, look });
    }
    at += 1;
  }
  return { runs, missing };
}

function shapedOf(text: string, first: number, type: Type, asked: Asked, book: FaceBook, extra: (char: number) => number): Token & { missing: boolean } {
  const { runs, missing } = runsOf(text, first, asked, book);
  const glyphs: Glyph[] = [];
  let x = 0;
  for (const run of runs) {
    const { size, leading } = run.look;
    const ligatures = run.look.tracking === 0 ? Ligatures.On : Ligatures.Off;
    const tracking = run.look.tracking * size;
    const scale = size / run.face.unitsPerEm;
    let char = first + run.at;
    for (const g of run.face.shape(run.text, ligatures, type.features)) {
      const advance = g.advance * scale + tracking * g.chars + Array.from({ length: g.chars }, (_, k) => extra(char + k)).reduce((n, e) => n + e, 0) * size;
      glyphs.push({ face: run.face, glyph: g.glyph, skew: run.skew, x: x + g.dx * scale, dy: g.dy * scale, char, pen: x, advance, word: -1, letter: char - first, size, leading });
      x += advance;
      char += g.chars;
    }
  }
  return { glyphs, width: x, space: text.startsWith(SPACE), missing };
}

function tokenOf(text: string, first: number, word: number, type: Type, asked: Asked, book: FaceBook, extra: (word: number, letter: number) => number): Token & { missing: boolean } {
  const pieces = type.shaping === Shaping.Chars ? [...text] : [text];
  const token: Token & { missing: boolean } = { glyphs: [], width: 0, space: text.startsWith(SPACE), missing: false };
  for (const [i, piece] of pieces.entries()) {
    const shaped = shapedOf(piece, first + i, type, asked, book, (char) => (text.startsWith(SPACE) ? 0 : extra(word, char - first)));
    token.glyphs.push(...shift(shaped.glyphs, token.width).map((g) => ({ ...g, word: token.space ? -1 : word, letter: g.char - first })));
    token.width += shaped.width;
    token.missing ||= shaped.missing;
  }
  return token;
}

function shift(glyphs: Glyph[], by: number): Glyph[] {
  return glyphs.map((g) => ({ ...g, x: g.x + by, pen: g.pen + by }));
}

type Broken = { glyphs: Glyph[]; width: number };

function wrapped(tokens: Token[], flow: Flow, room: number, inset: number, indent: number): Broken[] {
  const lines: Broken[] = [];
  let glyphs: Glyph[] = [];
  let pen = inset + indent;
  let inked = pen;
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

function gapsOf(glyphs: Glyph[]): number[] {
  const starts: number[] = [];
  glyphs.forEach((g, i) => {
    const after = glyphs[i - 1];
    if (g.word >= 0 && after && after.word < 0 && glyphs.slice(0, i).some((h) => h.word >= 0)) {
      starts.push(i);
    }
  });
  return starts;
}

function justified(line: { glyphs: Glyph[]; width: number }, room: number): { glyphs: Glyph[]; width: number } {
  const gaps = gapsOf(line.glyphs);
  if (!gaps.length || line.width >= room) {
    return line;
  }
  const extra = (room - line.width) / gaps.length;
  const glyphs = line.glyphs.map((g, i) => {
    const by = gaps.filter((at) => at <= i).length * extra;
    return { ...g, x: g.x + by, pen: g.pen + by };
  });
  return { glyphs, width: room };
}

const wordsIn = (line: Broken) => new Set(line.glyphs.filter((g) => g.word >= 0).map((g) => g.word)).size;

const BALANCE_MAX_LINES = 6;
const BALANCE_STEPS = 20;
const PRETTY_STEP = 0.02;
const PRETTY_FLOOR = 0.7;

function balancedRoom(lay: (room: number) => Broken[], room: number): number {
  const count = lay(room).length;
  if (count < 2 || count > BALANCE_MAX_LINES) {
    return room;
  }
  let low = room / count;
  let high = room;
  for (let i = 0; i < BALANCE_STEPS; i++) {
    const mid = (low + high) / 2;
    if (lay(mid).length > count) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return high;
}

function prettyRoom(lay: (room: number) => Broken[], room: number): number {
  const lines = lay(room);
  if (lines.length < 2 || wordsIn(lines.at(-1)!) > 1) {
    return room;
  }
  for (let share = 1 - PRETTY_STEP; share >= PRETTY_FLOOR; share -= PRETTY_STEP) {
    const tried = lay(room * share);
    if (tried.length > lines.length) {
      return room;
    }
    if (wordsIn(tried.at(-1)!) > 1) {
      return room * share;
    }
  }
  return room;
}

const WRAP_ROOM: Record<Wrap, (lay: (room: number) => Broken[], room: number) => number> = {
  [Wrap.Greedy]: (_lay, room) => room,
  [Wrap.Balance]: balancedRoom,
  [Wrap.Pretty]: prettyRoom
};

const JUSTIFIED: Record<Justify, (lines: Broken[], room: number) => Broken[]> = {
  [Justify.Off]: (lines) => lines,
  [Justify.On]: (lines, room) => lines.map((line, i) => (i < lines.length - 1 ? justified(line, room) : line))
};

function primary(type: Type, book: FaceBook, text: string): Face | null {
  const request = { ...type.request, size: type.size };
  const first = text.codePointAt(0);
  return (book(request, SPACE_CODE) ?? (first === undefined ? null : book(request, first)))?.face ?? null;
}

const lineHeightOf = (size: number, leading: number) => Math.floor((Math.round(size * LAYOUT_UNIT) / LAYOUT_UNIT) * leading * LAYOUT_UNIT) / LAYOUT_UNIT;

type Metrics = { above: number; below: number };

function glyphMetrics(g: Glyph): Metrics {
  const scale = g.size / g.face.unitsPerEm;
  const ascent = Math.round(g.face.ascent * scale);
  const descent = Math.round(g.face.descent * scale);
  const height = g.leading === AUTO ? ascent + descent : lineHeightOf(g.size, g.leading);
  const above = Math.floor((height - ascent - descent) / 2) + ascent;
  return { above, below: height - above };
}

function mixedLines(lines: { glyphs: Glyph[]; width: number }[], uniform: Metrics): Line[] {
  let top = 0;
  return lines.map((l) => {
    const metrics = l.glyphs.length ? l.glyphs.map(glyphMetrics) : [uniform];
    const above = Math.max(...metrics.map((m) => m.above));
    const height = above + Math.max(...metrics.map((m) => m.below));
    const line = { ...l, top, height, baseline: top + above };
    top += height;
    return line;
  });
}

const ELLIPSIS = '…';
const CAP_LETTER = 'H';

const inkedEnd = (glyphs: Glyph[]) => {
  const last = glyphs.at(-1);
  return last ? last.pen + last.advance : 0;
};

function ellipsised(line: Broken, room: number, ellipsis: Token): Broken {
  const glyphs = [...line.glyphs];
  while (glyphs.length && (glyphs.at(-1)!.word < 0 || inkedEnd(glyphs) + ellipsis.width > room + SLACK)) {
    glyphs.pop();
  }
  const at = inkedEnd(glyphs);
  const char = (glyphs.at(-1)?.char ?? -1) + 1;
  const tail = shift(ellipsis.glyphs, at).map((g) => ({ ...g, char, word: -1 }));
  return { glyphs: [...glyphs, ...tail], width: at + ellipsis.width };
}

function limited(blocks: Block[], limit: number, room: number, ellipsis: () => Token): Block[] {
  const total = blocks.reduce((n, b) => n + b.lines.length, 0);
  if (limit === NO_LIMIT || total <= limit) {
    return blocks;
  }
  const kept: Block[] = [];
  let left = limit;
  for (const block of blocks) {
    if (left === 0) {
      break;
    }
    const lines = block.lines.slice(0, left);
    left -= lines.length;
    kept.push({ ...block, lines, height: block.height * (lines.length / block.lines.length) });
  }
  const last = kept.at(-1)!;
  const closing = last.lines.at(-1)!;
  last.lines[last.lines.length - 1] = { ...closing, ...ellipsised(closing, room - last.inset, ellipsis()) };
  return kept;
}

function capHeightOf(type: Type, book: FaceBook): number {
  const resolved = book({ ...type.request, size: type.size }, CAP_LETTER.codePointAt(0)!);
  if (!resolved) {
    return 0;
  }
  const [shaped] = resolved.face.shape(CAP_LETTER, Ligatures.Off);
  const ys = (shaped ? resolved.face.outline(shaped.glyph) : []).flatMap((c) => c.at.filter((_, i) => i % 2 === 1));
  return (Math.max(0, ...ys) * type.size) / resolved.face.unitsPerEm;
}

function typeLineHeight(type: Type, face: Face | null, ascent: number, descent: number): number {
  if (type.leading === AUTO) {
    return ascent + descent + Math.round((face?.lineGap ?? 0) * (face ? type.size / face.unitsPerEm : 0));
  }
  return lineHeightOf(type.size, type.leading);
}

export function layOut(paragraphs: string[], type: Type, flow: Flow, room: number, book: FaceBook, extra: Extra = NO_EXTRA): Laid {
  const face = primary(type, book, paragraphs.join(''));
  const scale = face ? type.size / face.unitsPerEm : 0;
  const ascent = Math.round((face?.ascent ?? 0) * scale);
  const descent = Math.round((face?.descent ?? 0) * scale);
  const lineHeight = typeLineHeight(type, face, ascent, descent);
  const baseline = Math.floor((lineHeight - ascent - descent) / 2) + ascent;
  const paragraph = type.paragraph ?? PLAIN_PARAGRAPH;
  let missing = false;
  let top = 0;
  const blocks = paragraphs.map((source, at): Block => {
    const text = collapsed(source, flow.spaces);
    const asked = askedOf(type, at);
    let first = 0;
    let words = 0;
    const tokens = [...text.matchAll(TOKEN)].map((m) => {
      const token = tokenOf(m[0], first, words, type, asked, book, (word, letter) => extra(at, word, letter));
      words += token.space ? 0 : 1;
      first += [...m[0]].length;
      missing ||= token.missing;
      return token;
    });
    const mark = paragraph.lists[at] ?? null;
    const inset = mark ? mark.inset : 0;
    const available = room - inset;
    const shapedMarker = mark ? shapedOf(mark.marker, 0, type, askedOf({ ...type, requestAt: undefined }, at), book, () => 0) : null;
    missing ||= shapedMarker?.missing ?? false;
    const marker = mark && shapedMarker ? shift(shapedMarker.glyphs, mark.inset - mark.gap - shapedMarker.width).map((g) => ({ ...g, char: 0, word: -1 })) : [];
    const lay = (width: number) => wrapped(tokens, flow, width, type.inset, paragraph.indent);
    const fitted = flow.wraps ? WRAP_ROOM[paragraph.wrap](lay, available) : available;
    const laid = JUSTIFIED[flow.wraps ? paragraph.justify : Justify.Off](lay(fitted), available);
    const lines = type.requestAt ? mixedLines(laid, { above: baseline, below: lineHeight - baseline }) : laid.map((l, i) => ({ ...l, top: i * lineHeight, height: lineHeight, baseline: i * lineHeight + baseline }));
    const block = { lines, top, height: lines.reduce((n, l) => n + l.height, 0), inset, marker };
    top += block.height + paragraph.spacing;
    return block;
  });
  const ellipsis = () => shapedOf(ELLIPSIS, 0, type, askedOf(type, 0), book, () => 0);
  const kept = limited(blocks, paragraph.limit, room, ellipsis);
  const bottom = kept.at(-1);
  const height = bottom ? bottom.top + bottom.height : 0;
  const trimTop = paragraph.trim === Trim.Cap ? baseline - capHeightOf(type, book) : 0;
  const trimBottom = paragraph.trim === Trim.Cap ? lineHeight - baseline : 0;
  const trimmed = kept.map((b) => ({ ...b, top: b.top - trimTop }));
  const width = Math.max(0, ...trimmed.flatMap((b) => b.lines.map((l) => b.inset + l.width)));
  return { blocks: trimmed, width, height: Math.max(0, height - trimTop - trimBottom), ascent, descent, lineHeight, missing };
}
