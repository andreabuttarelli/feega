import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { resolveAt, type Breakpoint } from '@feega/motion-core/motion/breakpoints/model';
import { changedLook, lookOf, LookKey, minSideOf, type Look } from '$lib/canvas/code-look';

const VIEW_KEYS = [LookKey.Size, LookKey.Gap, LookKey.Padding, LookKey.Direction];

const SEPARATOR = ':';

const viewKey = (view: string, key: LookKey) => `${view}${SEPARATOR}${key}`;

const topClips = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips) as MotionClip[];

function looksAt(doc: MotionDoc, view: Breakpoint): Map<string, Look> {
  const resolved = resolveAt(doc, view.id);
  const side = minSideOf(resolved);
  return new Map(topClips(resolved).map((c) => [c.id, lookOf(c, side)]));
}

export function viewBaselined(doc: MotionDoc): MotionDoc {
  const views = doc.breakpoints ?? [];
  if (!views.length) {
    return doc;
  }

  const looks = views.map((view) => ({ view, looks: looksAt(doc, view) }));
  const tracks = doc.tracks.map((t) => ({
    ...t,
    clips: (t.clips as MotionClip[]).map((clip) => {
      if (!clip.source) {
        return clip;
      }
      const was = looks.flatMap(({ view, looks: at }) => VIEW_KEYS.flatMap((key) => (at.get(clip.id)?.[key] === undefined ? [] : [[viewKey(view.id, key), at.get(clip.id)![key]] as const])));
      return { ...clip, source: { ...clip.source, was: { ...clip.source.was, ...Object.fromEntries(was) } } };
    })
  }));
  return { ...doc, tracks } as MotionDoc;
}

export type ViewChange = { clip: MotionClip; view: Breakpoint; look: Look; was: Look };

export function viewChanges(doc: MotionDoc): ViewChange[] {
  const views = doc.breakpoints ?? [];
  const side = minSideOf(doc);
  return views.flatMap((view) => {
    const now = looksAt(doc, view);
    return topClips(doc).flatMap((clip) => {
      const base = changedLook(clip, side);
      const keys = VIEW_KEYS.filter((key) => {
        const was = clip.source?.was[viewKey(view.id, key)];
        const value = now.get(clip.id)?.[key];
        return was !== undefined && value !== undefined && value !== was && !(key in base);
      });
      const look = Object.fromEntries(keys.map((key) => [key, now.get(clip.id)![key]]));
      const was = Object.fromEntries(keys.map((key) => [key, clip.source!.was[viewKey(view.id, key)]]));
      return keys.length ? [{ clip, view, look, was }] : [];
    });
  });
}
