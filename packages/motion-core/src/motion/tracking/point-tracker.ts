import type { Luma } from './luma';

export enum Direction {
  Forward = 1,
  Backward = -1
}

export enum Adapt {
  Never = 'never',
  EachFrame = 'each-frame'
}

export type Spot = { x: number; y: number };

export type TrackOptions = { feature: number; search: number; adapt: Adapt; minScore: number };

export type Sample = Spot & { index: number; score: number };

export type Tracked = { samples: Sample[]; lost: boolean };

export const DEFAULT_TRACK: TrackOptions = { feature: 0.04, search: 0.12, adapt: Adapt.Never, minScore: 0.5 };

type Plane = { width: number; height: number; data: Float32Array };

type Template = { half: number; size: number; data: Float32Array; energy: number };

type Match = Spot & { score: number };

const LEVELS = 3;
const REFINE_RADIUS = 2;
const MIN_HALF = 2;
const FLAT = 1e-6;

function planeOf(luma: Luma): Plane {
  return { width: luma.width, height: luma.height, data: Float32Array.from(luma.data) };
}

function halved(plane: Plane): Plane {
  const width = Math.max(1, plane.width >> 1);
  const height = Math.max(1, plane.height >> 1);
  const data = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = 2 * y * plane.width + 2 * x;
      data[y * width + x] = (plane.data[at] + plane.data[at + 1] + plane.data[at + plane.width] + plane.data[at + plane.width + 1]) / 4;
    }
  }
  return { width, height, data };
}

function pyramid(luma: Luma): Plane[] {
  const levels = [planeOf(luma)];

  while (levels.length < LEVELS) {
    levels.push(halved(levels[levels.length - 1]));
  }
  return levels;
}

const fits = (plane: Plane, x: number, y: number, half: number) => x - half >= 0 && y - half >= 0 && x + half < plane.width && y + half < plane.height;

function templateAt(plane: Plane, x: number, y: number, half: number): Template | null {
  if (!fits(plane, x, y, half)) {
    return null;
  }
  const size = 2 * half + 1;
  const data = new Float32Array(size * size);
  let sum = 0;

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const value = plane.data[(y - half + j) * plane.width + x - half + i];
      data[j * size + i] = value;
      sum += value;
    }
  }
  const mean = sum / data.length;
  let energy = 0;
  for (let k = 0; k < data.length; k++) {
    data[k] -= mean;
    energy += data[k] * data[k];
  }
  return { half, size, data, energy };
}

function scoreAt(plane: Plane, t: Template, x: number, y: number): number {
  let sum = 0;
  let squares = 0;
  let cross = 0;

  for (let j = 0; j < t.size; j++) {
    const row = (y - t.half + j) * plane.width + x - t.half;
    for (let i = 0; i < t.size; i++) {
      const value = plane.data[row + i];
      sum += value;
      squares += value * value;
      cross += value * t.data[j * t.size + i];
    }
  }
  const spread = squares - (sum * sum) / t.data.length;
  if (spread < FLAT || t.energy < FLAT) {
    return 0;
  }
  return cross / Math.sqrt(spread * t.energy);
}

function bestAround(plane: Plane, t: Template, cx: number, cy: number, radius: number): Match | null {
  let best: Match | null = null;

  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!fits(plane, x, y, t.half)) {
        continue;
      }
      const score = scoreAt(plane, t, x, y);
      if (!best || score > best.score) {
        best = { x, y, score };
      }
    }
  }
  return best;
}

function parabola(before: number, centre: number, after: number): number {
  const bend = before - 2 * centre + after;
  return bend === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (before - after)) / bend));
}

function subpixel(plane: Plane, t: Template, at: Match): Spot {
  if (!fits(plane, at.x, at.y, t.half + 1)) {
    return at;
  }
  const dx = parabola(scoreAt(plane, t, at.x - 1, at.y), at.score, scoreAt(plane, t, at.x + 1, at.y));
  const dy = parabola(scoreAt(plane, t, at.x, at.y - 1), at.score, scoreAt(plane, t, at.x, at.y + 1));
  return { x: at.x + dx, y: at.y + dy };
}

type Reference = { templates: Template[]; lead: Spot };

function referenceAt(planes: Plane[], at: Spot, half: number): Reference | null {
  const templates: Template[] = [];

  for (let level = 0; level < LEVELS; level++) {
    const scale = 2 ** level;
    const made = templateAt(planes[level], Math.round(at.x / scale), Math.round(at.y / scale), level === 0 ? half : Math.max(MIN_HALF, Math.round(half / scale)));
    if (!made) {
      return null;
    }
    templates.push(made);
  }
  return { templates, lead: { x: at.x - Math.round(at.x), y: at.y - Math.round(at.y) } };
}

function locate(planes: Plane[], ref: Reference, from: Spot, radius: number): Match | null {
  const top = LEVELS - 1;
  const topScale = 2 ** top;
  let at = bestAround(planes[top], ref.templates[top], Math.round(from.x / topScale), Math.round(from.y / topScale), Math.ceil(radius / topScale));

  for (let level = top - 1; level >= 0 && at; level--) {
    at = bestAround(planes[level], ref.templates[level], at.x * 2, at.y * 2, REFINE_RADIUS);
  }
  if (!at) {
    return null;
  }
  const exact = subpixel(planes[0], ref.templates[0], at);
  return { x: exact.x + ref.lead.x, y: exact.y + ref.lead.y, score: at.score };
}

const normalised = (spot: Spot, luma: Luma): Spot => ({ x: spot.x / luma.width, y: spot.y / luma.height });

export function trackFrom(lumas: readonly Luma[], start: number, point: Spot, direction: Direction, options: TrackOptions): Tracked {
  const first = lumas[start];
  const width = first.width;
  const half = Math.max(MIN_HALF, Math.round(options.feature * width));
  const radius = Math.max(1, Math.round(options.search * width));
  const from: Spot = { x: point.x * width, y: point.y * first.height };
  let planes = pyramid(first);
  let reference = referenceAt(planes, from, half);

  if (!reference) {
    return { samples: [], lost: true };
  }
  const samples: Sample[] = [{ index: start, ...point, score: 1 }];
  let at = from;

  for (let index = start + direction; index >= 0 && index < lumas.length; index += direction) {
    planes = pyramid(lumas[index]);
    const found = locate(planes, reference, at, radius);
    if (!found || found.score < options.minScore) {
      return { samples, lost: true };
    }
    at = { x: found.x, y: found.y };
    samples.push({ index, ...normalised(at, lumas[index]), score: found.score });
    if (options.adapt === Adapt.EachFrame) {
      reference = referenceAt(planes, at, half) ?? reference;
    }
  }
  return { samples, lost: false };
}
