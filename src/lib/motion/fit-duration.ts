import { TrackKind, type ComponentId } from './components';
import type { MotionDoc } from './doc';
import { STYLES, styleOf } from './style';
import type { OpResult } from './timeline';

type Clip = MotionDoc['tracks'][number]['clips'][number];

export type Span = { from: number; to: number };

const SCENERY: ReadonlySet<ComponentId> = new Set(['BrandBackground', 'Adjustment', 'Particles', 'Null', 'Shape'] as ComponentId[]);

function visibleUntil(clip: Clip): number {
  const opacity = clip.keyframes.opacity ?? [];
  const last = opacity.at(-1);
  return last && Number(last.value) <= 0 ? Math.min(clip.durationInFrames, last.frame) : clip.durationInFrames;
}

export function shownSpans(doc: MotionDoc, tracks: MotionDoc['tracks'], offset: number, end: number): Span[] {
  return tracks
    .filter((t) => t.kind === TrackKind.Visual)
    .flatMap((t) => t.clips as Clip[])
    .flatMap((clip): Span[] => {
      const from = offset + clip.from;
      const to = Math.min(end, from + visibleUntil(clip));
      const nested = clip.component === 'Precomp' ? doc.comps[String(clip.props.comp)] : undefined;
      if (nested) {
        return shownSpans(doc, nested.tracks, from - clip.trimStart, to).filter((s) => s.to > from).map((s) => ({ from: Math.max(from, s.from), to: s.to }));
      }
      return SCENERY.has(clip.component) ? [] : [{ from, to }];
    });
}

export const contentEnd = (doc: MotionDoc) => Math.max(0, ...shownSpans(doc, doc.tracks, 0, doc.durationInFrames).map((s) => s.to));

const holdFrames = (doc: MotionDoc) => Math.round(STYLES[styleOf(doc)].pace.hold * doc.fps);

const endsAt = (clip: Clip, frame: number) => clip.from + clip.durationInFrames === frame && visibleUntil(clip) === clip.durationInFrames;

function heldTracks(doc: MotionDoc, end: number, hold: number): MotionDoc['tracks'] {
  return doc.tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => (t.kind === TrackKind.Visual && !SCENERY.has(c.component) && endsAt(c, end) ? { ...c, durationInFrames: c.durationInFrames + hold } : c))
  }));
}

function cutTracks(tracks: MotionDoc['tracks'], end: number): MotionDoc['tracks'] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.filter((c) => c.from < end).map((c) => ({ ...c, durationInFrames: Math.min(c.durationInFrames, end - c.from) }))
  }));
}

export function fitDuration(doc: MotionDoc): OpResult {
  const end = contentEnd(doc);
  if (end === 0) {
    return { ok: false, error: 'nothing is on screen yet: add content before fitting the duration' };
  }

  const tracks = heldTracks(doc, end, holdFrames(doc));
  const held = tracks.some((t, i) => t.clips.some((c, j) => c !== doc.tracks[i].clips[j]));
  const target = held ? end + holdFrames(doc) : end;
  const workArea = doc.workArea && doc.workArea.to > target ? null : doc.workArea;

  return { ok: true, doc: { ...doc, durationInFrames: target, tracks: cutTracks(tracks, target), workArea } };
}

export function fitNewVideo(start: MotionDoc, built: MotionDoc): MotionDoc {
  const sized = built.durationInFrames !== start.durationInFrames;
  if (sized || contentEnd(start) > 0 || contentEnd(built) === 0) {
    return built;
  }
  const fitted = fitDuration(built);
  return fitted.ok ? fitted.doc : built;
}
