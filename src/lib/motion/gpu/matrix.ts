export type Mat4 = number[];

export type Size = { width: number; height: number };

export const IDENTITY_3D: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const DEG = Math.PI / 180;
const FUNCTION = /([a-zA-Z0-9]+)\(([^)]*)\)/g;

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export const translation = (x: number, y: number, z = 0): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

const scaling = (x: number, y: number, z = 1): Mat4 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];

const affine = (a: number, b: number, c: number, d: number, e: number, f: number): Mat4 => [a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, e, f, 0, 1];

function rotationZ(deg: number): Mat4 {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return affine(c, s, -s, c, 0, 0);
}

function rotationX(deg: number): Mat4 {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

function rotationY(deg: number): Mat4 {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

export function perspective(distance: number): Mat4 {
  const m = [...IDENTITY_3D];
  m[11] = distance ? -1 / distance : 0;
  return m;
}

function length(raw: string, reference: number): number {
  const value = parseFloat(raw);
  return raw.trim().endsWith('%') ? (value / 100) * reference : value || 0;
}

function angle(raw: string): number {
  const value = parseFloat(raw) || 0;
  const UNITS: Record<string, number> = { deg: 1, rad: 1 / DEG, turn: 360, grad: 0.9 };
  const unit = /[a-z]+$/.exec(raw.trim())?.[0] ?? 'deg';
  return value * (UNITS[unit] ?? 1);
}

type Fn = (args: string[], box: Size) => Mat4;

const FUNCTIONS: Record<string, Fn> = {
  translate: ([x, y = '0'], box) => translation(length(x, box.width), length(y, box.height)),
  translateX: ([x], box) => translation(length(x, box.width), 0),
  translateY: ([y], box) => translation(0, length(y, box.height)),
  translate3d: ([x, y, z], box) => translation(length(x, box.width), length(y, box.height), length(z, 0)),
  translateZ: ([z]) => translation(0, 0, length(z, 0)),
  scale: ([x, y]) => scaling(Number(x), Number(y ?? x)),
  scaleX: ([x]) => scaling(Number(x), 1),
  scaleY: ([y]) => scaling(1, Number(y)),
  scale3d: ([x, y, z]) => scaling(Number(x), Number(y), Number(z)),
  rotate: ([a]) => rotationZ(angle(a)),
  rotateZ: ([a]) => rotationZ(angle(a)),
  rotateX: ([a]) => rotationX(angle(a)),
  rotateY: ([a]) => rotationY(angle(a)),
  skew: ([x, y = '0']) => affine(1, Math.tan(angle(y) * DEG), Math.tan(angle(x) * DEG), 1, 0, 0),
  skewX: ([x]) => affine(1, 0, Math.tan(angle(x) * DEG), 1, 0, 0),
  skewY: ([y]) => affine(1, Math.tan(angle(y) * DEG), 0, 1, 0, 0),
  perspective: ([d]) => perspective(parseFloat(d)),
  matrix: (n) => affine(...(n.map(Number) as [number, number, number, number, number, number])),
  matrix3d: (n) => n.map(Number)
};

export function cssTransform(transform: string, box: Size): Mat4 {
  let out = IDENTITY_3D;
  for (const [, name, args] of transform.matchAll(FUNCTION)) {
    const fn = FUNCTIONS[name];
    if (!fn) {
      continue;
    }
    out = multiply(out, fn(args.split(',').map((a) => a.trim()), box));
  }
  return out;
}

export function project(m: Mat4, x: number, y: number): [number, number] {
  const w = m[3] * x + m[7] * y + m[15];
  return [(m[0] * x + m[4] * y + m[12]) / w, (m[1] * x + m[5] * y + m[13]) / w];
}

export function isAffine(m: Mat4): boolean {
  const TOLERANCE = 1e-9;
  return Math.abs(m[3]) < TOLERANCE && Math.abs(m[7]) < TOLERANCE && Math.abs(m[15] - 1) < TOLERANCE;
}

export function scaleOf(m: Mat4): number {
  return Math.sqrt(Math.abs(m[0] * m[5] - m[1] * m[4]));
}
