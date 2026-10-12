import { WORD_ENTRANCE } from '../word-entrance';

export const SPLIT_MODEL = String.raw`
${WORD_ENTRANCE}
const SAFE = 0.88;
const AUTO_ROW_MIN = 0.7;
const LINE_GAP = 0.12;
const WORDS_OUT = 0.6;
const WORDS_OUT_LIFT = 0.2;

const SETTLE_OVERLAP = 0.35;
const FADE_UNTIL = 0.1;

function splitWords(text, at) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { left: words, right: [] };
  }
  const auto = Math.round(words.length / 2);
  const cut = Math.min(words.length - 1, Math.max(1, Math.round(at) || auto));
  return { left: words.slice(0, cut), right: words.slice(cut) };
}

function chooseAxis(p, rowFit, m) {
  if (p.stack === 'row' || p.stack === 'column') {
    return p.stack;
  }
  return rowFit >= AUTO_ROW_MIN && m.frameW >= m.frameH ? 'row' : 'column';
}

function splitLayout(p, m) {
  const imgH = p.imageHeight;
  const imgW = imgH * p.aspect;
  const rowWidth = m.leftW + m.rightW + imgW + 2 * p.gap;
  const rowFit = Math.min(1, (m.frameW * SAFE) / rowWidth, (m.frameH * SAFE) / Math.max(1, imgH));
  const axis = chooseAxis(p, rowFit, m);
  const columnFit = Math.min(1, (m.frameW * SAFE) / Math.max(m.leftW, m.rightW, imgW), (m.frameH * SAFE) / (2 + imgH + 2 * p.gap));
  return { axis, fit: axis === 'row' ? rowFit : columnFit, imgW, imgH, gap: p.gap, space: m.space, cx: (m.leftW - m.rightW) / 2 };
}

function openTimes(p, words, length) {
  const titleDone = p.titleAt + Math.max(0, words - 1) * WORD_GAP + WORD_IN;
  const openAt = Math.max(p.titleAt, titleDone - SETTLE_OVERLAP + p.openDelay);
  const closeLatest = length - WORDS_OUT - p.closeSeconds;
  const closeAt = Math.max(openAt + p.openSeconds, Math.min(closeLatest, openAt + p.openSeconds + p.holdSeconds));
  return { openAt, closeAt, outAt: length - WORDS_OUT };
}

function openness(p, times, t) {
  const opened = expoInOut(span(t, times.openAt, p.openSeconds));
  const closed = p.leave ? expoInOut(span(t, times.closeAt, p.closeSeconds)) : 0;
  return Math.max(0, opened - closed);
}

function rowPlace(layout, e, w) {
  const hug = w / 2 + layout.gap * e + (layout.space / 2) * (1 - e);
  return { left: { x: layout.cx - hug, y: 0 }, right: { x: layout.cx + hug, y: 0 }, image: { x: layout.cx, y: 0 } };
}

function columnPlace(layout, e, h) {
  const hug = h / 2 + layout.gap * e + (LINE_GAP / 2) * (1 - e) + 0.5;
  return { left: { x: 0, y: -hug }, right: { x: 0, y: hug }, image: { x: 0, y: 0 } };
}

function imageSize(layout, p, e) {
  const both = p.grow === 'size' ? e : 1;
  return layout.axis === 'row' ? { w: layout.imgW * e, h: layout.imgH * both } : { w: layout.imgW * both, h: layout.imgH * e };
}

function wordLooks(count, p, t, out) {
  return Array.from({ length: count }, (_, i) => {
    const look = wordIn(t, p.titleAt + i * WORD_GAP);
    return { progress: look.progress, rise: look.rise - WORDS_OUT_LIFT * out, opacity: look.opacity * (1 - out) };
  });
}

function splitFrame(layout, p, t, length, words) {
  const times = openTimes(p, words, length);
  const e = openness(p, times, t);
  const size = imageSize(layout, p, e);
  const place = layout.axis === 'row' ? rowPlace(layout, e, size.w) : columnPlace(layout, e, size.h);
  const out = p.leave ? smooth(span(t, times.outAt, WORDS_OUT * 0.85)) : 0;
  return {
    open: e,
    image: { ...place.image, w: size.w, h: size.h, opacity: smooth(clamp01(e / FADE_UNTIL)), zoom: p.innerZoom ? 1 + p.zoomAmount * (1 - e) : 1 },
    left: place.left,
    right: place.right,
    words: wordLooks(words, p, t, out),
    times
  };
}
`;
