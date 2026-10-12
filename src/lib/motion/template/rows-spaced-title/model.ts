import { WORD_ENTRANCE } from '../word-entrance';

export const ROWS_MODEL = String.raw`
${WORD_ENTRANCE}
const MAX_PHOTOS = 24;
const SPLIT_FROM = 4;
const BOTTOM_PHASE = 0.5;
const TITLE_OUT = 0.7;
const TITLE_OUT_LEAD = 0.25;
const TIGHTEN_IN = 1.6;

const photoCount = (p, items) => (items > 0 ? Math.min(MAX_PHOTOS, items) : Math.max(1, Math.min(MAX_PHOTOS, Math.round(p.count))));
const pitchOf = (p) => p.cardSize + p.gap;

function rowPhotos(n) {
  const all = Array.from({ length: n }, (_, i) => i);
  if (n < SPLIT_FROM) {
    return { top: all, bottom: all };
  }
  return { top: all.filter((i) => i % 2 === 0), bottom: all.filter((i) => i % 2 === 1) };
}

function rowShift(n, p, length) {
  return n * Math.max(1, Math.round((Math.max(0, p.speed) * length) / n));
}

function slotsFor(n, p, half) {
  let slots = n;
  while (slots * pitchOf(p) < 2 * half + p.cardSize + pitchOf(p)) {
    slots += n;
  }
  return slots;
}

const wrapped = (x, size) => x - size * Math.floor(x / size + 0.5);

function rowCards(p, photos, sign, phase, t, length, half) {
  const n = photos.length;
  const slots = slotsFor(n, p, half);
  const pitch = pitchOf(p);
  const s = (sign * rowShift(n, p, length) * t) / length;
  return Array.from({ length: slots }, (_, slot) => ({ slot, photo: photos[slot % n], x: wrapped((slot - s + phase) * pitch, slots * pitch), w: p.cardSize }));
}

function rowsFrame(p, t, length, width, height, items) {
  const short = Math.min(width, height);
  const half = width / short / 2;
  const edge = height / short / 2 - p.margin - p.cardSize / 2;
  const split = rowPhotos(photoCount(p, items || 0));
  const sign = p.direction === 'right' ? -1 : 1;
  return [
    { y: -edge, cards: rowCards(p, split.top, sign, 0, t, length, half) },
    { y: edge, cards: rowCards(p, split.bottom, -sign, BOTTOM_PHASE, t, length, half) }
  ];
}

function titleFrame(p, t, length, count) {
  const out = smooth(span(t, length - TITLE_OUT_LEAD - TITLE_OUT, TITLE_OUT));
  const settled = p.delay + Math.max(0, count - 1) * p.stagger + WORD_IN;
  const gap = p.spacing * (1 - p.tighten * expoInOut(span(t, settled, TIGHTEN_IN)));
  const words = Array.from({ length: count }, (_, i) => {
    const w = wordIn(t, p.delay + i * p.stagger);
    return { opacity: w.opacity * (1 - out), rise: w.rise };
  });
  return { gap, words };
}
`;
