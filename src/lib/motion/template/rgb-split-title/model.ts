import { WORD_ENTRANCE } from '../word-entrance';

export const RGB_MODEL = String.raw`
${WORD_ENTRANCE}
const SETTLE_AT = 0.1;
const UNSETTLE = 2.2;
const TITLE_OUT = 0.9;
const TITLE_OUT_PAD = 0.15;
const WORD_BEAT = 0.14;
const CHANNELS = [-1, 0, 1];
const DRIFT = 0.06;
const ZOOM = 0.08;
const BREATH = 0.035;

const titleWords = (raw) => String(raw || '').split(/\s+/).filter(Boolean);

function rgbFrame(p, time, length, words) {
  const t = ((time % length) + length) % length;
  const settle = expoInOut(span(t, SETTLE_AT, p.settle));
  const unsettle = expoInOut(span(t, length - UNSETTLE, UNSETTLE));
  const amount = clamp01(1 - settle + unsettle);
  const out = smooth(span(t, length - UNSETTLE - TITLE_OUT_PAD - TITLE_OUT, TITLE_OUT));
  return {
    amount,
    offsets: CHANNELS.map((c) => (c === 0 || amount === 0 ? 0 : c * p.split * amount)),
    blur: p.blur * amount,
    drift: DRIFT * amount,
    zoom: 1 + ZOOM * amount + BREATH * (t / length) * (1 - unsettle),
    words: Array.from({ length: words }, (_, i) => {
      const word = wordIn(t, p.titleAt + i * WORD_BEAT);
      return { opacity: word.opacity * (1 - out), rise: word.rise };
    })
  };
}
`;
