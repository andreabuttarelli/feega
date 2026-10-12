import { WORD_ENTRANCE } from '../word-entrance';

export const GTW_MODEL = String.raw`
${WORD_ENTRANCE}
const MOVE_SHARE = 0.62;
const EXPO_EDGE = Math.pow(2, -10) / 2;
const MAX_ROWS_HALF = 4;
const MAX_LATITUDE = 1.35;
const MIN_FACING = 0.12;
const LIFT_SHARPNESS = 8;
const LIFT_DEPTH = 0.12;
const CAMERA_DISTANCE = 1.7;
const DEG = Math.PI / 180;
const SWAY = 0.06;
const STAGGER_DEPTH = 0.16;
const GOLDEN = 0.6180339887;
const PITCH_SHARE = 0.4;

const glide = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : (expoInOut(x) - EXPO_EDGE) / (1 - 2 * EXPO_EDGE));
const wrap = (x, period) => x - period * Math.floor(x / period);
const movesOf = (p) => Math.max(1, Math.round(p.moves));
const loopColumns = (p) => movesOf(p) * Math.max(1, Math.round(p.step));

function wallLayout(p, width, height) {
  const unit = Math.min(width, height);
  const tileW = p.tileSize * unit;
  const tileH = tileW / Math.max(0.3, p.tileAspect);
  const gap = p.gap * tileW;
  const pitchX = tileW + gap;
  const pitchY = tileH + gap;
  const radius = Math.max(0.3, p.curve) * Math.max(width, height);
  const rowsHalf = Math.min(MAX_ROWS_HALF, Math.ceil((height / 2 + pitchY) / pitchY));
  const k = loopColumns(p);
  const rows = [];
  for (let r = -rowsHalf; r <= rowsHalf; r++) {
    const b = (r * pitchY) / radius;
    if (Math.abs(b) > MAX_LATITUDE) {
      continue;
    }
    const ring = radius * Math.cos(b);
    const reach = Math.min((ring * Math.PI) / 2, width * 0.75 + pitchX);
    const slots = k * Math.ceil((2 * reach / pitchX + 3) / k);
    rows.push({ r, b, ring, reach, slots, shift: wrap(r, 2) * pitchX / 2 });
  }
  return { width, height, tileW, tileH, pitchX, pitchY, radius, distance: CAMERA_DISTANCE * Math.max(width, height), k, rows };
}

function panAt(p, t, length) {
  const moves = movesOf(p);
  const loops = Math.floor(t / length);
  const local = ((t - loops * length) / length) * moves;
  const k = Math.floor(local);
  const move = clamp01((local - k - (1 - MOVE_SHARE) / 2) / MOVE_SHARE);
  return loops + (k + glide(move)) / moves;
}

function itemOf(layout, row, slot) {
  return wrap(wrap(slot, layout.k) + row.r * (layout.k + 1), 1e6);
}

function placeTile(layout, p, row, slot, q, tilt) {
  const span = row.slots * layout.pitchX;
  const s = wrap(slot * layout.pitchX + row.shift - q + span / 2, span) - span / 2;
  const a = s / row.ring;
  const R = layout.radius;
  const cb = Math.cos(row.b);
  const sb = Math.sin(row.b);
  const ca = Math.cos(a);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const y0 = R * sb;
  const z0 = R * cb * ca;
  const facing = sb * st + cb * ca * ct;
  const item = itemOf(layout, row, slot);
  const stagger = p.stagger * STAGGER_DEPTH * layout.tileW * (2 * wrap(item * GOLDEN, 1) - 1);
  const lift = p.lift * LIFT_DEPTH * layout.tileW * Math.pow(Math.max(0, facing), LIFT_SHARPNESS);
  return {
    row: row.r,
    slot,
    item,
    x: R * cb * Math.sin(a),
    y: y0 * ct - z0 * st,
    z: y0 * st + z0 * ct - R + lift + stagger,
    a,
    b: row.b,
    facing,
    shown: Math.abs(s) < row.reach && facing > MIN_FACING
  };
}

function wallFrame(layout, p, t, length) {
  const progress = panAt(p, t, length);
  const breath = (2 * Math.PI * t) / length;
  const q = (progress * layout.k + SWAY * Math.sin(breath)) * layout.pitchX;
  const tilt = p.tilt * DEG * Math.cos(breath);
  const tiles = layout.rows.flatMap((row) => Array.from({ length: row.slots }, (_, slot) => placeTile(layout, p, row, slot, q, tilt)));
  return { tilt, tiles };
}

function orbitAt(p, t, length) {
  const turn = (2 * Math.PI * t) / length;
  const reach = p.orbit * DEG;
  return { yaw: reach * Math.sin(turn), pitch: reach * PITCH_SHARE * Math.sin(2 * turn) };
}
`;
