import { WORD_ENTRANCE } from '../word-entrance';

export const MELT_MODEL = String.raw`
${WORD_ENTRANCE}
const PAGE_ASPECT = 3 / 4;
const GROW = 2.6;
const SETTLE = 2.2;
const CLUSTER = 8;
const DETAIL = 2.5;
const DRIP_FROM = 0.36;
const DRIP_FULL = 0.72;

const hash01 = (i, salt) => {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const valueNoise = (x, salt) => {
  const i = Math.floor(x);
  const f = smooth(x - i);
  return hash01(i, salt) * (1 - f) + hash01(i + 1, salt) * f;
};

const band = (x, from, to) => smooth(clamp01((x - from) / (to - from)));

function pageBox(width, height, margin) {
  const room = { w: width * (1 - 2 * margin), h: height * (1 - 2 * margin) };
  const h = Math.min(room.h, room.w / PAGE_ASPECT);
  const w = h * PAGE_ASPECT;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function meltColumns(count, p) {
  return Array.from({ length: count }, (_, i) => {
    const shape = valueNoise(i / CLUSTER, 1) * 0.75 + valueNoise(i / DETAIL, 2) * 0.25;
    return {
      activity: band(shape, DRIP_FROM, DRIP_FULL),
      delay: valueNoise(i / CLUSTER, 3) * 0.7 + hash01(i, 4) * 0.3,
      reach: 0.35 + 0.65 * Math.pow(hash01(i, 5), 0.7),
      split: 0.25 + 0.5 * hash01(i, 6)
    };
  });
}

function meltAt(column, p, t, length) {
  const at = p.meltAt + column.delay * p.spread;
  const grow = expoInOut(span(t, at, GROW));
  const back = expoInOut(span(t, at + GROW + p.holdFor, SETTLE));
  const level = grow * (1 - back) * column.activity * p.strength;
  return { drop: level > 0 ? p.reach * column.reach * level : 0, fade: level > 0 ? level : 0 };
}
`;
