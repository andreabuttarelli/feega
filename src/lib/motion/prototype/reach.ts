import { clipsOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ActionKind } from '@feega/motion-core/motion/prototype/model';

const FRAME_ACTIONS: ReadonlySet<ActionKind> = new Set([ActionKind.Navigate, ActionKind.OpenOverlay, ActionKind.ScrollTo]);

function targetsOf(doc: MotionDoc): string[] {
  return clipsOf(doc).flatMap((clip) => (clip.interactions ?? []).flatMap((i) => (FRAME_ACTIONS.has(i.action.kind) && 'target' in i.action ? [i.action.target] : [])));
}

export function reachableFrom(docs: ReadonlyMap<string, MotionDoc>, start: string): string[] {
  const seen: string[] = [];
  const queue = docs.has(start) ? [start] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.includes(id)) {
      continue;
    }
    seen.push(id);
    queue.push(...targetsOf(docs.get(id)!).filter((t) => docs.has(t)));
  }
  return seen;
}
