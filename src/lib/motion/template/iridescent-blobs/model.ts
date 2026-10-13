import { WORD_ENTRANCE } from '../word-entrance';

export const BLOBS_MODEL = String.raw`
${WORD_ENTRANCE}
const BLOB_COUNT = 10;
const TAU = Math.PI * 2;
const SPREAD = { x: 0.36, y: 0.8, z: 0.14 };
const RADIUS = { min: 0.11, max: 0.22 };
const SWAY = { min: 0.03, max: 0.075 };
const BREATH = 0.08;
const CAMERA = { yaw: 0.2, pitch: 0.08 };
const FACING = 1.25;
const BUBBLE_DRIFT = 0.12;
const BUBBLE_KINDS = [
  { name: 'cluster', count: 100, groups: 5, size: { min: 0.05, max: 0.32 }, bias: 1.7, spread: 0.32, depth: { min: 0.93, max: 1.03 } },
  { name: 'scatter', count: 24, groups: 24, size: { min: 0.035, max: 0.12 }, bias: 1.4, spread: 0, depth: { min: 0.96, max: 1.04 } },
  { name: 'trail', count: 52, groups: 8, size: { min: 0.012, max: 0.03 }, bias: 1, spread: 0.07, depth: { min: 0.98, max: 1.04 } }
];
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

function bubbleKind(kind, r) {
  const groups = Array.from({ length: kind.groups }, () => ({ host: Math.floor(r() * BLOB_COUNT), polar: r() * FACING, azimuth: r() * TAU, bend: (r() - 0.5) * 0.5 }));
  return Array.from({ length: kind.count }, (_, i) => {
    const g = groups[i % kind.groups];
    const along = Math.floor(i / kind.groups);
    const trail = kind.name === 'trail';
    return {
      host: g.host,
      polar: Math.min(FACING, Math.abs(g.polar + (trail ? along * kind.spread : (r() - 0.5) * 2 * kind.spread))),
      azimuth: g.azimuth + (trail ? along * g.bend : (r() - 0.5) * 2 * kind.spread * 2),
      depth: between(r, kind.depth),
      size: kind.size.min + (kind.size.max - kind.size.min) * Math.pow(r(), kind.bias),
      drift: r() * TAU
    };
  });
}

function interleave(lists) {
  const longest = Math.max(...lists.map((l) => l.length));
  return Array.from({ length: longest }, (_, i) => lists.map((l) => l[i]).filter(Boolean)).flat();
}

function blobsLayout(p) {
  const r = seeded(p.seed);
  const blobs = Array.from({ length: BLOB_COUNT }, (_, i) => ({
    x: (r() * 2 - 1) * SPREAD.x,
    y: ((i + r()) / BLOB_COUNT * 2 - 1) * SPREAD.y,
    z: (r() * 2 - 1) * SPREAD.z,
    r: between(r, RADIUS),
    waves: [wave(r), wave(r), wave(r), wave(r), wave(r)],
    breath: r() * TAU
  }));
  return { blobs, bubbles: interleave(BUBBLE_KINDS.map((kind) => bubbleKind(kind, r))) };
}

const MAX_BUBBLES = BUBBLE_KINDS.reduce((sum, kind) => sum + kind.count, 0);

const sway = (w, theta) => w.amp * Math.sin(w.k * theta + w.phase);

function blobAt(b, mass, theta) {
  return {
    x: b.x + sway(b.waves[0], theta) + sway(b.waves[1], theta),
    y: b.y + sway(b.waves[2], theta) + sway(b.waves[3], theta),
    z: b.z + sway(b.waves[4], theta),
    r: b.r * mass * (1 + BREATH * Math.sin(theta + b.breath))
  };
}

function bubbleAt(bubble, host, theta) {
  const polar = Math.min(FACING, bubble.polar + BUBBLE_DRIFT * Math.sin(theta + bubble.drift));
  const azimuth = bubble.azimuth + BUBBLE_DRIFT * Math.cos(theta + bubble.drift);
  const reach = host.r * bubble.depth;
  return {
    x: host.x + reach * Math.sin(polar) * Math.cos(azimuth),
    y: host.y + reach * Math.sin(polar) * Math.sin(azimuth),
    z: host.z + reach * Math.cos(polar),
    r: host.r * bubble.size
  };
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
  const orbit = (TAU * t) / length;
  return { blobs, bubbles, phase: theta, yaw: CAMERA.yaw * Math.sin(orbit), pitch: CAMERA.pitch * Math.sin(orbit + 1), ...titleBeat(p, t) };
}
`;
