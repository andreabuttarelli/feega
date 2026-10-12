import { WORD_ENTRANCE } from '../word-entrance';

export const BLUR_LINES_MODEL = String.raw`
${WORD_ENTRANCE}
const HAIRLINES = [0.105, 0.23, 0.76, 0.89];
const LINE_IN = 1.4;
const LINE_AT = 0.1;
const LINE_STAGGER = 0.1;
const LINE_OUT = 1.1;
const LETTER_FADE = 2.5;
const GLOW_TAIL = 3;
const GLOW_SETTLE = 1.4;
const TEXT_OUT = 0.9;
const EXIT = 1.6;
const TURN = 2 * Math.PI;
const SWAY_DEG = 4;
const BREATH = 0.05;

function letterFrame(i, count, settle) {
  const age = count - i;
  const opacity = smooth(clamp01(age / LETTER_FADE));
  const glow = smooth(clamp01(age)) * Math.exp(-Math.max(0, age - 1) / GLOW_TAIL);
  return { opacity, glow: glow * (1 - settle) };
}

function lineFrame(at, i, p, t, length) {
  const grow = expoInOut(span(t, LINE_AT + i * LINE_STAGGER, LINE_IN));
  const gone = p.leave ? expoInOut(span(t, length - LINE_OUT - (HAIRLINES.length - 1 - i) * LINE_STAGGER - 0.05, LINE_OUT)) : 0;
  return { at, scale: grow * (1 - gone) };
}

function blobFrame(p, t, length) {
  const a = (TURN * t) / length;
  return {
    x: p.drift * Math.sin(a),
    y: p.drift * 0.5 * Math.sin(2 * a),
    rotate: SWAY_DEG * Math.sin(a + Math.PI / 3),
    scale: 1 + BREATH * Math.sin(a - Math.PI / 4)
  };
}

function blurLinesFrame(p, t, length, widths) {
  const n = widths.length;
  const progress = smooth(span(t, p.typeAt, p.typeSeconds));
  const count = (n + LETTER_FADE) * progress;
  const settle = smooth(span(t, p.typeAt + p.typeSeconds, GLOW_SETTLE));
  const full = widths.reduce((a, w) => a + w, 0);
  return {
    letters: widths.map((_, i) => letterFrame(i, count, settle)),
    shift: (full * (1 - progress)) / 2,
    text: p.leave ? 1 - smooth(span(t, length - EXIT - TEXT_OUT * 0.5, TEXT_OUT)) : 1,
    lines: HAIRLINES.map((at, i) => lineFrame(at, i, p, t, length)),
    blob: blobFrame(p, t, length)
  };
}
`;
