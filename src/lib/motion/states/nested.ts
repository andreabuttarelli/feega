import { clipsOf, compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { flattenComps, SEPARATOR } from '@feega/motion-core/motion/precomp';
import { mixState } from '@feega/motion-core/motion/states/model';
import { nestedOverrides, type ClipPath, type PathChange } from '$lib/motion/nested-overrides';
import type { Overrides } from '$lib/motion/main-component';
import { pastHalfway, stateVariantOf } from './variant-states';
import type { StatePick, StatePicks } from './preview';

export const flatClips = (doc: MotionDoc): Map<string, MotionClip> => new Map(clipsOf(flattenComps(doc)).map((c) => [c.id, c]));

export const pathOf = (scoped: string): ClipPath => scoped.split(SEPARATOR).filter((_, i) => i % 2 === 0);

export const isNested = (scoped: string): boolean => pathOf(scoped).length > 1;

function changed(from: Record<string, unknown>, to: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(to).filter(([k, v]) => from[k] !== v));
}

function overrideOf(doc: MotionDoc, clip: MotionClip, pick: StatePick): Record<string, unknown> | null {
  if (clip.states?.length) {
    const mixed = mixState(clip, pick.state, pick.amount);
    return { transform: mixed.transform, ...changed(clip.props, mixed.props) };
  }
  const variant = pastHalfway(pick.amount) ? stateVariantOf(doc, clip, pick.state) : null;
  return variant ? { comp: variant } : null;
}

function changesByHost(doc: MotionDoc, picks: StatePicks): Map<string, PathChange[]> {
  const clips = flatClips(doc);
  const hosts = new Map<string, PathChange[]>();
  for (const [scoped, pick] of Object.entries(picks)) {
    const clip = clips.get(scoped);
    const props = clip ? overrideOf(doc, clip, pick) : null;
    if (!props) {
      continue;
    }
    const [host, ...path] = pathOf(scoped);
    hosts.set(host, [...(hosts.get(host) ?? []), { path, props }]);
  }
  return hosts;
}

export function withNestedPicks(doc: MotionDoc, picks: StatePicks): MotionDoc {
  const hosts = changesByHost(doc, picks);
  if (!hosts.size) {
    return doc;
  }

  const hosted = (clip: MotionClip): MotionClip => {
    const changes = hosts.get(clip.id);
    const comp = changes ? compOf(clip) : null;
    if (!changes || !comp) {
      return clip;
    }
    const overrides = nestedOverrides(doc, comp, changes, (clip.props.overrides as Overrides | undefined) ?? {});
    return { ...clip, props: { ...clip.props, overrides } };
  };
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map(hosted) })) };
}
