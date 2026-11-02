import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { FrameRect, FrameSize } from '$lib/motion/prototype/hotspots';
import { hasVariantStates } from './variant-states';
import { flatClips } from './nested';

export type StateSpot = { clip: string; box: FrameRect };
export type Parents = ReadonlyMap<string, string | null>;
type Point = { x: number; y: number };

export function stateSpotsOf(doc: MotionDoc, size: FrameSize, rectOf: (clip: string) => FrameRect | null): StateSpot[] {
  return [...flatClips(doc).values()].flatMap((clip) => {
    const rect = clip.states?.length || hasVariantStates(doc, clip) ? rectOf(clip.id) : null;
    if (!rect) {
      return [];
    }
    return [{ clip: clip.id, box: { left: rect.left / size.width, top: rect.top / size.height, width: rect.width / size.width, height: rect.height / size.height } }];
  });
}

export const parentsOf = (doc: MotionDoc): Parents => new Map([...flatClips(doc).values()].map((c) => [c.id, c.parent ?? null]));

const covers = ({ box }: StateSpot, { x, y }: Point) => x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;

function chainOf(id: string, parents: Parents): string[] {
  const chain: string[] = [];
  for (let at: string | null | undefined = id; at && !chain.includes(at); at = parents.get(at)) {
    chain.push(at);
  }
  return chain;
}

export function statesUnder(spots: readonly StateSpot[], parents: Parents, point: Point): string[] {
  const inside = spots.filter((s) => covers(s, point));
  if (!inside.length) {
    return [];
  }

  const innermost = inside.reduce((best, s) => (chainOf(s.clip, parents).length >= chainOf(best.clip, parents).length ? s : best));
  const stated = new Set(spots.map((s) => s.clip));
  return chainOf(innermost.clip, parents).filter((id) => stated.has(id));
}
