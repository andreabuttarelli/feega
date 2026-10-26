import { IDENTITY, mul2d, type Affine } from "../../affine";
import { rgbaOf, type Rgba } from "../rgba";
import type { Stop } from "../paint";

export type Size = { w: number; h: number };
export type Gradient = {
  from: [number, number];
  to: [number, number];
  stops: Stop[];
  repeating: boolean;
};

const DEG = Math.PI / 180;
const ANGLE_UNITS: Record<string, number> = {
  deg: DEG,
  rad: 1,
  turn: 2 * Math.PI,
  grad: Math.PI / 200,
};
const SIDE_ANGLES: Record<string, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
};
const DEFAULT_ANGLE = 180;
const DIRECTION = /^(-?[\d.]+(deg|rad|turn|grad)$|to\s)/;
const PERCENT = 100;
const NONE_VALUES = new Set(["", "none"]);

export const isNone = (value: string | undefined) =>
  NONE_VALUES.has((value ?? "").trim());

export function splitTop(value: string, by = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    depth += c === "(" ? 1 : c === ")" ? -1 : 0;
    if (depth === 0 && c === by) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  return [...out, value.slice(start).trim()].filter(Boolean);
}

export function lengthOf(
  value: string | undefined,
  basis: number,
): number | null {
  const v = (value ?? "").trim();
  if (v === "") {
    return 0;
  }
  const m = /^(-?[\d.]+(?:e-?\d+)?)(px|%)?$/.exec(v);
  if (!m) {
    return null;
  }
  return m[2] === "%" ? (Number(m[1]) * basis) / PERCENT : Number(m[1]);
}

export type Matrix4 = number[];
type Perspective = { depth: number; origin: [number, number] };
type Point = [number, number];

const MATRIX_2D = /^matrix\(([^)]+)\)$/;
const MATRIX_3D = /^matrix3d\(([^)]+)\)$/;
const IDENTITY4: Matrix4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const translate4 = (x: number, y: number): Matrix4 => [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  x,
  y,
  0,
  1,
];
export const mul4 = (a: Matrix4, b: Matrix4): Matrix4 =>
  Array.from({ length: 16 }, (_, i) =>
    [0, 1, 2, 3].reduce(
      (sum, k) => sum + a[k * 4 + (i % 4)] * b[Math.floor(i / 4) * 4 + k],
      0,
    ),
  );
const originOf = (origin: string | undefined) =>
  (origin ?? "0px 0px").split(/\s+/).map((v) => parseFloat(v) || 0) as [
    number,
    number,
  ];

export function perspectiveOf(
  depth: string | undefined,
  origin: string | undefined,
): Perspective | null {
  const d = parseFloat(depth ?? "");
  return d > 0 ? { depth: d, origin: originOf(origin) } : null;
}

export function matrix4Of(
  transform: string | undefined,
  origin: string | undefined,
): Matrix4 | null {
  if (isNone(transform)) {
    return IDENTITY4;
  }
  const value = (transform ?? "").trim();
  const flat = MATRIX_2D.exec(value);
  const deep = MATRIX_3D.exec(value);
  const lifted = (v: number[]) => [
    v[0],
    v[1],
    0,
    0,
    v[2],
    v[3],
    0,
    0,
    0,
    0,
    1,
    0,
    v[4],
    v[5],
    0,
    1,
  ];
  const own = flat
    ? lifted(flat[1].split(",").map(Number))
    : deep
      ? deep[1].split(",").map(Number)
      : null;
  if (!own) {
    return null;
  }
  const [ox, oy] = originOf(origin);
  return mul4(mul4(translate4(ox, oy), own), translate4(-ox, -oy));
}

export const affineOf = (m: Matrix4): Affine | null =>
  Math.abs(m[3]) < 1e-12 &&
  Math.abs(m[7]) < 1e-12 &&
  Math.abs(m[15] - 1) < 1e-12
    ? [m[0], m[1], m[4], m[5], m[12], m[13]]
    : null;

export const projectBy =
  (m: Matrix4) =>
  ([x, y]: Point): Point | null => {
    const w = m[3] * x + m[7] * y + m[15];
    return w > 0
      ? [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w]
      : null;
  };

export function viewOf({ depth, origin: [px, py] }: Perspective): Matrix4 {
  const lens = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / depth, 0, 0, 0, 1];
  return mul4(mul4(translate4(px, py), lens), translate4(-px, -py));
}

export function flattened(m: Matrix4, size: Size): Affine | null {
  const box = size.w > 0 && size.h > 0 ? size : { w: 1, h: 1 };
  const corners: [number, number][] = [
    [0, 0],
    [box.w, 0],
    [box.w, box.h],
    [0, box.h],
  ];
  const projected = corners.map(projectBy(m));
  if (projected.some((p) => p === null)) {
    return null;
  }
  const points = projected as number[][];
  const [hx, hy] = [box.w / 2, box.h / 2];
  const signs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const fit = (axis: number) => {
    const mean = points.reduce((s, p) => s + p[axis], 0) / 4;
    const alongX =
      points.reduce((s, p, i) => s + signs[i][0] * p[axis], 0) / (4 * hx);
    const alongY =
      points.reduce((s, p, i) => s + signs[i][1] * p[axis], 0) / (4 * hy);
    return [alongX, alongY, mean - alongX * hx - alongY * hy];
  };
  const [a, c, e] = fit(0);
  const [b, d, f] = fit(1);
  return [a, b, c, d, e, f];
}

