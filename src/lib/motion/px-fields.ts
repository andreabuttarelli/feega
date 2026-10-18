import type { Frame } from './units';

export type PxBox = { left: number; top: number; width: number; height: number };

export type PxRead = { box: PxBox | null; radius: number | null; strokes_px: number[] | null };

type Props = Record<string, unknown>;

const MAX_ROUNDNESS = 0.5;
const PRECISION = 100;

const STROKE_PX_FIELDS = { width_px: 'width', dash_px: 'dash', gap_px: 'gap' } as const;

export const PX_FIELDS_GUIDE =
  'Px fields: left/top place the top-left corner of the box in px (instead of x/y, its centre); radius is the corner radius in px (instead of roundness); each stroke takes width_px, dash_px, gap_px in px (instead of fractions of the short side). Reads give box {left, top, width, height}, radius and strokes_px in px next to the stored props.';

const tidy = (n: number) => Math.round(n * PRECISION) / PRECISION;
const shortSide = (frame: Frame) => Math.min(frame.width, frame.height);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

function strokeFromPx(stroke: unknown, frame: Frame): unknown {
  if (!stroke || typeof stroke !== 'object') {
    return stroke;
  }
  const out: Props = { ...(stroke as Props) };
  for (const [field, key] of Object.entries(STROKE_PX_FIELDS)) {
    const value = num(out[field]);
    if (value === null) {
      continue;
    }
    out[key] = value / shortSide(frame);
    delete out[field];
  }
  return out;
}

export function strokesFromPx(strokes: unknown, frame: Frame): unknown {
  return Array.isArray(strokes) ? strokes.map((s) => strokeFromPx(s, frame)) : strokes;
}

export function propsFromPx(props: Props, shownBefore: Props, frame: Frame): Props {
  const { left, top, radius, ...rest } = props;
  const width = num(rest.width) ?? num(shownBefore.width) ?? 0;
  const height = num(rest.height) ?? num(shownBefore.height) ?? 0;
  const out: Props = { ...rest };

  if (typeof left === 'number') {
    out.x = left + width / 2;
  }
  if (typeof top === 'number') {
    out.y = top + height / 2;
  }
  if (typeof radius === 'number') {
    const side = Math.min(width, height);
    out.roundness = side > 0 ? Math.min(MAX_ROUNDNESS, radius / side) : 0;
  }
  if (rest.strokes !== undefined) {
    out.strokes = strokesFromPx(rest.strokes, frame);
  }
  return out;
}

function boxOf(stored: Props, frame: Frame): PxBox | null {
  const [x, y] = [num(stored.x), num(stored.y)];
  if (x === null || y === null) {
    return null;
  }
  const width = (num(stored.width) ?? 0) * frame.width;
  const height = (num(stored.height) ?? 0) * frame.height;
  return { left: tidy(x * frame.width - width / 2), top: tidy(y * frame.height - height / 2), width: tidy(width), height: tidy(height) };
}

export function pxRead(stored: Props, frame: Frame): PxRead {
  const box = boxOf(stored, frame);
  const roundness = num(stored.roundness);
  const strokes = Array.isArray(stored.strokes) ? (stored.strokes as Props[]) : null;
  return {
    box,
    radius: box && roundness !== null ? tidy(roundness * Math.min(box.width, box.height)) : null,
    strokes_px: strokes ? strokes.map((s) => tidy((num(s.width) ?? 0) * shortSide(frame))) : null
  };
}
