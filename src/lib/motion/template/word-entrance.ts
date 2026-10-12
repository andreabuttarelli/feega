export const WORD_ENTRANCE = String.raw`
const WORD_IN = 1.1;
const WORD_GAP = 0.08;
const WORD_RISE = 0.2;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, at, length) => clamp01((t - at) / Math.max(length, 1e-6));
const expoInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);

function wordIn(t, at) {
  const progress = expoInOut(span(t, at, WORD_IN));
  return { progress, rise: WORD_RISE * (1 - progress), opacity: smooth(span(t, at, WORD_IN * 0.35)) };
}
`;
