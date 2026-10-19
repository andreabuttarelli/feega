import { fontStack, loadedWeight, type FontFace } from '../../fonts/model';
import type { Face, FaceBook, Request, Resolved } from './face';

export type FaceRule = { family: string; italic: boolean; weight: [number, number]; url: string; ranges: [number, number][] };

export type Axes = Record<string, [min: number, max: number, fallback: number]>;

export type Source = { axes: Axes; covers: (codePoint: number) => boolean; at: (coords: Record<string, number>) => Face };

const BLOCK = /@font-face\s*\{([^}]*)\}/g;
const DESCRIPTOR = /([a-z-]+)\s*:\s*([^;]+)/g;
const URL = /url\(\s*["']?([^"')]+)["']?\s*\)/;
const RANGE = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/gi;
const ALL: [number, number] = [0, 0x10ffff];
const QUOTED = /'([^']+)'/;
const SYNTHETIC_OBLIQUE = 0.25;
const MIDDLE = [400, 500] as const;

function rangesOf(value: string | undefined): [number, number][] {
  if (!value) {
    return [ALL];
  }
  return [...value.matchAll(RANGE)].map((m): [number, number] => {
    if (m[1].includes('?')) {
      return [parseInt(m[1].replace(/\?/g, '0'), 16), parseInt(m[1].replace(/\?/g, 'F'), 16)];
    }
    const lo = parseInt(m[1], 16);
    return [lo, m[2] ? parseInt(m[2], 16) : lo];
  });
}

export function faceRules(css: string): FaceRule[] {
  return [...css.matchAll(BLOCK)].flatMap((block) => {
    const d = Object.fromEntries([...block[1].matchAll(DESCRIPTOR)].map((m) => [m[1], m[2].trim()]));
    const url = URL.exec(d.src ?? '')?.[1];
    if (!d['font-family'] || !url) {
      return [];
    }
    const weights = (d['font-weight'] ?? '400').split(/\s+/).map(Number);
    return [{ family: d['font-family'].replace(/^['"]|['"]$/g, ''), italic: d['font-style'] === 'italic', weight: [weights[0], weights[1] ?? weights[0]], url, ranges: rangesOf(d['unicode-range']) }];
  });
}

const familyName = (family: string, registry: readonly FontFace[]) => QUOTED.exec(fontStack(family, registry))?.[1] ?? family;

function nearest(groups: [number, number][], desired: number): [number, number] | undefined {
  const inside = groups.find(([lo, hi]) => lo <= desired && desired <= hi);
  if (inside) {
    return inside;
  }
  const below = groups.filter(([, hi]) => hi < desired).sort((a, b) => b[1] - a[1]);
  const above = groups.filter(([lo]) => lo > desired).sort((a, b) => a[0] - b[0]);
  if (desired >= MIDDLE[0] && desired <= MIDDLE[1]) {
    return [...above.filter(([lo]) => lo <= MIDDLE[1]), ...below, ...above.filter(([lo]) => lo > MIDDLE[1])][0];
  }
  return (desired < MIDDLE[0] ? [...below, ...above] : [...above, ...below])[0];
}

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));

function coordsFor(source: Source, weight: number, request: Request): Record<string, number> {
  const auto: Record<string, number> = {};
  if (source.axes.wght) {
    auto.wght = weight;
  }
  if (source.axes.opsz) {
    auto.opsz = request.size;
  }
  return { ...auto, ...Object.fromEntries(Object.entries(request.axes).filter(([tag]) => source.axes[tag])) };
}

export const resolvedRequest = <R extends Omit<Request, 'size'>>(request: R, registry: readonly FontFace[]): R => ({ ...request, family: familyName(request.family, registry), weight: loadedWeight(request.family, request.weight, registry) });

export function faceBook(rules: readonly FaceRule[], sources: ReadonlyMap<string, Source>, registry: readonly FontFace[]): FaceBook {
  return (request, codePoint): Resolved | null => {
    const { family, weight: desired } = resolvedRequest(request, registry);
    const own = rules.filter((r) => r.family === family && sources.has(r.url));
    const styled = own.filter((r) => r.italic === request.italic);
    const pool = styled.length ? styled : own;
    const skew = request.italic && !styled.length ? SYNTHETIC_OBLIQUE : 0;
    const group = nearest([...new Map(pool.map((r) => [r.weight.join('-'), r.weight])).values()], desired);
    if (!group) {
      return null;
    }
    const rule = pool.find((r) => r.weight[0] === group[0] && r.weight[1] === group[1] && r.ranges.some(([lo, hi]) => lo <= codePoint && codePoint <= hi) && sources.get(r.url)!.covers(codePoint));
    if (!rule) {
      return null;
    }
    const source = sources.get(rule.url)!;
    return { face: source.at(coordsFor(source, clamp(desired, group), request)), skew };
  };
}
