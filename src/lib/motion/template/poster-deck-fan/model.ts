import { SNAKE_CHAIN } from '../snake-chain';

export const PD_MODEL = String.raw`
${SNAKE_CHAIN}
const MIN_CARDS = 4;
const MAX_CARDS = 12;
const MIN_CHAINS = 1;
const MAX_CHAINS = 4;
const KINDS = ['photo', 'paper', 'photo', 'accent', 'photo', 'dark'];
const TURN_AT = [0.36, 0.78];
const TURN_SECONDS = 1.5;
const SURGE_SECONDS = 1.7;
const GAP = 0.04;

const clampRound = (v, min, max) => Math.max(min, Math.min(max, Math.round(v) || min));

function fanLayout(p) {
  const chains = clampRound(p.chains, MIN_CHAINS, MAX_CHAINS);
  const perChain = clampRound(p.count, MIN_CARDS, MAX_CARDS);
  let photo = 0;
  const cards = Array.from({ length: chains * perChain }, (_, i) => {
    const kind = i === 0 ? 'front' : KINDS[(i - 1) % KINDS.length];
    return { k: i, kind, media: kind === 'photo' ? photo++ : -1 };
  });
  return { chains, perChain, cards };
}

function fanFrame(layout, p, t, length) {
  const motion = { surge: SURGE_SECONDS, trail: p.riffleGap, gap: GAP * p.fan, spread: p.fan };
  const turn = 180 * (glide(span(t, TURN_AT[0] * length, TURN_SECONDS)) - glide(span(t, TURN_AT[1] * length, TURN_SECONDS)));
  const cards = snakeChains(layout.chains, layout.perChain, motion, t, length).map((c, i) => ({ ...c, turn: i === 0 ? turn : 0 }));
  return { cards };
}
`;
