import { COMPONENTS } from './components';
import { findClip, type Marker, type MotionClip, type MotionDoc, type MotionTrack } from './doc';
import { ClipEdge, moveClip, trimClip, type OpResult } from './timeline';

const fail = (error: string): OpResult => ({ ok: false, error });
const ok = (doc: MotionDoc): OpResult => ({ ok: true, doc });

const byFrame = (a: Marker, b: Marker) => a.frame - b.frame;

export function addMarker(doc: MotionDoc, input: { frame: number; label: string; clipId?: string }): OpResult {
  const marker = { frame: Math.max(0, Math.round(input.frame)), label: input.label.trim() };
  if (!marker.label) {
    return fail('a marker needs a label');
  }
  if (!input.clipId) {
    const markers = doc.markers ?? [];
    return markers.some((m) => m.label === marker.label) ? fail(`a marker called ${marker.label} already exists`) : ok({ ...doc, markers: [...markers, marker].sort(byFrame) });
  }
  const found = findClip(doc, input.clipId);
  if (!found) {
    return fail(`no clip ${input.clipId}`);
  }
  const markers = found.clip.markers ?? [];
  if (markers.some((m) => m.label === marker.label)) {
    return fail(`${input.clipId} already has a marker called ${marker.label}`);
  }
  return ok(withClip(doc, input.clipId, (c) => ({ ...c, markers: [...markers, marker].sort(byFrame) })));
}

export function removeMarker(doc: MotionDoc, label: string, clipId?: string): OpResult {
  if (!clipId) {
    return ok({ ...doc, markers: (doc.markers ?? []).filter((m) => m.label !== label) });
  }
  return findClip(doc, clipId) ? ok(withClip(doc, clipId, (c) => ({ ...c, markers: (c.markers ?? []).filter((m) => m.label !== label) }))) : fail(`no clip ${clipId}`);
}

export function allMarkers(doc: MotionDoc): { frame: number; label: string; clipId: string | null }[] {
  const comp = (doc.markers ?? []).map((m) => ({ ...m, clipId: null }));
  const clips = doc.tracks.flatMap((t) => t.clips.flatMap((c) => (c.markers ?? []).map((m) => ({ frame: c.from + m.frame, label: m.label, clipId: c.id }))));
  return [...comp, ...clips];
}

export function markerFrame(doc: MotionDoc, label: string): number | null {
  return allMarkers(doc).find((m) => m.label === label)?.frame ?? null;
}

export function setWorkArea(doc: MotionDoc, area: { from: number; to: number } | null): OpResult {
  if (!area) {
    return ok({ ...doc, workArea: null });
  }
  const from = Math.max(0, Math.round(area.from));
  const to = Math.min(doc.durationInFrames, Math.round(area.to));
  return to > from ? ok({ ...doc, workArea: { from, to } }) : fail('the work area needs its out point after its in point');
}

export function loopFrame(doc: MotionDoc, frame: number): number {
  const area = doc.workArea;
  if (!area) {
    return frame;
  }
  return frame >= area.to || frame < area.from ? area.from : frame;
}

type Flags = { hidden?: boolean; locked?: boolean };
type ClipFlags = Flags & { bleed?: boolean };

export function setTrackFlags(doc: MotionDoc, trackId: string, flags: Flags): OpResult {
  return doc.tracks.some((t) => t.id === trackId) ? ok({ ...doc, tracks: doc.tracks.map((t) => (t.id === trackId ? { ...t, ...flags } : t)) }) : fail(`no track ${trackId}`);
}

export function setClipFlags(doc: MotionDoc, clipId: string, flags: ClipFlags): OpResult {
  return findClip(doc, clipId) ? ok(withClip(doc, clipId, (c) => ({ ...c, ...flags }))) : fail(`no clip ${clipId}`);
}

export function withoutHidden(doc: MotionDoc): MotionDoc {
  return { ...doc, tracks: doc.tracks.filter((t) => !t.hidden).map((t) => ({ ...t, clips: t.clips.filter((c) => !c.hidden) })) };
}

export function isLocked(doc: MotionDoc, clipId: string): boolean {
  const found = findClip(doc, clipId);
  return !!(found?.clip.locked || found?.track.locked);
}

