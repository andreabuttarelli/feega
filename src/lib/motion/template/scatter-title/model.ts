import { WORD_ENTRANCE } from '../word-entrance';

export const SCATTER_MODEL = String.raw`
${WORD_ENTRANCE}
const CARDS = [
  [-0.645, -0.65, 0.31, 0.56],
  [0.703, -0.66, 0.465, 0.55],
  [-0.19, -0.45, 0.245, 0.57],
  [0.473, 0.42, 0.28, 0.56],
  [-0.652, 0.75, 0.49, 0.65],
  [0.068, 0.9, 0.335, 0.56],
  [0.158, -0.76, 0.145, 0.64],
  [-0.212, 0.46, 0.145, 0.57],
  [0.878, 0.78, 0.25, 0.94],
  [-0.93, -0.08, 0.21, 0.56],
  [0.906, -0.03, 0.156, 0.66],
  [-0.4, -0.96, 0.13, 1.2]
];
const LANDSCAPE_HALF = 16 / 9 / 2;
const FIT_POWER = 0.8;
const CLEAR_MARGIN = 0.035;
const GAP = 0.025;
const RELAX_ROUNDS = 40;
const ENTER = 1.6;
const EXIT = 1.6;
const ARRIVE = 0.1;
const DEPART = 0.12;
const FADE_SHARE = 0.55;

const hash01 = (i, salt) => {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function frameBox(width, height) {
  const short = Math.min(width, height);
  return { ax: width / short / 2, ay: height / short / 2 };
}

function clearOf(card, title) {
  const inward = 1 - ARRIVE;
  const beside = Math.abs(card.x) * inward >= card.w / 2 + title.hw + CLEAR_MARGIN;
  const below = (card.h / 2 + title.hh + CLEAR_MARGIN) / inward;
  if (beside || Math.abs(card.y) >= below) {
    return card;
  }
  return { ...card, y: (card.y < 0 ? -1 : 1) * below };
}

function separate(a, b) {
  const overX = a.w / 2 + b.w / 2 + GAP - Math.abs(a.x - b.x);
  const overY = a.h / 2 + b.h / 2 + GAP - Math.abs(a.y - b.y);
  if (overX <= 0 || overY <= 0) {
    return false;
  }
  const axis = overX < overY ? 'x' : 'y';
  const sign = a[axis] - b[axis] >= 0 ? 1 : -1;
  const step = (Math.min(overX, overY) / 2) * sign;
  a[axis] += step;
  b[axis] -= step;
  return true;
}

function relax(cards, title) {
  for (let round = 0; round < RELAX_ROUNDS; round++) {
    const moved = cards.map((a, i) => cards.slice(i + 1).map((b) => separate(a, b)).some(Boolean)).some(Boolean);
    cards.forEach((card) => Object.assign(card, clearOf(card, title)));
    if (!moved) {
      return cards;
    }
  }
  return cards;
}

function scatterLayout(p, width, height, title) {
  const box = frameBox(width, height);
  const tall = height > width;
  const fit = Math.min(1, Math.pow(Math.max(box.ax, box.ay) / LANDSCAPE_HALF, FIT_POWER));
  const n = Math.max(1, Math.min(CARDS.length, Math.round(p.count)));
  const cards = CARDS.slice(0, n).map(([fx, fy, w, aspect], i) => {
    const [x, y] = tall ? [fy, fx] : [fx, fy];
    const width = w * p.cardScale * fit;
    return clearOf({ i, x: x * box.ax, y: y * box.ay, w: width, h: width * aspect, depth: 0.7 + 0.6 * hash01(i, 5) }, title);
  });
  relax(cards, title);
  const order = [...cards].sort((a, b) => Math.hypot(a.x / box.ax, a.y / box.ay) - Math.hypot(b.x / box.ax, b.y / box.ay));
  return cards.map((card) => ({ ...card, rank: order.indexOf(card) }));
}

function cardFrame(card, n, p, t, length) {
  const at = p.cardsAt + card.rank * p.stagger;
  const leave = p.leave ? length - EXIT - (n - 1 - card.rank) * p.stagger * 0.5 : Infinity;
  const enter = span(t, at, ENTER);
  const exit = span(t, leave, EXIT);
  const reach = 1 + p.spread * card.depth * (t / length) - ARRIVE * (1 - expoInOut(enter)) + DEPART * expoInOut(exit);
  return {
    x: card.x * reach,
    y: card.y * reach,
    w: card.w,
    h: card.h,
    scale: Math.pow(reach, p.depth),
    opacity: smooth(clamp01(enter / FADE_SHARE)) * (1 - smooth(clamp01((exit - (1 - FADE_SHARE)) / FADE_SHARE)))
  };
}

function wordFrames(words, p, t, length) {
  return Array.from({ length: words }, (_, i) => {
    const e = wordIn(t, p.titleAt + i * WORD_GAP);
    const out = p.leave ? smooth(span(t, length - EXIT + i * 0.04, EXIT * 0.7)) : 0;
    return { y: e.rise - 0.1 * out, opacity: e.opacity * (1 - out) };
  });
}

function scatterFrame(layout, p, t, length, words) {
  return {
    cards: layout.map((card) => cardFrame(card, layout.length, p, t, length)),
    words: wordFrames(words, p, t, length)
  };
}
`;
