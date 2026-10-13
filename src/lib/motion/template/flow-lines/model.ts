import { WORD_ENTRANCE } from '../word-entrance';

export const FLOW_MODEL = String.raw`
${WORD_ENTRANCE}
const TAU = Math.PI * 2;
const SPARSE = { thin: 16, thick: 4 };
const OCTAVE = { calm: 0.12, wild: 0.75 };
const FREQUENCY = { calm: 0.55, wild: 1.4 };
const VEIL_LEAD = 0.3;
const VEIL_IN = 0.9;
const VEIL_OUT = 1;
const WORD_OUT = 0.7;

const mix = (a, b, x) => a + (b - a) * x;

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function flowLook(p) {
  const d = clamp01(p.density);
  const w = clamp01(p.turbulence);
  return { sparsity: mix(SPARSE.thin, SPARSE.thick, d), octave: mix(OCTAVE.calm, OCTAVE.wild, w), frequency: mix(FREQUENCY.calm, FREQUENCY.wild, w) };
}

function flowFrame(p, t, length) {
  const turn = (TAU * t) / length;
  const cycles = Math.max(0, Math.round(p.speed));
  const words = titleWords(p.title);
  const leaveAt = p.titleAt + p.titleSeconds;
  const gone = (at, over) => 1 - smooth(span(t, at, over));
  const veil = words.length ? p.titleDim * smooth(span(t, p.titleAt - VEIL_LEAD, VEIL_IN)) * gone(leaveAt, VEIL_OUT) : 0;
  return {
    orbit: [Math.cos(turn), Math.sin(turn)],
    phase: (cycles * t) / length,
    veil,
    words: words.map((_, i) => {
      const e = wordIn(t, p.titleAt + i * WORD_GAP);
      return { y: e.rise, opacity: e.opacity * gone(leaveAt + i * WORD_GAP * 0.5, WORD_OUT) };
    })
  };
}
`;