export type TrackView = { solo: readonly string[]; shy: readonly string[]; hideShy: boolean; filter: string };

export function clipName(clip: Pick<MotionClip, 'component' | 'props'>): string {
  const p = clip.props as { text?: string; title?: string; name?: string };
  return (clip.component === 'Custom' ? p.name : undefined) ?? p.text?.split('\n')[0] ?? p.title ?? COMPONENTS[clip.component].label;
}

export function shownTracks(doc: MotionDoc, view: TrackView): MotionTrack[] {
  const needle = view.filter.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(needle);
  return doc.tracks
    .filter((t) => !view.solo.length || view.solo.includes(t.id))
    .filter((t) => !(view.hideShy && view.shy.includes(t.id)))
    .map((t) => (!needle || matches(t.name) ? t : { ...t, clips: t.clips.filter((c) => matches(clipName(c as MotionClip)) || matches(c.id)) }))
    .filter((t) => !needle || t.clips.length > 0);
}

export enum Align {
  Start = 'start',
  End = 'end'
}

function placed(doc: MotionDoc, ids: readonly string[]): MotionClip[] {
  return ids.map((id) => findClip(doc, id)?.clip).filter((c): c is MotionClip => !!c);
}

function moveAll(doc: MotionDoc, ids: readonly string[], startOf: (clip: MotionClip, index: number, clips: MotionClip[]) => number): OpResult {
  const locked = ids.find((id) => isLocked(doc, id));
  if (locked) {
    return fail(`${locked} is locked`);
  }
  const clips = placed(doc, ids).sort((a, b) => a.from - b.from);
  return clips.reduce<OpResult>((r, clip, i) => (r.ok ? moveClip(r.doc, clip.id, { from: startOf(clip, i, clips) }) : r), ok(doc));
}

export function nudgeClips(doc: MotionDoc, ids: readonly string[], frames: number): OpResult {
  return moveAll(doc, ids, (c) => Math.max(0, c.from + frames));
}

const STARTS_FOR_EDGE: Record<ClipEdge, (clip: MotionClip, frame: number) => number> = {
  [ClipEdge.Start]: (_clip, frame) => frame,
  [ClipEdge.End]: (clip, frame) => Math.max(0, frame - clip.durationInFrames)
};

export function clipsTo(doc: MotionDoc, ids: readonly string[], edge: ClipEdge, frame: number): OpResult {
  return moveAll(doc, ids, (c) => STARTS_FOR_EDGE[edge](c, frame));
}

export function trimClipsAt(doc: MotionDoc, ids: readonly string[], edge: ClipEdge, frame: number): OpResult {
  const locked = ids.find((id) => isLocked(doc, id));
  if (locked) {
    return fail(`${locked} is locked`);
  }
  return ids.reduce<OpResult>((r, id) => (r.ok ? trimClip(r.doc, id, edge, frame) : r), ok(doc));
}

export function sequenceClips(doc: MotionDoc, ids: readonly string[], gap: number): OpResult {
  return moveAll(doc, ids, (_c, i, clips) => clips[0].from + clips.slice(0, i).reduce((sum, c) => sum + c.durationInFrames + gap, 0));
}

export function staggerClips(doc: MotionDoc, ids: readonly string[], step: number): OpResult {
  return moveAll(doc, ids, (_c, i, clips) => clips[0].from + i * step);
}

const ALIGN: Record<Align, (clip: MotionClip, clips: MotionClip[]) => number> = {
  [Align.Start]: (_c, clips) => clips[0].from,
  [Align.End]: (c, clips) => Math.max(...clips.map((x) => x.from + x.durationInFrames)) - c.durationInFrames
};

export function alignClips(doc: MotionDoc, ids: readonly string[], align: Align): OpResult {
  return moveAll(doc, ids, (c, _i, clips) => ALIGN[align](c, clips));
}

export function distributeClips(doc: MotionDoc, ids: readonly string[]): OpResult {
  return moveAll(doc, ids, (_c, i, clips) => Math.round(clips[0].from + ((clips[clips.length - 1].from - clips[0].from) * i) / Math.max(1, clips.length - 1)));
}

function withClip(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionClip): MotionDoc {
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? edit(c as MotionClip) : c)) })) };
}
