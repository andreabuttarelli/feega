import { DEFAULT_COLOUR } from './default-colours';
import { TrackKind, defaultProps } from './components';
import { Background, findClip, newClip, type MotionClip, type MotionDoc, type MotionTrack } from './doc';
import { FillType } from './fill/model';
import { transformAt } from './parent';
import { ShapeKind } from './shape/schema';
import { cornerRadii, type Corners } from './shape/geometry';

const SURFACE_NAME = 'Frame';
const MAX_ROUNDNESS = 0.5;

const surfaceProps = () => ({
  ...defaultProps('Shape'),
  shape: ShapeKind.Rect,
  x: 0.5,
  y: 0.5,
  width: 1,
  height: 1,
  fills: [{ type: FillType.Solid, color: DEFAULT_COLOUR.surface, opacity: 1, visible: true }],
  strokes: []
});

export function frameSurface(doc: MotionDoc): MotionClip | null {
  return doc.surface ? (findClip(doc, doc.surface)?.clip ?? null) : null;
}

export function frameFadeAt(doc: MotionDoc, frame: number): number {
  const surface = frameSurface(doc);
  return surface ? transformAt(surface, 'opacity', frame) : 1;
}

export function unfaded(doc: MotionDoc): MotionDoc {
  if (!frameSurface(doc)) {
    return doc;
  }

  const plain = (c: MotionClip): MotionClip => {
    const { opacity: _o, ...transform } = c.transform;
    const { opacity: _k, ...keyframes } = c.keyframes;
    return { ...c, transform, keyframes };
  };

  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === doc.surface ? plain(c) : c)) })) };
}

export const clipsContent = (doc: MotionDoc): boolean => frameSurface(doc)?.clipContent !== false;

export function clipRadii(doc: MotionDoc): Corners | null {
  const surface = frameSurface(doc);
  if (!surface || surface.clipContent === false) {
    return null;
  }

  const props = surface.props as { roundness?: number; corners?: number[] };
  const radii = cornerRadii(props.roundness ?? 0, props.corners ?? []).map((r) => Math.min(Math.max(r, 0), MAX_ROUNDNESS)) as Corners;

  return radii.some((r) => r > 0) ? radii : null;
}

export const isLayer = (doc: MotionDoc, id: string): boolean => id !== doc.surface && !!findClip(doc, id);

export const layerTracks = <T extends { clips: readonly { id: string }[] }>(doc: Pick<MotionDoc, 'surface'>, tracks: readonly T[]): T[] => tracks.filter((t) => !t.clips.some((c) => c.id === doc.surface));

function spanned(doc: MotionDoc, id: string): MotionDoc {
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, from: 0, durationInFrames: doc.durationInFrames } : c)) })) };
}

export function withSurface(doc: MotionDoc, id: string): MotionDoc {
  const existing = frameSurface(doc);
  if (existing) {
    return spanned(doc, existing.id);
  }

  const clip = newClip({ id, name: SURFACE_NAME, from: 0, durationInFrames: doc.durationInFrames, component: 'Shape', props: surfaceProps(), locked: true, clipContent: true });
  const track: MotionTrack = { id, kind: TrackKind.Visual, name: SURFACE_NAME, clips: [clip] };
  const firstAudio = doc.tracks.findIndex((t) => t.kind === TrackKind.Audio);
  const at = firstAudio < 0 ? doc.tracks.length : firstAudio;
  const tracks = [...doc.tracks.slice(0, at), track, ...doc.tracks.slice(at)];

  return { ...doc, tracks, surface: id, background: Background.Transparent };
}

export function dropSurface(doc: MotionDoc): MotionDoc {
  const id = doc.surface;
  if (!id) {
    return doc;
  }

  const { surface: _, ...rest } = doc;
  const tracks = doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })).filter((t) => t.clips.length > 0 || t.id !== id);

  return { ...rest, tracks, background: Background.Brand };
}
