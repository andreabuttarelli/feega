import { compOf, type MotionDoc } from '@feega/motion-core/motion/doc';
import { ElementState } from '@feega/motion-core/motion/states/model';
import type { FrameRect, FrameSize } from '$lib/motion/prototype/hotspots';
import { changeTo, clipById, isInstance, placedClips, type Swaps } from '$lib/motion/prototype/variant-change';
import { setMembers } from '$lib/motion/variants';
import { statePick } from './variant-states';
import { statedId, withStatedComps } from './stated-comps';

export enum StateSpotKind {
  Rows = 'rows',
  Variants = 'variants',
  Main = 'main'
}

export type StateSpot = { clip: string; path: string[]; box: FrameRect; kind: StateSpotKind };

const mainOf = (doc: MotionDoc, clip: string) => compOf(clipById(doc, clip)!)!;

function hasHoverVariant(doc: MotionDoc, clip: string): boolean {
  const [[prop, value]] = Object.entries(statePick(ElementState.Hover));
  return setMembers(doc, mainOf(doc, clip)).some(([, c]) => c.component?.variant?.[prop] === value);
}

const drawnHovered = (doc: MotionDoc, clip: string) => Boolean(withStatedComps(doc).comps[statedId(mainOf(doc, clip), ElementState.Hover)]);

const insideInstance = (doc: MotionDoc, path: readonly string[]) => path.slice(0, -1).some((id) => isInstance(doc, id));

function kindOf(doc: MotionDoc, path: string[]): StateSpotKind | null {
  const clip = clipById(doc, path.at(-1)!)!;
  if (clip.states?.length && !insideInstance(doc, path)) {
    return StateSpotKind.Rows;
  }
  if (!isInstance(doc, clip.id)) {
    return null;
  }
  if (hasHoverVariant(doc, clip.id)) {
    return StateSpotKind.Variants;
  }
  return drawnHovered(doc, clip.id) ? StateSpotKind.Main : null;
}

const HOLDS: Record<StateSpotKind, (doc: MotionDoc, clip: string, state: ElementState) => Swaps | null> = {
  [StateSpotKind.Rows]: () => null,
  [StateSpotKind.Variants]: (doc, clip, state) => {
    const swap = changeTo(doc, [clip], statePick(state));
    return swap ? { [swap.instance]: swap.comp } : null;
  },
  [StateSpotKind.Main]: (doc, clip, state) => {
    const id = statedId(mainOf(doc, clip), state);
    return withStatedComps(doc).comps[id] ? { [clip]: id } : null;
  }
};

export const stateHold = (doc: MotionDoc, spot: StateSpot, state: ElementState): Swaps | null => HOLDS[spot.kind](doc, spot.clip, state);

export function stateSpotsOf(doc: MotionDoc, size: FrameSize, rectOf: (path: readonly string[]) => FrameRect | null): StateSpot[] {
  return placedClips(doc).flatMap(({ path }) => {
    const kind = kindOf(doc, path);
    const rect = kind ? rectOf(path) : null;
    if (!kind || !rect) {
      return [];
    }
    return [{ clip: path.at(-1)!, path, kind, box: { left: rect.left / size.width, top: rect.top / size.height, width: rect.width / size.width, height: rect.height / size.height } }];
  });
}
