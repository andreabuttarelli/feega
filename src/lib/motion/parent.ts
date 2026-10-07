import { TrackKind } from './components';
import { TRANSFORM, sampleTrack, type Keyframe, type Transform, type TransformKey } from './keyframes';
import type { Box } from './layout';
import { IDENTITY, apply2d, composeLocal, mul2d, type Affine, type Pose2d } from './affine';

export { IDENTITY, apply2d, composeLocal, mul2d, type Affine, type Pose2d };

export enum ParentOpacity {
  Inherit = 'inherit',
  Ignore = 'ignore'
}

export const PARENT_OPACITIES = [ParentOpacity.Inherit, ParentOpacity.Ignore] as const;

export type Size = { width: number; height: number };

type Parented = { id: string; parent: string | null };
type Posed = Parented & { from: number; props: Record<string, unknown>; transform: Transform; keyframes: Record<string, Keyframe[] | undefined> };
type Tracks = { tracks: { kind: string; clips: unknown[] }[] };

const DEG = Math.PI / 180;




export function invert2d(m: Affine): Affine {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

function clipsOf(doc: Tracks): Posed[] {
  return doc.tracks.flatMap((t) => t.clips as Posed[]);
}

function visualIds(doc: Tracks): Set<string> {
  return new Set(doc.tracks.filter((t) => t.kind === TrackKind.Visual).flatMap((t) => (t.clips as Parented[]).map((c) => c.id)));
}

function parentMap(doc: Tracks): Map<string, string | null> {
  return new Map(clipsOf(doc).map((c) => [c.id, c.parent ?? null]));
}

export function ancestorsOf(doc: Tracks, clipId: string): string[] {
  const parents = parentMap(doc);
  const chain: string[] = [];
  let at = parents.get(clipId) ?? null;
  while (at && !chain.includes(at) && at !== clipId) {
    chain.unshift(at);
    at = parents.get(at) ?? null;
  }
  return chain;
}

export function childrenOf(doc: Tracks, clipId: string): string[] {
  return clipsOf(doc)
    .filter((c) => c.parent === clipId)
    .map((c) => c.id);
}

export function parentChoices(doc: Tracks, clipId: string): string[] {
  const descends = (id: string) => id === clipId || ancestorsOf(doc, id).includes(clipId);
  return [...visualIds(doc)].filter((id) => !descends(id));
}

export function parentsWithChildren(doc: Tracks): Set<string> {
  return new Set(clipsOf(doc).flatMap((c) => (c.parent ? [c.parent] : [])));
}

export function parentProblem(doc: Tracks): string | null {
  const parents = parentMap(doc);
  const visual = visualIds(doc);
  for (const [id, parent] of parents) {
    if (!parent) {
      continue;
    }
    if (parent === id) {
      return `${id} cannot be its own parent`;
    }
    if (!visual.has(parent) || !visual.has(id)) {
      return `${id}: the parent ${parent} must be a visual clip of this video`;
    }
    const seen = new Set([id]);
    for (let at: string | null = parent; at; at = parents.get(at) ?? null) {
      if (seen.has(at)) {
        return `${id} → ${parent}: parenting would make a loop`;
      }
      seen.add(at);
    }
  }
  return null;
}

export function pivotBox(props: Record<string, unknown>, size: Size): Box {
  const { x, y, width = 0, height = 0 } = props as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') {
    return { left: 0, top: 0, width: size.width, height: size.height };
  }
  const w = Number(width) * size.width;
  const h = Number(height) * size.height;
  return { left: x * size.width - w / 2, top: y * size.height - h / 2, width: w, height: h };
}

export function pivotOf(clip: Pick<Posed, 'props' | 'transform'>, size: Size): [number, number] {
  const box = pivotBox(clip.props, size);
  const ax = clip.transform.anchorX ?? TRANSFORM.anchorX.fallback;
  const ay = clip.transform.anchorY ?? TRANSFORM.anchorY.fallback;
  return [box.left + ax * box.width, box.top + ay * box.height];
}

export function transformAt(clip: Pick<Posed, 'from' | 'transform' | 'keyframes'>, key: TransformKey, frame: number): number {
  const track = clip.keyframes[key];
  return track?.length ? sampleTrack(track, frame - clip.from) : (clip.transform[key] ?? TRANSFORM[key].fallback);
}


export function localAt(clip: Posed, frame: number, size: Size): Affine {
  const at = (key: TransformKey) => transformAt(clip, key, frame);
  return composeLocal({ x: at('x') * size.width, y: at('y') * size.height, rotateZ: at('rotateZ'), scaleX: at('scale') * at('scaleX'), scaleY: at('scale') * at('scaleY') }, pivotOf(clip, size));
}


export function decomposeLocal(m: Affine, [ox, oy]: [number, number]): Pose2d {
  const scaleX = Math.hypot(m[0], m[1]);
  const rotateZ = Math.atan2(m[1], m[0]) / DEG;
  const scaleY = (m[0] * m[3] - m[1] * m[2]) / scaleX;
  const [lx, ly] = apply2d([m[0], m[1], m[2], m[3], 0, 0], [ox, oy]);
  return { x: m[4] - ox + lx, y: m[5] - oy + ly, rotateZ, scaleX, scaleY };
}

export function worldAt(doc: Tracks, clipId: string, frame: number, size: Size): Affine {
  const byId = new Map(clipsOf(doc).map((c) => [c.id, c]));
  return [...ancestorsOf(doc, clipId), clipId].reduce<Affine>((m, id) => {
    const clip = byId.get(id);
    return clip ? mul2d(m, localAt(clip, frame, size)) : m;
  }, IDENTITY);
}
