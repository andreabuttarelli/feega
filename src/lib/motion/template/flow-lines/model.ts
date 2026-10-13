import { WORD_ENTRANCE } from '../word-entrance';
import { STRAND } from './shaders';

export const FLOW_MODEL = String.raw`
${WORD_ENTRANCE}
const TAU = Math.PI * 2;
const STRANDS = { thin: 12000, thick: 56000 };
const SEED = 0x2545f491;
const REACH = 1.2;
const CENTRE_BIAS = 0.68;
const GROW = ${STRAND.grow};
const FADE = ${STRAND.fade};
const OCTAVE = { calm: 0.1, wild: 0.6 };
const FREQUENCY = { calm: 0.32, wild: 0.8 };
const VEIL_LEAD = 0.3;
const VEIL_IN = 0.9;
const VEIL_OUT = 1;
const WORD_OUT = 0.7;

const mix = (a, b, x) => a + (b - a) * x;

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function flowLook(p) {
  const d = clamp01(p.density);
  const w = clamp01(p.turbulence);
  return { strands: Math.round(mix(STRANDS.thin, STRANDS.thick, d)), octave: mix(OCTAVE.calm, OCTAVE.wild, w), frequency: mix(FREQUENCY.calm, FREQUENCY.wild, w) };
}

function strandSeeds(count) {
  let s = SEED;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const r = REACH * Math.pow(next(), CENTRE_BIAS);
    const a = TAU * next();
    return { x: r * Math.cos(a), y: r * Math.sin(a), offset: next() };
  });
}

function strandSpan(life) {
  const head = smooth(span(life, 0, GROW));
  const tail = Math.min(head, smooth(span(life, 1 - GROW, GROW)));
  return { tail, head, alpha: smooth(span(life, 0, FADE)) * (1 - smooth(span(life, 1 - FADE, FADE))) };
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
