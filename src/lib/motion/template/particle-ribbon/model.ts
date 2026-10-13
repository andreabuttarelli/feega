import { WORD_ENTRANCE } from '../word-entrance';

export const RIBBON_MODEL = String.raw`
${WORD_ENTRANCE}
const TAU = Math.PI * 2;
const MAX_PARTICLES = 1000000;
const MIN_PARTICLES = 100000;
const PER_UNIT = 1000;
const FALLBACK_STOP = [0.5, 0.5, 0.5];
const FOLD_SWING = 0.5;
const SWAY_SWING = 0.7;
const YAW_SWING = 0.32;
const PITCH_SWING = 0.1;
const VEIL = 0.88;
const VEIL_IN = 1.1;
const WORDS_OUT = 0.9;
const SEED_A = 0x9e3779b1;
const SEED_B = 0x85ebca6b;
const SEED_C = 0xc2b2ae35;

const cyclesOf = (speed) => Math.max(1, Math.round(Number(speed) || 0));

const particleCount = (density) => Math.round(Math.min(MAX_PARTICLES, Math.max(MIN_PARTICLES, Number(density) * PER_UNIT || MIN_PARTICLES)));

function stopOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) {
    return FALLBACK_STOP;
  }
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const gradientStops = (p) => [p.colorA, p.colorB, p.colorC, p.colorD].map(stopOf);

function unit(i, salt) {
  let h = Math.imul(i + 1, SEED_A) ^ salt;
  h = Math.imul(h ^ (h >>> 16), SEED_B);
  h = Math.imul(h ^ (h >>> 13), SEED_C);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function particleSeeds(n) {
  const seeds = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    seeds[i * 3] = unit(i, SEED_B);
    seeds[i * 3 + 1] = unit(i, SEED_C);
    seeds[i * 3 + 2] = unit(i, SEED_A);
  }
  return seeds;
}

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function titleBeat(p, t) {
  const words = titleWords(p.title);
  if (!words.length) {
    return { words: [], veil: 0 };
  }
  const leave = p.titleAt + p.titleHold;
  const out = expoInOut(span(t, leave, WORDS_OUT));
  const veilIn = smooth(span(t, p.titleAt - 0.3, VEIL_IN));
  const veilOut = smooth(span(t, leave + 0.2, VEIL_IN));
  return {
    words: words.map((_, i) => {
      const e = wordIn(t, p.titleAt + i * WORD_GAP);
      return { y: e.rise - 0.12 * out, opacity: e.opacity * (1 - smooth(span(t, leave + i * 0.04, WORDS_OUT * 0.7))) };
    }),
    veil: VEIL * veilIn * (1 - veilOut)
  };
}

function ribbonFrame(p, t, length) {
  const phase = (TAU * cyclesOf(p.speed) * t) / length;
  const beat = titleBeat(p, t);
  return {
    phase,
    fold: 0.5 + FOLD_SWING * 0.5 * Math.sin(phase + 0.9),
    sway: SWAY_SWING * Math.sin(phase),
    yaw: YAW_SWING * Math.sin(phase - 0.6),
    pitch: PITCH_SWING * Math.cos(phase),
    words: beat.words,
    veil: beat.veil
  };
}
`;
