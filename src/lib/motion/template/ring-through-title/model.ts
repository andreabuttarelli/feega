import { WORD_ENTRANCE } from '../word-entrance';

export const RING_MODEL = String.raw`
${WORD_ENTRANCE}
const PERSPECTIVE = 1.25;
const MIN_CARDS = 6;
const MAX_CARDS = 32;
const ENTER_REACH = 0.22;
const ENTER_SIZE = 0.7;
const EXIT = 1.1;
const EXIT_SPREAD = 0.7;
const EXIT_REACH = 0.18;
const SPIN_LEAD = 0.9;
const DEG = Math.PI / 180;

const fract = (x) => x - Math.floor(x);
const grain = (i, salt) => fract(Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453);

function ringLayout(p) {
  const n = Math.max(MIN_CARDS, Math.min(MAX_CARDS, Math.round(p.cards)));
  return Array.from({ length: n }, (_, i) => {
    const size = 1 + p.variety * (grain(i, 1) - 0.5);
    const aspect = p.cardAspect * (1 + 0.3 * p.variety * (grain(i, 2) - 0.5));
    return {
      angle: (2 * Math.PI * i) / n,
      w: p.cardSize * size * Math.sqrt(aspect / p.cardAspect),
      h: (p.cardSize * size) / Math.sqrt(aspect * p.cardAspect),
      order: n > 1 ? i / (n - 1) : 0
    };
  });
}

function spin(p, t, length) {
  const turns = Math.max(0, Math.round(p.turns));
  const lead = Math.min(SPIN_LEAD, (Math.PI * turns) / 2);
  const settle = smooth(span(t, p.ringAt, p.ringSeconds + p.stagger));
  const fling = p.leave ? smooth(span(t, length - EXIT - EXIT_SPREAD, EXIT + EXIT_SPREAD)) : 0;
  const steady = p.leave ? 2 * Math.PI * turns - 2 * lead : 2 * Math.PI * turns - lead;
  return (steady * t) / length + lead * settle + lead * fling;
}

function place(angle, r, yaw, tilt) {
  const x0 = r * Math.cos(angle);
  const y0 = r * Math.sin(angle);
  const x1 = x0 * Math.cos(yaw);
  const z1 = -x0 * Math.sin(yaw);
  const y = y0 * Math.cos(tilt) - z1 * Math.sin(tilt);
  const z = y0 * Math.sin(tilt) + z1 * Math.cos(tilt);
  const s = PERSPECTIVE / (PERSPECTIVE - z);
  return { x: x1 * s, y: y * s, z, s };
}

function centring(p) {
  const yaw = p.yaw * DEG;
  const tilt = p.tilt * DEG;
  return -(place(0, p.radius, yaw, tilt).x + place(Math.PI, p.radius, yaw, tilt).x) / 2;
}

function cardFrame(card, p, t, length, phase) {
  const enter = span(t, p.ringAt + card.order * p.stagger, p.ringSeconds);
  const grown = expoInOut(enter);
  const out = p.leave ? expoInOut(span(t, length - EXIT - EXIT_SPREAD * (1 - card.order), EXIT)) : 0;
  const r = p.radius * (1 + ENTER_REACH * (1 - grown) + EXIT_REACH * out);
  const at = place(card.angle + phase, r, p.yaw * DEG, p.tilt * DEG);
  const size = (ENTER_SIZE + (1 - ENTER_SIZE) * grown) * at.s;
  const depth = clamp01(-at.z / Math.max(p.radius, 1e-6));
  return {
    r,
    x: at.x + centring(p),
    y: at.y,
    z: at.z,
    w: card.w * size,
    h: card.h * size,
    front: at.z > 0,
    shade: p.backDim * smooth(depth),
    opacity: smooth(clamp01(enter * 1.8)) * (1 - smooth(out))
  };
}

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function titleOut(p, t, length, i) {
  return p.leave ? expoInOut(span(t, length - EXIT - 0.1 + i * 0.05, EXIT * 0.8)) : 0;
}

function layered(cards) {
  const byDepth = cards.map((c, i) => [c.z, i]).sort((a, b) => a[0] - b[0]);
  const rank = new Array(cards.length);
  byDepth.forEach(([, i], k) => {
    rank[i] = k;
  });
  return cards.map((c, i) => ({ ...c, layer: rank[i] + (c.front ? cards.length + 1 : 0) }));
}

function ringFrame(layout, p, t, length) {
  const phase = spin(p, t, length);
  const words = titleWords(p.title).map((_, i) => {
    const e = wordIn(t, p.titleAt + i * WORD_GAP);
    const out = titleOut(p, t, length, i);
    return { y: e.rise - 0.08 * out, opacity: e.opacity * (1 - smooth(out)) };
  });
  return {
    phase,
    titleLayer: layout.length,
    cards: layered(layout.map((card) => cardFrame(card, p, t, length, phase))),
    words
  };
}
`;
