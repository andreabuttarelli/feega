import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { mixState, type ElementState } from '@feega/motion-core/motion/states/model';
import { inVariantState, pastHalfway } from './variant-states';

export type StatePick = { state: ElementState; amount: number };
export type StatePicks = Record<string, StatePick>;

type Tracks = MotionDoc['tracks'];

const withPicks = (tracks: Tracks, picks: StatePicks): Tracks =>
  tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => {
      const pick = picks[c.id];
      return pick && c.states?.length ? { ...c, ...mixState(c, pick.state, pick.amount) } : c;
    })
  }));

export function previewDoc(doc: MotionDoc, picks: StatePicks): MotionDoc {
  if (!Object.keys(picks).length) {
    return doc;
  }
  const comps = Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: withPicks(comp.tracks, picks) }]));
  return Object.entries(picks).reduce((shown, [clip, pick]) => (pastHalfway(pick.amount) ? (inVariantState(shown, clip, pick.state) ?? shown) : shown), { ...doc, tracks: withPicks(doc.tracks, picks), comps });
}
