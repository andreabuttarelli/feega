import { SNAKE_CHAIN } from '../snake-chain';

export const PS_MODEL = String.raw`
${SNAKE_CHAIN}
const MIN_CARDS = 3;
const MAX_CARDS = 9;
const MIN_CHAINS = 1;
const MAX_CHAINS = 4;
const KINDS = ['colourA', 'colourB', 'colourC'];
const LEAD_SCALE = 1.08;
const FLOOR_SWAY = 0.012;

const clampRound = (v, min, max) => Math.max(min, Math.min(max, Math.round(v) || min));

function deckLayout(p) {
  const chains = clampRound(p.chains, MIN_CHAINS, MAX_CHAINS);
  const perChain = clampRound(p.count, MIN_CARDS, MAX_CARDS);
  const cards = Array.from({ length: chains * perChain }, (_, i) => {
    const k = i % perChain;
    const kind = k === 0 ? 'photo' : KINDS[(k - 1) % KINDS.length];
    return { i, k, kind, media: k === 0 ? Math.floor(i / perChain) : -1 };
  });
  return { chains, perChain, cards };
}

function stackFrame(layout, p, t, length) {
  const motion = { surge: p.flip, trail: p.trail, gap: p.gap, spread: p.spread };
  const cards = snakeChains(layout.chains, layout.perChain, motion, t, length).map((c, i) => ({ ...c, scale: layout.cards[i].k === 0 ? LEAD_SCALE : 1 }));
  const blobs = [0, 1, 2].map((b) => ({
    x: 0.22 * loopWave(t, length, 1 + b, b * 2.1),
    y: 0.16 * loopWave(t, length, 2 - (b % 2), b * 1.3 + 0.7),
    turn: 40 * loopWave(t, length, 1, b)
  }));
  return { cards, blobs, sway: FLOOR_SWAY * loopWave(t, length, 1, 0.5) };
}
`;
