import { WORD_ENTRANCE } from '../word-entrance';

export const CLOUD_MODEL = String.raw`
${WORD_ENTRANCE}
const FAR = 7;
const NEAR = 0.3;
const FAR_FADE = 1.2;
const NEAR_FADE = 1.1;
const REF_DEPTH = 2.5;
const SPREAD = 3.2;
const MAX_TILE = 0.3;
const MAX_TILES = 200;
const CLEAR_SOFT = 0.2;
const TITLE_OUT = 0.9;
const RATIOS = [1, 4 / 3, 3 / 4, 16 / 9, 1, 5 / 4];
const R2 = [0.7548776662466927, 0.5698402909980532];

const hash01 = (i, salt) => {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const frac = (x) => x - Math.floor(x);
const scatter = (i, axis) => 2 * frac(0.5 + R2[axis] * i + 0.04 * (hash01(i, 5 + axis) - 0.5)) - 1;

function frameBox(width, height) {
  const short = Math.min(width, height);
  return { ax: width / short / 2, ay: height / short / 2 };
}

function cloudLayout(p, width, height) {
  const box = frameBox(width, height);
  const n = Math.max(1, Math.min(MAX_TILES, Math.round(p.count)));
  return Array.from({ length: n }, (_, i) => {
    const sx = scatter(i, 0);
    const sy = scatter(i, 1);
    const centre = 1 - clamp01(Math.hypot(sx, sy) / Math.SQRT2);
    const ratio = RATIOS[Math.floor(hash01(i, 3) * RATIOS.length)];
    const size = p.tileSize * (0.45 + 1.35 * Math.pow(hash01(i, 4), 2)) * (1 + p.centreBoost * centre * centre) * REF_DEPTH;
    return {
      i,
      x: sx * box.ax * SPREAD * p.spread,
      y: sy * box.ay * SPREAD * p.spread,
      w: size * Math.sqrt(ratio),
      h: size / Math.sqrt(ratio),
      phase: hash01(i, 8),
      crop: [Math.round(100 * hash01(i, 9)), Math.round(100 * hash01(i, 10))]
    };
  });
}

function camera(p, t, length) {
  const turn = (2 * Math.PI * t) / length;
  return { x: p.drift * Math.sin(turn), y: 0.6 * p.drift * Math.sin(2 * turn + 1.1) };
}

function clearMask(sx, sy, hw, hh, clear) {
  const dx = Math.max(0, Math.abs(sx) - (clear.hw + hw));
  const dy = Math.max(0, Math.abs(sy) - (clear.hh + hh));
  return 1 - smooth(clamp01(Math.hypot(dx, dy) / CLEAR_SOFT));
}

function tileFrame(tile, p, t, length, cam, cleared, clear) {
  const depth = FAR - (FAR - NEAR) * frac(tile.phase + (Math.max(1, Math.round(p.passes)) * t) / length);
  const scale = 1 / depth;
  const x = (tile.x - cam.x) * scale;
  const y = (tile.y - cam.y) * scale;
  const reach = Math.max(tile.w, tile.h) * scale;
  const arrive = smooth(clamp01((FAR - depth) / FAR_FADE));
  const pass = 1 - smooth(clamp01((NEAR_FADE - depth) / (NEAR_FADE - NEAR)));
  const big = 1 - smooth(clamp01((reach - 0.45 * MAX_TILE) / (0.5 * MAX_TILE)));
  const hide = cleared > 0 ? cleared * clearMask(x, y, (tile.w * scale) / 2, (tile.h * scale) / 2, clear) : 0;
  return {
    x,
    y,
    w: tile.w,
    h: tile.h,
    scale,
    depth,
    opacity: arrive * pass * big * (1 - hide),
    blur: p.blur * clamp01((depth - FAR * 0.55) / (FAR * 0.45)),
    z: Math.round((FAR - depth) * 1000)
  };
}

function wordFrames(words, p, t, length) {
  return words.map((_, i) => {
    const e = wordIn(t, p.titleAt + i * WORD_GAP);
    const out = expoInOut(span(t, length - TITLE_OUT - 0.5 + i * 0.04, TITLE_OUT));
    return { y: e.rise - 0.1 * out, opacity: e.opacity * (1 - smooth(out)) };
  });
}

function cloudFrame(layout, p, t, length, clear) {
  const words = String(p.title || '').trim().split(/\s+/).filter(Boolean);
  const shown = words.length ? smooth(span(t, Math.max(0, p.titleAt - 0.5), 1)) * (1 - smooth(span(t, length - TITLE_OUT - 0.6, TITLE_OUT))) : 0;
  const cam = camera(p, t, length);
  return {
    tiles: layout.map((tile) => tileFrame(tile, p, t, length, cam, shown * p.clearing, clear)),
    words: wordFrames(words, p, t, length),
    clear: shown
  };
}
`;
