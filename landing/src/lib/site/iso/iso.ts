const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const DIGITS = 2;

const round = (n: number) => Number(n.toFixed(DIGITS));

export const project = (x: number, y: number, z = 0): [number, number] => [round(COS * (x - y)), round(SIN * (x + y) - z)];

export const PLANE = `matrix(${round(COS)} ${SIN} ${-round(COS)} ${SIN} 0 0)`;

export const onTop = (x: number, y: number, z: number) => `translate(${project(x, y, z).join(' ')}) ${PLANE}`;

const points = (corners: [number, number, number][]) => corners.map(([x, y, z]) => project(x, y, z).join(',')).join(' ');

export type Box = { x: number; y: number; w: number; d: number; t: number };

export type Faces = { top: string; left: string; right: string };

export function slab({ x, y, w, d, t }: Box): Faces {
  return {
    top: points([[x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]]),
    left: points([[x, y + d, t], [x + w, y + d, t], [x + w, y + d, 0], [x, y + d, 0]]),
    right: points([[x + w, y, t], [x + w, y + d, t], [x + w, y + d, 0], [x + w, y, 0]])
  };
}

export type Shade = { top: string; left: string; right: string; line: string };

export const SHADES = {
  code: { top: '#141414', left: '#0c0c0c', right: '#070707', line: '#333' },
  paper: { top: '#f0eee9', left: '#cbc7bf', right: '#9e9a93', line: '#000' },
  card: { top: '#fbfaf7', left: '#d6d2ca', right: '#aaa69f', line: '#000' },
  night: { top: '#262626', left: '#1a1a1a', right: '#111', line: '#444' },
  nightCard: { top: '#333', left: '#222', right: '#171717', line: '#4a4a4a' },
  accent: { top: '#ff5100', left: '#cc4100', right: '#993100', line: '#000' }
} as const satisfies Record<string, Shade>;

export const INK = { light: '#151515', dark: '#f0eee9', accent: '#ff5100' } as const;
