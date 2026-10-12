import { WORD_ENTRANCE } from '../word-entrance';

export const EDITORIAL_MODEL = String.raw`
${WORD_ENTRANCE}
const CHAR_EM = 0.56;
const LINE = 1.02;
const QUOTE = '"';
const QUOTE_EM = 0.45;
const SIDE_BY_SIDE = 0.9;
const STACKED_MEDIA = 0.6;
const MEDIA_IN = 0.8;
const EXIT = 0.7;
const EXIT_STAGGER = 0.04;
const EXIT_PAD = 0.05;
const EXIT_LIFT = 0.12;
const MAX_LINES = 4;
const MIN_GAP = 0.02;
const ASCENT_GAP = 0.16;
const QUOTE_DROP = 0.2;
const MEDIA_ZOOM = 0.12;
const MEDIA_DRIFT = 0.012;

const phrasesOf = (raw) => String(raw || '').split(/\n|\|/).map((line) => line.split('/').map((s) => s.trim()).filter(Boolean).slice(0, MAX_LINES)).filter((lines) => lines.length);

const sideOf = (k, r) => ((k + r) % 2 === 0 ? 'left' : 'right');
const flip = (side) => (side === 'left' ? 'right' : 'left');

function fontFor(p, phrases, width, height, sideBySide, mediaW, margin) {
  const longest = Math.max(1, ...phrases.flat().map((s) => s.length));
  const room = sideBySide ? width - 2 * margin - mediaW - margin : width - 2 * margin;
  return Math.min(p.fontSize * Math.min(width, height), room / (CHAR_EM * longest));
}

function rowCells(p, lines, k, quoted) {
  return lines.flatMap((text, r) => {
    const side = sideOf(k, r);
    const last = r === lines.length - 1;
    const partner = last && quoted ? 'quote' : 'media';
    return [{ kind: 'text', row: r, text, align: side }, { kind: partner, row: r, text: partner === 'quote' ? QUOTE : '', align: flip(side) }];
  });
}

function placeSide(cells, n, size, mediaW, mediaH, width, height, m) {
  const cellH = Math.max(mediaH, size * LINE);
  const pitch = n > 1 ? (height - 2 * m - cellH) / (n - 1) : 0;
  return cells.map((c) => {
    const centre = n > 1 ? m + cellH / 2 + c.row * pitch : height / 2;
    if (c.kind === 'media') {
      return { ...c, x: c.align === 'left' ? m : width - m - mediaW, y: centre - mediaH / 2, w: mediaW, h: mediaH };
    }
    const w = c.kind === 'quote' ? QUOTE_EM * size : c.text.length * CHAR_EM * size;
    const drop = c.kind === 'quote' ? QUOTE_DROP * size : 0;
    return { ...c, x: c.align === 'left' ? m : width - m, y: textTop(c.row, n, centre, cellH, size) + drop, w, h: size * LINE };
  });
}

function textTop(row, n, centre, cellH, size) {
  if (n > 1 && row === 0) {
    return centre - cellH / 2 - ASCENT_GAP * size;
  }
  if (n > 1 && row === n - 1) {
    return centre + cellH / 2 - size * LINE;
  }
  return centre - (size * LINE) / 2;
}

function placeStacked(cells, size, mediaW, mediaH, width, height, m) {
  const heightOf = (c) => (c.kind === 'media' ? mediaH : c.kind === 'text' ? size * LINE : 0);
  const stack = cells.filter((c) => c.kind !== 'quote');
  const total = stack.reduce((sum, c) => sum + heightOf(c), 0);
  const gap = stack.length > 1 ? (height - 2 * m - total) / (stack.length - 1) : 0;
  let y = m;
  const tops = new Map();
  for (const c of stack) {
    tops.set(c, y);
    y += heightOf(c) + gap;
  }
  return cells.map((c) => {
    if (c.kind === 'media') {
      return { ...c, x: c.align === 'left' ? m : width - m - mediaW, y: tops.get(c), w: mediaW, h: mediaH };
    }
    const twin = c.kind === 'quote' ? cells.find((o) => o.kind === 'text' && o.row === c.row) : c;
    const w = c.kind === 'quote' ? QUOTE_EM * size : c.text.length * CHAR_EM * size;
    return { ...c, x: c.align === 'left' ? m : width - m, y: tops.get(twin), w, h: size * LINE };
  });
}

function editorialLayout(p, width, height) {
  const phrases = phrasesOf(p.phrases);
  const m = p.margin * Math.min(width, height);
  const sideBySide = width / height >= SIDE_BY_SIDE;
  let mediaW = sideBySide ? p.mediaWidth * width : STACKED_MEDIA * width;
  const size = fontFor(p, phrases, width, height, sideBySide, mediaW, m);
  if (!sideBySide) {
    const rows = Math.max(...phrases.map((l) => l.length));
    const room = height - 2 * m - rows * size * LINE - (2 * rows - 2) * MIN_GAP * height;
    mediaW = Math.min(mediaW, (Math.max(0, room) / Math.max(1, rows - 1)) * p.mediaAspect);
  }
  const mediaH = mediaW / p.mediaAspect;
  let counter = 0;
  return phrases.flatMap((lines, k) => {
    const cells = rowCells(p, lines, k, p.quote);
    const placed = sideBySide ? placeSide(cells, lines.length, size, mediaW, mediaH, width, height, m) : placeStacked(cells, size, mediaW, mediaH, width, height, m);
    return placed.map((c, e) => ({ ...c, phrase: k, order: e, size, media: c.kind === 'media' ? counter++ : -1 }));
  });
}

function editorialFrame(p, t, length, width, height) {
  const cells = editorialLayout(p, width, height);
  const count = Math.max(1, ...cells.map((c) => c.phrase + 1));
  const slot = length / count;
  return {
    cells: cells.map((c) => {
      const at = c.phrase * slot + p.lead + c.order * p.beat;
      const leave = (c.phrase + 1) * slot - EXIT_PAD - EXIT - (5 - Math.min(5, c.order)) * EXIT_STAGGER;
      const out = span(t, leave, EXIT);
      if (c.kind === 'media') {
        const reveal = expoInOut(span(t, at, MEDIA_IN)) * (1 - expoInOut(out));
        return { ...c, opacity: 0, rise: 0, reveal, zoom: 1 + MEDIA_ZOOM * (1 - reveal) + MEDIA_DRIFT * Math.max(0, t - at) };
      }
      const word = wordIn(t, at);
      return { ...c, opacity: word.opacity * (1 - smooth(out)), rise: word.rise - EXIT_LIFT * expoInOut(out), reveal: 0, zoom: 1 };
    })
  };
}
`;
