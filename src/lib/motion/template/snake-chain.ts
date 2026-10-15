import { SOFT_SETTLE } from './soft-settle';

export const SNAKE_CHAIN = String.raw`
${SOFT_SETTLE}
const SURGE_BEAT = 3;
const MIN_SURGES = 2;
const MAX_SURGE_SHARE = 0.8;
const PATH_X = 0.36;
const PATH_Y = 0.26;
const PATH_Z = 0.42;
const LOOK = 0.22;
const MAX_YAW = 38;
const MAX_PITCH = 26;
const BANK = 10;
const BREATH = 0.012;
const DEPTH_ORDER = 1000;

const surgeCount = (length) => Math.max(MIN_SURGES, Math.round(length / SURGE_BEAT));

function leaderAt(t, length, surge) {
  const n = surgeCount(length);
  const step = length / n;
  const i = Math.floor(t / step);
  const move = Math.min(surge, step * MAX_SURGE_SHARE);
  return (i + glide((t - i * step) / move)) / n;
}

function pathPoint(chain, chains, u, spread) {
  const turn = TURN * u;
  const phase = (TURN * chain) / chains;
  return {
    x: spread * PATH_X * Math.sin(turn + phase),
    y: spread * PATH_Y * Math.sin(2 * turn + phase * 1.7),
    z: PATH_Z * Math.cos(turn + phase)
  };
}

function snakeCard(chain, chains, u, spread, t, length) {
  const here = pathPoint(chain, chains, u, spread);
  const ahead = pathPoint(chain, chains, u + LOOK / 10, spread);
  const dx = ahead.x - here.x;
  const dy = ahead.y - here.y;
  const dz = ahead.z - here.z;
  const reach = Math.hypot(dx, dy, dz) || 1;
  const breath = BREATH * loopWave(t, length, 2, chain);
  return {
    x: here.x,
    y: here.y + breath,
    z: here.z,
    yaw: MAX_YAW * (dx / reach),
    pitch: -MAX_PITCH * (dy / reach),
    roll: BANK * (dz / reach),
    order: Math.round((here.z + 1) * DEPTH_ORDER),
    opacity: 1
  };
}

function snakeChains(chains, perChain, p, t, length) {
  return Array.from({ length: chains }, (_, c) =>
    Array.from({ length: perChain }, (_, k) => {
      const lagged = t - k * p.trail;
      const u = leaderAt(wrap(lagged, length), length, p.surge) + (lagged < 0 ? -1 : 0) - k * p.gap + c / chains;
      return snakeCard(c, chains, u, p.spread, t, length);
    })
  ).flat();
}
`;