export function cornerOf(
  value: string | undefined,
  size: Size,
): [number, number] | null {
  const parts = (value ?? "0px").trim().split(/\s+/);
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
  if (words[0] !== "to") {
    return null;
  }
  const sides = words.slice(1);
  if (sides.length === 1) {
    return SIDE_ANGLES[sides[0]] ?? null;
  }
  const sx = sides.includes("right") ? 1 : sides.includes("left") ? -1 : 0;
  const sy = sides.includes("bottom") ? 1 : sides.includes("top") ? -1 : 0;
  return sx && sy ? Math.atan2(sx * size.h, -sy * size.w) / DEG : null;
}

type RawStop = { color: Rgba; at: number | null };

function stopsOf(args: string[], length: number): RawStop[] | null {
  const stops: RawStop[] = [];
  for (const arg of args) {
    const m =
      /^((?:rgba?|hsla?|color)\([^)]*\)|#[0-9a-f]+|[a-z]+)\s*(.*)$/i.exec(arg);
    const color = m ? rgbaOf(m[1]) : null;
    if (!m || !color) {
      return null;
    }
    const positions = m[2]
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => lengthOf(p, length));
    if (positions.some((p) => p === null) || positions.length > 2) {
      return null;
    }
    const ats = positions.length
      ? (positions as number[]).map((p) => p / length)
      : [null];
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

const padded = (stops: Stop[]): Stop[] => [
  ...(stops[0].at > 0 ? [{ at: 0, color: stops[0].color }] : []),
  ...stops,
  ...(stops[stops.length - 1].at < 1
    ? [{ at: 1, color: stops[stops.length - 1].color }]
    : []),
];

export function linearGradient(css: string, size: Size): Gradient | null {
  const m = /^(repeating-)?linear-gradient\((.*)\)$/s.exec(css.trim());
  if (!m) {
    return null;
  }
  const args = splitTop(m[2]);
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
  return {
    from: [size.w / 2 - half[0], size.h / 2 - half[1]],
    to: [size.w / 2 + half[0], size.h / 2 + half[1]],
    stops: m[1] ? placed(raw) : padded(placed(raw)),
    repeating: Boolean(m[1]),
  };
}

export function tileOf(value: string | undefined, box: Size): Size | null {
  const parts = (value ?? "auto").trim().split(/\s+/);
  if (parts[0] === "cover" || parts[0] === "contain") {
    return box;
  }
  const w = parts[0] === "auto" ? box.w : lengthOf(parts[0], box.w);
  const h = (parts[1] ?? "auto") === "auto" ? box.h : lengthOf(parts[1], box.h);
  return w === null || h === null || w <= 0 || h <= 0 ? null : { w, h };
}

export type Radial = {
  center: [number, number];
  radii: [number, number];
  stops: Stop[];
};

const RADIAL_HEAD = /^(circle|ellipse|closest-|farthest-|at\s|-?[\d.]+(px|%))/;
const POSITION_WORDS: Record<string, string> = {
  left: "0%",
  top: "0%",
  center: "50%",
  right: "100%",
  bottom: "100%",
};
const NEAREST = (a: number, b: number) => Math.min(a, b);
const FARTHEST = (a: number, b: number) => Math.max(a, b);
const EXTENTS: Record<
  string,
  { pick: (a: number, b: number) => number; corner: boolean }
> = {
  "closest-side": { pick: NEAREST, corner: false },
  "farthest-side": { pick: FARTHEST, corner: false },
  "closest-corner": { pick: NEAREST, corner: true },
  "farthest-corner": { pick: FARTHEST, corner: true },
};

function radiiOf(
  words: string[],
  [cx, cy]: [number, number],
  size: Size,
): [number, number] | null {
  const circle = words.includes("circle");
  const rest = words.filter((w) => w !== "circle" && w !== "ellipse");
  const extent = EXTENTS[rest[0] ?? "farthest-corner"];
  if (extent) {
    const [x, y] = [extent.pick(cx, size.w - cx), extent.pick(cy, size.h - cy)];
    if (circle) {
      return extent.corner
        ? [Math.hypot(x, y), Math.hypot(x, y)]
        : [extent.pick(x, y), extent.pick(x, y)];
    }
    return extent.corner ? [x * Math.SQRT2, y * Math.SQRT2] : [x, y];
  }
  const rx = lengthOf(rest[0], size.w);
  const ry = rest.length > 1 ? lengthOf(rest[1], size.h) : rx;
  return rx === null || ry === null ? null : [rx, ry];
}

export function radialGradient(css: string, size: Size): Radial | null {
  const m = /^radial-gradient\((.*)\)$/s.exec(css.trim());
  if (!m) {
    return null;
  }
  const args = splitTop(m[1]);
  const headed = RADIAL_HEAD.test(args[0]);
  const [shape, at] = headed
    ? (` ${args[0]}`.split(/\sat\s/) as [string, string?])
    : ["", undefined];
  const place = (at ?? "center")
    .trim()
    .split(/\s+/)
    .map((w) => POSITION_WORDS[w] ?? w);
  const cx = lengthOf(place[0], size.w);
  const cy = lengthOf(place[1] ?? "50%", size.h);
  if (cx === null || cy === null) {
    return null;
  }
  const radii = radiiOf(
    shape.trim().split(/\s+/).filter(Boolean),
    [cx, cy],
    size,
  );
  const raw =
    radii && radii[0] > 0 && radii[1] > 0
      ? stopsOf(headed ? args.slice(1) : args, radii[0])
      : null;
  return radii && raw
    ? { center: [cx, cy], radii, stops: padded(placed(raw)) }
    : null;
}
