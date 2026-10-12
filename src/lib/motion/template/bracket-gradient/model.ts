import { WORD_ENTRANCE } from '../word-entrance';

export const BRACKET_MODEL = String.raw`
${WORD_ENTRANCE}
const WORDS_AFTER_OPEN = 0.3;
const WORDS_OUT = 0.6;
const WORDS_OUT_LEAD = 0.4;
const WORDS_OUT_LIFT = 0.15;
const MARKS_FADE_UNTIL = 0.06;
const TURN = Math.PI * 2;

const BLOB_REST = [
  { x: 0.74, y: 0.5, r: 0.36, phase: 0, swing: 1 },
  { x: 0.24, y: 0.82, r: 0.42, phase: 0.25, swing: 1 },
  { x: 0.04, y: 1.08, r: 0.34, phase: 0.55, swing: 0.8 },
  { x: 0.98, y: 0.95, r: 0.36, phase: 0.8, swing: 0.9 },
  { x: 0.62, y: 0.72, r: 0.16, phase: 0.4, swing: 1.2 }
];

function blobsAt(p, t, length) {
  const turn = TURN * (t / length);
  return BLOB_REST.map((b) => {
    const a = turn + TURN * b.phase;
    return { x: b.x + p.drift * b.swing * Math.sin(a), y: b.y + p.drift * b.swing * 0.35 * Math.cos(a), r: b.r * (1 + 0.08 * Math.sin(a + 1)) };
  });
}

function bracketTimes(p, length) {
  const closeAt = length - p.closeSeconds;
  return { openAt: p.titleAt, wordsAt: p.titleAt + p.openSeconds * WORDS_AFTER_OPEN, closeAt, outAt: closeAt - WORDS_OUT_LEAD };
}

function bracketFrame(p, box, t, length, words) {
  const times = bracketTimes(p, length);
  const opened = expoInOut(span(t, times.openAt, p.openSeconds));
  const closed = p.leave ? expoInOut(span(t, times.closeAt, p.closeSeconds)) : 0;
  const open = Math.max(0, opened - closed);
  const out = p.leave ? smooth(span(t, times.outAt, WORDS_OUT)) : 0;
  return {
    open,
    half: { x: open * (box.w / 2 + p.padX), y: open * (box.h / 2 + p.padY) },
    marks: smooth(clamp01(open / MARKS_FADE_UNTIL)),
    words: Array.from({ length: words }, (_, i) => {
      const look = wordIn(t, times.wordsAt + i * WORD_GAP);
      return { rise: look.rise - WORDS_OUT_LIFT * out, opacity: look.opacity * (1 - out) };
    }),
    blobs: blobsAt(p, t, length)
  };
}
`;
