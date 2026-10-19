import { IDENTITY, mul2d, type Affine } from '../../affine';
import { rgbaOf, type Rgba } from '../rgba';
import type { Stop } from '../paint';

export type Size = { w: number; h: number };
export type Gradient = { from: [number, number]; to: [number, number]; stops: Stop[] };

const DEG = Math.PI / 180;
const ANGLE_UNITS: Record<string, number> = { deg: DEG, rad: 1, turn: 2 * Math.PI, grad: Math.PI / 200 };
const SIDE_ANGLES: Record<string, number> = { top: 0, right: 90, bottom: 180, left: 270 };
const DEFAULT_ANGLE = 180;
const DIRECTION = /^(-?[\d.]+(deg|rad|turn|grad)$|to\s)/;
const PERCENT = 100;
const NONE_VALUES = new Set(['', 'none']);

export const isNone = (value: string | undefined) => NONE_VALUES.has((value ?? '').trim());

export function splitTop(value: string, by = ','): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    depth += c === '(' ? 1 : c === ')' ? -1 : 0;
    if (depth === 0 && c === by) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...out, value.slice(start).trim()].filter(Boolean);
}

export function lengthOf(value: string | undefined, basis: number): number | null {
  const v = (value ?? '').trim();
  if (v === '') {
    return 0;
  }
  const m = /^(-?[\d.]+(?:e-?\d+)?)(px|%)?$/.exec(v);
  if (!m) {
    return null;
  }
  return m[2] === '%' ? (Number(m[1]) * basis) / PERCENT : Number(m[1]);
}

export function transformOf(transform: string | undefined, origin: string | undefined): Affine | null {
  if (isNone(transform)) {
    return IDENTITY;
  }
  const m = /^matrix\(([^)]+)\)$/.exec((transform ?? '').trim());
  if (!m) {
    return null;
  }
  const [a, b, c, d, e, f] = m[1].split(',').map(Number);
  const [ox, oy] = (origin ?? '0px 0px').split(/\s+/).map((v) => parseFloat(v) || 0);
  return mul2d(mul2d([1, 0, 0, 1, ox, oy], [a, b, c, d, e, f]), [1, 0, 0, 1, -ox, -oy]);
}

export function cornerOf(value: string | undefined, size: Size): [number, number] | null {
  const parts = (value ?? '0px').trim().split(/\s+/);
  const rx = lengthOf(parts[0], size.w);
  const ry = lengthOf(parts[1] ?? parts[0], size.h);
  return rx === null || ry === null ? null : [rx, ry];
}

function angleOf(head: string, size: Size): number | null {
  const unit = /^(-?[\d.]+)(deg|rad|turn|grad)$/.exec(head);
  if (unit) {
    return (Number(unit[1]) * ANGLE_UNITS[unit[2]]) / DEG;
  }
  const words = head.split(/\s+/);
  if (words[0] !== 'to') {
    return null;
  }
  const sides = words.slice(1);
  if (sides.length === 1) {
    return SIDE_ANGLES[sides[0]] ?? null;
  }
  const sx = sides.includes('right') ? 1 : sides.includes('left') ? -1 : 0;
  const sy = sides.includes('bottom') ? 1 : sides.includes('top') ? -1 : 0;
  return sx && sy ? Math.atan2(sx * size.h, -sy * size.w) / DEG : null;
}

type RawStop = { color: Rgba; at: number | null };

function stopsOf(args: string[], length: number): RawStop[] | null {
  const stops: RawStop[] = [];
  for (const arg of args) {
    const m = /^((?:rgba?|hsla?)\([^)]*\)|#[0-9a-f]+|[a-z]+)\s*(.*)$/i.exec(arg);
    const color = m ? rgbaOf(m[1]) : null;
    if (!m || !color) {
      return null;
    }
    const positions = m[2].split(/\s+/).filter(Boolean).map((p) => lengthOf(p, length));
    if (positions.some((p) => p === null) || positions.length > 2) {
      return null;
    }
    const ats = positions.length ? (positions as number[]).map((p) => p / length) : [null];
    stops.push(...ats.map((at) => ({ color, at })));
  }
  return stops.length >= 2 ? stops : null;
}

function placed(stops: RawStop[]): Stop[] {
  const ats = stops.map((s) => s.at);
  ats[0] ??= 0;
  ats[ats.length - 1] ??= 1;
  for (let i = 1; i < ats.length; i++) {
    if (ats[i] !== null) {
      ats[i] = Math.max(ats[i] as number, ats[i - 1] as number);
    }
  }
  for (let i = 1; i < ats.length; i++) {
    if (ats[i] !== null) {
      continue;
    }
    const next = ats.findIndex((a, j) => j > i && a !== null);
    const from = ats[i - 1] as number;
    ats[i] = from + ((ats[next] as number) - from) / (next - i + 1);
  }
  return stops.map((s, i) => ({ at: ats[i] as number, color: s.color }));
}

export function linearGradient(css: string, size: Size): Gradient | null {
  const m = /^linear-gradient\((.*)\)$/s.exec(css.trim());
  if (!m) {
    return null;
  }
  const args = splitTop(m[1]);
  const directed = DIRECTION.test(args[0]);
  const angle = directed ? angleOf(args[0], size) : DEFAULT_ANGLE;
  if (angle === null) {
    return null;
  }
  const a = angle * DEG;
  const dir: [number, number] = [Math.sin(a), -Math.cos(a)];
  const length = Math.abs(size.w * dir[0]) + Math.abs(size.h * dir[1]);
  const raw = stopsOf(directed ? args.slice(1) : args, length);
  if (!raw) {
    return null;
  }
  const half: [number, number] = [(dir[0] * length) / 2, (dir[1] * length) / 2];
  return { from: [size.w / 2 - half[0], size.h / 2 - half[1]], to: [size.w / 2 + half[0], size.h / 2 + half[1]], stops: placed(raw) };
}

export function tileOf(value: string | undefined, box: Size): Size | null {
  const parts = (value ?? 'auto').trim().split(/\s+/);
  if (parts[0] === 'cover' || parts[0] === 'contain') {
    return box;
  }
  const w = parts[0] === 'auto' ? box.w : lengthOf(parts[0], box.w);
  const h = (parts[1] ?? 'auto') === 'auto' ? box.h : lengthOf(parts[1], box.h);
  return w === null || h === null || w <= 0 || h <= 0 ? null : { w, h };
}
