import { LENS_MAP_SIZE } from '../glass/lens-map';
import type { GlassPose } from '../glass/shape';

export const glassIds = {
  layer: (id: string) => `lg-${id}`,
  filter: (id: string) => `lgf-${id}`,
  map: (id: string) => `lgm-${id}`,
  smooth: (id: string) => `lgn-${id}`,
  bend: (id: string) => `lgd-${id}`,
  frost: (id: string) => `lgb-${id}`,
  cut: (id: string) => `lgk-${id}`,
  chrome: (id: string) => `lgs-${id}`,
  body: (id: string) => `lgc-${id}`,
  rim: (id: string) => `lgr-${id}`,
  shine: (id: string) => `lgh-${id}`,
  shade: (id: string) => `lgo-${id}`
};

export const UNIT = 100;
const EDGE_PAD = 2;
const SMOOTH_TEXELS = 3;
const PRECISION = 100;

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

export type Attrs = Record<string, string | number>;

function region(p: GlassPose): Attrs {
  return { x: round(p.cx - p.rx - EDGE_PAD), y: round(p.cy - p.ry - EDGE_PAD), width: round(2 * (p.rx + EDGE_PAD)), height: round(2 * (p.ry + EDGE_PAD)) };
}

export function glassAttrs(id: string, p: GlassPose): Map<string, Attrs> {
  const box = region(p);
  const texel = (2 * SMOOTH_TEXELS) / LENS_MAP_SIZE;
  return new Map<string, Attrs>([
    [glassIds.map(id), { x: round(p.cx - p.rx), y: round(p.cy - p.ry), width: round(2 * p.rx), height: round(2 * p.ry) }],
    [glassIds.smooth(id), { ...box, stdDeviation: `${round(texel * p.rx)} ${round(texel * p.ry)}` }],
    [glassIds.bend(id), { ...box, scale: round(p.bend) }],
    [glassIds.frost(id), { ...box, stdDeviation: round(p.frost) }],
    [glassIds.cut(id), box],
    [glassIds.body(id), { transform: `translate(${round(p.cx)} ${round(p.cy)}) scale(${round(p.rx / UNIT)} ${round(p.ry / UNIT)})`, opacity: round(p.alpha) }]
  ]);
}
