import { WORD_ENTRANCE } from '../word-entrance';

export const BLOBS_MODEL = String.raw`
${WORD_ENTRANCE}
const BLOB_COUNT = 10;
const MAX_BUBBLES = 64;
const CLUSTERS = 4;
const TAU = Math.PI * 2;
const SPREAD = { x: 0.36, y: 0.8 };
const RADIUS = { min: 0.11, max: 0.22 };
const SWAY = { min: 0.03, max: 0.075 };
const BREATH = 0.08;
const BUBBLE_REACH = { min: 0.12, max: 0.72 };
const BUBBLE_SIZE = { min: 0.03, max: 0.3 };
const BUBBLE_DRIFT = 0.22;
const TITLE_OUT = 0.9;
const TITLE_DIM = 0.55;
const DIM_IN = 0.8;

function seeded(seed) {
  let a = (Math.round(seed) * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r, range) => range.min + (range.max - range.min) * r();
const wave = (r) => ({ amp: between(r, SWAY), k: 1 + Math.floor(r() * 2), phase: r() * TAU });

function hexRgb(hex) {
  const raw = String(hex || '').trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return [0, 0, 0];
  }
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function blobsLayout(p) {
  const r = seeded(p.seed);
  const blobs = Array.from({ length: BLOB_COUNT }, (_, i) => ({
    x: (r() * 2 - 1) * SPREAD.x,
    y: ((i + r()) / BLOB_COUNT * 2 - 1) * SPREAD.y,
    r: between(r, RADIUS),
    waves: [wave(r), wave(r), wave(r), wave(r)],
    breath: r() * TAU
  }));
  const hosts = Array.from({ length: CLUSTERS }, () => Math.floor(r() * BLOB_COUNT));
  const bubbles = Array.from({ length: MAX_BUBBLES }, (_, i) => ({
    host: hosts[i % CLUSTERS],
    angle: r() * TAU,
    reach: between(r, BUBBLE_REACH),
    size: BUBBLE_SIZE.min + (BUBBLE_SIZE.max - BUBBLE_SIZE.min) * Math.pow(r(), 2.4),
    drift: r() * TAU
  }));
  return { blobs, bubbles };
}

const sway = (w, theta) => w.amp * Math.sin(w.k * theta + w.phase);

function blobAt(b, mass, theta) {
  return {
    x: b.x + sway(b.waves[0], theta) + sway(b.waves[1], theta),
    y: b.y + sway(b.waves[2], theta) + sway(b.waves[3], theta),
    r: b.r * mass * (1 + BREATH * Math.sin(theta + b.breath))
  };
}

function bubbleAt(bubble, host, theta) {
  const turn = bubble.angle + BUBBLE_DRIFT * Math.sin(theta + bubble.drift);
  const reach = host.r * bubble.reach;
  return { x: host.x + reach * Math.cos(turn), y: host.y + reach * Math.sin(turn), r: host.r * bubble.size };
}

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function titleBeat(p, t) {
  const words = titleWords(p.title);
  if (!words.length) {
    return { words: [], dim: 0 };
  }
  const out = expoInOut(span(t, p.titleAt + p.titleSeconds - TITLE_OUT, TITLE_OUT));
  return {
    words: words.map((_, i) => {
      const e = wordIn(t, p.titleAt + i * WORD_GAP);
      return { y: e.rise - 0.08 * out, opacity: e.opacity * (1 - smooth(out)) };
    }),
    dim: TITLE_DIM * smooth(span(t, p.titleAt, DIM_IN)) * (1 - smooth(out))
  };
}

function blobsFrame(layout, p, t, length) {
  const cycles = Math.max(1, Math.round(p.speed));
  const theta = (TAU * cycles * t) / length;
  const blobs = layout.blobs.map((b) => blobAt(b, p.mass, theta));
  const count = Math.round(Math.max(0, Math.min(1, p.bubbles)) * MAX_BUBBLES);
  const bubbles = layout.bubbles.slice(0, count).map((b) => bubbleAt(b, blobs[b.host], theta));
  return { blobs, bubbles, phase: theta, ...titleBeat(p, t) };
}
`;
