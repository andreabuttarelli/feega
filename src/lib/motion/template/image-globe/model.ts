import { WORD_ENTRANCE } from '../word-entrance';

export const GLOBE_MODEL = String.raw`
${WORD_ENTRANCE}
const PERSPECTIVE = 2.4;
const MIN_TILES = 8;
const MAX_TILES = 60;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const START_RADIUS = 0.55;
const START_SIZE = 0.6;
const EXIT = 1.1;
const EXIT_SPREAD = 0.6;
const SPIN_LEAD = 0.6;
const CAMERA_TAIL = 0.8;
const FACE_EDGE = 0.5;
const FACE_SPAN = 1.1;
const VEIL_IN = 1.2;
const DEG = Math.PI / 180;

function globeLayout(p) {
  const n = Math.max(MIN_TILES, Math.min(MAX_TILES, Math.round(p.tiles)));
  const side = Math.sqrt((4 * Math.PI) / n) * p.tileSize * p.radius;
  const stretch = Math.sqrt(Math.max(0.2, p.tileAspect));
  return Array.from({ length: n }, (_, i) => ({
    lat: Math.asin(1 - (2 * (i + 0.5)) / n),
    lon: i * GOLDEN_ANGLE,
    w: side * stretch,
    h: side / stretch,
    order: n > 1 ? i / (n - 1) : 0
  }));
}

function spin(p, t, length) {
  const turns = Math.max(0, Math.round(p.turns));
  const lead = Math.min(SPIN_LEAD, (Math.PI * turns) / 2);
  const settle = smooth(span(t, p.assembleAt, p.assembleSeconds + p.stagger));
  const fling = p.leave ? smooth(span(t, length - EXIT - EXIT_SPREAD, EXIT + EXIT_SPREAD)) : 0;
  const steady = p.leave ? 2 * Math.PI * turns - 2 * lead : 2 * Math.PI * turns - lead;
  return (steady * t) / length + lead * settle + lead * fling;
}

function tileFrame(tile, p, t, length, yaw, tilt) {
  const at = p.assembleAt + tile.order * p.stagger;
  const enter = span(t, at, p.assembleSeconds);
  const grown = expoInOut(enter);
  const out = p.leave ? expoInOut(span(t, length - EXIT - EXIT_SPREAD * (1 - tile.order), EXIT)) : 0;
  const reach = START_RADIUS + (1 - START_RADIUS) * grown;
  const r = p.radius * reach * (1 - (1 - START_RADIUS) * out);
  const lon = tile.lon + yaw;
  const x = r * Math.cos(tile.lat) * Math.sin(lon);
  const y0 = -r * Math.sin(tile.lat);
  const z0 = r * Math.cos(tile.lat) * Math.cos(lon);
  const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
  const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
  const facing = r > 0 ? z / r : 1;
  const size = START_SIZE + (1 - START_SIZE) * grown;
  return {
    lon,
    lat: tile.lat,
    r,
    x,
    y,
    z,
    w: tile.w * size,
    h: tile.h * size,
    facing,
    shade: p.backDim * smooth(clamp01((FACE_EDGE - facing) / FACE_SPAN)),
    opacity: smooth(clamp01(enter * 1.6)) * (1 - smooth(out))
  };
}

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function titleOut(p, t, length, i) {
  return p.leave ? expoInOut(span(t, length - EXIT - 0.2 + i * 0.04, EXIT * 0.8)) : 0;
}

function globeFrame(layout, p, t, length) {
  const yaw = spin(p, t, length);
  const tilt = -p.axisTilt * DEG;
  const words = titleWords(p.title).map((_, i) => {
    const e = wordIn(t, p.titleAt + i * WORD_GAP);
    const out = titleOut(p, t, length, i);
    return { y: e.rise - 0.1 * out, opacity: e.opacity * (1 - smooth(out)) };
  });
  const camera = expoInOut(span(t, p.assembleAt, p.assembleSeconds + p.stagger + CAMERA_TAIL));
  return {
    yaw,
    tilt,
    scale: 1 - p.push + p.push * camera,
    tiles: layout.map((tile) => tileFrame(tile, p, t, length, yaw, tilt)),
    words,
    veil: p.globeDim * smooth(span(t, p.titleAt, VEIL_IN)) * (1 - smooth(titleOut(p, t, length, 0)))
  };
}
`;
